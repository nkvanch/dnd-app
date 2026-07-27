---
tags: [grimoire, database]
type: "Database"
source: "src/db/sessionRepo.ts"
---

# sessionRepo

> **Database**  ·  `src/db/sessionRepo.ts`

## Functions

### `getOrCreateSession(): Promise<DeviceSession>`

Generate a compact UUID-like string (no external deps). 
function generateDeviceId(): string {
  const hex = () => Math.floor(Math.random() * 0x10000).toString(16).padStart(4, '0');
  return `${hex()}${hex()}-${hex()}-4${hex().slice(1)}-${hex()}-${hex()}${hex()}${hex()}`;
}
Returns the existing DeviceSession, or creates a new one on first install.
deviceId is fetched from SecureStore first — if missing, one is generated,
stored in SecureStore, then persisted to SQLite.
On web, returns a transient in-memory session (no persistence).

### `updateSession(`

Persist partial DeviceSession updates.
Does not allow changing deviceId (immutable after creation).

---

## Imports

- [[src__db__db|db]]  ·  `src/db/db.ts`
- [[src__engine__types|types]]  ·  `src/engine/types.ts`

## Used by

- [[src__store__sessionStore|sessionStore]]  ·  `src/store/sessionStore.ts`
