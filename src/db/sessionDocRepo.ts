// ============================================================================
// FILE: src/db/sessionDocRepo.ts
// SQLite-backed KeyValueStore for the Host/DM/Player session layer
// (src/session/kv.ts defines the interface; InMemoryKv is the test double).
// Web-safe: behaves as an empty in-memory store where SQLite is unavailable.
// ============================================================================
import { Platform } from 'react-native';
import { getDb } from './db';
import { InMemoryKv, KeyValueStore } from '../session/kv';

type DocRow = { key: string; data: string };

class SqliteKv implements KeyValueStore {
  async get<T>(key: string): Promise<T | null> {
    const row = await getDb().getFirstAsync<DocRow>('SELECT key, data FROM session_docs WHERE key = ?', [key]);
    if (!row) return null;
    try {
      return JSON.parse(row.data) as T;
    } catch (e) {
      console.error(`[sessionDocRepo] malformed document ${key}:`, e);
      return null;
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    await getDb().runAsync(
      `INSERT INTO session_docs (key, data, updatedAt) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET data = excluded.data, updatedAt = excluded.updatedAt`,
      [key, JSON.stringify(value), Date.now()],
    );
  }

  async delete(key: string): Promise<void> {
    await getDb().runAsync('DELETE FROM session_docs WHERE key = ?', [key]);
  }

  async keys(prefix: string): Promise<string[]> {
    // Escape LIKE wildcards so a prefix can never match more than it names.
    const escaped = prefix.replace(/[\\%_]/g, m => `\\${m}`);
    const rows = await getDb().getAllAsync<{ key: string }>(
      "SELECT key FROM session_docs WHERE key LIKE ? ESCAPE '\\' ORDER BY key",
      [`${escaped}%`],
    );
    return rows.map(r => r.key);
  }
}

let shared: KeyValueStore | null = null;

/** The app-wide session document store. */
export function getSessionKv(): KeyValueStore {
  if (!shared) shared = Platform.OS === 'web' ? new InMemoryKv() : new SqliteKv();
  return shared;
}

/** For tests: swap the shared store. */
export function setSessionKvForTests(kv: KeyValueStore | null): void {
  shared = kv;
}
