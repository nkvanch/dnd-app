// Phase 1: homebrew item charge pools (Item.resources + the builder compiler).
import { buildItemCharges, chargeActivation, newItemChargesDraft } from '../../content/itemCharges';
import { equipItem, unequipItem } from '../inventory';
import { makeEmptyEntity, DEFAULT_RULES } from '../../store/characterStore';
import { takeDawn } from '../rest';
import type { Item, Entity } from '../types';

function standard(): Item {
  const pool = buildItemCharges('hb_standard', 'Standard of the Unyielding Line', {
    ...newItemChargesDraft(), enabled: true, max: '3', recharge: 'dawn', actionType: 'reaction',
  })!;
  return {
    id: 'hb_standard', name: 'Standard of the Unyielding Line', weight: 0, cost: '-', properties: [],
    resources: [pool.resource],
    features: [{
      id: 'hb_standard_feat', name: 'Last Line', description: '', source: { kind: 'item', refId: 'hb_standard' },
      level: null, effects: [], actions: [], choices: [], passive: false,
      activation: chargeActivation({ actionType: pool.actionType, range: 'self', target: 'single', requiresSave: null }, pool.resourceId, pool.cost),
    }],
  };
}
const carrying = (id: string): Entity => {
  const e = makeEmptyEntity('c');
  return { ...e, inventory: { ...e.inventory, carried: [{ itemId: id, quantity: 1, attuned: false, features: [] }] } };
};

describe('buildItemCharges', () => {
  it('returns null when disabled', () => {
    expect(buildItemCharges('x', 'X', newItemChargesDraft())).toBeNull();
  });
  it('compiles max/starting/recharge/cost and clamps bad input', () => {
    const r = buildItemCharges('x', 'Wand', { ...newItemChargesDraft(), enabled: true, max: '7', starting: '2', cost: '2', recharge: 'long_rest' })!;
    expect(r.resource).toEqual({ resourceId: 'x_charges', name: 'Wand (Charges)', maximum: 7, recharge: 'long_rest', starting: 2 });
    expect(r.cost).toBe(2);
    const bad = buildItemCharges('x', 'Wand', { ...newItemChargesDraft(), enabled: true, max: 'zzz', starting: '99', cost: '0' })!;
    expect(bad.resource.maximum).toBe(1);
    expect(bad.cost).toBe(1);
  });
  it('free-text recharge is carried verbatim (manual, never auto-restored)', () => {
    const r = buildItemCharges('x', 'Wand', { ...newItemChargesDraft(), enabled: true, recharge: 'other', rechargeOther: 'when you win a duel' })!;
    expect(r.resource.recharge).toBe('when you win a duel');
  });
});

describe('item charge pool on a character', () => {
  it('registers a full pool on first equip, sourced to the item', () => {
    const e = equipItem(carrying('hb_standard'), 'hb_standard', standard(), DEFAULT_RULES);
    const pool = e.resources.custom.find(r => r.id === 'hb_standard_charges')!;
    expect(pool).toMatchObject({ current: 3, maximum: 3, recharge: 'dawn', sourceKind: 'item', sourceId: 'hb_standard' });
  });
  it('honors a lower starting count', () => {
    const def = standard();
    def.resources = [{ ...def.resources![0], starting: 1 }];
    const e = equipItem(carrying('hb_standard'), 'hb_standard', def, DEFAULT_RULES);
    expect(e.resources.custom[0].current).toBe(1);
  });
  it('spent charges survive unequip/re-equip and refill only on dawn', () => {
    let e = equipItem(carrying('hb_standard'), 'hb_standard', standard(), DEFAULT_RULES);
    e = { ...e, resources: { ...e.resources, custom: e.resources.custom.map(r => ({ ...r, current: 0 })) } };
    e = unequipItem(e, 'hb_standard', DEFAULT_RULES);
    e = equipItem(e, 'hb_standard', standard(), DEFAULT_RULES);
    expect(e.resources.custom.filter(r => r.id === 'hb_standard_charges')).toHaveLength(1);
    expect(e.resources.custom[0].current).toBe(0);
    expect(takeDawn(e, DEFAULT_RULES).resources.custom[0].current).toBe(3);
  });
});
