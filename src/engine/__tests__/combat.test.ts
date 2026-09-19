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
  CombatState,
} from '../combat';
import { applyCondition } from '../conditions';
import { isFeatureAvailable } from '../actionCards';
import { setRandomSource } from '../dice';
import { Entity, SpellSlots, FeatureInstance, Spell, AbilityEffect } from '../types';

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
});
