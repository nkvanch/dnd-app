import { newChar, toLevel, bindSubclass } from '../testKit';
import { weaponMasteryCapacity } from '../../../engine/weaponMastery';

describe('Monk (2024)', () => {
  const max = (e: any, id: string) => e.resources.custom.find((r: any) => r.id === id)?.maximum;

  it('Unarmored Defense is 10 + Dex + Wis; the Martial Arts die is d6, d8 at 5, d10 at 11, d12 at 17', () => {
    let e = newChar('monk', { dex: 16, wis: 14 });
    expect(e.derived.ac).toBe(10 + 3 + 2);
    const unarmed = (x: any) => x.derived.attackBonuses.find((a: any) => a.id === 'unarmed_strike').damageDice;
    expect(unarmed(e)).toBe('1d6');
    e = toLevel(e, 'monk', 5); expect(unarmed(e)).toBe('1d8');
    e = toLevel(e, 'monk', 11); expect(unarmed(e)).toBe('1d10');
    e = toLevel(e, 'monk', 17); expect(unarmed(e)).toBe('1d12');
  });

  it('Focus Points equal the Monk level from level 2', () => {
    let e = newChar('monk');
    expect(max(e, 'focus_points')).toBeUndefined();
    e = toLevel(e, 'monk', 2); expect(max(e, 'focus_points')).toBe(2);
    e = toLevel(e, 'monk', 9); expect(max(e, 'focus_points')).toBe(9);
    e = toLevel(e, 'monk', 20); expect(max(e, 'focus_points')).toBe(20);
  });

  it('Unarmored Movement upgrades rather than stacks: +10 at 2, +15 at 6, +30 at 18', () => {
    let e = newChar('monk');
    const base = e.derived.speed;
    e = toLevel(e, 'monk', 2); expect(e.derived.speed).toBe(base + 10);
    e = toLevel(e, 'monk', 6); expect(e.derived.speed).toBe(base + 15);
    e = toLevel(e, 'monk', 18); expect(e.derived.speed).toBe(base + 30);
  });

  it('Extra Attack at 5; Disciplined Survivor gives every saving throw proficiency at 14; no Weapon Mastery', () => {
    let e = newChar('monk', { con: 10, int: 10 });
    expect(weaponMasteryCapacity(e)).toBe(0);
    e = toLevel(e, 'monk', 5); expect(e.derived.attackActionAttacks).toBe(2);
    expect(e.derived.savingThrows.int).toBe(0);
    e = toLevel(e, 'monk', 14);
    expect(e.derived.savingThrows.int).toBe(e.derived.proficiencyBonus);   // Int 10 (+0) plus proficiency
    expect(e.derived.savingThrows.con).toBe(e.derived.proficiencyBonus);
  });

  it('Warrior of the Open Hand: Wholeness of Body uses equal the Wisdom modifier from level 6', () => {
    let e = bindSubclass(toLevel(newChar('monk', { wis: 16 }), 'monk', 3), 'monk');
    expect(e.features.some(f => f.name === 'Open Hand Technique')).toBe(true);
    e = toLevel(e, 'monk', 6);
    expect(max(e, 'wholeness_of_body')).toBe(3);
  });

  it('Body and Mind at 20 raises Dexterity and Wisdom by 4', () => {
    let e = newChar('monk', { dex: 14, wis: 14 });
    e = toLevel(e, 'monk', 20);
    expect(e.derived.savingThrows.dex).toBe(4 + 6);   // Dex 14 -> 18 (+4), proficient, +6 at level 20
  });
});
