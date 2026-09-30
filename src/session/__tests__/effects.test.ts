import { newRig, addDm, addPlayer, seedPrep, restartActor, Rig, Actor } from '../testing/harness';

async function table(): Promise<{ rig: Rig; dm: Actor; alice: Actor; bob: Actor; cara: Actor }> {
  const rig = await newRig();
  const dm = await addDm(rig);
  const alice = await addPlayer(rig, 'alice');
  const bob = await addPlayer(rig, 'bob');
  const cara = await addPlayer(rig, 'cara');
  await seedPrep(dm);
  await dm.peer.selectCampaign('camp-auto');
  await rig.settle();
  return { rig, dm, alice, bob, cara };
}

describe('general effect system', () => {
  it('a prepared public effect is not applied until the DM applies it', async () => {
    const { rig, alice } = await table();
    expect(rig.host.debugState().effects).toEqual({});
    expect(alice.peer.visibleEffects()).toEqual([]);
  });

  it('public single-target effect: target sees it, everyone sees public effects', async () => {
    const { rig, dm, alice, bob } = await table();
    const { effectId } = await dm.peer.applyPreparedEffect('camp-auto', 'fx-blessing', ['alice']);
    await rig.settle();
    const app = rig.host.debugState().effects[effectId].applications[`${effectId}:alice`];
    expect(app).toMatchObject({ state: 'ACTIVE', targetId: 'alice', remaining: 3 });
    expect(alice.peer.visibleEffects()[0]).toMatchObject({ label: 'Blessing', components: [{ stat: 'save', operation: 'add', value: 1 }] });
    expect(bob.peer.visibleEffects()[0]?.label).toBe('Blessing');       // public: table-visible
  });

  it('multi-target effect: one definition, lifecycle tracked per target', async () => {
    const { rig, dm } = await table();
    const { effectId } = await dm.peer.applyPreparedEffect('camp-auto', 'fx-blessing', ['alice', 'bob', 'cara']);
    await rig.settle();
    const eff = rig.host.debugState().effects[effectId];
    expect(Object.keys(eff.applications).sort()).toEqual([`${effectId}:alice`, `${effectId}:bob`, `${effectId}:cara`]);
    expect(Object.values(eff.applications).every(a => a.state === 'ACTIVE')).toBe(true);
  });

  it('Due to End does not delete the effect; a human still ends it', async () => {
    const { rig, dm, alice } = await table();
    const { effectId } = await dm.peer.applyPreparedEffect('camp-auto', 'fx-blessing', ['alice']);
    await rig.settle();
    dm.peer.markDue(`${effectId}:alice`);
    await rig.settle();
    const app = rig.host.debugState().effects[effectId].applications[`${effectId}:alice`];
    expect(app.state).toBe('DUE_TO_END');
    expect(alice.peer.visibleEffects()).toHaveLength(1);                // still present, still counted
    expect(alice.peer.visibleEffects()[0].app.state).toBe('DUE_TO_END');
    dm.peer.endEffect(effectId, `${effectId}:alice`);
    await rig.settle();
    expect(rig.host.debugState().effects[effectId].applications[`${effectId}:alice`].state).toBe('ENDED');
    expect(alice.peer.visibleEffects()).toHaveLength(0);
  });

  it('round ticks mark effects Due to End at zero but never remove them', async () => {
    const { rig, dm } = await table();
    const { effectId } = await dm.peer.applyPreparedEffect('camp-auto', 'fx-blessing', ['alice', 'bob']);
    await rig.settle();
    dm.peer.tickRounds(2);
    await rig.settle();
    let apps = Object.values(rig.host.debugState().effects[effectId].applications);
    expect(apps.map(a => [a.state, a.remaining])).toEqual([['ACTIVE', 1], ['ACTIVE', 1]]);
    dm.peer.tickRounds(5);
    await rig.settle();
    apps = Object.values(rig.host.debugState().effects[effectId].applications);
    expect(apps.map(a => [a.state, a.remaining])).toEqual([['DUE_TO_END', 0], ['DUE_TO_END', 0]]);
  });

  it('ending one target leaves the other targets active', async () => {
    const { rig, dm, alice, bob, cara } = await table();
    const { effectId } = await dm.peer.applyPreparedEffect('camp-auto', 'fx-blessing', ['alice', 'bob', 'cara']);
    await rig.settle();
    dm.peer.markDue(`${effectId}:alice`);
    dm.peer.endEffect(effectId, `${effectId}:alice`);
    await rig.settle();
    const apps = rig.host.debugState().effects[effectId].applications;
    expect(apps[`${effectId}:alice`].state).toBe('ENDED');
    expect(apps[`${effectId}:bob`].state).toBe('ACTIVE');
    expect(apps[`${effectId}:cara`].state).toBe('ACTIVE');
    expect(alice.peer.visibleEffects()).toHaveLength(2);                // public: alice still sees Bob+Cara's
    expect(alice.peer.visibleEffects().every(v => v.app.targetId !== 'alice')).toBe(true);
    expect(bob.peer.visibleEffects().map(v => v.app.targetId).sort()).toEqual(['bob', 'cara']);
    expect(cara.peer.visibleEffects().map(v => v.app.targetId).sort()).toEqual(['bob', 'cara']);
  });

  it('ending the whole effect ends every remaining target', async () => {
    const { rig, dm } = await table();
    const { effectId } = await dm.peer.applyPreparedEffect('camp-auto', 'fx-blessing', ['alice', 'bob', 'cara']);
    await rig.settle();
    dm.peer.endEffect(effectId, `${effectId}:alice`);
    await rig.settle();
    dm.peer.endEffect(effectId);
    await rig.settle();
    expect(Object.values(rig.host.debugState().effects[effectId].applications).map(a => a.state)).toEqual(['ENDED', 'ENDED', 'ENDED']);
    // Ending again is refused rather than re-processed.
    const again = dm.peer.endEffect(effectId);
    await rig.settle();
    expect(dm.peer.resultOf(again)).toMatchObject({ status: 'rejected', reason: 'already-ended' });
  });

  it('duplicate End Effect (network duplicate) is idempotent', async () => {
    const { rig, dm } = await table();
    const { effectId } = await dm.peer.applyPreparedEffect('camp-auto', 'fx-blessing', ['alice']);
    await rig.settle();
    const rev = rig.host.debugState().revision;
    rig.net.duplicateNext('dm1', 'c2s', f => f.includes('dm.end_effect'));
    dm.peer.endEffect(effectId);
    await rig.settle();
    expect(rig.host.debugState().revision).toBe(rev + 1);              // exactly one event
  });
});

describe('secret effects', () => {
  it('DM sees full identity; the target sees mechanics only; nobody else sees anything', async () => {
    const { rig, dm, alice, bob } = await table();
    const { effectId } = await dm.peer.applyPreparedEffect('camp-auto', 'fx-curse', ['alice']);
    await rig.settle();

    const dmFx = dm.peer.dmEffects().find(e => e.effectId === effectId)!;
    expect(dmFx.displayName).toBe('Hidden Curse');
    expect(dmFx.secret).toMatchObject({ description: 'DM ONLY: the amulet is cursed', source: 'Cursed amulet', hiddenDurationReason: 'until remove curse' });

    const seen = alice.peer.visibleEffects();
    expect(seen).toHaveLength(1);
    expect(seen[0].label).toBeNull();                                    // identity concealed
    expect(seen[0].components).toEqual([{ stat: 'ac', operation: 'add', value: -1 }]);   // mechanics still correct
    expect(bob.peer.visibleEffects()).toEqual([]);                       // other players: nothing
    expect(bob.peer.view!.effects).toEqual({});
  });

  it('SERIALIZED player payloads never contain secret metadata (wire, replica and persisted state)', async () => {
    const { rig, dm, alice } = await table();
    await dm.peer.applyPreparedEffect('camp-auto', 'fx-curse', ['alice']);
    dm.peer.tickRounds(1);
    await rig.settle();
    await alice.peer.flush();
    const secrets = ['Hidden Curse', 'the amulet is cursed', 'Cursed amulet', 'reveal at level 5', 'until remove curse'];
    const wire = rig.net.receivedBy('alice').join('\n');
    const replica = JSON.stringify(alice.peer.view);
    const persisted = JSON.stringify(await alice.kv.get(`session.peer.alice`));
    for (const s of secrets) {
      expect(wire).not.toContain(s);
      expect(replica).not.toContain(s);
      expect(persisted).not.toContain(s);
    }
    for (const s of secrets) {
      expect(JSON.stringify(rig.host.debugState())).not.toContain(s);      // the Host never had them either
      expect(rig.net.receivedBy('host1').join('\n')).not.toContain(s);
    }
  });

  it('the secret effect still changes the player\'s derived numbers (mechanics stay correct)', async () => {
    const { rig, dm, alice } = await table();
    await dm.peer.applyPreparedEffect('camp-auto', 'fx-curse', ['alice']);
    await rig.settle();
    const ac = alice.character!.ac + alice.peer.visibleEffects()
      .flatMap(v => v.components).filter(c => c.stat === 'ac' && c.operation === 'add').reduce((n, c) => n + c.value, 0);
    expect(ac).toBe(13);                                                  // 14 - 1, with no identity revealed
  });

  it('the vault survives a DM restart so secret identity is still available to the DM', async () => {
    const { rig, dm } = await table();
    const { effectId } = await dm.peer.applyPreparedEffect('camp-auto', 'fx-curse', ['alice']);
    await rig.settle();
    const dm2 = await restartActor(rig, dm);
    expect(dm2.peer.dmEffects().find(e => e.effectId === effectId)?.displayName).toBe('Hidden Curse');
  });

  it('secret metadata sent by a hostile/buggy DM client is refused at the Host', async () => {
    const { rig, dm } = await table();
    const id = dm.peer.sendRaw({
      kind: 'dm.apply_effect', targets: ['alice'],
      effect: { id: 'fx-leaky', name: 'Leaky Curse', description: 'oops', source: 'oops', visibility: 'secret', components: [], duration: { unit: 'manual' } },
    });
    await rig.settle();
    expect(dm.peer.resultOf(id)).toMatchObject({ status: 'rejected', reason: 'secret-metadata-not-allowed' });
    expect(JSON.stringify(rig.host.debugState())).not.toContain('Leaky Curse');
  });

  it('secret effect audit entries are DM-only', async () => {
    const { rig, dm, alice } = await table();
    const { effectId } = await dm.peer.applyPreparedEffect('camp-auto', 'fx-curse', ['alice']);
    dm.peer.endEffect(effectId);
    await rig.settle();
    expect(dm.peer.view!.audit.map(a => a.kind)).toEqual(expect.arrayContaining(['effect_apply', 'effect_end']));
    expect(alice.peer.view!.audit.map(a => a.kind)).not.toContain('effect_apply');
    expect(alice.peer.view!.audit.map(a => a.kind)).not.toContain('effect_end');
    expect(rig.hostPeer.view!.audit.map(a => a.kind)).not.toContain('effect_apply');
  });

  it('a non-target cannot learn about a secret effect from its lifecycle events (ticks carry no content)', async () => {
    const { rig, dm, bob } = await table();
    const { effectId } = await dm.peer.applyPreparedEffect('camp-auto', 'fx-curse', ['alice']);
    dm.peer.endEffect(effectId);
    await rig.settle();
    const bobWire = rig.net.receivedBy('bob').join('\n');
    expect(bobWire).not.toContain(effectId);
    expect(bobWire).not.toContain('alice:');
    expect(bob.peer.view!.revision).toBe(rig.host.debugState().revision);   // still in lock-step via ticks
  });
});
