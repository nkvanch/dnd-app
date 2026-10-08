// ============================================================================
// FILE: src/engine/conditions.ts
// PROJECT: Condition Application, Suppression & Immunity Engine
// ============================================================================
import { Entity, ActiveCondition, CampaignRules, Feature, FeatureInstance, DurationTracker } from './types';
import { recomputeDerived } from './pipeline';
import { DEFAULT_RULES } from '../store/characterStore';

// ── Immunity ──────────────────────────────────────────────────────────────────

/**
 * Returns true if any active feature grants immunity to this condition.
 * Immunity prevents the condition from being applied at all.
 */
export function isImmuneToCondition(entity: Entity, conditionId: string): boolean {
  // Plain target match (e.g. 'poisoned') — matches how every real
  // condition_immunity effect is actually authored (Skeleton, Nature's Ward,
  // Mindless Rage, Divine Health), not a 'condition.'-prefixed target that
  // no content anywhere writes.
  return entity.features.some(f =>
    f.isActive &&
    f.effects.some(e =>
      e.type === 'condition_immunity' &&
      e.target === conditionId
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
  // Plain target match — same convention fix as isImmuneToCondition above.
  // suppress_condition_effects had zero real content usage before
  // movement_condition traits (src/content/traitCompiler.ts) started
  // authoring it, so there's no existing-data compatibility concern here,
  // but standardizing on the plain convention keeps it consistent.
  return entity.features
    .filter(f => f.isActive)
    .flatMap(f =>
      f.effects
        .filter(e =>
          e.type === 'suppress_condition_effects' &&
          e.target === conditionId
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
/**
 * Optional condition features from content (e.g. globalContentDB.conditions).
 * The engine can't import content directly (circular dep), so the caller looks
 * up the Condition and passes its features here.
 */
export function applyCondition(
  entity:             Entity,
  conditionId:        string,
  sourceId:           string,
  rules:              CampaignRules = DEFAULT_RULES,
  conditionFeatures?: Feature[],
  /** Optional — defaults to null (permanent, today's existing behavior).
   * Only 'rounds' (tickDurations, called from a player's own "End Turn" or
   * a DM's endTurn()) and 'until_rest' (already removed wholesale by
   * longRest() in rest.ts) durations are ever actually acted on anywhere in
   * the app — 'minutes'/'hours' are set but never ticked (see
   * wildShapeState.expiresAt's own doc comment for why), so callers should
   * not offer those as real options. */
  duration?:          DurationTracker | null,
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
    duration:     duration ?? null,
    suppressedBy: collectSuppressors(entity, conditionId),
  };

  // Apply the condition's mechanical features so the pipeline enforces them.
  // Each feature gets source.kind='condition' so removeCondition strips them
  // when the condition is lifted.
  const newFeatures: FeatureInstance[] = (conditionFeatures ?? []).map(f => ({
    ...f,
    source:   { kind: 'condition' as const, refId: conditionId },
    isActive: true,
  }));

  const updated = {
    ...entity,
    conditions: [...entity.conditions, newCondition],
    conditionMonitor: {
      ...entity.conditionMonitor,
      active: [...entity.conditionMonitor.active, newCondition],
    },
    features: [...entity.features, ...newFeatures],
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

  // Bug fix: a condition expiring here previously only removed its
  // ActiveCondition entry — the Feature(s) applyCondition() had pushed onto
  // entity.features (source.kind:'condition', refId: the expired id) stayed
  // forever, so an expired condition's mechanical effects (an AC penalty,
  // a stat bonus, anything besides the visible chip) kept applying with no
  // way to clear them short of a manual removeCondition() call, which
  // nothing calls automatically on natural expiry. Same feature-stripping
  // filter removeCondition() already uses for a manual removal.
  const expiredIds = new Set(
    entity.conditionMonitor.active
      .filter(c => !newActive.some(a => a.id === c.id))
      .map(c => c.id)
  );
  const newFeatures = expiredIds.size === 0
    ? entity.features
    : entity.features.filter(f => !(f.source.kind === 'condition' && expiredIds.has(f.source.refId)));

  const updated = {
    ...entity,
    conditions: newConditions,
    conditionMonitor: {
      ...entity.conditionMonitor,
      active: newActive,
    },
    features: newFeatures,
  };

  return recomputeDerived(updated, rules);
}
