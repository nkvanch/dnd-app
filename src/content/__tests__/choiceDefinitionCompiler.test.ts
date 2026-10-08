// src/content/__tests__/choiceDefinitionCompiler.test.ts
// CHOICE-AUTHORING-1: round-trip tests for the shared choice-authoring
// compiler — the concrete proof that "create -> save -> reopen -> same
// count/pool/options -> save again -> semantic definition unchanged" holds,
// per the homebrew authoring task's completion criteria.
import {
  newDraftChoice, draftChoiceToDefinition, definitionToDraftChoice,
  validateDraftChoice, idsForCategories, DraftChoice,
} from '../choiceDefinitionCompiler';
import { ALL_TOOLS } from '../tools';
import { ALL_LANGUAGES } from '../languages';
import { ALL_SKILL_OPTIONS } from '../skills';
import { ChoiceDefinition } from '../../engine/types';

function poolIdSet(def: ChoiceDefinition): Set<string> | 'all' {
  if (def.pool === 'all') return 'all';
  if (!Array.isArray(def.pool)) throw new Error('unexpected FilterExpression pool');
  return new Set(def.pool.map(o => String(o.value ?? o.id)));
}

/** Compiles once, reopens into a fresh draft, compiles again — asserts the
 * two compiled ChoiceDefinitions are semantically identical (same kind,
 * count, prompt, and pool id set) even if the draft's own poolMode differs
 * in representation (e.g. category vs restricted). */
function roundTrip(draft: DraftChoice, idPrefix = 'race_choice_') {
  const first = draftChoiceToDefinition(draft, idPrefix);
  const reopened = definitionToDraftChoice(first, idPrefix);
  expect(reopened).not.toBeNull();
  const second = draftChoiceToDefinition(reopened!, idPrefix);
  expect(second.kind).toBe(first.kind);
  expect(second.count).toBe(first.count);
  expect(second.prompt).toBe(first.prompt);
  expect(second.id).toBe(first.id);
  expect(poolIdSet(second)).toEqual(poolIdSet(first));
  return { first, reopened: reopened!, second };
}

describe('choiceDefinitionCompiler round-trips', () => {
  test('Expertise unrestricted (all)', () => {
    const draft = newDraftChoice('expertise');
    draft.count = '2';
    const { first, reopened } = roundTrip(draft);
    expect(first.kind).toBe('expertise');
    expect(first.pool).toBe('all');
    expect(first.count).toBe(2);
    expect(reopened.poolMode).toBe('all');
  });

  test('Expertise restricted', () => {
    const draft = newDraftChoice('expertise');
    draft.count = '1';
    draft.poolMode = 'restricted';
    draft.restrictedIds = ['stealth', 'perception'];
    const { first, reopened } = roundTrip(draft);
    expect(poolIdSet(first)).toEqual(new Set(['stealth', 'perception']));
    expect(reopened.poolMode).toBe('restricted');
    expect(new Set(reopened.restrictedIds)).toEqual(new Set(['stealth', 'perception']));
  });

  test('Tool unrestricted (all)', () => {
    const draft = newDraftChoice('tool');
    const { first, reopened } = roundTrip(draft, 'background_choice_');
    expect(first.pool).toBe('all');
    expect(reopened.poolMode).toBe('all');
  });

  test('Tool category (gaming sets) compiles to canonical literal ids and reopens as category', () => {
    const draft = newDraftChoice('tool');
    draft.poolMode = 'category';
    draft.categories = ['gaming_set'];
    const { first, reopened } = roundTrip(draft, 'background_choice_');
    const expectedIds = new Set(
      ALL_TOOLS.filter(t => t.category === 'gaming_set').map(t => t.id),
    );
    expect(poolIdSet(first)).toEqual(expectedIds);
    expect(reopened.poolMode).toBe('category');
    expect(reopened.categories).toEqual(['gaming_set']);
  });

  test('Tool restricted preserves exact canonical ids, not display labels', () => {
    const draft = newDraftChoice('tool');
    draft.poolMode = 'restricted';
    draft.restrictedIds = ['smiths_tools', 'brewers_supplies', 'masons_tools'];
    const { first, reopened } = roundTrip(draft, 'race_choice_');
    expect(poolIdSet(first)).toEqual(new Set(['smiths_tools', 'brewers_supplies', 'masons_tools']));
    // Mechanical identity is the id, never the label.
    if (Array.isArray(first.pool)) {
      for (const opt of first.pool) expect(opt.value).toBe(opt.id);
    }
    expect(reopened.poolMode).toBe('restricted');
  });

  test('Language unrestricted (all)', () => {
    const draft = newDraftChoice('language');
    draft.count = '2';
    const { first } = roundTrip(draft, 'race_choice_');
    expect(first.pool).toBe('all');
    expect(first.count).toBe(2);
  });

  test('Language category (common) compiles to canonical ids and reopens as category', () => {
    const draft = newDraftChoice('language');
    draft.poolMode = 'category';
    draft.categories = ['common'];
    const { first, reopened } = roundTrip(draft, 'race_choice_');
    const expectedIds = new Set(ALL_LANGUAGES.filter(l => l.category === 'common').map(l => l.id));
    expect(poolIdSet(first)).toEqual(expectedIds);
    expect(reopened.poolMode).toBe('category');
  });

  test('Language restricted list', () => {
    const draft = newDraftChoice('language');
    draft.poolMode = 'restricted';
    draft.restrictedIds = ['dwarvish', 'elvish', 'gnomish'];
    const { first, reopened } = roundTrip(draft, 'race_choice_');
    expect(poolIdSet(first)).toEqual(new Set(['dwarvish', 'elvish', 'gnomish']));
    expect(reopened.poolMode).toBe('restricted');
  });

  test('explicit secret-language inclusion in a restricted pool survives round-trip unbroadened', () => {
    const secretIds = ALL_LANGUAGES.filter(l => l.category === 'secret').map(l => l.id);
    expect(secretIds.length).toBeGreaterThan(0); // sanity: registry actually has secret languages
    const draft = newDraftChoice('language');
    draft.poolMode = 'restricted';
    draft.restrictedIds = [...secretIds, 'common'];
    const { first, reopened } = roundTrip(draft, 'race_choice_');
    for (const id of secretIds) expect((poolIdSet(first) as Set<string>).has(id)).toBe(true);
    expect(reopened.poolMode).toBe('restricted');
    // Never silently generalized to the 'all' sentinel, which would exclude
    // secret languages again per the default-pool convention.
    expect(first.pool).not.toBe('all');
  });

  test('definitionToDraftChoice returns null for a kind this editor does not author', () => {
    const skillChoice: ChoiceDefinition = {
      id: 'x', prompt: 'p', kind: 'skill', count: 1, pool: 'all', grants: [], required: true, resolved: false,
    };
    expect(definitionToDraftChoice(skillChoice)).toBeNull();
  });

  test('idsForCategories never includes ids outside the requested categories', () => {
    const artisanOnly = idsForCategories('tool', ['artisan']);
    for (const id of artisanOnly) {
      const t = ALL_TOOLS.find(x => x.id === id);
      expect(t?.category).toBe('artisan');
    }
  });
});

describe('validateDraftChoice', () => {
  test('flags count > restricted pool size', () => {
    const d = newDraftChoice('expertise');
    d.count = '3';
    d.poolMode = 'restricted';
    d.restrictedIds = ['stealth', 'perception'];
    const errors = validateDraftChoice(d);
    expect(errors.some(e => e.includes('exceeds'))).toBe(true);
  });

  test('flags empty restricted pool', () => {
    const d = newDraftChoice('tool');
    d.poolMode = 'restricted';
    d.restrictedIds = [];
    expect(validateDraftChoice(d).some(e => e.includes('empty'))).toBe(true);
  });

  test('flags duplicate ids in restricted pool', () => {
    const d = newDraftChoice('language');
    d.poolMode = 'restricted';
    d.restrictedIds = ['common', 'common'];
    expect(validateDraftChoice(d).some(e => e.includes('duplicate'))).toBe(true);
  });

  test('flags unknown registry ids', () => {
    const d = newDraftChoice('tool');
    d.poolMode = 'restricted';
    d.restrictedIds = ['not_a_real_tool'];
    expect(validateDraftChoice(d).some(e => e.includes('Unknown'))).toBe(true);
  });

  test('flags empty category selection', () => {
    const d = newDraftChoice('language');
    d.poolMode = 'category';
    d.categories = [];
    expect(validateDraftChoice(d).some(e => e.includes('category'))).toBe(true);
  });

  test('flags count exceeding a too-small category selection', () => {
    const d = newDraftChoice('language');
    d.poolMode = 'category';
    d.categories = ['secret']; // only 2 entries
    d.count = '5';
    expect(validateDraftChoice(d).some(e => e.includes('exceeds'))).toBe(true);
  });

  test('valid unrestricted draft has zero errors', () => {
    const d = newDraftChoice('expertise');
    d.count = '2';
    expect(validateDraftChoice(d)).toEqual([]);
  });
});

test('every skill option is a legal expertise restricted-pool id', () => {
  const ids = new Set(ALL_SKILL_OPTIONS.map(o => o.id));
  const d = newDraftChoice('expertise');
  d.poolMode = 'restricted';
  d.restrictedIds = [...ids];
  expect(validateDraftChoice(d)).toEqual([]);
});
