---
tags: [grimoire, database]
type: "Database"
source: "src/db/appMetaRepo.ts"
---

# appMetaRepo

> **Database**  ·  `src/db/appMetaRepo.ts`

## Functions

### `getMeta(key: string): Promise<string | null>`

Read a meta value by key. Returns null if unset (or on web).

### `setMeta(key: string, value: string): Promise<void>`

Upsert a meta value. No-op on web.

---

## Imports

- [[src__db__db|db]]  ·  `src/db/db.ts`

## Used by

- [[src__store__homebrewStore|homebrewStore]]  ·  `src/store/homebrewStore.ts`
