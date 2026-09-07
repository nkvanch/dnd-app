// src/engine/__tests__/inventory.test.ts
import { equipItem, unequipItem, itemRequiresAttunement, attunementCap, countAttuned, toggleAttunement } from '../inventory';
import { makeEmptyEntity, DEFAULT_RULES } from '../../store/characterStore';
import { Entity, Item, ItemInstance, FeatureInstance } from '../types';

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

function withFeatureId(entity: Entity, id: string): Entity {
  const feature: FeatureInstance = {
    id, name: id, description: '', source: { kind: 'class', refId: 'test' },
    level: null, effects: [], actions: [], choices: [], passive: true, isActive: true,
  };
  return { ...entity, features: [...entity.features, feature] };
}

describe('itemRequiresAttunement', () => {
  it('is true when properties disclose attunement, case-insensitively', () => {
    const item: Item = { id: 'x', name: 'X', weight: 0, cost: '', properties: ['magic item', 'Requires Attunement'], features: [] };
    expect(itemRequiresAttunement(item)).toBe(true);
  });
  it('is false for a mundane item and for undefined', () => {
    const item: Item = { id: 'x', name: 'X', weight: 0, cost: '', properties: ['heavy'], features: [] };
    expect(itemRequiresAttunement(item)).toBe(false);
    expect(itemRequiresAttunement(undefined)).toBe(false);
  });
  it('is true for the curated named-item ids even when properties omit the tag', () => {
    // Regression case: the real Ring of Protection content entry carries
    // only properties: ["rare"] — no "requires attunement" string at all.
    const item: Item = { id: 'ring_of_protection', name: 'Ring of Protection', weight: 0, cost: '', properties: ['rare'], features: [] };
    expect(itemRequiresAttunement(item)).toBe(true);
  });
});

describe('attunementCap', () => {
  it('defaults to 3', () => {
    expect(attunementCap(makeEmptyEntity('inv-test'))).toBe(3);
  });
  it('honors the Artificer capstones, highest wins', () => {
    expect(attunementCap(withFeatureId(makeEmptyEntity('inv-test'), 'magic_item_adept'))).toBe(4);
    expect(attunementCap(withFeatureId(makeEmptyEntity('inv-test'), 'magic_item_savant'))).toBe(5);
    expect(attunementCap(withFeatureId(makeEmptyEntity('inv-test'), 'magic_item_master'))).toBe(6);
  });
  it('adds 1 for Mystic Conflux', () => {
    expect(attunementCap(withFeatureId(makeEmptyEntity('inv-test'), 'feat_mystic_conflux'))).toBe(4);
  });
});

describe('countAttuned / toggleAttunement', () => {
  function withInstances(equipped: ItemInstance[], carried: ItemInstance[]): Entity {
    const e = makeEmptyEntity('inv-test');
    return { ...e, inventory: { ...e.inventory, equipped, carried } };
  }

  it('counts attuned instances across both equipped and carried', () => {
    const entity = withInstances(
      [{ itemId: 'ring1', quantity: 1, attuned: true, features: [] }],
      [{ itemId: 'ring2', quantity: 1, attuned: true, features: [] }, { itemId: 'sword', quantity: 1, attuned: false, features: [] }],
    );
    expect(countAttuned(entity)).toBe(2);
  });

  it('flips attuned true -> false and false -> true', () => {
    const entity = withInstances([{ itemId: 'ring1', quantity: 1, attuned: false, features: [] }], []);
    const attuned = toggleAttunement(entity, 'ring1');
    expect(attuned.inventory.equipped[0].attuned).toBe(true);
    const unattuned = toggleAttunement(attuned, 'ring1');
    expect(unattuned.inventory.equipped[0].attuned).toBe(false);
  });

  it('refuses to attune a 4th item at the default cap of 3', () => {
    const entity = withInstances(
      [
        { itemId: 'a', quantity: 1, attuned: true, features: [] },
        { itemId: 'b', quantity: 1, attuned: true, features: [] },
        { itemId: 'c', quantity: 1, attuned: true, features: [] },
        { itemId: 'd', quantity: 1, attuned: false, features: [] },
      ],
      [],
    );
    const after = toggleAttunement(entity, 'd');
    expect(after).toBe(entity);
    expect(countAttuned(after)).toBe(3);
  });

  it('always allows un-attuning even when at cap', () => {
    const entity = withInstances(
      [
        { itemId: 'a', quantity: 1, attuned: true, features: [] },
        { itemId: 'b', quantity: 1, attuned: true, features: [] },
        { itemId: 'c', quantity: 1, attuned: true, features: [] },
      ],
      [],
    );
    const after = toggleAttunement(entity, 'a');
    expect(after.inventory.equipped[0].attuned).toBe(false);
    expect(countAttuned(after)).toBe(2);
  });

  it('is a no-op when the item is in neither carried nor equipped', () => {
    const entity = makeEmptyEntity('inv-test');
    const after = toggleAttunement(entity, 'nonexistent');
    expect(after).toBe(entity);
  });
});
