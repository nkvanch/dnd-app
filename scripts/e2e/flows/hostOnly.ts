// The PHONE is a Host-only device (Emulator A in the original topology). A Node DM and Node Players dial
// it over real TCP (`adb forward`). Proves: Host != DM on a real device, protocol-level refusal of forged
// DM ops by the phone's Host core, Host privacy, DM approval, Host restart persistence.
import { Flow, waitUntil } from './common';
import { AUTOMATION_CAMPAIGN_ID } from '../../../src/session/fixtures';

export const hostOnly: Flow = {
  name: 'host-only',
  description: 'phone = Host-only: approve a DM, forged DM ops refused, Host sees no DM material, Host app restart resumes with roles intact',
  table: { policy: 'manual', remote: true },
  async run(ctx) {
    const { phone, step, check } = ctx;
    const T = () => ctx.table!;

    await phone.launch();
    await phone.tap({ id: 'tab-campaigns' });
    await phone.tap({ id: 'campaigns-open-live' });
    step('clean slate for live-session test data (test build fixture)');
    await phone.tap({ id: 'live-open-e2e' });
    await phone.tap({ id: 'e2e-wipe' });
    await phone.assertText('session data wiped');
    phone.back();

    step('F-G: start hosting as HOST ONLY with manual DM approval');
    await phone.typeInto({ id: 'live-nickname' }, 'Hosty');
    await phone.setChip('live-role-host', true);
    await phone.setChip('live-policy-manual', true);
    await phone.tap({ id: 'live-start-hosting' });
    await phone.waitFor({ id: 'host-status' }, 20000);
    check(true, 'a Host-only device is routed to the Host screen');

    step('a DM and two players dial the phone over TCP');
    const dm = await T().addNodeDm('node-dm', 'Node DM', 7743);
    const alice = await T().addPlayer('alice', 'Alice', 7743);
    await T().addPlayer('bob', 'Bob', 7743);
    await phone.assertPresent({ id: 'host-participant-Node DM' });
    await phone.assertPresent({ textContains: 'wants DM' });
    check(dm.peer.capabilities.length === 0, 'the DM holds no capability until the Host approves');
    let forged = dm.peer.sendRaw({ kind: 'dm.select_campaign', campaignId: 'x', name: 'x', campaignRevision: 1 });
    await waitUntil(() => dm.peer.resultOf(forged) !== undefined, 'phone Host answers the unapproved DM op');
    check(dm.peer.resultOf(forged)!.status === 'forbidden', 'the phone Host refuses a DM op from an unapproved participant');

    step('the phone user approves the DM');
    await phone.tap({ id: 'host-approve-dm-Node DM' });
    await waitUntil(() => dm.peer.capabilities.includes('dm'), 'DM approved');
    check(true, 'after approval the DM holds the dm capability and NOT host');
    check(!dm.peer.capabilities.includes('host'), 'the DM did not gain the host capability');

    step('DM runs the table through the phone Host: campaign, encounter, secret effect, change request');
    await dm.peer.selectCampaign(AUTOMATION_CAMPAIGN_ID);
    await dm.peer.activateEncounter(AUTOMATION_CAMPAIGN_ID, 'enc-bridge');
    const fx = await dm.peer.applyPreparedEffect(AUTOMATION_CAMPAIGN_ID, 'fx-curse', ['alice']);
    await dm.peer.applyPreparedEffect(AUTOMATION_CAMPAIGN_ID, 'fx-blessing', ['alice', 'bob']);
    const rq = await dm.peer.requestChangeFromTemplate(AUTOMATION_CAMPAIGN_ID, 'tpl-exh', 'alice');
    await waitUntil(() => alice.peer.pendingRequests().length === 1, 'Alice has the request through the phone Host');
    alice.peer.respond(alice.peer.pendingRequests()[0].id, 'accept');
    await waitUntil(() => alice.character.exhaustion === 1, 'accepted change applied on Alice');
    check(dm.peer.resultOf(fx.opId)?.status === 'applied' && dm.peer.resultOf(rq.opId)?.status === 'applied', 'the phone Host applied every DM op');
    check(!JSON.stringify(alice.wire.received).includes('Hidden Curse'), 'the secret effect identity never crossed the phone Host to the player');

    step('a Player forges a DM op against the phone Host');
    forged = alice.peer.sendRaw({ kind: 'dm.end_effect', effectId: fx.effectId });
    await waitUntil(() => alice.peer.resultOf(forged) !== undefined, 'forged op answered');
    check(alice.peer.resultOf(forged)!.status === 'forbidden', 'the phone Host refuses a DM op from a Player over the real network');

    step('the Host screen shows sessions and roles but NO DM material');
    await phone.assertPresent({ id: 'host-participant-Alice' });
    const hostText = phone.allText();
    for (const s of ['Bridge Ambush', 'Hidden Curse', 'Blessing', 'Exhaustion Increase', 'automation fixture', 'Bandit']) {
      check(!hostText.includes(s), `Host screen does not show "${s}"`);
    }
    await phone.tap({ id: 'live-back' });
    await phone.assertPresent({ id: 'live-open-host' });
    check(!phone.visible({ id: 'live-open-dm' }), 'a Host-only device has no DM screen entry');
    check(!phone.visible({ id: 'live-open-player' }), 'a Host-only device has no Player screen entry');

    step('Host app restart: kill the app, relaunch, resume the hosted session');
    for (const p of [dm.peer, alice.peer, T().players.get('bob')!.peer]) p.disconnect();
    phone.stopApp();
    await phone.launch(false);
    await phone.tap({ id: 'tab-campaigns' });
    await phone.tap({ id: 'campaigns-open-live' });
    await phone.tap({ id: 'live-resume-hosting' });
    await phone.waitFor({ id: 'host-status' }, 20000);
    await dm.peer.connect();
    await alice.peer.connect();
    await waitUntil(() => dm.peer.status === 'connected' && alice.peer.status === 'connected', 'peers reconnect to the restarted Host');
    check(dm.peer.capabilities.includes('dm'), 'the DM kept its role across a Host restart (token + registry persisted)');
    check(alice.peer.view!.requests[rq.requestId].status === 'ACCEPTED', 'the live state (accepted request) survived the Host restart');
    check(Object.keys(alice.peer.view!.effects).length === 2, 'effects survived the Host restart exactly once');

    step('AH: end the session from the phone');
    await phone.tap({ id: 'host-end' });
    await phone.tap({ text: 'END SESSION' });
    await waitUntil(() => alice.peer.view?.ended === true, 'players are told the session ended', 20000);
  },
};
