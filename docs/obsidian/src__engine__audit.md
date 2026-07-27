---
tags: [grimoire, engine]
type: "Engine"
source: "src/engine/audit.ts"
---

# audit

> **Engine**  ·  `src/engine/audit.ts`

## Functions

### `explainValue(entity: Entity, stat: string): AuditTrail`

── Public API ────────────────────────────────────────────────────────────────
Returns the full audit trail for a derived stat.
Every entry is one contribution (+value or −value) with its source labeled.
DM overrides are always appended last.
Returns an empty trail (total: 0) for unrecognised stat keys rather than throwing.

---

## Imports

- [[src__engine__pipeline|pipeline]]  ·  `src/engine/pipeline.ts`
- [[src__engine__types|types]]  ·  `src/engine/types.ts`

## Used by

- [[src__components__sheet__AuditModal|AuditModal]]  ·  `src/components/sheet/AuditModal.tsx`
