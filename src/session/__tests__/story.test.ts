// The complete DM-preparation E2E story (spec steps A..AM), executed in-process
// over the deterministic transport. The Android run replays the same script
// against the real app (see artifacts/host-dm-rework/e2e).
import { newRig, addDm, addPlayer, expectConverged } from '../testing/harness';
import { InMemoryKv } from '../kv';
import { PrepService } from '../prep';

describe('full DM preparation -> live session story', () => {
  it('A-AM', async () => {
    const dmKv = new InMemoryKv();

    // A-B: DM prepares OFFLINE (no Host exists yet).
    const offlinePrep = new PrepService(dmKv);
    await offlinePrep.create('camp-auto', 'Automation Campaign');
    await offlinePrep.edit('camp-auto', p => {
      p.encounters.push({ id: 'enc-bridge', name: 'Bridge Ambush', dmNotes: 'DMONLY-enc', combatants: [
        { id: 'c1', name: 'Bandit', hpState: 'healthy', ac: 12, dmNotes: 'DMONLY-c1' },
        { id: 'c2', name: 'Bandit Captain', hpState: 'healthy', ac: 15, dmNotes: 'DMONLY-c2' }] });
      p.effects.push({ id: 'fx-blessing', name: 'Blessing', description: 'favour', source: 'Cleric', notes: '', hiddenDurationReason: '', visibility: 'public', components: [{ stat: 'spell_attack', operation: 'add', value: 1 }], duration: { unit: 'rounds', total: 10, remaining: 10 } });
      p.effects.push({ id: 'fx-curse', name: 'Hidden Curse', description: 'DMONLY-curse-desc', source: 'DMONLY-curse-src', notes: 'DMONLY-curse-notes', hiddenDurationReason: 'DMONLY-why', visibility: 'secret', components: [{ stat: 'ac', operation: 'add', value: -1 }], duration: { unit: 'manual' } });
      p.templates.push({ id: 'tpl-exh', label: 'Exhaustion Increase', changes: [{ kind: 'exhaustion', delta: 1 }] });
      p.notes.push({ id: 'n1', text: 'DMONLY automation fixture note', dmOnly: true });
      return p;
    });

    // C-E: close the app completely, relaunch, verify persistence.
    const relaunched = new PrepService(dmKv);
    const prep = (await relaunched.load('camp-auto'))!;
    expect([prep.encounters.length, prep.effects.length, prep.templates.length, prep.notes.length]).toEqual([1, 2, 1, 1]);

    // F-G: Host-only creates a live session.
    const rigX = await newRig({ sessionId: 'hostX', dmPolicy: 'auto-first' });
    // H-I: DM joins and selects the campaign.
    let dm = await addDm(rigX, 'dm1', 'Tater', dmKv);
    await dm.peer.selectCampaign('camp-auto');
    await rigX.settle();

    // J: nothing prepared is live; the Host cannot see DM material.
    expect(Object.keys(rigX.host.debugState().encounters)).toEqual([]);
    expect(Object.keys(rigX.host.debugState().effects)).toEqual([]);
    expect(JSON.stringify(rigX.host.debugState())).not.toContain('DMONLY');
    expect(rigX.net.receivedBy('host1').join('')).not.toContain('DMONLY');

    // K-L: players join.
    const alice = await addPlayer(rigX, 'alice');
    const bob = await addPlayer(rigX, 'bob');

    // M-N: activate Bridge Ambush; only that content goes live.
    await dm.peer.activateEncounter('camp-auto', 'enc-bridge');
    await rigX.settle();
    expect(Object.values(alice.peer.view!.encounters).map(e => e.name)).toEqual(['Bridge Ambush']);
    expect(JSON.stringify(alice.peer.view)).not.toContain('DMONLY');

    // O-P: Blessing on multiple targets.
    const blessing = await dm.peer.applyPreparedEffect('camp-auto', 'fx-blessing', ['alice', 'bob']);
    await rigX.settle();
    expect(alice.peer.visibleEffects().map(v => v.label)).toEqual(['Blessing', 'Blessing']);
    expect(bob.peer.visibleEffects()).toHaveLength(2);

    // Q-R: Hidden Curse on Alice; serialized payloads carry no secret metadata.
    const curse = await dm.peer.applyPreparedEffect('camp-auto', 'fx-curse', ['alice']);
    await rigX.settle();
    await alice.peer.flush();
    const aliceWire = rigX.net.receivedBy('alice').join('\n');
    const alicePersisted = JSON.stringify(await alice.kv.get('session.peer.alice'));
    for (const s of ['Hidden Curse', 'DMONLY']) {
      expect(aliceWire).not.toContain(s);
      expect(alicePersisted).not.toContain(s);
      expect(JSON.stringify(alice.peer.view)).not.toContain(s);
    }
    expect(dm.peer.dmEffects().find(e => e.effectId === curse.effectId)?.secret?.description).toBe('DMONLY-curse-desc');

    // S-V: Exhaustion Increase request; Alice modifies then accepts; both versions auditable.
    const { requestId } = await dm.peer.requestChangeFromTemplate('camp-auto', 'tpl-exh', 'alice');
    await rigX.settle();
    alice.peer.respond(requestId, 'modify', { modified: [{ kind: 'exhaustion', delta: 2 }] });
    await rigX.settle();
    const req = dm.peer.view!.requests[requestId];
    expect(req.original).toEqual([{ kind: 'exhaustion', delta: 1 }]);
    expect(req.finalApplied).toEqual([{ kind: 'exhaustion', delta: 2 }]);
    expect(req.status).toBe('MODIFIED');
    expect(alice.character!.exhaustion).toBe(2);

    // W-Y: Blessing Due to End for one target, end that target only.
    dm.peer.markDue(`${blessing.effectId}:alice`);
    await rigX.settle();
    expect(alice.peer.visibleEffects().find(v => v.app.targetId === 'alice' && v.label === 'Blessing')?.app.state).toBe('DUE_TO_END');
    dm.peer.endEffect(blessing.effectId, `${blessing.effectId}:alice`);
    await rigX.settle();
    const apps = rigX.host.debugState().effects[blessing.effectId].applications;
    expect(apps[`${blessing.effectId}:alice`].state).toBe('ENDED');
    expect(apps[`${blessing.effectId}:bob`].state).toBe('ACTIVE');                     // Z: other target remains affected
    expect(bob.peer.visibleEffects().some(v => v.label === 'Blessing' && v.app.targetId === 'bob')).toBe(true);

    // Z-AC: Player disconnects; DM changes live state; player reconnects; no duplicates.
    alice.peer.disconnect();
    await rigX.settle();
    dm.peer.tickRounds(3);
    await dm.peer.requestChangeFromTemplate('camp-auto', 'tpl-exh', 'alice');
    await rigX.settle();
    await alice.peer.connect();
    await rigX.settle();
    expect(Object.keys(alice.peer.view!.requests)).toHaveLength(2);
    expect(alice.peer.pendingRequests()).toHaveLength(1);
    expect(alice.peer.visibleEffects().filter(v => v.label === null)).toHaveLength(1);   // the curse, once, no identity
    expectConverged(rigX, [dm.peer, alice.peer, bob.peer, rigX.hostPeer]);

    // AD-AG: DM disconnects, edits unrevealed local prep offline, reconnects; newer prep survives.
    dm.peer.disconnect();
    await rigX.settle();
    await dm.prep.edit('camp-auto', p => { p.notes.push({ id: 'n2', text: 'DMONLY edited while disconnected', dmOnly: true }); return p; });
    const revOffline = (await dm.prep.load('camp-auto'))!.campaignRevision;
    await dm.peer.connect();
    await rigX.settle();
    expect((await dm.prep.load('camp-auto'))!.campaignRevision).toBe(revOffline);
    expect((await dm.prep.load('camp-auto'))!.notes.map(n => n.text)).toContain('DMONLY edited while disconnected');
    expectConverged(rigX, [dm.peer, alice.peer, bob.peer, rigX.hostPeer]);

    // AH-AI: end the session, stop Host X.
    dm.peer.disconnect();
    await dm.peer.flush();
    rigX.host.stop();

    // AJ-AM: fresh Host Y; DM joins and selects the SAME campaign; it is reusable and independent of Host X.
    const rigY = await newRig({ sessionId: 'hostY', dmPolicy: 'auto-first' });
    dm = await addDm(rigY, 'dm-y', 'Tater', dmKv);
    await dm.peer.selectCampaign('camp-auto');
    await rigY.settle();
    const y = rigY.host.debugState();
    expect(y.sessionId).toBe('hostY');
    expect(y.campaign?.name).toBe('Automation Campaign');
    expect(y.encounters).toEqual({});
    expect(y.effects).toEqual({});
    await dm.peer.activateEncounter('camp-auto', 'enc-bridge');
    await rigY.settle();
    expect(Object.values(rigY.host.debugState().encounters).map(e => e.name)).toEqual(['Bridge Ambush']);
    expect((await dm.prep.load('camp-auto'))!.campaignRevision).toBe(revOffline);
  });
});
