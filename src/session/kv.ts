// ============================================================================
// FILE: src/session/kv.ts
// Minimal async key/value document store used by every persistent part of the
// session layer (DM campaign prep, DM secret vault, per-peer restart state,
// optional Host live-state snapshot). InMemoryKv is used by tests; the app
// uses the SQLite-backed implementation in src/db/sessionDocRepo.ts.
// Values are always JSON round-tripped so aliasing bugs cannot hide in tests.
// ============================================================================

export interface KeyValueStore {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  /** Keys starting with `prefix`, sorted. */
  keys(prefix: string): Promise<string[]>;
}

export class InMemoryKv implements KeyValueStore {
  private data = new Map<string, string>();

  get<T>(key: string): Promise<T | null> {
    const raw = this.data.get(key);
    return Promise.resolve(raw === undefined ? null : (JSON.parse(raw) as T));
  }
  set<T>(key: string, value: T): Promise<void> {
    this.data.set(key, JSON.stringify(value));
    return Promise.resolve();
  }
  delete(key: string): Promise<void> {
    this.data.delete(key);
    return Promise.resolve();
  }
  keys(prefix: string): Promise<string[]> {
    return Promise.resolve([...this.data.keys()].filter(k => k.startsWith(prefix)).sort());
  }
}
