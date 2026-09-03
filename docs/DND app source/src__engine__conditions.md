---
tags: [grimoire, engine]
type: "Engine"
source: "src/engine/conditions.ts"
---

# conditions

> **Engine**  ·  `src/engine/conditions.ts`

## Functions

### `applyCondition(`

── Apply condition ───────────────────────────────────────────────────────────
Applies a condition to an entity.
- If the entity is immune, returns unchanged.
- If the condition is already active, returns unchanged (no stacking).
- Exhaustion is the only exception: increments the numeric level instead.
Optional condition features from content (e.g. globalContentDB.conditions).
The engine can't import content directly (circular dep), so the caller looks
up the Condition and passes its features here.

### `collectSuppressors(entity: Entity, conditionId: string): string[]`

── Suppression ───────────────────────────────────────────────────────────────
Collects IDs of features that suppress effects of the given condition
without removing it.
Example: Blindsight suppresses Blinded attack penalties but
the Blinded condition itself remains on the entity.

### `isImmuneToCondition(entity: Entity, conditionId: string): boolean`

── Immunity ──────────────────────────────────────────────────────────────────
Returns true if any active feature grants immunity to this condition.
Immunity prevents the condition from being applied at all.

### `reduceExhaustion(`

── Exhaustion ────────────────────────────────────────────────────────────────

 Reduces exhaustion by 1 (long rest effect). Minimum is 0.

### `refreshSuppressors(entity: Entity): Entity`

Rebuilds the suppressedBy list for every active condition.
Called inside recomputeDerived whenever features change (items equipped,
concentration dropped, features toggled).

### `removeCondition(`

── Remove condition ──────────────────────────────────────────────────────────

 Removes a condition by ID, plus any features that were granted by that condition.

### `setFlag(`

── Runtime flags ─────────────────────────────────────────────────────────────
Sets or clears a runtime boolean flag on the entity.
Used for: "rage_active", "concentrating", "second_wind_used", etc.
These flags gate conditional effects in collectAllEffects.

### `tickDurations(`

── Tick durations ────────────────────────────────────────────────────────────
Decrements all round-based durations by 1 and removes expired conditions.
Called by the combat engine at the end of each creature's turn.

---

## Imports

- [[src__engine__pipeline|pipeline]]  ·  `src/engine/pipeline.ts`
- [[src__engine__types|types]]  ·  `src/engine/types.ts`
- [[src__store__characterStore|characterStore]]  ·  `src/store/characterStore.ts`

## Used by

- [[app__dm__character__[id]|[id]]]  ·  `app/dm/character/[id].tsx`
- [[app__dm__encounter|encounter]]  ·  `app/dm/encounter.tsx`
- [[app__sheet__[id]|[id]]]  ·  `app/sheet/[id].tsx`
- [[src__engine__combat|combat]]  ·  `src/engine/combat.ts`
- [[src__engine__rest|rest]]  ·  `src/engine/rest.ts`
- [[src__test-engine|test-engine]]  ·  `src/test-engine.ts`
