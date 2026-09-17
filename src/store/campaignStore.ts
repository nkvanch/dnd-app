// ============================================================================
// FILE: src/store/campaignStore.ts
// Campaign + DM identity state management.
// ============================================================================
import { create } from 'zustand';
import { Campaign, CampaignRules, DeviceSession } from '../engine/types';
import { saveCampaign, loadAllCampaigns, deleteCampaign, loadCampaign } from '../db/campaignRepo';
import { getMeta, setMeta } from '../db/appMetaRepo';
import { useSessionStore } from './sessionStore';
import { syncManager } from '../sync/syncManager';
import { deepMerge } from '../sync/diff';
import { DEFAULT_RULES } from './characterStore';

// Persisted (via the generic app_meta key/value store — no schema change
// needed) so a reconnect after any app restart or foreground transition can
// re-announce which character this device claims, instead of the P1/S0
// stale-snapshot guard in characterStore.applyIncomingEntity being silently
// defeated for the rest of the session (audit finding SYNC-4). Session-local
// SyncClient state (syncManager.ownedCharacterId) was the only place this
// ever lived before — it resets to null on every fresh connection.
const CLAIMED_CHARACTER_META_KEY = 'claimed_character_id';

// ── Defaults ──────────────────────────────────────────────────────────────────
// DEFAULT_RULES is defined once in characterStore and imported here so a single
// edit to the book defaults (incl. houseRules) propagates everywhere.

function genId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/**
 * Starts the sync transport for `campaign` on this device — hosts it (DM) or
 * reconnects to it (player) — shared by resumeSync (re-establish the
 * CURRENTLY active campaign after an app restart) and switchToCampaign
 * (explicitly activate a DIFFERENT locally-known campaign). Both callers
 * already caught/handled this graceful-degradation contract identically
 * before this was extracted, so behavior is unchanged: a DM always becomes
 * the host locally regardless of network (see syncManager.startAsServer);
 * a stale/unreachable player join code surfaces later as a disconnected
 * sync status, not a thrown error here.
 */
async function hostOrConnectCampaign(
  campaign:        Campaign,
  session:         DeviceSession,
  isDm:            boolean,
  updateCampaign:  (id: string, updater: (c: Campaign) => Campaign) => Promise<void>,
): Promise<void> {
  if (isDm) {
    // A fresh id per hosting run, distinct from the DM's permanent device
    // identity — session.deviceId was previously passed for BOTH
    // parameters, collapsing "which hosting run is this" with "which
    // device is this" (audit finding ARCH-4). Currently latent (the only
    // consumer that would key off sessionId, syncManager.emit()'s offline
    // SyncEvent queue, has no live callers yet) but a real semantic bug
    // in that dormant path.
    const roomCode = await syncManager.startAsServer(
      campaign.id, genId(), session.deviceId, session.nickname,
    );
    const nextJoinCode = roomCode ?? '';
    if (nextJoinCode !== campaign.joinCode) {
      await updateCampaign(campaign.id, c => ({ ...c, joinCode: nextJoinCode }));
    }
  } else {
    const claimedCharacterId = (await getMeta(CLAIMED_CHARACTER_META_KEY)) || null;
    await syncManager.startAsClient(
      campaign.joinCode, session.deviceId, session.nickname, claimedCharacterId,
    );
  }
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

  /**
   * Player-only: apply a full Campaign snapshot pushed by the DM — on join/
   * reconnect ('hello'), or a full push when there's no prior local copy to
   * diff against. Unlike applyIncomingEntity, there is no stale-snapshot
   * guard here: a player never legitimately authors a Campaign edit of
   * their own to protect, so the DM's copy is always authoritative
   * (audit finding CAMPAIGN-SYNC-1).
   */
  applyIncomingCampaign: (campaign: Campaign) => Promise<void>;

  /** Player-only: merge a partial Campaign patch pushed by the DM onto the
   *  local copy — same deepMerge shape as characterStore.applyIncomingPatch.
   *  No-op if this device doesn't know the campaign yet (a snapshot always
   *  precedes patches, same assumption applyIncomingPatch makes). */
  applyIncomingCampaignPatch: (campaignId: string, patch: Record<string, unknown>) => Promise<void>;

  /**
   * Stop hosting/connecting to the active campaign and clear it as active —
   * does NOT delete it. The campaign stays in `campaigns` (and SQLite) and
   * can be resumed later via switchToCampaign. A DM leaving disconnects any
   * connected players (the TCP server stops), same as a network outage —
   * their own devices keep their last-synced state and can reconnect once
   * the DM re-hosts.
   */
  leaveCampaign: (reason?: string) => Promise<void>;

  /**
   * Permanently delete a campaign — SQLite row and local list entry both
   * gone, unrecoverable. Deliberately separate from leaveCampaign so the
   * routine "I'm done for tonight" action never destroys data by accident
   * (this used to be exactly what leaveCampaign did for a DM). Leaves the
   * campaign first if it's currently active.
   */
  deleteCampaignPermanently: (id: string) => Promise<void>;

  /**
   * A DM can own/keep several campaigns but only hosts one at a time
   * (CampaignHost, singular, per device — see syncManager). Switches which
   * LOCALLY KNOWN campaign is active: stops hosting/connecting to whatever
   * was active before, then hosts (DM) or reconnects (player) the target.
   * Graceful-degradation rules match resumeSync — a DM never fails to
   * become the active host locally just because a live network/reconnect
   * attempt failed; only an unknown campaign id throws.
   */
  switchToCampaign: (campaignId: string) => Promise<void>;

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

    // Start hosting (DM role). This is CampaignHost — a session/role concept
    // independent of network availability (see syncManager.startAsServer's
    // own doc comment) — and only throws for a genuine platform/build
    // incapability (web, or a native TCP module that isn't linked), never
    // for "no WiFi/hotspot." roomCode may legitimately be null (no usable
    // local network right now); the campaign is still created and this
    // device is still the host either way — joining just isn't available
    // until a network appears, which syncManager's own network watch picks
    // up reactively without needing to recreate the campaign.
    // Fresh per-hosting-run id — see hostOrConnectCampaign's identical fix
    // above (audit finding ARCH-4).
    const roomCode = await syncManager.startAsServer(
      campaign.id, genId(), session.deviceId, session.nickname,
    );
    campaign.joinCode = roomCode ?? '';

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
    // campaign to show immediately and the session points at it. A readable
    // placeholder is used until the DM's real campaign_snapshot arrives
    // (pushed automatically on 'hello' — see server.ts's onCampaignSyncRequested),
    // at which point applyIncomingCampaign reconciles this placeholder
    // (matched by joinCode, since its locally-invented id never matches the
    // DM's real one) into the DM's authoritative name/rules/notes/quests.
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
      // Persisted too (see CLAIMED_CHARACTER_META_KEY's doc comment above) —
      // ownedCharacterId alone resets on every fresh connection, which used
      // to silently defeat the reconnect stale-snapshot guard.
      await setMeta(CLAIMED_CHARACTER_META_KEY, characterId);
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

    // Broadcast to connected players (audit finding CAMPAIGN-SYNC-1) — a
    // no-op inside syncCampaignPatch itself when this device isn't the DM
    // (see that method's own doc comment), so every caller of updateCampaign
    // — including the player-only local self-corrections like persisting a
    // freshly-reconnected joinCode — can call this unconditionally without
    // each needing to know whether IT should be the one broadcasting.
    syncManager.syncCampaignPatch(id, existing, updated);
  },

  applyIncomingCampaign: async (campaign) => {
    const state = get();
    // Reconcile the join-time placeholder (id `joined_${code}`, dmDeviceId
    // 'remote' — see joinCampaign's own doc comment, which promised this
    // reconciliation but never implemented it until now) into the DM's
    // real campaign record. Matched by joinCode, not id: the placeholder's
    // locally-invented id never matches the DM's real generated one, so a
    // plain id-based upsert would leave both records around forever
    // instead of resolving to a single one (audit finding CAMPAIGN-SYNC-1).
    const placeholder = state.campaigns.find(
      c => c.id !== campaign.id && c.joinCode === campaign.joinCode && c.dmDeviceId === 'remote'
    );
    if (placeholder) {
      await deleteCampaign(placeholder.id);
      if (state.activeCampaign?.id === placeholder.id) {
        await useSessionStore.getState().setCampaignId(campaign.id);
      }
    }
    await saveCampaign(campaign);
    set(s => {
      const withoutPlaceholder = placeholder ? s.campaigns.filter(c => c.id !== placeholder.id) : s.campaigns;
      const exists = withoutPlaceholder.some(c => c.id === campaign.id);
      const campaigns = exists
        ? withoutPlaceholder.map(c => c.id === campaign.id ? campaign : c)
        : [...withoutPlaceholder, campaign];
      const wasActive = s.activeCampaign?.id === campaign.id || s.activeCampaign?.id === placeholder?.id;
      return {
        campaigns,
        activeCampaign: wasActive ? campaign : s.activeCampaign,
      };
    });
  },

  applyIncomingCampaignPatch: async (campaignId, patch) => {
    const { campaigns } = get();
    const existing = campaigns.find(c => c.id === campaignId);
    if (!existing) return; // a snapshot always precedes patches
    const merged = deepMerge(existing, patch);
    await saveCampaign(merged);
    set(state => ({
      campaigns: state.campaigns.map(c => c.id === campaignId ? merged : c),
      activeCampaign: state.activeCampaign?.id === campaignId ? merged : state.activeCampaign,
    }));
  },

  leaveCampaign: async (reason) => {
    const { activeCampaign, isDm } = get();
    if (!activeCampaign) return;

    // Bug fix: this used to permanently delete the campaign when a DM left
    // — the only way a DM could "leave" was to destroy the data, so owning
    // more than one campaign at a time was impossible (creating a second
    // one meant deleting the first). Leaving now just stops hosting/
    // connecting and clears the active reference, for both roles alike —
    // the campaign's own record is untouched and can be resumed later via
    // switchToCampaign. See deleteCampaignPermanently for actual deletion.
    //
    // CAMPAIGN-CLOSED-1: tell connected players WHY, before tearing the
    // connection down — without this, a DM-initiated stop/leave/delete
    // looked identical to a transient network drop from a player's device
    // (both just showed "Connection lost"). Awaited so the message has
    // actually flushed before stopAll() destroys the sockets.
    if (isDm) {
      await syncManager.announceClosing(reason ?? 'The DM has stopped hosting this campaign.');
    }
    syncManager.stopAll();
    set({ activeCampaign: null, isDm: false });
    await useSessionStore.getState().setCampaignId(null);
    // Don't carry a claimed character over into whatever campaign this
    // device joins/hosts next — see CLAIMED_CHARACTER_META_KEY's doc comment.
    await setMeta(CLAIMED_CHARACTER_META_KEY, '');
  },

  deleteCampaignPermanently: async (id) => {
    const { activeCampaign, leaveCampaign } = get();
    if (activeCampaign?.id === id) {
      // Can't delete what this device is currently hosting/connected to —
      // leave it first (stops the transport, clears the session pointer).
      await leaveCampaign('The DM has deleted this campaign.');
    }
    await deleteCampaign(id);
    set(state => ({ campaigns: state.campaigns.filter(c => c.id !== id) }));
  },

  switchToCampaign: async (campaignId) => {
    const { campaigns, activeCampaign, updateCampaign } = get();
    const session = useSessionStore.getState().session;
    if (!session) throw new Error('No device session. Call initSession() first.');
    if (activeCampaign?.id === campaignId) return; // already active

    const target = campaigns.find(c => c.id === campaignId);
    if (!target) throw new Error(`Campaign ${campaignId} not found locally.`);

    // A device hosts/connects to one campaign at a time — stop whatever was
    // active before switching (CampaignHost is singular per device; owning
    // several campaigns and switching which one is live is the point of
    // this action, not hosting them all at once).
    syncManager.stopAll();

    const isDm = target.dmDeviceId === session.deviceId;
    set({ activeCampaign: target, isDm });
    await useSessionStore.getState().setCampaignId(target.id);

    try {
      await hostOrConnectCampaign(target, session, isDm, updateCampaign);
    } catch (e) {
      // Same graceful-degradation contract as resumeSync — the switch has
      // already happened locally either way (activeCampaign/isDm are set
      // above); only the live transport attempt failed.
      console.warn('[campaignStore] switchToCampaign failed:', e);
    }
  },

  resumeSync: async () => {
    const { activeCampaign, isDm, updateCampaign } = get();
    const session = useSessionStore.getState().session;
    if (!activeCampaign || !session) return;

    try {
      // Re-host (DM) or reconnect (player) — see hostOrConnectCampaign's own
      // doc comment for the graceful-degradation contract this shares with
      // switchToCampaign.
      await hostOrConnectCampaign(activeCampaign, session, isDm, updateCampaign);
    } catch (e) {
      // A DM re-host no longer throws for "no network" (see
      // syncManager.startAsServer) — this now only catches a genuine
      // platform/build incapability (web, native TCP module not linked) or,
      // for a player, a malformed stored join code. The campaign stays
      // active locally either way and the sync status simply shows
      // disconnected. Don't throw on boot.
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
    const claimedCharacterId = (await getMeta(CLAIMED_CHARACTER_META_KEY)) || null;
    await syncManager.startAsClient(
      cleanCode, session.deviceId, session.nickname, claimedCharacterId,
    );

    // Persist the fresh code so a later resume uses it.
    if (cleanCode !== activeCampaign.joinCode) {
      await get().updateCampaign(activeCampaign.id, c => ({ ...c, joinCode: cleanCode }));
    }
  },
}));
