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
import { migrateEntity } from '../engine/multiclass';

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
  return migrateEntity(JSON.parse(row.data) as Entity);
}

/**
 * Parses one entity row, returning null (and logging) instead of throwing
 * on a malformed blob — used by loadAllEntities/loadEntitiesByKind so one
 * corrupted row doesn't take down the entire list (audit finding
 * PERSIST-4). Mirrors the per-row try/catch loadAllEntityMeta already uses
 * below for the same reason.
 */
function parseEntityRow(r: EntityRow): Entity | null {
  try {
    return migrateEntity(JSON.parse(r.data) as Entity);
  } catch (e) {
    console.error(`[entityRepo] skipping malformed row id=${r.id}:`, e);
    return null;
  }
}

/** Load all stored entities, sorted by updatedAt descending (most recent first). */
export async function loadAllEntities(): Promise<Entity[]> {
  if (Platform.OS === 'web') return [];
  const db   = getDb();
  const rows = await db.getAllAsync<EntityRow>(
    'SELECT * FROM entities ORDER BY updatedAt DESC'
  );
  return rows.map(parseEntityRow).filter((e): e is Entity => e !== null);
}

/** Load all entities of a specific kind. */
export async function loadEntitiesByKind(kind: Entity['kind']): Promise<Entity[]> {
  if (Platform.OS === 'web') return [];
  const db   = getDb();
  const rows = await db.getAllAsync<EntityRow>(
    'SELECT * FROM entities WHERE kind = ? ORDER BY updatedAt DESC',
    [kind]
  );
  return rows.map(parseEntityRow).filter((e): e is Entity => e !== null);
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
