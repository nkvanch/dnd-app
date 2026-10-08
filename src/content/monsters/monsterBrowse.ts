// src/content/monsters/monsterBrowse.ts
// COMPENDIUM-1: extracted from app/dm/monsters.tsx so the Compendium's
// Monster browser shares the exact same derivation logic instead of a
// second, independently-written copy. Movement-type/resistance/immunity/
// condition-immunity/spellcaster aren't direct MonsterTemplate fields, but
// each is real, structured data reachable via features[].effects — same
// "derive, don't fabricate" approach used throughout this session (see
// raceBrowse.ts, backgroundBrowse.ts). Alignment/legendaryActions/
// lairActions/senses/languages ARE direct fields, used as-is by callers.
import { MonsterTemplate } from './types';
import { SortOption, nameSortOptions, sourceSortOption } from '../contentQuery';
import { getContentProvenance } from '../provenance';

// MonsterTemplate.size is a lowercase literal union ('tiny'|'small'|...) —
// this order list is kept lowercase to match the real field values directly
// (a prior capitalized version silently broke app/dm/monsters.tsx's own
// SIZE_ORDER.indexOf() size-sort, since indexOf('large') against a
// capitalized 'Large' list never matched, real bug fixed here).
export const MONSTER_SIZE_ORDER = ['tiny', 'small', 'medium', 'large', 'huge', 'gargantuan'];
export const MONSTER_MOVEMENT_TYPES = ['fly', 'swim', 'climb', 'burrow'] as const;

export function monsterMovementTypes(t: MonsterTemplate): Set<string> {
  const out = new Set<string>();
  for (const f of t.features) for (const e of f.effects) {
    if (e.type === 'grant_movement' && e.movementType) out.add(e.movementType);
  }
  return out;
}
export function monsterResistances(t: MonsterTemplate): Set<string> {
  const out = new Set<string>();
  for (const f of t.features) for (const e of f.effects) {
    if (e.type === 'grant_resistance') out.add(e.target);
  }
  return out;
}
export function monsterImmunities(t: MonsterTemplate): Set<string> {
  const out = new Set<string>();
  for (const f of t.features) for (const e of f.effects) {
    if (e.type === 'grant_immunity') out.add(e.target);
  }
  return out;
}
export function monsterConditionImmunities(t: MonsterTemplate): Set<string> {
  const out = new Set<string>();
  for (const f of t.features) for (const e of f.effects) {
    if (e.type === 'condition_immunity') out.add(e.target);
  }
  return out;
}
export function monsterHasDarkvision(t: MonsterTemplate): boolean {
  return t.senses.some(s => s.toLowerCase().includes('darkvision'));
}
/** Best-effort: a monster is treated as a spellcaster if any feature grants
 *  spells directly (grant_spell) or is named "Spellcasting"/"Innate
 *  Spellcasting" (the two standard SRD stat-block feature names) — there's
 *  no dedicated boolean field, so this is a disclosed heuristic over real
 *  feature data, not a fabricated category. */
export function monsterIsSpellcaster(t: MonsterTemplate): boolean {
  return t.features.some(f =>
    f.effects.some(e => e.type === 'grant_spell') ||
    /spellcasting/i.test(f.name)
  );
}

export function crLabel(cr: number): string {
  if (cr === 0.125) return '1/8';
  if (cr === 0.25)  return '1/4';
  if (cr === 0.5)   return '1/2';
  return String(cr);
}

export function monsterSourceLabel(t: MonsterTemplate, isHomebrew: boolean): string | undefined {
  return getContentProvenance(t, { isHomebrew }).sourceLabel;
}

export function monsterSortOptions(isHomebrewOf: (t: MonsterTemplate) => boolean): SortOption<MonsterTemplate>[] {
  return [
    ...nameSortOptions<MonsterTemplate>(),
    { id: 'cr', label: 'CR', compare: (a, b) => a.cr - b.cr || a.name.localeCompare(b.name) },
    { id: 'type', label: 'Creature Type', compare: (a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name) },
    {
      id: 'size', label: 'Size',
      compare: (a, b) => (MONSTER_SIZE_ORDER.indexOf(a.size) - MONSTER_SIZE_ORDER.indexOf(b.size)) || a.name.localeCompare(b.name),
    },
    sourceSortOption<MonsterTemplate>(t => monsterSourceLabel(t, isHomebrewOf(t))),
  ];
}
