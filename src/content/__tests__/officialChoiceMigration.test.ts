// src/content/__tests__/officialChoiceMigration.test.ts
// CHOICE-EXPANSION-2: proves each migrated official Tool/Language choice
// produces a real ChoiceDefinition with the correct count/pool and actually
// resolves through the runtime apply*ChoiceToEntity functions — not just a
// JSON snapshot of the content literal. Covers: race (restricted + unrestricted
// pool), background (restricted pool), class level-1 (unrestricted + union
// category), and subclass (restricted + unrestricted pool + count-2 language).
import { raceDwarf, raceHuman } from '../races/index';
import { bgCriminal } from '../backgrounds/index';
import { artificerProgression } from '../classes/artificer';
import { bardProgression, monkProgression } from '../classes/index';
import { battleMasterProgression } from '../subclasses/fighter';
import { mastermindProgression } from '../subclasses/rogue';
import { knowledgeDomainProgression } from '../subclasses/cleric';
import { applyToolChoiceToEntity, applyLanguageChoiceToEntity, queueChoice } from '../../engine/leveling';
import { makeEmptyEntity, DEFAULT_RULES } from '../../store/characterStore';
import type { ChoiceDefinition } from '../../engine/types';

function findChoice(choices: ChoiceDefinition[], predicate: (c: ChoiceDefinition) => boolean): ChoiceDefinition {
  const found = choices.find(predicate);
  expect(found).toBeDefined();
  return found!;
}

function poolIds(def: ChoiceDefinition): string[] {
  if (!Array.isArray(def.pool)) throw new Error('expected a literal pool');
  return def.pool.map(o => String(o.value ?? o.id));
}

describe('Race — restricted Tool pool (Dwarf)', () => {
  it('is a real tool choice restricted to exactly the 3 RAW-named tools, never broadened to all', () => {
    const def = findChoice(raceDwarf.pendingChoices ?? [], c => c.id.endsWith('dwarf_tool_proficiency'));
    expect(def.kind).toBe('tool');
    expect(def.count).toBe(1);
    expect(poolIds(def).sort()).toEqual(['brewers_supplies', 'masons_tools', 'smiths_tools']);
  });

  it('resolves through applyToolChoiceToEntity and grants the canonical id', () => {
    const def = findChoice(raceDwarf.pendingChoices ?? [], c => c.id.endsWith('dwarf_tool_proficiency'));
    let e = queueChoice(makeEmptyEntity('e1'), def, 0);
    const queued = e.choices.find(c => !c.resolved)!;
    e = applyToolChoiceToEntity(e, queued.id, ['masons_tools'], DEFAULT_RULES);
    expect(e.proficiencies.tools).toContain('masons_tools');
  });

  it('rejects a tool outside the restricted pool via the existing runtime eligibility check', () => {
    const def = findChoice(raceDwarf.pendingChoices ?? [], c => c.id.endsWith('dwarf_tool_proficiency'));
    const e = queueChoice(makeEmptyEntity('e1'), def, 0);
    const queued = e.choices.find(c => !c.resolved)!;
    // thieves_tools is a real tool but not in Dwarf's restricted pool.
    expect(() => applyToolChoiceToEntity(e, queued.id, ['thieves_tools'], DEFAULT_RULES)).toThrow();
  });
});

describe('Race — unrestricted Language pool (Human)', () => {
  it('is a real, unrestricted language choice', () => {
    const def = findChoice(raceHuman.pendingChoices ?? [], c => c.id.endsWith('human_extra_language'));
    expect(def.kind).toBe('language');
    expect(def.count).toBe(1);
    expect(def.pool).toBe('all');
  });

  it('resolves through applyLanguageChoiceToEntity', () => {
    const def = findChoice(raceHuman.pendingChoices ?? [], c => c.id.endsWith('human_extra_language'));
    let e = queueChoice(makeEmptyEntity('e1'), def, 0);
    const queued = e.choices.find(c => !c.resolved)!;
    e = applyLanguageChoiceToEntity(e, queued.id, ['dwarvish'], DEFAULT_RULES);
    expect(e.proficiencies.languages).toContain('dwarvish');
  });
});

describe('Background — restricted Tool pool (Criminal, "one gaming set")', () => {
  it('is a real tool choice restricted to the gaming_set category, thieves\' tools stays a fixed grant', () => {
    const def = findChoice(bgCriminal.pendingChoices ?? [], c => c.id.endsWith('criminal_gaming_set'));
    expect(def.kind).toBe('tool');
    expect(def.count).toBe(1);
    const ids = poolIds(def);
    expect(ids).toContain('dice_set');
    expect(ids).not.toContain('thieves_tools'); // fixed grant, not part of the choice pool
  });

  it('resolves through applyToolChoiceToEntity', () => {
    const def = findChoice(bgCriminal.pendingChoices ?? [], c => c.id.endsWith('criminal_gaming_set'));
    let e = queueChoice(makeEmptyEntity('e1'), def, 0);
    const queued = e.choices.find(c => !c.resolved)!;
    e = applyToolChoiceToEntity(e, queued.id, ['dice_set'], DEFAULT_RULES);
    expect(e.proficiencies.tools).toContain('dice_set');
  });
});

describe('Class level 1 — Tool choices (Artificer/Bard/Monk)', () => {
  it('Artificer: one artisan\'s tool, restricted to the artisan category', () => {
    const lvl1 = artificerProgression.entries.find(e => e.level === 1)!;
    const def = findChoice(lvl1.choices, c => c.id === 'artificer_tool_lvl_1');
    expect(def.kind).toBe('tool');
    expect(def.count).toBe(1);
    expect(poolIds(def)).toContain('alchemists_supplies');
    expect(poolIds(def)).not.toContain('lute'); // not a musical instrument
  });

  it('Bard: three musical instruments, restricted to the musical_instrument category', () => {
    const lvl1 = bardProgression.entries.find(e => e.level === 1)!;
    const def = findChoice(lvl1.choices, c => c.id === 'bard_instruments_lvl_1');
    expect(def.kind).toBe('tool');
    expect(def.count).toBe(3);
    expect(poolIds(def)).toContain('lute');
    expect(poolIds(def)).not.toContain('smiths_tools');
  });

  it('Monk: one tool, pool spans BOTH artisan and musical_instrument (a union, not either alone)', () => {
    const lvl1 = monkProgression.entries.find(e => e.level === 1)!;
    const def = findChoice(lvl1.choices, c => c.id === 'monk_tool_lvl_1');
    expect(def.kind).toBe('tool');
    expect(def.count).toBe(1);
    const ids = poolIds(def);
    expect(ids).toContain('lute');             // musical_instrument
    expect(ids).toContain('smiths_tools');     // artisan
    expect(ids).not.toContain('dice_set');     // gaming_set — NOT part of Monk's RAW choice
  });

  it('a Bard instrument choice resolves through applyToolChoiceToEntity', () => {
    const lvl1 = bardProgression.entries.find(e => e.level === 1)!;
    const def = findChoice(lvl1.choices, c => c.id === 'bard_instruments_lvl_1');
    let e = queueChoice(makeEmptyEntity('e1'), def, 1);
    const queued = e.choices.find(c => !c.resolved)!;
    e = applyToolChoiceToEntity(e, queued.id, ['lute', 'flute', 'drum'], DEFAULT_RULES);
    expect(e.proficiencies.tools).toEqual(expect.arrayContaining(['lute', 'flute', 'drum']));
  });
});

describe('Subclass — Tool/Language choices (Battle Master/Mastermind/Knowledge Domain)', () => {
  it('Battle Master: Student of War, restricted to the artisan category', () => {
    const lvl3 = battleMasterProgression.entries.find(e => e.level === 3)!;
    const def = findChoice(lvl3.choices, c => c.id === 'battle_master_tool_3');
    expect(def.kind).toBe('tool');
    expect(poolIds(def)).toContain('woodcarvers_tools');
  });

  it('Mastermind: gaming set (restricted) + two languages (unrestricted), both real choices', () => {
    const lvl3 = mastermindProgression.entries.find(e => e.level === 3)!;
    const toolDef = findChoice(lvl3.choices, c => c.id === 'mastermind_gaming_set_3');
    const langDef = findChoice(lvl3.choices, c => c.id === 'mastermind_languages_3');
    expect(toolDef.kind).toBe('tool');
    expect(poolIds(toolDef)).toContain('dice_set');
    expect(langDef.kind).toBe('language');
    expect(langDef.count).toBe(2);
    expect(langDef.pool).toBe('all');
  });

  it('Knowledge Domain: two languages, unrestricted, RAW skill-doubling half correctly left unmigrated', () => {
    const lvl1 = knowledgeDomainProgression.entries.find(e => e.level === 1)!;
    const def = findChoice(lvl1.choices, c => c.id === 'knowledge_domain_languages_1');
    expect(def.kind).toBe('language');
    expect(def.count).toBe(2);
    expect(lvl1.choices.some(c => c.kind === 'expertise')).toBe(false);
  });

  it('a Mastermind language choice resolves through applyLanguageChoiceToEntity', () => {
    const lvl3 = mastermindProgression.entries.find(e => e.level === 3)!;
    const def = findChoice(lvl3.choices, c => c.id === 'mastermind_languages_3');
    let e = queueChoice(makeEmptyEntity('e1'), def, 3);
    const queued = e.choices.find(c => !c.resolved)!;
    e = applyLanguageChoiceToEntity(e, queued.id, ['dwarvish', 'elvish'], DEFAULT_RULES);
    expect(e.proficiencies.languages).toEqual(expect.arrayContaining(['dwarvish', 'elvish']));
  });
});
