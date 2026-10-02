// ============================================================================
// FILE: src/engine/rewardTracks.ts
// Upgradeable mid-campaign rewards (Weight of Authority). A reward is a TRACK of tiers; every tier
// is one or more ordinary Features carrying `rewardTrack: { trackId, tier }`. Granting a tier
// REPLACES the lower tiers of that track rather than stacking with them — "Tier II grants +10
// maximum HP total, not +15" — by removing those features (which revokes their resource pools and
// effects) before applying the new ones. Nothing here is special-cased in the pipeline: max HP,
// initiative and reroll uses are plain effects/resources that simply stop existing with the old tier.
// ============================================================================
import { Entity, Feature, CampaignRules } from './types';
import { applyGrant, removeFeature } from './leveling';
import { recomputeDerived } from './pipeline';
import { DEFAULT_RULES } from '../store/characterStore';

/** Highest tier of `trackId` the entity currently holds (0 = none). */
export function currentRewardTier(entity: Entity, trackId: string): number {
  return entity.features.reduce((max, f) => (f.rewardTrack?.trackId === trackId ? Math.max(max, f.rewardTrack.tier) : max), 0);
}

/** Every distinct tier a list of reward features defines for a track, ascending. */
export function rewardTiers(features: readonly Feature[], trackId: string): number[] {
  return [...new Set(features.filter(f => f.rewardTrack?.trackId === trackId).map(f => f.rewardTrack!.tier))].sort((a, b) => a - b);
}

/**
 * Grants one tier of a reward track: `tierFeatures` are the features of exactly that tier. Lower
 * tiers are removed first. No-op when the entity already holds this tier or a higher one.
 */
export function grantRewardTier(entity: Entity, tierFeatures: readonly Feature[], rules: CampaignRules = DEFAULT_RULES): Entity {
  const first = tierFeatures.find(f => f.rewardTrack);
  if (!first?.rewardTrack) return entity;
  const { trackId, tier } = first.rewardTrack;
  if (currentRewardTier(entity, trackId) >= tier) return entity;

  let updated = entity;
  for (const old of entity.features.filter(f => f.rewardTrack?.trackId === trackId && f.rewardTrack.tier < tier)) {
    updated = removeFeature(updated, old.id);
  }
  for (const f of tierFeatures) {
    updated = applyGrant(updated, { kind: 'feature', value: { ...f, isActive: true } }, updated.identity.level, undefined, { kind: 'feature', id: f.id });
  }
  return recomputeDerived(updated, rules);
}
