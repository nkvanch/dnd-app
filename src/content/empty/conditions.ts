import type { Condition } from '../../engine/types';
import { getOfficialContentProvider } from '../officialSource';
export const ALL_CONDITIONS: Condition[] = [];
export const CONDITIONS_BY_ID: Record<string, Condition> = {};
let homebrewConditionsById: Record<string, Condition> = {};
export function registerHomebrewConditions(list: readonly Condition[]): void {
  homebrewConditionsById = Object.fromEntries(list.map(c => [c.id, c]));
}
/** The installed packs' condition, else a registered homebrew one. */
export function lookupCondition(id: string): Condition | undefined {
  return getOfficialContentProvider()?.getCondition(id) ?? homebrewConditionsById[id];
}
