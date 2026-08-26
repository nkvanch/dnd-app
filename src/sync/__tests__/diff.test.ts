// src/sync/__tests__/diff.test.ts
// Tests for the deepDiff/deepMerge pair that replaced full-entity sync,
// fixing the "minor change overwrites unrelated fields" problem. This is
// the highest-stakes pure logic in the sync layer — a bug here means real
// data loss across devices, so it gets real coverage, not just device
// testing.
import { deepDiff, deepMerge } from '../diff';

describe('deepDiff', () => {
  it('returns undefined when nothing changed', () => {
    const obj = { a: 1, b: { c: 2 } };
    expect(deepDiff(obj, obj)).toBeUndefined();
    expect(deepDiff({ a: 1 }, { a: 1 })).toBeUndefined();
  });

  it('returns only the changed top-level key', () => {
    const prev = { hp: 20, ac: 15 };
    const next = { hp: 15, ac: 15 };
    expect(deepDiff(prev, next)).toEqual({ hp: 15 });
  });

  it('recurses into nested objects and returns only the changed leaf', () => {
    const prev = { resources: { hp: { current: 20, maximum: 20 }, speed: 30 } };
    const next = { resources: { hp: { current: 15, maximum: 20 }, speed: 30 } };
    // Only resources.hp.current changed — everything else should be absent
    // from the patch, not just unchanged-but-present.
    expect(deepDiff(prev, next)).toEqual({ resources: { hp: { current: 15 } } });
  });

  it('treats arrays as whole values, not element-by-element', () => {
    const prev = { conditions: [{ id: 'poisoned' }] };
    const next = { conditions: [{ id: 'poisoned' }, { id: 'prone' }] };
    expect(deepDiff(prev, next)).toEqual({ conditions: [{ id: 'poisoned' }, { id: 'prone' }] });
  });

  it('handles added and removed keys', () => {
    const prev = { a: 1, b: 2 };
    const next = { a: 1, c: 3 };
    expect(deepDiff(prev, next)).toEqual({ b: undefined, c: 3 });
  });
});

describe('deepMerge', () => {
  it('applies a patch onto a local object without touching untouched fields', () => {
    const local = { hp: 20, ac: 15, name: 'Aria' };
    const patch = { hp: 15 };
    expect(deepMerge(local, patch)).toEqual({ hp: 15, ac: 15, name: 'Aria' });
  });

  it('is a no-op for an undefined patch', () => {
    const local = { hp: 20 };
    expect(deepMerge(local, undefined)).toEqual(local);
  });

  it('recursively merges nested objects', () => {
    const local = { resources: { hp: { current: 20, maximum: 20, temp: 5 }, speed: 30 } };
    const patch = { resources: { hp: { current: 15 } } };
    // speed and hp.maximum/temp must survive — this is the actual bug fix:
    // the OLD behavior would have replaced the whole `resources` object.
    expect(deepMerge(local, patch)).toEqual({
      resources: { hp: { current: 15, maximum: 20, temp: 5 }, speed: 30 },
    });
  });

  it('THE CORE REGRESSION TEST: an unrelated field change from another device is never lost', () => {
    // Simulates the exact bug Nick reported: two devices each make a small,
    // unrelated change. With the old full-snapshot-replace behavior,
    // whichever arrived last would wipe out the other's change entirely.
    const localAfterOwnEdit = {
      resources: { hp: { current: 18, maximum: 20 } },   // this device just took 2 damage
      conditions: [],
    };
    // A patch arrives from another device that only touched conditions —
    // it has NO idea about the HP change made locally in the meantime.
    const incomingPatchFromOtherDevice = {
      conditions: [{ id: 'prone' }],
    };
    const result = deepMerge(localAfterOwnEdit, incomingPatchFromOtherDevice);
    expect(result.resources.hp.current).toBe(18); // NOT reverted to some stale value
    expect(result.conditions).toEqual([{ id: 'prone' }]); // patch still applied
  });

  it('replaces arrays wholesale rather than merging them element-by-element', () => {
    const local = { conditions: [{ id: 'poisoned' }] };
    const patch = { conditions: [{ id: 'prone' }] };
    expect(deepMerge(local, patch)).toEqual({ conditions: [{ id: 'prone' }] });
  });
});

describe('deepDiff + deepMerge round trip', () => {
  it('applying the diff between A and B onto A reproduces B', () => {
    const a = { resources: { hp: { current: 20, maximum: 20 }, speed: 30 }, name: 'Aria' };
    const b = { resources: { hp: { current: 12, maximum: 20 }, speed: 30 }, name: 'Aria' };
    const patch = deepDiff(a, b);
    expect(deepMerge(a, patch)).toEqual(b);
  });
});
