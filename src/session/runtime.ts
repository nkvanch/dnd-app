// ============================================================================
// FILE: src/session/runtime.ts
// App-level runtime for the Host / DM / Player session layer. One device is in
// at most one live session at a time; its participation is described by
// capabilities (host / dm / player), never by "who created the room".
// Screens observe `useSessionRuntime` and call the runtime; all rules live in
// host.ts / peer.ts / state.ts.
// ============================================================================
import { create } from 'zustand';
import { SessionHost, DmPolicy, HostPersisted } from './host';
import { SessionPeer, PeerStatus } from './peer';
import { PrepService, SecretVault } from './prep';
import { KeyValueStore } from './kv';
import { ClientTransport, Connection, ServerTransport } from './transport';
import { Capability, CharacterAdapter, ViewState, ParticipantId } from './types';
import type { ActiveComponents } from './effectBridge';

// ── Store mirrored for React ──────────────────────────────────────────────────

export type RuntimeMode = 'idle' | 'hosting' | 'joined';

export type RuntimeState = {
  mode:         RuntimeMode;
  busy:         boolean;
  error:        string | null;
  address:      string | null;            // Host: where others connect ("ip:port")
  roomCode:     string | null;
  participantId: ParticipantId | null;
  nickname:     string;
  capabilities: Capability[];
  status:       PeerStatus;
  view:         ViewState | null;
  version:      number;                   // bumps on every peer notification
};

const INITIAL: RuntimeState = {
  mode: 'idle', busy: false, error: null, address: null, roomCode: null, participantId: null,
  nickname: '', capabilities: [], status: 'disconnected', view: null, version: 0,
};

export const useSessionRuntime = create<RuntimeState>(() => INITIAL);

// ── Dependencies (injectable for tests) ───────────────────────────────────────

export type RuntimeDeps = {
  kv:                 KeyValueStore;
  /** Transports the Host listens on for remote participants (LAN in production). */
  remoteServer:       () => ServerTransport;
  /** Loopback used by the Host device's own participant. */
  localLink:          () => { server: ServerTransport; client: ClientTransport };
  /** Client transport for joining a remote Host at host:port. */
  remoteClient:       (host: string, port: number) => ClientTransport;
  /** The local IP other devices should use, or null when offline. */
  localAddress:       () => Promise<{ host: string; code: string | null } | null>;
  port:               number;
  newId:              () => string;
  /** Applies the player's own active effect components to their real character. */
  effectSink?:        (characterId: string, active: ActiveComponents[]) => void;
  /** Calls `cb` (debounced by the implementation) when the character's DM-visible state changes. Returns an unsubscribe. */
  watchCharacter?:    (characterId: string, cb: () => void) => () => void;
};

function combineServers(...servers: ServerTransport[]): ServerTransport {
  return {
    listen: async (onConnection: (c: Connection) => void) => {
      await Promise.all(servers.map(s => s.listen(onConnection)));
    },
    close: () => servers.forEach(s => s.close()),
  };
}

const KEY_DEVICE = 'session.device.participantId';
const KEY_HOST_SNAPSHOT = 'session.host.snapshot';

export class SessionRuntime {
  private host: SessionHost | null = null;
  private peer: SessionPeer | null = null;
  private unsubscribe: (() => void) | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private retries = 0;
  private wantConnected = false;
  private lastEffectSig = '';
  private bridgedCharacter: string | null = null;
  private announced = false;
  private stopWatch: (() => void) | null = null;

  constructor(private readonly deps: RuntimeDeps) {}

  get kv(): KeyValueStore { return this.deps.kv; }
  get prep(): PrepService { return new PrepService(this.deps.kv); }
  get vault(): SecretVault { return new SecretVault(this.deps.kv); }
  get currentPeer(): SessionPeer | null { return this.peer; }
  get currentHost(): SessionHost | null { return this.host; }

  /** Stable per-device participant id (a device may hold different capabilities in different sessions). */
  async deviceParticipantId(): Promise<ParticipantId> {
    const existing = await this.deps.kv.get<string>(KEY_DEVICE);
    if (existing) return existing;
    const id = `p_${this.deps.newId()}`;
    await this.deps.kv.set(KEY_DEVICE, id);
    return id;
  }

  /** True when an unfinished Host session snapshot exists on this device. */
  async hasResumableHostSession(): Promise<boolean> {
    const snap = await this.deps.kv.get<HostPersisted>(KEY_HOST_SNAPSHOT);
    return !!snap && !snap.state.ended;
  }

  // ── Hosting ────────────────────────────────────────────────────────────────

  async startHosting(opts: {
    nickname:    string;
    /** Extra capabilities for THIS device on top of host (e.g. ['dm'] for Host + DM). */
    extraCaps?:  Capability[];
    dmPolicy?:   DmPolicy;
    resume?:     boolean;
    characterId?: string | null;
    character?:  CharacterAdapter;
  }): Promise<void> {
    if (this.peer || this.host) await this.leave();
    this.setBusy(true);
    try {
      const participantId = await this.deviceParticipantId();
      const snapshot = opts.resume ? await this.deps.kv.get<HostPersisted>(KEY_HOST_SNAPSHOT) : null;
      const host = new SessionHost({
        sessionId: `sess_${this.deps.newId()}`,
        dmPolicy: opts.dmPolicy ?? 'manual',
        newToken: () => `tok_${this.deps.newId()}_${this.deps.newId()}`,
        persist: p => { void this.deps.kv.set(KEY_HOST_SNAPSHOT, p); },
        ...(snapshot ? { restoreFrom: snapshot } : {}),
      });
      const local = this.deps.localLink();
      await host.start(combineServers(local.server, this.deps.remoteServer()));
      const token = host.registerLocalHost(participantId, opts.nickname, opts.extraCaps ?? []);
      const peer = await SessionPeer.create({
        participantId, nickname: opts.nickname, requestedCapabilities: [],
        initialToken: token, transport: local.client, kv: this.deps.kv,
        storageKey: `session.peer.${participantId}@local`,
        prep: new PrepService(this.deps.kv), vault: new SecretVault(this.deps.kv),
        newId: p => `${p}_${this.deps.newId()}`,
        ...(opts.character ? { character: opts.character, characterId: opts.characterId ?? opts.character.characterId } : {}),
      });
      this.host = host;
      this.attach(peer, 'hosting');
      this.wantConnected = false;                // loopback never needs backoff
      await peer.connect();
      const addr = await this.deps.localAddress();
      useSessionRuntime.setState({
        address: addr ? `${addr.host}:${this.deps.port}` : null,
        roomCode: addr?.code ?? null, nickname: opts.nickname, participantId, error: null,
      });
    } catch (e) {
      await this.leave();
      useSessionRuntime.setState({ error: (e as Error).message });
      throw e;
    } finally {
      this.setBusy(false);
    }
  }

  // ── Joining ────────────────────────────────────────────────────────────────

  async join(opts: {
    host:        string;
    port?:       number;
    nickname:    string;
    wants:       Capability[];
    character?:  CharacterAdapter;
    characterId?: string | null;
  }): Promise<void> {
    if (this.peer || this.host) await this.leave();
    this.setBusy(true);
    const port = opts.port ?? this.deps.port;
    try {
      const participantId = await this.deviceParticipantId();
      const peer = await SessionPeer.create({
        participantId, nickname: opts.nickname, requestedCapabilities: opts.wants,
        transport: this.deps.remoteClient(opts.host, port), kv: this.deps.kv,
        storageKey: `session.peer.${participantId}@${opts.host}:${port}`,
        prep: new PrepService(this.deps.kv), vault: new SecretVault(this.deps.kv),
        newId: p => `${p}_${this.deps.newId()}`,
        ...(opts.character ? { character: opts.character, characterId: opts.characterId ?? opts.character.characterId } : {}),
      });
      this.attach(peer, 'joined');
      useSessionRuntime.setState({ nickname: opts.nickname, participantId, address: `${opts.host}:${port}`, error: null });
      this.wantConnected = true;
      this.retries = 0;
      await peer.connect();
    } catch (e) {
      useSessionRuntime.setState({ error: (e as Error).message });
      this.scheduleRetry();
    } finally {
      this.setBusy(false);
    }
  }

  private scheduleRetry(): void {
    if (!this.wantConnected || !this.peer || this.retryTimer) return;
    if (this.retries >= 40) {   // ~10 minutes of capped (15 s) retries, then wait for a manual Reconnect
      useSessionRuntime.setState({ error: 'Could not reach the Host. Check the address and that you are on the same network, then rejoin.' });
      return;
    }
    const delay = Math.min(1000 * 2 ** this.retries, 15_000);
    this.retries += 1;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      const p = this.peer;
      if (!p || !this.wantConnected || p.status !== 'disconnected') return;
      p.connect().catch(() => this.scheduleRetry());
    }, delay);
  }

  /** Manual reconnect (used by the UI and by the OS bringing the app back to the foreground). */
  async reconnect(): Promise<void> {
    const p = this.peer;
    if (!p || p.status !== 'disconnected') return;
    this.retries = 0;
    this.wantConnected = this.host === null;
    try { await p.connect(); } catch (e) { useSessionRuntime.setState({ error: (e as Error).message }); this.scheduleRetry(); }
  }

  // ── Teardown ───────────────────────────────────────────────────────────────

  async leave(): Promise<void> {
    this.wantConnected = false;
    if (this.retryTimer) { clearTimeout(this.retryTimer); this.retryTimer = null; }
    this.unsubscribe?.();
    this.unsubscribe = null;
    if (this.bridgedCharacter) this.deps.effectSink?.(this.bridgedCharacter, []);   // leaving ends session effects on the sheet
    this.bridgedCharacter = null;
    this.lastEffectSig = '';
    this.stopWatch?.();
    this.stopWatch = null;
    this.announced = false;
    this.peer?.disconnect();
    await this.peer?.flush();
    this.host?.stop();
    this.peer = null;
    this.host = null;
    useSessionRuntime.setState({ ...INITIAL, nickname: useSessionRuntime.getState().nickname });
  }

  /** Ends and forgets the hosted session (a finished session is not resumable). */
  async endHostedSession(): Promise<void> {
    this.peer?.endSession();
    await this.peer?.flush();
    await this.deps.kv.delete(KEY_HOST_SNAPSHOT);
    await this.leave();
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  private attach(peer: SessionPeer, mode: RuntimeMode): void {
    this.peer = peer;
    this.unsubscribe?.();
    const mirror = (): void => {
      useSessionRuntime.setState(s => ({
        mode, capabilities: peer.capabilities, status: peer.status, view: peer.view,
        participantId: peer.participantId, version: s.version + 1,
        error: peer.lastError ?? s.error,
      }));
      this.bridgeEffects(peer);
      this.announceCharacter(peer);
      if (mode === 'joined' && peer.status === 'disconnected') this.scheduleRetry();
      if (mode === 'joined' && peer.status === 'connected') { this.retries = 0; }
    };
    this.unsubscribe = peer.subscribe(mirror);
    mirror();
  }

  /** A connected player reports its character once per connection and whenever its DM-visible state changes. */
  private announceCharacter(peer: SessionPeer): void {
    if (peer.status !== 'connected') {
      if (this.announced) { this.announced = false; this.stopWatch?.(); this.stopWatch = null; }
      return;
    }
    const characterId = peer.cfg.character?.characterId;
    if (this.announced || !characterId || !peer.capabilities.includes('player')) return;
    this.announced = true;
    peer.announceCharacter();
    this.stopWatch = this.deps.watchCharacter?.(characterId, () => peer.characterChanged()) ?? null;
  }

  /** Pushes the player's OWN active effect mechanics to their character; secret identity never passes through here. */
  private bridgeEffects(peer: SessionPeer): void {
    const sink = this.deps.effectSink;
    const characterId = peer.cfg.character?.characterId;
    if (!sink || !characterId || !peer.capabilities.includes('player') || !peer.view) return;
    const me = peer.participantId;
    const active: ActiveComponents[] = peer.visibleEffects()
      .filter(v => v.app.targetId === me)
      .map(v => ({ applicationId: v.app.id, components: v.components }));
    const sig = JSON.stringify(active);
    if (sig === this.lastEffectSig) return;
    this.lastEffectSig = sig;
    this.bridgedCharacter = characterId;
    sink(characterId, active);
  }

  private setBusy(busy: boolean): void {
    useSessionRuntime.setState({ busy });
  }
}

// ── Singleton wiring for the real app ─────────────────────────────────────────

let singleton: SessionRuntime | null = null;

/** Lazily builds the production runtime (LAN sockets + SQLite). */
export function getSessionRuntime(): SessionRuntime {
  if (!singleton) {
    // Required lazily so importing this module in tests never pulls native modules.
    const lan = require('./lanTransport') as typeof import('./lanTransport');
    const loop = require('./loopbackTransport') as typeof import('./loopbackTransport');
    const disc = require('../sync/discovery') as typeof import('../sync/discovery');
    const repo = require('../db/sessionDocRepo') as typeof import('../db/sessionDocRepo');
    singleton = new SessionRuntime({
      kv: repo.getSessionKv(),
      remoteServer: () => new lan.LanServerTransport(lan.SESSION_PORT),
      localLink: () => { const n = new loop.LoopbackNetwork(); return { server: n.server(), client: n.client() }; },
      remoteClient: (host, port) => new lan.LanClientTransport(host, port),
      localAddress: async () => {
        const ip = await disc.getLocalIp();
        return ip ? { host: ip, code: disc.encodeRoomCode(ip) } : null;
      },
      port: lan.SESSION_PORT,
      newId: () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      watchCharacter: (characterId, cb) => {

        const { useCharacterStore } = require('../store/characterStore') as typeof import('../store/characterStore');
        const sig = (e: { resources: { hp: { current: number; maximum: number } }; derived: { ac: number } } | undefined): string =>
          e ? `${e.resources.hp.current}/${e.resources.hp.maximum}/${e.derived.ac}` : '';
        let timer: ReturnType<typeof setTimeout> | null = null;
        const unsub = useCharacterStore.subscribe((state, prev) => {
          const a = state.characters.find(c => c.id === characterId);
          const b = prev.characters.find(c => c.id === characterId);
          if (sig(a) === sig(b)) return;
          if (timer) clearTimeout(timer);
          timer = setTimeout(cb, 600);
        });
        return () => { if (timer) clearTimeout(timer); unsub(); };
      },
      effectSink: (characterId, active) => {

        const { useCharacterStore } = require('../store/characterStore') as typeof import('../store/characterStore');

        const bridge = require('./effectBridge') as typeof import('./effectBridge');
        const store = useCharacterStore.getState();
        const entity = store.characters.find(c => c.id === characterId);
        if (!entity) return;
        const desired = bridge.overridesFor(characterId, active);
        const current = entity.dmOverrides.filter(o => o.id.startsWith(bridge.SESSION_OVERRIDE_PREFIX));
        if (bridge.signature(current) === bridge.signature(desired)) return;
        store.updateCharacter(characterId, e => bridge.withSessionOverrides(e, desired, store.rules), 'Session effects', 'other');
      },
    });
  }
  return singleton;
}

/** Test hook. */
export function setSessionRuntimeForTests(rt: SessionRuntime | null): void {
  singleton = rt;
}
