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
  parseConcentrationDuration, tickConcentrationDuration,
} from '../combat';
import { setRandomSource } from '../dice';
import { Entity, SpellSlots, FeatureInstance, Spell } from '../types';

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
