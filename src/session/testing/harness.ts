// Deterministic three-peer integration harness (Host / DM / Player) with no Android
// networking. It drives the SAME production code (SessionHost, SessionPeer, reducers,
// projections, JSON framing) over the InMemoryNetwork.
import { InMemoryNetwork } from '../memoryTransport';
import { SessionHost, DmPolicy, HostPersisted } from '../host';
import { SessionPeer } from '../peer';
import { InMemoryKv } from '../kv';
import { PrepService, SecretVault, CampaignPrep } from '../prep';
import { projectState } from '../state';
import { applyAutomationFixture } from '../fixtures';
import { Capability } from '../types';

export { FakeCharacter } from './fakeCharacter';
import { FakeCharacter } from './fakeCharacter';

export function counter(prefix = ''): () => string {
  let n = 0;
  return () => `${prefix}${++n}`;
}

export type Rig = {
  net: InMemoryNetwork;
  host: SessionHost;
  hostKv: InMemoryKv;
  hostPeer: SessionPeer;
  dmPolicy: DmPolicy;
  now: () => number;
  tokens: () => string;
  hostSnapshots: HostPersisted[];
  settle(): Promise<void>;
};

export type Actor = {
  peer: SessionPeer;
  kv: InMemoryKv;
  prep: PrepService;
  vault: SecretVault;
  character?: FakeCharacter;
  label: string;
};

export async function newRig(opts: {
  dmPolicy?: DmPolicy; hostCapabilities?: Capability[]; sessionId?: string;
  roomName?: string | null; maxParticipants?: number | null;
} = {}): Promise<Rig> {
  const net = new InMemoryNetwork();
  let t = 1000;
  const now = () => (t += 10);
  const tokens = counter('tok');
  const hostSnapshots: HostPersisted[] = [];
  const host = new SessionHost({
    sessionId: opts.sessionId ?? 'sess1', now, dmPolicy: opts.dmPolicy ?? 'auto-first', newToken: tokens,
    roomName: opts.roomName, maxParticipants: opts.maxParticipants,
    persist: p => { hostSnapshots.push(p); },
  });
  await host.start(net.server());
  const hostKv = new InMemoryKv();
  const hostToken = host.registerLocalHost('host1', 'Host', opts.hostCapabilities ?? []);
  const hostPeer = await SessionPeer.create({
    participantId: 'host1', nickname: 'Host', requestedCapabilities: [], initialToken: hostToken,
    transport: net.client('host1'), kv: hostKv, newId: counter('h'),
  });
  // The local host participant authenticates with the token issued at registration.
  await hostPeer.connect();
  await net.settle();
  return { net, host, hostKv, hostPeer, dmPolicy: opts.dmPolicy ?? 'auto-first', now, tokens, hostSnapshots, settle: () => net.settle() };
}

export async function addDm(rig: Rig, id = 'dm1', nickname = 'Dungeon Master', kv = new InMemoryKv()): Promise<Actor> {
  const prep = new PrepService(kv, rig.now);
  const vault = new SecretVault(kv);
  const peer = await SessionPeer.create({
    participantId: id, nickname, requestedCapabilities: ['dm'],
    transport: rig.net.client(id), kv, newId: counter(`${id}-`), prep, vault,
  });
  await peer.connect();
  await rig.settle();
  return { peer, kv, prep, vault, label: id };
}

export async function addPlayer(rig: Rig, id: string, nickname = id, character = new FakeCharacter(`char_${id}`, nickname), kv = new InMemoryKv()): Promise<Actor> {
  const prep = new PrepService(kv, rig.now);
  const vault = new SecretVault(kv);
  const peer = await SessionPeer.create({
    participantId: id, nickname, requestedCapabilities: ['player'], characterId: character.characterId,
    transport: rig.net.client(id), kv, newId: counter(`${id}-`), character,
  });
  await peer.connect();
  await rig.settle();
  peer.announceCharacter();
  await rig.settle();
  return { peer, kv, prep, vault, character, label: id };
}

/** Restarts an actor's process: a NEW peer over the SAME persistent store. */
export async function restartActor(rig: Rig, a: Actor, extra: { nickname?: string; caps?: Capability[] } = {}): Promise<Actor> {
  a.peer.disconnect();
  await a.peer.flush();
  await rig.settle();
  const prep = new PrepService(a.kv, rig.now);
  const vault = new SecretVault(a.kv);
  const peer = await SessionPeer.create({
    participantId: a.peer.participantId, nickname: extra.nickname ?? a.peer.cfg.nickname,
    requestedCapabilities: extra.caps ?? a.peer.cfg.requestedCapabilities,
    characterId: a.peer.cfg.characterId, transport: rig.net.client(a.label), kv: a.kv,
    newId: counter(`${a.label}-r-`), prep, vault, character: a.character,
  });
  await peer.connect();
  await rig.settle();
  return { ...a, peer, prep, vault };
}

/** Seeds an offline DM campaign preparation with the fixtures from the spec. */
export async function seedPrep(dm: Actor, campaignId = 'camp-auto', name = 'Automation Campaign'): Promise<CampaignPrep> {
  await dm.prep.create(campaignId, name);
  await dm.prep.edit(campaignId, applyAutomationFixture);
  return (await dm.prep.load(campaignId))!;
}

// ── Invariant: after reconciliation every replica equals the Host's authorized projection ──


export function projectionFor(rig: Rig, peer: SessionPeer) {
  const state = rig.host.debugState();
  return projectState(state, { id: peer.participantId, capabilities: state.participants[peer.participantId]?.capabilities ?? [] });
}

/** Host authoritative == DM projection == Player projection (except intentionally private fields). */
export function expectConverged(rig: Rig, peers: SessionPeer[]): void {
  for (const p of peers) {
    if (p.status !== 'connected') continue;
    expect(p.view).toEqual(projectionFor(rig, p));
  }
}
