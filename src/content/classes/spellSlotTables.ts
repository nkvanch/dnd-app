// ============================================================================
// FILE: src/content/classes/spellSlotTables.ts
// PHB spell slot progression tables.
// Row index = level - 1. Columns = slot tiers 1-9.
// ============================================================================
import { SpellSlotRow } from '../../engine/types';

/** Full caster (Wizard, Cleric, Druid, Bard, Sorcerer). */
export const FULL_CASTER_SLOTS: SpellSlotRow[] = [
  { level:  1, slots: [2,0,0,0,0,0,0,0,0] },
  { level:  2, slots: [3,0,0,0,0,0,0,0,0] },
  { level:  3, slots: [4,2,0,0,0,0,0,0,0] },
  { level:  4, slots: [4,3,0,0,0,0,0,0,0] },
  { level:  5, slots: [4,3,2,0,0,0,0,0,0] },
  { level:  6, slots: [4,3,3,0,0,0,0,0,0] },
  { level:  7, slots: [4,3,3,1,0,0,0,0,0] },
  { level:  8, slots: [4,3,3,2,0,0,0,0,0] },
  { level:  9, slots: [4,3,3,3,1,0,0,0,0] },
  { level: 10, slots: [4,3,3,3,2,0,0,0,0] },
  { level: 11, slots: [4,3,3,3,2,1,0,0,0] },
  { level: 12, slots: [4,3,3,3,2,1,0,0,0] },
  { level: 13, slots: [4,3,3,3,2,1,1,0,0] },
  { level: 14, slots: [4,3,3,3,2,1,1,0,0] },
  { level: 15, slots: [4,3,3,3,2,1,1,1,0] },
  { level: 16, slots: [4,3,3,3,2,1,1,1,0] },
  { level: 17, slots: [4,3,3,3,2,1,1,1,1] },
  { level: 18, slots: [4,3,3,3,3,1,1,1,1] },
  { level: 19, slots: [4,3,3,3,3,2,1,1,1] },
  { level: 20, slots: [4,3,3,3,3,2,2,1,1] },
];

/** Half caster (Paladin, Ranger). */
export const HALF_CASTER_SLOTS: SpellSlotRow[] = [
  { level:  1, slots: [0,0,0,0,0,0,0,0,0] },
  { level:  2, slots: [2,0,0,0,0,0,0,0,0] },
  { level:  3, slots: [3,0,0,0,0,0,0,0,0] },
  { level:  4, slots: [3,0,0,0,0,0,0,0,0] },
  { level:  5, slots: [4,2,0,0,0,0,0,0,0] },
  { level:  6, slots: [4,2,0,0,0,0,0,0,0] },
  { level:  7, slots: [4,3,0,0,0,0,0,0,0] },
  { level:  8, slots: [4,3,0,0,0,0,0,0,0] },
  { level:  9, slots: [4,3,2,0,0,0,0,0,0] },
  { level: 10, slots: [4,3,2,0,0,0,0,0,0] },
  { level: 11, slots: [4,3,3,0,0,0,0,0,0] },
  { level: 12, slots: [4,3,3,0,0,0,0,0,0] },
  { level: 13, slots: [4,3,3,1,0,0,0,0,0] },
  { level: 14, slots: [4,3,3,1,0,0,0,0,0] },
  { level: 15, slots: [4,3,3,2,0,0,0,0,0] },
  { level: 16, slots: [4,3,3,2,0,0,0,0,0] },
  { level: 17, slots: [4,3,3,3,1,0,0,0,0] },
  { level: 18, slots: [4,3,3,3,1,0,0,0,0] },
  { level: 19, slots: [4,3,3,3,2,0,0,0,0] },
  { level: 20, slots: [4,3,3,3,2,0,0,0,0] },
];

/** Warlock (pact magic — all slots same tier, recharge short rest). */
export const WARLOCK_SLOTS: SpellSlotRow[] = [
  { level:  1, slots: [1,0,0,0,0,0,0,0,0] },
  { level:  2, slots: [2,0,0,0,0,0,0,0,0] },
  { level:  3, slots: [0,2,0,0,0,0,0,0,0] },
  { level:  4, slots: [0,2,0,0,0,0,0,0,0] },
  { level:  5, slots: [0,0,2,0,0,0,0,0,0] },
  { level:  6, slots: [0,0,2,0,0,0,0,0,0] },
  { level:  7, slots: [0,0,0,2,0,0,0,0,0] },
  { level:  8, slots: [0,0,0,2,0,0,0,0,0] },
  { level:  9, slots: [0,0,0,0,2,0,0,0,0] },
  { level: 10, slots: [0,0,0,0,2,0,0,0,0] },
  { level: 11, slots: [0,0,0,0,3,0,0,0,0] },
  { level: 12, slots: [0,0,0,0,3,0,0,0,0] },
  { level: 13, slots: [0,0,0,0,3,0,0,0,0] },
  { level: 14, slots: [0,0,0,0,3,0,0,0,0] },
  { level: 15, slots: [0,0,0,0,3,0,0,0,0] },
  { level: 16, slots: [0,0,0,0,3,0,0,0,0] },
  { level: 17, slots: [0,0,0,0,4,0,0,0,0] },
  { level: 18, slots: [0,0,0,0,4,0,0,0,0] },
  { level: 19, slots: [0,0,0,0,4,0,0,0,0] },
  { level: 20, slots: [0,0,0,0,4,0,0,0,0] },
];

/** Build a SpellSlots object from a SlotRow for a given level. */
export function slotsForLevel(
  table: SpellSlotRow[],
  level: number,
): import('../../engine/types').SpellSlots {
  const row = table.find(r => r.level === level) ?? table[0];
  const [s1,s2,s3,s4,s5,s6,s7,s8,s9] = row.slots;
  return {
    '1': { total: s1, used: 0 },
    '2': { total: s2, used: 0 },
    '3': { total: s3, used: 0 },
    '4': { total: s4, used: 0 },
    '5': { total: s5, used: 0 },
    '6': { total: s6, used: 0 },
    '7': { total: s7, used: 0 },
    '8': { total: s8, used: 0 },
    '9': { total: s9, used: 0 },
  };
}

/** Maps classId to its spell slot table. */
const SLOT_TABLES: Record<string, SpellSlotRow[]> = {
  wizard:   FULL_CASTER_SLOTS,
  cleric:   FULL_CASTER_SLOTS,
  druid:    FULL_CASTER_SLOTS,
  bard:     FULL_CASTER_SLOTS,
  sorcerer: FULL_CASTER_SLOTS,
  paladin:  HALF_CASTER_SLOTS,
  ranger:   HALF_CASTER_SLOTS,
  warlock:  WARLOCK_SLOTS,
};

/**
 * Returns the 9-element slot count array for a given classId and level.
 * Returns null for non-spellcasting classes (fighter, rogue, barbarian, monk).
 */
export function getSpellSlotsForClassLevel(
  classId: string,
  level:   number,
): [number,number,number,number,number,number,number,number,number] | null {
  const table = SLOT_TABLES[classId];
  if (!table) return null;
  const row = table.find(r => r.level === level);
  if (!row) return null;
  return row.slots as [number,number,number,number,number,number,number,number,number];
}
