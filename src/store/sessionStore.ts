// ============================================================================
// FILE: src/store/sessionStore.ts
// Zustand store for device session and identity.
// Hydrated on app startup from sessionRepo.getOrCreateSession().
// ============================================================================
import { create } from 'zustand';
import { DeviceSession } from '../engine/types';
import { getOrCreateSession, updateSession } from '../db/sessionRepo';

type SessionStore = {
  session:  DeviceSession | null;
  isLoading: boolean;

  /** Called once on startup after initDb(). Loads or creates the session. */
  initSession: () => Promise<void>;

  /** Update mutable session fields (nickname, role, campaignId). */
  setNickname:   (nickname: string)          => Promise<void>;
  setRole:       (role: 'dm' | 'player')     => Promise<void>;
  setCampaignId: (campaignId: string | null) => Promise<void>;
};

export const useSessionStore = create<SessionStore>((set, get) => ({
  session:   null,
  isLoading: false,

  initSession: async () => {
    set({ isLoading: true });
    try {
      const session = await getOrCreateSession();
      set({ session, isLoading: false });
    } catch (e) {
      console.error('[sessionStore] initSession failed:', e);
      set({ isLoading: false });
    }
  },

  setNickname: async (nickname) => {
    await updateSession({ nickname });
    const { session } = get();
    if (session) set({ session: { ...session, nickname } });
  },

  setRole: async (role) => {
    await updateSession({ role });
    const { session } = get();
    if (session) set({ session: { ...session, role } });
  },

  setCampaignId: async (campaignId) => {
    await updateSession({ campaignId });
    const { session } = get();
    if (session) set({ session: { ...session, campaignId } });
  },
}));
