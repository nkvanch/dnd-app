// src/engine/__tests__/extraAttackMultiattack.test.ts
// Extra Attack / action-structure batch: ONE Action containing MULTIPLE
// attacks, never confused with multiple Actions or multiple action-economy
// spends. Covers:
//   - DerivedStats.attackActionAttacks (pipeline.ts) — end-to-end wiring of
//     the pre-existing resolveExtraAttack primitive (resolver.ts already has
//     its own dedicated, more exhaustive unit tests).
//   - ActionCard.isWeaponAttack — which cards are eligible attack
//     opportunities for the Attack action.
//   - Extra Attack SEQUENCE closure (single-HIGH final closure): the
//     original `isChainedAttack?: boolean` escape hatch let ANY caller
//     assert "this is a chained attack" with zero verification. It has been
//     REMOVED and replaced by `attackSequence?: AttackSequenceUse` — an
//     opaque correlation token resolved against the entity's OWN
//     authoritative `entity.attackSequence` record (AttackSequenceState,
//     types.ts). This file's "parent-action/child-attack economy" describe
//     block now doubles as the security/forged-call test matrix (Parts P/Q
//     of the closure spec) proving a bare token can never manufacture
//     authority it wasn't actually granted.
import {
  Entity, Item, ItemInstance, FeatureInstance, ActionCard, AttackSequenceUse,
} from '../types';
import { recomputeDerived } from '../pipeline';
import { generateAllActionCards } from '../actionCards';
import { applyActionCardUse } from '../actionUse';
import { makeEmptyEntity, DEFAULT_RULES } from '../../store/characterStore';
import { startTurn, endAttackSequence, stripTransientRuntimeState } from '../combat';
import { monsterOwlbear } from '../../content/monsters/srd';
import { spawnMonster } from '../monsterFactory';
import { serializePortableCharacter, parsePortableCharacter } from '../../io/characterPortable';

function extraAttackFeature(id: string, value: number, level = 5): FeatureInstance {
  return {
    id, name: 'Extra Attack', description: '', source: { kind: 'class', refId: id },
    level, effects: [{ type: 'stat_modifier', target: 'extra_attack', operation: 'set', value, condition: null }],
    actions: [], choices: [], passive: true, isActive: true,
  };
}

describe('Extra Attack / action-structure batch — DerivedStats.attackActionAttacks (end-to-end wiring)', () => {
  it('an ordinary character (no Extra Attack feature) has exactly 1 attack', () => {
    const e = makeEmptyEntity('e1');
    const result = recomputeDerived(e, DEFAULT_RULES);
    expect(result.derived.attackActionAttacks).toBe(1);
  });

  it('a Fighter-5-shaped character (single extra_attack grant, value 1) has 2 attacks', () => {
    let e = { ...makeEmptyEntity('e1'), features: [extraAttackFeature('extra_attack_fighter', 1)] };
    e = recomputeDerived(e, DEFAULT_RULES);
    expect(e.derived.attackActionAttacks).toBe(2);
  });

  it('a Paladin-5-shaped character has 2 attacks', () => {
    let e = { ...makeEmptyEntity('e1'), features: [extraAttackFeature('extra_attack_paladin', 1)] };
    e = recomputeDerived(e, DEFAULT_RULES);
    expect(e.derived.attackActionAttacks).toBe(2);
  });

  it('Fighter 5 / Paladin 5 (BOTH grants present, real multiclass shape) → still 2, never 3 (max, not additive)', () => {
    let e = {
      ...makeEmptyEntity('e1'),
      features: [extraAttackFeature('extra_attack_fighter', 1), extraAttackFeature('extra_attack_paladin', 1)],
    };
    e = recomputeDerived(e, DEFAULT_RULES);
    expect(e.derived.attackActionAttacks).toBe(2);
  });

  it('a higher Fighter tier (value 2 → 3 attacks) alongside Paladin\'s grant still resolves to 3, not 4', () => {
    let e = {
      ...makeEmptyEntity('e1'),
      features: [extraAttackFeature('extra_attack_2_fighter', 2, 11), extraAttackFeature('extra_attack_paladin', 1)],
    };
    e = recomputeDerived(e, DEFAULT_RULES);
    expect(e.derived.attackActionAttacks).toBe(3);
  });

  it('the highest Fighter tier (value 3) resolves to 4 attacks', () => {
    let e = { ...makeEmptyEntity('e1'), features: [extraAttackFeature('extra_attack_3_fighter', 3, 20)] };
    e = recomputeDerived(e, DEFAULT_RULES);
    expect(e.derived.attackActionAttacks).toBe(4);
  });
});

// ── Weapon fixtures (mirrors itemInstanceIdentity.test.ts's own dagger
// pattern exactly, so the synthetic "basic weapon attack" card path is
// exercised the same way that closure's own tests already validated). ──────
function daggerBaseDef(): Item {
  return {
    id: 'dagger', name: 'Dagger', weight: 1, cost: '2 gp', properties: ['finesse', 'light'],
    features: [{
      id: 'dagger_attack', name: 'Dagger', description: '', source: { kind: 'item', refId: 'dagger' },
      level: null, effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'action', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
      abilityEffects: [{ type: 'damage', dice: '1d4', damageType: 'piercing' }],
    }],
  };
}
function daggerDef(): Item {
  return { id: 'test_dagger', name: 'Dagger', weight: 1, cost: '2 gp', properties: ['finesse', 'light'], features: [] };
}
function wandDef(): Item {
  // A non-weapon item with its own authored damage-dealing feature — must
  // NOT be flagged isWeaponAttack (see that field's own doc comment).
  return {
    id: 'test_wand', name: 'Test Wand', weight: 1, cost: '', properties: [],
    features: [{
      id: 'test_wand_zap', name: 'Zap', description: '', source: { kind: 'item', refId: 'test_wand' },
      level: null, effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'action', resourceCost: null, range: '30 feet', target: 'single', requiresSave: null },
      abilityEffects: [{ type: 'damage', dice: '1d10', damageType: 'force' }],
    }],
  };
}
function magicSwordDef(): Item {
  // A weapon with its OWN authored attack feature (not the synthetic
  // basic-weapon-attack fallback path) — must still be flagged
  // isWeaponAttack, since the item itself is a weapon.
  return {
    id: 'test_magic_sword', name: 'Magic Sword', weight: 3, cost: '', properties: ['martial'],
    features: [{
      id: 'test_magic_sword_attack', name: 'Magic Sword', description: '', source: { kind: 'item', refId: 'test_magic_sword' },
      level: null, effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'action', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
      abilityEffects: [{ type: 'damage', dice: '1d8+1', damageType: 'slashing' }],
    }],
  };
}
function costedWeaponDef(): Item {
  // A weapon whose authored attack feature has a real per-use resourceCost
  // (standing in for a future per-attack resource like ammunition/charges)
  // — H1/Part L: proves a CHAINED attack still pays its own real cost, using
  // a card that's actually eligible (isWeaponAttack) rather than an
  // arbitrary class feature, which the sequence closure's Part C now
  // excludes from ever being a valid sequence child.
  return {
    id: 'test_costed_weapon', name: 'Costed Weapon', weight: 2, cost: '', properties: ['martial'],
    features: [{
      id: 'test_costed_weapon_attack', name: 'Costed Weapon', description: '', source: { kind: 'item', refId: 'test_costed_weapon' },
      level: null, effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'action', resourceCost: { resourceId: 'test_charges', quantity: 1 }, range: '5 feet', target: 'single', requiresSave: null },
      abilityEffects: [{ type: 'damage', dice: '1d8', damageType: 'slashing' }],
    }],
  };
}
function bonusActionWeaponDef(): Item {
  // Extra Attack sequence closure (two-issue final closure, Part A2): a
  // weapon whose OWN authored attack feature activates as a Bonus Action
  // (e.g. a "as a bonus action, make a melee weapon attack" rider) — deals
  // damage, belongs to a weapon, but is NOT a genuine Attack-action attack.
  // Must NOT be flagged isWeaponAttack merely because it satisfies the
  // damage+weapon half of the old, too-broad gate.
  return {
    id: 'test_bonus_weapon', name: 'Bonus Action Blade', weight: 2, cost: '', properties: ['martial'],
    features: [{
      id: 'test_bonus_weapon_attack', name: 'Bonus Action Blade', description: '', source: { kind: 'item', refId: 'test_bonus_weapon' },
      level: null, effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'bonus_action', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
      abilityEffects: [{ type: 'damage', dice: '1d6', damageType: 'slashing' }],
    }],
  };
}
function reactionWeaponDef(): Item {
  // Same as bonusActionWeaponDef but Reaction-activated (e.g. a "when hit,
  // make a reaction melee attack" rider weapon).
  return {
    id: 'test_reaction_weapon', name: 'Reaction Spike', weight: 2, cost: '', properties: ['martial'],
    features: [{
      id: 'test_reaction_weapon_attack', name: 'Reaction Spike', description: '', source: { kind: 'item', refId: 'test_reaction_weapon' },
      level: null, effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'reaction', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
      abilityEffects: [{ type: 'damage', dice: '1d6', damageType: 'piercing' }],
    }],
  };
}
const weaponContent = {
  items: [daggerDef(), daggerBaseDef(), wandDef(), magicSwordDef(), costedWeaponDef(), bonusActionWeaponDef(), reactionWeaponDef()],
};

/** A minimal, directly-constructed ActionCard — used to simulate a forged/
 *  malicious call site handing applyActionCardUse a card shape it never
 *  actually generated (Part P.5-9: spell/feature/bonus/reaction/passive
 *  cards attempted as sequence children). Every field not overridden is a
 *  harmless, generically-legal default. */
function fakeCard(overrides: Partial<ActionCard> & Pick<ActionCard, 'activation'>): ActionCard {
  return {
    featureId: 'fake_card_test', name: 'Fake Card', cardType: 'damage', color: 'red',
    layer1: '', layer2: '', layer3: null, outcomes: [], triggerNote: null,
    resourceCost: null, tabs: ['actions'], available: true, unavailableReason: null,
    ...overrides,
  };
}

describe('Extra Attack / action-structure batch — ActionCard.isWeaponAttack', () => {
  it('the synthetic basic-weapon-attack card is flagged isWeaponAttack', () => {
    const daggerA: ItemInstance = { id: 'dagger-a', itemId: 'test_dagger', quantity: 1, attuned: false, features: [] };
    let e = { ...makeEmptyEntity('e1'), inventory: { ...makeEmptyEntity('e1').inventory, equipped: [daggerA] } };
    e = recomputeDerived(e, DEFAULT_RULES, weaponContent);
    const cards = generateAllActionCards(e, DEFAULT_RULES, weaponContent);
    const daggerCard = cards.find(c => c.featureId.includes('basic_weapon_attack'))!;
    expect(daggerCard).toBeDefined();
    expect(daggerCard.isWeaponAttack).toBe(true);
  });

  it('Unarmed Strike is flagged isWeaponAttack', () => {
    const e = recomputeDerived(makeEmptyEntity('e1'), DEFAULT_RULES);
    const cards = generateAllActionCards(e, DEFAULT_RULES, {});
    const unarmed = cards.find(c => c.featureId === 'unarmed_strike')!;
    expect(unarmed).toBeDefined();
    expect(unarmed.isWeaponAttack).toBe(true);
  });

  it('an authored attack feature on a WEAPON item is flagged isWeaponAttack', () => {
    const swordA: ItemInstance = { id: 'sword-a', itemId: 'test_magic_sword', quantity: 1, attuned: false, features: [] };
    let e = { ...makeEmptyEntity('e1'), inventory: { ...makeEmptyEntity('e1').inventory, equipped: [swordA] } };
    e = recomputeDerived(e, DEFAULT_RULES, weaponContent);
    const cards = generateAllActionCards(e, DEFAULT_RULES, weaponContent);
    const swordCard = cards.find(c => c.featureId === 'test_magic_sword_attack')!;
    expect(swordCard).toBeDefined();
    expect(swordCard.isWeaponAttack).toBe(true);
  });

  // NOTE: a "non-weapon item with its own raw damage-dealing feature" isn't
  // actually representable against this codebase's EXISTING isWeapon()
  // heuristic (itemBrowse.ts) — `isWeapon()` already treats "declares a
  // damage-type abilityEffect" as sufficient evidence of being a weapon
  // (`hasDamageEffect` short-circuits it), and no real content in this
  // catalog models a non-weapon item's damage (e.g. a wand's blast) as a
  // raw `damage` abilityEffect rather than a `cast_spell` effect. So for
  // every item shape this catalog actually authors, isWeaponAttack's own
  // extra isWeapon() check is consistent with (and never narrower than)
  // isWeapon() itself — verified directly: the wand fixture above IS
  // classified isWeapon()===true by the pre-existing heuristic, so
  // isWeaponAttack being true for it is correct given that existing
  // definition, not a gap this batch introduces or needs to fix.
  it('confirms the existing isWeapon() heuristic (pre-existing, unrelated to this batch) already treats any damage-dealing item feature as a weapon', () => {
    const wandA: ItemInstance = { id: 'wand-a', itemId: 'test_wand', quantity: 1, attuned: false, features: [] };
    let e = { ...makeEmptyEntity('e1'), inventory: { ...makeEmptyEntity('e1').inventory, equipped: [wandA] } };
    e = recomputeDerived(e, DEFAULT_RULES, weaponContent);
    const wandCard = generateAllActionCards(e, DEFAULT_RULES, weaponContent).find(c => c.featureId === 'test_wand_zap')!;
    expect(wandCard).toBeDefined();
    expect(wandCard.isWeaponAttack).toBe(true); // consistent with isWeapon()'s own pre-existing classification
  });

  // Part A2/F5/F6 (two-issue final closure): a weapon's own authored attack
  // feature must ALSO be actionType:'action' to be sequence-eligible — the
  // damage+isWeapon() conditions alone are not sufficient.
  it('F5: an authored weapon feature that activates as a Bonus Action is NOT flagged isWeaponAttack', () => {
    const inst: ItemInstance = { id: 'bonus-weapon-a', itemId: 'test_bonus_weapon', quantity: 1, attuned: false, features: [] };
    let e = { ...makeEmptyEntity('e1'), inventory: { ...makeEmptyEntity('e1').inventory, equipped: [inst] } };
    e = recomputeDerived(e, DEFAULT_RULES, weaponContent);
    const card = generateAllActionCards(e, DEFAULT_RULES, weaponContent).find(c => c.featureId === 'test_bonus_weapon_attack')!;
    expect(card).toBeDefined();
    expect(card.activation.actionType).toBe('bonus_action');
    expect(card.isWeaponAttack).toBeFalsy();
  });

  it('F6: an authored weapon feature that activates as a Reaction is NOT flagged isWeaponAttack', () => {
    const inst: ItemInstance = { id: 'reaction-weapon-a', itemId: 'test_reaction_weapon', quantity: 1, attuned: false, features: [] };
    let e = { ...makeEmptyEntity('e1'), inventory: { ...makeEmptyEntity('e1').inventory, equipped: [inst] } };
    e = recomputeDerived(e, DEFAULT_RULES, weaponContent);
    const card = generateAllActionCards(e, DEFAULT_RULES, weaponContent).find(c => c.featureId === 'test_reaction_weapon_attack')!;
    expect(card).toBeDefined();
    expect(card.activation.actionType).toBe('reaction');
    expect(card.isWeaponAttack).toBeFalsy();
  });

  it('F7: a legitimate authored weapon Action attack remains eligible (no regression from the A2 fix)', () => {
    const swordA: ItemInstance = { id: 'sword-f7', itemId: 'test_magic_sword', quantity: 1, attuned: false, features: [] };
    let e = { ...makeEmptyEntity('e1'), inventory: { ...makeEmptyEntity('e1').inventory, equipped: [swordA] } };
    e = recomputeDerived(e, DEFAULT_RULES, weaponContent);
    const card = generateAllActionCards(e, DEFAULT_RULES, weaponContent).find(c => c.featureId === 'test_magic_sword_attack')!;
    expect(card.activation.actionType).toBe('action');
    expect(card.isWeaponAttack).toBe(true);
  });

  it('a plain non-attack class feature (e.g. a Second-Wind-shaped card) is NOT flagged isWeaponAttack', () => {
    const secondWind: FeatureInstance = {
      id: 'second_wind_test', name: 'Second Wind', description: '', source: { kind: 'class', refId: 'fighter' },
      level: null, effects: [], actions: [], choices: [], passive: false, isActive: true,
      activation: { actionType: 'bonus_action', resourceCost: null, range: 'self', target: 'self', requiresSave: null },
    };
    const e = recomputeDerived({ ...makeEmptyEntity('e1'), features: [secondWind] }, DEFAULT_RULES);
    const cards = generateAllActionCards(e, DEFAULT_RULES, {});
    const card = cards.find(c => c.featureId === 'second_wind_test')!;
    expect(card).toBeDefined();
    expect(card.isWeaponAttack).toBeFalsy();
  });
});

/** N equipped dagger instances (dagger-0..dagger-N-1) plus optional Extra
 *  Attack grant(s) — used for the Fighter-tier positive matrix (Q2-Q5) and
 *  the action-type safety matrix (Part A/F). Module-scoped so every describe
 *  block in this file can share it. */
function weaponEntity(opts: { extraAttackValue?: number; secondExtraAttackValue?: number; level?: number; daggers?: number } = {}, id = 'e1') {
  const features: FeatureInstance[] = [];
  if (opts.extraAttackValue !== undefined) features.push(extraAttackFeature('extra_attack_a', opts.extraAttackValue, opts.level ?? 5));
  if (opts.secondExtraAttackValue !== undefined) features.push(extraAttackFeature('extra_attack_b', opts.secondExtraAttackValue, opts.level ?? 5));
  const daggers: ItemInstance[] = Array.from({ length: opts.daggers ?? 4 }, (_, i) => (
    { id: `dagger-${i}`, itemId: 'test_dagger', quantity: 1, attuned: false, features: [] }
  ));
  const base = makeEmptyEntity(id);
  const e: Entity = { ...startTurn(base), features, inventory: { ...base.inventory, equipped: daggers } };
  return recomputeDerived(e, DEFAULT_RULES, weaponContent);
}
function daggerCard(e: Entity, index: number): ActionCard {
  return generateAllActionCards(e, DEFAULT_RULES, weaponContent).find(c => c.sourceId === `dagger-${index}`)!;
}
const seq = (sequenceId: string): AttackSequenceUse => ({ sequenceId });

describe('Extra Attack sequence closure — applyActionCardUse `attackSequence` (parent-action/child-attack economy, authority model)', () => {
  // Extra Attack grant (value 1 → attackActionAttacks 2) is REQUIRED here —
  // under the old, unconstrained isChainedAttack boolean, a caller could
  // claim "chained" regardless of the entity's real attack count; the new
  // authoritative sequence model derives maxAttacks from the entity's OWN
  // derived stats, so a fixture used to exercise a genuine 2-attack
  // lead+chained sequence must actually HAVE 2 attacks.
  function twoDaggersEntity() {
    const daggerA: ItemInstance = { id: 'dagger-a', itemId: 'test_dagger', quantity: 1, attuned: false, features: [] };
    const daggerB: ItemInstance = { id: 'dagger-b', itemId: 'test_dagger', quantity: 1, attuned: false, features: [] };
    let e: Entity = {
      ...startTurn(makeEmptyEntity('e1')),
      features: [extraAttackFeature('extra_attack_test', 1)],
      inventory: { ...makeEmptyEntity('e1').inventory, equipped: [daggerA, daggerB] },
    };
    return recomputeDerived(e, DEFAULT_RULES, weaponContent);
  }

  // ── Positive matrix (Part Q) ──────────────────────────────────────────────

  it('Q1: an ordinary character — one attack spends the Action once, no follow-up allowed (auto-closes on exhaustion)', () => {
    const e = weaponEntity({ daggers: 1 });
    const lead = applyActionCardUse(e, daggerCard(e, 0), DEFAULT_RULES, undefined, undefined, undefined, undefined, weaponContent, undefined, undefined, seq('s1'));
    expect(lead).not.toBe(e);
    expect(lead.turnState?.actionUsed).toBe(true);
    expect(lead.attackSequence).toBeNull(); // auto-closed: maxAttacks 1, usedAttacks 1

    // A follow-up with the SAME token now has nothing to match — treated as
    // a fresh lead attempt, correctly blocked by ordinary action economy.
    const followUp = applyActionCardUse(lead, daggerCard(lead, 0), DEFAULT_RULES, undefined, undefined, undefined, undefined, weaponContent, undefined, undefined, seq('s1'));
    expect(followUp).toBe(lead);
  });

  it('Q2/K6-K8: Fighter 5 (2 attacks) — first spends the Action, second does not, a third is rejected (P.3/P.12)', () => {
    const e = weaponEntity({ extraAttackValue: 1, daggers: 3 });
    expect(e.derived.attackActionAttacks).toBe(2);

    const afterLead = applyActionCardUse(e, daggerCard(e, 0), DEFAULT_RULES, undefined, undefined, undefined, undefined, weaponContent, undefined, undefined, seq('s2'));
    expect(afterLead).not.toBe(e);
    expect(afterLead.turnState?.actionUsed).toBe(true);
    expect(afterLead.attackSequence).toEqual({ sequenceId: 's2', actorId: e.id, maxAttacks: 2, usedAttacks: 1 });

    const afterChained = applyActionCardUse(afterLead, daggerCard(afterLead, 1), DEFAULT_RULES, undefined, undefined, undefined, undefined, weaponContent, undefined, undefined, seq('s2'));
    expect(afterChained).not.toBe(afterLead);
    expect(afterChained.turnState?.actionUsed).toBe(true); // still exactly once
    expect(afterChained.attackSequence).toBeNull(); // exhausted, auto-closed

    // A third attempt with the same token: no active sequence to match →
    // treated as a fresh lead → blocked (Action already spent this turn).
    const thirdRejected = applyActionCardUse(afterChained, daggerCard(afterChained, 2), DEFAULT_RULES, undefined, undefined, undefined, undefined, weaponContent, undefined, undefined, seq('s2'));
    expect(thirdRejected).toBe(afterChained);
  });

  it('Q3: Fighter 11 (3 attacks) — three attacks succeed, a fourth is rejected', () => {
    const e = weaponEntity({ extraAttackValue: 2, level: 11, daggers: 4 });
    expect(e.derived.attackActionAttacks).toBe(3);
    let cur = applyActionCardUse(e, daggerCard(e, 0), DEFAULT_RULES, undefined, undefined, undefined, undefined, weaponContent, undefined, undefined, seq('s3'));
    expect(cur.turnState?.actionUsed).toBe(true);
    cur = applyActionCardUse(cur, daggerCard(cur, 1), DEFAULT_RULES, undefined, undefined, undefined, undefined, weaponContent, undefined, undefined, seq('s3'));
    expect(cur.attackSequence?.usedAttacks).toBe(2);
    cur = applyActionCardUse(cur, daggerCard(cur, 2), DEFAULT_RULES, undefined, undefined, undefined, undefined, weaponContent, undefined, undefined, seq('s3'));
    expect(cur.attackSequence).toBeNull(); // 3/3, auto-closed
    const fourthRejected = applyActionCardUse(cur, daggerCard(cur, 3), DEFAULT_RULES, undefined, undefined, undefined, undefined, weaponContent, undefined, undefined, seq('s3'));
    expect(fourthRejected).toBe(cur);
  });

  it('Q4: Fighter 20 (4 attacks) — all four succeed as one Action', () => {
    const e = weaponEntity({ extraAttackValue: 3, level: 20, daggers: 4 });
    expect(e.derived.attackActionAttacks).toBe(4);
    let cur = e;
    for (let i = 0; i < 4; i++) {
      const next = applyActionCardUse(cur, daggerCard(cur, i), DEFAULT_RULES, undefined, undefined, undefined, undefined, weaponContent, undefined, undefined, seq('s4'));
      expect(next).not.toBe(cur);
      cur = next;
    }
    expect(cur.turnState?.actionUsed).toBe(true);
    expect(cur.attackSequence).toBeNull();
  });

  it('Q5: Fighter 5 / Paladin 5 multiclass — still 2 attacks, never 3 (max, not additive)', () => {
    const e = weaponEntity({ extraAttackValue: 1, secondExtraAttackValue: 1, daggers: 3 });
    expect(e.derived.attackActionAttacks).toBe(2);
    const afterLead = applyActionCardUse(e, daggerCard(e, 0), DEFAULT_RULES, undefined, undefined, undefined, undefined, weaponContent, undefined, undefined, seq('s5'));
    const afterChained = applyActionCardUse(afterLead, daggerCard(afterLead, 1), DEFAULT_RULES, undefined, undefined, undefined, undefined, weaponContent, undefined, undefined, seq('s5'));
    expect(afterChained.attackSequence).toBeNull();
    const thirdRejected = applyActionCardUse(afterChained, daggerCard(afterChained, 2), DEFAULT_RULES, undefined, undefined, undefined, undefined, weaponContent, undefined, undefined, seq('s5'));
    expect(thirdRejected).toBe(afterChained);
  });

  it('Q6/K6-K8: two DIFFERENT weapon instances in the same sequence both apply, exactly one Action spent', () => {
    const e = twoDaggersEntity();
    const cards = generateAllActionCards(e, DEFAULT_RULES, weaponContent).filter(c => c.isWeaponAttack);
    const realCardA = cards.find(c => c.sourceId === 'dagger-a')!;
    const realCardB = cards.find(c => c.sourceId === 'dagger-b')!;
    expect(realCardA).toBeDefined();
    expect(realCardB).toBeDefined();

    const afterLead = applyActionCardUse(e, realCardA, DEFAULT_RULES, undefined, undefined, undefined, undefined, weaponContent, undefined, undefined, seq('s6'));
    expect(afterLead).not.toBe(e);
    expect(afterLead.turnState?.actionUsed).toBe(true);

    const cardBFresh = generateAllActionCards(afterLead, DEFAULT_RULES, weaponContent).find(c => c.sourceId === 'dagger-b')!;
    const afterChained = applyActionCardUse(afterLead, cardBFresh, DEFAULT_RULES, undefined, undefined, undefined, undefined, weaponContent, undefined, undefined, seq('s6'));
    expect(afterChained).not.toBe(afterLead);
    expect(afterChained.turnState?.actionUsed).toBe(true); // still exactly once — never double-marked
  });

  it('regression: WITHOUT an attackSequence token at all, a second action-type card use in the same turn is correctly blocked (economy still enforced normally)', () => {
    const e = twoDaggersEntity();
    const cards = generateAllActionCards(e, DEFAULT_RULES, weaponContent).filter(c => c.isWeaponAttack);
    const cardA = cards.find(c => c.sourceId === 'dagger-a')!;
    const afterLead = applyActionCardUse(e, cardA, DEFAULT_RULES, undefined, undefined, undefined, undefined, weaponContent);
    const cardBFresh = generateAllActionCards(afterLead, DEFAULT_RULES, weaponContent).find(c => c.sourceId === 'dagger-b')!;
    // No attackSequence param at all — must be refused exactly as any
    // ordinary second Action attempt always has been.
    const blocked = applyActionCardUse(afterLead, cardBFresh, DEFAULT_RULES, undefined, undefined, undefined, undefined, weaponContent);
    expect(blocked).toBe(afterLead);
  });

  it('Q7/K9/K15: the SAME weapon instance used twice as two separate attack opportunities both apply, exact instance identity preserved', () => {
    const daggerA: ItemInstance = { id: 'dagger-a', itemId: 'test_dagger', quantity: 1, attuned: false, features: [] };
    let e: Entity = {
      ...startTurn(makeEmptyEntity('e1')),
      features: [extraAttackFeature('extra_attack_test', 1)],
      inventory: { ...makeEmptyEntity('e1').inventory, equipped: [daggerA] },
    };
    e = recomputeDerived(e, DEFAULT_RULES, weaponContent);
    const card = generateAllActionCards(e, DEFAULT_RULES, weaponContent).find(c => c.isWeaponAttack)!;
    expect(card.sourceId).toBe('dagger-a');

    const afterLead = applyActionCardUse(e, card, DEFAULT_RULES, undefined, undefined, undefined, undefined, weaponContent, undefined, undefined, seq('s7'));
    expect(afterLead.turnState?.actionUsed).toBe(true);
    const cardAgain = generateAllActionCards(afterLead, DEFAULT_RULES, weaponContent).find(c => c.isWeaponAttack)!;
    expect(cardAgain.sourceId).toBe('dagger-a'); // the SAME instance, targeted exactly, not a different duplicate
    const afterChained = applyActionCardUse(afterLead, cardAgain, DEFAULT_RULES, undefined, undefined, undefined, undefined, weaponContent, undefined, undefined, seq('s7'));
    expect(afterChained).not.toBe(afterLead); // the second attack with the same dagger also went through
  });

  it('Q8: Unarmed Strike + a weapon attack may mix within the same sequence', () => {
    const e = weaponEntity({ extraAttackValue: 1, daggers: 1 });
    const unarmed = generateAllActionCards(e, DEFAULT_RULES, weaponContent).find(c => c.featureId === 'unarmed_strike')!;
    expect(unarmed.isWeaponAttack).toBe(true);
    const afterLead = applyActionCardUse(e, unarmed, DEFAULT_RULES, undefined, undefined, undefined, undefined, weaponContent, undefined, undefined, seq('s8'));
    expect(afterLead.turnState?.actionUsed).toBe(true);
    const afterChained = applyActionCardUse(afterLead, daggerCard(afterLead, 0), DEFAULT_RULES, undefined, undefined, undefined, undefined, weaponContent, undefined, undefined, seq('s8'));
    expect(afterChained).not.toBe(afterLead);
    expect(afterChained.attackSequence).toBeNull(); // 2/2
  });

  it('Q9/K14/H2: a stale (unequipped) weapon between attacks is rejected without advancing the sequence count, never retargeting another instance', () => {
    const e = twoDaggersEntity();
    const cardA = generateAllActionCards(e, DEFAULT_RULES, weaponContent).find(c => c.sourceId === 'dagger-a')!;
    const cardB = generateAllActionCards(e, DEFAULT_RULES, weaponContent).find(c => c.sourceId === 'dagger-b')!;
    const afterLead = applyActionCardUse(e, cardA, DEFAULT_RULES, undefined, undefined, undefined, undefined, weaponContent, undefined, undefined, seq('s9'));
    expect(afterLead.attackSequence?.usedAttacks).toBe(1);
    // dagger-b removed from equipped between generating the card and using it.
    const staleEntity: Entity = { ...afterLead, inventory: { ...afterLead.inventory, equipped: afterLead.inventory.equipped.filter(i => i.id !== 'dagger-b') } };
    const result = applyActionCardUse(staleEntity, cardB, DEFAULT_RULES, undefined, undefined, undefined, undefined, weaponContent, undefined, undefined, seq('s9'));
    expect(result).toBe(staleEntity); // refused — never silently retargets dagger-a
    expect(result.attackSequence?.usedAttacks).toBe(1); // count never advanced (Part J)
  });

  it('Q10/H1/Part L: a chained attack still pays its own real per-attack resource cost when the child card has one', () => {
    const daggerA: ItemInstance = { id: 'dagger-a', itemId: 'test_dagger', quantity: 1, attuned: false, features: [] };
    const costedWeapon: ItemInstance = { id: 'costed-a', itemId: 'test_costed_weapon', quantity: 1, attuned: false, features: [] };
    let e: Entity = {
      ...startTurn(makeEmptyEntity('e1')),
      features: [extraAttackFeature('extra_attack_test', 1)],
      inventory: { ...makeEmptyEntity('e1').inventory, equipped: [daggerA, costedWeapon] },
      resources: { ...makeEmptyEntity('e1').resources, custom: [{ id: 'test_charges', name: 'Test Charges', current: 5, maximum: 20, recharge: 'never' }] },
    };
    e = recomputeDerived(e, DEFAULT_RULES, weaponContent);
    const dagger = generateAllActionCards(e, DEFAULT_RULES, weaponContent).find(c => c.sourceId === 'dagger-a')!;
    const costed = generateAllActionCards(e, DEFAULT_RULES, weaponContent).find(c => c.sourceId === 'costed-a')!;
    expect(costed.isWeaponAttack).toBe(true); // an equipped weapon's own authored attack — eligible per Part C

    const afterLead = applyActionCardUse(e, dagger, DEFAULT_RULES, undefined, undefined, undefined, undefined, weaponContent, undefined, undefined, seq('s10'));
    expect(afterLead.turnState?.actionUsed).toBe(true);
    const costedFresh = generateAllActionCards(afterLead, DEFAULT_RULES, weaponContent).find(c => c.sourceId === 'costed-a')!;
    // Even as a CHAINED attack (no second Action spend), the resource is still spent.
    const afterChained = applyActionCardUse(afterLead, costedFresh, DEFAULT_RULES, undefined, undefined, undefined, undefined, weaponContent, undefined, undefined, seq('s10'));
    expect(afterChained).not.toBe(afterLead);
    expect(afterChained.resources.custom.find(r => r.id === 'test_charges')?.current).toBe(4);
    expect(afterChained.turnState?.actionUsed).toBe(true); // still exactly once
  });

  it('Q11/Q12/K12/K13: incapacitation still blocks a chained attack unless Use Anyway is passed, without weakening sequence checks', () => {
    const e = weaponEntity({ extraAttackValue: 1, daggers: 2 });
    const afterLead = applyActionCardUse(e, daggerCard(e, 0), DEFAULT_RULES, undefined, undefined, undefined, undefined, weaponContent, undefined, undefined, seq('s11'));
    expect(afterLead.attackSequence?.usedAttacks).toBe(1);

    const incapacitated: Entity = { ...afterLead, resources: { ...afterLead.resources, hp: { current: 0, maximum: 20, temp: 0 } } };
    // Note: the DISPLAYED card's own `incapacitatedOverridable` is computed
    // by plain card generation (isFeatureAvailable with no sequence
    // context), which sees the Action already spent by the lead attack and
    // reports "already used your action" rather than incapacitation —
    // exactly why TabActions.tsx's chooser never gates on it for a chained
    // candidate, instead reacting to applyActionCardUse's own real verdict
    // below (the actual authoritative check, with the sequence bypass applied).
    const chainedCard = generateAllActionCards(incapacitated, DEFAULT_RULES, weaponContent).find(c => c.sourceId === 'dagger-1')!;

    const blocked = applyActionCardUse(incapacitated, chainedCard, DEFAULT_RULES, undefined, undefined, undefined, undefined, weaponContent, /*bypassIncapacitated*/ false, undefined, seq('s11'));
    expect(blocked).toBe(incapacitated);
    expect(blocked.attackSequence?.usedAttacks).toBe(1); // never advanced

    const viaUseAnyway = applyActionCardUse(incapacitated, chainedCard, DEFAULT_RULES, undefined, undefined, undefined, undefined, weaponContent, /*bypassIncapacitated*/ true, undefined, seq('s11'));
    expect(viaUseAnyway).not.toBe(incapacitated);
    expect(viaUseAnyway.turnState?.actionUsed).toBe(true); // unaffected — already set by the lead attack
    expect(viaUseAnyway.attackSequence).toBeNull(); // 2/2, auto-closed
  });

  it('Q13/Part O: cancel before any successful attack leaves the Action unspent (endAttackSequence is a no-op with nothing to close)', () => {
    const e = weaponEntity({ extraAttackValue: 1, daggers: 2 });
    expect(endAttackSequence(e)).toBe(e); // no active sequence — nothing to cancel
    expect(e.turnState?.actionUsed).toBeFalsy();
  });

  it('Q14/Part O: Done after a partial sequence closes it — the Action stays spent, the second opportunity is simply discarded', () => {
    const e = weaponEntity({ extraAttackValue: 1, daggers: 2 });
    const afterLead = applyActionCardUse(e, daggerCard(e, 0), DEFAULT_RULES, undefined, undefined, undefined, undefined, weaponContent, undefined, undefined, seq('s14'));
    expect(afterLead.attackSequence?.usedAttacks).toBe(1);
    const closed = endAttackSequence(afterLead);
    expect(closed.attackSequence).toBeNull();
    expect(closed.turnState?.actionUsed).toBe(true); // unaffected

    // The old token no longer matches anything — reusing it now behaves as
    // a fresh lead attempt, correctly blocked (Action already spent).
    const reused = applyActionCardUse(closed, daggerCard(closed, 1), DEFAULT_RULES, undefined, undefined, undefined, undefined, weaponContent, undefined, undefined, seq('s14'));
    expect(reused).toBe(closed);
  });

  // ── Security / forged-call matrix (Part P) ────────────────────────────────

  it('P.1: a "follow-up" call with NO active sequence is never treated as a bypass — it pays its own Action like a lead attack', () => {
    const e = weaponEntity({ extraAttackValue: 1, daggers: 1 });
    expect(e.attackSequence).toBeFalsy(); // startTurn resets it to null — no sequence in progress
    const result = applyActionCardUse(e, daggerCard(e, 0), DEFAULT_RULES, undefined, undefined, undefined, undefined, weaponContent, undefined, undefined, seq('nonexistent-token'));
    expect(result).not.toBe(e);
    expect(result.turnState?.actionUsed).toBe(true); // paid normally — no bypass occurred
  });

  it('P.2/P.12: an ordinary character (maxAttacks 1) cannot be tricked into a follow-up — the sequence auto-closes after attack 1', () => {
    const e = weaponEntity({ daggers: 2 });
    const lead = applyActionCardUse(e, daggerCard(e, 0), DEFAULT_RULES, undefined, undefined, undefined, undefined, weaponContent, undefined, undefined, seq('p2'));
    expect(lead.attackSequence).toBeNull();
    const forgedFollowUp = applyActionCardUse(lead, daggerCard(lead, 1), DEFAULT_RULES, undefined, undefined, undefined, undefined, weaponContent, undefined, undefined, seq('p2'));
    expect(forgedFollowUp).toBe(lead); // rejected — no active sequence to match, and the Action is already spent
  });

  it('P.5-P.9: a spell/feature/bonus-action/reaction/passive-shaped card can never be smuggled in as a sequence child', () => {
    const e = weaponEntity({ extraAttackValue: 1, daggers: 1 });
    const afterLead = applyActionCardUse(e, daggerCard(e, 0), DEFAULT_RULES, undefined, undefined, undefined, undefined, weaponContent, undefined, undefined, seq('p5'));
    expect(afterLead.attackSequence?.usedAttacks).toBe(1);

    const forgedShapes: ActionCard[] = [
      fakeCard({ cardType: 'damage', activation: { actionType: 'action', resourceCost: null, range: '30 feet', target: 'single', requiresSave: null }, spellCastingContext: undefined }), // spell-shaped
      fakeCard({ activation: { actionType: 'action', resourceCost: null, range: 'self', target: 'self', requiresSave: null } }), // arbitrary feature
      fakeCard({ activation: { actionType: 'bonus_action', resourceCost: null, range: 'self', target: 'self', requiresSave: null } }), // bonus action
      fakeCard({ activation: { actionType: 'reaction', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null } }), // reaction
      fakeCard({ activation: { actionType: 'passive', resourceCost: null, range: 'self', target: 'self', requiresSave: null } }), // passive
    ];
    for (const forged of forgedShapes) {
      expect(forged.isWeaponAttack).toBeFalsy();
      const result = applyActionCardUse(afterLead, forged, DEFAULT_RULES, undefined, undefined, undefined, undefined, weaponContent, undefined, undefined, seq('p5'));
      expect(result).toBe(afterLead); // rejected, zero mutation
      expect(result.attackSequence?.usedAttacks).toBe(1); // count never advanced
    }

    // Also rejected as an attempt to START a sequence in the first place.
    const rejectedLead = applyActionCardUse(e, forgedShapes[0], DEFAULT_RULES, undefined, undefined, undefined, undefined, weaponContent, undefined, undefined, seq('p5-lead'));
    expect(rejectedLead).toBe(e);
  });

  it('P.10/Part F: actor B can never reuse actor A\'s sequence, even if B\'s own state is contaminated with a matching token', () => {
    const a = weaponEntity({ extraAttackValue: 1, daggers: 2 }, 'entity-a');
    const afterLeadA = applyActionCardUse(a, daggerCard(a, 0), DEFAULT_RULES, undefined, undefined, undefined, undefined, weaponContent, undefined, undefined, seq('shared-token'));
    expect(afterLeadA.attackSequence?.actorId).toBe('entity-a');

    const b = weaponEntity({ daggers: 1 }, 'entity-b'); // ordinary character — max 1 attack
    // Simulate a bug/attack that copied A's in-progress sequence record onto
    // B (actorId still says 'entity-a') — the actorId check must still
    // refuse to treat this as B's own legitimate continuation.
    const contaminatedB: Entity = { ...b, attackSequence: { ...afterLeadA.attackSequence! } };
    const result = applyActionCardUse(contaminatedB, daggerCard(contaminatedB, 0), DEFAULT_RULES, undefined, undefined, undefined, undefined, weaponContent, undefined, undefined, seq('shared-token'));
    expect(result).not.toBe(contaminatedB); // succeeds — but only as B's OWN fresh lead attack
    expect(result.turnState?.actionUsed).toBe(true); // paid normally — economy was NOT bypassed
    expect(result.attackSequence).toBeNull(); // B's own maxAttacks is 1 — auto-closed immediately, never inherited A's progress
  });

  it('P.11: a closed sequence token cannot be reused to resume where it left off', () => {
    const e = weaponEntity({ extraAttackValue: 1, daggers: 2 });
    const afterLead = applyActionCardUse(e, daggerCard(e, 0), DEFAULT_RULES, undefined, undefined, undefined, undefined, weaponContent, undefined, undefined, seq('p11'));
    const closed = endAttackSequence(afterLead); // player pressed Done after only 1 of 2 attacks
    expect(closed.attackSequence).toBeNull();
    const reused = applyActionCardUse(closed, daggerCard(closed, 1), DEFAULT_RULES, undefined, undefined, undefined, undefined, weaponContent, undefined, undefined, seq('p11'));
    expect(reused).toBe(closed); // treated as a fresh lead, blocked by action economy
  });

  it('P.13: forged extra fields on the attackSequence token (attackIndex/totalAttacks) are inert — only sequenceId is ever consulted', () => {
    const e = weaponEntity({ daggers: 1 }); // ordinary character — real maxAttacks is 1
    const forged = { sequenceId: 'p13', attackIndex: 99, totalAttacks: 99 } as unknown as AttackSequenceUse;
    const result = applyActionCardUse(e, daggerCard(e, 0), DEFAULT_RULES, undefined, undefined, undefined, undefined, weaponContent, undefined, undefined, forged);
    expect(result).not.toBe(e);
    // maxAttacks came from the entity's OWN derived stats (1), never the
    // forged totalAttacks:99 — confirmed by immediate auto-closure.
    expect(result.attackSequence).toBeNull();
    expect(result.turnState?.actionUsed).toBe(true);
  });
});

describe('Extra Attack two-issue final closure — Part A: action-only sequence eligibility (authoritative engine gate)', () => {
  // F1: a real, generated Action-type weapon attack card already works —
  // covered exhaustively by every Q-numbered test above (all use real
  // dagger/unarmed cards, all actionType:'action'). Re-asserted directly
  // here for a single, self-contained confirmation alongside the negative
  // cases below.
  it('F1: isWeaponAttack:true + actionType:action → sequence allowed (lead and chained)', () => {
    const e = weaponEntity({ extraAttackValue: 1, daggers: 2 });
    expect(daggerCard(e, 0).activation.actionType).toBe('action');
    const afterLead = applyActionCardUse(e, daggerCard(e, 0), DEFAULT_RULES, undefined, undefined, undefined, undefined, weaponContent, undefined, undefined, seq('f1'));
    expect(afterLead.turnState?.actionUsed).toBe(true);
    const afterChained = applyActionCardUse(afterLead, daggerCard(afterLead, 1), DEFAULT_RULES, undefined, undefined, undefined, undefined, weaponContent, undefined, undefined, seq('f1'));
    expect(afterChained).not.toBe(afterLead);
  });

  // F2/F3/F4/A4: a card that is DELIBERATELY forged with isWeaponAttack:true
  // (never isWeaponAttack:false — the point is proving the engine doesn't
  // just trust a true flag) alongside a non-Action actionType. Attempted as
  // BOTH the lead attack (starting a sequence) and a continuation (chaining
  // off a real, already-active sequence) — both must be rejected, and
  // neither may bypass normal action economy.
  const nonActionShapes: { label: string; actionType: 'bonus_action' | 'reaction' | 'passive' }[] = [
    { label: 'F2: bonus_action', actionType: 'bonus_action' },
    { label: 'F3: reaction', actionType: 'reaction' },
    { label: 'F4: passive', actionType: 'passive' },
  ];

  for (const { label, actionType } of nonActionShapes) {
    it(`${label}: isWeaponAttack:true + actionType:${actionType} is rejected as a LEAD sequence attack`, () => {
      const e = weaponEntity({ extraAttackValue: 1, daggers: 1 });
      const forged = fakeCard({
        isWeaponAttack: true,
        activation: { actionType, resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
      });
      const result = applyActionCardUse(e, forged, DEFAULT_RULES, undefined, undefined, undefined, undefined, weaponContent, undefined, undefined, seq(`forged-lead-${actionType}`));
      expect(result).toBe(e); // rejected, zero mutation
      expect(result.attackSequence).toBeFalsy(); // no sequence was ever started
      expect(result.turnState?.actionUsed).toBeFalsy(); // no bypass, and nothing spent either
    });

    it(`${label}: isWeaponAttack:true + actionType:${actionType} is rejected as a CONTINUATION of a real active sequence`, () => {
      const e = weaponEntity({ extraAttackValue: 1, daggers: 2 });
      const afterLead = applyActionCardUse(e, daggerCard(e, 0), DEFAULT_RULES, undefined, undefined, undefined, undefined, weaponContent, undefined, undefined, seq(`forged-chain-${actionType}`));
      expect(afterLead.attackSequence?.usedAttacks).toBe(1);

      const forged = fakeCard({
        isWeaponAttack: true,
        activation: { actionType, resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
      });
      const result = applyActionCardUse(afterLead, forged, DEFAULT_RULES, undefined, undefined, undefined, undefined, weaponContent, undefined, undefined, seq(`forged-chain-${actionType}`));
      expect(result).toBe(afterLead); // rejected, zero mutation
      expect(result.attackSequence?.usedAttacks).toBe(1); // count never advanced
      expect(result.turnState?.actionUsed).toBe(true); // unchanged — still just the lead attack's own spend
    });
  }
});

describe('Monster Multiattack — audit finding: no structured data exists; the sequence closure\'s stricter child-eligibility gate (Part C) means this machinery does NOT currently generalize to monster content', () => {
  // Part R (single-HIGH final closure): the earlier draft of this milestone
  // claimed the shared chained-attack primitive "already generalizes" to a
  // manual Beak→Claws Multiattack sequence. That claim relied on the OLD,
  // unconstrained `isChainedAttack: true` boolean, which never checked
  // WHAT was being chained. Under the new `attackSequence` model, only a
  // card flagged `isWeaponAttack` (Part C) may participate in a sequence —
  // and monster natural-attack cards (Beak/Claws) are generated from plain
  // entity.features, the same code path as every other class/monster
  // feature, which never sets that flag (only the equipped-item-attack and
  // synthetic weapon/unarmed paths do — see isWeaponAttack's own doc
  // comment, types.ts). So today, a monster's own attacks cannot start or
  // join a tracked Attack-action sequence through this API at all — this is
  // the CORRECTED, accurate claim: the machinery COULD be extended to
  // monster Multiattack later if monster attack cards were similarly
  // tagged, but that tagging is explicit monster-content work this closure
  // does not do (out of scope — Part R).
  it('Beak cannot start a tracked sequence — rejected outright, exactly as any other non-isWeaponAttack card would be', () => {
    let monster = spawnMonster(monsterOwlbear, DEFAULT_RULES);
    monster = startTurn(monster);
    monster = recomputeDerived(monster, DEFAULT_RULES);
    const beak = generateAllActionCards(monster, DEFAULT_RULES, {}).find(c => c.featureId === 'owlbear_beak')!;
    expect(beak.isWeaponAttack).toBeFalsy(); // confirms the audit finding above
    const result = applyActionCardUse(monster, beak, DEFAULT_RULES, undefined, undefined, undefined, undefined, {}, undefined, undefined, { sequenceId: 'monster-seq' });
    expect(result).toBe(monster); // rejected, zero mutation
  });

  it('regression: Beak and Claws each remain independently usable as ordinary standalone actions (no attackSequence param — completely unaffected)', () => {
    let monster = spawnMonster(monsterOwlbear, DEFAULT_RULES);
    monster = startTurn(monster);
    monster = recomputeDerived(monster, DEFAULT_RULES);
    const beak = generateAllActionCards(monster, DEFAULT_RULES, {}).find(c => c.featureId === 'owlbear_beak')!;
    const result = applyActionCardUse(monster, beak, DEFAULT_RULES, undefined, undefined, undefined, undefined, {});
    expect(result).not.toBe(monster);
    expect(result.turnState?.actionUsed).toBe(true);

    // Manual DM-driven chaining still works the OLD way it always has: a
    // second real Action can't be spent this turn (economy correctly
    // blocks it), so a DM narrates Claws as flavor on the same Bite/Action
    // or waits for the next turn — no automation claimed either way.
    const claws = generateAllActionCards(result, DEFAULT_RULES, {}).find(c => c.featureId === 'owlbear_claws')!;
    const blocked = applyActionCardUse(result, claws, DEFAULT_RULES, undefined, undefined, undefined, undefined, {});
    expect(blocked).toBe(result);
  });
});

describe('Extra Attack two-issue final closure — Part B: attackSequence must not survive a durable boundary', () => {
  it('F13: an ordinary in-session recompute (applyActionCardUse itself) PRESERVES the just-created active sequence — this is NOT a durable boundary', () => {
    const e = weaponEntity({ extraAttackValue: 1, daggers: 2 });
    const afterLead = applyActionCardUse(e, daggerCard(e, 0), DEFAULT_RULES, undefined, undefined, undefined, undefined, weaponContent, undefined, undefined, seq('f13'));
    // applyActionCardUse's own last step is recomputeDerived — proving that
    // call path does NOT strip attackSequence is exactly what makes the
    // whole sequence feature work at all within one live session.
    expect(afterLead.attackSequence).toEqual({ sequenceId: 'f13', actorId: e.id, maxAttacks: 2, usedAttacks: 1 });
  });

  it('F14: startTurn still clears an active sequence (regression — unchanged from the prior closure)', () => {
    const e = weaponEntity({ extraAttackValue: 1, daggers: 2 });
    const afterLead = applyActionCardUse(e, daggerCard(e, 0), DEFAULT_RULES, undefined, undefined, undefined, undefined, weaponContent, undefined, undefined, seq('f14'));
    expect(afterLead.attackSequence).not.toBeNull();
    const nextTurn = startTurn(afterLead);
    expect(nextTurn.attackSequence).toBeNull();
  });

  it('F15/stripTransientRuntimeState: a no-op (same reference) when there is nothing to strip', () => {
    const e = weaponEntity({ daggers: 1 });
    expect(stripTransientRuntimeState(e)).toBe(e);
  });

  it('stripTransientRuntimeState clears a populated attackSequence and leaves everything else untouched', () => {
    const e = weaponEntity({ extraAttackValue: 1, daggers: 2 });
    const afterLead = applyActionCardUse(e, daggerCard(e, 0), DEFAULT_RULES, undefined, undefined, undefined, undefined, weaponContent, undefined, undefined, seq('strip-test'));
    expect(afterLead.attackSequence).not.toBeNull();
    const stripped = stripTransientRuntimeState(afterLead);
    expect(stripped.attackSequence).toBeNull();
    expect(stripped.turnState).toEqual(afterLead.turnState); // turnState is NOT this closure's concern — untouched
    expect(stripped.resources).toEqual(afterLead.resources);
  });

  // F8/F9/B6: the realistic reload scenario, through a REAL durable
  // boundary — portable character export/import (characterPortable.ts) —
  // rather than an invented code path. Fighter 5 starts an Attack action,
  // the first attack succeeds (Action spent, one attack opportunity
  // remaining), the character is serialized exactly as export does, then
  // re-parsed exactly as import does. The reloaded entity must show
  // attackSequence === null, and the OLD sequenceId must never again
  // authorize a free continuation.
  it('F8/F9/B6: reload scenario — a paid, in-progress sequence does not survive a real export/import round-trip, and the old token cannot continue it', () => {
    const e = weaponEntity({ extraAttackValue: 1, daggers: 2 });
    const beforeReload = applyActionCardUse(e, daggerCard(e, 0), DEFAULT_RULES, undefined, undefined, undefined, undefined, weaponContent, undefined, undefined, seq('reload-token'));
    expect(beforeReload.turnState?.actionUsed).toBe(true);
    expect(beforeReload.attackSequence).toEqual({ sequenceId: 'reload-token', actorId: e.id, maxAttacks: 2, usedAttacks: 1 });

    // Real export → real import round-trip (no mocking, no invented path).
    const portableText = serializePortableCharacter(beforeReload);
    const { entity: reloaded } = parsePortableCharacter(portableText);

    expect(reloaded.attackSequence).toBeFalsy(); // B1: never survives a durable boundary
    // turnState (a SEPARATE, already-correct persistence concern — Part B5)
    // is preserved as-is by the portable format, same as any other field —
    // the reloaded character still correctly shows its Action as spent.
    expect(reloaded.turnState?.actionUsed).toBe(true);

    // The old sequenceId can no longer authorize a free continuation — it's
    // simply treated as a fresh lead attempt, which the still-spent Action
    // correctly blocks.
    const reloadedCard = generateAllActionCards(reloaded, DEFAULT_RULES, weaponContent).find(c => c.sourceId === 'dagger-1')!;
    const attemptedContinuation = applyActionCardUse(reloaded, reloadedCard, DEFAULT_RULES, undefined, undefined, undefined, undefined, weaponContent, undefined, undefined, seq('reload-token'));
    expect(attemptedContinuation).toBe(reloaded); // rejected — no free attack
  });

  // F10: portable import specifically, verified via the exact same real
  // API import-character.tsx uses (parsePortableCharacter, characterPortable.ts).
  it('F10: portable import strips an attackSequence physically present in the imported JSON', () => {
    const e = weaponEntity({ extraAttackValue: 1, daggers: 1 });
    const withSequence: Entity = {
      ...e,
      attackSequence: { sequenceId: 'imported-seq', actorId: e.id, maxAttacks: 2, usedAttacks: 1 },
    };
    const portableText = serializePortableCharacter(withSequence);
    const { entity: imported } = parsePortableCharacter(portableText);
    expect(imported.attackSequence).toBeFalsy();
  });
});
