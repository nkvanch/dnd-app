// ============================================================================
// FILE: src/db/draftRepo.ts
// Persists the in-progress character creation draft so it survives an app
// restart (re-audit A09, item 11). Single-row table, mirrors combatRepo.ts's
// combat_state pattern exactly — the creation flow only ever has one active
// draft at a time (characterStore.ts's `draft: Entity | null`).
// ============================================================================
import { Platform } from 'react-native';
import { getDb } from './db';
import { Entity } from '../engine/types';

/** Upserts the current creation draft (single-row table). */
export async function saveDraftState(entity: Entity): Promise<void> {
  if (Platform.OS === 'web') return;
  const db = getDb();
  await db.runAsync(
    `INSERT INTO character_draft (id, data, updatedAt) VALUES (1, ?, ?)
     ON CONFLICT(id) DO UPDATE SET data = excluded.data, updatedAt = excluded.updatedAt`,
    [JSON.stringify(entity), Date.now()]
  );
}

/** Loads the persisted draft. Returns null if none saved or on error. */
export async function loadDraftState(): Promise<Entity | null> {
  if (Platform.OS === 'web') return null;
  try {
    const db  = getDb();
    const row = await db.getFirstAsync<{ data: string }>(
      'SELECT data FROM character_draft WHERE id = 1'
    );
    if (!row) return null;
    return JSON.parse(row.data) as Entity;
  } catch {
    return null;
  }
}

/** Removes the persisted draft (called once the character is durably saved, or discarded). */
export async function clearDraftState(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const db = getDb();
    await db.runAsync('DELETE FROM character_draft WHERE id = 1');
  } catch { /* ignore */ }
}
