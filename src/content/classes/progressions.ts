// ============================================================================
// FILE: src/content/classes/progressions.ts
// Compatibility shim. The canonical classId → ClassProgression map is
// ALL_PROGRESSIONS in ./index — this re-exports it (plus a null-safe getter)
// so callers don't build a second, drift-prone copy.
// ============================================================================
import { ALL_PROGRESSIONS } from './index';
import { ClassProgression, CharClass, LevelEntry, ChoiceDefinition, Grant } from '../../engine/types';

/** Alias of the canonical map in ./index. */
export const PROGRESSIONS = ALL_PROGRESSIONS;

/** Returns the class progression for a classId, or null if unknown (e.g. homebrew). */
export function getProgression(classId: string): ClassProgression | null {
  return ALL_PROGRESSIONS[classId] ?? null;
}

// ── Homebrew class progression fallback (4B Phase 1) ────────────────────────
//
// Homebrew classes (built in app/homebrew/class-builder.tsx) are saved as a
// bare CharClass: { id, name, hitDie, features: [] } — there is no authored
// ClassProgression for them. Without a fallback, getProgression(homebrewId)
// returns null and levelUp() is never called for that class, leaving the
// character permanently stuck at level 0 with 0 HP.
//
// buildStubProgression generates a minimal-but-functional 1–20 progression
// from just the CharClass: HP grows by the class's hit die every level, the
// class's own features (if any) apply at level 1, and standard Ability Score
// Improvement choices appear at levels 4/8/12/16/19 (the same levels as most
// official classes). This makes ANY homebrew class immediately selectable and
// levelable — no saving throws, proficiencies, or spellcasting are inferred,
// since there's no data to infer them from yet. A full level-by-level editor
// (4B Phase 2) lets a player replace this stub with real per-level content.

const STUB_ASI_LEVELS = [4, 8, 12, 16, 19];

function stubAsiChoice(id: string): ChoiceDefinition {
  return {
    id,
    prompt:   'Choose an Ability Score Increase (+2 to one or +1 to two) or a Feat.',
    kind:     'asi', count: 1, pool: 'all', grants: [], required: true, resolved: false,
  };
}

export function buildStubProgression(cls: CharClass): ClassProgression {
  const asiLevels = new Set(STUB_ASI_LEVELS);
  const entries: LevelEntry[] = [];
  for (let level = 1; level <= 20; level++) {
    const grants: Grant[] = level === 1
      ? cls.features.map(f => ({ kind: 'feature', value: f }))
      : [];
    entries.push({
      level,
      hpDie:   cls.hitDie as 4 | 6 | 8 | 10 | 12,
      choices: asiLevels.has(level) ? [stubAsiChoice(`${cls.id}_stub_asi_${level}`)] : [],
      grants,
    });
  }
  return { classId: cls.id, entries };
}

/**
 * Returns the progression for a class, falling back to a generated stub for
 * homebrew classes with no authored progression. Unlike getProgression, this
 * never returns null — every CharClass produces a usable (if minimal)
 * progression, so levelUp() can always be called safely.
 */
export function getProgressionForClass(cls: CharClass): ClassProgression {
  return ALL_PROGRESSIONS[cls.id] ?? buildStubProgression(cls);
}
