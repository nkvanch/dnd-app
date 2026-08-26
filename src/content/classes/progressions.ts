import { ALL_PROGRESSIONS } from './index';
import {
  ClassProgression, CharClass, LevelEntry, ChoiceDefinition, Grant, Ability,
} from '../../engine/types';
import {
  FULL_CASTER_SLOTS, HALF_CASTER_SLOTS, WARLOCK_SLOTS,
} from './spellSlotTables';
import { buildTraitFeature } from '../traitCompiler';

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
  // A hand-authored full progression always wins over the simplified fields.
  if (cls.rawProgression) return cls.rawProgression;

  const asiLevels = new Set(cls.asiLevels ?? STUB_ASI_LEVELS);

  // Resolve spell slot table if spellcasting is configured. Checks BOTH the
  // single-ability field and the multi-ability options array — a class using
  // spellcastingAbilityOptions (2+ entries) would otherwise fail this check
  // since cls.spellcastingAbility stays unset for that case, silently losing
  // its slot table.
  const hasSpellcasting = !!cls.spellcastingAbility || (cls.spellcastingAbilityOptions?.length ?? 0) > 0;
  const slotTable = (hasSpellcasting && cls.spellcastingStyle)
    ? slotTableForStyle(cls.spellcastingStyle)
    : null;
  const spellStartLevel = cls.spellcastingStartLevel ?? 1;

  // Group authored level features by level number
  const featuresByLevel = new Map<number, NonNullable<CharClass['levelFeatures']>>();
  for (const f of (cls.levelFeatures ?? [])) {
    if (!featuresByLevel.has(f.level)) featuresByLevel.set(f.level, []);
    featuresByLevel.get(f.level)!.push(f);
  }

  const entries: LevelEntry[] = [];

  for (let level = 1; level <= 20; level++) {
    const grants: Grant[] = [];
    const levelChoices: ChoiceDefinition[] = [];

    // ─ Level 1: proficiency grant ──────────────────────────────────────────────
    if (level === 1 && (cls.armorProfs?.length || cls.weaponProfs?.length || cls.toolProfs?.length)) {
      grants.push({
        kind:  'proficiency',
        value: { armor: cls.armorProfs ?? [], weapons: cls.weaponProfs ?? [], tools: cls.toolProfs ?? [] },
      });
    }

    if (level === 1 && cls.startingEquipment?.length) {
      for (const itemId of cls.startingEquipment) {
        grants.push({ kind: 'starting_item', value: itemId });
      }
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
    // Classes saved before class features gained real effect kinds only have
    // {level, name, description} — effectKind defaults to 'none' (flavor-only),
    // matching what buildTraitFeature already does for an unset/unrecognized kind.
    const authoredFeatures = featuresByLevel.get(level);
    if (authoredFeatures) {
      for (const f of authoredFeatures) {
        const { feature, resource } = buildTraitFeature(
          { ...f, effectKind: f.effectKind ?? 'none' },
          { idPrefix: `${cls.id}_l${level}`, sourceKind: 'class', sourceRefId: cls.id, level },
        );
        grants.push({ kind: 'feature', value: feature });
        if (resource) grants.push({ kind: 'resource', value: resource });
      }
    }

    // ─ Spellcasting ───────────────────────────────────────────────────────────────
    const multiAbility  = (cls.spellcastingAbilityOptions?.length ?? 0) >= 2;
    const singleAbility = multiAbility ? undefined : (cls.spellcastingAbilityOptions?.[0] ?? cls.spellcastingAbility);

    if (singleAbility) {
      // init_spellcasting must come before spell_slots in the grants array
      if (level === spellStartLevel) {
        grants.push({
          kind:  'init_spellcasting',
          value: { ability: singleAbility },
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
    } else if (multiAbility) {
      if (level === spellStartLevel) {
        levelChoices.push({
          id:       `${cls.id}_spellcasting_ability`,
          prompt:   `Choose your spellcasting ability: ${cls.spellcastingAbilityOptions!.map(a => a.toUpperCase()).join(', ')}.`,
          kind:     'spellcasting_ability',
          count:    1,
          pool:     cls.spellcastingAbilityOptions!.map(a => ({ id: a, label: a.toUpperCase(), value: a })),
          grants:   [],
          required: true,
          resolved: false,
        });
      }
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
      choices: [
        ...levelChoices,
        ...(asiLevels.has(level) ? [makeAsiChoice(`${cls.id}_asi_${level}`)] : []),
      ],
      grants,
    });
  }

  return { classId: cls.id, entries, hpAbility: cls.hpAbility };
}

/** Backward-compat alias. Existing callers that import buildStubProgression continue to work. */
export const buildStubProgression = buildProgressionFromClass;

/**
 * Returns the progression for a class, falling back to a generated progression
 * for homebrew classes with no hand-authored progression in ALL_PROGRESSIONS.
 * Never returns null.
 */
export function getProgressionForClass(cls: CharClass): ClassProgression {
  // Priority: hand-authored rawProgression > registered official progression >
  // progression rebuilt from the simplified homebrew fields.
  if (cls.rawProgression) return cls.rawProgression;
  return ALL_PROGRESSIONS[cls.id] ?? buildProgressionFromClass(cls);
}
