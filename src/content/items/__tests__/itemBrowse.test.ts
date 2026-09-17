// src/content/items/__tests__/itemBrowse.test.ts
import {
  isMagic, isWeapon, isRangedWeapon, isMartialWeapon, armorWeight,
  itemCategory, rarityOf, rarityRank,
  costInCopper, itemSourceLabel, itemSortOptions, itemMatchesConstraint,
} from '../itemBrowse';
import { sortByOption } from '../../contentQuery';
import { toItemIndexEntry } from '../../itemRepo.types';
import type { ItemIndexEntry } from '../../itemRepo.types';
import type { Item } from '../../../engine/types';

function mk(over: Partial<ItemIndexEntry>): ItemIndexEntry {
  return {
    id: 'x', name: 'X', weight: 1, cost: '1 gp', properties: [],
    hasDamageEffect: false, weaponRange: null,
    ...over,
  };
}

describe('independent item classification axes', () => {
  it('classifies a mundane martial melee weapon (Longsword) correctly on every axis independently', () => {
    const longsword = mk({ name: 'Longsword', properties: ['versatile'] });
    expect(isMagic(longsword)).toBe(false);
    expect(isWeapon(longsword)).toBe(true);
    expect(isRangedWeapon(longsword)).toBe(false);
    expect(isMartialWeapon(longsword)).toBe(true);
    expect(itemCategory(longsword)).toBe('weapon');
  });

  it('classifies a magic ranged simple weapon (a +1 Sling) with Magical and Category as independent fields, not a combined label', () => {
    const sling = mk({ name: '+1 Sling', properties: ['magic weapon', 'ammunition'] });
    expect(isMagic(sling)).toBe(true);
    expect(itemCategory(sling)).toBe('weapon');
    expect(isRangedWeapon(sling)).toBe(true);
    expect(isMartialWeapon(sling)).toBe(false);
  });

  it('classifies armor weight independently of the Magical axis', () => {
    const plate = mk({ name: 'Plate Armor', properties: ['heavy armor'] });
    const magicPlate = mk({ name: 'Adamantine Plate Armor', properties: ['heavy armor', 'magic item'] });
    expect(armorWeight(plate)).toBe('heavy');
    expect(itemCategory(plate)).toBe('armor');
    expect(isMagic(plate)).toBe(false);
    expect(armorWeight(magicPlate)).toBe('heavy');
    expect(isMagic(magicPlate)).toBe(true);
  });

  it('classifies shields, ammunition, tools, and foci into their own independent categories', () => {
    expect(itemCategory(mk({ name: 'Shield', properties: ['shield'] }))).toBe('shield');
    expect(itemCategory(mk({ name: 'Arrows', properties: ['ammunition'] }))).toBe('ammunition');
    expect(itemCategory(mk({ name: "Thieves' Tools", properties: ['tool'] }))).toBe('tool');
    expect(itemCategory(mk({ name: 'Wand of Magic Missiles', properties: ['magic item'] }))).toBe('focus');
    expect(itemCategory(mk({ name: 'Bedroll', properties: [] }))).toBe('gear');
  });
});

describe('rarityOf / rarityRank', () => {
  it('reads rarity from a matching property, case-insensitively', () => {
    expect(rarityOf(mk({ properties: ['Rare', 'requires attunement'] }))).toBe('rare');
    expect(rarityRank(mk({ properties: ['Legendary'] }))).toBe(5);
  });
  it('reports no rarity (null / rank 0) for a mundane item', () => {
    expect(rarityOf(mk({ properties: ['versatile'] }))).toBeNull();
    expect(rarityRank(mk({ properties: [] }))).toBe(0);
  });
});

describe('costInCopper', () => {
  it('parses each coin denomination correctly', () => {
    expect(costInCopper('1 pp')).toBe(1000);
    expect(costInCopper('1 gp')).toBe(100);
    expect(costInCopper('1 ep')).toBe(50);
    expect(costInCopper('1 sp')).toBe(10);
    expect(costInCopper('1 cp')).toBe(1);
  });
  it('sorts unknown/"—" cost last (−1), not first', () => {
    expect(costInCopper('—')).toBe(-1);
    expect(costInCopper('')).toBe(-1);
  });
});

describe('itemSourceLabel', () => {
  it('resolves SRD official content to "SRD 5.1", homebrew to "Local Homebrew"', () => {
    expect(itemSourceLabel(mk({ srd: true }), false)).toBe('SRD 5.1');
    expect(itemSourceLabel(mk({}), true)).toBe('Local Homebrew');
  });
});

describe('itemSortOptions', () => {
  const options = itemSortOptions(() => false);

  it('offers exactly A-Z / Z-A / Rarity / Value / Weight / Source, in that order', () => {
    expect(options.map(o => o.id)).toEqual(['name_asc', 'name_desc', 'rarity', 'value', 'weight', 'source']);
  });

  it('Rarity sorts highest tier first, then alphabetically within a tier', () => {
    const legendary = mk({ id: 'l', name: 'Zzz Legendary', properties: ['legendary'] });
    const common    = mk({ id: 'c', name: 'Aaa Common', properties: ['common'] });
    expect(sortByOption([common, legendary], options, 'rarity').map(i => i.id)).toEqual(['l', 'c']);
  });

  it('Value sorts highest cost first, unknown cost sinking to the bottom', () => {
    const cheap    = mk({ id: 'cheap', name: 'Cheap', cost: '1 sp' });
    const pricey   = mk({ id: 'pricey', name: 'Pricey', cost: '500 gp' });
    const unknown  = mk({ id: 'unknown', name: 'Unknown', cost: '—' });
    expect(sortByOption([cheap, unknown, pricey], options, 'value').map(i => i.id)).toEqual(['pricey', 'cheap', 'unknown']);
  });

  it('Weight sorts lightest first', () => {
    const heavy = mk({ id: 'heavy', name: 'Heavy', weight: 50 });
    const light = mk({ id: 'light', name: 'Light', weight: 1 });
    expect(sortByOption([heavy, light], options, 'weight').map(i => i.id)).toEqual(['light', 'heavy']);
  });
});

// STARTING-EQUIPMENT-2: homebrew weapons have no BASE_WEAPONS name match,
// so isRangedWeapon needs an explicit property override (symmetric with
// isMartialWeapon's existing 'martial'/'simple' override) for the item
// builder's new Weapon Range chip to actually take effect.
describe('isRangedWeapon explicit property override', () => {
  it('recognizes an explicit "ranged" property on a name it cannot classify', () => {
    expect(isRangedWeapon(mk({ name: 'Sunfire Piercer', properties: ['ranged'] }))).toBe(true);
  });
  it('recognizes an explicit "melee" property on a name it cannot classify', () => {
    expect(isRangedWeapon(mk({ name: 'Sunfire Edge', properties: ['melee'] }))).toBe(false);
  });
  it('still falls back to the ammunition/thrown heuristic when neither override is set', () => {
    expect(isRangedWeapon(mk({ name: 'Starfall Chakram', properties: ['thrown'] }))).toBe(true);
  });
  it('official content matched by name is unaffected by the new override path', () => {
    expect(isRangedWeapon(mk({ name: 'Longsword', properties: ['versatile'] }))).toBe(false);
    expect(isRangedWeapon(mk({ name: 'Shortbow', properties: [] }))).toBe(true);
  });
});

// STARTING-EQUIPMENT-2: proves the constrained-required-equipment Homebrew
// Item flow's eligibility check — item-builder.tsx calls exactly these two
// functions (toItemIndexEntry + itemMatchesConstraint) at save time, never
// a parallel check, so testing them directly against a freshly-built
// homebrew Item IS the authoritative test for that flow.
describe('itemMatchesConstraint against a freshly-built homebrew Item', () => {
  // Mirrors item-builder.tsx's buildFeature(): a weapon item gets a
  // feature carrying a 'damage' abilityEffect (weaponDamage defaults to
  // 1d8 slashing) — that's what makes toItemIndexEntry set
  // hasDamageEffect:true, which itemCategory()/isWeapon() need to
  // classify it as 'weapon' at all. A homebrew item with no such feature
  // (armor, gear, etc.) omits it.
  function mkHomebrewItem(overrides: Partial<Item>, isWeaponItem = false): Item {
    return {
      id: 'hb_test', name: 'Test Item', weight: 0, cost: '—', properties: [],
      features: isWeaponItem ? [{
        id: 'hb_test_feat', name: 'Test Item', description: '', source: { kind: 'item', refId: 'hb_test' },
        level: null, effects: [], actions: [], choices: [], passive: true,
        abilityEffects: [{ type: 'damage', dice: '1d8', damageType: 'slashing' }],
      }] : [],
      ...overrides,
    };
  }

  it('valid: category=Weapon, weaponClass=Martial, weaponRange=Melee satisfies "Martial Melee Weapon"', () => {
    const entry = toItemIndexEntry(mkHomebrewItem({ name: 'Zephyrion Edge', properties: ['martial', 'melee'] }, true));
    expect(itemMatchesConstraint(entry, { category: 'weapon', weaponClass: 'martial', weaponRange: 'melee' })).toBe(true);
  });

  it('invalid: category=Armor does not satisfy "Martial Melee Weapon"', () => {
    const entry = toItemIndexEntry(mkHomebrewItem({ name: 'Zephyrion Guard', properties: ['heavy armor'] }));
    expect(itemMatchesConstraint(entry, { category: 'weapon', weaponClass: 'martial', weaponRange: 'melee' })).toBe(false);
  });

  it('invalid: an explicitly Simple weapon does not satisfy a Martial constraint', () => {
    const entry = toItemIndexEntry(mkHomebrewItem({ name: 'Zephyrion Point', properties: ['simple', 'melee'] }, true));
    expect(itemMatchesConstraint(entry, { category: 'weapon', weaponClass: 'martial' })).toBe(false);
  });

  it('valid: a Simple Ranged weapon satisfies a "Simple Ranged Weapon" constraint', () => {
    const entry = toItemIndexEntry(mkHomebrewItem({ name: 'Zephyrion Caster', properties: ['simple', 'ranged'] }, true));
    expect(itemMatchesConstraint(entry, { category: 'weapon', weaponClass: 'simple', weaponRange: 'ranged' })).toBe(true);
  });
});
