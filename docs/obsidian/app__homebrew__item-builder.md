---
tags: [grimoire, screen-homebrew]
type: "Screen · Homebrew"
source: "app/homebrew/item-builder.tsx"
---

# item-builder

> **Screen · Homebrew**  ·  `app/homebrew/item-builder.tsx`

Homebrew item builder. Fields: name, cost, weight, properties (comma-separated,
drives inventory categorisation). Optional mechanical effects: Armor AC (with
optional DEX add), Weapon damage (full FeatureActivation), Stat bonus, grant_sense,
or grant_movement. Effects generate a Feature with the appropriate Effect on the
item, which the pipeline picks up when the item is equipped.

---

## Functions

### `ItemBuilderScreen()`

---

## Imports

- [[src__engine__types|types]]  ·  `src/engine/types.ts`
- [[src__store__homebrewStore|homebrewStore]]  ·  `src/store/homebrewStore.ts`
- [[src__theme|theme]]  ·  `src/theme.ts`
