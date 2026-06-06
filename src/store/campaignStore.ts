// ============================================================================
// FILE: src/store/campaignStore.ts
// Campaign + DM identity state management.
// ============================================================================
import { create } from 'zustand';
import { Campaign, CampaignRules } from '../engine/types';
import { saveCampaign, loadAllCampaigns, deleteCampaign, loadCampaign } from '../db/campaignRepo';
import { useSessionStore } from './sessionStore';

// ── Defaults ──────────────────────────────────────────────────────────────────

const DEFAULT_RULES: CampaignRules = {
  maxAbilityScore: 20,
  maxLevel:        20,
  useXP:           false,
  hpMode:          'fixed',
  allowMulticlass: false,
  customRules:     {},
};

function genId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/**
 * Encode IP+port into a 6-digit alphanumeric room code.
 * Simple scheme: last two octets × port → base-36, zero-padded to 6 chars.
 * Full resolution logic lives in src/sync/discovery.ts.
 * Here we just generate a stub code that looks right.
 */
function generateJoinCode(): string {
  const n = Math.floor(Math.random() * 46655) + 1; // 1 – 46655 (max base-36 6-digit)
  return n.toString(36).toUpperCase().padStart(6, '0');
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
   * Join an existing campaign via 6-digit code.
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
      joinCode:     generateJoinCode(),
      rules:        { ...DEFAULT_RULES },
      playerIds:    [],
      characterIds: [],
      notes:        '',
      createdAt:    Date.now(),
    };

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

    // In the sync phase this resolves the code to DM IP and fetches campaign data.
    // For now we store a stub so the UI can advance.
    const stub: Campaign = {
      id:           `joined_${code}`,
      name:         `Campaign (code: ${code})`,
      dmDeviceId:   'unknown',
      joinCode:     code,
      rules:        { ...DEFAULT_RULES },
      playerIds:    [session.deviceId],
      characterIds: [],
      notes:        '',
      createdAt:    Date.now(),
    };

    await saveCampaign(stub);
    await useSessionStore.getState().setCampaignId(stub.id);

    set(state => ({
      campaigns:      [...state.campaigns, stub],
      activeCampaign: stub,
      isDm:           false,
    }));
  },

  assignCharacterToCampaign: async (characterId, campaignId) => {
    const campaign = await loadCampaign(campaignId);
    if (!campaign) throw new Error(`Campaign ${campaignId} not found.`);

    if (campaign.characterIds.includes(characterId)) return;

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
}));
