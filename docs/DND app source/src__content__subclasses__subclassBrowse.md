---
tags: [grimoire, content]
type: "Content"
source: "src/content/subclasses/subclassBrowse.ts"
---

# subclassBrowse

> **Content**  ·  `src/content/subclasses/subclassBrowse.ts`

## Types

### `SubclassEntry`

A subclass paired with a stable id derived from its feature sources.

### `SubclassRow`

Level → feature names table for a subclass.

## Functions

### `getSubclassEntry(classId: string, subclassId: string): SubclassEntry | null`

Look up a single subclass entry by classId + subclass id.

### `subclassEntriesForClass(classId: string): SubclassEntry[]`

All subclasses for a class, shaped for the browse list.

### `subclassFeaturesByLevel(sub: SubclassProgression):`

Subclass progressions have no top-level id; their identity lives in the
source.refId every granted feature carries (e.g. 'thief'). Recover it, with a
name-slug fallback for any subclass whose features omit a refId.
 
function deriveSubclassId(sub: SubclassProgression): string {
  for (const entry of sub.entries) {
    for (const grant of entry.grants) {
      if (grant.kind === 'feature') {
        const f = grant.value as Feature;
        if (f?.source?.kind === 'subclass' && f.source.refId) return f.source.refId;
      }
    }
  }
  return sub.name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
}

 Features of a subclass paired with the level they're gained, in level order.

### `subclassProgressionTable(sub: SubclassProgression): SubclassRow[]`

---

## Imports

- [[src__content__subclasses__index|subclasses]]  ·  `src/content/subclasses/index.ts`
- [[src__engine__types|types]]  ·  `src/engine/types.ts`

## Used by

- [[app__creation__class-detail|class-detail]]  ·  `app/creation/class-detail.tsx`
- [[app__creation__subclass-detail|subclass-detail]]  ·  `app/creation/subclass-detail.tsx`
