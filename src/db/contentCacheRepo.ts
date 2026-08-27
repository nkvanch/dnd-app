// ============================================================================
// FILE: src/db/contentCacheRepo.ts
// CRUD for homebrew content stored in the content_cache table.
// ============================================================================
import { Platform } from 'react-native';
import { Race, Subrace, CharClass, HomebrewSubclass, Spell, Feature, Background, Item, Feat } from '../engine/types';
import { MonsterTemplate } from '../content/monsters/types';
import { getDb } from './db';

export type ContentCacheType = 'race' | 'subrace' | 'class' | 'subclass' | 'spell' | 'background' | 'feature' | 'item' | 'feat' | 'monster';
export type HomebrewContent   = Race | Subrace | CharClass | HomebrewSubclass | Spell | Feature | Background | Item | Feat | MonsterTemplate;

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
  const id = `${type}:${(content as any).id}`;

  await db.withTransactionAsync(async () => {
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

/** Load all homebrew content of a given type. */
export async function loadHomebrewByType(type: ContentCacheType): Promise<HomebrewContent[]> {
  if (Platform.OS === 'web') return [];
  const db   = getDb();
  const rows = await db.getAllAsync<ContentCacheRow>(
    'SELECT * FROM content_cache WHERE type = ?',
    [type]
  );
  return rows.map(r => JSON.parse(r.data) as HomebrewContent);
}

/** Load all homebrew content (all types). */
export async function loadAllHomebrew(): Promise<Partial<Record<ContentCacheType, HomebrewContent[]>>> {
  if (Platform.OS === 'web') return {};
  const db   = getDb();
  const rows = await db.getAllAsync<ContentCacheRow>('SELECT * FROM content_cache');
  const result: Partial<Record<ContentCacheType, HomebrewContent[]>> = {};
  for (const row of rows) {
    const type = row.type as ContentCacheType;
    if (!result[type]) result[type] = [];
    result[type]!.push(JSON.parse(row.data) as HomebrewContent);
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
