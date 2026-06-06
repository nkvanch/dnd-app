// ============================================================================
// FILE: src/engine/conditions.ts
// PROJECT: Condition Application, Suppression & Immunity Engine
// ============================================================================
import { Entity, ActiveCondition, CampaignRules } from './types';
import { recomputeDerived } from './pipeline';
import { DEFAULT_RULES } from '../store/characterStore';

// ── Immunity ──────────────────────────────────────────────────────────────────

/**
 * Returns true if any active feature grants immunity to this condition.
 * Immunity prevents the condition from being applied at all.
 */
export function isImmuneToCondition(entity: Entity, conditionId: string): boolean {
  return entity.features.some(f =>
    f.isActive &&
    f.effects.some(e =>
      e.type === 'condition_immunity' &&
      e.target === `condition.${conditionId}`
    )
  );
}

// ── Suppression ───────────────────────────────────────────────────────────────

/**
 * Collects IDs of features that suppress effects of the given condition
 * without removing it.
 * Example: Blindsight suppresses Blinded attack penalties but
 * the Blinded condition itself remains on the entity.
 */
export function collectSuppressors(entity: Entity, conditionId: string): string[] {
  return entity.features
    .filter(f => f.isActive)
    .flatMap(f =>
      f.effects
        .filter(e =>
          e.type === 'suppress_condition_effects' &&
          e.target === `condition.${conditionId}`
        )
        .map(() => f.id)
    );
}

/**
 * Rebuilds the suppressedBy list for every active condition.
 * Called inside recomputeDerived whenever features change (items equipped,
 * concentration dropped, features toggled).
 */
export function refreshSuppressors(entity: Entity): Entity {
  return {
    ...entity,
    conditions: entity.conditions.map(c => ({
      ...c,
      suppressedBy: collectSuppressors(entity, c.id),
    })),
    conditionMonitor: {
      ...entity.conditionMonitor,
      active: entity.conditionMonitor.active.map(c => ({
        ...c,
        suppressedBy: collectSuppressors(entity, c.id),
      })),
    },
  };
}

// ── Apply condition ───────────────────────────────────────────────────────────

/**
 * Applies a condition to an entity.
 * - If the entity is immune, returns unchanged.
 * - If the condition is already active, returns unchanged (no stacking).
 * - Exhaustion is the only exception: increments the numeric level instead.
 */
export function applyCondition(
  entity:      Entity,
  conditionId: string,
  sourceId:    string,
  rules:       CampaignRules = DEFAULT_RULES
): Entity {
  if (isImmuneToCondition(entity, conditionId)) return entity;

  if (conditionId === 'exhaustion') {
    const updated = {
      ...entity,
      conditionMonitor: {
        ...entity.conditionMonitor,
        exhaustion: Math.min(6, entity.conditionMonitor.exhaustion + 1),
      },
    };
    return recomputeDerived(updated, rules);
  }

  // Already active — no duplicate, no change
  const alreadyActive = entity.conditionMonitor.active.some(c => c.id === conditionId);
  if (alreadyActive) return entity;

  const newCondition: ActiveCondition = {
    id:           conditionId,
    sourceId,
    duration:     null,
    suppressedBy: collectSuppressors(entity, conditionId),
  };

  const updated = {
    ...entity,
    conditions: [...entity.conditions, newCondition],
    conditionMonitor: {
      ...entity.conditionMonitor,
      active: [...entity.conditionMonitor.active, newCondition],
    },
  };

  return recomputeDerived(updated, rules);
}

// ── Remove condition ──────────────────────────────────────────────────────────

/** Removes a condition by ID, plus any features that were granted by that condition. */
export function removeCondition(
  entity:      Entity,
  conditionId: string,
  rules:       CampaignRules = DEFAULT_RULES
): Entity {
  const updated = {
    ...entity,
    conditions: entity.conditions.filter(c => c.id !== conditionId),
    conditionMonitor: {
      ...entity.conditionMonitor,
      active: entity.conditionMonitor.active.filter(c => c.id !== conditionId),
    },
    // Also remove any features whose source was this condition
    features: entity.features.filter(f =>
      !(f.source.kind === 'condition' && f.source.refId === conditionId)
    ),
  };
  return recomputeDerived(updated, rules);
}

// ── Exhaustion ────────────────────────────────────────────────────────────────

/** Reduces exhaustion by 1 (long rest effect). Minimum is 0. */
export function reduceExhaustion(
  entity: Entity,
  rules:  CampaignRules = DEFAULT_RULES
): Entity {
  const updated = {
    ...entity,
    conditionMonitor: {
      ...entity.conditionMonitor,
      exhaustion: Math.max(0, entity.conditionMonitor.exhaustion - 1),
    },
  };
  return recomputeDerived(updated, rules);
}

// ── Runtime flags ─────────────────────────────────────────────────────────────

/**
 * Sets or clears a runtime boolean flag on the entity.
 * Used for: "rage_active", "concentrating", "second_wind_used", etc.
 * These flags gate conditional effects in collectAllEffects.
 */
export function setFlag(
  entity: Entity,
  flag:   string,
  value:  boolean,
  rules:  CampaignRules = DEFAULT_RULES
): Entity {
  const updated = {
    ...entity,
    conditionMonitor: {
      ...entity.conditionMonitor,
      flags: { ...entity.conditionMonitor.flags, [flag]: value },
    },
  };
  return recomputeDerived(updated, rules);
}

// ── Tick durations ────────────────────────────────────────────────────────────

/**
 * Decrements all round-based durations by 1 and removes expired conditions.
 * Called by the combat engine at the end of each creature's turn.
 */
export function tickDurations(
  entity: Entity,
  rules:  CampaignRules = DEFAULT_RULES
): Entity {
  const tickCondition = (c: ActiveCondition): ActiveCondition | null => {
    if (!c.duration || c.duration.unit !== 'rounds') return c;
    const remaining = c.duration.remaining - 1;
    if (remaining <= 0) return null;  // Expired
    return { ...c, duration: { ...c.duration, remaining } };
  };

  const newActive = entity.conditionMonitor.active
    .map(tickCondition)
    .filter((c): c is ActiveCondition => c !== null);

  const newConditions = entity.conditions
    .map(tickCondition)
    .filter((c): c is ActiveCondition => c !== null);

  const updated = {
    ...entity,
    conditions: newConditions,
    conditionMonitor: {
      ...entity.conditionMonitor,
      active: newActive,
    },
  };

  return recomputeDerived(updated, rules);
}
