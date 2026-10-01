// src/content/spellLists.ts
// Shared helpers for SpellList consumption — the one place both app/creation/
// spells.tsx and SpellChoicePicker.tsx go to turn "which spells can this class
// pick from" into an actual filtered pool, instead of each re-deriving the
// same `!s.classes || s.classes.includes(classId)` idiom (which is what they
// did before this file existed, and is still the DEFAULT pool below).
import { SpellList } from '../engine/types';

/** Every spell list suggested for this class — doesn't restrict who else can pick a list (see
 *  SpellList.classId's own doc comment), just what's offered first/by default for this class. */
export function spellListsForClass(spellLists: SpellList[], classId: string): SpellList[] {
  return spellLists.filter(l => l.classId === classId);
}

/** The default, no-list-selected pool: official class tagging, same idiom every call site used
 *  inline before this file existed — a spell with no `classes` tag at all is included (legacy/
 *  untagged content), same fallback as always. */
export function isSpellInClassPool(spell: { classes?: string[] }, classId: string): boolean {
  return !spell.classes || spell.classes.length === 0 || spell.classes.includes(classId);
}

/**
 * The spell pool a class's picker should actually show. `activeSpellListId` is the list the
 * player/DM has opted into for this picker (from spellListsForClass, or any other list if the
 * table allows it) — null/undefined means "use the normal class-tag pool." When a list IS
 * active, it REPLACES the class-tag pool entirely rather than widening it, since a SpellList was
 * authored specifically to be the full, curated pool for its use case (most often a homebrew
 * class with no official tagging at all).
 */
export function filterSpellsForClass<T extends { id: string; classes?: string[] }>(
  allSpells: T[],
  classId: string,
  activeSpellListId: string | null | undefined,
  spellLists: SpellList[],
): T[] {
  if (activeSpellListId) {
    const list = spellLists.find(l => l.id === activeSpellListId);
    if (list) {
      const idSet = new Set(list.spellIds);
      return allSpells.filter(s => idSet.has(s.id));
    }
  }
  return allSpells.filter(s => isSpellInClassPool(s, classId));
}
