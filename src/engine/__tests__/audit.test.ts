// src/engine/__tests__/audit.test.ts
// explainValue() and recomputeDerived() used to compute AC/DC/proficiency
// bonus independently, with the same formulas hand-duplicated in both files
// — a real drift risk (Phase 1 of the fundamental-changes migration). These
// tests lock the invariant that the two can never disagree again: for every
// stat covered, the audit trail's total must equal the actual derived value.
import { makeEmptyEntity, DEFAULT_RULES } from '../../store/characterStore';
import { recomputeDerived } from '../pipeline';
import { explainValue } from '../audit';
import { Entity, Effect, Feature, FeatureInstance } from '../types';
import { formWolf } from '../../content/beastforms';

function feature(id: string, effects: Partial<Effect>[]): FeatureInstance {
  return {
    id, name: id, description: '', source: { kind: 'class', refId: 'test' }, level: 1,
    effects: effects.map(e => ({
      type: 'stat_modifier', target: '', operation: 'add', value: null, condition: null, ...e,
    })),
    actions: [], choices: [], passive: true, isActive: true,
  };
}

// Item features are plain Feature (no isActive — equipped items' features
// apply unconditionally while worn, per collectAllEffects's item loop).
function itemFeature(id: string, effects: Partial<Effect>[]): Feature {
  return {
    id, name: id, description: '', source: { kind: 'item', refId: id }, level: null,
    effects: effects.map(e => ({
      type: 'stat_modifier', target: '', operation: 'add', value: null, condition: null, ...e,
    })),
    actions: [], choices: [], passive: true,
  };
}

function withFeatures(features: FeatureInstance[], overrides: Partial<Entity> = {}): Entity {
  const e = makeEmptyEntity('e1');
  return { ...e, features, ...overrides };
}

describe('explainValue matches recomputeDerived — AC', () => {
  it('agrees on the 10 + DEX fallback', () => {
    const e = withFeatures([], { stats: { str: 10, dex: 14, con: 10, int: 10, wis: 10, cha: 10 } });
    const derived = recomputeDerived(e, DEFAULT_RULES);
    expect(explainValue(derived, 'ac').total).toBe(derived.derived.ac);
  });

  it('agrees on a base_ac_formula effect (Unarmored Defense)', () => {
    const e = withFeatures(
      [feature('unarmored_defense', [{ type: 'base_ac_formula', target: 'ac', operation: 'add', value: 10, formulaAbilities: ['dex', 'con'] }])],
      { stats: { str: 10, dex: 14, con: 14, int: 10, wis: 10, cha: 10 } },
    );
    const derived = recomputeDerived(e, DEFAULT_RULES);
    const trail = explainValue(derived, 'ac');
    expect(trail.total).toBe(derived.derived.ac);
    expect(derived.derived.ac).toBe(14); // 10 + dex(2) + con(2)
  });

  it('agrees when the highest of multiple base_ac_formula effects wins', () => {
    const e = withFeatures([
      feature('unarmored_defense_monk', [{ type: 'base_ac_formula', target: 'ac', operation: 'add', value: 10, formulaAbilities: ['dex', 'wis'] }]),
      feature('unarmored_defense_barbarian', [{ type: 'base_ac_formula', target: 'ac', operation: 'add', value: 10, formulaAbilities: ['dex', 'con'] }]),
    ], { stats: { str: 10, dex: 14, con: 16, int: 10, wis: 10, cha: 10 } });
    const derived = recomputeDerived(e, DEFAULT_RULES);
    const trail = explainValue(derived, 'ac');
    expect(trail.total).toBe(derived.derived.ac);
    expect(derived.derived.ac).toBe(15); // barbarian formula wins: 10+2+3
  });

  it('agrees on an item-granted base_ac_formula — previously invisible to the audit trail entirely', () => {
    const e = withFeatures([], {
      stats: { str: 10, dex: 16, con: 10, int: 10, wis: 10, cha: 10 },
      inventory: {
        ...makeEmptyEntity('e1').inventory,
        equipped: [{
          itemId: 'bracers_of_defense', quantity: 1, attuned: true,
          features: [itemFeature('bracers_formula', [{ type: 'base_ac_formula', target: 'ac', operation: 'add', value: 10, formulaAbilities: ['dex'] }])],
        }],
      },
    });
    const derived = recomputeDerived(e, DEFAULT_RULES);
    const trail = explainValue(derived, 'ac');
    expect(derived.derived.ac).toBe(13); // 10 + dex mod(3)
    expect(trail.total).toBe(derived.derived.ac);
    expect(trail.entries.some(en => en.sourceId === 'bracers_of_defense')).toBe(true);
  });

  it('agrees on a flat AC bonus (shield) stacked on armor', () => {
    const e = withFeatures(
      [feature('shield', [{ type: 'stat_modifier', target: 'ac', operation: 'add', value: 2 }])],
      { resources: { ...makeEmptyEntity('e1').resources, ac: 16 } },
    );
    const derived = recomputeDerived(e, DEFAULT_RULES);
    expect(explainValue(derived, 'ac').total).toBe(derived.derived.ac);
  });
});

describe('explainValue matches recomputeDerived — proficiency bonus', () => {
  it.each([1, 4, 5, 9, 13, 17, 20])('agrees at character level %i', (level) => {
    const e = withFeatures([], { identity: { ...makeEmptyEntity('e1').identity, level } });
    const derived = recomputeDerived(e, DEFAULT_RULES);
    expect(explainValue(derived, 'proficiencyBonus').total).toBe(derived.derived.proficiencyBonus);
  });
});

describe('explainValue matches recomputeDerived — spell save DC', () => {
  it('agrees for a caster', () => {
    const e = makeEmptyEntity('e1');
    e.stats = { str: 10, dex: 10, con: 10, int: 10, wis: 16, cha: 10 };
    e.identity.level = 5;
    e.spellcasting = { ability: 'wis', slots: {} as any, cantrips: [], known: [], prepared: [], concentrating: null };
    const derived = recomputeDerived(e, DEFAULT_RULES);
    expect(explainValue(derived, 'spellSaveDC').total).toBe(derived.derived.spellSaveDC);
  });
});

describe('explainValue matches recomputeDerived — saving throws', () => {
  it('agrees for a proficient and a non-proficient save', () => {
    const e = withFeatures([], {
      stats: { str: 16, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      identity: { ...makeEmptyEntity('e1').identity, level: 5 },
      proficiencies: { ...makeEmptyEntity('e1').proficiencies, savingThrows: ['str'] },
    });
    const derived = recomputeDerived(e, DEFAULT_RULES);
    expect(explainValue(derived, 'save_str').total).toBe(derived.derived.savingThrows.str);
    expect(explainValue(derived, 'save_dex').total).toBe(derived.derived.savingThrows.dex);
  });
});

describe('explainValue matches recomputeDerived — skills', () => {
  it('agrees for passive perception, trained and untrained', () => {
    const e = makeEmptyEntity('e1');
    e.stats = { str: 10, dex: 10, con: 10, int: 10, wis: 14, cha: 10 };
    e.identity.level = 1;
    e.skills.skills.perception = { ability: 'wis', trained: true, expertise: false, bonus: null };
    const derived = recomputeDerived(e, DEFAULT_RULES);
    expect(explainValue(derived, 'perception').total + 10).toBe(derived.derived.passivePerception);
  });
});

// The 4 divergences below were found in an audit pass looking for spots
// where explainValue's own hand-rolled logic could disagree with
// recomputeDerived's real calculation — each is a case the original
// "agrees on X" tests above didn't happen to cover.
describe('explainValue matches recomputeDerived — competing speed "set" effects (audit bug #7a)', () => {
  it('agrees regardless of which order the competing sets are collected in', () => {
    const low  = feature('speed_low',  [{ target: 'speed', operation: 'set', value: 25 }]);
    const high = feature('speed_high', [{ target: 'speed', operation: 'set', value: 30 }]);

    const forward  = withFeatures([low, high]);
    const reversed = withFeatures([high, low]);

    const dForward  = recomputeDerived(forward, DEFAULT_RULES);
    const dReversed = recomputeDerived(reversed, DEFAULT_RULES);

    // Both orderings must agree with each other AND with the audit trail —
    // this used to pick "last collected" (array-order-dependent) instead of
    // highest value, so a dwarf's audit could disagree with its own sheet
    // depending on how collectAllEffects happened to order its features.
    expect(dForward.derived.speed).toBe(30);
    expect(dReversed.derived.speed).toBe(30);
    expect(explainValue(dForward, 'speed').total).toBe(dForward.derived.speed);
    expect(explainValue(dReversed, 'speed').total).toBe(dReversed.derived.speed);
  });
});

describe('explainValue matches recomputeDerived — spell save DC effect bonus (audit bug #7b)', () => {
  it('includes an item-granted +N spell save DC bonus in the breakdown', () => {
    const e = makeEmptyEntity('e1');
    e.stats = { str: 10, dex: 10, con: 10, int: 10, wis: 16, cha: 10 };
    e.identity.level = 5;
    e.spellcasting = { ability: 'wis', slots: {} as any, cantrips: [], known: [], prepared: [], concentrating: null };
    e.inventory = {
      ...e.inventory,
      equipped: [{
        itemId: 'ring_of_spell_focus', quantity: 1, attuned: true,
        features: [itemFeature('ring_of_spell_focus_bonus', [{ target: 'spellSaveDC', operation: 'add', value: 1 }])],
      }],
    };
    const derived = recomputeDerived(e, DEFAULT_RULES);
    const trail = explainValue(derived, 'spellSaveDC');
    // This used to silently drop the item's bonus from the breakdown (the
    // real derived.spellSaveDC already included it) — total would disagree.
    expect(trail.total).toBe(derived.derived.spellSaveDC);
    expect(trail.entries.some(en => en.sourceId === 'ring_of_spell_focus')).toBe(true);
  });
});

describe('explainValue matches recomputeDerived — AC "multiply" effect (audit bug #7c)', () => {
  it('agrees when an AC "add" effect is combined with a "multiply" effect (homebrew-only today, no official content does this)', () => {
    const e = withFeatures(
      [
        feature('shield', [{ target: 'ac', operation: 'add', value: 4 }]),
        feature('doubling_ward', [{ target: 'ac', operation: 'multiply', value: 2 }]),
      ],
      { resources: { ...makeEmptyEntity('e1').resources, ac: 16 } },
    );
    const derived = recomputeDerived(e, DEFAULT_RULES);
    const trail = explainValue(derived, 'ac');
    // resolveCombine applies 'multiply' to (base + addSum) of the AC-target
    // effects themselves — (0 + 4) * 2 = 8 — on top of the 16 armor AC, for
    // 24 total. The old buggy code summed every effect's raw value
    // regardless of operation (4 + 2 = 6, treating 'multiply' as if it were
    // 'add'), so the audit trail would have shown 22, disagreeing with the
    // sheet's real 24.
    expect(derived.derived.ac).toBe(24);
    expect(trail.total).toBe(derived.derived.ac);
  });
});

describe('explainValue matches recomputeDerived — Wild Shape AC (audit bug #7d)', () => {
  it('shows the beast form flat AC, not the player\'s own gear/formula breakdown', () => {
    const e = withFeatures([], {
      stats: { str: 10, dex: 18, con: 10, int: 10, wis: 10, cha: 10 },
      resources: { ...makeEmptyEntity('e1').resources, ac: 16 }, // player's own armor — must be ignored while wildshaped
      wildShapeState: {
        active: true, formId: formWolf.id, beastHp: formWolf.hp, beastHpMax: formWolf.hp,
        expiresAt: { unit: 'hours', remaining: 1 },
      },
    });
    const derived = recomputeDerived(e, DEFAULT_RULES);
    const trail = explainValue(derived, 'ac');
    // Previously this function had no Wild Shape awareness at all, so it
    // would show the player's own 16 AC + DEX-formula breakdown instead of
    // the wolf's actual flat AC 13 the sheet is really using.
    expect(derived.derived.ac).toBe(formWolf.ac);
    expect(trail.total).toBe(derived.derived.ac);
  });
});

describe('explainValue matches recomputeDerived — passiveInvestigation/passiveInsight/kiSaveDC (audit bug E3)', () => {
  it('no longer falls through to an empty trail for passiveInvestigation', () => {
    const e = withFeatures([], { stats: { str: 10, dex: 10, con: 10, int: 16, wis: 10, cha: 10 } });
    const derived = recomputeDerived(e, DEFAULT_RULES);
    const trail = explainValue(derived, 'passiveInvestigation');
    expect(trail.entries.length).toBeGreaterThan(0);
    expect(trail.total).toBe(derived.derived.passiveInvestigation);
  });

  it('no longer falls through to an empty trail for passiveInsight', () => {
    const e = withFeatures([], { stats: { str: 10, dex: 10, con: 10, int: 10, wis: 16, cha: 10 } });
    const derived = recomputeDerived(e, DEFAULT_RULES);
    const trail = explainValue(derived, 'passiveInsight');
    expect(trail.entries.length).toBeGreaterThan(0);
    expect(trail.total).toBe(derived.derived.passiveInsight);
  });

  it('includes an Observant-style passive-score bonus in the passiveInvestigation trail', () => {
    const e = withFeatures(
      [feature('observant', [{ type: 'stat_modifier', target: 'passiveInvestigation', operation: 'add', value: 5 }])],
      { stats: { str: 10, dex: 10, con: 10, int: 16, wis: 10, cha: 10 } },
    );
    const derived = recomputeDerived(e, DEFAULT_RULES);
    const trail = explainValue(derived, 'passiveInvestigation');
    expect(trail.total).toBe(derived.derived.passiveInvestigation);
    expect(trail.entries.some(en => en.sourceId === 'observant')).toBe(true);
  });

  it('agrees on kiSaveDC for a Monk (has martial_arts) and returns empty for a non-Monk', () => {
    const monk = withFeatures(
      [feature('martial_arts', [])],
      { stats: { str: 10, dex: 10, con: 10, int: 10, wis: 16, cha: 10 }, identity: { ...makeEmptyEntity('e1').identity, level: 5 } },
    );
    const derivedMonk = recomputeDerived(monk, DEFAULT_RULES);
    const monkTrail = explainValue(derivedMonk, 'kiSaveDC');
    expect(derivedMonk.derived.kiSaveDC).not.toBeNull();
    expect(monkTrail.total).toBe(derivedMonk.derived.kiSaveDC);

    const nonMonk = withFeatures([]);
    const derivedNonMonk = recomputeDerived(nonMonk, DEFAULT_RULES);
    expect(derivedNonMonk.derived.kiSaveDC).toBeNull();
    expect(explainValue(derivedNonMonk, 'kiSaveDC').total).toBe(0);
  });
});
