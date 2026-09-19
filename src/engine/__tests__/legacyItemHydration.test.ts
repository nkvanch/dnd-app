import { FULL_ITEM_LIBRARY } from '../../content/items';
import { makeEmptyEntity, DEFAULT_RULES } from '../../store/characterStore';
import { hydrateEntityItemDefinitionFacts } from '../itemMechanics';
import { recomputeDerived } from '../pipeline';
import { generateAllActionCards } from '../actionCards';
import type { Entity } from '../types';
import { toggleAttunement } from '../inventory';

const mockDefinitions = new Map(FULL_ITEM_LIBRARY.map(item => [item.id, item]));
jest.mock('../../content/itemRepo', () => ({
  itemRepo: {
    init: jest.fn(), getIndex: jest.fn(() => []), ensureLoaded: jest.fn(),
    getItemSync: jest.fn((id: string) => mockDefinitions.get(id)),
  },
}));

function equipped(...ids: string[]) {
  const entity = makeEmptyEntity('legacy-items');
  return {
    ...entity,
    inventory: { ...entity.inventory, equipped: ids.map(itemId => ({ itemId, quantity: 1, attuned: false, features: [] })) },
  };
}

describe('legacy item definition hydration', () => {
  it('old Ring of Protection stays inactive until attuned and survives JSON reload', () => {
    let entity = hydrateEntityItemDefinitionFacts(equipped('ring_of_protection'));
    expect(entity.inventory.equipped[0].requiresAttunement).toBe(true);
    expect(recomputeDerived(entity, DEFAULT_RULES).derived.ac).toBe(10);
    entity = recomputeDerived(toggleAttunement(entity, 'ring_of_protection'), DEFAULT_RULES);
    expect(entity.derived.ac).toBe(11);
    const reloaded = hydrateEntityItemDefinitionFacts(JSON.parse(JSON.stringify(entity)));
    expect(recomputeDerived(reloaded, DEFAULT_RULES).derived.ac).toBe(11);
    expect(recomputeDerived(toggleAttunement(reloaded, 'ring_of_protection'), DEFAULT_RULES).derived.ac).toBe(10);
  });

  it('uses the same definition-derived attunement gate for effects, actions, and attacks', () => {
    const definition = mockDefinitions.get('ring_of_protection')!;
    const bonusFeature = definition.features.find(feature => feature.effects.length > 0)!;
    const activeFeature = { ...bonusFeature, activation: { actionType: 'action', resourceCost: null, range: 'self', target: 'self', requiresSave: null } } as any;
    mockDefinitions.set('ring_of_protection', { ...definition, features: [activeFeature] });
    try {
      let entity: Entity = equipped('ring_of_protection');
      entity = recomputeDerived(entity, DEFAULT_RULES);
      expect(entity.derived.ac).toBe(10);
      expect(generateAllActionCards(entity).some(card => card.featureId === activeFeature.id)).toBe(false);
      entity = recomputeDerived(toggleAttunement(entity, 'ring_of_protection'), DEFAULT_RULES);
      expect(entity.derived.ac).toBe(11);
      expect(generateAllActionCards(entity).some(card => card.featureId === activeFeature.id)).toBe(true);
      expect(entity.derived.attackBonuses.some(attack => attack.id === 'ring_of_protection')).toBe(false);
    } finally { mockDefinitions.set('ring_of_protection', definition); }
  });

  it('derives armor and shield classification from definitions missing on old instances', () => {
    const shield = mockDefinitions.has('shield') ? 'shield' : [...mockDefinitions.keys()].find(id => id.includes('shield'))!;
    let entity = hydrateEntityItemDefinitionFacts(equipped('bracers_of_defense', shield));
    entity = { ...entity, inventory: { ...entity.inventory, equipped: entity.inventory.equipped.map(item =>
      item.itemId === 'bracers_of_defense' ? { ...item, attuned: true } : item) } };
    const shieldInstance = entity.inventory.equipped.find(item => item.itemId === shield)!;
    expect(shieldInstance.wearsArmorOrShield).toBe(true);
    expect(recomputeDerived(entity, DEFAULT_RULES).derived.ac).toBeGreaterThanOrEqual(12);
    const withoutShield = { ...entity, inventory: { ...entity.inventory, equipped: entity.inventory.equipped.filter(item => item.itemId !== shield) } };
    expect(recomputeDerived(withoutShield, DEFAULT_RULES).derived.ac).toBe(12);
  });
});
