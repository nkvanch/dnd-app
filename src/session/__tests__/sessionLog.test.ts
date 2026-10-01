// Session log (DM_SCREEN_SPEC.md item 14) — a DM-curated NARRATIVE log, deliberately separate
// from the automatic technical/audit trail (CAMPAIGN_DM_AUTHORITY_RULES.md item 21: "Audit
// History and Session Log Are Different... do not combine both into one giant log"). See
// SessionLogEntry's own doc comment in types.ts for why nothing in this app ever appends to it
// automatically — only the DM's own explicit dm.add_session_log op does.
import { newRig, addDm, addPlayer } from '../testing/harness';

describe('dm.add_session_log', () => {
  it('rejects an unknown log kind', async () => {
    const rig = await newRig();
    const dm = await addDm(rig);
    const opId = dm.peer.sendRaw({ kind: 'dm.add_session_log', entryId: 'e1', logKind: 'not_a_kind' as never, text: 'The tower fell.' });
    await rig.settle();
    expect(dm.peer.resultOf(opId)?.status).toBe('rejected');
  });

  it('rejects empty text', async () => {
    const rig = await newRig();
    const dm = await addDm(rig);
    const opId = dm.peer.sendRaw({ kind: 'dm.add_session_log', entryId: 'e1', logKind: 'milestone', text: '' });
    await rig.settle();
    expect(dm.peer.resultOf(opId)?.status).toBe('rejected');
  });

  it('appends a narrative entry visible to the DM and every Player', async () => {
    const rig = await newRig();
    const dm = await addDm(rig);
    const alice = await addPlayer(rig, 'alice');
    const bob = await addPlayer(rig, 'bob');
    const opId = dm.peer.addSessionLog('npc_death', 'Baron Verrick fell in the throne room.');
    await rig.settle();
    expect(dm.peer.resultOf(opId)?.status).toBe('applied');

    expect(dm.peer.view!.sessionLog).toHaveLength(1);
    expect(dm.peer.view!.sessionLog[0]).toMatchObject({ kind: 'npc_death', text: 'Baron Verrick fell in the throne room.' });
    expect(alice.peer.view!.sessionLog).toHaveLength(1);
    expect(bob.peer.view!.sessionLog).toHaveLength(1);
  });

  it('preserves insertion order across multiple entries', async () => {
    const rig = await newRig();
    const dm = await addDm(rig);
    dm.peer.addSessionLog('major_event', 'The party entered the Sunken Library.');
    await rig.settle();
    dm.peer.addSessionLog('milestone', 'Reached level 5.');
    await rig.settle();
    expect(dm.peer.view!.sessionLog.map(e => e.text)).toEqual([
      'The party entered the Sunken Library.', 'Reached level 5.',
    ]);
  });

  it('a Host-only participant sees no session log at all', async () => {
    const rig = await newRig();
    const dm = await addDm(rig);
    dm.peer.addSessionLog('milestone', 'Reached level 5.');
    await rig.settle();
    expect(rig.hostPeer.view!.sessionLog).toEqual([]);
  });

  it('a Player cannot add a session log entry', async () => {
    const rig = await newRig();
    const alice = await addPlayer(rig, 'alice');
    const opId = alice.peer.sendRaw({ kind: 'dm.add_session_log', entryId: 'e1', logKind: 'milestone', text: 'Reached level 5.' });
    await rig.settle();
    expect(alice.peer.resultOf(opId)?.status).toBe('forbidden');
  });

  it('is never auto-populated by an unrelated event, e.g. granting a Reward', async () => {
    const rig = await newRig();
    const dm = await addDm(rig);
    const alice = await addPlayer(rig, 'alice');
    dm.peer.grantReward(alice.peer.participantId, 'campaign_boon', 'Blessing of the Harbor');
    await rig.settle();
    alice.peer.respondReward(Object.keys(dm.peer.view!.rewards)[0], 'accept');
    await rig.settle();
    expect(dm.peer.view!.sessionLog).toEqual([]);
  });
});
