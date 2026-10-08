import snapshot from './publicContent.json';
import type { CharClass, ClassProgression } from '../../engine/types';
export const ALL_CHAR_CLASSES = snapshot.classes as CharClass[];
export const ALL_CHAR_CLASSES_CATALOG = ALL_CHAR_CLASSES;
export const ALL_CLASS_PROGRESSIONS = snapshot.progressions as ClassProgression[];
export const ALL_PROGRESSIONS: Record<string, ClassProgression> = Object.fromEntries(ALL_CLASS_PROGRESSIONS.map(value => [value.classId, value]));
export function filterClassesForExposure(classes: readonly CharClass[], _srdOnly: boolean): CharClass[] { return [...classes]; }
