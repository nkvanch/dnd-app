// ============================================================================
// FILE: src/db/contentDb.ts
// Connection management for the bundled, read-only static-content database
// (spells, and from Phase 2, items). Separate from dndapp.db (db.ts), which
// holds mutable user data — this one ships as a pre-seeded asset and is
// never written to at runtime.
//
// Call initContentDb() once on app startup, after initDb() (it uses
// appMetaRepo, which needs dndapp.db open). All content repos call
// getContentDb() to obtain the live connection.
// ============================================================================
import { Platform } from 'react-native';
import * as SQLite from 'expo-sqlite';
import { importDatabaseFromAssetAsync } from 'expo-sqlite';
import { getMeta, setMeta } from './appMetaRepo';
import { CONTENT_DB_VERSION } from '../content/contentDbVersion';

const DB_NAME        = 'content.db';
const META_KEY        = 'contentDbVersion';

let _db: SQLite.SQLiteDatabase | null = null;

/**
 * Opens (or returns the cached) content database, importing the bundled
 * asset into the writable SQLite directory on first launch or whenever the
 * bundled contentVersion (baked in at build time via
 * scripts/generate-content-db.mjs) differs from what's already installed —
 * i.e. after an app update that ships new spell content.
 */
export async function initContentDb(): Promise<SQLite.SQLiteDatabase | null> {
  if (Platform.OS === 'web') return null;
  if (_db) return _db;

  const installedVersion = await getMeta(META_KEY);
  const needsImport = installedVersion !== CONTENT_DB_VERSION;

  if (needsImport) {
    await importDatabaseFromAssetAsync(
      DB_NAME,
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      { assetId: require('../../assets/content.db'), forceOverwrite: true },
    );
  }

  _db = await SQLite.openDatabaseAsync(DB_NAME);

  if (needsImport) {
    await setMeta(META_KEY, CONTENT_DB_VERSION);
  }

  return _db;
}

/** Returns the live content database instance. Throws if not initialized. */
export function getContentDb(): SQLite.SQLiteDatabase {
  if (Platform.OS === 'web') {
    throw new Error('Content SQLite DB is not available on web.');
  }
  if (!_db) {
    throw new Error('Content DB not initialized. Call initContentDb() before using any content repo.');
  }
  return _db;
}
