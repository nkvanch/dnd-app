import { WEAPON_MASTERY_TABLE, MASTERY_RULES, isEligibleForMastery } from '../../content/weaponMastery';
import { FULL_ITEM_LIBRARY } from '../../content/items/index';
import { newChar, toLevel } from '../../content/classes2024/testKit';
import { weaponMasteryCapacity, weaponMasteryRules, eligibleMasteryWeapons, setWeaponMasteryPicks, masteredWeaponIds, masteryPropertyFor } from '../weaponMastery';

describe('Weapon Mastery data (SRD 5.2.1)', () => {
  it('lists every weapon once with exactly one of the eight mastery properties', () => {
    const ids = WEAPON_MASTERY_TABLE.map(w => w.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(WEAPON_MASTERY_TABLE).toHaveLength(38);
    for (const w of WEAPON_MASTERY_TABLE) expect(Object.keys(MASTERY_RULES)).toContain(w.mastery);
    expect(Object.keys(MASTERY_RULES)).toHaveLength(8);
  });

  it('spot-checks known assignments', () => {
    const by = (id: string) => WEAPON_MASTERY_TABLE.find(w => w.id === id)!.mastery;
    expect([by('greataxe'), by('dagger'), by('longsword'), by('rapier'), by('war_pick'), by('glaive'), by('longbow')])
      .toEqual(['cleave', 'nick', 'sap', 'vex', 'sap', 'graze', 'slow']);
  });

  it('every weapon id matches a weapon in the item catalog (the Musket and Pistol included)', () => {
    const itemIds = new Set(FULL_ITEM_LIBRARY.map((i: any) => i.id));
    expect(WEAPON_MASTERY_TABLE.filter(w => !itemIds.has(w.id)).map(w => w.id)).toEqual([]);
  });

  it('class eligibility rules filter the table', () => {
    const greataxe = WEAPON_MASTERY_TABLE.find(w => w.id === 'greataxe')!;
    const longbow = WEAPON_MASTERY_TABLE.find(w => w.id === 'longbow')!;
    const shortbow = WEAPON_MASTERY_TABLE.find(w => w.id === 'shortbow')!;
    expect(isEligibleForMastery(greataxe, 'melee')).toBe(true);
    expect(isEligibleForMastery(longbow, 'melee')).toBe(false);
    expect(isEligibleForMastery(longbow, 'any')).toBe(true);
    expect(isEligibleForMastery(shortbow, 'finesse_or_light')).toBe(true);
    expect(isEligibleForMastery(longbow, 'finesse_or_light')).toBe(false);
    expect(isEligibleForMastery(greataxe, 'finesse_or_light')).toBe(false);
  });
});

describe('Weapon Mastery as a tracked property', () => {
  it('classes without the feature have no capacity; Barbarian is melee-only', () => {
    expect(weaponMasteryCapacity(newChar('wizard'))).toBe(0);
    const barb = newChar('barbarian');
    expect(weaponMasteryCapacity(barb)).toBe(2);
    expect(weaponMasteryRules(barb)).toEqual(['melee']);
    expect(eligibleMasteryWeapons(barb).some((w: any) => w.kind === 'ranged')).toBe(false);
  });

  it('picks are capped at capacity and dropped when ineligible', () => {
    let e = newChar('barbarian');
    e = setWeaponMasteryPicks(e, ['greataxe', 'longbow', 'handaxe', 'warhammer']);
    expect(masteredWeaponIds(e)).toEqual(['greataxe', 'handaxe']);   // the Longbow is ranged, the third is over capacity
    expect(masteryPropertyFor(e, 'greataxe')).toBe('cleave');
    expect(masteryPropertyFor(e, 'warhammer')).toBeNull();
  });

  it('capacity grows with level and surplus picks stay recorded', () => {
    let e = newChar('barbarian');
    e = setWeaponMasteryPicks(e, ['greataxe', 'handaxe']);
    e = toLevel(e, 'barbarian', 4);
    expect(weaponMasteryCapacity(e)).toBe(3);
    e = setWeaponMasteryPicks(e, ['greataxe', 'handaxe', 'warhammer']);
    expect(masteredWeaponIds(e)).toHaveLength(3);
  });
});
