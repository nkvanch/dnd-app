// ============================================================================
// FILE: src/db/combatRepo.ts
// Persists combat state so encounters survive app restarts.
// ============================================================================
import { Platform } from 'react-native';
import { getDb } from './db';
import { CombatState } from '../engine/combat';

/** Upserts the current combat state (single-row table). */
export async function saveCombatState(state: CombatState): Promise<void> {
  if (Platform.OS === 'web') return;
  const db = getDb();
  await db.runAsync(
    `INSERT INTO combat_state (id, data, updatedAt) VALUES (1, ?, ?)
     ON CONFLICT(id) DO UPDATE SET data = excluded.data, updatedAt = excluded.updatedAt`,
    [JSON.stringify(state), Date.now()]
  );
}

/** Loads the saved combat state. Returns null if none saved or on error. */
export async function loadCombatState(): Promise<CombatState | null> {
  if (Platform.OS === 'web') return null;
  try {
    const db  = getDb();
    const row = await db.getFirstAsync<{ data: string }>(
      'SELECT data FROM combat_state WHERE id = 1'
    );
    return row ? JSON.parse(row.data) as CombatState : null;
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
