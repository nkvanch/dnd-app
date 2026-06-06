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
