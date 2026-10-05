import { newChar, toLevel, bindSubclass } from '../testKit';

describe('Sorcerer (2024)', () => {
  const max = (e: any, id: string) => e.resources.custom.find((r: any) => r.id === id)?.maximum;

  it('Charisma full caster: 2 slots at 1; Innate Sorcery x2; Sorcery Points = level from 2', () => {
    let e = newChar('sorcerer');
    expect(e.spellcasting!.slots['1'].total).toBe(2);
    expect(max(e, 'innate_sorcery')).toBe(2);
    expect(max(e, 'sorcery_points')).toBeUndefined();
    e = toLevel(e, 'sorcerer', 2); expect(max(e, 'sorcery_points')).toBe(2);
    e = toLevel(e, 'sorcerer', 11); expect(max(e, 'sorcery_points')).toBe(11);
  });

  it('Metamagic: two options at 2, two more at 10 and at 17', () => {
    let e = toLevel(newChar('sorcerer'), 'sorcerer', 2);
    const first = e.choices.find(c => c.definition.id.includes('metamagic_2'))!;
    expect(first.definition.count).toBe(2);
    e = toLevel(e, 'sorcerer', 17);
    expect(e.choices.some(c => c.definition.id.includes('metamagic_10'))).toBe(true);
    expect(e.choices.some(c => c.definition.id.includes('metamagic_17'))).toBe(true);
  });

  it('Draconic Sorcery: AC is 10 + Dex + Cha, HP grows with level, and Elemental Affinity is a choice at 6', () => {
    let e = newChar('sorcerer', { dex: 14, cha: 16 });
    const hp0 = e.resources.hp.maximum;
    e = bindSubclass(toLevel(e, 'sorcerer', 3), 'sorcerer');
    expect(e.derived.ac).toBe(10 + 2 + 3);
    e = toLevel(e, 'sorcerer', 6);
    expect(e.choices.some(c => c.definition.id.includes('elemental_affinity'))).toBe(true);
    expect(e.resources.hp.maximum).toBeGreaterThan(hp0);
  });
});
