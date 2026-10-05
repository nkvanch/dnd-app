import { Entity, Item, ItemInstance } from './types';
import { itemRepo } from '../content/itemRepo';
import { armorWeight, baseWeaponIdFromName, isShield, isWeapon } from '../content/items/itemBrowse';
import { ItemIndexEntry, toItemIndexEntry } from '../content/itemRepo.types';

const KNOWN_ATTUNEMENT_ITEM_IDS = new Set([
  'ring_of_protection', 'cloak_of_protection', 'bracers_of_defense',
  'amulet_of_health', 'headband_of_intellect',
]);

/**
 * Item-identity closure: the ONE id-generation convention for a new owned
 * ItemInstance — same shape as equipmentDisplay.ts's pre-existing
 * acquisitionSourceId generator (Date.now + Math.random, base36), the
 * established per-row identity pattern already used in this codebase.
 * Lives here (not inventory.ts, which imports DEFAULT_RULES from
 * characterStore.ts) specifically so characterStore.ts's own load-time
 * migration hydration can import it without a circular dependency;
 * inventory.ts re-exports it for its own existing callers. Called only at
 * mutation/application boundaries (add/duplicate/migration) — never inside
 * recomputeDerived or another pure derivation function, which must only
 * ever CONSUME an already-stable id.
 */
export function generateItemInstanceId(): string {
  return 'item:' + Date.now().toString(36) + ':' + Math.random().toString(36).slice(2);
}

/**
 * Item-identity closure (pass 2, finding A): the ONE reusable legacy
 * ItemInstance identity hydrator — assigns a deterministic id
 * (`legacy:<entityId>:<side>:<index>:<itemId>`) to any owned instance that
 * doesn't already have one, and leaves every instance that already has an
 * id completely untouched. Deliberately does NOT resolve content
 * definitions (no itemRepo/homebrew lookup — unlike
 * hydrateItemInstanceDefinitionFacts) and does NOT read Zustand, so it's
 * safe to call from every path that can hand a deserialized Entity to
 * normal runtime: characterStore.ts's own boot-time load hydration, portable
 * character import (characterPortable.ts), and any other direct-import path
 * (backup restore / inbound sync's applyIncomingEntity) that would
 * otherwise bypass boot hydration entirely and expose an identity-less
 * legacy item straight into gameplay. Never called from recomputeDerived or
 * another pure derivation function — those only ever CONSUME an
 * already-stable id.
 *
 * Deterministic-by-array-position is safe specifically because this only
 * ever assigns an id to a row that doesn't have one yet; once a row has a
 * real id (from here, from creation, or from a prior call to this same
 * function), it's never touched again, and normal mutations (equip/
 * unequip/remove) never reorder either array — they only splice/filter/
 * push — so a not-yet-persisted legacy character re-hydrates the exact same
 * ids on every subsequent load until a real mutation persists them for good.
 */
export function hydrateLegacyItemInstanceIds(entity: Entity): Entity {
  // Malformed/partial data (e.g. a hand-crafted invalid import fixture, or
  // truly corrupt persisted JSON) may not even have a well-shaped
  // inventory yet — leave it untouched and let the caller's own structural
  // validator (validateEntityShape/validateEntityDeep) report that clearly,
  // rather than this hydrator throwing a confusing low-level TypeError
  // before validation ever runs.
  if (!entity.inventory || !Array.isArray(entity.inventory.equipped) || !Array.isArray(entity.inventory.carried)) {
    return entity;
  }
  // Item-identity closure (pass 3, finding A): reserve every ALREADY-
  // SUPPLIED nonempty id first, across BOTH collections, before assigning
  // anything — otherwise a deterministic legacy candidate synthesized for
  // one missing row could collide with a real id another row already
  // carries (e.g. a modern instance whose real id happens to equal what
  // this function would have generated for a different legacy row).
  // Deliberately does NOT touch or "repair" two rows that already share a
  // supplied id — that's invalid modern data, left visible for
  // validateEntityDeep to reject, never silently rewritten by a hydrator
  // whose whole job is filling in what's MISSING, not fixing what's wrong.
  const reserved = new Set<string>();
  for (const inst of [...entity.inventory.equipped, ...entity.inventory.carried]) {
    if (inst.id) reserved.add(inst.id);
  }

  /**
   * Item-identity closure (pass 3, finding B): a row is only MISSING an id
   * when the field is absent entirely (undefined/null) — a present-but-
   * empty-string id is malformed SUPPLIED data, not a gap to fill, and must
   * stay visible for validateEntityDeep to reject. `!inst.id` alone can't
   * tell those two cases apart (both are falsy), so this checks presence of
   * the key itself.
   */
  function isMissingId(inst: ItemInstance): boolean {
    return !('id' in inst) || inst.id === undefined || inst.id === null;
  }

  /**
   * Deterministic, collision-aware allocation for one missing-id row:
   * starts from the existing legacy candidate shape and, only if that's
   * already taken (by a supplied id OR by another row hydrated earlier in
   * this SAME pass), deterministically appends `:2`, `:3`, ... until an
   * unused candidate is found. No randomness — the same input (entity id,
   * side, index, itemId, and the same set of already-reserved ids)
   * produces the same output every time.
   */
  function allocateLegacyId(side: 'equipped' | 'carried', index: number, itemId: string): string {
    const base = `legacy:${entity.id}:${side}:${index}:${itemId}`;
    if (!reserved.has(base)) return base;
    let n = 2;
    let candidate = `${base}:${n}`;
    while (reserved.has(candidate)) {
      n += 1;
      candidate = `${base}:${n}`;
    }
    return candidate;
  }

  function withId(side: 'equipped' | 'carried') {
    return (inst: ItemInstance, index: number): ItemInstance => {
      if (!isMissingId(inst)) return inst;
      const id = allocateLegacyId(side, index, inst.itemId);
      reserved.add(id); // reserve immediately so the NEXT missing row in this pass can't collide with it either
      return { ...inst, id };
    };
  }
  const equipped = entity.inventory.equipped.map(withId('equipped'));
  const carried  = entity.inventory.carried.map(withId('carried'));
  if (
    equipped.every((h, i) => h === entity.inventory.equipped[i]) &&
    carried.every( (h, i) => h === entity.inventory.carried[i])
  ) return entity; // nothing changed — avoid unnecessary object creation
  return { ...entity, inventory: { ...entity.inventory, equipped, carried } };
}

/**
 * Rules-engine blocker RE-AUDIT closure (dependency inversion, 1D):
 * `homebrewItems` used to be resolved by reaching into
 * useHomebrewStore.getState() directly from inside this pure engine
 * function — a rules-core file must never read application/store state
 * implicitly. The APPLICATION layer now resolves the correct merged/
 * ruleset-filtered item list (getMergedContentDB(entity.rulesetId).items)
 * and passes it in explicitly; omitting it falls back to official-only
 * itemRepo content (a deterministic, static default) — correct for every
 * test and any caller that hasn't been updated to pass homebrew-aware
 * content, though it won't resolve a homebrew item in that case.
 */
export function resolveItemDefinition(itemId: string, homebrewItems: readonly Item[] = []): Item | undefined {
  return itemRepo.getItemSync(itemId)
    ?? homebrewItems.find(item => item.id === itemId);
}

export function itemRequiresAttunement(item: Pick<Item, 'id' | 'properties'> | undefined): boolean {
  if (!item) return false;
  return KNOWN_ATTUNEMENT_ITEM_IDS.has(item.id)
    || item.properties.some(property => property.toLowerCase().includes('requires attunement'));
}

/** What the character is wearing, for effects gated on armor ("while you aren't wearing Heavy armor"). */
export type WornGear = { armor: 'none' | 'light' | 'medium' | 'heavy'; shield: boolean };

export function wornGearOf(equipped: readonly ItemInstance[], resolve: (itemId: string) => Item | undefined): WornGear {
  const rank = { none: 0, light: 1, medium: 2, heavy: 3 } as const;
  let armor: WornGear['armor'] = 'none';
  let shield = false;
  for (const i of equipped) {
    // The catalog when it resolves, otherwise the facts hydrated onto the instance when it was equipped.
    const def = resolve(i.itemId);
    const entry = def ? toItemIndexEntry(def) : undefined;
    const w = entry ? armorWeight(entry) : (i.armorWeight ?? null);
    if (w && rank[w] > rank[armor]) armor = w;
    if (entry ? isShield(entry) : i.isShield === true) shield = true;
  }
  return { armor, shield };
}

export function itemWearsArmorOrShield(item: Item | undefined): boolean {
  if (!item) return false;
  const entry = toItemIndexEntry(item);
  return armorWeight(entry) !== null || isShield(entry);
}

/**
 * Item-identity closure (duplicate item-instance identity): the explicit
 * rule separating STATELESS/FUNGIBLE items (ordinary quantity stacking is
 * fine — arrows, rope, rations) from STATEFUL items, where two owned copies
 * must be able to carry independent mutable state (equipped/attuned/
 * infused/feature-granting) and must never be silently combined into one
 * shared row. True when the definition requires attunement, is a weapon,
 * is armor or a shield (all independently equippable/attunable per copy),
 * or declares any Feature at all (a magic item's mechanical effects are
 * exactly the state that must stay per-instance — this catches a
 * non-weapon/armor/attunement item like Broom of Flying too, whose only
 * signal is a real, if purely descriptive, authored feature). Everything
 * else (plain gear with no features and no equip/attune concept) is
 * fungible. Deliberately definition-only — an explicit content-driven rule
 * rather than a name-based heuristic (e.g. sniffing "Longsword" vs "Rope").
 *
 * Item-identity closure (pass 3, finding D): deliberately requires the
 * FULL resolved `Item`, never the lighter Tier-1 `ItemIndexEntry` — that
 * index doesn't carry the features array at all, so a feature-bearing item
 * with no damage effect and no attunement/weapon/armor/shield signal (e.g.
 * Broom of Flying) would silently misclassify as fungible if this ever
 * accepted it. Every caller must resolve the full definition first (see
 * resolveItemDefinition, itemMechanics.ts) — the SAME one authoritative
 * classifier for both ordinary inventory acquisition and creation/
 * Additional Equipment, never a second, creation-only definition of
 * "stateful."
 */
export function isStatefulItem(item: Item | ItemIndexEntry | undefined): boolean {
  if (!item) return false;
  const isFullDefinition = 'features' in item;
  const entry = isFullDefinition ? toItemIndexEntry(item) : item;
  return itemRequiresAttunement(item)
    || isWeapon(entry)
    || armorWeight(entry) !== null
    || isShield(entry)
    || (isFullDefinition ? item.features.length > 0 : item.hasFeatures === true);
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

/** Resolve attack features for weapons whose magic-item record only describes
 * the special property. Base weapon dice remain catalog data; this composes
 * them at runtime without inventing an activation for the passive feature. */
export function effectiveWeaponAttackFeatures(instance: ItemInstance, definition: Item | undefined, homebrewItems: readonly Item[] = []) {
  const own = effectiveItemFeatures(instance, definition);
  if (!definition || own.some(feature => feature.abilityEffects?.some(effect => effect.type === 'damage'))) return own;
  if (!isWeapon(toItemIndexEntry(definition))) return own;
  const baseId = baseWeaponIdFromName(definition.name);
  const baseDefinition = baseId && baseId !== definition.id
    ? itemRepo.getItemSync(baseId) ?? homebrewItems.find(item => item.id === baseId)
    : undefined;
  const attacks = baseDefinition?.features.filter(feature => feature.abilityEffects?.some(effect => effect.type === 'damage')) ?? [];
  return [...own, ...attacks];
}

/** Refresh immutable definition facts without overwriting mutable instance state. */
export function hydrateItemInstanceDefinitionFacts(
  instance: ItemInstance, definition: Item | undefined,
): ItemInstance {
  if (!definition) return instance;
  const features = effectiveItemFeatures(instance, definition);
  const requiresAttunement = itemRequiresAttunement(definition);
  const wearsArmorOrShield = itemWearsArmorOrShield(definition);
  const entry = toItemIndexEntry(definition);
  const weight = armorWeight(entry) ?? undefined;
  const shield = isShield(entry);
  if (features === instance.features
    && requiresAttunement === instance.requiresAttunement
    && wearsArmorOrShield === instance.wearsArmorOrShield
    && weight === instance.armorWeight && (shield || undefined) === (instance.isShield || undefined)) return instance;
  return { ...instance, features, requiresAttunement, wearsArmorOrShield, armorWeight: weight, isShield: shield };
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
