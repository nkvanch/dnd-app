---
tags: [grimoire, component]
type: "Component"
source: "src/components/sheet/TabInventory.tsx"
---

# TabInventory

> **Component**  ·  `src/components/sheet/TabInventory.tsx`

Full inventory management. Categorises items by their properties array (armor,
weapons, magic items, tools, adventuring gear, currency). Handles equip/unequip,
quantity changes, and the quick-add picker. Keys use `eq_${itemId}_${idx}`
and `ca_${itemId}_${idx}` to avoid duplicate-key crashes when the same item
appears multiple times.

---

## Functions

### `TabInventory(`

---

## Imports

- [[src__content__classes__library|library]]  ·  `src/content/classes/library.ts`
- [[src__engine__houseRules|houseRules]]  ·  `src/engine/houseRules.ts`
- [[src__engine__types|types]]  ·  `src/engine/types.ts`
- [[src__store__homebrewStore|homebrewStore]]  ·  `src/store/homebrewStore.ts`
- [[src__theme|theme]]  ·  `src/theme.ts`

## Used by

- [[app__sheet__[id]|[id]]]  ·  `app/sheet/[id].tsx`
