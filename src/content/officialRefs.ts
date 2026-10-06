// src/content/officialRefs.ts
// "Is this reference official/base content?" — used by the export review to
// say a reference is intentionally NOT bundled (it exists on every device)
// instead of reporting it as missing. Follows the existing dependency policy:
// only Homebrew is ever copied into a package; official content is referenced.
import type { DependencyRef } from '../engine/contentDependencies';
import { globalContentDB } from './classes/library';
import { spellRepo } from './spellRepo';
import { itemRepo } from './itemRepo';
import { officialMonsters } from './runtimeRules';
import { currentContentExposure, exposedSubraces } from './contentExposure';
import { officialContentVersion } from './officialSource';


let cache: Map<string, Set<string>> | null = null;
let cacheVersion = -1;

function officialIds(): Map<string, Set<string>> {
  if (cache && cacheVersion === officialContentVersion()) return cache;
  cacheVersion = officialContentVersion();
  const ids = (arr: readonly { id: string }[]) => new Set(arr.map(x => x.id));
  cache = new Map<string, Set<string>>([
    ['race', ids(globalContentDB.races)],
    ['subrace', new Set(globalContentDB.races.flatMap(r => exposedSubraces(r.subraces, currentContentExposure()).map(s => s.id)))],
    ['class', ids(globalContentDB.classes)],
    ['background', ids(globalContentDB.backgrounds)],
    ['feat', ids(globalContentDB.feats ?? [])],
    ['condition', ids(globalContentDB.conditions)],
    ['monster', ids(officialMonsters())],
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
