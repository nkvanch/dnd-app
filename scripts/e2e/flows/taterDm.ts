// The "Tater the Bard" DM workflow (spec 26.8 / Phase 21) as a real-phone acceptance test AND a screen recording.
// The PHONE is the DM. The Host and the two Players are genuine remote peers on the PC. Paced for a <= 170 s
// recording: real behaviour, deliberate pauses on meaningful states, no editing.
import { projectState } from '../../../src/session/state';
import { Flow, FlowCtx, joinSession, toTabs, waitUntil } from './common';

const SECRETS = ['Hidden Curse', 'DMONLY', 'amulet', 'reveal at level 5', 'until remove curse'];

function converged(ctx: FlowCtx, who: string): boolean {
  const t = ctx.table!;
  const st = t.state();
  return JSON.stringify(t.players.get(who)!.peer.view) === JSON.stringify(projectState(st, { id: who, capabilities: st.participants[who].capabilities }));
}

export const taterDm: Flow = {
  name: 'tater-dm-workflow',
  description: 'Tater the Bard: DM prepares offline, connects to a Host, activates prepared content, change request modified by the player, per-target effects, secret effect, reconnect, prep still there',
  table: { policy: 'manual', proxyPort: 7744 },
  async run(ctx) {
    const { phone, step, check } = ctx;
    const T = () => ctx.table!;
    const dwell = (ms = 1600) => phone.pause(ms);

    // ── setup (not the story): fixtures are seeded and the app is started clean before the story begins ──
    await phone.launch();
    await phone.tap({ id: 'tab-campaigns' });
    await phone.tap({ id: 'live-open-e2e' });
    await phone.tap({ id: 'e2e-wipe' });
    await phone.tap({ id: 'e2e-seed-campaign' });
    await phone.assertPresent({ textContains: 'campaign seeded' });
    await toTabs(phone);
    step('SETUP DONE: recording story begins from the Home screen');
    ctx.startRecording();
    await dwell(1200);

    // 1. DM opens Grimoire OFFLINE (no Host exists) and opens the prepared campaign
    step('1-4: OFFLINE: open the prepared Automation Campaign; Bridge Ambush and the effects are prepared');
    await phone.tap({ id: 'tab-campaigns' });
    await dwell();
    await phone.tap({ id: 'live-open-prepare' });
    await phone.tap({ id: 'prep-open-Automation Campaign' });
    await dwell();
    await phone.assertPresent({ id: 'prep-encounter-Bridge Ambush' });
    await dwell(2200);
    await phone.assertPresent({ id: 'prep-effect-Hidden Curse' });                    // prepared secret effect
    await dwell(2200);
    await phone.tap({ id: 'live-back' });                                              // back to the hub

    // 5-6. The Host creates the live session; the DM connects and chooses the prepared campaign
    step('5-6: DM connects to the Host and chooses the prepared campaign');
    await joinSession(phone, { nick: 'Tater', address: '127.0.0.1', player: false, dm: true });
    await waitUntil(() => Object.values(T().state().participants).some(p => p.requestedDm), 'DM request reaches the Host');
    await dwell(1500);
    const dmId = Object.values(T().state().participants).find(p => p.requestedDm)!.id;
    T().hostPeer.assignCapabilities(dmId, ['dm']);                                     // the Host user approves
    await phone.waitFor({ id: 'dm-status' }, 20000);
    await phone.tapUntil({ id: 'dm-link-Automation Campaign' }, { id: 'dm-prepared-encounter-Bridge Ambush' });
    await dwell(2200);                                                                 // 7. prepared, NOT live
    check(Object.keys(T().state().encounters).length === 0, 'the prepared encounter is not live after linking');
    check(!JSON.stringify(T().state()).includes('DMONLY') && !JSON.stringify(T().state()).includes('troll'), 'the Host never received DM notes');

    // 9. Players join; live state appears
    step('9: players join; the DM activates Bridge Ambush');
    await T().addPlayer('alice', 'Alice');
    await T().addPlayer('bob', 'Bob');
    await phone.assertPresent({ textContains: 'Players: Alice, Bob' });
    await dwell(1400);
    // 8. DM activates Bridge Ambush
    await phone.tap({ id: 'dm-start-Bridge Ambush' });      // one tap: starting an encounter is not idempotent by design
    await waitUntil(() => Object.keys(T().state().encounters).length === 1, 'encounter live');
    await dwell(1800);

    // 10-12. Character change request; the player modifies and accepts; the result synchronizes
    step('10-12: request Exhaustion Increase; Alice modifies it; both versions are shown');
    const alice = T().players.get('alice')!;
    await phone.tapUntil({ id: 'dm-request-Exhaustion Increase' }, { id: 'dm-request-to-Alice' });
    await phone.tap({ id: 'dm-request-to-Alice' });
    await waitUntil(() => alice.peer.pendingRequests().length === 1, 'Alice receives the request');
    await dwell(1500);
    const req = alice.peer.pendingRequests()[0];
    alice.peer.respond(req.id, 'modify', { modified: [{ kind: 'exhaustion', delta: 2 }] });
    await phone.assertPresent({ textContains: 'Player changed it to: Exhaustion +2' });
    await dwell(2600);
    check(alice.character.exhaustion === 2, 'the modified +2 was applied to Alice exactly once');

    // 13-16. Multi-target effect, Due to End for one target, end that target only
    step('13-16: Blessing on Alice and Bob; Alice due to end; end for Alice only; Bob stays affected');
    await phone.tapUntil({ id: 'dm-apply-Blessing' }, { id: 'dm-target-Alice' });
    await phone.tap({ id: 'dm-target-Alice' });
    await phone.tap({ id: 'dm-target-Bob' });
    await phone.tap({ id: 'dm-apply-confirm-Blessing' });
    await waitUntil(() => Object.keys(T().state().effects).length === 1, 'Blessing applied');
    const blessing = Object.keys(T().state().effects)[0];
    await dwell(1800);
    await phone.tap({ id: 'dm-due-Blessing-Alice' });
    await dwell(1800);
    await phone.tap({ id: 'dm-end-Blessing-Alice' });
    await waitUntil(() => T().state().effects[blessing].applications[`${blessing}:alice`].state === 'ENDED', 'Alice application ended');
    check(T().state().effects[blessing].applications[`${blessing}:bob`].state === 'ACTIVE', 'Bob\'s Blessing is still active');
    await dwell(2400);

    // 17-19. Secret effect: the DM sees it, the player gets mechanics only
    step('17-19: secret Hidden Curse on Alice; the DM sees the secret, Alice\'s raw payload does not contain it');
    await phone.tapUntil({ id: 'dm-apply-Hidden Curse' }, { id: 'dm-target-Alice' });
    await phone.tap({ id: 'dm-target-Alice' });
    await phone.tap({ id: 'dm-apply-confirm-Hidden Curse' });
    await waitUntil(() => Object.keys(T().state().effects).length === 2, 'curse applied');
    await phone.assertPresent({ textContains: 'the amulet is cursed' });
    await dwell(2600);
    const wire = alice.wire.received.join('\n');
    for (const s of SECRETS) check(!wire.includes(s), `Alice's raw wire bytes do not contain "${s}"`);
    check(!JSON.stringify(alice.peer.view).includes('Hidden Curse'), 'Alice\'s replica does not contain the curse\'s name');

    // 20-23. Player disconnects, DM changes state, player reconnects: state restores without duplicates
    step('20-23: Alice disconnects; the DM passes a round; Alice reconnects; no duplicates');
    alice.peer.disconnect();
    await waitUntil(() => !T().state().participants.alice.connected, 'Host sees Alice offline');
    await phone.assertPresent({ textContains: 'Alice (offline)' });
    await dwell(1600);
    await phone.tap({ id: 'dm-tick' });
    await dwell(1400);
    await alice.peer.connect();
    await waitUntil(() => alice.peer.status === 'connected' && alice.peer.view!.revision === T().state().revision, 'Alice caught up');
    check(converged(ctx, 'alice'), 'Alice\'s replica equals her authorized projection');
    check(Object.keys(alice.peer.view!.requests).length === 1 && alice.peer.visibleEffects().filter(v => v.label === null).length === 1, 'no duplicate requests or effects after reconnect');
    await phone.assertPresent({ textContains: 'Players: Alice, Bob' });
    await dwell(2000);

    // 24. End with the DM's campaign preparation still present
    step('24: the DM\'s preparation is still there');
    await phone.tap({ id: 'live-back' });
    await phone.tap({ id: 'live-open-prepare' });
    await phone.tap({ id: 'prep-open-Automation Campaign' });
    await phone.assertPresent({ id: 'prep-encounter-Bridge Ambush' });
    await dwell(2600);
    check(true, 'preparation persisted after the whole live session');
  },
};
