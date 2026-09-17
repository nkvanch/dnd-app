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
  // Merge into an existing equipped stack of the same item (matching
  // infusion state) instead of adding a second row — mirrors
  // handleAddItem's carried-side stacking (app/sheet/[id].tsx). Without
  // this, two separately-acquired copies of the same item (e.g. two
  // daggers picked up in two different pickup+equip cycles) end up as two
  // independent equipped rows sharing one itemId, which unequipItem below
  // cannot safely tell apart (see audit finding INV-1).
  const existingEquipped = entity.inventory.equipped.find(
    i => i.itemId === itemId && (i.infusedWith ?? null) === (hydrated.infusedWith ?? null)
  );
  const equipped = existingEquipped
    ? entity.inventory.equipped.map(i => i === existingEquipped ? { ...i, quantity: i.quantity + hydrated.quantity } : i)
    : [...entity.inventory.equipped, hydrated];
  const updated: Entity = {
    ...entity,
    inventory: {
      ...entity.inventory,
      // Removed by reference, not by itemId — carried should never hold
      // two rows for one itemId (handleAddItem already stacks on add), but
      // matching unequipItem's own reference-based removal below keeps the
      // invariant self-enforcing rather than assumed.
      carried: entity.inventory.carried.filter(i => i !== inst),
      equipped,
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
  // Merge into an existing carried stack of the same item (matching
  // infusion state) instead of adding a second row — same reasoning as
  // equipItem's merge above.
  const existingCarried = entity.inventory.carried.find(
    i => i.itemId === itemId && (i.infusedWith ?? null) === (inst.infusedWith ?? null)
  );
  const carried = existingCarried
    ? entity.inventory.carried.map(i => i === existingCarried ? { ...i, quantity: i.quantity + inst.quantity } : i)
    : [...entity.inventory.carried, inst];
  const updated: Entity = {
    ...entity,
    inventory: {
      ...entity.inventory,
      // Removed by reference, not by itemId. Two equipped instances CAN
      // legitimately share an itemId (an infused and an uninfused copy of
      // the same item, or — before this fix — two separately-equipped
      // copies), and `.filter(i => i.itemId !== itemId)` deleted every one
      // of them while this function only ever restored the single `.find()`
      // match — a confirmed silent data-loss bug (audit finding INV-1).
      equipped: entity.inventory.equipped.filter(i => i !== inst),
      carried,
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
export function itemRequiresAttunement(
  item: { id: string; properties: string[] } | undefined,
): boolean {
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
  // Flip by reference, not itemId — otherwise two instances sharing an
  // itemId (e.g. an infused and uninfused copy) would both flip from one
  // toggle call, silently double-spending the attunement cap.
  const flip = (list: ItemInstance[]) =>
    list.map(i => i === inst ? { ...i, attuned: !i.attuned } : i);
  return {
    ...entity,
    inventory: {
      ...entity.inventory,
      equipped: flip(entity.inventory.equipped),
      carried:  flip(entity.inventory.carried),
    },
  };
}
