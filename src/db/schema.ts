// ============================================================================
// FILE: src/db/schema.ts
// SQLite table definitions for the D&D companion app.
//
// Design principle: store full JSON blobs for complex types (Entity, Campaign).
// This avoids painful schema migrations when the domain model evolves.
// Only index columns that are actually queried in WHERE clauses.
// ============================================================================

export const CREATE_ENTITIES_TABLE = `
  CREATE TABLE IF NOT EXISTS entities (
    id        TEXT PRIMARY KEY NOT NULL,
    kind      TEXT NOT NULL DEFAULT 'character',
    data      TEXT NOT NULL,
    updatedAt INTEGER NOT NULL
  );
`;

export const CREATE_CAMPAIGNS_TABLE = `
  CREATE TABLE IF NOT EXISTS campaigns (
    id        TEXT PRIMARY KEY NOT NULL,
    data      TEXT NOT NULL,
    updatedAt INTEGER NOT NULL
  );
`;

// applied is stored as 0/1 (SQLite has no native BOOLEAN)
export const CREATE_SYNC_EVENTS_TABLE = `
  CREATE TABLE IF NOT EXISTS sync_events (
    id             TEXT PRIMARY KEY NOT NULL,
    sessionId      TEXT NOT NULL,
    entityId       TEXT NOT NULL,
    changeType     TEXT NOT NULL,
    payload        TEXT NOT NULL,
    authorDeviceId TEXT NOT NULL,
    timestamp      INTEGER NOT NULL,
    applied        INTEGER NOT NULL DEFAULT 0
  );
`;

// Singleton row — always id = 1.
export const CREATE_DEVICE_SESSION_TABLE = `
  CREATE TABLE IF NOT EXISTS device_session (
    id         INTEGER PRIMARY KEY NOT NULL DEFAULT 1,
    deviceId   TEXT NOT NULL,
    nickname   TEXT NOT NULL DEFAULT '',
    role       TEXT NOT NULL DEFAULT 'player',
    campaignId TEXT
  );
`;

export const CREATE_CONTENT_CACHE_TABLE = `
  CREATE TABLE IF NOT EXISTS content_cache (
    id      TEXT PRIMARY KEY NOT NULL,
    type    TEXT NOT NULL,
    data    TEXT NOT NULL,
    version TEXT NOT NULL DEFAULT '1'
  );
`;

// Singleton row for active combat state (id always = 1)
export const CREATE_COMBAT_STATE_TABLE = `
  CREATE TABLE IF NOT EXISTS combat_state (
    id        INTEGER PRIMARY KEY NOT NULL DEFAULT 1,
    data      TEXT NOT NULL,
    updatedAt INTEGER NOT NULL
  );
`;

// Simple key-value store for app-level flags (e.g. one-time seeding markers).
export const CREATE_APP_META_TABLE = `
  CREATE TABLE IF NOT EXISTS app_meta (
    key   TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );
`;

// Indexes for common query patterns
export const CREATE_INDEXES = `
  CREATE INDEX IF NOT EXISTS idx_entities_kind     ON entities    (kind);
  CREATE INDEX IF NOT EXISTS idx_sync_events_applied ON sync_events (applied, sessionId);
  CREATE INDEX IF NOT EXISTS idx_content_type      ON content_cache (type);
`;

export const ALL_TABLES = [
  CREATE_ENTITIES_TABLE,
  CREATE_CAMPAIGNS_TABLE,
  CREATE_SYNC_EVENTS_TABLE,
  CREATE_DEVICE_SESSION_TABLE,
  CREATE_CONTENT_CACHE_TABLE,
  CREATE_COMBAT_STATE_TABLE,
  CREATE_APP_META_TABLE,
  CREATE_INDEXES,
];
