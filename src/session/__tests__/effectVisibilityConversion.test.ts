// dm.convert_effect_visibility (DM_SCREEN_SPEC.md item 8's "convert public <-> secret where
// appropriate"). See effect_visibility_converted's own doc comment in types.ts for why this
// always forces a full resync rather than relying on the narrow event alone — converting
// visibility can change WHO is entitled to see the effect at all, the same class of problem
// Monster Visibility's dm.set_combatant_visibility already solved the same way.
import { newRig, addDm, addPlayer, seedPrep } from '../testing/harness';

async function table() {
  const rig = await newRig();
  const dm = await addDm(rig);
  const alice = await addPlayer(rig, 'alice');
  const bob = await addPlayer(rig, 'bob');
  await seedPrep(dm);
  await dm.peer.selectCampaign('camp-auto');
  await rig.settle();
  return { rig, dm, alice, bob };
}

describe('dm.convert_effect_visibility', () => {
  it('rejects an unknown effect', async () => {
    const { rig, dm } = await table();
    const opId = dm.peer.convertEffectVisibility('nope', 'secret');
    await rig.settle();
    expect(dm.peer.resultOf(opId)).toMatchObject({ status: 'rejected', reason: 'unknown-effect' });
  });

  it('public -> secret: strips identity on the Host, but the DM keeps seeing it via the vault', async () => {
    const { rig, dm, alice, bob } = await table();
    const { effectId } = await dm.peer.applyPreparedEffect('camp-auto', 'fx-blessing', ['alice']);
    await rig.settle();
    dm.peer.convertEffectVisibility(effectId, 'secret');
    await rig.settle();

    expect(rig.host.debugState().effects[effectId].definition).toMatchObject({ name: null, description: null, source: null, visibility: 'secret' });
    const dmEff = dm.peer.dmEffects().find(e => e.effectId === effectId)!;
    expect(dmEff.displayName).toBe('Blessing');   // recovered from the vault, not from the Host
    expect(dmEff.secret?.name).toBe('Blessing');

    // Alice was already a target; she should now see mechanics only, no identity.
    expect(alice.peer.visibleEffects()[0]).toMatchObject({ label: null });
    // Bob was never a target of this 'target'-visibility-turned-secret effect — unaffected either way.
    expect(bob.peer.visibleEffects()).toHaveLength(0);
  });

  it('secret -> public: a Player who was NEVER a target learns the real identity via the forced resync', async () => {
    const { rig, dm, alice, bob } = await table();
    const { effectId } = await dm.peer.applyPreparedEffect('camp-auto', 'fx-curse', ['alice']);
    await rig.settle();
    expect(bob.peer.visibleEffects()).toHaveLength(0);   // bob never saw the secret effect at all

    dm.peer.convertEffectVisibility(effectId, 'public');
    await rig.settle();

    expect(rig.host.debugState().effects[effectId].definition).toMatchObject({ name: 'Hidden Curse', visibility: 'public' });
    expect(alice.peer.visibleEffects()[0]).toMatchObject({ label: 'Hidden Curse' });
    expect(bob.peer.visibleEffects()[0]).toMatchObject({ label: 'Hidden Curse' });   // now visible table-wide
  });

  it('secret -> target: identity is revealed only to the actual target(s), not the whole table', async () => {
    const { rig, dm, alice, bob } = await table();
    const { effectId } = await dm.peer.applyPreparedEffect('camp-auto', 'fx-curse', ['alice']);
    await rig.settle();
    dm.peer.convertEffectVisibility(effectId, 'target');
    await rig.settle();
    expect(alice.peer.visibleEffects()[0]).toMatchObject({ label: 'Hidden Curse' });
    expect(bob.peer.visibleEffects()).toHaveLength(0);
  });

  it('a fresh name/description can be supplied when revealing, instead of the original secret identity', async () => {
    const { rig, dm, alice } = await table();
    const { effectId } = await dm.peer.applyPreparedEffect('camp-auto', 'fx-curse', ['alice']);
    await rig.settle();
    dm.peer.convertEffectVisibility(effectId, 'public', { name: 'The Curse of the Drowned King', description: 'revealed at last' });
    await rig.settle();
    expect(alice.peer.visibleEffects()[0]).toMatchObject({ label: 'The Curse of the Drowned King' });
  });

  it('rejects converting to secret with identity still attached (secret-metadata-not-allowed)', async () => {
    const { rig, dm } = await table();
    const { effectId } = await dm.peer.applyPreparedEffect('camp-auto', 'fx-blessing', ['alice']);
    await rig.settle();
    const opId = dm.peer.sendRaw({ kind: 'dm.convert_effect_visibility', effectId, visibility: 'secret', identity: { name: 'Blessing', description: null, source: null } });
    await rig.settle();
    expect(dm.peer.resultOf(opId)).toMatchObject({ status: 'rejected', reason: 'secret-metadata-not-allowed' });
  });

  it('rejects revealing with a null name', async () => {
    const { rig, dm } = await table();
    const { effectId } = await dm.peer.applyPreparedEffect('camp-auto', 'fx-curse', ['alice']);
    await rig.settle();
    const opId = dm.peer.sendRaw({ kind: 'dm.convert_effect_visibility', effectId, visibility: 'public', identity: { name: null, description: null, source: null } });
    await rig.settle();
    expect(dm.peer.resultOf(opId)).toMatchObject({ status: 'rejected', reason: 'malformed' });
  });

  it('a Host-only participant never sees any of this', async () => {
    const { rig, dm } = await table();
    const { effectId } = await dm.peer.applyPreparedEffect('camp-auto', 'fx-blessing', ['alice']);
    await rig.settle();
    dm.peer.convertEffectVisibility(effectId, 'secret');
    await rig.settle();
    expect(rig.hostPeer.view!.effects).toEqual({});
  });
});
