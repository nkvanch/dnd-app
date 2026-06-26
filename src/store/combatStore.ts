// ============================================================================
// FILE: src/store/combatStore.ts
// PROJECT: Combat & Initiative State Management (Zustand)
// ============================================================================
import { create } from 'zustand';
import { Entity, CampaignRules } from '../engine/types';
import { CombatState, InitiativeEntry, startEncounter, endTurn, endEncounter } from '../engine/combat';
import { saveCombatState, clearCombatState } from '../db/combatRepo';
import { DEFAULT_RULES } from './characterStore';

const EMPTY_COMBAT: CombatState = {
  active:      false,
  round:       0,
  turnIndex:   0,
  order:       [],
  encounterId: '',
};

type CombatStore = {
  combat:   CombatState;
  entities: Entity[];   // All entities active in the current encounter

  /** Start an encounter with the given entities. Rolls initiative for all. */
  startCombat: (entities: Entity[], encounterId: string) => void;

  /** End the current entity's turn, tick durations, advance the clock. */
  advanceTurn: (rules?: CampaignRules) => void;

  /** End the encounter entirely. */
  endCombat: () => void;

  /** Update a single entity mid-combat (HP changes, condition applied, etc.). */
  updateEntity: (id: string, updater: (e: Entity) => Entity) => void;

  /** Manually override the initiative order (DM drag-to-reorder). */
  setOrder: (order: InitiativeEntry[]) => void;

  /** Override a specific entity's initiative roll. */
  setInitiative: (entityId: string, value: number) => void;
};

export const useCombatStore = create<CombatStore>((set, get) => ({
  combat:   EMPTY_COMBAT,
  entities: [],

  startCombat: (entities, encounterId) => {
    const combat = startEncounter(entities, encounterId);
    set({ combat, entities });
    saveCombatState(combat).catch(console.error);
  },

  advanceTurn: (rules = DEFAULT_RULES) => {
    const { combat, entities } = get();
    if (!combat.active) return;
    const result = endTurn(combat, entities, rules);
    set({ combat: result.combat, entities: result.entities });
    saveCombatState(result.combat).catch(console.error);
  },

  endCombat: () => {
    const { combat } = get();
    set({ combat: endEncounter(combat), entities: [] });
    clearCombatState().catch(console.error);
  },

  updateEntity: (id, updater) =>
    set(state => ({
      entities: state.entities.map(e => e.id === id ? updater(e) : e),
    })),

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
}));
