// src/engine/allyGrants.ts
// Ally-targeting effects: an aura a feature holds over a set of allies, and a
// one-shot grant to one chosen creature. See AllyGrantSpec in types.ts for the
// honest limits (no battle map: aura membership and "in range" are ticked by
// hand; recipients are characters on this device).
//
// Pure functions over Entity values. Callers (the sheet UI) persist the
// returned entities; recipient recomputes happen here so derived stats
// (AC, saves, …) reflect the grant immediately.
import { Entity, ReceivedGrant, Item, CampaignRules, Ability } from './types';
import { listModeGroups } from './modes';
import { recomputeDerived, modifier, effectiveAbilityScores } from './pipeline';
import { applyTempHP, tickReceivedGrants } from './combat';
import { rollExpression } from './dice';
import { DEFAULT_RULES } from '../store/characterStore';
import {
  AllyGrantSource, listAllyGrantSources, isAuraProjecting, buildGrant, auraKey, auraGrantId,
} from './allyAuras';

export { tickReceivedGrants };
export { listAllyGrantSources, isAuraProjecting, auraKey, auraRangeFeet } from './allyAuras';
export type { AllyGrantSource } from './allyAuras';

function abilityMod(e: Entity, a: Ability): number {
  return modifier(effectiveAbilityScores(e)[a]);
}

/** Toggle one ally in/out of an aura's checklist. Pure; call syncAllyGrants afterward to push it to the ally. */
export function setAuraMember(holder: Entity, featureId: string, specId: string, allyId: string, inRange: boolean): Entity {
  const key = auraKey(featureId, specId);
  const current = holder.auraMembers?.[key] ?? [];
  const next = inRange ? Array.from(new Set([...current, allyId])) : current.filter(id => id !== allyId);
  return { ...holder, auraMembers: { ...(holder.auraMembers ?? {}), [key]: next } };
}

/**
 * Re-evaluates every aura across the roster and rewrites each creature's
 * 'aura' receivedGrants to exactly match: a creature holds an aura grant iff
 * its holder is projecting it AND the creature is on the holder's checklist
 * (or is the holder, for includeSelf). Chosen grants are never touched.
 * Returns a new array; unchanged entities keep their identity.
 */
export function syncAllyGrants(
  roster: readonly Entity[], rules: CampaignRules = DEFAULT_RULES, homebrewItems: readonly Item[] = [],
  now: string = new Date().toISOString(),
): Entity[] {
  const byId = new Map(roster.map(e => [e.id, e]));
  const desired = new Map<string, ReceivedGrant[]>();
  for (const holder of roster) {
    for (const src of listAllyGrantSources(holder, homebrewItems)) {
      if (src.spec.mode !== 'aura' || !isAuraProjecting(holder, src.spec)) continue;
      const members = new Set(holder.auraMembers?.[auraKey(src.feature.id, src.spec.id)] ?? []);
      members.delete(holder.id); // the holder's own aura (includeSelf) is applied inside recomputeDerived
      for (const memberId of members) {
        if (!byId.has(memberId)) continue;
        const id = auraGrantId(holder.id, src.feature.id, src.spec.id);
        desired.set(memberId, [...(desired.get(memberId) ?? []), buildGrant(holder, src, effectiveAbilityScores(holder), id, now)]);
      }
    }
  }
  // Target-scope mode groups (Command the Field): each member's currently
  // picked option becomes that member's grant. The carrier feature being
  // active IS the group's lifetime (a concentration spell's feature leaves
  // when concentration drops), so no separate flag check is needed.
  for (const holder of roster) {
    for (const { feature, group } of listModeGroups(holder)) {
      if (group.scope !== 'target') continue;
      const members = holder.targetModes?.[group.id]?.members ?? {};
      for (const [targetId, optionId] of Object.entries(members)) {
        const option = group.options.find(o => o.id === optionId);
        if (!option || !byId.has(targetId)) continue;
        const grant: ReceivedGrant = {
          id: `mode:${holder.id}:${group.id}:${targetId}`, mode: 'mode', modeGroupId: group.id, modeOptionId: option.id,
          sourceEntityId: holder.id, sourceName: holder.identity.name || 'Ally', sourceFeatureId: feature.id, specId: group.id,
          label: `${group.name}: ${option.name}`, effects: (option.effects ?? []).map(x => ({ ...x })), note: option.note,
          duration: null, grantedAt: now,
        };
        desired.set(targetId, [...(desired.get(targetId) ?? []), grant]);
      }
    }
  }
  const synced = (g: ReceivedGrant, e: Entity) => g.mode === 'mode' || (g.mode === 'aura' && g.sourceEntityId !== e.id);
  return roster.map(e => {
    const want = desired.get(e.id) ?? [];
    const have = (e.receivedGrants ?? []).filter(g => synced(g, e));
    const same = want.length === have.length && want.every(w => {
      const h = have.find(x => x.id === w.id);
      return h && JSON.stringify(h.effects) === JSON.stringify(w.effects) && h.label === w.label && h.sourceName === w.sourceName
        && h.modeOptionId === w.modeOptionId && h.note === w.note;
    });
    if (same) return e;
    // Keep the original grantedAt of an aura grant that persists but whose numbers changed.
    const merged = want.map(w => ({ ...w, grantedAt: have.find(h => h.id === w.id)?.grantedAt ?? w.grantedAt }));
    const kept = (e.receivedGrants ?? []).filter(g => !synced(g, e));
    return recomputeDerived({ ...e, receivedGrants: [...kept, ...merged] }, rules);
  });
}

/**
 * A chosen, one-shot grant (Imperial Command, Hold Fast, Stand With Me …).
 * `target` may be the holder itself (pass the same entity). Re-granting the
 * same spec to the same target REPLACES the earlier grant (refresh, never a
 * stack). Spending the activating resource is the caller's job (the normal
 * action-card use already did). Returns both updated entities.
 */
export function applyChosenGrant(
  holder: Entity, target: Entity, source: AllyGrantSource, rules: CampaignRules = DEFAULT_RULES,
  now: string = new Date().toISOString(),
): { holder: Entity; target: Entity; grant: ReceivedGrant } {
  const grant: ReceivedGrant = {
    ...buildGrant(holder, source, effectiveAbilityScores(holder), `chosen:${holder.id}:${source.feature.id}:${source.spec.id}:${target.id}`, now),
  };
  const t = source.spec.tempHp;
  if (t) {
    const amount = (t.flat ?? 0) + (t.addProficiency ? holder.derived.proficiencyBonus : 0)
      + (t.addAbilityMod ? abilityMod(holder, t.addAbilityMod) : 0);
    if (amount > 0) grant.tempHpGranted = amount;
  }
  const hasLasting = grant.effects.length > 0 || !!grant.die || !!grant.token || !!grant.note;
  const base = target.id === holder.id ? holder : target;
  let next: Entity = {
    ...base,
    receivedGrants: [...(base.receivedGrants ?? []).filter(g => g.id !== grant.id), ...(hasLasting ? [grant] : [])],
  };
  if (grant.tempHpGranted) next = applyTempHP(next, grant.tempHpGranted, rules);
  next = recomputeDerived(next, rules);
  return target.id === holder.id
    ? { holder: next, target: next, grant }
    : { holder, target: next, grant };
}

export function dismissReceivedGrant(entity: Entity, grantId: string, rules: CampaignRules = DEFAULT_RULES): Entity {
  if (!(entity.receivedGrants ?? []).some(g => g.id === grantId)) return entity;
  return recomputeDerived({ ...entity, receivedGrants: entity.receivedGrants!.filter(g => g.id !== grantId) }, rules);
}

/** Roll and consume one of a grant's dice. The grant disappears once nothing lasting remains. */
export function spendGrantDie(
  entity: Entity, grantId: string, rules: CampaignRules = DEFAULT_RULES,
): { entity: Entity; roll: number; size: string } | null {
  const g = entity.receivedGrants?.find(x => x.id === grantId);
  if (!g?.die || g.die.remaining <= 0) return null;
  const roll = rollExpression(`1${g.die.size}`, g.label).total;
  const remainingDie = g.die.remaining - 1;
  const updated: ReceivedGrant = { ...g, die: { ...g.die, remaining: remainingDie } };
  const exhausted = remainingDie <= 0 && updated.effects.length === 0 && !(updated.token && updated.token.remaining > 0);
  const receivedGrants = entity.receivedGrants!.flatMap(x => x.id !== grantId ? [x] : exhausted ? [] : [updated]);
  return { entity: recomputeDerived({ ...entity, receivedGrants }, rules), roll, size: g.die.size };
}

/** Spend one use of a note-only token ("reroll"). */
export function spendGrantToken(entity: Entity, grantId: string, rules: CampaignRules = DEFAULT_RULES): Entity {
  const g = entity.receivedGrants?.find(x => x.id === grantId);
  if (!g?.token || g.token.remaining <= 0) return entity;
  const updated: ReceivedGrant = { ...g, token: { ...g.token, remaining: g.token.remaining - 1 } };
  const exhausted = updated.token!.remaining <= 0 && updated.effects.length === 0 && !(updated.die && updated.die.remaining > 0);
  const receivedGrants = entity.receivedGrants!.flatMap(x => x.id !== grantId ? [x] : exhausted ? [] : [updated]);
  return recomputeDerived({ ...entity, receivedGrants }, rules);
}

