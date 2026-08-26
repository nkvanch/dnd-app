// ============================================================================
// FILE: src/content/itemRepo.ts
// Default implementation — thin synchronous wrapper around the existing
// static item arrays (src/content/items/index.ts). Metro's platform-
// extension resolution picks itemRepo.native.ts instead of this file on
// iOS/Android builds (see that file for the real SQLite-backed
// implementation); this file is what `expo start --web` actually bundles.
// Mirrors spellRepo.ts's design exactly.
// ============================================================================
import { Item } from '../engine/types';
import { ALL_ITEMS } from './items/index';
import { toItemIndexEntry } from './itemRepo.types';
import type { ItemIndexEntry, ItemRepo } from './itemRepo.types';

const itemById = new Map<string, Item>(ALL_ITEMS.map(i => [i.id, i]));

const index: ItemIndexEntry[] = ALL_ITEMS.map(toItemIndexEntry);

export const itemRepo: ItemRepo = {
  async init() { /* no-op — the static arrays are already in memory */ },
  getIndex() { return index; },
  async ensureLoaded() { /* no-op — everything is already resident */ },
  getItemSync(id) { return itemById.get(id); },
};
