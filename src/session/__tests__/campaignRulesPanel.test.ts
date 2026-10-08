// Campaign Rules quick panel (DM_SCREEN_SPEC.md item 11). Four of these five settings already
// existed fully built on the legacy CampaignRules object (src/engine/houseRules.ts) but were never
// wired to the live session at all; these are fresh fields on CampaignPrep/CampaignPolicy instead
// of a bridge into that legacy object (see CampaignPolicy's own doc comment in
// campaignCompatibility.ts for why). Only ruleSuggestionsEnabled and permanentRewardsAutomatic are
// actually ENFORCED here — monsterHpVisibilityDefault is tested in monsterVisibilityDefault below;
// freeEditAllowed/homebrewNeedsApproval/combatVariants are display-only (see their own doc
// comments) and have nothing to assert beyond "the value round-trips," covered by prep.test.ts's
// existing linking test.
import { newRig, addDm, addPlayer, seedPrep } from '../testing/harness';
import { CampaignPrepRules } from '../prep';

async function tableWithRules(rules: Partial<CampaignPrepRules>) {
  const rig = await newRig();
  const dm = await addDm(rig);
  const alice = await addPlayer(rig, 'alice');
  const prep = await seedPrep(dm);
  await dm.prep.edit(prep.campaignId, p => ({ ...p, rules: { ...p.rules!, ...rules } }));
  await dm.peer.selectCampaign(prep.campaignId);
  await rig.settle();
  return { rig, dm, alice };
}

describe('ruleSuggestionsEnabled (ENFORCED)', () => {
  it('defaults to allowed when no campaign is linked at all', async () => {
    const rig = await newRig();
    const alice = await addPlayer(rig, 'alice');
    const opId = alice.peer.suggestRule('Flanking', 'Grant advantage');
    await rig.settle();
    expect(alice.peer.resultOf(opId)?.status).toBe('applied');
  });

  it('allows suggestions when explicitly enabled', async () => {
    const { rig, alice } = await tableWithRules({ ruleSuggestionsEnabled: true });
    const opId = alice.peer.suggestRule('Flanking', 'Grant advantage');
    await rig.settle();
    expect(alice.peer.resultOf(opId)?.status).toBe('applied');
  });

  it('rejects suggestions when disabled', async () => {
    const { rig, alice } = await tableWithRules({ ruleSuggestionsEnabled: false });
    const opId = alice.peer.suggestRule('Flanking', 'Grant advantage');
    await rig.settle();
    expect(alice.peer.resultOf(opId)).toMatchObject({ status: 'rejected', reason: 'rule-suggestions-disabled' });
  });
});

describe('permanentRewardsAutomatic (ENFORCED)', () => {
  it('defaults to requiring Player approval (PENDING) when no campaign is linked', async () => {
    const rig = await newRig();
    const dm = await addDm(rig);
    const alice = await addPlayer(rig, 'alice');
    const { rewardId } = dm.peer.grantReward(alice.peer.participantId, 'campaign_boon', 'Blessing of the Harbor');
    await rig.settle();
    expect(dm.peer.view!.rewards[rewardId].status).toBe('PENDING');
  });

  it('stays PENDING when the policy requires approval', async () => {
    const { rig, dm, alice } = await tableWithRules({ permanentRewardsAutomatic: false });
    const { rewardId } = dm.peer.grantReward(alice.peer.participantId, 'campaign_boon', 'Blessing of the Harbor');
    await rig.settle();
    expect(dm.peer.view!.rewards[rewardId].status).toBe('PENDING');
  });

  it('auto-resolves to ACCEPTED immediately when the policy applies automatically', async () => {
    const { rig, dm, alice } = await tableWithRules({ permanentRewardsAutomatic: true });
    const { rewardId } = dm.peer.grantReward(alice.peer.participantId, 'campaign_boon', 'Blessing of the Harbor');
    await rig.settle();
    expect(dm.peer.view!.rewards[rewardId].status).toBe('ACCEPTED');
    expect(alice.peer.view!.rewards[rewardId].status).toBe('ACCEPTED');
  });

  it('auto-apply still supersedes the prior tier in the same track', async () => {
    const { rig, dm, alice } = await tableWithRules({ permanentRewardsAutomatic: true });
    const first = dm.peer.grantReward(alice.peer.participantId, 'reward_tier', 'Forge-Blessed I', { tierTrack: 'forge-blessing' });
    await rig.settle();
    expect(dm.peer.view!.rewards[first.rewardId].status).toBe('ACCEPTED');
    const second = dm.peer.grantReward(alice.peer.participantId, 'reward_tier', 'Forge-Blessed II', { tierTrack: 'forge-blessing' });
    await rig.settle();
    expect(dm.peer.view!.rewards[second.rewardId].status).toBe('ACCEPTED');
    expect(dm.peer.view!.rewards[first.rewardId]).toMatchObject({ status: 'SUPERSEDED', supersededBy: second.rewardId });
  });
});

describe('monsterHpVisibilityDefault (ENFORCED)', () => {
  it('a freshly-activated encounter uses the campaign-configured default preset instead of always Standard', async () => {
    const { rig, dm, alice } = await tableWithRules({ monsterHpVisibilityDefault: 'full' });
    await dm.peer.activateEncounter('camp-auto', 'enc-bridge');
    await rig.settle();
    const encounterId = Object.keys(rig.host.debugState().encounters)[0];
    const seen = alice.peer.view!.encounters[encounterId].combatants[0];
    expect(seen.exactHp).toBeUndefined();   // not yet set, but visibility allows it
    expect(rig.host.debugState().encounters[encounterId].combatants[0].visibility).toEqual({ name: true, hpState: true, exactHp: true, ac: true, conditions: true });
  });

  it('a Hidden default means a mid-encounter reinforcement starts fully hidden too', async () => {
    const { rig, dm, alice } = await tableWithRules({ monsterHpVisibilityDefault: 'hidden' });
    await dm.peer.activateEncounter('camp-auto', 'enc-bridge');
    await rig.settle();
    const encounterId = Object.keys(rig.host.debugState().encounters)[0];
    dm.peer.addCombatant(encounterId, { id: 'reinforcement', name: 'Reinforcement' });
    await rig.settle();
    const seen = alice.peer.view!.encounters[encounterId].combatants.find(c => c.id === 'reinforcement')!;
    expect(seen.name).toBe('Unknown Creature');
  });

  it('defaults to Standard when no campaign is linked at all', async () => {
    const rig = await newRig();
    const dm = await addDm(rig);
    await addPlayer(rig, 'alice');
    await seedPrep(dm);
    await dm.peer.activateEncounter('camp-auto', 'enc-bridge');
    await rig.settle();
    const encounterId = Object.keys(rig.host.debugState().encounters)[0];
    expect(rig.host.debugState().encounters[encounterId].combatants[0].visibility).toEqual({ name: true, hpState: true, exactHp: false, ac: true, conditions: true });
  });
});
