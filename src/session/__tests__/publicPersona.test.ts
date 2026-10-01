// Player-to-player visibility / "Public Persona" (LAN_PLAYER_SCREEN_SPEC.md's "What others see").
// Before this, a player received NOTHING about another player's character at all — projectState's
// player branch only ever populated its own entry. See state.ts's publicSummaryOf/
// publicCharacterOf for the projection logic, and host.ts's player.set_persona.
import { newRig, addPlayer, counter } from '../testing/harness';
import { SessionPeer } from '../peer';
import { InMemoryKv } from '../kv';
import { FakeCharacter } from '../testing/fakeCharacter';

async function twoPlayers() {
  const rig = await newRig();
  const alice = await addPlayer(rig, 'alice', 'Alice', new FakeCharacter('char_alice', 'Mira'));
  const bob = await addPlayer(rig, 'bob', 'Bob', new FakeCharacter('char_bob', 'Thorne'));
  return { rig, alice, bob };
}

describe('before any persona exists', () => {
  it('a peer sees the real reported summary verbatim (no persona set = no change)', async () => {
    const { rig, alice, bob } = await twoPlayers();
    void rig;
    const seenByBob = bob.peer.partyView().find(c => c.participantId === 'alice')!;
    expect(seenByBob.summary).toEqual(alice.character!.summary());
    expect(seenByBob).not.toHaveProperty('persona');   // peers never receive the raw config, even an absent one meaningfully
  });

  it('own character is always the full authoritative entry, never redirected through publicCharacterOf', async () => {
    const { bob } = await twoPlayers();
    expect(bob.peer.view!.characters.bob.summary).toEqual(bob.character!.summary());
  });
});

describe('player.set_persona / peer.setPersona', () => {
  it('requires a character to have been reported first', async () => {
    const rig = await newRig();
    const kv = new InMemoryKv();
    const noCharacter = await SessionPeer.create({
      participantId: 'carol', nickname: 'Carol', requestedCapabilities: ['player'],
      transport: rig.net.client('carol'), kv, newId: counter('c'),
    });
    await noCharacter.connect();
    await rig.settle();
    const opId = noCharacter.setPersona({ enabled: true, name: 'Mystery', hp: 1, maxHp: 1, ac: 1 });
    await rig.settle();
    expect(noCharacter.resultOf(opId)?.status).toBe('rejected');
  });

  it('once enabled, a peer sees the FAKE values entirely, not a mix with the real ones', async () => {
    const { rig, alice, bob } = await twoPlayers();
    alice.peer.setPersona({ enabled: true, name: 'The Stranger', hp: 999, maxHp: 999, ac: 99 });
    await rig.settle();
    const seenByBob = bob.peer.partyView().find(c => c.participantId === 'alice')!;
    expect(seenByBob.summary).toEqual({ name: 'The Stranger', hp: 999, maxHp: 999, ac: 99 });
  });

  it('disabling the persona reverts a peer\'s view back to the real summary', async () => {
    const { rig, alice, bob } = await twoPlayers();
    alice.peer.setPersona({ enabled: true, name: 'The Stranger', hp: 999, maxHp: 999, ac: 99 });
    await rig.settle();
    alice.peer.setPersona({ enabled: false, name: 'The Stranger', hp: 999, maxHp: 999, ac: 99 });
    await rig.settle();
    const seenByBob = bob.peer.partyView().find(c => c.participantId === 'alice')!;
    expect(seenByBob.summary).toEqual(alice.character!.summary());
  });

  it('a REAL character change never leaks to a peer while the persona is enabled — their view keeps showing the fake values', async () => {
    const { rig, alice, bob } = await twoPlayers();
    alice.peer.setPersona({ enabled: true, name: 'The Stranger', hp: 999, maxHp: 999, ac: 99 });
    await rig.settle();
    alice.character!.hp -= 5;   // a real, authoritative change
    alice.character!.revision += 1;
    alice.peer.reportCharacter();
    await rig.settle();
    const seenByBob = bob.peer.partyView().find(c => c.participantId === 'alice')!;
    expect(seenByBob.summary).toEqual({ name: 'The Stranger', hp: 999, maxHp: 999, ac: 99 });   // unchanged, still fake
  });

  it('an ordinary character_reported (no persona involved) never silently clears an existing persona', async () => {
    const { rig, alice, bob } = await twoPlayers();
    alice.peer.setPersona({ enabled: true, name: 'The Stranger', hp: 999, maxHp: 999, ac: 99 });
    await rig.settle();
    alice.character!.hp -= 1;
    alice.character!.revision += 1;
    alice.peer.reportCharacter();   // an ordinary HP-change report, nothing to do with persona
    await rig.settle();
    const seenByBob = bob.peer.partyView().find(c => c.participantId === 'alice')!;
    expect(seenByBob.summary.name).toBe('The Stranger');   // persona survived the unrelated report
  });

  it('the DM sees BOTH the authoritative summary and the persona, never redacted', async () => {
    const rig = await newRig({ hostCapabilities: ['dm'] });   // Host device is also DM here
    const alice = await addPlayer(rig, 'alice', 'Alice', new FakeCharacter('char_alice', 'Mira'));
    alice.peer.setPersona({ enabled: true, name: 'The Stranger', hp: 999, maxHp: 999, ac: 99 });
    await rig.settle();
    const seenByDm = rig.hostPeer.view!.characters.alice;
    expect(seenByDm.summary).toEqual(alice.character!.summary());   // real
    expect(seenByDm.persona).toEqual({ enabled: true, name: 'The Stranger', hp: 999, maxHp: 999, ac: 99 });   // and the persona too
  });

  it('rejects a malformed persona', async () => {
    const { rig, alice } = await twoPlayers();
    const opId = alice.peer.sendRaw({ kind: 'player.set_persona', persona: { enabled: true, name: 'X' } as never });
    await rig.settle();
    expect(alice.peer.resultOf(opId)?.status).toBe('rejected');
  });
});

describe('visibility: a Host-only participant sees none of this', () => {
  it('characters (including personas) are absent from the Host-only view', async () => {
    const { rig, alice } = await twoPlayers();
    alice.peer.setPersona({ enabled: true, name: 'The Stranger', hp: 999, maxHp: 999, ac: 99 });
    await rig.settle();
    expect(rig.hostPeer.view!.characters).toEqual({});
  });
});
