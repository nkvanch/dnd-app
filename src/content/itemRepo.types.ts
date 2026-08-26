// ============================================================================
// FILE: src/content/itemRepo.types.ts
// Shared types for itemRepo.ts (web/default) and itemRepo.native.ts
// (SQLite-backed). Mirrors spellRepo.types.ts's design exactly — see that
// file's header for the full rationale.
// ============================================================================
import { Item, ItemInstance } from '../engine/types';

/**
 * Tier 1 — the lightweight fields browse/sort/classify UIs actually key on
 * (TabInventory's AddItemModal: search, category classification, rarity,
 * cost/weight sort — see propsLower/isMagic/rarityRank/costInCopper there).
 * Deliberately excludes `features` (the bulk of an Item record's size —
 * activation, abilityEffects, descriptive text) — that's Tier 2.
 */
export type ItemIndexEntry = {
  id:         string;
  name:       string;
  weight:     number;
  cost:       string;
  properties: string[];
  /**
   * Whether any feature on this item has a 'damage' abilityEffect, and that
   * feature's activation range — the weapon-classification fallback
   * TabInventory.tsx's isWeapon()/isRangedWeapon() use for items whose name
   * and properties don't otherwise identify them as a weapon. Derived at
   * generation time (see scripts/generate-content-db.mjs's
   * findDamageFeature) so Tier 1 doesn't need the full features array just
   * for this one check.
   */
  hasDamageEffect: boolean;
  weaponRange:     string | null;
  srd?:       boolean;
};

export interface ItemRepo {
  /** Must be called once at app startup before any other method is used. */
  init(): Promise<void>;
  /** The full lightweight index — every item, eager, already SRD-filtered. */
  getIndex(): ItemIndexEntry[];
  /** Warms the Tier-2 full-record cache for the given ids. Idempotent. */
  ensureLoaded(ids: string[]): Promise<void>;
  /** Synchronous full-record lookup. Only returns a hit for ids already passed to ensureLoaded(). */
  getItemSync(id: string): Item | undefined;
}

/**
 * Normalizes a full Item (e.g. a homebrew item, which has no precomputed
 * Tier-1 row) into an ItemIndexEntry so it can be merged into an
 * itemRepo.getIndex() array for browse/classification UIs — see
 * TabInventory.tsx's AddItemModal. Mirrors
 * scripts/generate-content-db.mjs's findDamageFeature exactly.
 */
export function toItemIndexEntry(item: Item): ItemIndexEntry {
  const damageFeature = item.features.find(f => (f.abilityEffects ?? []).some(e => e.type === 'damage')) ?? null;
  return {
    id:              item.id,
    name:            item.name,
    weight:          item.weight,
    cost:            item.cost,
    properties:      item.properties,
    hasDamageEffect: !!damageFeature,
    weaponRange:     damageFeature?.activation?.range ?? null,
    srd:             item.srd,
  };
}

/** Every item id a character actually references — equipped + carried. */
export function itemIdsOnEntity(
  entity: { inventory?: { equipped?: ItemInstance[]; carried?: ItemInstance[] } }
): string[] {
  const ids = new Set<string>();
  for (const inst of entity.inventory?.equipped ?? []) ids.add(inst.itemId);
  for (const inst of entity.inventory?.carried ?? [])  ids.add(inst.itemId);
  return Array.from(ids);
}
