// src/content/classes/__tests__/levelChoiceAuthoring.test.ts
// CHOICE-AUTHORING-1: CharClass.levelChoices (authored via class-builder.tsx
// / subclass-builder.tsx) actually reaches a real character. buildProgressionFromClass
// merges it into the matching LevelEntry.choices, and levelUp queues it through
// the exact same queueChoice path the ASI/spellcasting_ability choices already
// use — no new runtime wiring, just a new content source feeding an existing pipe.
import { buildProgressionFromClass } from '../progressions';
import { levelUp, applyToolChoiceToEntity } from '../../../engine/leveling';
import { makeEmptyEntity, DEFAULT_RULES } from '../../../store/characterStore';
import type { CharClass, ChoiceDefinition } from '../../../engine/types';

function toolDef(id: string): ChoiceDefinition {
  return { id, prompt: 'Choose 1 tool proficiency.', kind: 'tool', count: 1, pool: 'all', grants: [], required: true, resolved: false };
}

function baseClass(overrides: Partial<CharClass> = {}): CharClass {
  return { id: 'test_class', name: 'Test Class', hitDie: 8, features: [], ...overrides };
}

describe('CharClass.levelChoices -> buildProgressionFromClass', () => {
  it('merges an authored choice into the matching level entry only', () => {
    const cls = baseClass({ levelChoices: [{ level: 3, choices: [toolDef('test_class_l3_tool')] }] });
    const progression = buildProgressionFromClass(cls);
    const lvl3 = progression.entries.find(e => e.level === 3)!;
    const lvl2 = progression.entries.find(e => e.level === 2)!;
    expect(lvl3.choices.some(c => c.id === 'test_class_l3_tool')).toBe(true);
    expect(lvl2.choices.some(c => c.id === 'test_class_l3_tool')).toBe(false);
  });

  it('coexists with a synthesized ASI choice at the same level', () => {
    const cls = baseClass({
      asiLevels: [3],
      levelChoices: [{ level: 3, choices: [toolDef('test_class_l3_tool')] }],
    });
    const progression = buildProgressionFromClass(cls);
    const lvl3 = progression.entries.find(e => e.level === 3)!;
    expect(lvl3.choices.some(c => c.kind === 'asi')).toBe(true);
    expect(lvl3.choices.some(c => c.id === 'test_class_l3_tool')).toBe(true);
  });

  it('multiple choices authored at the same level all merge in', () => {
    const cls = baseClass({
      levelChoices: [{ level: 5, choices: [toolDef('a'), toolDef('b')] }],
    });
    const progression = buildProgressionFromClass(cls);
    const lvl5 = progression.entries.find(e => e.level === 5)!;
    expect(lvl5.choices.map(c => c.id).sort()).toEqual(['a', 'b']);
  });

  it('no levelChoices set behaves exactly as before (no choices beyond ASI/spellcasting)', () => {
    const cls = baseClass();
    const progression = buildProgressionFromClass(cls);
    const lvl3 = progression.entries.find(e => e.level === 3)!;
    expect(lvl3.choices).toEqual([]);
  });
});

describe('a homebrew class-authored choice resolves end to end via levelUp', () => {
  it('levelUp queues the authored choice at the right level, and it resolves through the same applyToolChoiceToEntity path official content uses', () => {
    const cls = baseClass({ levelChoices: [{ level: 2, choices: [toolDef('herolass_l2_tool')] }] });
    const progression = buildProgressionFromClass(cls);
    let e = { ...makeEmptyEntity('e1'), identity: { ...makeEmptyEntity('e1').identity, level: 1, classId: 'test_class' } };

    e = levelUp(e, 2, progression, DEFAULT_RULES);
    const queued = e.choices.find(c => c.definition.id.endsWith('herolass_l2_tool') && !c.resolved);
    expect(queued).toBeDefined();

    e = applyToolChoiceToEntity(e, queued!.id, ['thieves_tools'], DEFAULT_RULES);
    expect(e.proficiencies.tools).toContain('thieves_tools');
    expect(e.choices.find(c => c.id === queued!.id)!.resolved).toBe(true);
  });
});
