import { newRig, addDm, addPlayer, seedPrep, restartActor, expectConverged, Rig, Actor } from '../testing/harness';
import { SessionHost } from '../host';

async function table(): Promise<{ rig: Rig; dm: Actor; alice: Actor; bob: Actor }> {
  const rig = await newRig();
  const dm = await addDm(rig);
  const alice = await addPlayer(rig, 'alice');
  const bob = await addPlayer(rig, 'bob');
  await seedPrep(dm);
  await dm.peer.selectCampaign('camp-auto');
  await rig.settle();
  return { rig, dm, alice, bob };
}

describe('reconnection and resynchronization', () => {
  it('Player misses revisions while offline, then converges with no duplicates', async () => {
    const { rig, dm, alice, bob } = await table();
    alice.peer.disconnect();
    await rig.settle();
    expect(rig.host.debugState().participants.alice.connected).toBe(false);
    const revAtDrop = alice.peer.view!.revision;

    const { effectId } = await dm.peer.applyPreparedEffect('camp-auto', 'fx-blessing', ['alice', 'bob']);
    const { requestId } = await dm.peer.requestChangeFromTemplate('camp-auto', 'tpl-exh', 'alice');
    await dm.peer.activateEncounter('camp-auto', 'enc-bridge');
    await rig.settle();
    expect(alice.peer.view!.revision).toBe(revAtDrop);            // truly missed

    await alice.peer.connect();
    await rig.settle();
    expect(Object.keys(alice.peer.view!.effects)).toEqual([effectId]);          // exactly once
    expect(Object.keys(alice.peer.view!.requests)).toEqual([requestId]);        // exactly once
    expect(Object.keys(alice.peer.view!.encounters)).toHaveLength(1);
    expect(alice.peer.visibleEffects()).toHaveLength(2);
    expect(alice.peer.capabilities).toEqual(['player']);
    const auditTexts = alice.peer.view!.audit.map(a => a.text);
    expect(new Set(auditTexts).size).toBe(auditTexts.length);                   // no duplicated history
    expectConverged(rig, [dm.peer, alice.peer, bob.peer, rig.hostPeer]);
  });

  it('DM misses revisions while offline and its local preparation is untouched', async () => {
    const { rig, dm, alice, bob } = await table();
    const prepBefore = JSON.stringify(await dm.prep.load('camp-auto'));
    dm.peer.disconnect();
    await rig.settle();
    alice.character!.localEdit();
    alice.peer.characterChanged();
    await addPlayer(rig, 'cara');
    bob.peer.characterChanged();
    await rig.settle();

    await dm.peer.connect();
    await rig.settle();
    expect(dm.peer.capabilities).toEqual(['dm']);                                // role preserved
    expect(dm.peer.view!.characters.alice.revision).toBe(alice.character!.revision);
    expect(Object.keys(dm.peer.view!.participants)).toContain('cara');
    expect(JSON.stringify(await dm.prep.load('camp-auto'))).toBe(prepBefore);
    expectConverged(rig, [dm.peer, alice.peer, bob.peer, rig.hostPeer]);
  });

  it('Player process restart: unsent ops are persisted and replayed exactly once', async () => {
    const { rig, dm, alice } = await table();
    const { requestId } = await dm.peer.requestChangeFromTemplate('camp-auto', 'tpl-exh', 'alice');
    await rig.settle();
    alice.peer.disconnect();
    await rig.settle();
    alice.peer.respond(requestId, 'accept');                                     // queued offline
    await alice.peer.flush();
    expect(alice.peer.pendingOps).toHaveLength(1);

    const restarted = await restartActor(rig, alice);                            // new process, same storage
    await rig.settle();
    expect(restarted.peer.pendingOps).toHaveLength(0);
    expect(rig.host.debugState().requests[requestId].status).toBe('ACCEPTED');
    expect(restarted.character!.applied).toEqual([requestId]);
    expect(restarted.character!.exhaustion).toBe(1);
    expect(restarted.peer.capabilities).toEqual(['player']);                     // identity survived via token
    expectConverged(rig, [dm.peer, restarted.peer, rig.hostPeer]);
  });

  it('dropped acknowledgement: the client replays and the Host answers from its ledger', async () => {
    const { rig, dm, alice } = await table();
    const { requestId } = await dm.peer.requestChangeFromTemplate('camp-auto', 'tpl-exh', 'alice');
    await rig.settle();
    rig.net.dropNext('alice', 's2c', f => f.includes('"type":"result"'));
    const opId = alice.peer.respond(requestId, 'accept');
    await rig.settle();
    expect(alice.peer.resultOf(opId)).toBeUndefined();                           // ack lost
    expect(alice.peer.pendingOps).toHaveLength(1);
    expect(rig.host.debugState().requests[requestId].status).toBe('ACCEPTED');

    const rev = rig.host.debugState().revision;
    alice.peer.disconnect();
    await alice.peer.connect();                                                  // reconnect resends the op
    await rig.settle();
    expect(alice.peer.resultOf(opId)).toMatchObject({ status: 'applied', duplicate: true });
    expect(alice.peer.pendingOps).toHaveLength(0);
    expect(alice.character!.applied).toEqual([requestId]);
    expect(alice.character!.exhaustion).toBe(1);
    // Only the disconnect/reconnect presence events advanced the revision, no second resolution.
    const resolutions = rig.host.debugState().audit.filter(a => a.kind === 'request' && a.text.includes('accepted'));
    expect(resolutions).toHaveLength(1);
    expect(rig.host.debugState().revision).toBeGreaterThan(rev);
  });

  it('duplicate events are ignored', async () => {
    const { rig, dm, alice } = await table();
    rig.net.duplicateNext('alice', 's2c', f => f.includes('effect_applied'));
    const { effectId } = await dm.peer.applyPreparedEffect('camp-auto', 'fx-blessing', ['alice']);
    await rig.settle();
    expect(alice.peer.visibleEffects()).toHaveLength(1);
    expect(alice.peer.view!.audit.filter(a => a.refId === effectId)).toHaveLength(1);
    expectConverged(rig, [alice.peer]);
  });

  it('a missed event triggers a resync instead of corrupting state', async () => {
    const { rig, dm, alice } = await table();
    rig.net.dropNext('alice', 's2c', f => f.includes('effect_applied'));
    await dm.peer.applyPreparedEffect('camp-auto', 'fx-blessing', ['alice']);
    await dm.peer.activateEncounter('camp-auto', 'enc-bridge');                  // arrives one revision "early"
    await rig.settle();
    expect(alice.peer.visibleEffects()).toHaveLength(1);                         // recovered via snapshot
    expect(Object.keys(alice.peer.view!.encounters)).toHaveLength(1);
    expectConverged(rig, [alice.peer]);
  });

  it('out-of-order events: a late older event is ignored after a resync', async () => {
    const { rig, dm, alice } = await table();
    rig.net.delayNext('alice', 's2c', f => f.includes('effect_applied'));
    await dm.peer.applyPreparedEffect('camp-auto', 'fx-blessing', ['alice']);
    await dm.peer.activateEncounter('camp-auto', 'enc-bridge');
    await rig.settle();
    rig.net.releaseDelayed();
    await rig.settle();
    expect(alice.peer.visibleEffects()).toHaveLength(1);
    expect(alice.peer.view!.audit.filter(a => a.kind === 'effect_apply')).toHaveLength(1);
    expectConverged(rig, [alice.peer]);
  });

  it('out-of-order ops: the Host applies each participant\'s ops strictly in sequence', async () => {
    const { rig, dm } = await table();
    rig.net.delayNext('dm1', 'c2s', f => f.includes('dm.apply_effect'));
    const { effectId } = await dm.peer.applyPreparedEffect('camp-auto', 'fx-blessing', ['alice']);
    const endId = dm.peer.endEffect(effectId);                                   // seq+1 reaches the Host first
    await rig.settle();
    expect(rig.host.debugState().effects[effectId]).toBeUndefined();             // held, not rejected as "unknown effect"
    rig.net.releaseDelayed();
    await rig.settle();
    expect(rig.host.debugState().effects[effectId].applications[`${effectId}:alice`].state).toBe('ENDED');
    expect(dm.peer.resultOf(endId)?.status).toBe('applied');
    expect(dm.peer.pendingOps).toHaveLength(0);
  });

  it('replayed old messages after the fact change nothing', async () => {
    const { rig, dm, alice } = await table();
    const { effectId } = await dm.peer.applyPreparedEffect('camp-auto', 'fx-blessing', ['alice']);
    await rig.settle();
    dm.peer.endEffect(effectId);
    await rig.settle();
    const effectsBefore = JSON.stringify(rig.host.debugState().effects);
    const revBefore = rig.host.debugState().revision;
    const oldFrames = rig.net.log.filter(l => l.label === 'dm1' && l.dir === 'c2s' && l.frame.includes('"type":"op"')).map(l => l.frame);
    expect(oldFrames.length).toBeGreaterThanOrEqual(2);
    for (const frame of oldFrames) rig.net.inject('dm1', frame);                 // replay every op the DM ever sent
    await rig.settle();
    expect(JSON.stringify(rig.host.debugState().effects)).toBe(effectsBefore);
    expect(rig.host.debugState().revision).toBe(revBefore);
    expect(alice.peer.visibleEffects()).toHaveLength(0);
    expectConverged(rig, [dm.peer, alice.peer]);
  });

  it('Host restart: persisted live state, tokens and idempotency ledger survive; peers resume', async () => {
    const { rig, dm, alice } = await table();
    const { effectId } = await dm.peer.applyPreparedEffect('camp-auto', 'fx-blessing', ['alice']);
    const { requestId } = await dm.peer.requestChangeFromTemplate('camp-auto', 'tpl-exh', 'alice');
    await rig.settle();
    const revBefore = rig.host.debugState().revision;
    const persisted = rig.hostSnapshots[rig.hostSnapshots.length - 1];
    rig.host.stop();                                                             // Host process dies
    await rig.settle();
    expect(alice.peer.status).toBe('disconnected');

    const host2 = new SessionHost({ sessionId: 'ignored', now: rig.now, dmPolicy: 'auto-first', newToken: rig.tokens, restoreFrom: persisted });
    await host2.start(rig.net.server());
    await dm.peer.connect();
    await alice.peer.connect();
    await rig.hostPeer.connect();
    await rig.net.settle();
    const s = host2.debugState();
    expect(s.effects[effectId].applications[`${effectId}:alice`].state).toBe('ACTIVE');
    expect(s.requests[requestId].status).toBe('PENDING');
    expect(s.revision).toBeGreaterThanOrEqual(revBefore);
    expect(alice.peer.capabilities).toEqual(['player']);                         // tokens still valid
    expect(dm.peer.capabilities).toEqual(['dm']);
    alice.peer.respond(requestId, 'accept');
    await rig.net.settle();
    expect(host2.debugState().requests[requestId].status).toBe('ACCEPTED');
    expect(alice.character!.exhaustion).toBe(1);
  });

  it('ended sessions refuse further ops', async () => {
    const rig = await newRig({ hostCapabilities: ['dm'] });
    await addPlayer(rig, 'p1');
    rig.hostPeer.endSession();
    await rig.settle();
    expect(rig.host.debugState().ended).toBe(true);
    const id = rig.hostPeer.tickRounds(1);
    await rig.settle();
    expect(rig.hostPeer.resultOf(id)).toMatchObject({ status: 'rejected', reason: 'session-ended' });
  });
});
