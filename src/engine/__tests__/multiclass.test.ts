// src/engine/__tests__/multiclass.test.ts
// The single source of truth for reading/writing Identity.classes. Every
// function here is small and pure but load-bearing — a bug in
// getClassLevels' legacy fallback or syncLegacyIdentity's mirroring would
// silently corrupt every pre-multiclass save (the common case) or every
// class-list display for a multiclassed character.
import { makeEmptyEntity } from '../../store/characterStore';
import {
  getClassLevels, isMulticlassed, getClassEntry, hasClassId, totalLevelOf,
  syncLegacyIdentity, formatClassLabel, multiclassProficienciesFor, migrateEntity,
} from '../multiclass';
import { Entity, ClassLevelEntry, CharClass } from '../types';

describe('getClassLevels', () => {
  it('returns identity.classes verbatim when present', () => {
    const classes: ClassLevelEntry[] = [
      { classId: 'fighter', subclassId: 'champion', level: 3 },
      { classId: 'wizard', subclassId: null, level: 2 },
    ];
    const e: Entity = { ...makeEmptyEntity('e1'), identity: { ...makeEmptyEntity('e1').identity, classes } };
    expect(getClassLevels(e)).toBe(classes);
  });

  it('synthesizes a single-entry array from legacy classId/subclassId/level when classes is absent', () => {
    const e = makeEmptyEntity('e1');
    e.identity.classId = 'rogue';
    e.identity.subclassId = 'thief';
    e.identity.level = 5;
    expect(getClassLevels(e)).toEqual([{ classId: 'rogue', subclassId: 'thief', level: 5 }]);
  });

  it('returns an empty array for an entity with no class at all (fresh creation draft)', () => {
    const e = makeEmptyEntity('e1');
    expect(getClassLevels(e)).toEqual([]);
  });

  it('falls back to legacy fields when classes is present but empty', () => {
    const e = makeEmptyEntity('e1');
    e.identity.classId = 'cleric';
    e.identity.level = 1;
    e.identity.classes = [];
    expect(getClassLevels(e)).toEqual([{ classId: 'cleric', subclassId: null, level: 1 }]);
  });
});

describe('isMulticlassed', () => {
  it('is false for a single-class character', () => {
    const e = makeEmptyEntity('e1');
    e.identity.classId = 'fighter';
    e.identity.level = 5;
    expect(isMulticlassed(e)).toBe(false);
  });

  it('is true once a second class exists', () => {
    const e = makeEmptyEntity('e1');
    e.identity.classes = [
      { classId: 'fighter', subclassId: null, level: 3 },
      { classId: 'wizard', subclassId: null, level: 1 },
    ];
    expect(isMulticlassed(e)).toBe(true);
  });

  it('is false for a character with no class at all', () => {
    expect(isMulticlassed(makeEmptyEntity('e1'))).toBe(false);
  });
});

describe('getClassEntry / hasClassId', () => {
  const e = makeEmptyEntity('e1');
  e.identity.classes = [
    { classId: 'fighter', subclassId: 'champion', level: 3 },
    { classId: 'wizard', subclassId: null, level: 2 },
  ];

  it('finds an existing class entry by id', () => {
    expect(getClassEntry(e, 'wizard')).toEqual({ classId: 'wizard', subclassId: null, level: 2 });
  });

  it('returns null for a class not taken', () => {
    expect(getClassEntry(e, 'cleric')).toBeNull();
  });

  it('hasClassId mirrors getClassEntry as a boolean', () => {
    expect(hasClassId(e, 'fighter')).toBe(true);
    expect(hasClassId(e, 'cleric')).toBe(false);
  });
});

describe('totalLevelOf', () => {
  it('sums levels across all classes', () => {
    expect(totalLevelOf([
      { classId: 'fighter', subclassId: null, level: 3 },
      { classId: 'wizard', subclassId: null, level: 2 },
    ])).toBe(5);
  });

  it('is 0 for an empty class list', () => {
    expect(totalLevelOf([])).toBe(0);
  });
});

describe('syncLegacyIdentity', () => {
  it('mirrors classes[0] into classId/subclassId and sums level into identity.level', () => {
    const e = makeEmptyEntity('e1');
    e.identity.classes = [
      { classId: 'fighter', subclassId: 'champion', level: 3 },
      { classId: 'wizard', subclassId: 'evocation', level: 2 },
    ];
    const synced = syncLegacyIdentity(e);
    expect(synced.identity.classId).toBe('fighter');
    expect(synced.identity.subclassId).toBe('champion');
    expect(synced.identity.level).toBe(5);
  });

  it('is a no-op when identity.classes is absent', () => {
    const e = makeEmptyEntity('e1');
    e.identity.classId = 'rogue';
    e.identity.level = 4;
    expect(syncLegacyIdentity(e)).toBe(e);
  });

  it('is a no-op when identity.classes is an empty array', () => {
    const e = makeEmptyEntity('e1');
    e.identity.classes = [];
    expect(syncLegacyIdentity(e)).toBe(e);
  });
});

describe('formatClassLabel', () => {
  const resolveName = (id: string) => ({ fighter: 'Fighter', wizard: 'Wizard' }[id] ?? id);

  it('formats a single-classed character as "Name Level"', () => {
    const e = makeEmptyEntity('e1');
    e.identity.classId = 'fighter';
    e.identity.level = 5;
    expect(formatClassLabel(e, resolveName)).toBe('Fighter 5');
  });

  it('formats a multiclassed character joined with " / "', () => {
    const e = makeEmptyEntity('e1');
    e.identity.classes = [
      { classId: 'fighter', subclassId: null, level: 3 },
      { classId: 'wizard', subclassId: null, level: 2 },
    ];
    expect(formatClassLabel(e, resolveName)).toBe('Fighter 3 / Wizard 2');
  });

  it('returns an empty string for a character with no class', () => {
    expect(formatClassLabel(makeEmptyEntity('e1'), resolveName)).toBe('');
  });
});

describe('multiclassProficienciesFor', () => {
  it('returns the class\'s multiclassProficiencies field when present', () => {
    const cls = { multiclassProficiencies: { armor: ['light'], weapons: [], tools: [], languages: [] } } as unknown as CharClass;
    expect(multiclassProficienciesFor(cls)).toEqual({ armor: ['light'], weapons: [], tools: [], languages: [] });
  });

  it('returns null when the field is absent, null, or the class itself is absent', () => {
    expect(multiclassProficienciesFor({} as CharClass)).toBeNull();
    expect(multiclassProficienciesFor(null)).toBeNull();
    expect(multiclassProficienciesFor(undefined)).toBeNull();
  });
});

describe('migrateEntity', () => {
  it('synthesizes identity.classes for a character-kind entity that predates multiclassing', () => {
    const e = makeEmptyEntity('e1', 'character');
    e.identity.classId = 'druid';
    e.identity.subclassId = 'moon';
    e.identity.level = 6;
    const migrated = migrateEntity(e);
    expect(migrated.identity.classes).toEqual([{ classId: 'druid', subclassId: 'moon', level: 6 }]);
  });

  it('is idempotent — a no-op on an already-migrated entity', () => {
    const e = makeEmptyEntity('e1', 'character');
    e.identity.classes = [{ classId: 'druid', subclassId: 'moon', level: 6 }];
    expect(migrateEntity(e)).toBe(e);
  });

  it('leaves an entity with no class at all untouched', () => {
    const e = makeEmptyEntity('e1', 'character');
    expect(migrateEntity(e)).toBe(e);
  });

  it('never touches a non-character entity (monster reusing classId as a template id)', () => {
    const e = makeEmptyEntity('e1', 'monster');
    e.identity.classId = 'steel_defender';
    e.identity.level = 1;
    expect(migrateEntity(e)).toBe(e);
    expect(migrateEntity(e).identity.classes).toBeUndefined();
  });
});
