import { Entity, Item, ItemInstance } from './types';
import { itemRepo } from '../content/itemRepo';
import { useHomebrewStore } from '../store/homebrewStore';
import { armorWeight, isShield } from '../content/items/itemBrowse';
import { toItemIndexEntry } from '../content/itemRepo.types';

const KNOWN_ATTUNEMENT_ITEM_IDS = new Set([
  'ring_of_protection', 'cloak_of_protection', 'bracers_of_defense',
  'amulet_of_health', 'headband_of_intellect',
]);

export function resolveItemDefinition(itemId: string): Item | undefined {
  return itemRepo.getItemSync(itemId)
    ?? useHomebrewStore.getState().items.find(item => item.id === itemId);
}

export function itemRequiresAttunement(item: Pick<Item, 'id' | 'properties'> | undefined): boolean {
  if (!item) return false;
  return KNOWN_ATTUNEMENT_ITEM_IDS.has(item.id)
    || item.properties.some(property => property.toLowerCase().includes('requires attunement'));
}

export function itemWearsArmorOrShield(item: Item | undefined): boolean {
  if (!item) return false;
  const entry = toItemIndexEntry(item);
  return armorWeight(entry) !== null || isShield(entry);
}

/** Resolve one authoritative feature set. Legacy instance.features historically copied
 * definition features, so they cannot override a resolved current definition. The only
 * existing explicit instance-only feature is the feature named by infusedWith. */
export function effectiveItemFeatures(instance: ItemInstance, definition: Item | undefined) {
  if (!definition) return instance.features;
  const infusionId = instance.infusedWith ? `infusion_${instance.infusedWith}` : null;
  const instanceOnly = infusionId ? instance.features.filter(feature => feature.id === infusionId) : [];
  const definitionIds = new Set(definition.features.map(feature => feature.id));
  return [...definition.features, ...instanceOnly.filter(feature => !definitionIds.has(feature.id))];
}

/** Refresh immutable definition facts without overwriting mutable instance state. */
export function hydrateItemInstanceDefinitionFacts(
  instance: ItemInstance, definition: Item | undefined,
): ItemInstance {
  if (!definition) return instance;
  const features = effectiveItemFeatures(instance, definition);
  const requiresAttunement = itemRequiresAttunement(definition);
  const wearsArmorOrShield = itemWearsArmorOrShield(definition);
  if (features === instance.features
    && requiresAttunement === instance.requiresAttunement
    && wearsArmorOrShield === instance.wearsArmorOrShield) return instance;
  return { ...instance, features, requiresAttunement, wearsArmorOrShield };
}

export function hydrateEntityItemDefinitionFacts(entity: Entity): Entity {
  const equipped = entity.inventory.equipped.map(instance =>
    hydrateItemInstanceDefinitionFacts(instance, resolveItemDefinition(instance.itemId)));
  const carried = entity.inventory.carried.map(instance =>
    hydrateItemInstanceDefinitionFacts(instance, resolveItemDefinition(instance.itemId)));
  if (equipped.every((item, i) => item === entity.inventory.equipped[i])
    && carried.every((item, i) => item === entity.inventory.carried[i])) return entity;
  return { ...entity, inventory: { ...entity.inventory, equipped, carried } };
}

/** One eligibility predicate shared by passive effects, attacks, and item actions. */
export function isItemMechanicallyActive(
  instance: ItemInstance,
  definition: Item | undefined,
): boolean {
  const requiresAttunement = definition
    ? itemRequiresAttunement(definition)
    : instance.requiresAttunement === true;
  return !requiresAttunement || instance.attuned;
}
