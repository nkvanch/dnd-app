// Rule suggestions (DM_SCREEN_SPEC.md item 5). Deliberately a structured proposal/decision
// record, not an auto-applying rule patcher — see RuleSuggestion's own doc comment in types.ts
// for why. Visibility mirrors ChangeRequest exactly: the DM sees every suggestion, a Player sees
// only their own.
import { newRig, addDm, addPlayer } from '../testing/harness';

describe('player.suggest_rule / peer.suggestRule', () => {
  it('creates a PENDING suggestion visible to the DM and the suggesting player', async () => {
    const rig = await newRig();
    const dm = await addDm(rig);
    const alice = await addPlayer(rig, 'alice');
    alice.peer.suggestRule('Flanking', 'Grant advantage when flanking', 'Speeds up combat');
    await rig.settle();

    const sug = Object.values(dm.peer.view!.ruleSuggestions)[0];
    expect(sug).toMatchObject({ rule: 'Flanking', proposedValue: 'Grant advantage when flanking', note: 'Speeds up combat', status: 'PENDING', dmResponse: null });
    expect(Object.values(alice.peer.view!.ruleSuggestions)[0]).toMatchObject({ rule: 'Flanking', status: 'PENDING' });
  });

  it('is invisible to an uninvolved player', async () => {
    const rig = await newRig();
    await addDm(rig);
    const alice = await addPlayer(rig, 'alice');
    const bob = await addPlayer(rig, 'bob');
    alice.peer.suggestRule('Critical hit table', 'Use the expanded table', '');
    await rig.settle();
    expect(Object.keys(bob.peer.view!.ruleSuggestions)).toHaveLength(0);
  });

  it('a note defaults to an empty string when not given', async () => {
    const rig = await newRig();
    const dm = await addDm(rig);
    const alice = await addPlayer(rig, 'alice');
    alice.peer.suggestRule('Short rests', 'Allow a short rest once per hour');
    await rig.settle();
    expect(Object.values(dm.peer.view!.ruleSuggestions)[0].note).toBe('');
  });
});

describe('dm.resolve_rule_suggestion / peer.resolveRuleSuggestion', () => {
  async function suggested() {
    const rig = await newRig();
    const dm = await addDm(rig);
    const alice = await addPlayer(rig, 'alice');
    alice.peer.suggestRule('Flanking', 'Grant advantage when flanking', '');
    await rig.settle();
    const suggestionId = Object.keys(rig.host.debugState().ruleSuggestions)[0];
    return { rig, dm, alice, suggestionId };
  }

  it('accept resolves to ACCEPTED with no dmResponse, visible to the suggesting player', async () => {
    const { rig, dm, alice, suggestionId } = await suggested();
    dm.peer.resolveRuleSuggestion(suggestionId, 'accept');
    await rig.settle();
    expect(rig.host.debugState().ruleSuggestions[suggestionId]).toMatchObject({ status: 'ACCEPTED', dmResponse: null });
    expect(Object.values(alice.peer.view!.ruleSuggestions)[0]).toMatchObject({ status: 'ACCEPTED' });
  });

  it('modify requires and stores dmResponse, resolving to MODIFIED', async () => {
    const { rig, dm, alice, suggestionId } = await suggested();
    dm.peer.resolveRuleSuggestion(suggestionId, 'modify', 'Advantage only if BOTH allies are adjacent');
    await rig.settle();
    const sug = rig.host.debugState().ruleSuggestions[suggestionId];
    expect(sug.status).toBe('MODIFIED');
    expect(sug.dmResponse).toBe('Advantage only if BOTH allies are adjacent');
    expect(Object.values(alice.peer.view!.ruleSuggestions)[0].dmResponse).toBe('Advantage only if BOTH allies are adjacent');
  });

  it('reject resolves to REJECTED with no dmResponse', async () => {
    const { rig, dm, suggestionId } = await suggested();
    dm.peer.resolveRuleSuggestion(suggestionId, 'reject');
    await rig.settle();
    expect(rig.host.debugState().ruleSuggestions[suggestionId]).toMatchObject({ status: 'REJECTED', dmResponse: null });
  });

  it('modify without a dmResponse is rejected by the Host', async () => {
    const { rig, dm, suggestionId } = await suggested();
    const opId = dm.peer.resolveRuleSuggestion(suggestionId, 'modify');
    await rig.settle();
    expect(dm.peer.resultOf(opId)?.status).toBe('rejected');
  });

  it('cannot be resolved twice', async () => {
    const { rig, dm, suggestionId } = await suggested();
    dm.peer.resolveRuleSuggestion(suggestionId, 'accept');
    await rig.settle();
    const second = dm.peer.resolveRuleSuggestion(suggestionId, 'reject');
    await rig.settle();
    expect(dm.peer.resultOf(second)?.status).toBe('rejected');
  });

  it('rejects an unknown suggestion id', async () => {
    const rig = await newRig();
    const dm = await addDm(rig);
    const opId = dm.peer.resolveRuleSuggestion('not-real', 'accept');
    await rig.settle();
    expect(dm.peer.resultOf(opId)?.status).toBe('rejected');
  });
});

describe('visibility: a Host-only participant sees none of this', () => {
  it('rule suggestions are absent from the Host-only view', async () => {
    const rig = await newRig();
    await addDm(rig);
    const alice = await addPlayer(rig, 'alice');
    alice.peer.suggestRule('Flanking', 'Grant advantage', '');
    await rig.settle();
    expect(rig.hostPeer.view!.ruleSuggestions).toEqual({});
  });
});
