// ============================================================================
// FILE: src/db/encounterRepo.ts
// CRUD operations for PreparedEncounter objects — DM planning data, kept
// deliberately separate from combatRepo.ts (which persists the runtime
// ActiveEncounter/CombatState instead). See engine/types.ts's
// PreparedEncounter doc comment for the conceptual split.
// ============================================================================
import { Platform } from 'react-native';
import { PreparedEncounter } from '../engine/types';
import { getDb } from './db';

type PreparedEncounterRow = {
  id:         string;
  campaignId: string | null;
  status:     string;
  data:       string;
  updatedAt:  number;
};

/**
 * Parses one prepared_encounters row, returning null (and logging) on a
 * malformed blob — used by loadEncounter/loadAllEncounters so one corrupted
 * row doesn't take down the whole Encounter Library (same shape as
 * entityRepo.ts's parseEntityRow / PERSIST-4).
 */
function fromRow(row: PreparedEncounterRow): PreparedEncounter | null {
  try {
    return JSON.parse(row.data) as PreparedEncounter;
  } catch (e) {
    console.error(`[encounterRepo] skipping malformed row id=${row.id}:`, e);
    return null;
  }
}

/** Upsert a PreparedEncounter. campaignId/status are duplicated as plain
 *  columns purely for indexed search/filter — the blob is still the single
 *  source of truth, see schema.ts's own note on this table. */
export async function saveEncounter(encounter: PreparedEncounter): Promise<void> {
  if (Platform.OS === 'web') return;
  const db = getDb();
  await db.runAsync(
    `INSERT INTO prepared_encounters (id, campaignId, status, data, updatedAt)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       campaignId = excluded.campaignId,
       status     = excluded.status,
       data       = excluded.data,
       updatedAt  = excluded.updatedAt`,
    [encounter.id, encounter.campaignId ?? null, encounter.status, JSON.stringify(encounter), Date.now()],
  );
}

/** Load a single PreparedEncounter by id. Returns null if not found. */
export async function loadEncounter(id: string): Promise<PreparedEncounter | null> {
  if (Platform.OS === 'web') return null;
  const db  = getDb();
  const row = await db.getFirstAsync<PreparedEncounterRow>(
    'SELECT * FROM prepared_encounters WHERE id = ?',
    [id],
  );
  return row ? fromRow(row) : null;
}

/** Load every PreparedEncounter, newest-updated first. Empty on web. */
export async function loadAllEncounters(): Promise<PreparedEncounter[]> {
  if (Platform.OS === 'web') return [];
  const db   = getDb();
  const rows = await db.getAllAsync<PreparedEncounterRow>(
    'SELECT * FROM prepared_encounters ORDER BY updatedAt DESC',
  );
  return rows.map(fromRow).filter((e): e is PreparedEncounter => e !== null);
}

/** Permanently delete a PreparedEncounter by id. */
export async function deleteEncounter(id: string): Promise<void> {
  if (Platform.OS === 'web') return;
  const db = getDb();
  await db.runAsync('DELETE FROM prepared_encounters WHERE id = ?', [id]);
}
