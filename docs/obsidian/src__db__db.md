---
tags: [grimoire, database]
type: "Database"
source: "src/db/db.ts"
---

# db

> **Database**  ·  `src/db/db.ts`

## Functions

### `closeDb(): Promise<void>`

Closes the database connection. Call during app teardown if needed.
After calling this, initDb() must be called again before any DB access.

### `getDb(): SQLite.SQLiteDatabase`

Returns the live database instance.
Throws if initDb() has not been called yet.

### `initDb(): Promise<SQLite.SQLiteDatabase | null>`

Opens (or returns the cached) database and creates all tables.
Safe to call multiple times — idempotent due to IF NOT EXISTS.

---

## Imports

- [[src__db__schema|schema]]  ·  `src/db/schema.ts`

## Used by

- [[app___layout|_layout]]  ·  `app/_layout.tsx`
- [[src__db__appMetaRepo|appMetaRepo]]  ·  `src/db/appMetaRepo.ts`
- [[src__db__campaignRepo|campaignRepo]]  ·  `src/db/campaignRepo.ts`
- [[src__db__combatRepo|combatRepo]]  ·  `src/db/combatRepo.ts`
- [[src__db__contentCacheRepo|contentCacheRepo]]  ·  `src/db/contentCacheRepo.ts`
- [[src__db__entityRepo|entityRepo]]  ·  `src/db/entityRepo.ts`
- [[src__db__sessionRepo|sessionRepo]]  ·  `src/db/sessionRepo.ts`
- [[src__db__syncRepo|syncRepo]]  ·  `src/db/syncRepo.ts`
