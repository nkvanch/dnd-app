// src/content/compendiumModes.ts
// The Compendium's three same-page modes and the (pure) routing helpers that
// point at them. Kept free of React/zustand so it is directly unit-testable.
//
//   Official  — the ordinary Compendium browser (unchanged)
//   Homebrew  — the Homebrew LIBRARY (browse/manage existing content)
//   Packages  — the INSTALLED PACKAGES library
//
// Homebrew CREATION stays on the Homebrew tab (app/(tabs)/homebrew.tsx);
// nothing here routes to or replaces a builder.

export const COMPENDIUM_MODES = ['official', 'homebrew', 'packages'] as const;
export type CompendiumMode = typeof COMPENDIUM_MODES[number];

export const DEFAULT_COMPENDIUM_MODE: CompendiumMode = 'official';

export const COMPENDIUM_MODE_LABELS: Record<CompendiumMode, string> = {
  official: 'Official',
  homebrew: 'Homebrew',
  packages: 'Packages',
};

/** Validates an arbitrary value (a route param, persisted state) into a mode, or null. */
export function parseCompendiumMode(value: unknown): CompendiumMode | null {
  const v = Array.isArray(value) ? value[0] : value;
  return typeof v === 'string' && (COMPENDIUM_MODES as readonly string[]).includes(v) ? (v as CompendiumMode) : null;
}

/** Deep link straight to one Compendium mode. */
export function compendiumHref(mode: CompendiumMode): string {
  return `/(tabs)/compendium?mode=${mode}`;
}

/**
 * Old Homebrew-tab deep links for the two views that moved into the
 * Compendium (`/(tabs)/homebrew?view=library`, `?view=packages`). Returns the
 * Compendium href to redirect to, or null when the param names neither moved
 * view — in particular null for every CREATION route/param, which must never
 * be redirected.
 */
export function legacyHomebrewViewRedirect(view: unknown): string | null {
  const v = Array.isArray(view) ? view[0] : view;
  if (v === 'library') return compendiumHref('homebrew');
  if (v === 'packages' || v === 'installed') return compendiumHref('packages');
  return null;
}
