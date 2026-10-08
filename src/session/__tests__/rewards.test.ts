// Rewards (DM_SCREEN_SPEC.md item 13) — a DM-granted, Player-approved record of a stored
// homebrew feature / resource / proficiency / reward tier / permanent modifier / campaign boon.
// See Reward's own doc comment in types.ts for why this is a structured grant/decision record
// (mirroring RuleSuggestion and ChangeRequest) rather than something that mechanically mutates
// the character sheet over the wire, and why it's always Player-gated rather than auto-applied.
import { newRig, addDm, addPlayer } from '../testing/harness';

describe('dm.grant_reward', () => {
  it('rejects an unknown reward kind', async () => {
    const rig = await newRig();
    const dm = await addDm(rig);
    const alice = await addPlayer(rig, 'alice');
    const opId = dm.peer.sendRaw({ kind: 'dm.grant_reward', rewardId: 'r1', targetId: alice.peer.participantId, rewardKind: 'not_a_kind' as never, label: 'X' });
    await rig.settle();
    expect(dm.peer.resultOf(opId)?.status).toBe('rejected');
  });

  it('rejects a target that is not a player', async () => {
    const rig = await newRig();
    const dm = await addDm(rig);
    const opId = dm.peer.grantReward('host1' as never, 'campaign_boon', 'Favor of the Crown').opId;
    await rig.settle();
    expect(dm.peer.resultOf(opId)?.status).toBe('rejected');
  });

  it('creates a PENDING reward visible to the DM and to the target only', async () => {
    const rig = await newRig();
    const dm = await addDm(rig);
    const alice = await addPlayer(rig, 'alice');
    const bob = await addPlayer(rig, 'bob');
    const { opId, rewardId } = dm.peer.grantReward(alice.peer.participantId, 'homebrew_feature', 'Ember Sight', { description: 'See through smoke and fire.' });
    await rig.settle();
    expect(dm.peer.resultOf(opId)?.status).toBe('applied');

    expect(dm.peer.view!.rewards[rewardId]).toMatchObject({ status: 'PENDING', label: 'Ember Sight', kind: 'homebrew_feature' });
    expect(alice.peer.view!.rewards[rewardId]).toMatchObject({ status: 'PENDING', label: 'Ember Sight' });
    expect(bob.peer.view!.rewards[rewardId]).toBeUndefined();
  });

  it('a Host-only participant sees no rewards at all', async () => {
    const rig = await newRig();
    const dm = await addDm(rig);
    const alice = await addPlayer(rig, 'alice');
    dm.peer.grantReward(alice.peer.participantId, 'resource', 'Extra Ki Point');
    await rig.settle();
    expect(rig.hostPeer.view!.rewards).toEqual({});
  });
});

describe('player.respond_reward', () => {
  it('only the target may respond', async () => {
    const rig = await newRig();
    const dm = await addDm(rig);
    const alice = await addPlayer(rig, 'alice');
    const bob = await addPlayer(rig, 'bob');
    const { rewardId } = dm.peer.grantReward(alice.peer.participantId, 'proficiency', 'Thieves’ Tools');
    await rig.settle();
    const opId = bob.peer.sendRaw({ kind: 'player.respond_reward', rewardId, decision: 'accept' });
    await rig.settle();
    expect(bob.peer.resultOf(opId)?.status).toBe('forbidden');
  });

  it('accept moves it to ACCEPTED for both DM and target', async () => {
    const rig = await newRig();
    const dm = await addDm(rig);
    const alice = await addPlayer(rig, 'alice');
    const { rewardId } = dm.peer.grantReward(alice.peer.participantId, 'campaign_boon', 'Blessing of the Harbor');
    await rig.settle();
    alice.peer.respondReward(rewardId, 'accept');
    await rig.settle();
    expect(dm.peer.view!.rewards[rewardId].status).toBe('ACCEPTED');
    expect(alice.peer.view!.rewards[rewardId].status).toBe('ACCEPTED');
  });

  it('reject carries an optional player note and never applies anything', async () => {
    const rig = await newRig();
    const dm = await addDm(rig);
    const alice = await addPlayer(rig, 'alice');
    const { rewardId } = dm.peer.grantReward(alice.peer.participantId, 'permanent_modifier', '+1 STR');
    await rig.settle();
    alice.peer.respondReward(rewardId, 'reject', 'Not thematic for my character');
    await rig.settle();
    expect(dm.peer.view!.rewards[rewardId]).toMatchObject({ status: 'REJECTED', playerNote: 'Not thematic for my character' });
  });

  it('modify requires a note and records it as the player’s own wording', async () => {
    const rig = await newRig();
    const dm = await addDm(rig);
    const alice = await addPlayer(rig, 'alice');
    const { rewardId } = dm.peer.grantReward(alice.peer.participantId, 'homebrew_feature', 'Ember Sight');
    await rig.settle();
    const badOp = alice.peer.respondReward(rewardId, 'modify');   // no note
    await rig.settle();
    expect(alice.peer.resultOf(badOp)?.status).toBe('rejected');

    alice.peer.respondReward(rewardId, 'modify', 'I’d rather this only work at night');
    await rig.settle();
    expect(dm.peer.view!.rewards[rewardId]).toMatchObject({ status: 'MODIFIED', playerNote: 'I’d rather this only work at night' });
  });

  it('cannot respond twice to the same reward', async () => {
    const rig = await newRig();
    const dm = await addDm(rig);
    const alice = await addPlayer(rig, 'alice');
    const { rewardId } = dm.peer.grantReward(alice.peer.participantId, 'resource', 'Extra Ki Point');
    await rig.settle();
    alice.peer.respondReward(rewardId, 'accept');
    await rig.settle();
    const opId = alice.peer.respondReward(rewardId, 'reject');
    await rig.settle();
    expect(alice.peer.resultOf(opId)?.status).toBe('rejected');
  });
});

describe('dm.cancel_reward', () => {
  it('withdraws a PENDING reward as CANCELLED, visible to the target', async () => {
    const rig = await newRig();
    const dm = await addDm(rig);
    const alice = await addPlayer(rig, 'alice');
    const { rewardId } = dm.peer.grantReward(alice.peer.participantId, 'resource', 'Extra Ki Point');
    await rig.settle();
    dm.peer.cancelReward(rewardId);
    await rig.settle();
    expect(alice.peer.view!.rewards[rewardId].status).toBe('CANCELLED');
  });

  it('cannot cancel an already-resolved reward', async () => {
    const rig = await newRig();
    const dm = await addDm(rig);
    const alice = await addPlayer(rig, 'alice');
    const { rewardId } = dm.peer.grantReward(alice.peer.participantId, 'resource', 'Extra Ki Point');
    await rig.settle();
    alice.peer.respondReward(rewardId, 'accept');
    await rig.settle();
    const opId = dm.peer.cancelReward(rewardId);
    await rig.settle();
    expect(dm.peer.resultOf(opId)?.status).toBe('rejected');
  });
});

describe('tiered rewards (DM_SCREEN_SPEC.md: "replace the previous tier... keep upgrade history")', () => {
  it('accepting a new tier in the same track supersedes the prior accepted tier, which is kept, not deleted', async () => {
    const rig = await newRig();
    const dm = await addDm(rig);
    const alice = await addPlayer(rig, 'alice');
    const first = dm.peer.grantReward(alice.peer.participantId, 'reward_tier', 'Forge-Blessed I', { tierTrack: 'forge-blessing' });
    await rig.settle();
    alice.peer.respondReward(first.rewardId, 'accept');
    await rig.settle();
    expect(dm.peer.view!.rewards[first.rewardId].status).toBe('ACCEPTED');

    const second = dm.peer.grantReward(alice.peer.participantId, 'reward_tier', 'Forge-Blessed II', { tierTrack: 'forge-blessing' });
    await rig.settle();
    alice.peer.respondReward(second.rewardId, 'accept');
    await rig.settle();

    expect(dm.peer.view!.rewards[second.rewardId].status).toBe('ACCEPTED');
    expect(dm.peer.view!.rewards[first.rewardId]).toMatchObject({ status: 'SUPERSEDED', supersededBy: second.rewardId });
    // Still present for the target too — history isn't erased for the player either.
    expect(alice.peer.view!.rewards[first.rewardId].status).toBe('SUPERSEDED');
  });

  it('a different tier track does NOT supersede an unrelated accepted tier', async () => {
    const rig = await newRig();
    const dm = await addDm(rig);
    const alice = await addPlayer(rig, 'alice');
    const forge = dm.peer.grantReward(alice.peer.participantId, 'reward_tier', 'Forge-Blessed I', { tierTrack: 'forge-blessing' });
    await rig.settle();
    alice.peer.respondReward(forge.rewardId, 'accept');
    await rig.settle();

    const tide = dm.peer.grantReward(alice.peer.participantId, 'reward_tier', 'Tide-Bound I', { tierTrack: 'tide-binding' });
    await rig.settle();
    alice.peer.respondReward(tide.rewardId, 'accept');
    await rig.settle();

    expect(dm.peer.view!.rewards[forge.rewardId].status).toBe('ACCEPTED');   // untouched by the unrelated track
    expect(dm.peer.view!.rewards[tide.rewardId].status).toBe('ACCEPTED');
  });

  it('a non-reward_tier kind never supersedes anything, even with a matching tierTrack string', async () => {
    const rig = await newRig();
    const dm = await addDm(rig);
    const alice = await addPlayer(rig, 'alice');
    const tier = dm.peer.grantReward(alice.peer.participantId, 'reward_tier', 'Forge-Blessed I', { tierTrack: 'forge-blessing' });
    await rig.settle();
    alice.peer.respondReward(tier.rewardId, 'accept');
    await rig.settle();

    const feature = dm.peer.grantReward(alice.peer.participantId, 'homebrew_feature', 'Unrelated Feature', { tierTrack: 'forge-blessing' });
    await rig.settle();
    alice.peer.respondReward(feature.rewardId, 'accept');
    await rig.settle();

    expect(dm.peer.view!.rewards[tier.rewardId].status).toBe('ACCEPTED');   // not superseded by a non-tier grant
  });
});
