---
tags: [grimoire, store]
type: "Store"
source: "src/store/combatStore.ts"
---

# combatStore

> **Store**  ·  `src/store/combatStore.ts`

Holds the current CombatState (initiative order, round number, active turn).
Wraps the pure engine functions from combat.ts in store actions that also
persist the state to the database after each change.

---

## Constants

### `useCombatStore`

---

## Imports

- [[src__db__combatRepo|combatRepo]]  ·  `src/db/combatRepo.ts`
- [[src__engine__combat|combat]]  ·  `src/engine/combat.ts`
- [[src__engine__types|types]]  ·  `src/engine/types.ts`
- [[src__store__characterStore|characterStore]]  ·  `src/store/characterStore.ts`

## Used by

- [[app___layout|_layout]]  ·  `app/_layout.tsx`
- [[app__dm__dashboard|dashboard]]  ·  `app/dm/dashboard.tsx`
- [[app__dm__encounter|encounter]]  ·  `app/dm/encounter.tsx`
- [[app__dm__monsters|monsters]]  ·  `app/dm/monsters.tsx`
