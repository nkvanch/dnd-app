import type { ClassProgression } from '../../engine/types';
import { getOfficialContentProvider } from '../officialSource';
export type SubclassProgression = ClassProgression & { name: string };
export const ALL_SUBCLASSES: SubclassProgression[] = [];
export const FULL_SUBCLASS_LIBRARY: SubclassProgression[] = [];
export function getSubclassesForClass(classId: string): SubclassProgression[] {
  const provider = getOfficialContentProvider();
  return provider ? (provider.subclassesOf(classId) as unknown as SubclassProgression[]) : [];
}
