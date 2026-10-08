import { FULL_ITEM_LIBRARY } from '../../content/items';
import { makeEmptyEntity, DEFAULT_RULES } from '../../store/characterStore';
import { generateAllActionCards } from '../actionCards';
import { hydrateEntityItemDefinitionFacts } from '../itemMechanics';
import { toggleAttunement } from '../inventory';
import { recomputeDerived } from '../pipeline';
import type { Entity, Feature } from '../types';

const mockDefinitions = new Map(FULL_ITEM_LIBRARY.map(item => [item.id, item]));
jest.mock('../../content/itemRepo', () => ({ itemRepo: { init: jest.fn(), getIndex: jest.fn(() => []), ensureLoaded: jest.fn(), getItemSync: jest.fn((id: string) => mockDefinitions.get(id)) } }));
const stale = (id: string, features: Feature[]): Entity => {
  const entity = makeEmptyEntity('stale-item');
  entity.inventory.equipped = [{ itemId: id, quantity: 1, attuned: false, features }];
  return entity;
};

describe('authoritative definition features replace stale legacy copies', () => {
  it('stale Bracers copy cannot bypass the current no-armor predicate', () => {
    const bracers = mockDefinitions.get('bracers_of_defense')!;
    const old = bracers.features.map(feature => ({ ...feature, effects: feature.effects.map(effect => ({ ...effect, requiresNoArmorOrShield: undefined })) }));
    const entity = stale('bracers_of_defense', old);
    entity.inventory.equipped[0].attuned = true;
    expect(recomputeDerived(entity, DEFAULT_RULES).derived.ac).toBe(12);
    entity.inventory.equipped.push({ itemId: 'leather_armor', quantity: 1, attuned: false, features: [] });
    expect(recomputeDerived(entity, DEFAULT_RULES).derived.ac).toBe(11);
    entity.inventory.equipped.pop();
    expect(recomputeDerived(entity, DEFAULT_RULES).derived.ac).toBe(12);
  });

  it('stale nonempty Ring features remain gated by current attunement through save/reload', () => {
    const ring = mockDefinitions.get('ring_of_protection')!;
    const staleFeatures = ring.features.map(feature => ({ ...feature, effects: feature.effects.map(effect => ({ ...effect, value: 99 })) }));
    let entity = recomputeDerived(stale('ring_of_protection', staleFeatures), DEFAULT_RULES);
    expect(entity.derived.ac).toBe(10);
    entity = recomputeDerived(toggleAttunement(entity, 'ring_of_protection'), DEFAULT_RULES);
    expect(entity.derived.ac).toBe(11);
    entity = hydrateEntityItemDefinitionFacts(JSON.parse(JSON.stringify(entity)));
    expect(recomputeDerived(entity, DEFAULT_RULES).derived.ac).toBe(11);
    expect(recomputeDerived(toggleAttunement(entity, 'ring_of_protection'), DEFAULT_RULES).derived.ac).toBe(10);
  });

  it('pipeline and action cards use the same current weapon feature set', () => {
    const longsword = mockDefinitions.get('longsword')!;
    const staleAttack = { ...longsword.features[0], id: 'stale_attack', abilityEffects: [{ type: 'damage', dice: '99d99', damageType: 'force' }] } as Feature;
    const entity = recomputeDerived(stale('longsword', [staleAttack]), DEFAULT_RULES);
    expect(entity.derived.attackBonuses.find(attack => attack.id === 'longsword')?.damageDice).toBe('1d8');
    const cards = generateAllActionCards(entity);
    expect(cards.some(card => card.featureId === 'stale_attack')).toBe(false);
    expect(cards.some(card => card.featureId === 'longsword_attack')).toBe(true);
  });
});
