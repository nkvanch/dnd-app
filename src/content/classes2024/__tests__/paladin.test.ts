import { newChar, toLevel, bindSubclass } from '../testKit';
import { weaponMasteryCapacity, weaponMasteryRules } from '../../../engine/weaponMastery';

describe('Paladin (2024)', () => {
  const max = (e: any, id: string) => e.resources.custom.find((r: any) => r.id === id)?.maximum;

  it('casts from level 1 (2 first-level slots), with Lay On Hands = 5 x level and Weapon Mastery (2, any weapon)', () => {
    let e = newChar('paladin');
    expect(e.spellcasting!.slots['1'].total).toBe(2);
    expect(max(e, 'lay_on_hands')).toBe(5);
    expect(weaponMasteryCapacity(e)).toBe(2);
    expect(weaponMasteryRules(e)).toEqual(['any']);
    e = toLevel(e, 'paladin', 5);
    expect(max(e, 'lay_on_hands')).toBe(25);
    expect(e.derived.attackActionAttacks).toBe(2);
  });

  it('Paladin\'s Smite and Faithful Steed give free casts and always-prepared spells', () => {
    let e = toLevel(newChar('paladin'), 'paladin', 5);
    expect(max(e, 'paladins_smite')).toBe(1);
    expect(max(e, 'faithful_steed')).toBe(1);
    const known = JSON.stringify(e.entitlements ?? e.spellcasting);
    expect(known).toContain('divine_smite');
    expect(known).toContain('find_steed');
  });

  it('Channel Divinity is 2 uses, 3 at level 11; Aura of Protection adds Charisma to saves from level 6', () => {
    let e = newChar('paladin', { cha: 16, wis: 10 });
    e = toLevel(e, 'paladin', 3); expect(max(e, 'channel_divinity')).toBe(2);
    expect(e.derived.savingThrows.wis).toBe(e.derived.proficiencyBonus);          // proficient, Wis +0
    e = toLevel(e, 'paladin', 6);
    expect(e.derived.savingThrows.wis).toBe(e.derived.proficiencyBonus + 3);      // plus Cha +3 from the aura
    expect(e.derived.savingThrows.str).toBe(3);
    e = toLevel(e, 'paladin', 11); expect(max(e, 'channel_divinity')).toBe(3);
  });

  it('Oath of Devotion: oath spells are gated by Paladin level', () => {
    let e = bindSubclass(toLevel(newChar('paladin'), 'paladin', 3), 'paladin');
    expect(e.features.some(f => f.name === 'Sacred Weapon')).toBe(true);
    e = toLevel(e, 'paladin', 7);
    expect(e.features.some(f => f.name === 'Aura of Devotion')).toBe(true);
  });
});
