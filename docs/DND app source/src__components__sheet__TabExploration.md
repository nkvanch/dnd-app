---
tags: [grimoire, component]
type: "Component"
source: "src/components/sheet/TabExploration.tsx"
---

# TabExploration

> **Component**  ·  `src/components/sheet/TabExploration.tsx`

The Exploration view of Tab 1. Designed for out-of-combat use: vitals (HP/AC/Speed),
travel speeds (walking + fly/swim/climb from derived.movement), all three passives,
vision & senses editor, tap-to-roll skills (writes to diceLogStore), languages,
tools, conditions (add/remove), features with a manual exploration star,
spell list with level badge and tap-for-description modal, inventory quick view,
and categorised Notes & Clues (Objectives / NPCs / Clues / Locations + scratch).

---

## Functions

### `TabExploration(`

Exploration view. Key design choice: spell/ability "utility" filtering is NOT auto-detected (prose descriptions have no structured tag). Instead features have an explorationTag?: boolean the player sets manually (tap the star). Notes are serialised into entity.notes with a NOTES_MARKER fence for backward compat.

---

## Imports

- [[src__components__AsiFeatPicker|AsiFeatPicker]]  ·  `src/components/AsiFeatPicker.tsx`
- [[src__components__sheet__HpModal|HpModal]]  ·  `src/components/sheet/HpModal.tsx`
- [[src__content__items__index|items]]  ·  `src/content/items/index.ts`
- [[src__content__spells__index|spells]]  ·  `src/content/spells/index.ts`
- [[src__engine__pipeline|pipeline]]  ·  `src/engine/pipeline.ts`
- [[src__engine__types|types]]  ·  `src/engine/types.ts`
- [[src__store__diceLogStore|diceLogStore]]  ·  `src/store/diceLogStore.ts`
- [[src__theme|theme]]  ·  `src/theme.ts`

## Used by

- [[app__sheet__[id]|[id]]]  ·  `app/sheet/[id].tsx`
