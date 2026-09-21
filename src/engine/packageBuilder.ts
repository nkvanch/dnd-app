// src/engine/packageBuilder.ts
// Pure model for the two Homebrew export flows and the import preview:
//
//   Export Homebrew (single)  -> ONE explicitly chosen entry + the content it
//                                genuinely requires
//   Export Package (multi)    -> MANY explicitly chosen entries + what they
//                                require, one .grimoire-pack file
//
// Both use the same envelope (createPackageContentPack), the same dependency
// closure (contentDependencies.ts) and the same manifest (`contents`, where
// each entry is tagged 'selected' or 'dependency'), so there is a single
// import path and the file always says which entries the author picked and
// which were pulled in automatically.
//
// Deliberately NOT here: Character export. A character is its own portable
// format (io/characterPortable.ts). A future "character + homebrew" package
// would add a `characters` selection to this model; the plan/payload shapes
// below keep explicit selection, automatic dependencies and the manifest as
// separate concepts so that extension doesn't require restructuring them.
import { ContentCacheType, HomebrewContent } from '../db/contentCacheRepo';
import {
  buildDependencyClosure, collectContentDependencies, DependencyRef, ResolvedContentRef,
} from './contentDependencies';
import {
  GrimoirePack, GrimoirePackHomebrew, PackageContentRef, PackageMeta, createPackageContentPack,
} from './backup';

export type PackageLookup = (ref: DependencyRef) => (HomebrewContent & { rulesetId?: string }) | undefined;

/** Which GrimoirePackHomebrew array each portable content type lives in. */
export const PACKAGE_CATEGORY_KEY: Record<ContentCacheType, keyof GrimoirePackHomebrew> = {
  race: 'races', subrace: 'subraces', class: 'classes', subclass: 'subclasses',
  spell: 'spells', background: 'backgrounds', feature: 'features', item: 'items',
  feat: 'feats', monster: 'monsters', condition: 'conditions',
};

/** Every content type a package can carry (the taxonomy the pack format itself supports). */
export const PACKAGE_CONTENT_TYPES = Object.keys(PACKAGE_CATEGORY_KEY) as ContentCacheType[];

export const PACKAGE_TYPE_ORDER: ContentCacheType[] = [
  'race', 'subrace', 'class', 'subclass', 'background', 'feat', 'feature', 'spell', 'item', 'monster', 'condition',
];

export const PACKAGE_TYPE_LABELS: Record<ContentCacheType, [string, string]> = {
  race: ['Species', 'Species'], subrace: ['Subrace', 'Subraces'], class: ['Class', 'Classes'],
  subclass: ['Subclass', 'Subclasses'], background: ['Background', 'Backgrounds'], feat: ['Feat', 'Feats'],
  feature: ['Feature', 'Features'], spell: ['Spell', 'Spells'], item: ['Item', 'Items'],
  monster: ['Monster', 'Monsters'], condition: ['Condition', 'Conditions'],
};

export const refKey = (r: DependencyRef): string => `${r.type}:${r.id}`;

/** Same stable id appears once. First occurrence keeps its position. */
export function dedupeRefs(refs: readonly DependencyRef[]): DependencyRef[] {
  const seen = new Set<string>();
  const out: DependencyRef[] = [];
  for (const r of refs) {
    const k = refKey(r);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ type: r.type, id: r.id });
  }
  return out;
}

export function isSelected(explicit: readonly DependencyRef[], ref: DependencyRef): boolean {
  return explicit.some(r => refKey(r) === refKey(ref));
}

export function toggleRef(explicit: readonly DependencyRef[], ref: DependencyRef): DependencyRef[] {
  return isSelected(explicit, ref)
    ? explicit.filter(r => refKey(r) !== refKey(ref))
    : dedupeRefs([...explicit, ref]);
}

export function removeRef(explicit: readonly DependencyRef[], ref: DependencyRef): DependencyRef[] {
  return explicit.filter(r => refKey(r) !== refKey(ref));
}

export type PackagePlanEntry = ResolvedContentRef & {
  included: 'selected' | 'dependency';
  /** Names of the entries in the plan that directly require this one (dependencies only). */
  requiredBy: string[];
};

export type PackagePlan = {
  /** Explicitly chosen by the user, grouped order, resolved. */
  selected: PackagePlanEntry[];
  /** Pulled in automatically because something selected (transitively) requires them. */
  dependencies: PackagePlanEntry[];
  /** Referenced by the content but not found in the local Homebrew library. */
  unresolved: DependencyRef[];
  /** Explicit selections that no longer resolve to a local entry (e.g. deleted since). */
  missingSelected: DependencyRef[];
  counts: { selected: number; dependencies: number; total: number };
};

const typeRank = (t: ContentCacheType) => PACKAGE_TYPE_ORDER.indexOf(t);
const byTypeThenName = (a: { type: ContentCacheType; name: string }, b: { type: ContentCacheType; name: string }) =>
  (typeRank(a.type) - typeRank(b.type)) || a.name.localeCompare(b.name);

/**
 * The dependency closure of an explicit selection. Dependencies are always
 * DERIVED from the selection, never stored, so removing an explicit entry
 * automatically drops any dependency nothing else still requires, and an
 * entry that is BOTH selected and required stays "selected" (explicit picks win).
 */
export function computePackagePlan(explicit: readonly DependencyRef[], lookup: PackageLookup): PackagePlan {
  const refs = dedupeRefs(explicit);
  const { closure, unresolved } = buildDependencyClosure(refs, lookup);
  const missingSelected = unresolved.filter(u => refs.some(r => refKey(r) === refKey(u)));
  const presentUnresolved = unresolved.filter(u => !refs.some(r => refKey(r) === refKey(u)));

  const requiredBy = new Map<string, string[]>();
  for (const entry of closure) {
    const item = lookup(entry);
    if (!item) continue;
    for (const dep of collectContentDependencies(entry.type, item)) {
      const k = refKey(dep);
      const list = requiredBy.get(k) ?? [];
      if (!list.includes(entry.name)) list.push(entry.name);
      requiredBy.set(k, list);
    }
  }
  const toEntry = (c: (typeof closure)[number]): PackagePlanEntry => ({
    ...c, requiredBy: c.included === 'dependency' ? (requiredBy.get(refKey(c)) ?? []) : [],
  });
  const selected = closure.filter(c => c.included === 'selected').map(toEntry).sort(byTypeThenName);
  const dependencies = closure.filter(c => c.included === 'dependency').map(toEntry).sort(byTypeThenName);
  return {
    selected, dependencies,
    unresolved: presentUnresolved, missingSelected,
    counts: { selected: selected.length, dependencies: dependencies.length, total: selected.length + dependencies.length },
  };
}

/** The plan for a single entry: one primary + what it requires. */
export const computeSingleExportPlan = (ref: DependencyRef, lookup: PackageLookup): PackagePlan =>
  computePackagePlan([ref], lookup);

/** Default metadata for a single-entry export — no naming step needed to send one entry. */
export function singleExportMeta(entryName: string, author?: string): PackageMeta {
  return {
    name: entryName,
    packageVersion: '1.0',
    author: author?.trim() || undefined,
    description: undefined,
  };
}

export type PackagePayload = { homebrew: GrimoirePackHomebrew; contents: PackageContentRef[] };

/** Every entry in the plan (selected + dependencies), each exactly once, with its manifest role. */
export function buildPackagePayload(plan: PackagePlan, lookup: PackageLookup): PackagePayload {
  const homebrew: GrimoirePackHomebrew = {};
  const contents: PackageContentRef[] = [];
  const seen = new Set<string>();
  for (const entry of [...plan.selected, ...plan.dependencies]) {
    const k = refKey(entry);
    if (seen.has(k)) continue;
    const item = lookup(entry);
    if (!item) continue;
    seen.add(k);
    const key = PACKAGE_CATEGORY_KEY[entry.type];
    const list = ((homebrew[key] as HomebrewContent[] | undefined) ?? []);
    list.push(item);
    (homebrew as Record<string, HomebrewContent[]>)[key] = list;
    contents.push({
      type: entry.type, id: entry.id, name: entry.name,
      rulesetId: entry.rulesetId as PackageContentRef['rulesetId'],
      included: entry.included,
    });
  }
  return { homebrew, contents };
}

export function buildPackage(
  plan: PackagePlan, lookup: PackageLookup, meta: PackageMeta, deviceId: string | null, appVersion: string,
): GrimoirePack {
  const { homebrew, contents } = buildPackagePayload(plan, lookup);
  return createPackageContentPack(homebrew, contents, meta, deviceId, appVersion);
}

// ── Review helpers ──────────────────────────────────────────────────────────

export type TypeGroup<T extends { type: ContentCacheType }> = { type: ContentCacheType; entries: T[] };

export function groupByType<T extends { type: ContentCacheType }>(entries: readonly T[]): TypeGroup<T>[] {
  const map = new Map<ContentCacheType, T[]>();
  for (const e of entries) map.set(e.type, [...(map.get(e.type) ?? []), e]);
  return PACKAGE_TYPE_ORDER.filter(t => map.has(t)).map(t => ({ type: t, entries: map.get(t)! }));
}

export type ReviewWarning = { kind: 'unresolved' | 'missing_selected'; message: string };

/**
 * Warnings for the review step. `isOfficial` lets the caller say a reference
 * is official/base content (available on every device, so deliberately NOT
 * bundled — the existing dependency policy) instead of merely "not found".
 */
export function reviewWarnings(
  plan: PackagePlan,
  isOfficial: (ref: DependencyRef) => boolean = () => false,
): ReviewWarning[] {
  const warnings: ReviewWarning[] = [];
  for (const u of plan.missingSelected) {
    warnings.push({ kind: 'missing_selected', message: `${u.type} "${u.id}" was selected but no longer exists in your library. It will not be exported.` });
  }
  const missing = plan.unresolved.filter(u => !isOfficial(u));
  if (missing.length > 0) {
    warnings.push({
      kind: 'unresolved',
      message: `Referenced but not found locally, so it can't be bundled: ${missing.map(u => `${u.type} "${u.id}"`).join(', ')}. The exported content may be incomplete.`,
    });
  }
  return warnings;
}

/** Official/base references that are intentionally not copied into the file. */
export function externalizedReferences(plan: PackagePlan, isOfficial: (ref: DependencyRef) => boolean): DependencyRef[] {
  return plan.unresolved.filter(isOfficial);
}

// ── Import preview grouping ─────────────────────────────────────────────────

export type PreviewEntry = { type: ContentCacheType; id: string; name: string };
export type PackPreviewGroups = {
  /** What the author picked. */
  content: TypeGroup<PreviewEntry>[];
  /** What was included automatically because something requires it. */
  dependencies: TypeGroup<PreviewEntry>[];
  counts: { content: number; dependencies: number; total: number };
};

/**
 * Groups a package's contents for the import preview: the manifest when
 * present (it records selected vs dependency), otherwise every homebrew entry
 * counts as content (older packages / single-item exports without a manifest).
 */
export function groupPackContents(pack: Pick<GrimoirePack, 'contents' | 'homebrew'>): PackPreviewGroups {
  const manifest = pack.contents ?? [];
  const inPayload: PreviewEntry[] = [];
  const homebrew = pack.homebrew ?? {};
  for (const type of PACKAGE_CONTENT_TYPES) {
    const list = (homebrew[PACKAGE_CATEGORY_KEY[type]] as { id: string; name: string }[] | undefined) ?? [];
    for (const item of list) inPayload.push({ type, id: item.id, name: item.name });
  }
  const role = new Map(manifest.map(m => [`${m.type}:${m.id}`, m.included]));
  const content: PreviewEntry[] = [];
  const dependencies: PreviewEntry[] = [];
  const seen = new Set<string>();
  for (const e of inPayload) {
    const k = `${e.type}:${e.id}`;
    if (seen.has(k)) continue;
    seen.add(k);
    (role.get(k) === 'dependency' ? dependencies : content).push(e);
  }
  const sort = (a: PreviewEntry, b: PreviewEntry) => a.name.localeCompare(b.name);
  return {
    content: groupByType(content.sort(sort)),
    dependencies: groupByType(dependencies.sort(sort)),
    counts: { content: content.length, dependencies: dependencies.length, total: content.length + dependencies.length },
  };
}
