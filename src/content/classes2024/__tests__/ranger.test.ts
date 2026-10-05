import { newChar, toLevel, bindSubclass } from '../testKit';
import { weaponMasteryCapacity } from '../../../engine/weaponMastery';

describe('Ranger (2024)', () => {
  const max = (e: any, id: string) => e.resources.custom.find((r: any) => r.id === id)?.maximum;

  it('casts from level 1; Favored Enemy is free Hunter\'s Mark 2/3/4/5/6 times; Weapon Mastery 2 kinds', () => {
    let e = newChar('ranger');
    expect(e.spellcasting!.slots['1'].total).toBe(2);
    expect(max(e, 'favored_enemy')).toBe(2);
    expect(weaponMasteryCapacity(e)).toBe(2);
    e = toLevel(e, 'ranger', 5); expect(max(e, 'favored_enemy')).toBe(3);
    e = toLevel(e, 'ranger', 9); expect(max(e, 'favored_enemy')).toBe(4);
    e = toLevel(e, 'ranger', 13); expect(max(e, 'favored_enemy')).toBe(5);
    e = toLevel(e, 'ranger', 17); expect(max(e, 'favored_enemy')).toBe(6);
  });

  it('Roving adds 10 feet at level 6; Extra Attack at 5; Feral Senses gives Blindsight 30 at 18', () => {
    let e = newChar('ranger');
    const base = e.derived.speed;
    e = toLevel(e, 'ranger', 6);
    expect(e.derived.speed).toBe(base + 10);
    expect(e.derived.attackActionAttacks).toBe(2);
    e = toLevel(e, 'ranger', 18);
    expect(e.derived.senses.some((s: any) => s.type === 'blindsight' && s.range === 30)).toBe(true);
  });

  it('Hunter: Hunter\'s Prey and Defensive Tactics are real choices', () => {
    let e = bindSubclass(toLevel(newChar('ranger'), 'ranger', 3), 'ranger');
    expect(e.choices.some(c => c.definition.id.includes('hunters_prey'))).toBe(true);
    e = toLevel(e, 'ranger', 7);
    expect(e.choices.some(c => c.definition.id.includes('defensive_tactics'))).toBe(true);
  });
});
