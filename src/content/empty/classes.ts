import type { CharClass, ClassProgression } from '../../engine/types';
export const ALL_CHAR_CLASSES: CharClass[] = [];
export const ALL_CHAR_CLASSES_CATALOG: CharClass[] = [];
export const ALL_CLASS_PROGRESSIONS: ClassProgression[] = [];
export const ALL_PROGRESSIONS: Record<string, ClassProgression> = {};
export function filterClassesForExposure(classes: readonly CharClass[], _srdOnly: boolean): CharClass[] { return [...classes]; }
