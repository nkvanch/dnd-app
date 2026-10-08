// src/content/classes/__tests__/classArrays.test.ts
// ALL_CHAR_CLASSES (display metadata) and ALL_CLASS_PROGRESSIONS (real
// mechanics) are two entirely separate hand-authored arrays with no shared
// type-level or runtime link — nothing else enforces that a class added to
// one is also added to the other with a matching id/classId. A desync
// wouldn't crash; it would silently produce a missing or wrong progression
// for that class (see TabCharacter.tsx's resolveProgression fallback, which
// exists specifically to survive this). This test is the safety net: it
// fails CI immediately instead of surfacing as a runtime "my class has no
// features" bug report.
import { ALL_CHAR_CLASSES, ALL_CLASS_PROGRESSIONS } from '../index';

describe('ALL_CHAR_CLASSES / ALL_CLASS_PROGRESSIONS stay in sync', () => {
  it('have exactly the same set of class ids', () => {
    const classIds = new Set(ALL_CHAR_CLASSES.map(c => c.id));
    const progressionIds = new Set(ALL_CLASS_PROGRESSIONS.map(p => p.classId));
    expect(classIds).toEqual(progressionIds);
  });

  it('have no duplicate ids within either array', () => {
    const classIds = ALL_CHAR_CLASSES.map(c => c.id);
    const progressionIds = ALL_CLASS_PROGRESSIONS.map(p => p.classId);
    expect(classIds.length).toBe(new Set(classIds).size);
    expect(progressionIds.length).toBe(new Set(progressionIds).size);
  });
});
