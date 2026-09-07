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
};

type InstalledPackRow = {
  id:         string;
  name:       string;
  importedAt: number;
  itemRefs:   string;
};

/** Records a freshly-imported content-pack. No-op on web (no SQLite there). */
export async function recordInstalledPack(
  id:       string,
  name:     string,
  itemRefs: PackItemRef[],
): Promise<void> {
  if (Platform.OS === 'web') return;
  const db = getDb();
  await db.runAsync(
    'INSERT OR REPLACE INTO installed_packs (id, name, importedAt, itemRefs) VALUES (?, ?, ?, ?)',
    [id, name, Date.now(), JSON.stringify(itemRefs)],
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
  }));
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
