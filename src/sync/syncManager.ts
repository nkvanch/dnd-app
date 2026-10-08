// ============================================================================
// FILE: src/sync/syncManager.ts
// Central sync orchestrator — single entry point for the rest of the app.
//
// Role transitions:
//   offline  → dm:     startAsServer()  — DM creates a campaign and starts the TCP server
//   offline  → player: startAsClient()  — Player enters a room code and connects
//   any      → offline: stopAll()       — leaves or ends campaign
//
// Entity sync model: always send the full Entity JSON, never deltas.
// This gives us trivial conflict resolution (last-writer-wins) and simplicity.
// ============================================================================
import { Platform } from 'react-native';
import { Entity, SyncEvent, Campaign } from '../engine/types';
import { SyncServer } from './server';
import { SyncClient } from './client';
import { ConnectedPlayer, CombatTurnState } from './protocol';
import { decodeRoomCode, encodeRoomCode, getLocalIp, watchNetworkChanges } from './discovery';
import type { EventSubscription } from 'expo-modules-core';
import { queueSyncEvent, markEventApplied, getUnflushedEvents } from '../db/syncRepo';
import { deepDiff } from './diff';

// Lazy import to avoid circular dependency: characterStore → syncManager → characterStore.
// We call getState() at runtime, not at module evaluation time.
function getCharacters(): Entity[] {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('../store/characterStore').useCharacterStore.getState().characters as Entity[];
}

// Same lazy-require pattern as getCharacters() above, same reason
// (campaignStore → syncManager → campaignStore would otherwise cycle).
function getActiveCampaignById(campaignId: string): Campaign | null {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const campaigns = require('../store/campaignStore').useCampaignStore.getState().campaigns as Campaign[];
  return campaigns.find(c => c.id === campaignId) ?? null;
}

// ── Public types ──────────────────────────────────────────────────────────────

export type SyncRole = 'dm' | 'player' | 'offline';

export type SyncStatus = {
  role:        SyncRole;
  connected:   boolean;
  clientCount: number;      // DM only: number of live player connections
  roomCode:    string | null;
  sessionId:   string | null;
  roster:      ConnectedPlayer[];   // DM only: who's connected and which character they control
  lastError:   string | null;       // player: most recent connection-failure reason, if any
};

export type SyncManagerCallbacks = {
  onStatusChange:   (status: SyncStatus) => void;
  onEntityReceived: (entity: Entity) => void;
  /** A partial patch arrived instead of a full entity — merge, don't replace. */
  onEntityPatchReceived: (entityId: string, patch: Record<string, unknown>) => void;
  onSyncEvent:      (event: SyncEvent) => void;
  /** Player only — the DM pushed the current Campaign (join/reconnect, or
   *  after a DM edit) — audit finding CAMPAIGN-SYNC-1. */
  onCampaignReceived?:      (campaign: Campaign) => void;
  onCampaignPatchReceived?: (campaignId: string, patch: Record<string, unknown>) => void;
  /** Player only — the DM's combat state changed (start/advance/end turn). */
  onCombatTurnReceived?: (turn: CombatTurnState) => void;
};

// ── generateEventId ───────────────────────────────────────────────────────────

function generateEventId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ── SyncManagerClass ──────────────────────────────────────────────────────────

class SyncManagerClass {
  private server:      SyncServer | null = null;
  private client:      SyncClient | null = null;
  private role:        SyncRole = 'offline';
  private callbacks:   SyncManagerCallbacks | null = null;
  private roomCode:    string | null = null;
  private sessionId:   string | null = null;
  private _roster:     ConnectedPlayer[] = [];
  private _lastError:  string | null = null;
  /** DM role only — watches for the device's network connectivity changing
   *  while a campaign is hosted, so the room code can regenerate (or clear)
   *  without restarting the TCP server. See startNetworkWatch(). */
  private networkSub:  EventSubscription | null = null;

  // ── Setup ─────────────────────────────────────────────────────────────────

  /** Wire up app-level callbacks. Call once in the root layout. */
  initialise(callbacks: SyncManagerCallbacks): void {
    this.callbacks = callbacks;
  }

  // ── Role entry points ─────────────────────────────────────────────────────

  /**
   * Start hosting on this device (DM role) — CampaignHost, the session/role
   * concept, not NetworkHostAvailability. Always succeeds regardless of
   * WiFi/hotspot/network state (throws only for genuine platform/build
   * incapability — web, or a native TCP module that isn't linked): the TCP
   * server binds to 0.0.0.0, which doesn't require an active network
   * interface, so it's always started here. Hosting is valid offline.
   *
   * Returns the 7-character room code players use to join, or null if no
   * usable local network is currently available to derive one from — in
   * that case the server is still running and ready, just not currently
   * dialable. startNetworkWatch() picks up a network appearing later (WiFi
   * connects, a hotspot is enabled) and regenerates the code reactively,
   * without needing to re-call this method or recreate the campaign.
   */
  async startAsServer(
    campaignId: string,
    sessionId:  string,
    deviceId:   string,
    nickname:   string,
  ): Promise<string | null> {
    if (Platform.OS === 'web') throw new Error('Sync not supported on web.');
    this.stopAll();

    const ip = await getLocalIp();
    this.roomCode  = ip ? encodeRoomCode(ip) : null;
    this.sessionId = sessionId;
    this.role      = 'dm';

    this.server = new SyncServer(campaignId, sessionId, {
      onClientJoined: (_dId, _nick) => {
        // Count/roster are derived from onRosterChanged; nothing to do here.
      },
      onClientLeft: (_dId) => {
        // Count/roster are derived from onRosterChanged; nothing to do here.
      },
      onRosterChanged: (roster) => {
        this._roster = roster;
        this.emitStatus();
      },
      onSyncEvent: (event) => {
        this.applyIncomingEvent(event);
      },
      onEntityRequested: (entityId, requesterId) => {
        // Forward as a synthetic event so the app layer can respond
        const syntheticEvent: SyncEvent = {
          id:             `req-${generateEventId()}`,
          sessionId:      sessionId,
          entityId,
          changeType:     'entity_full_sync',
          payload:        null,
          authorDeviceId: requesterId,
          timestamp:      Date.now(),
          applied:        false,
        };
        this.callbacks?.onSyncEvent(syntheticEvent);
      },
      onEntitySyncRequested: (requesterId) => {
        // Push all known entities to the newly connected / reconnected player
        const entities = getCharacters();
        for (const ent of entities) {
          this.server?.sendTo(requesterId, { type: 'entity_snapshot', entity: ent });
        }
      },
      onCampaignSyncRequested: (requesterId) => {
        // Push the current Campaign to the newly connected/reconnected
        // player (audit finding CAMPAIGN-SYNC-1) — same shape as
        // onEntitySyncRequested above.
        const campaign = getActiveCampaignById(campaignId);
        if (campaign) {
          this.server?.sendTo(requesterId, { type: 'campaign_snapshot', campaign });
        }
      },
      onEntityReceived: (entity) => {
        // A player pushed their character up to us (the DM). Apply locally.
        this.callbacks?.onEntityReceived(entity);
      },
      onEntityPatchReceived: (entityId, patch) => {
        this.callbacks?.onEntityPatchReceived(entityId, patch);
      },
    });

    await this.server.start();
    this.startNetworkWatch();
    this.emitStatus();
    return this.roomCode;
  }

  /**
   * Subscribes to network connectivity changes while hosting, so a WiFi/
   * hotspot connection appearing or disappearing updates the room code
   * reactively (regenerate, or clear to null) without tearing down the
   * already-running TCP server — "network appears/disappears during
   * campaign" from the CampaignHost/NetworkHostAvailability split. Torn
   * down in stopAll(); re-subscribing on every startAsServer call (via the
   * stopAll() at its top) keeps at most one active subscription.
   */
  private startNetworkWatch(): void {
    this.networkSub = watchNetworkChanges(() => { void this.refreshRoomCode(); });
  }

  private async refreshRoomCode(): Promise<void> {
    if (this.role !== 'dm') return;
    const ip = await getLocalIp();
    const nextCode = ip ? encodeRoomCode(ip) : null;
    if (nextCode !== this.roomCode) {
      this.roomCode = nextCode;
      this.emitStatus();
    }
  }

  /**
   * Connect as a TCP client to the DM's server (player role).
   * `code` is the 6-character room code shown on the DM's screen.
   */
  async startAsClient(
    code:        string,
    deviceId:    string,
    nickname:    string,
    characterId: string | null,
  ): Promise<void> {
    if (Platform.OS === 'web') throw new Error('Sync not supported on web.');
    this.stopAll();

    const { ip, port } = decodeRoomCode(code);
    this.role = 'player';
    this._lastError = null;

    this.client = new SyncClient(deviceId, nickname, characterId, {
      onConnected: (campaignId, sessionId) => {
        this.sessionId = sessionId;
        this._lastError = null;
        this.emitStatus();
        // Flush any events we queued while offline
        this.flushQueuedEvents(sessionId);
      },
      onDisconnected: () => {
        this.emitStatus();
      },
      onError: (reason) => {
        this._lastError = reason;
        this.emitStatus();
      },
      onSyncEvent: (event) => {
        this.applyIncomingEvent(event);
      },
      onEntitySnapshot: (entity) => {
        // Persistence is NOT done here — onEntityReceived routes to
        // characterStore.applyIncomingEntity, which already owns the only
        // saveEntity call for this data (see its own doc comment) and is
        // conditioned on its P1/S0 stale-snapshot guard. A second,
        // unconditional saveEntity call here used to bypass that guard and
        // silently write a stale snapshot straight to SQLite even when
        // applyIncomingEntity correctly rejected it in memory (audit
        // finding PERSIST-1).
        this.callbacks?.onEntityReceived(entity);
      },
      onEntityPatch: (entityId, patch) => {
        this.callbacks?.onEntityPatchReceived(entityId, patch);
        // Note: NOT persisted here directly (unlike the full-snapshot case
        // above) — the merged result is persisted by characterStore's
        // applyIncomingPatch, which is the one that actually knows the
        // merged entity shape.
      },
      onCampaignSnapshot: (campaign) => {
        this.callbacks?.onCampaignReceived?.(campaign);
      },
      onCampaignPatch: (campaignId, patch) => {
        this.callbacks?.onCampaignPatchReceived?.(campaignId, patch);
      },
      onCombatTurn: (turn) => {
        this.callbacks?.onCombatTurnReceived?.(turn);
      },
    });

    this.client.connect(ip, port);
    this.emitStatus();
  }

  // ── Outgoing ──────────────────────────────────────────────────────────────

  /**
   * Broadcast a full entity snapshot to all connected peers.
   * DM-only operation — players can't broadcast directly to the whole table
   * (they don't run the server), which is why this alone was a silent no-op
   * when called from a player's device. Kept for DM-only call sites and for
   * `syncEntity` below to delegate to.
   */
  broadcastEntity(entity: Entity): void {
    if (this.role === 'dm' && this.server) {
      this.server.broadcastEntity(entity);
    }
  }

  /**
   * Broadcast "whose turn is it" to every connected player — DM-only, same
   * no-op-for-players shape as broadcastEntity. combatStore.ts calls this on
   * every combat-state change (start/advance/end turn, reinforcements
   * added/removed) so player devices can show a live turn banner instead of
   * having zero visibility into DM-run combat, as before this existed.
   */
  broadcastCombatTurn(turn: CombatTurnState): void {
    if (this.role === 'dm' && this.server) {
      this.server.broadcastCombatTurn(turn);
    }
  }

  /**
   * DM-only: tell every connected player why hosting is about to stop
   * (explicit "Stop Hosting"/"Leave Campaign"/campaign deletion — never a
   * network drop, since there'd be no connection left to send this over).
   * Callers must await this and call it BEFORE stopAll(), so the message
   * actually reaches clients before their sockets are torn down. No-op
   * (resolves immediately) when not currently hosting with clients
   * connected — matches broadcastEntity/broadcastCombatTurn's own
   * role-gated no-op shape.
   */
  async announceClosing(reason: string): Promise<void> {
    if (this.role === 'dm' && this.server) {
      await this.server.announceClosing(reason);
    }
  }

  /**
   * Role-aware entity sync — the method the rest of the app should call on
   * every entity mutation, regardless of whether this device is the DM or a
   * player. Dispatches to the correct underlying transport:
   *   DM:     broadcasts directly to every connected player (server → all clients).
   *   Player: pushes up to the DM, who relays it onward to the rest of the
   *           table (see onEntityReceived in app/_layout.tsx).
   *   Offline: no-op — nothing to sync to yet.
   * Before this existed, characterStore's updateCharacter only ever called
   * broadcastEntity, which is a no-op for players — so a player editing their
   * own character (taking damage, marking a death save, spending a slot)
   * never left their device. See docs/ROADMAP_1.0.md Phase 3 for the fix.
   */
  syncEntity(entity: Entity): void {
    if (this.role === 'dm' && this.server) {
      this.server.broadcastEntity(entity);
    } else if (this.role === 'player' && this.client) {
      this.client.send({ type: 'entity_snapshot', entity });
    }
  }

  /**
   * Role-aware entity PATCH sync — sends only what changed between
   * `previous` and `next` (via deepDiff), not the whole entity. This is what
   * characterStore.updateCharacter calls on every mutation now, replacing
   * the old "always send the full entity" approach, which had two real
   * problems: (1) every minor change sent the entire character over the
   * wire, and (2) the receiving side did a wholesale replace, so two
   * devices making different small edits close together could have one
   * fully overwrite the other's unrelated change. See src/sync/diff.ts for
   * the full writeup.
   *
   * Falls back to a full snapshot if there's no meaningful diff to send
   * (e.g. `previous` is null — first save of a brand-new entity, nothing to
   * diff against yet).
   */
  syncEntityPatch(id: string, previous: Entity | null, next: Entity): void {
    if (!previous) {
      this.syncEntity(next);
      return;
    }
    const patch = deepDiff(previous, next) as Record<string, unknown> | undefined;
    if (!patch) return; // nothing actually changed — nothing to send

    if (this.role === 'dm' && this.server) {
      this.server.broadcastEntityPatch(id, patch);
    } else if (this.role === 'player' && this.client) {
      this.client.send({ type: 'entity_patch', entityId: id, patch });
    }
  }

  /**
   * DM-only, one-way Campaign patch sync (audit finding CAMPAIGN-SYNC-1) —
   * a no-op when called from a player's device, since a player never
   * legitimately authors a Campaign edit (campaignStore.updateCampaign's
   * own player-side call sites are local self-corrections — e.g. persisting
   * a freshly-reconnected joinCode — not DM edits, so broadcasting them
   * would be meaningless/wrong for the rest of the table). Same
   * deepDiff-based shape as syncEntityPatch above.
   */
  syncCampaignPatch(id: string, previous: Campaign | null, next: Campaign): void {
    if (this.role !== 'dm' || !this.server) return;
    if (!previous) {
      this.server.broadcastCampaign(next);
      return;
    }
    const patch = deepDiff(previous, next) as Record<string, unknown> | undefined;
    if (!patch) return;
    this.server.broadcastCampaignPatch(id, patch);
  }

  /**
   * Player-only: announce which character this device is controlling.
   * No-op for DM/offline. Safe to call before connection completes — the
   * client also re-sends the current characterId inside every 'hello'.
   */
  claimCharacter(characterId: string | null): void {
    if (this.role === 'player' && this.client) {
      this.client.claimCharacter(characterId);
    }
  }

  /**
   * Player-only: push a full entity snapshot up to the DM (and, via relay, the
   * rest of the table). Used when a player claims/updates their character so it
   * appears on the DM's dashboard. No-op for DM/offline.
   */
  pushEntity(entity: Entity): void {
    if (this.role === 'player' && this.client) {
      this.client.send({ type: 'entity_snapshot', entity });
    }
  }

  /**
   * Emit a typed sync event to connected peers.
   * If offline, the event is queued in SQLite for replay on reconnect.
   */
  emit(
    event: Omit<SyncEvent, 'id' | 'timestamp' | 'applied'>,
  ): void {
    const full: SyncEvent = {
      ...event,
      id:        generateEventId(),
      timestamp: Date.now(),
      applied:   true,
    };

    if (this.role === 'dm' && this.server) {
      this.server.broadcast({ type: 'sync_event', event: full });
    } else if (this.role === 'player' && this.client) {
      this.client.send({ type: 'sync_event', event: full });
    } else {
      // Offline — queue for later
      queueSyncEvent(full).catch(e => console.error('[syncManager] queueSyncEvent:', e));
    }
  }

  // ── Teardown ──────────────────────────────────────────────────────────────

  stopAll(): void {
    this.networkSub?.remove();
    this.networkSub   = null;
    this.server?.stop();
    this.client?.disconnect();
    this.server       = null;
    this.client       = null;
    this.role         = 'offline';
    this._roster      = [];
    this.roomCode     = null;
    this.sessionId    = null;
    this._lastError   = null;
    this.emitStatus();
  }

  // ── Status ────────────────────────────────────────────────────────────────

  getStatus(): SyncStatus {
    const connected =
      this.role === 'dm'
        ? this.server !== null
        : this.role === 'player'
          ? (this.client?.isConnected ?? false)
          : false;

    return {
      role:        this.role,
      connected,
      clientCount: this.role === 'dm' ? (this.server?.clientCount ?? 0) : 0,
      roomCode:    this.roomCode,
      sessionId:   this.sessionId,
      roster:      this.role === 'dm' ? this._roster : [],
      lastError:   this.role === 'player' ? this._lastError : null,
    };
  }

  /** Which character THIS device currently claims/controls (player role
   *  only — null for DM/offline/unclaimed). See SyncClient.ownedCharacterId. */
  get ownedCharacterId(): string | null {
    return this.role === 'player' ? (this.client?.ownedCharacterId ?? null) : null;
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private applyIncomingEvent(event: SyncEvent): void {
    markEventApplied(event.id).catch(() => { /* non-critical */ });
    this.callbacks?.onSyncEvent(event);
  }

  private async flushQueuedEvents(sessionId: string): Promise<void> {
    if (!this.client) return;
    try {
      const queued = await getUnflushedEvents(sessionId);
      for (const event of queued) {
        this.client.send({ type: 'sync_event', event });
        await markEventApplied(event.id).catch(() => { /* ignore */ });
      }
      if (queued.length > 0) {
        console.log(`[syncManager] Flushed ${queued.length} queued event(s).`);
      }
    } catch (e) {
      console.error('[syncManager] flushQueuedEvents failed:', e);
    }
  }

  private emitStatus(): void {
    this.callbacks?.onStatusChange(this.getStatus());
  }
}

// ── Singleton export ──────────────────────────────────────────────────────────

export const syncManager = new SyncManagerClass();
