// src/engine/__tests__/inventory.test.ts
import { equipItem, unequipItem } from '../inventory';
import { makeEmptyEntity, DEFAULT_RULES } from '../../store/characterStore';
import { Entity, Item, ItemInstance } from '../types';

function withCarried(inst: ItemInstance): Entity {
  const e = makeEmptyEntity('inv-test');
  return { ...e, inventory: { ...e.inventory, carried: [inst] } };
}

function withEquipped(inst: ItemInstance): Entity {
  const e = makeEmptyEntity('inv-test');
  return { ...e, inventory: { ...e.inventory, equipped: [inst] } };
}

describe('equipItem', () => {
  it('moves the instance from carried to equipped and hydrates its features from the definition', () => {
    const inst: ItemInstance = { itemId: 'ring_of_protection', quantity: 1, attuned: false, features: [] };
    const entity = withCarried(inst);
    const def: Item = {
      id: 'ring_of_protection', name: 'Ring of Protection', weight: 0, cost: '', properties: [],
      features: [{
        id: 'ring_ac', name: 'Ring of Protection', description: '', source: { kind: 'item', refId: 'ring_of_protection' },
        level: null, effects: [{ type: 'stat_modifier', target: 'ac', operation: 'add', value: 1, condition: null }],
        actions: [], choices: [], passive: true,
      }],
    };

    const after = equipItem(entity, 'ring_of_protection', def, DEFAULT_RULES);

    expect(after.inventory.carried).toEqual([]);
    expect(after.inventory.equipped).toHaveLength(1);
    expect(after.inventory.equipped[0].features).toEqual(def.features);
    expect(after.derived.ac).toBe(entity.derived.ac + 1);
  });

  it('is a no-op when the item is not in carried', () => {
    const entity = makeEmptyEntity('inv-test');
    const after = equipItem(entity, 'nonexistent', undefined, DEFAULT_RULES);
    expect(after).toBe(entity);
  });

  it('equips with empty features when no definition is found (e.g. a stale homebrew id)', () => {
    const inst: ItemInstance = { itemId: 'mystery_item', quantity: 1, attuned: false, features: [] };
    const entity = withCarried(inst);
    const after = equipItem(entity, 'mystery_item', undefined, DEFAULT_RULES);
    expect(after.inventory.equipped).toHaveLength(1);
    expect(after.inventory.equipped[0].features).toEqual([]);
  });
});

describe('unequipItem', () => {
  it('moves the instance from equipped back to carried, keeping its already-hydrated features', () => {
    const inst: ItemInstance = {
      itemId: 'plate_armor', quantity: 1, attuned: false,
      features: [{
        id: 'plate_ac', name: 'Plate', description: '', source: { kind: 'item', refId: 'plate_armor' },
        level: null, effects: [{ type: 'base_ac_formula', target: 'ac', operation: 'set', value: 18, condition: null }],
        actions: [], choices: [], passive: true,
      }],
    };
    const entity = withEquipped(inst);
    const after = unequipItem(entity, 'plate_armor', DEFAULT_RULES);

    expect(after.inventory.equipped).toEqual([]);
    expect(after.inventory.carried).toHaveLength(1);
    expect(after.inventory.carried[0].features).toEqual(inst.features);
  });

  it('is a no-op when the item is not in equipped', () => {
    const entity = makeEmptyEntity('inv-test');
    const after = unequipItem(entity, 'nonexistent', DEFAULT_RULES);
    expect(after).toBe(entity);
  });
});
