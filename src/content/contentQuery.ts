// src/content/contentQuery.ts
// SHARED-QUERY-1: the one reusable content-query layer every content
// browser/picker (character-creation screens, live-character browsers,
// Homebrew, Compendium) shares for the UNIVERSAL axes — search, Game,
// Ruleset, Official/Homebrew, and sorting. Type-specific filters (Race's
// Size, Class's Hit Die, Spell's School, ...) stay in each content type's
// own `*Browse.ts` module (raceBrowse.ts, classBrowse.ts, spellBrowse.ts,
// etc.) — genuinely heterogeneous data, not worth forcing into one generic
// shape — but every one of those modules is written against THIS file's
// primitives so a screen and Compendium filtering the same content type
// share the exact same logic, never two incompatible copies.
//
// Ruleset-agnostic by construction: Game is never special-cased to D&D
// anywhere here — matchesGame()/matchesRuleset() both resolve through the
// Game→Ruleset registry (rulesets.ts) and the existing `rulesetId?` field
// every content type already carries. Adding a new supported ruleset (or
// an entirely new Game) needs zero changes to this file or to any screen
// built on it — see src/content/__tests__/contentQuery.test.ts's
// "fixture non-D&D ruleset" test for the proof.
import { RulesetId, matchesRuleset } from '../engine/types';
import { matchesGame } from './rulesets';

export type ContentTypeId =
  | 'race' | 'subrace' | 'class' | 'subclass' | 'background'
  | 'feat' | 'spell' | 'item' | 'monster' | 'condition';

export const CONTENT_TYPE_LABELS: Record<ContentTypeId, string> = {
  race: 'Races', subrace: 'Subraces', class: 'Classes', subclass: 'Subclasses',
  background: 'Backgrounds', feat: 'Feats', spell: 'Spells', item: 'Items',
  monster: 'Monsters', condition: 'Conditions',
};

/** Every content-browse module normalizes its type's content into this
 *  shape for the shared Compendium/mixed-search path. `raw` keeps the
 *  original object so type-specific rendering/filtering (which stays in
 *  each type's own module) can still get at everything else. */
export type BrowsableEntry<T = unknown> = {
  id:         string;
  name:       string;
  type:       ContentTypeId;
  rulesetId?: RulesetId;
  srd?:       boolean;
  isHomebrew: boolean;
  raw:        T;
};

export type OfficialFilter = 'all' | 'official' | 'homebrew';

export function matchesSearchText(name: string, extra: (string | undefined)[], query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (name.toLowerCase().includes(q)) return true;
  return extra.some(e => !!e && e.toLowerCase().includes(q));
}

export function matchesOfficialFilter(isHomebrew: boolean, filter: OfficialFilter): boolean {
  return filter === 'all' || (filter === 'homebrew') === isHomebrew;
}

// Re-exported so a consumer importing from this one module gets the whole
// universal-axis toolkit (search/official/ruleset/game) without also
// needing to know these two live in engine/types.ts and rulesets.ts.
export { matchesRuleset, matchesGame };

/** One entry in a sort dropdown — deliberately pre-directional (a single
 *  "A–Z" / "Z–A" pair, not one option plus a separate asc/desc toggle) to
 *  match the shared `[Sort: A–Z ▼]` control's single-selector UI. */
export type SortOption<T> = { id: string; label: string; compare: (a: T, b: T) => number };

export function sortByOption<T>(entries: T[], options: SortOption<T>[], sortId: string): T[] {
  const opt = options.find(o => o.id === sortId) ?? options[0];
  if (!opt) return entries;
  return [...entries].sort(opt.compare);
}

/** A–Z / Z–A — every content type gets these two for free; type-specific
 *  modules prepend/append their own SortOptions to this pair. */
export function nameSortOptions<T extends { name: string }>(): SortOption<T>[] {
  return [
    { id: 'name_asc',  label: 'A–Z', compare: (a, b) => a.name.localeCompare(b.name) },
    { id: 'name_desc', label: 'Z–A', compare: (a, b) => b.name.localeCompare(a.name) },
  ];
}

/** Source sort — reuses getContentProvenance()'s sourceLabel so "Source"
 *  sorts identically to however the Source/Pack filter itself derives it
 *  (undefined sorts last, not first, so unattributed content doesn't
 *  crowd the top of a Source-sorted list). */
export function sourceSortOption<T>(sourceLabelOf: (t: T) => string | undefined): SortOption<T> {
  return {
    id: 'source', label: 'Source',
    compare: (a, b) => {
      const sa = sourceLabelOf(a), sb = sourceLabelOf(b);
      if (sa === sb) return 0;
      if (sa === undefined) return 1;
      if (sb === undefined) return -1;
      return sa.localeCompare(sb);
    },
  };
}

/** Every browsable entry's ContentType, for the Compendium's "Content Type"
 *  global filter and its Content-Type sort option. */
export function contentTypeSortOption<T extends { type: ContentTypeId }>(): SortOption<T> {
  return {
    id: 'content_type', label: 'Content Type',
    compare: (a, b) => CONTENT_TYPE_LABELS[a.type].localeCompare(CONTENT_TYPE_LABELS[b.type]) || 0,
  };
}
