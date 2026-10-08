// ============================================================================
// FILE: src/engine/originFeat.ts
// A 2024 background names an Origin feat ("Acolyte: Magic Initiate (Cleric)"). Selecting the background
// must GRANT that feat, not merely mention it. Everything the feat brings (its feature, its limited-use
// pools, the picks it asks the player for) is granted with the BACKGROUND as its source, so the existing
// background-change paths — which already strip every background-sourced feature, unresolved choice and
// resource — take the feat back out too. No second removal mechanism.
// ============================================================================
import { Entity, Feat, Background, Feature, BACKGROUND_CHOICE_PREFIX } from './types';
import { applyGrant, queueChoice } from './leveling';
import { revokeResourceSource } from './entitlements';

/** The id of the generated feature that stands for the granted Origin feat on the sheet. The feat id is part
 *  of it so a later change of background can tell which feat to take back out. */
export const originFeatFeatureId = (bgId: string, featId: string) => `${bgId}_origin_${featId}`;

export function applyBackgroundOriginFeat(entity: Entity, bg: Pick<Background, 'id'>, feat: Feat | undefined): Entity {
  if (!feat) return entity;
  const feature: Feature = {
    ...feat.feature,
    id: originFeatFeatureId(bg.id, feat.id),
    name: `${feat.name} (Origin Feat)`,
    source: { kind: 'background', refId: bg.id },
    level: null,
  };
  const source = { kind: 'background' as const, id: bg.id };
  let updated = applyGrant(entity, { kind: 'feature', value: { ...feature, isActive: true } }, 0);
  for (const r of feat.resources ?? []) updated = applyGrant(updated, { kind: 'resource', value: r }, 0, undefined, source);
  for (const choice of feat.pendingChoices ?? []) {
    // The background prefix makes a still-unresolved pick get swept if the background changes again.
    updated = queueChoice(updated, { ...choice, id: `${BACKGROUND_CHOICE_PREFIX}origin_${feat.id}_${choice.id}` }, 0, undefined, source);
  }
  return updated;
}

/**
 * Takes back what an earlier background's Origin feat granted beyond its own feature: spells the feat's
 * picks gave (their entitlements are sourced to the feat id) — the background-sourced pools, features and
 * unresolved picks are already removed by the ordinary background-change path.
 */
export function revokeBackgroundOriginFeat(entity: Entity): Entity {
  let updated = entity;
  for (const f of entity.features) {
    const m = f.source.kind === 'background' ? /_origin_(.+)$/.exec(f.id) : null;
    if (m) updated = revokeResourceSource(updated, 'background', m[1]);
  }
  return updated;
}
