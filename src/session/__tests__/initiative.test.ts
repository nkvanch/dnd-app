// Initiative/turn tracking (DM_SCREEN_SPEC.md item 6, DM cockpit Phase 2). No numeric initiative
// is tracked on the wire — the DM rolls/tracks it at the table and sends the resulting order,
// which can mix LiveCombatant ids (monsters) and ParticipantIds (a player's own character also
// takes a turn). See host.ts's dm.set_turn_order/next_turn/previous_turn/add_combatant/
// remove_combatant/set_combatant_hp and state.ts's matching reducer cases.
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

describe('dm.set_turn_order', () => {
  it('accepts an order mixing a combatant id and a participant id (a player acts in initiative too)', async () => {
    const { rig, dm, alice, encounterId, combatantId } = await tableWithEncounter();
    dm.peer.setTurnOrder(encounterId, [combatantId, 'alice']);
    await rig.settle();
    expect(rig.host.debugState().encounters[encounterId].turnOrder).toEqual([combatantId, 'alice']);
    expect(alice.peer.view!.encounters[encounterId].turnOrder).toEqual([combatantId, 'alice']);
  });

  it('rejects an unknown id, a duplicate, or an empty order', async () => {
    const { rig, dm, encounterId, combatantId } = await tableWithEncounter();
    const before = rig.host.debugState().encounters[encounterId].turnOrder;
    for (const bad of [['not-a-real-id'], [combatantId, combatantId], []]) {
      const opId = dm.peer.setTurnOrder(encounterId, bad);
      await rig.settle();
      expect(dm.peer.resultOf(opId)?.status).not.toBe('applied');
    }
    expect(rig.host.debugState().encounters[encounterId].turnOrder).toEqual(before);
  });

  it('is rejected for an unknown or inactive encounter', async () => {
    const { dm, rig } = await tableWithEncounter();
    const opId = dm.peer.setTurnOrder('not-an-encounter', ['x']);
    await rig.settle();
    expect(dm.peer.resultOf(opId)?.status).toBe('rejected');
  });
});

describe('dm.next_turn / dm.previous_turn', () => {
  it('next_turn from the unstarted state goes to index 0 without changing the round', async () => {
    const { rig, dm, encounterId, combatantId } = await tableWithEncounter();
    dm.peer.setTurnOrder(encounterId, [combatantId, 'alice']);
    await rig.settle();
    dm.peer.nextTurn(encounterId);
    await rig.settle();
    const enc = rig.host.debugState().encounters[encounterId];
    expect(enc.currentTurnIndex).toBe(0);
    expect(enc.round).toBe(1);
  });

  it('wraps forward past the end: index resets to 0 and the round increments', async () => {
    const { rig, dm, encounterId, combatantId } = await tableWithEncounter();
    dm.peer.setTurnOrder(encounterId, [combatantId, 'alice']);
    await rig.settle();
    dm.peer.nextTurn(encounterId); dm.peer.nextTurn(encounterId); dm.peer.nextTurn(encounterId);
    await rig.settle();
    const enc = rig.host.debugState().encounters[encounterId];
    expect(enc.currentTurnIndex).toBe(0);
    expect(enc.round).toBe(2);
  });

  it('previous_turn wraps backward: index goes to the last entry and the round decrements, floored at 1', async () => {
    const { rig, dm, encounterId, combatantId } = await tableWithEncounter();
    dm.peer.setTurnOrder(encounterId, [combatantId, 'alice']);
    await rig.settle();
    dm.peer.nextTurn(encounterId);                  // round 1, idx 0
    await rig.settle();
    dm.peer.previousTurn(encounterId);               // back to unstarted-equivalent: wraps to last, round floored
    await rig.settle();
    const enc = rig.host.debugState().encounters[encounterId];
    expect(enc.currentTurnIndex).toBe(1);
    expect(enc.round).toBe(1);                       // never goes below round 1
  });

  it('is rejected when no turn order has been set yet', async () => {
    const { rig, dm, encounterId } = await tableWithEncounter();
    const opId = dm.peer.nextTurn(encounterId);
    await rig.settle();
    expect(dm.peer.resultOf(opId)?.status).toBe('rejected');
  });

  it('is visible to the Player, not just the DM', async () => {
    const { rig, dm, alice, encounterId, combatantId } = await tableWithEncounter();
    dm.peer.setTurnOrder(encounterId, [combatantId, 'alice']);
    dm.peer.nextTurn(encounterId);
    await rig.settle();
    expect(alice.peer.view!.encounters[encounterId].currentTurnIndex).toBe(0);
    expect(alice.peer.view!.encounters[encounterId].round).toBe(1);
  });
});

describe('dm.add_combatant / dm.remove_combatant', () => {
  it('adds a new combatant without touching the existing turn order', async () => {
    const { rig, dm, encounterId, combatantId } = await tableWithEncounter();
    dm.peer.setTurnOrder(encounterId, [combatantId]);
    await rig.settle();
    dm.peer.addCombatant(encounterId, { id: 'reinforcement', name: 'Reinforcement' });
    await rig.settle();
    const enc = rig.host.debugState().encounters[encounterId];
    expect(enc.combatants.map(c => c.id)).toContain('reinforcement');
    expect(enc.turnOrder).toEqual([combatantId]);     // the DM places them explicitly via set_turn_order
  });

  it('rejects adding a combatant id that already exists', async () => {
    const { rig, dm, encounterId, combatantId } = await tableWithEncounter();
    const opId = dm.peer.addCombatant(encounterId, { id: combatantId, name: 'Dupe' });
    await rig.settle();
    expect(dm.peer.resultOf(opId)?.status).toBe('rejected');
  });

  it('removing a combatant drops it from both combatants and turnOrder, shifting the current index down when it was earlier', async () => {
    const { rig, dm, encounterId, combatantId } = await tableWithEncounter();
    dm.peer.addCombatant(encounterId, { id: 'second', name: 'Second' });
    await rig.settle();
    dm.peer.setTurnOrder(encounterId, [combatantId, 'second', 'alice']);
    dm.peer.nextTurn(encounterId); dm.peer.nextTurn(encounterId); dm.peer.nextTurn(encounterId);   // null->0->1->2 ('alice')
    await rig.settle();
    expect(rig.host.debugState().encounters[encounterId].currentTurnIndex).toBe(2);

    dm.peer.removeCombatant(encounterId, combatantId);              // removes index 0, before current
    await rig.settle();
    const enc = rig.host.debugState().encounters[encounterId];
    expect(enc.turnOrder).toEqual(['second', 'alice']);
    expect(enc.currentTurnIndex).toBe(1);                           // shifted down, still pointing at 'alice'
  });

  it('removing the last remaining turn-order entry clears currentTurnIndex back to null', async () => {
    const { rig, dm, encounterId, combatantId } = await tableWithEncounter();
    dm.peer.setTurnOrder(encounterId, [combatantId]);
    dm.peer.nextTurn(encounterId);
    await rig.settle();
    dm.peer.removeCombatant(encounterId, combatantId);
    await rig.settle();
    const enc = rig.host.debugState().encounters[encounterId];
    expect(enc.turnOrder).toEqual([]);
    expect(enc.currentTurnIndex).toBeNull();
    expect(enc.combatants.some(c => c.id === combatantId)).toBe(false);   // the fixture's other combatant stays
  });

  it('rejects removing an unknown combatant id', async () => {
    const { rig, dm, encounterId } = await tableWithEncounter();
    const opId = dm.peer.removeCombatant(encounterId, 'nope');
    await rig.settle();
    expect(dm.peer.resultOf(opId)?.status).toBe('rejected');
  });
});

describe('dm.set_combatant_hp', () => {
  it('updates a combatant\'s coarse hp state and is visible to the Player', async () => {
    const { rig, dm, alice, encounterId, combatantId } = await tableWithEncounter();
    dm.peer.setCombatantHpState(encounterId, combatantId, 'bloodied');
    await rig.settle();
    expect(rig.host.debugState().encounters[encounterId].combatants[0].hpState).toBe('bloodied');
    expect(alice.peer.view!.encounters[encounterId].combatants[0].hpState).toBe('bloodied');
  });

  it('rejects an unknown combatant or an invalid hpState value', async () => {
    const { rig, dm, encounterId, combatantId } = await tableWithEncounter();
    const badId = dm.peer.setCombatantHpState(encounterId, 'nope', 'down');
    await rig.settle();
    expect(dm.peer.resultOf(badId)?.status).toBe('rejected');
    const badState = dm.peer.sendRaw({ kind: 'dm.set_combatant_hp', encounterId, combatantId, hpState: 'exploded' as never });
    await rig.settle();
    expect(dm.peer.resultOf(badState)?.status).toBe('rejected');
  });
});

describe('visibility: a Host-only participant sees none of this', () => {
  it('turn order, turn advancement and combatant changes are absent from the Host-only view', async () => {
    const rig = await newRig({ dmPolicy: 'manual' });
    const dm = await addDm(rig);
    rig.hostPeer.assignCapabilities('dm1', ['dm']);
    await rig.settle();
    await seedPrep(dm);
    await dm.peer.selectCampaign('camp-auto');
    await dm.peer.activateEncounter('camp-auto', 'enc-bridge');
    await rig.settle();
    const encounterId = Object.keys(rig.host.debugState().encounters)[0];
    const combatantId = rig.host.debugState().encounters[encounterId].combatants[0].id;
    dm.peer.setTurnOrder(encounterId, [combatantId]);
    dm.peer.nextTurn(encounterId);
    await rig.settle();
    // rig.hostPeer holds only the 'host' capability — a Host-only view of this same encounter.
    expect(rig.hostPeer.view!.encounters).toEqual({});
  });
});
