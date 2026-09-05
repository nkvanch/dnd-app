// src/engine/inventory.ts
// Pure equip/unequip mutators, extracted out of app/sheet/[id].tsx's old
// inline handleEquip/handleUnequip closures so they can be used as
// simulate() mutators (which need a synchronous (Entity) => Entity — the
// only async part of the original handleEquip was resolving the item's
// definition via itemRepo, which is I/O and stays in the UI layer).
import { Entity, Item, CampaignRules } from './types';
import { recomputeDerived } from './pipeline';
import { DEFAULT_RULES } from '../store/characterStore';

/**
 * itemDef must already be resolved by the caller (itemRepo.ensureLoaded +
 * getItemSync, or a homebrew lookup) — this function does no I/O. No-op
 * (returns entity unchanged) if itemId isn't in carried.
 */
export function equipItem(
  entity:  Entity,
  itemId:  string,
  itemDef: Item | undefined,
  rules:   CampaignRules = DEFAULT_RULES,
): Entity {
  const inst = entity.inventory.carried.find(i => i.itemId === itemId);
  if (!inst) return entity;
  // Hydrate features from the content definition at equip time — inventory
  // instances are created with features: [] (resolveChoice and the
  // equipment screen only store the itemId), so without this, equipping
  // armor adds an item with zero effects and AC never changes.
  const hydrated = itemDef ? { ...inst, features: itemDef.features } : inst;
  const updated: Entity = {
    ...entity,
    inventory: {
      ...entity.inventory,
      carried:  entity.inventory.carried.filter(i => i.itemId !== itemId),
      equipped: [...entity.inventory.equipped, hydrated],
    },
  };
  return recomputeDerived(updated, rules);
}

/**
 * No-op (returns entity unchanged) if itemId isn't in equipped. No I/O —
 * the instance being unequipped already carries its own hydrated features.
 */
export function unequipItem(
  entity: Entity,
  itemId: string,
  rules:  CampaignRules = DEFAULT_RULES,
): Entity {
  const inst = entity.inventory.equipped.find(i => i.itemId === itemId);
  if (!inst) return entity;
  const updated: Entity = {
    ...entity,
    inventory: {
      ...entity.inventory,
      equipped: entity.inventory.equipped.filter(i => i.itemId !== itemId),
      carried:  [...entity.inventory.carried, inst],
    },
  };
  return recomputeDerived(updated, rules);
}
