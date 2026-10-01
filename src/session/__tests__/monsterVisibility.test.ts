// Monster visibility controls (DM_SCREEN_SPEC.md item 9). Per-field reveal state on each
// combatant, with DM-UI presets (Hidden/Minimal/Standard/Full) over a shared MonsterVisibility
// shape. See state.ts's combatantForPlayer/encounterForPlayer for the redaction logic and
// host.ts's dm.set_combatant_visibility for why a visibility change triggers a full resync
// rather than a narrow event.
import { newRig, addDm, addPlayer, seedPrep } from '../testing/harness';

async function tableWithEncounter() {
  const rig = await newRig();
  const dm = await addDm(rig);
  const alice = await addPlayer(rig, 'alice');
  await seedPrep(dm);
  await dm.peer.selectCampaign('camp-auto');
  await dm.peer.activateEncounter('camp-auto', 'enc-bridge');
  await rig.settle();
  const encounterId = Object.keys(rig.host.debugState().encounters)[0];
  const combatantId = rig.host.debugState().encounters[encounterId].combatants[0].id;
  return { rig, dm, alice, encounterId, combatantId };
}

describe('default visibility matches pre-existing behavior (no regression)', () => {
  it('a freshly-activated combatant defaults to name+hpState+ac visible, exactHp hidden', async () => {
    const { rig, alice, encounterId, combatantId } = await tableWithEncounter();
    const seen = alice.peer.view!.encounters[encounterId].combatants.find(c => c.id === combatantId)!;
    expect(seen.name).not.toBe('Unknown Creature');
    expect(seen.hpState).toBeDefined();
    expect(seen.exactHp).toBeUndefined();
    void rig;
  });

  it('a combatant added mid-encounter also defaults to Standard', async () => {
    const { rig, dm, alice, encounterId } = await tableWithEncounter();
    dm.peer.addCombatant(encounterId, { id: 'second', name: 'Reinforcement', ac: 14 });
    await rig.settle();
    const seen = alice.peer.view!.encounters[encounterId].combatants.find(c => c.id === 'second')!;
    expect(seen.name).toBe('Reinforcement');
    expect(seen.hpState).toBe('healthy');
    expect(seen.ac).toBe(14);
    expect(seen.exactHp).toBeUndefined();
  });
});

describe('dm.set_combatant_visibility', () => {
  it('Hidden preset: name replaced with a placeholder, hpState/ac/exactHp all omitted', async () => {
    const { rig, dm, alice, encounterId, combatantId } = await tableWithEncounter();
    dm.peer.setCombatantVisibility(encounterId, combatantId, { name: false, hpState: false, exactHp: false, ac: false, conditions: false });
    await rig.settle();
    const seen = alice.peer.view!.encounters[encounterId].combatants.find(c => c.id === combatantId)!;
    expect(seen.name).toBe('Unknown Creature');
    expect(seen.hpState).toBeUndefined();
    expect(seen.ac).toBeUndefined();
    expect(seen.exactHp).toBeUndefined();
  });

  it('the DM\'s own view is never redacted, regardless of visibility settings', async () => {
    const { rig, dm, encounterId, combatantId } = await tableWithEncounter();
    dm.peer.setCombatantVisibility(encounterId, combatantId, { name: false, hpState: false, exactHp: false, ac: false, conditions: false });
    await rig.settle();
    const seen = dm.peer.view!.encounters[encounterId].combatants.find(c => c.id === combatantId)!;
    expect(seen.name).not.toBe('Unknown Creature');
    expect(seen.hpState).toBeDefined();
  });

  it('RE-HIDING a field the player already learned actually removes it from their replica (not just future events)', async () => {
    const { rig, dm, alice, encounterId, combatantId } = await tableWithEncounter();
    // Standard already reveals ac; confirm the player has it, then hide everything.
    expect(alice.peer.view!.encounters[encounterId].combatants.find(c => c.id === combatantId)!.ac).toBeDefined();
    dm.peer.setCombatantVisibility(encounterId, combatantId, { name: true, hpState: true, exactHp: false, ac: false, conditions: false });
    await rig.settle();
    const seen = alice.peer.view!.encounters[encounterId].combatants.find(c => c.id === combatantId)!;
    expect(seen.ac).toBeUndefined();   // not still lingering from before the visibility change
  });

  it('REVEALING exact HP retroactively surfaces the real numbers the player never had', async () => {
    const { rig, dm, alice, encounterId, combatantId } = await tableWithEncounter();
    dm.peer.setCombatantExactHp(encounterId, combatantId, 12, 20);   // set while exactHp is still hidden
    await rig.settle();
    expect(alice.peer.view!.encounters[encounterId].combatants.find(c => c.id === combatantId)!.exactHp).toBeUndefined();

    dm.peer.setCombatantVisibility(encounterId, combatantId, { name: true, hpState: true, exactHp: true, ac: true, conditions: true });
    await rig.settle();
    const seen = alice.peer.view!.encounters[encounterId].combatants.find(c => c.id === combatantId)!;
    expect(seen.exactHp).toEqual({ current: 12, max: 20 });   // the resync caught them up
  });

  it('rejects a malformed visibility object', async () => {
    const { rig, dm, encounterId, combatantId } = await tableWithEncounter();
    const opId = dm.peer.sendRaw({ kind: 'dm.set_combatant_visibility', encounterId, combatantId, visibility: { name: 'yes' } as never });
    await rig.settle();
    expect(dm.peer.resultOf(opId)?.status).toBe('rejected');
  });

  it('rejects an unknown combatant', async () => {
    const { rig, dm, encounterId } = await tableWithEncounter();
    const opId = dm.peer.setCombatantVisibility(encounterId, 'nope', { name: true, hpState: true, exactHp: true, ac: true, conditions: true });
    await rig.settle();
    expect(dm.peer.resultOf(opId)?.status).toBe('rejected');
  });
});

describe('dm.set_combatant_exact_hp', () => {
  it('sets real numbers, delivered live to a player who can already see exactHp', async () => {
    const { rig, dm, alice, encounterId, combatantId } = await tableWithEncounter();
    dm.peer.setCombatantVisibility(encounterId, combatantId, { name: true, hpState: true, exactHp: true, ac: true, conditions: true });
    await rig.settle();
    dm.peer.setCombatantExactHp(encounterId, combatantId, 8, 20);
    await rig.settle();
    expect(alice.peer.view!.encounters[encounterId].combatants.find(c => c.id === combatantId)!.exactHp).toEqual({ current: 8, max: 20 });
  });

  it('rejects current > max, negative current, or max < 1', async () => {
    const { rig, dm, encounterId, combatantId } = await tableWithEncounter();
    for (const [current, max] of [[21, 20], [-1, 20], [0, 0]]) {
      const opId = dm.peer.setCombatantExactHp(encounterId, combatantId, current, max);
      await rig.settle();
      expect(dm.peer.resultOf(opId)?.status).toBe('rejected');
    }
  });
});

describe('incremental event redaction, not just full-snapshot redaction', () => {
  it('combatant_added is redacted for a player even when visibility is non-standard', async () => {
    // Exercise the EVENT path (not projectState) by adding a combatant AFTER a player is already
    // connected and receiving live events, matching a realistic "reinforcements arrive" moment.
    const rig = await newRig();
    const dm = await addDm(rig);
    const alice = await addPlayer(rig, 'alice');
    await seedPrep(dm);
    await dm.peer.selectCampaign('camp-auto');
    await dm.peer.activateEncounter('camp-auto', 'enc-bridge');
    await rig.settle();
    const encounterId = Object.keys(rig.host.debugState().encounters)[0];

    dm.peer.addCombatant(encounterId, { id: 'sneaky', name: 'Assassin' });
    await rig.settle();
    dm.peer.setCombatantVisibility(encounterId, 'sneaky', { name: false, hpState: false, exactHp: false, ac: false, conditions: false });
    await rig.settle();
    const seen = alice.peer.view!.encounters[encounterId].combatants.find(c => c.id === 'sneaky')!;
    expect(seen.name).toBe('Unknown Creature');
  });

  it('combatant_hp_state_set is suppressed entirely for a player when hpState is not visible', async () => {
    const { rig, dm, alice, encounterId, combatantId } = await tableWithEncounter();
    dm.peer.setCombatantVisibility(encounterId, combatantId, { name: true, hpState: false, exactHp: false, ac: false, conditions: false });
    await rig.settle();
    dm.peer.setCombatantHpState(encounterId, combatantId, 'bloodied');
    await rig.settle();
    expect(alice.peer.view!.encounters[encounterId].combatants.find(c => c.id === combatantId)!.hpState).toBeUndefined();
    // but it DID really change on the canonical Host/DM side
    expect(rig.host.debugState().encounters[encounterId].combatants.find(c => c.id === combatantId)!.hpState).toBe('bloodied');
  });
});

describe('visibility: a Host-only participant sees none of this', () => {
  it('combatants are absent from the Host-only view regardless of per-field visibility', async () => {
    const { rig } = await tableWithEncounter();
    expect(rig.hostPeer.view!.encounters).toEqual({});
  });
});

// Monster conditions (DM_SCREEN_SPEC.md items 6/9) — gated by the SAME MonsterVisibility.conditions
// flag as hpState/ac/exactHp, deliberately NOT routed through the Effect/EffectApplication system
// (see LiveCombatant.conditions's own doc comment in types.ts for why).
describe('dm.set_combatant_conditions', () => {
  it('a player who can see conditions (Standard preset) sees them live', async () => {
    const { rig, dm, alice, encounterId, combatantId } = await tableWithEncounter();
    dm.peer.setCombatantConditions(encounterId, combatantId, ['poisoned', 'prone']);
    await rig.settle();
    expect(alice.peer.view!.encounters[encounterId].combatants.find(c => c.id === combatantId)!.conditions).toEqual(['poisoned', 'prone']);
  });

  it('a player who cannot see conditions never receives them, even though the Host/DM state is real', async () => {
    const { rig, dm, alice, encounterId, combatantId } = await tableWithEncounter();
    dm.peer.setCombatantVisibility(encounterId, combatantId, { name: true, hpState: true, exactHp: false, ac: true, conditions: false });
    await rig.settle();
    dm.peer.setCombatantConditions(encounterId, combatantId, ['poisoned']);
    await rig.settle();
    expect(alice.peer.view!.encounters[encounterId].combatants.find(c => c.id === combatantId)!.conditions).toBeUndefined();
    expect(rig.host.debugState().encounters[encounterId].combatants.find(c => c.id === combatantId)!.conditions).toEqual(['poisoned']);
  });

  it('the DM always sees the real conditions regardless of the visibility flag', async () => {
    const { rig, dm, encounterId, combatantId } = await tableWithEncounter();
    dm.peer.setCombatantVisibility(encounterId, combatantId, { name: true, hpState: true, exactHp: false, ac: true, conditions: false });
    await rig.settle();
    dm.peer.setCombatantConditions(encounterId, combatantId, ['poisoned']);
    await rig.settle();
    expect(dm.peer.view!.encounters[encounterId].combatants.find(c => c.id === combatantId)!.conditions).toEqual(['poisoned']);
  });

  it('setting an empty array clears conditions', async () => {
    const { rig, dm, alice, encounterId, combatantId } = await tableWithEncounter();
    dm.peer.setCombatantConditions(encounterId, combatantId, ['poisoned']);
    await rig.settle();
    dm.peer.setCombatantConditions(encounterId, combatantId, []);
    await rig.settle();
    expect(alice.peer.view!.encounters[encounterId].combatants.find(c => c.id === combatantId)!.conditions).toEqual([]);
  });

  it('rejects a non-array or non-string-element payload', async () => {
    const { rig, dm, encounterId, combatantId } = await tableWithEncounter();
    const opId = dm.peer.sendRaw({ kind: 'dm.set_combatant_conditions', encounterId, combatantId, conditions: [{ bad: true }] as never });
    await rig.settle();
    expect(dm.peer.resultOf(opId)?.status).toBe('rejected');
  });

  it('rejects an unknown combatant', async () => {
    const { rig, dm, encounterId } = await tableWithEncounter();
    const opId = dm.peer.setCombatantConditions(encounterId, 'nope', ['poisoned']);
    await rig.settle();
    expect(dm.peer.resultOf(opId)?.status).toBe('rejected');
  });
});
