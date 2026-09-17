// ============================================================================
// FILE: src/store/__tests__/homebrewStore.test.ts
// First coverage for this file. Regression lock for audit finding
// CONTENT-REGISTRY-PERF-1: getMergedContentDB() previously re-ran the full
// official+homebrew merge on every call with no caching, even when nothing
// in the store had changed since the last call — confirmed via audit as a
// significant redundant-work source across many render-body callers.
// ============================================================================
import { useHomebrewStore } from '../homebrewStore';

describe('homebrewStore.getMergedContentDB caching (CONTENT-REGISTRY-PERF-1)', () => {
  beforeEach(() => {
    useHomebrewStore.setState({
      races: [], subraces: [], classes: [], subclasses: [], spells: [],
      backgrounds: [], features: [], items: [], feats: [], monsters: [], conditions: [],
    });
  });

  it('returns the identical object reference on repeated calls when nothing changed', () => {
    const first  = useHomebrewStore.getState().getMergedContentDB();
    const second = useHomebrewStore.getState().getMergedContentDB();
    expect(second).toBe(first);
  });

  it('returns a fresh, updated result after the store state actually changes', () => {
    const before = useHomebrewStore.getState().getMergedContentDB();

    useHomebrewStore.setState(state => ({
      conditions: [...state.conditions, { id: 'hb_cond', name: 'Test Condition', description: '', features: [] }],
    }));

    const after = useHomebrewStore.getState().getMergedContentDB();
    expect(after).not.toBe(before);
    expect(after.conditions.some(c => c.id === 'hb_cond')).toBe(true);
    expect(before.conditions.some(c => c.id === 'hb_cond')).toBe(false);
  });

  it('cache hit is scoped to matching activeRuleset/bannedIds arguments', () => {
    const noArgs      = useHomebrewStore.getState().getMergedContentDB();
    const withBanned  = useHomebrewStore.getState().getMergedContentDB(undefined, new Set(['x']));
    expect(withBanned).not.toBe(noArgs);
    // A second call with a DIFFERENT (but equivalent) Set object still misses —
    // documents the known, accepted limitation for callers building a fresh
    // Set every call, rather than silently asserting it caches when it can't.
    const withBanned2 = useHomebrewStore.getState().getMergedContentDB(undefined, new Set(['x']));
    expect(withBanned2).not.toBe(withBanned);
  });
});
