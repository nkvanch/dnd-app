// ============================================================================
// FILE: src/engine/dmOverride.ts
// DM Override management functions.
//
// Overrides sit on entity.dmOverrides[] and are applied LAST in
// recomputeDerived() — after all features, equipment, and conditions.
// They NEVER touch entity.stats or entity.features.
// Cancelling sets active=false; recomputeDerived restores original values.
// ============================================================================
import { Entity, DmOverride, CampaignRules, DERIVED_NUMERIC_KEYS } from './types';
import { effectiveAbilityScores, modifier, recomputeDerived } from './pipeline';

function reconcileConOverrideHp(previous: Entity, next: Entity): Entity {
  const level = next.identity.level;
  if (level <= 0) return next;
  const delta = (modifier(effectiveAbilityScores(next).con) - modifier(effectiveAbilityScores(previous).con)) * level;
  if (delta === 0) return next;
  const maximum = Math.max(1, next.resources.hp.maximum + delta);
  return { ...next, resources: { ...next.resources, hp: {
    ...next.resources.hp,
    maximum,
    // Preserve damage taken. A maximum reduction clamps current into range.
    current: Math.min(maximum, Math.max(0, next.resources.hp.current + delta)),
  } } };
}

function uuid(): string {
  const s4 = () => Math.floor(Math.random() * 0x10000).toString(16).padStart(4, '0');
  return `${s4()}${s4()}-${s4()}-4${s4().slice(1)}-${s4()}-${s4()}${s4()}${s4()}`;
}

/**
 * Applies a new DM override to an entity.
 * Only targets in DERIVED_NUMERIC_KEYS (or savingThrows.X) are accepted;
 * unknown targets are silently ignored to keep the engine safe.
 */
export function applyDmOverride(
  entity:   Entity,
  override: Omit<DmOverride, 'id' | 'appliedAt' | 'cancelledAt' | 'active'>,
  rules:    CampaignRules
): Entity {
  // Guard: only allow scalar numeric DerivedStats targets
  const isSavingThrow = override.stat.startsWith('savingThrows.');
  const isAbility = ['str','dex','con','int','wis','cha'].includes(override.stat);
  if (!DERIVED_NUMERIC_KEYS.has(override.stat) && !isSavingThrow && !isAbility) {
    console.warn(`[dmOverride] Attempted override of non-scalar stat: "${override.stat}". Ignored.`);
    return entity;
  }

  const newOverride: DmOverride = {
    ...override,
    id:          uuid(),
    appliedAt:   Date.now(),
    cancelledAt: null,
    active:      true,
  };

  const updated = {
    ...entity,
    dmOverrides: [...(entity.dmOverrides ?? []), newOverride],
  };

  const recomputed = recomputeDerived(updated, rules);
  return override.stat === 'con' ? reconcileConOverrideHp(entity, recomputed) : recomputed;
}

/**
 * Cancels a single override by id.
 * Sets active=false and records cancelledAt timestamp.
 * Values restore automatically on next recomputeDerived call.
 */
export function cancelDmOverride(
  entity:     Entity,
  overrideId: string,
  rules:      CampaignRules
): Entity {
  const now = Date.now();
  const updated = {
    ...entity,
    dmOverrides: (entity.dmOverrides ?? []).map(o =>
      o.id === overrideId
        ? { ...o, active: false, cancelledAt: now }
        : o
    ),
  };
  const recomputed = recomputeDerived(updated, rules);
  const cancelled = (entity.dmOverrides ?? []).find(o => o.id === overrideId && o.active);
  return cancelled?.stat === 'con' ? reconcileConOverrideHp(entity, recomputed) : recomputed;
}

/**
 * Cancels all active overrides targeting a specific stat.
 * Used when DM wants a clean slate on one stat before applying a new override.
 */
export function cancelAllOverridesForStat(
  entity: Entity,
  stat:   string,
  rules:  CampaignRules
): Entity {
  const now = Date.now();
  const updated = {
    ...entity,
    dmOverrides: (entity.dmOverrides ?? []).map(o =>
      o.active && o.stat === stat
        ? { ...o, active: false, cancelledAt: now }
        : o
    ),
  };
  const recomputed = recomputeDerived(updated, rules);
  return stat === 'con' ? reconcileConOverrideHp(entity, recomputed) : recomputed;
}

/**
 * Cancels all overrides that match the given expiry type.
 * Called on:
 *   'end_of_encounter' — when DM ends the combat encounter
 *   'end_of_session'   — on long rest / session end
 *   'manual'           — never called automatically
 */
export function expireOverrides(
  entity: Entity,
  expiry: DmOverride['expiry'],
  rules:  CampaignRules
): Entity {
  const now = Date.now();
  const updated = {
    ...entity,
    dmOverrides: (entity.dmOverrides ?? []).map(o =>
      o.active && o.expiry === expiry
        ? { ...o, active: false, cancelledAt: now }
        : o
    ),
  };
  return recomputeDerived(updated, rules);
}

/**
 * Returns all active DM overrides on an entity, sorted by appliedAt ascending.
 */
export function getActiveOverrides(entity: Entity): DmOverride[] {
  return (entity.dmOverrides ?? [])
    .filter(o => o.active)
    .sort((a, b) => a.appliedAt - b.appliedAt);
}

/**
 * Returns true if any active override targets the given stat.
 * Used by UI to display the ✱ indicator.
 */
export function hasActiveOverride(entity: Entity, stat: string): boolean {
  return (entity.dmOverrides ?? []).some(o => o.active && o.stat === stat);
}
