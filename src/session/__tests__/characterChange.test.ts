import { describeChange, describeChanges, validChanges } from '../roles';

describe('describeChange', () => {
  it('describes every kind, including the two newest (hp, temp_hp)', () => {
    expect(describeChange({ kind: 'exhaustion', delta: 1 })).toBe('Exhaustion +1');
    expect(describeChange({ kind: 'max_hp', delta: -3 })).toBe('Max HP -3');
    expect(describeChange({ kind: 'ability', ability: 'dex', delta: 2 })).toBe('DEX +2');
    expect(describeChange({ kind: 'hp', delta: -8 })).toBe('8 damage');
    expect(describeChange({ kind: 'hp', delta: 5 })).toBe('Heal 5');
    expect(describeChange({ kind: 'temp_hp', amount: 5 })).toBe('5 temp HP');
  });

  it('describeChanges joins several in one readable line', () => {
    expect(describeChanges([{ kind: 'hp', delta: -4 }, { kind: 'temp_hp', amount: 3 }])).toBe('4 damage, 3 temp HP');
  });
});

describe('validChanges', () => {
  it('accepts a well-formed hp change', () => {
    expect(validChanges([{ kind: 'hp', delta: -5 }])).toBe(true);
  });

  it('accepts a well-formed temp_hp change, including zero', () => {
    expect(validChanges([{ kind: 'temp_hp', amount: 5 }])).toBe(true);
    expect(validChanges([{ kind: 'temp_hp', amount: 0 }])).toBe(true);
  });

  it('rejects temp_hp with a negative amount', () => {
    expect(validChanges([{ kind: 'temp_hp', amount: -1 }])).toBe(false);
  });

  it('rejects an hp change with no delta, or a non-integer/non-finite one', () => {
    expect(validChanges([{ kind: 'hp' }])).toBe(false);
    expect(validChanges([{ kind: 'hp', delta: 1.5 }])).toBe(false);
    expect(validChanges([{ kind: 'hp', delta: Infinity }])).toBe(false);
  });

  it('accepts Heroic Inspiration, which carries nothing else, and describes it', () => {
    expect(validChanges([{ kind: 'heroic_inspiration' }])).toBe(true);
    expect(describeChange({ kind: 'heroic_inspiration' })).toBe('Heroic Inspiration');
  });

  it('rejects an unknown kind', () => {
    expect(validChanges([{ kind: 'bogus', delta: 1 }])).toBe(false);
  });

  it('rejects an empty list or more than 20 entries', () => {
    expect(validChanges([])).toBe(false);
    expect(validChanges(Array.from({ length: 21 }, () => ({ kind: 'hp', delta: 1 })))).toBe(false);
    expect(validChanges(Array.from({ length: 20 }, () => ({ kind: 'hp', delta: 1 })))).toBe(true);
  });
});
