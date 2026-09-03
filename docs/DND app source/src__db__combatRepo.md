---
tags: [grimoire, database]
type: "Database"
source: "src/db/combatRepo.ts"
---

# combatRepo

> **Database**  ·  `src/db/combatRepo.ts`

## Functions

### `clearCombatState(): Promise<void>`

Removes saved combat state (called when encounter ends).

### `loadCombatState(): Promise<CombatState | null>`

Loads the saved combat state. Returns null if none saved or on error.

### `saveCombatState(state: CombatState): Promise<void>`

Upserts the current combat state (single-row table).

---

## Imports

- [[src__db__db|db]]  ·  `src/db/db.ts`
- [[src__engine__combat|combat]]  ·  `src/engine/combat.ts`

## Used by

- [[app___layout|_layout]]  ·  `app/_layout.tsx`
- [[src__store__combatStore|combatStore]]  ·  `src/store/combatStore.ts`
