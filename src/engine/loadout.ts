// ============================================================================
// FILE: src/engine/loadout.ts
// Item 13 (build comparison/checkpoints/loadouts) — the "loadouts" third of
// that backlog item. Scoped deliberately smaller than the other two:
//
// - "Checkpoints" (save/restore an ENTIRE character snapshot) was already
//   explicitly considered and deferred once, in the persistent-timeline
//   track's own design notes (src/db/timelineRepo.ts's header comment):
//   "restoring an ARBITRARY past character snapshot is a much bigger,
//   riskier can of worms" than undo/redo already covers. That reasoning
//   still holds — not revisited here.
// - "Build comparison" (diff two independently-hypothesized builds side by
//   side) would need a new two-entity diff/row-builder on top of the
//   existing single-lineage buildLevelUpSummaryRows-style pattern — real,
//   separate work, not built here.
//
// A Loadout is just a named, saved (equipped items, prepared spells) pair —
// low-risk (nothing about the character's progression/identity is touched,
// only carried<->equipped movement and the prepared-spell list) and reuses
// the already-existing, already-tested equipItem/unequipItem pure mutators
// rather than hand-rolling inventory movement again.
// ============================================================================
import { Entity, Item, CampaignRules, Loadout } from './types';
import { equipItem, unequipItem } from './inventory';
import { recomputeDerived } from './pipeline';
import { DEFAULT_RULES } from '../store/characterStore';

function genId(): string {
  return `loadout_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Snapshots the entity's CURRENT equipped items + prepared spells into a
 *  new named Loadout. Does not mutate the entity or save it anywhere —
 *  the caller appends the result to entity.loadouts.
 *
 *  Item-identity closure (pass 2, finding E1): captures BOTH the
 *  definition ids (`equippedItemIds` — kept for display/ensureLoaded) AND
 *  the owned instance ids (`equippedItemInstanceIds` — the real targeting
 *  key applyLoadout now uses). Two identical equipped items each keep
 *  their own entry in the instance-id list; a bare `itemId` array alone
 *  would collapse them if ever de-duplicated through a Set. */
export function captureLoadout(entity: Entity, name: string): Loadout {
  return {
    id:                      genId(),
    name:                    name.trim() || 'Loadout',
    equippedItemIds:         entity.inventory.equipped.map(i => i.itemId),
    equippedItemInstanceIds: entity.inventory.equipped.map(i => i.id ?? i.itemId),
    preparedSpellIds:        entity.spellcasting?.prepared ?? [],
    createdAt:               Date.now(),
  };
}

/**
 * Applies a saved Loadout: moves items between carried/equipped to match
 * `loadout.equippedItemIds` exactly, and (for a prepared caster) replaces
 * `spellcasting.prepared` with `loadout.preparedSpellIds` intersected
 * against what the entity currently KNOWS — a spell the loadout remembers
 * but the character no longer knows (forgotten at a level-up since the
 * loadout was saved) is silently dropped rather than producing an invalid
 * prepared-spell entry; this is the same "resolve against current state,
 * don't trust a stale snapshot verbatim" principle applyLoadout's own
 * equip/unequip loop follows (an item id missing from `itemDefs` or no
 * longer carried is skipped, not an error).
 *
 * `itemDefs` must already be resolved by the caller (itemRepo.ensureLoaded
 * + getItemSync, or a homebrew lookup) for every id in
 * `loadout.equippedItemIds` NOT already equipped — same I/O-stays-in-the-
 * UI-layer contract equipItem itself already has. A missing/undefined
 * resolution for an item that needs equipping still equips the instance,
 * just without re-hydrating its features (matches equipItem's own
 * already-established fallback behavior).
 *
 * Items currently equipped that the loadout doesn't want are unequipped;
 * items the loadout wants that are already equipped are left untouched
 * (no needless move) — a minimal-diff swap, not an unequip-everything-
 * then-reequip.
 */
export function applyLoadout(
  entity:   Entity,
  loadout:  Loadout,
  itemDefs: Record<string, Item | undefined>,
  rules:    CampaignRules = DEFAULT_RULES,
): Entity {
  let updated = entity;

  // Item-identity closure (pass 2, finding E2/E4): a MODERN loadout
  // (equippedItemInstanceIds present) targets exact owned copies — two
  // identical swords stay distinguishable, and applying Loadout 1 vs
  // Loadout 2 equips the SPECIFIC instance each one saved, never
  // whichever same-definition copy happens to be first. A LEGACY loadout
  // (saved before this field existed) has no way to know WHICH historical
  // duplicate it meant, so it falls back to the original itemId-only
  // matching — equipItem/unequipItem's own established "first eligible
  // match" semantics for a caller that omits instanceId — a documented,
  // least-destructive compromise, not a claim that legacy data secretly
  // encodes per-copy intent it never captured.
  if (loadout.equippedItemInstanceIds) {
    const wantInstanceIds = new Set(loadout.equippedItemInstanceIds);
    for (const inst of entity.inventory.equipped) {
      if (!wantInstanceIds.has(inst.id ?? inst.itemId)) {
        updated = unequipItem(updated, inst.itemId, rules, inst.id);
      }
    }
    for (const instanceId of loadout.equippedItemInstanceIds) {
      if (updated.inventory.equipped.some(i => (i.id ?? i.itemId) === instanceId)) continue;
      const carriedInst = updated.inventory.carried.find(i => (i.id ?? i.itemId) === instanceId);
      if (!carriedInst) continue; // no longer owned — skip, same "resolve against current state" rule as prepared spells below
      updated = equipItem(updated, carriedInst.itemId, itemDefs[carriedInst.itemId], rules, carriedInst.id);
    }
  } else {
    const wantEquipped = new Set(loadout.equippedItemIds);
    for (const inst of entity.inventory.equipped) {
      if (!wantEquipped.has(inst.itemId)) {
        updated = unequipItem(updated, inst.itemId, rules);
      }
    }
    for (const itemId of loadout.equippedItemIds) {
      if (!updated.inventory.equipped.some(i => i.itemId === itemId)) {
        updated = equipItem(updated, itemId, itemDefs[itemId], rules);
      }
    }
  }

  if (updated.spellcasting) {
    const known = new Set(updated.spellcasting.known);
    updated = {
      ...updated,
      spellcasting: {
        ...updated.spellcasting,
        prepared: loadout.preparedSpellIds.filter(id => known.has(id)),
      },
    };
  }

  return recomputeDerived(updated, rules);
}

/** Removes a saved loadout by id. No-op if not found. */
export function deleteLoadout(entity: Entity, loadoutId: string): Entity {
  return { ...entity, loadouts: (entity.loadouts ?? []).filter(l => l.id !== loadoutId) };
}
