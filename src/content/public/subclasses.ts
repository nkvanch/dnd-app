import snapshot from './publicContent.json';
import type { ClassProgression } from '../../engine/types';
export type SubclassProgression = ClassProgression & { name: string };
export const ALL_SUBCLASSES = snapshot.subclasses as SubclassProgression[];
export const FULL_SUBCLASS_LIBRARY = ALL_SUBCLASSES;
export function getSubclassesForClass(classId: string): SubclassProgression[] { return ALL_SUBCLASSES.filter(value => value.classId === classId); }
