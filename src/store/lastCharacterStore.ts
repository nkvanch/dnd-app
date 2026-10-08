import { create } from 'zustand';
import { getMeta, setMeta } from '../db/appMetaRepo';
const KEY = 'last_opened_character_id';
type State = { lastCharacterId: string | null; initialized: boolean; load: () => Promise<void>; markOpened: (id: string) => Promise<void>; clearIfDeleted: (id: string) => Promise<void> };
export const useLastCharacterStore = create<State>((set, get) => ({
  lastCharacterId: null, initialized: false,
  load: async () => { if (get().initialized) return; const id = await getMeta(KEY); set({ lastCharacterId: id || null, initialized: true }); },
  markOpened: async id => { set({ lastCharacterId: id, initialized: true }); await setMeta(KEY, id).catch(() => {}); },
  clearIfDeleted: async id => { if (get().lastCharacterId === id) { set({ lastCharacterId: null, initialized: true }); await setMeta(KEY, '').catch(() => {}); } },
}));
