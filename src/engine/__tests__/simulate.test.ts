// src/engine/__tests__/simulate.test.ts
import { simulate } from '../simulate';
import { applyDamage } from '../combat';
import { makeEmptyEntity } from '../../store/characterStore';

describe('simulate', () => {
  function damagedEntity() {
    const e = makeEmptyEntity('sim-test');
    return {
      ...e,
      resources: { ...e.resources, hp: { current: 20, maximum: 20, temp: 0 } },
    };
  }

  it('returns a before/after pair reflecting the mutator, without touching the input entity', () => {
    const entity = damagedEntity();
    const result = simulate(entity, e => applyDamage(e, 5));

    expect(result.before.resources.hp.current).toBe(20);
    expect(result.after.resources.hp.current).toBe(15);
    // Original object passed in is never mutated.
    expect(entity.resources.hp.current).toBe(20);
  });

  it('diff contains only the changed leaf, not untouched branches', () => {
    const entity = damagedEntity();
    const { diff } = simulate(entity, e => applyDamage(e, 5));

    const patch = diff as { resources?: { hp?: { current?: number } } };
    expect(patch.resources?.hp?.current).toBe(15);
    // Untouched top-level branches shouldn't appear in the patch at all.
    expect((diff as Record<string, unknown>).identity).toBeUndefined();
    expect((diff as Record<string, unknown>).features).toBeUndefined();
  });

  it('a no-op mutator produces no diff', () => {
    const entity = damagedEntity();
    const { diff, before, after } = simulate(entity, e => e);

    expect(diff).toBeUndefined();
    expect(after).toEqual(before);
  });
});
