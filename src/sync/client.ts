// ============================================================================
// FILE: src/sync/client.ts
// TCP client — runs on player devices.
//
// Connects to the DM's server, sends 'hello', receives 'welcome'.
// Auto-reconnects with capped exponential backoff on disconnect (see
// MAX_RETRIES) — NOT forever. campaignStore's resumeSync() calls connect()
// on every app boot whenever a campaign is still marked active locally,
// which is normal between sessions (the DM's device usually isn't hosting
// between play sessions) — retrying every 5s with no cap kept the socket
// stack + radio busy indefinitely in the background any time the DM wasn't
// currently reachable, which is most of the time. Giving up after a bounded
// number of attempts and surfacing that via onError (the Campaigns screen's
// "Reconnect" flow already exists for the player to retry manually) fixes
// that battery drain without losing the auto-reconnect behavior while a
// session is actually live.
// ============================================================================
import TcpSocket from 'react-native-tcp-socket';
import { NativeModules } from 'react-native';
import type Socket from 'react-native-tcp-socket/lib/types/Socket';

import { Entity, SyncEvent, Campaign } from '../engine/types';
import { SyncMessage, encodeMessage, parseBuffer, CombatTurnState } from './protocol';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ClientCallbacks = {
  onConnected:      (campaignId: string, sessionId: string) => void;
  onDisconnected:   () => void;
  onSyncEvent:      (event: SyncEvent) => void;
  onEntitySnapshot: (entity: Entity) => void;
  /** Fired when the DM relays a partial entity PATCH instead of a full snapshot. */
  onEntityPatch?:   (entityId: string, patch: Record<string, unknown>) => void;
  /** Fired when the DM pushes the current Campaign (name/rules/notes/quests/
   *  session log) — on join/reconnect, or after the DM edits it (audit
   *  finding CAMPAIGN-SYNC-1). */
  onCampaignSnapshot?: (campaign: Campaign) => void;
  onCampaignPatch?:    (campaignId: string, patch: Record<string, unknown>) => void;
  /** Fired whenever the DM's combat state changes (start/advance/end turn) —
   *  drives the player-facing "whose turn is it" banner. */
  onCombatTurn?:    (turn: CombatTurnState) => void;
  /** Fired whenever a connection attempt fails, with a human-readable reason. */
  onError?:         (reason: string) => void;
};

// ── SyncClient ────────────────────────────────────────────────────────────────

// Capped exponential backoff: 5s, 10s, 20s, 40s, 60s, 60s, then give up.
// ~3.5 minutes of trying before the socket/radio goes quiet.
const MAX_RETRIES = 6;
const RETRY_BASE_MS = 5000;
const RETRY_MAX_MS  = 60000;

export class SyncClient {
  private socket:      Socket | null = null;
  private buffer:      string = '';
  private connected:   boolean = false;
  private retryTimer:  ReturnType<typeof setTimeout> | null = null;
  private retryCount:  number = 0;
  private cb:          ClientCallbacks;
  private deviceId:    string;
  private nickname:    string;
  private characterId: string | null;
  private host:        string = '';
  private port:        number = 0;
  private lastError:   string | null = null;

  // expose for diagnostics
  get target(): string { return `${this.host}:${this.port}`; }
  get lastErrorMessage(): string | null { return this.lastError; }
  /** Which character this device currently claims/controls, if any — see
   *  claimCharacter(). Used by characterStore's applyIncomingEntity to
   *  decide whether an incoming full snapshot for this specific entity
   *  should override local state or not (architecture review P1). */
  get ownedCharacterId(): string | null { return this.characterId; }

  constructor(deviceId: string, nickname: string, characterId: string | null, callbacks: ClientCallbacks) {
    this.deviceId    = deviceId;
    this.nickname    = nickname;
    this.characterId = characterId;
    this.cb          = callbacks;
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  connect(host: string, port: number): void {
    this.host = host;
    this.port = port;
    this.retryCount = 0;   // a fresh/manual connect() always gets the full retry budget
    this.attemptConnect();
  }

  disconnect(): void {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    try { this.socket?.destroy(); } catch { /* ignore */ }
    this.socket     = null;
    this.connected  = false;
    this.buffer     = '';
    this.retryCount = 0;
  }

  get isConnected(): boolean {
    return this.connected;
  }

  // ── Outgoing ────────────────────────────────────────────────────────────────

  send(msg: SyncMessage): void {
    if (!this.connected || !this.socket) return;
    try { this.socket.write(encodeMessage(msg)); } catch { /* ignore */ }
  }

  /**
   * Tell the server which character this player is now controlling.
   * Updates the local field too, so a later reconnect re-announces it in 'hello'.
   */
  claimCharacter(characterId: string | null): void {
    this.characterId = characterId;
    this.send({ type: 'claim_character', characterId });
  }

  // ── Private: connection management ─────────────────────────────────────────

  private attemptConnect(): void {
    console.log(`[sync-client] Connecting to ${this.host}:${this.port}…`);

    // The native module must be linked. If it isn't, createConnection() returns
    // a JS object whose native calls dereference a null module, crashing. Fail
    // with a clear message routed through onError instead.
    if (!NativeModules.TcpSockets) {
      const reason =
        'The networking module isn\u2019t available in this build. Rebuild the app ' +
        '(npx expo run:android) to join campaigns.';
      this.lastError = reason;
      console.warn('[sync-client]', reason);
      this.cb.onError?.(reason);
      return;
    }

    const socket = TcpSocket.createConnection(
      { host: this.host, port: this.port },
      () => {
        this.connected  = true;
        this.buffer     = '';
        this.retryCount = 0;   // reset the backoff — this was a real, working connection
        console.log(`[sync-client] Connected to ${this.host}:${this.port}`);
        // Introduce ourselves to the server
        this.send({ type: 'hello', deviceId: this.deviceId, nickname: this.nickname, characterId: this.characterId });
      }
    );

    // Defensive: at cold app boot, resumeSync() reconnects almost immediately
    // on mount, sometimes before react-native-tcp-socket's native module has
    // finished registering with the bridge, causing createConnection() to
    // return null. A short retry lets the bridge finish initialising instead
    // of crashing on `.on(...)` of null.
    if (!socket) {
      const reason = 'Network module not ready yet.';
      this.lastError = reason;
      console.warn('[sync-client] createConnection returned null — retrying in 400ms.');
      this.retryTimer = setTimeout(() => {
        this.retryTimer = null;
        if (!this.connected) this.attemptConnect();
      }, 400);
      return;
    }
    this.socket = socket;

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

    this.socket.on('error', (err: Error & { code?: string }) => {
      // 'close' always follows an error, so the retry is handled there.
      const reason = describeSocketError(err, this.host, this.port);
      this.lastError = reason;
      console.warn('[sync-client] Connection error:', err.message, `(${reason})`);
      this.cb.onError?.(reason);
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

      case 'entity_patch':
        this.cb.onEntityPatch?.(msg.entityId, msg.patch);
        break;

      case 'campaign_snapshot':
        this.cb.onCampaignSnapshot?.(msg.campaign);
        break;

      case 'campaign_patch':
        this.cb.onCampaignPatch?.(msg.campaignId, msg.patch);
        break;

      case 'combat_turn_state':
        this.cb.onCombatTurn?.({ active: msg.active, round: msg.round, currentEntityId: msg.currentEntityId, currentName: msg.currentName });
        break;

      // CAMPAIGN-CLOSED-1: previously fell through to `default: break` and
      // was silently dropped — the server never actually sent this type
      // before now, so it was dead on both ends. The DM's device now sends
      // one right before intentionally stopping hosting (see server.ts's
      // announceClosing / campaignStore.ts's leaveCampaign), so a player
      // sees a specific reason ("The DM has closed this campaign.") instead
      // of the same generic "Connection lost" a transient network drop
      // shows — same onError path, just with a message that actually
      // distinguishes the two cases.
      case 'error':
        this.lastError = msg.message;
        this.cb.onError?.(msg.message);
        break;

      default: break;
    }
  }

  private scheduleRetry(): void {
    if (this.retryTimer) return;
    if (this.retryCount >= MAX_RETRIES) {
      const reason = `Couldn't reach the DM after ${MAX_RETRIES} attempts. Reconnect manually once they're hosting again.`;
      this.lastError = reason;
      console.warn(`[sync-client] ${reason}`);
      this.cb.onError?.(reason);
      return;
    }
    const delay = Math.min(RETRY_BASE_MS * 2 ** this.retryCount, RETRY_MAX_MS);
    this.retryCount += 1;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      if (!this.connected) {
        this.attemptConnect();
      }
    }, delay);
  }
}

/**
 * Translates a raw TCP socket error into a short, player-readable reason that
 * actually helps diagnose a failed join.
 */
function describeSocketError(err: Error & { code?: string }, host: string, port: number): string {
  const code = err.code ?? '';
  if (code === 'ECONNREFUSED' || /ECONNREFUSED/.test(err.message)) {
    return `No server answering at ${host}:${port}. Make sure the DM has created the campaign and is on this WiFi.`;
  }
  if (code === 'ETIMEDOUT' || /ETIMEDOUT|timed out/i.test(err.message)) {
    return `Couldn't reach ${host}. Both phones must be on the same WiFi, and the router must allow device-to-device connections (no "AP/client isolation").`;
  }
  if (code === 'EHOSTUNREACH' || code === 'ENETUNREACH' || /unreachable/i.test(err.message)) {
    return `${host} is unreachable from this phone. You're probably on a different network or subnet than the DM.`;
  }
  return `Connection error: ${err.message} (trying ${host}:${port}).`;
}
