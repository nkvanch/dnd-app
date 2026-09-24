// ============================================================================
// FILE: src/store/encounterStore.ts
// Zustand store for PreparedEncounter (DM planning data) CRUD. Deliberately
// separate from combatStore.ts, which owns the runtime ActiveEncounter.
// ============================================================================
import { create } from 'zustand';
import { PreparedEncounter } from '../engine/types';
import { saveEncounter, loadAllEncounters, deleteEncounter } from '../db/encounterRepo';
import { newPreparedEncounter, hasInvalidManualHp } from '../engine/preparedEncounter';

type EncounterStore = {
  encounters: PreparedEncounter[];
  isLoading:  boolean;

  /** Load all prepared encounters from SQLite. Called after initDb(). */
  loadEncounters: () => Promise<void>;

  /** Create a new draft encounter, persist it, and return it.
   *  `sessionId` (item 14) — the campaign's currently-active session, if
   *  any, so the encounter records which session it was prepared during.
   *  See PreparedEncounter.sessionId's own doc comment. */
  createEncounter: (name: string, campaignId?: string, sessionId?: string) => Promise<PreparedEncounter>;

  /** Full replace-and-persist for an existing encounter (the builder screen's
   *  own save button uses this — it already holds the complete edited record). */
  saveEncounterDraft: (encounter: PreparedEncounter) => Promise<void>;

  /** Duplicate an encounter as a new draft — independent copy, own id,
   *  status reset to draft, never shares combatant array references with
   *  the source so editing one can never affect the other. */
  duplicateEncounter: (id: string) => Promise<PreparedEncounter | null>;

  /** Set status without touching anything else (Archive, mark Ready, etc.). */
  setEncounterStatus: (id: string, status: PreparedEncounter['status']) => Promise<void>;

  /** Permanently delete an encounter. */
  deleteEncounterPermanently: (id: string) => Promise<void>;
};

export const useEncounterStore = create<EncounterStore>((set, get) => ({
  encounters: [],
  isLoading:  false,

  loadEncounters: async () => {
    set({ isLoading: true });
    try {
      const encounters = await loadAllEncounters();
      set({ encounters, isLoading: false });
    } catch (e) {
      console.error('[encounterStore] loadEncounters failed:', e);
      set({ isLoading: false });
    }
  },

  createEncounter: async (name, campaignId, sessionId) => {
    const encounter = newPreparedEncounter(name, campaignId, sessionId);
    await saveEncounter(encounter);
    set(state => ({ encounters: [encounter, ...state.encounters] }));
    return encounter;
  },

  saveEncounterDraft: async (encounter) => {
    const updated = { ...encounter, updatedAt: Date.now() };
    await saveEncounter(updated);
    set(state => ({
      encounters: state.encounters.some(e => e.id === updated.id)
        ? state.encounters.map(e => e.id === updated.id ? updated : e)
        : [updated, ...state.encounters],
    }));
  },

  duplicateEncounter: async (id) => {
    const source = get().encounters.find(e => e.id === id);
    if (!source) return null;
    const now = Date.now();
    const copy: PreparedEncounter = {
      ...source,
      id: `enc_${now.toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      name: `${source.name} (Copy)`,
      status: 'draft',
      combatants:  source.combatants.map(c => ({ ...c })),
      groups:      source.groups.map(g => ({ ...g })),
      waves:       source.waves.map(w => ({ ...w })),
      environment: source.environment.map(e => ({ ...e })),
      rewards:     source.rewards.map(r => ({ ...r })),
      createdAt: now, updatedAt: now,
      lastStartedAt: undefined, completedAt: undefined,
    };
    await saveEncounter(copy);
    set(state => ({ encounters: [copy, ...state.encounters] }));
    return copy;
  },

  setEncounterStatus: async (id, status) => {
    const existing = get().encounters.find(e => e.id === id);
    if (!existing) return;
    const updated = { ...existing, status, updatedAt: Date.now() };
    await saveEncounter(updated);
    set(state => ({ encounters: state.encounters.map(e => e.id === id ? updated : e) }));
  },

  deleteEncounterPermanently: async (id) => {
    await deleteEncounter(id);
    set(state => ({ encounters: state.encounters.filter(e => e.id !== id) }));
  },
}));

/**
 * Closure (Review/Start save race): the ONE shared "is this draft safe to
 * persist, and did persistence actually succeed" check. Used by
 * app/dm/encounter-builder.tsx's Save AND Review/Start actions so there is
 * exactly one persistence implementation and one error-surfacing behavior
 * — not two separately-written async blocks that can drift apart, which is
 * literally how Review/Start ended up navigating without ever awaiting a
 * successful save in the first place. Reuses hasInvalidManualHp
 * (preparedEncounter.ts) rather than reimplementing manual-HP validation;
 * never calls saveEncounterDraft at all when the draft itself is invalid.
 * Never throws — a caller can always safely `await` this with no try/catch
 * of its own and just branch on `ok`.
 *
 * {ok:true} is returned ONLY once useEncounterStore's own `encounters`
 * already reflects the just-saved version: saveEncounterDraft updates the
 * store synchronously as part of the same async function, BEFORE its
 * returned promise resolves (see its own implementation above) — so a
 * caller that navigates immediately after a true result can never have the
 * next screen read a stale, previously-saved copy of this encounter.
 */
export async function trySavePreparedEncounter(
  prepared: PreparedEncounter,
): Promise<{ ok: true } | { ok: false; reason: 'invalid' | 'save-failed' }> {
  if (hasInvalidManualHp(prepared)) return { ok: false, reason: 'invalid' };
  try {
    await useEncounterStore.getState().saveEncounterDraft(prepared);
    return { ok: true };
  } catch (e) {
    console.error('[encounterStore] trySavePreparedEncounter failed:', e);
    return { ok: false, reason: 'save-failed' };
  }
}
