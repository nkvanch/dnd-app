---
tags: [grimoire, engine]
type: "Engine"
source: "src/engine/dmOverride.ts"
---

# dmOverride

> **Engine**  ·  `src/engine/dmOverride.ts`

## Functions

### `applyDmOverride(`

Applies a new DM override to an entity.
Only targets in DERIVED_NUMERIC_KEYS (or savingThrows.X) are accepted;
unknown targets are silently ignored to keep the engine safe.

### `cancelAllOverridesForStat(`

Cancels all active overrides targeting a specific stat.
Used when DM wants a clean slate on one stat before applying a new override.

### `cancelDmOverride(`

Cancels a single override by id.
Sets active=false and records cancelledAt timestamp.
Values restore automatically on next recomputeDerived call.

### `expireOverrides(`

Cancels all overrides that match the given expiry type.
Called on:
  'end_of_encounter' — when DM ends the combat encounter
  'end_of_session'   — on long rest / session end
  'manual'           — never called automatically

### `getActiveOverrides(entity: Entity): DmOverride[]`

Returns all active DM overrides on an entity, sorted by appliedAt ascending.

### `hasActiveOverride(entity: Entity, stat: string): boolean`

Returns true if any active override targets the given stat.
Used by UI to display the ✱ indicator.

---

## Imports

- [[src__engine__pipeline|pipeline]]  ·  `src/engine/pipeline.ts`
- [[src__engine__types|types]]  ·  `src/engine/types.ts`

## Used by

- [[app__dm__encounter|encounter]]  ·  `app/dm/encounter.tsx`
- [[app__sheet__[id]|[id]]]  ·  `app/sheet/[id].tsx`
- [[src__components__sheet__AuditModal|AuditModal]]  ·  `src/components/sheet/AuditModal.tsx`
- [[src__components__sheet__DmOverrideModal|DmOverrideModal]]  ·  `src/components/sheet/DmOverrideModal.tsx`
- [[src__components__sheet__FreeEditModal|FreeEditModal]]  ·  `src/components/sheet/FreeEditModal.tsx`
- [[src__components__sheet__TabCharacter|TabCharacter]]  ·  `src/components/sheet/TabCharacter.tsx`
