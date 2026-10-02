// "Catastrophically Dense" (Ballast): Hit Die +1 die size; a d12 class gets +3 max HP per level.
// The examples below are the ones the spec itself lists (docs/homebrew/BALLAST.md).
import { makeEmptyEntity, DEFAULT_RULES } from '../../store/characterStore';
import { recomputeDerived } from '../pipeline';
import { applyGrant } from '../leveling';
import { currentHitDieSize, spendHitDie, entityHitDieTier } from '../rest';
import { bumpedHitDie, tierHpPerLevel, tierHpBonus } from '../hitDieTier';
import { Entity, Feature } from '../types';

const dense: Feature = {
  id: 'cat_dense', name: 'Catastrophically Dense', description: '', source: { kind: 'race', refId: 'ballast' }, level: null,
  effects: [{ type: 'stat_modifier', target: 'hit_die_tier', operation: 'add', value: 1, condition: null }],
  actions: [], choices: [], passive: true,
};

function withDice(level: number, pools: { die: number; total: number }[]): Entity {
  const e = makeEmptyEntity('b');
  const total = pools.reduce((s, p) => s + p.total, 0);
  return {
    ...e, identity: { ...e.identity, level },
    resources: {
      ...e.resources, hp: { current: 50, maximum: 50, temp: 0 },
      hitDice: { die: pools[pools.length - 1].die, total, remaining: total,
        pools: pools.length > 1 ? pools.map(p => ({ ...p, remaining: p.total })) : undefined },
    },
  };
}
const dense_ = (e: Entity) => recomputeDerived(applyGrant(e, { kind: 'feature', value: dense }, 1), DEFAULT_RULES);

describe('hit die tier helpers', () => {
  it('bumps d6->d8->d10->d12 and stops at d12', () => {
    expect([6, 8, 10, 12].map(d => bumpedHitDie(d, 1))).toEqual([8, 10, 12, 12]);
  });
  it('+1 HP/level for a die that moves, +3 HP/level once capped at d12', () => {
    expect(tierHpPerLevel(6, 1)).toBe(1);
    expect(tierHpPerLevel(10, 1)).toBe(1);
    expect(tierHpPerLevel(12, 1)).toBe(3);
  });
  it('resolves each pool separately (the spec’s Wizard 3 / Barbarian 3 example)', () => {
    expect(tierHpBonus({ die: 12, total: 6, remaining: 6, pools: [{ die: 6, total: 3, remaining: 3 }, { die: 12, total: 3, remaining: 3 }] }, 1))
      .toBe(3 * 1 + 3 * 3);   // Wizard levels +1 each, Barbarian levels +3 each = +12
  });
});

describe('Catastrophically Dense on a real entity', () => {
  it('Wizard 6 (d6): rolls a d8 and gains +6 max HP', () => {
    const e = dense_(withDice(6, [{ die: 6, total: 6 }]));
    expect(entityHitDieTier(e)).toBe(1);
    expect(currentHitDieSize(e)).toBe(8);
    expect(e.resources.hp.maximum).toBe(56);
    expect(e.resources.hitDice.die).toBe(6);   // the STORED die is untouched
  });

  it('Fighter 6 (d10): d12 and +6', () => {
    const e = dense_(withDice(6, [{ die: 10, total: 6 }]));
    expect(currentHitDieSize(e)).toBe(12);
    expect(e.resources.hp.maximum).toBe(56);
  });

  it('Barbarian 6 (already d12): stays d12 and gains +18 max HP', () => {
    const e = dense_(withDice(6, [{ die: 12, total: 6 }]));
    expect(currentHitDieSize(e)).toBe(12);
    expect(e.resources.hp.maximum).toBe(68);
  });

  it('Wizard 3 / Barbarian 3: Wizard dice become d8, Barbarian dice stay d12 for +9 HP', () => {
    const e = dense_(withDice(6, [{ die: 6, total: 3 }, { die: 12, total: 3 }]));
    expect(currentHitDieSize(e, 6)).toBe(8);
    expect(currentHitDieSize(e, 12)).toBe(12);
    expect(e.resources.hp.maximum).toBe(50 + 3 + 9);
  });

  it('spending a hit die rolls the bumped die (never exceeds its faces)', () => {
    const e = dense_(withDice(6, [{ die: 6, total: 6 }]));
    const hurt = { ...e, resources: { ...e.resources, hp: { ...e.resources.hp, current: 1 } } };
    for (let i = 0; i < 25; i++) {
      const after = spendHitDie(hurt, DEFAULT_RULES);
      // 1 HP + roll(1..8) + CON mod(0), minimum heal 1 => never more than 9
      expect(after.resources.hp.current).toBeLessThanOrEqual(1 + 8);
    }
  });

  it('a character without the effect is entirely unaffected', () => {
    const e = recomputeDerived(withDice(6, [{ die: 6, total: 6 }]), DEFAULT_RULES);
    expect(currentHitDieSize(e)).toBe(6);
    expect(e.resources.hp.maximum).toBe(50);
  });

  it('gaining a level later extends the bonus automatically', () => {
    let e = dense_(withDice(6, [{ die: 6, total: 6 }]));
    e = { ...e, resources: { ...e.resources, hitDice: { die: 6, total: 7, remaining: 7 } } };
    e = recomputeDerived(e, DEFAULT_RULES);
    expect(e.resources.hp.maximum).toBe(50 + 7);
  });

  it('removing the feature takes the HP back out', () => {
    const { removeFeature } = require('../leveling');
    let e = dense_(withDice(6, [{ die: 6, total: 6 }]));
    e = recomputeDerived(removeFeature(e, 'cat_dense'), DEFAULT_RULES);
    expect(e.resources.hp.maximum).toBe(50);
  });
});
