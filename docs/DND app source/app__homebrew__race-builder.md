---
tags: [grimoire, screen-homebrew]
type: "Screen · Homebrew"
source: "app/homebrew/race-builder.tsx"
---

# race-builder

> **Screen · Homebrew**  ·  `app/homebrew/race-builder.tsx`

Homebrew race builder. Fields: name, speed, size, ability bonuses (multi-select
chips), a Senses editor (type + range + note → grant_sense effects on a race
feature), and a Movement editor (fly/swim/climb/burrow speeds → grant_movement
effects). Both feed into derived.senses and derived.movement via the pipeline.

---

## Functions

### `RaceBuilderScreen()`

---

## Imports

- [[src__engine__types|types]]  ·  `src/engine/types.ts`
- [[src__store__homebrewStore|homebrewStore]]  ·  `src/store/homebrewStore.ts`
- [[src__theme|theme]]  ·  `src/theme.ts`
