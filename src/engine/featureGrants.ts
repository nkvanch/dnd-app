// src/engine/featureGrants.ts
// Mid-campaign "grant a feature" (DM reward / boon), independent of level-up.
//
// A grant bundles ordinary Feature objects (the same shape every homebrew
// builder produces — including a max-HP bonus, which is just a Feature effect
// with target 'max_hp') plus optional resource pools, under a lineage + tier.
// Granting a lineage that already has an ACTIVE grant REPLACES it: the old
// tier's features and pools are removed (a pool with the same id is kept at
// its spent amount, not refilled), the new tier's are added, and BOTH rows
// stay in the ledger (Entity.featureGrants) so Tier I → II → III is visible.
import { Entity, Feature, FeatureInstance, ResourceGrant, FeatureGrantRecord, CampaignRules } from './types';
import { applyGrant, removeFeature } from './leveling';
import { revokeResourceSource } from './entitlements';
import { recomputeDerived } from './pipeline';
import { DEFAULT_RULES } from '../store/characterStore';

export type FeatureGrantDef = {
  lineageId:  string;
  label:      string;
  tier?:      number;
  features:   Feature[];
  resources?: ResourceGrant[];
  grantedBy?: string;
  note?:      string;
};

/** The active grant of a lineage, if any. */
export function activeGrantFor(entity: Entity, lineageId: string): FeatureGrantRecord | undefined {
  return (entity.featureGrants ?? []).find(g => g.lineageId === lineageId && g.status === 'active');
}

/** Oldest-first history of one lineage (all statuses). */
export function lineageHistory(entity: Entity, lineageId: string): FeatureGrantRecord[] {
  return (entity.featureGrants ?? []).filter(g => g.lineageId === lineageId);
}

function newGrantId(lineageId: string, tier: number | undefined, now: string): string {
  return `grant_${lineageId}_${tier ?? 0}_${now.replace(/[^0-9]/g, '').slice(0, 14)}_${Math.random().toString(36).slice(2, 6)}`;
}

function stripGrantContent(entity: Entity, record: FeatureGrantRecord): Entity {
  let next = entity;
  for (const fid of record.featureIds) next = removeFeature(next, fid);
  next = revokeResourceSource(next, 'manual', record.id);
  // Pools this grant created but that removeFeature's id-keyed sweep missed.
  return {
    ...next,
    resources: { ...next.resources, custom: next.resources.custom.filter(r => !(record.resourceIds.includes(r.id) && r.sourceId === record.id)) },
  };
}

export function grantFeatureBundle(
  entity: Entity, def: FeatureGrantDef, rules: CampaignRules = DEFAULT_RULES,
  now: string = new Date().toISOString(),
): Entity {
  const previous = activeGrantFor(entity, def.lineageId);
  // Remember how much of each shared pool was spent, so a replacement tier
  // does not refill it.
  const spentById = new Map<string, number>();
  let next = entity;
  if (previous) {
    for (const rid of previous.resourceIds) {
      const r = next.resources.custom.find(x => x.id === rid);
      if (r) spentById.set(rid, Math.max(0, r.maximum - r.current));
    }
    next = stripGrantContent(next, previous);
  }

  const id = newGrantId(def.lineageId, def.tier, now);
  const source = { kind: 'manual' as const, id };
  for (const r of def.resources ?? []) {
    next = applyGrant(next, { kind: 'resource', value: r }, 0, undefined, source);
    const spent = spentById.get(r.resourceId);
    if (spent !== undefined) {
      next = {
        ...next,
        resources: { ...next.resources, custom: next.resources.custom.map(c =>
          c.id === r.resourceId ? { ...c, current: Math.max(0, Math.min(c.maximum, c.maximum - spent)) } : c) },
      };
    }
  }
  const instances: FeatureInstance[] = def.features.map(f => ({
    ...f, source: { kind: 'manual', refId: id }, isActive: true, level: f.level,
  }));
  for (const f of instances) next = applyGrant(next, { kind: 'feature', value: f }, 0);

  const record: FeatureGrantRecord = {
    id, lineageId: def.lineageId, label: def.label, tier: def.tier,
    featureIds: def.features.map(f => f.id), resourceIds: (def.resources ?? []).map(r => r.resourceId),
    grantedAt: now, grantedBy: def.grantedBy ?? 'DM', note: def.note, status: 'active',
  };
  const ledger = (next.featureGrants ?? []).map(g =>
    previous && g.id === previous.id ? { ...g, status: 'replaced' as const, replacedAt: now, replacedBy: id } : g);
  return recomputeDerived({ ...next, featureGrants: [...ledger, record] }, rules);
}

/** Take an active grant away without a successor. The row stays in the ledger as 'revoked'. */
export function revokeFeatureGrant(
  entity: Entity, grantId: string, rules: CampaignRules = DEFAULT_RULES, now: string = new Date().toISOString(),
): Entity {
  const record = (entity.featureGrants ?? []).find(g => g.id === grantId && g.status === 'active');
  if (!record) return entity;
  const stripped = stripGrantContent(entity, record);
  return recomputeDerived({
    ...stripped,
    featureGrants: (stripped.featureGrants ?? []).map(g => g.id === grantId ? { ...g, status: 'revoked' as const, replacedAt: now } : g),
  }, rules);
}
