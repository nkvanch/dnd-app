// src/engine/__tests__/equipmentChoice.test.ts
import { makeEmptyEntity, DEFAULT_RULES } from '../../store/characterStore';
import { queueChoice, resolveEquipmentChoice } from '../leveling';
import { itemMatchesConstraint } from '../../content/items/itemBrowse';
import type { ChoiceDefinition } from '../types';
import type { ItemIndexEntry } from '../../content/itemRepo.types';

function mkItem(over: Partial<ItemIndexEntry>): ItemIndexEntry {
  return { id: 'x', name: 'X', weight: 1, cost: '1 gp', properties: [], hasDamageEffect: false, weaponRange: null, ...over };
}

const longsword = mkItem({ id: 'longsword', name: 'Longsword', hasDamageEffect: true, properties: ['versatile'] });
const dagger    = mkItem({ id: 'dagger', name: 'Dagger', hasDamageEffect: true, properties: ['finesse', 'light', 'thrown'] });
const shield    = mkItem({ id: 'shield', name: 'Shield', properties: ['shield'] });
const chainMail = mkItem({ id: 'chain_mail', name: 'Chain Mail', properties: ['heavy armor'] });

const ITEM_INDEX: Record<string, ItemIndexEntry> = {
  longsword, dagger, shield, chain_mail: chainMail,
};
const lookup = (id: string) => ITEM_INDEX[id];

describe('itemMatchesConstraint', () => {
  it('matches on weaponClass/category (Longsword is a martial weapon)', () => {
    expect(itemMatchesConstraint(longsword, { category: 'weapon', weaponClass: 'martial' })).toBe(true);
    expect(itemMatchesConstraint(longsword, { category: 'weapon', weaponClass: 'simple' })).toBe(false);
  });
  it('matches on weaponRange (Dagger is melee, not ranged, despite being thrown)', () => {
    expect(itemMatchesConstraint(dagger, { weaponRange: 'melee' })).toBe(true);
  });
  it('an empty constraint matches everything', () => {
    expect(itemMatchesConstraint(shield, {})).toBe(true);
  });
  it('rejects a non-weapon against a weapon constraint', () => {
    expect(itemMatchesConstraint(shield, { category: 'weapon' })).toBe(false);
  });
});

describe('resolveEquipmentChoice — filtered_item style', () => {
  function setup(): ReturnType<typeof makeEmptyEntity> {
    const def: ChoiceDefinition = {
      id: 'test_weapons', prompt: 'Choose 2 Simple Melee Weapons', kind: 'equipment',
      count: 2, pool: [], grants: [], required: true, resolved: false,
      equipmentStyle: 'filtered_item',
      itemFilter: { category: 'weapon', weaponClass: 'simple', weaponRange: 'melee' },
    };
    return queueChoice(makeEmptyEntity('e1'), def, 1);
  }

  it('grants exactly the chosen qualifying items and marks the choice resolved', () => {
    const e = setup();
    const updated = resolveEquipmentChoice(e, 'test_weapons_1', { style: 'filtered_item', itemIds: ['dagger', 'dagger'] }, lookup, DEFAULT_RULES);
    const carriedIds = updated.inventory.carried.map(i => i.itemId);
    expect(carriedIds).toEqual(['dagger', 'dagger']);
    expect(updated.choices.find(c => c.id === 'test_weapons_1')?.resolved).toBe(true);
    expect(updated.choices.find(c => c.id === 'test_weapons_1')?.selections).toEqual(['dagger', 'dagger']);
  });

  it('rejects an item that does not satisfy the constraint (a martial weapon for a Simple-only choice)', () => {
    const e = setup();
    expect(() => resolveEquipmentChoice(e, 'test_weapons_1', { style: 'filtered_item', itemIds: ['dagger', 'longsword'] }, lookup, DEFAULT_RULES))
      .toThrow(/does not satisfy/);
  });

  it('rejects the wrong number of items', () => {
    const e = setup();
    expect(() => resolveEquipmentChoice(e, 'test_weapons_1', { style: 'filtered_item', itemIds: ['dagger'] }, lookup, DEFAULT_RULES))
      .toThrow(/Expected 2/);
  });
});

describe('resolveEquipmentChoice — exact_options style with a nested itemFilter', () => {
  function setup(): ReturnType<typeof makeEmptyEntity> {
    // Mirrors "(a) a martial weapon and a shield, or (b) two martial weapons"
    // — option A grants a fixed shield PLUS requires 1 filtered martial
    // weapon; option B requires 2 filtered martial weapons and grants
    // nothing fixed. Neither option hardcodes a specific weapon.
    const def: ChoiceDefinition = {
      id: 'test_fighter_weapon', prompt: 'Choose your fighting style gear', kind: 'equipment',
      count: 1, grants: [], required: true, resolved: false,
      equipmentStyle: 'exact_options',
      pool: [
        { id: 'weapon_and_shield', label: 'A martial weapon and a shield', value: ['shield'], itemFilter: { constraint: { category: 'weapon', weaponClass: 'martial' }, quantity: 1 } },
        { id: 'two_weapons', label: 'Two martial weapons', value: [], itemFilter: { constraint: { category: 'weapon', weaponClass: 'martial' }, quantity: 2 } },
      ],
    };
    return queueChoice(makeEmptyEntity('e1'), def, 1);
  }

  it('option A grants the fixed shield plus the chosen filtered weapon', () => {
    const e = setup();
    const updated = resolveEquipmentChoice(e, 'test_fighter_weapon_1', { style: 'exact_options', optionId: 'weapon_and_shield', filteredItemIds: ['longsword'] }, lookup, DEFAULT_RULES);
    expect(updated.inventory.carried.map(i => i.itemId).sort()).toEqual(['longsword', 'shield']);
  });

  it('option B grants only the two chosen filtered weapons, no fixed items', () => {
    const e = setup();
    const updated = resolveEquipmentChoice(e, 'test_fighter_weapon_1', { style: 'exact_options', optionId: 'two_weapons', filteredItemIds: ['longsword', 'longsword'] }, lookup, DEFAULT_RULES);
    expect(updated.inventory.carried.map(i => i.itemId)).toEqual(['longsword', 'longsword']);
  });

  it('rejects a filtered pick that violates the option\'s own constraint (a non-martial item)', () => {
    const e = setup();
    expect(() => resolveEquipmentChoice(e, 'test_fighter_weapon_1', { style: 'exact_options', optionId: 'weapon_and_shield', filteredItemIds: ['chain_mail'] }, lookup, DEFAULT_RULES))
      .toThrow(/does not satisfy/);
  });

  it('rejects an unknown option id', () => {
    const e = setup();
    expect(() => resolveEquipmentChoice(e, 'test_fighter_weapon_1', { style: 'exact_options', optionId: 'nope', filteredItemIds: [] }, lookup, DEFAULT_RULES))
      .toThrow(/Invalid selection/);
  });
});

describe('resolveEquipmentChoice — plain exact_options (no itemFilter), unchanged legacy shape', () => {
  it('grants a fixed option\'s value items with no filtered pick required', () => {
    const def: ChoiceDefinition = {
      id: 'test_armor', prompt: 'Choose armor', kind: 'equipment',
      count: 1, grants: [], required: true, resolved: false,
      pool: [
        { id: 'chain', label: 'Chain Mail', value: ['chain_mail'] },
        { id: 'leather', label: 'Leather Armor', value: [] },
      ],
    };
    const e = queueChoice(makeEmptyEntity('e1'), def, 1);
    const updated = resolveEquipmentChoice(e, 'test_armor_1', { style: 'exact_options', optionId: 'chain' }, lookup, DEFAULT_RULES);
    expect(updated.inventory.carried.map(i => i.itemId)).toEqual(['chain_mail']);
  });
});

// STARTING-EQUIPMENT-2 (item 11 — Required/Automatic/Manual separation):
// manually-added inventory items (the "+ Add Additional Item" flow in
// app/creation/equipment.tsx) go straight into entity.inventory.carried
// and never touch entity.choices at all — proves the required-equipment
// counter can't be inflated by them, structurally, not just by
// convention. Mirrors the exact shape equipment.tsx's addManualItem()
// uses (a raw carried-array push, no choice resolution involved).
describe('Required vs Manual equipment separation (regression, item 11)', () => {
  it('adding manual items to inventory.carried never resolves or otherwise touches a pending equipment choice', () => {
    const def: ChoiceDefinition = {
      id: 'test_weapons', prompt: 'Choose 2 Simple Melee Weapons', kind: 'equipment',
      count: 2, pool: [], grants: [], required: true, resolved: false,
      equipmentStyle: 'filtered_item',
      itemFilter: { category: 'weapon', weaponClass: 'simple', weaponRange: 'melee' },
    };
    let e = queueChoice(makeEmptyEntity('e1'), def, 1);
    const requiredCountBefore = e.choices.filter(c => c.definition.kind === 'equipment' && !c.resolved).length;

    // Manually add 3 unrelated items the way "+ Add Additional Item" does —
    // a raw carried-array push, no resolveEquipmentChoice call at all.
    for (const itemId of ['torch', 'rope_50ft', 'rations_1day']) {
      e = { ...e, inventory: { ...e.inventory, carried: [...e.inventory.carried, { itemId, quantity: 1, attuned: false, features: [] }] } };
    }

    const requiredCountAfter = e.choices.filter(c => c.definition.kind === 'equipment' && !c.resolved).length;
    expect(requiredCountAfter).toBe(requiredCountBefore); // still 1 unresolved choice — required = /4 semantics unaffected
    expect(e.choices.find(c => c.id === 'test_weapons_1')?.resolved).toBe(false);
    expect(e.inventory.carried.map(i => i.itemId)).toEqual(['torch', 'rope_50ft', 'rations_1day']); // manual items present, but granted nothing toward the choice
  });
});
