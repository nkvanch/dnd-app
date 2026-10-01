// Host room config extras (HOST_SESSION_FLOW_SPEC.md): room name and maximum participants, both
// optional, set once at hosting start. Everything else that spec lists (room code, port under
// Advanced, approval policy, QR, IP fallback) already existed before this.
import { newRig, addPlayer, counter } from '../testing/harness';
import { SessionPeer } from '../peer';
import { InMemoryKv } from '../kv';
import { peekRoom } from '../roomPeek';

describe('room name and max participants', () => {
  it('a set room name and cap are both visible on peek', async () => {
    const rig = await newRig({ roomName: 'Tuesday Table', maxParticipants: 4 });
    const result = await Promise.all([peekRoom(rig.net.client('peeker')), rig.settle()]).then(([r]) => r);
    expect(result.roomName).toBe('Tuesday Table');
    expect(result.maxParticipants).toBe(4);
  });

  it('both default to null (unset/uncapped) when not given', async () => {
    const rig = await newRig();
    const result = await Promise.all([peekRoom(rig.net.client('peeker')), rig.settle()]).then(([r]) => r);
    expect(result.roomName).toBeNull();
    expect(result.maxParticipants).toBeNull();
  });

  it('refuses a brand-new participant once the room is at capacity, without registering them', async () => {
    const rig = await newRig({ maxParticipants: 2 });     // room for the Host (1) + exactly one more
    const alice = await addPlayer(rig, 'alice');
    expect(rig.host.debugState().participants.alice.connected).toBe(true);

    const kv = new InMemoryKv();
    const bob = await SessionPeer.create({
      participantId: 'bob', nickname: 'Bob', requestedCapabilities: ['player'],
      transport: rig.net.client('bob'), kv, newId: counter('b'),
    });
    await bob.connect();
    await rig.settle();

    expect(bob.status).toBe('disconnected');
    expect(bob.lastError).toBe('This room is full.');
    expect(rig.host.debugState().participants.bob).toBeUndefined();
    expect(alice.peer.status).toBe('connected');            // the room's existing occupant is unaffected
  });

  it('a reconnecting KNOWN participant is never refused by the cap, even past capacity', async () => {
    const rig = await newRig({ maxParticipants: 2 });
    const alice = await addPlayer(rig, 'alice');
    alice.peer.disconnect();
    await rig.settle();

    // While alice is offline, someone else takes the freed seat.
    const bobKv = new InMemoryKv();
    const bob = await SessionPeer.create({
      participantId: 'bob', nickname: 'Bob', requestedCapabilities: ['player'],
      transport: rig.net.client('bob'), kv: bobKv, newId: counter('b'),
    });
    await bob.connect();
    await rig.settle();
    expect(bob.status).toBe('connected');                   // host(1) + bob(2) = at cap now

    // Alice reconnects — the room is nominally "full," but she already holds a seat in the
    // registry, so this must succeed rather than being treated as a brand-new join.
    await alice.peer.connect();
    await rig.settle();
    expect(alice.peer.status).toBe('connected');
    expect(alice.peer.lastError).toBeNull();
  });

  it('never refuses anyone when maxParticipants is left unset', async () => {
    const rig = await newRig();
    await addPlayer(rig, 'alice');
    await addPlayer(rig, 'bob');
    const carol = await addPlayer(rig, 'carol');
    expect(carol.peer.status).toBe('connected');
  });
});
