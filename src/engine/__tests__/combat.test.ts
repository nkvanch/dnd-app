// src/engine/__tests__/combat.test.ts
// Real regression tests for the death-save and Wild Shape logic built this
// session — chosen deliberately because both had real bugs found and fixed
// during development (the stabilize-vs-revive conflation, the damage-
// routing gap, the Rage set_flag gap). Tests here would have caught those
// regressions automatically instead of relying on manual device testing.
import { makeEmptyEntity, DEFAULT_RULES } from '../../store/characterStore';
import {
  applyDamage, applyHealing, recordDeathSave,
  startWildShape, endWildShape, applyWildShapeDamage,
} from '../combat';
import { Entity } from '../types';

/** A fresh level-1 test entity with known HP/stats, independent of any
 *  particular class/race content so these tests don't break if content
 *  files change. */
function testEntity(hp = 20): Entity {
  const e = makeEmptyEntity('test-entity', 'character');
  return {
    ...e,
    resources: {
      ...e.resources,
      hp: { current: hp, maximum: hp, temp: 0 },
    },
  };
}

describe('applyDamage', () => {
  it('reduces current HP by the damage amount', () => {
    const e = testEntity(20);
    const updated = applyDamage(e, 5, DEFAULT_RULES);
    expect(updated.resources.hp.current).toBe(15);
  });

  it('never reduces HP below 0', () => {
    const e = testEntity(10);
    const updated = applyDamage(e, 999, DEFAULT_RULES);
    expect(updated.resources.hp.current).toBe(0);
  });

  it('absorbs damage with temp HP first', () => {
    const e = { ...testEntity(20), resources: { ...testEntity(20).resources, hp: { current: 20, maximum: 20, temp: 5 } } };
    const updated = applyDamage(e, 3, DEFAULT_RULES);
    expect(updated.resources.hp.temp).toBe(2);
    expect(updated.resources.hp.current).toBe(20); // real HP untouched — temp absorbed it all
  });

  it('starts a fresh death-save count on first dropping to 0', () => {
    const e = testEntity(5);
    const updated = applyDamage(e, 5, DEFAULT_RULES);
    expect(updated.resources.hp.current).toBe(0);
    expect(updated.resources.deathSaves).toEqual({ successes: 0, failures: 0, stable: false });
  });

  it('counts damage taken while already at 0 HP as one automatic failure (book rule)', () => {
    let e = testEntity(5);
    e = applyDamage(e, 5, DEFAULT_RULES);        // drops to 0, fresh count
    e = applyDamage(e, 3, DEFAULT_RULES);        // hit again while at 0
    expect(e.resources.deathSaves.failures).toBe(1);
    expect(e.resources.hp.current).toBe(0);      // still 0, not negative
  });

  it('does not add an automatic failure once stable', () => {
    let e = testEntity(5);
    e = applyDamage(e, 5, DEFAULT_RULES);
    e = { ...e, resources: { ...e.resources, deathSaves: { successes: 3, failures: 0, stable: true } } };
    e = applyDamage(e, 3, DEFAULT_RULES);
    expect(e.resources.deathSaves.failures).toBe(0);
  });
});

describe('applyHealing', () => {
  it('increases current HP, capped at maximum', () => {
    const e = testEntity(20);
    const damaged = applyDamage(e, 15, DEFAULT_RULES); // 5 HP left
    const healed = applyHealing(damaged, 100, DEFAULT_RULES);
    expect(healed.resources.hp.current).toBe(20); // capped at max, not 105
  });

  it('clears death saves when healing above 0 HP', () => {
    let e = testEntity(5);
    e = applyDamage(e, 5, DEFAULT_RULES);
    e = { ...e, resources: { ...e.resources, deathSaves: { successes: 1, failures: 2, stable: false } } };
    const healed = applyHealing(e, 1, DEFAULT_RULES);
    expect(healed.resources.deathSaves).toEqual({ successes: 0, failures: 0, stable: false });
  });
});

describe('recordDeathSave', () => {
  function dyingEntity(): Entity {
    const e = testEntity(5);
    return applyDamage(e, 5, DEFAULT_RULES); // at 0 HP, fresh death saves
  }

  it('records a success without changing HP', () => {
    const e = recordDeathSave(dyingEntity(), 'success', DEFAULT_RULES);
    expect(e.resources.deathSaves.successes).toBe(1);
    expect(e.resources.hp.current).toBe(0); // still 0 — success ≠ healing
  });

  it('records a failure', () => {
    const e = recordDeathSave(dyingEntity(), 'failure', DEFAULT_RULES);
    expect(e.resources.deathSaves.failures).toBe(1);
  });

  it('stabilizes at 3 successes WITHOUT changing HP (regression test — this was a real bug: 3 successes used to incorrectly heal to 1 HP)', () => {
    let e = dyingEntity();
    e = recordDeathSave(e, 'success', DEFAULT_RULES);
    e = recordDeathSave(e, 'success', DEFAULT_RULES);
    e = recordDeathSave(e, 'success', DEFAULT_RULES);
    expect(e.resources.deathSaves.stable).toBe(true);
    expect(e.resources.hp.current).toBe(0); // NOT 1 — stabilizing ≠ healing
  });

  it('is a no-op once stable', () => {
    let e = dyingEntity();
    e = recordDeathSave(e, 'success', DEFAULT_RULES);
    e = recordDeathSave(e, 'success', DEFAULT_RULES);
    e = recordDeathSave(e, 'success', DEFAULT_RULES); // now stable
    const before = e.resources.deathSaves;
    e = recordDeathSave(e, 'failure', DEFAULT_RULES);
    expect(e.resources.deathSaves).toEqual(before);
  });

  it('is a no-op once dead (3 failures)', () => {
    let e = dyingEntity();
    e = recordDeathSave(e, 'failure', DEFAULT_RULES);
    e = recordDeathSave(e, 'failure', DEFAULT_RULES);
    e = recordDeathSave(e, 'failure', DEFAULT_RULES); // dead
    const before = e.resources.deathSaves;
    e = recordDeathSave(e, 'success', DEFAULT_RULES);
    expect(e.resources.deathSaves).toEqual(before);
  });

  it('is a no-op if not actually at 0 HP', () => {
    const e = testEntity(10);
    const updated = recordDeathSave(e, 'success', DEFAULT_RULES);
    expect(updated.resources.deathSaves.successes).toBe(0);
  });
});

describe('Wild Shape', () => {
  it('startWildShape sets wildShapeState with the beast form id and full beast HP', () => {
    const e = testEntity(20);
    const shaped = startWildShape(e, 'wolf', DEFAULT_RULES);
    expect(shaped.wildShapeState?.active).toBe(true);
    expect(shaped.wildShapeState?.formId).toBe('wolf');
    expect(shaped.wildShapeState?.beastHp).toBeGreaterThan(0);
    expect(shaped.wildShapeState?.beastHp).toBe(shaped.wildShapeState?.beastHpMax);
  });

  it('does not touch the player\'s real HP when transforming', () => {
    const e = testEntity(20);
    const shaped = startWildShape(e, 'wolf', DEFAULT_RULES);
    expect(shaped.resources.hp.current).toBe(20); // untouched
  });

  it('is a no-op for an unknown beast form id', () => {
    const e = testEntity(20);
    const shaped = startWildShape(e, 'not_a_real_beast', DEFAULT_RULES);
    expect(shaped.wildShapeState).toBeNull();
  });

  it('applyWildShapeDamage hits the beast HP pool, not the player\'s real HP (regression test — this was a real gap: damage used to incorrectly hit real HP while transformed)', () => {
    const e = testEntity(20);
    let shaped = startWildShape(e, 'wolf', DEFAULT_RULES);
    const beastMaxHp = shaped.wildShapeState!.beastHpMax;
    shaped = applyWildShapeDamage(shaped, 2, DEFAULT_RULES);
    expect(shaped.wildShapeState?.beastHp).toBe(beastMaxHp - 2);
    expect(shaped.resources.hp.current).toBe(20); // real HP still untouched
  });

  it('auto-reverts when beast HP hits 0, with no carryover damage to real HP', () => {
    const e = testEntity(20);
    let shaped = startWildShape(e, 'wolf', DEFAULT_RULES);
    const beastMaxHp = shaped.wildShapeState!.beastHpMax;
    shaped = applyWildShapeDamage(shaped, beastMaxHp + 50, DEFAULT_RULES); // massive overkill
    expect(shaped.wildShapeState).toBeNull();       // reverted
    expect(shaped.resources.hp.current).toBe(20);    // no carryover — still full real HP
  });

  it('endWildShape reverts and restores the player\'s own stats', () => {
    const e = testEntity(20);
    const shaped = startWildShape(e, 'wolf', DEFAULT_RULES);
    const reverted = endWildShape(shaped, DEFAULT_RULES);
    expect(reverted.wildShapeState).toBeNull();
    expect(reverted.derived.ac).toBe(e.derived.ac); // back to the player's own AC, not the wolf's
  });

  it('is a no-op if not currently transformed', () => {
    const e = testEntity(20);
    const still = endWildShape(e, DEFAULT_RULES);
    expect(still).toEqual(e);
  });
});
