// src/engine/__tests__/resolver.test.ts
// resolveEffectsForTarget's 'stat_modifier' strategy (resolveCombine
// internally) must be order-independent: shuffling the collected effects
// must never change the derived result. This locks in the Phase 1 fix
// (engine-architecture-hardening track) — competing 'set' operations now
// resolve by highest value, not by whichever happened to be last in the
// array, mirroring pipeline.ts's selectBestAcFormula's own "highest wins"
// tie-break for competing base-AC formulas.
import { resolveEffectsForTarget, resolveBinary, resolveChooseMax } from '../resolver';
import { ActiveEffect, Effect } from '../types';

function ae(effect: Partial<Effect>, sourceName = 'x', appliedAt = 0): ActiveEffect {
  return {
    effect: { type: 'stat_modifier', target: 'speed', operation: 'add', value: null, condition: null, ...effect },
    sourceName, sourceId: sourceName, appliedAt,
  };
}

describe('resolveEffectsForTarget — stat_modifier / resolveCombine', () => {
  it('sums add operations on top of a zero base when there is no set', () => {
    const effects = [ae({ operation: 'add', value: 5 }), ae({ operation: 'add', value: 10 })];
    expect(resolveEffectsForTarget('speed', effects, {} as never)).toBe(15);
  });

  it('picks the highest competing set operation regardless of array order', () => {
    const setA = ae({ operation: 'set', value: 25 }, 'Race');
    const setB = ae({ operation: 'set', value: 30 }, 'Item');
    const forward = [setA, setB];
    const reversed = [setB, setA];
    expect(resolveEffectsForTarget('speed', forward, {} as never)).toBe(30);
    expect(resolveEffectsForTarget('speed', reversed, {} as never)).toBe(30);
  });

  it('is fully order-independent across a shuffled mix of set/add/multiply', () => {
    const effects = [
      ae({ operation: 'set', value: 30 }, 'A'),
      ae({ operation: 'add', value: 10 }, 'B'),
      ae({ operation: 'set', value: 25 }, 'C'), // loses to A's higher set
      ae({ operation: 'add', value: 5 }, 'D'),
      ae({ operation: 'multiply', value: 2 }, 'E'),
    ];
    const expected = resolveEffectsForTarget('speed', effects, {} as never);
    // (30 base + 10 + 5) * 2 = 90, regardless of collection order.
    expect(expected).toBe(90);
    for (let i = 0; i < 5; i++) {
      const shuffled = [...effects].sort(() => Math.random() - 0.5);
      expect(resolveEffectsForTarget('speed', shuffled, {} as never)).toBe(expected);
    }
  });

  it('applies add/multiply on top of a base of 0 when no set is present at all', () => {
    const effects = [ae({ operation: 'add', value: 3 }), ae({ operation: 'multiply', value: 4 })];
    expect(resolveEffectsForTarget('speed', effects, {} as never)).toBe(12);
  });
});

describe('resolveBinary (unchanged, sanity check)', () => {
  it('neutralizes advantage and disadvantage together to straight', () => {
    const effects = [
      ae({ operation: 'advantage' }),
      ae({ operation: 'disadvantage' }),
    ];
    expect(resolveBinary(effects)).toBe('straight');
  });
});

describe('resolveChooseMax (unchanged, sanity check)', () => {
  it('picks the highest value among competing pools', () => {
    const effects = [ae({ value: 5 }), ae({ value: 12 }), ae({ value: 8 })];
    expect(resolveChooseMax(effects)).toBe(12);
  });
});
