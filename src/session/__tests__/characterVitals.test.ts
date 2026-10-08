// Party Dashboard vitals (DM_SCREEN_SPEC.md item 2) — temp HP, speed, conditions, exhaustion,
// concentration, death saves, custom resources, spell slots, reported alongside the bare
// CharacterSummary. See CharacterVitals's own doc comment in types.ts for why this is DM-
// dashboard-only data, never sent to a peer player and never given a Public Persona override.
import { newRig, addDm, addPlayer } from '../testing/harness';
import { describeChanges } from '../roles';

describe('player.report_character with vitals', () => {
  it('a real adapter (FakeCharacter) reports vitals, visible to the DM', async () => {
    const rig = await newRig();
    const dm = await addDm(rig);
    const alice = await addPlayer(rig, 'alice');
    alice.character!.conditions = ['poisoned'];
    alice.character!.speed = 25;
    alice.character!.revision += 1;
    alice.peer.reportCharacter();
    await rig.settle();
    expect(dm.peer.view!.characters.alice.vitals).toMatchObject({ speed: 25, conditions: ['poisoned'] });
  });

  it('vitals are never sent to a peer player, even redacted', async () => {
    const rig = await newRig();
    const alice = await addPlayer(rig, 'alice');
    const bob = await addPlayer(rig, 'bob');
    alice.character!.conditions = ['poisoned'];
    alice.character!.revision += 1;
    alice.peer.reportCharacter();
    await rig.settle();
    const seenByBob = bob.peer.partyView().find(c => c.participantId === 'alice')!;
    expect(seenByBob).not.toHaveProperty('vitals');
    const bobWire = rig.net.receivedBy('bob').join('\n');
    expect(bobWire).not.toContain('poisoned');
  });

  it('a Host-only participant sees no character vitals (characters is empty for that level)', async () => {
    const rig = await newRig();
    const alice = await addPlayer(rig, 'alice');
    alice.character!.conditions = ['poisoned'];
    alice.character!.revision += 1;
    alice.peer.reportCharacter();
    await rig.settle();
    expect(rig.hostPeer.view!.characters).toEqual({});
  });

  it('rejects malformed vitals (exhaustion out of range)', async () => {
    const rig = await newRig();
    const alice = await addPlayer(rig, 'alice');
    const opId = alice.peer.sendRaw({
      kind: 'player.report_character', characterId: 'char_alice', revision: 99,
      summary: { name: 'Mira', hp: 10, maxHp: 10, ac: 14 },
      vitals: { tempHp: 0, speed: 30, exhaustion: 7, conditions: [], concentration: null, deathSaves: { successes: 0, failures: 0, stable: false }, resources: [], spellSlots: null },
    });
    await rig.settle();
    expect(alice.peer.resultOf(opId)).toMatchObject({ status: 'rejected', reason: 'malformed' });
  });

  it('rejects malformed vitals (wrong resource shape)', async () => {
    const rig = await newRig();
    const alice = await addPlayer(rig, 'alice');
    const opId = alice.peer.sendRaw({
      kind: 'player.report_character', characterId: 'char_alice', revision: 99,
      summary: { name: 'Mira', hp: 10, maxHp: 10, ac: 14 },
      vitals: { tempHp: 0, speed: 30, exhaustion: 0, conditions: [], concentration: null, deathSaves: { successes: 0, failures: 0, stable: false }, resources: [{ name: 'Ki' } as never], spellSlots: null },
    });
    await rig.settle();
    expect(alice.peer.resultOf(opId)).toMatchObject({ status: 'rejected', reason: 'malformed' });
  });

  it('a character with no reported vitals at all still reports normally (vitals is optional)', async () => {
    const rig = await newRig();
    const dm = await addDm(rig);
    const alice = await addPlayer(rig, 'alice');
    const opId = alice.peer.sendRaw({ kind: 'player.report_character', characterId: 'char_alice', revision: 99, summary: { name: 'Mira', hp: 10, maxHp: 10, ac: 14 } });
    await rig.settle();
    expect(alice.peer.resultOf(opId)?.status).toBe('applied');
    expect(dm.peer.view!.characters.alice.vitals).toBeUndefined();
  });
});

describe('new CharacterChange kinds: condition_add/remove, concentration_break, stabilize', () => {
  it('a DM-requested condition is applied once accepted', async () => {
    const rig = await newRig();
    const dm = await addDm(rig);
    const alice = await addPlayer(rig, 'alice');
    const { requestId } = dm.peer.requestChange('alice', 'Poisoned', [{ kind: 'condition_add', conditionId: 'poisoned' }]);
    await rig.settle();
    alice.peer.respond(requestId, 'accept');
    await rig.settle();
    expect(alice.character!.conditions).toEqual(['poisoned']);
  });

  it('removing a condition and breaking concentration both apply', async () => {
    const rig = await newRig();
    const dm = await addDm(rig);
    const alice = await addPlayer(rig, 'alice');
    alice.character!.conditions = ['prone'];
    alice.character!.concentrating = 'bless';
    const { requestId } = dm.peer.requestChange('alice', 'Clear', [{ kind: 'condition_remove', conditionId: 'prone' }, { kind: 'concentration_break' }]);
    await rig.settle();
    alice.peer.respond(requestId, 'accept');
    await rig.settle();
    expect(alice.character!.conditions).toEqual([]);
    expect(alice.character!.concentrating).toBeNull();
  });

  it('stabilize resets death saves and marks stable', async () => {
    const rig = await newRig();
    const dm = await addDm(rig);
    const alice = await addPlayer(rig, 'alice');
    alice.character!.deathSaves = { successes: 1, failures: 2, stable: false };
    const { requestId } = dm.peer.requestChange('alice', 'Stabilize', [{ kind: 'stabilize' }]);
    await rig.settle();
    alice.peer.respond(requestId, 'accept');
    await rig.settle();
    expect(alice.character!.deathSaves).toEqual({ successes: 0, failures: 0, stable: true });
  });

  it('dm.request_change rejects a condition_add with a missing conditionId', async () => {
    const rig = await newRig();
    const dm = await addDm(rig);
    await addPlayer(rig, 'alice');
    const opId = dm.peer.sendRaw({ kind: 'dm.request_change', requestId: 'r1', targetId: 'alice', baseRevision: 1, label: 'Bad', changes: [{ kind: 'condition_add' } as never] });
    await rig.settle();
    expect(dm.peer.resultOf(opId)).toMatchObject({ status: 'rejected', reason: 'malformed' });
  });

  it('describeChanges renders the new kinds in human-readable form', () => {
    expect(describeChanges([{ kind: 'condition_add', conditionId: 'poisoned' }])).toBe('Add condition: Poisoned');
    expect(describeChanges([{ kind: 'condition_remove', conditionId: 'prone' }])).toBe('Remove condition: Prone');
    expect(describeChanges([{ kind: 'concentration_break' }])).toBe('Break concentration');
    expect(describeChanges([{ kind: 'stabilize' }])).toBe('Stabilize');
  });
});
