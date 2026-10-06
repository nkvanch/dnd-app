// ============================================================================
// FILE: src/content/officialSource.ts
// Where the app's official races, classes, backgrounds, feats and subclasses come from. By default that is the
// hardcoded catalog; once installed content packs are available, a ContentProvider built from them is set here and
// every reader of the official catalog (the creation screens, the merged content database, the Compendium's Official
// view, subclass browsing) follows it, with no change to those readers. Setting the provider back to null restores the
// hardcoded catalog. The version number changes on every switch so caches keyed on the official catalog can refresh.
// ============================================================================
import type { ContentProvider } from './provider/contentProvider';

let active: ContentProvider | null = null;
let version = 0;

/** Makes `provider` the source of the official catalog, or null for the hardcoded catalog. */
export function setOfficialContentProvider(provider: ContentProvider | null): void {
  if (provider === active) return;
  active = provider;
  version += 1;
}

export const getOfficialContentProvider = (): ContentProvider | null => active;

/** Changes whenever the official source changes (for cache keys). */
export const officialContentVersion = (): number => version;
