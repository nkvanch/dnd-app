---
tags: [grimoire, database]
type: "Database"
source: "src/db/schema.ts"
---

# schema

> **Database**  ·  `src/db/schema.ts`

## Constants

### `ALL_TABLES`

### `CREATE_APP_META_TABLE`

Simple key-value store for app-level flags (e.g. one-time seeding markers).

### `CREATE_CAMPAIGNS_TABLE`

### `CREATE_COMBAT_STATE_TABLE`

Singleton row for active combat state (id always = 1)

### `CREATE_CONTENT_CACHE_TABLE`

### `CREATE_DEVICE_SESSION_TABLE`

Singleton row — always id = 1.

### `CREATE_ENTITIES_TABLE`

============================================================================
FILE: src/db/schema.ts
SQLite table definitions for the D&D companion app.
Design principle: store full JSON blobs for complex types (Entity, Campaign).
This avoids painful schema migrations when the domain model evolves.
Only index columns that are actually queried in WHERE clauses.
============================================================================

### `CREATE_INDEXES`

Indexes for common query patterns

### `CREATE_SYNC_EVENTS_TABLE`

applied is stored as 0/1 (SQLite has no native BOOLEAN)

---

## Used by

- [[src__db__db|db]]  ·  `src/db/db.ts`
