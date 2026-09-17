// ============================================================================
// FILE: src/db/db.ts
// Database initialization — singleton connection management.
//
// Call initDb() once on app startup (in app/_layout.tsx useEffect).
// All repos call getDb() to obtain the live connection.
// ============================================================================
import { Platform } from 'react-native';
import * as SQLite from 'expo-sqlite';
import { ALL_TABLES } from './schema';

let _db: SQLite.SQLiteDatabase | null = null;

/**
 * Opens (or returns the cached) database and creates all tables.
 * Safe to call multiple times — idempotent due to IF NOT EXISTS.
 */
export async function initDb(): Promise<SQLite.SQLiteDatabase | null> {
  // SQLite is not supported on web — return null, all db calls are no-ops on web.
  if (Platform.OS === 'web') return null;

  if (_db) return _db;

  _db = await SQLite.openDatabaseAsync('dndapp.db');

  // Create all tables in a single transaction for atomicity
  await _db.withTransactionAsync(async () => {
    for (const ddl of ALL_TABLES) {
      await _db!.execAsync(ddl);
    }
  });

  // HOMEBREW-PACKAGE-1 item 15: additive migration for an existing dev
  // database created before installed_packs had packageVersion/author —
  // CREATE TABLE IF NOT EXISTS above never adds columns to an already-
  // existing table. ADD COLUMN is cheap/safe (no table rewrite); the
  // try/catch swallows the "duplicate column" error a fresh (already-
  // current) table produces, matching this being the only migration
  // mechanism this app has (no schema-version tracking — see schema.ts's
  // own header comment on the JSON-blob-storage rationale).
  for (const alter of [
    'ALTER TABLE installed_packs ADD COLUMN packageVersion TEXT',
    'ALTER TABLE installed_packs ADD COLUMN author TEXT',
  ]) {
    try {
      await _db.execAsync(alter);
    } catch {
      // Column already exists — expected on every run after the first.
    }
  }

  return _db;
}

/**
 * Returns the live database instance.
 * Throws if initDb() has not been called yet.
 */
export function getDb(): SQLite.SQLiteDatabase {
  if (Platform.OS === 'web') {
    throw new Error('SQLite is not available on web.');
  }
  if (!_db) {
    throw new Error(
      'Database not initialized. Call initDb() before using any repo functions.'
    );
  }
  return _db;
}

/**
 * Closes the database connection. Call during app teardown if needed.
 * After calling this, initDb() must be called again before any DB access.
 */
export async function closeDb(): Promise<void> {
  if (_db) {
    await _db.closeAsync();
    _db = null;
  }
}
