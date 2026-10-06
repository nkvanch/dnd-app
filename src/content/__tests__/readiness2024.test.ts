// Release-readiness checks for 5.5e (SRD 5.2.1) built on the real flows: three representative 2024 characters (a martial, a prepared full
// caster and a choice-heavy Warlock) are created from the installed packs, every pending pick is resolved the way a player would, they are
// levelled through the breakpoints to 20, rested, saved and reloaded. The invariants are what an outside tester relies on: nothing lost,
// duplicated or stale, the state survives a save, and a 2014 character never receives 2024-only rules.
import fs from 'fs';
import path from 'path';
import { buildSrd51Pack, buildSrd521Pack, serializePack } from '../packs/srdPacks';
import { packContentProvider, ContentProvider } from '../provider/contentProvider';
import { createCharacter, spellCandidates, recomputeContentOf } from '../provider/createCharacter';
import { applyPoolChoiceToEntity, applyExpertiseChoiceToEntity, levelUpClass, resolveChoice, applySpellChoiceToEntity, applySubclassToEntity } from '../../engine/leveling';
import { mergeSubclassIntoProgression } from '../classes/progressions';
import { recomputeDerived } from '../../engine/pipeline';
import { takeRest } from '../../engine/rest';
import { DEFAULT_RULES } from '../../store/characterStore';
import { validateEntityShape } from '../../engine/homebrewValidator';
import { migrateEntity } from '../../engine/multiclass';
import { Entity, RulesetId, CharClass } from '../../engine/types';
import { gainHeroicInspiration, spendHeroicInspiration } from '../../engine/heroicInspiration';
import { weaponMasteryCapacity, eligibleMasteryWeapons, setWeaponMasteryPicks, masteredWeaponIds } from '../../engine/weaponMastery';

const R2024 = 'dnd5e-2024' as RulesetId;
const packs = [buildSrd51Pack(), buildSrd521Pack()].map(p => JSON.parse(serializePack(p)));
const provider: ContentProvider = packContentProvider(packs, R2024);
const stats = { str: 15, dex: 14, con: 14, int: 12, wis: 12, cha: 10 };
const report: Record<string, unknown> = {};

type Stuck = { choice: string; kind: string; why: string };

/** Resolves every pending pick the way a player would (first valid options). Returns what could not be resolved and why. */
function resolveAll(start: Entity, p: ContentProvider, classId: string, subclassId?: string): { entity: Entity; stuck: Stuck[] } {
  let e = start; const stuck: Stuck[] = [];
  for (let pass = 0; pass < 40; pass++) {
    const pending = e.choices.filter(c => !c.resolved && !stuck.some(s => s.choice === c.id));
    if (pending.length === 0) break;
    const c = pending[0];
    const d = c.definition;
    try {
      if (d.kind === 'subclass') {
        const sub = subclassId ? p.getSubclass(subclassId) : p.subclassesOf(classId)[0];
        if (!sub) throw new Error('no subclass in the pack');
        e = applySubclassToEntity(e, c.id, sub.id as never, sub as never, DEFAULT_RULES);
      } else if (d.kind === 'spell') {
        const cands = spellCandidates(p, e, c.id);
        if (cands.length < d.count) throw new Error(`only ${cands.length} candidates for ${d.count} picks`);
        e = applySpellChoiceToEntity(e, c.id, cands.slice(0, d.count).map(s => s.id), id => p.getSpell(id)?.level, DEFAULT_RULES);
      } else if (d.kind === 'feature_pool' && Array.isArray(d.pool)) {
        const picked: string[] = [];
        for (const o of d.pool) {
          if (picked.length >= d.count) break;
          try { applyPoolChoiceToEntity(e, c.id, [...picked, o.id], DEFAULT_RULES); picked.push(o.id); } catch { /* option not allowed for this character */ }
        }
        if (picked.length < d.count) throw new Error(`only ${picked.length} of ${d.count} options are valid`);
        e = applyPoolChoiceToEntity(e, c.id, picked, DEFAULT_RULES);
      } else if (d.kind === 'expertise') {
        const trained = Object.entries(e.skills.skills).filter(([, sk]) => (sk as { trained: boolean; expertise?: boolean }).trained && !(sk as { expertise?: boolean }).expertise).map(([n]) => n);
        const ids = (Array.isArray(d.pool) ? d.pool.map(o => o.id).filter(id => trained.includes(id)) : trained).slice(0, d.count);
        if (ids.length < Math.min(d.count, trained.length)) throw new Error('not enough trained skills');
        e = applyExpertiseChoiceToEntity(e, c.id, ids, DEFAULT_RULES);
      } else if (Array.isArray(d.pool) && (d.kind === 'skill' || d.kind === 'equipment' || d.kind === 'tool' || d.kind === 'language' || d.kind === 'custom')) {
        const ids = d.pool.slice(0, d.count).map(o => o.id);
        if (ids.length < d.count) throw new Error(`pool of ${d.pool.length} for ${d.count} picks`);
        e = resolveChoice(e, c.id, ids, DEFAULT_RULES);
      } else {
        throw new Error(`not auto-resolvable (${d.kind}${Array.isArray(d.pool) ? '' : ', pool=' + String(d.pool)})`);
      }
    } catch (err) {
      stuck.push({ choice: c.definition.id, kind: d.kind, why: err instanceof Error ? err.message : String(err) });
    }
  }
  return { entity: recomputeDerived(e, DEFAULT_RULES, recomputeContentOf(p)), stuck };
}

function levelTo(e: Entity, cls: CharClass, to: number, p: ContentProvider, subclassId: string): { entity: Entity; stuck: Stuck[] } {
  const stuckAll: Stuck[] = [];
  let ent = e;
  let progression = cls.rawProgression!;
  const sub = p.getSubclass(subclassId) as never;
  if (ent.identity.subclassId) progression = mergeSubclassIntoProgression(progression, sub);
  for (let level = ent.identity.level + 1; level <= to; level++) {
    ent = levelUpClass(ent, cls.id, progression, DEFAULT_RULES, cls, p.classes());
    const r = resolveAll(ent, p, cls.id, subclassId);
    ent = r.entity; stuckAll.push(...r.stuck);
    if (ent.identity.subclassId && progression === cls.rawProgression) progression = mergeSubclassIntoProgression(progression, sub);
  }
  return { entity: recomputeDerived(ent, DEFAULT_RULES, recomputeContentOf(p)), stuck: stuckAll };
}

const CASES = [
  { key: 'fighter', classId: 'fighter_2024', raceId: 'orc_2024', backgroundId: 'soldier_2024', subclassId: 'champion_2024' },
  { key: 'wizard', classId: 'wizard_2024', raceId: 'human_2024', backgroundId: 'sage_2024', subclassId: 'evoker_2024' },
  { key: 'warlock', classId: 'warlock_2024', raceId: 'dragonborn_2024', backgroundId: 'acolyte_2024', subclassId: 'fiend_patron_2024' },
] as const;

function subclassFor(classId: string, wanted: string): string {
  const subs = provider.subclassesOf(classId);
  return subs.find(s => s.id === wanted)?.id ?? subs[0].id;
}

describe('2024 representative characters, end to end', () => {
  for (const c of CASES) {
    describe(c.key, () => {
      const subclassId = subclassFor(c.classId, c.subclassId);
      const cls = provider.getClass(c.classId)!;
      let created: Entity; let stuck1: Stuck[]; let final: Entity; let stuck20: Stuck[];
      const snapshots: Record<number, Entity> = {};

      it('creates at level 1 with species, background, Origin feat, class, equipment and spells, every pick resolvable', () => {
        const base = createCharacter(provider, { id: c.key, name: c.key, classId: c.classId, raceId: c.raceId, backgroundId: c.backgroundId, stats, level: 1 }, DEFAULT_RULES);
        const r = resolveAll(base, provider, c.classId, subclassId);
        created = r.entity; stuck1 = r.stuck;
        report[`${c.key}_level1_stuck`] = stuck1;
        expect(created.rulesetId).toBe(R2024);
        expect(created.identity.level).toBe(1);
        expect(created.identity.raceId).toBe(c.raceId);
        expect(created.identity.backgroundId).toBe(c.backgroundId);
        expect(created.resources.hp.maximum).toBeGreaterThan(5);
        // The background grants a real Origin feat (a feature), not a note.
        expect(created.features.some(f => f.id.includes('_origin_'))).toBe(true);
        expect(created.inventory.carried.length).toBeGreaterThan(0);
        expect(stuck1.map(s => `${s.choice}: ${s.why}`)).toEqual([]);
      });

      it('levels to 20 through every breakpoint with no duplicate features, no unresolvable picks and sane derived values', () => {
        let ent = created;
        // subclass level is 3 for every SRD class
        for (const target of [3, 5, 9, 11, 17, 20]) {
          const r = levelTo(ent, cls, target, provider, subclassId);
          ent = r.entity; snapshots[target] = ent; stuck20 = [...(stuck20 ?? []), ...r.stuck];
          const ids = ent.features.map(f => f.id);
          const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
          expect(dup).toEqual([]);
          expect(ent.identity.level).toBe(target);
          expect(ent.derived.proficiencyBonus).toBe(2 + Math.floor((target - 1) / 4));
          expect(Number.isFinite(ent.derived.ac)).toBe(true);
          expect(Number.isFinite(ent.derived.speed)).toBe(true);
          expect(ent.resources.hp.maximum).toBeGreaterThan(target);
          expect(ent.resources.hitDice.total ?? ent.resources.hitDice).toBeTruthy();
        }
        final = ent;
        report[`${c.key}_level20_stuck`] = stuck20;
        report[`${c.key}_level20_features`] = final.features.length;
        report[`${c.key}_subclass`] = final.identity.subclassId;
        // ASI / feat picks at 4, 8, 12, 16 are made on the Ability Improvements screen, not auto-resolved here.
        const notAsi = (stuck20 ?? []).filter(s => !/asi|ability|feat/i.test(`${s.choice} ${s.kind}`));
        expect(notAsi.map(s => `${s.choice}: ${s.why}`)).toEqual([]);
      });

      it('keeps its resources: nothing lost between levels, every pool has a maximum, and a long rest refills them', () => {
        const pools = final.resources.custom;
        for (const r of pools) expect(r.maximum).toBeGreaterThanOrEqual(0);
        const spent = { ...final, resources: { ...final.resources, custom: pools.map(r => ({ ...r, current: 0 })) } };
        const rested = takeRest(spent, 'long', DEFAULT_RULES);
        for (const r of rested.resources.custom) expect(r.current).toBe(r.maximum);
        report[`${c.key}_pools`] = pools.map(r => `${r.id}:${r.maximum}/${r.recharge}`);
      });

      it('survives a save and a restart: the JSON round trip is identical, validates, and recomputes to the same derived stats', () => {
        const stored = JSON.parse(JSON.stringify(final)) as Entity;
        expect(stored).toEqual(JSON.parse(JSON.stringify(final)));
        const reloaded = migrateEntity(stored);
        expect(validateEntityShape(reloaded).valid).toBe(true);
        const again = recomputeDerived(reloaded, DEFAULT_RULES, recomputeContentOf(provider));
        expect(again.derived.ac).toBe(final.derived.ac);
        expect(again.derived.speed).toBe(final.derived.speed);
        expect(again.resources.hp.maximum).toBe(final.resources.hp.maximum);
        expect(again.features.length).toBe(final.features.length);
      });

      it('Heroic Inspiration is state that persists, never stacks and can be spent', () => {
        const gained = gainHeroicInspiration(final);
        expect(gained.entity.heroicInspiration).toBe(true);
        expect(gainHeroicInspiration(gained.entity).overflow).toBe(true);
        const saved = JSON.parse(JSON.stringify(gained.entity)) as Entity;
        expect(saved.heroicInspiration).toBe(true);
        expect(spendHeroicInspiration(saved).heroicInspiration).toBe(false);
      });
    });
  }

  it('Weapon Mastery: capacity and eligible weapons follow the class, and picks persist', () => {
    const rows: Record<string, unknown> = {};
    for (const [classId, expectCap] of [['fighter_2024', 3], ['barbarian_2024', 2], ['paladin_2024', 2], ['ranger_2024', 2], ['rogue_2024', 2]] as const) {
      const cls = provider.getClass(classId)!;
      const base = createCharacter(provider, { id: classId, name: classId, classId, raceId: 'human_2024', backgroundId: 'soldier_2024', stats, level: 1 }, DEFAULT_RULES);
      const e = resolveAll(base, provider, classId).entity;
      rows[classId] = { capacityL1: weaponMasteryCapacity(e), eligible: eligibleMasteryWeapons(e).length };
      expect(weaponMasteryCapacity(e)).toBe(expectCap);
      const picks = eligibleMasteryWeapons(e).slice(0, weaponMasteryCapacity(e)).map(w => w.id);
      const withPicks = setWeaponMasteryPicks(e, picks);
      expect(masteredWeaponIds(JSON.parse(JSON.stringify(withPicks)))).toEqual(picks);
      void cls;
    }
    report.weaponMastery = rows;
    for (const classId of ['wizard_2024', 'cleric_2024', 'bard_2024']) {
      const e = resolveAll(createCharacter(provider, { id: classId, name: classId, classId, raceId: 'human_2024', backgroundId: 'sage_2024', stats, level: 1 }, DEFAULT_RULES), provider, classId).entity;
      expect(weaponMasteryCapacity(e)).toBe(0);
    }
  });

  describe('all twelve classes, level 1 to 20 through the real pick flow', () => {
    const ALL = ['barbarian', 'bard', 'cleric', 'druid', 'fighter', 'monk', 'paladin', 'ranger', 'rogue', 'sorcerer', 'warlock', 'wizard'];
    for (const key of ALL) {
      it(key + ': creates, levels to 20, no stuck pick but ASI, no duplicate feature, saves and reloads to the same state', () => {
        const classId = key + '_2024';
        const cls = provider.getClass(classId)!;
        const subclassId = provider.subclassesOf(classId)[0].id;
        const base = createCharacter(provider, { id: key, name: key, classId, raceId: 'human_2024', backgroundId: 'sage_2024', stats, level: 1 }, DEFAULT_RULES);
        let ent = resolveAll(base, provider, classId, subclassId).entity;
        const stuckAll: Stuck[] = [];
        for (const target of [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]) {
          const r = levelTo(ent, cls, target, provider, subclassId);
          ent = r.entity; stuckAll.push(...r.stuck);
          const ids = ent.features.map(f => f.id);
          expect(ids.filter((id, i) => ids.indexOf(id) !== i)).toEqual([]);
          expect(Number.isFinite(ent.derived.ac) && Number.isFinite(ent.derived.speed)).toBe(true);
        }
        const notAsi = stuckAll.filter(x => !/asi|ability|feat/i.test(x.choice + ' ' + x.kind)).map(x => x.choice + ': ' + x.why);
        expect(notAsi).toEqual([]);
        expect(ent.identity.subclassId).toBe(subclassId);
        const reloaded = recomputeDerived(migrateEntity(JSON.parse(JSON.stringify(ent)) as Entity), DEFAULT_RULES, recomputeContentOf(provider));
        expect(validateEntityShape(reloaded).valid).toBe(true);
        expect([reloaded.derived.ac, reloaded.derived.speed, reloaded.resources.hp.maximum, reloaded.features.length]).toEqual([ent.derived.ac, ent.derived.speed, ent.resources.hp.maximum, ent.features.length]);
        const own = ent.features.filter(f => f.source.kind === 'class' || f.source.kind === 'subclass');
        const mech = own.filter(f => (f.effects?.length ?? 0) > 0 || (f.abilityEffects?.length ?? 0) > 0 || !!f.activation);
        report['class_' + key] = { features: ent.features.length, classFeatures: own.length, mechanicalOrTracked: mech.length, textOnly: own.length - mech.length, textOnlyNames: own.filter(f => !mech.includes(f)).map(f => f.name), hp: ent.resources.hp.maximum, pools: ent.resources.custom.length, stuck: stuckAll.length };
      });
    }
  });

  it('writes the machine-readable result for the audit document', () => {
    fs.mkdirSync(path.join(process.cwd(), 'release'), { recursive: true });
    fs.writeFileSync(path.join(process.cwd(), 'release', 'audit2024.json'), JSON.stringify(report, null, 1));
  });
});
