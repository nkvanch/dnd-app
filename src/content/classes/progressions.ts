import { ALL_PROGRESSIONS } from './index';
import {
  ClassProgression, CharClass, LevelEntry, ChoiceDefinition, Grant, Feature, Ability,
} from '../../engine/types';
import {
  FULL_CASTER_SLOTS, HALF_CASTER_SLOTS, WARLOCK_SLOTS,
} from './spellSlotTables';

/** Alias of the canonical map in ./index. */
export const PROGRESSIONS = ALL_PROGRESSIONS;

/** Returns the class progression for a classId, or null if unknown (e.g. homebrew). */
export function getProgression(classId: string): ClassProgression | null {
  return ALL_PROGRESSIONS[classId] ?? null;
}

// ── Homebrew class progression builder (4B Phase 1 + Phase 2) ──────────────────
//
// Builds a full ClassProgression from the fields authored in a CharClass.
// Phase 1 fields (id, name, hitDie, features, description) produce a stub:
//   • HP grows by hit die every level
//   • Level-1 features from cls.features
//   • ASI choices at levels 4/8/12/16/19
// Phase 2 fields (all optional) override/extend the stub:
//   • savingThrows   → stored on CharClass; class-detail.tsx reads it in doSelect()
//   • armorProfs / weaponProfs  → emitted as a proficiency grant at level 1
//   • spellcastingAbility + spellcastingStyle + spellcastingStartLevel
//                         → init_spellcasting + spell_slots grants per level
//   • asiLevels            → replaces the stub [4,8,12,16,19] default
//   • levelFeatures        → feature grants at each authored level

const STUB_ASI_LEVELS = [4, 8, 12, 16, 19];

function makeAsiChoice(id: string): ChoiceDefinition {
  return {
    id,
    prompt:   'Choose an Ability Score Increase (+2 to one or +1 to two) or a Feat.',
    kind:     'asi', count: 1, pool: 'all', grants: [], required: true, resolved: false,
  };
}

/** Resolves the slot table rows for a spellcastingStyle. */
function slotTableForStyle(
  style: 'full' | 'half' | 'pact',
): { level: number; slots: number[] }[] {
  switch (style) {
    case 'full': return FULL_CASTER_SLOTS;
    case 'half': return HALF_CASTER_SLOTS;
    case 'pact': return WARLOCK_SLOTS;
  }
}

/**
 * Builds a complete ClassProgression for a homebrew class from its CharClass
 * definition. Phase 2 fields are used when present; stub values fill in gaps.
 *
 * Exported as buildProgressionFromClass (canonical name) and buildStubProgression
 * (backward-compat alias used by existing callers).
 */
export function buildProgressionFromClass(cls: CharClass): ClassProgression {
  const asiLevels = new Set(cls.asiLevels ?? STUB_ASI_LEVELS);

  // Resolve spell slot table if spellcasting is configured
  const slotTable = (cls.spellcastingAbility && cls.spellcastingStyle)
    ? slotTableForStyle(cls.spellcastingStyle)
    : null;
  const spellStartLevel = cls.spellcastingStartLevel ?? 1;

  // Group authored level features by level number
  const featuresByLevel = new Map<number, { name: string; description: string }[]>();
  for (const f of (cls.levelFeatures ?? [])) {
    if (!featuresByLevel.has(f.level)) featuresByLevel.set(f.level, []);
    featuresByLevel.get(f.level)!.push(f);
  }

  const entries: LevelEntry[] = [];

  for (let level = 1; level <= 20; level++) {
    const grants: Grant[] = [];

    // ─ Level 1: proficiency grant ──────────────────────────────────────────────
    if (level === 1 && (cls.armorProfs?.length || cls.weaponProfs?.length)) {
      grants.push({
        kind:  'proficiency',
        value: { armor: cls.armorProfs ?? [], weapons: cls.weaponProfs ?? [] },
      });
    }

    // ─ Backward-compat: legacy cls.features at level 1 ─────────────────────────
    // cls.features is the old Phase 1 / pre-Phase 2 field. Phase 2 classes use
    // levelFeatures instead. We still emit cls.features at level 1 so old homebrew
    // classes (saved before Phase 2) continue working unchanged.
    if (level === 1) {
      for (const f of (cls.features ?? [])) {
        grants.push({ kind: 'feature', value: f });
      }
    }

    // ─ Authored per-level features from levelFeatures ──────────────────────────
    const authoredFeatures = featuresByLevel.get(level);
    if (authoredFeatures) {
      for (const f of authoredFeatures) {
        const feature: Feature = {
          id:          `${cls.id}_feat_l${level}_${f.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 30)}`,
          name:        f.name,
          description: f.description,
          source:      { kind: 'class', refId: cls.id },
          level,
          effects:     [],
          actions:     [],
          choices:     [],
          passive:     true,
        };
        grants.push({ kind: 'feature', value: feature });
      }
    }

    // ─ Spellcasting ───────────────────────────────────────────────────────────────
    if (cls.spellcastingAbility) {
      // init_spellcasting must come before spell_slots in the grants array
      if (level === spellStartLevel) {
        grants.push({
          kind:  'init_spellcasting',
          value: { ability: cls.spellcastingAbility },
        });
      }
      // Emit spell_slots every level at or above start level so the slot
      // count is refreshed as the character levels up through the table.
      if (slotTable && level >= spellStartLevel) {
        grants.push({
          kind:  'spell_slots',
          value: { level, slotsTable: slotTable },
        });
      }
    }

    entries.push({
      level,
      hpDie:   cls.hitDie as 4 | 6 | 8 | 10 | 12,
      choices: asiLevels.has(level) ? [makeAsiChoice(`${cls.id}_asi_${level}`)] : [],
      grants,
    });
  }

  return { classId: cls.id, entries };
}

/** Backward-compat alias. Existing callers that import buildStubProgression continue to work. */
export const buildStubProgression = buildProgressionFromClass;

/**
 * Returns the progression for a class, falling back to a generated progression
 * for homebrew classes with no hand-authored progression in ALL_PROGRESSIONS.
 * Never returns null.
 */
export function getProgressionForClass(cls: CharClass): ClassProgression {
  return ALL_PROGRESSIONS[cls.id] ?? buildProgressionFromClass(cls);
}
