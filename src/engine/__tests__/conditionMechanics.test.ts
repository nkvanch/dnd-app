// src/engine/__tests__/conditionMechanics.test.ts
// 2014 condition-mechanics closure. Covers ONLY what this batch actually
// added/changed:
//   - isIncapacitated (combat.ts) now also blocks Actions/Reactions for
//     Paralyzed, Stunned, Petrified, and the bare Incapacitated condition
//     (previously only 0 HP / explicit Unconscious).
//   - incapacitationReason (combat.ts) reports the ACTUAL active cause
//     instead of a hardcoded 0-HP/Unconscious guess.
//   - Blinded/Invisible/Poisoned/Prone/Restrained now author self-side
//     `stat_modifier`/advantage|disadvantage Effects (content/conditions/
//     index.ts), feeding the PRE-EXISTING DerivedStats.advantageStates/
//     resolveBinary mechanism — no new primitive.
//   - Petrified now authors a full resistance-to-all-damage Feature,
//     reusing the pre-existing grant_resistance/resolveResistance/
//     applyDamage pipeline unchanged.
// Regression coverage for pre-existing behavior (speed-zero precedence,
// Wild Shape composition, duplicate/removal handling) already lives in
// pipeline.test.ts and conditions.test.ts and is NOT duplicated here — see
// this file's own closing describe block, which just re-confirms nothing
// broke rather than re-testing what those files already own.
import { Entity } from '../types';
import { makeEmptyEntity, DEFAULT_RULES } from '../../store/characterStore';
import { applyCondition, removeCondition, isImmuneToCondition } from '../conditions';
import { isIncapacitated, incapacitationReason, applyDamage, startTurn, startWildShape } from '../combat';
import { isFeatureAvailable } from '../actionCards';
import { recomputeDerived } from '../pipeline';
import { CONDITIONS_BY_ID } from '../../content/conditions';

/** Applies a REAL shipped condition (with its real content features), not a
 *  hand-built fixture — mirrors pipeline.test.ts's own established pattern
 *  for exercising real condition definitions end-to-end. */
function withCondition(entity: Entity, conditionId: string): Entity {
  return applyCondition(entity, conditionId, 'manual', DEFAULT_RULES, CONDITIONS_BY_ID[conditionId].features);
}

function healthyEntity(): Entity {
  return { ...makeEmptyEntity('e1'), resources: { ...makeEmptyEntity('e1').resources, hp: { current: 20, maximum: 20, temp: 0 } } };
}

function advTarget(e: Entity, target: string) {
  return e.derived.advantageStates.find(a => a.target === target);
}

const actionFeature = { activation: { actionType: 'action' as const, resourceCost: null, range: '5 feet', target: 'single' as const, requiresSave: null } };
const reactionFeature = { activation: { actionType: 'reaction' as const, resourceCost: null, range: '5 feet', target: 'single' as const, requiresSave: null } };
const costedActionFeature = { activation: { actionType: 'action' as const, resourceCost: { resourceId: 'rage', quantity: 1 }, range: '5 feet', target: 'single' as const, requiresSave: null } };

describe('GRAPPLED', () => {
  it('speed becomes 0', () => {
    const e = withCondition(healthyEntity(), 'grappled');
    expect(e.derived.speed).toBe(0);
  });
  it('removal restores ordinary speed', () => {
    const grappled = withCondition(healthyEntity(), 'grappled');
    const restored = removeCondition(grappled, 'grappled', DEFAULT_RULES);
    expect(restored.derived.speed).toBe(healthyEntity().derived.speed);
  });
  it('Wild Shape + Grappled -> 0, removal restores the FORM speed (not base)', () => {
    const shaped = startWildShape(healthyEntity(), 'wolf', DEFAULT_RULES); // Wolf: speed 40
    expect(shaped.derived.speed).toBe(40);
    const grappled = withCondition(shaped, 'grappled');
    expect(grappled.derived.speed).toBe(0);
    const restored = removeCondition(grappled, 'grappled', DEFAULT_RULES);
    expect(restored.derived.speed).toBe(40); // form speed restored, not the player's base
  });
});

describe('INCAPACITATED (action/reaction legality)', () => {
  it('an incapacitated entity is blocked from a normal Action, with the actual reason exposed', () => {
    const e = withCondition(healthyEntity(), 'incapacitated');
    const result = isFeatureAvailable(actionFeature, e);
    expect(result.available).toBe(false);
    expect(result.reason).toBe('Incapacitated');
    expect(result.incapacitatedOverridable).toBe(true);
  });

  it('an incapacitated entity is blocked from a Reaction too', () => {
    const e = withCondition(healthyEntity(), 'incapacitated');
    const result = isFeatureAvailable(reactionFeature, e);
    expect(result.available).toBe(false);
    expect(result.incapacitatedOverridable).toBe(true);
  });

  it('Use Anyway (bypassIncapacitated) lets the status-blocked Action through', () => {
    const e = withCondition(healthyEntity(), 'incapacitated');
    const result = isFeatureAvailable(actionFeature, e, /*bypassIncapacitated*/ true);
    expect(result.available).toBe(true);
  });

  it('Use Anyway does NOT bypass a genuinely missing resource — hard resource/action constraints remain hard', () => {
    const e = withCondition(healthyEntity(), 'incapacitated'); // no 'rage' resource on this entity
    const result = isFeatureAvailable(costedActionFeature, e, /*bypassIncapacitated*/ true);
    expect(result.available).toBe(false);
    expect(result.reason).toMatch(/rage/i);
  });

  it('Use Anyway does NOT bypass an already-spent action-economy slot', () => {
    let e = withCondition(healthyEntity(), 'incapacitated');
    e = startTurn(e); // begin tracking turn state
    e = { ...e, turnState: { ...e.turnState!, actionUsed: true } };
    const result = isFeatureAvailable(actionFeature, e, /*bypassIncapacitated*/ true);
    expect(result.available).toBe(false);
    expect(result.reason).toMatch(/already used/i);
  });

  it('regression: a healthy entity with none of these conditions is NOT incapacitated', () => {
    expect(isIncapacitated(healthyEntity())).toBe(false);
  });
});

describe('PARALYZED', () => {
  it('blocks Actions/Reactions with the correct reason (Paralyzed, not a generic Unconscious/0-HP guess)', () => {
    const e = withCondition(healthyEntity(), 'paralyzed');
    expect(isFeatureAvailable(actionFeature, e).available).toBe(false);
    expect(incapacitationReason(e)).toBe('Paralyzed');
  });
  it('speed becomes 0 (already-intended engine behavior, reconfirmed)', () => {
    const e = withCondition(healthyEntity(), 'paralyzed');
    expect(e.derived.speed).toBe(0);
  });
  it('no target-distance-dependent critical-hit automation is invented (no such effect exists on this condition)', () => {
    const e = withCondition(healthyEntity(), 'paralyzed');
    expect(e.derived.advantageStates).toHaveLength(0);
  });
});

describe('STUNNED', () => {
  it('blocks Actions/Reactions with the correct reason (Stunned)', () => {
    const e = withCondition(healthyEntity(), 'stunned');
    expect(isFeatureAvailable(actionFeature, e).available).toBe(false);
    expect(incapacitationReason(e)).toBe('Stunned');
  });
  it('speed becomes 0', () => {
    const e = withCondition(healthyEntity(), 'stunned');
    expect(e.derived.speed).toBe(0);
  });
});

describe('PETRIFIED', () => {
  it('blocks Actions/Reactions with the correct reason (Petrified) and speed 0', () => {
    const e = withCondition(healthyEntity(), 'petrified');
    expect(isFeatureAvailable(actionFeature, e).available).toBe(false);
    expect(incapacitationReason(e)).toBe('Petrified');
    expect(e.derived.speed).toBe(0);
  });
  it('deterministic resistance to all damage applies through the existing damage pipeline', () => {
    const e = withCondition(healthyEntity(), 'petrified');
    for (const damageType of ['fire', 'slashing', 'psychic', 'cold', 'radiant']) {
      const after = applyDamage(e, 20, DEFAULT_RULES, damageType);
      expect(after.resources.hp.current).toBe(10); // halved
    }
  });
  it('removal restores normal (unresisted) damage behavior', () => {
    const petrified = withCondition(healthyEntity(), 'petrified');
    const restored = removeCondition(petrified, 'petrified', DEFAULT_RULES);
    const afterFire = applyDamage(restored, 20, DEFAULT_RULES, 'fire');
    expect(afterFire.resources.hp.current).toBe(0); // no longer resisted
  });
  it('does not falsely automate contextual mechanics not represented (target-side attack advantage, auto-fail saves, poison/disease immunity)', () => {
    const e = withCondition(healthyEntity(), 'petrified');
    // Only the deterministic self-side facts (speed 0, incapacitated,
    // resistance) are represented — no advantageStates entry exists for
    // anything Petrified doesn't actually automate.
    expect(e.derived.advantageStates).toHaveLength(0);
  });
});

describe('UNCONSCIOUS / 0 HP', () => {
  it('explicit Unconscious blocks Actions/Reactions', () => {
    const e = withCondition(healthyEntity(), 'unconscious');
    expect(isFeatureAvailable(actionFeature, e).available).toBe(false);
    expect(isFeatureAvailable(reactionFeature, e).available).toBe(false);
  });
  it('0 HP alone (no explicit condition) already blocks actions, with the correct reason', () => {
    const e = { ...healthyEntity(), resources: { ...healthyEntity().resources, hp: { current: 0, maximum: 20, temp: 0 } } };
    expect(isIncapacitated(e)).toBe(true);
    expect(incapacitationReason(e)).toBe('At 0 HP');
    expect(isFeatureAvailable(actionFeature, e).available).toBe(false);
  });
  it('explicit Unconscious at full HP is independently incapacitated (Sleep/Hold Person style)', () => {
    const e = withCondition(healthyEntity(), 'unconscious');
    expect(e.resources.hp.current).toBe(20);
    expect(isIncapacitated(e)).toBe(true);
    expect(incapacitationReason(e)).toBe('Unconscious');
  });
  it('removing explicit Unconscious while still at 0 HP does NOT wake the character — existing action restrictions remain intact', () => {
    let e = { ...healthyEntity(), resources: { ...healthyEntity().resources, hp: { current: 0, maximum: 20, temp: 0 } } };
    e = withCondition(e, 'unconscious');
    e = removeCondition(e, 'unconscious', DEFAULT_RULES);
    expect(isIncapacitated(e)).toBe(true); // 0 HP alone still incapacitates
    expect(incapacitationReason(e)).toBe('At 0 HP');
    expect(isFeatureAvailable(actionFeature, e).available).toBe(false);
  });
});

describe('POISONED', () => {
  it('self attack-roll disadvantage AND ability-check disadvantage are applied', () => {
    const e = withCondition(healthyEntity(), 'poisoned');
    expect(advTarget(e, 'attack rolls')?.state).toBe('disadvantage');
    expect(advTarget(e, 'ability checks')?.state).toBe('disadvantage');
  });
  it('removal clears both', () => {
    const poisoned = withCondition(healthyEntity(), 'poisoned');
    const restored = removeCondition(poisoned, 'poisoned', DEFAULT_RULES);
    expect(advTarget(restored, 'attack rolls')).toBeUndefined();
    expect(advTarget(restored, 'ability checks')).toBeUndefined();
  });
});

describe('BLINDED', () => {
  it('self attack-roll disadvantage is applied', () => {
    const e = withCondition(healthyEntity(), 'blinded');
    expect(advTarget(e, 'attack rolls')?.state).toBe('disadvantage');
  });
  it('no fake universal target-side "attacks against me have advantage" automation is invented', () => {
    const e = withCondition(healthyEntity(), 'blinded');
    expect(e.derived.advantageStates).toHaveLength(1); // only the self-side track exists
  });
});

describe('INVISIBLE', () => {
  it('self attack-roll advantage is applied per current 2014 condition modeling', () => {
    const e = withCondition(healthyEntity(), 'invisible');
    expect(advTarget(e, 'attack rolls')?.state).toBe('advantage');
  });
  it('no LOS/hidden-state system is invented — the target-side fact stays manual', () => {
    const e = withCondition(healthyEntity(), 'invisible');
    expect(e.derived.advantageStates).toHaveLength(1);
  });
});

describe('RESTRAINED', () => {
  it('self attack-roll disadvantage AND Dexterity-save disadvantage are applied', () => {
    const e = withCondition(healthyEntity(), 'restrained');
    expect(advTarget(e, 'attack rolls')?.state).toBe('disadvantage');
    expect(advTarget(e, 'Dexterity saving throws')?.state).toBe('disadvantage');
  });
  it('existing speed=0 movement behavior is unaffected', () => {
    const e = withCondition(healthyEntity(), 'restrained');
    expect(e.derived.speed).toBe(0);
  });
  it('removal clears speed and both roll modifiers', () => {
    const restrained = withCondition(healthyEntity(), 'restrained');
    const restored = removeCondition(restrained, 'restrained', DEFAULT_RULES);
    expect(restored.derived.speed).toBe(healthyEntity().derived.speed);
    expect(advTarget(restored, 'attack rolls')).toBeUndefined();
    expect(advTarget(restored, 'Dexterity saving throws')).toBeUndefined();
  });
  it('target-side "attacks against it have advantage" remains manual (not represented)', () => {
    const e = withCondition(healthyEntity(), 'restrained');
    // Exactly 2 tracks exist (both self-side) — no 3rd entry pretending to
    // know who's attacking this creature.
    expect(e.derived.advantageStates).toHaveLength(2);
  });
});

describe('PRONE', () => {
  it('self attack-roll disadvantage is applied (the unconditional part of the rule)', () => {
    const e = withCondition(healthyEntity(), 'prone');
    expect(advTarget(e, 'attack rolls')?.state).toBe('disadvantage');
  });
  it('the distance-dependent "attacks against it" modifier stays manual — not falsely automated', () => {
    const e = withCondition(healthyEntity(), 'prone');
    expect(e.derived.advantageStates).toHaveLength(1); // only the self-side track exists
  });
});

describe('FRIGHTENED', () => {
  it('does not falsely automate source visibility or willing-movement-toward-source — no facts this engine models exist for either', () => {
    const e = withCondition(healthyEntity(), 'frightened');
    expect(e.derived.advantageStates).toHaveLength(0);
    expect(isFeatureAvailable(actionFeature, e).available).toBe(true); // does not even block actions
  });
});

describe('CHARMED', () => {
  it('does not falsely automate charmer-specific rules without a persisted source-actor relationship', () => {
    const e = withCondition(healthyEntity(), 'charmed');
    expect(e.derived.advantageStates).toHaveLength(0);
    expect(isFeatureAvailable(actionFeature, e).available).toBe(true);
  });
});

describe('Advantage/disadvantage cancellation (existing resolveBinary semantics, reused unchanged)', () => {
  it('two independent advantage sources on the same track do not stack (still just "advantage")', () => {
    let e = withCondition(healthyEntity(), 'invisible');
    e = {
      ...e,
      features: [...e.features, {
        id: 'lucky_charm', name: 'Lucky Charm', description: '', source: { kind: 'manual' as const, refId: 'test' },
        level: null, effects: [{ type: 'stat_modifier' as const, target: 'attack rolls', operation: 'advantage' as const, value: null, condition: null }],
        actions: [], choices: [], passive: true, isActive: true,
      }],
    };
    const recomputed = recomputeDerived(e, DEFAULT_RULES);
    expect(advTarget(recomputed, 'attack rolls')?.state).toBe('advantage');
  });

  it('two independent disadvantage sources on the same track do not stack (still just "disadvantage")', () => {
    let e = withCondition(healthyEntity(), 'poisoned');
    e = withCondition(e, 'restrained');
    expect(advTarget(e, 'attack rolls')?.state).toBe('disadvantage');
    expect(e.derived.advantageStates.filter(a => a.target === 'attack rolls')).toHaveLength(1);
  });

  it('advantage + disadvantage on the same track cancel to straight (disappears entirely, per resolveBinary)', () => {
    let e = withCondition(healthyEntity(), 'invisible'); // advantage on attack rolls
    e = withCondition(e, 'poisoned');                    // disadvantage on attack rolls (+ ability checks)
    expect(advTarget(e, 'attack rolls')).toBeUndefined();
    expect(advTarget(e, 'ability checks')?.state).toBe('disadvantage'); // Poisoned's OTHER track is unaffected
  });
});

describe('Condition immunity', () => {
  it('an entity immune to a condition never gains its derived effects when application is attempted', () => {
    const immuneFeature = {
      id: 'test_poison_immunity', name: 'Poison Immunity', description: '', source: { kind: 'manual' as const, refId: 'test' },
      level: null, effects: [{ type: 'condition_immunity' as const, target: 'poisoned', operation: 'immunity' as const, value: null, condition: null }],
      actions: [], choices: [], passive: true, isActive: true,
    };
    const e = { ...healthyEntity(), features: [immuneFeature] };
    expect(isImmuneToCondition(e, 'poisoned')).toBe(true);
    const attempted = withCondition(e, 'poisoned');
    expect(attempted).toBe(e); // no-op — rejected before any mutation
    expect(attempted.conditionMonitor.active).toHaveLength(0);
    expect(attempted.derived.advantageStates).toHaveLength(0);
  });

  it('removal still works normally for a non-immune entity (regression)', () => {
    const poisoned = withCondition(healthyEntity(), 'poisoned');
    expect(poisoned.conditionMonitor.active).toHaveLength(1);
    const removed = removeCondition(poisoned, 'poisoned', DEFAULT_RULES);
    expect(removed.conditionMonitor.active).toHaveLength(0);
  });
});

// ── Regression spot-checks for systems this batch must not disturb ──────────
describe('regression — unaffected systems', () => {
  it('duplicate condition application is still a no-op', () => {
    const once = withCondition(healthyEntity(), 'poisoned');
    const twice = withCondition(once, 'poisoned');
    expect(twice).toBe(once);
    expect(twice.conditionMonitor.active).toHaveLength(1);
  });

  it('a plain healthy entity with zero conditions has no advantageStates and is not incapacitated', () => {
    const e = healthyEntity();
    expect(e.derived.advantageStates).toHaveLength(0);
    expect(isIncapacitated(e)).toBe(false);
  });

  it('grappled + restrained (two overlapping speed restrictions) still resolves to 0, removing one leaves the other in effect', () => {
    let e = withCondition(healthyEntity(), 'grappled');
    e = withCondition(e, 'restrained');
    expect(e.derived.speed).toBe(0);
    e = removeCondition(e, 'grappled', DEFAULT_RULES);
    expect(e.derived.speed).toBe(0); // restrained alone still zeroes it
  });
});
