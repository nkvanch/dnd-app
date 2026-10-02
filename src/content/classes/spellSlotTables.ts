// ============================================================================
// FILE: src/content/classes/spellSlotTables.ts
// PHB spell slot progression tables.
// Row index = level - 1. Columns = slot tiers 1-9.
// ============================================================================
import { SpellSlotRow, SpellSlots } from '../../engine/types';

/**
 * Converts a raw 9-slot count array (or null, for "no slots at all" — a
 * genuine zero, not a table lookup miss) into a SpellSlots object, preserving
 * `used` from a previous slots block where present (clamped to the new
 * total, same as every other slot-refresh site in this codebase). Shared by
 * levelUp()/levelUpClass() so both the direct and incremental leveling paths
 * build a slots object the identical way — re-audit A10 found them diverging
 * partly because each hand-rolled its own version of this loop.
 */
export function slotsFromCountArray(
  counts:   [number,number,number,number,number,number,number,number,number] | null,
  prevUsed?: SpellSlots,
): SpellSlots {
  const tiers = ['1','2','3','4','5','6','7','8','9'] as const;
  const result = {} as SpellSlots;
  tiers.forEach((t, i) => {
    const total = counts ? counts[i] : 0;
    const used  = Math.max(0, Math.min(prevUsed?.[t]?.used ?? 0, total));
    result[t] = { total, used };
  });
  return result;
}

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
  // Emperor Warlock (both versions): the spec says only "Warlock-style Pact Magic", so it uses the standard Warlock table.
  emperor_warlock: WARLOCK_SLOTS,
  emperor_warlock_demo: WARLOCK_SLOTS,
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

/** Official fallback for definitions without caster metadata. Structured
 * spellcastingStyle takes precedence. Subclass-only third casters are resolved below. */
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
  emperor_warlock: 'pact',
  emperor_warlock_demo: 'pact',
};

/** classIds whose pact-magic table lives outside WARLOCK_SLOTS (order/patron-gated). */
const PACT_SLOT_TABLES: Record<string, SpellSlotRow[]> = {
  warlock:      WARLOCK_SLOTS,
  abyss_knight: ABYSS_KNIGHT_SLOTS,
  emperor_warlock:      WARLOCK_SLOTS,
  emperor_warlock_demo: WARLOCK_SLOTS,
};

export function pactSlotTableFor(classId: string, subclassId: string | null): SpellSlotRow[] | null {
  if (classId === 'blood_hunter') {
    return subclassId === 'profane_soul' ? PROFANE_SOUL_SLOTS : null;
  }
  return PACT_SLOT_TABLES[classId] ?? null;
}

/**
 * Resolves a class's caster type — the hardcoded CASTER_TYPE map first (every
 * official class, unaffected, zero behavior change), falling back to the
 * class's own authored `spellcastingStyle` ('full'/'half'/'pact') when the
 * classId isn't in that map. This is real, already-existing structured
 * metadata (CharClass.spellcastingStyle, authored by the homebrew class
 * builder and already used to build a homebrew class's OWN single-class slot
 * table in progressions.ts) — re-audit A13 finding was specifically that this
 * classifier never consulted it. Third-caster ('third') has no
 * spellcastingStyle equivalent (it's a subclass-granted type, not a base-
 * class one — see CASTER_TYPE's own note), so it stays reachable only via
 * the hardcoded map, same disclosed scope cut as before.
 */
function resolveCasterType(classId: string, spellcastingStyle?: 'full' | 'half' | 'pact'): CasterType | undefined {
  return spellcastingStyle ?? CASTER_TYPE[classId];
}

/**
 * Combined multiclass caster level per PHB: full casters count their whole
 * level, half casters floor(level/2), third casters floor(level/3); pact casters (Warlock) don't contribute at all — their slots are
 * tracked separately as pact slots. `spellcastingStyle` is optional per
 * entry — see resolveCasterType's own doc comment; omitting it for every
 * entry reproduces the exact prior (official-classes-only) behavior.
 */
export function multiclassCasterLevel(
  classes: { classId: string; level: number; spellcastingStyle?: 'full' | 'half' | 'pact'; subclassId?: string | null }[],
): number {
  let total = 0;
  for (const c of classes) {
    // Official third-caster subclasses have no CharClass caster metadata.
    const third = (c.classId === 'fighter' && c.subclassId === 'eldritch_knight')
      || (c.classId === 'rogue' && c.subclassId === 'arcane_trickster');
    const type = c.spellcastingStyle ?? (third ? 'third' : resolveCasterType(c.classId));

    if (type === 'full')      total += c.level;
    else if (type === 'half') total += Math.floor(c.level / 2);
    else if (type === 'third') total += Math.floor(c.level / 3);
  }
  return total;
}
