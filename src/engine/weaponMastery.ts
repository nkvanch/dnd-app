// ============================================================================
// FILE: src/engine/weaponMastery.ts
// Weapon Mastery as a TRACKED property (2024 rules). Capacity and eligibility come from class features
// as ordinary effects, so they follow level, multiclassing and feature removal for free:
//   stat_modifier 'weapon_mastery_slots'       add N     how many weapon kinds the feature lets you master
//   stat_modifier 'weapon_mastery_rule:<rule>' set 1     which weapons that feature allows (content/weaponMastery.ts)
// What the player chose is the only stored state: Entity.weaponMastery.picks, a list of weapon ids
// ('greataxe'). A pick that no longer fits (the capacity shrank, the feature was removed) is ignored
// rather than deleted, so regaining the feature restores it. Applying a mastery property in play stays
// with the player, as with every other rider in the app; the sheet shows which equipped weapons are
// mastered and what their property does.
// ============================================================================
import { Entity } from './types';
import { collectAllEffects, foldKnownBonuses } from './pipeline';
import {
  WEAPON_MASTERY_TABLE, WeaponMasteryEntry, MasteryEligibility, MasteryProperty, isEligibleForMastery, masteryEntryFor,
} from '../content/weaponMastery';

const RULE_PREFIX = 'weapon_mastery_rule:';

function masteryEffects(entity: Entity) {
  return foldKnownBonuses(collectAllEffects(entity), entity).map(ae => ae.effect);
}

/** How many weapon kinds the character can master right now (0 for a character with no Weapon Mastery feature). */
export function weaponMasteryCapacity(entity: Entity): number {
  return masteryEffects(entity)
    .filter(e => e.target === 'weapon_mastery_slots' && e.operation === 'add' && typeof e.value === 'number')
    .reduce((sum, e) => sum + (e.value as number), 0);
}

/** Eligibility rules the character's Weapon Mastery features grant. */
export function weaponMasteryRules(entity: Entity): MasteryEligibility[] {
  const rules = new Set<MasteryEligibility>();
  for (const e of masteryEffects(entity)) {
    if (e.target.startsWith(RULE_PREFIX) && e.operation === 'set' && e.value) rules.add(e.target.slice(RULE_PREFIX.length) as MasteryEligibility);
  }
  return [...rules];
}

/** Every weapon the character may choose to master: eligible under at least one of their rules. */
export function eligibleMasteryWeapons(entity: Entity): WeaponMasteryEntry[] {
  const rules = weaponMasteryRules(entity);
  return WEAPON_MASTERY_TABLE.filter(w => rules.some(r => isEligibleForMastery(w, r)));
}

/** The weapon ids the character currently masters: their picks, still eligible, within capacity. */
export function masteredWeaponIds(entity: Entity): string[] {
  const capacity = weaponMasteryCapacity(entity);
  if (capacity <= 0) return [];
  const eligible = new Set(eligibleMasteryWeapons(entity).map(w => w.id));
  return (entity.weaponMastery?.picks ?? []).filter(id => eligible.has(id)).slice(0, capacity);
}

/** The mastery property usable with this item (id or name), or null if the weapon isn't mastered. */
export function masteryPropertyFor(entity: Entity, itemIdOrName: string | undefined): MasteryProperty | null {
  const entry = masteryEntryFor(itemIdOrName);
  if (!entry) return null;
  return masteredWeaponIds(entity).includes(entry.id) ? entry.mastery : null;
}

/**
 * Stores the player's picks: unknown, ineligible and duplicate ids are dropped and the list is cut to the
 * current capacity. Returns the same entity when nothing changes.
 */
export function setWeaponMasteryPicks(entity: Entity, picks: readonly string[]): Entity {
  const eligible = new Set(eligibleMasteryWeapons(entity).map(w => w.id));
  const capacity = weaponMasteryCapacity(entity);
  const clean = [...new Set(picks)].filter(id => eligible.has(id)).slice(0, capacity);
  const before = entity.weaponMastery?.picks ?? [];
  if (clean.length === before.length && clean.every((id, i) => id === before[i])) return entity;
  return { ...entity, weaponMastery: { picks: clean } };
}
