// src/engine/inventory.ts
// Pure equip/unequip mutators, extracted out of app/sheet/[id].tsx's old
// inline handleEquip/handleUnequip closures so they can be used as
// simulate() mutators (which need a synchronous (Entity) => Entity — the
// only async part of the original handleEquip was resolving the item's
// definition via itemRepo, which is I/O and stays in the UI layer).
import { Entity, Item, ItemInstance, CampaignRules, Feature } from './types';
import { recomputeDerived } from './pipeline';
import { DEFAULT_RULES } from '../store/characterStore';
import { hydrateItemInstanceDefinitionFacts, generateItemInstanceId } from './itemMechanics';

export { generateItemInstanceId } from './itemMechanics';

/** Finds one exact owned instance — by `instanceId` (`ItemInstance.id`)
 *  when given, since two instances can share `itemId`; falls back to the
 *  first `itemId` match for callers that haven't been updated to pass an
 *  instance id yet (legacy behavior, preserved for back-compat). */
function findInstance(list: ItemInstance[], itemId: string, instanceId?: string): ItemInstance | undefined {
  if (instanceId) return list.find(i => i.id === instanceId);
  return list.find(i => i.itemId === itemId);
}

/**
 * itemDef must already be resolved by the caller (itemRepo.ensureLoaded +
 * getItemSync, or a homebrew lookup) — this function does no I/O. No-op
 * (returns entity unchanged) if the target instance isn't in carried.
 *
 * `instanceId` (item-identity closure) — when supplied, targets that EXACT
 * owned copy; when omitted, falls back to the first `itemId` match (legacy
 * callers). Always pass it once the caller has a real ItemInstance in hand
 * (the UI iterates ItemInstance[] already — see TabInventory.tsx).
 */
export function equipItem(
  entity:     Entity,
  itemId:     string,
  itemDef:    Item | undefined,
  rules:      CampaignRules = DEFAULT_RULES,
  instanceId?: string,
): Entity {
  const inst = findInstance(entity.inventory.carried, itemId, instanceId);
  if (!inst) return entity;
  // Hydrate features from the content definition at equip time — inventory
  // instances are created with features: [] (resolveChoice and the
  // equipment screen only store the itemId), so without this, equipping
  // armor adds an item with zero effects and AC never changes. Re-audit
  // A17/A19: also hydrate requiresAttunement/wearsArmorOrShield the same
  // way, so the pure engine pipeline (collectAllEffects) can gate an
  // item's effects on attunement/equipment-predicates without needing its
  // own content-store lookup — see ItemInstance's own doc comments.
  const rawHydrated = hydrateItemInstanceDefinitionFacts(inst, itemDef);
  // Defensive backfill — every production creation path now assigns an id
  // up front (see generateItemInstanceId's own doc comment) and
  // characterStore.ts's load hydration backfills any legacy row missing
  // one, so this only guards a still-possible stale/malformed fixture.
  const hydrated = rawHydrated.id ? rawHydrated : { ...rawHydrated, id: generateItemInstanceId() };
  // Item-identity closure (no automatic destructive merging): equipping
  // NEVER folds into an existing equipped row anymore, even one sharing
  // itemId+infusion state — merging would silently combine two
  // independently-tracked instances' mutable state (attunement, features,
  // and which one an action card/resource lookup actually targets) into
  // one shared row, exactly the bug this closure exists to prevent. Two
  // equipped copies of the same item now legitimately stay two separate
  // rows, each with its own stable id — mirroring 5e RAW itself (e.g. two
  // daggers when dual-wielding each get their own attack).
  const updated: Entity = {
    ...entity,
    inventory: {
      ...entity.inventory,
      // Removed by reference, not by itemId — two carried rows can share an
      // itemId (independent stateful instances), and matching unequipItem's
      // own reference-based removal below keeps the invariant self-
      // enforcing rather than assumed.
      carried: entity.inventory.carried.filter(i => i !== inst),
      equipped: [...entity.inventory.equipped, hydrated],
    },
  };
  return recomputeDerived(updated, rules);
}

/**
 * No-op (returns entity unchanged) if the target instance isn't in
 * equipped. No I/O — the instance being unequipped already carries its own
 * hydrated features.
 *
 * `instanceId` — see equipItem's own doc comment; same targeting contract.
 */
export function unequipItem(
  entity:      Entity,
  itemId:      string,
  rules:       CampaignRules = DEFAULT_RULES,
  instanceId?: string,
): Entity {
  const inst = findInstance(entity.inventory.equipped, itemId, instanceId);
  if (!inst) return entity;
  // Item-identity closure (no automatic destructive merging): same as
  // equipItem above — the unequipped instance keeps its own row (and its
  // own attunement/features/id) in carried rather than being folded into
  // an existing carried row of the same itemId.
  const updated: Entity = {
    ...entity,
    inventory: {
      ...entity.inventory,
      // Removed by reference, not by itemId. Two equipped instances CAN
      // legitimately share an itemId (independent stateful copies, or an
      // infused and an uninfused copy of the same item), and
      // `.filter(i => i.itemId !== itemId)` would delete every one of them
      // while only ever restoring the single matched instance — a
      // confirmed silent data-loss bug (audit finding INV-1).
      equipped: entity.inventory.equipped.filter(i => i !== inst),
      carried: [...entity.inventory.carried, inst],
    },
  };
  return recomputeDerived(updated, rules);
}

export { itemRequiresAttunement, isStatefulItem } from './itemMechanics';

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
 * explain why, rather than relying on a silent no-op here. No-op if the
 * target instance isn't in carried or equipped.
 *
 * `instanceId` — item-identity closure: targets that EXACT owned copy when
 * given (two instances can share `itemId` with independent attunement —
 * see ItemInstance's own doc comment); falls back to the first `itemId`
 * match otherwise (legacy callers).
 */
export function toggleAttunement(entity: Entity, itemId: string, instanceId?: string): Entity {
  const inst = findInstance(entity.inventory.equipped, itemId, instanceId)
            ?? findInstance(entity.inventory.carried, itemId, instanceId);
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

/**
 * Item-identity closure (pass 2, finding B): pure infusion mutators,
 * extracted out of app/sheet/[id].tsx's own inline handleApplyInfusion
 * closure (same "extracted for testability, no expo-router import at
 * module scope" reasoning as equipItem/unequipItem's own header comment —
 * a route file can't be imported directly from Jest). `instanceId` targets
 * the EXACT selected owned copy (TabInventory's InfuseItemModal now
 * selects a real instance, not merely a definition); the `applied`/
 * `removed` single-match guard only matters for the itemId-only legacy
 * fallback (`.map()` would otherwise touch every same-definition row).
 * No cap/eligibility checking here — the caller (app/sheet/[id].tsx)
 * checks maxInfusedItems/already-infused before calling, same division of
 * responsibility as toggleAttunement's own "backstop only" doc comment.
 */
/**
 * Item-identity closure (pass 3, finding E): the itemId-only LEGACY
 * fallback (no `instanceId` supplied) must never silently pick "whichever
 * eligible row comes first" — that's exactly the ambiguous-duplicate bug
 * this whole closure exists to eliminate. Counts every instance in
 * `list` that matches `itemId` AND satisfies `eligible` (the caller's own
 * "can this specific mutation apply to it" predicate — not infused yet,
 * for an apply; currently infused, for a removal): exactly one eligible
 * match is the ONLY case where the legacy fallback may safely proceed
 * (there's no real ambiguity — a single candidate is a single candidate).
 * Zero or 2+ eligible matches return `undefined`, an explicit refusal
 * rather than an arbitrary pick.
 */
function resolveLegacyUniqueMatch(
  entity: Entity, itemId: string, eligible: (inst: ItemInstance) => boolean,
): ItemInstance | undefined {
  const matches = [...entity.inventory.equipped, ...entity.inventory.carried]
    .filter(inst => inst.itemId === itemId && eligible(inst));
  return matches.length === 1 ? matches[0] : undefined;
}

export function applyItemInfusion(
  entity: Entity, itemId: string, infusionId: string, feature: Feature | null, instanceId?: string,
): Entity {
  // Item-identity closure (pass 3, finding E1/E2): an explicit instanceId
  // targets that exact instance, unambiguously, no matter how many other
  // instances share itemId (unchanged behavior). Without one, the legacy
  // fallback resolves to a target ONLY when exactly one un-infused
  // instance of this itemId exists — two or more eligible duplicates
  // refuse (no-op) rather than infusing an arbitrary first match.
  const target = instanceId
    ? [...entity.inventory.equipped, ...entity.inventory.carried].find(i => i.id === instanceId && !i.infusedWith)
    : resolveLegacyUniqueMatch(entity, itemId, inst => !inst.infusedWith);
  if (!target) return entity;
  function applyTo(inst: ItemInstance): ItemInstance {
    if (inst !== target) return inst;
    return { ...inst, infusedWith: infusionId, features: feature ? [...inst.features, feature] : inst.features };
  }
  return {
    ...entity,
    inventory: {
      ...entity.inventory,
      equipped: entity.inventory.equipped.map(applyTo),
      carried:  entity.inventory.carried.map(applyTo),
    },
  };
}

/** See applyItemInfusion's own doc comment — the matching removal mutator.
 *  Eligibility for the legacy fallback here is "currently infused" (the
 *  state actually required to remove an infusion), not "un-infused." */
export function removeItemInfusion(entity: Entity, itemId: string, instanceId?: string): Entity {
  const target = instanceId
    ? [...entity.inventory.equipped, ...entity.inventory.carried].find(i => i.id === instanceId && !!i.infusedWith)
    : resolveLegacyUniqueMatch(entity, itemId, inst => !!inst.infusedWith);
  if (!target) return entity;
  function removeFrom(inst: ItemInstance): ItemInstance {
    if (inst !== target || !inst.infusedWith) return inst;
    const featureId = `infusion_${inst.infusedWith}`;
    return { ...inst, infusedWith: null, features: inst.features.filter(f => f.id !== featureId) };
  }
  return {
    ...entity,
    inventory: {
      ...entity.inventory,
      equipped: entity.inventory.equipped.map(removeFrom),
      carried:  entity.inventory.carried.map(removeFrom),
    },
  };
}
