// ============================================================================
// FILE: src/content/itemEditions.ts
// 5e and 5.5e items that differ do not share an id. An item the SRD 5.2.1 pack rewrites (a magic item with the 2024 text and
// attunement, a tool with the 2024 Utilize and Craft entries) is a separate record whose id is the 5e id plus `_2024`, tagged
// rulesetId 'dnd5e-2024', so installing it can never replace the 5e item and a 5e character never sees it. Items that are the
// same in both editions (a Longsword) stay one record. These helpers say which id belongs to which edition; pure functions.
// ============================================================================
import type { RulesetId } from '../engine/types';

export const EDITION_2024_SUFFIX = '_2024';
const R2024 = 'dnd5e-2024';

export const is2024ItemId = (id: string): boolean => id.endsWith(EDITION_2024_SUFFIX);
export const editionItemId = (baseId: string): string => baseId + EDITION_2024_SUFFIX;
export const baseItemId = (id: string): string => (is2024ItemId(id) ? id.slice(0, -EDITION_2024_SUFFIX.length) : id);

/** The ids to try, in order, for an item reference on a character of this ruleset: its edition's own record first. */
export function itemIdCandidates(id: string, ruleset: RulesetId | string | undefined): string[] {
  const base = baseItemId(id);
  return ruleset === R2024 ? [editionItemId(base), base] : [base, editionItemId(base)];
}

/**
 * What a list of items shows for a ruleset: records written for the other edition are left out, and a base record is left out
 * when the edition has its own version of it. With no ruleset, everything is shown.
 */
export function itemsForRuleset<T extends { id: string; rulesetId?: RulesetId | string }>(items: readonly T[], ruleset: RulesetId | string | undefined): T[] {
  if (!ruleset) return [...items];
  const ids = new Set(items.map(i => i.id));
  return items.filter(i => {
    if (i.rulesetId && i.rulesetId !== ruleset) return false;
    if (ruleset === R2024) return !(ids.has(editionItemId(i.id)));
    return !is2024ItemId(i.id) || i.rulesetId === ruleset;
  });
}

/** A copy of an item under another id (its features follow: their ids and their source reference the new id), tagged for 5.5e. */
export function asEditionItem<T extends { id: string; features: { id: string; source?: { refId?: string } }[] }>(item: T, newId: string): T & { rulesetId: RulesetId } {
  const old = item.id;
  const rename = (s: string) => (s === old ? newId : s.startsWith(old + '_') ? newId + s.slice(old.length) : s);
  return {
    ...item, id: newId, rulesetId: R2024 as RulesetId,
    features: item.features.map(f => ({ ...f, id: rename(f.id), ...(f.source ? { source: { ...f.source, ...(f.source.refId ? { refId: f.source.refId === old ? newId : f.source.refId } : {}) } } : {}) })),
  };
}
