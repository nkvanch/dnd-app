// Node "table" for Android E2E: real Host / DM / Player peers on the PC that talk to the phone
// over genuine TCP using the production session code (SessionHost, SessionPeer, reducers).
import { SessionHost, DmPolicy } from '../../src/session/host';
import { SessionPeer } from '../../src/session/peer';
import { InMemoryKv } from '../../src/session/kv';
import { PrepService, SecretVault } from '../../src/session/prep';
import { LoopbackNetwork } from '../../src/session/loopbackTransport';
import { FakeCharacter } from '../../src/session/testing/fakeCharacter';
import { AUTOMATION_CAMPAIGN_ID, AUTOMATION_CAMPAIGN_NAME, applyAutomationFixture } from '../../src/session/fixtures';
import { LiveState } from '../../src/session/types';
import { FaultProxy, NodeClientTransport, NodeServerTransport } from './nodeTransport';

export const HOST_PORT = 7743;

export type Player = { peer: SessionPeer; character: FakeCharacter; kv: InMemoryKv; wire: NodeClientTransport };

export class NodeTable {
  host!: SessionHost;
  hostPeer!: SessionPeer;
  server!: NodeServerTransport;
  proxy: FaultProxy | null = null;
  players = new Map<string, Player>();
  dm: { peer: SessionPeer; kv: InMemoryKv; prep: PrepService } | null = null;
  readonly failures: string[] = [];
  readonly checks: string[] = [];
  private seq = 0;

  /** remote = the PHONE is the Host; Node peers connect to it (adb forward) instead of hosting. */
  constructor(private readonly opts: { dmPolicy: DmPolicy; port?: number; hostCaps?: ('dm' | 'player')[]; sessionId?: string; remote?: boolean }) {}

  get port(): number { return this.opts.port ?? HOST_PORT; }

  /** Starts a Host on the given port (the phone reaches it via `adb reverse`). */
  async startHost(): Promise<void> {
    if (this.opts.remote) return;
    this.host = new SessionHost({
      sessionId: this.opts.sessionId ?? `node-${Date.now().toString(36)}`, dmPolicy: this.opts.dmPolicy,
      newToken: () => `ntok${++this.seq}_${Math.random().toString(36).slice(2, 10)}`,
    });
    const local = new LoopbackNetwork();
    this.server = new NodeServerTransport(this.port);
    await this.host.start({
      listen: async (onConn) => { await local.server().listen(onConn); await this.server.listen(onConn); },
      close: () => { local.server().close(); this.server.close(); },
    });
    const token = this.host.registerLocalHost('node-host', 'Node Host', this.opts.hostCaps ?? []);
    this.hostPeer = await SessionPeer.create({
      participantId: 'node-host', nickname: 'Node Host', requestedCapabilities: [], initialToken: token,
      transport: local.client(), kv: new InMemoryKv(),
    });
    await this.hostPeer.connect();
  }

  async addPlayer(id: string, name: string, viaPort = this.port): Promise<Player> {
    const kv = new InMemoryKv();
    const character = new FakeCharacter(`char_${id}`, name);
    const wire = new NodeClientTransport('127.0.0.1', viaPort);
    const peer = await SessionPeer.create({
      participantId: id, nickname: name, requestedCapabilities: ['player'], characterId: character.characterId,
      transport: wire, kv, character,
    });
    await peer.connect();
    await this.until(() => peer.status === 'connected', `player ${name} connects`);
    peer.announceCharacter();
    const p = { peer, character, kv, wire };
    this.players.set(id, p);
    return p;
  }

  /** A Node DM (used when the phone plays Host or Player). */
  async addNodeDm(id = 'node-dm', name = 'Node DM', viaPort = this.port): Promise<NonNullable<NodeTable['dm']>> {
    const kv = new InMemoryKv();
    const prep = new PrepService(kv);
    await prep.create(AUTOMATION_CAMPAIGN_ID, AUTOMATION_CAMPAIGN_NAME);
    await prep.edit(AUTOMATION_CAMPAIGN_ID, applyAutomationFixture);
    const peer = await SessionPeer.create({
      participantId: id, nickname: name, requestedCapabilities: ['dm'],
      transport: new NodeClientTransport('127.0.0.1', viaPort), kv, prep, vault: new SecretVault(kv),
    });
    await peer.connect();
    await this.until(() => peer.status === 'connected', 'node DM connects');
    this.dm = { peer, kv, prep };
    return this.dm;
  }

  state(): LiveState {
    if (!this.host) throw new Error('no local Host in remote mode; read the peer views instead');
    return this.host.debugState();
  }

  async until(cond: () => boolean, what: string, timeoutMs = 20000): Promise<void> {
    const start = Date.now();
    while (!cond()) {
      if (Date.now() - start > timeoutMs) throw new Error(`timeout waiting for: ${what}`);
      await new Promise(r => setTimeout(r, 50));
    }
  }

  check(cond: boolean, what: string): void {
    if (cond) this.checks.push(`ok: ${what}`);
    else { this.failures.push(what); this.checks.push(`FAIL: ${what}`); }
  }

  async stop(): Promise<void> {
    for (const p of this.players.values()) p.peer.disconnect();
    this.dm?.peer.disconnect();
    this.hostPeer?.disconnect();
    this.proxy?.stop();
    this.host?.stop();
  }
}
