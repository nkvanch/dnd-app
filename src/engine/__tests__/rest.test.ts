// src/engine/__tests__/rest.test.ts
// Short/long rest recovery — the pact-slot-vs-combined-slot split here was
// added during multiclassing and is easy to get backwards (recharging the
// wrong pool, or recharging both when only one should refresh), so it gets
// dedicated coverage rather than relying on manual device testing.
import { makeEmptyEntity, DEFAULT_RULES } from '../../store/characterStore';
import { takeRest, spendHitDie, discardHitDie } from '../rest';
import { Entity, SpellSlots, CampaignRules } from '../types';

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
  it('recharges resources tagged short_rest or long_rest', () => {
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
    expect(result.resources.custom.find(r => r.id === 'channel_divinity')!.current).toBe(1);
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
          { classId: 'warlock', subclassId: null, level: 2 },
          { classId: 'wizard', subclassId: null, level: 2 },
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
