---
tags: [grimoire, component]
type: "Component"
source: "src/components/GlobalDiceRoller.tsx"
---

# GlobalDiceRoller

> **Component**  ·  `src/components/GlobalDiceRoller.tsx`

Floating dice roller that lives on top of the character sheet. Reads its roll
history from diceLogStore (shared) so rolls triggered anywhere — including
skill taps in the exploration tab — appear here automatically.

Auto-opens via useEffect when a new roll id appears in the store that wasn't
there on the previous render.

---

## Functions

### `GlobalDiceRoller(`

Floating dice roller overlay. Reads history from useDiceLogStore. A useEffect watches history[0].id — when it changes and the roller is closed, the roller auto-opens so the result is visible. This makes tap-to-roll skills "just work" without the player having to open the roller manually.

---

## Imports

- [[src__store__diceLogStore|diceLogStore]]  ·  `src/store/diceLogStore.ts`
- [[src__theme|theme]]  ·  `src/theme.ts`

## Used by

- [[app__sheet__[id]|[id]]]  ·  `app/sheet/[id].tsx`
