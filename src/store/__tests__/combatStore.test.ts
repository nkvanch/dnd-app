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
import { useCharacterStore, makeEmptyEntity } from '../characterStore';
import * as combatRepo from '../../db/combatRepo';
import { Entity } from '../../engine/types';
import { applyCondition } from '../../engine/conditions';
import { syncManager } from '../../sync/syncManager';

function entityAt(id: string, initiativeBonus: number): Entity {
  const e = makeEmptyEntity(id, 'monster');
  return { ...e, identity: { ...e.identity, name: id }, derived: { ...e.derived, initiative: initiativeBonus } };
}

function characterAt(id: string, initiativeBonus: number): Entity {
  const e = makeEmptyEntity(id, 'character');
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
      lastPersistError: null,
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

  describe('updateEntity', () => {
    it('persists the change when combat is active (PERSIST-2 regression)', () => {
      useCombatStore.getState().startCombat([entityAt('a', 10)], 'enc1');
      saveSpy.mockClear();
      useCombatStore.getState().updateEntity('a', e => ({ ...e, identity: { ...e.identity, name: 'Damaged A' } }));
      expect(useCombatStore.getState().entities[0].identity.name).toBe('Damaged A');
      expect(saveSpy).toHaveBeenCalledTimes(1);
      const [, savedEntities] = saveSpy.mock.calls[0];
      expect(savedEntities[0].identity.name).toBe('Damaged A');
    });

    it('does not persist when combat is not active', () => {
      useCombatStore.setState({ entities: [entityAt('a', 10)] });
      useCombatStore.getState().updateEntity('a', e => ({ ...e, identity: { ...e.identity, name: 'X' } }));
      expect(saveSpy).not.toHaveBeenCalled();
    });
  });

  describe('advanceTurn — ticked entities sync to characterStore (SYNC-COMBAT-1 sub-path c)', () => {
    afterEach(() => {
      useCharacterStore.setState({ characters: [] });
    });

    it('merges a rounds-based condition tick onto characterStore, not just combatStore', () => {
      // 'a' (initiative 10) acts before 'b' (initiative 5) — advanceTurn
      // ends 'a's turn, which is what ticks 'a's own condition duration
      // (tickDurations ticks the entity whose turn just ENDED).
      const a = applyCondition(characterAt('a', 10), 'poisoned', 'test', undefined, undefined, { unit: 'rounds', remaining: 1 });
      const b = characterAt('b', 5);
      useCharacterStore.setState({ characters: [a, b] });

      useCombatStore.getState().startCombat([a, b], 'enc1');
      // startCombat re-rolled initiative onto fresh copies — read the
      // actual post-start combatStore entity (with the condition intact)
      // back out rather than assuming order.
      expect(useCombatStore.getState().entities.find(e => e.id === 'a')!.conditions).toHaveLength(1);
      // Force turnIndex onto 'a' regardless of roll outcome (same
      // deterministic-test pattern the removeFromEncounter suite above
      // already uses) — advanceTurn ticks whoever's turn just ENDED, so
      // this guarantees it's 'a's condition being ticked, not 'b's.
      useCombatStore.setState(state => ({
        combat: { ...state.combat, turnIndex: state.combat.order.findIndex(e => e.entityId === 'a') },
      }));

      useCombatStore.getState().advanceTurn();

      const combatEntityA = useCombatStore.getState().entities.find(e => e.id === 'a')!;
      const storeEntityA  = useCharacterStore.getState().characters.find(c => c.id === 'a')!;
      // The condition expired (1 round remaining, ticked to 0) on BOTH —
      // before this fix, only combatStore's own copy ever reflected it.
      expect(combatEntityA.conditions).toHaveLength(0);
      expect(storeEntityA.conditions).toHaveLength(0);
    });

    it('does not touch characterStore for a monster-kind entity (nothing to merge onto)', () => {
      const a = entityAt('a', 10);
      const b = entityAt('b', 5);
      useCharacterStore.setState({ characters: [] });

      useCombatStore.getState().startCombat([a, b], 'enc1');
      expect(() => useCombatStore.getState().advanceTurn()).not.toThrow();
      expect(useCharacterStore.getState().characters).toHaveLength(0);
    });
  });

  describe('lastPersistError — surfaces SQLite write failures instead of only logging them (PERSIST-5)', () => {
    it('sets lastPersistError when saveCombatState rejects, and clears it on the next successful save', () => {
      saveSpy.mockRejectedValueOnce(new Error('disk full'));
      useCombatStore.getState().startCombat([entityAt('a', 10)], 'enc1');
      return Promise.resolve().then(() => {
        expect(useCombatStore.getState().lastPersistError).not.toBeNull();

        saveSpy.mockResolvedValueOnce(undefined);
        useCombatStore.getState().addEntities([entityAt('b', 5)]);
        return Promise.resolve().then(() => {
          expect(useCombatStore.getState().lastPersistError).toBeNull();
        });
      });
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

  // Player turn banner (item 8): combatStore pushes "whose turn is it" to
  // connected players via syncManager on every state-changing action.
  // syncManager.broadcastCombatTurn is itself a no-op unless this device's
  // role is 'dm' with a live server (see syncManager.ts) — these tests spy
  // on it directly rather than standing up a real server/client pair, since
  // the actual transport is already covered by sync's own test suite; this
  // file's job is proving combatStore calls it with the right payload at
  // the right times.
  describe('broadcastTurn (player live-play turn banner)', () => {
    let broadcastSpy: jest.SpyInstance;

    beforeEach(() => {
      broadcastSpy = jest.spyOn(syncManager, 'broadcastCombatTurn').mockImplementation(() => {});
    });

    it('startCombat broadcasts the first actor as current', () => {
      // Deterministic: single entity, so it's unambiguously first in initiative.
      useCombatStore.getState().startCombat([entityAt('a', 10)], 'enc1');
      expect(broadcastSpy).toHaveBeenCalledWith({ active: true, round: 1, currentEntityId: 'a', currentName: 'a' });
    });

    it('advanceTurn broadcasts the new current actor and round', () => {
      useCombatStore.getState().startCombat([entityAt('a', 10), entityAt('b', 5)], 'enc1');
      broadcastSpy.mockClear();
      useCombatStore.getState().advanceTurn();
      const { combat } = useCombatStore.getState();
      const nowActing = combat.order[combat.turnIndex].entityId;
      expect(broadcastSpy).toHaveBeenCalledWith({ active: true, round: combat.round, currentEntityId: nowActing, currentName: nowActing });
    });

    it('endCombat broadcasts active:false with no current actor', () => {
      useCombatStore.getState().startCombat([entityAt('a', 10)], 'enc1');
      broadcastSpy.mockClear();
      useCombatStore.getState().endCombat();
      expect(broadcastSpy).toHaveBeenCalledWith({ active: false, round: 0, currentEntityId: null, currentName: null });
    });

    it('removeFromEncounter broadcasts the re-anchored current actor when combat is active', () => {
      useCombatStore.getState().startCombat([entityAt('a', 10), entityAt('b', 5)], 'enc1');
      broadcastSpy.mockClear();
      useCombatStore.getState().removeFromEncounter('b');
      const { combat } = useCombatStore.getState();
      expect(broadcastSpy).toHaveBeenCalledWith(expect.objectContaining({ currentEntityId: combat.order[combat.turnIndex]?.entityId ?? null }));
    });

    it('does not broadcast when removeFromEncounter runs with combat inactive', () => {
      useCombatStore.setState({ entities: [entityAt('a', 10)] });
      useCombatStore.getState().removeFromEncounter('a');
      expect(broadcastSpy).not.toHaveBeenCalled();
    });
  });
});
