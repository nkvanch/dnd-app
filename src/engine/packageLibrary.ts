// src/engine/packageLibrary.ts
// Pure model behind Compendium → Packages (the INSTALLED PACKAGES library).
//
// What the data model actually supports today: `installed_packs`
// (src/db/packRegistryRepo.ts) only ever registers imported CONTENT packs —
// 'backup' imports (a user restoring their own device, characters included)
// are deliberately never registered. So every InstalledPack is a content
// pack, and `packageKindOf` reports exactly that. The kind union exists so a
// new registered package type has one obvious place to be added; nothing here
// invents semantics for types the registry does not record.
import type { ContentCacheType, HomebrewContent } from '../db/contentCacheRepo';
import type { InstalledPack } from '../db/packRegistryRepo';
import { collectContentDependencies, DependencyRef } from './contentDependencies';
import type { Issue } from './types';
import type { SortOption } from '../content/contentQuery';

export type PackageKind = 'content';

export const PACKAGE_KIND_LABELS: Record<PackageKind, string> = {
  content: 'Content Pack',
};

export function packageKindOf(_pack: InstalledPack): PackageKind {
  return 'content';
}

export const CONTENT_TYPE_PLURALS: Record<ContentCacheType, [string, string]> = {
  race: ['race', 'races'], subrace: ['subrace', 'subraces'], class: ['class', 'classes'],
  subclass: ['subclass', 'subclasses'], spell: ['spell', 'spells'], background: ['background', 'backgrounds'],
  feature: ['feature', 'features'], item: ['item', 'items'], feat: ['feat', 'feats'],
  monster: ['monster', 'monsters'], condition: ['condition', 'conditions'],
};

export const CONTENT_TYPE_ORDER: ContentCacheType[] = [
  'race', 'subrace', 'class', 'subclass', 'background', 'feat', 'spell', 'item', 'feature', 'monster', 'condition',
];

export type CompositionPart = { type: ContentCacheType; count: number };

/** Per-type counts of what a pack installed, in a stable display order. */
export function summarizeComposition(pack: Pick<InstalledPack, 'itemRefs'>): CompositionPart[] {
  const counts = new Map<ContentCacheType, number>();
  for (const ref of pack.itemRefs) counts.set(ref.type, (counts.get(ref.type) ?? 0) + 1);
  return CONTENT_TYPE_ORDER.filter(t => counts.has(t)).map(t => ({ type: t, count: counts.get(t)! }));
}

/** "2 spells · 1 race" */
export function compositionLabel(pack: Pick<InstalledPack, 'itemRefs'>): string {
  return summarizeComposition(pack)
    .map(({ type, count }) => `${count} ${CONTENT_TYPE_PLURALS[type][count === 1 ? 0 : 1]}`)
    .join(' · ');
}

export type PackageStatus = 'ok' | 'warning' | 'error';

export const PACKAGE_STATUS_LABELS: Record<PackageStatus, string> = {
  ok: 'OK', warning: 'Warnings', error: 'Errors',
};

export function packageStatusOf(issues: readonly Pick<Issue, 'severity'>[]): PackageStatus {
  if (issues.some(i => i.severity === 'error')) return 'error';
  return issues.length > 0 ? 'warning' : 'ok';
}

export type PackageFilter = {
  search: string;
  kind: PackageKind | 'all';
  status: PackageStatus | 'all';
};

export const DEFAULT_PACKAGE_FILTER: PackageFilter = { search: '', kind: 'all', status: 'all' };

export function filterPackages(
  packs: InstalledPack[],
  f: PackageFilter,
  statusOf: (pack: InstalledPack) => PackageStatus,
): InstalledPack[] {
  const q = f.search.trim().toLowerCase();
  return packs.filter(p => {
    if (q && !`${p.name} ${p.author ?? ''}`.toLowerCase().includes(q)) return false;
    if (f.kind !== 'all' && packageKindOf(p) !== f.kind) return false;
    if (f.status !== 'all' && statusOf(p) !== f.status) return false;
    return true;
  });
}

export const PACKAGE_SORT_OPTIONS: SortOption<InstalledPack>[] = [
  { id: 'newest', label: 'Newest', compare: (a, b) => b.importedAt - a.importedAt },
  { id: 'oldest', label: 'Oldest', compare: (a, b) => a.importedAt - b.importedAt },
  { id: 'name',   label: 'A–Z',    compare: (a, b) => a.name.localeCompare(b.name) },
  { id: 'size',   label: 'Most entries', compare: (a, b) => b.itemRefs.length - a.itemRefs.length || a.name.localeCompare(b.name) },
];

export type PackDetailEntry = { type: ContentCacheType; id: string; name: string; missing: boolean; included?: 'selected' | 'dependency' };
export type PackDetailGroup = { type: ContentCacheType; entries: PackDetailEntry[] };
export type PackDetail = {
  kind: PackageKind;
  rulesets: string[];
  /** What the pack installed, grouped by content type; names resolve to the CURRENT name (a renamed entry shows its new name). */
  groups: PackDetailGroup[];
  /** Content the pack's entries depend on that the pack itself doesn't own. */
  externalDeps: { type: ContentCacheType; id: string; name: string; missing: boolean }[];
  missingCount: number;
};

export function buildPackDetail(
  pack: InstalledPack,
  lookup: (ref: DependencyRef) => HomebrewContent | undefined,
): PackDetail {
  const rulesetSet = new Set<string>();
  const ownedKeys = new Set(pack.itemRefs.map(r => `${r.type}:${r.id}`));
  const deps = new Map<string, PackDetail['externalDeps'][number]>();
  const byType = new Map<ContentCacheType, PackDetailEntry[]>();
  let missingCount = 0;

  for (const ref of pack.itemRefs) {
    const item = lookup({ type: ref.type, id: ref.id });
    const list = byType.get(ref.type) ?? [];
    list.push({ type: ref.type, id: ref.id, name: item?.name ?? ref.id, missing: !item, included: ref.included });
    byType.set(ref.type, list);
    if (!item) { missingCount++; continue; }
    const rid = (item as { rulesetId?: string }).rulesetId;
    if (rid) rulesetSet.add(rid);
    for (const dep of collectContentDependencies(ref.type, item)) {
      const key = `${dep.type}:${dep.id}`;
      if (ownedKeys.has(key) || deps.has(key)) continue;
      const depItem = lookup(dep);
      deps.set(key, { type: dep.type, id: dep.id, name: depItem?.name ?? dep.id, missing: !depItem });
    }
  }

  return {
    kind: packageKindOf(pack),
    rulesets: Array.from(rulesetSet),
    groups: CONTENT_TYPE_ORDER.filter(t => byType.has(t)).map(t => ({
      type: t,
      entries: byType.get(t)!.sort((a, b) => a.name.localeCompare(b.name)),
    })),
    externalDeps: Array.from(deps.values()),
    missingCount,
  };
}
