// src/store/homebrewLookup.ts
// HOMEBREW-PACKAGE-1: a plain {type,id} -> item lookup built from the
// homebrew store's own arrays — the one shared shape the package export
// (dependency closure) and import (conflict detection) flows both need,
// so neither the Homebrew screen nor the import screen reimplements its
// own per-type switch. Store-layer (not engine/) since it's built directly
// from HomebrewStore's field shape.
import { ContentCacheType, HomebrewContent } from '../db/contentCacheRepo';
import { DependencyRef } from '../engine/contentDependencies';

export type HomebrewArrays = {
  races: HomebrewContent[]; subraces: HomebrewContent[]; classes: HomebrewContent[];
  subclasses: HomebrewContent[]; spells: HomebrewContent[]; backgrounds: HomebrewContent[];
  features: HomebrewContent[]; items: HomebrewContent[]; feats: HomebrewContent[];
  monsters: HomebrewContent[]; conditions: HomebrewContent[];
};

const TYPE_TO_KEY: Record<ContentCacheType, keyof HomebrewArrays> = {
  race: 'races', subrace: 'subraces', class: 'classes', subclass: 'subclasses',
  spell: 'spells', background: 'backgrounds', feature: 'features', item: 'items',
  feat: 'feats', monster: 'monsters', condition: 'conditions',
};

/** {type,id} -> the actual local item, or undefined if none exists with that id. */
export function makeHomebrewLookup(hb: HomebrewArrays): (ref: DependencyRef) => HomebrewContent | undefined {
  return (ref) => hb[TYPE_TO_KEY[ref.type]].find(i => i.id === ref.id);
}

/** {type,id} -> the local item's NAME only (detectConflicts' shape), or
 *  undefined if none exists with that id. */
export function makeHomebrewNameLookup(hb: HomebrewArrays): (type: ContentCacheType, id: string) => string | undefined {
  return (type, id) => hb[TYPE_TO_KEY[type]].find(i => i.id === id)?.name;
}

export function homebrewArrayFor(hb: HomebrewArrays, type: ContentCacheType): HomebrewContent[] {
  return hb[TYPE_TO_KEY[type]];
}
