// Spec steps F-AM on a real phone: the PHONE is the DM. Host and Players run on the PC over real
// TCP (through a fault proxy) using the production session code. Node-side assertions inspect the
// authoritative Host state and the raw bytes each Player actually received.
import { projectState } from '../../../src/session/state';
import { Flow, FlowCtx, joinSession, openLiveHub, waitUntil } from './common';

const PLAYER_SECRETS = ['Hidden Curse', 'DMONLY', 'amulet', 'reveal at level 5', 'until remove curse'];
const HOST_FORBIDDEN = ['automation fixture note', 'the troll', 'doppelganger', 'ransom letter', 'Hidden Curse', 'amulet is cursed'];

function converged(ctx: FlowCtx, who: string): boolean {
  const t = ctx.table!;
  const p = t.players.get(who)!;
  const st = t.state();
  const expected = projectState(st, { id: who, capabilities: st.participants[who].capabilities });
  return JSON.stringify(p.peer.view) === JSON.stringify(expected);
}

export const dmLive: Flow = {
  name: 'dm-live',
  description: 'F-AM: phone = DM against a Node Host + Players; activation, secrets, change requests, per-target effects, reconnects, Host X -> Host Y',
  table: { policy: 'manual', players: [['alice', 'Alice'], ['bob', 'Bob']], proxyPort: 7744 },
  async run(ctx) {
    const { phone, step, check } = ctx;
    const T = () => ctx.table!;

    await phone.launch();
    await openLiveHub(phone);
    step('fixtures: wipe live-session data, seed the Automation Campaign (test build only)');
    await phone.tap({ id: 'live-open-e2e' });
    await phone.tap({ id: 'e2e-wipe' });
    await phone.assertText('session data wiped');
    await phone.tap({ id: 'e2e-seed-campaign' });
    await phone.assertText('campaign seeded');
    phone.back();

    step('H: DM joins the Host over TCP asking ONLY for DM (Host approves manually)');
    await joinSession(phone, { nick: 'Tater', address: '127.0.0.1', player: false, dm: true });
    await waitUntil(() => Object.values(T().state().participants).some(p => p.requestedDm), 'Host sees the DM request');
    const dmId = Object.values(T().state().participants).find(p => p.requestedDm)!.id;
    check(T().state().participants[dmId].capabilities.length === 0, 'before approval the joiner holds NO capability');
    await phone.assertText('Waiting for the Host to assign you a role');
    check(!phone.visible({ id: 'dm-status' }), 'DM screen is not reachable before approval');
    T().hostPeer.assignCapabilities(dmId, ['dm']);
    await phone.waitFor({ id: 'dm-status' }, 20000);
    check(T().state().participants[dmId].capabilities.join() === 'dm', 'after approval the phone is DM only (not Host, not Player)');

    step('I-J: choose the prepared campaign; nothing prepared is live; Host cannot see DM material');
    await phone.tapUntil({ id: 'dm-link-Automation Campaign' }, { id: 'dm-prepared-encounter-Bridge Ambush' });
    await waitUntil(() => T().state().campaign?.name === 'Automation Campaign', 'campaign linked on the Host');
    check(Object.keys(T().state().encounters).length === 0, 'Bridge Ambush is NOT active after linking');
    check(Object.keys(T().state().effects).length === 0, 'Blessing / Hidden Curse are NOT applied after linking');
    const hostJson = JSON.stringify(T().state());
    for (const f of HOST_FORBIDDEN) check(!hostJson.includes(f), `Host state does not contain "${f}"`);
    await phone.assertPresent({ id: 'dm-prepared-encounter-Bridge Ambush' });

    step('M-N: activate Bridge Ambush; only that content becomes live');
    await phone.tap({ id: 'dm-start-Bridge Ambush' });
    await waitUntil(() => Object.keys(T().state().encounters).length === 1, 'encounter live on the Host');
    await waitUntil(() => Object.keys(T().players.get('alice')!.peer.view!.encounters).length === 1, 'Alice sees the encounter');
    check(!JSON.stringify(T().players.get('alice')!.peer.view).includes('doppelganger'), 'players never receive encounter DM notes');
    await phone.assertPresent({ id: 'dm-live-encounter-Bridge Ambush' });

    step('O-P: Blessing on multiple targets');
    await phone.tapUntil({ id: 'dm-apply-Blessing' }, { id: 'dm-target-Alice' });
    await phone.tap({ id: 'dm-target-Alice' });
    await phone.tap({ id: 'dm-target-Bob' });
    await phone.tap({ id: 'dm-apply-confirm-Blessing' });
    await waitUntil(() => Object.keys(T().state().effects).length === 1, 'Blessing applied');
    const blessingId = Object.keys(T().state().effects)[0];
    check(Object.keys(T().state().effects[blessingId].applications).length === 2, 'Blessing has one application per target');
    await waitUntil(() => T().players.get('bob')!.peer.visibleEffects().length >= 2, 'Bob sees the public Blessing');

    step('Q-R: Hidden Curse on Alice; inspect the serialized payloads Alice actually received');
    await phone.tapUntil({ id: 'dm-apply-Hidden Curse' }, { id: 'dm-target-Alice' });
    await phone.tap({ id: 'dm-target-Alice' });
    await phone.tap({ id: 'dm-apply-confirm-Hidden Curse' });
    await waitUntil(() => Object.keys(T().state().effects).length === 2, 'curse applied');
    const alice = T().players.get('alice')!;
    await waitUntil(() => alice.peer.visibleEffects().some(v => v.label === null), 'Alice receives the mechanics-only curse');
    const aliceWire = alice.wire.received.join('\n');
    const alicePersisted = JSON.stringify(await alice.kv.get('session.peer.alice'));
    for (const s of PLAYER_SECRETS) {
      check(!aliceWire.includes(s), `Alice's raw wire bytes do not contain "${s}"`);
      check(!alicePersisted.includes(s), `Alice's persisted state does not contain "${s}"`);
    }
    check(!JSON.stringify(T().players.get('bob')!.peer.view).includes(Object.keys(T().state().effects)[1]), 'Bob learns nothing about the curse');
    const curseAc = alice.peer.visibleEffects().flatMap(v => v.components).filter(c => c.stat === 'ac').reduce((n, c) => n + c.value, 0);
    check(curseAc === -1, 'the curse still changes Alice\'s AC by -1 (mechanics intact, identity hidden)');
    await phone.assertPresent({ id: 'dm-live-effect-Hidden Curse' });
    await phone.assertPresent({ textContains: 'the amulet is cursed' });        // the DM sees the secret

    step('S-V: Exhaustion Increase request; Alice modifies it to +2 and accepts');
    await phone.tapUntil({ id: 'dm-request-Exhaustion Increase' }, { id: 'dm-request-to-Alice' });
    await phone.tap({ id: 'dm-request-to-Alice' });
    await waitUntil(() => alice.peer.pendingRequests().length === 1, 'Alice receives the request');
    const req = alice.peer.pendingRequests()[0];
    alice.peer.respond(req.id, 'modify', { modified: [{ kind: 'exhaustion', delta: 2 }] });
    await waitUntil(() => T().state().requests[req.id].status === 'MODIFIED', 'request resolved');
    check(alice.character.exhaustion === 2, 'Alice\'s character received the modified +2 exactly once');
    check(JSON.stringify(T().state().requests[req.id].original) === JSON.stringify([{ kind: 'exhaustion', delta: 1 }]), 'the original +1 proposal is preserved');
    await phone.assertPresent({ textContains: 'Player changed it to: Exhaustion +2' });
    await phone.assertPresent({ textContains: 'Requested: Exhaustion +1' });

    step('W-Z: Blessing due to end for Alice, end Alice only; Bob stays affected');
    await phone.tap({ id: 'dm-due-Blessing-Alice' });
    await waitUntil(() => T().state().effects[blessingId].applications[`${blessingId}:alice`].state === 'DUE_TO_END', 'due to end');
    check(T().state().effects[blessingId].applications[`${blessingId}:alice`].state === 'DUE_TO_END', 'Due to End does not remove the effect');
    await phone.tap({ id: 'dm-end-Blessing-Alice' });
    await waitUntil(() => T().state().effects[blessingId].applications[`${blessingId}:alice`].state === 'ENDED', 'Alice application ended');
    check(T().state().effects[blessingId].applications[`${blessingId}:bob`].state === 'ACTIVE', 'Bob\'s Blessing is still ACTIVE');

    step('AA-AC: Alice disconnects; DM changes live state; Alice reconnects; no duplicates');
    alice.peer.disconnect();
    await waitUntil(() => !T().state().participants.alice.connected, 'Host sees Alice offline');
    await phone.tap({ id: 'dm-tick' });
    await waitUntil(() => T().state().effects[blessingId].applications[`${blessingId}:bob`].remaining === 2, 'a round passed');
    await alice.peer.connect();
    await waitUntil(() => alice.peer.status === 'connected' && alice.peer.view!.revision === T().state().revision, 'Alice caught up');
    check(converged(ctx, 'alice'), 'Alice\'s replica equals the Host\'s authorized projection after reconnect');
    check(Object.keys(alice.peer.view!.requests).length === 1, 'the request appears exactly once');
    check(alice.peer.visibleEffects().filter(v => v.label === null).length === 1, 'the secret curse appears exactly once');

    step('AD-AG: DM link is severed; the DM keeps preparing offline; reconnect keeps the newer preparation');
    T().proxy!.block(true);
    await phone.assertPresent({ textContains: 'You are disconnected' }, 40000);
    await phone.tap({ id: 'live-back' });                                       // to the hub
    await phone.tap({ id: 'live-open-prepare' });
    await phone.tap({ id: 'prep-open-Automation Campaign' });
    await phone.tap({ id: 'prep-add-note' });
    await phone.typeInto({ id: 'prep-note-text' }, 'edited while disconnected');
    await phone.tap({ id: 'prep-note-save' });
    await phone.assertPresent({ textContains: 'dited while disconnected' });
    T().proxy!.block(false);
    await phone.tap({ id: 'live-back' });                                       // back to the hub
    await phone.tap({ id: 'live-open-dm' });
    try {
      await waitUntil(() => T().state().participants[dmId].connected, 'DM auto-reconnected', 20000);
    } catch {
      await phone.tap({ id: 'dm-reconnect' });                                  // retries were exhausted while offline: manual Reconnect
      await waitUntil(() => T().state().participants[dmId].connected, 'DM reconnected to the Host', 30000);
    }
    await phone.assertPresent({ textContains: 'prep rev' });
    check(JSON.stringify(T().state()).includes('edited while disconnected') === false, 'offline DM note never reached the Host');

    step('AH-AI: end the session; stop Host X');
    T().hostPeer.endSession();
    await phone.assertPresent({ textContains: 'session ended' }, 30000);
    const hostXSession = T().state().sessionId;

    step('AJ-AM: a brand-new Host Y; the DM joins it and reuses the same campaign');
    await phone.tap({ id: 'live-back' });
    await phone.tap({ id: 'live-leave' });
    await ctx.startTable({ policy: 'auto-first', players: [['carol', 'Carol']], sessionId: 'hostY', proxyPort: 7744 });
    check(T().state().sessionId !== hostXSession, 'Host Y is a different session from Host X');
    await joinSession(phone, { nick: 'Tater', address: '127.0.0.1', player: false, dm: true });
    await phone.waitFor({ id: 'dm-status' }, 30000);
    await phone.tapUntil({ id: 'dm-link-Automation Campaign' }, { id: 'dm-prepared-encounter-Bridge Ambush' });
    await waitUntil(() => T().state().campaign?.name === 'Automation Campaign', 'campaign linked on Host Y');
    check(Object.keys(T().state().encounters).length === 0, 'nothing from Host X followed the DM to Host Y');
    await phone.assertPresent({ textContains: 'prep rev' });
    await phone.tap({ id: 'dm-start-Bridge Ambush' });      // one tap: starting an encounter is not idempotent by design
    await waitUntil(() => Object.keys(T().state().encounters).length === 1, 'encounter re-activated on Host Y');
    check(!JSON.stringify(T().state()).includes('hostX') && !JSON.stringify(T().state()).includes(hostXSession), 'Host Y carries no Host X identity');
  },
};
