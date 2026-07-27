---
tags: [grimoire, content]
type: "Content"
source: "src/content/classes/progressions.ts"
---

# progressions

> **Content**  ·  `src/content/classes/progressions.ts`

## Functions

### `buildProgressionFromClass(cls: CharClass): ClassProgression`

Resolves the slot table rows for a spellcastingStyle. 
function slotTableForStyle(
  style: 'full' | 'half' | 'pact',
): { level: number; slots: number[] }[] {
  switch (style) {
    case 'full': return FULL_CASTER_SLOTS;
    case 'half': return HALF_CASTER_SLOTS;
    case 'pact': return WARLOCK_SLOTS;
  }
}
Builds a complete ClassProgression for a homebrew class from its CharClass
definition. Phase 2 fields are used when present; stub values fill in gaps.
Exported as buildProgressionFromClass (canonical name) and buildStubProgression
(backward-compat alias used by existing callers).

### `getProgression(classId: string): ClassProgression | null`

Returns the class progression for a classId, or null if unknown (e.g. homebrew).

### `getProgressionForClass(cls: CharClass): ClassProgression`

Returns the progression for a class, falling back to a generated progression
for homebrew classes with no hand-authored progression in ALL_PROGRESSIONS.
Never returns null.

## Constants

### `buildStubProgression`

Backward-compat alias. Existing callers that import buildStubProgression continue to work.

### `PROGRESSIONS`

Alias of the canonical map in ./index.

---

## Imports

- [[src__content__classes__index|classes]]  ·  `src/content/classes/index.ts`
- [[src__content__classes__spellSlotTables|spellSlotTables]]  ·  `src/content/classes/spellSlotTables.ts`
- [[src__engine__types|types]]  ·  `src/engine/types.ts`

## Used by

- [[app__creation__class-detail|class-detail]]  ·  `app/creation/class-detail.tsx`
- [[src__components__sheet__TabCharacter|TabCharacter]]  ·  `src/components/sheet/TabCharacter.tsx`
- [[src__content__classes__classBrowse|classBrowse]]  ·  `src/content/classes/classBrowse.ts`
