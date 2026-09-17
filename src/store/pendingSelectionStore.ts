// src/store/pendingSelectionStore.ts
// SAVE-AND-ADD-1: a tiny one-shot handoff so a homebrew builder's "Save"
// can tell the picker that sent it here which newly-created content to
// select/add automatically, without threading a callback through router
// params. The builder calls setPending(screenKey, newId) right before
// navigating back (useSafeGoBack — which already returns to whichever
// screen pushed the builder, never through the global Homebrew tab); the
// picker calls consumePending(screenKey) once on (re)focus, which both
// reads AND clears the entry so it's only ever applied once.
import { create } from 'zustand';

type PendingSelectionStore = {
  pending: Record<string, string>;
  setPending: (screenKey: string, id: string) => void;
  consumePending: (screenKey: string) => string | null;
};

export const usePendingSelectionStore = create<PendingSelectionStore>((set, get) => ({
  pending: {},
  setPending: (screenKey, id) => set(s => ({ pending: { ...s.pending, [screenKey]: id } })),
  consumePending: (screenKey) => {
    const id = get().pending[screenKey];
    if (id === undefined) return null;
    set(s => {
      const next = { ...s.pending };
      delete next[screenKey];
      return { pending: next };
    });
    return id;
  },
}));
