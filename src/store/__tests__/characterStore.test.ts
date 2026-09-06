// src/store/__tests__/characterStore.test.ts
// First test coverage for this store. Focuses on Phase A of the undo/redo +
// mechanical timeline track: updateCharacter's new undo-stack push, and the
// undo()/redo() actions themselves (pop/push symmetry, the stack cap, and
// redo being cleared by a genuinely new mutation).
import { useCharacterStore, makeEmptyEntity } from '../characterStore';
import { Entity } from '../../engine/types';

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
