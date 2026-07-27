---
tags: [grimoire, content]
type: "Content"
source: "src/content/classes/classBrowse.ts"
---

# classBrowse

> **Content**  ·  `src/content/classes/classBrowse.ts`

## Types

### `BrowseFeature`

── Layer 2: Feature list ───────────────────────────────────────────────────────

### `ClassMeta`

### `Complexity`

── Layer 1: Class Summary metadata ─────────────────────────────────────────────

### `ProgressionRow`

── Layer 3: Progression table ──────────────────────────────────────────────────

## Functions

### `abilityFullName(a: Ability): string`

### `classMeta(cls: CharClass): ClassMeta`

Returns Layer-1 metadata for a class, falling back to derived values for
homebrew classes with no CLASS_META entry.

### `featuresByLevel(cls: CharClass): BrowseFeature[]`

Same as layerFeatures but pairs each feature with the level it's gained.

### `layerFeatures(cls: CharClass): Feature[]`

Extracts every feature granted across the class's full progression, in level
order, de-duplicated by feature id (keeping the earliest level it appears).

### `progressionTable(cls: CharClass): ProgressionRow[]`

Builds the level-by-level progression table. Feature names come from feature
grants; ASI is detected from choices; slot summary from spell_slots grants.

## Constants

### `CLASS_META: Record<string, ClassMeta>`

Hand-authored summaries for official classes. Homebrew / unlisted classes get
a derived fallback (see classMeta()).

---

## Imports

- [[src__content__classes__progressions|progressions]]  ·  `src/content/classes/progressions.ts`
- [[src__engine__types|types]]  ·  `src/engine/types.ts`

## Used by

- [[app__creation__class-detail|class-detail]]  ·  `app/creation/class-detail.tsx`
