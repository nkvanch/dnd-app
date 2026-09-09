// src/store/__tests__/combatStore.test.ts
// First test coverage for this store. Focuses on the Phase 1 (prepared
// encounters) additions — addEntities (reinforcement deploy) and
// removeFromEncounter — since combat.ts's own addToEncounter merge/
// turn-pointer logic already has direct coverage in engine/__tests__/
// combat.test.ts; this file proves the store wires that logic correctly
// into both combat.order AND entities together. removeFromEncounter in
// particular is a regression lock: it used to be a component-local
// helper (app/dm/encounter.tsx) that only filtered `entities`, leaving a
// ghost row in the initiative order with no entity behind it.
import { useCombatStore } from '../combatStore';
import * as combatRepo from '../../db/combatRepo';
import { makeEmptyEntity } from '../characterStore';
import { Entity } from '../../engine/types';

function entityAt(id: string, initiativeBonus: number): Entity {
  const e = makeEmptyEntity(id, 'monster');
  return { ...e, identity: { ...e.identity, name: id }, derived: { ...e.derived, initiative: initiativeBonus } };
}

describe('combatStore', () => {
  let saveSpy: jest.SpyInstance;
  let clearSpy: jest.SpyInstance;

  beforeEach(() => {
    saveSpy  = jest.spyOn(combatRepo, 'saveCombatState').mockResolvedValue(undefined);
    clearSpy = jest.spyOn(combatRepo, 'clearCombatState').mockResolvedValue(undefined);
    useCombatStore.setState({
      combat:   { active: false, round: 0, turnIndex: 0, order: [], encounterId: '' },
      entities: [],
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('startCombat', () => {
    it('rolls initiative, activates combat, and persists', () => {
      useCombatStore.getState().startCombat([entityAt('a', 5)], 'enc1');
      const { combat, entities } = useCombatStore.getState();
      expect(combat.active).toBe(true);
      expect(combat.order).toHaveLength(1);
      expect(entities).toHaveLength(1);
      expect(saveSpy).toHaveBeenCalledTimes(1);
    });

    it('threads sourcePreparedEncounterId through into combat state', () => {
      useCombatStore.getState().startCombat([entityAt('a', 5)], 'enc1', 'prep1');
      expect(useCombatStore.getState().combat.sourcePreparedEncounterId).toBe('prep1');
    });
  });

  describe('addEntities', () => {
    it('merges new entities into both combat.order and entities, and persists', () => {
      useCombatStore.getState().startCombat([entityAt('a', 5)], 'enc1');
      saveSpy.mockClear();
      useCombatStore.getState().addEntities([entityAt('b', 3)]);
      const { combat, entities } = useCombatStore.getState();
      expect(combat.order.map(e => e.entityId).sort()).toEqual(['a', 'b']);
      expect(entities.map(e => e.id).sort()).toEqual(['a', 'b']);
      expect(saveSpy).toHaveBeenCalledTimes(1);
    });

    it('is a no-op when combat is not active', () => {
      useCombatStore.getState().addEntities([entityAt('b', 3)]);
      expect(useCombatStore.getState().entities).toHaveLength(0);
      expect(saveSpy).not.toHaveBeenCalled();
    });

    it('is a no-op for an empty array', () => {
      useCombatStore.getState().startCombat([entityAt('a', 5)], 'enc1');
      saveSpy.mockClear();
      useCombatStore.getState().addEntities([]);
      expect(useCombatStore.getState().entities).toHaveLength(1);
      expect(saveSpy).not.toHaveBeenCalled();
    });
  });

  describe('removeFromEncounter', () => {
    it('removes the entity from BOTH combat.order and entities — no ghost initiative row', () => {
      useCombatStore.getState().startCombat([entityAt('a', 10), entityAt('b', 5)], 'enc1');
      saveSpy.mockClear();
      useCombatStore.getState().removeFromEncounter('b');
      const { combat, entities } = useCombatStore.getState();
      expect(combat.order.map(e => e.entityId)).toEqual(['a']);
      expect(entities.map(e => e.id)).toEqual(['a']);
      expect(saveSpy).toHaveBeenCalledTimes(1);
    });

    it("re-anchors turnIndex when removing an entry ahead of the current turn", () => {
      useCombatStore.getState().startCombat([entityAt('high', 10), entityAt('mid', 5), entityAt('low', 0)], 'enc1');
      // Force turnIndex onto 'low' regardless of roll outcome, to test the pointer re-anchor deterministically.
      useCombatStore.setState(state => ({
        combat: { ...state.combat, turnIndex: state.combat.order.findIndex(e => e.entityId === 'low') },
      }));
      useCombatStore.getState().removeFromEncounter('high');
      const { combat } = useCombatStore.getState();
      expect(combat.order[combat.turnIndex].entityId).toBe('low');
    });

    it('clamps turnIndex when the currently-acting entity itself is removed', () => {
      useCombatStore.getState().startCombat([entityAt('a', 10), entityAt('b', 5)], 'enc1');
      useCombatStore.setState(state => ({ combat: { ...state.combat, turnIndex: 1 } })); // 'b' has the turn (whichever order it landed in)
      const actingId = useCombatStore.getState().combat.order[1].entityId;
      useCombatStore.getState().removeFromEncounter(actingId);
      const { combat } = useCombatStore.getState();
      expect(combat.turnIndex).toBeLessThanOrEqual(Math.max(0, combat.order.length - 1));
      expect(combat.order.find(e => e.entityId === actingId)).toBeUndefined();
    });

    it('safely no-ops removing an id that is not present', () => {
      useCombatStore.getState().startCombat([entityAt('a', 10)], 'enc1');
      expect(() => useCombatStore.getState().removeFromEncounter('missing')).not.toThrow();
      expect(useCombatStore.getState().entities).toHaveLength(1);
    });

    it('still removes from entities even when combat is not active (no crash, no save)', () => {
      useCombatStore.setState({ entities: [entityAt('a', 10)] });
      useCombatStore.getState().removeFromEncounter('a');
      expect(useCombatStore.getState().entities).toHaveLength(0);
      expect(saveSpy).not.toHaveBeenCalled();
    });
  });

  describe('endCombat', () => {
    it('deactivates combat, clears entities, and clears persisted state', () => {
      useCombatStore.getState().startCombat([entityAt('a', 10)], 'enc1');
      useCombatStore.getState().endCombat();
      const { combat, entities } = useCombatStore.getState();
      expect(combat.active).toBe(false);
      expect(entities).toHaveLength(0);
      expect(clearSpy).toHaveBeenCalledTimes(1);
    });
  });
});
