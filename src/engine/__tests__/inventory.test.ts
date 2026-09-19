// src/engine/__tests__/inventory.test.ts
import { equipItem, unequipItem, itemRequiresAttunement, attunementCap, countAttuned, toggleAttunement } from '../inventory';
import { recomputeDerived } from '../pipeline';
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
  function ringOfProtectionDef(): Item {
    return {
      id: 'ring_of_protection', name: 'Ring of Protection', weight: 0, cost: '', properties: [],
      features: [{
        id: 'ring_ac', name: 'Ring of Protection', description: '', source: { kind: 'item', refId: 'ring_of_protection' },
        level: null, effects: [{ type: 'stat_modifier', target: 'ac', operation: 'add', value: 1, condition: null }],
        actions: [], choices: [], passive: true,
      }],
    };
  }

  it('moves the instance from carried to equipped, hydrates its features and requiresAttunement from the definition', () => {
    const inst: ItemInstance = { itemId: 'ring_of_protection', quantity: 1, attuned: false, features: [] };
    const entity = withCarried(inst);
    const def = ringOfProtectionDef();

    const after = equipItem(entity, 'ring_of_protection', def, DEFAULT_RULES);

    expect(after.inventory.carried).toEqual([]);
    expect(after.inventory.equipped).toHaveLength(1);
    expect(after.inventory.equipped[0].features).toEqual(def.features);
    expect(after.inventory.equipped[0].requiresAttunement).toBe(true);
  });

  // Re-audit A17: merely equipping an attunement-required item must not
  // contribute its effects — only attuning does. Ring of Protection is one
  // of inventory.ts's own KNOWN_ATTUNEMENT_ITEM_IDS (the bulk-imported
  // catalog's own "requires attunement" property text is confirmed
  // incomplete for it — see that constant's own doc comment).
  it('an equipped-but-unattuned attunement-required item contributes NO effect', () => {
    const inst: ItemInstance = { itemId: 'ring_of_protection', quantity: 1, attuned: false, features: [] };
    const entity = withCarried(inst);
    const after = equipItem(entity, 'ring_of_protection', ringOfProtectionDef(), DEFAULT_RULES);
    expect(after.derived.ac).toBe(entity.derived.ac); // unchanged — not attuned yet
  });

  it('attuning the same equipped item makes its effect apply; unattuning removes it again', () => {
    const inst: ItemInstance = { itemId: 'ring_of_protection', quantity: 1, attuned: false, features: [] };
    const entity = withCarried(inst);
    let after = equipItem(entity, 'ring_of_protection', ringOfProtectionDef(), DEFAULT_RULES);
    expect(after.derived.ac).toBe(entity.derived.ac); // not attuned: no bonus

    after = recomputeDerived(toggleAttunement(after, 'ring_of_protection'), DEFAULT_RULES);
    expect(after.derived.ac).toBe(entity.derived.ac + 1); // attuned: bonus appears

    after = recomputeDerived(toggleAttunement(after, 'ring_of_protection'), DEFAULT_RULES);
    expect(after.derived.ac).toBe(entity.derived.ac); // unattuned again: bonus disappears
  });

  // Re-audit A19: Bracers of Defense (and any future item using
  // requiresNoArmorOrShield) must not apply while ANOTHER equipped item is
  // armor or a shield.
  it('hydrates wearsArmorOrShield for armor and shields, but not for a non-armor item', () => {
    const armorDef: Item = { id: 'leather_armor', name: 'Leather Armor', weight: 10, cost: '10 gp', properties: ['light armor'], features: [] };
    const shieldDef: Item = { id: 'shield', name: 'Shield', weight: 6, cost: '10 gp', properties: ['shield'], features: [] };
    const ringDef: Item = { id: 'plain_ring', name: 'Plain Ring', weight: 0, cost: '', properties: [], features: [] };
    for (const [def, expected] of [[armorDef, true], [shieldDef, true], [ringDef, false]] as const) {
      const inst: ItemInstance = { itemId: def.id, quantity: 1, attuned: false, features: [] };
      const after = equipItem(withCarried(inst), def.id, def, DEFAULT_RULES);
      expect(after.inventory.equipped[0].wearsArmorOrShield).toBe(expected);
    }
  });

  function bracersOfDefenseDef(): Item {
    return {
      id: 'bracers_of_defense', name: 'Bracers of Defense', weight: 0, cost: '', properties: [],
      features: [{
        id: 'bracers_bonus', name: 'Bracers of Defense', description: '', source: { kind: 'item', refId: 'bracers_of_defense' },
        level: null, actions: [], choices: [], passive: true,
        effects: [{ type: 'stat_modifier', target: 'ac', operation: 'add', value: 2, condition: null, requiresNoArmorOrShield: true }],
      }],
    };
  }

  it('Bracers of Defense applies its AC bonus once equipped AND attuned, with no armor/shield', () => {
    // bracers_of_defense is itself attunement-required (inventory.ts's own
    // KNOWN_ATTUNEMENT_ITEM_IDS) — A17's gate and A19's gate compose
    // correctly here: both conditions must be satisfied.
    const bracersInst: ItemInstance = { itemId: 'bracers_of_defense', quantity: 1, attuned: false, features: [] };
    const entity = withCarried(bracersInst);
    let after = equipItem(entity, 'bracers_of_defense', bracersOfDefenseDef(), DEFAULT_RULES);
    expect(after.derived.ac).toBe(entity.derived.ac); // equipped but not attuned yet: no bonus
    after = recomputeDerived(toggleAttunement(after, 'bracers_of_defense'), DEFAULT_RULES);
    expect(after.derived.ac).toBe(entity.derived.ac + 2); // attuned, no armor/shield: bonus applies
  });

  it('Bracers of Defense does NOT apply while a shield is also equipped, even when attuned', () => {
    const shieldDef: Item = {
      id: 'shield', name: 'Shield', weight: 6, cost: '10 gp', properties: ['shield'],
      features: [{
        id: 'shield_ac', name: 'Shield', description: '', source: { kind: 'item', refId: 'shield' },
        level: null, actions: [], choices: [], passive: true,
        effects: [{ type: 'stat_modifier', target: 'ac', operation: 'add', value: 2, condition: null }],
      }],
    };
    let entity = withCarried({ itemId: 'bracers_of_defense', quantity: 1, attuned: false, features: [] });
    entity = { ...entity, inventory: { ...entity.inventory, carried: [...entity.inventory.carried, { itemId: 'shield', quantity: 1, attuned: false, features: [] }] } };
    let updated = equipItem(entity, 'bracers_of_defense', bracersOfDefenseDef(), DEFAULT_RULES);
    updated = recomputeDerived(toggleAttunement(updated, 'bracers_of_defense'), DEFAULT_RULES);
    expect(updated.derived.ac).toBe(entity.derived.ac + 2); // bracers alone, attuned: +2

    updated = equipItem(updated, 'shield', shieldDef, DEFAULT_RULES);
    // shield's own +2 applies, but bracers' +2 no longer does (requiresNoArmorOrShield blocks it)
    expect(updated.derived.ac).toBe(entity.derived.ac + 2); // net: only the shield's bonus, not both
  });

  it('an item with no attunement requirement contributes its effect immediately on equip, unaffected by this fix', () => {
    const inst: ItemInstance = { itemId: 'plate_of_testing', quantity: 1, attuned: false, features: [] };
    const entity = withCarried(inst);
    const def: Item = {
      id: 'plate_of_testing', name: 'Plate of Testing', weight: 0, cost: '', properties: [],
      features: [{
        id: 'plate_ac', name: 'Plate of Testing', description: '', source: { kind: 'item', refId: 'plate_of_testing' },
        level: null, effects: [{ type: 'stat_modifier', target: 'ac', operation: 'add', value: 1, condition: null }],
        actions: [], choices: [], passive: true,
      }],
    };
    const after = equipItem(entity, 'plate_of_testing', def, DEFAULT_RULES);
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

  it('merges into an existing equipped stack of the same item instead of creating a second row', () => {
    // Regression for INV-1: two daggers acquired in two separate pickup+equip
    // cycles used to end up as two independent equipped rows sharing one
    // itemId, which unequipItem could not safely tell apart.
    const equippedDagger: ItemInstance = { itemId: 'dagger', quantity: 1, attuned: false, features: [] };
    const carriedDagger:  ItemInstance = { itemId: 'dagger', quantity: 1, attuned: false, features: [] };
    let entity = withEquipped(equippedDagger);
    entity = { ...entity, inventory: { ...entity.inventory, carried: [carriedDagger] } };

    const after = equipItem(entity, 'dagger', undefined, DEFAULT_RULES);

    expect(after.inventory.equipped).toHaveLength(1);
    expect(after.inventory.equipped[0].quantity).toBe(2);
    expect(after.inventory.carried).toEqual([]);
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

  it('unequipping one of two same-itemId equipped instances leaves the other untouched (INV-1 regression)', () => {
    // Two daggers, each equipped via a separate pickup+equip cycle (the
    // pre-fix path that produced two independent equipped rows sharing one
    // itemId). Before the fix, unequipItem's `.find()`+`.filter(itemId)`
    // mismatch deleted BOTH rows and restored only one to carried.
    const daggerA: ItemInstance = { itemId: 'dagger', quantity: 1, attuned: false, features: [] };
    const daggerB: ItemInstance = { itemId: 'dagger', quantity: 1, attuned: true,  features: [] };
    const e = makeEmptyEntity('inv-test');
    const entity: Entity = { ...e, inventory: { ...e.inventory, equipped: [daggerA, daggerB], carried: [] } };

    const after = unequipItem(entity, 'dagger', DEFAULT_RULES);

    // Exactly one dagger moved to carried; the other is still equipped —
    // neither was silently deleted, and they were kept distinct (not
    // merged) because their attuned state differs... actually merge only
    // keys on itemId+infusedWith, so same-itemId same-infusion instances
    // DO merge on the carried side; assert total dagger count is preserved
    // instead of asserting non-merge, since merging is itself correct here.
    const totalDaggers =
      after.inventory.equipped.filter(i => i.itemId === 'dagger').reduce((s, i) => s + i.quantity, 0) +
      after.inventory.carried.filter(i => i.itemId === 'dagger').reduce((s, i) => s + i.quantity, 0);
    expect(totalDaggers).toBe(2);
    expect(after.inventory.equipped).toHaveLength(1);
    expect(after.inventory.carried).toHaveLength(1);
  });

  it('merges into an existing carried stack of the same item instead of creating a second row', () => {
    const equippedRing: ItemInstance = { itemId: 'ring', quantity: 1, attuned: false, features: [] };
    const carriedRing:  ItemInstance = { itemId: 'ring', quantity: 2, attuned: false, features: [] };
    const e = makeEmptyEntity('inv-test');
    const entity: Entity = { ...e, inventory: { ...e.inventory, equipped: [equippedRing], carried: [carriedRing] } };

    const after = unequipItem(entity, 'ring', DEFAULT_RULES);

    expect(after.inventory.equipped).toEqual([]);
    expect(after.inventory.carried).toHaveLength(1);
    expect(after.inventory.carried[0].quantity).toBe(3);
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
