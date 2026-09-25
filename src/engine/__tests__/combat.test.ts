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
  concentrationCheck, castConcentrationSpell, dropConcentration,
  parseConcentrationDuration, tickConcentrationDuration, startEncounter,
  startTurn, markActionSlotUsed, toggleActionEconomy, endTurn, addToEncounter,
  applyAbilityEffects, playerEndTurn,
  rollInitiativeValue, rollAllInitiative,
  rollConcentrationSave, resolveConcentrationOutcome,
  parseRechargeThreshold, rollRecharge, extractRechargeTag,
  extractRechargeTagFromName, resolveFeatureRechargeTag, findRechargeableFeatures,
  sortInitiative, reanchorTurnIndex,
  CombatState, InitiativeEntry,
} from '../combat';
import { applyCondition } from '../conditions';
import { isFeatureAvailable } from '../actionCards';
import { setRandomSource } from '../dice';
import { Entity, SpellSlots, FeatureInstance, Spell, AbilityEffect, FeatureActivation } from '../types';

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

// ── startEncounter ────────────────────────────────────────────────────────────
// Regression test for a real bug found during an R-29 hygiene audit
// (engine-hardening Phase 6): initiative used to be rolled against a local
// Math.floor((entity.stats.dex - 10) / 2) reimplementation of modifier() —
// the RAW ability score, silently missing both effective (race/item-bonused)
// DEX and any flat initiative-bonus effects (e.g. Alert) that
// entity.derived.initiative already correctly folds in.

describe('startEncounter', () => {
  afterEach(() => {
    setRandomSource(Math.random);
  });

  it("rolls initiative against entity.derived.initiative, not raw entity.stats.dex", () => {
    const e = {
      ...testEntity(20),
      // Raw DEX is low, but derived.initiative reflects an effective bonus
      // (e.g. from a racial/item DEX increase or an Alert-style feat) — if
      // the roll used the raw stat instead, this test would see a total 10
      // lower than expected.
      stats:   { ...testEntity(20).stats, dex: 8 }, // raw modifier would be -1
      derived: { ...testEntity(20).derived, initiative: 7 },
    };
    setRandomSource(() => 0); // d20 roll of 1
    const result = startEncounter([e], 'enc1');
    expect(result.order[0].initiative).toBe(8); // 1 (roll) + 7 (derived bonus), not 1 + (-1)
    expect(result.order[0].tiebreak).toBe(7);
  });

  it('sorts descending by initiative roll, then by derived.initiative as tiebreaker', () => {
    const low  = { ...testEntity(20), id: 'low',  identity: { ...testEntity(20).identity, name: 'Low' }, derived: { ...testEntity(20).derived, initiative: 1 } };
    const high = { ...testEntity(20), id: 'high', identity: { ...testEntity(20).identity, name: 'High' }, derived: { ...testEntity(20).derived, initiative: 5 } };
    let calls = 0;
    const sequence = [0, 0]; // both roll a 1 on the die — ties on total, tiebreak decides
    setRandomSource(() => sequence[calls++]);
    const result = startEncounter([low, high], 'enc1');
    expect(result.order.map(e => e.entityId)).toEqual(['high', 'low']);
  });
});

// ── A-25: turn/action economy ────────────────────────────────────────────────

describe('startTurn', () => {
  it('resets all 3 slots to unused, replacing a null turnState', () => {
    const e = testEntity();
    expect(e.turnState).toBeUndefined();
    const started = startTurn(e);
    expect(started.turnState).toEqual({ actionUsed: false, bonusActionUsed: false, reactionUsed: false });
  });

  it('resets all 3 slots even if some were already used', () => {
    const e = { ...testEntity(), turnState: { actionUsed: true, bonusActionUsed: true, reactionUsed: true } };
    expect(startTurn(e).turnState).toEqual({ actionUsed: false, bonusActionUsed: false, reactionUsed: false });
  });

  // Regression coverage for the legendary-actions engine mechanism (Phase 4,
  // legendary/lair actions): a CustomResource tagged recharge:'start_of_turn'
  // (a monster's Legendary Actions pool) must refresh to full whenever this
  // entity's own turn starts — a generic mechanism, not legendary-action-
  // specific, so it's tested against a bare custom resource rather than a
  // real monster fixture.
  it("refreshes a resource tagged recharge:'start_of_turn' back to maximum", () => {
    const e = {
      ...testEntity(),
      resources: {
        ...testEntity().resources,
        custom: [{ id: 'legendary_actions', name: 'Legendary Actions', current: 0, maximum: 3, recharge: 'start_of_turn' }],
      },
    };
    const started = startTurn(e);
    expect(started.resources.custom[0].current).toBe(3);
  });

  it("leaves resources with any other recharge value untouched", () => {
    const e = {
      ...testEntity(),
      resources: {
        ...testEntity().resources,
        custom: [{ id: 'second_wind', name: 'Second Wind', current: 0, maximum: 1, recharge: 'short_rest' as const }],
      },
    };
    expect(startTurn(e).resources.custom[0].current).toBe(0);
  });

  it('is a no-op on resources.custom identity when there is nothing tagged start_of_turn (cheap path)', () => {
    const e = testEntity();
    expect(startTurn(e).resources).toBe(e.resources);
  });
});

describe('markActionSlotUsed', () => {
  it('sets only the given slot, leaving the other two untouched', () => {
    const e = startTurn(testEntity());
    const after = markActionSlotUsed(e, 'bonus_action');
    expect(after.turnState).toEqual({ actionUsed: false, bonusActionUsed: true, reactionUsed: false });
  });

  it('is a no-op when turnState is null (not actively tracked)', () => {
    const e = testEntity();
    const after = markActionSlotUsed(e, 'action');
    expect(after).toBe(e);
    expect(after.turnState).toBeUndefined();
  });
});

describe('toggleActionEconomy', () => {
  it('initializes turnState (via startTurn) if it was null, then sets the slot', () => {
    const e = testEntity();
    const after = toggleActionEconomy(e, 'reaction');
    expect(after.turnState).toEqual({ actionUsed: false, bonusActionUsed: false, reactionUsed: true });
  });

  it('flips true back to false — a manual correction, unlike markActionSlotUsed', () => {
    const e = startTurn(testEntity());
    const usedOnce = toggleActionEconomy(e, 'action');
    expect(usedOnce.turnState?.actionUsed).toBe(true);
    const toggledBack = toggleActionEconomy(usedOnce, 'action');
    expect(toggledBack.turnState?.actionUsed).toBe(false);
  });
});

describe('endTurn — action economy', () => {
  it("starts a fresh turn (resets action economy) for whoever's turn is now current, leaving the entity whose turn just ended untouched", () => {
    const a = { ...testEntity(), id: 'a', identity: { ...testEntity().identity, name: 'A' }, turnState: { actionUsed: true, bonusActionUsed: true, reactionUsed: true } };
    const b = { ...testEntity(), id: 'b', identity: { ...testEntity().identity, name: 'B' }, turnState: { actionUsed: true, bonusActionUsed: false, reactionUsed: true } };
    const combat = {
      active: true, round: 1, turnIndex: 0, encounterId: 'enc1',
      order: [
        { entityId: 'a', name: 'A', initiative: 20, tiebreak: 3, isPlayer: true, hasTakenTurn: false },
        { entityId: 'b', name: 'B', initiative: 10, tiebreak: 1, isPlayer: true, hasTakenTurn: false },
      ],
    };
    const result = endTurn(combat, [a, b], DEFAULT_RULES);

    const newA = result.entities.find(e => e.id === 'a')!;
    const newB = result.entities.find(e => e.id === 'b')!;
    // B's turn is now current (turnIndex advanced 0 -> 1) — fresh turnState.
    expect(newB.turnState).toEqual({ actionUsed: false, bonusActionUsed: false, reactionUsed: false });
    // A's turn just ended — its (fully-used) turnState is untouched, stays
    // spent until A's own next turn comes around.
    expect(newA.turnState).toEqual({ actionUsed: true, bonusActionUsed: true, reactionUsed: true });
  });

  it('wraps correctly — the last combatant ending their turn resets the first combatant for the new round', () => {
    const a = { ...testEntity(), id: 'a', turnState: { actionUsed: false, bonusActionUsed: false, reactionUsed: false } };
    const b = { ...testEntity(), id: 'b', turnState: { actionUsed: true, bonusActionUsed: true, reactionUsed: true } };
    const combat = {
      active: true, round: 1, turnIndex: 1, encounterId: 'enc1', // B's turn, last in order
      order: [
        { entityId: 'a', name: 'A', initiative: 20, tiebreak: 3, isPlayer: true, hasTakenTurn: true },
        { entityId: 'b', name: 'B', initiative: 10, tiebreak: 1, isPlayer: true, hasTakenTurn: false },
      ],
    };
    const result = endTurn(combat, [a, b], DEFAULT_RULES);
    expect(result.combat.round).toBe(2);
    expect(result.combat.turnIndex).toBe(0);
    const newA = result.entities.find(e => e.id === 'a')!;
    expect(newA.turnState).toEqual({ actionUsed: false, bonusActionUsed: false, reactionUsed: false });
  });
});

describe('isFeatureAvailable — turn-economy gate (A-25)', () => {
  const actionFeature: FeatureInstance = {
    id: 'f1', name: 'Test Action', description: '', source: { kind: 'manual', refId: 'x' },
    level: null, effects: [], actions: [], choices: [], passive: false, isActive: true,
    activation: { actionType: 'action', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
  };

  it('is available when turnState is null (not actively tracked)', () => {
    const e = testEntity();
    expect(isFeatureAvailable(actionFeature, e)).toEqual({ available: true, reason: null });
  });

  it('is available when tracked but the action slot is unused', () => {
    const e = startTurn(testEntity());
    expect(isFeatureAvailable(actionFeature, e)).toEqual({ available: true, reason: null });
  });

  it('is unavailable, with a labeled reason, once the action slot is used', () => {
    const e = markActionSlotUsed(startTurn(testEntity()), 'action');
    expect(isFeatureAvailable(actionFeature, e)).toEqual({
      available: false, reason: 'Already used your action this turn.',
    });
  });

  it('a bonus_action card is gated independently of the action slot', () => {
    const bonusFeature: FeatureInstance = {
      ...actionFeature, activation: { ...actionFeature.activation!, actionType: 'bonus_action' },
    };
    const e = markActionSlotUsed(startTurn(testEntity()), 'action'); // action used, bonus still free
    expect(isFeatureAvailable(bonusFeature, e)).toEqual({ available: true, reason: null });
  });

  it("a 'passive' or 'free' actionType is never gated by turn economy", () => {
    const freeFeature: FeatureInstance = {
      ...actionFeature, activation: { ...actionFeature.activation!, actionType: 'free' },
    };
    const e = { ...startTurn(testEntity()), turnState: { actionUsed: true, bonusActionUsed: true, reactionUsed: true } };
    expect(isFeatureAvailable(freeFeature, e)).toEqual({ available: true, reason: null });
  });
});

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

  // Rules-engine blocker fix (C): damage exceeding the beast form's
  // remaining HP used to just discard the excess outright ("form dies, 0
  // hp gained/lost beyond what was already on the sheet") — real damage
  // that had genuinely landed silently vanished. The form now absorbs up
  // to its own remaining HP, reverts, and any OVERFLOW carries into the
  // player's real HP via the existing, unmodified applyDamage() — see
  // applyWildShapeDamage's own doc comment for the exact D-vs-F boundary
  // rules and why this can't double-apply resistance.
  describe('Wild Shape overflow damage (rules-engine blocker C)', () => {
    // Wolf's beast form HP is a fixed 11 (src/content/beastforms).
    function wolfShaped(baseHp = 30): Entity {
      const e = testEntity(baseHp);
      return startWildShape(e, 'wolf', DEFAULT_RULES);
    }

    it('D < F: remains transformed, form HP reduced, real HP untouched (unchanged from before this fix)', () => {
      let shaped = wolfShaped(30);
      shaped = applyWildShapeDamage(shaped, 6, DEFAULT_RULES); // 6 < 11
      expect(shaped.wildShapeState?.active).toBe(true);
      expect(shaped.wildShapeState?.beastHp).toBe(5); // 11 - 6
      expect(shaped.resources.hp.current).toBe(30); // untouched
    });

    it('D === F: reverts, zero overflow, real HP unchanged', () => {
      let shaped = wolfShaped(30);
      shaped = applyWildShapeDamage(shaped, 11, DEFAULT_RULES); // exactly the form's full HP
      expect(shaped.wildShapeState).toBeNull(); // reverted
      expect(shaped.resources.hp.current).toBe(30); // 0 overflow — unchanged
    });

    it('D > F: reverts, overflow carries into real HP exactly', () => {
      let shaped = wolfShaped(30);
      shaped = applyWildShapeDamage(shaped, 20, DEFAULT_RULES); // form HP 1 less than this — 9 overflow
      expect(shaped.wildShapeState).toBeNull();
      expect(shaped.resources.hp.current).toBe(21); // 30 - (20 - 11) = 21, matching the task's own worked example
    });

    it('does not incorrectly reduce a form already damaged this session (D compares against CURRENT beast HP, not max)', () => {
      let shaped = wolfShaped(30);
      shaped = applyWildShapeDamage(shaped, 6, DEFAULT_RULES); // beastHp now 5, still transformed
      shaped = applyWildShapeDamage(shaped, 10, DEFAULT_RULES); // 10 > 5 remaining — 5 overflow
      expect(shaped.wildShapeState).toBeNull();
      expect(shaped.resources.hp.current).toBe(25); // 30 - 5
    });

    it('very large overflow is never silently clamped or discarded, even against a small base HP', () => {
      let shaped = wolfShaped(5); // small base HP, wolf form HP is 11
      shaped = applyWildShapeDamage(shaped, 100, DEFAULT_RULES); // massive overkill — overflow = 100 - 11 = 89
      expect(shaped.wildShapeState).toBeNull();
      // 5 base HP against an 89 overflow — HP floors at 0 rather than going
      // negative, same floor applyDamage always enforces; the overflow
      // itself was never clamped or discarded before reaching that floor.
      expect(shaped.resources.hp.current).toBe(0);
    });

    it('zero damage is a no-op', () => {
      const shaped = wolfShaped(30);
      const result = applyWildShapeDamage(shaped, 0, DEFAULT_RULES);
      expect(result).toBe(shaped);
    });

    it('reversion on overflow restores base stats, same as a manual/normal reversion', () => {
      const e = testEntity(30);
      let shaped = startWildShape(e, 'wolf', DEFAULT_RULES);
      shaped = applyWildShapeDamage(shaped, 50, DEFAULT_RULES); // big overkill, forces revert
      expect(shaped.wildShapeState).toBeNull();
      expect(shaped.derived.ac).toBe(e.derived.ac); // back to the player's own AC, not the wolf's
    });

    it('is a no-op when not currently transformed (real HP untouched)', () => {
      const e = testEntity(30);
      const result = applyWildShapeDamage(e, 15, DEFAULT_RULES);
      expect(result).toBe(e);
    });

    // Rules-engine blocker CLOSURE (re-audit): resistance/immunity/
    // vulnerability must resolve ONCE, against the FULL raw hit, BEFORE the
    // form-HP split — not against just the leftover overflow portion after
    // splitting (the previous implementation's bug: it split raw damage
    // against the beast pool first, then only resolved resistance on
    // whatever was left, discounting the wrong slice of the hit).
    it('resistance resolves once against the FULL raw hit, before the form-HP split — not just the overflow', () => {
      const resistantEntity: Entity = {
        ...testEntity(30),
        features: [
          ...testEntity(30).features,
          {
            id: 'test_fire_resistance', name: 'Fire Resistance', description: '',
            source: { kind: 'feat', refId: 'test' }, level: null, passive: true, isActive: true,
            effects: [{ type: 'grant_resistance', target: 'fire', operation: 'resistance', value: null, condition: null }],
            actions: [], choices: [],
          },
        ],
      };
      let shaped = startWildShape(resistantEntity, 'wolf', DEFAULT_RULES);
      // Wolf form HP is 11. Raw fire hit of 31, fire-resistant throughout.
      // Correct: resistance applies ONCE to the full 31 -> effective 15.
      // 15 >= beastHp(11) -> reverts with overflow 15-11=4 (already-resolved
      // HP damage) -> base loses 4, unresisted a second time -> 30-4=26.
      // The PREVIOUS (buggy) order gave 20: raw overflow 31-11=20,
      // resistance applied only to THAT afterward -> floor(20/2)=10 ->
      // 30-10=20 — the wrong slice of the hit got the discount.
      shaped = applyWildShapeDamage(shaped, 31, DEFAULT_RULES, 'fire');
      expect(shaped.wildShapeState).toBeNull();
      expect(shaped.resources.hp.current).toBe(26);
    });

    it('resistance is NOT re-applied a second time to the overflow after reversion (no double-processing)', () => {
      const resistantEntity: Entity = {
        ...testEntity(30),
        features: [
          ...testEntity(30).features,
          {
            id: 'test_fire_resistance', name: 'Fire Resistance', description: '',
            source: { kind: 'feat', refId: 'test' }, level: null, passive: true, isActive: true,
            effects: [{ type: 'grant_resistance', target: 'fire', operation: 'resistance', value: null, condition: null }],
            actions: [], choices: [],
          },
        ],
      };
      let shaped = startWildShape(resistantEntity, 'wolf', DEFAULT_RULES);
      shaped = applyWildShapeDamage(shaped, 31, DEFAULT_RULES, 'fire');
      // If resistance were (incorrectly) applied a SECOND time to the 4
      // overflow after reversion, base HP would be 30 - floor(4/2) = 28,
      // not 26 — this pins the "exactly once" invariant directly.
      expect(shaped.resources.hp.current).not.toBe(28);
      expect(shaped.resources.hp.current).toBe(26);
    });

    it('temp HP participates in the SAME hit before the form-HP split (not only on overflow)', () => {
      const e = { ...testEntity(30), resources: { ...testEntity(30).resources, hp: { current: 30, maximum: 30, temp: 4 } } };
      let shaped = startWildShape(e, 'wolf', DEFAULT_RULES); // wolf form HP 11
      shaped = applyWildShapeDamage(shaped, 6, DEFAULT_RULES);
      // temp absorbs 4, 2 HP damage remains -> form 11-2=9, still transformed.
      expect(shaped.wildShapeState?.active).toBe(true);
      expect(shaped.wildShapeState?.beastHp).toBe(9);
      expect(shaped.resources.hp.temp).toBe(0);
      expect(shaped.resources.hp.current).toBe(30); // real HP untouched
    });

    it('temp HP + overflow in one hit: temp absorbs first, remaining HP damage overflows into base, no second temp absorption', () => {
      const e = { ...testEntity(30), resources: { ...testEntity(30).resources, hp: { current: 30, maximum: 30, temp: 4 } } };
      let shaped = startWildShape(e, 'wolf', DEFAULT_RULES); // wolf form HP 11
      shaped = applyWildShapeDamage(shaped, 20, DEFAULT_RULES);
      // temp absorbs 4 of the 20 -> hpDamage 16. beastHp 11 -> 16 >= 11 ->
      // reverts with overflow 16-11=5 -> base loses 5 -> 30-5=25. If temp
      // were (incorrectly) absorbed a second time on the post-revert
      // applyDamage call, base would lose less than 5.
      expect(shaped.wildShapeState).toBeNull();
      expect(shaped.resources.hp.temp).toBe(0);
      expect(shaped.resources.hp.current).toBe(25);
    });

    it('immunity: zero HP damage, no form HP loss, no state change at all', () => {
      const immuneEntity: Entity = {
        ...testEntity(30),
        features: [
          ...testEntity(30).features,
          {
            id: 'test_fire_immunity', name: 'Fire Immunity', description: '',
            source: { kind: 'feat', refId: 'test' }, level: null, passive: true, isActive: true,
            effects: [{ type: 'grant_resistance', target: 'fire', operation: 'immunity', value: null, condition: null }],
            actions: [], choices: [],
          },
        ],
      };
      const shaped = startWildShape(immuneEntity, 'wolf', DEFAULT_RULES);
      const result = applyWildShapeDamage(shaped, 100, DEFAULT_RULES, 'fire'); // massive hit, fully immune
      expect(result).toBe(shaped); // no-op, same as applyDamage's own immunity early-return
      expect(result.wildShapeState?.active).toBe(true);
      expect(result.wildShapeState?.beastHp).toBe(11); // unchanged
      expect(result.resources.hp.current).toBe(30); // unchanged
    });

    it('vulnerability: damage doubled ONCE against the full raw hit, then split — never doubled again after reversion', () => {
      const vulnerableEntity: Entity = {
        ...testEntity(30),
        features: [
          ...testEntity(30).features,
          {
            id: 'test_fire_vulnerability', name: 'Fire Vulnerability', description: '',
            source: { kind: 'feat', refId: 'test' }, level: null, passive: true, isActive: true,
            effects: [{ type: 'grant_resistance', target: 'fire', operation: 'vulnerability', value: null, condition: null }],
            actions: [], choices: [],
          },
        ],
      };
      let shaped = startWildShape(vulnerableEntity, 'wolf', DEFAULT_RULES); // form HP 11
      // Raw 10 fire -> doubled once to 20 -> 20 >= 11 -> reverts, overflow 9
      // -> base loses 9 (unresisted/undoubled a second time) -> 30-9=21.
      // If vulnerability were (incorrectly) applied a second time to the
      // overflow, base would instead lose 18 -> 12.
      shaped = applyWildShapeDamage(shaped, 10, DEFAULT_RULES, 'fire');
      expect(shaped.wildShapeState).toBeNull();
      expect(shaped.resources.hp.current).toBe(21);
    });
  });

  // ── DM Kill regression (rules-engine blocker closure 3I) ──────────────────
  // The DM "Kill" control (app/dm/encounter.tsx) used to route a
  // transformed entity through applyWildShapeDamage(entity,
  // wildShapeState.beastHpMax, ...) — harmless before the overflow fix
  // above (excess was silently discarded), but a genuine bug now that
  // overflow correctly carries into real HP: an already-damaged form
  // (beastHp < beastHpMax) would compute fake overflow damage into the
  // player's real HP purely from the GAP between current and max beast HP,
  // never a real hit. The fix calls endWildShape() directly instead — the
  // same "just zero out the currently active HP pool" semantics the
  // non-transformed Kill branch already uses (a direct HP-to-0 set, no
  // damage pipeline at all). This pins the invariant the fix relies on:
  // ending Wild Shape NEVER touches real HP, regardless of how damaged the
  // form currently is.
  describe('DM Kill regression — ending Wild Shape must never manufacture overflow damage', () => {
    it('endWildShape on an ALREADY-DAMAGED form (beastHp well below beastHpMax) leaves real HP completely untouched', () => {
      const e = testEntity(30);
      let shaped = startWildShape(e, 'wolf', DEFAULT_RULES); // beastHp 11 = beastHpMax
      shaped = applyWildShapeDamage(shaped, 7, DEFAULT_RULES); // beastHp now 4, well below max 11
      expect(shaped.wildShapeState?.beastHp).toBe(4);
      expect(shaped.wildShapeState?.beastHpMax).toBe(11);

      const killed = endWildShape(shaped, DEFAULT_RULES);
      expect(killed.wildShapeState).toBeNull();
      expect(killed.resources.hp.current).toBe(30); // unchanged — not beastHpMax(11) - beastHp(4) = 7 "fake overflow"
    });

    it('bulk-equivalent: endWildShape on any damaged transformed entity never touches real HP, regardless of how much beast HP remains', () => {
      const e = testEntity(50);
      let shaped = startWildShape(e, 'fire_elemental', DEFAULT_RULES); // beastHpMax 102
      shaped = applyWildShapeDamage(shaped, 90, DEFAULT_RULES); // beastHp now 12, far below max
      const killed = endWildShape(shaped, DEFAULT_RULES);
      expect(killed.resources.hp.current).toBe(50); // unchanged regardless of the 90-point gap to beastHpMax
    });
  });

  // ── Native BeastForm defenses (rules-engine blocker RE-AUDIT closure 3) ──
  // Real shipped elemental forms now carry structured damage resistances/
  // immunities/vulnerabilities (src/content/beastforms/index.ts) — these
  // participate in the SAME collectAllEffects/resolveResistance path as
  // every other active effect (pipeline.ts), so applyWildShapeDamage picks
  // them up automatically with no combat.ts changes of its own.
  describe('native BeastForm defenses (rules-engine blocker RE-AUDIT closure 3)', () => {
    it('Fire Elemental: immune to fire — zero damage, no form HP loss', () => {
      const e = testEntity(50);
      const shaped = startWildShape(e, 'fire_elemental', DEFAULT_RULES);
      const result = applyWildShapeDamage(shaped, 500, DEFAULT_RULES, 'fire');
      expect(result).toBe(shaped); // no-op, matching applyDamage's own immunity behavior
    });

    it('Fire Elemental: NOT immune to a different damage type — cold applies normally', () => {
      const e = testEntity(50);
      const shaped = startWildShape(e, 'fire_elemental', DEFAULT_RULES); // beastHpMax 102
      const result = applyWildShapeDamage(shaped, 50, DEFAULT_RULES, 'cold');
      expect(result.wildShapeState?.active).toBe(true);
      expect(result.wildShapeState?.beastHp).toBe(52); // 102 - 50, unresisted
    });

    it('Air Elemental: resists lightning — the form-native resistance applies while transformed', () => {
      const e = testEntity(50);
      let shaped = startWildShape(e, 'air_elemental', DEFAULT_RULES); // beastHpMax 90
      shaped = applyWildShapeDamage(shaped, 40, DEFAULT_RULES, 'lightning');
      expect(shaped.wildShapeState?.active).toBe(true);
      expect(shaped.wildShapeState?.beastHp).toBe(70); // 90 - floor(40/2)=20 -> 70
    });

    it('Earth Elemental: vulnerable to thunder — damage doubled once, split correctly, never doubled again on overflow', () => {
      const e = testEntity(50);
      let shaped = startWildShape(e, 'earth_elemental', DEFAULT_RULES); // beastHpMax 126
      // Raw 70 thunder -> doubled once to 140 -> 140 >= 126 -> reverts,
      // overflow 140-126=14 (already-resolved) -> base loses 14 -> 50-14=36.
      shaped = applyWildShapeDamage(shaped, 70, DEFAULT_RULES, 'thunder');
      expect(shaped.wildShapeState).toBeNull();
      expect(shaped.resources.hp.current).toBe(36);
    });

    it('Water Elemental: resists acid and fire (two native resistances on one form)', () => {
      const e = testEntity(50);
      let acidShaped = startWildShape(e, 'water_elemental', DEFAULT_RULES); // beastHpMax 114
      acidShaped = applyWildShapeDamage(acidShaped, 60, DEFAULT_RULES, 'acid');
      expect(acidShaped.wildShapeState?.beastHp).toBe(84); // 114 - floor(60/2)=30

      let fireShaped = startWildShape(e, 'water_elemental', DEFAULT_RULES);
      fireShaped = applyWildShapeDamage(fireShaped, 60, DEFAULT_RULES, 'fire');
      expect(fireShaped.wildShapeState?.beastHp).toBe(84); // same discount for the second native resistance
    });

    it('the native form defense disappears entirely after reversion — the base entity has no such resistance', () => {
      const e = testEntity(50);
      let shaped = startWildShape(e, 'air_elemental', DEFAULT_RULES); // beastHpMax 90
      shaped = applyWildShapeDamage(shaped, 200, DEFAULT_RULES, 'lightning'); // overkill, forces revert; overflow already resistance-discounted
      expect(shaped.wildShapeState).toBeNull();
      // Post-revert, apply the SAME damage type directly via applyDamage
      // (simulating a normal hit against the now-reverted base character) —
      // it must NOT be resisted, since the base entity has no lightning
      // resistance of its own; only the form did, and the form is gone.
      const before = shaped.resources.hp.current;
      const after = applyDamage(shaped, 10, DEFAULT_RULES, 'lightning');
      expect(before - after.resources.hp.current).toBe(10); // full, unresisted damage
    });

    it('no double-processing: a native form resistance applies to the FULL raw hit exactly once, not re-applied to the overflow', () => {
      const e = testEntity(50);
      let shaped = startWildShape(e, 'water_elemental', DEFAULT_RULES); // beastHpMax 114, resists acid
      // Raw 250 acid -> resisted once to 125 -> 125 >= 114 -> reverts,
      // overflow 125-114=11 -> base loses 11 (NOT re-resisted) -> 50-11=39.
      // If double-processed, base would instead lose floor(11/2)=5 -> 45.
      shaped = applyWildShapeDamage(shaped, 250, DEFAULT_RULES, 'acid');
      expect(shaped.wildShapeState).toBeNull();
      expect(shaped.resources.hp.current).toBe(39);
    });

    it('temp HP + native form defense: temp HP absorbs the ALREADY-RESISTED damage, not the raw amount', () => {
      const e = { ...testEntity(50), resources: { ...testEntity(50).resources, hp: { current: 50, maximum: 50, temp: 10 } } };
      let shaped = startWildShape(e, 'air_elemental', DEFAULT_RULES); // beastHpMax 90, resists lightning
      // Raw 40 lightning -> resisted to 20 -> temp absorbs 10 -> hpDamage 10
      // -> form 90-10=80, still transformed, temp now 0.
      shaped = applyWildShapeDamage(shaped, 40, DEFAULT_RULES, 'lightning');
      expect(shaped.wildShapeState?.active).toBe(true);
      expect(shaped.wildShapeState?.beastHp).toBe(80);
      expect(shaped.resources.hp.temp).toBe(0);
    });

    it('Wolf (a non-elemental, no native defenses) is completely unaffected — no accidental leakage', () => {
      const e = testEntity(30);
      let shaped = startWildShape(e, 'wolf', DEFAULT_RULES); // beastHpMax 11
      shaped = applyWildShapeDamage(shaped, 6, DEFAULT_RULES, 'fire'); // no fire resistance on Wolf
      expect(shaped.wildShapeState?.beastHp).toBe(5); // 11-6, unresisted
    });

    // Rules-engine blocker RE-AUDIT closure (2A/2B, corrected): the real
    // SRD/MM stat block gives EVERY elemental (Air/Earth/Fire/Water) its own
    // "Damage Immunities: poison" line, separate from the shared "poisoned"
    // CONDITION immunity every elemental also has (which this engine has no
    // representation for at all — out of scope). Round 3's assumption that
    // only Fire Elemental had poison DAMAGE immunity was a genuine mistake;
    // see beastforms/index.ts's own per-form comment for the corrected
    // reasoning. Exercises the real transform -> hit -> revert pipeline
    // (not just a bare damageImmunities field check), including a repeated
    // transform/revert cycle to prove the native immunity never leaks onto
    // the base character and reliably re-applies on a second transformation.
    it.each(['air_elemental', 'earth_elemental', 'fire_elemental', 'water_elemental'])(
      '%s is immune to poison DAMAGE — zero form/temp/base HP loss, immunity gone after reverting, and it reliably reapplies on a second transform',
      formId => {
        const e = testEntity(50);
        let shaped = startWildShape(e, formId, DEFAULT_RULES);
        const beastHpBefore = shaped.wildShapeState!.beastHp;
        let result = applyWildShapeDamage(shaped, 500, DEFAULT_RULES, 'poison');
        expect(result).toBe(shaped); // no-op, matching Fire Elemental's own fire-immunity assertion above
        expect(result.wildShapeState?.beastHp).toBe(beastHpBefore);
        expect(result.resources.hp.current).toBe(50);

        const reverted = endWildShape(result, DEFAULT_RULES);
        expect(reverted.wildShapeState).toBeNull();
        expect(reverted.resources.hp.current).toBe(50); // unaffected by the no-op damage
        // Post-revert, the base character has no native poison immunity of
        // its own — a poison hit against the now-reverted entity applies in full.
        const hitAfterRevert = applyDamage(reverted, 10, DEFAULT_RULES, 'poison');
        expect(hitAfterRevert.resources.hp.current).toBe(40);

        // Repeated transform/revert cycle — no leakage either direction.
        let reshaped = startWildShape(hitAfterRevert, formId, DEFAULT_RULES);
        const beastHpBefore2 = reshaped.wildShapeState!.beastHp;
        result = applyWildShapeDamage(reshaped, 500, DEFAULT_RULES, 'poison');
        expect(result).toBe(reshaped); // immunity reliably reapplies on the second transformation
        expect(result.wildShapeState?.beastHp).toBe(beastHpBefore2);
      },
    );

    it('Fire Elemental (the one real exception) remains immune to poison damage — unaffected by this closure', () => {
      const e = testEntity(50);
      const shaped = startWildShape(e, 'fire_elemental', DEFAULT_RULES);
      const result = applyWildShapeDamage(shaped, 999, DEFAULT_RULES, 'poison');
      expect(result).toBe(shaped); // no-op, immune
    });

    // Rules-engine blocker RE-AUDIT closure (3B): the shared elemental
    // resistance to bludgeoning/piercing/slashing from NONMAGICAL attacks —
    // a table-first, PER-HIT fact (isNonmagicalAttack), never inferred.
    describe('conditional nonmagical B/P/S resistance (closure 3B)', () => {
      it('marked nonmagical -> resisted (halved)', () => {
        const e = testEntity(50);
        let shaped = startWildShape(e, 'air_elemental', DEFAULT_RULES); // beastHpMax 90
        shaped = applyWildShapeDamage(shaped, 30, DEFAULT_RULES, 'bludgeoning', true);
        expect(shaped.wildShapeState?.active).toBe(true);
        expect(shaped.wildShapeState?.beastHp).toBe(75); // 90 - floor(30/2)=15
      });

      it('marked magical (the default) -> NOT resisted, same hit dealt in full', () => {
        const e = testEntity(50);
        let shaped = startWildShape(e, 'air_elemental', DEFAULT_RULES); // beastHpMax 90
        shaped = applyWildShapeDamage(shaped, 30, DEFAULT_RULES, 'bludgeoning'); // isNonmagicalAttack omitted -> false
        expect(shaped.wildShapeState?.beastHp).toBe(60); // 90-30, full damage
      });

      it('explicitly marked magical (false) -> NOT resisted, same as the default', () => {
        const e = testEntity(50);
        let shaped = startWildShape(e, 'air_elemental', DEFAULT_RULES);
        shaped = applyWildShapeDamage(shaped, 30, DEFAULT_RULES, 'bludgeoning', false);
        expect(shaped.wildShapeState?.beastHp).toBe(60);
      });

      it('only applies to bludgeoning/piercing/slashing — a nonmagical-marked FIRE hit is unaffected by this specific resistance', () => {
        const e = testEntity(50);
        let shaped = startWildShape(e, 'air_elemental', DEFAULT_RULES); // no fire resistance on Air Elemental
        shaped = applyWildShapeDamage(shaped, 30, DEFAULT_RULES, 'fire', true);
        expect(shaped.wildShapeState?.beastHp).toBe(60); // full damage — nonmagical flag is irrelevant to non-B/P/S types
      });

      it('does not double-halve when the SAME hit is ALSO covered by an unrelated type-based resistance (5e RAW: multiple resistance reasons never stack)', () => {
        const e = testEntity(50);
        let shaped = startWildShape(e, 'air_elemental', DEFAULT_RULES); // resists lightning AND nonmagical B/P/S
        // lightning isn't B/P/S, so nonmagicalBPSApplies is false here regardless —
        // this proves the type-based resistance path alone still only halves once.
        shaped = applyWildShapeDamage(shaped, 40, DEFAULT_RULES, 'lightning', true);
        expect(shaped.wildShapeState?.beastHp).toBe(70); // 90 - floor(40/2)=20, NOT floor(floor(40/2)/2)
      });

      it('a form with no nonmagicalPhysicalResistance flag is never discounted even when marked nonmagical', () => {
        const e = testEntity(30);
        let shaped = startWildShape(e, 'wolf', DEFAULT_RULES); // Wolf has no such flag
        shaped = applyWildShapeDamage(shaped, 6, DEFAULT_RULES, 'bludgeoning', true);
        expect(shaped.wildShapeState?.beastHp).toBe(5); // 11-6, unresisted
      });

      it('disappears after reversion: overflow from a nonmagical B/P/S hit is resolved once, never re-discounted post-revert', () => {
        const e = testEntity(50);
        let shaped = startWildShape(e, 'earth_elemental', DEFAULT_RULES); // beastHpMax 126
        // Raw 200 nonmagical bludgeoning -> resisted once to 100 -> 100 < 126
        // -> stays transformed (not the overflow case) — verify the discount
        // applies correctly first, then force overflow with a second hit.
        shaped = applyWildShapeDamage(shaped, 200, DEFAULT_RULES, 'bludgeoning', true);
        expect(shaped.wildShapeState?.active).toBe(true);
        expect(shaped.wildShapeState?.beastHp).toBe(26); // 126 - floor(200/2)=100
        // Now overkill it — overflow must be the ALREADY-resisted remainder,
        // never re-resisted against the reverted base entity.
        shaped = applyWildShapeDamage(shaped, 100, DEFAULT_RULES, 'bludgeoning', true);
        expect(shaped.wildShapeState).toBeNull();
        // resolved 100 -> floor(100/2)=50; beastHp was 26 -> overflow 50-26=24 -> base 50-24=26.
        expect(shaped.resources.hp.current).toBe(26);
      });
    });

    it('repeated transformations never duplicate/accumulate native defenses — elemental -> revert -> elemental again behaves identically both times', () => {
      const e = testEntity(50);
      let shaped = startWildShape(e, 'air_elemental', DEFAULT_RULES);
      shaped = applyWildShapeDamage(shaped, 40, DEFAULT_RULES, 'lightning');
      expect(shaped.wildShapeState?.beastHp).toBe(70); // 90 - floor(40/2)=20, same as the single-transformation test above

      const reverted = endWildShape(shaped, DEFAULT_RULES);
      expect(reverted.wildShapeState).toBeNull();

      let shapedAgain = startWildShape(reverted, 'air_elemental', DEFAULT_RULES);
      shapedAgain = applyWildShapeDamage(shapedAgain, 40, DEFAULT_RULES, 'lightning');
      // IDENTICAL result the second time — no accumulated/doubled resistance
      // from the first transformation leaking into the second.
      expect(shapedAgain.wildShapeState?.beastHp).toBe(70);
    });
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

// ── concentrationCheck ───────────────────────────────────────────────────────
// concentrationCheck() had zero callers anywhere in the app before this
// phase wired it into TabCharacter.tsx/ConcentrationModal.tsx and
// app/dm/encounter.tsx — the hand-rolled UI code it replaced had two real
// bugs (raw ability modifier instead of the derived, proficiency-aware save
// bonus; no War Caster logic) that these tests lock the real function
// against regressing into.

function emptySlots(): SpellSlots {
  const tiers = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;
  const slots = {} as SpellSlots;
  for (const t of tiers) slots[t] = { total: 0, used: 0 };
  return slots;
}

/** A concentrating entity with a known, directly-set CON save bonus —
 *  bypasses recomputeDerived entirely so tests aren't coupled to any
 *  particular race/class/feat's real bonus math. */
function concentratingEntity(conSaveBonus: number, overrides: Partial<Entity> = {}): Entity {
  const e = testEntity(20);
  const spellFeature: FeatureInstance = {
    id: 'spell_effect_1', name: 'Bless Effect', description: '', level: null,
    effects: [], actions: [], choices: [], passive: true, isActive: true,
    source: { kind: 'spell', refId: 'bless' },
  };
  return {
    ...e,
    features: [...e.features, spellFeature],
    spellcasting: {
      ability: 'wis', slots: emptySlots(), cantrips: [], known: [], prepared: [],
      concentrating: 'bless',
    },
    conditionMonitor: {
      ...e.conditionMonitor,
      flags: { ...e.conditionMonitor.flags, concentrating: true },
    },
    derived: { ...e.derived, savingThrows: { ...e.derived.savingThrows, con: conSaveBonus } },
    ...overrides,
  };
}

describe('concentrationCheck', () => {
  afterEach(() => {
    setRandomSource(Math.random);
  });

  it('is a no-op when the entity is not concentrating', () => {
    const e = testEntity(20);
    const result = concentrationCheck(e, 10, DEFAULT_RULES);
    expect(result).toBe(e); // same reference — no work done at all
  });

  it('DC is max(10, floor(damage/2)) — floor, not round/ceil, at the .5 boundary', () => {
    // 21 damage / 2 = 10.5 → DC must floor to 10, not ceil to 11.
    const e = concentratingEntity(0);
    setRandomSource(() => 9 / 20); // d20 roll of exactly 10 (floor(0.45*20)+1=10)
    const result = concentrationCheck(e, 21, DEFAULT_RULES);
    // If DC were (incorrectly) 11, a roll of 10 would fail and drop concentration.
    expect(result.spellcasting!.concentrating).toBe('bless');
  });

  it('passing the save keeps concentration untouched', () => {
    const e = concentratingEntity(5);
    setRandomSource(() => 0.9); // d20 roll of 19, +5 = 24, comfortably beats any DC
    const result = concentrationCheck(e, 10, DEFAULT_RULES); // DC 10
    expect(result.spellcasting!.concentrating).toBe('bless');
    expect(result.features.some(f => f.id === 'spell_effect_1')).toBe(true);
  });

  it('failing the save drops concentration — spell features removed, flag cleared', () => {
    const e = concentratingEntity(0);
    setRandomSource(() => 0); // d20 roll of 1, +0 = 1, fails any DC >= 10
    const result = concentrationCheck(e, 10, DEFAULT_RULES); // DC 10
    expect(result.spellcasting!.concentrating).toBeNull();
    expect(result.features.some(f => f.id === 'spell_effect_1')).toBe(false);
    expect(result.conditionMonitor.flags.concentrating).toBe(false);
  });

  it('grants War Caster advantage — rolls twice, keeps the higher', () => {
    const e = concentratingEntity(0, {
      features: [
        {
          id: 'feat_war_caster', name: 'War Caster', description: '', level: null,
          effects: [], actions: [], choices: [], passive: true, isActive: true,
          source: { kind: 'feat', refId: 'war_caster' },
        },
      ],
    });
    // First roll fails (1), second roll comfortably passes (20) — War Caster
    // must keep the second, higher roll rather than stopping at the first.
    let calls = 0;
    const sequence = [0, 0.95]; // d20: 1, then 20
    setRandomSource(() => sequence[calls++]);
    const result = concentrationCheck(e, 10, DEFAULT_RULES); // DC 10
    expect(result.spellcasting!.concentrating).toBe('bless');
  });

  it('without War Caster, only rolls once — a first-roll failure is final', () => {
    const e = concentratingEntity(0);
    let calls = 0;
    const sequence = [0, 0.95]; // if a second roll were (incorrectly) taken, it would pass
    setRandomSource(() => sequence[calls++]);
    const result = concentrationCheck(e, 10, DEFAULT_RULES); // DC 10
    expect(result.spellcasting!.concentrating).toBeNull(); // fails on the one roll it takes
    expect(calls).toBe(1); // proves only one roll happened
  });
});

// ── parseConcentrationDuration / castConcentrationSpell / tickConcentrationDuration ──
// Phase 3 of the engine-hardening track: concentration was previously just a
// bare spell-id pointer with no tracked duration anywhere. These tests lock
// in the parser's real-content range (sampled every `concentration: true`
// spell in src/content/spells/*.ts) plus the fail-open behavior for anything
// outside it, and the tick/auto-drop boundary.

/** testEntity() has spellcasting: null by default (makeEmptyEntity's own
 *  default) — beginConcentration is a no-op on a null spellcasting block,
 *  so any test that casts a spell needs a real (if otherwise empty) one. */
function casterEntity(): Entity {
  return {
    ...testEntity(20),
    spellcasting: {
      ability: 'wis', slots: emptySlots(), cantrips: [], known: [], prepared: [],
      concentrating: null,
    },
  };
}

function makeSpell(overrides: Partial<Spell> = {}): Spell {
  return {
    id: 'test_spell', name: 'Test Spell', level: 1, school: 'evocation',
    castingTime: '1 action', range: '30 feet', components: ['V', 'S'],
    duration: 'Concentration, up to 1 minute', description: '',
    upcast: null, ritual: false, concentration: true,
    ...overrides,
  };
}

describe('parseConcentrationDuration', () => {
  it.each([
    ['Concentration, up to 1 round',    1],
    ['Concentration, up to 1 minute',   10],
    ['Concentration, up to 10 minutes', 100],
    ['Concentration, up to 1 hour',     600],
    ['Concentration, up to 8 hours',    4800],
    ['1 minute',                        10],   // homebrew bare form, no prefix
  ])('parses %s to %i rounds', (text, expectedRounds) => {
    expect(parseConcentrationDuration(text)).toEqual({ unit: 'rounds', remaining: expectedRounds });
  });

  it.each([
    'Instantaneous',
    'Until dispelled',
    '',
  ])('fails open (returns null, never throws) for %s', (text) => {
    expect(() => parseConcentrationDuration(text)).not.toThrow();
    expect(parseConcentrationDuration(text)).toBeNull();
  });
});

describe('castConcentrationSpell — duration wiring', () => {
  it('sets concentratingDuration alongside concentrating for a parseable duration', () => {
    const e = casterEntity();
    const spell = makeSpell({ id: 'bless', duration: 'Concentration, up to 1 minute' });
    const result = castConcentrationSpell(e, spell, DEFAULT_RULES);
    expect(result.spellcasting!.concentrating).toBe('bless');
    expect(result.spellcasting!.concentratingDuration).toEqual({ unit: 'rounds', remaining: 10 });
  });

  it('leaves concentratingDuration undefined for an unparseable duration, while still concentrating', () => {
    const e = casterEntity();
    // Real content never pairs concentration:true with 'Instantaneous', but the
    // engine layer must fail open rather than assume every concentration spell
    // has a parseable duration (documents the fail-open contract at the layer
    // that actually calls the parser, not just the parser in isolation).
    const spell = makeSpell({ id: 'weird_spell', duration: 'Instantaneous' });
    const result = castConcentrationSpell(e, spell, DEFAULT_RULES);
    expect(result.spellcasting!.concentrating).toBe('weird_spell');
    expect(result.spellcasting!.concentratingDuration).toBeUndefined();
  });

  it('the Hex → Fly scenario replaces both concentrating and concentratingDuration, not just the id', () => {
    const e = casterEntity();
    const hex = makeSpell({ id: 'hex', duration: 'Concentration, up to 1 hour' });
    const fly = makeSpell({ id: 'fly', duration: 'Concentration, up to 10 minutes' });
    let updated = castConcentrationSpell(e, hex, DEFAULT_RULES);
    expect(updated.spellcasting!.concentratingDuration).toEqual({ unit: 'rounds', remaining: 600 });
    updated = castConcentrationSpell(updated, fly, DEFAULT_RULES);
    expect(updated.spellcasting!.concentrating).toBe('fly');
    expect(updated.spellcasting!.concentratingDuration).toEqual({ unit: 'rounds', remaining: 100 });
  });
});

describe('dropConcentration — clears the tracked duration', () => {
  it('clears concentratingDuration alongside concentrating', () => {
    const e = concentratingEntity(0, {
      spellcasting: {
        ability: 'wis', slots: emptySlots(), cantrips: [], known: [], prepared: [],
        concentrating: 'bless', concentratingDuration: { unit: 'rounds', remaining: 5 },
      },
    });
    const result = dropConcentration(e);
    expect(result.spellcasting!.concentrating).toBeNull();
    expect(result.spellcasting!.concentratingDuration).toBeUndefined();
  });
});

describe('tickConcentrationDuration', () => {
  function withDuration(remaining: number): Entity {
    return concentratingEntity(0, {
      spellcasting: {
        ability: 'wis', slots: emptySlots(), cantrips: [], known: [], prepared: [],
        concentrating: 'bless', concentratingDuration: { unit: 'rounds', remaining },
      },
    });
  }

  it('decrements remaining by 1 and stays concentrating', () => {
    const result = tickConcentrationDuration(withDuration(5), DEFAULT_RULES);
    expect(result.spellcasting!.concentrating).toBe('bless');
    expect(result.spellcasting!.concentratingDuration).toEqual({ unit: 'rounds', remaining: 4 });
  });

  it('auto-drops concentration when the countdown reaches 0 — features removed, flag cleared', () => {
    const result = tickConcentrationDuration(withDuration(1), DEFAULT_RULES);
    expect(result.spellcasting!.concentrating).toBeNull();
    expect(result.spellcasting!.concentratingDuration).toBeUndefined();
    expect(result.features.some(f => f.id === 'spell_effect_1')).toBe(false);
    expect(result.conditionMonitor.flags.concentrating).toBe(false);
  });

  it('is a no-op when not concentrating at all', () => {
    const e = testEntity(20);
    expect(tickConcentrationDuration(e, DEFAULT_RULES)).toBe(e);
  });

  it('is a no-op when concentrating but the duration never parsed (concentratingDuration undefined)', () => {
    const e = concentratingEntity(0); // default fixture has no concentratingDuration set
    const result = tickConcentrationDuration(e, DEFAULT_RULES);
    expect(result.spellcasting!.concentrating).toBe('bless'); // untouched, still concentrating
  });
});

// Re-audit item 18: playerEndTurn is the single authoritative solo-player
// End Turn mutation shared by the Character/Actions/Spells tabs' own
// buttons — this locks in that it's really the composition of all three
// (not a subset), so none of those three call sites can silently drift.
describe('playerEndTurn', () => {
  it('composes tickDurations + tickConcentrationDuration + startTurn in one call', () => {
    let e = concentratingEntity(0, {
      spellcasting: {
        ability: 'wis', slots: emptySlots(), cantrips: [], known: [], prepared: [],
        concentrating: 'bless', concentratingDuration: { unit: 'rounds', remaining: 1 },
      },
    });
    e = applyCondition(e, 'blinded', 'manual', DEFAULT_RULES, undefined, { unit: 'rounds', remaining: 1 });
    e.turnState = null;

    const result = playerEndTurn(e, DEFAULT_RULES);

    // tickDurations: the 1-round condition expired
    expect(result.conditionMonitor.active).toHaveLength(0);
    // tickConcentrationDuration: the 1-round concentration auto-dropped
    expect(result.spellcasting!.concentrating).toBeNull();
    // startTurn: action economy freshly reset
    expect(result.turnState).toEqual({ actionUsed: false, bonusActionUsed: false, reactionUsed: false });
  });

  it('defaults rules to DEFAULT_RULES when omitted', () => {
    const e = testEntity(20);
    expect(() => playerEndTurn(e)).not.toThrow();
    expect(playerEndTurn(e).turnState).toEqual({ actionUsed: false, bonusActionUsed: false, reactionUsed: false });
  });
});

// ── addToEncounter — reinforcement merge, turn-pointer preservation ──────────
// Regression coverage for Phase 1's prepared-encounter wave-deploy feature:
// inserting mid-combat must roll initiative for new arrivals only, merge them
// into the existing sorted order, and re-anchor turnIndex (a plain array
// index) to whichever entity currently has the turn — a naive insertion
// would silently point turnIndex at the wrong combatant whenever a new
// entry sorts ahead of the current turn.

describe('addToEncounter', () => {
  afterEach(() => setRandomSource(Math.random));

  function reinforcement(id: string, initiativeBonus: number): Entity {
    return { ...testEntity(10), id, identity: { ...testEntity(10).identity, name: id }, derived: { ...testEntity(10).derived, initiative: initiativeBonus } };
  }

  it('is a no-op when combat is not active', () => {
    const combat: CombatState = { active: false, round: 0, turnIndex: 0, order: [], encounterId: 'e1' };
    const result = addToEncounter(combat, [reinforcement('new1', 0)]);
    expect(result).toBe(combat);
  });

  it('is a no-op when there are no new entities', () => {
    const combat: CombatState = { active: true, round: 1, turnIndex: 0, order: [{ entityId: 'a', name: 'A', initiative: 10, tiebreak: 0, isPlayer: false, hasTakenTurn: false }], encounterId: 'e1' };
    expect(addToEncounter(combat, [])).toBe(combat);
  });

  it('rolls initiative for new entities only and merges them into the existing sorted order', () => {
    const combat: CombatState = {
      active: true, round: 1, turnIndex: 0,
      order: [
        { entityId: 'high', name: 'High', initiative: 20, tiebreak: 0, isPlayer: true, hasTakenTurn: true },
        { entityId: 'low',  name: 'Low',  initiative: 5,  tiebreak: 0, isPlayer: true, hasTakenTurn: false },
      ],
      encounterId: 'e1',
    };
    setRandomSource(() => 0); // reinforcement rolls a 1 on the d20
    const result = addToEncounter(combat, [reinforcement('new1', 9)]); // 1 + 9 = 10, lands between high and low
    expect(result.order.map(e => e.entityId)).toEqual(['high', 'new1', 'low']);
    expect(result.order.find(e => e.entityId === 'new1')?.hasTakenTurn).toBe(false);
  });

  it("re-anchors turnIndex to the currently-acting entity's new position after a mid-order insertion", () => {
    const combat: CombatState = {
      active: true, round: 1, turnIndex: 1, // "low" currently has the turn
      order: [
        { entityId: 'high', name: 'High', initiative: 20, tiebreak: 0, isPlayer: true, hasTakenTurn: true },
        { entityId: 'low',  name: 'Low',  initiative: 5,  tiebreak: 0, isPlayer: true, hasTakenTurn: false },
      ],
      encounterId: 'e1',
    };
    setRandomSource(() => 0); // reinforcement rolls a 1
    const result = addToEncounter(combat, [reinforcement('new1', 9)]); // sorts between high and low, ahead of the pointer
    expect(result.order[result.turnIndex].entityId).toBe('low'); // pointer followed "low" to its new index (2), not left at stale index 1
    expect(result.turnIndex).toBe(2);
  });

  it('merges multiple simultaneous reinforcements in one call', () => {
    const combat: CombatState = {
      active: true, round: 1, turnIndex: 0,
      order: [{ entityId: 'a', name: 'A', initiative: 10, tiebreak: 0, isPlayer: true, hasTakenTurn: false }],
      encounterId: 'e1',
    };
    setRandomSource(() => 0);
    const result = addToEncounter(combat, [reinforcement('new1', 0), reinforcement('new2', 5)]);
    expect(result.order).toHaveLength(3);
    expect(new Set(result.order.map(e => e.entityId))).toEqual(new Set(['a', 'new1', 'new2']));
  });
});

// Regression for audit finding ARCH-2: apply_condition/remove_condition
// AbilityEffects used to display correctly on an action card but produce
// zero actual game-state change — applyAbilityEffects had no case for them
// at all. 'grappled' is used here specifically because its real content
// definition carries a genuine mechanical feature (speed → 0), so this
// proves the fix all the way through to a derived-stat change, not just
// that a chip appears in entity.conditions.
describe('applyAbilityEffects — apply_condition / remove_condition (ARCH-2)', () => {
  it('apply_condition actually applies the condition and its mechanical effect', () => {
    const entity = testEntity();
    const before = entity.derived.speed;
    const effects: AbilityEffect[] = [
      { type: 'apply_condition', conditionId: 'grappled', duration: { unit: 'rounds', remaining: 1 } },
    ];

    const after = applyAbilityEffects(entity, effects);

    expect(after.conditions.some(c => c.id === 'grappled')).toBe(true);
    expect(after.derived.speed).toBe(0); // the actual mechanical effect, not just the chip
    expect(before).toBeGreaterThan(0); // sanity: it really changed something
  });

  it('remove_condition actually removes the condition and reverts its mechanical effect', () => {
    let entity = testEntity();
    entity = applyAbilityEffects(entity, [
      { type: 'apply_condition', conditionId: 'grappled', duration: { unit: 'rounds', remaining: 1 } },
    ]);
    expect(entity.derived.speed).toBe(0);

    const after = applyAbilityEffects(entity, [{ type: 'remove_condition', conditionId: 'grappled' }]);

    expect(after.conditions.some(c => c.id === 'grappled')).toBe(false);
    expect(after.derived.speed).toBeGreaterThan(0);
  });

  it('grant_speed still has no effect (explicitly deferred, not silently claimed as done)', () => {
    const entity = testEntity();
    const after = applyAbilityEffects(entity, [
      { type: 'grant_speed', speedType: 'fly', amount: 30, duration: { unit: 'rounds', remaining: 1 } },
    ]);
    expect(after.derived.movement?.fly ?? 0).toBe(entity.derived.movement?.fly ?? 0);
  });

  // Table-first correction, on top of ARCH-2 above: apply_condition/
  // remove_condition now only auto-apply for a self-targeting, unconditional
  // activation. A target-contingent one (not target:'self', or requiresSave
  // set — e.g. a monster's "target makes a save or becomes X" attack) is
  // left for manual/table resolution instead of silently applying to
  // whichever entity used the ability. See legendaryActions.test.ts's Lich
  // Frightening Gaze test for the same fix proven through real content.
  const selfActivation: FeatureActivation = { actionType: 'free', resourceCost: null, range: 'self', target: 'self', requiresSave: null };
  const targetActivation: FeatureActivation = { actionType: 'action', resourceCost: null, range: '10 feet', target: 'single', requiresSave: { ability: 'wis', dc: 15 } };

  it('a self-targeting, unconditional activation (no `activation` arg — every pre-existing caller) still applies apply_condition immediately', () => {
    const entity = testEntity();
    const after = applyAbilityEffects(entity, [
      { type: 'apply_condition', conditionId: 'grappled', duration: { unit: 'rounds', remaining: 1 } },
    ]);
    expect(after.conditions.some(c => c.id === 'grappled')).toBe(true);
  });

  it('an explicit self-targeting, unconditional activation still applies apply_condition immediately', () => {
    const entity = testEntity();
    const after = applyAbilityEffects(entity, [
      { type: 'apply_condition', conditionId: 'grappled', duration: { unit: 'rounds', remaining: 1 } },
    ], DEFAULT_RULES, selfActivation);
    expect(after.conditions.some(c => c.id === 'grappled')).toBe(true);
  });

  it('a target-contingent activation (target:"single" + requiresSave) does NOT apply apply_condition to the entity using the ability', () => {
    const entity = testEntity();
    const after = applyAbilityEffects(entity, [
      { type: 'apply_condition', conditionId: 'frightened', duration: { unit: 'minutes', remaining: 1 } },
    ], DEFAULT_RULES, targetActivation);
    expect(after.conditions).toHaveLength(0);
    expect(after).not.toBe(entity); // still a real (if identical-in-conditions) recomputed entity, not a bypass
  });

  it('a target-contingent activation does NOT apply remove_condition either', () => {
    let entity = testEntity();
    entity = applyAbilityEffects(entity, [
      { type: 'apply_condition', conditionId: 'grappled', duration: { unit: 'rounds', remaining: 1 } },
    ]); // self/unconditional call — establishes the condition to try to remove
    expect(entity.conditions.some(c => c.id === 'grappled')).toBe(true);

    const after = applyAbilityEffects(entity, [
      { type: 'remove_condition', conditionId: 'grappled' },
    ], DEFAULT_RULES, targetActivation);
    expect(after.conditions.some(c => c.id === 'grappled')).toBe(true); // untouched
  });

  it('deterministic self effects (set_flag, restore_resource) still apply immediately regardless of activation contingency', () => {
    const entity = { ...testEntity(), resources: { ...testEntity().resources, custom: [{ id: 'r1', name: 'R', current: 0, maximum: 3, recharge: 'long_rest' }] } };
    const after = applyAbilityEffects(entity, [
      { type: 'set_flag', flag: 'rage_active', value: true },
      { type: 'restore_resource', resourceId: 'r1', amount: 1 },
    ], DEFAULT_RULES, targetActivation); // even under a target-contingent activation
    expect(after.conditionMonitor.flags.rage_active).toBe(true);
    expect(after.resources.custom.find(r => r.id === 'r1')?.current).toBe(1);
  });
});

// ── Table-first initiative: manual by default, roll is opt-in ───────────────

describe('startEncounter — roll parameter (table-first)', () => {
  afterEach(() => setRandomSource(Math.random));

  it('roll:false seeds every entry at initiative 0, sorted by tiebreak alone', () => {
    const low  = { ...testEntity(10), id: 'low',  identity: { ...testEntity(10).identity, name: 'Low' },  derived: { ...testEntity(10).derived, initiative: 1 } };
    const high = { ...testEntity(10), id: 'high', identity: { ...testEntity(10).identity, name: 'High' }, derived: { ...testEntity(10).derived, initiative: 5 } };
    const result = startEncounter([low, high], 'enc1', undefined, false);
    expect(result.order.map(e => e.initiative)).toEqual([0, 0]);
    expect(result.order.map(e => e.entityId)).toEqual(['high', 'low']); // tiebreak still orders them
  });

  it('roll:true (and the default, for backward compatibility) still rolls', () => {
    setRandomSource(() => 0.5); // d20 roll of 11
    const e = testEntity(10);
    const result = startEncounter([e], 'enc1', undefined, true);
    expect(result.order[0].initiative).not.toBe(0);
  });

  it('omitting roll entirely defaults to true — no existing caller/test is affected', () => {
    setRandomSource(() => 0.5);
    const e = testEntity(10);
    const result = startEncounter([e], 'enc1');
    expect(result.order[0].initiative).not.toBe(0);
  });
});

describe('addToEncounter — roll parameter (table-first)', () => {
  afterEach(() => setRandomSource(Math.random));

  it('roll:false seeds reinforcements at 0 instead of rolling', () => {
    const combat: CombatState = {
      active: true, round: 1, turnIndex: 0,
      order: [{ entityId: 'a', name: 'A', initiative: 10, tiebreak: 0, isPlayer: true, hasTakenTurn: false }],
      encounterId: 'e1',
    };
    const reinforcement = { ...testEntity(10), id: 'new1', identity: { ...testEntity(10).identity, name: 'new1' } };
    const result = addToEncounter(combat, [reinforcement], false);
    expect(result.order.find(e => e.entityId === 'new1')?.initiative).toBe(0);
  });
});

describe('rollInitiativeValue', () => {
  afterEach(() => setRandomSource(Math.random));

  it('rolls a d20 against entity.derived.initiative', () => {
    setRandomSource(() => 0); // d20 roll of 1
    const e = { ...testEntity(10), derived: { ...testEntity(10).derived, initiative: 4 } };
    expect(rollInitiativeValue(e)).toBe(5);
  });
});

describe('rollAllInitiative', () => {
  afterEach(() => setRandomSource(Math.random));

  it('rolls and re-sorts every entry currently in the order, using each live entity\'s own initiative modifier', () => {
    // entity.derived.initiative doubles as both the d20 roll's modifier and
    // the sort tiebreak (see rollAllInitiative's own implementation) — give
    // a and b different modifiers so the re-roll visibly changes the order.
    const a = { ...testEntity(10), id: 'a', identity: { ...testEntity(10).identity, name: 'a' }, derived: { ...testEntity(10).derived, initiative: 0 } };
    const b = { ...testEntity(10), id: 'b', identity: { ...testEntity(10).identity, name: 'b' }, derived: { ...testEntity(10).derived, initiative: 5 } };
    const combat: CombatState = {
      active: true, round: 1, turnIndex: 0,
      order: [
        { entityId: 'a', name: 'a', initiative: 99, tiebreak: 0, isPlayer: true, hasTakenTurn: false }, // stale value from a prior roll
        { entityId: 'b', name: 'b', initiative: 1,  tiebreak: 0, isPlayer: true, hasTakenTurn: false },
      ],
      encounterId: 'e1',
    };
    setRandomSource(() => 0); // both roll a 1 on the die itself
    const result = rollAllInitiative(combat, [a, b]);
    expect(result.order.map(e => ({ id: e.entityId, initiative: e.initiative }))).toEqual([
      { id: 'b', initiative: 6 }, // 1 + modifier 5 — now correctly ahead of a despite a's stale 99
      { id: 'a', initiative: 1 }, // 1 + modifier 0
    ]);
  });

  it('leaves an entry alone if its entity is no longer present', () => {
    const combat: CombatState = {
      active: true, round: 1, turnIndex: 0,
      order: [{ entityId: 'ghost', name: 'ghost', initiative: 5, tiebreak: 0, isPlayer: false, hasTakenTurn: false }],
      encounterId: 'e1',
    };
    const result = rollAllInitiative(combat, []);
    expect(result.order[0].initiative).toBe(5); // unchanged, no crash
  });

  // Closure 1 (active-actor stability): re-rolling the whole order must not
  // silently hand the turn to whoever else lands at the previous position.
  it("re-anchors turnIndex to the currently-acting entity's new position after Roll All Initiative", () => {
    const a = { ...testEntity(10), id: 'a', identity: { ...testEntity(10).identity, name: 'a' }, derived: { ...testEntity(10).derived, initiative: 0 } };
    const b = { ...testEntity(10), id: 'b', identity: { ...testEntity(10).identity, name: 'b' }, derived: { ...testEntity(10).derived, initiative: 20 } };
    const c = { ...testEntity(10), id: 'c', identity: { ...testEntity(10).identity, name: 'c' }, derived: { ...testEntity(10).derived, initiative: 0 } };
    const combat: CombatState = {
      active: true, round: 1, turnIndex: 1, // 'b' currently has the turn, sitting in the middle
      order: [
        { entityId: 'a', name: 'a', initiative: 20, tiebreak: 0,  isPlayer: true, hasTakenTurn: true },
        { entityId: 'b', name: 'b', initiative: 10, tiebreak: 20, isPlayer: true, hasTakenTurn: false },
        { entityId: 'c', name: 'c', initiative: 5,  tiebreak: 0,  isPlayer: true, hasTakenTurn: false },
      ],
      encounterId: 'e1',
    };
    setRandomSource(() => 0.99); // near-max roll — b's +20 modifier now puts it comfortably first
    const result = rollAllInitiative(combat, [a, b, c]);
    expect(result.order[result.turnIndex].entityId).toBe('b'); // still 'b', regardless of where the re-roll placed it
  });
});

// ── reanchorTurnIndex (shared active-actor stability helper) ────────────────

describe('reanchorTurnIndex', () => {
  function entry(id: string): InitiativeEntry {
    return { entityId: id, name: id, initiative: 0, tiebreak: 0, isPlayer: true, hasTakenTurn: false };
  }

  it('finds the current entity at its new position after a reorder', () => {
    const order = [entry('c'), entry('b'), entry('a')]; // reordered from [a,b,c]
    expect(reanchorTurnIndex(order, 'b', 1)).toBe(1); // b stayed at index 1, coincidentally
    expect(reanchorTurnIndex(order, 'a', 0)).toBe(2); // a moved from 0 to 2 — followed, not left stale
  });

  it('falls back to the previous index, clamped, when the entity is no longer present', () => {
    const order = [entry('x'), entry('y')];
    expect(reanchorTurnIndex(order, 'gone', 5)).toBe(1); // clamped to the last valid index
    expect(reanchorTurnIndex(order, undefined, 0)).toBe(0);
  });

  it('clamps to 0 for an empty order', () => {
    expect(reanchorTurnIndex([], 'anyone', 3)).toBe(0);
  });
});

// ── Table-first concentration: manual result vs. app roll, one resolution path ──

describe('rollConcentrationSave + resolveConcentrationOutcome (table-first split of concentrationCheck)', () => {
  afterEach(() => setRandomSource(Math.random));

  function concentratingEntity(conBonus: number, overrides: Partial<Entity> = {}): Entity {
    const e = testEntity();
    return {
      ...e,
      ...overrides,
      derived: { ...e.derived, savingThrows: { ...e.derived.savingThrows, con: conBonus } },
      spellcasting: {
        ability: 'int', known: [], cantrips: [], prepared: [], slots: {} as SpellSlots,
        concentrating: 'bless',
        concentratingDuration: undefined,
      },
      features: [
        ...(overrides.features ?? []),
        {
          id: 'spell_effect_1', name: 'Bless Effect', description: '', level: null,
          effects: [], actions: [], choices: [], passive: true, isActive: true,
          source: { kind: 'spell', refId: 'bless' },
        },
      ],
    };
  }

  it('rollConcentrationSave computes DC/roll/passed without mutating anything', () => {
    const e = concentratingEntity(5);
    setRandomSource(() => 0.9); // d20 roll of 19, +5 = 24
    const result = rollConcentrationSave(e, 10); // DC 10
    expect(result).toEqual({ passed: true, dc: 10, roll: 24 });
    expect(e.spellcasting!.concentrating).toBe('bless'); // untouched — pure computation
  });

  it('resolveConcentrationOutcome(entity, true) keeps concentration', () => {
    const e = concentratingEntity(0);
    const after = resolveConcentrationOutcome(e, true);
    expect(after.spellcasting!.concentrating).toBe('bless');
    expect(after.features.some(f => f.id === 'spell_effect_1')).toBe(true);
  });

  it('resolveConcentrationOutcome(entity, false) drops concentration — same cleanup as concentrationCheck', () => {
    const e = concentratingEntity(0);
    const after = resolveConcentrationOutcome(e, false);
    expect(after.spellcasting!.concentrating).toBeNull();
    expect(after.features.some(f => f.id === 'spell_effect_1')).toBe(false);
    expect(after.conditionMonitor.flags.concentrating).toBe(false);
  });

  it('resolveConcentrationOutcome is a no-op when not concentrating, for either outcome', () => {
    const e = testEntity();
    expect(resolveConcentrationOutcome(e, true)).toBe(e);
    expect(resolveConcentrationOutcome(e, false)).toBe(e);
  });

  it('manual buttons and the app-roll convenience agree: concentrationCheck itself composes the exact same two split functions', () => {
    const e = concentratingEntity(0);
    setRandomSource(() => 0); // fails any DC >= 10
    const viaConcentrationCheck = concentrationCheck(e, 10, DEFAULT_RULES);
    const { passed } = rollConcentrationSave(e, 10);
    const viaSplit = resolveConcentrationOutcome(e, passed);
    expect(viaConcentrationCheck.spellcasting!.concentrating).toBe(viaSplit.spellcasting!.concentrating);
  });
});

// ── Table-first recharge (e.g. "Recharge 5-6") ───────────────────────────────

describe('parseRechargeThreshold', () => {
  it('parses "Recharge 5-6" (and the en-dash variant) to the minimum face', () => {
    expect(parseRechargeThreshold('Recharge 5-6')).toBe(5);
    expect(parseRechargeThreshold('Recharge 5–6')).toBe(5);
  });

  it('parses a bare single-value "Recharge 6"', () => {
    expect(parseRechargeThreshold('Recharge 6')).toBe(6);
  });

  it('is case-insensitive', () => {
    expect(parseRechargeThreshold('recharge 4-6')).toBe(4);
  });

  it('returns null for rest-based, start_of_turn, and freeform text that is not a recharge pattern', () => {
    expect(parseRechargeThreshold('short_rest')).toBeNull();
    expect(parseRechargeThreshold('long_rest')).toBeNull();
    expect(parseRechargeThreshold('start_of_turn')).toBeNull();
    expect(parseRechargeThreshold('dawn')).toBeNull();
    expect(parseRechargeThreshold('never')).toBeNull();
    expect(parseRechargeThreshold('once per short or long rest')).toBeNull();
  });

  // Closure 3E: anchored parsing — the whole trimmed string must be exactly
  // "Recharge N" or "Recharge N-6", nothing more, nothing less.
  it('rejects "Recharge 4-5" — the engine only models X-6 semantics, never X-5', () => {
    expect(parseRechargeThreshold('Recharge 4-5')).toBeNull();
  });

  it('rejects trailing junk after an otherwise-valid pattern', () => {
    expect(parseRechargeThreshold('Recharge 5-6 extra junk')).toBeNull();
  });

  it('rejects a recharge-shaped substring embedded in a longer sentence', () => {
    expect(parseRechargeThreshold('This ability has a Recharge 5-6 that only triggers sometimes')).toBeNull();
  });

  it('tolerates surrounding whitespace on an otherwise exact match', () => {
    expect(parseRechargeThreshold('  Recharge 5-6  ')).toBe(5);
  });

  it('rejects a threshold outside 2-6', () => {
    expect(parseRechargeThreshold('Recharge 1')).toBeNull();
  });
});

describe('extractRechargeTag (closure 3A: pulling a recharge clause out of a real stat-block description)', () => {
  it('extracts "Recharge 5-6" from the start of a real description, dropping the trailing period and the rest of the sentence', () => {
    expect(extractRechargeTag('Recharge 5-6. The dragon head exhales fire in a 15-foot cone.')).toBe('Recharge 5-6');
  });

  it('extracts a bare "Recharge 6" form', () => {
    expect(extractRechargeTag('Recharge 6. A 15-ft.-radius cloud of toxic spores extends from the vrock.')).toBe('Recharge 6');
  });

  it('extracts "Recharge 4-6" (a real non-5 threshold seen in this content)', () => {
    expect(extractRechargeTag("Recharge 4-6. Each creature in the elemental's space makes a DC 15 STR save.")).toBe('Recharge 4-6');
  });

  it('is case-insensitive and tolerates the en-dash variant', () => {
    expect(extractRechargeTag('recharge 5–6. Some effect.')).toBe('recharge 5–6');
  });

  it('returns null when the description has no leading Recharge clause at all', () => {
    expect(extractRechargeTag('Melee Weapon Attack: +7 to hit, reach 5 ft., one target.')).toBeNull();
  });

  it('returns null for a malformed "Recharge 4-5" clause (not X-6)', () => {
    expect(extractRechargeTag('Recharge 4-5. Some effect.')).toBeNull();
  });

  it('returns null when the recharge clause is NOT at the very start of the description', () => {
    expect(extractRechargeTag('This creature has a Recharge 5-6. effect somewhere in the middle.')).toBeNull();
  });

  it('returns null when there is no terminating period at all', () => {
    expect(extractRechargeTag('Recharge 5-6 with no period')).toBeNull();
  });
});

describe('extractRechargeTagFromName (closure 2C: name-suffix recharge form)', () => {
  it('extracts "Recharge 6" from a real name suffix — the Ghost\'s "Possession (Recharge 6)"', () => {
    expect(extractRechargeTagFromName('Possession (Recharge 6)')).toBe('Recharge 6');
  });

  it('supports the hyphen and en-dash "(Recharge 5-6)" / "(Recharge 5–6)" forms', () => {
    expect(extractRechargeTagFromName('Fire Breath (Recharge 5-6)')).toBe('Recharge 5-6');
    expect(extractRechargeTagFromName('Fire Breath (Recharge 5–6)')).toBe('Recharge 5–6');
  });

  it('is anchored to the END of the name — trailing junk after the parenthesized form is rejected', () => {
    expect(extractRechargeTagFromName('Fire Breath (Recharge 5-6) extra')).toBeNull();
  });

  it('rejects a real other-monster name that merely contains the word "Recharge" pluralized — "Leadership (Recharges After a Short/Long Rest)"', () => {
    expect(extractRechargeTagFromName('Leadership (Recharges After a Short/Long Rest)')).toBeNull();
    expect(extractRechargeTagFromName('Animate Chains (Recharges After a Short/Long Rest)')).toBeNull();
  });

  it('rejects a malformed "(Recharge 4-5)" suffix (not X-6)', () => {
    expect(extractRechargeTagFromName('Something (Recharge 4-5)')).toBeNull();
  });

  it('returns null for a name with no parenthesized recharge suffix at all', () => {
    expect(extractRechargeTagFromName('Multiattack')).toBeNull();
  });
});

describe('resolveFeatureRechargeTag (closure 2C: combined name/description resolution)', () => {
  it('uses the leading description clause when only the description has one', () => {
    expect(resolveFeatureRechargeTag('Fire Breath', 'Recharge 5-6. Exhales fire.')).toBe('Recharge 5-6');
  });

  it('uses the name suffix when only the name has one', () => {
    expect(resolveFeatureRechargeTag('Possession (Recharge 6)', 'One humanoid makes a save.')).toBe('Recharge 6');
  });

  it('the name suffix wins when BOTH the name and description carry recharge metadata — resolves to exactly one tag, never two', () => {
    expect(resolveFeatureRechargeTag('Doom Blast (Recharge 5-6)', 'Recharge 6. Devastating blast.')).toBe('Recharge 5-6');
  });

  it('returns null when neither the name nor the description has a recognizable clause', () => {
    expect(resolveFeatureRechargeTag('Multiattack', 'The creature makes two attacks.')).toBeNull();
  });
});

describe('rollRecharge', () => {
  // rollRecharge uses Math.random() directly (not dice.ts's shared
  // randomSource), so it's seeded via jest.spyOn(Math, 'random') here rather
  // than setRandomSource — matching leveling.test.ts's rollDie precedent.
  const originalRandom = Math.random;
  afterEach(() => { Math.random = originalRandom; });

  it('succeeds when the roll meets or beats the threshold', () => {
    Math.random = () => 0.99; // d6 roll of 6
    expect(rollRecharge(5)).toEqual({ roll: 6, success: true });
  });

  it('fails when the roll is below the threshold', () => {
    Math.random = () => 0; // d6 roll of 1
    expect(rollRecharge(5)).toEqual({ roll: 1, success: false });
  });
});
