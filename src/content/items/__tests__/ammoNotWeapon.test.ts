// "Case, crossbow bolt" and "Crossbow Bolts (20)" were listed as martial weapons in the starting-equipment picker because the name
// classifier matched "crossbow" inside them.
import { isWeapon, classifyWeaponByName } from '../itemBrowse';
import type { ItemIndexEntry } from '../../itemRepo.types';

const entry = (name: string, extra: Partial<ItemIndexEntry> = {}): ItemIndexEntry => ({ id: name, name, properties: [], hasDamageEffect: false, ...extra } as ItemIndexEntry);

describe('ammunition and containers are not weapons', () => {
  it.each(['Case, crossbow bolt', 'Case, Crossbow Bolt', 'Crossbow Bolts (20)', 'Quiver', 'Blowgun Needles (50)'])('%s', name => {
    expect(isWeapon(entry(name))).toBe(false);
    expect(classifyWeaponByName(entry(name))).toBeNull();
  });
  it.each(['Light Crossbow', 'Crossbow, hand', 'Longsword', 'Blowgun', 'Handaxe'])('%s is still a weapon', name => {
    expect(isWeapon(entry(name))).toBe(true);
  });
});
