// ============================================================================
// FILE: src/store/combatStore.ts
// PROJECT: Combat & Initiative State Management (Zustand)
// ============================================================================
import { create } from 'zustand';
import { Entity, CampaignRules } from '../engine/types';
import { CombatState, InitiativeEntry, startEncounter, endTurn, endEncounter, addToEncounter, rollAllInitiative, sortInitiative, reanchorTurnIndex } from '../engine/combat';
import { saveCombatState, clearCombatState, loadCombatState } from '../db/combatRepo';
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

  /** Start an encounter with the given entities. `roll` (default false —
   *  table-first: manual entry/reorder is the primary path) controls
   *  whether initiative is app-rolled for everyone or left at 0 for manual/
   *  table entry. `sourcePreparedEncounterId` links this run back to the
   *  PreparedEncounter template it came from, if any — see CombatState's
   *  own doc comment. */
  startCombat: (entities: Entity[], encounterId: string, sourcePreparedEncounterId?: string, roll?: boolean) => void;

  /** End the current entity's turn, tick durations, advance the clock. */
  advanceTurn: (rules?: CampaignRules) => void;

  /** End the encounter entirely. */
  endCombat: () => void;

  /** Update a single entity mid-combat (HP changes, condition applied, etc.). */
  updateEntity: (id: string, updater: (e: Entity) => Entity) => void;

  /** Insert reinforcements into an already-active encounter and merge them
   *  into the existing order. `roll` (default false — table-first, matching
   *  startCombat) controls whether their initiative is app-rolled or left
   *  at 0 for manual/table entry. No-op if combat isn't active. See
   *  engine/combat.ts's addToEncounter for the exact turn-pointer-preserving
   *  merge logic. */
  addEntities: (newEntities: Entity[], roll?: boolean) => void;

  /** Rolls (or re-rolls) initiative for every entity currently in the
   *  order — the "🎲 Roll All Initiative" secondary convenience. */
  rollAllInitiative: () => void;

  /** Removes an entity from the encounter roster (initiative order + the
   *  live entities list) WITHOUT deleting the Entity itself elsewhere in
   *  the app — a monster fled/was dismissed, or a party member left the
   *  fight. Safe to no-op on an id that isn't present. Persists regardless
   *  of whether combat is active — see addToRoster's own doc comment for
   *  why an inactive-but-nonempty roster is now a real, persisted state. */
  removeFromEncounter: (id: string) => void;

  /** Adds one entity to the pre-combat setup roster (a party member, or a
   *  monster spawned directly via "Add Monster") — the roster the DM
   *  assembles in Setup mode BEFORE pressing "Start Combat." Closure fix
   *  (pre-combat roster lifecycle): this used to be a raw
   *  useCombatStore.setState() call made directly from app/dm/monsters.tsx
   *  and app/dm/encounter.tsx, which never persisted at all — an app kill
   *  mid-setup silently lost the whole roster the DM had assembled so far,
   *  with no indication anything was wrong. Persists immediately through
   *  the SAME combat-state repository row startCombat/addEntities/etc.
   *  already use (no schema change): `combat` stays whatever's already in
   *  state (EMPTY_COMBAT while still in setup), `entities` gains this one
   *  addition. app/_layout.tsx's boot restore recognizes and restores this
   *  shape (entities present, combat inactive) the same way it restores an
   *  active encounter. No-op if the entity is already present. */
  addToRoster: (entity: Entity) => void;

  /** Manually override the initiative order (DM drag-to-reorder / up-down
   *  swap). Closure fix: this used to only update in-memory state — a
   *  manually chosen order could silently revert to whatever was last
   *  saved if the app closed before some OTHER action happened to persist.
   *  Now persists immediately, same as every other order-changing action.
   *  Takes `order` exactly as given — never re-sorted by initiative value —
   *  so an explicit manual order is allowed to disagree with the numeric
   *  initiative values on each entry (e.g. the DM deliberately moved a
   *  readied action ahead of its roll). Re-anchors `turnIndex` to whichever
   *  entity currently has the turn, so reordering rows never silently hands
   *  the turn to a different combatant that happens to land at the same
   *  numeric position. */
  setOrder: (order: InitiativeEntry[]) => void;

  /** Override a specific entity's initiative roll (the table-first "enter
   *  the rolled/assigned result" primary path, and the per-row 🎲 secondary
   *  convenience, which both call this with their result). Closure fix:
   *  this used to only update in-memory state (same persistence gap as
   *  setOrder) and re-sorted the WHOLE order without re-anchoring
   *  `turnIndex`, so a single edit could silently hand the turn to whoever
   *  else ended up at the previous position. Now persists immediately and
   *  re-anchors `turnIndex` to the same acting entity. Re-sorting on a
   *  numeric edit is the pre-existing, intentional UX (entering a value is
   *  itself an initiative resolution, unlike setOrder's explicit reorder)
   *  — only the actor-stability and persistence gaps are closed here. */
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

  startCombat: (entities, encounterId, sourcePreparedEncounterId, roll = false) => {
    const combat = startEncounter(entities, encounterId, sourcePreparedEncounterId, roll);
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

  addEntities: (newEntities, roll = false) => {
    const { combat, entities } = get();
    if (!combat.active || newEntities.length === 0) return;
    const nextCombat = addToEncounter(combat, newEntities, roll);
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
    // Closure fix: this used to only persist while combat was active,
    // leaving a pre-combat roster removal (setup mode) unsaved — the
    // removed monster/party member would silently reappear on restart.
    // Now always persists; broadcastTurn stays active-only (there's no
    // "current actor" to announce outside a running encounter).
    persist(nextCombat, nextEntities, 'removeFromEncounter');
    if (combat.active) {
      broadcastTurn(nextCombat, nextEntities);
    }
  },

  addToRoster: (entity) => {
    const { combat, entities } = get();
    if (entities.some(e => e.id === entity.id)) return;
    const nextEntities = [...entities, entity];
    set({ entities: nextEntities });
    persist(combat, nextEntities, 'addToRoster');
  },

  setOrder: (order) => {
    const { combat, entities } = get();
    const currentEntityId = combat.order[combat.turnIndex]?.entityId;
    const nextCombat: CombatState = { ...combat, order, turnIndex: reanchorTurnIndex(order, currentEntityId, combat.turnIndex) };
    set({ combat: nextCombat });
    if (combat.active) {
      persist(nextCombat, entities, 'setOrder');
    }
  },

  rollAllInitiative: () => {
    const { combat, entities } = get();
    if (!combat.active) return;
    const nextCombat = rollAllInitiative(combat, entities);
    set({ combat: nextCombat });
    persist(nextCombat, entities, 'rollAllInitiative');
  },

  setInitiative: (entityId, value) => {
    const { combat, entities } = get();
    const currentEntityId = combat.order[combat.turnIndex]?.entityId;
    const order = sortInitiative(
      combat.order.map(e => e.entityId === entityId ? { ...e, initiative: value } : e)
    );
    const nextCombat: CombatState = { ...combat, order, turnIndex: reanchorTurnIndex(order, currentEntityId, combat.turnIndex) };
    set({ combat: nextCombat });
    if (combat.active) {
      persist(nextCombat, entities, 'setInitiative');
    }
  },
  };
});

/**
 * Closure fix (active-combat hydration race): restores persisted combat
 * state into this store, exactly as app/_layout.tsx's boot sequence needs.
 * Extracted out of the boot sequence itself (a React component's inline
 * useEffect) so there is exactly ONE implementation of "what a restored
 * combat/entities pair means" — not a copy embedded in the component — and
 * so it's independently testable with a genuinely async loadCombatState,
 * not just a synchronously-resolved mock. app/_layout.tsx now `await`s
 * this call before releasing the boot screen; previously that restore ran
 * as a fire-and-forget `.then(...)`, so the boot-ready flag could flip
 * before this resolved, letting app/dm/encounter.tsx mount and capture its
 * local `setupMode` from useCombatStore's still-default (inactive, empty)
 * state — a real active encounter restored a moment later left the DM
 * stuck looking at Setup.
 *
 * Any state with at least one entity restores, whether it's an active
 * encounter OR a pre-combat setup roster (Closure 2E — combat.active can
 * be false with entities present). A stale ACTIVE state with NO entities
 * (an old pre-migration save, or a genuinely interrupted encounter — see
 * combatRepo.ts's own migration note) is cleared instead of restored: the
 * DM's screen would otherwise show ghost initiative rows with no HP/
 * condition data and no way to act on them (audit finding PERSIST-2).
 * Never throws — a boot that can't read combat state just starts with
 * none, same as every other best-effort boot step in app/_layout.tsx.
 */
export async function hydrateCombatStateOnBoot(): Promise<void> {
  try {
    const state = await loadCombatState();
    if (state && state.entities.length > 0) {
      useCombatStore.setState({ combat: state.combat, entities: state.entities });
    } else if (state?.combat.active) {
      await clearCombatState().catch(() => { /* non-critical */ });
    }
  } catch (e) {
    console.error('[combatStore] hydrateCombatStateOnBoot failed:', e);
  }
}
