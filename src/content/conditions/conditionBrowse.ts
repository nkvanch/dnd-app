// src/content/conditions/conditionBrowse.ts
// SHARED-QUERY-1: Condition sort options, following the same pattern as
// every other content type this pass. Condition has no `srd?` field at all
// (confirmed against its type: `{id, name, description, features,
// rulesetId?}` — unlike every other content type) — conditionSourceLabel
// therefore only ever resolves to "Local Homebrew" for homebrew content or
// undefined for official content, a narrower signal than most other types'
// source label, disclosed here rather than fabricated.
import { Condition } from '../../engine/types';
import { SortOption, nameSortOptions, sourceSortOption } from '../contentQuery';
import { getContentProvenance } from '../provenance';

export function conditionSourceLabel(c: Condition, isHomebrew: boolean): string | undefined {
  return getContentProvenance(c, { isHomebrew }).sourceLabel;
}

export function conditionSortOptions(isHomebrewOf: (c: Condition) => boolean): SortOption<Condition>[] {
  return [
    ...nameSortOptions<Condition>(),
    sourceSortOption<Condition>(c => conditionSourceLabel(c, isHomebrewOf(c))),
  ];
}
