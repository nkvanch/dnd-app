// src/engine/allyAuras.ts
// Pure helpers behind ally-targeting effects, split out of allyGrants.ts so
// pipeline.ts (which must apply a holder's OWN aura during recomputeDerived)
// can use them without an import cycle. Nothing here imports pipeline/combat.
import { Entity, Feature, AllyGrantSpec, ReceivedGrant, Item, Effect, Ability, AbilityScores } from './types';
import { resolveItemDefinition, effectiveItemFeatures, isItemMechanicallyActive } from './itemMechanics';

export type AllyGrantSource = { feature: Feature; spec: AllyGrantSpec; sourceKind: 'feature' | 'item' };

export const INCAPACITATING_CONDITION_IDS: readonly string[] = ['unconscious', 'paralyzed', 'stunned', 'petrified', 'incapacitated'];

export const auraKey = (featureId: string, specId: string) => `${featureId}:${specId}`;
export const auraGrantId = (holderId: string, featureId: string, specId: string) => `aura:${holderId}:${featureId}:${specId}`;

/** Every ally-grant spec on the entity's active features and mechanically-active equipped items. */
export function listAllyGrantSources(entity: Entity, homebrewItems: readonly Item[] = []): AllyGrantSource[] {
  const out: AllyGrantSource[] = [];
  for (const f of entity.features) {
    if (!f.isActive) continue;
    for (const spec of f.allyGrants ?? []) out.push({ feature: f, spec, sourceKind: 'feature' });
  }
  for (const inst of entity.inventory.equipped) {
    const def = resolveItemDefinition(inst.itemId, homebrewItems);
    if (!isItemMechanicallyActive(inst, def)) continue;
    for (const f of effectiveItemFeatures(inst, def)) {
      for (const spec of f.allyGrants ?? []) out.push({ feature: f, spec, sourceKind: 'item' });
    }
  }
  return out;
}

/** Aura is projecting: holder not incapacitated and the gating flag (if any) is on. (Feature-active is checked by the lister.) */
export function isAuraProjecting(holder: Entity, spec: AllyGrantSpec): boolean {
  if (spec.mode !== 'aura') return false;
  const incapacitated = (holder.resources.hp.maximum > 0 && holder.resources.hp.current === 0)
    || holder.conditions.some(c => INCAPACITATING_CONDITION_IDS.includes(c.id));
  if (incapacitated) return false;
  if (spec.activeWhileFlag && holder.conditionMonitor.flags[spec.activeWhileFlag] !== true) return false;
  return true;
}

/** Printed range for the holder's level (Aura Improvements: 10 → 30 ft). */
export function auraRangeFeet(spec: AllyGrantSpec, level: number): number | null {
  let feet = spec.rangeFeet ?? null;
  for (const row of [...(spec.rangeByLevel ?? [])].sort((a, b) => a.level - b.level)) if (level >= row.level) feet = row.feet;
  return feet;
}

export function sizeForLevel(die: NonNullable<AllyGrantSpec['die']>, level: number): string {
  let size = die.size;
  for (const row of [...(die.sizeByLevel ?? [])].sort((x, y) => x.level - y.level)) if (level >= row.level) size = row.size;
  return size;
}

const mod = (score: number) => Math.floor((score - 10) / 2);

/** Resolve the spec's effects against the holder's ability scores into plain Effects. */
export function snapshotEffects(spec: AllyGrantSpec, scores: AbilityScores): Effect[] {
  const v = spec.valueFromAbilityMod;
  const fixed = v ? Math.max(v.min ?? Number.NEGATIVE_INFINITY, mod(scores[v.ability])) : null;
  return (spec.effects ?? []).map(e => fixed !== null && typeof e.value === 'number' ? { ...e, value: fixed } : { ...e });
}

export function buildGrant(
  holder: Entity, source: AllyGrantSource, scores: AbilityScores, id: string, now: string,
): ReceivedGrant {
  const { feature, spec } = source;
  return {
    id, mode: spec.mode, sourceEntityId: holder.id, sourceName: holder.identity.name || 'Ally',
    sourceFeatureId: feature.id, specId: spec.id, label: spec.label,
    effects: snapshotEffects(spec, scores),
    note: spec.note,
    die: spec.die ? { size: sizeForLevel(spec.die, holder.identity.level), remaining: spec.die.count ?? 1, usableOn: spec.die.usableOn } : undefined,
    token: spec.token ? { text: spec.token.text, remaining: spec.token.uses } : undefined,
    duration: spec.duration ?? null,
    grantedAt: now,
  };
}

/** The holder's own includeSelf auras as grants (applied inside recomputeDerived — no sync needed for self). */
export function selfAuraGrants(holder: Entity, scores: AbilityScores, homebrewItems: readonly Item[] = []): ReceivedGrant[] {
  const out: ReceivedGrant[] = [];
  for (const src of listAllyGrantSources(holder, homebrewItems)) {
    if (src.spec.mode !== 'aura' || !src.spec.includeSelf || !isAuraProjecting(holder, src.spec)) continue;
    out.push(buildGrant(holder, src, scores, auraGrantId(holder.id, src.feature.id, src.spec.id), 'self'));
  }
  return out;
}

export type { Ability };
