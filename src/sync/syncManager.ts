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
import { Entity, SyncEvent } from '../engine/types';
import { SyncServer } from './server';
import { SyncClient } from './client';
import { ConnectedPlayer } from './protocol';
import { decodeRoomCode, encodeRoomCode, getLocalIp } from './discovery';
import { queueSyncEvent, markEventApplied, getUnflushedEvents } from '../db/syncRepo';
import { saveEntity } from '../db/entityRepo';
import { deepDiff } from './diff';

// Lazy import to avoid circular dependency: characterStore → syncManager → characterStore.
// We call getState() at runtime, not at module evaluation time.
function getCharacters(): Entity[] {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('../store/characterStore').useCharacterStore.getState().characters as Entity[];
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

  // ── Setup ─────────────────────────────────────────────────────────────────

  /** Wire up app-level callbacks. Call once in the root layout. */
  initialise(callbacks: SyncManagerCallbacks): void {
    this.callbacks = callbacks;
  }

  // ── Role entry points ─────────────────────────────────────────────────────

  /**
   * Start a TCP server on this device (DM role).
   * Returns the 6-character room code players use to join.
   * Throws if not on WiFi.
   */
  async startAsServer(
    campaignId: string,
    sessionId:  string,
    deviceId:   string,
    nickname:   string,
  ): Promise<string> {
    if (Platform.OS === 'web') throw new Error('Sync not supported on web.');
    this.stopAll();

    const ip = await getLocalIp();
    if (!ip) throw new Error('Not connected to WiFi. Cannot host campaign.');

    this.roomCode  = encodeRoomCode(ip);
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
      onEntityReceived: (entity) => {
        // A player pushed their character up to us (the DM). Apply locally.
        this.callbacks?.onEntityReceived(entity);
      },
      onEntityPatchReceived: (entityId, patch) => {
        this.callbacks?.onEntityPatchReceived(entityId, patch);
      },
    });

    await this.server.start();
    this.emitStatus();
    return this.roomCode;
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
        this.callbacks?.onEntityReceived(entity);
        // Also persist to local SQLite so offline access still works
        saveEntity(entity).catch(e => console.error('[syncManager] saveEntity failed:', e));
      },
      onEntityPatch: (entityId, patch) => {
        this.callbacks?.onEntityPatchReceived(entityId, patch);
        // Note: NOT persisted here directly (unlike the full-snapshot case
        // above) — the merged result is persisted by characterStore's
        // applyIncomingPatch, which is the one that actually knows the
        // merged entity shape.
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
