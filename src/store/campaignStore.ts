// ============================================================================
// FILE: src/store/campaignStore.ts
// Campaign + DM identity state management.
// ============================================================================
import { create } from 'zustand';
import { Campaign, CampaignRules } from '../engine/types';
import { saveCampaign, loadAllCampaigns, deleteCampaign, loadCampaign } from '../db/campaignRepo';
import { useSessionStore } from './sessionStore';
import { syncManager } from '../sync/syncManager';
import { DEFAULT_RULES } from './characterStore';

// ── Defaults ──────────────────────────────────────────────────────────────────
// DEFAULT_RULES is defined once in characterStore and imported here so a single
// edit to the book defaults (incl. houseRules) propagates everywhere.

function genId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

// ── Store ─────────────────────────────────────────────────────────────────────

type CampaignStore = {
  campaigns:      Campaign[];
  activeCampaign: Campaign | null;
  isLoading:      boolean;

  /** True when the logged-in device owns the active campaign. */
  isDm: boolean;

  /** Load all campaigns from SQLite. Called after initDb(). */
  loadCampaigns: () => Promise<void>;

  /**
   * Create a new campaign. The caller must be the DM device.
   * Sets activeCampaign and persists to SQLite.
   */
  createCampaign: (name: string) => Promise<Campaign>;

  /**
   * Join an existing campaign via 7-character code.
   * In the full sync implementation this resolves to the DM's IP.
   * For now it stores a stub campaign locally.
   */
  joinCampaign: (code: string) => Promise<void>;

  /** Assign a character to a campaign. */
  assignCharacterToCampaign: (characterId: string, campaignId: string) => Promise<void>;

  /** Set the active campaign (e.g. after joining). */
  setActiveCampaign: (campaign: Campaign | null) => void;

  /** Update campaign fields (name, rules, notes, etc.). */
  updateCampaign: (id: string, updater: (c: Campaign) => Campaign) => Promise<void>;

  /** Leave / remove the active campaign. */
  leaveCampaign: () => Promise<void>;

  /**
   * Re-establish the sync transport for an already-active campaign after an app
   * restart. DM re-hosts (new room code, since the LAN IP may have changed);
   * player reconnects using the stored join code. Safe no-op when offline.
   */
  resumeSync: () => Promise<void>;

  /**
   * Player-only: reconnect to the active campaign using a freshly-entered room
   * code. Needed because room codes are IP-derived and go stale if the DM's IP
   * changes between sessions — the player asks the DM for the current code and
   * re-enters it here without leaving the campaign. Updates the stored joinCode.
   */
  reconnectWithCode: (code: string) => Promise<void>;
};

export const useCampaignStore = create<CampaignStore>((set, get) => ({
  campaigns:      [],
  activeCampaign: null,
  isLoading:      false,
  isDm:           false,

  loadCampaigns: async () => {
    set({ isLoading: true });
    try {
      const campaigns = await loadAllCampaigns();
      const session   = useSessionStore.getState().session;
      const active    = campaigns.find(c => c.id === session?.campaignId) ?? null;
      const isDm      = !!active && !!session && active.dmDeviceId === session.deviceId;
      set({ campaigns, activeCampaign: active, isDm, isLoading: false });
    } catch (e) {
      console.error('[campaignStore] loadCampaigns failed:', e);
      set({ isLoading: false });
    }
  },

  createCampaign: async (name) => {
    const session = useSessionStore.getState().session;
    if (!session) throw new Error('No device session. Call initSession() first.');

    const campaign: Campaign = {
      id:           genId(),
      name,
      dmDeviceId:   session.deviceId,
      joinCode:     '',  // assigned from the real LAN room code below, before persisting
      rules:        { ...DEFAULT_RULES },
      playerIds:    [],
      characterIds: [],
      notes:        '',
      createdAt:    Date.now(),
    };

    // Start the LAN sync server (DM role). This binds the TCP socket and returns
    // the real room code encoding this device's WiFi IP. On web or off-WiFi this
    // throws; we surface that to the caller so the UI can explain why hosting
    // failed, and we don't persist a campaign that can't actually be hosted.
    const roomCode = await syncManager.startAsServer(
      campaign.id, session.deviceId, session.deviceId, session.nickname,
    );
    campaign.joinCode = roomCode;

    await saveCampaign(campaign);
    await useSessionStore.getState().setCampaignId(campaign.id);

    set(state => ({
      campaigns:      [...state.campaigns, campaign],
      activeCampaign: campaign,
      isDm:           true,
    }));

    return campaign;
  },

  joinCampaign: async (code) => {
    const session = useSessionStore.getState().session;
    if (!session) throw new Error('No device session.');

    const cleanCode = code.trim().toUpperCase();

    // Start the LAN client (player role). This resolves the room code to the
    // DM's IP and opens the TCP connection. The connection completes
    // asynchronously: on 'welcome' the syncManager fires onConnected, and the
    // DM immediately pushes every entity snapshot, which lands via the
    // characterStore.applyIncomingEntity callback wired in app/_layout.tsx.
    // startAsClient throws synchronously only on web or a malformed code; an
    // unreachable host surfaces later as a disconnected status (auto-retry).
    await syncManager.startAsClient(
      cleanCode, session.deviceId, session.nickname, null,
    );

    // Persist a local campaign record keyed by the join code so the UI has a
    // campaign to show immediately and the session points at it. The DM's
    // authoritative name/rules arrive with the connection; we reconcile the
    // local record's name once a snapshot identifies the campaign. Until then a
    // readable placeholder name is used.
    const local: Campaign = {
      id:           `joined_${cleanCode}`,
      name:         `Joined campaign (${cleanCode})`,
      dmDeviceId:   'remote',
      joinCode:     cleanCode,
      rules:        { ...DEFAULT_RULES },
      playerIds:    [session.deviceId],
      characterIds: [],
      notes:        '',
      createdAt:    Date.now(),
    };

    await saveCampaign(local);
    await useSessionStore.getState().setCampaignId(local.id);

    set(state => ({
      campaigns:      state.campaigns.some(c => c.id === local.id)
        ? state.campaigns
        : [...state.campaigns, local],
      activeCampaign: local,
      isDm:           false,
    }));
  },

  assignCharacterToCampaign: async (characterId, campaignId) => {
    const campaign = await loadCampaign(campaignId);
    if (!campaign) throw new Error(`Campaign ${campaignId} not found.`);

    if (!campaign.characterIds.includes(characterId)) {
      const updated: Campaign = {
        ...campaign,
        characterIds: [...campaign.characterIds, characterId],
      };

      await saveCampaign(updated);

      set(state => ({
        campaigns: state.campaigns.map(c => c.id === campaignId ? updated : c),
        activeCampaign:
          state.activeCampaign?.id === campaignId ? updated : state.activeCampaign,
      }));
    }

    // Sync side: tell the table which character this device controls, and push
    // the full snapshot so it appears on the DM's dashboard. These are no-ops
    // when offline or when this device is the DM (the DM already owns the data).
    if (!get().isDm) {
      syncManager.claimCharacter(characterId);
      // Lazy import to avoid a static cycle (characterStore -> syncManager).
      const entity = require('./characterStore').useCharacterStore.getState()
        .characters.find((c: { id: string }) => c.id === characterId);
      if (entity) syncManager.pushEntity(entity);
    }
  },

  setActiveCampaign: (campaign) => {
    const session = useSessionStore.getState().session;
    const isDm = !!campaign && !!session && campaign.dmDeviceId === session.deviceId;
    set({ activeCampaign: campaign, isDm });
  },

  updateCampaign: async (id, updater) => {
    const { campaigns } = get();
    const existing = campaigns.find(c => c.id === id);
    if (!existing) return;

    const updated = updater(existing);
    await saveCampaign(updated);

    set(state => ({
      campaigns: state.campaigns.map(c => c.id === id ? updated : c),
      activeCampaign:
        state.activeCampaign?.id === id ? updated : state.activeCampaign,
    }));
  },

  leaveCampaign: async () => {
    const { activeCampaign } = get();
    if (!activeCampaign) return;

    const session = useSessionStore.getState().session;
    const ownsCampaign = session?.deviceId === activeCampaign.dmDeviceId;

    // Tear down the TCP server/client regardless of role before clearing state.
    syncManager.stopAll();

    if (ownsCampaign) {
      // DM deletes the campaign entirely
      await deleteCampaign(activeCampaign.id);
      set(state => ({
        campaigns:      state.campaigns.filter(c => c.id !== activeCampaign.id),
        activeCampaign: null,
        isDm:           false,
      }));
    } else {
      // Player just clears their local active campaign reference
      set({ activeCampaign: null, isDm: false });
    }

    await useSessionStore.getState().setCampaignId(null);
  },

  resumeSync: async () => {
    const { activeCampaign, isDm } = get();
    const session = useSessionStore.getState().session;
    if (!activeCampaign || !session) return;

    try {
      if (isDm) {
        // Re-host. The room code is regenerated from the current LAN IP and may
        // differ from last session; persist the new code so the DM screen and
        // any QR share reflect reality.
        const roomCode = await syncManager.startAsServer(
          activeCampaign.id, session.deviceId, session.deviceId, session.nickname,
        );
        if (roomCode !== activeCampaign.joinCode) {
          await get().updateCampaign(activeCampaign.id, c => ({ ...c, joinCode: roomCode }));
        }
      } else {
        // Reconnect as a player using the stored join code.
        await syncManager.startAsClient(
          activeCampaign.joinCode, session.deviceId, session.nickname, null,
        );
      }
    } catch (e) {
      // Off-WiFi or unreachable host — the campaign stays active locally and the
      // sync status simply shows disconnected. Don't throw on boot.
      console.warn('[campaignStore] resumeSync failed:', e);
    }
  },

  reconnectWithCode: async (code) => {
    const { activeCampaign, isDm } = get();
    const session = useSessionStore.getState().session;
    if (!activeCampaign || !session || isDm) return;

    const cleanCode = code.trim().toUpperCase();
    if (cleanCode.length !== 7) throw new Error('Room codes are 7 characters.');

    // Tear down any half-open client before reconnecting with the new code.
    syncManager.stopAll();
    await syncManager.startAsClient(
      cleanCode, session.deviceId, session.nickname, null,
    );

    // Persist the fresh code so a later resume uses it.
    if (cleanCode !== activeCampaign.joinCode) {
      await get().updateCampaign(activeCampaign.id, c => ({ ...c, joinCode: cleanCode }));
    }
  },
}));
