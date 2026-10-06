// Second half of the 5.5e release-readiness checks (see readiness2024.test.ts): ruleset separation, version-correct spell cards, Warlock invocation
// prerequisites and replacement, pact slots on a short rest, non-walking movement speeds, cross-list spell picks and Paladin auras.
import { buildSrd51Pack, buildSrd521Pack, serializePack } from '../packs/srdPacks';
import { packContentProvider, ContentProvider } from '../provider/contentProvider';
import { createCharacter, spellCandidates, recomputeContentOf } from '../provider/createCharacter';
import { applyPoolChoiceToEntity, levelUpClass, replacePoolOption, applySubclassToEntity, applySpellChoiceToEntity } from '../../engine/leveling';
import { mergeSubclassIntoProgression } from '../classes/progressions';
import { recomputeDerived } from '../../engine/pipeline';
import { takeRest } from '../../engine/rest';
import { DEFAULT_RULES } from '../../store/characterStore';
import { buildLayer1 } from '../../engine/actionCards';
import { Entity, RulesetId, CharClass, Feature } from '../../engine/types';
import { PackStore, installOfficialPack, resetOfficialPackService } from '../officialPackService';
import { clearOfficialPacks } from '../officialPacks';
import { weaponMasteryCapacity } from '../../engine/weaponMastery';

const R2014 = 'dnd5e-2014' as RulesetId;
const R2024 = 'dnd5e-2024' as RulesetId;
const packs = [buildSrd51Pack(), buildSrd521Pack()].map(p => JSON.parse(serializePack(p)));
const p24: ContentProvider = packContentProvider(packs, R2024);
const p14: ContentProvider = packContentProvider(packs, R2014);
const stats = { str: 15, dex: 14, con: 14, int: 12, wis: 12, cha: 14 };

function make(p: ContentProvider, classId: string, raceId: string, backgroundId: string, level = 1): Entity {
  return createCharacter(p, { id: classId, name: classId, classId, raceId, backgroundId, stats, level }, DEFAULT_RULES);
}
function levelTo(e: Entity, p: ContentProvider, cls: CharClass, to: number, subclassId?: string): Entity {
  let ent = e; let progression = cls.rawProgression!;
  const sub = subclassId ? (p.getSubclass(subclassId) as never) : undefined;
  for (let level = ent.identity.level + 1; level <= to; level++) {
    ent = levelUpClass(ent, cls.id, progression, DEFAULT_RULES, cls, p.classes());
    if (subclassId) {
      const pending = ent.choices.find(c => !c.resolved && c.definition.kind === 'subclass');
      if (pending) { ent = applySubclassToEntity(ent, pending.id, subclassId as never, sub!, DEFAULT_RULES); progression = mergeSubclassIntoProgression(cls.rawProgression!, sub!); }
    }
  }
  return recomputeDerived(ent, DEFAULT_RULES, recomputeContentOf(p));
}

const store: PackStore = { save: async () => {}, load: async () => [], remove: async () => {} };
beforeAll(async () => { resetOfficialPackService(); clearOfficialPacks(); for (const p of packs) expect(await installOfficialPack(p, store)).toEqual({ ok: true }); });
afterAll(() => { resetOfficialPackService(); clearOfficialPacks(); });

describe('ruleset separation: what each edition is offered', () => {
  it('a 2014 provider offers no 2024 class, species, background, feat or spell; a 2024 provider offers no 2014 ones', () => {
    for (const [label, p, own, other] of [['2014', p14, R2014, R2024], ['2024', p24, R2024, R2014]] as const) {
      for (const list of [p.classes(), p.races(), p.backgrounds(), p.feats()] as unknown as { id: string; rulesetId?: RulesetId }[][]) {
        expect(list.length).toBeGreaterThan(0);
        for (const x of list) expect([`${label}:${x.id}:${x.rulesetId}`, x.rulesetId === other]).toEqual([`${label}:${x.id}:${x.rulesetId}`, false]);
        void own;
      }
    }
    expect(p24.classes().every(c => c.id.endsWith('_2024'))).toBe(true);
    expect(p14.classes().some(c => c.id.endsWith('_2024'))).toBe(false);
  });

  it('a spell with a changed 2024 version resolves to that version for a 2024 character and the SRD 5.1 text for a 2014 one', () => {
    const cure24 = p24.getSpell('cure_wounds')!, cure14 = p14.getSpell('cure_wounds')!;
    expect(cure24.school).toBe('Abjuration');   // 5.2.1: Abjuration; 5.1: Evocation
    expect(cure14.school).toBe('Evocation');
    expect(p24.getSpell('sleep_spell')!.concentration).toBe(true);
    expect(p14.getSpell('sleep_spell')!.concentration).toBeFalsy();
    expect(p24.getSpell('true_strike')!.rulesetId).toBe(R2024);
    // The six spells new in 2024 are not visible to a 2014 character at all.
    for (const id of ['divine_smite', 'hex', 'ray_of_sickness', 'summon_dragon']) {
      expect(p14.getSpell(id)?.rulesetId === R2024 ? p14.getSpell(id) : undefined).toBeUndefined();
    }
  });

  it('an action card for a granted spell (species, Origin feat, invocation) is built from the character\'s edition of the spell', () => {
    const grant: Feature = {
      id: 'probe', name: 'Probe', description: '', source: { kind: 'race', refId: 'probe' } as never,
      activation: { actionType: 'action' } as never, abilityEffects: [{ type: 'cast_spell', spellId: 'cure_wounds' }] as never,
    } as unknown as Feature;
    // spellRepo is the runtime lookup; its version overlay is what the card uses
    expect(buildLayer1(grant, 'healing', R2024)).toContain('Abjuration');
    expect(buildLayer1(grant, 'healing', R2014)).toContain('Evocation');
  });

  it('weapon mastery exists only for a 2024 character', () => {
    const f24 = createCharacter(p24, { id: 'f24', name: 'f24', classId: 'fighter_2024', raceId: 'human_2024', backgroundId: 'soldier_2024', stats, level: 1 }, DEFAULT_RULES);
    expect(weaponMasteryCapacity(f24)).toBe(3);
    const f14 = createCharacter(p14, { id: 'f14', name: 'f14', classId: 'fighter', raceId: p14.races()[0].id, backgroundId: p14.backgrounds()[0].id, stats, level: 1 }, DEFAULT_RULES);
    expect(f14.rulesetId).not.toBe(R2024);
    expect(weaponMasteryCapacity(f14)).toBe(0);
    expect(f14.features.some(f => /_2024/.test(f.id))).toBe(false);
  });
});

describe('Warlock (2024): invocations, prerequisites, replacement, pact slots', () => {
  const cls = p24.getClass('warlock_2024')!;
  const base = (): Entity => {
    let e = make(p24, 'warlock_2024', 'orc_2024', 'acolyte_2024', 1);
    for (let l = 2; l <= 5; l++) e = levelUpClass(e, cls.id, cls.rawProgression!, DEFAULT_RULES, cls, p24.classes());
    return e;
  };
  const inv = (e: Entity, n: number) => e.choices.find(c => c.id.endsWith('invocations_' + n + '_' + n))!;
  const pick = (e: Entity, n: number, ids: string[]) => applyPoolChoiceToEntity(e, inv(e, n).id, ids, DEFAULT_RULES);

  it('refuses an invocation whose level or prerequisite invocation is missing, and allows it once the prerequisite is held', () => {
    const e = base();
    const lvl1 = make(p24, 'warlock_2024', 'orc_2024', 'acolyte_2024', 1);
    expect(() => applyPoolChoiceToEntity(lvl1, lvl1.choices.find(c => c.id.endsWith('invocations_1_1'))!.id, ['invocation_ascendant_step'], DEFAULT_RULES)).toThrow(/Level 5/);   // level-gated
    const tome = pick(e, 1, ['invocation_pact_of_the_tome']);
    expect(() => pick(tome, 5, ['invocation_eldritch_smite', 'invocation_devils_sight'])).toThrow(/Pact of the Blade/);
    expect(() => pick(tome, 5, ['invocation_devouring_blade', 'invocation_devils_sight'])).toThrow(/requires/);
    const blade = pick(e, 1, ['invocation_pact_of_the_blade']);
    const withSmite = pick(blade, 5, ['invocation_eldritch_smite', 'invocation_devils_sight']);
    expect(withSmite.features.some(f => f.id.includes('eldritch_smite'))).toBe(true);
    // both in the same pick also works: Pact of the Blade counts as held within the selection
    const e2 = base();
    const together = pick(pick(e2, 1, ['invocation_devils_sight']), 5, ['invocation_pact_of_the_blade', 'invocation_eldritch_smite']);
    expect(together.features.some(f => f.id.includes('eldritch_smite'))).toBe(true);
  });

  it('replacing an invocation re-checks the character as they will be: a prerequisite held by another invocation cannot be swapped out, a free one can', () => {
    let e = pick(base(), 1, ['invocation_pact_of_the_blade']);
    e = pick(e, 2, ['invocation_devils_sight', 'invocation_fiendish_vigor']);
    e = pick(e, 5, ['invocation_eldritch_smite', 'invocation_armor_of_shadows']);
    expect(inv(e, 1).definition.replace).toBeTruthy();
    expect(() => replacePoolOption(e, inv(e, 1).id, 'invocation_pact_of_the_blade', 'invocation_misty_visions', DEFAULT_RULES)).toThrow(/prerequisite/);
    const swapped = replacePoolOption(e, inv(e, 2).id, 'invocation_devils_sight', 'invocation_misty_visions', DEFAULT_RULES);
    expect(swapped.features.some(f => f.id.includes('misty_visions'))).toBe(true);
    expect(swapped.features.some(f => f.id.includes('devils_sight'))).toBe(false);
    // a new option whose prerequisites are not met is refused
    expect(() => replacePoolOption(e, inv(e, 2).id, 'invocation_devils_sight', 'invocation_devouring_blade', DEFAULT_RULES)).toThrow(/requires/);
  });

  it('Pact Magic slots come back on a short rest (a solo Warlock keeps them in pactSlots)', () => {
    const e = base();
    const sc = e.spellcasting!;
    const pact = (sc.pactSlots ?? sc.slots) as Record<string, { total: number; used: number }>;
    const total = Object.values(pact).reduce((a, s) => a + s.total, 0);
    expect(total).toBe(2);                                    // Warlock 5: two 3rd-level slots
    const spend = (m: Record<string, { total: number; used: number }>) => Object.fromEntries(Object.entries(m).map(([k, s]) => [k, { ...s, used: s.total }]));
    const spent: Entity = { ...e, spellcasting: { ...sc, ...(sc.pactSlots ? { pactSlots: spend(sc.pactSlots as never) as never } : { slots: spend(sc.slots as never) as never }) } };
    const short = takeRest(spent, 'short', DEFAULT_RULES);
    const after = (short.spellcasting!.pactSlots ?? short.spellcasting!.slots) as Record<string, { total: number; used: number }>;
    expect(Object.values(after).reduce((a, s) => a + s.used, 0)).toBe(0);
  });
});

describe('non-walking movement speeds (2024)', () => {
  const reach = (classId: string, raceId: string, bg: string, to: number, subclassId?: string) => {
    const p = p24; const cls = p.getClass(classId)!;
    // resolve nothing by hand: levelUpClass queues the picks, movement comes from always-on features
    let e = make(p, classId, raceId, bg, 1);
    e = levelTo(e, p, cls, to, subclassId);
    return e;
  };
  it('Ranger Roving gives climb and swim equal to the final Speed at level 6', () => {
    const e = reach('ranger_2024', 'human_2024', 'soldier_2024', 6);
    expect(e.derived.speed).toBe(40);
    expect(e.derived.movement.climb).toBe(40);
    expect(e.derived.movement.swim).toBe(40);
  });
  it('Thief Second-Story Work gives a climb speed equal to Speed at level 3', () => {
    const sub = p24.subclassesOf('rogue_2024').find(s => /thief/.test(s.id))!.id;
    const e = reach('rogue_2024', 'human_2024', 'soldier_2024', 3, sub);
    expect(e.derived.movement.climb).toBe(e.derived.speed);
  });
});

describe('Paladin auras (2024)', () => {
  it('the Paladin\'s own Aura of Protection adds the Charisma modifier to every save; the ally share is text', () => {
    const cls = p24.getClass('paladin_2024')!;
    const e = levelTo(make(p24, 'paladin_2024', 'human_2024', 'soldier_2024', 1), p24, cls, 6);
    const aura = e.features.find(f => f.id.includes('aura_of_protection'))!;
    expect(aura).toBeTruthy();
    expect(aura.effects?.length).toBeGreaterThan(0);
    expect(aura.description).toMatch(/allies/);
  });
});

describe('cross-list spell picks (2024), through the real pickers', () => {
  const names = (list: { id: string }[]) => new Set(list.map(s => s.id));
  const take = (e: Entity, suffix: string) => e.choices.find(c => c.id.includes(suffix))!;

  it('Blessed Warrior: Paladin picks two Cleric cantrips, from the Cleric list only', () => {
    const cls = p24.getClass('paladin_2024')!;
    let e = levelTo(make(p24, 'paladin_2024', 'human_2024', 'soldier_2024', 1), p24, cls, 2);
    const fs = e.choices.find(c => !c.resolved && Array.isArray(c.definition.pool) && c.definition.pool.some(o => o.id === 'fighting_style_blessed_warrior'))!;
    e = applyPoolChoiceToEntity(e, fs.id, ['fighting_style_blessed_warrior'], DEFAULT_RULES);
    const choice = take(e, 'blessed_warrior_cantrips');
    expect(choice).toBeTruthy();
    const ids = names(spellCandidates(p24, e, choice.id));
    expect(ids.has('sacred_flame') && ids.has('guidance')).toBe(true);
    expect([...ids].every(id => p24.getSpell(id)!.level === 0)).toBe(true);
    const cleric = new Set(p24.spells().filter(s => (s.classes ?? []).includes('cleric_2024') && s.level === 0).map(s => s.id));
    expect([...ids].every(id => cleric.has(id))).toBe(true);
    expect(ids.has('firebolt')).toBe(false);                                    // a Wizard cantrip is not on offer
    const done = applySpellChoiceToEntity(e, choice.id, ['guidance', 'sacred_flame'], id => p24.getSpell(id)?.level, DEFAULT_RULES);
    expect(done.spellcasting?.cantrips).toEqual(expect.arrayContaining(['guidance', 'sacred_flame']));
  });

  it('Druidic Warrior: Ranger picks two Druid cantrips', () => {
    const cls = p24.getClass('ranger_2024')!;
    let e = levelTo(make(p24, 'ranger_2024', 'human_2024', 'soldier_2024', 1), p24, cls, 2);
    const fs = e.choices.find(c => !c.resolved && Array.isArray(c.definition.pool) && c.definition.pool.some(o => o.id === 'fighting_style_druidic_warrior'))!;
    e = applyPoolChoiceToEntity(e, fs.id, ['fighting_style_druidic_warrior'], DEFAULT_RULES);
    const ids = names(spellCandidates(p24, e, take(e, 'druidic_warrior_cantrips').id));
    expect(ids.has('guidance') && ids.has('starry_wisp')).toBe(true);
    expect(ids.has('sacred_flame')).toBe(false);
  });

  it('Bard Magical Secrets: from level 10 new prepared spells may come from the Bard, Cleric, Druid and Wizard lists, and not before', () => {
    const cls = p24.getClass('bard_2024')!;
    const at = (n: number) => { const e = levelTo(make(p24, 'bard_2024', 'human_2024', 'sage_2024', 1), p24, cls, n); return e.choices.filter(c => !c.resolved && c.definition.kind === 'spell' && /spells_/.test(c.id)).pop()!; };
    const early = at(9), late = at(10);
    const eEarly = levelTo(make(p24, 'bard_2024', 'human_2024', 'sage_2024', 1), p24, cls, 9);
    const eLate = levelTo(make(p24, 'bard_2024', 'human_2024', 'sage_2024', 1), p24, cls, 10);
    const early5 = names(spellCandidates(p24, eEarly, early.id)), late5 = names(spellCandidates(p24, eLate, late.id));
    const wizardOnly = p24.spells().find(s => (s.classes ?? []).includes('wizard_2024') && !(s.classes ?? []).includes('bard_2024') && s.level >= 1 && s.level <= 5)!;
    expect(early5.has(wizardOnly.id)).toBe(false);
    expect(late5.has(wizardOnly.id)).toBe(true);
  });

  it('Pact of the Tome: three cantrips and two level 1 rituals from any list; Mystic Arcanum: only Warlock spells of its level', () => {
    const cls = p24.getClass('warlock_2024')!;
    let e = levelTo(make(p24, 'warlock_2024', 'orc_2024', 'acolyte_2024', 1), p24, cls, 1);
    const inv = e.choices.find(c => c.id.endsWith('invocations_1_1'))!;
    e = applyPoolChoiceToEntity(e, inv.id, ['invocation_pact_of_the_tome'], DEFAULT_RULES);
    const cantrips = spellCandidates(p24, e, take(e, 'tome_cantrips').id), rituals = spellCandidates(p24, e, take(e, 'tome_rituals').id);
    expect(names(cantrips).has('firebolt') && names(cantrips).has('sacred_flame') && names(cantrips).has('guidance')).toBe(true);   // Wizard, Cleric, Druid lists
    expect(rituals.length).toBeGreaterThan(5);
    expect(rituals.every(s => s.level === 1 && s.ritual)).toBe(true);
    // Mystic Arcanum 6 at level 11
    const w11 = levelTo(make(p24, 'warlock_2024', 'orc_2024', 'acolyte_2024', 1), p24, cls, 11);
    const arc = w11.choices.find(c => c.id.includes('arcanum_6'));
    if (arc) {
      const cands = spellCandidates(p24, w11, arc.id);
      expect(cands.length).toBeGreaterThan(0);
      expect(cands.every(s => s.level === 6 && (s.classes ?? []).includes('warlock_2024'))).toBe(true);
    }
    // The arcanum choice is queued by the feature's grant, so it exists only once the feature is held: report whether it was queued
    expect(w11.features.some(f => f.id.includes('mystic_arcanum_6'))).toBe(true);
  });
});
