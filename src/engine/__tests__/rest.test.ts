// src/engine/__tests__/rest.test.ts
// Short/long rest recovery — the pact-slot-vs-combined-slot split here was
// added during multiclassing and is easy to get backwards (recharging the
// wrong pool, or recharging both when only one should refresh), so it gets
// dedicated coverage rather than relying on manual device testing.
import { makeEmptyEntity, DEFAULT_RULES } from '../../store/characterStore';
import {
  takeRest, spendHitDie, discardHitDie, spendHitDieManual, currentHitDieSize,
  hitDiceRecoveryNeedsAllocation, hitDiceRecoveryBudget, expendedHitDicePools,
  HitDiceRecoveryAllocation,
} from '../rest';
import { Entity, SpellSlots, CampaignRules, asClassId } from '../types';

function emptySlots(overrides: Partial<Record<keyof SpellSlots, { total: number; used: number }>> = {}): SpellSlots {
  const tiers = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;
  const slots = {} as SpellSlots;
  for (const t of tiers) slots[t] = { total: 0, used: 0 };
  return { ...slots, ...overrides };
}

function baseEntity(overrides: Partial<Entity> = {}): Entity {
  return { ...makeEmptyEntity('e1'), ...overrides };
}

describe('takeRest — dispatcher', () => {
  it('routes to short rest logic and recomputes derived stats', () => {
    const e = baseEntity();
    const result = takeRest(e, 'short', DEFAULT_RULES);
    expect(result.derived).toBeDefined();
  });

  it('routes to long rest logic and recomputes derived stats', () => {
    const e = baseEntity();
    const result = takeRest(e, 'long', DEFAULT_RULES);
    expect(result.derived).toBeDefined();
  });
});

describe('short rest — custom resources', () => {
  // Re-audit A15: this test previously asserted the WRONG oracle — a
  // long_rest-tagged resource recovering on a mere short rest — which was
  // the reproduced bug (a long_rest resource at 0/3 recharged to 3/3 on
  // short rest). A short rest must restore ONLY short_rest resources.
  it('recharges only short_rest-tagged resources, never long_rest ones', () => {
    const e = baseEntity({
      resources: {
        ...makeEmptyEntity('e1').resources,
        custom: [
          { id: 'ki', name: 'Ki Points', current: 0, maximum: 4, recharge: 'short_rest' },
          { id: 'channel_divinity', name: 'Channel Divinity', current: 0, maximum: 1, recharge: 'long_rest' },
        ],
      },
    });
    const result = takeRest(e, 'short', DEFAULT_RULES);
    expect(result.resources.custom.find(r => r.id === 'ki')!.current).toBe(4);
    expect(result.resources.custom.find(r => r.id === 'channel_divinity')!.current).toBe(0);
  });

  it('does not recharge a resource with a non-rest recharge (e.g. "dawn")', () => {
    const e = baseEntity({
      resources: {
        ...makeEmptyEntity('e1').resources,
        custom: [{ id: 'special', name: 'Special', current: 0, maximum: 1, recharge: 'dawn' }],
      },
    });
    const result = takeRest(e, 'short', DEFAULT_RULES);
    expect(result.resources.custom[0].current).toBe(0);
  });

  it('does not recharge a "never"-tagged resource on a short rest', () => {
    const e = baseEntity({
      resources: {
        ...makeEmptyEntity('e1').resources,
        custom: [{ id: 'relic', name: 'Relic Charge', current: 0, maximum: 1, recharge: 'never' }],
      },
    });
    const result = takeRest(e, 'short', DEFAULT_RULES);
    expect(result.resources.custom[0].current).toBe(0);
  });

  it('does not recharge a free-text homebrew recharge string on a short rest', () => {
    const e = baseEntity({
      resources: {
        ...makeEmptyEntity('e1').resources,
        custom: [{ id: 'moon', name: 'Moonlit Charge', current: 0, maximum: 1, recharge: 'full moon' }],
      },
    });
    const result = takeRest(e, 'short', DEFAULT_RULES);
    expect(result.resources.custom[0].current).toBe(0);
  });
});

describe('long rest — custom resources (A15)', () => {
  it('restores both short_rest- and long_rest-tagged resources', () => {
    const e = baseEntity({
      resources: {
        ...makeEmptyEntity('e1').resources,
        custom: [
          { id: 'ki', name: 'Ki Points', current: 0, maximum: 4, recharge: 'short_rest' },
          { id: 'channel_divinity', name: 'Channel Divinity', current: 0, maximum: 1, recharge: 'long_rest' },
        ],
      },
    });
    const result = takeRest(e, 'long', DEFAULT_RULES);
    expect(result.resources.custom.find(r => r.id === 'ki')!.current).toBe(4);
    expect(result.resources.custom.find(r => r.id === 'channel_divinity')!.current).toBe(1);
  });

  it('does NOT restore a "never"-tagged resource on a long rest', () => {
    const e = baseEntity({
      resources: {
        ...makeEmptyEntity('e1').resources,
        custom: [{ id: 'relic', name: 'Relic Charge', current: 0, maximum: 1, recharge: 'never' }],
      },
    });
    const result = takeRest(e, 'long', DEFAULT_RULES);
    expect(result.resources.custom[0].current).toBe(0);
  });

  it('does NOT restore a "dawn" or free-text homebrew recharge on a long rest (unsupported category, not silently mapped)', () => {
    const e = baseEntity({
      resources: {
        ...makeEmptyEntity('e1').resources,
        custom: [
          { id: 'special', name: 'Special', current: 0, maximum: 1, recharge: 'dawn' },
          { id: 'moon', name: 'Moonlit Charge', current: 0, maximum: 1, recharge: 'full moon' },
        ],
      },
    });
    const result = takeRest(e, 'long', DEFAULT_RULES);
    expect(result.resources.custom.find(r => r.id === 'special')!.current).toBe(0);
    expect(result.resources.custom.find(r => r.id === 'moon')!.current).toBe(0);
  });
});

describe('short rest — spell slots', () => {
  it('recharges a solo pact caster (Warlock) whose pact slots live in .slots directly', () => {
    const e = baseEntity({
      identity: { ...makeEmptyEntity('e1').identity, classId: 'warlock', level: 1 },
      spellcasting: {
        ability: 'cha',
        slots: emptySlots({ '1': { total: 1, used: 1 } }),
        cantrips: [], known: [], prepared: [], concentrating: null,
      },
    });
    const result = takeRest(e, 'short', DEFAULT_RULES);
    expect(result.spellcasting!.slots['1'].used).toBe(0);
  });

  it('does NOT recharge a non-pact caster (Wizard) on a short rest', () => {
    const e = baseEntity({
      identity: { ...makeEmptyEntity('e1').identity, classId: 'wizard', level: 1 },
      spellcasting: {
        ability: 'int',
        slots: emptySlots({ '1': { total: 2, used: 1 } }),
        cantrips: [], known: [], prepared: [], concentrating: null,
      },
    });
    const result = takeRest(e, 'short', DEFAULT_RULES);
    expect(result.spellcasting!.slots['1'].used).toBe(1); // untouched
  });

  it('recharges only the split-out pact pool for a multiclassed pact caster, leaving combined .slots alone', () => {
    const e = baseEntity({
      identity: {
        ...makeEmptyEntity('e1').identity,
        classes: [
          { classId: asClassId('warlock'), subclassId: null, level: 2 },
          { classId: asClassId('wizard'), subclassId: null, level: 2 },
        ],
      },
      spellcasting: {
        ability: 'cha',
        slots:     emptySlots({ '1': { total: 3, used: 2 } }),   // combined multiclass pool
        pactSlots: emptySlots({ '1': { total: 2, used: 2 } }),   // warlock's own pact pool
        cantrips: [], known: [], prepared: [], concentrating: null,
      },
    });
    const result = takeRest(e, 'short', DEFAULT_RULES);
    expect(result.spellcasting!.pactSlots!['1'].used).toBe(0);  // pact pool recharged
    expect(result.spellcasting!.slots['1'].used).toBe(2);        // combined pool untouched
  });
});

describe('long rest', () => {
  function longRestedEntity(overrides: Partial<Entity> = {}): Entity {
    return baseEntity({
      identity: { ...makeEmptyEntity('e1').identity, level: 10 },
      resources: {
        ...makeEmptyEntity('e1').resources,
        hp: { current: 3, maximum: 40, temp: 5 },
        hitDice: { die: 8, total: 10, remaining: 2 },
        deathSaves: { successes: 1, failures: 1, stable: false },
        custom: [{ id: 'ki', name: 'Ki', current: 0, maximum: 4, recharge: 'short_rest' }],
      },
      ...overrides,
    });
  }

  it('restores HP to maximum and clears temp HP + death saves', () => {
    const result = takeRest(longRestedEntity(), 'long', DEFAULT_RULES);
    expect(result.resources.hp).toEqual({ current: 40, maximum: 40, temp: 0 });
    expect(result.resources.deathSaves).toEqual({ successes: 0, failures: 0, stable: false });
  });

  it('recharges all custom resources regardless of their recharge type', () => {
    const result = takeRest(longRestedEntity(), 'long', DEFAULT_RULES);
    expect(result.resources.custom[0].current).toBe(4);
  });

  it('restores half of total hit dice (rounded down), minimum 1, without exceeding the total', () => {
    // level 10 → floor(10/2) = 5 restored; remaining 2+5=7, capped at total 10
    const result = takeRest(longRestedEntity(), 'long', DEFAULT_RULES);
    expect(result.resources.hitDice.remaining).toBe(7);
  });

  it('never restores hit dice above the total pool', () => {
    const e = longRestedEntity({
      resources: { ...longRestedEntity().resources, hitDice: { die: 8, total: 10, remaining: 9 } },
    });
    const result = takeRest(e, 'long', DEFAULT_RULES);
    expect(result.resources.hitDice.remaining).toBe(10); // capped, not 14
  });

  it('restores the minimum of 1 hit die even at low level', () => {
    const e = longRestedEntity({
      identity: { ...makeEmptyEntity('e1').identity, level: 1 },
      resources: { ...longRestedEntity().resources, hitDice: { die: 8, total: 5, remaining: 0 } },
    });
    const result = takeRest(e, 'long', DEFAULT_RULES);
    expect(result.resources.hitDice.remaining).toBe(1);
  });

  it('restores the entire spent hit dice pool under the fullHitDiceOnLongRest house rule', () => {
    const rules: CampaignRules = { ...DEFAULT_RULES, customRules: { fullHitDiceOnLongRest: true } };
    const e = longRestedEntity({ resources: { ...longRestedEntity().resources, hitDice: { die: 8, total: 10, remaining: 0 } } });
    const result = takeRest(e, 'long', rules);
    expect(result.resources.hitDice.remaining).toBe(10);
  });

  it('restores all spell slots including pact slots', () => {
    const e = longRestedEntity({
      spellcasting: {
        ability: 'cha',
        slots:     emptySlots({ '1': { total: 3, used: 3 } }),
        pactSlots: emptySlots({ '1': { total: 2, used: 2 } }),
        cantrips: [], known: [], prepared: [], concentrating: null,
      },
    });
    const result = takeRest(e, 'long', DEFAULT_RULES);
    expect(result.spellcasting!.slots['1'].used).toBe(0);
    expect(result.spellcasting!.pactSlots!['1'].used).toBe(0);
  });

  it('drops concentration', () => {
    const e = longRestedEntity({
      spellcasting: {
        ability: 'wis', slots: emptySlots(), cantrips: [], known: [], prepared: [],
        concentrating: 'bless',
      },
    });
    const result = takeRest(e, 'long', DEFAULT_RULES);
    expect(result.spellcasting!.concentrating).toBeNull();
  });

  it('removes until_rest conditions but leaves others in place', () => {
    const e = longRestedEntity({
      conditions: [
        { id: 'blessed', sourceId: 'bless_spell', duration: { unit: 'until_rest', value: null } as any, suppressedBy: [] },
        { id: 'cursed', sourceId: 'curse_item', duration: { unit: 'permanent', value: null } as any, suppressedBy: [] },
      ],
      conditionMonitor: {
        active: [
          { id: 'blessed', sourceId: 'bless_spell', duration: { unit: 'until_rest', value: null } as any, suppressedBy: [] },
          { id: 'cursed', sourceId: 'curse_item', duration: { unit: 'permanent', value: null } as any, suppressedBy: [] },
        ],
        exhaustion: 0, flags: {},
      },
    });
    const result = takeRest(e, 'long', DEFAULT_RULES);
    expect(result.conditions.map(c => c.id)).toEqual(['cursed']);
    expect(result.conditionMonitor.active.map(c => c.id)).toEqual(['cursed']);
  });

  it('reduces exhaustion by 1, minimum 0', () => {
    const e = longRestedEntity({ conditionMonitor: { active: [], exhaustion: 2, flags: {} } });
    const result = takeRest(e, 'long', DEFAULT_RULES);
    expect(result.conditionMonitor.exhaustion).toBe(1);

    const atZero = longRestedEntity({ conditionMonitor: { active: [], exhaustion: 0, flags: {} } });
    expect(takeRest(atZero, 'long', DEFAULT_RULES).conditionMonitor.exhaustion).toBe(0);
  });
});

describe('spendHitDie', () => {
  const originalRandom = Math.random;
  afterEach(() => { Math.random = originalRandom; });

  it('heals by roll + CON modifier and decrements remaining hit dice', () => {
    Math.random = () => 0.5; // d8 → floor(0.5*8)+1 = 5
    const e = baseEntity({
      stats: { str: 10, dex: 10, con: 14, int: 10, wis: 10, cha: 10 }, // +2 CON mod
      resources: { ...makeEmptyEntity('e1').resources, hp: { current: 10, maximum: 30, temp: 0 }, hitDice: { die: 8, total: 3, remaining: 3 } },
    });
    const result = spendHitDie(e, DEFAULT_RULES);
    expect(result.resources.hp.current).toBe(10 + 5 + 2);
    expect(result.resources.hitDice.remaining).toBe(2);
  });

  it('heals a minimum of 1 even with a very negative CON modifier', () => {
    Math.random = () => 0; // d8 → 1
    const e = baseEntity({
      stats: { str: 10, dex: 10, con: 1, int: 10, wis: 10, cha: 10 }, // -5 CON mod
      resources: { ...makeEmptyEntity('e1').resources, hp: { current: 10, maximum: 30, temp: 0 }, hitDice: { die: 8, total: 3, remaining: 3 } },
    });
    const result = spendHitDie(e, DEFAULT_RULES);
    expect(result.resources.hp.current).toBe(11); // 10 + max(1, 1-5)
  });

  it('never heals above maximum HP', () => {
    Math.random = () => 0.99;
    const e = baseEntity({
      resources: { ...makeEmptyEntity('e1').resources, hp: { current: 28, maximum: 30, temp: 0 }, hitDice: { die: 8, total: 3, remaining: 3 } },
    });
    const result = spendHitDie(e, DEFAULT_RULES);
    expect(result.resources.hp.current).toBe(30);
  });

  it('is a no-op when no hit dice remain', () => {
    const e = baseEntity({ resources: { ...makeEmptyEntity('e1').resources, hitDice: { die: 8, total: 3, remaining: 0 } } });
    const result = spendHitDie(e, DEFAULT_RULES);
    expect(result).toBe(e);
  });
});

describe('discardHitDie', () => {
  it('decrements remaining hit dice without changing HP', () => {
    const e = baseEntity({
      resources: { ...makeEmptyEntity('e1').resources, hp: { current: 10, maximum: 30, temp: 0 }, hitDice: { die: 8, total: 3, remaining: 3 } },
    });
    const result = discardHitDie(e, DEFAULT_RULES);
    expect(result.resources.hitDice.remaining).toBe(2);
    expect(result.resources.hp.current).toBe(10);
  });

  it('is a no-op when no hit dice remain', () => {
    const e = baseEntity({ resources: { ...makeEmptyEntity('e1').resources, hitDice: { die: 8, total: 3, remaining: 0 } } });
    expect(discardHitDie(e, DEFAULT_RULES)).toBe(e);
  });
});

// ── Mixed hit-dice pools (multiclass bug fix) ───────────────────────────────
// A Fighter 3/Wizard 1 has 3 real d10s and 1 real d6 — `pools` is how that
// gets tracked instead of the old single {die,total,remaining} triple
// silently mislabeling everything as whichever class leveled most recently.

describe('spendHitDie / discardHitDie with a mixed pool', () => {
  const originalRandom = Math.random;
  afterEach(() => { Math.random = originalRandom; });

  function mixedPoolEntity() {
    return baseEntity({
      resources: {
        ...makeEmptyEntity('e1').resources,
        hp: { current: 10, maximum: 50, temp: 0 },
        hitDice: {
          die: 6, total: 4, remaining: 4,
          pools: [{ die: 10, total: 3, remaining: 3 }, { die: 6, total: 1, remaining: 1 }],
        },
      },
    });
  }

  // Rules-completeness batch (mixed hit-die pools), C2/C4: with 2+ genuinely
  // spendable die sizes, the engine must never silently pick one for the
  // player — see spendFromHitDicePools' own doc comment (rest.ts). This
  // replaces the old "always rolls the largest" expectation, which encoded
  // exactly the auto-pick behavior this batch removes.
  it('spendHitDie refuses (no-op) when 2+ pools are spendable and no dieSize is given', () => {
    Math.random = () => 0.99;
    const entity = mixedPoolEntity();
    const result = spendHitDie(entity, DEFAULT_RULES);
    expect(result).toBe(entity); // unchanged — never guesses which pool
  });

  it('spendHitDie spends EXACTLY the named pool when dieSize is given', () => {
    Math.random = () => 0.99; // near-max roll: d10→10, d6→6 — distinguishes which die was actually rolled
    const result = spendHitDie(mixedPoolEntity(), DEFAULT_RULES, 10);
    // +0 CON mod: healed amount equals the die rolled.
    expect(result.resources.hp.current).toBe(10 + 10);
    expect(result.resources.hitDice.pools).toEqual([
      { die: 10, total: 3, remaining: 2 }, // the d10 pool lost one...
      { die: 6, total: 1, remaining: 1 },  // ...the d6 pool untouched
    ]);
    expect(result.resources.hitDice.remaining).toBe(3); // sum stays correct
  });

  it('spendHitDie spends the OTHER named pool (d6) when that is what was chosen', () => {
    Math.random = () => 0.99;
    const result = spendHitDie(mixedPoolEntity(), DEFAULT_RULES, 6);
    expect(result.resources.hp.current).toBe(10 + 6);
    expect(result.resources.hitDice.pools).toEqual([
      { die: 10, total: 3, remaining: 3 }, // untouched
      { die: 6, total: 1, remaining: 0 },
    ]);
  });

  it('spendHitDie refuses (no-op) when dieSize names a size the character does not have', () => {
    const entity = mixedPoolEntity();
    const result = spendHitDie(entity, DEFAULT_RULES, 12);
    expect(result).toBe(entity);
  });

  it('spendHitDie refuses (no-op) when dieSize names a pool that is already exhausted', () => {
    const e = mixedPoolEntity();
    const drained = {
      ...e,
      resources: { ...e.resources, hitDice: { ...e.resources.hitDice, remaining: 1, pools: [{ die: 10, total: 3, remaining: 0 }, { die: 6, total: 1, remaining: 1 }] } },
    };
    const result = spendHitDie(drained, DEFAULT_RULES, 10);
    expect(result).toBe(drained);
  });

  it('spends from the d6 pool once every d10 is gone', () => {
    Math.random = () => 0.99;
    const e = mixedPoolEntity();
    const drained = {
      ...e,
      resources: {
        ...e.resources,
        hitDice: { ...e.resources.hitDice, remaining: 1, pools: [{ die: 10, total: 3, remaining: 0 }, { die: 6, total: 1, remaining: 1 }] },
      },
    };
    const result = spendHitDie(drained, DEFAULT_RULES);
    expect(result.resources.hp.current).toBe(10 + 6); // rolled the d6, not a phantom d10
    expect(result.resources.hitDice.pools).toEqual([
      { die: 10, total: 3, remaining: 0 },
      { die: 6, total: 1, remaining: 0 },
    ]);
  });

  it('discardHitDie refuses (no-op) when 2+ pools are spendable and no dieSize is given', () => {
    const entity = mixedPoolEntity();
    const result = discardHitDie(entity, DEFAULT_RULES);
    expect(result).toBe(entity);
  });

  it('discardHitDie decrements EXACTLY the named pool and keeps the sum correct', () => {
    const result = discardHitDie(mixedPoolEntity(), DEFAULT_RULES, 10);
    expect(result.resources.hitDice.pools).toEqual([
      { die: 10, total: 3, remaining: 2 },
      { die: 6, total: 1, remaining: 1 },
    ]);
    expect(result.resources.hitDice.remaining).toBe(3);
  });
});

// ── Table-first hit-die healing: manual table roll vs. app roll, one mutation ──

describe('currentHitDieSize', () => {
  it('returns the size of the largest available pool without spending it', () => {
    const e = baseEntity({
      resources: {
        ...makeEmptyEntity('e1').resources,
        hitDice: {
          die: 6, total: 4, remaining: 4,
          pools: [{ die: 10, total: 3, remaining: 3 }, { die: 6, total: 1, remaining: 1 }],
        },
      },
    });
    expect(currentHitDieSize(e)).toBe(10);
    expect(e.resources.hitDice.pools![0].remaining).toBe(3); // unspent — pure peek
  });

  it('falls back to the legacy single `die` field when there are no pools', () => {
    const e = baseEntity({
      resources: { ...makeEmptyEntity('e1').resources, hitDice: { die: 8, total: 3, remaining: 3 } },
    });
    expect(currentHitDieSize(e)).toBe(8);
  });

  it('falls back to the legacy `die` field even with none remaining (no pools to check availability against)', () => {
    const e = baseEntity({
      resources: { ...makeEmptyEntity('e1').resources, hitDice: { die: 8, total: 3, remaining: 0 } },
    });
    expect(currentHitDieSize(e)).toBe(8); // callers gate on `remaining > 0` separately, same as spendHitDie's own guard
  });

  it('with pools, skips an exhausted pool and returns the largest pool that still has dice remaining', () => {
    const e = baseEntity({
      resources: {
        ...makeEmptyEntity('e1').resources,
        hitDice: {
          die: 6, total: 4, remaining: 1,
          pools: [{ die: 10, total: 3, remaining: 0 }, { die: 6, total: 1, remaining: 1 }],
        },
      },
    });
    expect(currentHitDieSize(e)).toBe(6); // the exhausted d10 pool is skipped
  });
});

describe('spendHitDieManual', () => {
  it('heals using the table-supplied roll (not Math.random) plus CON modifier, and decrements remaining', () => {
    const e = baseEntity({
      stats: { str: 10, dex: 10, con: 14, int: 10, wis: 10, cha: 10 }, // +2 CON mod
      resources: { ...makeEmptyEntity('e1').resources, hp: { current: 10, maximum: 30, temp: 0 }, hitDice: { die: 8, total: 3, remaining: 3 } },
    });
    const result = spendHitDieManual(e, 6, DEFAULT_RULES);
    expect(result.resources.hp.current).toBe(10 + 6 + 2);
    expect(result.resources.hitDice.remaining).toBe(2);
  });

  it('never heals above maximum HP even on a high manual entry', () => {
    const e = baseEntity({
      resources: { ...makeEmptyEntity('e1').resources, hp: { current: 28, maximum: 30, temp: 0 }, hitDice: { die: 8, total: 3, remaining: 3 } },
    });
    const result = spendHitDieManual(e, 8, DEFAULT_RULES);
    expect(result.resources.hp.current).toBe(30);
  });

  it('is a no-op when no hit dice remain, same guard as spendHitDie', () => {
    const e = baseEntity({ resources: { ...makeEmptyEntity('e1').resources, hitDice: { die: 8, total: 3, remaining: 0 } } });
    const result = spendHitDieManual(e, 5, DEFAULT_RULES);
    expect(result).toBe(e);
  });

  it('refuses (no-op) for a mixed pool when 2+ pools are spendable and no dieSize is given', () => {
    const e = baseEntity({
      resources: {
        ...makeEmptyEntity('e1').resources,
        hp: { current: 10, maximum: 50, temp: 0 },
        hitDice: {
          die: 6, total: 4, remaining: 4,
          pools: [{ die: 10, total: 3, remaining: 3 }, { die: 6, total: 1, remaining: 1 }],
        },
      },
    });
    const result = spendHitDieManual(e, 7, DEFAULT_RULES);
    expect(result).toBe(e);
  });

  it('spends exactly one die from the NAMED pool for a mixed pool', () => {
    const e = baseEntity({
      resources: {
        ...makeEmptyEntity('e1').resources,
        hp: { current: 10, maximum: 50, temp: 0 },
        hitDice: {
          die: 6, total: 4, remaining: 4,
          pools: [{ die: 10, total: 3, remaining: 3 }, { die: 6, total: 1, remaining: 1 }],
        },
      },
    });
    const result = spendHitDieManual(e, 7, DEFAULT_RULES, 10);
    expect(result.resources.hp.current).toBe(10 + 7);
    expect(result.resources.hitDice.pools).toEqual([
      { die: 10, total: 3, remaining: 2 },
      { die: 6, total: 1, remaining: 1 },
    ]);
  });

  it('agrees with spendHitDie: same shared mutation for a given roll value', () => {
    const originalRandom = Math.random;
    Math.random = () => 0.5; // d8 → floor(0.5*8)+1 = 5
    const auto = spendHitDie(baseEntity({
      resources: { ...makeEmptyEntity('e1').resources, hp: { current: 10, maximum: 30, temp: 0 }, hitDice: { die: 8, total: 3, remaining: 3 } },
    }), DEFAULT_RULES);
    Math.random = originalRandom;
    const manual = spendHitDieManual(baseEntity({
      resources: { ...makeEmptyEntity('e1').resources, hp: { current: 10, maximum: 30, temp: 0 }, hitDice: { die: 8, total: 3, remaining: 3 } },
    }), 5, DEFAULT_RULES);
    expect(manual.resources.hp.current).toBe(auto.resources.hp.current);
    expect(manual.resources.hitDice.remaining).toBe(auto.resources.hitDice.remaining);
  });
});

describe('long rest hit-dice restore with a mixed pool', () => {
  function mixedDrainedEntity() {
    return baseEntity({
      resources: {
        ...makeEmptyEntity('e1').resources,
        hitDice: {
          die: 6, total: 4, remaining: 0,
          pools: [{ die: 10, total: 3, remaining: 0 }, { die: 6, total: 1, remaining: 0 }],
        },
      },
    });
  }

  // Rules-completeness batch (long-rest recovery), HIGH-fix closure: budget
  // (1) is smaller than the total expended across the two pools (4) — a
  // REAL choice exists, so the engine must never pick a pool automatically
  // (the old "acquisition order" behavior this test used to encode was
  // exactly the bug the Codex audit flagged). Superseded by the dedicated
  // "long-rest hit-die recovery allocation" describe block below, which
  // covers both the refusal-without-allocation and explicit-choice cases.

  it('never restores a pool past its own total even with the full-restore house rule', () => {
    const result = takeRest(mixedDrainedEntity(), 'long', { ...DEFAULT_RULES, customRules: { fullHitDiceOnLongRest: true } });
    expect(result.resources.hitDice.pools).toEqual([
      { die: 10, total: 3, remaining: 3 },
      { die: 6, total: 1, remaining: 1 },
    ]);
    expect(result.resources.hitDice.remaining).toBe(4);
  });
});

// ============================================================================
// HIGH-fix closure (Codex audit finding 2): mixed-pool long-rest recovery
// must let the PLAYER choose which expended dice recover when the recovery
// budget is smaller than the total expended across 2+ pools — never
// largest/smallest/acquisition order. See HitDiceRecoveryAllocation and
// hitDiceRecoveryNeedsAllocation's own doc comments (rest.ts).
// ============================================================================
describe('long-rest hit-die recovery allocation (HIGH-fix closure)', () => {
  // level 2 → budget = max(1, floor(2/2)) = 1
  function twoExpendedPoolsEntity(overrides: Partial<Entity> = {}) {
    return baseEntity({
      identity: { ...makeEmptyEntity('e1').identity, level: 2 },
      resources: {
        ...makeEmptyEntity('e1').resources,
        hitDice: {
          die: 6, total: 4, remaining: 0,
          pools: [{ die: 10, total: 2, remaining: 0 }, { die: 6, total: 2, remaining: 0 }],
        },
      },
      ...overrides,
    });
  }

  it('1. one expended pool → simple automatic legal recovery, no allocation required', () => {
    const e = baseEntity({
      identity: { ...makeEmptyEntity('e1').identity, level: 2 },
      resources: { ...makeEmptyEntity('e1').resources, hitDice: { die: 8, total: 3, remaining: 1 } },
    });
    expect(hitDiceRecoveryNeedsAllocation(e, DEFAULT_RULES)).toBe(false);
    const result = takeRest(e, 'long', DEFAULT_RULES);
    expect(result.resources.hitDice.remaining).toBe(2); // budget 1, restored automatically
  });

  it('2. two expended pools, budget smaller than total expended → explicit allocation required (refused without one)', () => {
    const e = twoExpendedPoolsEntity();
    expect(hitDiceRecoveryNeedsAllocation(e, DEFAULT_RULES)).toBe(true);
    expect(hitDiceRecoveryBudget(e, DEFAULT_RULES)).toBe(1);
    // takeRest always runs recomputeDerived on its result (even a refused
    // one), so object identity can't be asserted here — every REST
    // CONSEQUENCE (hit dice, HP, resources) must instead be byte-for-byte
    // unchanged, proving the refusal really is atomic and not just "hit
    // dice stayed put while everything else quietly rested."
    const result = takeRest(e, 'long', DEFAULT_RULES); // no allocation supplied
    expect(result.resources.hitDice).toEqual(e.resources.hitDice);
    expect(result.resources.hp).toEqual(e.resources.hp);
    expect(result.resources.custom).toEqual(e.resources.custom);
  });

  it('3. choose all recovery from d10 → only the d10 pool is restored', () => {
    const e = twoExpendedPoolsEntity();
    const allocation: HitDiceRecoveryAllocation = [{ dieSize: 10, recover: 1 }];
    const result = takeRest(e, 'long', DEFAULT_RULES, allocation);
    expect(result).not.toBe(e);
    expect(result.resources.hitDice.pools).toEqual([
      { die: 10, total: 2, remaining: 1 },
      { die: 6, total: 2, remaining: 0 },
    ]);
  });

  it('4. split between d10/d6 → exact counts restored', () => {
    // Budget 2 (level 4) split 1/1 across both pools.
    const e = twoExpendedPoolsEntity({ identity: { ...makeEmptyEntity('e1').identity, level: 4 } });
    const allocation: HitDiceRecoveryAllocation = [{ dieSize: 10, recover: 1 }, { dieSize: 6, recover: 1 }];
    const result = takeRest(e, 'long', DEFAULT_RULES, allocation);
    expect(result.resources.hitDice.pools).toEqual([
      { die: 10, total: 2, remaining: 1 },
      { die: 6, total: 2, remaining: 1 },
    ]);
  });

  it('5. choose all recovery from d6 → exact d6 recovery, d10 untouched', () => {
    const e = twoExpendedPoolsEntity();
    const allocation: HitDiceRecoveryAllocation = [{ dieSize: 6, recover: 1 }];
    const result = takeRest(e, 'long', DEFAULT_RULES, allocation);
    expect(result.resources.hitDice.pools).toEqual([
      { die: 10, total: 2, remaining: 0 },
      { die: 6, total: 2, remaining: 1 },
    ]);
  });

  it('6. an allocation requesting more than the legal budget is rejected — whole rest refused', () => {
    const e = twoExpendedPoolsEntity(); // budget 1
    const allocation: HitDiceRecoveryAllocation = [{ dieSize: 10, recover: 1 }, { dieSize: 6, recover: 1 }]; // totals 2 > budget 1
    const result = takeRest(e, 'long', DEFAULT_RULES, allocation);
    expect(result.resources.hitDice).toEqual(e.resources.hitDice);
  });

  it("7. an allocation requesting more than a pool's own expended count is rejected", () => {
    const e = twoExpendedPoolsEntity({ identity: { ...makeEmptyEntity('e1').identity, level: 20 } }); // huge budget, irrelevant
    const allocation: HitDiceRecoveryAllocation = [{ dieSize: 10, recover: 3 }]; // only 2 total, both expended — 3 exceeds the pool itself
    const result = takeRest(e, 'long', DEFAULT_RULES, allocation);
    expect(result.resources.hitDice).toEqual(e.resources.hitDice);
  });

  it('8. an allocation naming an invalid die size is rejected', () => {
    const e = twoExpendedPoolsEntity();
    const allocation: HitDiceRecoveryAllocation = [{ dieSize: 12, recover: 1 }]; // no d12 pool exists
    const result = takeRest(e, 'long', DEFAULT_RULES, allocation);
    expect(result.resources.hitDice).toEqual(e.resources.hitDice);
  });

  it('9. a budget that covers all expended dice needs no meaningful chooser and restores everything automatically', () => {
    const e = twoExpendedPoolsEntity({ identity: { ...makeEmptyEntity('e1').identity, level: 8 } }); // budget 4 == total expended
    expect(hitDiceRecoveryNeedsAllocation(e, DEFAULT_RULES)).toBe(false);
    const result = takeRest(e, 'long', DEFAULT_RULES); // no allocation — still succeeds
    expect(result.resources.hitDice.pools).toEqual([
      { die: 10, total: 2, remaining: 2 },
      { die: 6, total: 2, remaining: 2 },
    ]);
  });

  it('10. canceling (never calling takeRest) leaves no long-rest state mutation — nothing to assert beyond the refusal itself', () => {
    // The UI contract: canceling never invokes takeRest at all (see
    // RestPreviewModal.onConfirm's own doc comment) — modeled here as the
    // same "no allocation supplied" refusal already proven by test 2, since
    // from the engine's perspective a cancel and a missing allocation are
    // indistinguishable and both must be fully inert.
    const e = twoExpendedPoolsEntity();
    expect(takeRest(e, 'long', DEFAULT_RULES).resources.hitDice).toEqual(e.resources.hitDice);
  });

  it('11. repeated long rests never exceed pool totals even with a generous allocation', () => {
    let e = twoExpendedPoolsEntity({ identity: { ...makeEmptyEntity('e1').identity, level: 20 } }); // budget covers everything
    e = takeRest(e, 'long', DEFAULT_RULES); // fully restored, no allocation needed (budget >= expended)
    expect(e.resources.hitDice.remaining).toBe(4);
    // A second long rest with nothing expended is a legal no-op — never
    // exceeds each pool's own total.
    const again = takeRest(e, 'long', DEFAULT_RULES);
    expect(again.resources.hitDice.remaining).toBe(4);
    expect(again.resources.hitDice.pools).toEqual([
      { die: 10, total: 2, remaining: 2 },
      { die: 6, total: 2, remaining: 2 },
    ]);
  });

  it('12. chosen pool state survives being read back exactly as persisted (save/load proxy)', () => {
    const e = twoExpendedPoolsEntity();
    const allocation: HitDiceRecoveryAllocation = [{ dieSize: 6, recover: 1 }];
    const result = takeRest(e, 'long', DEFAULT_RULES, allocation);
    // Round-trip through JSON, the same serialization boundary save/load
    // crosses — proves nothing about the allocation choice is retained
    // anywhere except the resulting plain pool state.
    const reloaded: Entity = JSON.parse(JSON.stringify(result));
    expect(reloaded.resources.hitDice.pools).toEqual([
      { die: 10, total: 2, remaining: 0 },
      { die: 6, total: 2, remaining: 1 },
    ]);
  });

  it('expendedHitDicePools reports only pools with something actually spent', () => {
    const e = twoExpendedPoolsEntity();
    expect(expendedHitDicePools(e.resources.hitDice)).toEqual([
      { die: 10, total: 2, remaining: 0 },
      { die: 6, total: 2, remaining: 0 },
    ]);
    const fresh = baseEntity({ resources: { ...makeEmptyEntity('e1').resources, hitDice: { die: 8, total: 3, remaining: 3 } } });
    expect(expendedHitDicePools(fresh.resources.hitDice)).toEqual([]);
  });

  it('a duplicate die-size entry in the allocation is rejected as ambiguous', () => {
    const e = twoExpendedPoolsEntity();
    const allocation: HitDiceRecoveryAllocation = [{ dieSize: 10, recover: 0 }, { dieSize: 10, recover: 1 }];
    const result = takeRest(e, 'long', DEFAULT_RULES, allocation);
    expect(result.resources.hitDice).toEqual(e.resources.hitDice);
  });

  it('a negative recover count is rejected', () => {
    const e = twoExpendedPoolsEntity();
    const allocation: HitDiceRecoveryAllocation = [{ dieSize: 10, recover: -1 }];
    const result = takeRest(e, 'long', DEFAULT_RULES, allocation);
    expect(result.resources.hitDice).toEqual(e.resources.hitDice);
  });
});
