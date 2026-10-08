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
import { useCombatStore, hydrateCombatStateOnBoot } from '../combatStore';
import { useCharacterStore, makeEmptyEntity } from '../characterStore';
import * as combatRepo from '../../db/combatRepo';
import { Entity } from '../../engine/types';
import { applyCondition } from '../../engine/conditions';
import { syncManager } from '../../sync/syncManager';
import { setRandomSource } from '../../engine/dice';

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

    // Table-first: the store's own default is roll:false (manual-first),
    // deliberately distinct from combat.ts's engine-level startEncounter
    // default of true (preserved there for every pre-existing caller/test).
    it('defaults to roll:false — initiative starts at 0, ordered only by tiebreak, until the DM rolls or enters values', () => {
      useCombatStore.getState().startCombat([entityAt('high', 10), entityAt('low', 2)], 'enc1');
      const { combat } = useCombatStore.getState();
      expect(combat.order.every(e => e.initiative === 0)).toBe(true);
      expect(combat.order.map(e => e.entityId)).toEqual(['high', 'low']); // tiebreak (initiative modifier) still orders them
    });

    it('roll:true explicitly still rolls, for a caller that wants the old in-app behavior', () => {
      setRandomSource(() => 0); // d20 roll of 1
      useCombatStore.getState().startCombat([entityAt('a', 5)], 'enc1', undefined, true);
      const { combat } = useCombatStore.getState();
      expect(combat.order[0].initiative).toBe(6); // 1 (die) + 5 (modifier)
      setRandomSource(Math.random);
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

    it('defaults to roll:false — reinforcements seed at initiative 0, same table-first default as startCombat', () => {
      useCombatStore.getState().startCombat([entityAt('a', 5)], 'enc1');
      useCombatStore.getState().addEntities([entityAt('b', 3)]);
      const added = useCombatStore.getState().combat.order.find(e => e.entityId === 'b');
      expect(added?.initiative).toBe(0);
    });

    it('roll:true explicitly still rolls a reinforcement\'s initiative', () => {
      useCombatStore.getState().startCombat([entityAt('a', 5)], 'enc1');
      setRandomSource(() => 0); // d20 roll of 1
      useCombatStore.getState().addEntities([entityAt('b', 3)], true);
      const added = useCombatStore.getState().combat.order.find(e => e.entityId === 'b');
      expect(added?.initiative).toBe(4); // 1 (die) + 3 (modifier)
      setRandomSource(Math.random);
    });
  });

  describe('rollAllInitiative (🎲 Roll All Initiative)', () => {
    it('rolls every current entry and persists', () => {
      useCombatStore.getState().startCombat([entityAt('a', 5), entityAt('b', 2)], 'enc1'); // roll:false → both at 0
      saveSpy.mockClear();
      setRandomSource(() => 0); // d20 roll of 1
      useCombatStore.getState().rollAllInitiative();
      const { combat } = useCombatStore.getState();
      expect(combat.order.every(e => e.initiative !== 0)).toBe(true);
      expect(saveSpy).toHaveBeenCalledTimes(1);
      setRandomSource(Math.random);
    });

    it('is a no-op when combat is not active', () => {
      useCombatStore.getState().rollAllInitiative();
      expect(saveSpy).not.toHaveBeenCalled();
    });
  });

  // ── Closure 1: initiative persistence + active-actor stability ─────────────
  // setOrder/setInitiative used to only update in-memory Zustand state (a
  // manual edit could silently revert on restart) and never re-anchored
  // turnIndex to the entity that actually had the turn (a reorder/resort
  // could silently hand the turn to a different combatant sitting at the
  // same numeric position). Simulates "restart" the same way app/_layout.tsx's
  // real boot restore does: read back whatever the (mocked) persist call was
  // actually given, reset the store to empty, then hydrate from that exact
  // payload — proving the persisted blob itself is correct, not just that a
  // save call fired.
  describe('setInitiative (closure 1: persistence + actor stability)', () => {
    it('persists immediately to the repository save path', () => {
      useCombatStore.getState().startCombat([entityAt('a', 5), entityAt('b', 2)], 'enc1');
      saveSpy.mockClear();
      useCombatStore.getState().setInitiative('a', 17);
      expect(saveSpy).toHaveBeenCalledTimes(1);
      const [savedCombat] = saveSpy.mock.calls[0];
      expect(savedCombat.order.find((e: any) => e.entityId === 'a').initiative).toBe(17);
    });

    it('restart restores the manually entered initiative value', () => {
      useCombatStore.getState().startCombat([entityAt('a', 5), entityAt('b', 2)], 'enc1');
      useCombatStore.getState().setInitiative('a', 17);
      const [savedCombat, savedEntities] = saveSpy.mock.calls[saveSpy.mock.calls.length - 1];

      // Simulate an app restart: wipe the store, then hydrate exactly as
      // app/_layout.tsx's boot restore does from the persisted payload.
      useCombatStore.setState({ combat: { active: false, round: 0, turnIndex: 0, order: [], encounterId: '' }, entities: [] });
      useCombatStore.setState({ combat: savedCombat, entities: savedEntities });

      expect(useCombatStore.getState().combat.order.find(e => e.entityId === 'a')?.initiative).toBe(17);
    });

    it('re-sorts by the new value (pre-existing, intentional UX for a numeric edit)', () => {
      useCombatStore.getState().startCombat([entityAt('low', 0), entityAt('high', 0)], 'enc1');
      useCombatStore.getState().setInitiative('low', 99);
      expect(useCombatStore.getState().combat.order[0].entityId).toBe('low');
    });

    it("re-anchors turnIndex to the currently-acting entity after a numeric edit resorts the order", () => {
      useCombatStore.getState().startCombat([entityAt('a', 10), entityAt('b', 5), entityAt('c', 0)], 'enc1');
      // Force turnIndex onto 'b' regardless of the (roll:false) seed order.
      useCombatStore.setState(state => ({
        combat: { ...state.combat, turnIndex: state.combat.order.findIndex(e => e.entityId === 'b') },
      }));
      // Editing 'c' to a huge value pushes it to the front — 'b' must still be "current."
      useCombatStore.getState().setInitiative('c', 999);
      const { combat } = useCombatStore.getState();
      expect(combat.order[combat.turnIndex].entityId).toBe('b');
    });

    it('is a no-op (no persist) when combat is not active', () => {
      useCombatStore.setState({ entities: [entityAt('a', 5)] }); // combat.order empty/inactive
      useCombatStore.getState().setInitiative('a', 10);
      expect(saveSpy).not.toHaveBeenCalled();
    });
  });

  describe('setOrder (closure 1: persistence + actor stability + explicit-order authority)', () => {
    it('persists immediately to the repository save path', () => {
      useCombatStore.getState().startCombat([entityAt('a', 5), entityAt('b', 2)], 'enc1');
      saveSpy.mockClear();
      const swapped = [...useCombatStore.getState().combat.order].reverse();
      useCombatStore.getState().setOrder(swapped);
      expect(saveSpy).toHaveBeenCalledTimes(1);
      const [savedCombat] = saveSpy.mock.calls[0];
      expect(savedCombat.order.map((e: any) => e.entityId)).toEqual(swapped.map(e => e.entityId));
    });

    it('an explicit manual order may disagree with numeric initiative values and is never silently re-sorted', () => {
      useCombatStore.getState().startCombat([entityAt('a', 5), entityAt('b', 2)], 'enc1');
      // Deliberately out of numeric order: 'low' (initiative 1) placed AHEAD of 'high' (initiative 20).
      const manualOrder = [
        { entityId: 'low',  name: 'low',  initiative: 1,  tiebreak: 0, isPlayer: true, hasTakenTurn: false },
        { entityId: 'high', name: 'high', initiative: 20, tiebreak: 0, isPlayer: true, hasTakenTurn: false },
      ];
      useCombatStore.getState().setOrder(manualOrder);
      expect(useCombatStore.getState().combat.order.map(e => e.entityId)).toEqual(['low', 'high']); // NOT re-sorted to ['high','low']
    });

    it('an explicit disagreeing order survives a simulated restart exactly as entered', () => {
      useCombatStore.getState().startCombat([entityAt('a', 5), entityAt('b', 2)], 'enc1');
      const manualOrder = [
        { entityId: 'low',  name: 'low',  initiative: 1,  tiebreak: 0, isPlayer: true, hasTakenTurn: false },
        { entityId: 'high', name: 'high', initiative: 20, tiebreak: 0, isPlayer: true, hasTakenTurn: false },
      ];
      useCombatStore.getState().setOrder(manualOrder);
      const [savedCombat, savedEntities] = saveSpy.mock.calls[saveSpy.mock.calls.length - 1];

      useCombatStore.setState({ combat: { active: false, round: 0, turnIndex: 0, order: [], encounterId: '' }, entities: [] });
      useCombatStore.setState({ combat: savedCombat, entities: savedEntities });

      expect(useCombatStore.getState().combat.order.map(e => e.entityId)).toEqual(['low', 'high']);
    });

    it('current actor remains the same entity after a manual reorder (up/down swap)', () => {
      useCombatStore.getState().startCombat([entityAt('a', 10), entityAt('b', 5), entityAt('c', 0)], 'enc1');
      useCombatStore.setState(state => ({
        combat: { ...state.combat, turnIndex: state.combat.order.findIndex(e => e.entityId === 'b') },
      }));
      // Move 'a' from the front to the back, same shape as encounter.tsx's swap().
      const order = [...useCombatStore.getState().combat.order];
      const aIdx = order.findIndex(e => e.entityId === 'a');
      const reordered = [...order.slice(0, aIdx), ...order.slice(aIdx + 1), order[aIdx]];
      useCombatStore.getState().setOrder(reordered);
      const { combat } = useCombatStore.getState();
      expect(combat.order[combat.turnIndex].entityId).toBe('b');
    });

    it('is a no-op (no persist) when combat is not active', () => {
      useCombatStore.getState().setOrder([]);
      expect(saveSpy).not.toHaveBeenCalled();
    });
  });

  describe('active-actor stability across the remaining order-changing actions', () => {
    it('rollAllInitiative keeps the same current actor even after the re-roll changes positions', () => {
      useCombatStore.getState().startCombat([entityAt('a', 10), entityAt('b', 5), entityAt('c', 0)], 'enc1');
      useCombatStore.setState(state => ({
        combat: { ...state.combat, turnIndex: state.combat.order.findIndex(e => e.entityId === 'b') },
      }));
      setRandomSource(() => 0.99); // near-max roll for everyone
      useCombatStore.getState().rollAllInitiative();
      const { combat } = useCombatStore.getState();
      expect(combat.order[combat.turnIndex].entityId).toBe('b');
      setRandomSource(Math.random);
    });

    it('adding reinforcements preserves the current actor', () => {
      useCombatStore.getState().startCombat([entityAt('a', 10), entityAt('b', 5)], 'enc1');
      useCombatStore.setState(state => ({
        combat: { ...state.combat, turnIndex: state.combat.order.findIndex(e => e.entityId === 'b') },
      }));
      useCombatStore.getState().addEntities([entityAt('reinforcement', 999)], true); // rolls in ahead of everyone
      const { combat } = useCombatStore.getState();
      expect(combat.order[combat.turnIndex].entityId).toBe('b');
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

    // Closure 2E (pre-combat roster lifecycle): this used to assert "no
    // save" here — a removal from the pre-combat setup roster (combat not
    // yet active) silently never persisted, so the removed entry could
    // reappear on restart. The product decision (see addToRoster's own doc
    // comment) is that the pre-combat roster IS a persisted state, the same
    // repository row an active encounter already uses — so removing from it
    // must persist too, not just additions.
    it('removes from entities even when combat is not active, and persists that too', () => {
      useCombatStore.setState({ entities: [entityAt('a', 10)] });
      useCombatStore.getState().removeFromEncounter('a');
      expect(useCombatStore.getState().entities).toHaveLength(0);
      expect(saveSpy).toHaveBeenCalledTimes(1);
      const [, savedEntities] = saveSpy.mock.calls[0];
      expect(savedEntities).toHaveLength(0);
    });
  });

  describe('addToRoster (closure 2E: pre-combat roster persistence)', () => {
    it('adds an entity to the pre-combat roster and persists immediately, before Start Combat', () => {
      useCombatStore.getState().addToRoster(entityAt('a', 5));
      expect(useCombatStore.getState().entities.map(e => e.id)).toEqual(['a']);
      expect(saveSpy).toHaveBeenCalledTimes(1);
      const [savedCombat, savedEntities] = saveSpy.mock.calls[0];
      expect(savedCombat.active).toBe(false); // no encounter started yet
      expect(savedEntities.map((e: Entity) => e.id)).toEqual(['a']);
    });

    it('is idempotent — adding the same entity id twice does not duplicate or re-persist', () => {
      useCombatStore.getState().addToRoster(entityAt('a', 5));
      saveSpy.mockClear();
      useCombatStore.getState().addToRoster(entityAt('a', 5));
      expect(useCombatStore.getState().entities).toHaveLength(1);
      expect(saveSpy).not.toHaveBeenCalled();
    });

    it('the pre-combat roster survives a simulated restart (entities present, combat inactive)', () => {
      useCombatStore.getState().addToRoster(entityAt('a', 5));
      useCombatStore.getState().addToRoster(entityAt('b', 2));
      const [savedCombat, savedEntities] = saveSpy.mock.calls[saveSpy.mock.calls.length - 1];

      // Simulate the exact app/_layout.tsx boot-restore condition: entities
      // present restores regardless of combat.active.
      useCombatStore.setState({ combat: { active: false, round: 0, turnIndex: 0, order: [], encounterId: '' }, entities: [] });
      if (savedEntities.length > 0) {
        useCombatStore.setState({ combat: savedCombat, entities: savedEntities });
      }

      expect(useCombatStore.getState().entities.map(e => e.id).sort()).toEqual(['a', 'b']);
    });

    // Closure 2: a manually/table-entered monster HP value (spawned via
    // app/dm/monsters.tsx's "Table-Rolled" mode, resolveMonsterHp('manual', ...))
    // must round-trip through persistence exactly — restart must never
    // silently reroll or fall back to the printed average.
    it('a manually-chosen monster HP survives a simulated restart unchanged', () => {
      const monster = { ...entityAt('boss', 0), resources: { ...entityAt('boss', 0).resources, hp: { current: 77, maximum: 77, temp: 0 } } };
      useCombatStore.getState().addToRoster(monster);
      const [savedCombat, savedEntities] = saveSpy.mock.calls[saveSpy.mock.calls.length - 1];

      useCombatStore.setState({ combat: { active: false, round: 0, turnIndex: 0, order: [], encounterId: '' }, entities: [] });
      useCombatStore.setState({ combat: savedCombat, entities: savedEntities });

      const restored = useCombatStore.getState().entities.find(e => e.id === 'boss');
      expect(restored?.resources.hp).toEqual({ current: 77, maximum: 77, temp: 0 }); // exact, not average, not rerolled
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

  // ── Closure 1: active-combat hydration race ─────────────────────────────
  // hydrateCombatStateOnBoot is the exact function app/_layout.tsx's boot
  // sequence now `await`s before releasing the boot screen — extracted out
  // of that component specifically so it's testable here with a genuinely
  // asynchronous loadCombatState (a manually-controlled Promise the test
  // resolves on its own schedule), not a synchronously-resolved mock that
  // could hide a real ordering bug.
  describe('hydrateCombatStateOnBoot (closure 1: active-combat hydration race)', () => {
    let loadSpy: jest.SpyInstance;

    beforeEach(() => {
      loadSpy = jest.spyOn(combatRepo, 'loadCombatState');
    });

    it('restores an active encounter (combat.active true, entities present)', async () => {
      const persisted = {
        combat: { active: true, round: 2, turnIndex: 1, order: [{ entityId: 'a', name: 'a', initiative: 10, tiebreak: 0, isPlayer: true, hasTakenTurn: false }], encounterId: 'enc1' },
        entities: [entityAt('a', 10)],
      };
      loadSpy.mockResolvedValue(persisted);
      await hydrateCombatStateOnBoot();
      expect(useCombatStore.getState().combat).toEqual(persisted.combat);
      expect(useCombatStore.getState().entities.map(e => e.id)).toEqual(['a']);
    });

    it('restores an inactive pre-combat roster (combat.active false, entities present)', async () => {
      const persisted = {
        combat: { active: false, round: 0, turnIndex: 0, order: [], encounterId: '' },
        entities: [entityAt('a', 5), entityAt('b', 2)],
      };
      loadSpy.mockResolvedValue(persisted);
      await hydrateCombatStateOnBoot();
      expect(useCombatStore.getState().combat.active).toBe(false);
      expect(useCombatStore.getState().entities.map(e => e.id).sort()).toEqual(['a', 'b']);
    });

    it('clears a stale active state with zero entities instead of restoring a broken screen', async () => {
      loadSpy.mockResolvedValue({ combat: { active: true, round: 3, turnIndex: 0, order: [], encounterId: 'stale' }, entities: [] });
      await hydrateCombatStateOnBoot();
      // Not applied to the store — stays at whatever default the store already had.
      expect(useCombatStore.getState().combat.active).toBe(false);
      expect(clearSpy).toHaveBeenCalledTimes(1);
    });

    it('is a no-op when nothing was persisted', async () => {
      loadSpy.mockResolvedValue(null);
      await hydrateCombatStateOnBoot();
      expect(useCombatStore.getState().combat.active).toBe(false);
      expect(useCombatStore.getState().entities).toHaveLength(0);
      expect(clearSpy).not.toHaveBeenCalled();
    });

    it('never throws, even if loadCombatState rejects — a boot that cannot read combat state just starts with none', async () => {
      loadSpy.mockRejectedValue(new Error('disk error'));
      await expect(hydrateCombatStateOnBoot()).resolves.toBeUndefined();
    });

    // The actual race this closure fixes: a fire-and-forget restore let a
    // "boot ready" flag flip before the store was actually updated. This
    // proves the FIXED pattern (await hydrateCombatStateOnBoot(); ...; ready
    // = true) can never release "ready" before the store reflects the
    // persisted state — using a real, test-controlled async resolution
    // (not a synchronous mock) so the ordering assertion is meaningful.
    it('does not let a "boot ready" flag release before the store reflects the restored active encounter', async () => {
      let resolveLoad!: (v: any) => void;
      const deferred = new Promise(resolve => { resolveLoad = resolve; });
      loadSpy.mockReturnValue(deferred as any);

      let ready = false;
      // Mirrors app/_layout.tsx's actual fixed pattern: await the restore,
      // THEN flip ready — never the other way around.
      const bootPromise = hydrateCombatStateOnBoot().then(() => { ready = true; });

      // Hydration hasn't resolved yet — store must still be untouched and
      // "ready" must still be false, proving this is a genuine race, not a
      // same-tick synchronous resolution.
      await Promise.resolve(); // let any already-queued microtasks flush
      expect(useCombatStore.getState().combat.active).toBe(false);
      expect(ready).toBe(false);

      // Now let the persisted load resolve, well after "boot work" began.
      resolveLoad({
        combat: { active: true, round: 1, turnIndex: 0, order: [{ entityId: 'a', name: 'a', initiative: 10, tiebreak: 0, isPlayer: true, hasTakenTurn: false }], encounterId: 'enc1' },
        entities: [entityAt('a', 10)],
      });
      await bootPromise;

      expect(useCombatStore.getState().combat.active).toBe(true);
      expect(ready).toBe(true);
    });
  });
});
