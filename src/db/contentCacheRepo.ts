// ============================================================================
// FILE: src/db/contentCacheRepo.ts
// CRUD for homebrew content stored in the content_cache table.
// ============================================================================
import { Platform } from 'react-native';
import { Race, Subrace, CharClass, HomebrewSubclass, Spell, Feature, Background, Item, Feat, Condition, SpellList } from '../engine/types';
import { MonsterTemplate } from '../content/monsters/types';
import { getDb } from './db';

export type ContentCacheType = 'race' | 'subrace' | 'class' | 'subclass' | 'spell' | 'background' | 'feature' | 'item' | 'feat' | 'monster' | 'condition' | 'spellList';
export type HomebrewContent   = Race | Subrace | CharClass | HomebrewSubclass | Spell | Feature | Background | Item | Feat | MonsterTemplate | Condition | SpellList;

type ContentCacheRow = {
  id:      string;
  type:    string;
  data:    string;
  version: string;
};

type ContentCacheHistoryRow = {
  historyId: number;
  contentId: string;
  type:      string;
  version:   string;
  data:      string;
  savedAt:   number;
};

export type ContentVersionEntry = {
  version: string;
  data:    HomebrewContent;
  savedAt: number;
};

/** The actual upsert logic, factored out so it can run either inside its
 *  own single-item transaction (saveHomebrewContent) or as one statement
 *  among many inside a SHARED transaction (saveHomebrewContentBatch below)
 *  — no transaction handling of its own, callers own that. */
async function upsertOne(
  db:      ReturnType<typeof getDb>,
  type:    ContentCacheType,
  content: HomebrewContent,
): Promise<void> {
  const id = `${type}:${(content as any).id}`;
  const existing = await db.getFirstAsync<ContentCacheRow>(
    'SELECT * FROM content_cache WHERE id = ?', [id]
  );

  if (existing) {
    await db.runAsync(
      `INSERT INTO content_cache_history (contentId, type, version, data, savedAt)
       VALUES (?, ?, ?, ?, ?)`,
      [id, type, existing.version, existing.data, Date.now()]
    );
    // Safe to increment as a number — this function is the only writer of
    // this column, always as a plain incrementing-integer string.
    const nextVersion = String(Number(existing.version) + 1);
    await db.runAsync(
      'UPDATE content_cache SET data = ?, version = ? WHERE id = ?',
      [JSON.stringify(content), nextVersion, id]
    );
  } else {
    await db.runAsync(
      `INSERT INTO content_cache (id, type, data, version) VALUES (?, ?, ?, '1')`,
      [id, type, JSON.stringify(content)]
    );
  }
}

/**
 * Upsert a piece of homebrew content. If a row already exists for this id,
 * the OLD row is archived into content_cache_history first (inside the same
 * transaction) and the version counter increments — nothing is ever lost to
 * an edit. A brand-new item just inserts at version '1', no history yet.
 */
export async function saveHomebrewContent(
  type:    ContentCacheType,
  content: HomebrewContent,
): Promise<void> {
  if (Platform.OS === 'web') return;
  const db = getDb();
  await db.withTransactionAsync(() => upsertOne(db, type, content));
}

/**
 * HOMEBREW-PACKAGE-1 item 14: a genuinely ATOMIC multi-item save — every
 * item in `items` is upserted inside ONE SQLite transaction, so a package
 * import either fully commits or (if any single upsert throws — a
 * malformed item, a disk error mid-write, etc.) fully rolls back, leaving
 * the local library exactly as it was before the import started. This
 * replaces the previously-disclosed "sequential, not atomic" limitation in
 * app/homebrew/import-package.tsx's commit handler — expo-sqlite's
 * withTransactionAsync already provides real BEGIN/COMMIT/ROLLBACK
 * semantics; the only reason saveItem() didn't already use it for multiple
 * items is that it was designed as a single-item API. This is an additive
 * sibling, not a rewrite of that API — existing single-item callers
 * (builders' own Save buttons) are completely unaffected.
 */
export async function saveHomebrewContentBatch(
  items: { type: ContentCacheType; content: HomebrewContent }[],
): Promise<void> {
  if (Platform.OS === 'web') return;
  if (items.length === 0) return;
  const db = getDb();
  await db.withTransactionAsync(async () => {
    for (const { type, content } of items) {
      await upsertOne(db, type, content);
    }
  });
}

/** Prior versions of a piece of homebrew content, newest first. Does NOT
 *  include the current version — that's already in the live store. */
export async function loadContentHistory(
  type: ContentCacheType,
  id:   string,
): Promise<ContentVersionEntry[]> {
  if (Platform.OS === 'web') return [];
  const db  = getDb();
  const key = `${type}:${id}`;
  const rows = await db.getAllAsync<ContentCacheHistoryRow>(
    'SELECT * FROM content_cache_history WHERE contentId = ? ORDER BY historyId DESC',
    [key]
  );
  return rows.map(r => ({
    version: r.version,
    data:    JSON.parse(r.data) as HomebrewContent,
    savedAt: r.savedAt,
  }));
}

/**
 * Restores a prior version as the new current version. Goes back through
 * saveHomebrewContent so the archive/increment logic lives in exactly one
 * place — a restore is indistinguishable from a normal edit everywhere else
 * in this file. History stays strictly linear: restoring v1 out of
 * v1→v2→v3 produces v4 (a copy of v1), never rewrites existing rows.
 */
export async function restoreContentVersion(
  type:    ContentCacheType,
  id:      string,
  version: string,
): Promise<HomebrewContent> {
  if (Platform.OS === 'web') throw new Error('Not available on web.');
  const db  = getDb();
  const key = `${type}:${id}`;
  const row = await db.getFirstAsync<ContentCacheHistoryRow>(
    'SELECT * FROM content_cache_history WHERE contentId = ? AND version = ?',
    [key, version]
  );
  if (!row) throw new Error(`Version ${version} not found for ${key}.`);
  const restored = JSON.parse(row.data) as HomebrewContent;
  await saveHomebrewContent(type, restored);
  return restored;
}

/**
 * Parses one content_cache row, returning null (and logging) on a malformed
 * blob — used by loadHomebrewByType/loadAllHomebrew so one corrupted row
 * doesn't take down the entire homebrew library (audit finding, same shape
 * as entityRepo.ts's parseEntityRow / PERSIST-4).
 */
function parseContentRow(r: ContentCacheRow): HomebrewContent | null {
  try {
    return JSON.parse(r.data) as HomebrewContent;
  } catch (e) {
    console.error(`[contentCacheRepo] skipping malformed row id=${r.id}:`, e);
    return null;
  }
}

/** Load all homebrew content of a given type. */
export async function loadHomebrewByType(type: ContentCacheType): Promise<HomebrewContent[]> {
  if (Platform.OS === 'web') return [];
  const db   = getDb();
  const rows = await db.getAllAsync<ContentCacheRow>(
    'SELECT * FROM content_cache WHERE type = ?',
    [type]
  );
  return rows.map(parseContentRow).filter((c): c is HomebrewContent => c !== null);
}

/** Load all homebrew content (all types). */
export async function loadAllHomebrew(): Promise<Partial<Record<ContentCacheType, HomebrewContent[]>>> {
  if (Platform.OS === 'web') return {};
  const db   = getDb();
  const rows = await db.getAllAsync<ContentCacheRow>('SELECT * FROM content_cache');
  const result: Partial<Record<ContentCacheType, HomebrewContent[]>> = {};
  for (const row of rows) {
    const parsed = parseContentRow(row);
    if (!parsed) continue;
    const type = row.type as ContentCacheType;
    if (!result[type]) result[type] = [];
    result[type]!.push(parsed);
  }
  return result;
}

/** Delete a specific homebrew item. */
export async function deleteHomebrewContent(type: ContentCacheType, id: string): Promise<void> {
  if (Platform.OS === 'web') return;
  const db   = getDb();
  const key  = `${type}:${id}`;
  await db.runAsync('DELETE FROM content_cache WHERE id = ?', [key]);
}
