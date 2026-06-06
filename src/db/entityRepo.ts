// ============================================================================
// FILE: src/db/entityRepo.ts
// CRUD operations for Entity objects.
//
// Entities are stored as full JSON blobs. The only separate columns are id,
// kind, and updatedAt for efficient list/filter queries.
// ============================================================================
import { Platform } from 'react-native';
import { Entity } from '../engine/types';
import { getDb } from './db';

type EntityRow = {
  id:        string;
  kind:      string;
  data:      string;
  updatedAt: number;
};

/** Upsert a full Entity. Overwrites any existing row with the same id. */
export async function saveEntity(entity: Entity): Promise<void> {
  if (Platform.OS === 'web') return;
  const db = getDb();
  await db.runAsync(
    `INSERT INTO entities (id, kind, data, updatedAt)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       kind      = excluded.kind,
       data      = excluded.data,
       updatedAt = excluded.updatedAt`,
    [entity.id, entity.kind, JSON.stringify(entity), Date.now()]
  );
}

/** Load a single Entity by id. Returns null if not found. */
export async function loadEntity(id: string): Promise<Entity | null> {
  if (Platform.OS === 'web') return null;
  const db  = getDb();
  const row = await db.getFirstAsync<EntityRow>(
    'SELECT * FROM entities WHERE id = ?',
    [id]
  );
  if (!row) return null;
  return JSON.parse(row.data) as Entity;
}

/** Load all stored entities, sorted by updatedAt descending (most recent first). */
export async function loadAllEntities(): Promise<Entity[]> {
  if (Platform.OS === 'web') return [];
  const db   = getDb();
  const rows = await db.getAllAsync<EntityRow>(
    'SELECT * FROM entities ORDER BY updatedAt DESC'
  );
  return rows.map(r => JSON.parse(r.data) as Entity);
}

/** Load all entities of a specific kind. */
export async function loadEntitiesByKind(kind: Entity['kind']): Promise<Entity[]> {
  if (Platform.OS === 'web') return [];
  const db   = getDb();
  const rows = await db.getAllAsync<EntityRow>(
    'SELECT * FROM entities WHERE kind = ? ORDER BY updatedAt DESC',
    [kind]
  );
  return rows.map(r => JSON.parse(r.data) as Entity);
}

export type EntityMeta = {
  id:        string;
  kind:      Entity['kind'];
  name:      string;
  level:     number;
  classId:   string;
  hp:        number;
  updatedAt: number;
};

/**
 * Load lightweight metadata for all entities without deserializing full JSON blobs.
 * Used for the character list screen to avoid loading complete entity data on startup.
 * Full entity data is only deserialized when a character sheet is opened (loadEntity).
 */
export async function loadAllEntityMeta(): Promise<EntityMeta[]> {
  if (Platform.OS === 'web') return [];
  const db   = getDb();
  const rows = await db.getAllAsync<EntityRow>(
    'SELECT id, kind, data, updatedAt FROM entities ORDER BY updatedAt DESC'
  );
  return rows.map(r => {
    // Deserialize only the minimum fields needed for list display
    let name = '', level = 0, classId = '', hp = 0;
    try {
      const partial = JSON.parse(r.data) as Partial<Entity>;
      name    = partial.identity?.name    ?? '';
      level   = partial.identity?.level   ?? 0;
      classId = partial.identity?.classId ?? '';
      hp      = partial.resources?.hp?.current ?? 0;
    } catch { /* malformed row — keep defaults */ }
    return {
      id:        r.id,
      kind:      r.kind as Entity['kind'],
      name,
      level,
      classId,
      hp,
      updatedAt: r.updatedAt,
    };
  });
}

/** Permanently delete an entity by id. */
export async function deleteEntity(id: string): Promise<void> {
  if (Platform.OS === 'web') return;
  const db = getDb();
  await db.runAsync('DELETE FROM entities WHERE id = ?', [id]);
}
