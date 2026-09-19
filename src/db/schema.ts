// ============================================================================
// FILE: src/db/schema.ts
// SQLite table definitions for the D&D companion app.
//
// Design principle: store full JSON blobs for complex types (Entity, Campaign).
// This avoids painful schema migrations when the domain model evolves.
// Only index columns that are actually queried in WHERE clauses.
//
// Revisited deliberately (not by default) against an external architecture
// review's recommendation to fully normalize instead — see docs/NEW
// architecture/09-conformance-answers.md §1.1 and the plan file's B6 note.
// Kept as-is, for reasons specific to this app rather than a general
// argument against normalization:
//   - Sync already diffs at the JS-object layer (src/sync/diff.ts's
//     deepDiff/deepMerge) before anything reaches SQLite — the "row-level
//     sync is difficult with blobs" concern doesn't apply here; that
//     problem is solved one layer above the database already.
//   - A character record is ~5-30KB. Rewriting the whole blob per change
//     is not a real cost at that size, on any device this app targets.
//   - Undo doesn't need field-level granularity — whole-entity before/after
//     snapshots are the actual design (see the undo/redo track), and blob
//     storage supports that fine.
//   - Nothing in this app's real requirements needs to SQL-query INTO a
//     character's internals (no cross-character stat search, no reporting).
// The one place this reasoning does NOT apply — data with a genuinely
// different lifecycle from the character record itself, like a persistent
// mechanical timeline — gets its OWN normalized table, not a spot inside
// the entity blob. See CREATE_CHARACTER_TIMELINE_TABLE (planned) for that.
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

// Prior versions of homebrew content, archived on every edit of an existing
// item (see contentCacheRepo.ts's saveHomebrewContent). Append-only —
// restoring an old version writes a NEW current version rather than
// deleting forward history, so this table only ever gets INSERTs.
export const CREATE_CONTENT_CACHE_HISTORY_TABLE = `
  CREATE TABLE IF NOT EXISTS content_cache_history (
    historyId INTEGER PRIMARY KEY AUTOINCREMENT,
    contentId TEXT NOT NULL,
    type      TEXT NOT NULL,
    version   TEXT NOT NULL,
    data      TEXT NOT NULL,
    savedAt   INTEGER NOT NULL
  );
`;

// Persistent mechanical timeline — one row per updateCharacter() call,
// written alongside (not instead of) the session-local undo/redo stacks in
// characterStore.ts. Append-only, same pattern as content_cache_history:
// never deleted, never overwritten, newest-first query. Survives app
// restart, unlike undo/redo (session-local, cleared on reload) — that's
// the deliberate distinction between the two (see the undo/redo +
// mechanical timeline plan section's own verification note).
export const CREATE_CHARACTER_TIMELINE_TABLE = `
  CREATE TABLE IF NOT EXISTS character_timeline (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    entityId  TEXT NOT NULL,
    label     TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    category  TEXT
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

// Re-audit A09 (item 11): singleton row for the in-progress character
// creation draft, same shape as combat_state above — a full Entity blob is
// written on every setDraft() call so an app kill mid-creation (name
// chosen, race/class/scores picked, etc.) doesn't lose that progress. Only
// ever one row (id=1) since the creation flow supports exactly one active
// draft at a time (characterStore.ts's `draft: Entity | null`).
export const CREATE_CHARACTER_DRAFT_TABLE = `
  CREATE TABLE IF NOT EXISTS character_draft (
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

// DM-authored planning data — see engine/types.ts's PreparedEncounter doc
// comment. Same blob-storage shape as campaigns: a full CRUD list, no
// internal field is ever queried directly. campaignId/status ARE indexed
// (library search/filter reads them a lot), duplicated out of the blob as
// plain columns purely for that — the blob (`data`) stays the single
// source of truth; the columns are kept in sync on every write and never
// read back into the app, matching content_cache's `type` column doing the
// same thing for the same reason.
export const CREATE_PREPARED_ENCOUNTERS_TABLE = `
  CREATE TABLE IF NOT EXISTS prepared_encounters (
    id         TEXT PRIMARY KEY NOT NULL,
    campaignId TEXT,
    status     TEXT NOT NULL DEFAULT 'draft',
    data       TEXT NOT NULL,
    updatedAt  INTEGER NOT NULL
  );
`;

// A-36 foundations: tracks which homebrew items arrived together as one
// imported content-pack, so they can be seen and removed as a group instead
// of only individually. Deliberately NOT a full pack system yet -- no
// version/dependency/priority fields, since nothing produces or consumes
// them today (see the A-36 plan note in memory: foundations only, the rest
// waits for a real multi-pack/multi-ruleset consumer). itemRefs is a JSON
// array of {type, id} — content_cache's own composite key shape — rather
// than a normalized join table, matching this file's own stated blob-
// storage rationale (small data, no cross-table query need).
// HOMEBREW-PACKAGE-1 item 15: packageVersion/author are nullable additions
// for package provenance (a package's own author-set version string and
// author name, distinct from content identity) — see db.ts's initDb() for
// the additive ADD COLUMN migration that brings an existing dev database
// created before these columns existed up to date.
export const CREATE_INSTALLED_PACKS_TABLE = `
  CREATE TABLE IF NOT EXISTS installed_packs (
    id             TEXT PRIMARY KEY NOT NULL,
    name           TEXT NOT NULL,
    importedAt     INTEGER NOT NULL,
    itemRefs       TEXT NOT NULL,
    packageVersion TEXT,
    author         TEXT
  );
`;

// Indexes for common query patterns
export const CREATE_INDEXES = `
  CREATE INDEX IF NOT EXISTS idx_entities_kind     ON entities    (kind);
  CREATE INDEX IF NOT EXISTS idx_sync_events_applied ON sync_events (applied, sessionId);
  CREATE INDEX IF NOT EXISTS idx_content_type      ON content_cache (type);
  CREATE INDEX IF NOT EXISTS idx_content_history_contentId ON content_cache_history (contentId);
  CREATE INDEX IF NOT EXISTS idx_timeline_entityId ON character_timeline (entityId);
  CREATE INDEX IF NOT EXISTS idx_prepared_encounters_campaign ON prepared_encounters (campaignId);
  CREATE INDEX IF NOT EXISTS idx_prepared_encounters_status   ON prepared_encounters (status);
`;

export const ALL_TABLES = [
  CREATE_ENTITIES_TABLE,
  CREATE_CAMPAIGNS_TABLE,
  CREATE_SYNC_EVENTS_TABLE,
  CREATE_DEVICE_SESSION_TABLE,
  CREATE_CONTENT_CACHE_TABLE,
  CREATE_CONTENT_CACHE_HISTORY_TABLE,
  CREATE_CHARACTER_TIMELINE_TABLE,
  CREATE_COMBAT_STATE_TABLE,
  CREATE_CHARACTER_DRAFT_TABLE,
  CREATE_APP_META_TABLE,
  CREATE_INSTALLED_PACKS_TABLE,
  CREATE_PREPARED_ENCOUNTERS_TABLE,
  CREATE_INDEXES,
];
