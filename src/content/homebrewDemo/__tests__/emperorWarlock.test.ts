// The Emperor Warlock, exercised end to end through the engine (levelUp,
// resolve choices, rest, modes, ally grants) — not just shape-checked.
import { makeEmptyEntity, DEFAULT_RULES } from '../../../store/characterStore';
import { levelUp, applyPoolChoiceToEntity, applySpellChoiceToEntity, resolveChoice, applyExpertiseChoiceToEntity, swapPoolChoice, swapsRemainingThisLevel } from '../../../engine/leveling';
import { recomputeDerived } from '../../../engine/pipeline';
import { takeRest } from '../../../engine/rest';
import { setRandomSource } from '../../../engine/dice';
import { startModePeriod, pickPendingRoll, rerollMode, setMode, modeSelectorInfo } from '../../../engine/modes';
import { listAllyGrantSources, applyChosenGrant, spendGrantDie, syncAllyGrants, setAuraMember } from '../../../engine/allyGrants';
import { applyActionCardUse } from '../../../engine/actionUse';
import { EMPEROR_WARLOCK, emperorWarlockProgression, EDICT_OPTIONS, LEGACY_BINDING } from '../emperorWarlock';
import { BOUND_SPIRIT_OPTIONS } from '../boundSpirits';
import { spellRepo } from '../../spellRepo';
import { ALL_SPELLS } from '../../spells';
import { SPIRIT_SPELL_LEVEL } from '../boundSpirits';
import { validateClass } from '../../../engine/homebrewValidator';
import { validatePackageForImport } from '../../../engine/packageValidation';
import { createPackageContentPack } from '../../../engine/backup';
import { isOfficialRef } from '../../officialRefs';
import { validateEntityDeep } from '../../../engine/entityValidation';
import type { Entity, ChoiceDefinition } from '../../../engine/types';

const R = DEFAULT_RULES;
const DEFS = [EMPEROR_WARLOCK];
afterAll(() => setRandomSource(Math.random));

function newCharacter(): Entity {
  const e = makeEmptyEntity('emp');
  return { ...e, identity: { ...e.identity, name: 'Emperor', classId: 'emperor_warlock', level: 0 }, stats: { ...e.stats, cha: 18, con: 14, dex: 12 } };
}

/** Level up and auto-resolve every pending choice the way a player would (ASIs left alone). */
function build(level: number): Entity {
  let e = levelUp(newCharacter(), level, emperorWarlockProgression, R, DEFS);
  for (let guard = 0; guard < 80; guard++) {
    const c = e.choices.find(x => !x.resolved && x.definition.kind !== 'asi');
    if (!c) break;
    const d = c.definition as ChoiceDefinition;
    if (d.kind === 'skill') e = resolveChoice(e, c.id, ['history', 'persuasion'], R);
    else if (d.kind === 'expertise') e = applyExpertiseChoiceToEntity(e, c.id, ['history'], R);   // History: trained from the class skill pick
    else if (d.kind === 'feature_pool') {
      const have = new Set(e.features.map(f => f.id));
      // Prefer edicts that do not touch skills, so skill-based tests stay predictable.
      const order = ['tactical_withdrawal', 'unbroken_line', 'rally', 'unshaken', 'commander_of_many', 'iron_discipline', 'historian', 'forced_march', 'imperial_blast', 'mark_of_the_emperor', 'battlefield_observer'];
      const picks = order.filter(id => !have.has(`edict_${id}`)).slice(0, d.count);
      e = applyPoolChoiceToEntity(e, c.id, picks, R);
    } else if (d.kind === 'spell') {
      const lvl = d.arcanum?.spellLevel;
      const id = lvl ? ({ 6: 'true_seeing', 7: 'plane_shift', 8: 'dominate_monster', 9: 'weird' } as Record<number, string>)[lvl]
        : d.id.includes('cantrip') ? ['eldritch_blast', 'mage_hand', 'minor_illusion', 'prestidigitation', 'chill_touch'][Math.min(4, e.spellcasting?.cantrips.length ?? 0)] : undefined;
      e = applySpellChoiceToEntity(e, c.id, id ? [id] : [], s => spellRepo.getSpellSync(s)?.level, R);
    } else break;
  }
  return recomputeDerived(e, R);
}
const ids = (e: Entity) => e.features.map(f => f.id);

describe('class shape', () => {
  it('passes the homebrew class validator', () => {
    const r = validateClass(EMPEROR_WARLOCK);
    expect(r.errors).toEqual([]);
    expect(r.valid).toBe(true);
  });
  it('says Bound Spirit, never Subclass', () => {
    expect(EMPEROR_WARLOCK.subclassLabel).toBe('Bound Spirit');
    expect(LEGACY_BINDING.optionLabel).toBe('Bound Spirit');
    const blob = JSON.stringify(EMPEROR_WARLOCK);
    expect(blob).not.toMatch(/[Ss]ubclass(?!Label)/);
  });
  it('has 12 spirits in d12 order, each with entries at 1/5/10/15/20 and no empty descriptions', () => {
    expect(BOUND_SPIRIT_OPTIONS.map(o => o.name)).toEqual(['Genghis Khan', 'Stalin', 'Hannibal', 'Napoleon', 'Alexander the Great', 'Odysseus', 'Julius Caesar', 'Saladin', 'Montezuma', 'David IV the Builder', 'Sun Tzu', 'Joan of Arc']);
    for (const o of BOUND_SPIRIT_OPTIONS) {
      expect(o.entries.map(en => en.level)).toEqual([1, 5, 10, 15, 20]);
      for (const en of o.entries) for (const f of en.features ?? []) expect(f.description.length).toBeGreaterThan(20);
    }
  });
  it('has the 17 edicts', () => {
    expect(EDICT_OPTIONS).toHaveLength(17);
    expect(new Set(EDICT_OPTIONS.map(o => o.id)).size).toBe(17);
  });
  it('every automated claim names its table-resolved remainder honestly (no feature promises automation it lacks)', () => {
    for (const o of BOUND_SPIRIT_OPTIONS) for (const en of o.entries) for (const f of en.features ?? []) {
      if (f.id.includes('_spells_') || f.id.includes('_cast_')) continue;
      expect(/Automated:|Table-resolved:/.test(f.description) || f.effects.length === 0).toBe(true);
    }
  });
});

describe('spirit spell table', () => {
  it('every spirit spell exists in the spell library at the level the pack records', () => {
    const byId = new Map(ALL_SPELLS.map(sp => [sp.id, sp.level]));
    const wrong = Object.entries(SPIRIT_SPELL_LEVEL).filter(([id, lvl]) => byId.get(id) !== lvl).map(([id, lvl]) => `${id}: pack ${lvl} vs library ${byId.get(id)}`);
    expect(wrong).toEqual([]);
  });
  it('each spirit grants 2/2/2/1/1 spells at 1/5/10/15/20', () => {
    for (const o of BOUND_SPIRIT_OPTIONS) {
      const counts = o.entries.map(en => (en.features ?? []).reduce((n, f) => n + (f.id.includes('_cast_') ? 1 : (f.effects.find(x => x.type === 'grant_spell')?.spellIds?.length ?? 0)), 0));
      expect(counts).toEqual([2, 2, 2, 1, 1]);
    }
  });
});

describe('level 1', () => {
  const l1 = () => build(1);
  it('Pact Magic: CHA caster, one 1st-level slot, recharges on a SHORT rest, Eldritch Blast known', () => {
    const e = l1();
    expect(e.spellcasting!.ability).toBe('cha');
    expect(e.spellcasting!.shortRestSlots).toBe(true);
    const total = (x: Entity) => ['1', '2', '3', '4', '5'].map(t => (x.spellcasting!.pactSlots ?? x.spellcasting!.slots)[t as '1'].total);
    expect(total(e)).toEqual([1, 0, 0, 0, 0]);
    expect(e.spellcasting!.cantrips).toContain('eldritch_blast');
    // spend the slot, short rest restores it
    const slots = e.spellcasting!.pactSlots ? 'pactSlots' : 'slots';
    const spent = { ...e, spellcasting: { ...e.spellcasting!, [slots]: { ...(e.spellcasting as any)[slots], '1': { total: 1, used: 1 } } } } as Entity;
    expect((takeRest(spent, 'short', R).spellcasting as any)[slots]['1'].used).toBe(0);
  });
  it('Command Dice = proficiency bonus (2 at level 1), long-rest recharge', () => {
    const e = l1();
    expect(e.resources.custom.find(r => r.id === 'command_dice')).toMatchObject({ maximum: 2, current: 2, recharge: 'long_rest' });
  });
  it('Legacy Binding exists as a mode group labelled Bound Spirit; nothing active until rolled', () => {
    const e = l1();
    expect(e.features.find(f => f.id === 'legacy_binding')!.modeGroup!.optionLabel).toBe('Bound Spirit');
    expect(e.features.some(f => f.source.kind === 'mode')).toBe(false);
  });
  it('rolling a 10 binds David IV the Builder: his L1 features and two bonus spells arrive', () => {
    const e = recomputeDerived(startModePeriod(l1(), 'legacy_binding', [10]), R);
    expect(ids(e)).toEqual(expect.arrayContaining(['legacy_binding__david_iv_the_builder__royal_authority']));
    expect(e.skills.skills.persuasion.trained).toBe(true);
    expect(e.skills.skills.history.trained).toBe(true);
    expect(e.spellcasting!.known).toEqual(expect.arrayContaining(['shield_of_faith', 'heroism']));
  });
});

describe('Imperial Command through the real action card', () => {
  it('spends a Command Die from the pool and hands the ally a d6; ally spends it', () => {
    setRandomSource(() => 0.5);
    const holder = build(1);
    const card = holder.actionCards!.find(c => c.featureId === 'imperial_command')!;
    expect(card).toBeDefined();
    const used = applyActionCardUse(holder, card, R);
    expect(used.resources.custom.find(r => r.id === 'command_dice')!.current).toBe(1);
    const ally = recomputeDerived({ ...makeEmptyEntity('ally'), identity: { ...makeEmptyEntity('a').identity, name: 'Ally' } }, R);
    const src = listAllyGrantSources(used).find(s => s.spec.id === 'command_die')!;
    const res = applyChosenGrant(used, ally, src, R);
    expect(res.target.receivedGrants![0].die).toMatchObject({ size: 'd6', remaining: 1 });
    const spent = spendGrantDie(res.target, res.grant.id, R)!;
    expect(spent.roll).toBeGreaterThanOrEqual(1);
    expect(spent.entity.receivedGrants).toEqual([]);
  });
  it('die grows to d8 at 9 and d10 at 17; pool = PB; Tireless Command refills an empty pool on a short rest from 13', () => {
    const e9 = build(9);
    expect(listAllyGrantSources(e9).find(s => s.spec.id === 'command_die')!.spec.die!.sizeByLevel).toEqual([{ level: 9, size: 'd8' }, { level: 17, size: 'd10' }]);
    const grant = applyChosenGrant(e9, e9, listAllyGrantSources(e9).find(s => s.spec.id === 'command_die')!, R).holder.receivedGrants!.find(g => g.specId === 'command_die')!;
    expect(grant.die!.size).toBe('d8');
    const e13 = build(13);
    const pool = e13.resources.custom.find(r => r.id === 'command_dice')!;
    expect(pool.maximum).toBe(5);
    const empty = { ...e13, resources: { ...e13.resources, custom: e13.resources.custom.map(r => r.id === 'command_dice' ? { ...r, current: 0 } : r) } };
    expect(takeRest(empty, 'short', R).resources.custom.find(r => r.id === 'command_dice')!.current).toBe(1);
    const e12 = build(12);
    const empty12 = { ...e12, resources: { ...e12.resources, custom: e12.resources.custom.map(r => r.id === 'command_dice' ? { ...r, current: 0 } : r) } };
    expect(takeRest(empty12, 'short', R).resources.custom.find(r => r.id === 'command_dice')!.current).toBe(0);
    expect(applyChosenGrant(build(17), build(17), listAllyGrantSources(build(17)).find(s => s.spec.id === 'command_die')!, R).holder.receivedGrants!.find(g => g.specId === 'command_die')!.die!.size).toBe('d10');
  });
});

describe('Imperial Edicts', () => {
  it('2 at level 2, then +1 at 6/10/14/17 = 6 by level 20', () => {
    const count = (lvl: number) => build(lvl).choices.filter(c => c.definition.kind === 'feature_pool').reduce((n, c) => n + c.selections.length, 0);
    expect([count(2), count(5), count(6), count(10), count(14), count(17), count(20)]).toEqual([2, 2, 3, 4, 5, 6, 6]);
  });
  it('an edict\'s pool is real: Tactical Withdrawal is proficiency-bonus sized', () => {
    let e = build(1);
    e = levelUp(e, 2, emperorWarlockProgression, R, DEFS);
    const c = e.choices.find(x => x.definition.id === 'imperial_edicts_2')!;
    e = applyPoolChoiceToEntity(e, c.id, ['tactical_withdrawal', 'scholar_of_empires'], R);
    expect(e.resources.custom.find(r => r.id === 'edict_tactical_withdrawal')).toMatchObject({ maximum: 2 });
    expect(recomputeDerived({ ...e, identity: { ...e.identity, level: 5 } }, R).resources.custom.find(r => r.id === 'edict_tactical_withdrawal')!.maximum).toBe(3);
  });
  it('Scholar of Empires: expertise when History is already known, plain proficiency when it is not', () => {
    const scholar = (EDICT_OPTIONS.find(o => o.id === 'scholar_of_empires')!.value) as any;
    const give = (e: Entity) => recomputeDerived({ ...e, features: [...e.features, { ...scholar, isActive: true }] }, R);
    const trained = give(build(2));                       // class skill pick included History
    expect(trained.skills.skills.history).toMatchObject({ trained: true, expertise: true });
    const bare = (() => { const x = makeEmptyEntity('b'); return give(x); })();
    expect(bare.skills.skills.history).toMatchObject({ trained: true, expertise: false });
  });
  it('SWAP: replace one known edict with another once per level; the old one\'s feature and pool leave, history is kept', () => {
    let e = build(2);
    const choice = e.choices.find(c => c.definition.id === 'imperial_edicts_2')!;
    const [first] = choice.selections;
    expect(swapsRemainingThisLevel(e, 'imperial_edicts')).toBe(1);
    const unknown = EDICT_OPTIONS.find(o => !e.features.some(f => f.id === (o.value as { id: string }).id))!;
    const swapped = swapPoolChoice(e, choice.id, first, unknown.id, R, '2026-05-01T00:00:00Z');
    const after = swapped.choices.find(c => c.id === choice.id)!;
    expect(after.selections).toContain(unknown.id);
    expect(after.selections).not.toContain(first);
    expect(after.swaps).toEqual([{ from: first, to: unknown.id, atLevel: 2, at: '2026-05-01T00:00:00Z' }]);
    expect(ids(swapped)).toContain((unknown.value as { id: string }).id);
    expect(ids(swapped)).not.toContain(`edict_${first}`);
    // a second swap at the same level is refused
    const another = EDICT_OPTIONS.find(o => !swapped.features.some(f => f.id === (o.value as { id: string }).id))!;
    expect(swapPoolChoice(swapped, choice.id, unknown.id, another.id, R)).toBe(swapped);
    expect(swapsRemainingThisLevel(swapped, 'imperial_edicts')).toBe(0);
    // after gaining a level the swap is available again
    e = levelUp(swapped, 3, emperorWarlockProgression, R, DEFS);
    expect(swapsRemainingThisLevel(e, 'imperial_edicts')).toBe(1);
    // cannot swap into something already known
    const known = after.selections.find(s => s !== unknown.id)!;
    expect(swapPoolChoice(e, choice.id, unknown.id, known, R)).toBe(e);
  });
  it('Unbroken Line: +1 AC to ticked allies only, and it switches off while the Emperor is down', () => {
    const line = build(2);                                   // build() picked Unbroken Line
    expect(ids(line)).toContain('edict_unbroken_line');
    const ally = recomputeDerived(makeEmptyEntity('ally'), R);
    const bystander = recomputeDerived(makeEmptyEntity('by'), R);
    const ticked = setAuraMember(line, 'edict_unbroken_line', 'line', 'ally', true);
    const [, a, b] = syncAllyGrants([ticked, ally, bystander], R);
    expect(a.derived.ac).toBe(ally.derived.ac + 1);
    expect(b.derived.ac).toBe(bystander.derived.ac);
    const down = recomputeDerived({ ...ticked, resources: { ...ticked.resources, hp: { ...ticked.resources.hp, current: 0 } } }, R);
    expect(syncAllyGrants([down, a], R)[1].derived.ac).toBe(ally.derived.ac);
  });
  it('Battlefield Observer: initiative gains the Charisma modifier (+4 at CHA 18) and follows it', () => {
    const obs = (EDICT_OPTIONS.find(o => o.id === 'battlefield_observer')!.value) as any;
    const base = build(2);
    const without = base.derived.initiative;
    const withIt = recomputeDerived({ ...base, features: [...base.features, { ...obs, isActive: true }] }, R);
    expect(withIt.derived.initiative).toBe(without + 4);
    const weaker = recomputeDerived({ ...withIt, stats: { ...withIt.stats, cha: 12 } }, R);
    expect(weaker.derived.initiative).toBe(without + 1);
  });
});

describe('Legacy Binding over a career', () => {
  it('Council of Spirits (3): re-roll once a month; Two Voices (11): roll two, pick one; Crown (20): free choice', () => {
    const roll = (v: number) => setRandomSource(() => (v - 0.5) / 12);
    roll(4);
    let e = recomputeDerived(startModePeriod(build(3), 'legacy_binding'), R);
    expect(e.modeStates!.legacy_binding.activeOptionId).toBe('napoleon');
    roll(7);
    e = recomputeDerived(rerollMode(e, 'legacy_binding'), R);
    expect(e.modeStates!.legacy_binding.activeOptionId).toBe('julius_caesar');
    expect(rerollMode(e, 'legacy_binding')).toBe(e);
    const e11 = build(11);
    expect(modeSelectorInfo(e11, LEGACY_BINDING).rollCount).toBe(2);
    let two = startModePeriod(e11, 'legacy_binding', [2, 9]);
    two = recomputeDerived(pickPendingRoll(two, 'legacy_binding', 1), R);
    expect(two.modeStates!.legacy_binding.activeOptionId).toBe('montezuma');
    const e20 = build(20);
    expect(modeSelectorInfo(e20, LEGACY_BINDING).freeChoice).toBe(true);
    expect(modeSelectorInfo(build(19), LEGACY_BINDING).freeChoice).toBe(false);
  });

  it('level gating and swapping: a level-10 Emperor bound to Napoleon, then Joan — nothing of Napoleon lingers', () => {
    let e = recomputeDerived(setMode(build(10), 'legacy_binding', 'napoleon', 'dm'), R);
    expect(ids(e).filter(i => i.startsWith('legacy_binding__napoleon__'))).toEqual(expect.arrayContaining([
      'legacy_binding__napoleon__scientific_corps', 'legacy_binding__napoleon__imperial_presence', 'legacy_binding__napoleon__against_the_odds']));
    expect(ids(e)).not.toContain('legacy_binding__napoleon__chosen_rival');                // level 15
    const chaBefore = e.derived.abilityBasedDC.cha;
    e = recomputeDerived(setMode(e, 'legacy_binding', 'joan_of_arc', 'dm'), R);
    expect(ids(e).some(i => i.includes('napoleon'))).toBe(false);
    expect(ids(e)).toContain('legacy_binding__joan_of_arc__raise_the_standard');
    expect(e.derived.abilityBasedDC.cha).toBe(chaBefore - 0); // Napoleon's +1 CHA left with him... (checked below)
    expect(e.stats.cha).toBe(18);
  });

  it('spent spirit pools stay spent across a swap-away and swap-back; a long rest refills them', () => {
    let e = recomputeDerived(setMode(build(5), 'legacy_binding', 'alexander_the_great', 'dm'), R);
    const pid = 'legacy_binding__alexander_the_great__bucephalus';
    expect(e.resources.custom.find(r => r.id === pid)).toMatchObject({ current: 1, maximum: 1 });
    e = { ...e, resources: { ...e.resources, custom: e.resources.custom.map(r => r.id === pid ? { ...r, current: 0 } : r) } };
    e = recomputeDerived(setMode(e, 'legacy_binding', 'odysseus', 'dm'), R);
    e = recomputeDerived(setMode(e, 'legacy_binding', 'alexander_the_great', 'dm'), R);
    expect(e.resources.custom.find(r => r.id === pid)!.current).toBe(0);
    expect(takeRest(e, 'long', R).resources.custom.find(r => r.id === pid)!.current).toBe(1);
  });

  it('Stalin\'s Firing Squad is ONE card whose dice grow (4d6 → 12d6), never duplicated', () => {
    const at = (lvl: number) => recomputeDerived(setMode(build(lvl), 'legacy_binding', 'stalin', 'dm'), R);
    const dice = (e: Entity) => {
      const fs = e.features.filter(f => f.id === 'legacy_binding__stalin__firing_squad');
      expect(fs).toHaveLength(1);
      return fs[0].abilityEffects!.find(a => a.type === 'damage')!;
    };
    expect((dice(at(1)) as any).dice).toBe('4d6');
    expect((dice(at(5)) as any).dice).toBe('6d6');
    expect((dice(at(10)) as any).dice).toBe('8d6');
    expect((dice(at(20)) as any).dice).toBe('12d6');
    expect(dice(at(1)) && at(1).actionCards!.filter(c => c.name === 'Firing Squad')).toHaveLength(1);
  });

  it('spirit spells: 1st–5th level are known spells; 6th+ cast from Legacy Arcanum and need the pool', () => {
    let e = recomputeDerived(setMode(build(15), 'legacy_binding', 'stalin', 'dm'), R);
    expect(e.spellcasting!.known).toEqual(expect.arrayContaining(['command', 'cause_fear', 'fear', 'animate_dead', 'geas', 'modify_memory']));
    const finger = e.features.find(f => f.id === 'legacy_binding__stalin__stalin_cast_finger_of_death')!;
    expect(finger.activation!.resourceCost).toEqual({ resourceId: 'legacy_arcanum_7', quantity: 1 });
    expect(e.resources.custom.find(r => r.id === 'legacy_arcanum_7')).toBeDefined();
    e = recomputeDerived(setMode(e, 'legacy_binding', 'joan_of_arc', 'dm'), R);
    expect(e.spellcasting!.known).not.toContain('fear');
    expect(e.spellcasting!.known).toEqual(expect.arrayContaining(['heroism', 'bless', 'beacon_of_hope']));
    expect(e.features.some(f => f.id.includes('finger_of_death'))).toBe(false);
  });
});

describe('Legacy Arcanum', () => {
  it('level 11–17 each add a once-per-Long-Rest pool and a spell of exactly that level, cast from the pool, not a slot', () => {
    const e = build(17);
    for (const lvl of [6, 7, 8, 9]) {
      expect(e.resources.custom.find(r => r.id === `legacy_arcanum_${lvl}`)).toMatchObject({ maximum: 1, recharge: 'long_rest' });
    }
    const cast = e.features.filter(f => f.name.startsWith('Arcanum:'));
    expect(cast.map(f => f.activation!.resourceCost!.resourceId).sort()).toEqual(['legacy_arcanum_6', 'legacy_arcanum_7', 'legacy_arcanum_8', 'legacy_arcanum_9']);
    expect(e.spellcasting!.known).not.toEqual(expect.arrayContaining(['true_seeing']));  // not an ordinary known spell
  });
});

describe('persistence', () => {
  it('a level-12 Emperor bound to a spirit survives a JSON save/load unchanged and still passes deep validation', () => {
    const e = recomputeDerived(setMode(build(12), 'legacy_binding', 'hannibal', 'dm'), R);
    const loaded = JSON.parse(JSON.stringify(e)) as Entity;
    const again = recomputeDerived(loaded, R);
    expect(again.features.map(f => f.id).sort()).toEqual(e.features.map(f => f.id).sort());
    expect(again.resources.custom.map(r => [r.id, r.current, r.maximum])).toEqual(e.resources.custom.map(r => [r.id, r.current, r.maximum]));
    expect(again.derived.ac).toBe(e.derived.ac);
    expect(again.modeStates).toEqual(e.modeStates);
    const v = validateEntityDeep(loaded);
    expect(v.errors).toEqual([]);
  });
});

describe('progression sanity', () => {
  it('Extra Attack at 5, hit points use the d8, saves are WIS/CHA', () => {
    expect(build(5).derived.attackActionAttacks).toBe(2);
    expect(build(4).derived.attackActionAttacks).toBe(1);
    expect(EMPEROR_WARLOCK.hitDie).toBe(8);
    expect(EMPEROR_WARLOCK.savingThrows).toEqual(['wis', 'cha']);
  });
  it('pact slot table: Warlock-shaped, 4 fifth-level slots at 17+', () => {
    const e = build(17);
    const s = (e.spellcasting!.pactSlots ?? e.spellcasting!.slots) as any;
    expect(s['5'].total).toBe(4);
  });
  it('round-trips through a real content pack: JSON → validatePackageForImport has no blocking problems', () => {
    const pack = createPackageContentPack({ classes: [EMPEROR_WARLOCK] }, [{ type: 'class', id: 'emperor_warlock', name: 'Emperor Warlock', included: 'selected' }], { name: 'Emperor Warlock' }, null, '1.0.0');
    const reloaded = JSON.parse(JSON.stringify(pack));
    const known = new Set(['dnd5e-2014', 'dnd5e-2024']);
    const result = validatePackageForImport(reloaded, known, () => undefined, isOfficialRef);
    expect(result.blocking).toEqual([]);
    expect(reloaded.homebrew.classes[0].rawProgression.entries.flatMap((e: any) => e.grants).length).toBeGreaterThan(30);
  });
  it('is one self-contained class object (spirits + edicts embedded) so it exports/imports as one unit', () => {
    const blob = JSON.stringify(EMPEROR_WARLOCK);
    expect(JSON.parse(blob).rawProgression.entries).toHaveLength(20);
    expect(blob).toContain('joan_of_arc');
    expect(blob).toContain('mark_of_the_emperor');
  });
});
