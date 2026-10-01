// src/content/subclasses/subclassBrowse.ts
// Browse-layer helpers for subclasses, mirroring classBrowse.ts. Subclasses use
// the same progression shape as classes (SubclassProgression extends
// ClassProgression), so the feature-list and progression-table derivations are
// the same logic pointed at a subclass's entries. Kept separate from
// classBrowse so each stays focused on its own content type.
import { Feature, HomebrewSubclass, RulesetId, matchesRuleset } from '../../engine/types';
import { SubclassProgression, getSubclassesForClass } from './index';
import { SortOption, nameSortOptions, sourceSortOption, sortByOption } from '../contentQuery';
import { getContentProvenance } from '../provenance';

/** A subclass paired with a stable id derived from its feature sources. */
export type SubclassEntry = {
  id:           string;   // e.g. 'thief' — the source.refId its features carry
  name:         string;   // e.g. 'Thief'
  classId:      string;
  progression:  SubclassProgression;
  unlockLevel:  number;   // earliest level the subclass grants anything
  blurb:        string;   // short description from the first feature, trimmed
  /** LIVE-RULESET-3 (item 4): which ruleset this subclass belongs to —
   *  ClassProgression.rulesetId (already a real field, see engine/types.ts)
   *  carried through onto the browse-shaped entry so callers don't need to
   *  reach back into `.progression.rulesetId` themselves. Undefined =
   *  available under every ruleset — true of every official subclass in
   *  this app's content library today (see subclassEntriesForClassMerged's
   *  own doc comment for why none are tagged). */
  rulesetId?:   RulesetId;
};

/**
 * Subclass progressions have no top-level id; their identity lives in the
 * source.refId every granted feature carries (e.g. 'thief'). Recover it, with a
 * name-slug fallback for any subclass whose features omit a refId.
 */
export function deriveSubclassId(sub: SubclassProgression): string {
  for (const entry of sub.entries) {
    for (const grant of entry.grants) {
      if (grant.kind === 'feature') {
        const f = grant.value as Feature;
        if (f?.source?.kind === 'subclass' && f.source.refId) return f.source.refId;
      }
    }
  }
  return sub.name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
}

/** Features of a subclass paired with the level they're gained, in level order. */
export function subclassFeaturesByLevel(sub: SubclassProgression): { feature: Feature; level: number }[] {
  const seen = new Set<string>();
  const out: { feature: Feature; level: number }[] = [];
  for (const entry of sub.entries) {
    for (const grant of entry.grants) {
      if (grant.kind === 'feature') {
        const f = grant.value as Feature;
        if (f && f.id && !seen.has(f.id)) {
          seen.add(f.id);
          out.push({ feature: f, level: entry.level });
        }
      }
    }
  }
  return out.sort((a, b) => a.level - b.level);
}

/** Level → feature names table for a subclass. */
export type SubclassRow = { level: number; features: { id: string; name: string }[] };
export function subclassProgressionTable(sub: SubclassProgression): SubclassRow[] {
  const rows: SubclassRow[] = [];
  for (const entry of sub.entries) {
    const features: { id: string; name: string }[] = [];
    for (const grant of entry.grants) {
      if (grant.kind === 'feature') {
        const f = grant.value as Feature;
        if (f?.name) features.push({ id: f.id, name: f.name });
      }
    }
    if (features.length > 0) rows.push({ level: entry.level, features });
  }
  return rows.sort((a, b) => a.level - b.level);
}

/** All subclasses for a class, shaped for the browse list. */
export function subclassEntriesForClass(classId: string): SubclassEntry[] {
  return getSubclassesForClass(classId).map(sub => {
    const byLevel = subclassFeaturesByLevel(sub);
    const first = byLevel[0]?.feature;
    const blurb = first?.description
      ? (first.description.length > 120 ? first.description.slice(0, 117) + '…' : first.description)
      : 'A subclass option.';
    return {
      id:          deriveSubclassId(sub),
      name:        sub.name,
      classId:     sub.classId,
      progression: sub,
      unlockLevel: byLevel.length > 0 ? byLevel[0].level : 3,
      blurb,
      rulesetId:   sub.rulesetId,
    };
  });
}

/** Look up a single subclass entry by classId + subclass id. */
export function getSubclassEntry(classId: string, subclassId: string): SubclassEntry | null {
  return subclassEntriesForClass(classId).find(s => s.id === subclassId) ?? null;
}

/** Shapes a homebrew subclass (explicit id, unlike official ones) as a SubclassEntry. */
function homebrewSubclassEntry(sub: HomebrewSubclass): SubclassEntry {
  const byLevel = subclassFeaturesByLevel(sub);
  const first = byLevel[0]?.feature;
  const blurb = first?.description
    ? (first.description.length > 120 ? first.description.slice(0, 117) + '…' : first.description)
    : 'A subclass option.';
  return {
    id: sub.id, name: sub.name, classId: sub.classId, progression: sub,
    unlockLevel: byLevel.length > 0 ? byLevel[0].level : 3,
    blurb,
    rulesetId: sub.rulesetId,
  };
}

/**
 * Official + homebrew subclasses for a class, shaped for the browse list.
 * Makes homebrew subclasses (see app/homebrew/subclass-builder.tsx) appear
 * alongside official ones in class-detail.tsx / subclass-detail.tsx — AND
 * this same function is what src/components/SubclassPicker.tsx calls to
 * resolve a real 'subclass' pending choice (leveling.ts's subclass_unlock
 * case), so subclass SELECTION is wired too, for creation, level-up, and
 * live editing alike. (Corrected stale claim: an earlier version of this
 * comment said selection wasn't wired — that was true before SubclassPicker
 * was built, and was left uncorrected long enough to mislead a later
 * session into re-investigating an already-closed gap. If you're about to
 * treat "homebrew subclass selection" as broken, verify against
 * SubclassPicker.tsx directly first, not just this comment.)
 *
 * LIVE-RULESET-3 (item 4): optional `activeRuleset` filters BOTH official
 * and homebrew entries via matchesRuleset — the same "untagged = shared"
 * rule every other content pool uses (getMergedContentDB's races/classes/
 * backgrounds/conditions/feats, mergeSpellIndex/mergeItemIndex). Omitted =
 * no filter, today's exact pre-existing behavior. As of this change every
 * OFFICIAL subclass in this app's content library is genuinely untagged
 * (confirmed: no subclass content here has ever been authored as a
 * 2024-specific revision — the 2024 PHB's subclass write-ups are light
 * reprints of the 2014 ones for every class this app models), so this
 * filter is real, tested machinery with no current official-content
 * consequence — homebrew subclasses tagged via app/homebrew/
 * subclass-builder.tsx are the first real consumer. Fabricating a
 * "2024-only" tag on an unchanged official subclass, purely to have a
 * visible official example, would be asserting something factually untrue
 * about the content — deliberately not done; see the completion report.
 */
export function subclassEntriesForClassMerged(classId: string, homebrew: HomebrewSubclass[], activeRuleset?: RulesetId): SubclassEntry[] {
  // Bug fix (architecture review C1): this used to plain-concatenate with
  // no dedup — official first, homebrew appended after, so a homebrew
  // subclass sharing a derived id with an official one (a realistic
  // collision: both derive/author ids by slugifying the subclass name,
  // e.g. a homebrew "Thief" reimagining) showed as two entries, and any
  // id-keyed lookup (.find()) always resolved to the official one — the
  // opposite of the homebrew-wins precedence used everywhere else in this
  // app (contentResolution.ts's mergeSpellIndex/mergeItemIndex, etc.).
  const homebrewInScope = homebrew.filter(s => s.classId === classId && matchesRuleset(s.rulesetId, activeRuleset));
  const homebrewEntries = homebrewInScope.map(homebrewSubclassEntry);
  const homebrewIds = new Set(homebrewEntries.map(s => s.id));
  const officialEntries = subclassEntriesForClass(classId)
    .filter(s => !homebrewIds.has(s.id) && matchesRuleset(s.rulesetId, activeRuleset));
  return [...officialEntries, ...homebrewEntries];
}

/**
 * The noun the UI uses for one subclass of `classId`: a homebrew subclass's own
 * displayLabel, else the class's subclassLabel, else "Subclass". Shared by
 * every picker so a class that calls them "Bound Spirits" never shows
 * "Subclass" anywhere.
 */
export function subclassLabelFor(
  classId: string | null | undefined, homebrew: HomebrewSubclass[], classes: readonly { id: string; subclassLabel?: string }[] = [],
): string {
  if (!classId) return 'Subclass';
  const own = homebrew.find(s => s.classId === classId && s.displayLabel)?.displayLabel;
  return own ?? classes.find(c => c.id === classId)?.subclassLabel ?? 'Subclass';
}

/** Look up a single subclass entry (official or homebrew) by classId + subclass id. */
export function getSubclassEntryMerged(classId: string, subclassId: string, homebrew: HomebrewSubclass[], activeRuleset?: RulesetId): SubclassEntry | null {
  return subclassEntriesForClassMerged(classId, homebrew, activeRuleset).find(s => s.id === subclassId) ?? null;
}

// ── SHARED-QUERY-1: "What it adds" filter — real, derived from the
// subclass's own granted features, not a fabricated taxonomy. Reused by
// both class-detail.tsx's subclass picker and the Compendium. ──────────────
export type SubclassAddition = 'spellcasting' | 'expands_spell_list' | 'armor_prof' | 'weapon_prof' | 'skill_prof' | 'tool_prof';

export function subclassAdditions(sub: SubclassProgression): Set<SubclassAddition> {
  const out = new Set<SubclassAddition>();
  // 'init_spellcasting' is a Grant kind (leveling.ts), not a Feature Effect
  // — scanned directly off each level entry's grants, alongside the
  // Effect-level scan below for everything else.
  for (const entry of sub.entries) {
    if (entry.grants.some(g => g.kind === 'init_spellcasting')) out.add('spellcasting');
  }
  for (const { feature } of subclassFeaturesByLevel(sub)) {
    for (const effect of feature.effects) {
      if (effect.type === 'grant_spell') out.add('spellcasting');
      if (effect.type === 'grant_proficiency') {
        if (effect.target.startsWith('armor:')) out.add('armor_prof');
        else if (effect.target.startsWith('weapon:')) out.add('weapon_prof');
        else if (effect.target.startsWith('skill:')) out.add('skill_prof');
        else if (effect.target.startsWith('tool:')) out.add('tool_prof');
      }
    }
    // "Expands spell list" — a subclass granting known/prepared spells from
    // a list broader than its parent class's own (e.g. a Cleric domain's
    // domain spells, an Eldritch Knight/Arcane Trickster's expanded list)
    // is disclosed via the feature's own name/description containing
    // "spell list" or "domain spells" — best-effort text signal, since
    // there's no structured "expanded spell list" flag anywhere in this
    // engine; not treated as authoritative, just a browse-time hint.
    if (/expanded spell list|domain spells|spells always prepared/i.test(feature.description ?? '')) {
      out.add('expands_spell_list');
    }
  }
  return out;
}

export const SUBCLASS_ADDITION_LABELS: Record<SubclassAddition, string> = {
  spellcasting: 'Adds Spellcasting', expands_spell_list: 'Expands Spell List',
  armor_prof: 'Adds Armor Proficiency', weapon_prof: 'Adds Weapon Proficiency',
  skill_prof: 'Adds Skill Proficiency', tool_prof: 'Adds Tool Proficiency',
};

export function subclassSourceLabel(entry: SubclassEntry, isHomebrew: boolean): string | undefined {
  return getContentProvenance({ id: entry.id, srd: entry.progression.srd, rulesetId: entry.progression.rulesetId }, { isHomebrew }).sourceLabel;
}

export function subclassSortOptions(isHomebrewOf: (entry: SubclassEntry) => boolean): SortOption<SubclassEntry>[] {
  return [
    ...nameSortOptions<SubclassEntry>(),
    sourceSortOption<SubclassEntry>(e => subclassSourceLabel(e, isHomebrewOf(e))),
  ];
}

/**
 * SUBCLASS-BROWSE-1: the combined search + Official/Homebrew filter + "what
 * it adds" filter + sort composition SubclassPicker.tsx renders — pulled out
 * as a pure function (rather than left inline in the component) so it has
 * direct test coverage without needing to render RN, matching this
 * codebase's established "test pure logic, not through rendering" preference.
 */
export function filterAndSortSubclassOptions(
  options: SubclassEntry[],
  params: {
    search: string;
    officialFilter: 'all' | 'official' | 'homebrew';
    addsFilter: Set<SubclassAddition>;
    sort: string;
    isHomebrewOf: (entry: SubclassEntry) => boolean;
  },
): SubclassEntry[] {
  const sortOpts = subclassSortOptions(params.isHomebrewOf);
  const q = params.search.trim().toLowerCase();
  const filtered = options
    .filter(o => !q || o.name.toLowerCase().includes(q))
    .filter(o => params.officialFilter === 'all' || (params.officialFilter === 'homebrew') === params.isHomebrewOf(o))
    .filter(o => params.addsFilter.size === 0 || Array.from(params.addsFilter).some(a => subclassAdditions(o.progression).has(a)));
  return sortByOption(filtered, sortOpts, params.sort);
}
