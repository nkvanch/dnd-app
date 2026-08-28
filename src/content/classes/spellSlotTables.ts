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

/**
 * Artificer — identical to the half-caster table from level 2 on, but
 * (unusually for a half-caster) already casts at level 1, using the same
 * slot allocation the half-caster table gives at level 2 (2 first-level
 * slots) instead of the usual empty level-1 row.
 */
export const ARTIFICER_SLOTS: SpellSlotRow[] = HALF_CASTER_SLOTS.map(row =>
  row.level === 1 ? { level: 1, slots: HALF_CASTER_SLOTS[1].slots } : row
);

/**
 * Third caster (Eldritch Knight, Arcane Trickster) — casting starts at
 * class level 3, tops out at 4th-level spells.
 */
export const THIRD_CASTER_SLOTS: SpellSlotRow[] = [
  { level:  1, slots: [0,0,0,0,0,0,0,0,0] },
  { level:  2, slots: [0,0,0,0,0,0,0,0,0] },
  { level:  3, slots: [2,0,0,0,0,0,0,0,0] },
  { level:  4, slots: [3,0,0,0,0,0,0,0,0] },
  { level:  5, slots: [3,0,0,0,0,0,0,0,0] },
  { level:  6, slots: [3,0,0,0,0,0,0,0,0] },
  { level:  7, slots: [4,2,0,0,0,0,0,0,0] },
  { level:  8, slots: [4,2,0,0,0,0,0,0,0] },
  { level:  9, slots: [4,2,0,0,0,0,0,0,0] },
  { level: 10, slots: [4,3,0,0,0,0,0,0,0] },
  { level: 11, slots: [4,3,0,0,0,0,0,0,0] },
  { level: 12, slots: [4,3,0,0,0,0,0,0,0] },
  { level: 13, slots: [4,3,2,0,0,0,0,0,0] },
  { level: 14, slots: [4,3,2,0,0,0,0,0,0] },
  { level: 15, slots: [4,3,2,0,0,0,0,0,0] },
  { level: 16, slots: [4,3,3,0,0,0,0,0,0] },
  { level: 17, slots: [4,3,3,0,0,0,0,0,0] },
  { level: 18, slots: [4,3,3,0,0,0,0,0,0] },
  { level: 19, slots: [4,3,3,1,0,0,0,0,0] },
  { level: 20, slots: [4,3,3,1,0,0,0,0,0] },
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

/**
 * Blood Hunter — Order of the Profane Soul pact magic (warlock-style, all
 * slots the same tier, recharge short rest). Levels 1-2 are zero since the
 * order isn't chosen until class level 3.
 * Level  | Slots | Slot Level
 *  3-5   |   1   |    1st
 *   6    |   2   |    1st
 *  7-12  |   2   |    2nd
 * 13-18  |   2   |    3rd
 * 19-20  |   2   |    4th
 */
export const PROFANE_SOUL_SLOTS: SpellSlotRow[] = [
  { level:  1, slots: [0,0,0,0,0,0,0,0,0] },
  { level:  2, slots: [0,0,0,0,0,0,0,0,0] },
  { level:  3, slots: [1,0,0,0,0,0,0,0,0] },
  { level:  4, slots: [1,0,0,0,0,0,0,0,0] },
  { level:  5, slots: [1,0,0,0,0,0,0,0,0] },
  { level:  6, slots: [2,0,0,0,0,0,0,0,0] },
  { level:  7, slots: [0,2,0,0,0,0,0,0,0] },
  { level:  8, slots: [0,2,0,0,0,0,0,0,0] },
  { level:  9, slots: [0,2,0,0,0,0,0,0,0] },
  { level: 10, slots: [0,2,0,0,0,0,0,0,0] },
  { level: 11, slots: [0,2,0,0,0,0,0,0,0] },
  { level: 12, slots: [0,2,0,0,0,0,0,0,0] },
  { level: 13, slots: [0,0,2,0,0,0,0,0,0] },
  { level: 14, slots: [0,0,2,0,0,0,0,0,0] },
  { level: 15, slots: [0,0,2,0,0,0,0,0,0] },
  { level: 16, slots: [0,0,2,0,0,0,0,0,0] },
  { level: 17, slots: [0,0,2,0,0,0,0,0,0] },
  { level: 18, slots: [0,0,2,0,0,0,0,0,0] },
  { level: 19, slots: [0,0,0,2,0,0,0,0,0] },
  { level: 20, slots: [0,0,0,2,0,0,0,0,0] },
];

/**
 * Abyss Knight pact magic — exact class table.
 * Level  | Slots | Slot Level
 *  2-4   |   2   |    1st
 *  5-8   |   2   |    2nd
 *  9-10  |   2   |    3rd
 * 11-12  |   3   |    3rd
 * 13-16  |   3   |    4th
 * 17-20  |   4   |    5th
 */
export const ABYSS_KNIGHT_SLOTS: SpellSlotRow[] = [
  { level:  1, slots: [0, 0, 0, 0, 0, 0, 0, 0, 0] }, // no spellcasting
  { level:  2, slots: [2, 0, 0, 0, 0, 0, 0, 0, 0] }, // 2 × 1st
  { level:  3, slots: [2, 0, 0, 0, 0, 0, 0, 0, 0] },
  { level:  4, slots: [2, 0, 0, 0, 0, 0, 0, 0, 0] },
  { level:  5, slots: [0, 2, 0, 0, 0, 0, 0, 0, 0] }, // 2 × 2nd ↑
  { level:  6, slots: [0, 2, 0, 0, 0, 0, 0, 0, 0] },
  { level:  7, slots: [0, 2, 0, 0, 0, 0, 0, 0, 0] },
  { level:  8, slots: [0, 2, 0, 0, 0, 0, 0, 0, 0] },
  { level:  9, slots: [0, 0, 2, 0, 0, 0, 0, 0, 0] }, // 2 × 3rd ↑
  { level: 10, slots: [0, 0, 2, 0, 0, 0, 0, 0, 0] },
  { level: 11, slots: [0, 0, 3, 0, 0, 0, 0, 0, 0] }, // 3 × 3rd ↑
  { level: 12, slots: [0, 0, 3, 0, 0, 0, 0, 0, 0] },
  { level: 13, slots: [0, 0, 0, 3, 0, 0, 0, 0, 0] }, // 3 × 4th ↑
  { level: 14, slots: [0, 0, 0, 3, 0, 0, 0, 0, 0] },
  { level: 15, slots: [0, 0, 0, 3, 0, 0, 0, 0, 0] },
  { level: 16, slots: [0, 0, 0, 3, 0, 0, 0, 0, 0] },
  { level: 17, slots: [0, 0, 0, 0, 4, 0, 0, 0, 0] }, // 4 × 5th ↑
  { level: 18, slots: [0, 0, 0, 0, 4, 0, 0, 0, 0] },
  { level: 19, slots: [0, 0, 0, 0, 4, 0, 0, 0, 0] },
  { level: 20, slots: [0, 0, 0, 0, 4, 0, 0, 0, 0] },
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
  abyss_knight: ABYSS_KNIGHT_SLOTS,
  artificer: ARTIFICER_SLOTS,
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

// ── Multiclass spellcasting ─────────────────────────────────────────────────

/**
 * PHB "Multiclass Spellcaster" combined table — identical progression to the
 * full-caster table by RAW, but indexed by COMBINED caster level (see
 * multiclassCasterLevel), not any one class's own level. Warlock pact magic
 * is explicitly excluded from this table (PHB rule) — see WARLOCK_SLOTS /
 * PROFANE_SOUL_SLOTS / ABYSS_KNIGHT_SLOTS for pact slots, tracked separately
 * on SpellcastingBlock.pactSlots.
 */
export const MULTICLASS_SPELLCASTER_SLOTS: SpellSlotRow[] = FULL_CASTER_SLOTS;

export type CasterType = 'full' | 'half' | 'third' | 'pact' | 'none';

/**
 * How each class counts toward the combined multiclass spellcaster level.
 * Third casters (Eldritch Knight Fighter, Arcane Trickster Rogue) are a
 * subclass-granted caster type, not a base-class one — this app's base
 * fighter/rogue entries aren't casters, so they're omitted here rather than
 * hardcoded as 'third'. See the multiclass plan's disclosed scope cut: a
 * Fighter(EK)/other-class multiclass under-grants combined slots (treats
 * the EK levels as 0 toward the combined pool) rather than the correct 1/3,
 * until subclass-aware caster-type detection is added.
 */
export const CASTER_TYPE: Record<string, CasterType> = {
  wizard:   'full',
  cleric:   'full',
  druid:    'full',
  bard:     'full',
  sorcerer: 'full',
  paladin:  'half',
  ranger:   'half',
  artificer: 'half',
  warlock:  'pact',
  blood_hunter: 'none',   // Profane Soul order grants its own pact magic — see below
  abyss_knight: 'pact',
};

/** classIds whose pact-magic table lives outside WARLOCK_SLOTS (order/patron-gated). */
const PACT_SLOT_TABLES: Record<string, SpellSlotRow[]> = {
  warlock:      WARLOCK_SLOTS,
  abyss_knight: ABYSS_KNIGHT_SLOTS,
};

export function pactSlotTableFor(classId: string, subclassId: string | null): SpellSlotRow[] | null {
  if (classId === 'blood_hunter') {
    return subclassId === 'profane_soul' ? PROFANE_SOUL_SLOTS : null;
  }
  return PACT_SLOT_TABLES[classId] ?? null;
}

/**
 * Combined multiclass caster level per PHB: full casters count their whole
 * level, half casters floor(level/2), third casters floor(level/3) (see
 * CASTER_TYPE's note on why third-caster subclasses aren't detected here
 * yet), pact casters (Warlock) don't contribute at all — their slots are
 * tracked separately as pact slots.
 */
export function multiclassCasterLevel(
  classes: { classId: string; level: number }[],
): number {
  let total = 0;
  for (const c of classes) {
    const type = CASTER_TYPE[c.classId];
    if (type === 'full')      total += c.level;
    else if (type === 'half') total += Math.floor(c.level / 2);
    else if (type === 'third') total += Math.floor(c.level / 3);
  }
  return total;
}
