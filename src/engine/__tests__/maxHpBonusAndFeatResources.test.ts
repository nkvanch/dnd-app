// Two small engine primitives the built-in homebrew needs:
//  1. a DERIVED max-HP bonus (Effect target 'max_hp') that tiered rewards can REPLACE rather than stack
//  2. Feat.resources — a feat granting a limited-use resource pool
import { makeEmptyEntity, DEFAULT_RULES } from '../../store/characterStore';
import { recomputeDerived } from '../pipeline';
import { applyFeatToEntity, removeFeature } from '../leveling';
import { Entity, Feature } from '../types';

function feature(id: string, hp: number | null): Feature {
  return {
    id, name: id, description: '', source: { kind: 'feat', refId: id }, level: null,
    effects: hp === null ? [] : [{ type: 'stat_modifier', target: 'max_hp', operation: 'add', value: hp, condition: null }],
    actions: [], choices: [], passive: true,
  };
}

function character(): Entity {
  const e = makeEmptyEntity('t');
  return { ...e, identity: { ...e.identity, level: 5 }, resources: { ...e.resources, hp: { current: 30, maximum: 40, temp: 0 } } };
}

describe('max_hp effect (derived, replace-not-stack)', () => {
  it('raises maximum and current by the bonus when the feature is added', () => {
    const e = applyFeatToEntity(character(), 'c1', 1, feature('presence', 5), 'presence', DEFAULT_RULES);
    expect(e.resources.hp).toMatchObject({ maximum: 45, current: 35, bonusApplied: 5 });
  });

  it('a higher tier that REPLACES the lower one nets the difference, never stacks', () => {
    let e = applyFeatToEntity(character(), 'c1', 1, feature('tier1', 5), 'tier1', DEFAULT_RULES);
    e = removeFeature(e, 'tier1');
    e = applyFeatToEntity(e, 'c2', 2, feature('tier2', 10), 'tier2', DEFAULT_RULES);
    expect(e.resources.hp.maximum).toBe(50);          // 40 base + 10, NOT 40 + 5 + 10
    expect(e.resources.hp.bonusApplied).toBe(10);
    e = removeFeature(e, 'tier2');
    e = applyFeatToEntity(e, 'c3', 3, feature('tier3', 15), 'tier3', DEFAULT_RULES);
    expect(e.resources.hp.maximum).toBe(55);          // 40 + 15
  });

  it('removing the feature takes its bonus back out and clamps current HP', () => {
    let e = applyFeatToEntity(character(), 'c1', 1, feature('presence', 5), 'presence', DEFAULT_RULES);
    e = { ...e, resources: { ...e.resources, hp: { ...e.resources.hp, current: 45 } } };   // at full 45/45
    e = recomputeDerived(removeFeature(e, 'presence'), DEFAULT_RULES);
    expect(e.resources.hp).toMatchObject({ maximum: 40, current: 40, bonusApplied: 0 });
  });

  it('is idempotent: recomputing repeatedly never re-adds the bonus', () => {
    let e = applyFeatToEntity(character(), 'c1', 1, feature('presence', 5), 'presence', DEFAULT_RULES);
    for (let i = 0; i < 4; i++) e = recomputeDerived(e, DEFAULT_RULES);
    expect(e.resources.hp.maximum).toBe(45);
  });

  it('a character with no max_hp effects is untouched (bonusApplied stays absent)', () => {
    const e = recomputeDerived(character(), DEFAULT_RULES);
    expect(e.resources.hp).toEqual({ current: 30, maximum: 40, temp: 0 });
  });
});

describe('Feat.resources', () => {
  it('grants the pool when the feat is taken, and removeFeature takes it away again', () => {
    const f = feature('anchor', null);
    let e = applyFeatToEntity(character(), 'c1', 1, f, 'anchor', DEFAULT_RULES, undefined,
      [{ resourceId: 'anchor_hold_fast', name: 'Hold Fast', maximum: 1, recharge: 'long_rest' }]);
    expect(e.resources.custom.find(r => r.id === 'anchor_hold_fast')).toMatchObject({ current: 1, maximum: 1, recharge: 'long_rest' });
    e = removeFeature(e, 'anchor');
    expect(e.resources.custom.find(r => r.id === 'anchor_hold_fast')).toBeUndefined();
  });

  it('a feat with no resources behaves exactly as before', () => {
    const e = applyFeatToEntity(character(), 'c1', 1, feature('plain', null), 'plain', DEFAULT_RULES);
    expect(e.resources.custom).toEqual([]);
  });
});

describe('max_hp bonus survives the engine paths that rebuild the HP block', () => {
  it('levelling up keeps the bonus accounted for (no double count on the next recompute)', () => {
    const { applyHP } = require('../leveling');
    let e = applyFeatToEntity(character(), 'c1', 1, feature('presence', 5), 'presence', DEFAULT_RULES);
    e = { ...e, resources: { ...e.resources, hitDice: { die: 8, total: 5, remaining: 5 } } };
    e = applyHP(e, 8, 'fixed', 6, DEFAULT_RULES);
    const afterLevel = e.resources.hp.maximum;
    expect(e.resources.hp.bonusApplied).toBe(5);
    e = recomputeDerived(e, DEFAULT_RULES);
    expect(e.resources.hp.maximum).toBe(afterLevel);   // unchanged: nothing re-added
  });

  it('a long rest keeps the bonus accounted for', () => {
    const { takeRest } = require('../rest');
    let e = applyFeatToEntity(character(), 'c1', 1, feature('presence', 5), 'presence', DEFAULT_RULES);
    e = takeRest(e, 'long', DEFAULT_RULES);
    expect(e.resources.hp.maximum).toBe(45);
    expect(e.resources.hp.bonusApplied).toBe(5);
    e = recomputeDerived(e, DEFAULT_RULES);
    expect(e.resources.hp.maximum).toBe(45);
  });
});
