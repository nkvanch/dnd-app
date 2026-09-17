// src/store/__tests__/browseStateStore.test.ts
import { useBrowseStateStore } from '../browseStateStore';

beforeEach(() => {
  useBrowseStateStore.setState({ states: {} });
});

describe('browseStateStore', () => {
  it('getBrowseState returns an empty object for a screen with no stored state', () => {
    expect(useBrowseStateStore.getState().getBrowseState('race')).toEqual({});
  });

  it('setBrowseState merges a patch into the existing state for that screen only', () => {
    const { setBrowseState, getBrowseState } = useBrowseStateStore.getState();
    setBrowseState('race', { search: 'elf' });
    setBrowseState('race', { sort: 'name_desc' });
    setBrowseState('class', { search: 'wizard' });
    expect(getBrowseState('race')).toEqual({ search: 'elf', sort: 'name_desc' });
    expect(getBrowseState('class')).toEqual({ search: 'wizard' });
  });

  it('state survives independent of any component mount cycle — plain store state, not React state', () => {
    useBrowseStateStore.getState().setBrowseState('spell', { search: 'fireball', filters: { school: 'Evocation' } });
    // Simulate "navigating away and back" — nothing re-initializes the store between these two reads.
    const first  = useBrowseStateStore.getState().getBrowseState('spell');
    const second = useBrowseStateStore.getState().getBrowseState('spell');
    expect(first).toEqual(second);
    expect(second.filters).toEqual({ school: 'Evocation' });
  });

  it('clearBrowseState removes only the named screen\'s state', () => {
    const { setBrowseState, clearBrowseState, getBrowseState } = useBrowseStateStore.getState();
    setBrowseState('race', { search: 'elf' });
    setBrowseState('class', { search: 'wizard' });
    clearBrowseState('race');
    expect(getBrowseState('race')).toEqual({});
    expect(getBrowseState('class')).toEqual({ search: 'wizard' });
  });
});
