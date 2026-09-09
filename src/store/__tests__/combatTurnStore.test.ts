// src/store/__tests__/combatTurnStore.test.ts
// First test coverage for this store — trivial by design (a thin Zustand
// wrapper around setTurn), but locks in the default (inactive, nothing to
// show) state a freshly-booted player device should start in before any
// combat_turn_state message ever arrives.
import { useCombatTurnStore } from '../combatTurnStore';

describe('combatTurnStore', () => {
  afterEach(() => {
    useCombatTurnStore.setState({ active: false, round: 0, currentEntityId: null, currentName: null });
  });

  it('defaults to inactive with no current actor', () => {
    const state = useCombatTurnStore.getState();
    expect(state.active).toBe(false);
    expect(state.round).toBe(0);
    expect(state.currentEntityId).toBeNull();
    expect(state.currentName).toBeNull();
  });

  it('setTurn replaces the whole turn summary', () => {
    useCombatTurnStore.getState().setTurn({ active: true, round: 3, currentEntityId: 'e1', currentName: 'Goblin' });
    const state = useCombatTurnStore.getState();
    expect(state.active).toBe(true);
    expect(state.round).toBe(3);
    expect(state.currentEntityId).toBe('e1');
    expect(state.currentName).toBe('Goblin');
  });
});
