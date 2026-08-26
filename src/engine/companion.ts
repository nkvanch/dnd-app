// ============================================================================
// FILE: src/engine/companion.ts
// A player-owned companion creature (Artificer's Steel Defender/Eldritch
// Cannon, etc.) — a normal Entity (kind:'monster') linked to its owner via
// identity.companionOf, NOT a spawned-once MonsterTemplate instance. The key
// difference from monsterFactory.ts's spawnMonster(): a companion's stats
// (HP max, and sometimes an ability score standing in for the owner's own
// modifier — e.g. Steel Defender's attack bonus explicitly uses the
// Artificer's INT mod, not its own) must track the OWNER's CURRENT level and
// stats continuously, not a one-shot spawn-time bake. syncCompanionFromOwner
// re-derives those fields every time the companion is read/recomputed,
// following the same non-destructive "apply on top, recompute" philosophy
// as DmOverride/WildShapeState — never a frozen snapshot.
// ============================================================================
import { Entity, CampaignRules, Ability, Feature } from './types';
import { makeEmptyEntity, DEFAULT_RULES } from '../store/characterStore';
import { recomputeDerived } from './pipeline';

/**
 * Static definition for one companion type. Deliberately NOT the same shape
 * as MonsterTemplate (src/content/monsters/types.ts) — that type bakes a
 * fixed stat block once; a companion's HP/attack bonus are formulas over the
 * OWNER's level/abilities, resolved fresh every sync, not fixed numbers.
 */
export type CompanionTemplate = {
  id:       string;
  name:     string;
  baseStats: Record<Ability, number>;
  /** Base speed in feet — companions don't inherit the owner's speed. */
  speed:     number;
  /**
   * Ability scores this companion's stat block copies DIRECTLY from the
   * owner every sync (5e's "use your Intelligence modifier instead of
   * Strength" style substitution — Steel Defender's whole stat block
   * otherwise has its own fixed abilities; only the listed ones sync).
   */
  syncAbilitiesFromOwner?: Ability[];
  /**
   * HP formula. 'per_owner_level' matches Steel Defender's "5 x your
   * Artificer level" rule; 'fixed' is for companions with a flat pool
   * (e.g. Eldritch Cannon's fixed-by-level table, expressed as a lookup
   * function instead since it isn't linear — see hpForOwnerLevel).
   */
  hpForOwnerLevel: (ownerLevel: number) => number;
  /**
   * Feature instances this companion always has — its attack(s), AC formula
   * (as a base_ac_formula effect, same machinery Unarmored Defense uses, so
   * no new pipeline code is needed), senses, etc. Compiled once at template
   *-authoring time (see src/content/subclasses/artificer.ts), not per-sync.
   */
  features: Feature[];
};

function companionId(ownerId: string, templateId: string): string {
  return `companion_${ownerId}_${templateId}`;
}

/**
 * Re-derives everything about a companion that depends on its owner's
 * CURRENT state — called every time the companion is displayed or after the
 * owner levels up, never assumed to still be correct from spawn time.
 */
export function syncCompanionFromOwner(
  companion: Entity,
  owner:     Entity,
  template:  CompanionTemplate,
  rules:     CampaignRules = DEFAULT_RULES,
): Entity {
  const stats = { ...companion.stats };
  for (const ab of template.syncAbilitiesFromOwner ?? []) {
    stats[ab] = owner.stats[ab];
  }
  const hpMax = Math.max(1, template.hpForOwnerLevel(owner.identity.level));
  const prevMax = companion.resources.hp.maximum;
  // Preserve current damage taken, but rescale if max just grew (e.g. owner
  // leveled up) — never let current exceed the new max, never heal for free.
  const hpCurrent = prevMax > 0
    ? Math.min(hpMax, companion.resources.hp.current)
    : hpMax;

  const synced: Entity = {
    ...companion,
    identity: { ...companion.identity, level: owner.identity.level, companionOf: owner.id },
    stats,
    resources: {
      ...companion.resources,
      hp: { ...companion.resources.hp, maximum: hpMax, current: hpCurrent },
      speed: template.speed,
    },
  };
  return recomputeDerived(synced, rules);
}

/** Creates a brand-new companion Entity for `owner` from `template`. */
export function createCompanion(
  owner:    Entity,
  template: CompanionTemplate,
  rules:    CampaignRules = DEFAULT_RULES,
): Entity {
  const base = makeEmptyEntity(companionId(owner.id, template.id), 'monster');
  let companion: Entity = {
    ...base,
    identity: {
      ...base.identity,
      name: template.name,
      classId: template.id,
      raceId: template.id,
      companionOf: owner.id,
    },
    stats: { ...template.baseStats },
    features: template.features.map(f => ({ ...f, isActive: true })),
  };
  return syncCompanionFromOwner(companion, owner, template, rules);
}
