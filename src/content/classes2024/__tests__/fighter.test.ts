import { newChar, toLevel, bindSubclass, sub } from '../testKit';
import { applyPoolChoiceToEntity } from '../../../engine/leveling';
import { DEFAULT_RULES } from '../../../store/characterStore';
import { weaponMasteryCapacity, weaponMasteryRules, setWeaponMasteryPicks, masteredWeaponIds, masteryPropertyFor } from '../../../engine/weaponMastery';
import { generateAllActionCards } from '../../../engine/actionCards';

describe('Fighter (2024)', () => {
  it('Second Wind: 2 uses, 3 at level 4, 4 at level 10; Action Surge 1 then 2 at 17; Indomitable 1/2/3 at 9/13/17', () => {
    let e = newChar('fighter');
    const max = (id: string) => e.resources.custom.find(r => r.id === id)?.maximum;
    expect(max('second_wind')).toBe(2);
    e = toLevel(e, 'fighter', 4); expect(max('second_wind')).toBe(3);
    e = toLevel(e, 'fighter', 9); expect([max('action_surge'), max('indomitable')]).toEqual([1, 1]);
    e = toLevel(e, 'fighter', 10); expect(max('second_wind')).toBe(4);
    e = toLevel(e, 'fighter', 13); expect(max('indomitable')).toBe(2);
    e = toLevel(e, 'fighter', 17); expect([max('action_surge'), max('indomitable')]).toEqual([2, 3]);
  });

  it('Extra Attack is 2 attacks at 5, 3 at 11, 4 at 20', () => {
    let e = newChar('fighter');
    expect(e.derived.attackActionAttacks).toBe(1);
    e = toLevel(e, 'fighter', 5); expect(e.derived.attackActionAttacks).toBe(2);
    e = toLevel(e, 'fighter', 11); expect(e.derived.attackActionAttacks).toBe(3);
    e = toLevel(e, 'fighter', 20); expect(e.derived.attackActionAttacks).toBe(4);
  });

  it('Weapon Mastery: 3 kinds of any Simple or Martial weapon, growing to 6; the mastery shows on the weapon\'s card', () => {
    let e = newChar('fighter');
    expect(weaponMasteryCapacity(e)).toBe(3);
    expect(weaponMasteryRules(e)).toEqual(['any']);
    e = setWeaponMasteryPicks(e, ['longbow', 'greataxe', 'shortsword', 'dagger']);
    expect(masteredWeaponIds(e)).toEqual(['longbow', 'greataxe', 'shortsword']);
    expect(masteryPropertyFor(e, 'greataxe')).toBe('cleave');
    expect(masteryPropertyFor(e, 'dagger')).toBeNull();
    e = toLevel(e, 'fighter', 16);
    expect(weaponMasteryCapacity(e)).toBe(6);
  });

  it('a mastered, equipped weapon\'s attack card names its mastery property', () => {
    const { FULL_ITEM_LIBRARY } = require('../../items/index');
    const { equipItem } = require('../../../engine/inventory');
    let e = newChar('fighter', { str: 16 });
    const axe = FULL_ITEM_LIBRARY.find((i: any) => i.id === 'greataxe');
    e = { ...e, inventory: { ...e.inventory, carried: [{ id: 'g1', itemId: 'greataxe', quantity: 1, attuned: false, features: [] }], equipped: [] } };
    e = equipItem(e, 'greataxe', axe, DEFAULT_RULES);
    e = setWeaponMasteryPicks(e, ['greataxe']);
    const card = generateAllActionCards(e, DEFAULT_RULES).find((c: any) => c.name === 'Greataxe');
    expect(card?.layer3).toBe('Mastery: Cleave');
  });

  it('Fighting Style is a real choice; Champion adds a second one at 7 and cannot pick the same style twice', () => {
    let e = newChar('fighter');
    const first = e.choices.find(c => c.definition.id === 'fighter_2024_fighting_style')!;
    e = applyPoolChoiceToEntity(e, first.id, ['fighting_style_defense'], DEFAULT_RULES);
    expect(e.features.some(f => f.name === 'Defense')).toBe(true);
    e = bindSubclass(toLevel(e, 'fighter', 3), 'fighter');
    e = toLevel(e, 'fighter', 7);
    const second = e.choices.find(c => !c.resolved && c.definition.id.includes('additional_fighting_style'))!;
    expect(second).toBeDefined();
    expect(sub('fighter').name).toBe('Champion');
  });

  it('Champion: advantage on initiative, Survivor at 18, and the subclass is the only SRD one', () => {
    let e = bindSubclass(toLevel(newChar('fighter'), 'fighter', 3), 'fighter');
    expect(e.derived.advantageStates.some(a => a.target === 'initiative' && a.state === 'advantage')).toBe(true);
    e = toLevel(e, 'fighter', 18);
    expect(e.features.some(f => f.name === 'Survivor')).toBe(true);
  });
});
