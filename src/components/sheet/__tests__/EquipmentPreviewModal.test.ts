// src/components/sheet/__tests__/EquipmentPreviewModal.test.ts
// Tests buildEquipmentSummaryRows directly (pure logic), exercised through
// the real equipItem()/simulate() path so the rows reflect what actually
// happens on equip/unequip, not a hand-crafted before/after pair.
import { buildEquipmentSummaryRows } from '../EquipmentPreviewModal';
import { equipItem } from '../../../engine/inventory';
import { simulate } from '../../../engine/simulate';
import { makeEmptyEntity, DEFAULT_RULES } from '../../../store/characterStore';
import { Entity, Item, ItemInstance, Feature } from '../../../engine/types';

function feature(id: string, effects: Feature['effects']): Feature {
  return {
    id, name: id, description: '', source: { kind: 'item', refId: id },
    level: null, effects, actions: [], choices: [], passive: true,
  };
}

function item(id: string, name: string, features: Feature[]): Item {
  return { id, name, weight: 0, cost: '', properties: [], features };
}

describe('buildEquipmentSummaryRows', () => {
  it('reports an AC change from armor', () => {
    const armor = item('plate', 'Plate Armor', [
      feature('plate_ac', [{ type: 'base_ac_formula', target: 'ac', operation: 'set', value: 18, condition: null }]),
    ]);
    const inst: ItemInstance = { itemId: 'plate', quantity: 1, attuned: false, features: [] };
    const e = makeEmptyEntity('eq-test');
    const entity: Entity = { ...e, inventory: { ...e.inventory, carried: [inst] } };

    const { before, after } = simulate(entity, ent => equipItem(ent, 'plate', armor, DEFAULT_RULES), DEFAULT_RULES);
    const rows = buildEquipmentSummaryRows(before, after);
    expect(rows.some(r => r.label === `AC: ${before.derived.ac} → 18`)).toBe(true);
  });

  it('reports a new attack from a weapon', () => {
    // Weapon attack bonuses are computed by the pipeline's own weapon-attack
    // derivation (not driven by a simple stat_modifier effect), so this
    // test exercises the row-builder directly against a before/after pair
    // rather than through a real equipItem() call — equipItem's own test
    // file covers the real equip-hydration path.
    const e = makeEmptyEntity('eq-test');
    const before: Entity = e;
    const after: Entity = {
      ...before,
      derived: {
        ...before.derived,
        attackBonuses: [{ id: 'longsword_1', name: '+1 Longsword', bonus: 1, type: 'melee', ability: 'str', damageBonus: 1, damageDice: '1d8', damageType: 'slashing' }],
      },
    };
    const rows = buildEquipmentSummaryRows(before, after);
    expect(rows.some(r => r.label === 'New attack: +1 Longsword (+1 to hit, 1d8+1 slashing)')).toBe(true);
  });

  it('reports a removed attack on unequip', () => {
    // Same reasoning as the "new attack" test above — attackBonuses is
    // pipeline-computed, so a hand-crafted entry wouldn't survive
    // simulate()'s internal recompute unless the entity actually has a
    // real weapon equipped. Exercises the row-builder directly instead.
    const e = makeEmptyEntity('eq-test');
    const before: Entity = {
      ...e,
      derived: { ...e.derived, attackBonuses: [{ id: 'dagger', name: 'Dagger', bonus: 2, type: 'melee', ability: 'dex', damageBonus: 2, damageDice: '1d4', damageType: 'piercing' }] },
    };
    const after: Entity = { ...before, derived: { ...before.derived, attackBonuses: [] } };
    const rows = buildEquipmentSummaryRows(before, after);
    expect(rows.some(r => r.label === 'Attack removed: Dagger')).toBe(true);
  });

  it('reports a resistance gained from an item', () => {
    const ring = item('ring_of_fire_resistance', 'Ring of Fire Resistance', [
      feature('ring_res', [{ type: 'grant_resistance', target: 'fire', operation: 'resistance', value: null, condition: null }]),
    ]);
    const inst: ItemInstance = { itemId: 'ring_of_fire_resistance', quantity: 1, attuned: false, features: [] };
    const e = makeEmptyEntity('eq-test');
    const entity: Entity = { ...e, inventory: { ...e.inventory, carried: [inst] } };

    const { before, after } = simulate(entity, ent => equipItem(ent, 'ring_of_fire_resistance', ring, DEFAULT_RULES), DEFAULT_RULES);
    const rows = buildEquipmentSummaryRows(before, after);
    expect(rows.some(r => r.label === 'Gained Resistance: fire')).toBe(true);
  });

  it('returns no rows for mundane gear with no modeled effect', () => {
    const rope = item('rope', 'Rope, Hempen (50 feet)', []);
    const inst: ItemInstance = { itemId: 'rope', quantity: 1, attuned: false, features: [] };
    const e = makeEmptyEntity('eq-test');
    const entity: Entity = { ...e, inventory: { ...e.inventory, carried: [inst] } };

    const { before, after } = simulate(entity, ent => equipItem(ent, 'rope', rope, DEFAULT_RULES), DEFAULT_RULES);
    expect(buildEquipmentSummaryRows(before, after)).toEqual([]);
  });
});
