// src/content/classes/__tests__/classBrowse.test.ts
import { classDisplayName } from '../classBrowse';
import { ALL_CHAR_CLASSES } from '../index';
import type { CharClass } from '../../../engine/types';

describe('classDisplayName', () => {
  // Real, confirmed bug: AddSpellModal.tsx's class-filter chips used to run
  // a naive cap() helper (capitalize only the first character of the raw id
  // string) over a spell's `classes: string[]` ids — turning a multi-word
  // snake_case class id like 'abyss_knight' into 'Abyss_knight' instead of
  // the class's real display name 'Abyss Knight'. classDisplayName looks up
  // the real name from the class registry instead of guessing from the id.
  const abyssKnight: CharClass = {
    id: 'abyss_knight', name: 'Abyss Knight', hitDie: 10, features: [],
  } as CharClass;

  it('resolves a class id to its real display name, not a naive capitalization of the id', () => {
    expect(classDisplayName('abyss_knight', [abyssKnight])).toBe('Abyss Knight');
    expect(classDisplayName('abyss_knight', [abyssKnight])).not.toBe('Abyss_knight');
  });

  it('falls back to the raw id when the class truly cannot be found', () => {
    expect(classDisplayName('nonexistent_class', ALL_CHAR_CLASSES as CharClass[])).toBe('nonexistent_class');
  });

  it('resolves every official class id to its real display name', () => {
    for (const cls of ALL_CHAR_CLASSES) {
      expect(classDisplayName(cls.id, ALL_CHAR_CLASSES)).toBe(cls.name);
    }
  });
});
