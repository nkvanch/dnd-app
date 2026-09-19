// src/engine/__tests__/homebrewValidator.test.ts
// First test coverage for this file. validateContent's type union/switch
// was missing 'subrace', 'subclass', and 'item' — dead code today (nothing
// calls it generically yet), but a real gap: a full character export/
// import round-trip validating homebrew content generically would have
// silently fallen through to "Unknown type" for exactly those three types
// (audit bug #10). Locks in the fix: all 11 ContentCacheType members now
// dispatch to a real validator via validateContent, and the two brand-new
// validators (validateSubclass, validateItem) enforce their own genuinely
// different required-field shapes.
import { validateContent, validateSubclass, validateItem, validateEntityShape } from '../homebrewValidator';
import { makeEmptyEntity } from '../../store/characterStore';

describe('validateContent — dispatches every content type to a real validator (audit bug #10)', () => {
  it('routes "subrace" to the same {id, name, features[]} shape check as race', () => {
    const result = validateContent('subrace', { id: 'sr1', name: 'Test Subrace', parentId: 'human', features: [] });
    expect(result.valid).toBe(true);
  });

  it('routes "subclass" to validateSubclass, not the unrelated CharClass shape', () => {
    const result = validateContent('subclass', {
      id: 'sc1', name: 'Test Subclass', classId: 'fighter',
      entries: [{ level: 3, grants: [], choices: [] }],
    });
    expect(result.valid).toBe(true);
  });

  it('routes "item" to validateItem', () => {
    const result = validateContent('item', {
      id: 'it1', name: 'Test Item', weight: 1, cost: '10 gp', properties: [], features: [],
    });
    expect(result.valid).toBe(true);
  });

  it('no longer falls through to "Unknown type" for any of the 3 previously-missing types', () => {
    for (const type of ['subrace', 'subclass', 'item'] as const) {
      const result = validateContent(type, {});
      expect(result.errors.some(e => e.startsWith('Unknown type'))).toBe(false);
    }
  });

  it('still dispatches every previously-supported type correctly (no regression)', () => {
    expect(validateContent('race', { id: 'r1', name: 'R', features: [] }).valid).toBe(true);
    expect(validateContent('class', { id: 'c1', name: 'C', hitDie: 8, features: [] }).valid).toBe(true);
    expect(validateContent('monster', {
      id: 'm1', name: 'M', cr: 0.25, size: 'Medium', type: 'beast', alignment: 'unaligned',
      stats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      hp: { dice: '2d8', average: 9 }, ac: { value: 12 }, speed: 30, features: [],
    }).valid).toBe(true);
  });
});

describe('validateSubclass', () => {
  it('requires id, name, classId, and an entries array', () => {
    const result = validateSubclass({});
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([
      'id: required string', 'name: required string', 'classId: required string', 'entries: must be an array',
    ]));
  });

  it('flags a malformed entry (missing level) without crashing', () => {
    const result = validateSubclass({ id: 'sc1', name: 'S', classId: 'wizard', entries: [{ grants: [], choices: [] }] });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('entries[0].level: required number');
  });

  it('warns (not errors) when a well-formed entry omits grants/choices', () => {
    const result = validateSubclass({ id: 'sc1', name: 'S', classId: 'wizard', entries: [{ level: 2 }] });
    expect(result.valid).toBe(true);
    expect(result.warnings).toEqual(expect.arrayContaining([
      'entries[0].grants: missing (using [])', 'entries[0].choices: missing (using [])',
    ]));
  });
});

describe('validateItem', () => {
  it('requires id, name, and a features array', () => {
    const result = validateItem({});
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([
      'id: required string', 'name: required string', 'features: must be an array',
    ]));
  });

  it('warns (not errors) when weight/cost/properties are missing', () => {
    const result = validateItem({ id: 'it1', name: 'I', features: [] });
    expect(result.valid).toBe(true);
    expect(result.warnings).toEqual(expect.arrayContaining([
      'weight: missing (using 0)', 'cost: missing (using "")', 'properties: missing (using [])',
    ]));
  });

  it('validates each feature in the array via the shared feature validator', () => {
    const result = validateItem({ id: 'it1', name: 'I', features: [{ name: 'no id' }] });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('features[0].id: required string');
  });
});

// Re-audit A07: structural validator for untrusted Entity blobs at the
// import (backup.ts) and native-load (entityRepo.ts) boundaries — distinct
// from engine/validation.ts's validateEntity(), which assumes a
// structurally-sound Entity already.
describe('validateEntityShape', () => {
  function validEntity(overrides: Record<string, unknown> = {}) {
    return { ...makeEmptyEntity('c1'), ...overrides };
  }

  it('accepts a well-formed minimal entity', () => {
    const result = validateEntityShape(validEntity());
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('rejects a non-object', () => {
    expect(validateEntityShape(null).valid).toBe(false);
    expect(validateEntityShape('not an entity').valid).toBe(false);
    expect(validateEntityShape(undefined).valid).toBe(false);
  });

  it('rejects the exact re-audit-named malformed shape: {id, identity.name, features} with no kind/stats/resources/inventory', () => {
    const result = validateEntityShape({ id: 'bad', identity: { name: 'Bad' }, features: [] });
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([
      expect.stringContaining('kind'),
      expect.stringContaining('stats'),
      expect.stringContaining('resources'),
      expect.stringContaining('inventory'),
    ]));
  });

  it('rejects an unrecognized kind', () => {
    const result = validateEntityShape(validEntity({ kind: 'not-a-real-kind' }));
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.startsWith('kind:'))).toBe(true);
  });

  it('rejects missing identity.level and identity.name', () => {
    const result = validateEntityShape(validEntity({ identity: {} }));
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([
      'identity.name: required string', 'identity.level: finite nonnegative number required',
    ]));
  });

  it('rejects an identity.classes that is present but not an array', () => {
    const result = validateEntityShape(validEntity({ identity: { name: 'X', level: 1, classes: 'not-an-array' } }));
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('identity.classes: must be an array');
  });

  it('rejects stats missing an ability', () => {
    const result = validateEntityShape(validEntity({ stats: { str: 10, dex: 10, con: 10, int: 10, wis: 10 } })); // missing cha
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('stats.cha: finite value from 0 to 100 required');
  });

  it('rejects resources.hp missing current/maximum', () => {
    const result = validateEntityShape(validEntity({ resources: { hp: {} } }));
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([
      'resources.hp.current: invalid', 'resources.hp.maximum: invalid',
    ]));
  });

  it('rejects features that is not an array', () => {
    const result = validateEntityShape(validEntity({ features: 'not-an-array' }));
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('features: required array');
  });

  it('rejects inventory missing equipped/carried arrays', () => {
    const result = validateEntityShape(validEntity({ inventory: {} }));
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([
      'inventory.equipped: required array', 'inventory.carried: required array',
    ]));
  });

  it('accepts a well-formed spellcasting block, rejects a malformed one', () => {
    const good = validateEntityShape(validEntity({
      spellcasting: { ability: 'int', known: [], prepared: [], cantrips: [], slots: { '1': { total: 2, used: 0 } } },
    }));
    expect(good.valid).toBe(true);

    const bad = validateEntityShape(validEntity({ spellcasting: { slots: {} } })); // missing ability
    expect(bad.valid).toBe(false);
    expect(bad.errors).toContain('spellcasting.ability: invalid');
  });

  it('rejects a missing choices array at the canonical deep boundary', () => {
    const entity = validEntity();
    delete (entity as { choices?: unknown }).choices;
    const result = validateEntityShape(entity);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('choices: required array');
  });
});
