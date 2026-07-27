---
tags: [grimoire, content]
type: "Content"
source: "src/content/builtinHomebrew.ts"
---

# builtinHomebrew

> **Content**  ·  `src/content/builtinHomebrew.ts`

## Constants

### `BUILTIN_HOMEBREW`

Abyss Knight as a homebrew CharClass. The simplified fields (savingThrows,
spellcasting*, etc.) are deliberately omitted — rawProgression carries the
real, full 1–20 progression including the Oozing Knight subclass, the
level-2 known spells, and the custom slot table (resolved by classId in
spellSlotTables.ts, which is independent of official-content registration).
 
const abyssKnightClass: CharClass = {
  id:      'abyss_knight',
  name:    'Abyss Knight',
  hitDie:  10,
  features: [],
  description:
    'A warrior bound to a demonic patron, drawing on abyssal energy to infuse ' +
    'their strikes and channel dark magic. Half-caster (Charisma) whose pact-' +
    'style spell slots all share the same level.',
  Saving throw proficiencies are read by class-detail.tsx's doSelect() from
  cls.savingThrows for homebrew classes (official classes use CLASS_DETAIL).
  Abyss Knight is STR/CON per its source.
  savingThrows: ['str', 'con'],
  rawProgression: abyssKnightProgression,
};

 All built-in homebrew, grouped by content type for seeding.

### `BUILTIN_HOMEBREW_SEED: Array<`

Stable list of [type, item] pairs for the seeding loop.

---

## Imports

- [[src__content__classes__abyssKnight|abyssKnight]]  ·  `src/content/classes/abyssKnight.ts`
- [[src__content__races__index|races]]  ·  `src/content/races/index.ts`
- [[src__engine__types|types]]  ·  `src/engine/types.ts`

## Used by

- [[src__store__homebrewStore|homebrewStore]]  ·  `src/store/homebrewStore.ts`
