// src/store/__tests__/pendingSelectionStore.test.ts
import { usePendingSelectionStore } from '../pendingSelectionStore';

beforeEach(() => {
  usePendingSelectionStore.setState({ pending: {} });
});

describe('pendingSelectionStore', () => {
  it('consumePending returns null when nothing is pending for that screen', () => {
    expect(usePendingSelectionStore.getState().consumePending('race_picker')).toBeNull();
  });

  it('setPending then consumePending returns the id exactly once', () => {
    const { setPending, consumePending } = usePendingSelectionStore.getState();
    setPending('race_picker', 'human_2024');
    expect(consumePending('race_picker')).toBe('human_2024');
    // one-shot — a second consume finds nothing left
    expect(consumePending('race_picker')).toBeNull();
  });

  it('keeps pending selections for different screens independent', () => {
    const { setPending, consumePending } = usePendingSelectionStore.getState();
    setPending('race_picker', 'r1');
    setPending('spell_picker', 's1');
    expect(consumePending('spell_picker')).toBe('s1');
    // race_picker's entry is untouched by consuming spell_picker's
    expect(consumePending('race_picker')).toBe('r1');
  });
});
