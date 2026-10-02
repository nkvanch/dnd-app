// The Emperor Warlock (both versions) driven through the real engine: class creation, level-ups,
// spirit binding/switching, edicts, arcanum and the mode helpers.
import { makeEmptyEntity, DEFAULT_RULES } from '../../../../store/characterStore';
import { recomputeDerived } from '../../../../engine/pipeline';
import { levelUp, applySubclassToEntity, applyPoolChoiceToEntity, applyGrant } from '../../../../engine/leveling';
import { mergeSubclassIntoProgression } from '../../progressions';
import {
  modeGroupsForEntity, activeModeOption, modeDiceCount, optionForRoll, modeAllowsFreeChoice,
  modeRerollAvailable, spendModeReroll, switchModeOption, modeClassLevel,
} from '../../../../engine/modes';
import { BUILTIN_HOMEBREW } from '../../../builtinHomebrew';
import { applyDamage } from '../../../../engine/combat';
import { Entity, CharClass, HomebrewSubclass } from '../../../../engine/types';
import { emperorWarlockClass, emperorWarlockDemoClass, emperorWarlockSpirits } from '../index';
import { spiritId } from '../spirits';
import { spellRangeOverride, spellDamageBonus } from '../../../../engine/spellModifiers';
import { ALL_EMPEROR_SPELL_IDS } from '../spellData';
import { FULL_SPELL_LIBRARY } from '../../../spells/index';

const CLASSES: CharClass[] = [emperorWarlockClass, emperorWarlockDemoClass];
const spiritsOf = (classId: string) => emperorWarlockSpirits.filter(s => s.classId === classId);
const spirit = (classId: string, key: string): HomebrewSubclass => spiritsOf(classId).find(s => s.id === spiritId(classId, key))!;

function start(cls: CharClass): Entity {
  let e = makeEmptyEntity('emp');
  e = { ...e, identity: { ...e.identity, classId: cls.id, level: 0 },
    stats: { str: 10, dex: 14, con: 14, int: 10, wis: 12, cha: 18 },
    resources: { ...e.resources, hp: { current: 10, maximum: 10, temp: 0 } } };
  return levelUp(e, 1, cls.rawProgression!, DEFAULT_RULES, CLASSES);
}
// Like the app's resolveProgression: once a spirit is bound, level-ups also apply ITS entries.
const toLevel = (e: Entity, cls: CharClass, n: number) => {
  const sub = e.identity.subclassId ? emperorWarlockSpirits.find(s => s.id === e.identity.subclassId) : undefined;
  const prog = sub ? mergeSubclassIntoProgression(cls.rawProgression!, sub) : cls.rawProgression!;
  return levelUp(e, n, prog, DEFAULT_RULES, CLASSES);
};
/** Gives the character proficiency in a skill from an ordinary effect-backed source (as a background would). */
const withProficiency = (e: Entity, skill: string): Entity => recomputeDerived(applyGrant(e, { kind: 'feature', value: {
  id: `test_prof_${skill}`, name: 'Test proficiency', description: '', source: { kind: 'background', refId: 'test' }, level: null, actions: [], choices: [], passive: true, isActive: true,
  effects: [{ type: 'grant_proficiency', target: `skill:${skill}`, operation: 'add', value: null, condition: null }],
} }, 0), DEFAULT_RULES);
const bind = (e: Entity, classId: string, key: string): Entity => {
  const choice = e.choices.find(c => c.definition.kind === 'subclass')!;
  return applySubclassToEntity(e, choice.id, spiritId(classId, key), spirit(classId, key), DEFAULT_RULES);
};
const featureIds = (e: Entity) => e.features.map(f => f.id);

describe('content shape', () => {
  it('registers both classes, 24 spirits (12 per class), summon stat blocks and spirit conditions', () => {
    const ids = BUILTIN_HOMEBREW.classes.map(c => c.id);
    expect(ids).toEqual(expect.arrayContaining(['emperor_warlock', 'emperor_warlock_demo']));
    expect(spiritsOf('emperor_warlock')).toHaveLength(12);
    expect(spiritsOf('emperor_warlock_demo')).toHaveLength(12);
    expect(BUILTIN_HOMEBREW.monsters.map(m => m.id)).toEqual(expect.arrayContaining(['spectral_mob', 'achilles', 'kartvelebi', 'khevsurebi']));
    expect(BUILTIN_HOMEBREW.conditions.map(c => c.id)).toEqual(expect.arrayContaining(['emperor_avatar_of_tenochtitlan', 'emperor_banner_of_orleans']));
  });

  it('only the true class has a Mode Group; both label the choice "Bound Spirit"', () => {
    expect(emperorWarlockClass.modeGroups).toHaveLength(1);
    expect(emperorWarlockDemoClass.modeGroups).toBeUndefined();
    for (const c of CLASSES) {
      const q = c.rawProgression!.entries[0].choices.find(x => x.kind === 'subclass')!;
      expect(q.subclassLabel).toBe('Bound Spirit');
    }
  });

  it('every spirit has entries at exactly levels 1, 5, 10, 15, 20, and a bonus-spell grant at each', () => {
    for (const s of spiritsOf('emperor_warlock')) {
      expect(s.entries.map(e => e.level)).toEqual([1, 5, 10, 15, 20]);
      for (const e of s.entries) expect(e.grants.some(g => g.kind === 'known_spells')).toBe(true);
    }
  });

  it('every spell the class refers to exists in the spell library', () => {
    const have = new Set(FULL_SPELL_LIBRARY.map(s => s.id));
    expect(ALL_EMPEROR_SPELL_IDS.filter(id => !have.has(id))).toEqual([]);
  });

  it('the class spell list is tagged onto library spells for both class ids', () => {
    const blast = FULL_SPELL_LIBRARY.find(s => s.id === 'eldritch_blast')!;
    expect(blast.classes).toEqual(expect.arrayContaining(['emperor_warlock', 'emperor_warlock_demo']));
  });
});

describe('level 1 character', () => {
  it('has Legacy Binding, Imperial Command, 2 Command Dice (= proficiency bonus), Eldritch Blast, and a Bound Spirit choice', () => {
    for (const cls of CLASSES) {
      const e = start(cls);
      expect(featureIds(e)).toEqual(expect.arrayContaining(['legacy_binding', 'imperial_command', 'spirit_pact_magic']));
      expect(e.resources.custom.find(r => r.id === 'command_dice')).toMatchObject({ maximum: 2, current: 2, perProficiencyBonus: true });
      expect(e.spellcasting!.ability).toBe('cha');
      expect(e.spellcasting!.cantrips).toContain('eldritch_blast');
      expect(e.choices.find(c => c.definition.kind === 'subclass' && !c.resolved)?.definition.subclassLabel).toBe('Bound Spirit');
    }
  });

  it('Command Dice track the proficiency bonus as the character levels (2 -> 3 -> 4 -> 5 -> 6), keeping spent dice spent', () => {
    let e = start(emperorWarlockClass);
    e = { ...e, resources: { ...e.resources, custom: e.resources.custom.map(r => r.id === 'command_dice' ? { ...r, current: 0 } : r) } };
    e = toLevel(e, emperorWarlockClass, 5);
    expect(e.resources.custom.find(r => r.id === 'command_dice')).toMatchObject({ maximum: 3, current: 1 });
    e = toLevel(e, emperorWarlockClass, 20);
    expect(e.resources.custom.find(r => r.id === 'command_dice')!.maximum).toBe(6);
  });

  it('Imperial Command is upgraded in place to d8 at 9 and d10 at 17 — never duplicated', () => {
    let e = toLevel(start(emperorWarlockClass), emperorWarlockClass, 9);
    expect(e.features.filter(f => f.id === 'imperial_command')).toHaveLength(1);
    expect(e.features.find(f => f.id === 'imperial_command')!.name).toBe('Improved Command');
    e = toLevel(e, emperorWarlockClass, 17);
    expect(e.features.filter(f => f.id === 'imperial_command')).toHaveLength(1);
    expect(e.features.find(f => f.id === 'imperial_command')!.name).toBe('Greater Command');
    expect(e.features.filter(f => f.id === 'commanding_presence')).toHaveLength(1);
    e = toLevel(e, emperorWarlockClass, 18);
    expect(e.features.find(f => f.id === 'commanding_presence')!.name).toBe('Greater Presence');
  });
});

describe('binding a spirit (demo and true)', () => {
  it('Genghis Khan at level 1 grants Steppe Archer proficiencies and his two level-1 spells', () => {
    for (const cls of CLASSES) {
      const e = bind(start(cls), cls.id, 'genghis_khan');
      expect(e.identity.subclassId).toBe(spiritId(cls.id, 'genghis_khan'));
      expect(e.proficiencies.weapons).toEqual(expect.arrayContaining(['shortbow', 'longbow']));
      expect(e.skills.skills.animal_handling.trained).toBe(true);
      expect(e.spellcasting!.known).toEqual(expect.arrayContaining(['longstrider', 'hunters_mark']));
    }
  });

  it('binding at level 12 immediately grants every spirit feature up to level 10, and level 15 arrives on level-up', () => {
    let e = toLevel(start(emperorWarlockClass), emperorWarlockClass, 12);
    e = bind(e, 'emperor_warlock', 'stalin');
    const ids = featureIds(e);
    expect(ids).toEqual(expect.arrayContaining([spiritId('emperor_warlock', 'stalin') + '_firing_squad', spiritId('emperor_warlock', 'stalin') + '_open_the_vodka', spiritId('emperor_warlock', 'stalin') + '_burn_moscow']));
    expect(ids).not.toContain(spiritId('emperor_warlock', 'stalin') + '_comrades_provide');
    const fs = e.features.filter(f => f.id.endsWith('_firing_squad'));
    expect(fs).toHaveLength(1);
    expect(fs[0].abilityEffects![0]).toMatchObject({ dice: '8d6' });
    e = toLevel(e, emperorWarlockClass, 15);
    expect(featureIds(e)).toContain(spiritId('emperor_warlock', 'stalin') + '_comrades_provide');
    expect(e.features.find(f => f.id.endsWith('_firing_squad'))!.abilityEffects![0]).toMatchObject({ dice: '10d6' });
  });

  it('Napoleon L5 raises Charisma by 1 and Persuasion becomes expertise if already proficient', () => {
    let e = toLevel(start(emperorWarlockClass), emperorWarlockClass, 5);
    e = withProficiency(e, 'persuasion');
    e = bind(e, 'emperor_warlock', 'napoleon');
    expect(e.skills.skills.persuasion.trained).toBe(true);
    expect(e.skills.skills.persuasion.expertise).toBe(true);
    // ...and a character who was NOT proficient only gains proficiency, never expertise.
    const fresh = bind(toLevel(start(emperorWarlockClass), emperorWarlockClass, 5), 'emperor_warlock', 'napoleon');
    expect(fresh.skills.skills.persuasion).toMatchObject({ trained: true, expertise: false });
  });
});

describe('Legacy Binding: switching the spirit (true version)', () => {
  const group = emperorWarlockClass.modeGroups![0];
  const prog = (key: string) => spirit('emperor_warlock', key);
  const sid = (key: string) => spiritId('emperor_warlock', key);

  it('the d12 table maps 1..12 to the twelve spirits in order', () => {
    expect(optionForRoll(group, 1)).toBe(sid('genghis_khan'));
    expect(optionForRoll(group, 4)).toBe(sid('napoleon'));
    expect(optionForRoll(group, 12)).toBe(sid('joan'));
    expect(optionForRoll(group, 13)).toBeNull();
  });

  it('rolls one die until level 11 (Two Voices), is free-choice only from level 20, and Council of Spirits unlocks at 3', () => {
    expect(modeDiceCount(group, 10)).toBe(1);
    expect(modeDiceCount(group, 11)).toBe(2);
    expect(modeAllowsFreeChoice(group, 19)).toBe(false);
    expect(modeAllowsFreeChoice(group, 20)).toBe(true);
    const lv1 = bind(start(emperorWarlockClass), 'emperor_warlock', 'genghis_khan');
    expect(modeRerollAvailable(lv1, group)).toBe(false);
    const lv3 = toLevel(lv1, emperorWarlockClass, 3);
    expect(modeRerollAvailable(lv3, group)).toBe(true);
    const spent = spendModeReroll(lv3, group);
    expect(modeRerollAvailable(spent, group)).toBe(false);
    expect(spendModeReroll(spent, group)).toBe(spent);
  });

  it('finds the group from the character\'s class and reads the active spirit', () => {
    const e = bind(start(emperorWarlockClass), 'emperor_warlock', 'hannibal');
    expect(modeGroupsForEntity(e, CLASSES).map(g => g.id)).toEqual(['legacy_binding']);
    expect(activeModeOption(e, group)).toBe(sid('hannibal'));
    expect(modeClassLevel(e, group)).toBe(1);
    expect(modeGroupsForEntity(start(emperorWarlockDemoClass), CLASSES)).toEqual([]);
  });

  it('A -> B swaps the whole block: A\'s features, proficiencies and spells go, B\'s arrive, nothing leaks', () => {
    let e = toLevel(start(emperorWarlockClass), emperorWarlockClass, 5);
    e = bind(e, 'emperor_warlock', 'genghis_khan');
    expect(e.proficiencies.weapons).toContain('longbow');
    expect(e.spellcasting!.known).toContain('phantom_steed');
    e = switchModeOption(e, group, sid('stalin'), prog('stalin'), DEFAULT_RULES);
    expect(e.identity.subclassId).toBe(sid('stalin'));
    expect(featureIds(e).filter(i => i.startsWith(sid('genghis_khan')))).toEqual([]);
    expect(featureIds(e)).toContain(sid('stalin') + '_firing_squad');
    expect(e.proficiencies.weapons).not.toContain('longbow');
    expect(e.spellcasting!.known).toEqual(expect.arrayContaining(['command', 'cause_fear', 'fear', 'animate_dead']));
    expect(e.spellcasting!.known).not.toContain('phantom_steed');
    expect(e.modeState!.legacy_binding.changes).toBe(1);
  });

  it('A -> B -> A -> C -> A -> B leaves exactly one spirit, no duplicate features, and keeps each spirit\'s spent resources', () => {
    let e = toLevel(start(emperorWarlockClass), emperorWarlockClass, 10);
    e = bind(e, 'emperor_warlock', 'genghis_khan');
    const spend = (id: string, current: number) => ({
      ...e, resources: { ...e.resources, custom: e.resources.custom.map(r => r.id === id ? { ...r, current } : r) } });
    e = spend('khan_eagles', 0);                                  // spend Genghis's Eyes of the Khan
    expect(e.resources.custom.find(r => r.id === 'khan_eagles')!.current).toBe(0);
    e = switchModeOption(e, group, sid('hannibal'), prog('hannibal'), DEFAULT_RULES);          // B
    expect(e.resources.custom.find(r => r.id === 'khan_eagles')).toBeUndefined();
    e = switchModeOption(e, group, sid('genghis_khan'), prog('genghis_khan'), DEFAULT_RULES);  // back to A
    expect(e.resources.custom.find(r => r.id === 'khan_eagles')!.current).toBe(0);              // still spent
    e = switchModeOption(e, group, sid('napoleon'), prog('napoleon'), DEFAULT_RULES);          // C
    e = switchModeOption(e, group, sid('genghis_khan'), prog('genghis_khan'), DEFAULT_RULES);  // A
    e = switchModeOption(e, group, sid('hannibal'), prog('hannibal'), DEFAULT_RULES);          // B
    const spiritFeatures = e.features.filter(f => f.source.kind === 'subclass');
    expect(new Set(spiritFeatures.map(f => f.id)).size).toBe(spiritFeatures.length);
    expect(spiritFeatures.every(f => f.source.refId === sid('hannibal'))).toBe(true);
    expect(e.resources.custom.filter(r => r.sourceKind === 'subclass').every(r => r.sourceId === sid('hannibal'))).toBe(true);
    expect(e.modeState!.legacy_binding.changes).toBe(5);
  });

  it('a new month restores Council of Spirits even when the same spirit answers again', () => {
    let e = toLevel(start(emperorWarlockClass), emperorWarlockClass, 3);
    e = bind(e, 'emperor_warlock', 'saladin');
    e = spendModeReroll(e, group);
    expect(e.resources.custom.find(r => r.id === 'council_of_spirits')!.current).toBe(0);
    e = switchModeOption(e, group, sid('saladin'), prog('saladin'), DEFAULT_RULES);
    expect(e.resources.custom.find(r => r.id === 'council_of_spirits')!.current).toBe(1);
    expect(activeModeOption(e, group)).toBe(sid('saladin'));
  });
});

describe('spirit-owned choices', () => {
  const group = emperorWarlockClass.modeGroups![0];
  const sid = (key: string) => spiritId('emperor_warlock', key);

  it('Napoleon queues a skill pick; leaving removes it and its granted skill, coming back queues it fresh', () => {
    let e = bind(start(emperorWarlockClass), 'emperor_warlock', 'napoleon');
    const pending = e.choices.find(c => c.sourceId === sid('napoleon') && !c.resolved)!;
    expect(pending.definition.kind).toBe('feature_pool');
    e = applyPoolChoiceToEntity(e, pending.id, ['corps_skill_history'], DEFAULT_RULES);
    expect(e.skills.skills.history.trained).toBe(true);
    e = switchModeOption(e, group, sid('stalin'), spirit('emperor_warlock', 'stalin'), DEFAULT_RULES);
    expect(e.choices.filter(c => c.sourceId === sid('napoleon'))).toEqual([]);
    expect(e.skills.skills.history.trained).toBe(false);
    e = switchModeOption(e, group, sid('napoleon'), spirit('emperor_warlock', 'napoleon'), DEFAULT_RULES);
    expect(e.choices.filter(c => c.sourceId === sid('napoleon') && !c.resolved)).toHaveLength(1);
  });
});

describe('timed states and floors', () => {
  it('Wisdom of the Sultan raises Wisdom to 24 only if lower and never lowers a higher score', () => {
    const cls = emperorWarlockClass;
    let e = bind(toLevel(start(cls), cls, 20), cls.id, 'saladin');
    expect(e.stats.wis).toBe(12);
    const { effectiveAbilityScores } = require('../../../../engine/pipeline');
    expect(effectiveAbilityScores(e).wis).toBe(24);
    e = { ...e, stats: { ...e.stats, wis: 26 } };
    expect(effectiveAbilityScores(e).wis).toBe(26);
  });

  it('Avatar of Tenochtitlan (Montezuma L20) sets floors for STR/DEX/CON/CHA while the condition lasts', () => {
    const cls = emperorWarlockClass;
    const { applyAbilityEffects } = require('../../../../engine/combat');
    const { registerHomebrewConditions } = require('../../../conditions/index');
    registerHomebrewConditions(BUILTIN_HOMEBREW.conditions);
    const { effectiveAbilityScores } = require('../../../../engine/pipeline');
    let e = bind(toLevel(start(cls), cls, 20), cls.id, 'montezuma');
    const avatar = e.features.find(f => f.id.endsWith('_avatar_of_tenochtitlan'))!;
    expect(effectiveAbilityScores(e).str).toBe(10);
    e = applyAbilityEffects(e, avatar.abilityEffects!, DEFAULT_RULES, avatar.activation);
    const s = effectiveAbilityScores(e);
    expect([s.str, s.dex, s.con, s.cha]).toEqual([22, 24, 22, 24]);
    expect(s.int).toBe(10);
  });
});

describe('Imperial Edicts', () => {
  const cls = emperorWarlockClass;
  const pick = (e: Entity, optionId: string) => {
    const pending = e.choices.find(c => !c.resolved && c.definition.kind === 'feature_pool' && c.definition.id.includes('edicts'))!;
    return applyPoolChoiceToEntity(e, pending.id, [optionId], DEFAULT_RULES);
  };

  it('level 2 queues a two-Edict choice from a pool of 17', () => {
    const e = toLevel(start(cls), cls, 2);
    const c = e.choices.find(x => x.definition.id.includes('edicts_2'))!;
    expect(c.definition.count).toBe(2);
    expect((c.definition.pool as unknown[]).length).toBe(17);
  });

  it('Battlefield Observer adds the Charisma modifier to initiative', () => {
    let e = toLevel(start(cls), cls, 2);
    const before = e.derived.initiative;
    const pending = e.choices.find(x => x.definition.id.includes('edicts_2'))!;
    e = applyPoolChoiceToEntity(e, pending.id, ['edict_battlefield_observer', 'edict_iron_discipline'], DEFAULT_RULES);
    expect(e.derived.initiative).toBe(before + 4);              // CHA 18 -> +4
    expect(e.derived.advantageStates.some(a => a.target === 'saving throws against being frightened')).toBe(true);
    void pick;
  });

  it('Scholar of Empires is expertise only when already proficient; Tactical Withdrawal grants a PB-per-Long-Rest pool', () => {
    let e = toLevel(start(cls), cls, 2);
    e = withProficiency(e, 'history');
    const pending = e.choices.find(x => x.definition.id.includes('edicts_2'))!;
    e = applyPoolChoiceToEntity(e, pending.id, ['edict_scholar_of_empires', 'edict_tactical_withdrawal'], DEFAULT_RULES);
    expect(e.skills.skills.history.expertise).toBe(true);
    expect(e.resources.custom.find(r => r.id === 'edict_tactical_withdrawal')).toMatchObject({ maximum: 2, perProficiencyBonus: true });
    e = toLevel(e, cls, 5);
    expect(e.resources.custom.find(r => r.id === 'edict_tactical_withdrawal')!.maximum).toBe(3);
  });

  it('Imperial Blast and Long-Range Artillery change Eldritch Blast\'s damage bonus and range', () => {
    let e = toLevel(start(cls), cls, 2);
    expect(spellRangeOverride(e, 'eldritch_blast')).toBeNull();
    expect(spellDamageBonus(e, 'eldritch_blast')).toBe(0);
    const pending = e.choices.find(x => x.definition.id.includes('edicts_2'))!;
    e = applyPoolChoiceToEntity(e, pending.id, ['edict_imperial_blast', 'edict_long_range_artillery'], DEFAULT_RULES);
    expect(spellRangeOverride(e, 'eldritch_blast')).toBe(300);
    expect(spellDamageBonus(e, 'eldritch_blast')).toBe(4);
  });
});

describe('Legacy Arcanum and Ceramic-free sanity', () => {
  const cls = emperorWarlockClass;
  it('levels 11/13/15/17 queue a 6th/7th/8th/9th-level Arcanum choice and grant its once-per-Long-Rest pool', () => {
    let e = toLevel(start(cls), cls, 17);
    for (const lvl of [6, 7, 8, 9]) {
      expect(e.choices.some(c => c.definition.id.includes(`legacy_arcanum_${lvl}`))).toBe(true);
      expect(e.resources.custom.find(r => r.id === `legacy_arcanum_${lvl}`)).toMatchObject({ maximum: 1, recharge: 'long_rest' });
    }
    const c = e.choices.find(x => x.definition.id.includes('legacy_arcanum_9'))!;
    e = applyPoolChoiceToEntity(e, c.id, ['arcanum_9_foresight'], DEFAULT_RULES);
    const card = e.features.find(f => f.id.endsWith('arcanum_9_foresight'))!;
    expect(card.abilityEffects).toEqual([{ type: 'cast_spell', spellId: 'foresight' }]);
    expect(card.activation!.resourceCost).toMatchObject({ resourceId: 'legacy_arcanum_9' });
  });

  it('uses the Warlock pact slot table (1 slot at level 1, 2 third-level slots at 5, 4 fifth-level slots at 17)', () => {
    // Pact slots are tracked separately from ordinary slots, exactly like the Warlock's own.
    expect(toLevel(start(cls), cls, 5).spellcasting!.pactSlots!['3'].total).toBe(2);
    expect(toLevel(start(cls), cls, 17).spellcasting!.pactSlots!['5'].total).toBe(4);
    expect(start(cls).spellcasting!.pactSlots!['1'].total).toBe(1);
  });
});

void applyDamage; void recomputeDerived;
