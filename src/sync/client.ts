// ============================================================================
// FILE: src/sync/client.ts
// TCP client — runs on player devices.
//
// Connects to the DM's server, sends 'hello', receives 'welcome'.
// Auto-reconnects every 5 seconds on disconnect.
// ============================================================================
import TcpSocket from 'react-native-tcp-socket';
import type Socket from 'react-native-tcp-socket/lib/types/Socket';

import { Entity, SyncEvent } from '../engine/types';
import { SyncMessage, encodeMessage, parseBuffer } from './protocol';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ClientCallbacks = {
  onConnected:      (campaignId: string, sessionId: string) => void;
  onDisconnected:   () => void;
  onSyncEvent:      (event: SyncEvent) => void;
  onEntitySnapshot: (entity: Entity) => void;
};

// ── SyncClient ────────────────────────────────────────────────────────────────

export class SyncClient {
  private socket:      Socket | null = null;
  private buffer:      string = '';
  private connected:   boolean = false;
  private retryTimer:  ReturnType<typeof setTimeout> | null = null;
  private cb:          ClientCallbacks;
  private deviceId:    string;
  private nickname:    string;
  private host:        string = '';
  private port:        number = 0;

  constructor(deviceId: string, nickname: string, callbacks: ClientCallbacks) {
    this.deviceId = deviceId;
    this.nickname = nickname;
    this.cb       = callbacks;
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  connect(host: string, port: number): void {
    this.host = host;
    this.port = port;
    this.attemptConnect();
  }

  disconnect(): void {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    try { this.socket?.destroy(); } catch { /* ignore */ }
    this.socket    = null;
    this.connected = false;
    this.buffer    = '';
  }

  get isConnected(): boolean {
    return this.connected;
  }

  // ── Outgoing ────────────────────────────────────────────────────────────────

  send(msg: SyncMessage): void {
    if (!this.connected || !this.socket) return;
    try { this.socket.write(encodeMessage(msg)); } catch { /* ignore */ }
  }

  // ── Private: connection management ─────────────────────────────────────────

  private attemptConnect(): void {
    console.log(`[sync-client] Connecting to ${this.host}:${this.port}…`);

    this.socket = TcpSocket.createConnection(
      { host: this.host, port: this.port },
      () => {
        this.connected = true;
        this.buffer    = '';
        console.log(`[sync-client] Connected to ${this.host}:${this.port}`);
        // Introduce ourselves to the server
        this.send({ type: 'hello', deviceId: this.deviceId, nickname: this.nickname });
      }
    );

    this.socket.on('data', (chunk: Buffer | string) => {
      this.buffer += chunk.toString();
      const { messages, remainder } = parseBuffer(this.buffer);
      this.buffer = remainder;
      for (const msg of messages) {
        this.handleMessage(msg);
      }
    });

    this.socket.on('close', () => {
      this.connected = false;
      console.log('[sync-client] Disconnected. Will retry in 5 s…');
      this.cb.onDisconnected();
      this.scheduleRetry();
    });

    this.socket.on('error', (err: Error) => {
      // 'close' always follows an error, so the retry is handled there.
      console.warn('[sync-client] Connection error:', err.message);
    });
  }

  private handleMessage(msg: SyncMessage): void {
    switch (msg.type) {
      case 'pong': break;

      case 'welcome':
        this.cb.onConnected(msg.campaignId, msg.sessionId);
        break;

      case 'sync_event':
        this.cb.onSyncEvent(msg.event);
        break;

      case 'entity_snapshot':
        this.cb.onEntitySnapshot(msg.entity);
        break;

      default: break;
    }
  }

  private scheduleRetry(): void {
    if (this.retryTimer) return;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      if (!this.connected) {
        this.attemptConnect();
      }
    }, 5000);
  }
}
