// src/engine/modes.ts
// Mode groups — see ModeGroup in types.ts for the model. Pure functions; no
// pipeline import, so recomputeDerived can call reconcileModes directly.
//
// Atomicity: every public mutator below only edits `modeStates` /
// `targetModes` (the CHOICE). The consequences — which features and resource
// pools exist — are derived by reconcileModes, which recomputeDerived runs on
// every pass. A switch is therefore a single state change followed by one
// recompute: validate → set active option → reconcile removes the old
// option's grants and adds the new one's → done. Nothing can be left half
// swapped, and a character reloaded from storage re-derives the same result.
import {
  Entity, Feature, FeatureInstance, ModeGroup, ModeOption, ModeState, ModeHistoryEntry, ResourceGrant, CustomResource,
} from './types';
import { getClassLevels } from './multiclass';
import { grantEntitlement } from './entitlements';
import { rollDie } from './dice';

export type ModeCarrier = { feature: FeatureInstance; group: ModeGroup };

export const modeFeatureId = (groupId: string, optionId: string, featureId: string) => `${groupId}__${optionId}__${featureId}`;
export const modeResourceId = (groupId: string, optionId: string, resourceId: string) => `${groupId}__${optionId}__${resourceId}`;
export const modeRerollResourceId = (groupId: string) => `${groupId}__reroll`;

/** Active features that carry a mode group. */
export function listModeGroups(entity: Entity): ModeCarrier[] {
  return entity.features.filter(f => f.isActive && f.modeGroup).map(f => ({ feature: f, group: f.modeGroup! }));
}

export function findModeGroup(entity: Entity, groupId: string): ModeGroup | undefined {
  return listModeGroups(entity).find(c => c.group.id === groupId)?.group;
}

/** The level that gates this group's entries. */
export function modeGroupLevel(entity: Entity, group: ModeGroup): number {
  const src = group.levelSource;
  if (src?.kind === 'class') return getClassLevels(entity).find(c => c.classId === src.classId)?.level ?? 0;
  return entity.identity.level;
}

export function activeOptionOf(entity: Entity, group: ModeGroup): ModeOption | null {
  const id = entity.modeStates?.[group.id]?.activeOptionId;
  return (id && group.options.find(o => o.id === id)) || null;
}

function remapResourceIds(f: Feature, map: Map<string, string>): Feature {
  if (map.size === 0) return f;
  const remap = <T extends { resourceId: string } | null | undefined>(c: T): T =>
    (c && map.has(c.resourceId) ? { ...c, resourceId: map.get(c.resourceId)! } : c) as T;
  return {
    ...f,
    activation: f.activation
      ? { ...f.activation, resourceCost: remap(f.activation.resourceCost),
          options: f.activation.options?.map(o => ({ ...o, resourceCost: o.resourceCost ? remap(o.resourceCost) : o.resourceCost })) }
      : f.activation,
    abilityEffects: f.abilityEffects?.map(e =>
      (e.type === 'spend_resource' || e.type === 'restore_resource') && map.has(e.resourceId) ? { ...e, resourceId: map.get(e.resourceId)! } : e),
  };
}

/**
 * Brings entity.features / entity.resources.custom in line with every mode
 * group's current choice. Idempotent; returns the SAME object when nothing
 * needs changing (so it is free to call on every recompute).
 */
export function reconcileModes(entity: Entity): Entity {
  const carriers = listModeGroups(entity).filter(c => c.group.scope === 'self');
  const hasModeFeatures = entity.features.some(f => f.source.kind === 'mode');
  const hasModeResources = entity.resources.custom.some(r => r.sourceKind === 'mode');
  const hasModeEntitlements = (entity.entitlements ?? []).some(r => r.sourceKind === 'mode');
  if (carriers.length === 0 && !hasModeFeatures && !hasModeResources && !hasModeEntitlements) return entity;

  const desiredFeatures: FeatureInstance[] = [];
  type PoolWant = { grant: ResourceGrant; id: string; active: boolean; owner: string };
  const pools: PoolWant[] = [];

  for (const { group } of carriers) {
    const level = modeGroupLevel(entity, group);
    const active = activeOptionOf(entity, group);
    for (const option of group.options) {
      const isActive = active?.id === option.id;
      const idMap = new Map<string, string>();
      for (const entry of option.entries) for (const r of entry.resources ?? []) idMap.set(r.resourceId, modeResourceId(group.id, option.id, r.resourceId));
      for (const entry of option.entries) {
        const unlocked = level >= entry.level;
        for (const r of entry.resources ?? []) {
          pools.push({ grant: r, id: idMap.get(r.resourceId)!, active: isActive && unlocked, owner: `${group.id}:${option.id}` });
        }
        if (!isActive || !unlocked) continue;
        for (const f of entry.features ?? []) {
          const remapped = remapResourceIds(f, idMap);
          desiredFeatures.push({
            ...remapped, id: modeFeatureId(group.id, option.id, f.id), level: entry.level, isActive: true,
            source: { kind: 'mode', refId: `${group.id}:${option.id}` }, sourceLabel: group.optionLabel, choices: [],
          });
        }
      }
    }
    // Re-roll pool (Council of Spirits): exists once the level is reached.
    const sel = group.selector;
    if (sel.kind === 'table' && sel.reroll) {
      pools.push({
        grant: { resourceId: 'reroll', name: `${group.name} re-roll`, maximum: sel.reroll.perPeriod, recharge: `per ${sel.periodLabel ?? 'period'} (manual)` },
        id: modeRerollResourceId(group.id), active: level >= sel.reroll.level, owner: `${group.id}:reroll`,
      });
    }
  }

  // Features
  const desiredIds = new Set(desiredFeatures.map(f => f.id));
  const keptModeFeatures = new Map(entity.features.filter(f => f.source.kind === 'mode' && desiredIds.has(f.id)).map(f => [f.id, f]));
  const nextFeatures: FeatureInstance[] = [
    ...entity.features.filter(f => f.source.kind !== 'mode'),
    ...desiredFeatures.map(f => keptModeFeatures.get(f.id) ?? f),
  ];
  const featuresSame = nextFeatures.length === entity.features.length && nextFeatures.every((f, i) => f === entity.features[i]);

  // Resources
  const wantById = new Map(pools.map(p => [p.id, p]));
  let resourcesChanged = false;
  const custom: CustomResource[] = [];
  for (const r of entity.resources.custom) {
    if (r.sourceKind !== 'mode') { custom.push(r); continue; }
    const want = wantById.get(r.id);
    if (!want) { resourcesChanged = true; continue; }              // its group is gone
    const inactive = !want.active;
    const spent = Math.max(0, r.maximum - r.current);
    const maximum = want.grant.maximum;
    const current = Math.max(0, Math.min(maximum, maximum - spent));
    if (!!r.inactive === inactive && r.maximum === maximum && r.current === current) { custom.push(r); continue; }
    resourcesChanged = true;
    custom.push({ ...r, inactive, maximum, current, name: want.grant.name, recharge: want.grant.recharge });
  }
  for (const want of pools) {
    if (!want.active || custom.some(c => c.id === want.id)) continue;      // never create a pool for an option that was never active
    resourcesChanged = true;
    custom.push({
      id: want.id, name: want.grant.name, current: Math.max(0, Math.min(want.grant.maximum, want.grant.starting ?? want.grant.maximum)),
      maximum: want.grant.maximum, recharge: want.grant.recharge, sourceKind: 'mode', sourceId: want.owner,
    });
  }

  let next: Entity = (featuresSame && !resourcesChanged) ? entity : {
    ...entity,
    features: featuresSame ? entity.features : nextFeatures,
    resources: resourcesChanged ? { ...entity.resources, custom } : entity.resources,
  };
  return reconcileModeSpellAccess(next, desiredFeatures);
}

/**
 * Spirit-granted spells: a mode feature's grant_spell effects become
 * spell/cantrip access entitlements owned by that option (sourceKind 'mode'),
 * and are revoked the moment the option stops being active — so they are
 * "known only while that spirit is active", with no spell list to clean up.
 */
function reconcileModeSpellAccess(entity: Entity, desired: FeatureInstance[]): Entity {
  type Want = { kind: 'spell_access' | 'cantrip_access'; key: string; sourceId: string };
  const wants: Want[] = [];
  for (const f of desired) {
    for (const eff of f.effects) {
      if (eff.type !== 'grant_spell') continue;
      for (const key of eff.cantripIds ?? []) wants.push({ kind: 'cantrip_access', key, sourceId: f.source.refId });
      for (const key of eff.spellIds ?? []) wants.push({ kind: 'spell_access', key, sourceId: f.source.refId });
    }
  }
  const records = entity.entitlements ?? [];
  const has = (w: Want) => records.some(r => r.sourceKind === 'mode' && r.kind === w.kind && r.key === w.key && r.sourceId === w.sourceId);
  const stale = records.filter(r => r.sourceKind === 'mode'
    && !wants.some(w => w.kind === r.kind && w.key === r.key && w.sourceId === r.sourceId));
  const missing = wants.filter(w => !has(w));
  if (stale.length === 0 && missing.length === 0) return entity;
  let next: Entity = stale.length ? { ...entity, entitlements: records.filter(r => !stale.includes(r)) } : entity;
  if (missing.length && !next.spellcasting) {
    const ability = desired.flatMap(f => f.effects).find(e => e.type === 'grant_spell')?.spellcastingAbility ?? 'cha';
    next = { ...next, spellcasting: {
      ability, slots: Object.fromEntries(['1','2','3','4','5','6','7','8','9'].map(t => [t, { total: 0, used: 0 }])) as never,
      cantrips: [], known: [], prepared: [], concentrating: null,
    } };
  }
  for (const w of missing) next = grantEntitlement(next, { kind: w.kind, key: w.key, sourceKind: 'mode', sourceId: w.sourceId });
  return next;
}

// ── self-scope selection ────────────────────────────────────────────────────

const stateOf = (entity: Entity, groupId: string): ModeState =>
  entity.modeStates?.[groupId] ?? { groupId, activeOptionId: null, history: [] };

const withState = (entity: Entity, st: ModeState): Entity =>
  ({ ...entity, modeStates: { ...(entity.modeStates ?? {}), [st.groupId]: st } });

/** What the player may do right now (drives the picker UI). */
export function modeSelectorInfo(entity: Entity, group: ModeGroup) {
  const level = modeGroupLevel(entity, group);
  const st = stateOf(entity, group.id);
  const sel = group.selector;
  const table = sel.kind === 'table';
  const freeChoice = sel.kind === 'choice' || (table && sel.freeChoiceFromLevel !== undefined && level >= sel.freeChoiceFromLevel);
  const rollCount = table ? ([...(sel.pickBest ?? [])].sort((a, b) => b.level - a.level).find(r => level >= r.level)?.rolls ?? 1) : 0;
  const rerollRes = entity.resources.custom.find(r => r.id === modeRerollResourceId(group.id));
  const rerollsLeft = table && sel.reroll && level >= sel.reroll.level ? (rerollRes && !rerollRes.inactive ? rerollRes.current : sel.reroll.perPeriod) : 0;
  return {
    level, active: activeOptionOf(entity, group), history: st.history, pendingRolls: st.pendingRolls ?? null,
    canRoll: table, rollCount, die: table ? sel.die : 0, freeChoice, rerollsLeft,
    periodLabel: table ? sel.periodLabel ?? 'period' : null,
  };
}

function optionForRoll(group: ModeGroup, value: number): string | null {
  const sel = group.selector;
  if (sel.kind !== 'table') return null;
  const mapped = sel.table?.find(t => t.value === value)?.optionId;
  return mapped ?? group.options[value - 1]?.id ?? null;
}

/** Make `optionId` the active option. `how` is recorded in the history. */
export function setMode(
  entity: Entity, groupId: string, optionId: string, how: ModeHistoryEntry['how'] = 'choice',
  extra: { roll?: number; rolls?: number[] } = {}, now: string = new Date().toISOString(),
): Entity {
  const group = findModeGroup(entity, groupId);
  if (!group || !group.options.some(o => o.id === optionId)) return entity;
  const st = stateOf(entity, groupId);
  return withState(entity, {
    ...st, activeOptionId: optionId, pendingRolls: undefined,
    history: [...st.history, { optionId, at: now, how, ...extra }],
  });
}

/** requireActiveOption=false groups can be switched off. */
export function clearMode(entity: Entity, groupId: string): Entity {
  const group = findModeGroup(entity, groupId);
  if (!group || group.requireActiveOption) return entity;
  return withState(entity, { ...stateOf(entity, groupId), activeOptionId: null, pendingRolls: undefined });
}

function refillRerolls(entity: Entity, group: ModeGroup): Entity {
  const id = modeRerollResourceId(group.id);
  if (!entity.resources.custom.some(r => r.id === id)) return entity;
  return { ...entity, resources: { ...entity.resources, custom: entity.resources.custom.map(r => r.id === id ? { ...r, current: r.maximum } : r) } };
}

/**
 * A new period begins (the table says the month changed): roll for the next
 * option and refill the re-roll pool. `physical` is the dice the player rolled
 * at the table (the app rolls for them when omitted). With pickBest the result
 * is held in `pendingRolls` until pickPendingRoll chooses one.
 */
export function startModePeriod(
  entity: Entity, groupId: string, physical?: number[], now: string = new Date().toISOString(),
): Entity {
  const group = findModeGroup(entity, groupId);
  if (!group || group.selector.kind !== 'table') return entity;
  const info = modeSelectorInfo(entity, group);
  const die = group.selector.die;
  const rolls = (physical && physical.length > 0 ? physical : Array.from({ length: info.rollCount }, () => rollDie(die)))
    .map(v => Math.min(die, Math.max(1, Math.trunc(v))));
  const refilled = refillRerolls(entity, group);
  if (rolls.length > 1) return withState(refilled, { ...stateOf(refilled, groupId), pendingRolls: rolls });
  const optionId = optionForRoll(group, rolls[0]);
  return optionId ? setMode(refilled, groupId, optionId, physical ? 'physical_roll' : 'roll', { roll: rolls[0] }, now) : refilled;
}

/** Choose which of the held rolls the spirit answers (Two Voices). */
export function pickPendingRoll(entity: Entity, groupId: string, index: number, now: string = new Date().toISOString()): Entity {
  const group = findModeGroup(entity, groupId);
  const pending = entity.modeStates?.[groupId]?.pendingRolls;
  if (!group || !pending || index < 0 || index >= pending.length) return entity;
  const optionId = optionForRoll(group, pending[index]);
  return optionId ? setMode(entity, groupId, optionId, 'pick', { roll: pending[index], rolls: pending }, now) : entity;
}

/**
 * Spend one re-roll (Council of Spirits). With held rolls, `index` names the
 * die to replace and the pick is still pending; otherwise the active result
 * is replaced and the NEW result must be kept. No-op with no re-rolls left.
 */
export function rerollMode(
  entity: Entity, groupId: string, opts: { index?: number; physical?: number } = {}, now: string = new Date().toISOString(),
): Entity {
  const group = findModeGroup(entity, groupId);
  if (!group || group.selector.kind !== 'table') return entity;
  const info = modeSelectorInfo(entity, group);
  const poolId = modeRerollResourceId(groupId);
  const pool = entity.resources.custom.find(r => r.id === poolId);
  if (info.rerollsLeft <= 0 || !pool || pool.current <= 0) return entity;
  const value = Math.min(group.selector.die, Math.max(1, Math.trunc(opts.physical ?? rollDie(group.selector.die))));
  const spent: Entity = { ...entity, resources: { ...entity.resources, custom: entity.resources.custom.map(r => r.id === poolId ? { ...r, current: r.current - 1 } : r) } };
  const pending = entity.modeStates?.[groupId]?.pendingRolls;
  if (pending) {
    const i = opts.index ?? 0;
    if (i < 0 || i >= pending.length) return entity;
    return withState(spent, { ...stateOf(spent, groupId), pendingRolls: pending.map((v, k) => k === i ? value : v) });
  }
  const optionId = optionForRoll(group, value);
  return optionId ? setMode(spent, groupId, optionId, 'reroll', { roll: value }, now) : entity;
}

// ── target-scope selection (Command the Field) ──────────────────────────────

export function targetLimit(entity: Entity, group: ModeGroup): number {
  return (group.maxTargets ?? 1) + (entity.targetModes?.[group.id]?.extraTargets ?? 0);
}

export function setTargetMode(entity: Entity, groupId: string, targetId: string, optionId: string): Entity {
  const group = findModeGroup(entity, groupId);
  if (!group || group.scope !== 'target' || !group.options.some(o => o.id === optionId)) return entity;
  const cur = entity.targetModes?.[groupId] ?? { groupId, members: {}, extraTargets: 0 };
  if (!(targetId in cur.members) && Object.keys(cur.members).length >= targetLimit(entity, group)) return entity;
  return { ...entity, targetModes: { ...(entity.targetModes ?? {}), [groupId]: { ...cur, members: { ...cur.members, [targetId]: optionId } } } };
}

export function removeTargetMode(entity: Entity, groupId: string, targetId: string): Entity {
  const cur = entity.targetModes?.[groupId];
  if (!cur || !(targetId in cur.members)) return entity;
  const { [targetId]: _gone, ...members } = cur.members;
  return { ...entity, targetModes: { ...(entity.targetModes ?? {}), [groupId]: { ...cur, members } } };
}

export function setExtraTargets(entity: Entity, groupId: string, extra: number): Entity {
  const cur = entity.targetModes?.[groupId] ?? { groupId, members: {}, extraTargets: 0 };
  return { ...entity, targetModes: { ...(entity.targetModes ?? {}), [groupId]: { ...cur, extraTargets: Math.max(0, Math.trunc(extra)) } } };
}
