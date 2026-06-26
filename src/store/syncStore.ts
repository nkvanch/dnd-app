// ============================================================================
// FILE: src/store/syncStore.ts
// Zustand store for sync status — drives the connection indicator in the UI.
// ============================================================================
import { create } from 'zustand';
import { SyncStatus } from '../sync/syncManager';

type SyncStore = {
  status:    SyncStatus;
  setStatus: (status: SyncStatus) => void;
};

const DEFAULT_STATUS: SyncStatus = {
  role:        'offline',
  connected:   false,
  clientCount: 0,
  roomCode:    null,
  sessionId:   null,
  roster:      [],
  lastError:   null,
};

export const useSyncStore = create<SyncStore>(set => ({
  status:    DEFAULT_STATUS,
  setStatus: (status) => set({ status }),
}));
