---
tags: [grimoire, content]
type: "Content"
source: "src/content/classes/spellSlotTables.ts"
---

# spellSlotTables

> **Content**  ·  `src/content/classes/spellSlotTables.ts`

## Functions

### `getSpellSlotsForClassLevel(`

Maps classId to its spell slot table. 
const SLOT_TABLES: Record<string, SpellSlotRow[]> = {
  wizard:   FULL_CASTER_SLOTS,
  cleric:   FULL_CASTER_SLOTS,
  druid:    FULL_CASTER_SLOTS,
  bard:     FULL_CASTER_SLOTS,
  sorcerer: FULL_CASTER_SLOTS,
  paladin:  HALF_CASTER_SLOTS,
  ranger:   HALF_CASTER_SLOTS,
  warlock:  WARLOCK_SLOTS,
  abyss_knight: ABYSS_KNIGHT_SLOTS,
};
Returns the 9-element slot count array for a given classId and level.
Returns null for non-spellcasting classes (fighter, rogue, barbarian, monk).

### `slotsForLevel(`

Build a SpellSlots object from a SlotRow for a given level.

## Constants

### `ABYSS_KNIGHT_SLOTS: SpellSlotRow[]`

Abyss Knight pact magic — exact class table.
Level  | Slots | Slot Level
 2-4   |   2   |    1st
 5-8   |   2   |    2nd
 9-10  |   2   |    3rd
11-12  |   3   |    3rd
13-16  |   3   |    4th
17-20  |   4   |    5th

### `FULL_CASTER_SLOTS: SpellSlotRow[]`

Full caster (Wizard, Cleric, Druid, Bard, Sorcerer).

### `HALF_CASTER_SLOTS: SpellSlotRow[]`

Half caster (Paladin, Ranger).

### `WARLOCK_SLOTS: SpellSlotRow[]`

Warlock (pact magic — all slots same tier, recharge short rest).

---

## Imports

- [[src__engine__types|types]]  ·  `src/engine/types.ts`

## Used by

- [[src__content__classes__progressions|progressions]]  ·  `src/content/classes/progressions.ts`
- [[src__engine__leveling|leveling]]  ·  `src/engine/leveling.ts`
