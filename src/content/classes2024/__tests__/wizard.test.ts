import { newChar, toLevel, bindSubclass } from '../testKit';

describe('Wizard (2024)', () => {
  const max = (e: any, id: string) => e.resources.custom.find((r: any) => r.id === id)?.maximum;

  it('Intelligence full caster with a six-spell starting spellbook and two more spells every level', () => {
    let e = newChar('wizard');
    expect(e.spellcasting!.slots['1'].total).toBe(2);
    const book = (x: any) => x.choices.filter((c: any) => c.definition.id.includes('spellbook_')).reduce((n: number, c: any) => n + c.definition.count, 0);
    expect(book(e)).toBe(6);
    e = toLevel(e, 'wizard', 5);
    expect(book(e)).toBe(6 + 2 * 4);
  });

  it('Arcane Recovery is once per Long Rest; Scholar gives Expertise at 2', () => {
    const e = toLevel(newChar('wizard'), 'wizard', 2);
    expect(max(e, 'arcane_recovery')).toBe(1);
    expect(e.choices.some(c => c.definition.kind === 'expertise')).toBe(true);
  });

  it('Evoker: Evocation Savant picks at 3, and one more at each new slot level', () => {
    let e = bindSubclass(toLevel(newChar('wizard'), 'wizard', 3), 'wizard');
    expect(e.choices.some(c => c.definition.id.includes('evocation_savant_3'))).toBe(true);
    e = toLevel(e, 'wizard', 5);
    expect(e.choices.some(c => c.definition.id.includes('evocation_savant_5'))).toBe(true);
    expect(e.features.some(f => f.name === 'Potent Cantrip')).toBe(true);
  });
});
