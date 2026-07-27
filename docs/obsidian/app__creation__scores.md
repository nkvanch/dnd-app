---
tags: [grimoire, screen-creation]
type: "Screen · Creation"
source: "app/creation/scores.tsx"
---

# scores

> **Screen · Creation**  ·  `app/creation/scores.tsx`

Ability score assignment. Four methods: Standard Array, Point Buy (reads
pointBuyConfig(rules) for budget/min/max with cost extrapolated above 15 at
+2/point), Manual entry, and Roll (4d6 drop lowest). Saves a scoresConfirmed
flag to draft.notes so the hub can detect completion.

---

## Functions

### `ScoresScreen()`

---

## Imports

- [[src__engine__dice|dice]]  ·  `src/engine/dice.ts`
- [[src__engine__houseRules|houseRules]]  ·  `src/engine/houseRules.ts`
- [[src__engine__leveling|leveling]]  ·  `src/engine/leveling.ts`
- [[src__engine__pipeline|pipeline]]  ·  `src/engine/pipeline.ts`
- [[src__engine__types|types]]  ·  `src/engine/types.ts`
- [[src__store__characterStore|characterStore]]  ·  `src/store/characterStore.ts`
- [[src__theme|theme]]  ·  `src/theme.ts`
