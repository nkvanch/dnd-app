// src/content/subclasses/subclassBrowse.ts
// Browse-layer helpers for subclasses, mirroring classBrowse.ts. Subclasses use
// the same progression shape as classes (SubclassProgression extends
// ClassProgression), so the feature-list and progression-table derivations are
// the same logic pointed at a subclass's entries. Kept separate from
// classBrowse so each stays focused on its own content type.
import { Feature, HomebrewSubclass } from '../../engine/types';
import { SubclassProgression, getSubclassesForClass } from './index';

/** A subclass paired with a stable id derived from its feature sources. */
export type SubclassEntry = {
  id:           string;   // e.g. 'thief' — the source.refId its features carry
  name:         string;   // e.g. 'Thief'
  classId:      string;
  progression:  SubclassProgression;
  unlockLevel:  number;   // earliest level the subclass grants anything
  blurb:        string;   // short description from the first feature, trimmed
};

/**
 * Subclass progressions have no top-level id; their identity lives in the
 * source.refId every granted feature carries (e.g. 'thief'). Recover it, with a
 * name-slug fallback for any subclass whose features omit a refId.
 */
function deriveSubclassId(sub: SubclassProgression): string {
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
  };
}

/**
 * Official + homebrew subclasses for a class, shaped for the browse list.
 * Makes homebrew subclasses (see app/homebrew/subclass-builder.tsx) appear
 * alongside official ones in class-detail.tsx / subclass-detail.tsx. Doesn't
 * wire subclass SELECTION (see the subclass_unlock choice in leveling.ts) —
 * that's a separate, already-tracked gap that predates homebrew subclasses.
 */
export function subclassEntriesForClassMerged(classId: string, homebrew: HomebrewSubclass[]): SubclassEntry[] {
  // Bug fix (architecture review C1): this used to plain-concatenate with
  // no dedup — official first, homebrew appended after, so a homebrew
  // subclass sharing a derived id with an official one (a realistic
  // collision: both derive/author ids by slugifying the subclass name,
  // e.g. a homebrew "Thief" reimagining) showed as two entries, and any
  // id-keyed lookup (.find()) always resolved to the official one — the
  // opposite of the homebrew-wins precedence used everywhere else in this
  // app (contentResolution.ts's mergeSpellIndex/mergeItemIndex, etc.).
  const homebrewEntries = homebrew.filter(s => s.classId === classId).map(homebrewSubclassEntry);
  const homebrewIds = new Set(homebrewEntries.map(s => s.id));
  const officialEntries = subclassEntriesForClass(classId).filter(s => !homebrewIds.has(s.id));
  return [...officialEntries, ...homebrewEntries];
}

/** Look up a single subclass entry (official or homebrew) by classId + subclass id. */
export function getSubclassEntryMerged(classId: string, subclassId: string, homebrew: HomebrewSubclass[]): SubclassEntry | null {
  return subclassEntriesForClassMerged(classId, homebrew).find(s => s.id === subclassId) ?? null;
}
