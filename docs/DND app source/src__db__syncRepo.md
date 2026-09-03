---
tags: [grimoire, database]
type: "Database"
source: "src/db/syncRepo.ts"
---

# syncRepo

> **Database**  ·  `src/db/syncRepo.ts`

## Functions

### `getUnflushedEvents(sessionId: string): Promise<SyncEvent[]>`

Return all unapplied events for a session, sorted oldest-first
so they can be replayed in correct order on reconnect.

### `markAllEventsApplied(sessionId: string): Promise<void>`

Mark all unapplied events for a session as applied in bulk.

### `markEventApplied(eventId: string): Promise<void>`

Mark a single event as applied (flushed to peers).

### `pruneAppliedEvents(cutoffTimestamp: number): Promise<void>`

Purge applied events older than cutoffTimestamp (housekeeping).

### `queueSyncEvent(event: SyncEvent): Promise<void>`

Persist a new sync event (applied = false).

---

## Imports

- [[src__db__db|db]]  ·  `src/db/db.ts`
- [[src__engine__types|types]]  ·  `src/engine/types.ts`

## Used by

- [[src__sync__syncManager|syncManager]]  ·  `src/sync/syncManager.ts`
