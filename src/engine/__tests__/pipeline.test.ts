// src/engine/__tests__/pipeline.test.ts
// recomputeDerived() is the single choke point every mutation in the app
// passes through — AC, saves, spell DC, skills, senses, movement, and DM
// overrides all come from here. A regression in this file silently corrupts
// every character sheet, not just one feature, so it's the highest-value
// target in the engine for real test coverage.
import { makeEmptyEntity, DEFAULT_RULES } from '../../store/characterStore';
import { recomputeDerived, applyStatModifiers, modifier } from '../pipeline';
import { useHomebrewStore } from '../../store/homebrewStore';
import { applyCondition, removeCondition } from '../conditions';
import { startWildShape } from '../combat';
import { ALL_CONDITIONS } from '../../content/conditions';
import { Entity, Effect, FeatureInstance, DmOverride, Item } from '../types';

function feature(id: string, effects: Partial<Effect>[]): FeatureInstance {
  return {
    id, name: id, description: '', source: { kind: 'class', refId: 'test' }, level: 1,
    effects: effects.map(e => ({
      type: 'stat_modifier', target: '', operation: 'add', value: null, condition: null, ...e,
    })),
    actions: [], choices: [], passive: true, isActive: true,
  };
}

function withFeatures(features: FeatureInstance[], overrides: Partial<Entity> = {}): Entity {
  const e = makeEmptyEntity('e1');
  return { ...e, features, ...overrides };
}

describe('modifier', () => {
  it('follows the standard 5e ability score → modifier table', () => {
    expect(modifier(10)).toBe(0);
    expect(modifier(11)).toBe(0);
    expect(modifier(8)).toBe(-1);
    expect(modifier(20)).toBe(5);
    expect(modifier(1)).toBe(-5);
  });
});

describe('applyStatModifiers', () => {
  it('adds stat_modifier effects on top of base scores', () => {
    const base = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
    const effects = [{ effect: { type: 'stat_modifier', target: 'str', operation: 'add', value: 2, condition: null } as Effect, sourceName: 'x', sourceId: 'x', appliedAt: 0 }];
    expect(applyStatModifiers(base, effects).str).toBe(12);
  });

  it('applies a "set" effect as a new base, then stacks "add" on top', () => {
    const base = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
    const effects = [
      { effect: { type: 'stat_modifier', target: 'str', operation: 'set', value: 19, condition: null } as Effect, sourceName: 'belt', sourceId: 'x', appliedAt: 0 },
      { effect: { type: 'stat_modifier', target: 'str', operation: 'add', value: 1, condition: null } as Effect, sourceName: 'asi', sourceId: 'y', appliedAt: 1 },
    ];
    expect(applyStatModifiers(base, effects).str).toBe(20);
  });

  it('picks the highest of two competing "set" effects, regardless of collection order (order-independence bug fix)', () => {
    const base = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
    const setLow = { effect: { type: 'stat_modifier', target: 'str', operation: 'set', value: 19, condition: null } as Effect, sourceName: 'belt_of_giant_strength_lesser', sourceId: 'x', appliedAt: 0 };
    const setHigh = { effect: { type: 'stat_modifier', target: 'str', operation: 'set', value: 23, condition: null } as Effect, sourceName: 'belt_of_giant_strength_greater', sourceId: 'y', appliedAt: 1 };
    // Bug: this used to be "last one in the array wins" — so which value won
    // depended on collectAllEffects's iteration order, not on which item is
    // actually stronger. Both orderings must now agree on the higher value.
    expect(applyStatModifiers(base, [setLow, setHigh]).str).toBe(23);
    expect(applyStatModifiers(base, [setHigh, setLow]).str).toBe(23);
  });

  it('is fully order-independent across a shuffled mix of set/add for one ability', () => {
    const base = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
    const effects = [
      { effect: { type: 'stat_modifier', target: 'str', operation: 'set', value: 19, condition: null } as Effect, sourceName: 'A', sourceId: 'A', appliedAt: 0 },
      { effect: { type: 'stat_modifier', target: 'str', operation: 'add', value: 2, condition: null } as Effect, sourceName: 'B', sourceId: 'B', appliedAt: 1 },
      { effect: { type: 'stat_modifier', target: 'str', operation: 'set', value: 17, condition: null } as Effect, sourceName: 'C', sourceId: 'C', appliedAt: 2 }, // loses to A's higher set
      { effect: { type: 'stat_modifier', target: 'str', operation: 'add', value: 1, condition: null } as Effect, sourceName: 'D', sourceId: 'D', appliedAt: 3 },
    ];
    const expected = applyStatModifiers(base, effects).str;
    expect(expected).toBe(22); // 19 (highest set) + 2 + 1
    for (let i = 0; i < 5; i++) {
      const shuffled = [...effects].sort(() => Math.random() - 0.5);
      expect(applyStatModifiers(base, shuffled).str).toBe(expected);
    }
  });
});

describe('recomputeDerived — AC', () => {
  it('falls back to 10 + DEX modifier with no armor and no formula effects', () => {
    const e = withFeatures([], { stats: { str: 10, dex: 14, con: 10, int: 10, wis: 10, cha: 10 } });
    expect(recomputeDerived(e, DEFAULT_RULES).derived.ac).toBe(12);
  });

  it('uses entity.resources.ac when armor is equipped (no formula effect)', () => {
    const e = withFeatures([], { resources: { ...makeEmptyEntity('e1').resources, ac: 16 } });
    expect(recomputeDerived(e, DEFAULT_RULES).derived.ac).toBe(16);
  });

  it('applies a base_ac_formula effect (Unarmored Defense) over the flat fallback', () => {
    const e = withFeatures(
      [feature('unarmored_defense', [{ type: 'base_ac_formula', target: 'ac', operation: 'add', value: 10, formulaAbilities: ['dex', 'con'] }])],
      { stats: { str: 10, dex: 14, con: 14, int: 10, wis: 10, cha: 10 } },
    );
    // 10 + dex mod(2) + con mod(2) = 14
    expect(recomputeDerived(e, DEFAULT_RULES).derived.ac).toBe(14);
  });

  it('caps a formula ability\'s contribution when formulaAbilityCap is set (medium armor)', () => {
    const e = withFeatures(
      [feature('medium_armor', [{ type: 'base_ac_formula', target: 'ac', operation: 'add', value: 14, formulaAbilities: ['dex'], formulaAbilityCap: { dex: 2 } }])],
      { stats: { str: 10, dex: 20, con: 10, int: 10, wis: 10, cha: 10 } }, // dex mod would be +5 uncapped
    );
    expect(recomputeDerived(e, DEFAULT_RULES).derived.ac).toBe(16); // 14 + capped 2, not 14+5
  });

  it('stacks a flat AC bonus (shield) on top of the base AC', () => {
    const e = withFeatures(
      [feature('shield', [{ type: 'stat_modifier', target: 'ac', operation: 'add', value: 2 }])],
      { resources: { ...makeEmptyEntity('e1').resources, ac: 16 } },
    );
    expect(recomputeDerived(e, DEFAULT_RULES).derived.ac).toBe(18);
  });

  it('takes the highest of multiple base_ac_formula effects rather than stacking them', () => {
    const e = withFeatures([
      feature('unarmored_defense_monk', [{ type: 'base_ac_formula', target: 'ac', operation: 'add', value: 10, formulaAbilities: ['dex', 'wis'] }]),
      feature('unarmored_defense_barbarian', [{ type: 'base_ac_formula', target: 'ac', operation: 'add', value: 10, formulaAbilities: ['dex', 'con'] }]),
    ], { stats: { str: 10, dex: 14, con: 16, int: 10, wis: 10, cha: 10 } });
    // monk formula: 10+2+0=12, barbarian formula: 10+2+3=15 — max() wins
    expect(recomputeDerived(e, DEFAULT_RULES).derived.ac).toBe(15);
  });
});

describe('recomputeDerived — proficiency bonus', () => {
  it.each([
    [1, 2], [4, 2], [5, 3], [8, 3], [9, 4], [12, 4], [13, 5], [16, 5], [17, 6], [20, 6],
  ])('is correct at character level %i', (level, expected) => {
    const e = withFeatures([], { identity: { ...makeEmptyEntity('e1').identity, level } });
    expect(recomputeDerived(e, DEFAULT_RULES).derived.proficiencyBonus).toBe(expected);
  });
});

describe('recomputeDerived — saving throws', () => {
  it('applies proficiency bonus only to proficient abilities', () => {
    const e = withFeatures([], {
      stats: { str: 16, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      identity: { ...makeEmptyEntity('e1').identity, level: 1 },
      proficiencies: { ...makeEmptyEntity('e1').proficiencies, savingThrows: ['str'] },
    });
    const saves = recomputeDerived(e, DEFAULT_RULES).derived.savingThrows;
    expect(saves.str).toBe(modifier(16) + 2); // proficient: mod + prof bonus
    expect(saves.dex).toBe(modifier(10));     // not proficient: mod only
  });

  it('adds a savingThrows.<ability> stat_modifier effect on top', () => {
    const e = withFeatures([feature('resistance_spell', [{ type: 'stat_modifier', target: 'savingThrows.wis', operation: 'add', value: 5 }])]);
    expect(recomputeDerived(e, DEFAULT_RULES).derived.savingThrows.wis).toBe(5);
  });
});

describe('recomputeDerived — skills', () => {
  it('gives no bonus for an untrained skill beyond the ability modifier', () => {
    const e = withFeatures([], { stats: { str: 10, dex: 10, con: 10, int: 10, wis: 14, cha: 10 } });
    expect(recomputeDerived(e, DEFAULT_RULES).derived.passivePerception).toBe(10 + modifier(14));
  });

  it('doubles proficiency bonus for an expertise skill', () => {
    const e = makeEmptyEntity('e1');
    e.stats = { str: 10, dex: 10, con: 10, int: 10, wis: 14, cha: 10 };
    e.identity.level = 1;
    e.skills.skills.perception = { ability: 'wis', trained: true, expertise: true, bonus: null };
    expect(recomputeDerived(e, DEFAULT_RULES).derived.passivePerception).toBe(10 + modifier(14) + 2 * 2);
  });

  it('adds a skill.<name> stat_modifier effect only to that specific skill', () => {
    const e = withFeatures([feature('keen_senses', [{ type: 'stat_modifier', target: 'skill.perception', operation: 'add', value: 5 }])]);
    const derived = recomputeDerived(e, DEFAULT_RULES).derived;
    expect(derived.passivePerception).toBe(10 + 5);
    expect(derived.passiveInsight).toBe(10); // unaffected — target was perception-specific
  });

  it('adds a passivePerception/passiveInvestigation-targeted stat_modifier effect (Observant, architecture review U7)', () => {
    const e = withFeatures([feature('observant', [
      { type: 'stat_modifier', target: 'passivePerception', operation: 'add', value: 5 },
      { type: 'stat_modifier', target: 'passiveInvestigation', operation: 'add', value: 5 },
    ])]);
    const derived = recomputeDerived(e, DEFAULT_RULES).derived;
    expect(derived.passivePerception).toBe(10 + 5);
    expect(derived.passiveInvestigation).toBe(10 + 5);
    expect(derived.passiveInsight).toBe(10); // unaffected — Observant doesn't touch Insight
  });
});

describe('recomputeDerived — spellcasting', () => {
  it('is null for spellSaveDC/spellAttackBonus when the entity has no spellcasting block', () => {
    const derived = recomputeDerived(makeEmptyEntity('e1'), DEFAULT_RULES).derived;
    expect(derived.spellSaveDC).toBeNull();
    expect(derived.spellAttackBonus).toBeNull();
  });

  it('computes spell save DC / attack bonus as 8/prof + ability modifier', () => {
    const e = makeEmptyEntity('e1');
    e.stats = { str: 10, dex: 10, con: 10, int: 10, wis: 16, cha: 10 };
    e.identity.level = 1;
    e.spellcasting = { ability: 'wis', slots: {} as any, cantrips: [], known: [], prepared: [], concentrating: null };
    const derived = recomputeDerived(e, DEFAULT_RULES).derived;
    expect(derived.spellSaveDC).toBe(8 + 2 + modifier(16));
    expect(derived.spellAttackBonus).toBe(2 + modifier(16));
  });

  it('accepts either snake_case or camelCase target spelling for a spell-DC-boosting effect', () => {
    const e = makeEmptyEntity('e1');
    e.spellcasting = { ability: 'int', slots: {} as any, cantrips: [], known: [], prepared: [], concentrating: null };
    e.features = [feature('boost_snake', [{ type: 'stat_modifier', target: 'spell_save_dc', operation: 'add', value: 1 }])];
    const snakeCase = recomputeDerived(e, DEFAULT_RULES).derived.spellSaveDC;

    const e2 = { ...e, features: [feature('boost_camel', [{ type: 'stat_modifier', target: 'spellSaveDC', operation: 'add', value: 1 }])] };
    const camelCase = recomputeDerived(e2, DEFAULT_RULES).derived.spellSaveDC;

    const baseline = recomputeDerived({ ...e, features: [] }, DEFAULT_RULES).derived.spellSaveDC!;
    expect(snakeCase).toBe(baseline + 1);
    expect(camelCase).toBe(baseline + 1);
  });
});

describe('recomputeDerived — senses and movement', () => {
  it('keeps the longest range when two features grant the same sense type', () => {
    const e = withFeatures([
      feature('darkvision_60', [{ type: 'grant_sense', target: 'sense', operation: 'add', value: null, senseType: 'darkvision', senseRange: 60 }]),
      feature('darkvision_120', [{ type: 'grant_sense', target: 'sense', operation: 'add', value: null, senseType: 'darkvision', senseRange: 120 }]),
    ]);
    const senses = recomputeDerived(e, DEFAULT_RULES).derived.senses;
    expect(senses).toEqual([{ type: 'darkvision', range: 120, note: undefined }]);
  });

  it('keeps the largest value when two features grant the same movement type', () => {
    const e = withFeatures([
      feature('fly_30', [{ type: 'grant_movement', target: 'movement', operation: 'add', value: null, movementType: 'fly', movementRange: 30 }]),
      feature('fly_60', [{ type: 'grant_movement', target: 'movement', operation: 'add', value: null, movementType: 'fly', movementRange: 60 }]),
    ]);
    expect(recomputeDerived(e, DEFAULT_RULES).derived.movement).toEqual({ fly: 60 });
  });
});

describe('recomputeDerived — advantage/disadvantage aggregation', () => {
  it('records an advantage state for a target with an advantage effect', () => {
    const e = withFeatures([feature('lucky', [{ type: 'stat_modifier', target: 'adv.str_checks', operation: 'advantage', value: null }])]);
    expect(recomputeDerived(e, DEFAULT_RULES).derived.advantageStates).toEqual([{ target: 'adv.str_checks', state: 'advantage' }]);
  });

  it('cancels out to "straight" (and is omitted) when advantage and disadvantage both apply', () => {
    const e = withFeatures([
      feature('blessed', [{ type: 'stat_modifier', target: 'adv.str_checks', operation: 'advantage', value: null }]),
      feature('cursed', [{ type: 'stat_modifier', target: 'adv.str_checks', operation: 'disadvantage', value: null }]),
    ]);
    expect(recomputeDerived(e, DEFAULT_RULES).derived.advantageStates).toEqual([]);
  });
});

describe('recomputeDerived — grant_proficiency effects', () => {
  it('marks a skill trained via an "add" grant_proficiency effect', () => {
    const e = withFeatures([feature('keen_senses', [{ type: 'grant_proficiency', target: 'skill:perception', operation: 'add', value: null }])]);
    const updated = recomputeDerived(e, DEFAULT_RULES);
    expect(updated.skills.skills.perception.trained).toBe(true);
  });

  it('grants expertise via a "multiply" grant_proficiency effect', () => {
    const e = withFeatures([feature('expertise_grant', [{ type: 'grant_proficiency', target: 'skill:stealth', operation: 'multiply', value: 2 }])]);
    const updated = recomputeDerived(e, DEFAULT_RULES);
    // multiply on an untrained skill: current behavior requires !existing.expertise,
    // and marks both trained+expertise true regardless of prior trained state.
    expect(updated.skills.skills.stealth.trained).toBe(true);
    expect(updated.skills.skills.stealth.expertise).toBe(true);
  });

  it('adds a tool proficiency via an "add" grant_proficiency effect', () => {
    const e = withFeatures([feature('tool_grant', [{ type: 'grant_proficiency', target: 'tool:thieves_tools', operation: 'add', value: null }])]);
    const updated = recomputeDerived(e, DEFAULT_RULES);
    expect(updated.proficiencies.tools).toContain('thieves tools');
  });

  it('does not add a duplicate tool proficiency it already has (case-insensitive)', () => {
    const e = withFeatures([feature('tool_grant', [{ type: 'grant_proficiency', target: 'tool:thieves_tools', operation: 'add', value: null }])],
      { proficiencies: { ...makeEmptyEntity('e1').proficiencies, tools: ['Thieves Tools'] } });
    const updated = recomputeDerived(e, DEFAULT_RULES);
    expect(updated.proficiencies.tools.filter(t => t.toLowerCase() === 'thieves tools').length).toBe(1);
  });

  it('adds a weapon proficiency via an "add" grant_proficiency effect', () => {
    const e = withFeatures([feature('weapon_grant', [{ type: 'grant_proficiency', target: 'weapon:rapier', operation: 'add', value: null }])]);
    const updated = recomputeDerived(e, DEFAULT_RULES);
    expect(updated.proficiencies.weapons).toContain('rapier');
  });

  it('does not add a duplicate weapon proficiency it already has (case-insensitive)', () => {
    const e = withFeatures([feature('weapon_grant', [{ type: 'grant_proficiency', target: 'weapon:longbow', operation: 'add', value: null }])],
      { proficiencies: { ...makeEmptyEntity('e1').proficiencies, weapons: ['Longbow'] } });
    const updated = recomputeDerived(e, DEFAULT_RULES);
    expect(updated.proficiencies.weapons.filter(w => w.toLowerCase() === 'longbow').length).toBe(1);
  });

  it('adds an armor proficiency via an "add" grant_proficiency effect', () => {
    const e = withFeatures([feature('armor_grant', [{ type: 'grant_proficiency', target: 'armor:medium', operation: 'add', value: null }])]);
    const updated = recomputeDerived(e, DEFAULT_RULES);
    expect(updated.proficiencies.armor).toContain('medium');
  });

  it('does not add a duplicate armor proficiency it already has (case-insensitive)', () => {
    const e = withFeatures([feature('armor_grant', [{ type: 'grant_proficiency', target: 'armor:light', operation: 'add', value: null }])],
      { proficiencies: { ...makeEmptyEntity('e1').proficiencies, armor: ['Light'] } });
    const updated = recomputeDerived(e, DEFAULT_RULES);
    expect(updated.proficiencies.armor.filter(a => a.toLowerCase() === 'light').length).toBe(1);
  });
});

describe('recomputeDerived — conditional effects', () => {
  it('skips an effect gated on a condition flag that is not active', () => {
    const e = withFeatures([feature('rage_bonus', [{ type: 'stat_modifier', target: 'ac', operation: 'add', value: 2, condition: 'rage_active' }])]);
    expect(recomputeDerived(e, DEFAULT_RULES).derived.ac).toBe(10); // baseline, unarmored dex 10
  });

  it('applies the effect once the gating flag is set', () => {
    const e = withFeatures([feature('rage_bonus', [{ type: 'stat_modifier', target: 'ac', operation: 'add', value: 2, condition: 'rage_active' }])],
      { conditionMonitor: { active: [], exhaustion: 0, flags: { rage_active: true } } });
    expect(recomputeDerived(e, DEFAULT_RULES).derived.ac).toBe(12);
  });
});

// Item 9 — context-dependent/three-state mechanics. Distinct from
// Effect.condition above: `condition` gates on state the ENGINE already
// tracks (a flag/active condition id); `situational` gates on a real-world
// fact the app can't observe at all (positioning, "an ally within 5 feet"),
// so it reads from Entity.situationalAnswers, which only a person can set.
describe('recomputeDerived — situational effects (item 9)', () => {
  function situationalAcFeature() {
    return feature('bonus', [{
      type: 'stat_modifier', target: 'ac', operation: 'add', value: 2, condition: null,
      situational: { id: 'ally_adjacent', question: 'Is an ally within 5 feet?' },
    }]);
  }

  it('does not apply when unanswered — the conservative default', () => {
    const e = withFeatures([situationalAcFeature()]);
    expect(e.situationalAnswers).toBeUndefined();
    expect(recomputeDerived(e, DEFAULT_RULES).derived.ac).toBe(10);
  });

  it('does not apply when explicitly answered No', () => {
    const e = withFeatures([situationalAcFeature()], { situationalAnswers: { ally_adjacent: false } });
    expect(recomputeDerived(e, DEFAULT_RULES).derived.ac).toBe(10);
  });

  it('applies once explicitly answered Yes', () => {
    const e = withFeatures([situationalAcFeature()], { situationalAnswers: { ally_adjacent: true } });
    expect(recomputeDerived(e, DEFAULT_RULES).derived.ac).toBe(12);
  });

  it('an unrelated situational answer does not affect a different question', () => {
    const e = withFeatures([situationalAcFeature()], { situationalAnswers: { some_other_fact: true } });
    expect(recomputeDerived(e, DEFAULT_RULES).derived.ac).toBe(10);
  });

  it('gates situational effects on equipped items the same way as features', () => {
    const e = withFeatures([], {
      inventory: {
        ...makeEmptyEntity('e1').inventory,
        equipped: [{
          itemId: 'ring1', quantity: 1, attuned: false,
          features: [situationalAcFeature()],
        }],
      },
    });
    expect(recomputeDerived(e, DEFAULT_RULES).derived.ac).toBe(10);
    const answered = { ...e, situationalAnswers: { ally_adjacent: true } };
    expect(recomputeDerived(answered, DEFAULT_RULES).derived.ac).toBe(12);
  });
});

describe('recomputeDerived — DM overrides', () => {
  function override(partial: Partial<DmOverride>): DmOverride {
    return {
      id: 'o1', campaignId: 'c1', entityId: 'e1', dmDeviceId: 'd1',
      stat: 'ac', operation: 'set', value: 0, active: true,
      label: 'test override', appliedAt: Date.now(),
      ...partial,
    } as DmOverride;
  }

  it('a "set" override replaces the computed value', () => {
    const e = withFeatures([], { dmOverrides: [override({ stat: 'ac', operation: 'set', value: 25 })] });
    expect(recomputeDerived(e, DEFAULT_RULES).derived.ac).toBe(25);
  });

  it('an "add" override stacks on top of the computed value', () => {
    const e = withFeatures([], { dmOverrides: [override({ stat: 'ac', operation: 'add', value: 3 })] });
    expect(recomputeDerived(e, DEFAULT_RULES).derived.ac).toBe(13); // 10 baseline + 3
  });

  it('an inactive override has no effect', () => {
    const e = withFeatures([], { dmOverrides: [override({ stat: 'ac', operation: 'set', value: 25, active: false })] });
    expect(recomputeDerived(e, DEFAULT_RULES).derived.ac).toBe(10);
  });

  it('overrides a single saving throw via the "savingThrows.<ability>" target', () => {
    const e = withFeatures([], { dmOverrides: [override({ stat: 'savingThrows.dex', operation: 'set', value: 99 })] });
    const saves = recomputeDerived(e, DEFAULT_RULES).derived.savingThrows;
    expect(saves.dex).toBe(99);
    expect(saves.str).toBe(0); // untouched
  });

  it('an "add" override on passivePerception is reflected in entity.derived (architecture review U6 — closes the loop: the UI now reads this value directly instead of recomputing it independently)', () => {
    const e = withFeatures([], {
      stats: { str: 10, dex: 10, con: 10, int: 10, wis: 14, cha: 10 },
      dmOverrides: [override({ stat: 'passivePerception', operation: 'add', value: 5 })],
    });
    expect(recomputeDerived(e, DEFAULT_RULES).derived.passivePerception).toBe(10 + modifier(14) + 5);
  });
});

// Re-audit A18: weapon attack ability-selection and proficiency-bonus
// gating. Rules-engine blocker RE-AUDIT closure (dependency inversion, 1D):
// weapon definitions are now resolved via recomputeDerived's own explicit
// `content.items` parameter (a homebrew-only id proves the homebrew path
// resolves correctly, no SQLite/itemRepo warm-up needed in Jest) — the
// engine no longer reaches into useHomebrewStore for this at all.
describe('computeWeaponAttackBonuses — ability selection and proficiency (A18)', () => {
  function weaponItem(id: string, properties: string[], dice: string, damageType = 'slashing'): Item {
    return {
      id, name: id, weight: 1, cost: '1 gp', properties,
      features: [{
        id: `${id}_attack`, name: id, description: '', source: { kind: 'item', refId: id }, level: null,
        effects: [], actions: [], choices: [], passive: false,
        activation: { actionType: 'action', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
        abilityEffects: [{ type: 'damage', dice, damageType }],
      } as unknown as FeatureInstance],
    };
  }

  function withWeapon(item: Item, overrides: Partial<Entity> = {}): Entity {
    const inst = { itemId: item.id, quantity: 1, attuned: false, features: [] };
    const e = makeEmptyEntity('e1');
    return { ...e, stats: { str: 18, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, inventory: { ...e.inventory, equipped: [inst] }, ...overrides };
  }

  const items = (item: Item) => ({ items: [item as any] });

  it('a thrown, non-finesse weapon (handaxe) always uses STR, never DEX, despite listing a range in its own property text', () => {
    const item = weaponItem('test_handaxe', ['light', 'thrown (range 20/60)'], '1d6');
    const e = withWeapon(item, { proficiencies: { ...makeEmptyEntity('e1').proficiencies, weapons: ['martial'] } });
    const ab = recomputeDerived(e, DEFAULT_RULES, items(item)).derived.attackBonuses.find(a => a.id === 'test_handaxe')!;
    expect(ab.ability).toBe('str');
    expect(ab.type).toBe('melee');
  });

  it('a finesse thrown weapon (dagger) uses the higher of STR/DEX', () => {
    const item = weaponItem('test_dagger', ['finesse', 'light', 'thrown (range 20/60)'], '1d4', 'piercing');
    const e = withWeapon(item, {
      stats: { str: 10, dex: 18, con: 10, int: 10, wis: 10, cha: 10 },
      proficiencies: { ...makeEmptyEntity('e1').proficiencies, weapons: ['simple'] },
    });
    const ab = recomputeDerived(e, DEFAULT_RULES, items(item)).derived.attackBonuses.find(a => a.id === 'test_dagger')!;
    expect(ab.ability).toBe('dex');
  });

  it('an ammunition weapon (bow) uses DEX and is classified ranged', () => {
    const item = weaponItem('test_bow', ['ammunition (range 80/320)', 'two-handed'], '1d8', 'piercing');
    const e = withWeapon(item, { proficiencies: { ...makeEmptyEntity('e1').proficiencies, weapons: ['martial'] } });
    const ab = recomputeDerived(e, DEFAULT_RULES, items(item)).derived.attackBonuses.find(a => a.id === 'test_bow')!;
    expect(ab.ability).toBe('dex');
    expect(ab.type).toBe('ranged');
  });

  it('proficiency bonus applies when the character has the matching weapon-category proficiency', () => {
    const item = weaponItem('test_simple_weapon', [], '1d6'); // no recognizable name/props -> classified simple
    const e = withWeapon(item, {
      identity: { ...makeEmptyEntity('e1').identity, level: 5 },
      proficiencies: { ...makeEmptyEntity('e1').proficiencies, weapons: ['simple'] },
    });
    const result = recomputeDerived(e, DEFAULT_RULES, items(item));
    const ab = result.derived.attackBonuses.find(a => a.id === 'test_simple_weapon')!;
    expect(ab.bonus).toBe(result.derived.proficiencyBonus + modifier(18));
  });

  it('proficiency bonus is withheld when the character has NO matching weapon proficiency (untrained)', () => {
    const item = weaponItem('test_simple_weapon_2', [], '1d6');
    const e = withWeapon(item, {
      identity: { ...makeEmptyEntity('e1').identity, level: 5 },
      proficiencies: { ...makeEmptyEntity('e1').proficiencies, weapons: [] },
    });
    const result = recomputeDerived(e, DEFAULT_RULES, items(item));
    const ab = result.derived.attackBonuses.find(a => a.id === 'test_simple_weapon_2')!;
    expect(ab.bonus).toBe(modifier(18)); // no proficiency bonus included
  });

  it('WITHOUT the explicit content param, a homebrew-only weapon correctly falls back to official-only resolution (no crash, no bonus computed)', () => {
    const item = weaponItem('test_handaxe_2', ['light'], '1d6');
    const e = withWeapon(item, { proficiencies: { ...makeEmptyEntity('e1').proficiencies, weapons: ['martial'] } });
    const ab = recomputeDerived(e, DEFAULT_RULES).derived.attackBonuses.find(a => a.id === 'test_handaxe_2');
    expect(ab).toBeUndefined(); // deterministic official-only fallback, not a crash
  });

  // Rules-engine blocker RE-AUDIT closure — architecture purity (1J): the
  // REAL recomputeDerived path (item resolution + attack-bonus computation),
  // not a trivial resolver, proving determinism from explicit inputs alone.
  it('same entity + rules + explicit content -> same result, REGARDLESS of useHomebrewStore mutations in between', () => {
    const item = weaponItem('test_purity_weapon', ['light'], '1d6');
    const e = withWeapon(item, { proficiencies: { ...makeEmptyEntity('e1').proficiencies, weapons: ['martial'] } });
    const explicitContent = { items: [item] };

    useHomebrewStore.setState({ items: [] }); // baseline: store has NOTHING registered
    const before = recomputeDerived(e, DEFAULT_RULES, explicitContent);

    // Mutate the store with CONFLICTING content — a real store read would
    // change the result; an explicit-content-snapshot call must be
    // completely unaffected.
    useHomebrewStore.setState({ items: [{ ...item, name: 'DIFFERENT NAME', features: [] }] });
    const after = recomputeDerived(e, DEFAULT_RULES, explicitContent);

    expect(after.derived.attackBonuses.find(a => a.id === 'test_purity_weapon'))
      .toEqual(before.derived.attackBonuses.find(a => a.id === 'test_purity_weapon'));
    expect(after.derived.attackBonuses.find(a => a.id === 'test_purity_weapon')).toBeDefined();

    useHomebrewStore.setState({ items: [] }); // cleanup
  });
});

describe('recomputeDerived — entitlement-driven proficiencies (closure pass 2)', () => {
  it('syncs entity.proficiencies.tools/skills from entity.entitlements, and removing an entitlement source strips it from the flat array on the next pass', () => {
    let e: Entity = {
      ...makeEmptyEntity('e1'),
      entitlements: [
        { kind: 'tool_proficiency', key: 'thieves_tools', sourceKind: 'class', sourceId: 'rogue' },
        { kind: 'skill_proficiency', key: 'stealth', sourceKind: 'class', sourceId: 'rogue' },
      ],
    };
    let result = recomputeDerived(e, DEFAULT_RULES);
    expect(result.proficiencies.tools).toContain('thieves_tools');
    expect(result.skills.skills.stealth.trained).toBe(true);

    // Remove the class's own entitlement (e.g. a multiclass-removal or
    // subclass-change primitive would call this) and recompute again.
    e = { ...result, entitlements: (result.entitlements ?? []).filter(r => r.sourceId !== 'rogue') };
    result = recomputeDerived(e, DEFAULT_RULES);
    expect(result.proficiencies.tools).not.toContain('thieves_tools');
    expect(result.skills.skills.stealth.trained).toBe(false);
  });

  it('a manual entitlement survives even after every source entitlement for the same key is removed', () => {
    let e: Entity = {
      ...makeEmptyEntity('e1'),
      entitlements: [
        { kind: 'armor_proficiency', key: 'heavy', sourceKind: 'manual' },
        { kind: 'armor_proficiency', key: 'heavy', sourceKind: 'class', sourceId: 'fighter' },
      ],
    };
    let result = recomputeDerived(e, DEFAULT_RULES);
    expect(result.proficiencies.armor).toContain('heavy');

    e = { ...result, entitlements: (result.entitlements ?? []).filter(r => r.sourceKind !== 'class') };
    result = recomputeDerived(e, DEFAULT_RULES);
    expect(result.proficiencies.armor).toContain('heavy'); // manual entry still grants it
  });

  it('recompute is idempotent: calling it twice on its own output yields the same effective proficiencies (closure item 12)', () => {
    const e: Entity = {
      ...makeEmptyEntity('e1'),
      entitlements: [
        { kind: 'tool_proficiency', key: 'smiths_tools', sourceKind: 'race', sourceId: 'dwarf' },
        { kind: 'language', key: 'dwarvish', sourceKind: 'race', sourceId: 'dwarf' },
      ],
    };
    const once  = recomputeDerived(e, DEFAULT_RULES);
    const twice = recomputeDerived(once, DEFAULT_RULES);
    expect(twice.proficiencies).toEqual(once.proficiencies);
    expect(twice.skills).toEqual(once.skills);
    expect(twice.entitlements).toEqual(once.entitlements); // no double-application/duplication
  });
});

// ============================================================================
// HIGH-batch rules-correctness fix (A): speed-zero precedence. A condition
// that sets speed to 0 (Grappled/Restrained/Stunned/Unconscious — see
// content/conditions/index.ts's speedZeroFeature, target:'speed',
// operation:'set', value:0) is a RESTRICTION, not an ordinary "highest set
// wins" replacement value. Before this fix, resolveCombine's normal 'set'
// tie-break let an ordinary higher replacement speed OR an additive bonus
// stacked on top of the winning 'set' beat the 0. An explicit character/DM
// override still wins — those are applied later, unconditionally, and are
// untouched by this fix.
// ============================================================================
describe('recomputeDerived — speed resolution (speed-zero precedence)', () => {
  const speedZero = (id: string) => feature(id, [{ target: 'speed', operation: 'set', value: 0 }]);
  const speedAdd  = (id: string, value: number) => feature(id, [{ target: 'speed', operation: 'add', value }]);
  const speedSet  = (id: string, value: number) => feature(id, [{ target: 'speed', operation: 'set', value }]);

  it('1. base 30, no effects -> 30', () => {
    expect(recomputeDerived(withFeatures([]), DEFAULT_RULES).derived.speed).toBe(30);
  });

  it('2. base 30 + additive bonus 10 -> 40', () => {
    const e = withFeatures([speedAdd('boots', 10)]);
    expect(recomputeDerived(e, DEFAULT_RULES).derived.speed).toBe(40);
  });

  it('3. base 30 + additive bonus 10 + Grappled -> 0 (restriction beats additive bonus)', () => {
    const e = withFeatures([speedAdd('boots', 10), speedZero('grappled')]);
    expect(recomputeDerived(e, DEFAULT_RULES).derived.speed).toBe(0);
  });

  it('4. base 30 + ordinary replacement/set 40 + Grappled -> 0 (restriction beats an ordinary higher "set")', () => {
    const e = withFeatures([speedSet('haste', 40), speedZero('grappled')]);
    expect(recomputeDerived(e, DEFAULT_RULES).derived.speed).toBe(0);
  });

  it('5. Restrained alone -> 0', () => {
    const e = withFeatures([speedZero('restrained')]);
    expect(recomputeDerived(e, DEFAULT_RULES).derived.speed).toBe(0);
  });

  it('6. removing Grappled restores the ordinary calculated speed', () => {
    const grappled = withFeatures([speedAdd('boots', 10), speedZero('grappled')]);
    expect(recomputeDerived(grappled, DEFAULT_RULES).derived.speed).toBe(0);
    const removed = withFeatures([speedAdd('boots', 10)]); // Grappled feature stripped, same as removeCondition would do
    expect(recomputeDerived(removed, DEFAULT_RULES).derived.speed).toBe(40);
  });

  it('7. repeated recompute is idempotent — no stale zero, no duplicated effects', () => {
    const e = withFeatures([speedAdd('boots', 10), speedZero('grappled')]);
    const once  = recomputeDerived(e, DEFAULT_RULES);
    const twice = recomputeDerived(once, DEFAULT_RULES);
    expect(once.derived.speed).toBe(0);
    expect(twice.derived.speed).toBe(0);
    expect(twice.features.filter(f => f.id === 'grappled')).toHaveLength(1);
  });

  it('8. two overlapping zero restrictions -> still 0', () => {
    const e = withFeatures([speedZero('grappled'), speedZero('restrained')]);
    expect(recomputeDerived(e, DEFAULT_RULES).derived.speed).toBe(0);
  });

  it('9. removing one of two zero restrictions -> still 0 because the other remains', () => {
    const e = withFeatures([speedZero('restrained')]); // grappled already removed
    expect(recomputeDerived(e, DEFAULT_RULES).derived.speed).toBe(0);
  });

  it('10. an explicit character override after a calculated zero still wins', () => {
    const e = withFeatures([speedZero('grappled')], {
      characterOverrides: [{
        id: 'co1', entityId: 'e1', stat: 'speed', operation: 'set', value: 20,
        label: 'table ruling', active: true, appliedAt: 0, cancelledAt: null,
      }],
    });
    expect(recomputeDerived(e, DEFAULT_RULES).derived.speed).toBe(20);
  });

  it('11. a DM override wins over both the restriction and a character override (existing DM-wins-over-all precedence)', () => {
    const e = withFeatures([speedZero('grappled')], {
      characterOverrides: [{
        id: 'co1', entityId: 'e1', stat: 'speed', operation: 'set', value: 20,
        label: 'table ruling', active: true, appliedAt: 0, cancelledAt: null,
      }],
      dmOverrides: [{
        id: 'do1', campaignId: 'c1', entityId: 'e1', dmDeviceId: 'd1',
        stat: 'speed', operation: 'set', value: 15, active: true,
        label: 'DM ruling', appliedAt: 1, cancelledAt: null, expiry: 'manual',
      } as DmOverride],
    });
    expect(recomputeDerived(e, DEFAULT_RULES).derived.speed).toBe(15);
  });
});

// ============================================================================
// HIGH-batch rules-correctness fix (single-issue follow-up): Wild Shape
// speed-zero precedence. The beastForm branch of finalSpeed used to
// short-circuit straight to beastForm.speed BEFORE the zero-speed
// restriction check ever ran, so a transformed, Grappled/Restrained
// creature incorrectly kept its full beast-form movement — the active
// condition's own effects live on entity.features (applyCondition), which
// Wild Shape never touches, so the restriction must still apply on top of
// the transformed calculated speed. Uses the REAL shipped Grappled/
// Restrained condition definitions (content/conditions/index.ts), not just
// hand-built stat_modifier fixtures, and the real Wolf BeastForm (speed 40).
// ============================================================================
describe('recomputeDerived — Wild Shape speed-zero precedence (HIGH-batch single-issue follow-up)', () => {
  const grappledFeatures = ALL_CONDITIONS.find(c => c.id === 'grappled')!.features;
  const restrainedFeatures = ALL_CONDITIONS.find(c => c.id === 'restrained')!.features;
  const speedAdd = (id: string, value: number) => feature(id, [{ target: 'speed', operation: 'add', value }]);
  const speedSet = (id: string, value: number) => feature(id, [{ target: 'speed', operation: 'set', value }]);

  function wolfShaped(): Entity {
    const e = makeEmptyEntity('e1');
    return startWildShape(e, 'wolf', DEFAULT_RULES); // Wolf: speed 40
  }

  it('1. active Wild Shape + real Grappled -> speed 0', () => {
    const shaped = wolfShaped();
    expect(shaped.derived.speed).toBe(40); // sanity: beast form speed before the condition
    const grappled = applyCondition(shaped, 'grappled', 'manual', DEFAULT_RULES, grappledFeatures);
    expect(grappled.derived.speed).toBe(0);
  });

  it('2. active Wild Shape + real Restrained -> speed 0', () => {
    const shaped = wolfShaped();
    const restrained = applyCondition(shaped, 'restrained', 'manual', DEFAULT_RULES, restrainedFeatures);
    expect(restrained.derived.speed).toBe(0);
  });

  it('3. Wild Shape + Grappled + an additive speed bonus -> still 0', () => {
    let e = wolfShaped();
    e = applyCondition(e, 'grappled', 'manual', DEFAULT_RULES, grappledFeatures);
    e = { ...e, features: [...e.features, speedAdd('boots', 10)] };
    expect(recomputeDerived(e, DEFAULT_RULES).derived.speed).toBe(0);
  });

  it('4. Wild Shape + Grappled + an ordinary replacement/set speed effect -> still 0', () => {
    let e = wolfShaped();
    e = applyCondition(e, 'grappled', 'manual', DEFAULT_RULES, grappledFeatures);
    e = { ...e, features: [...e.features, speedSet('haste', 60)] };
    expect(recomputeDerived(e, DEFAULT_RULES).derived.speed).toBe(0);
  });

  it('5. Wild Shape + Grappled + Restrained (two overlapping restrictions) -> 0', () => {
    let e = wolfShaped();
    e = applyCondition(e, 'grappled', 'manual', DEFAULT_RULES, grappledFeatures);
    e = applyCondition(e, 'restrained', 'manual', DEFAULT_RULES, restrainedFeatures);
    expect(e.derived.speed).toBe(0);
  });

  it('6. removing one restriction (Grappled) while Restrained remains -> still 0', () => {
    let e = wolfShaped();
    e = applyCondition(e, 'grappled', 'manual', DEFAULT_RULES, grappledFeatures);
    e = applyCondition(e, 'restrained', 'manual', DEFAULT_RULES, restrainedFeatures);
    e = removeCondition(e, 'grappled', DEFAULT_RULES);
    expect(e.derived.speed).toBe(0);
  });

  it('7. removing the final restriction restores the BeastForm\'s calculated speed', () => {
    let e = wolfShaped();
    e = applyCondition(e, 'grappled', 'manual', DEFAULT_RULES, grappledFeatures);
    e = applyCondition(e, 'restrained', 'manual', DEFAULT_RULES, restrainedFeatures);
    e = removeCondition(e, 'grappled', DEFAULT_RULES);
    e = removeCondition(e, 'restrained', DEFAULT_RULES);
    expect(e.derived.speed).toBe(40); // Wolf's own speed, no stale zero/leftover effects
  });

  it('8. repeated recompute is stable — no stale zero, no duplicated effects', () => {
    let e = wolfShaped();
    e = applyCondition(e, 'grappled', 'manual', DEFAULT_RULES, grappledFeatures);
    const once = recomputeDerived(e, DEFAULT_RULES);
    const twice = recomputeDerived(once, DEFAULT_RULES);
    expect(once.derived.speed).toBe(0);
    expect(twice.derived.speed).toBe(0);
    expect(twice.features.filter(f => f.id === 'grappled_speed')).toHaveLength(1);
  });

  it('9. Wild Shape + Grappled + an explicit character/manual override -> the override still wins', () => {
    let e = wolfShaped();
    e = applyCondition(e, 'grappled', 'manual', DEFAULT_RULES, grappledFeatures);
    e = {
      ...e,
      characterOverrides: [{
        id: 'co1', entityId: 'e1', stat: 'speed', operation: 'set', value: 20,
        label: 'table ruling', active: true, appliedAt: 0, cancelledAt: null,
      }],
    };
    expect(recomputeDerived(e, DEFAULT_RULES).derived.speed).toBe(20);
  });

  it('10. Wild Shape + Grappled + a DM override -> existing DM-wins-over-all precedence still holds', () => {
    let e = wolfShaped();
    e = applyCondition(e, 'grappled', 'manual', DEFAULT_RULES, grappledFeatures);
    e = {
      ...e,
      characterOverrides: [{
        id: 'co1', entityId: 'e1', stat: 'speed', operation: 'set', value: 20,
        label: 'table ruling', active: true, appliedAt: 0, cancelledAt: null,
      }],
      dmOverrides: [{
        id: 'do1', campaignId: 'c1', entityId: 'e1', dmDeviceId: 'd1',
        stat: 'speed', operation: 'set', value: 15, active: true,
        label: 'DM ruling', appliedAt: 1, cancelledAt: null, expiry: 'manual',
      } as DmOverride],
    };
    expect(recomputeDerived(e, DEFAULT_RULES).derived.speed).toBe(15);
  });
});
