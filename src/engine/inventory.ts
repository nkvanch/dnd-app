// src/engine/inventory.ts
// Pure equip/unequip mutators, extracted out of app/sheet/[id].tsx's old
// inline handleEquip/handleUnequip closures so they can be used as
// simulate() mutators (which need a synchronous (Entity) => Entity — the
// only async part of the original handleEquip was resolving the item's
// definition via itemRepo, which is I/O and stays in the UI layer).
import { Entity, Item, ItemInstance, CampaignRules } from './types';
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

/**
 * The bulk-imported item catalog's "requires attunement" property tagging is
 * incomplete — spot-checked while building this feature: Ring of Protection
 * (a real, classic attunement item, and one of the 5 named items below that
 * ITEM_EFFECT_OVERRIDES in src/content/items/index.ts gives a real simulated
 * stat_modifier effect) carries only `properties: ["rare"]`, no attunement
 * tag at all. Rather than silently miss attunement enforcement on exactly
 * the items whose bonus is actually simulated, hardcode this small,
 * independently-verified set (all 5 require attunement per the real rules)
 * as a second signal alongside the properties-text parse below. Doesn't fix
 * the broader catalog's tagging gaps for items with no simulated effect —
 * a real, disclosed limitation, not silently claimed as complete.
 */
const KNOWN_ATTUNEMENT_ITEM_IDS = new Set([
  'ring_of_protection', 'cloak_of_protection', 'bracers_of_defense',
  'amulet_of_health', 'headband_of_intellect',
]);

/**
 * True when an item requires attunement — either the bulk-imported catalog's
 * free-text properties disclose it ("requires attunement" is how every
 * SRD/imported magic item that has the tag states it), or the item is one of
 * the small curated set above whose tagging is known to be missing.
 */
export function itemRequiresAttunement(item: Item | undefined): boolean {
  if (!item) return false;
  if (KNOWN_ATTUNEMENT_ITEM_IDS.has(item.id)) return true;
  return item.properties.some(p => p.toLowerCase().includes('requires attunement'));
}

/**
 * How many items this entity can be attuned to at once. Base 3 per the
 * rules. Checked by feature id rather than a generic effect/derived stat,
 * since these are the only content in the whole library that change the
 * cap: Artificer's Magic Item Adept/Savant/Master (4/5/6, each supersedes
 * the last rather than stacking) and the Mystic Conflux feat (+1).
 */
export function attunementCap(entity: Entity): number {
  const ids = new Set(entity.features.map(f => f.id));
  let cap = 3;
  if (ids.has('magic_item_master')) cap = 6;
  else if (ids.has('magic_item_savant')) cap = 5;
  else if (ids.has('magic_item_adept')) cap = 4;
  if (ids.has('feat_mystic_conflux')) cap += 1;
  return cap;
}

/** Count of currently-attuned item instances, carried or equipped. */
export function countAttuned(entity: Entity): number {
  return [...entity.inventory.equipped, ...entity.inventory.carried].filter(i => i.attuned).length;
}

/**
 * Flips an item instance's attuned flag. Un-attuning always succeeds;
 * attuning is refused (entity returned unchanged) once attunementCap(entity)
 * is already reached. This is a backstop only — callers should check
 * countAttuned()/attunementCap() themselves to disable the UI affordance and
 * explain why, rather than relying on a silent no-op here. No-op if itemId
 * isn't in carried or equipped.
 */
export function toggleAttunement(entity: Entity, itemId: string): Entity {
  const inst = entity.inventory.equipped.find(i => i.itemId === itemId)
            ?? entity.inventory.carried.find(i => i.itemId === itemId);
  if (!inst) return entity;
  if (!inst.attuned && countAttuned(entity) >= attunementCap(entity)) return entity;
  const flip = (list: ItemInstance[]) =>
    list.map(i => i.itemId === itemId ? { ...i, attuned: !i.attuned } : i);
  return {
    ...entity,
    inventory: {
      ...entity.inventory,
      equipped: flip(entity.inventory.equipped),
      carried:  flip(entity.inventory.carried),
    },
  };
}
