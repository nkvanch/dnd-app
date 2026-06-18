// ============================================================================
// FILE: src/db/appMetaRepo.ts
// Tiny key-value store for app-level flags (one-time seeding markers, etc.).
// Backed by the app_meta table. Web-safe: no-ops / null on web.
// ============================================================================
import { Platform } from 'react-native';
import { getDb } from './db';

type AppMetaRow = { key: string; value: string };

/** Read a meta value by key. Returns null if unset (or on web). */
export async function getMeta(key: string): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  const db  = getDb();
  const row = await db.getFirstAsync<AppMetaRow>(
    'SELECT key, value FROM app_meta WHERE key = ?',
    [key]
  );
  return row?.value ?? null;
}

/** Upsert a meta value. No-op on web. */
export async function setMeta(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') return;
  const db = getDb();
  await db.runAsync(
    `INSERT INTO app_meta (key, value)
     VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value]
  );
}
