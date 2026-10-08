// src/store/__tests__/encounterStore.test.ts
// Closure 2 (Review/Start save race): trySavePreparedEncounter is the ONE
// shared "validate, then save, then report success" function
// app/dm/encounter-builder.tsx's Save and Review/Start actions both funnel
// through — extracted specifically so this race can be tested with a
// GENUINELY asynchronous, manually-controlled saveEncounter mock (not a
// synchronously-resolved one, which would never expose the actual bug: a
// caller navigating before the save had really finished). Since the route
// file itself can't be imported into Jest (expo-router's useRouter at
// module scope — see app/creation/__tests__/hubProgress.test.ts's own doc
// comment for the same, already-diagnosed constraint), these tests model
// handleReviewAndStart's own control flow directly against the real
// trySavePreparedEncounter — validate → await save → navigate only on a
// genuine success — using a `navigate` counter in place of router.push.
import { useEncounterStore, trySavePreparedEncounter } from '../encounterStore';
import { newPreparedEncounter, newPreparedCombatant } from '../../engine/preparedEncounter';
import * as encounterRepo from '../../db/encounterRepo';
import { PreparedEncounter } from '../../engine/types';

function preparedWithManualHp(manualHp: number | undefined): PreparedEncounter {
  return {
    ...newPreparedEncounter('Test Fight'),
    combatants: [{ ...newPreparedCombatant('test_goblin'), hpMode: 'manual', manualHp }],
  };
}

describe('trySavePreparedEncounter', () => {
  let saveSpy: jest.SpyInstance;

  beforeEach(() => {
    useEncounterStore.setState({ encounters: [], isLoading: false });
    saveSpy = jest.spyOn(encounterRepo, 'saveEncounter');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('invalid manual HP: never calls saveEncounter at all, returns {ok:false, reason:"invalid"}', async () => {
    saveSpy.mockResolvedValue(undefined);
    const prepared = preparedWithManualHp(undefined);
    const result = await trySavePreparedEncounter(prepared);
    expect(result).toEqual({ ok: false, reason: 'invalid' });
    expect(saveSpy).not.toHaveBeenCalled();
    expect(useEncounterStore.getState().encounters).toHaveLength(0); // store untouched
  });

  it('manualHp=0: also invalid — never calls saveEncounter', async () => {
    saveSpy.mockResolvedValue(undefined);
    const prepared = preparedWithManualHp(0);
    const result = await trySavePreparedEncounter(prepared);
    expect(result).toEqual({ ok: false, reason: 'invalid' });
    expect(saveSpy).not.toHaveBeenCalled();
  });

  it('a valid draft saves successfully and the store reflects it once the promise resolves', async () => {
    saveSpy.mockResolvedValue(undefined);
    const prepared = preparedWithManualHp(27);
    const result = await trySavePreparedEncounter(prepared);
    expect(result).toEqual({ ok: true });
    expect(saveSpy).toHaveBeenCalledTimes(1);
    expect(useEncounterStore.getState().encounters.find(e => e.id === prepared.id)?.combatants[0].manualHp).toBe(27);
  });

  it('save failure: returns {ok:false, reason:"save-failed"}, store is not updated, and it never throws', async () => {
    saveSpy.mockRejectedValue(new Error('disk full'));
    const prepared = preparedWithManualHp(27);
    await expect(trySavePreparedEncounter(prepared)).resolves.toEqual({ ok: false, reason: 'save-failed' });
    expect(useEncounterStore.getState().encounters).toHaveLength(0);
  });

  it('the latest draft is what gets saved — a newer manualHp overwrites a previously-saved older value', async () => {
    saveSpy.mockResolvedValue(undefined);
    // Previously saved: manualHp 10.
    await trySavePreparedEncounter(preparedWithManualHp(10));
    expect(useEncounterStore.getState().encounters[0].combatants[0].manualHp).toBe(10);

    // The current draft (what the DM is actually looking at) has since
    // been edited to 27 — saving THIS draft must persist 27, not silently
    // keep 10.
    const current = { ...useEncounterStore.getState().encounters[0], combatants: [{ ...useEncounterStore.getState().encounters[0].combatants[0], manualHp: 27 }] };
    const result = await trySavePreparedEncounter(current);
    expect(result).toEqual({ ok: true });
    expect(useEncounterStore.getState().encounters[0].combatants[0].manualHp).toBe(27); // not 10
  });

  // The actual race this closure fixes: navigation must never happen
  // before the store genuinely reflects a successful save. Uses a real,
  // test-controlled async resolution (not a synchronous mock) so the
  // ordering assertion is meaningful — mirrors combatStore.ts's own
  // hydration-race test pattern.
  it('does not resolve until the (genuinely async) save has actually landed in the store', async () => {
    let resolveSave!: () => void;
    const deferred = new Promise<void>(resolve => { resolveSave = resolve; });
    saveSpy.mockReturnValue(deferred);

    const prepared = preparedWithManualHp(27);
    let resolved = false;
    const pending = trySavePreparedEncounter(prepared).then(r => { resolved = true; return r; });

    // The underlying saveEncounter call hasn't resolved yet — neither the
    // wrapper's own promise nor the store should reflect success.
    await Promise.resolve();
    expect(resolved).toBe(false);
    expect(useEncounterStore.getState().encounters).toHaveLength(0);

    resolveSave();
    const result = await pending;

    expect(resolved).toBe(true);
    expect(result).toEqual({ ok: true });
    expect(useEncounterStore.getState().encounters[0]?.combatants[0]?.manualHp).toBe(27);
  });
});

// ── Models handleReviewAndStart's own control flow (encounter-builder.tsx) ──
// Since the route file can't be imported into Jest, this exercises the
// SAME shape of logic it actually runs — validate → await
// trySavePreparedEncounter → navigate only on a genuine {ok:true} — against
// the real trySavePreparedEncounter, with a `navigate` counter standing in
// for router.push. Anything that would make Review/Start behave wrong
// (navigating early, navigating on failure, navigating on invalid input,
// double-navigating on a double-tap) shows up here as a wrong call count.
describe('Review/Start control flow (models handleReviewAndStart)', () => {
  let saveSpy: jest.SpyInstance;

  beforeEach(() => {
    useEncounterStore.setState({ encounters: [], isLoading: false });
    saveSpy = jest.spyOn(encounterRepo, 'saveEncounter');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  async function reviewAndStart(prepared: PreparedEncounter, navigate: () => void): Promise<void> {
    const result = await trySavePreparedEncounter(prepared);
    if (!result.ok) return; // trySave's caller shows an alert; never navigates
    navigate();
  }

  it('does not navigate while the save Promise is unresolved', async () => {
    let resolveSave!: () => void;
    const deferred = new Promise<void>(resolve => { resolveSave = resolve; });
    saveSpy.mockReturnValue(deferred);

    let navigateCalls = 0;
    const pending = reviewAndStart(preparedWithManualHp(27), () => { navigateCalls++; });

    await Promise.resolve();
    expect(navigateCalls).toBe(0);

    resolveSave();
    await pending;
    expect(navigateCalls).toBe(1);
  });

  it('navigates exactly once after a successful save', async () => {
    saveSpy.mockResolvedValue(undefined);
    let navigateCalls = 0;
    await reviewAndStart(preparedWithManualHp(27), () => { navigateCalls++; });
    expect(navigateCalls).toBe(1);
  });

  it('does not navigate when the save fails', async () => {
    saveSpy.mockRejectedValue(new Error('disk full'));
    let navigateCalls = 0;
    await reviewAndStart(preparedWithManualHp(27), () => { navigateCalls++; });
    expect(navigateCalls).toBe(0);
  });

  it('invalid manual HP: neither saveEncounter nor navigate is ever called', async () => {
    saveSpy.mockResolvedValue(undefined);
    let navigateCalls = 0;
    await reviewAndStart(preparedWithManualHp(undefined), () => { navigateCalls++; });
    expect(saveSpy).not.toHaveBeenCalled();
    expect(navigateCalls).toBe(0);
  });

  it('a double-tap while a save is already in flight does not double-navigate (the real handler additionally guards on a `saving` flag before calling this at all)', async () => {
    let resolveSave!: () => void;
    const deferred = new Promise<void>(resolve => { resolveSave = resolve; });
    saveSpy.mockReturnValue(deferred);

    let navigateCalls = 0;
    let saving = false;
    async function tap(prepared: PreparedEncounter) {
      if (saving) return; // the exact reentrancy guard encounter-builder.tsx's trySave() applies
      saving = true;
      try {
        await reviewAndStart(prepared, () => { navigateCalls++; });
      } finally {
        saving = false;
      }
    }

    const first = tap(preparedWithManualHp(27));
    const second = tap(preparedWithManualHp(27)); // fired while the first is still in flight — a no-op

    resolveSave();
    await Promise.all([first, second]);

    expect(navigateCalls).toBe(1); // not 2
    expect(saveSpy).toHaveBeenCalledTimes(1); // not 2
  });
});
