// ============================================================================
// FILE: src/content/classes/progressions.ts
// Compatibility shim. The canonical classId → ClassProgression map is
// ALL_PROGRESSIONS in ./index — this re-exports it (plus a null-safe getter)
// so callers don't build a second, drift-prone copy.
// ============================================================================
import { ALL_PROGRESSIONS } from './index';
import { ClassProgression } from '../../engine/types';

/** Alias of the canonical map in ./index. */
export const PROGRESSIONS = ALL_PROGRESSIONS;

/** Returns the class progression for a classId, or null if unknown (e.g. homebrew). */
export function getProgression(classId: string): ClassProgression | null {
  return ALL_PROGRESSIONS[classId] ?? null;
}
