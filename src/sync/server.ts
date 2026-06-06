// ============================================================================
// FILE: src/sync/server.ts
// TCP server — runs on the DM's device only.
//
// Listens on SYNC_PORT. Each connected player sends a 'hello' message and
// receives 'welcome'. All subsequent sync_events are relayed to every other
// connected client so every device sees the same entity state.
// ============================================================================
import TcpSocket from 'react-native-tcp-socket';
import type Server from 'react-native-tcp-socket/lib/types/Server';
import type Socket from 'react-native-tcp-socket/lib/types/Socket';

import { SyncEvent } from '../engine/types';
import { Entity }    from '../engine/types';
import { SyncMessage, encodeMessage, parseBuffer } from './protocol';
import { SYNC_PORT } from './discovery';

// ── Types ─────────────────────────────────────────────────────────────────────

type ClientConnection = {
  id:       string;   // deviceId received in the 'hello' message
  nickname: string;
  socket:   Socket;
  buffer:   string;   // partial-line accumulator
};

export type ServerCallbacks = {
  onClientJoined:        (deviceId: string, nickname: string) => void;
  onClientLeft:          (deviceId: string) => void;
  onSyncEvent:           (event: SyncEvent) => void;
  onEntityRequested:     (entityId: string, requesterId: string) => void;
  /** Called when a client (re)connects and needs a full entity sync. */
  onEntitySyncRequested: (requesterId: string) => void;
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
    return new Promise((resolve, reject) => {
      this.server = TcpSocket.createServer((socket: Socket) => {
        this.handleNewClient(socket);
      });

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

  /** Number of currently connected player clients. */
  get clientCount(): number {
    return this.clients.size;
  }

  // ── Private: incoming client handling ──────────────────────────────────────

  private handleNewClient(socket: Socket): void {
    // Temporary id until we receive the 'hello' message
    const tempId = `pending-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const conn: ClientConnection = { id: tempId, nickname: 'Unknown', socket, buffer: '' };

    socket.on('data', (chunk: Buffer | string) => {
      conn.buffer += chunk.toString();
      const { messages, remainder } = parseBuffer(conn.buffer);
      conn.buffer = remainder;
      for (const msg of messages) {
        this.handleClientMessage(conn, msg);
      }
    });

    socket.on('close', () => {
      if (this.clients.has(conn.id)) {
        this.clients.delete(conn.id);
        this.cb.onClientLeft(conn.id);
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

      case 'hello':
        // Upgrade from temp id to real deviceId
        conn.id       = msg.deviceId;
        conn.nickname = msg.nickname;
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
        // Push full entity state to newly connected/reconnected player
        this.cb.onEntitySyncRequested(conn.id);
        break;

      case 'sync_event':
        // Relay to all other clients, then deliver locally
        this.broadcast({ type: 'sync_event', event: msg.event }, conn.id);
        this.cb.onSyncEvent(msg.event);
        break;

      case 'request_entity':
        this.cb.onEntityRequested(msg.entityId, conn.id);
        break;

      default:
        break;
    }
  }
}
