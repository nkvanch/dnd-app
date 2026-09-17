// src/content/favorites.ts
// COMPENDIUM-2: generalizes the Compendium's per-device favorites from
// Condition-only to every supported content type, keyed by stable content
// identity (`${type}:${id}`) rather than a separate favorites store per
// type. One-time migration from the old Condition-only key preserves
// existing favorited conditions — "do not break existing Condition
// favorites."
import { getMeta, setMeta } from '../db/appMetaRepo';
import { ContentTypeId } from './contentQuery';

const FAVORITES_KEY = 'compendium_favorites';
// The Compendium's original, Condition-only favorites key (pre-COMPENDIUM-2).
const LEGACY_CONDITION_FAVORITES_KEY = 'compendium_favorite_condition_ids';

export function favoriteKey(type: ContentTypeId, id: string): string {
  return `${type}:${id}`;
}

/** Loads the favorites set, migrating the legacy Condition-only key into the
 *  new generalized shape (once) if the new key has never been written. */
export async function loadFavorites(): Promise<Set<string>> {
  const raw = await getMeta(FAVORITES_KEY);
  if (raw) {
    try { return new Set(JSON.parse(raw) as string[]); } catch { /* corrupted — start fresh */ }
  }
  const legacyRaw = await getMeta(LEGACY_CONDITION_FAVORITES_KEY);
  if (legacyRaw) {
    try {
      const legacyIds = JSON.parse(legacyRaw) as string[];
      const migrated = new Set(legacyIds.map(id => favoriteKey('condition', id)));
      await setMeta(FAVORITES_KEY, JSON.stringify(Array.from(migrated)));
      return migrated;
    } catch { /* corrupted legacy value — start fresh */ }
  }
  return new Set();
}

export async function saveFavorites(favorites: Set<string>): Promise<void> {
  await setMeta(FAVORITES_KEY, JSON.stringify(Array.from(favorites)));
}
