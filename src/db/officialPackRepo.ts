// ============================================================================
// FILE: src/db/officialPackRepo.ts
// Storage for installed first-party content packs (the SRD packs). The whole pack file is one JSON row, because it is
// read as a unit at boot. No-op on web, where there is no SQLite (the same as the homebrew pack registry).
// ============================================================================
import { Platform } from 'react-native';
import { getDb } from './db';

export type StoredOfficialPack = { id: string; version: string; importedAt: number; pack: unknown };

export async function saveOfficialPack(id: string, version: string, pack: unknown): Promise<void> {
  if (Platform.OS === 'web') return;
  await getDb().runAsync(
    'INSERT OR REPLACE INTO official_packs (id, version, importedAt, data) VALUES (?, ?, ?, ?)',
    [id, version, Date.now(), JSON.stringify(pack)],
  );
}

/** Every stored pack, oldest first (so a pack stored before the one that depends on it comes first). */
export async function loadOfficialPacks(): Promise<StoredOfficialPack[]> {
  if (Platform.OS === 'web') return [];
  const rows = await getDb().getAllAsync<{ id: string; version: string; importedAt: number; data: string }>(
    'SELECT id, version, importedAt, data FROM official_packs ORDER BY importedAt ASC',
  );
  const out: StoredOfficialPack[] = [];
  for (const r of rows) {
    try { out.push({ id: r.id, version: r.version, importedAt: r.importedAt, pack: JSON.parse(r.data) }); }
    catch (e) { console.error(`[officialPackRepo] Skipping unreadable pack "${r.id}":`, e); }
  }
  return out;
}

export async function deleteOfficialPack(id: string): Promise<void> {
  if (Platform.OS === 'web') return;
  await getDb().runAsync('DELETE FROM official_packs WHERE id = ?', [id]);
}
