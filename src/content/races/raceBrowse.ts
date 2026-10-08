// src/content/races/raceBrowse.ts
// COMPENDIUM-1: extracted from app/creation/race.tsx so the Compendium's
// Race browser can share the exact same derivation logic instead of a
// second, independently-written copy. Darkvision/movement aren't direct
// Race fields — both are derived by scanning the race's own base Feature
// effects (grant_sense/grant_movement), the same "derive, don't fabricate"
// approach already used for monsters (monsterBrowse.ts) and backgrounds
// (backgroundBrowse.ts).
import { Race } from '../../engine/types';
import { SortOption, nameSortOptions, sourceSortOption } from '../contentQuery';
import { getContentProvenance } from '../provenance';

export const RACE_SIZE_ORDER = ['Tiny', 'Small', 'Medium', 'Large'] as const;
export const RACE_MOVEMENT_TYPES = ['fly', 'swim', 'climb', 'burrow'] as const;

export function hasDarkvision(race: { features: { effects: { type: string; senseType?: string }[] }[] }): boolean {
  return race.features.some(f => f.effects.some(e => e.type === 'grant_sense' && e.senseType === 'darkvision'));
}

export function raceMovementTypes(race: { features: { effects: { type: string; movementType?: string }[] }[] }): string[] {
  const set = new Set<string>();
  for (const f of race.features) for (const e of f.effects) {
    if (e.type === 'grant_movement' && e.movementType) set.add(e.movementType);
  }
  return Array.from(set);
}

/** Real, structured field — Race.subraces?.length > 0. */
export function hasSubraces(race: { subraces?: unknown[] }): boolean {
  return !!race.subraces && race.subraces.length > 0;
}

export function raceSourceLabel(race: Race, isHomebrew: boolean): string | undefined {
  return getContentProvenance(race, { isHomebrew }).sourceLabel;
}

const RACE_SIZE_RANK: Record<string, number> = { Tiny: 0, Small: 1, Medium: 2, Large: 3 };

export function raceSortOptions(isHomebrewOf: (race: Race) => boolean): SortOption<Race>[] {
  return [
    ...nameSortOptions<Race>(),
    sourceSortOption<Race>(r => raceSourceLabel(r, isHomebrewOf(r))),
    {
      id: 'size', label: 'Size',
      compare: (a, b) => (RACE_SIZE_RANK[a.size ?? ''] ?? 99) - (RACE_SIZE_RANK[b.size ?? ''] ?? 99) || a.name.localeCompare(b.name),
    },
  ];
}
