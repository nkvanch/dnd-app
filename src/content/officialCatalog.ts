// src/content/officialCatalog.ts
// The data behind Compendium → Official: built-in/official content ONLY.
//
// Nothing in this module reads the homebrew store, so a user's Homebrew can
// never appear in Official mode — not as a row, not as an override of an
// official entry that shares its id (the merged content DB's "homebrew wins
// by id" rule deliberately does NOT apply here), and not through search.
// User Homebrew lives in Compendium → Homebrew (HomebrewLibraryView).
//
// SRD-only exposure is unchanged: the per-row exposure decision
// (isContentExposed) is still applied by the Official view on top of these
// lists, so broader official content stays hidden in an SRD-only build.
import type { Background, CharClass, Condition, Feat, Race, RulesetId } from '../engine/types';
import { matchesRuleset } from '../engine/types';
import { globalContentDB } from './classes/library';
import { mergeSpellIndex, mergeItemIndex, mergeMonsterIndex } from './contentResolution';
import { subclassEntriesForClassMerged, SubclassEntry } from './subclasses/subclassBrowse';

const inRuleset = <T extends { rulesetId?: RulesetId }>(arr: readonly T[], activeRuleset?: RulesetId): T[] =>
  arr.filter(x => matchesRuleset(x.rulesetId, activeRuleset));

export type OfficialContentDB = {
  races: Race[]; classes: CharClass[]; backgrounds: Background[]; feats: Feat[]; conditions: Condition[];
};

/** Official races/classes/backgrounds/feats/conditions, filtered by the active ruleset. Never includes homebrew. */
export function officialContentDB(activeRuleset?: RulesetId): OfficialContentDB {
  return {
    races:       inRuleset(globalContentDB.races, activeRuleset),
    classes:     inRuleset(globalContentDB.classes, activeRuleset),
    backgrounds: inRuleset(globalContentDB.backgrounds, activeRuleset),
    feats:       inRuleset(globalContentDB.feats ?? [], activeRuleset),
    conditions:  inRuleset(globalContentDB.conditions, activeRuleset),
  };
}

/** Official spell index (spellRepo-backed). */
export const officialSpellIndex = (activeRuleset?: RulesetId) => mergeSpellIndex([], activeRuleset);
/** Official item index (itemRepo-backed). */
export const officialItemIndex = (activeRuleset?: RulesetId) => mergeItemIndex([], activeRuleset);
/** Official monster templates. */
export const officialMonsterTemplates = (activeRuleset?: RulesetId) => mergeMonsterIndex([], activeRuleset);

/** Official subclasses for the given (official) classes. */
export function officialSubclassEntries(classes: readonly { id: string }[]): SubclassEntry[] {
  return classes.flatMap(c => subclassEntriesForClassMerged(c.id, []));
}
