---
tags: [grimoire, database]
type: "Database"
source: "src/db/entityRepo.ts"
---

# entityRepo

> **Database**  ·  `src/db/entityRepo.ts`

SQLite read/write for Entity objects. Serialises the full entity to JSON for
storage and deserialises on load. Also provides loadAllEntityMeta for the entity
list (id + name only, fast) and loadEntity for the full record.

---

## Types

### `EntityMeta`

## Functions

### `deleteEntity(id: string): Promise<void>`

Permanently delete an entity by id.

### `loadAllEntities(): Promise<Entity[]>`

Load all stored entities, sorted by updatedAt descending (most recent first).

### `loadAllEntityMeta(): Promise<EntityMeta[]>`

Load lightweight metadata for all entities without deserializing full JSON blobs.
Used for the character list screen to avoid loading complete entity data on startup.
Full entity data is only deserialized when a character sheet is opened (loadEntity).

### `loadEntitiesByKind(kind: Entity['kind']): Promise<Entity[]>`

Load all entities of a specific kind.

### `loadEntity(id: string): Promise<Entity | null>`

Load a single Entity by id. Returns null if not found.

### `saveEntity(entity: Entity): Promise<void>`

Upsert a full Entity. Overwrites any existing row with the same id.

---

## Imports

- [[src__db__db|db]]  ·  `src/db/db.ts`
- [[src__engine__types|types]]  ·  `src/engine/types.ts`

## Used by

- [[src__store__characterStore|characterStore]]  ·  `src/store/characterStore.ts`
- [[src__sync__syncManager|syncManager]]  ·  `src/sync/syncManager.ts`
