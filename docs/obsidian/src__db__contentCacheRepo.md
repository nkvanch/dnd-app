---
tags: [grimoire, database]
type: "Database"
source: "src/db/contentCacheRepo.ts"
---

# contentCacheRepo

> **Database**  ·  `src/db/contentCacheRepo.ts`

SQLite read/write for homebrew content (HomebrewContent records). Uses a
ContentCacheType discriminant ('race' | 'class' | 'spell' | 'item' | etc.)
to store all content types in one table.

---

## Types

### `ContentCacheType`

### `HomebrewContent`

## Functions

### `deleteHomebrewContent(type: ContentCacheType, id: string): Promise<void>`

Delete a specific homebrew item.

### `loadAllHomebrew(): Promise<Partial<Record<ContentCacheType, HomebrewContent[]>>>`

Load all homebrew content (all types).

### `loadHomebrewByType(type: ContentCacheType): Promise<HomebrewContent[]>`

Load all homebrew content of a given type.

### `saveHomebrewContent(`

Upsert a piece of homebrew content.

---

## Imports

- [[src__db__db|db]]  ·  `src/db/db.ts`
- [[src__engine__types|types]]  ·  `src/engine/types.ts`

## Used by

- [[src__store__homebrewStore|homebrewStore]]  ·  `src/store/homebrewStore.ts`
