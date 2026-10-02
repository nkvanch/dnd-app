// "Preview as Player" (DM_SCREEN_SPEC.md item 17) needs no new wire protocol at all — a DM's own
// ViewState IS the full unredacted canonical state (projectState's 'dm' branch clones every
// field), so app/live/dm.tsx recomputes a chosen Player's authorized projection locally by calling
// the SAME projectState() the Host itself uses, with that Player's id/capabilities. This test
// proves the one thing that approach actually depends on: projecting the DM's view down to a
// given Player produces EXACTLY what that Player's own device already has — across every kind of
// redaction this session has built (secret effects, monster visibility, persona, rewards, vitals).
import { newRig, addDm, addPlayer, seedPrep } from '../testing/harness';
import { projectState } from '../state';

describe('Preview as Player: projecting the DM view reproduces the real Player view exactly', () => {
  it('across secret effects, monster visibility, persona, rewards, and vitals all at once', async () => {
    const rig = await newRig();
    const dm = await addDm(rig);
    const alice = await addPlayer(rig, 'alice');
    const bob = await addPlayer(rig, 'bob');
    await seedPrep(dm);
    await dm.peer.selectCampaign('camp-auto');
    await dm.peer.activateEncounter('camp-auto', 'enc-bridge');
    await rig.settle();
    const encounterId = Object.keys(rig.host.debugState().encounters)[0];
    const combatantId = rig.host.debugState().encounters[encounterId].combatants[0].id;

    await dm.peer.applyPreparedEffect('camp-auto', 'fx-curse', ['alice']);
    dm.peer.setCombatantVisibility(encounterId, combatantId, { name: true, hpState: true, exactHp: true, ac: true, conditions: true });
    dm.peer.setCombatantExactHp(encounterId, combatantId, 7, 15);
    alice.peer.setPersona({ enabled: true, name: 'The Stranger', hp: 999, maxHp: 999, ac: 99 });
    alice.character!.conditions = ['poisoned'];
    alice.character!.revision += 1;
    alice.peer.reportCharacter();
    dm.peer.grantReward('bob', 'campaign_boon', 'Favor of the Tide');
    await rig.settle();

    const projectedForAlice = projectState(dm.peer.view!, { id: 'alice', capabilities: ['player'] });
    const projectedForBob = projectState(dm.peer.view!, { id: 'bob', capabilities: ['player'] });

    expect(projectedForAlice).toEqual(alice.peer.view);
    expect(projectedForBob).toEqual(bob.peer.view);
  });

  it('also holds for a Player who has reported nothing at all yet', async () => {
    const rig = await newRig();
    const dm = await addDm(rig);
    const alice = await addPlayer(rig, 'alice');
    await rig.settle();
    const projected = projectState(dm.peer.view!, { id: 'alice', capabilities: ['player'] });
    expect(projected).toEqual(alice.peer.view);
  });
});
