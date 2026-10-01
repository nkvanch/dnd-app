// The PHONE is a Player with a real character. The Host and the DM run on the PC over real TCP
// (through a fault proxy). Proves DM change requests (modify), secret-effect isolation on a real
// device, real derived-number changes on the sheet, and exactly-once application across a reconnect.
import { Flow, openLiveHub, waitUntil, joinSession, toTabs } from './common';
import { AUTOMATION_CAMPAIGN_ID } from '../../../src/session/fixtures';
import type { Phone } from '../adb';

const HERO = 'char_e2e_hero';

async function homeStats(phone: Phone): Promise<{ ac: number; hp: string }> {
  await toTabs(phone);
  await phone.tap({ id: 'tab-home' });
  await phone.waitFor({ id: 'home-screen' });
  await phone.pause(600);
  const ac = phone.textBelow('AC');
  const hp = phone.allText().match(/\d+ \/ \d+ HP/)?.[0] ?? '';
  return { ac: Number(ac), hp };
}

export const playerPhone: Flow = {
  name: 'player-phone',
  description: 'phone = Player: change request modified on-device, secret effect hidden but its AC change applied to the real sheet, exactly-once across reconnect',
  table: { policy: 'auto-first', nodeDm: true, proxyPort: 7744 },
  async run(ctx) {
    const { phone, step, check } = ctx;
    const T = () => ctx.table!;
    const dm = () => T().dm!.peer;

    await phone.launch();
    await openLiveHub(phone);
    step('fixtures: wipe live-session data, ensure the Fixture Hero test character exists');
    await phone.tap({ id: 'live-open-e2e' });
    await phone.tap({ id: 'e2e-wipe' });
    await phone.tap({ id: 'e2e-seed-hero' });
    await phone.assertPresent({ textContains: 'Fixture Hero' });
    const before = await homeStats(phone);
    check(before.ac === 10, `Fixture Hero starts with AC 10 (was ${before.ac})`);
    await phone.tap({ id: 'tab-campaigns' });

    step('the phone joins as a PLAYER only, with its character');
    await joinSession(phone, { nick: 'Hero Player', address: '127.0.0.1', player: true, dm: false, character: HERO });
    await phone.waitFor({ id: 'player-status' }, 25000);
    check(true, 'a Player-only device is routed to the Player screen');
    const me = Object.values(T().state().participants).find(p => p.nickname === 'Hero Player')!.id;
    check(T().state().participants[me].capabilities.join() === 'player', 'the phone holds exactly the player capability');
    await waitUntil(() => dm().view?.characters[me] !== undefined, 'DM sees the phone\'s character report');
    check(dm().view!.characters[me].summary.name === 'Fixture Hero', 'the DM sees the character the phone reported');

    step('DM activates an encounter and applies a public Blessing to the phone player');
    await dm().activateEncounter(AUTOMATION_CAMPAIGN_ID, 'enc-bridge');
    await phone.assertPresent({ id: 'player-encounter-Bridge Ambush' });
    const blessing = await dm().applyPreparedEffect(AUTOMATION_CAMPAIGN_ID, 'fx-blessing', [me]);
    await phone.assertPresent({ id: 'player-effect-Blessing' });

    step('DM applies the secret Hidden Curse (AC -1) to the phone player');
    const curse = await dm().applyPreparedEffect(AUTOMATION_CAMPAIGN_ID, 'fx-curse', [me]);
    await phone.assertPresent({ id: 'player-effect-unknown' });
    const screen = phone.allText();
    for (const s of ['Hidden Curse', 'amulet', 'reveal at level 5', 'Cursed']) check(!screen.includes(s), `Player screen does not show "${s}"`);
    const cursed = await homeStats(phone);
    check(cursed.ac === 9, `the secret effect still lowers the REAL sheet AC to 9 (was ${cursed.ac})`);
    check(dm().dmEffects().find(e => e.effectId === curse.effectId)?.displayName === 'Hidden Curse', 'the DM still knows what it is');

    step('DM sends a max-HP request; the phone player MODIFIES it and accepts');
    await toTabs(phone);
    await phone.tap({ id: 'tab-campaigns' });
    await phone.tap({ id: 'live-open-player' });
    const r1 = dm().requestChange(me, 'Curse of the Well', [{ kind: 'max_hp', delta: -4 }]);
    await phone.assertPresent({ id: 'player-request-Curse of the Well' });
    await phone.tap({ id: 'player-modify-Curse of the Well' });
    await phone.typeInto({ id: 'player-modify-amount-0' }, '-2');
    await phone.tap({ id: 'player-modify-submit' });
    await waitUntil(() => dm().view?.requests[r1.requestId]?.status === 'MODIFIED', 'request modified', 30000);
    const rq = dm().view!.requests[r1.requestId];
    check(JSON.stringify(rq.original) === JSON.stringify([{ kind: 'max_hp', delta: -4 }]), 'DM still sees the original -4 proposal');
    check(JSON.stringify(rq.finalApplied) === JSON.stringify([{ kind: 'max_hp', delta: -2 }]), 'and the player\'s final -2');
    const modified = await homeStats(phone);
    check(modified.hp.startsWith('22 / 22'), `the real character now has max HP 22 (24 - 2), got "${modified.hp}"`);

    step('phone loses the network; DM sends another request; reconnect delivers it exactly once');
    T().proxy!.block(true);
    await toTabs(phone);
    await phone.tap({ id: 'tab-campaigns' });
    await phone.tap({ id: 'live-open-player' });
    await phone.assertPresent({ textContains: 'You are offline' }, 40000);
    const r2 = dm().requestChange(me, 'Boon of the Well', [{ kind: 'max_hp', delta: 3 }]);
    T().proxy!.block(false);
    try { await phone.assertPresent({ id: 'player-request-Boon of the Well' }, 45000); }
    catch { await phone.tap({ id: 'player-reconnect' }); await phone.assertPresent({ id: 'player-request-Boon of the Well' }, 30000); }
    check(Object.values(dm().view!.requests).filter(r => r.label === 'Boon of the Well').length === 1, 'exactly one Boon request exists');
    await phone.tap({ id: 'player-accept-Boon of the Well' });
    await waitUntil(() => dm().view?.requests[r2.requestId]?.status === 'ACCEPTED', 'boon accepted', 30000);
    const boosted = await homeStats(phone);
    check(boosted.hp.endsWith('/ 25 HP'), `+3 was applied exactly once to max HP (22 -> 25; current HP is unchanged), got "${boosted.hp}"`);

    step('DM ends the curse: the sheet AC returns to normal');
    dm().endEffect(curse.effectId);
    await waitUntil(() => T().state().effects[curse.effectId].applications[`${curse.effectId}:${me}`].state === 'ENDED', 'curse ended');
    await phone.pause(1500);
    const restored = await homeStats(phone);
    check(restored.ac === 10, `AC is back to 10 after the effect ends (was ${restored.ac})`);
    dm().endEffect(blessing.effectId);

    step('leaving the session removes session effects from the sheet');
    await dm().applyPreparedEffect(AUTOMATION_CAMPAIGN_ID, 'fx-curse', [me]);
    await phone.pause(2500);
    check((await homeStats(phone)).ac === 9, 'a new curse lowers AC again');
    await toTabs(phone);
    await phone.tap({ id: 'tab-campaigns' });
    await phone.tap({ id: 'live-leave' });
    await phone.pause(1500);
    check((await homeStats(phone)).ac === 10, 'AC is back to 10 after leaving the session');
  },
};
