// ============================================================================
// FILE: src/engine/modes.ts
// Mode Groups (see ModeGroup in types.ts): a class holds exactly one of a set of switchable options
// at a time, and switching swaps that option's whole block of grants atomically — Emperor Warlock's
// Legacy Binding, where a new Bound Spirit replaces the old one every in-game month.
//
// An option IS a HomebrewSubclass of the class, so everything the app already does for a subclass
// is reused rather than duplicated: the option's level-gated progression is applied up to the
// class's current level (binding at level 12 immediately grants everything the option offers at
// 1, 5 and 10), later level-ups pick up the rest, the old option's features, resources,
// proficiencies and spell access are stripped by provenance, and the swap is one entity -> entity
// function so the caller persists once and records one timeline entry.
//
// What this adds on top of a plain subclass change:
//   - the player's own die result selects the option (the app never rolls for content selection);
//   - several dice may be rolled (Two Voices) and a roll may be thrown away (Council of Spirits);
//   - from some class level any option may simply be chosen (Crown of Legends);
//   - mode-owned persistent state: resources an option granted keep their spent/unspent value while
//     the character is in another option (the "stash"), and come back unchanged on return;
//   - per-period resources (Council of Spirits' once-a-month reroll) are restored at each new period.
// No calendar exists anywhere: a period ends when the player says so.
// ============================================================================
import {
  Entity, ModeGroup, ClassProgression, CampaignRules, CharClass,
} from './types';
import { applySubclassToEntity } from './leveling';
import { recomputeDerived } from './pipeline';
import { DEFAULT_RULES } from '../store/characterStore';

/** The class level that gates this group: the level in `group.classId` (multiclass-aware). */
export function modeClassLevel(entity: Entity, group: ModeGroup): number {
  const entry = entity.identity.classes?.find(c => c.classId === group.classId);
  if (entry) return entry.level;
  return entity.identity.classId === group.classId ? entity.identity.level : 0;
}

/** Mode groups declared by the classes this entity actually has levels in. */
export function modeGroupsForEntity(entity: Entity, classDefs: readonly CharClass[]): ModeGroup[] {
  const ids = new Set<string>([
    entity.identity.classId,
    ...(entity.identity.classes ?? []).map(c => c.classId as string),
  ]);
  return classDefs.filter(c => ids.has(c.id)).flatMap(c => c.modeGroups ?? []);
}

/** The option the character currently holds in this group, or null. */
export function activeModeOption(entity: Entity, group: ModeGroup): string | null {
  const entry = entity.identity.classes?.find(c => c.classId === group.classId);
  const id = entry ? entry.subclassId : entity.identity.classId === group.classId ? entity.identity.subclassId : null;
  return id && group.optionIds.includes(id as string) ? (id as string) : null;
}

/** How many dice the player rolls when a new period starts, at their current class level. */
export function modeDiceCount(group: ModeGroup, classLevel: number): number {
  const tiers = (group.selector.diceAtLevel ?? []).filter(t => classLevel >= t.level);
  return tiers.length ? Math.max(...tiers.map(t => t.dice)) : 1;
}

/** The option a die result maps to, or null for a result outside the table. */
export function optionForRoll(group: ModeGroup, value: number): string | null {
  return group.selector.table.find(t => t.value === value)?.optionId ?? null;
}

export function modeAllowsFreeChoice(group: ModeGroup, classLevel: number): boolean {
  return group.selector.freeChoiceFromLevel !== undefined && classLevel >= group.selector.freeChoiceFromLevel;
}

/** Whether the throw-it-away-and-roll-again resource exists, is unlocked, and has a use left. */
export function modeRerollAvailable(entity: Entity, group: ModeGroup): boolean {
  const { rerollResourceId, rerollFromLevel } = group.selector;
  if (!rerollResourceId) return false;
  if (rerollFromLevel !== undefined && modeClassLevel(entity, group) < rerollFromLevel) return false;
  const r = entity.resources.custom.find(x => x.id === rerollResourceId);
  return !!r && r.current > 0;
}

/** Spends one use of the reroll resource. No-op (same reference) when none is available. */
export function spendModeReroll(entity: Entity, group: ModeGroup): Entity {
  if (!modeRerollAvailable(entity, group)) return entity;
  const id = group.selector.rerollResourceId!;
  return {
    ...entity,
    resources: { ...entity.resources, custom: entity.resources.custom.map(r => r.id === id ? { ...r, current: r.current - 1 } : r) },
  };
}

/** What changing option would take away and bring in — for a confirmation screen. */
export function previewModeSwitch(
  entity: Entity, group: ModeGroup, toOptionId: string, toProgression: ClassProgression,
): { leaving: string[]; arriving: string[]; preservedResources: string[] } {
  const active = activeModeOption(entity, group);
  const leaving = entity.features
    .filter(f => f.source.kind === 'subclass' && f.source.refId === active)
    .map(f => f.name);
  const level = modeClassLevel(entity, group);
  const arriving = toProgression.entries
    .filter(e => e.level <= level)
    .flatMap(e => e.grants)
    .filter(g => g.kind === 'feature')
    .map(g => (g.value as { name: string }).name);
  const preservedResources = entity.resources.custom
    .filter(r => r.sourceKind === 'subclass' && r.sourceId === active)
    .map(r => r.name);
  void toOptionId;
  return { leaving, arriving, preservedResources };
}

/**
 * Changes the character's option in `group` to `optionId` in one step: stash the outgoing option's
 * resource values, strip it, apply the incoming option's progression up to the current class level,
 * restore the incoming option's own stashed values, restore the per-period resources, recompute.
 * Choosing the option already held is a legitimate new period (the die came up the same): nothing
 * is swapped, but the per-period resources are restored and the change counter advances.
 */
export function switchModeOption(
  entity:      Entity,
  group:       ModeGroup,
  optionId:    string,
  progression: ClassProgression,
  rules:       CampaignRules = DEFAULT_RULES,
): Entity {
  if (!group.optionIds.includes(optionId)) return entity;
  const active = activeModeOption(entity, group);
  const prior = entity.modeState?.[group.id] ?? { stash: {}, changes: 0 };

  const stash = { ...prior.stash };
  if (active) {
    stash[active] = Object.fromEntries(
      entity.resources.custom.filter(r => r.sourceKind === 'subclass' && r.sourceId === active).map(r => [r.id, r.current]),
    );
  }

  let updated = entity;
  if (active !== optionId) {
    // The outgoing option's own choices (a skill pick it offered, resolved or not) go with it, so coming
    // back later queues them fresh instead of colliding with a stale resolved copy.
    if (active) {
      updated = { ...updated, choices: updated.choices.filter(c => !(c.sourceKind === 'subclass' && c.sourceId === active)) };
    }
    const multi = (entity.identity.classes?.length ?? 0) > 1;
    const choiceId = updated.choices.find(c =>
      c.definition.kind === 'subclass' && (c.definition.forClassId ?? entity.identity.classId) === group.classId)?.id ?? '';
    updated = applySubclassToEntity(updated, choiceId, optionId, progression, rules, multi ? group.classId : undefined);

    const saved = stash[optionId];
    if (saved) {
      updated = {
        ...updated,
        resources: {
          ...updated.resources,
          custom: updated.resources.custom.map(r =>
            r.sourceKind === 'subclass' && r.sourceId === optionId && saved[r.id] !== undefined
              ? { ...r, current: Math.max(0, Math.min(r.maximum, saved[r.id])) } : r),
        },
      };
    }
  }

  const restore = new Set(group.restoreOnSwitch ?? []);
  if (restore.size) {
    updated = {
      ...updated,
      resources: { ...updated.resources, custom: updated.resources.custom.map(r => restore.has(r.id) ? { ...r, current: r.maximum } : r) },
    };
  }

  return recomputeDerived({
    ...updated,
    modeState: { ...(updated.modeState ?? {}), [group.id]: { stash, changes: prior.changes + 1 } },
  }, rules);
}
