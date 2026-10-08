// src/engine/__tests__/itemInstanceIdentityPass2.test.ts
// Item-identity closure, pass 2: infusions, authored item-feature
// ActionCard identity + stale-card rejection, loadouts, and Additional
// Equipment — the 5 findings the follow-up Codex audit flagged as still
// discarding instance identity after pass 1.
import { applyItemInfusion, removeItemInfusion, equipItem } from '../inventory';
import { generateAllActionCards } from '../actionCards';
import { applyActionCardUse } from '../actionUse';
import { recomputeDerived } from '../pipeline';
import { captureLoadout, applyLoadout } from '../loadout';
import { addAdditionalEquipment, additionalEquipment } from '../../content/items/equipmentDisplay';
import { makeEmptyEntity, DEFAULT_RULES } from '../../store/characterStore';
import { Entity, Item, ItemInstance, Feature } from '../types';

function twoIdenticalRings(): { entity: Entity; ringDef: Item } {
  const ringDef: Item = {
    id: 'test_ring_of_might', name: 'Ring of Might', weight: 0, cost: '', properties: [],
    features: [],
  };
  const ringA: ItemInstance = { id: 'ring-a', itemId: 'test_ring_of_might', quantity: 1, attuned: false, features: [] };
  const ringB: ItemInstance = { id: 'ring-b', itemId: 'test_ring_of_might', quantity: 1, attuned: false, features: [] };
  const base = makeEmptyEntity('e1');
  return { entity: { ...base, inventory: { ...base.inventory, equipped: [ringA, ringB] } }, ringDef };
}

describe('item-identity closure pass 2 — B. infusions target instances', () => {
  const infusionFeature: Feature = {
    id: 'infusion_test_infusion', name: 'Test Infusion', description: '', source: { kind: 'item', refId: 'test_ring_of_might' },
    level: null, effects: [{ type: 'stat_modifier', target: 'ac', operation: 'add', value: 1, condition: null }],
    actions: [], choices: [], passive: true,
  };

  it('H2: apply infusion to B only — A remains uninfused', () => {
    const { entity } = twoIdenticalRings();
    const infused = applyItemInfusion(entity, 'test_ring_of_might', 'test_infusion', infusionFeature, 'ring-b');
    const a = infused.inventory.equipped.find(i => i.id === 'ring-a')!;
    const b = infused.inventory.equipped.find(i => i.id === 'ring-b')!;
    expect(b.infusedWith).toBe('test_infusion');
    expect(a.infusedWith).toBeUndefined();
  });

  it('H2: remove infusion from B only — A (independently infused) is untouched', () => {
    const { entity } = twoIdenticalRings();
    let e = applyItemInfusion(entity, 'test_ring_of_might', 'test_infusion', infusionFeature, 'ring-a');
    e = applyItemInfusion(e, 'test_ring_of_might', 'test_infusion', infusionFeature, 'ring-b');
    expect(e.inventory.equipped.every(i => i.infusedWith === 'test_infusion')).toBe(true);

    const afterRemove = removeItemInfusion(e, 'test_ring_of_might', 'ring-b');
    const a = afterRemove.inventory.equipped.find(i => i.id === 'ring-a')!;
    const b = afterRemove.inventory.equipped.find(i => i.id === 'ring-b')!;
    expect(a.infusedWith).toBe('test_infusion'); // untouched
    expect(b.infusedWith).toBeNull();
  });

  it('H2: reordering the equipped array does not change which instance an infusion targets', () => {
    const { entity } = twoIdenticalRings();
    const reordered: Entity = { ...entity, inventory: { ...entity.inventory, equipped: [...entity.inventory.equipped].reverse() } };
    const infused = applyItemInfusion(reordered, 'test_ring_of_might', 'test_infusion', infusionFeature, 'ring-b');
    const a = infused.inventory.equipped.find(i => i.id === 'ring-a')!;
    const b = infused.inventory.equipped.find(i => i.id === 'ring-b')!;
    expect(b.infusedWith).toBe('test_infusion');
    expect(a.infusedWith).toBeUndefined();
  });

  // Item-identity closure (pass 3, finding E): the itemId-only legacy
  // fallback must never silently pick "whichever eligible row comes
  // first" — with TWO eligible duplicates, it refuses entirely.
  it('E2/J4-13: legacy fallback with TWO eligible duplicates refuses (no-op), never picks one arbitrarily', () => {
    const { entity } = twoIdenticalRings();
    const result = applyItemInfusion(entity, 'test_ring_of_might', 'test_infusion', infusionFeature);
    expect(result).toBe(entity); // unchanged — neither ring infused
  });

  it('E2/J4-12: legacy fallback with EXACTLY ONE eligible match succeeds', () => {
    const { entity } = twoIdenticalRings();
    // Pre-infuse ring-a, leaving exactly one eligible (un-infused) candidate.
    const oneInfused = applyItemInfusion(entity, 'test_ring_of_might', 'test_infusion', infusionFeature, 'ring-a');
    const result = applyItemInfusion(oneInfused, 'test_ring_of_might', 'other_infusion', null);
    const b = result.inventory.equipped.find(i => i.id === 'ring-b')!;
    expect(b.infusedWith).toBe('other_infusion');
  });

  it('E2/J4-13 removal: legacy fallback with TWO eligible (infused) duplicates refuses removal', () => {
    const { entity } = twoIdenticalRings();
    let both = applyItemInfusion(entity, 'test_ring_of_might', 'test_infusion', infusionFeature, 'ring-a');
    both = applyItemInfusion(both, 'test_ring_of_might', 'test_infusion', infusionFeature, 'ring-b');
    const result = removeItemInfusion(both, 'test_ring_of_might'); // no instanceId, two eligible
    expect(result).toBe(both); // unchanged — refused
  });

  it('E2/J4-12 removal: legacy fallback with exactly one infused match succeeds', () => {
    const { entity } = twoIdenticalRings();
    const oneInfused = applyItemInfusion(entity, 'test_ring_of_might', 'test_infusion', infusionFeature, 'ring-a');
    const result = removeItemInfusion(oneInfused, 'test_ring_of_might');
    const a = result.inventory.equipped.find(i => i.id === 'ring-a')!;
    expect(a.infusedWith).toBeNull();
  });

  it('E1: an explicit instanceId still targets exactly that instance even with a genuine duplicate present', () => {
    const { entity } = twoIdenticalRings();
    const result = applyItemInfusion(entity, 'test_ring_of_might', 'test_infusion', infusionFeature, 'ring-b');
    const a = result.inventory.equipped.find(i => i.id === 'ring-a')!;
    const b = result.inventory.equipped.find(i => i.id === 'ring-b')!;
    expect(b.infusedWith).toBe('test_infusion');
    expect(a.infusedWith).toBeUndefined();
  });
});

describe('item-identity closure pass 2 — D. authored item-feature ActionCards', () => {
  function authoredFeatureItemDef(): Item {
    return {
      id: 'test_wand_of_sparks', name: 'Wand of Sparks', weight: 1, cost: '', properties: [],
      features: [{
        id: 'wand_of_sparks_zap', name: 'Zap', description: '', source: { kind: 'item', refId: 'test_wand_of_sparks' },
        level: null, effects: [], actions: [], choices: [], passive: false,
        activation: { actionType: 'action', resourceCost: null, range: '30 feet', target: 'single', requiresSave: null },
        abilityEffects: [{ type: 'set_flag', flag: 'sparked', value: true }],
      }],
    };
  }

  function equippedTwice(): Entity {
    const def = authoredFeatureItemDef();
    const wandA: ItemInstance = { id: 'wand-a', itemId: 'test_wand_of_sparks', quantity: 1, attuned: false, features: [] };
    const wandB: ItemInstance = { id: 'wand-b', itemId: 'test_wand_of_sparks', quantity: 1, attuned: false, features: [] };
    let e = makeEmptyEntity('e1');
    e = { ...e, inventory: { ...e.inventory, carried: [wandA, wandB] } };
    let updated = equipItem(e, 'test_wand_of_sparks', def, DEFAULT_RULES, 'wand-a');
    updated = recomputeDerived(equipItem(updated, 'test_wand_of_sparks', def, DEFAULT_RULES, 'wand-b'), DEFAULT_RULES, { items: [def] });
    return updated;
  }

  it('D2: two identical equipped items with the SAME authored feature produce cards with DISTINCT source identity', () => {
    const entity = equippedTwice();
    const cards = generateAllActionCards(entity, DEFAULT_RULES, { items: [authoredFeatureItemDef()] })
      .filter(c => c.featureId === 'wand_of_sparks_zap');
    expect(cards).toHaveLength(2);
    expect(cards[0].sourceKind).toBe('item');
    expect(cards[1].sourceKind).toBe('item');
    expect(cards.map(c => c.sourceId).sort()).toEqual(['wand-a', 'wand-b']);
    // featureId itself stays the shared definition-level feature id —
    // sourceId is what actually distinguishes the two cards.
    expect(cards[0].featureId).toBe(cards[1].featureId);
  });

  it('D3/D4: removing A and executing its now-stale card is rejected safely — it never retargets B', () => {
    const entity = equippedTwice();
    const content = { items: [authoredFeatureItemDef()] };
    const cardA = generateAllActionCards(entity, DEFAULT_RULES, content).find(c => c.sourceId === 'wand-a')!;
    expect(cardA).toBeDefined();

    // Remove wand A entirely — B remains equipped, identical.
    const afterRemoveA: Entity = { ...entity, inventory: { ...entity.inventory, equipped: entity.inventory.equipped.filter(i => i.id !== 'wand-a') } };
    expect(afterRemoveA.inventory.equipped).toHaveLength(1);
    expect(afterRemoveA.inventory.equipped[0].id).toBe('wand-b');

    // Attempt to execute the now-stale A card.
    const result = applyActionCardUse(afterRemoveA, cardA, DEFAULT_RULES, undefined, undefined, undefined, undefined, content);
    expect(result).toBe(afterRemoveA); // rejected — unchanged, NOT silently executed against B
  });

  it('D5: B\'s own live card still executes normally after A is removed', () => {
    const entity = equippedTwice();
    const content = { items: [authoredFeatureItemDef()] };
    const cardB = generateAllActionCards(entity, DEFAULT_RULES, content).find(c => c.sourceId === 'wand-b')!;
    const afterRemoveA: Entity = { ...entity, inventory: { ...entity.inventory, equipped: entity.inventory.equipped.filter(i => i.id !== 'wand-a') } };
    const result = applyActionCardUse(afterRemoveA, cardB, DEFAULT_RULES, undefined, undefined, undefined, undefined, content);
    expect(result).not.toBe(afterRemoveA); // executed successfully
  });

  it('a legacy card with no sourceId still executes via the original flat-search fallback', () => {
    const legacyCard = {
      featureId: 'wand_of_sparks_zap', name: 'Zap', cardType: 'utility' as const, color: 'gray' as const,
      layer1: '', layer2: '', layer3: null, outcomes: [], triggerNote: null,
      activation: { actionType: 'action' as const, resourceCost: null, range: '30 feet', target: 'single' as const, requiresSave: null },
      resourceCost: null, tabs: ['actions' as const], available: true, unavailableReason: null,
    };
    const entity = equippedTwice();
    const result = applyActionCardUse(entity, legacyCard, DEFAULT_RULES);
    expect(result).not.toBe(entity); // executes fine — no sourceId means no stale-instance gate
  });
});

describe('item-identity closure pass 2 — E. loadouts store instance identity', () => {
  it('H5: two identical weapons — a loadout selecting A equips exactly A, not B', () => {
    const swordA: ItemInstance = { id: 'sword-a', itemId: 'test_sword', quantity: 1, attuned: false, features: [] };
    const swordB: ItemInstance = { id: 'sword-b', itemId: 'test_sword', quantity: 1, attuned: false, features: [] };
    let e = makeEmptyEntity('e1');
    e = { ...e, inventory: { ...e.inventory, equipped: [swordA], carried: [swordB] } };

    const loadoutA = captureLoadout(e, 'Loadout A');
    expect(loadoutA.equippedItemInstanceIds).toEqual(['sword-a']);

    // Switch which one is equipped, then apply loadoutA again.
    let switched: Entity = { ...e, inventory: { ...e.inventory, equipped: [swordB], carried: [swordA] } };
    switched = applyLoadout(switched, loadoutA, {}, DEFAULT_RULES);
    expect(switched.inventory.equipped.map(i => i.id)).toEqual(['sword-a']);
    expect(switched.inventory.carried.map(i => i.id)).toEqual(['sword-b']);
  });

  it('H5: a loadout selecting B equips exactly B — no definition-ID collapse between A and B', () => {
    const swordA: ItemInstance = { id: 'sword-a', itemId: 'test_sword', quantity: 1, attuned: false, features: [] };
    const swordB: ItemInstance = { id: 'sword-b', itemId: 'test_sword', quantity: 1, attuned: false, features: [] };
    let e = makeEmptyEntity('e1');
    e = { ...e, inventory: { ...e.inventory, equipped: [swordB], carried: [swordA] } };
    const loadoutB = captureLoadout(e, 'Loadout B');
    expect(loadoutB.equippedItemInstanceIds).toEqual(['sword-b']);

    let switched: Entity = { ...e, inventory: { ...e.inventory, equipped: [swordA], carried: [swordB] } };
    switched = applyLoadout(switched, loadoutB, {}, DEFAULT_RULES);
    expect(switched.inventory.equipped.map(i => i.id)).toEqual(['sword-b']);
  });

  it('legacy loadout (no equippedItemInstanceIds) falls back to itemId matching, least-destructively', () => {
    const swordA: ItemInstance = { id: 'sword-a', itemId: 'test_sword', quantity: 1, attuned: false, features: [] };
    let e = makeEmptyEntity('e1');
    e = { ...e, inventory: { ...e.inventory, carried: [swordA] } };
    const legacyLoadout = { id: 'l1', name: 'Legacy', equippedItemIds: ['test_sword'], preparedSpellIds: [], createdAt: 0 };
    const applied = applyLoadout(e, legacyLoadout, {}, DEFAULT_RULES);
    expect(applied.inventory.equipped.map(i => i.itemId)).toEqual(['test_sword']);
  });
});

describe('item-identity closure pass 2 — F. Additional Equipment allows stateful duplicates', () => {
  it('H6: a stateful item definition can be added twice — two rows, two distinct instance ids', () => {
    const statefulDef: Item = { id: 'test_magic_ring', name: 'Magic Ring', weight: 0, cost: '', properties: ['requires attunement'], features: [] };
    const e = makeEmptyEntity('e1');
    const first  = addAdditionalEquipment(e, 'test_magic_ring', statefulDef);
    expect(first.added).toBe(true);
    const second = addAdditionalEquipment(first.entity, 'test_magic_ring', statefulDef);
    expect(second.added).toBe(true); // NOT rejected merely because itemId already exists
    const owned = additionalEquipment(second.entity);
    expect(owned).toHaveLength(2);
    expect(owned[0].id).not.toBe(owned[1].id);
    expect(owned.every(i => i.itemId === 'test_magic_ring')).toBe(true);
  });

  it('H6: a fungible item definition preserves the existing one-of-each Additional Item behavior', () => {
    const fungibleDef: Item = { id: 'test_rope', name: 'Rope', weight: 10, cost: '', properties: [], features: [] };
    const e = makeEmptyEntity('e1');
    const first  = addAdditionalEquipment(e, 'test_rope', fungibleDef);
    expect(first.added).toBe(true);
    const second = addAdditionalEquipment(first.entity, 'test_rope', fungibleDef);
    expect(second.added).toBe(false); // unchanged — still rejected as an existing row
    expect(additionalEquipment(second.entity)).toHaveLength(1);
  });
});
