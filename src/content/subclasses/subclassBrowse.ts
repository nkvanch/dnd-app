// src/content/subclasses/subclassBrowse.ts
// Browse-layer helpers for subclasses, mirroring classBrowse.ts. Subclasses use
// the same progression shape as classes (SubclassProgression extends
// ClassProgression), so the feature-list and progression-table derivations are
// the same logic pointed at a subclass's entries. Kept separate from
// classBrowse so each stays focused on its own content type.
import { Feature } from '../../engine/types';
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
