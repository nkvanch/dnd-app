// ============================================================================
// FILE: src/store/combatStore.ts
// PROJECT: Combat & Initiative State Management (Zustand)
// ============================================================================
import { create } from 'zustand';
import { Entity, CampaignRules } from '../engine/types';
import { CombatState, InitiativeEntry, startEncounter, endTurn, endEncounter, addToEncounter } from '../engine/combat';
import { saveCombatState, clearCombatState } from '../db/combatRepo';
import { DEFAULT_RULES, useCharacterStore } from './characterStore';
import { syncManager } from '../sync/syncManager';
import { deepDiff, deepMerge } from '../sync/diff';

/**
 * advanceTurn's duration/concentration tick and action-economy reset used
 * to apply ONLY to combatStore's own `entities` copy, with no bridge back
 * to characterStore at all (unlike every other combatStore action, which
 * routes character-kind changes through app/dm/encounter.tsx's
 * applyEntityUpdate). A condition expiring, concentration dropping, or a
 * turn-economy reset on a player character's turn never persisted to
 * SQLite or synced to that player's own device — it silently "un-expired"
 * there the moment anything else touched that field (audit finding
 * SYNC-COMBAT-1, sub-path c). Diffs each character-kind entity's before/
 * after state (same deepDiff/deepMerge machinery applyEntityUpdate already
 * uses) and merges the patch onto characterStore directly — combatStore
 * isn't a React component, so useCharacterStore.getState() is used instead
 * of the hook form, the same non-hook-store-access pattern this file
 * already relies on for DEFAULT_RULES's sibling exports.
 */
function syncTickedEntitiesToCharacterStore(before: Entity[], after: Entity[]): void {
  const updateCharacter = useCharacterStore.getState().updateCharacter;
  const beforeById = new Map(before.map(e => [e.id, e]));
  for (const entity of after) {
    if (entity.kind !== 'character') continue;
    const prior = beforeById.get(entity.id);
    if (!prior) continue;
    const patch = deepDiff(prior, entity);
    if (patch !== undefined) {
      updateCharacter(entity.id, c => deepMerge(c, patch), 'End of turn', 'combat');
    }
  }
}

const EMPTY_COMBAT: CombatState = {
  active:      false,
  round:       0,
  turnIndex:   0,
  order:       [],
  encounterId: '',
};

/** Pushes "whose turn is it" to every connected player device — a no-op on
 *  a player's own device (syncManager.broadcastCombatTurn is DM-only) and
 *  a no-op offline (no server running). Player devices previously had zero
 *  visibility into DM-run combat at all — see sync/protocol.ts's
 *  CombatTurnState doc comment for the full context. Called after every
 *  action that can change whether combat is active or who's currently
 *  acting; NOT called from setOrder/setInitiative, which are manual
 *  DM corrections typically made before combat starts. */
function broadcastTurn(combat: CombatState, entities: Entity[]): void {
  const current = combat.active ? entities.find(e => e.id === combat.order[combat.turnIndex]?.entityId) : undefined;
  syncManager.broadcastCombatTurn({
    active:          combat.active,
    round:           combat.round,
    currentEntityId: current?.id ?? null,
    currentName:     current?.identity.name ?? null,
  });
}

type CombatStore = {
  combat:   CombatState;
  entities: Entity[];   // All entities active in the current encounter
  /** Most recent SQLite write failure for this store, or null once the
   *  next write succeeds — same lastPersistError pattern as characterStore
   *  (audit finding PERSIST-5); every combat-state write here used to be
   *  fire-and-forget with only a console.error on failure. */
  lastPersistError: string | null;

  /** Start an encounter with the given entities. Rolls initiative for all.
   *  `sourcePreparedEncounterId` links this run back to the PreparedEncounter
   *  template it came from, if any — see CombatState's own doc comment. */
  startCombat: (entities: Entity[], encounterId: string, sourcePreparedEncounterId?: string) => void;

  /** End the current entity's turn, tick durations, advance the clock. */
  advanceTurn: (rules?: CampaignRules) => void;

  /** End the encounter entirely. */
  endCombat: () => void;

  /** Update a single entity mid-combat (HP changes, condition applied, etc.). */
  updateEntity: (id: string, updater: (e: Entity) => Entity) => void;

  /** Insert reinforcements into an already-active encounter — rolls their
   *  initiative and merges them into the existing order. No-op if combat
   *  isn't active. See engine/combat.ts's addToEncounter for the exact
   *  turn-pointer-preserving merge logic. */
  addEntities: (newEntities: Entity[]) => void;

  /** Removes an entity from the encounter roster (initiative order + the
   *  live entities list) WITHOUT deleting the Entity itself elsewhere in
   *  the app — a monster fled/was dismissed, or a party member left the
   *  fight. Safe to no-op on an id that isn't present. */
  removeFromEncounter: (id: string) => void;

  /** Manually override the initiative order (DM drag-to-reorder). */
  setOrder: (order: InitiativeEntry[]) => void;

  /** Override a specific entity's initiative roll. */
  setInitiative: (entityId: string, value: number) => void;
};

export const useCombatStore = create<CombatStore>((set, get) => {
  function persist(combat: CombatState, entities: Entity[], context: string): void {
    saveCombatState(combat, entities).then(
      () => set({ lastPersistError: null }),
      e  => {
        console.error(`[combatStore] ${context} failed:`, e);
        set({ lastPersistError: `Couldn't save combat state (${context}) — it may be lost if the app closes.` });
      }
    );
  }

  return {
  combat:   EMPTY_COMBAT,
  entities: [],
  lastPersistError: null,

  startCombat: (entities, encounterId, sourcePreparedEncounterId) => {
    const combat = startEncounter(entities, encounterId, sourcePreparedEncounterId);
    set({ combat, entities });
    persist(combat, entities, 'startCombat');
    broadcastTurn(combat, entities);
  },

  advanceTurn: (rules = DEFAULT_RULES) => {
    const { combat, entities } = get();
    if (!combat.active) return;
    const result = endTurn(combat, entities, rules);
    set({ combat: result.combat, entities: result.entities });
    syncTickedEntitiesToCharacterStore(entities, result.entities);
    persist(result.combat, result.entities, 'advanceTurn');
    broadcastTurn(result.combat, result.entities);
  },

  endCombat: () => {
    const { combat } = get();
    const nextCombat = endEncounter(combat);
    set({ combat: nextCombat, entities: [] });
    clearCombatState().then(
      () => set({ lastPersistError: null }),
      e  => {
        console.error('[combatStore] endCombat failed:', e);
        set({ lastPersistError: "Couldn't clear saved combat state — it may reappear on next launch." });
      }
    );
    broadcastTurn(nextCombat, []);
  },

  updateEntity: (id, updater) => {
    const { combat } = get();
    set(state => ({
      entities: state.entities.map(e => e.id === id ? updater(e) : e),
    }));
    // Previously this never persisted at all — every per-combatant HP/
    // condition/resource change made via the DM's QuickPanel (the most
    // frequent mutation in live play) lived only in memory until some
    // OTHER action (advanceTurn, addEntities, ...) happened to also save.
    // An app kill between such actions lost the change outright (audit
    // finding PERSIST-2's other half — not just the "no entities at all"
    // case, but "entities present but stale").
    if (combat.active) {
      persist(combat, get().entities, 'updateEntity');
    }
  },

  addEntities: (newEntities) => {
    const { combat, entities } = get();
    if (!combat.active || newEntities.length === 0) return;
    const nextCombat = addToEncounter(combat, newEntities);
    const nextEntities = [...entities, ...newEntities];
    set({ combat: nextCombat, entities: nextEntities });
    persist(nextCombat, nextEntities, 'addEntities');
    broadcastTurn(nextCombat, nextEntities);
  },

  removeFromEncounter: (id) => {
    const { combat } = get();
    // Bug fix: this used to only be a component-local helper
    // (app/dm/encounter.tsx) that filtered `entities` alone — the initiative
    // order kept a ghost row for the removed id forever, with no entity
    // data behind it. Now removes from both in one place, and re-anchors
    // the turn pointer (a plain array index — removing an earlier entry
    // would otherwise silently point it at the wrong combatant).
    let nextCombat = combat;
    if (combat.active) {
      const currentEntityId = combat.order[combat.turnIndex]?.entityId;
      const order = combat.order.filter(e => e.entityId !== id);
      const turnIndex = currentEntityId && currentEntityId !== id
        ? Math.max(0, order.findIndex(e => e.entityId === currentEntityId))
        : Math.min(combat.turnIndex, Math.max(0, order.length - 1));
      nextCombat = { ...combat, order, turnIndex };
    }
    const nextEntities = get().entities.filter(e => e.id !== id);
    set({ combat: nextCombat, entities: nextEntities });
    if (combat.active) {
      persist(nextCombat, nextEntities, 'removeFromEncounter');
      broadcastTurn(nextCombat, nextEntities);
    }
  },

  setOrder: (order) =>
    set(state => ({ combat: { ...state.combat, order } })),

  setInitiative: (entityId, value) =>
    set(state => ({
      combat: {
        ...state.combat,
        order: state.combat.order
          .map(e => e.entityId === entityId ? { ...e, initiative: value } : e)
          .sort((a, b) =>
            b.initiative - a.initiative ||
            b.tiebreak   - a.tiebreak
          ),
      },
    })),
  };
});
