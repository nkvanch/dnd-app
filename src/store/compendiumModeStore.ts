// src/store/compendiumModeStore.ts
// Lightweight, session-local Compendium UI state: which of the three modes is
// showing, and (Packages mode) which installed package's detail is open.
// Plain Zustand — like browseStateStore, it survives a Compendium round-trip
// through an editor or another tab because the tab screen itself is stateless
// about it. No content data is stored here, only ids.
import { create } from 'zustand';
import { CompendiumMode, DEFAULT_COMPENDIUM_MODE } from '../content/compendiumModes';

type CompendiumModeStore = {
  mode: CompendiumMode;
  /** Installed package whose detail view is open in Packages mode. */
  selectedPackId: string | null;
  setMode: (mode: CompendiumMode) => void;
  openPack: (packId: string) => void;
  closePack: () => void;
};

export const useCompendiumModeStore = create<CompendiumModeStore>(set => ({
  mode: DEFAULT_COMPENDIUM_MODE,
  selectedPackId: null,
  setMode: mode => set({ mode }),
  openPack: packId => set({ mode: 'packages', selectedPackId: packId }),
  closePack: () => set({ selectedPackId: null }),
}));
