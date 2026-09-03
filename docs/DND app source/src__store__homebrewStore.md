---
tags: [grimoire, store]
type: "Store"
source: "src/store/homebrewStore.ts"
---

# homebrewStore

> **Store**  ·  `src/store/homebrewStore.ts`

Library of homebrew content the player/DM has created: races, classes, spells,
backgrounds, features, items. Persists to the SQLite content cache. Content is
merged with official content when building pickers (race selector, spell list, etc).

---

## Constants

### `useHomebrewStore`

---

## Imports

- [[src__content__builtinHomebrew|builtinHomebrew]]  ·  `src/content/builtinHomebrew.ts`
- [[src__content__classes__library|library]]  ·  `src/content/classes/library.ts`
- [[src__db__appMetaRepo|appMetaRepo]]  ·  `src/db/appMetaRepo.ts`
- [[src__db__contentCacheRepo|contentCacheRepo]]  ·  `src/db/contentCacheRepo.ts`
- [[src__engine__types|types]]  ·  `src/engine/types.ts`

## Used by

- [[app___layout|_layout]]  ·  `app/_layout.tsx`
- [[app__tabs__homebrew|homebrew]]  ·  `app/(tabs)/homebrew.tsx`
- [[app__creation__background|background]]  ·  `app/creation/background.tsx`
- [[app__creation__class-detail|class-detail]]  ·  `app/creation/class-detail.tsx`
- [[app__creation__class|class]]  ·  `app/creation/class.tsx`
- [[app__creation__race-detail|race-detail]]  ·  `app/creation/race-detail.tsx`
- [[app__creation__race|race]]  ·  `app/creation/race.tsx`
- [[app__creation__spells|spells]]  ·  `app/creation/spells.tsx`
- [[app__homebrew__class-builder|class-builder]]  ·  `app/homebrew/class-builder.tsx`
- [[app__homebrew__feature-editor|feature-editor]]  ·  `app/homebrew/feature-editor.tsx`
- [[app__homebrew__item-builder|item-builder]]  ·  `app/homebrew/item-builder.tsx`
- [[app__homebrew__race-builder|race-builder]]  ·  `app/homebrew/race-builder.tsx`
- [[app__homebrew__spell-builder|spell-builder]]  ·  `app/homebrew/spell-builder.tsx`
- [[src__components__AsiFeatPicker|AsiFeatPicker]]  ·  `src/components/AsiFeatPicker.tsx`
- [[src__components__sheet__AddSpellModal|AddSpellModal]]  ·  `src/components/sheet/AddSpellModal.tsx`
- [[src__components__sheet__TabCharacter|TabCharacter]]  ·  `src/components/sheet/TabCharacter.tsx`
- [[src__components__sheet__TabInventory|TabInventory]]  ·  `src/components/sheet/TabInventory.tsx`
- [[src__components__sheet__TabSpells|TabSpells]]  ·  `src/components/sheet/TabSpells.tsx`
