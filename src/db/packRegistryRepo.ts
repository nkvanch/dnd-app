// ============================================================================
// FILE: src/db/packRegistryRepo.ts
// A-36 foundations: tracks which homebrew items arrived together as one
// imported content-pack (see installed_packs in schema.ts), so a shared
// pack can be seen and removed as a group instead of only item-by-item.
// Deliberately NOT a full pack system — no version/dependency/priority
// tracking, since nothing produces or consumes those yet. 'backup' type
// imports (a user restoring their OWN device) are never registered here —
// only 'content-pack' imports (content brought in from elsewhere) are.
// ============================================================================
import { Platform } from 'react-native';
import { ContentCacheType } from './contentCacheRepo';
import { getDb } from './db';

export type PackItemRef = { type: ContentCacheType; id: string };

export type InstalledPack = {
  id:         string;
  name:       string;
  importedAt: number;
  itemRefs:   PackItemRef[];
  /** HOMEBREW-PACKAGE-1 item 15: package provenance — the author-set
   *  version string / author name from the .grimoire-pack file, if
   *  present. Provenance only, never used as content identity (stable
   *  content ids are the itemRefs themselves). */
  packageVersion?: string;
  author?:         string;
};

type InstalledPackRow = {
  id:             string;
  name:           string;
  importedAt:     number;
  itemRefs:       string;
  packageVersion: string | null;
  author:         string | null;
};

/** Records a freshly-imported content-pack. No-op on web (no SQLite there). */
export async function recordInstalledPack(
  id:       string,
  name:     string,
  itemRefs: PackItemRef[],
  meta?:    { packageVersion?: string; author?: string },
): Promise<void> {
  if (Platform.OS === 'web') return;
  const db = getDb();
  await db.runAsync(
    'INSERT OR REPLACE INTO installed_packs (id, name, importedAt, itemRefs, packageVersion, author) VALUES (?, ?, ?, ?, ?, ?)',
    [id, name, Date.now(), JSON.stringify(itemRefs), meta?.packageVersion ?? null, meta?.author ?? null],
  );
}

/** Every installed pack, newest first. Empty on web. */
export async function loadInstalledPacks(): Promise<InstalledPack[]> {
  if (Platform.OS === 'web') return [];
  const db = getDb();
  const rows = await db.getAllAsync<InstalledPackRow>(
    'SELECT * FROM installed_packs ORDER BY importedAt DESC',
  );
  return rows.map(r => ({
    id:         r.id,
    name:       r.name,
    importedAt: r.importedAt,
    itemRefs:   JSON.parse(r.itemRefs) as PackItemRef[],
    packageVersion: r.packageVersion ?? undefined,
    author:         r.author ?? undefined,
  }));
}

/**
 * PROVENANCE-1: a cached, O(1)-lookup reverse index from a content item
 * (`${type}:${id}`) to the pack that owns it — built once from
 * InstalledPack.itemRefs (the one authoritative registry of pack
 * ownership) rather than storing a `packId` directly on every content
 * item. A direct field would create two sources of truth that could drift
 * (e.g. a pack uninstalled and a same-id item re-authored locally would
 * leave a stale packId behind unless every content-mutation path
 * remembered to clear it); this index is instead recomputed from
 * `InstalledPack[]` whenever the pack list changes (callers should
 * memoize the result against their own `packs` state, the same "explicit
 * dependency array" pattern already used for getMergedContentDB() call
 * sites — see homebrewStore.ts's PERF-1 precedent) and is never persisted
 * itself, so it can never itself go stale independently of its source.
 */
export function buildPackOwnershipIndex(packs: InstalledPack[]): Map<string, { packId: string; packName: string }> {
  const index = new Map<string, { packId: string; packName: string }>();
  for (const pack of packs) {
    for (const ref of pack.itemRefs) {
      // First pack wins on a (should-be-impossible) double-claim — same
      // "don't silently overwrite, don't crash" posture as the rest of
      // this file's diagnostics.
      const key = `${ref.type}:${ref.id}`;
      if (!index.has(key)) index.set(key, { packId: pack.id, packName: pack.name });
    }
  }
  return index;
}

/** Removes a pack's registry row only — does NOT delete the content items
 *  themselves. Callers that want a full "uninstall" must separately call
 *  useHomebrewStore's deleteItem for each of the pack's itemRefs first
 *  (see app/(tabs)/homebrew.tsx's InstalledPacksPanel). Kept as two
 *  explicit steps rather than one so a user can un-track a pack (e.g. it
 *  turned out to be a mistake) without losing content they've since
 *  edited and want to keep. */
export async function deleteInstalledPack(id: string): Promise<void> {
  if (Platform.OS === 'web') return;
  const db = getDb();
  await db.runAsync('DELETE FROM installed_packs WHERE id = ?', [id]);
}
