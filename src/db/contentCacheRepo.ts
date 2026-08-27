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

/** Upsert a piece of homebrew content. */
export async function saveHomebrewContent(
  type:    ContentCacheType,
  content: HomebrewContent,
): Promise<void> {
  if (Platform.OS === 'web') return;
  const db = getDb();
  const id = `${type}:${(content as any).id}`;
  await db.runAsync(
    `INSERT INTO content_cache (id, type, data, version)
     VALUES (?, ?, ?, '1')
     ON CONFLICT(id) DO UPDATE SET data = excluded.data`,
    [id, type, JSON.stringify(content)]
  );
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
