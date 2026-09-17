// src/content/spells/__tests__/spellDataIntegrity.test.ts
// SHARED-QUERY-1 (spell display-metadata normalization pass): a real
// content-generation bug was found and repaired — scripts/convert-spells.mjs's
// level-line parser used to capture trailing "(ritual)"/"**Classes**: ..."
// text straight into the `school` field (e.g. "Conjuration (ritual)",
// "Abjuration **Classes**: bard, cleric, wizard"), and for the latter case
// the spell's real `classes` array was left empty — a silent correctness
// bug, since creation/spells.tsx treats an empty `classes` array as
// "available to every class" (not "belongs to no class"). Both the
// already-generated content (src/content/spells/generated.ts) and the
// parser itself (convert-spells.mjs) were repaired; this test is the
// regression lock so a future re-conversion (or any other content source)
// can't silently reintroduce either corruption pattern.
import { ALL_SPELLS } from '../index';

describe('spell content integrity — school/classes fields', () => {
  it('no spell\'s school field contains a "(ritual)" or "**classes**" fragment', () => {
    const corrupted = ALL_SPELLS.filter(s => /\(ritual\)|\*\*classes\*\*/i.test(s.school));
    expect(corrupted.map(s => ({ id: s.id, school: s.school }))).toEqual([]);
  });

  it('every school value is a single plain school name (no embedded punctuation beyond letters/spaces)', () => {
    for (const s of ALL_SPELLS) {
      expect(s.school).toMatch(/^[A-Za-z ]+$/);
    }
  });

  it('a known previously-corrupted spell (Symbol) now has both a clean school and its real classes list', () => {
    const symbol = ALL_SPELLS.find(s => s.id === 'symbol');
    if (symbol) {
      expect(symbol.school).toBe('Abjuration');
      expect(symbol.classes).toEqual(expect.arrayContaining(['bard', 'cleric', 'wizard']));
    }
  });
});
