// "Reconnect as Mira" (JOIN_SESSION_FLOW_SPEC.md) — the Join modal's reconnect-by-token screen
// reads this to recognize a device that already joined a room, without connecting. See
// peer.ts's peerStorageKey/loadStoredIdentity and runtime.ts's findStoredIdentity.
import { newRig, counter } from '../testing/harness';
import { SessionPeer, peerStorageKey, loadStoredIdentity } from '../peer';
import { InMemoryKv } from '../kv';

describe('loadStoredIdentity — real join, real persisted shape', () => {
  it('recovers nickname, capabilities and characterId after a real join + disconnect, scoped to that exact host:port', async () => {
    const rig = await newRig();
    const kv = new InMemoryKv();
    const peer = await SessionPeer.create({
      participantId: 'p_mira', nickname: 'Mira', requestedCapabilities: ['player'],
      characterId: 'char_mira', transport: rig.net.client('mira'), kv,
      storageKey: peerStorageKey('p_mira', '10.0.0.5', 7743), newId: counter('m'),
    });
    await peer.connect();
    await rig.settle();
    expect(peer.status).toBe('connected');
    peer.disconnect();
    await peer.flush();

    const identity = await loadStoredIdentity(kv, 'p_mira', '10.0.0.5', 7743);
    expect(identity).toEqual({ nickname: 'Mira', capabilities: ['player'], characterId: 'char_mira' });

    // Scoped per address — the same device/kv looking up a DIFFERENT host:port finds nothing,
    // even though it's the same participantId and the same kv store.
    expect(await loadStoredIdentity(kv, 'p_mira', '10.0.0.6', 7743)).toBeNull();
  });
});

describe('loadStoredIdentity — edge cases', () => {
  it('returns null when this device never joined that address at all', async () => {
    const kv = new InMemoryKv();
    expect(await loadStoredIdentity(kv, 'p1', '10.0.0.5', 7743)).toBeNull();
  });

  it('never returns another participant\'s identity, even if the stored blob somehow disagreed', async () => {
    const kv = new InMemoryKv();
    await kv.set(peerStorageKey('p1', '10.0.0.5', 7743), {
      participantId: 'p2', token: null, opCounter: 0, unacked: [], appliedRequests: [],
      view: { sessionId: 's', revision: 0, ended: false,
        participants: { p2: { id: 'p2', nickname: 'Someone Else', capabilities: ['player'], connected: false, characterId: null } },
        campaign: null, encounters: {}, effects: {}, requests: {}, characters: {}, audit: [] },
    });
    expect(await loadStoredIdentity(kv, 'p1', '10.0.0.5', 7743)).toBeNull();
  });

  it('returns null if persisted but no view was ever received (e.g. disconnected before the welcome arrived)', async () => {
    const kv = new InMemoryKv();
    await kv.set(peerStorageKey('p1', '10.0.0.5', 7743), {
      participantId: 'p1', token: null, opCounter: 0, unacked: [], appliedRequests: [], view: null,
    });
    expect(await loadStoredIdentity(kv, 'p1', '10.0.0.5', 7743)).toBeNull();
  });
});
