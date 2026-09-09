// src/store/__tests__/characterStore.test.ts
// First test coverage for this store. Covers Phase A (undo-stack push,
// undo()/redo() pop/push symmetry, the stack cap, redo cleared by a new
// mutation) and Phase B (the persistent timeline write is fire-and-forget
// and never blocks the synchronous state update) of the undo/redo +
// mechanical timeline track.
import { useCharacterStore, makeEmptyEntity } from '../characterStore';
import { Entity } from '../../engine/types';
import * as timelineRepo from '../../db/timelineRepo';
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
    useCharacterStore.setState({ redoStack: [{ entityId: 'c1', before: [testCharacter('c1')], label: 'stale', timestamp: 0 }] });
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
