// Monster resource/recharge tracking (DM_SCREEN_SPEC.md item 6) — always DM-only, no visibility
// flag (unlike conditions/hpState/ac/exactHp): item 9's per-field toggle list never names
// "resources", and this is DM encounter-running bookkeeping, not table-facing information. See
// LiveCombatant.resources's own doc comment in types.ts.
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

describe('dm.set_combatant_resources', () => {
  it('the DM sees resources set on a combatant', async () => {
    const { rig, dm, encounterId, combatantId } = await tableWithEncounter();
    dm.peer.setCombatantResources(encounterId, combatantId, [{ id: 'legendary', name: 'Legendary Actions', current: 3, maximum: 3 }]);
    await rig.settle();
    expect(dm.peer.view!.encounters[encounterId].combatants.find(c => c.id === combatantId)!.resources)
      .toEqual([{ id: 'legendary', name: 'Legendary Actions', current: 3, maximum: 3 }]);
  });

  it('a Player never sees monster resources at all, even though the Host/DM state is real', async () => {
    const { rig, dm, alice, encounterId, combatantId } = await tableWithEncounter();
    dm.peer.setCombatantResources(encounterId, combatantId, [{ id: 'breath', name: 'Breath Weapon', current: 0, maximum: 1 }]);
    await rig.settle();
    expect(alice.peer.view!.encounters[encounterId].combatants.find(c => c.id === combatantId)!.resources).toBeUndefined();
    const bobWire = rig.net.receivedBy('alice').join('\n');
    expect(bobWire).not.toContain('Breath Weapon');
    expect(rig.host.debugState().encounters[encounterId].combatants.find(c => c.id === combatantId)!.resources)
      .toEqual([{ id: 'breath', name: 'Breath Weapon', current: 0, maximum: 1 }]);
  });

  it('a Host-only participant sees no monster resources either', async () => {
    const { rig, dm, encounterId, combatantId } = await tableWithEncounter();
    dm.peer.setCombatantResources(encounterId, combatantId, [{ id: 'legendary', name: 'Legendary Actions', current: 3, maximum: 3 }]);
    await rig.settle();
    expect(rig.hostPeer.view!.encounters).toEqual({});
  });

  it('replacing with an empty array clears all resources', async () => {
    const { rig, dm, encounterId, combatantId } = await tableWithEncounter();
    dm.peer.setCombatantResources(encounterId, combatantId, [{ id: 'legendary', name: 'Legendary Actions', current: 3, maximum: 3 }]);
    await rig.settle();
    dm.peer.setCombatantResources(encounterId, combatantId, []);
    await rig.settle();
    expect(dm.peer.view!.encounters[encounterId].combatants.find(c => c.id === combatantId)!.resources).toEqual([]);
  });

  it('rejects current > maximum, negative current, or maximum < 1', async () => {
    const { rig, dm, encounterId, combatantId } = await tableWithEncounter();
    for (const bad of [
      [{ id: 'x', name: 'X', current: 5, maximum: 3 }],
      [{ id: 'x', name: 'X', current: -1, maximum: 3 }],
      [{ id: 'x', name: 'X', current: 0, maximum: 0 }],
    ]) {
      const opId = dm.peer.setCombatantResources(encounterId, combatantId, bad);
      await rig.settle();
      expect(dm.peer.resultOf(opId)?.status).toBe('rejected');
    }
  });

  it('rejects a malformed resource entry (missing name)', async () => {
    const { rig, dm, encounterId, combatantId } = await tableWithEncounter();
    const opId = dm.peer.sendRaw({ kind: 'dm.set_combatant_resources', encounterId, combatantId, resources: [{ id: 'x', current: 1, maximum: 1 } as never] });
    await rig.settle();
    expect(dm.peer.resultOf(opId)?.status).toBe('rejected');
  });

  it('rejects an unknown combatant', async () => {
    const { rig, dm, encounterId } = await tableWithEncounter();
    const opId = dm.peer.setCombatantResources(encounterId, 'nope', [{ id: 'x', name: 'X', current: 1, maximum: 1 }]);
    await rig.settle();
    expect(dm.peer.resultOf(opId)?.status).toBe('rejected');
  });
});
