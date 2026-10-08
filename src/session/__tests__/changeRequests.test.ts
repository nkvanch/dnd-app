import { newRig, addDm, addPlayer, seedPrep, restartActor, Rig, Actor } from '../testing/harness';
import { CharacterChange } from '../types';

async function table(): Promise<{ rig: Rig; dm: Actor; alice: Actor }> {
  const rig = await newRig();
  const dm = await addDm(rig);
  const alice = await addPlayer(rig, 'alice');
  await seedPrep(dm);
  await dm.peer.selectCampaign('camp-auto');
  await rig.settle();
  return { rig, dm, alice };
}

describe('DM -> Player change requests', () => {
  it('template activation creates a live PENDING request capturing the current target revision', async () => {
    const { rig, dm, alice } = await table();
    const { requestId } = await dm.peer.requestChangeFromTemplate('camp-auto', 'tpl-exh', 'alice');
    await rig.settle();
    const r = rig.host.debugState().requests[requestId];
    expect(r).toMatchObject({ status: 'PENDING', requesterId: 'dm1', targetId: 'alice', baseRevision: alice.character!.revision, label: 'Exhaustion Increase' });
    expect(r.original).toEqual([{ kind: 'exhaustion', delta: 1 }]);
    expect(alice.peer.pendingRequests().map(x => x.id)).toEqual([requestId]);
    // The template itself is untouched and holds no live values.
    const tpl = (await dm.prep.load('camp-auto'))!.templates[0];
    expect(Object.keys(tpl).sort()).toEqual(['changes', 'id', 'label']);
  });

  it('ACCEPT applies the exact proposal once and audits it', async () => {
    const { rig, dm, alice } = await table();
    const { requestId } = await dm.peer.requestChangeFromTemplate('camp-auto', 'tpl-exh', 'alice');
    await rig.settle();
    alice.peer.respond(requestId, 'accept');
    await rig.settle();
    expect(alice.character!.exhaustion).toBe(1);
    expect(alice.character!.applied).toEqual([requestId]);
    const r = rig.host.debugState().requests[requestId];
    expect(r).toMatchObject({ status: 'ACCEPTED', finalApplied: [{ kind: 'exhaustion', delta: 1 }], playerModified: null });
    const audit = rig.host.debugState().audit.map(a => a.text).join('\n');
    expect(audit).toContain('alice accepted "Exhaustion Increase": Exhaustion +1');
    expect(dm.peer.view!.requests[requestId].status).toBe('ACCEPTED');
  });

  it('the accepted result synchronizes: DM sees the player revision advance', async () => {
    const { rig, dm, alice } = await table();
    const before = dm.peer.view!.characters.alice.revision;
    const { requestId } = await dm.peer.requestChangeFromTemplate('camp-auto', 'tpl-exh', 'alice');
    await rig.settle();
    alice.peer.respond(requestId, 'accept');
    await rig.settle();
    expect(dm.peer.view!.characters.alice.revision).toBe(before + 1);
  });

  it('Heroic Inspiration is a DM-proposed change the player must accept, and nothing is awarded before that', async () => {
    const { rig, dm, alice } = await table();
    const { requestId } = dm.peer.requestChange('alice', 'Heroic Inspiration', [{ kind: 'heroic_inspiration' }]);
    await rig.settle();
    expect((alice.character as any).heroicInspiration).toBe(false);
    alice.peer.respond(requestId, 'accept');
    await rig.settle();
    expect((alice.character as any).heroicInspiration).toBe(true);
    expect(rig.host.debugState().audit.map(a => a.text).join('\n')).toContain('Heroic Inspiration');
  });

  it('a rejected Heroic Inspiration award gives nothing', async () => {
    const { rig, dm, alice } = await table();
    const { requestId } = dm.peer.requestChange('alice', 'Heroic Inspiration', [{ kind: 'heroic_inspiration' }]);
    await rig.settle();
    alice.peer.respond(requestId, 'reject');
    await rig.settle();
    expect((alice.character as any).heroicInspiration).toBe(false);
  });

  it('MODIFY preserves the original AND records the final applied change', async () => {
    const { rig, dm, alice } = await table();
    const { requestId } = dm.peer.requestChange('alice', 'Curse of the Well', [{ kind: 'max_hp', delta: -10 }]);
    await rig.settle();
    const modified: CharacterChange[] = [{ kind: 'max_hp', delta: -5 }];
    alice.peer.respond(requestId, 'modify', { modified });
    await rig.settle();
    expect(alice.character!.maxHp).toBe(15);                       // 20 - 5, not 20 - 10
    const r = rig.host.debugState().requests[requestId];
    expect(r.status).toBe('MODIFIED');
    expect(r.original).toEqual([{ kind: 'max_hp', delta: -10 }]);  // never mutated in place
    expect(r.playerModified).toEqual(modified);
    expect(r.finalApplied).toEqual(modified);
    const audit = rig.host.debugState().audit.map(a => a.text).join('\n');
    expect(audit).toContain('DM requested Max HP -10; alice modified it to Max HP -5 and accepted');
    // Both sides can audit both versions.
    for (const view of [dm.peer.view!, alice.peer.view!]) {
      expect(view.requests[requestId].original).toEqual([{ kind: 'max_hp', delta: -10 }]);
      expect(view.requests[requestId].finalApplied).toEqual(modified);
    }
  });

  it('REJECT applies nothing and a later replay cannot apply it', async () => {
    const { rig, dm, alice } = await table();
    const { requestId } = dm.peer.requestChange('alice', 'Nope', [{ kind: 'ability', ability: 'str', delta: -2 }]);
    await rig.settle();
    alice.peer.respond(requestId, 'reject');
    await rig.settle();
    expect(alice.character!.abilities.str).toBe(10);
    expect(rig.host.debugState().requests[requestId]).toMatchObject({ status: 'REJECTED', finalApplied: null });
    // Attempt to accept the rejected request afterwards (fresh op, not a replay).
    const late = alice.peer.respond(requestId, 'accept');
    await rig.settle();
    expect(alice.peer.resultOf(late)).toMatchObject({ status: 'rejected', reason: 'already-resolved' });
    expect(alice.character!.abilities.str).toBe(10);
    expect(alice.character!.applied).toEqual([]);
  });

  it('duplicate ACCEPT (double tap / replayed op) cannot double-apply', async () => {
    const { rig, dm, alice } = await table();
    const { requestId } = await dm.peer.requestChangeFromTemplate('camp-auto', 'tpl-exh', 'alice');
    await rig.settle();
    rig.net.duplicateNext('alice', 'c2s', f => f.includes('player.respond'));
    const opId = alice.peer.respond(requestId, 'accept');
    await rig.settle();
    expect(alice.character!.exhaustion).toBe(1);
    expect(alice.character!.applied).toEqual([requestId]);
    expect(alice.peer.resultOf(opId)?.status).toBe('applied');
    // A distinct second tap is refused, not applied.
    const second = alice.peer.respond(requestId, 'accept');
    await rig.settle();
    expect(alice.peer.resultOf(second)?.status).toBe('rejected');
    expect(alice.character!.exhaustion).toBe(1);
  });

  it('STALE: a request built against an older character revision is not silently applied', async () => {
    const { rig, dm, alice } = await table();
    const { requestId } = dm.peer.requestChange('alice', 'Stale me', [{ kind: 'max_hp', delta: -4 }]);
    await rig.settle();
    alice.character!.localEdit();                      // the character changed after the DM looked
    const opId = alice.peer.respond(requestId, 'accept');
    await rig.settle();
    expect(alice.peer.resultOf(opId)).toMatchObject({ status: 'stale', reason: 'character-changed' });
    expect(alice.character!.maxHp).toBe(20);           // nothing applied
    const r = rig.host.debugState().requests[requestId];
    expect(r.status).toBe('PENDING');
    expect(r.staleAgainst).toBe(alice.character!.revision);
    expect(dm.peer.view!.requests[requestId].staleAgainst).toBe(alice.character!.revision);   // conflict is exposed to the DM too
    expect(rig.host.debugState().audit.map(a => a.text).join('\n')).toContain('is stale');
  });

  it('STALE resolution: the player can explicitly acknowledge and accept', async () => {
    const { rig, dm, alice } = await table();
    const { requestId } = dm.peer.requestChange('alice', 'Stale me', [{ kind: 'max_hp', delta: -4 }]);
    await rig.settle();
    alice.character!.localEdit();
    alice.peer.respond(requestId, 'accept');
    await rig.settle();
    alice.peer.respond(requestId, 'accept', { acknowledgeStale: true });
    await rig.settle();
    expect(alice.character!.maxHp).toBe(16);
    expect(rig.host.debugState().requests[requestId]).toMatchObject({ status: 'ACCEPTED', acknowledgedStale: true });
  });

  it('a player cannot respond to another player\'s request', async () => {
    const { rig, dm, alice } = await table();
    const bob = await addPlayer(rig, 'bob');
    const { requestId } = dm.peer.requestChange('alice', 'Private', [{ kind: 'max_hp', delta: -1 }]);
    await rig.settle();
    expect(bob.peer.view!.requests[requestId]).toBeUndefined();        // not even visible
    const id = bob.peer.sendRaw({ kind: 'player.respond', requestId, decision: 'accept', currentRevision: 1 });
    await rig.settle();
    expect(bob.peer.resultOf(id)?.status).toBe('forbidden');
    expect(alice.peer.pendingRequests()).toHaveLength(1);
  });

  it('the DM can cancel a pending request; the player can no longer accept it', async () => {
    const { rig, dm, alice } = await table();
    const { requestId } = dm.peer.requestChange('alice', 'Oops', [{ kind: 'exhaustion', delta: 1 }]);
    await rig.settle();
    dm.peer.cancelRequest(requestId);
    await rig.settle();
    expect(rig.host.debugState().requests[requestId].status).toBe('CANCELLED');
    const id = alice.peer.respond(requestId, 'accept');
    await rig.settle();
    expect(alice.peer.resultOf(id)?.status).toBe('rejected');
    expect(alice.character!.exhaustion).toBe(0);
  });

  it('malformed / hostile change payloads are rejected at the Host', async () => {
    const { rig, dm } = await table();
    const bad = [
      [{ kind: 'exhaustion', delta: 1.5 }], [{ kind: 'god_mode', delta: 1 }], [], [{ kind: 'ability', ability: 'luck', delta: 1 }],
      [{ kind: 'max_hp', delta: Number.POSITIVE_INFINITY }],
    ];
    for (const [i, changes] of bad.entries()) {
      const id = dm.peer.sendRaw({ kind: 'dm.request_change', requestId: `bad${i}`, targetId: 'alice', baseRevision: 1, label: 'x', changes: changes as never });
      await rig.settle();
      expect(dm.peer.resultOf(id)?.status).toBe('rejected');
    }
    expect(Object.keys(rig.host.debugState().requests)).toEqual([]);
  });

  it('a pending request survives player disconnect + reconnect exactly once, and can then be accepted', async () => {
    const { rig, dm, alice } = await table();
    alice.peer.disconnect();
    await rig.settle();
    const { requestId } = await dm.peer.requestChangeFromTemplate('camp-auto', 'tpl-exh', 'alice');
    await rig.settle();
    expect(alice.peer.pendingRequests()).toHaveLength(0);              // missed while offline
    await alice.peer.connect();
    await rig.settle();
    expect(alice.peer.pendingRequests().map(r => r.id)).toEqual([requestId]);
    expect(Object.keys(alice.peer.view!.requests)).toHaveLength(1);
    alice.peer.respond(requestId, 'accept');
    await rig.settle();
    expect(alice.character!.exhaustion).toBe(1);
  });

  it('accepted-but-unapplied requests are applied exactly once after a player process restart', async () => {
    const { rig, dm, alice } = await table();
    const { requestId } = await dm.peer.requestChangeFromTemplate('camp-auto', 'tpl-exh', 'alice');
    await rig.settle();
    // The Host records the acceptance, but the player process dies before the event is applied.
    rig.net.dropNext('alice', 's2c', f => f.includes('request_resolved'));
    alice.peer.respond(requestId, 'accept');
    await rig.settle();
    expect(rig.host.debugState().requests[requestId].status).toBe('ACCEPTED');
    expect(alice.character!.applied).toEqual([]);                       // crash window
    const restarted = await restartActor(rig, alice);                   // same character store, new process
    expect(restarted.character!.applied).toEqual([requestId]);          // applied from the authoritative record
    const again = await restartActor(rig, restarted);
    expect(again.character!.applied).toEqual([requestId]);              // and not a second time
    expect(again.character!.exhaustion).toBe(1);
  });
});
