// src/engine/__tests__/validation.test.ts
import { validateEntity } from '../validation';
import { makeEmptyEntity } from '../../store/characterStore';
import {
  Entity, ContentDB, HomebrewSubclass, Race, CharClass, Background, Feat,
  RulesetId,
} from '../types';

const asRulesetId = (id: string): RulesetId => id as RulesetId;

function baseContentDB(): ContentDB {
  const race: Race = {
    id: 'human', name: 'Human', features: [],
    subraces: [{ id: 'variant_human', name: 'Variant Human', parentId: 'human', features: [] }],
  };
  const cls: CharClass = { id: 'fighter', name: 'Fighter', hitDie: 10, features: [] };
  const bg: Background = { id: 'soldier', name: 'Soldier', features: [] };
  // Only `.id` matters for validateEntity's lookups — the rest is padding
  // to satisfy the type, not exercised by these tests.
  const feat = {
    id: 'alert', name: 'Alert', prerequisite: null, description: '', source: 'PHB',
    feature: {
      id: 'alert_f', name: 'Alert', description: '', level: null, passive: true,
      source: { kind: 'feat', refId: 'alert' }, effects: [], actions: [], choices: [],
    },
  } as unknown as Feat;
  return {
    races: [race], classes: [cls], backgrounds: [bg],
    spells: [], items: [], conditions: [], features: [], feats: [feat],
  };
}

function withCharacter(overrides: Partial<Entity>): Entity {
  const e = makeEmptyEntity('test-char');
  return { ...e, ...overrides, identity: { ...e.identity, ...(overrides.identity ?? {}) } };
}

describe('validateEntity', () => {
  it('returns no issues for a fully-resolved character', () => {
    const entity = withCharacter({
      identity: { raceId: 'human', subRaceId: 'variant_human', classId: 'fighter', backgroundId: 'soldier' } as any,
    });
    expect(validateEntity(entity, baseContentDB(), [])).toEqual([]);
  });

  it('skips all checks for non-character entities (companion/monster reuse raceId/classId as template ids)', () => {
    const entity = withCharacter({ kind: 'monster', identity: { raceId: 'nonexistent', classId: 'nonexistent' } as any });
    expect(validateEntity(entity, baseContentDB(), [])).toEqual([]);
  });

  it('flags a missing race', () => {
    const entity = withCharacter({ identity: { raceId: 'nonexistent_race' } as any });
    const issues = validateEntity(entity, baseContentDB(), []);
    expect(issues).toContainEqual(expect.objectContaining({ code: 'missing_race', severity: 'error', affectedId: 'nonexistent_race' }));
  });

  it('flags a missing subrace only when the parent race resolves', () => {
    const entity = withCharacter({ identity: { raceId: 'human', subRaceId: 'nonexistent_subrace' } as any });
    const issues = validateEntity(entity, baseContentDB(), []);
    expect(issues).toContainEqual(expect.objectContaining({ code: 'missing_subrace', affectedId: 'nonexistent_subrace' }));
  });

  it('does not double-report a subrace when the race itself is already missing', () => {
    const entity = withCharacter({ identity: { raceId: 'nonexistent_race', subRaceId: 'variant_human' } as any });
    const issues = validateEntity(entity, baseContentDB(), []);
    expect(issues.filter(i => i.code === 'missing_subrace')).toHaveLength(0);
  });

  it('flags a missing class and skips its subclass check', () => {
    const entity = withCharacter({
      identity: { classes: [{ classId: 'nonexistent_class', subclassId: 'anything', level: 1 }] } as any,
    });
    const issues = validateEntity(entity, baseContentDB(), []);
    expect(issues).toContainEqual(expect.objectContaining({ code: 'missing_class', affectedId: 'nonexistent_class' }));
    expect(issues.filter(i => i.code === 'missing_subclass')).toHaveLength(0);
  });

  it('flags a missing subclass under a real class', () => {
    const entity = withCharacter({
      identity: { classes: [{ classId: 'fighter', subclassId: 'nonexistent_subclass', level: 1 }] } as any,
    });
    const homebrewSubclasses: HomebrewSubclass[] = [];
    const issues = validateEntity(entity, baseContentDB(), homebrewSubclasses);
    expect(issues).toContainEqual(expect.objectContaining({ code: 'missing_subclass', affectedId: 'nonexistent_subclass' }));
  });

  it('flags a missing background', () => {
    const entity = withCharacter({ identity: { backgroundId: 'nonexistent_bg' } as any });
    const issues = validateEntity(entity, baseContentDB(), []);
    expect(issues).toContainEqual(expect.objectContaining({ code: 'missing_background', affectedId: 'nonexistent_bg' }));
  });

  it('flags a ruleset mismatch as info, not error, and still resolves the content', () => {
    const contentDB = baseContentDB();
    contentDB.races[0] = { ...contentDB.races[0], rulesetId: asRulesetId('dnd5e-2024') };
    const entity = withCharacter({ identity: { raceId: 'human' } as any, rulesetId: asRulesetId('dnd5e-2014') });
    const issues = validateEntity(entity, contentDB, []);
    expect(issues).toContainEqual(expect.objectContaining({ code: 'ruleset_mismatch', severity: 'info', affectedId: 'human' }));
    expect(issues.filter(i => i.code === 'missing_race')).toHaveLength(0);
  });

  it('flags a missing spell referenced in spellcasting', () => {
    const entity = withCharacter({
      spellcasting: {
        ability: 'int', slots: {} as any, cantrips: ['nonexistent_spell'], known: [], prepared: [],
        concentrating: null,
      },
    });
    const issues = validateEntity(entity, baseContentDB(), []);
    expect(issues).toContainEqual(expect.objectContaining({ code: 'missing_spell', severity: 'warning', affectedId: 'nonexistent_spell' }));
  });

  it('flags a missing item in carried or equipped inventory', () => {
    const entity = withCharacter({
      inventory: {
        equipped: [{ itemId: 'nonexistent_item', features: [] } as any],
        carried: [],
        currency: { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 },
      },
    });
    const issues = validateEntity(entity, baseContentDB(), []);
    expect(issues).toContainEqual(expect.objectContaining({ code: 'missing_item', severity: 'warning', affectedId: 'nonexistent_item' }));
  });

  it('flags an orphaned resolved feat choice selection', () => {
    const entity = withCharacter({
      choices: [{
        id: 'c1',
        definition: { id: 'c1', prompt: '', kind: 'feat', count: 1, pool: 'all', grants: [], required: false, resolved: true },
        grantedAt: 1, resolved: true, selections: ['nonexistent_feat'],
      }],
    });
    const issues = validateEntity(entity, baseContentDB(), []);
    expect(issues).toContainEqual(expect.objectContaining({ code: 'orphaned_choice_selection', affectedId: 'nonexistent_feat' }));
  });

  it('does not flag an unresolved choice, even with a bogus selection', () => {
    const entity = withCharacter({
      choices: [{
        id: 'c1',
        definition: { id: 'c1', prompt: '', kind: 'feat', count: 1, pool: 'all', grants: [], required: false, resolved: false },
        grantedAt: 1, resolved: false, selections: ['nonexistent_feat'],
      }],
    });
    const issues = validateEntity(entity, baseContentDB(), []);
    expect(issues.filter(i => i.code === 'orphaned_choice_selection')).toHaveLength(0);
  });

  it('does not flag skill-kind choices (skills are a closed engine enum, not a content-id lookup)', () => {
    const entity = withCharacter({
      choices: [{
        id: 'c1',
        definition: { id: 'c1', prompt: '', kind: 'skill', count: 1, pool: 'all', grants: [], required: false, resolved: true },
        grantedAt: 1, resolved: true, selections: ['perception'],
      }],
    });
    const issues = validateEntity(entity, baseContentDB(), []);
    expect(issues).toEqual([]);
  });

  // CHOICE-EXPANSION-1: tool/language now DO have a real registry
  // (src/content/tools.ts, src/content/languages.ts) to check selections
  // against — this is the deliberate reversal of the gap the previous test
  // in this file documented.
  it('flags a resolved tool choice selection missing from the registry', () => {
    const entity = withCharacter({
      choices: [{
        id: 'c1',
        definition: { id: 'c1', prompt: '', kind: 'tool', count: 1, pool: 'all', grants: [], required: false, resolved: true },
        grantedAt: 1, resolved: true, selections: ['nonexistent_tool'],
      }],
    });
    const issues = validateEntity(entity, baseContentDB(), []);
    expect(issues.some(i => i.code === 'missing_tool_definition' && i.affectedId === 'nonexistent_tool')).toBe(true);
  });

  it('does not flag a resolved tool choice selection that IS in the registry', () => {
    const entity = withCharacter({
      choices: [{
        id: 'c1',
        definition: { id: 'c1', prompt: '', kind: 'tool', count: 1, pool: 'all', grants: [], required: false, resolved: true },
        grantedAt: 1, resolved: true, selections: ['thieves_tools'],
      }],
    });
    const issues = validateEntity(entity, baseContentDB(), []);
    expect(issues.filter(i => i.code === 'missing_tool_definition')).toHaveLength(0);
  });

  it('flags a resolved language choice selection missing from the registry', () => {
    const entity = withCharacter({
      choices: [{
        id: 'c1',
        definition: { id: 'c1', prompt: '', kind: 'language', count: 1, pool: 'all', grants: [], required: false, resolved: true },
        grantedAt: 1, resolved: true, selections: ['nonexistent_language'],
      }],
    });
    const issues = validateEntity(entity, baseContentDB(), []);
    expect(issues.some(i => i.code === 'missing_language_definition' && i.affectedId === 'nonexistent_language')).toBe(true);
  });
});
