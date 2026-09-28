// src/store/__tests__/characterStore.test.ts
// First test coverage for this store. Covers Phase A (undo-stack push,
// undo()/redo() pop/push symmetry, the stack cap, redo cleared by a new
// mutation) and Phase B (the persistent timeline write is fire-and-forget
// and never blocks the synchronous state update) of the undo/redo +
// mechanical timeline track.
import { useCharacterStore, makeEmptyEntity } from '../characterStore';
import { Entity } from '../../engine/types';
import * as timelineRepo from '../../db/timelineRepo';
import * as entityRepo from '../../db/entityRepo';
import * as draftRepo from '../../db/draftRepo';
import { syncManager } from '../../sync/syncManager';

// updateCharacter/undo/redo all call scheduleSave(), which debounces a real
// SQLite write behind a 600ms setTimeout — with no initDb() call in this
// test environment, that write would fail (harmlessly caught internally,
// but noisy and leaked past the test's own lifetime). Fake timers keep the
// debounce from ever actually firing during these tests.
beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

function reset(characters: Entity[] = []) {
  useCharacterStore.setState({ characters, undoStack: [], redoStack: [] });
}

function testCharacter(id: string, hp = 20): Entity {
  const e = makeEmptyEntity(id, 'character');
  return { ...e, resources: { ...e.resources, hp: { current: hp, maximum: hp, temp: 0 } } };
}

describe('updateCharacter — undo-stack push', () => {
  it('pushes an undo entry with the default label "Edit" when none is given', () => {
    reset([testCharacter('c1')]);
    useCharacterStore.getState().updateCharacter('c1', e => ({ ...e, notes: 'hi' }));
    const { undoStack } = useCharacterStore.getState();
    expect(undoStack).toHaveLength(1);
    expect(undoStack[0]).toMatchObject({ entityId: 'c1', label: 'Edit' });
  });

  it('uses an explicit label when given', () => {
    reset([testCharacter('c1')]);
    useCharacterStore.getState().updateCharacter('c1', e => ({ ...e, notes: 'hi' }), 'Took 8 damage');
    expect(useCharacterStore.getState().undoStack[0].label).toBe('Took 8 damage');
  });

  it("stores the PRE-mutation snapshot as the undo entry's before[0]", () => {
    reset([testCharacter('c1', 20)]);
    useCharacterStore.getState().updateCharacter(
      'c1', e => ({ ...e, resources: { ...e.resources, hp: { ...e.resources.hp, current: 5 } } }), 'Damage',
    );
    expect(useCharacterStore.getState().undoStack[0].before[0].resources.hp.current).toBe(20);
  });

  it('clears redoStack — a genuinely new mutation invalidates any prior redo path', () => {
    reset([testCharacter('c1')]);
    useCharacterStore.setState({ redoStack: [{ entityId: 'c1', before: [testCharacter('c1')], label: 'stale', timestamp: 0, entityRevision: 0 }] });
    useCharacterStore.getState().updateCharacter('c1', e => ({ ...e, notes: 'hi' }));
    expect(useCharacterStore.getState().redoStack).toEqual([]);
  });

  it('caps undoStack at 50 entries, dropping the oldest', () => {
    reset([testCharacter('c1')]);
    for (let i = 0; i < 55; i++) {
      useCharacterStore.getState().updateCharacter('c1', e => ({ ...e, notes: String(i) }), `Edit ${i}`);
    }
    const { undoStack } = useCharacterStore.getState();
    expect(undoStack).toHaveLength(50);
    expect(undoStack[0].label).toBe('Edit 54'); // most recent first
    expect(undoStack[49].label).toBe('Edit 5'); // oldest surviving entry
  });
});

describe('undo/redo — pop/push symmetry', () => {
  it('undo() reverts to the pre-mutation state and pushes the replaced state onto redoStack', () => {
    reset([testCharacter('c1', 20)]);
    useCharacterStore.getState().updateCharacter(
      'c1', e => ({ ...e, resources: { ...e.resources, hp: { ...e.resources.hp, current: 5 } } }), 'Damage',
    );
    useCharacterStore.getState().undo();
    const { characters, undoStack, redoStack } = useCharacterStore.getState();
    expect(characters.find(c => c.id === 'c1')!.resources.hp.current).toBe(20); // reverted
    expect(undoStack).toHaveLength(0); // popped
    expect(redoStack).toHaveLength(1);
    expect(redoStack[0].before[0].resources.hp.current).toBe(5); // the replaced (damaged) state
    expect(redoStack[0].label).toBe('Damage'); // same label carries over
  });

  it('redo() re-applies the undone mutation and pushes back onto undoStack', () => {
    reset([testCharacter('c1', 20)]);
    useCharacterStore.getState().updateCharacter(
      'c1', e => ({ ...e, resources: { ...e.resources, hp: { ...e.resources.hp, current: 5 } } }), 'Damage',
    );
    useCharacterStore.getState().undo();
    useCharacterStore.getState().redo();
    const { characters, undoStack, redoStack } = useCharacterStore.getState();
    expect(characters.find(c => c.id === 'c1')!.resources.hp.current).toBe(5); // re-applied
    expect(redoStack).toHaveLength(0); // popped
    expect(undoStack).toHaveLength(1);
    expect(undoStack[0].before[0].resources.hp.current).toBe(20); // the replaced (healed-back) state
  });

  it('undo() is a no-op when undoStack is empty', () => {
    reset([testCharacter('c1', 20)]);
    useCharacterStore.getState().undo();
    expect(useCharacterStore.getState().characters[0].resources.hp.current).toBe(20);
  });

  it('redo() is a no-op when redoStack is empty', () => {
    reset([testCharacter('c1', 20)]);
    useCharacterStore.getState().redo();
    expect(useCharacterStore.getState().characters[0].resources.hp.current).toBe(20);
  });

  it('is self-healing: undo() pops a stale entry for a character that no longer exists, without crashing', () => {
    reset([testCharacter('c1', 20)]);
    useCharacterStore.getState().updateCharacter(
      'c1', e => ({ ...e, resources: { ...e.resources, hp: { ...e.resources.hp, current: 5 } } }),
    );
    // Simulate the character having been deleted since the undo entry was pushed.
    useCharacterStore.setState({ characters: [] });
    expect(() => useCharacterStore.getState().undo()).not.toThrow();
    expect(useCharacterStore.getState().undoStack).toHaveLength(0); // stale entry still popped
    expect(useCharacterStore.getState().redoStack).toHaveLength(0); // nothing to push — character was gone
  });
});

describe('undo/redo — consecutive local traversal never invalidates itself (closure item 13)', () => {
  it('local edit A, local edit B, undo, undo, redo, redo all succeed — a chain of purely local undo/redo never bumps revision, so it can never conflict with itself', () => {
    reset([testCharacter('c1', 20)]);
    useCharacterStore.getState().updateCharacter(
      'c1', e => ({ ...e, resources: { ...e.resources, hp: { ...e.resources.hp, current: 15 } } }), 'Edit A',
    );
    useCharacterStore.getState().updateCharacter(
      'c1', e => ({ ...e, resources: { ...e.resources, hp: { ...e.resources.hp, current: 10 } } }), 'Edit B',
    );
    expect(useCharacterStore.getState().characters[0].resources.hp.current).toBe(10);

    useCharacterStore.getState().undo(); // undoes B -> 15
    expect(useCharacterStore.getState().characters[0].resources.hp.current).toBe(15);
    expect(useCharacterStore.getState().lastPersistError).toBeNull();

    useCharacterStore.getState().undo(); // undoes A -> 20
    expect(useCharacterStore.getState().characters[0].resources.hp.current).toBe(20);
    expect(useCharacterStore.getState().lastPersistError).toBeNull();

    useCharacterStore.getState().redo(); // redoes A -> 15
    expect(useCharacterStore.getState().characters[0].resources.hp.current).toBe(15);
    expect(useCharacterStore.getState().lastPersistError).toBeNull();

    useCharacterStore.getState().redo(); // redoes B -> 10
    expect(useCharacterStore.getState().characters[0].resources.hp.current).toBe(10);
    expect(useCharacterStore.getState().lastPersistError).toBeNull();
  });

  it('a longer local chain (4 edits, undo x4, redo x4) never refuses partway through', () => {
    reset([testCharacter('c1', 0)]);
    for (let i = 1; i <= 4; i++) {
      useCharacterStore.getState().updateCharacter(
        'c1', e => ({ ...e, resources: { ...e.resources, hp: { ...e.resources.hp, current: i } } }), `Edit ${i}`,
      );
    }
    for (let i = 0; i < 4; i++) {
      useCharacterStore.getState().undo();
      expect(useCharacterStore.getState().lastPersistError).toBeNull();
    }
    expect(useCharacterStore.getState().characters[0].resources.hp.current).toBe(0);
    for (let i = 0; i < 4; i++) {
      useCharacterStore.getState().redo();
      expect(useCharacterStore.getState().lastPersistError).toBeNull();
    }
    expect(useCharacterStore.getState().characters[0].resources.hp.current).toBe(4);
  });
});

describe('undo/redo — refuse to apply over an unrelated inbound change (re-audit A01/A29, item 14)', () => {
  afterEach(() => {
    useCharacterStore.setState({ lastPersistError: null });
  });

  it('undo() refuses and surfaces a conflict message when an inbound sync patch landed since the undo entry was captured, leaving both changes intact', async () => {
    reset([testCharacter('c1', 20)]);
    useCharacterStore.getState().updateCharacter(
      'c1', e => ({ ...e, resources: { ...e.resources, hp: { ...e.resources.hp, current: 5 } } }), 'Damage',
    );
    const saveSpy = jest.spyOn(entityRepo, 'saveEntity').mockResolvedValue(undefined);
    // Simulate an inbound sync patch (e.g. a DM correction) landing after
    // the local edit above, before undo() is ever called.
    await useCharacterStore.getState().applyIncomingPatch('c1', { notes: 'DM note' });

    useCharacterStore.getState().undo();

    const { characters, undoStack, lastPersistError } = useCharacterStore.getState();
    expect(characters.find(c => c.id === 'c1')!.resources.hp.current).toBe(5); // NOT reverted — refused
    expect(characters.find(c => c.id === 'c1')!.notes).toBe('DM note'); // inbound change preserved
    expect(undoStack).toHaveLength(0); // stale/conflicting entry still popped, doesn't block future undos
    expect(lastPersistError).toMatch(/changed elsewhere/i);
    saveSpy.mockRestore();
  });

  it('undo() still succeeds normally when nothing else touched the character since', () => {
    reset([testCharacter('c1', 20)]);
    useCharacterStore.getState().updateCharacter(
      'c1', e => ({ ...e, resources: { ...e.resources, hp: { ...e.resources.hp, current: 5 } } }), 'Damage',
    );
    useCharacterStore.getState().undo();
    expect(useCharacterStore.getState().characters.find(c => c.id === 'c1')!.resources.hp.current).toBe(20);
    expect(useCharacterStore.getState().lastPersistError).toBeNull();
  });

  it('redo() refuses when an inbound sync patch landed after the undo it would be re-applying over', async () => {
    reset([testCharacter('c1', 20)]);
    useCharacterStore.getState().updateCharacter(
      'c1', e => ({ ...e, resources: { ...e.resources, hp: { ...e.resources.hp, current: 5 } } }), 'Damage',
    );
    useCharacterStore.getState().undo(); // back to HP 20, redo entry pushed

    const saveSpy = jest.spyOn(entityRepo, 'saveEntity').mockResolvedValue(undefined);
    await useCharacterStore.getState().applyIncomingPatch('c1', { notes: 'DM note' });

    useCharacterStore.getState().redo();

    const { characters, redoStack, lastPersistError } = useCharacterStore.getState();
    expect(characters.find(c => c.id === 'c1')!.resources.hp.current).toBe(20); // NOT re-applied — refused
    expect(characters.find(c => c.id === 'c1')!.notes).toBe('DM note'); // inbound change preserved
    expect(redoStack).toHaveLength(0);
    expect(lastPersistError).toMatch(/changed elsewhere/i);
    saveSpy.mockRestore();
  });

  it('closure item 13: an external update invalidates every stacked local entry captured before it, not just the top one', async () => {
    reset([testCharacter('c1', 20)]);
    useCharacterStore.getState().updateCharacter(
      'c1', e => ({ ...e, resources: { ...e.resources, hp: { ...e.resources.hp, current: 15 } } }), 'Edit A',
    );
    useCharacterStore.getState().updateCharacter(
      'c1', e => ({ ...e, resources: { ...e.resources, hp: { ...e.resources.hp, current: 10 } } }), 'Edit B',
    );
    expect(useCharacterStore.getState().undoStack).toHaveLength(2);

    const saveSpy = jest.spyOn(entityRepo, 'saveEntity').mockResolvedValue(undefined);
    await useCharacterStore.getState().applyIncomingPatch('c1', { notes: 'DM note' });

    useCharacterStore.getState().undo(); // attempts to undo B — refused
    expect(useCharacterStore.getState().characters[0].resources.hp.current).toBe(10);
    expect(useCharacterStore.getState().lastPersistError).toMatch(/changed elsewhere/i);

    useCharacterStore.setState({ lastPersistError: null });
    useCharacterStore.getState().undo(); // attempts to undo A (now on top) — ALSO refused, same external event
    expect(useCharacterStore.getState().characters[0].resources.hp.current).toBe(10);
    expect(useCharacterStore.getState().characters[0].notes).toBe('DM note');
    expect(useCharacterStore.getState().lastPersistError).toMatch(/changed elsewhere/i);
    expect(useCharacterStore.getState().undoStack).toHaveLength(0);

    saveSpy.mockRestore();
  });
});

describe('scheduleSave — always persists the LIVE entity at flush time, never a stale snapshot (re-audit A01/A29, item 14)', () => {
  it('an inbound sync patch landing during the debounce window is what gets persisted, not the pre-patch snapshot captured at schedule time', async () => {
    reset([testCharacter('c1', 20)]);
    const saveSpy = jest.spyOn(entityRepo, 'saveEntity').mockResolvedValue(undefined);

    useCharacterStore.getState().updateCharacter(
      'c1', e => ({ ...e, resources: { ...e.resources, hp: { ...e.resources.hp, current: 5 } } }),
    ); // schedules a debounced save of the HP-5 state

    // Before the debounce fires, an inbound patch (e.g. a DM edit) lands and
    // persists immediately via its own saveEntity call.
    await useCharacterStore.getState().applyIncomingPatch('c1', { notes: 'DM note' });
    saveSpy.mockClear(); // only care about what the debounced flush writes next

    jest.advanceTimersByTime(600);
    await Promise.resolve();
    await Promise.resolve();

    expect(saveSpy).toHaveBeenCalledTimes(1);
    const written = saveSpy.mock.calls[0][0];
    expect(written.notes).toBe('DM note');             // the fresher inbound field
    expect(written.resources.hp.current).toBe(5);       // AND the earlier local edit — it's the live merged entity

    saveSpy.mockRestore();
  });
});

describe('updateCharacter — persistent timeline write (Phase B)', () => {
  it('records a timeline entry without blocking the synchronous state update', () => {
    const recordSpy = jest.spyOn(timelineRepo, 'recordTimelineEntry').mockResolvedValue(undefined);
    reset([testCharacter('c1')]);

    useCharacterStore.getState().updateCharacter('c1', e => ({ ...e, notes: 'hi' }), 'Took 8 damage');

    // The state update already happened synchronously — updateCharacter
    // never awaits recordTimelineEntry's returned promise.
    expect(useCharacterStore.getState().characters[0].notes).toBe('hi');
    // 4th arg (category, A-63) is undefined here — this call site doesn't pass one.
    expect(recordSpy).toHaveBeenCalledWith('c1', 'Took 8 damage', expect.any(Number), undefined);
    recordSpy.mockRestore();
  });

  it('passes a category through to recordTimelineEntry when the caller supplies one (A-63)', () => {
    const recordSpy = jest.spyOn(timelineRepo, 'recordTimelineEntry').mockResolvedValue(undefined);
    reset([testCharacter('c1')]);

    useCharacterStore.getState().updateCharacter('c1', e => ({ ...e, notes: 'hi' }), 'Took 8 damage', 'combat');

    expect(recordSpy).toHaveBeenCalledWith('c1', 'Took 8 damage', expect.any(Number), 'combat');
    recordSpy.mockRestore();
  });
});

describe('applyIncomingEntity — owned-character reconnect protection (architecture review P1, S0)', () => {
  it('does NOT overwrite local state with an incoming snapshot for a character this device owns, and pushes the local copy back up instead', async () => {
    const ownedSpy = jest.spyOn(syncManager, 'ownedCharacterId', 'get').mockReturnValue('c1');
    const pushSpy  = jest.spyOn(syncManager, 'pushEntity').mockImplementation(() => {});
    reset([testCharacter('c1', 6)]); // local: HP 6 (the player's own, correct, un-transmitted edit)

    const staleFromDm = testCharacter('c1', 20); // DM's stale pre-blip copy: still full HP
    await useCharacterStore.getState().applyIncomingEntity(staleFromDm);

    expect(useCharacterStore.getState().characters[0].resources.hp.current).toBe(6); // local state untouched
    expect(pushSpy).toHaveBeenCalledWith(expect.objectContaining({ id: 'c1', resources: expect.objectContaining({ hp: expect.objectContaining({ current: 6 }) }) }));

    ownedSpy.mockRestore();
    pushSpy.mockRestore();
  });

  it('still accepts an incoming snapshot normally for a character this device does NOT own', async () => {
    const ownedSpy = jest.spyOn(syncManager, 'ownedCharacterId', 'get').mockReturnValue('some_other_character');
    reset([testCharacter('c1', 6)]);

    const incoming = testCharacter('c1', 20);
    await useCharacterStore.getState().applyIncomingEntity(incoming);

    expect(useCharacterStore.getState().characters[0].resources.hp.current).toBe(20);
    ownedSpy.mockRestore();
  });

  it('still accepts an incoming snapshot for an owned character when this device has no local copy of it yet (nothing to protect)', async () => {
    const ownedSpy = jest.spyOn(syncManager, 'ownedCharacterId', 'get').mockReturnValue('c1');
    reset([]); // no local copy at all

    const incoming = testCharacter('c1', 20);
    await useCharacterStore.getState().applyIncomingEntity(incoming);

    expect(useCharacterStore.getState().characters.find(c => c.id === 'c1')?.resources.hp.current).toBe(20);
    ownedSpy.mockRestore();
  });

  it('still accepts an incoming snapshot for a brand-new, not-yet-locally-known entity even when unclaimed (companion insert path)', async () => {
    const ownedSpy = jest.spyOn(syncManager, 'ownedCharacterId', 'get').mockReturnValue(null);
    reset([testCharacter('c1', 20)]);

    const companion = testCharacter('companion1', 5);
    await useCharacterStore.getState().applyIncomingEntity(companion);

    expect(useCharacterStore.getState().characters.find(c => c.id === 'companion1')).toBeDefined();
    ownedSpy.mockRestore();
  });
});

describe('creation draft durability (re-audit A09, item 11)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    useCharacterStore.setState({ draft: null, lastPersistError: null });
  });

  it('setDraft persists the draft to SQLite alongside the in-memory update', () => {
    const saveDraftSpy = jest.spyOn(draftRepo, 'saveDraftState').mockResolvedValue(undefined);
    const draft = testCharacter('draft1');

    useCharacterStore.getState().setDraft(draft);

    expect(useCharacterStore.getState().draft).toEqual(draft);
    expect(saveDraftSpy).toHaveBeenCalledWith(draft);
  });

  it('clearDraft removes the draft from both memory and its persisted row', () => {
    const clearDraftSpy = jest.spyOn(draftRepo, 'clearDraftState').mockResolvedValue(undefined);
    useCharacterStore.setState({ draft: testCharacter('draft1') });

    useCharacterStore.getState().clearDraft();

    expect(useCharacterStore.getState().draft).toBeNull();
    expect(clearDraftSpy).toHaveBeenCalled();
  });

  it('saveDraft() only clears the draft (memory + persisted row) once the durable write succeeds, and reports success', async () => {
    const saveEntitySpy  = jest.spyOn(entityRepo, 'saveEntity').mockResolvedValue(undefined);
    const clearDraftSpy  = jest.spyOn(draftRepo, 'clearDraftState').mockResolvedValue(undefined);
    const draft = testCharacter('draft1');
    reset([]);
    useCharacterStore.setState({ draft });

    const result = await useCharacterStore.getState().saveDraft();

    expect(result).toBe(true);
    expect(useCharacterStore.getState().draft).toBeNull();
    expect(useCharacterStore.getState().characters.map(c => c.id)).toEqual(['draft1']);
    expect(saveEntitySpy).toHaveBeenCalledWith(draft);
    expect(clearDraftSpy).toHaveBeenCalled();
  });

  it('saveDraft() rolls back the optimistic characters-list change and leaves the draft intact when the durable write fails', async () => {
    const saveEntitySpy = jest.spyOn(entityRepo, 'saveEntity').mockRejectedValue(new Error('disk full'));
    const clearDraftSpy = jest.spyOn(draftRepo, 'clearDraftState').mockResolvedValue(undefined);
    const draft = testCharacter('draft1');
    reset([]);
    useCharacterStore.setState({ draft });

    const result = await useCharacterStore.getState().saveDraft();

    expect(result).toBe(false);
    expect(useCharacterStore.getState().draft).toEqual(draft); // NOT cleared — recoverable
    expect(useCharacterStore.getState().characters).toEqual([]); // optimistic add rolled back
    expect(useCharacterStore.getState().lastPersistError).not.toBeNull();
    expect(saveEntitySpy).toHaveBeenCalledWith(draft);
    expect(clearDraftSpy).not.toHaveBeenCalled(); // persisted draft row also left alone
  });

  it('saveDraft() is a no-op returning false when there is no draft', async () => {
    reset([]);
    useCharacterStore.setState({ draft: null });
    expect(await useCharacterStore.getState().saveDraft()).toBe(false);
  });
});

describe('Extra Attack sequence closure (final single-issue closure): attackSequence never survives the creation-draft boundary', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    useCharacterStore.setState({ draft: null, lastPersistError: null });
  });

  it('setDraft strips an attackSequence before it ever lands in Zustand state or the persisted draft row', () => {
    const saveDraftSpy = jest.spyOn(draftRepo, 'saveDraftState').mockResolvedValue(undefined);
    const draftWithSequence: Entity = {
      ...testCharacter('draft1'),
      attackSequence: { sequenceId: 'live-draft-seq', actorId: 'draft1', maxAttacks: 2, usedAttacks: 1 },
    };

    useCharacterStore.getState().setDraft(draftWithSequence);

    expect(useCharacterStore.getState().draft?.attackSequence).toBeFalsy();
    expect(saveDraftSpy).toHaveBeenCalledWith(expect.objectContaining({ attackSequence: null }));
  });

  it('saveDraft() strips attackSequence at the COMMIT boundary — defense-in-depth, independent of whatever load already did', async () => {
    const saveEntitySpy = jest.spyOn(entityRepo, 'saveEntity').mockResolvedValue(undefined);
    const clearDraftSpy = jest.spyOn(draftRepo, 'clearDraftState').mockResolvedValue(undefined);
    reset([]);
    // Simulate a draft whose Zustand state was populated with a non-null
    // attackSequence WITHOUT going through setDraft (e.g. a stale/legacy
    // persisted draft, or a future alternate loading path) — this bypasses
    // setDraft's own stripping entirely, so a pass here proves saveDraft
    // does its OWN independent normalization at commit time.
    const forgedDraft: Entity = {
      ...testCharacter('draft1'),
      attackSequence: { sequenceId: 'forged-commit-seq', actorId: 'draft1', maxAttacks: 2, usedAttacks: 1 },
    };
    useCharacterStore.setState({ draft: forgedDraft });

    const result = await useCharacterStore.getState().saveDraft();

    expect(result).toBe(true);
    const committed = useCharacterStore.getState().characters.find(c => c.id === 'draft1');
    expect(committed?.attackSequence).toBeFalsy();
    // The actual persisted write also never carried the sequence.
    expect(saveEntitySpy).toHaveBeenCalledWith(expect.objectContaining({ attackSequence: null }));
    saveEntitySpy.mockRestore();
    clearDraftSpy.mockRestore();
  });

  it('legitimate creation progress survives the strip untouched — only attackSequence is affected', async () => {
    const saveEntitySpy = jest.spyOn(entityRepo, 'saveEntity').mockResolvedValue(undefined);
    jest.spyOn(draftRepo, 'clearDraftState').mockResolvedValue(undefined);
    reset([]);
    const richDraft: Entity = {
      ...testCharacter('draft1'),
      identity: { ...testCharacter('draft1').identity, raceId: 'elf', classId: 'wizard', backgroundId: 'sage', name: 'Thren' },
      stats: { str: 8, dex: 14, con: 12, int: 16, wis: 10, cha: 10 },
      inventory: { ...testCharacter('draft1').inventory, equipped: [{ id: 'inst-1', itemId: 'dagger', quantity: 1, attuned: false, features: [] }] },
      spellcasting: { ability: 'int', known: ['fire_bolt'], prepared: [], slots: {} } as unknown as Entity['spellcasting'],
      attackSequence: { sequenceId: 'x', actorId: 'draft1', maxAttacks: 2, usedAttacks: 1 },
    };
    useCharacterStore.setState({ draft: richDraft });

    await useCharacterStore.getState().saveDraft();

    const committed = useCharacterStore.getState().characters.find(c => c.id === 'draft1')!;
    expect(committed.identity).toEqual(richDraft.identity);
    expect(committed.stats).toEqual(richDraft.stats);
    expect(committed.inventory).toEqual(richDraft.inventory);
    expect(committed.spellcasting).toEqual(richDraft.spellcasting);
    expect(committed.attackSequence).toBeFalsy();
  });

  it('an ordinary draft with no attackSequence commits completely unchanged', async () => {
    jest.spyOn(entityRepo, 'saveEntity').mockResolvedValue(undefined);
    jest.spyOn(draftRepo, 'clearDraftState').mockResolvedValue(undefined);
    reset([]);
    const draft = testCharacter('draft1');
    useCharacterStore.setState({ draft });

    await useCharacterStore.getState().saveDraft();

    expect(useCharacterStore.getState().characters.find(c => c.id === 'draft1')).toEqual(draft);
  });

  it('old-token safety: a forged draft sequence token cannot authorize a free continuation after commit', async () => {
    jest.spyOn(entityRepo, 'saveEntity').mockResolvedValue(undefined);
    jest.spyOn(draftRepo, 'clearDraftState').mockResolvedValue(undefined);
    reset([]);
    const forgedDraft: Entity = {
      ...testCharacter('draft1'),
      attackSequence: { sequenceId: 'old-token', actorId: 'draft1', maxAttacks: 2, usedAttacks: 1 },
    };
    useCharacterStore.setState({ draft: forgedDraft });

    await useCharacterStore.getState().saveDraft();
    const committed = useCharacterStore.getState().characters.find(c => c.id === 'draft1')!;

    // At minimum: the old token no longer exists anywhere on the committed
    // character to match against.
    expect(committed.attackSequence).toBeFalsy();
    expect(JSON.stringify(committed)).not.toContain('old-token');
  });
});

describe('lastPersistError — surfaces SQLite write failures instead of only logging them (PERSIST-5)', () => {
  beforeEach(() => {
    // Earlier describe blocks in this file exercise real (unmocked)
    // saveEntity calls, which genuinely fail in this test environment
    // (no initDb() call — see this file's own header comment) — that's
    // now visible via lastPersistError too, so it must be reset here
    // rather than assumed null at the start of each test in this block.
    useCharacterStore.setState({ lastPersistError: null });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    useCharacterStore.setState({ lastPersistError: null });
  });

  it('sets lastPersistError when a debounced save fails, and clears it on the next successful save', async () => {
    const saveSpy = jest.spyOn(entityRepo, 'saveEntity').mockRejectedValueOnce(new Error('disk full'));
    reset([testCharacter('c1', 20)]);
    expect(useCharacterStore.getState().lastPersistError).toBeNull();

    useCharacterStore.getState().updateCharacter('c1', e => ({
      ...e, resources: { ...e.resources, hp: { ...e.resources.hp, current: 5 } },
    }));
    jest.advanceTimersByTime(600); // fire the debounced save
    await Promise.resolve();
    await Promise.resolve();

    expect(useCharacterStore.getState().lastPersistError).not.toBeNull();

    saveSpy.mockResolvedValueOnce(undefined);
    useCharacterStore.getState().updateCharacter('c1', e => ({
      ...e, resources: { ...e.resources, hp: { ...e.resources.hp, current: 4 } },
    }));
    jest.advanceTimersByTime(600);
    await Promise.resolve();
    await Promise.resolve();

    expect(useCharacterStore.getState().lastPersistError).toBeNull();
  });
});

describe('applyIncomingPatch — normalizes item-instance identity before exposing/persisting (item-identity closure, pass 3 finding B)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    useCharacterStore.setState({ lastPersistError: null });
  });

  it('a patch introducing a legacy identity-less carried item gets an id immediately, no restart required', async () => {
    reset([testCharacter('c1', 20)]);
    const saveSpy = jest.spyOn(entityRepo, 'saveEntity').mockResolvedValue(undefined);

    await useCharacterStore.getState().applyIncomingPatch('c1', {
      inventory: { equipped: [], carried: [{ itemId: 'rope_50ft', quantity: 1, attuned: false, features: [] }] },
    });

    const entity = useCharacterStore.getState().characters.find(c => c.id === 'c1')!;
    expect(entity.inventory.carried).toHaveLength(1);
    expect(typeof entity.inventory.carried[0].id).toBe('string');
    expect(entity.inventory.carried[0].id).toBeTruthy();
    expect(useCharacterStore.getState().lastPersistError).toBeNull();
    saveSpy.mockRestore();
  });

  it('rejects a patch whose supplied ItemInstance id is malformed (empty string), leaving prior local state untouched', async () => {
    reset([testCharacter('c1', 20)]);
    const saveSpy = jest.spyOn(entityRepo, 'saveEntity').mockResolvedValue(undefined);
    const before = useCharacterStore.getState().characters.find(c => c.id === 'c1')!;

    await useCharacterStore.getState().applyIncomingPatch('c1', {
      inventory: { equipped: [], carried: [{ id: '', itemId: 'rope_50ft', quantity: 1, attuned: false, features: [] }] },
    });

    expect(useCharacterStore.getState().characters.find(c => c.id === 'c1')).toEqual(before);
    expect(useCharacterStore.getState().lastPersistError).not.toBeNull();
    expect(saveSpy).not.toHaveBeenCalled();
    saveSpy.mockRestore();
  });

  it('rejects a patch that introduces two carried rows with the same supplied nonempty instance id', async () => {
    reset([testCharacter('c1', 20)]);
    const saveSpy = jest.spyOn(entityRepo, 'saveEntity').mockResolvedValue(undefined);
    const before = useCharacterStore.getState().characters.find(c => c.id === 'c1')!;

    await useCharacterStore.getState().applyIncomingPatch('c1', {
      inventory: {
        equipped: [],
        carried: [
          { id: 'dup:1', itemId: 'rope_50ft', quantity: 1, attuned: false, features: [] },
          { id: 'dup:1', itemId: 'torch', quantity: 1, attuned: false, features: [] },
        ],
      },
    });

    expect(useCharacterStore.getState().characters.find(c => c.id === 'c1')).toEqual(before);
    expect(useCharacterStore.getState().lastPersistError).not.toBeNull();
    expect(saveSpy).not.toHaveBeenCalled();
    saveSpy.mockRestore();
  });
});

describe('Extra Attack sequence closure (two-issue final closure, Part B): attackSequence never survives applyIncomingEntity/applyIncomingPatch', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    useCharacterStore.setState({ lastPersistError: null });
  });

  it('F11: an incoming full snapshot carrying an in-progress attackSequence is stripped before it ever reaches state', async () => {
    const saveSpy = jest.spyOn(entityRepo, 'saveEntity').mockResolvedValue(undefined);
    reset([]); // no local copy — this is the "brand-new/backup-restore" path

    const incoming: Entity = {
      ...testCharacter('c1', 20),
      attackSequence: { sequenceId: 'sync-seq', actorId: 'c1', maxAttacks: 2, usedAttacks: 1 },
    };
    await useCharacterStore.getState().applyIncomingEntity(incoming);

    const stored = useCharacterStore.getState().characters.find(c => c.id === 'c1');
    expect(stored?.attackSequence).toBeFalsy();
    saveSpy.mockRestore();
  });

  it('F12: an incoming patch attempting to SET attackSequence is stripped from the merged result before it is exposed/persisted', async () => {
    const saveSpy = jest.spyOn(entityRepo, 'saveEntity').mockResolvedValue(undefined);
    reset([testCharacter('c1', 20)]);

    await useCharacterStore.getState().applyIncomingPatch('c1', {
      attackSequence: { sequenceId: 'forged-patch-seq', actorId: 'c1', maxAttacks: 2, usedAttacks: 1 },
    });

    const merged = useCharacterStore.getState().characters.find(c => c.id === 'c1');
    expect(merged?.attackSequence).toBeFalsy();
    expect(useCharacterStore.getState().lastPersistError).toBeNull();
    saveSpy.mockRestore();
  });

  it('importCharacter (generic import entry point) also strips an attackSequence present on the raw entity', async () => {
    const existsSpy = jest.spyOn(entityRepo, 'persistedCharacterExists').mockResolvedValue(false);
    const saveSpy   = jest.spyOn(entityRepo, 'saveEntity').mockResolvedValue(undefined);
    reset([]);

    const raw: Entity = {
      ...testCharacter('c1', 20),
      attackSequence: { sequenceId: 'import-seq', actorId: 'c1', maxAttacks: 2, usedAttacks: 1 },
    };
    const ok = await useCharacterStore.getState().importCharacter(raw);
    expect(ok).toBe(true);
    expect(useCharacterStore.getState().characters.find(c => c.id === 'c1')?.attackSequence).toBeFalsy();

    existsSpy.mockRestore();
    saveSpy.mockRestore();
  });
});
