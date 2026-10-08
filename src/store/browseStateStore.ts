// src/store/browseStateStore.ts
// BROWSE-STATE-1: lightweight, session-local (never persisted to disk —
// "the immediate requirement is navigation-state preservation," not
// surviving an app restart) preservation of a browse screen's search/
// filter/sort/scroll state across navigation. Every content picker in the
// app (Compendium, Race, Subrace, Class, Subclass, Background, Feat, Spell,
// Item, Monster) is its own route/component instance — navigating away
// (e.g. into a nested homebrew builder, or a detail screen) and back
// unmounts and remounts it, which would otherwise silently reset search
// text, active filters, and the chosen sort. Since Entity draft state
// already survives this exact round-trip via useCharacterStore (a plain
// Zustand store, unaffected by component mount/unmount), the same
// mechanism generalizes cleanly to browse UI state — one small store,
// keyed by a stable per-screen string, instead of plumbing state through
// route params or lifting it into a dozen different parent components.
import { create } from 'zustand';

export type BrowseState = {
  search?:      string;
  filters?:     Record<string, unknown>;
  sort?:        string;
  contentType?: string; // Compendium only — which type tab is active
  scrollY?:     number;
};

type BrowseStateStore = {
  states: Record<string, BrowseState>;
  setBrowseState: (screenKey: string, patch: Partial<BrowseState>) => void;
  getBrowseState: (screenKey: string) => BrowseState;
  clearBrowseState: (screenKey: string) => void;
};

const EMPTY: BrowseState = {};

export const useBrowseStateStore = create<BrowseStateStore>((set, get) => ({
  states: {},
  setBrowseState: (screenKey, patch) => set(s => ({
    states: { ...s.states, [screenKey]: { ...s.states[screenKey], ...patch } },
  })),
  getBrowseState: (screenKey) => get().states[screenKey] ?? EMPTY,
  clearBrowseState: (screenKey) => set(s => {
    if (!(screenKey in s.states)) return s;
    const next = { ...s.states };
    delete next[screenKey];
    return { states: next };
  }),
}));
