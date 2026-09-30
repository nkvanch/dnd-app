// src/content/identityLabels.ts
// Display labels for a character's identity ids (race / subrace / class / subclass / background), resolved with
// the same merged official + homebrew content the rest of the app reads. Presentation only: stored ids are never
// touched. An id that resolves to nothing falls back to a readable version of the id, never a blank.
import type { Entity, Race, CharClass, Background, HomebrewSubclass } from '../engine/types';
import { getClassLevels, formatClassLabel } from '../engine/multiclass';
import { getSubclassEntryMerged } from './subclasses/subclassBrowse';

export type IdentityLabels = {
  race: string;
  subrace: string | null;
  /** "Bard", or "Fighter 3 / Wizard 2" when multiclassed. */
  class: string;
  /** The chosen subclass name(s), or null when none is chosen. */
  subclass: string | null;
  background: string;
};

/** "hill_dwarf" -> "Hill Dwarf" — the fallback when content can't be found (e.g. a removed homebrew id). */
export function prettyId(id: string): string {
  return id.replace(/[_-]+/g, ' ').trim().replace(/\b\w/g, c => c.toUpperCase());
}

export function resolveIdentityLabels(
  entity: Pick<Entity, 'identity'>,
  db: { races: readonly Race[]; classes: readonly CharClass[]; backgrounds: readonly Background[] },
  homebrewSubclasses: readonly HomebrewSubclass[] = [],
): IdentityLabels {
  const { raceId, subRaceId, backgroundId } = entity.identity;
  const race = db.races.find(r => r.id === raceId);
  const subrace = subRaceId
    ? (race?.subraces ?? db.races.flatMap(r => r.subraces ?? [])).find(s => s.id === subRaceId)
    : undefined;
  const className = (id: string) => db.classes.find(c => c.id === id)?.name ?? prettyId(id);

  const levels = getClassLevels(entity as Entity);
  const classLabel = levels.length > 1
    ? formatClassLabel(entity as Entity, className)
    : (levels[0] ? className(levels[0].classId) : '');

  const subclassNames = levels
    .filter(l => l.subclassId)
    .map(l => getSubclassEntryMerged(l.classId, l.subclassId as string, homebrewSubclasses as HomebrewSubclass[])?.name ?? prettyId(l.subclassId as string));

  return {
    race: race?.name ?? (raceId ? prettyId(raceId) : ''),
    subrace: subRaceId ? (subrace?.name ?? prettyId(subRaceId)) : null,
    class: classLabel,
    subclass: subclassNames.length > 0 ? subclassNames.join(' / ') : null,
    background: db.backgrounds.find(b => b.id === backgroundId)?.name ?? (backgroundId ? prettyId(backgroundId) : ''),
  };
}
