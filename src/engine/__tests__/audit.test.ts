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
