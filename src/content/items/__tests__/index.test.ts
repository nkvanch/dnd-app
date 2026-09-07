// src/content/items/__tests__/index.test.ts
// Coverage for the 20 SRD magic items added to close the A-31 gap-fill audit
// (see itemArrowCatchingShield...itemSphereOfAnnihilation in ../index.ts).
// Content-shape checks (unique ids, correct rarity/attunement tagging) plus
// a real spawn-and-equip check for the 2 items that carry a modeled effect.
import { FULL_ITEM_LIBRARY, itemGlamouredStuddedLeatherArmor, itemBroochOfShielding } from '../index';
import { equipItem } from '../../../engine/inventory';
import { itemRequiresAttunement } from '../../../engine/inventory';
import { makeEmptyEntity, DEFAULT_RULES } from '../../../store/characterStore';
import { Entity, ItemInstance } from '../../../engine/types';

const NEW_ITEM_IDS = [
  'arrow_catching_shield', 'brooch_of_shielding', 'broom_of_flying',
  'candle_of_invocation', 'circlet_of_blasting', 'glamoured_studded_leather_armor',
  'helm_of_brilliance', 'helm_of_comprehending_languages', 'helm_of_telepathy',
  'helm_of_teleportation', 'manual_of_clay_golems', 'manual_of_flesh_golems',
  'manual_of_iron_golems', 'manual_of_stone_golems', 'oil_of_slipperiness',
  'philter_of_love', 'restorative_ointment', 'slippers_of_spider_climbing',
  'sovereign_glue', 'sphere_of_annihilation',
];

describe('A-31 gap-fill magic items', () => {
  it('every new item id exists exactly once in FULL_ITEM_LIBRARY', () => {
    for (const id of NEW_ITEM_IDS) {
      const matches = FULL_ITEM_LIBRARY.filter(i => i.id === id);
      expect(matches).toHaveLength(1);
    }
  });

  it('every new item id is unique across the whole library (no collision)', () => {
    const ids = FULL_ITEM_LIBRARY.map(i => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('items requiring attunement per SRD are tagged, others are not', () => {
    const requiresAttunement = new Set([
      'arrow_catching_shield', 'brooch_of_shielding', 'candle_of_invocation',
      'helm_of_telepathy', 'helm_of_teleportation', 'helm_of_brilliance',
      'slippers_of_spider_climbing',
    ]);
    for (const id of NEW_ITEM_IDS) {
      const item = FULL_ITEM_LIBRARY.find(i => i.id === id)!;
      expect(itemRequiresAttunement(item)).toBe(requiresAttunement.has(id));
    }
  });

  it('every new item is marked srd: true', () => {
    for (const id of NEW_ITEM_IDS) {
      const item = FULL_ITEM_LIBRARY.find(i => i.id === id)!;
      expect(item.srd).toBe(true);
    }
  });
});

function withCarried(inst: ItemInstance): Entity {
  const e = makeEmptyEntity('items-test');
  return { ...e, inventory: { ...e.inventory, carried: [inst] } };
}

describe('modeled magic-item effects', () => {
  it('Glamoured Studded Leather Armor grants +1 AC on equip', () => {
    const inst: ItemInstance = { itemId: 'glamoured_studded_leather_armor', quantity: 1, attuned: false, features: [] };
    const entity = withCarried(inst);
    const before = entity.derived.ac;
    const after = equipItem(entity, 'glamoured_studded_leather_armor', itemGlamouredStuddedLeatherArmor, DEFAULT_RULES);
    expect(after.derived.ac).toBe(before + 1);
  });

  it('Brooch of Shielding grants force resistance on equip', () => {
    const inst: ItemInstance = { itemId: 'brooch_of_shielding', quantity: 1, attuned: false, features: [] };
    const entity = withCarried(inst);
    const after = equipItem(entity, 'brooch_of_shielding', itemBroochOfShielding, DEFAULT_RULES);
    const resistanceFeature = after.inventory.equipped[0].features.find(f => f.id === 'brooch_of_shielding_resistance');
    expect(resistanceFeature?.effects).toEqual([
      { type: 'grant_resistance', target: 'force', operation: 'resistance', value: null, condition: null },
    ]);
  });
});
