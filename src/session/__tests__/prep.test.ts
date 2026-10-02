import { newRig, addDm, addPlayer, seedPrep, restartActor } from '../testing/harness';
import { InMemoryKv } from '../kv';
import { PrepService, findLiveFields, toEffectInput, toLiveEncounterInput } from '../prep';

describe('DM preparation works fully offline (no Host at all)', () => {
  it('creates, edits, closes and reopens a campaign with everything from the spec', async () => {
    const kv = new InMemoryKv();
    const prepA = new PrepService(kv, () => 5000);
    await prepA.create('camp-a', 'Automation Campaign');
    await prepA.edit('camp-a', p => {
      p.encounters.push({ id: 'e1', name: 'Bridge Ambush', combatants: [], dmNotes: 'n' });
      p.effects.push({ id: 'f1', name: 'Blessing', description: 'd', source: 's', notes: '', hiddenDurationReason: '', visibility: 'public', components: [], duration: { unit: 'manual' } });
      p.effects.push({ id: 'f2', name: 'Hidden Curse', description: 'secret d', source: 'amulet', notes: 'n', hiddenDurationReason: 'why', visibility: 'secret', components: [], duration: { unit: 'manual' } });
      p.templates.push({ id: 't1', label: 'Exhaustion Increase', changes: [{ kind: 'exhaustion', delta: 1 }] });
      p.notes.push({ id: 'n1', text: 'automation fixture note', dmOnly: true });
      p.plans.push({ id: 'pl1', name: 'Session 1', encounterIds: ['e1'], effectIds: ['f1', 'f2'], templateIds: ['t1'], notes: '' });
      p.contentManifest.bannedPackIds.push('pack-x');
      p.party.push({ name: 'Alice' });
      return p;
    });
    // "Close the app": a brand-new service over the same storage.
    const reopened = new PrepService(kv);
    const p = (await reopened.load('camp-a'))!;
    expect(p.name).toBe('Automation Campaign');
    expect(p.encounters.map(e => e.name)).toEqual(['Bridge Ambush']);
    expect(p.effects.map(e => e.visibility)).toEqual(['public', 'secret']);
    expect(p.templates[0].label).toBe('Exhaustion Increase');
    expect(p.notes[0]).toMatchObject({ text: 'automation fixture note', dmOnly: true });
    expect(p.plans).toHaveLength(1);
    expect(p.contentManifest.bannedPackIds).toEqual(['pack-x']);
    expect(p.campaignRevision).toBe(2);
    expect(await reopened.list()).toEqual([{ campaignId: 'camp-a', name: 'Automation Campaign', campaignRevision: 2 }]);
  });

  it('every edit advances the CampaignRevision', async () => {
    const svc = new PrepService(new InMemoryKv());
    await svc.create('c', 'C');
    const a = await svc.edit('c', p => p);
    const b = await svc.edit('c', p => p);
    expect([a.campaignRevision, b.campaignRevision]).toEqual([2, 3]);
  });

  it('prepared content cannot contain live-session fields (templates stay inert)', async () => {
    const svc = new PrepService(new InMemoryKv());
    await svc.create('c', 'C');
    await expect(svc.edit('c', p => {
      p.templates.push({ id: 't', label: 'x', changes: [], baseRevision: 9, status: 'PENDING', requestId: 'r' } as never);
      return p;
    })).rejects.toThrow(/live-session fields/);
    const clean = await svc.edit('c', p => { p.templates.push({ id: 't', label: 'x', changes: [{ kind: 'max_hp', delta: -5 }] }); return p; });
    expect(findLiveFields(clean)).toEqual([]);
  });

  it('activation payloads never carry DM notes or secret identity', () => {
    const enc = toLiveEncounterInput({
      id: 'e', name: 'Ambush', dmNotes: 'TOPSECRET',
      combatants: [{ id: 'c', name: 'Bandit', hpState: 'healthy', ac: 12, dmNotes: 'TOPSECRET-2' }],
    }, 'live-e');
    expect(JSON.stringify(enc)).not.toMatch(/TOPSECRET/);
    const { input, secret } = toEffectInput({
      id: 'f', name: 'Hidden Curse', description: 'the amulet', source: 'Amulet', notes: 'n', hiddenDurationReason: 'why',
      visibility: 'secret', components: [{ stat: 'ac', operation: 'add', value: -1 }], duration: { unit: 'manual' },
    }, 'live-f');
    expect(input).toMatchObject({ name: null, description: null, source: null, visibility: 'secret' });
    expect(secret).toMatchObject({ name: 'Hidden Curse', hiddenDurationReason: 'why' });
  });
});

describe('prepared content is not live content', () => {
  it('joining a Host with a prepared campaign makes NOTHING live until the DM activates it', async () => {
    const rig = await newRig();
    const dm = await addDm(rig);
    const alice = await addPlayer(rig, 'alice');
    await seedPrep(dm);
    const before = rig.host.debugState();
    await dm.peer.selectCampaign('camp-auto');
    await rig.settle();

    const s = rig.host.debugState();
    expect(s.campaign).toEqual({
      campaignId: 'camp-auto', name: 'Automation Campaign',
      bannedPackIds: [], bannedSubclassIds: [], requiredPacks: [],
      monsterHpVisibilityDefault: 'standard', freeEditAllowed: true, homebrewNeedsApproval: false,
      permanentRewardsAutomatic: false, ruleSuggestionsEnabled: true, combatVariants: [],
    });
    expect(s.encounters).toEqual({});
    expect(s.effects).toEqual({});
    expect(s.requests).toEqual({});
    expect(s.revision).toBe(before.revision + 1);          // only the link event
    expect(alice.peer.view!.effects).toEqual({});
    expect(alice.peer.view!.encounters).toEqual({});
  });

  it('the Host and players never see DM notes, prepared secrets or plans', async () => {
    const rig = await newRig();
    const dm = await addDm(rig);
    const alice = await addPlayer(rig, 'alice');
    await seedPrep(dm);
    await dm.peer.selectCampaign('camp-auto');
    await dm.peer.activateEncounter('camp-auto', 'enc-bridge');
    await dm.peer.applyPreparedEffect('camp-auto', 'fx-curse', ['alice']);
    await rig.settle();

    const forbidden = ['automation fixture note', 'SECRET: the troll', 'doppelganger', 'ransom letter', 'Hidden Curse',
      'the amulet is cursed', 'Cursed amulet', 'reveal at level 5', 'until remove curse', 'Session 1', 'Exhaustion Increase'];
    for (const label of ['host1', 'alice']) {
      const wire = rig.net.receivedBy(label).join('\n');
      for (const f of forbidden) expect(wire).not.toContain(f);
    }
    const hostState = JSON.stringify(rig.host.debugState());
    for (const f of forbidden) expect(hostState).not.toContain(f);
    expect(JSON.stringify(rig.hostPeer.view)).not.toContain('Bandit');   // Host-only sees no encounter content
    expect(JSON.stringify(alice.peer.view)).toContain('Bandit Captain'); // players see the activated public encounter
    expect(JSON.stringify(alice.peer.view)).not.toContain('doppelganger');
  });

  it('only the activated encounter becomes live', async () => {
    const rig = await newRig();
    const dm = await addDm(rig);
    const alice = await addPlayer(rig, 'alice');
    await seedPrep(dm);
    await dm.prep.edit('camp-auto', p => {
      p.encounters.push({ id: 'enc-other', name: 'Cellar Rats', combatants: [], dmNotes: '' });
      return p;
    });
    await dm.peer.selectCampaign('camp-auto');
    await dm.peer.activateEncounter('camp-auto', 'enc-bridge');
    await rig.settle();
    const names = Object.values(rig.host.debugState().encounters).map(e => e.name);
    expect(names).toEqual(['Bridge Ambush']);
    expect(Object.values(alice.peer.view!.encounters)[0].combatants.map(c => c.name)).toEqual(['Bandit', 'Bandit Captain']);
  });
});

describe('CampaignRevision and LiveSessionRevision are independent authority streams', () => {
  it('local prep can advance while offline and a live snapshot never overwrites it', async () => {
    const rig = await newRig();
    let dm = await addDm(rig);
    await seedPrep(dm);
    const revAtConnect = (await dm.prep.load('camp-auto'))!.campaignRevision;
    await dm.peer.selectCampaign('camp-auto');
    await rig.settle();
    expect(rig.host.debugState().campaign?.name).toBe('Automation Campaign');

    // DM goes offline and keeps preparing.
    dm.peer.disconnect();
    await rig.settle();
    await dm.prep.edit('camp-auto', p => { p.name = 'Automation Campaign (revised)'; p.notes.push({ id: 'n2', text: 'offline edit', dmOnly: true }); return p; });
    const offlineRev = (await dm.prep.load('camp-auto'))!.campaignRevision;
    expect(offlineRev).toBe(revAtConnect + 1);

    // Live session moves on without the DM.
    await addPlayer(rig, 'late-player');
    const liveRevWhileAway = rig.host.debugState().revision;

    // DM comes back: gets the (older-named) live snapshot, prep stays newer.
    dm = await restartActor(rig, dm);
    const p = (await dm.prep.load('camp-auto'))!;
    expect(p.name).toBe('Automation Campaign (revised)');
    expect(p.campaignRevision).toBe(offlineRev);
    expect(p.notes.map(n => n.text)).toContain('offline edit');
    expect(dm.peer.view!.revision).toBeGreaterThanOrEqual(liveRevWhileAway);
    expect(dm.peer.view!.campaign?.name).toBe('Automation Campaign');   // stale live ref, not prep

    // Re-linking pushes the NEWER prep info into the live ref (never the reverse).
    await dm.peer.selectCampaign('camp-auto');
    await rig.settle();
    expect(rig.host.debugState().campaign?.name).toBe('Automation Campaign (revised)');
    expect((await dm.prep.load('camp-auto'))!.campaignRevision).toBe(offlineRev);
  });

  it('the same campaign is reusable with a different Host (Host X then Host Y)', async () => {
    const dmKv = new InMemoryKv();
    // Session 1 on Host X.
    const rigX = await newRig({ sessionId: 'hostX' });
    let dm = await addDm(rigX, 'dm1', 'Dungeon Master', dmKv);
    await seedPrep(dm);
    await dm.peer.selectCampaign('camp-auto');
    await dm.peer.activateEncounter('camp-auto', 'enc-bridge');
    await rigX.settle();
    expect(rigX.host.debugState().sessionId).toBe('hostX');
    dm.peer.disconnect();
    await dm.peer.flush();
    rigX.host.stop();

    // Offline between sessions.
    const prep = new PrepService(dmKv);
    await prep.edit('camp-auto', p => { p.notes.push({ id: 'between', text: 'edited between sessions', dmOnly: true }); return p; });
    const revBetween = (await prep.load('camp-auto'))!.campaignRevision;

    // Session 2 on a completely fresh Host Y. Same DM identity storage is NOT reused for the peer.
    const rigY = await newRig({ sessionId: 'hostY' });
    dm = await addDm(rigY, 'dm-on-y', 'Dungeon Master', dmKv);
    await dm.peer.selectCampaign('camp-auto');
    await rigY.settle();
    const s = rigY.host.debugState();
    expect(s.sessionId).toBe('hostY');
    expect(s.campaign?.campaignId).toBe('camp-auto');
    expect(s.encounters).toEqual({});                        // Host X's live state did not follow
    expect((await dm.prep.load('camp-auto'))!.campaignRevision).toBe(revBetween);
    await dm.peer.activateEncounter('camp-auto', 'enc-bridge');
    await rigY.settle();
    expect(Object.values(rigY.host.debugState().encounters)[0].name).toBe('Bridge Ambush');
    expect(JSON.stringify(rigY.host.debugState())).not.toContain('hostX');
  });
});

describe('the SAME device identity moving between Hosts', () => {
  it('a DM that joined Host X and later joins a brand-new Host Y (same stored identity) works immediately', async () => {
    const dmKv = new InMemoryKv();
    const rigX = await newRig({ sessionId: 'hostX' });
    let dm = await addDm(rigX, 'dm-same', 'Dungeon Master', dmKv);
    await seedPrep(dm);
    await dm.peer.selectCampaign('camp-auto');
    await dm.peer.activateEncounter('camp-auto', 'enc-bridge');
    await rigX.settle();
    expect(dm.peer.pendingOps).toHaveLength(0);
    dm.peer.disconnect();
    await dm.peer.flush();
    rigX.host.stop();

    const rigY = await newRig({ sessionId: 'hostY' });
    dm = await addDm(rigY, 'dm-same', 'Dungeon Master', dmKv);          // identical participant id + storage
    expect(dm.peer.capabilities).toEqual(['dm']);
    const opId = await dm.peer.selectCampaign('camp-auto');
    await rigY.settle();
    expect(dm.peer.resultOf(opId)?.status).toBe('applied');              // not held behind X's old sequence numbers
    expect(rigY.host.debugState().campaign?.name).toBe('Automation Campaign');
    expect(rigY.host.debugState().sessionId).toBe('hostY');
  });

  it('ops queued for Host X are not replayed against Host Y', async () => {
    const dmKv = new InMemoryKv();
    const rigX = await newRig({ sessionId: 'hostX' });
    const dm = await addDm(rigX, 'dm-q', 'Dungeon Master', dmKv);
    await seedPrep(dm);
    dm.peer.disconnect();
    await rigX.settle();
    await dm.peer.selectCampaign('camp-auto');                           // queued while offline, never delivered to X
    await dm.peer.flush();
    expect(dm.peer.pendingOps).toHaveLength(1);
    rigX.host.stop();

    const rigY = await newRig({ sessionId: 'hostY' });
    const dmY = await addDm(rigY, 'dm-q', 'Dungeon Master', dmKv);
    expect(dmY.peer.pendingOps).toHaveLength(0);                         // X's op belongs to X's session
    expect(rigY.host.debugState().campaign).toBeNull();
  });
});
