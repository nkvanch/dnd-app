// ============================================================================
// FILE: src/db/combatRepo.ts
// Persists combat state so encounters survive app restarts.
//
// Persisted shape includes `entities` alongside `combat` (audit finding
// PERSIST-2) — previously only round/turnIndex/order/encounterId were
// saved, so an app kill mid-encounter lost every monster/NPC's HP and
// conditions outright and left the DM staring at ghost initiative rows on
// restart. Still one JSON blob in one single-row table, matching this
// project's established "blob storage, not normalized schema" design
// (see schema.ts's own header comment) — no new table, no schema change.
// ============================================================================
import { Platform } from 'react-native';
import { getDb } from './db';
import { CombatState } from '../engine/combat';
import { Entity } from '../engine/types';

export type PersistedCombatState = { combat: CombatState; entities: Entity[] };

/** Upserts the current combat state + its live entities (single-row table). */
export async function saveCombatState(combat: CombatState, entities: Entity[]): Promise<void> {
  if (Platform.OS === 'web') return;
  const db = getDb();
  const payload: PersistedCombatState = { combat, entities };
  await db.runAsync(
    `INSERT INTO combat_state (id, data, updatedAt) VALUES (1, ?, ?)
     ON CONFLICT(id) DO UPDATE SET data = excluded.data, updatedAt = excluded.updatedAt`,
    [JSON.stringify(payload), Date.now()]
  );
}

/**
 * Loads the saved combat state. Returns null if none saved or on error.
 *
 * Migration note: a row saved before this fix holds a bare CombatState
 * object (no `combat`/`entities` wrapper) — detected by the absence of a
 * `.combat` key and normalized to `{combat: <old blob>, entities: []}`
 * rather than throwing. The caller (app/_layout.tsx's boot restore)
 * already treats an active combat with no entities as an unrecoverable
 * interrupted encounter and clears it instead of resuming a broken
 * screen — an old-shape row gets exactly that same, already-correct
 * outcome instead of a parse-shape mismatch.
 */
export async function loadCombatState(): Promise<PersistedCombatState | null> {
  if (Platform.OS === 'web') return null;
  try {
    const db  = getDb();
    const row = await db.getFirstAsync<{ data: string }>(
      'SELECT data FROM combat_state WHERE id = 1'
    );
    if (!row) return null;
    const parsed = JSON.parse(row.data) as Partial<PersistedCombatState> | CombatState;
    if (parsed && typeof parsed === 'object' && 'combat' in parsed) {
      return { combat: parsed.combat as CombatState, entities: (parsed as PersistedCombatState).entities ?? [] };
    }
    return { combat: parsed as CombatState, entities: [] };
  } catch {
    return null;
  }
}

/** Removes saved combat state (called when encounter ends). */
export async function clearCombatState(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const db = getDb();
    await db.runAsync('DELETE FROM combat_state WHERE id = 1');
  } catch { /* ignore */ }
}
