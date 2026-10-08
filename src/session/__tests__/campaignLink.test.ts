// dm.unlink_campaign (DM_SCREEN_SPEC.md item 16's "disconnect campaign from live room") — the
// room itself keeps running; only the attached CampaignPolicy is cleared, same as how the room
// started with none.
import { newRig, addDm, addPlayer, seedPrep } from '../testing/harness';

describe('dm.unlink_campaign', () => {
  it('rejects when no campaign is linked', async () => {
    const rig = await newRig();
    const dm = await addDm(rig);
    const opId = dm.peer.unlinkCampaign();
    await rig.settle();
    expect(dm.peer.resultOf(opId)).toMatchObject({ status: 'rejected', reason: 'no-campaign-linked' });
  });

  it('clears the campaign for the DM, every Player, and a Host-only participant alike', async () => {
    const rig = await newRig();
    const dm = await addDm(rig);
    const alice = await addPlayer(rig, 'alice');
    await seedPrep(dm);
    await dm.peer.selectCampaign('camp-auto');
    await rig.settle();
    expect(dm.peer.view!.campaign?.campaignId).toBe('camp-auto');
    expect(alice.peer.view!.campaign?.campaignId).toBe('camp-auto');

    const opId = dm.peer.unlinkCampaign();
    await rig.settle();
    expect(dm.peer.resultOf(opId)?.status).toBe('applied');

    expect(dm.peer.view!.campaign).toBeNull();
    expect(alice.peer.view!.campaign).toBeNull();
    expect(rig.hostPeer.view!.campaign).toBeNull();
  });

  it('does not disturb anything else already live — participants, encounters, characters stay intact', async () => {
    const rig = await newRig();
    const dm = await addDm(rig);
    const alice = await addPlayer(rig, 'alice');
    await seedPrep(dm);
    await dm.peer.selectCampaign('camp-auto');
    await rig.settle();
    dm.peer.unlinkCampaign();
    await rig.settle();
    expect(dm.peer.view!.participants.alice).toBeDefined();
    expect(dm.peer.view!.characters.alice).toBeDefined();
  });

  it('can re-link a (possibly different) campaign afterwards', async () => {
    const rig = await newRig();
    const dm = await addDm(rig);
    await seedPrep(dm);
    await dm.peer.selectCampaign('camp-auto');
    await rig.settle();
    dm.peer.unlinkCampaign();
    await rig.settle();
    await dm.peer.selectCampaign('camp-auto');
    await rig.settle();
    expect(dm.peer.view!.campaign?.campaignId).toBe('camp-auto');
  });
});
