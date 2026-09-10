// src/engine/__tests__/dice.test.ts
// Dice expression parser/roller. setRandomSource lets every test be fully
// deterministic instead of asserting only on ranges — a real regression here
// (e.g. off-by-one on die sides, keep-highest/lowest picking the wrong end)
// would otherwise only ever show up as an occasionally-wrong character sheet.
import {
  rollDie, rollExpression, setRandomSource, rollAbilityScore, rollAbilityScoreSet,
  rollD20, rollWithAdvantage, rollWithDisadvantage, averageRoll, manualRoll, doubleDiceCount,
} from '../dice';

afterEach(() => {
  setRandomSource(Math.random);
});

describe('rollDie', () => {
  it('maps random() = 0 to the minimum face (1)', () => {
    setRandomSource(() => 0);
    expect(rollDie(20)).toBe(1);
  });

  it('maps random() just under 1 to the maximum face', () => {
    setRandomSource(() => 0.9999999);
    expect(rollDie(20)).toBe(20);
  });

  it('maps random() = 0.5 to the middle of the range', () => {
    setRandomSource(() => 0.5);
    expect(rollDie(6)).toBe(4); // floor(0.5*6)+1 = 4
  });
});

describe('rollExpression — standard NdM(+/-X)', () => {
  it('sums N dice at a fixed face value with no modifier', () => {
    setRandomSource(() => 0.5); // always rolls a 4 on a d6 (floor(0.5*6)+1)
    const r = rollExpression('2d6');
    expect(r.rolls).toEqual([4, 4]);
    expect(r.modifier).toBe(0);
    expect(r.total).toBe(8);
  });

  it('adds a positive flat modifier', () => {
    setRandomSource(() => 0); // always rolls 1
    const r = rollExpression('2d6+3');
    expect(r.total).toBe(2 + 3);
    expect(r.modifier).toBe(3);
  });

  it('applies a negative flat modifier', () => {
    setRandomSource(() => 0); // always rolls 1
    const r = rollExpression('1d20-2');
    expect(r.total).toBe(1 - 2);
    expect(r.modifier).toBe(-2);
  });

  it('is case-insensitive and ignores whitespace', () => {
    setRandomSource(() => 0);
    const r = rollExpression(' 1D20 + 2 ');
    expect(r.total).toBe(3);
  });

  it('carries the label through and stamps a timestamp/id', () => {
    const r = rollExpression('1d20', 'Attack roll');
    expect(r.label).toBe('Attack roll');
    expect(r.expression).toBe('1d20');
    expect(typeof r.id).toBe('string');
    expect(r.id.length).toBeGreaterThan(0);
    expect(typeof r.timestamp).toBe('number');
  });
});

describe('rollExpression — keep highest/lowest (4d6kh3 style)', () => {
  it('keeps the N highest rolls when using kh', () => {
    let calls = 0;
    const sequence = [0.0, 0.99, 0.5, 0.25]; // → dice values on a d6: 1, 6, 4, 2
    setRandomSource(() => sequence[calls++]);
    const r = rollExpression('4d6kh3');
    expect(r.rolls.sort((a, b) => a - b)).toEqual([2, 4, 6]); // drops the 1
    expect(r.total).toBe(2 + 4 + 6);
  });

  it('keeps the N lowest rolls when using kl', () => {
    let calls = 0;
    const sequence = [0.0, 0.99, 0.5, 0.25]; // → dice values on a d6: 1, 6, 4, 2
    setRandomSource(() => sequence[calls++]);
    const r = rollExpression('4d6kl3');
    expect(r.rolls.sort((a, b) => a - b)).toEqual([1, 2, 4]); // drops the 6
    expect(r.total).toBe(1 + 2 + 4);
  });

  it('applies a flat modifier after keeping', () => {
    setRandomSource(() => 0); // every die is a 1
    const r = rollExpression('4d6kh3+1');
    expect(r.total).toBe(1 + 1 + 1 + 1); // 3 kept 1s + modifier 1
  });
});

describe('rollExpression — flat numbers', () => {
  it('parses a bare number with no dice at all', () => {
    const r = rollExpression('8');
    expect(r.rolls).toEqual([8]);
    expect(r.total).toBe(8);
  });
});

describe('rollExpression — invalid input', () => {
  it('throws a descriptive error for unparseable expressions', () => {
    expect(() => rollExpression('not a dice expression')).toThrow(/Cannot parse dice expression/);
  });
});

describe('rollAbilityScore / rollAbilityScoreSet', () => {
  it('rollAbilityScore is a 4d6kh3 roll with the "Ability score" label', () => {
    const r = rollAbilityScore();
    expect(r.rolls.length).toBe(3);
    expect(r.label).toBe('Ability score');
    expect(r.total).toBeGreaterThanOrEqual(3);
    expect(r.total).toBeLessThanOrEqual(18);
  });

  it('rollAbilityScoreSet returns exactly 6 totals', () => {
    const set = rollAbilityScoreSet();
    expect(set.length).toBe(6);
    for (const total of set) {
      expect(total).toBeGreaterThanOrEqual(3);
      expect(total).toBeLessThanOrEqual(18);
    }
  });
});

describe('rollD20', () => {
  it('rolls a plain d20 with no modifier text when modifier is 0', () => {
    setRandomSource(() => 0);
    const r = rollD20();
    expect(r.total).toBe(1);
  });

  it('adds a positive modifier', () => {
    setRandomSource(() => 0);
    const r = rollD20(5);
    expect(r.total).toBe(6);
  });

  it('adds a negative modifier', () => {
    setRandomSource(() => 0);
    const r = rollD20(-3);
    expect(r.total).toBe(1 - 3);
  });
});

describe('rollWithAdvantage / rollWithDisadvantage', () => {
  it('advantage picks the higher of two d20 rolls', () => {
    let calls = 0;
    const sequence = [0.1, 0.9]; // low roll then high roll
    setRandomSource(() => sequence[calls++]);
    const r = rollWithAdvantage();
    expect(r.total).toBe(Math.floor(0.9 * 20) + 1);
  });

  it('disadvantage picks the lower of two d20 rolls', () => {
    let calls = 0;
    const sequence = [0.1, 0.9]; // low roll then high roll
    setRandomSource(() => sequence[calls++]);
    const r = rollWithDisadvantage();
    expect(r.total).toBe(Math.floor(0.1 * 20) + 1);
  });

  it('applies the modifier to both rolls before picking a winner', () => {
    let calls = 0;
    const sequence = [0.1, 0.9];
    setRandomSource(() => sequence[calls++]);
    const r = rollWithAdvantage(4);
    expect(r.total).toBe(Math.floor(0.9 * 20) + 1 + 4);
  });
});

describe('manualRoll', () => {
  it('splits out a positive trailing modifier from the expression', () => {
    const r = manualRoll('2d6+3', 13);
    expect(r.modifier).toBe(3);
    expect(r.rolls).toEqual([10]);
    expect(r.total).toBe(13);
  });

  it('splits out a negative trailing modifier from the expression', () => {
    const r = manualRoll('1d20-2', 5);
    expect(r.modifier).toBe(-2);
    expect(r.rolls).toEqual([7]);
    expect(r.total).toBe(5);
  });

  it('treats an expression with no trailing modifier as modifier 0', () => {
    const r = manualRoll('1d20', 15);
    expect(r.modifier).toBe(0);
    expect(r.rolls).toEqual([15]);
    expect(r.total).toBe(15);
  });

  it('recovers the modifier from a keep-highest expression the same way', () => {
    const r = manualRoll('4d6kh3+1', 14);
    expect(r.modifier).toBe(1);
    expect(r.rolls).toEqual([13]);
    expect(r.total).toBe(14);
  });

  it('carries the label through and stamps a timestamp/id, expression preserved verbatim', () => {
    const r = manualRoll('2d6+3', 13, 'Attack roll');
    expect(r.label).toBe('Attack roll');
    expect(r.expression).toBe('2d6+3');
    expect(typeof r.id).toBe('string');
    expect(r.id.length).toBeGreaterThan(0);
    expect(typeof r.timestamp).toBe('number');
  });

  it('defaults label to null when omitted', () => {
    const r = manualRoll('1d20', 10);
    expect(r.label).toBeNull();
  });
});

describe('averageRoll', () => {
  it('computes the standard fixed-HP average for NdM+X', () => {
    expect(averageRoll('1d8')).toBe(4.5);
    expect(averageRoll('2d6+3')).toBe(3.5 * 2 + 3);
    expect(averageRoll('1d10-1')).toBe(5.5 - 1);
  });

  it('returns the flat number unchanged when there are no dice', () => {
    expect(averageRoll('8')).toBe(8);
  });

  it('throws for an unparseable expression', () => {
    expect(() => averageRoll('nonsense')).toThrow(/Cannot compute average/);
  });
});

// Item 11 (roll improvements) — critical-hit damage doubling. Per the real
// 5e rule, a crit doubles the DICE, not the total/flat modifier.
describe('doubleDiceCount', () => {
  it('doubles the dice count on a standard NdX+M expression, leaving the modifier untouched', () => {
    expect(doubleDiceCount('2d6+4')).toBe('4d6+4');
  });

  it('doubles a single die with no modifier', () => {
    expect(doubleDiceCount('1d8')).toBe('2d8');
  });

  it('handles a negative modifier', () => {
    expect(doubleDiceCount('1d10-1')).toBe('2d10-1');
  });

  it('doubles the dice count on a keep-highest/lowest expression, leaving the keep count and modifier untouched', () => {
    expect(doubleDiceCount('2d6kh1+3')).toBe('4d6kh1+3');
  });

  it('returns a flat number (no dice) unchanged', () => {
    expect(doubleDiceCount('8')).toBe('8');
  });

  it('returns an unparseable expression unchanged rather than throwing', () => {
    expect(doubleDiceCount('nonsense')).toBe('nonsense');
  });

  it('is case-insensitive and strips whitespace, matching rollExpression\'s own parsing', () => {
    expect(doubleDiceCount('2D6 + 4')).toBe('4d6+4');
  });
});
