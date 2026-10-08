// ============================================================================
// FILE: src/content/rulesetSuggestion.ts
// "Suggest the selected ruleset's content foremost." Pickers still show everything (nothing is
// hidden), but a stable re-order puts content tagged for the character's ruleset first, then
// content that belongs to every ruleset (untagged), then content tagged for some other ruleset.
// With no active ruleset the list is returned untouched.
// ============================================================================
import { RulesetId } from '../engine/types';

type Tagged = { rulesetId?: RulesetId };

/** 0 = tagged for the active ruleset, 1 = shared by every ruleset, 2 = tagged for a different one. */
export function suggestionRank(item: Tagged, active: RulesetId | undefined): 0 | 1 | 2 {
  if (!active) return 1;
  if (item.rulesetId === active) return 0;
  return item.rulesetId === undefined ? 1 : 2;
}

/** Stable re-order: the active ruleset's content first. Returns a new array. */
export function suggestFirst<T extends Tagged>(items: readonly T[], active: RulesetId | undefined): T[] {
  if (!active) return [...items];
  return items
    .map((item, index) => ({ item, index, rank: suggestionRank(item, active) }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map(x => x.item);
}

/** Whether an item is specifically tagged for the active ruleset (worth a "Suggested" badge). */
export const isSuggested = (item: Tagged, active: RulesetId | undefined): boolean => !!active && item.rulesetId === active;
