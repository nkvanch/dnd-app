// src/content/homebrewLibrary.ts
// Pure model behind Compendium → Homebrew (the Homebrew LIBRARY). Extracted
// unchanged in behavior from the old Library panel on the Homebrew tab so it
// can be unit-tested and reused; creation flows are not part of this module.
import type { ContentCacheType, HomebrewContent } from '../db/contentCacheRepo';
import type { HomebrewArrays } from '../store/homebrewLookup';
import { getContentProvenance } from './provenance';
import type { SortOption } from './contentQuery';

export type LibraryEntry = { type: ContentCacheType; item: HomebrewContent; parentName?: string };

/** Where each content type is edited (the builders still live under the Homebrew tab's Create flow). */
export const EDIT_ROUTES: Partial<Record<ContentCacheType, string>> = {
  race: '/homebrew/race-builder',
  subrace: '/homebrew/subrace-builder',
  class: '/homebrew/class-builder',
  subclass: '/homebrew/subclass-builder',
  item: '/homebrew/item-builder',
  spell: '/homebrew/spell-builder',
  background: '/homebrew/background-builder',
  feature: '/homebrew/feature-editor',
  feat: '/homebrew/feat-builder',
  monster: '/homebrew/monster-builder',
  condition: '/homebrew/condition-builder',
};

export function editHrefFor(type: ContentCacheType, id: string): string | null {
  const route = EDIT_ROUTES[type];
  return route ? `${route}?editId=${id}` : null;
}

export const LIBRARY_CATEGORIES: { id: ContentCacheType | 'all'; label: string }[] = [
  { id: 'all',        label: 'All' },
  { id: 'race',       label: 'Races' },
  { id: 'subrace',    label: 'Subraces' },
  { id: 'class',      label: 'Classes' },
  { id: 'subclass',   label: 'Subclasses' },
  { id: 'background', label: 'Backgrounds' },
  { id: 'item',       label: 'Items' },
  { id: 'spell',      label: 'Spells' },
  { id: 'feature',    label: 'Features' },
  { id: 'feat',       label: 'Feats' },
  { id: 'monster',    label: 'Monsters' },
  { id: 'condition',  label: 'Conditions' },
];

/** Homebrew-only entries: every array comes straight from the homebrew store, never official content. */
export function buildLibraryEntries(
  hb: HomebrewArrays,
  allRaces: { id: string; name: string }[],
  allClasses: { id: string; name: string }[],
): LibraryEntry[] {
  return [
    ...hb.races.map(item => ({ type: 'race' as const, item })),
    ...hb.subraces.map(item => ({
      type: 'subrace' as const, item,
      parentName: allRaces.find(r => r.id === (item as { parentId: string }).parentId)?.name,
    })),
    ...hb.classes.map(item => ({ type: 'class' as const, item })),
    ...hb.subclasses.map(item => ({
      type: 'subclass' as const, item,
      parentName: allClasses.find(c => c.id === (item as { classId: string }).classId)?.name,
    })),
    ...hb.items.map(item => ({ type: 'item' as const, item })),
    ...hb.spells.map(item => ({ type: 'spell' as const, item })),
    ...hb.backgrounds.map(item => ({ type: 'background' as const, item })),
    ...hb.features.map(item => ({ type: 'feature' as const, item })),
    ...hb.feats.map(item => ({ type: 'feat' as const, item })),
    ...hb.monsters.map(item => ({ type: 'monster' as const, item })),
    ...hb.conditions.map(item => ({ type: 'condition' as const, item })),
  ];
}

export function rulesetIdOf(item: unknown): string | undefined {
  return (item && typeof item === 'object' && 'rulesetId' in item) ? (item as { rulesetId?: string }).rulesetId : undefined;
}

export type PackOwnershipIndex = Map<string, { packId: string; packName: string }>;

export type LibraryFilter = {
  search: string;
  category: ContentCacheType | 'all';
  ruleset: string | null;
  /** 'all' | 'local' (authored here) | an installed pack's id */
  source: 'all' | 'local' | string;
  packOwnership: PackOwnershipIndex;
};

export const DEFAULT_LIBRARY_FILTER: Omit<LibraryFilter, 'packOwnership'> = {
  search: '', category: 'all', ruleset: null, source: 'all',
};

export function provenanceOfEntry(entry: LibraryEntry, packOwnership: PackOwnershipIndex) {
  const { type, item } = entry;
  // Feature.source is a FeatureSource OBJECT (mechanical provenance), not the
  // free-text sourcebook string every other type's `.source` means — narrow it out.
  const raw = (item as { source?: unknown }).source;
  const itemForProvenance = { ...item, source: typeof raw === 'string' ? raw : undefined };
  return getContentProvenance(itemForProvenance, { isHomebrew: true, packOwnership, ownershipKey: `${type}:${item.id}` });
}

export function filterLibraryEntries(entries: LibraryEntry[], f: LibraryFilter): LibraryEntry[] {
  const q = f.search.trim().toLowerCase();
  return entries.filter(entry => {
    if (f.category !== 'all' && entry.type !== f.category) return false;
    if (q && !entry.item.name.toLowerCase().includes(q)) return false;
    if (f.ruleset && rulesetIdOf(entry.item) !== f.ruleset) return false;
    if (f.source !== 'all') {
      const prov = provenanceOfEntry(entry, f.packOwnership);
      if (f.source === 'local' ? prov.originKind !== 'local_homebrew' : prov.packId !== f.source) return false;
    }
    return true;
  });
}

export function libraryRulesets(entries: LibraryEntry[]): string[] {
  return Array.from(new Set(entries.map(e => rulesetIdOf(e.item)).filter((r): r is string => !!r))).sort();
}

const TYPE_ORDER = LIBRARY_CATEGORIES.map(c => c.id as string);

export const LIBRARY_SORT_OPTIONS: SortOption<LibraryEntry>[] = [
  { id: 'name_asc',  label: 'A–Z', compare: (a, b) => a.item.name.localeCompare(b.item.name) },
  { id: 'name_desc', label: 'Z–A', compare: (a, b) => b.item.name.localeCompare(a.item.name) },
  {
    id: 'type', label: 'Type',
    compare: (a, b) => (TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type)) || a.item.name.localeCompare(b.item.name),
  },
];

/** Short human-readable origin line for a row: "Local Homebrew" or the installed pack's name. */
export function originLabel(entry: LibraryEntry, packOwnership: PackOwnershipIndex): string {
  const prov = provenanceOfEntry(entry, packOwnership);
  return prov.originKind === 'imported_homebrew' ? `Pack: ${prov.packLabel ?? prov.packId ?? 'unknown'}` : 'Local Homebrew';
}

/** Free-text description of an entry for the expanded row, if the type carries one. */
export function descriptionOf(entry: LibraryEntry): string | undefined {
  const d = (entry.item as { description?: unknown }).description;
  return typeof d === 'string' && d.trim() ? d.trim() : undefined;
}
