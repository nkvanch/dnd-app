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

  // Combat/Spells crash closure: reproduced live (web preview) as a genuine
  // "Maximum update depth exceeded" on both tabs. Root cause — a single-
  // entry cache means two call sites in the SAME render tree using
  // different argument shapes (e.g. TabCharacter.tsx's useCardContent
  // selector calling `getMergedContentDB(entity.rulesetId)`, while its
  // child LevelUpSection calls `getMergedContentDB()` with no args in its
  // own render body) permanently evict each other's entry. When Zustand's
  // useSyncExternalStore machinery re-invokes the ORIGINAL selector right
  // after commit to verify the snapshot is stable, it gets a cache miss,
  // recomputes, and returns a NEW object reference — which React reads as
  // "the snapshot changed since render," forcing an infinite re-render
  // loop. This locks in that alternating argument shapes no longer thrash
  // a shared cache slot.
  it('two different argument shapes both stay cached when interleaved (no thrashing)', () => {
    const ruleset = 'dnd5e-2014' as any;
    const scopedFirst = useHomebrewStore.getState().getMergedContentDB(ruleset);
    const bareFirst   = useHomebrewStore.getState().getMergedContentDB();
    // Re-request the FIRST shape after a DIFFERENT-shape call landed in
    // between — before the multi-entry cache, this alone was enough to
    // evict and force a fresh (differently-referenced) recompute forever.
    const scopedAgain = useHomebrewStore.getState().getMergedContentDB(ruleset);
    const bareAgain   = useHomebrewStore.getState().getMergedContentDB();
    expect(scopedAgain).toBe(scopedFirst);
    expect(bareAgain).toBe(bareFirst);
  });
});
