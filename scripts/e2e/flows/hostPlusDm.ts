// The PHONE is an explicit Host + DM combination (the classic "one phone runs the table" setup, now a chosen
// combination of two capabilities rather than an implicit identity). A Node Player dials it over TCP.
import { Flow, waitUntil } from './common';

export const hostPlusDm: Flow = {
  name: 'host-plus-dm',
  description: 'phone = Host + DM (explicit): both screens reachable, no Player screen, DM operations work through its own Host, secrets stay out of the player wire',
  table: { policy: 'manual', remote: true },
  async run(ctx) {
    const { phone, step, check } = ctx;
    const T = () => ctx.table!;

    await phone.launch();
    await phone.tap({ id: 'tab-campaigns' });
    step('fixtures: wipe live-session data, seed the Automation Campaign (test build only)');
    await phone.tap({ id: 'live-open-e2e' });
    await phone.tap({ id: 'e2e-wipe' });
    await phone.tap({ id: 'e2e-seed-campaign' });
    await phone.assertPresent({ textContains: 'campaign seeded' });
    phone.back();

    step('start hosting as HOST + DM');
    await phone.typeInto({ id: 'live-nickname' }, 'Tater');
    await phone.tap({ id: 'live-host-campaign' });
    await phone.setChip('live-role-hostdm', true);
    await phone.setChip('live-policy-manual', true);
    await phone.tap({ id: 'live-start-hosting' });
    await phone.waitFor({ id: 'live-open-host' }, 20000);
    check(phone.visible({ id: 'live-open-dm' }), 'a Host + DM device is offered the DM screen');
    check(!phone.visible({ id: 'live-open-player' }), 'and no Player screen (it did not ask to play)');
    check(!phone.visible({ id: 'host-status' }) && !phone.visible({ id: 'dm-status' }), 'two roles: the app lets the user choose instead of guessing');

    step('a Node player joins the phone');
    const alice = await T().addPlayer('alice', 'Alice', 7743);
    await phone.tap({ id: 'live-open-host' });
    await phone.assertPresent({ id: 'host-participant-Alice' });
    phone.back();

    step('the phone DM links its campaign, starts the encounter, applies the secret curse via its own Host');
    await phone.tap({ id: 'live-open-dm' });
    await phone.tapUntil({ id: 'dm-link-Automation Campaign' }, { id: 'dm-prepared-encounter-Bridge Ambush' });
    await phone.tap({ id: 'dm-start-Bridge Ambush' });
    await waitUntil(() => Object.keys(alice.peer.view!.encounters).length === 1, 'Alice sees the encounter through the phone Host');
    await phone.tapUntil({ id: 'dm-apply-Hidden Curse' }, { id: 'dm-target-Alice' });
    await phone.tap({ id: 'dm-target-Alice' });
    await phone.tap({ id: 'dm-apply-confirm-Hidden Curse' });
    await waitUntil(() => alice.peer.visibleEffects().some(v => v.label === null), 'Alice receives the mechanics-only curse');
    const wire = alice.wire.received.join('\n');
    for (const s of ['Hidden Curse', 'DMONLY', 'amulet', 'reveal at level 5']) check(!wire.includes(s), `Alice's wire bytes from the Host + DM phone do not contain "${s}"`);
    check(!wire.includes('the troll') && !wire.includes('doppelganger'), 'encounter DM notes never left the phone');
    await phone.assertPresent({ textContains: 'the amulet is cursed' });

    step('a Player cannot use the Host + DM phone\'s DM capability');
    const forged = alice.peer.sendRaw({ kind: 'dm.end_encounter', encounterId: Object.keys(alice.peer.view!.encounters)[0] });
    await waitUntil(() => alice.peer.resultOf(forged) !== undefined, 'forged op answered');
    check(alice.peer.resultOf(forged)!.status === 'forbidden', 'the phone Host refuses the Player\'s DM op even though the phone itself is a DM');
  },
};
