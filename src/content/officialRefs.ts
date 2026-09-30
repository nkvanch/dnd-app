// src/content/officialRefs.ts
// "Is this reference official/base content?" — used by the export review to
// say a reference is intentionally NOT bundled (it exists on every device)
// instead of reporting it as missing. Follows the existing dependency policy:
// only Homebrew is ever copied into a package; official content is referenced.
import type { DependencyRef } from '../engine/contentDependencies';
import { globalContentDB } from './classes/library';
import { spellRepo } from './spellRepo';
import { itemRepo } from './itemRepo';
import { ALL_MONSTER_TEMPLATES } from './monsters/srd';
import { currentContentExposure, exposedSubraces } from './contentExposure';

// Same module-load evaluation the Compendium uses (the build mode is fixed for the app's lifetime).
const CONTENT_EXPOSURE = currentContentExposure();

let cache: Map<string, Set<string>> | null = null;

function officialIds(): Map<string, Set<string>> {
  if (cache) return cache;
  const ids = (arr: readonly { id: string }[]) => new Set(arr.map(x => x.id));
  cache = new Map<string, Set<string>>([
    ['race', ids(globalContentDB.races)],
    ['subrace', new Set(globalContentDB.races.flatMap(r => exposedSubraces(r.subraces, CONTENT_EXPOSURE).map(s => s.id)))],
    ['class', ids(globalContentDB.classes)],
    ['background', ids(globalContentDB.backgrounds)],
    ['feat', ids(globalContentDB.feats ?? [])],
    ['condition', ids(globalContentDB.conditions)],
    ['monster', ids(ALL_MONSTER_TEMPLATES)],
    ['spell', ids(spellRepo.getIndex())],
    ['item', ids(itemRepo.getIndex())],
  ]);
  return cache;
}

/** Display name of a bundled official race/class/background/feat/condition, or undefined (spells/items/monsters resolve through their repos). */
export function officialRefName(ref: DependencyRef): string | undefined {
  const list: readonly { id: string; name: string }[] | undefined =
    ref.type === 'race' ? globalContentDB.races
    : ref.type === 'class' ? globalContentDB.classes
    : ref.type === 'background' ? globalContentDB.backgrounds
    : ref.type === 'feat' ? (globalContentDB.feats ?? [])
    : ref.type === 'condition' ? globalContentDB.conditions
    : undefined;
  return list?.find(x => x.id === ref.id)?.name;
}

export function isOfficialRef(ref: DependencyRef): boolean {
  return officialIds().get(ref.type)?.has(ref.id) ?? false;
}
