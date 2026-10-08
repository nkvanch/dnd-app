// src/content/items/__tests__/equipmentDisplay.test.ts
// STARTING-EQUIPMENT-1: pure-logic coverage for the Starting Equipment
// screen's own display helpers (the UI-glue itself, app/creation/
// equipment.tsx, is exercised live — per this session's established
// preference for testing pure logic directly rather than through
// rendering, see e.g. RestPreviewModal/FeatPreviewModal tests).
import { describeConstraint, itemsGrantedBy, reopenEquipmentChoice, skipEquipmentChoice, addAdditionalEquipment } from '../equipmentDisplay';
import { ChoiceState, ChoiceOption, Entity } from '../../../engine/types';
import { makeEmptyEntity } from '../../../store/characterStore';
import { itemBroomOfFlying, itemRope50ft } from '../index';
import { toItemIndexEntry } from '../../itemRepo.types';

function makeChoice(overrides: Partial<ChoiceState> & { pool?: ChoiceOption[] }): ChoiceState {
  const { pool, ...rest } = overrides;
  return {
    id: 'c1',
    grantedAt: 1,
    resolved: true,
    selections: [],
    ...rest,
    definition: {
      id: 'c1', prompt: 'Choose', kind: 'equipment', count: 1,
      pool: pool ?? [], grants: [], required: true, resolved: false,
      ...rest.definition,
    },
  };
}

describe('describeConstraint', () => {
  it('describes a simple melee weapon constraint', () => {
    expect(describeConstraint({ category: 'weapon', weaponClass: 'simple', weaponRange: 'melee' }))
      .toBe('Simple Melee Weapons');
  });

  it('describes a martial weapon constraint with no range', () => {
    expect(describeConstraint({ category: 'weapon', weaponClass: 'martial' })).toBe('Martial Weapons');
  });

  it('describes an armor-weight constraint', () => {
    expect(describeConstraint({ category: 'armor', armorWeight: 'light' })).toBe('Light Armors');
  });

  it('falls back to "Items" for an empty constraint', () => {
    expect(describeConstraint({})).toBe('Items');
  });
});

describe('itemsGrantedBy', () => {
  it('resolves legacy selections (each selection is a pool option id)', () => {
    const choice = makeChoice({
      selections: ['leather'],
      definition: {
        pool: [
          { id: 'chain', label: 'Chain Mail', value: ['chain_mail'] },
          { id: 'leather', label: 'Leather + Longbow', value: ['leather_armor', 'longbow', 'arrows_20'] },
        ],
      } as any,
    });
    expect(itemsGrantedBy(choice)).toEqual(['leather_armor', 'longbow', 'arrows_20']);
  });

  it('resolves exact_options selections with a fixed item plus a nested filtered pick', () => {
    const choice = makeChoice({
      selections: ['weapon_shield', 'longsword'],
      definition: {
        equipmentStyle: 'exact_options',
        pool: [
          { id: 'weapon_shield', label: 'Martial weapon + shield', value: ['shield'], itemFilter: { constraint: { category: 'weapon', weaponClass: 'martial' }, quantity: 1 } },
          { id: 'two_martial', label: 'Two martial weapons', value: [], itemFilter: { constraint: { category: 'weapon', weaponClass: 'martial' }, quantity: 2 } },
        ],
      } as any,
    });
    expect(itemsGrantedBy(choice)).toEqual(['shield', 'longsword']);
  });

  it('resolves filtered_item selections as raw item ids directly', () => {
    const choice = makeChoice({
      selections: ['dagger', 'quarterstaff'],
      definition: { equipmentStyle: 'filtered_item', itemFilter: { category: 'weapon', weaponClass: 'simple' } } as any,
    });
    expect(itemsGrantedBy(choice)).toEqual(['dagger', 'quarterstaff']);
  });

  it('resolves bundle_options selections with no nested filter (pure fixed bundle)', () => {
    const choice = makeChoice({
      selections: ['dungeoneer'],
      definition: {
        equipmentStyle: 'bundle_options',
        pool: [
          { id: 'dungeoneer', label: "Dungeoneer's Pack", value: ['dungeoneers_pack'] },
          { id: 'explorer', label: "Explorer's Pack", value: ['explorers_pack'] },
        ],
      } as any,
    });
    expect(itemsGrantedBy(choice)).toEqual(['dungeoneers_pack']);
  });
});

describe('reopenEquipmentChoice', () => {
  const statefulItemDef = { id: 'ring_of_protection', name: 'Ring of Protection', properties: ['requires attunement'], features: [] } as any;

  function withChoice(entity: Entity, choice: ChoiceState): Entity {
    return { ...entity, choices: [...entity.choices, choice] };
  }

  it('reopening choice A (grantedItemInstanceIds) removes only A\'s instance, leaving B (same itemId, from Additional Equipment) untouched', () => {
    let entity = makeEmptyEntity('e1');
    const choiceA = makeChoice({
      id: 'choiceA', resolved: true, selections: ['ring_of_protection'],
      grantedItemInstanceIds: [], // filled in below once we know the generated id
    });
    // Simulate what resolveChoice/resolveEquipmentChoice does: grant an instance and record its id.
    const before = entity.inventory.carried.length;
    const withAdd = addAdditionalEquipment(entity, 'ring_of_protection', statefulItemDef);
    expect(withAdd.added).toBe(true);
    const instanceA = withAdd.entity.inventory.carried[before];
    entity = withChoice(withAdd.entity, { ...choiceA, grantedItemInstanceIds: [instanceA.id!] });

    // Choice B / Additional Equipment grants a SECOND instance of the same itemId.
    const withSecond = addAdditionalEquipment(entity, 'ring_of_protection', statefulItemDef);
    expect(withSecond.added).toBe(true); // stateful items always allow a second copy
    entity = withSecond.entity;
    const instanceB = entity.inventory.carried[entity.inventory.carried.length - 1];
    expect(instanceB.id).not.toBe(instanceA.id);

    const reopened = reopenEquipmentChoice(entity, 'choiceA');
    const remainingRingIds = reopened.inventory.carried.filter(i => i.itemId === 'ring_of_protection').map(i => i.id);
    expect(remainingRingIds).toEqual([instanceB.id]);
    expect(reopened.choices.find(c => c.id === 'choiceA')?.resolved).toBe(false);
    expect(reopened.choices.find(c => c.id === 'choiceA')?.selections).toEqual([]);
  });

  it('reopening choice B independently removes only B, leaving A (granted by a different choice) untouched', () => {
    let entity = makeEmptyEntity('e1');
    const before = entity.inventory.carried.length;
    const withA = addAdditionalEquipment(entity, 'ring_of_protection', statefulItemDef);
    const instanceA = withA.entity.inventory.carried[before];
    entity = withChoice(withA.entity, makeChoice({ id: 'choiceA', resolved: true, selections: ['ring_of_protection'], grantedItemInstanceIds: [instanceA.id!] }));

    const withB = addAdditionalEquipment(entity, 'ring_of_protection', statefulItemDef);
    const instanceB = withB.entity.inventory.carried[withB.entity.inventory.carried.length - 1];
    entity = withChoice(withB.entity, makeChoice({ id: 'choiceB', resolved: true, selections: ['ring_of_protection'], grantedItemInstanceIds: [instanceB.id!] }));

    const reopened = reopenEquipmentChoice(entity, 'choiceB');
    const remainingRingIds = reopened.inventory.carried.filter(i => i.itemId === 'ring_of_protection').map(i => i.id);
    expect(remainingRingIds).toEqual([instanceA.id]);
    expect(reopened.choices.find(c => c.id === 'choiceB')?.resolved).toBe(false);
  });

  it('falls back to itemId-based removal for a legacy choice with no grantedItemInstanceIds', () => {
    let entity = makeEmptyEntity('e1');
    entity = {
      ...entity,
      inventory: { ...entity.inventory, carried: [...entity.inventory.carried, { id: 'legacy:1', itemId: 'leather_armor', quantity: 1, attuned: false, features: [] }] },
      choices: [...entity.choices, makeChoice({
        id: 'legacyChoice', resolved: true, selections: ['leather'],
        definition: { pool: [{ id: 'leather', label: 'Leather Armor', value: ['leather_armor'] }] } as any,
      })],
    };
    const reopened = reopenEquipmentChoice(entity, 'legacyChoice');
    expect(reopened.inventory.carried.some(i => i.itemId === 'leather_armor')).toBe(false);
  });

  it('skipEquipmentChoice reopens (clearing any granted instances) then marks the choice resolved with empty selections', () => {
    let entity = makeEmptyEntity('e1');
    const before = entity.inventory.carried.length;
    const withA = addAdditionalEquipment(entity, 'ring_of_protection', statefulItemDef);
    const instanceA = withA.entity.inventory.carried[before];
    entity = withChoice(withA.entity, makeChoice({ id: 'choiceA', resolved: true, selections: ['ring_of_protection'], grantedItemInstanceIds: [instanceA.id!] }));

    const skipped = skipEquipmentChoice(entity, 'choiceA');
    expect(skipped.inventory.carried.some(i => i.id === instanceA.id)).toBe(false);
    const choice = skipped.choices.find(c => c.id === 'choiceA');
    expect(choice?.resolved).toBe(true);
    expect(choice?.selections).toEqual([]);
  });
});

describe('addAdditionalEquipment — creation-time stateful classification (item-identity closure, pass 3 finding D)', () => {
  it('a REAL feature-bearing, non-weapon/non-attunement item (Broom of Flying) added twice produces two distinct instances, not a quantity bump', () => {
    let entity = makeEmptyEntity('e1');
    // Creation receives the Tier-1 index on native, not a warmed full
    // definition. Its compact hasFeatures fact must preserve the same
    // stateful result.
    const broomIndex = toItemIndexEntry(itemBroomOfFlying);
    expect(broomIndex.hasFeatures).toBe(true);
    const first = addAdditionalEquipment(entity, 'broom_of_flying', broomIndex);
    expect(first.added).toBe(true);
    entity = first.entity;
    const second = addAdditionalEquipment(entity, 'broom_of_flying', broomIndex);
    expect(second.added).toBe(true); // stateful (has a feature) — a second owned copy is allowed
    entity = second.entity;

    const brooms = entity.inventory.carried.filter(i => i.itemId === 'broom_of_flying');
    expect(brooms).toHaveLength(2);
    expect(brooms[0].id).not.toBe(brooms[1].id);
    expect(brooms.every(b => b.quantity === 1)).toBe(true); // never stacked
  });

  it('a real fungible item (no features, no attunement/weapon/armor) still follows the existing one-of-each Additional Item stacking behavior', () => {
    let entity = makeEmptyEntity('e1');
    const first = addAdditionalEquipment(entity, 'rope_hemp_50ft', itemRope50ft);
    expect(first.added).toBe(true);
    entity = first.entity;
    const second = addAdditionalEquipment(entity, 'rope_hemp_50ft', itemRope50ft);
    expect(second.added).toBe(false); // fungible — already-added Additional Item of this itemId refuses a duplicate
    expect(second.entity.inventory.carried.filter(i => i.itemId === 'rope_hemp_50ft')).toHaveLength(1);
  });
});
