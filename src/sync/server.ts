// ============================================================================
// FILE: src/sync/server.ts
// TCP server — runs on the DM's device only.
//
// Listens on SYNC_PORT. Each connected player sends a 'hello' message and
// receives 'welcome'. All subsequent sync_events are relayed to every other
// connected client so every device sees the same entity state.
// ============================================================================
import TcpSocket from 'react-native-tcp-socket';
import { NativeModules } from 'react-native';
import type Server from 'react-native-tcp-socket/lib/types/Server';
import type Socket from 'react-native-tcp-socket/lib/types/Socket';

import { SyncEvent } from '../engine/types';
import { Entity, Campaign } from '../engine/types';
import { SyncMessage, encodeMessage, parseBuffer, ConnectedPlayer, CombatTurnState } from './protocol';
import { SYNC_PORT } from './discovery';

/**
 * True when the react-native-tcp-socket NATIVE module is actually linked and
 * registered. The JS layer (TcpSocket.createServer) always returns a Server
 * object even when the native side is missing — but the Server's internal
 * `Sockets.listen()` then crashes with "Cannot read property 'listen' of null"
 * because NativeModules.TcpSockets is null. Checking here lets us fail with a
 * clear, actionable message instead of a mystifying null TypeError.
 */
export function isTcpNativeAvailable(): boolean {
  return !!NativeModules.TcpSockets;
}

// ── Types ─────────────────────────────────────────────────────────────────────

type ClientConnection = {
  id:          string;   // deviceId received in the 'hello' message
  nickname:    string;
  characterId: string | null;   // which character this player controls
  socket:      Socket;
  buffer:      string;   // partial-line accumulator
};

export type ServerCallbacks = {
  onClientJoined:        (deviceId: string, nickname: string) => void;
  onClientLeft:          (deviceId: string) => void;
  onSyncEvent:           (event: SyncEvent) => void;
  onEntityRequested:     (entityId: string, requesterId: string) => void;
  /** Called when a client (re)connects and needs a full entity sync. */
  onEntitySyncRequested: (requesterId: string) => void;
  /** Called when a client (re)connects and needs the current Campaign
   *  snapshot (audit finding CAMPAIGN-SYNC-1) — mirrors onEntitySyncRequested. */
  onCampaignSyncRequested: (requesterId: string) => void;
  /** Called whenever the connected-player roster changes (join, leave, claim). */
  onRosterChanged:       (roster: ConnectedPlayer[]) => void;
  /** Called when a player pushes their own entity snapshot up to the DM. */
  onEntityReceived:      (entity: Entity) => void;
  /** Called when a player pushes an entity PATCH (not a full snapshot) up to the DM. */
  onEntityPatchReceived: (entityId: string, patch: Record<string, unknown>) => void;
};

// ── SyncServer ────────────────────────────────────────────────────────────────

export class SyncServer {
  private server:      Server | null = null;
  private clients:     Map<string, ClientConnection> = new Map();
  private cb:          ServerCallbacks;
  private campaignId:  string;
  private sessionId:   string;

  constructor(campaignId: string, sessionId: string, callbacks: ServerCallbacks) {
    this.campaignId = campaignId;
    this.sessionId  = sessionId;
    this.cb         = callbacks;
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  start(): Promise<void> {
    return this.startAttempt(0);
  }

  /**
   * Creates the server socket, with one short retry if the native TCP module
   * hasn't finished registering with the bridge yet. This specifically happens
   * at cold app boot: resumeSync() re-hosts the campaign almost immediately on
   * mount, sometimes before react-native-tcp-socket's native module is ready,
   * causing TcpSocket.createServer() to return null. A ~400ms retry is enough
   * for the bridge to finish initialising; if it still fails, something else
   * is wrong and we reject with a clear, readable error instead of letting a
   * raw "Cannot read property 'listen' of null" TypeError escape.
   */
  private startAttempt(retryCount: number): Promise<void> {
    return new Promise((resolve, reject) => {
      // The native module must be linked. If it isn't (stale build, failed
      // autolink), createServer() returns a JS object whose listen() dereferences
      // a null native module. Detect that up front with a clear message.
      if (!NativeModules.TcpSockets) {
        reject(new Error(
          'The networking module isn\u2019t available in this build. This usually means ' +
          'the app needs a fresh native rebuild (npx expo run:android). ' +
          'Campaigns can\u2019t be hosted until then.'
        ));
        return;
      }

      this.server = TcpSocket.createServer((socket: Socket) => {
        this.handleNewClient(socket);
      });

      if (!this.server) {
        if (retryCount < 1) {
          setTimeout(() => {
            this.startAttempt(retryCount + 1).then(resolve, reject);
          }, 400);
          return;
        }
        reject(new Error(
          'Could not start the campaign server (network module not ready). Try again in a moment.'
        ));
        return;
      }

      this.server.listen({ port: SYNC_PORT, host: '0.0.0.0' }, () => {
        console.log(`[sync-server] Listening on port ${SYNC_PORT}`);
        resolve();
      });

      this.server.on('error', (err: Error) => {
        console.error('[sync-server] Server error:', err.message);
        reject(err);
      });
    });
  }

  stop(): void {
    this.clients.forEach(client => {
      try { client.socket.destroy(); } catch { /* ignore */ }
    });
    this.clients.clear();
    try { this.server?.close(); } catch { /* ignore */ }
    this.server = null;
    console.log('[sync-server] Stopped.');
  }

  // ── Outgoing messages ───────────────────────────────────────────────────────

  /** Broadcast a message to all clients, optionally excluding one device. */
  broadcast(msg: SyncMessage, exceptDeviceId?: string): void {
    const encoded = encodeMessage(msg);
    this.clients.forEach((client, deviceId) => {
      if (deviceId === exceptDeviceId) return;
      try { client.socket.write(encoded); } catch { /* ignore */ }
    });
  }

  /** Send a message to a single named client. */
  sendTo(deviceId: string, msg: SyncMessage): void {
    const client = this.clients.get(deviceId);
    if (!client) return;
    try { client.socket.write(encodeMessage(msg)); } catch { /* ignore */ }
  }

  /** Push a full entity snapshot to every connected player. */
  broadcastEntity(entity: Entity): void {
    this.broadcast({ type: 'entity_snapshot', entity });
  }

  /** Push an entity PATCH (partial, from deepDiff) to every connected player. */
  broadcastEntityPatch(entityId: string, patch: Record<string, unknown>): void {
    this.broadcast({ type: 'entity_patch', entityId, patch });
  }

  /** Push a full Campaign snapshot to every connected player. */
  broadcastCampaign(campaign: Campaign): void {
    this.broadcast({ type: 'campaign_snapshot', campaign });
  }

  /** Push a Campaign PATCH (partial, from deepDiff) to every connected player. */
  broadcastCampaignPatch(campaignId: string, patch: Record<string, unknown>): void {
    this.broadcast({ type: 'campaign_patch', campaignId, patch });
  }

  /** Push the current "whose turn is it" summary to every connected player. */
  broadcastCombatTurn(turn: CombatTurnState): void {
    this.broadcast({ type: 'combat_turn_state', ...turn });
  }

  /**
   * Tell every connected player WHY this server is about to stop, before
   * stop() tears the sockets down — reuses the existing (previously
   * server-side-unused, client-side-dropped) 'error' message type rather
   * than adding a new one. Callers must await this BEFORE calling stop():
   * unlike broadcast() (fire-and-forget, fine for routine state pushes),
   * this waits for each socket.write() to actually flush — stop()'s
   * socket.destroy() right after would otherwise risk dropping an
   * unflushed write before the client ever sees it. Resolves once every
   * write has flushed (or errored) or after a 500ms safety timeout,
   * whichever comes first — never blocks shutdown indefinitely on one
   * stuck socket.
   */
  announceClosing(reason: string): Promise<void> {
    const encoded = encodeMessage({ type: 'error', message: reason });
    const writes = Array.from(this.clients.values()).map(client =>
      new Promise<void>(resolve => {
        try { client.socket.write(encoded, undefined, () => resolve()); }
        catch { resolve(); }
      })
    );
    return Promise.race([
      Promise.all(writes).then(() => undefined),
      new Promise<void>(resolve => setTimeout(resolve, 500)),
    ]);
  }

  /** Number of currently connected player clients. */
  get clientCount(): number {
    return this.clients.size;
  }

  /** Snapshot of all connected players (only those that have sent 'hello'). */
  getRoster(): ConnectedPlayer[] {
    const roster: ConnectedPlayer[] = [];
    this.clients.forEach(c => {
      // Skip connections still pending their hello (temp id)
      if (c.id.startsWith('pending-')) return;
      roster.push({ deviceId: c.id, nickname: c.nickname, characterId: c.characterId });
    });
    return roster;
  }

  // ── Private: incoming client handling ──────────────────────────────────────

  private handleNewClient(socket: Socket): void {
    // Temporary id until we receive the 'hello' message
    const tempId = `pending-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const conn: ClientConnection = { id: tempId, nickname: 'Unknown', characterId: null, socket, buffer: '' };

    socket.on('data', (chunk: Buffer | string) => {
      conn.buffer += chunk.toString();
      const { messages, remainder } = parseBuffer(conn.buffer);
      conn.buffer = remainder;
      for (const msg of messages) {
        this.handleClientMessage(conn, msg);
      }
    });

    socket.on('close', () => {
      // Reconnect-safe: only remove the map entry if it still points at THIS
      // socket. A stale 'close' from a dropped socket must not evict a player
      // who has already reconnected under the same deviceId with a new socket.
      const current = this.clients.get(conn.id);
      if (current && current.socket === socket) {
        this.clients.delete(conn.id);
        this.cb.onClientLeft(conn.id);
        this.cb.onRosterChanged(this.getRoster());
        console.log(`[sync-server] Client left: ${conn.nickname}`);
      }
    });

    socket.on('error', (err: Error) => {
      console.warn('[sync-server] Client socket error:', err.message);
    });
  }

  private handleClientMessage(conn: ClientConnection, msg: SyncMessage): void {
    switch (msg.type) {
      case 'ping':
        try { conn.socket.write(encodeMessage({ type: 'pong' })); } catch { /* ignore */ }
        break;

      case 'hello': {
        // Upgrade from temp id to real deviceId.
        // Reconnect-safe: if a previous connection for this deviceId still
        // lingers (stale socket not yet closed), destroy it so we don't keep
        // a phantom entry. The Map is keyed by deviceId so the set() below
        // replaces it, but we destroy the old socket to free the resource.
        const existing = this.clients.get(msg.deviceId);
        if (existing && existing.socket !== conn.socket) {
          try { existing.socket.destroy(); } catch { /* ignore */ }
        }
        conn.id          = msg.deviceId;
        conn.nickname    = msg.nickname;
        conn.characterId = msg.characterId ?? null;
        this.clients.set(conn.id, conn);
        console.log(`[sync-server] Client joined: ${msg.nickname} (${msg.deviceId})`);
        // Greet the player
        try {
          conn.socket.write(encodeMessage({
            type:       'welcome',
            campaignId: this.campaignId,
            sessionId:  this.sessionId,
          }));
        } catch { /* ignore */ }
        this.cb.onClientJoined(msg.deviceId, msg.nickname);
        this.cb.onRosterChanged(this.getRoster());
        // Push full entity state to newly connected/reconnected player
        this.cb.onEntitySyncRequested(conn.id);
        // Push the current Campaign snapshot too (audit finding CAMPAIGN-SYNC-1)
        this.cb.onCampaignSyncRequested(conn.id);
        break;
      }

      case 'claim_character': {
        // Player tells us which character they're now controlling.
        const c = this.clients.get(conn.id);
        if (c) {
          c.characterId = msg.characterId;
          this.cb.onRosterChanged(this.getRoster());
        }
        break;
      }

      case 'sync_event':
        // Relay to all other clients, then deliver locally
        this.broadcast({ type: 'sync_event', event: msg.event }, conn.id);
        this.cb.onSyncEvent(msg.event);
        break;

      case 'entity_snapshot':
        // A player is pushing their character up to the DM. Apply it on the DM
        // device (via the snapshot callback) and relay to other players so the
        // whole table converges on the same entity state.
        this.cb.onEntityReceived(msg.entity);
        this.broadcast({ type: 'entity_snapshot', entity: msg.entity }, conn.id);
        break;

      case 'entity_patch':
        // Same relay shape as entity_snapshot, but for a partial patch
        // (see src/sync/diff.ts) instead of the whole entity — this is the
        // normal path for ongoing small changes (HP, conditions, resources),
        // not just the initial sync. The DM applies it locally as a MERGE
        // (via onEntityPatchReceived, not a replace) and relays the raw
        // patch onward opaquely, same as sync_event/entity_snapshot — each
        // receiving player merges it into their own local copy independently.
        this.cb.onEntityPatchReceived(msg.entityId, msg.patch);
        this.broadcast({ type: 'entity_patch', entityId: msg.entityId, patch: msg.patch }, conn.id);
        break;

      case 'request_entity':
        this.cb.onEntityRequested(msg.entityId, conn.id);
        break;

      default:
        break;
    }
  }
}
