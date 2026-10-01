// app/live/dm.tsx
// DM LIVE SESSION — the operational cockpit for running a campaign live (DM_SCREEN_SPEC.md).
// Requires the DM capability (assigned by the Host); being the Host is not enough. Prepared
// content stays inert until activated here. Secret effect identity is joined in from the DM's
// local vault and never leaves this device.
//
// Phase 1 of the spec's 19 subsystems (confirmed with the user): reorganize into tabs, Party
// Dashboard fast actions, session overview, alerts queue, campaign rules quick panel, DM-only
// notes during play. Deliberately NOT in this pass — each needs real new wire protocol beyond
// what Phase 1 scoped: initiative/turn tracking, rule suggestions, monster visibility controls,
// player-to-player visibility ("Public Persona"), Quick Override as its own concept, Rewards.
// Full character data isn't available here either — only what a Player's device reports
// (ReportedCharacter.summary: name/hp/maxHp/ac) — so "DM Character View" is scoped to that, not
// a full sheet mirror; disclosed inline rather than silently pretending otherwise.
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { useSessionRuntime, getSessionRuntime } from '../../src/session/runtime';
import { CampaignPrep } from '../../src/session/prep';
import { addNote, describeDuration, describeEffectComponent, parseSignedInt, removeItem } from '../../src/session/prepEdit';
import { describeChanges } from '../../src/session/roles';
import { CharacterChange, LiveEffect } from '../../src/session/types';
import { SessionPeer } from '../../src/session/peer';
import { LiveScreen, Section, Card, Btn, Chip, Field, Row, Badge, Muted, Body, NotCapable } from '../../src/components/live/LiveUi';
import { Alert } from '../../src/utils/alert';

type Tab = 'dashboard' | 'encounter' | 'effects' | 'requests' | 'notes';
type FastAction = { participantId: string; kind: 'hp_damage' | 'hp_heal' | 'temp_hp' | 'max_hp' };

export default function DmLiveScreen() {
  const router = useRouter();
  const rt = useSessionRuntime();
  const runtime = getSessionRuntime();
  const peer = runtime.currentPeer;
  const [tab, setTab] = useState<Tab>('dashboard');
  const [campaigns, setCampaigns] = useState<{ campaignId: string; name: string; campaignRevision: number }[]>([]);
  const [prep, setPrep] = useState<CampaignPrep | null>(null);
  const [targets, setTargets] = useState<string[]>([]);
  const [applyingFx, setApplyingFx] = useState<string | null>(null);
  const [requestingTpl, setRequestingTpl] = useState<string | null>(null);
  const [expandedChar, setExpandedChar] = useState<string | null>(null);
  const [fastAction, setFastAction] = useState<FastAction | null>(null);
  const [fastAmount, setFastAmount] = useState('');
  const [noteText, setNoteText] = useState('');

  const linked = rt.view?.campaign?.campaignId ?? null;

  useEffect(() => { void runtime.prep.list().then(setCampaigns); }, [runtime]);
  useEffect(() => {
    if (linked) void runtime.prep.load(linked).then(setPrep);
    else setPrep(null);
  }, [linked, runtime, rt.version]);

  if (!rt.capabilities.includes('dm') || !peer) {
    return (
      <LiveScreen title="DM">
        <NotCapable needs="the DM" />
        <Btn label="Open DM preparation (offline)" kind="ghost" onPress={() => router.push('/live/prepare')} />
      </LiveScreen>
    );
  }

  const view = rt.view;
  const participants = Object.values(view?.participants ?? {});
  const players = participants.filter(p => p.capabilities.includes('player'));
  const nameOf = (id: string) => view?.participants[id]?.nickname ?? id;
  const run = (fn: () => unknown) => {
    try { void Promise.resolve(fn()).catch((e: Error) => Alert.alert('Not sent', e.message)); }
    catch (e) { Alert.alert('Not sent', (e as Error).message); }
  };
  const toggleTarget = (id: string) => setTargets(t => t.includes(id) ? t.filter(x => x !== id) : [...t, id]);
  const offline = rt.status !== 'connected';

  const requests = Object.values(view?.requests ?? {});
  const pendingRequests = requests.filter(r => r.status === 'PENDING');
  const staleRequests = pendingRequests.filter(r => r.staleAgainst !== null);
  const dueEffects = peer.dmEffects().flatMap(e => Object.values(e.effect.applications).filter(a => a.state === 'DUE_TO_END'));
  const disconnectedPlayers = players.filter(p => !p.connected);
  const activeEncounter = Object.values(view?.encounters ?? {}).find(e => e.active) ?? null;

  const alertCount = pendingRequests.length + dueEffects.length + disconnectedPlayers.length;

  // Fast-action change requests (DM_SCREEN_SPEC.md item 2) — same consent flow as every other
  // CharacterChange: this sends a request, it does not apply anything unilaterally.
  const dmPeer = peer;    // narrowed non-null above; re-bound so nested arrow functions keep that narrowing
  const openFastAction = (participantId: string, kind: FastAction['kind']) => {
    setFastAction({ participantId, kind }); setFastAmount('');
  };
  const submitFastAction = () => {
    if (!fastAction) return;
    const n = parseSignedInt(fastAmount);
    if (n === null || n === 0) { Alert.alert('Enter a number', 'Type a non-zero amount first.'); return; }
    const target = fastAction.participantId;
    let change: CharacterChange;
    let label: string;
    switch (fastAction.kind) {
      case 'hp_damage': change = { kind: 'hp', delta: -Math.abs(n) }; label = `${Math.abs(n)} damage`; break;
      case 'hp_heal':   change = { kind: 'hp', delta: Math.abs(n) };  label = `Heal ${Math.abs(n)}`; break;
      case 'temp_hp':   change = { kind: 'temp_hp', amount: Math.abs(n) }; label = `${Math.abs(n)} temp HP`; break;
      case 'max_hp':    change = { kind: 'max_hp', delta: n }; label = `Max HP ${n > 0 ? '+' : ''}${n}`; break;
    }
    run(() => dmPeer.requestChange(target, label, [change]));
    setFastAction(null); setFastAmount('');
  };
  const quickKill = (participantId: string) => {
    const current = view?.characters[participantId]?.summary.hp ?? null;
    Alert.alert('Set to 0 HP?', `${nameOf(participantId)} will be sent a request to drop to 0 HP.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Send request', style: 'destructive', onPress: () => {
        run(() => dmPeer.requestChange(participantId, 'Set to 0 HP', [{ kind: 'hp', delta: current !== null ? -current : -9999 }]));
      } },
    ]);
  };
  const exhaustionStep = (participantId: string, delta: number) => {
    run(() => dmPeer.requestChange(participantId, `Exhaustion ${delta > 0 ? '+1' : '-1'}`, [{ kind: 'exhaustion', delta }]));
  };

  return (
    <LiveScreen title="DM" subtitle={view?.campaign ? `Campaign: ${view.campaign.name}` : 'No campaign linked yet'}>
      <Card testID="dm-status">
        <Row wrap>
          <Badge label={rt.status} tone={offline ? 'warn' : 'good'} />
          <Badge label={`revision ${view?.revision ?? 0}`} />
          {view?.ended && <Badge label="session ended" tone="bad" />}
          {alertCount > 0 && <Badge label={`${alertCount} need${alertCount === 1 ? 's' : ''} attention`} tone="warn" />}
          {activeEncounter && <Badge label={`⚔ ${activeEncounter.name}`} tone="good" />}
        </Row>
        {offline && <Muted>You are disconnected. Your preparation is safe on this device; reconnect to keep playing.</Muted>}
        {offline && rt.mode === 'joined' && <Btn small label="Reconnect" kind="ghost" onPress={() => { void runtime.reconnect(); }} testID="dm-reconnect" />}
        <Muted>Players: {players.map(p => `${p.nickname}${p.connected ? '' : ' (offline)'}`).join(', ') || 'none yet'}</Muted>
      </Card>

      <Row wrap>
        {(['dashboard', 'encounter', 'effects', 'requests', 'notes'] as Tab[]).map(t => (
          <Chip key={t} label={t === 'dashboard' ? 'Dashboard' : t[0].toUpperCase() + t.slice(1)} active={tab === t} onPress={() => setTab(t)} testID={`dm-tab-${t}`} />
        ))}
      </Row>

      {tab === 'dashboard' && (
        <>
          {alertCount > 0 && (
            <Section title="Needs attention">
              {pendingRequests.length > 0 && <Muted>• {pendingRequests.length} pending request{pendingRequests.length === 1 ? '' : 's'}{staleRequests.length > 0 ? ` (${staleRequests.length} stale)` : ''}</Muted>}
              {dueEffects.length > 0 && <Muted>• {dueEffects.length} effect{dueEffects.length === 1 ? '' : 's'} due to end</Muted>}
              {disconnectedPlayers.length > 0 && <Muted>• {disconnectedPlayers.map(p => p.nickname).join(', ')} disconnected</Muted>}
            </Section>
          )}

          <Section title="Campaign" hint="Link one of your prepared campaigns to this Host's session. Nothing prepared becomes live by linking.">
            {campaigns.length === 0 && (
              <Card tone="warn"><Body>No prepared campaigns yet.</Body>
                <Btn small label="Open DM preparation" onPress={() => router.push('/live/prepare')} testID="dm-open-prepare" /></Card>
            )}
            {campaigns.map(c => (
              <Card key={c.campaignId} testID={`dm-campaign-${c.name}`}>
                <Row wrap><Body bold>{c.name}</Body>{linked === c.campaignId && <Badge label="linked" tone="good" />}<Muted>prep rev {c.campaignRevision}</Muted></Row>
                <Btn small label={linked === c.campaignId ? 'Re-link (send latest policy)' : 'Use this campaign'} disabled={offline}
                  onPress={() => run(() => peer.selectCampaign(c.campaignId))} testID={`dm-link-${c.name}`} />
              </Card>
            ))}
          </Section>

          {view?.campaign && (
            <Section title="Campaign rules" hint="Read-only here — edit in DM Preparation.">
              <Card>
                <Muted>Ruleset: {view.campaign.rulesetId ?? 'any'}</Muted>
                <Muted>Max level: {view.campaign.maxLevel ?? 'uncapped'}</Muted>
                <Muted>Banned packs: {view.campaign.bannedPackIds.length} · Banned subclasses: {view.campaign.bannedSubclassIds.length} · Required packs: {view.campaign.requiredPacks.length}</Muted>
                <Btn small kind="ghost" label="Edit in DM Preparation" onPress={() => router.push('/live/prepare')} testID="dm-edit-policy" />
              </Card>
            </Section>
          )}

          <Section title="Party">
            {Object.values(view?.characters ?? {}).map(c => {
              const expanded = expandedChar === c.participantId;
              const theirRequests = requests.filter(r => r.targetId === c.participantId);
              const theirEffects = peer.dmEffects().filter(({ effect }) => Object.values(effect.applications).some(a => a.targetId === c.participantId && a.state !== 'ENDED'));
              return (
                <Card key={c.participantId} testID={`dm-party-${c.summary.name}`}>
                  <Row wrap>
                    <Body bold>{c.summary.name}</Body>
                    <Badge label={view?.participants[c.participantId]?.connected ? 'online' : 'offline'} tone={view?.participants[c.participantId]?.connected ? 'good' : 'bad'} />
                  </Row>
                  <Muted>{nameOf(c.participantId)} · HP {c.summary.hp}/{c.summary.maxHp} · AC {c.summary.ac}</Muted>

                  {fastAction?.participantId === c.participantId ? (
                    <Row wrap>
                      <Field label="Amount" value={fastAmount} onChangeText={setFastAmount} keyboardType="numbers-and-punctuation" testID={`dm-fast-amount-${c.summary.name}`} />
                      <Btn small label="Send" disabled={offline} onPress={submitFastAction} testID={`dm-fast-submit-${c.summary.name}`} />
                      <Btn small kind="ghost" label="Cancel" onPress={() => setFastAction(null)} />
                    </Row>
                  ) : (
                    <Row wrap>
                      <Btn small kind="danger" label="Damage" disabled={offline} onPress={() => openFastAction(c.participantId, 'hp_damage')} testID={`dm-damage-${c.summary.name}`} />
                      <Btn small label="Heal" disabled={offline} onPress={() => openFastAction(c.participantId, 'hp_heal')} testID={`dm-heal-${c.summary.name}`} />
                      <Btn small kind="ghost" label="Temp HP" disabled={offline} onPress={() => openFastAction(c.participantId, 'temp_hp')} testID={`dm-temphp-${c.summary.name}`} />
                      <Btn small kind="ghost" label="Max HP" disabled={offline} onPress={() => openFastAction(c.participantId, 'max_hp')} testID={`dm-maxhp-${c.summary.name}`} />
                      <Btn small kind="ghost" label="Exh. +1" disabled={offline} onPress={() => exhaustionStep(c.participantId, 1)} testID={`dm-exh-up-${c.summary.name}`} />
                      <Btn small kind="ghost" label="Exh. -1" disabled={offline} onPress={() => exhaustionStep(c.participantId, -1)} testID={`dm-exh-down-${c.summary.name}`} />
                      <Btn small kind="danger" label="0 HP" disabled={offline} onPress={() => quickKill(c.participantId)} testID={`dm-kill-${c.summary.name}`} />
                    </Row>
                  )}

                  <Btn small kind="ghost" label={expanded ? 'Hide details ▴' : 'Details ▾'} onPress={() => setExpandedChar(expanded ? null : c.participantId)} testID={`dm-expand-${c.summary.name}`} />
                  {expanded && (
                    <>
                      <Muted>Only what this player's device reports is visible here — name, HP, AC. The full character sheet stays on their device.</Muted>
                      {theirEffects.length === 0 && theirRequests.length === 0 && <Muted>No active effects or requests.</Muted>}
                      {theirEffects.map(({ effectId, displayName, effect }) => (
                        <Muted key={effectId}>Effect: {displayName} ({effect.definition.components.map(describeEffectComponent).join(', ') || 'no numeric change'})</Muted>
                      ))}
                      {theirRequests.map(r => <Muted key={r.id}>Request: {r.label} — {r.status.toLowerCase()}</Muted>)}
                    </>
                  )}
                </Card>
              );
            })}
            {Object.keys(view?.characters ?? {}).length === 0 && <Muted>No character has reported in yet.</Muted>}
          </Section>
        </>
      )}

      {tab === 'encounter' && (
        <>
          {prep && (
            <Section title="Prepared encounters" hint="Activate one to make it live. Nothing here is sent until you do.">
              {prep.encounters.map(e => (
                <Card key={e.id} testID={`dm-prepared-encounter-${e.name}`}>
                  <Body bold>⚔ {e.name}</Body>
                  <Muted>{e.combatants.filter(c => !c.hidden).map(c => c.name).join(', ') || 'no visible combatants'}</Muted>
                  <Row wrap>
                    <Btn small label="Start encounter" disabled={offline} onPress={() => run(() => peer.activateEncounter(prep.campaignId, e.id))} testID={`dm-start-${e.name}`} />
                    <Btn small kind="ghost" label="Edit in DM Preparation" onPress={() => router.push('/live/prepare')} />
                  </Row>
                </Card>
              ))}
              {prep.encounters.length === 0 && <Muted>No prepared encounters yet.</Muted>}
            </Section>
          )}
          <Section title="Active encounter">
            {Object.values(view?.encounters ?? {}).filter(e => e.active).map(e => (
              <Card key={e.id} testID={`dm-live-encounter-${e.name}`}>
                <Body bold>⚔ {e.name} (live)</Body>
                <Muted>{e.combatants.map(c => c.name).join(', ')}</Muted>
                <Muted>Initiative/turn tracking isn't built yet — track order at the table for now.</Muted>
                <Btn small kind="danger" label="End encounter" disabled={offline} onPress={() => run(() => peer.endEncounter(e.id))} testID={`dm-end-encounter-${e.name}`} />
              </Card>
            ))}
            {!activeEncounter && <Muted>No active encounter.</Muted>}
          </Section>
        </>
      )}

      {tab === 'effects' && (
        <>
          {prep && prep.effects.length > 0 && (
            <Section title="Prepared effects" hint="Apply one to live targets.">
              {prep.effects.map(f => (
                <Card key={f.id} tone={f.visibility === 'secret' ? 'secret' : 'default'} testID={`dm-prepared-effect-${f.name}`}>
                  <Row wrap><Body bold>✦ {f.name}</Body><Badge label={f.visibility} tone={f.visibility === 'secret' ? 'secret' : 'default'} /></Row>
                  <Muted>{f.components.map(describeEffectComponent).join(', ') || 'no numeric change'} · {describeDuration(f.duration)}</Muted>
                  {applyingFx === f.id ? (
                    <>
                      <Muted>Choose targets:</Muted>
                      <Row wrap>{players.map(p => <Chip key={p.id} label={p.nickname} active={targets.includes(p.id)} onPress={() => toggleTarget(p.id)} testID={`dm-target-${p.nickname}`} />)}</Row>
                      <Row>
                        <Btn small label={`Apply to ${targets.length}`} disabled={targets.length === 0 || offline} testID={`dm-apply-confirm-${f.name}`}
                          onPress={() => { run(() => peer.applyPreparedEffect(prep.campaignId, f.id, targets)); setApplyingFx(null); setTargets([]); }} />
                        <Btn small kind="ghost" label="Cancel" onPress={() => { setApplyingFx(null); setTargets([]); }} />
                      </Row>
                    </>
                  ) : (
                    <Btn small label="Apply…" disabled={offline || players.length === 0} onPress={() => { setApplyingFx(f.id); setTargets([]); }} testID={`dm-apply-${f.name}`} />
                  )}
                </Card>
              ))}
            </Section>
          )}

          <Section title="Public effects">
            {peer.dmEffects().filter(({ effect }) => effect.definition.visibility !== 'secret').map(({ effectId, displayName, effect }) => (
              <EffectCard key={effectId} effectId={effectId} displayName={displayName} secret={null} effect={effect} nameOf={nameOf} offline={offline} peer={peer} run={run} />
            ))}
          </Section>
          <Section title="Secret effects" hint="DM-only identity — players see only the mechanical consequence.">
            {peer.dmEffects().filter(({ effect }) => effect.definition.visibility === 'secret').map(({ effectId, displayName, secret, effect }) => (
              <EffectCard key={effectId} effectId={effectId} displayName={displayName} secret={secret} effect={effect} nameOf={nameOf} offline={offline} peer={peer} run={run} />
            ))}
          </Section>
          {peer.dmEffects().some(e => Object.values(e.effect.applications).some(a => a.remaining !== null && a.state === 'ACTIVE')) && (
            <Btn small kind="ghost" label="Pass 1 round" disabled={offline} onPress={() => run(() => peer.tickRounds(1))} testID="dm-tick" />
          )}
        </>
      )}

      {tab === 'requests' && (
        <Section title={`Requests (${pendingRequests.length} pending)`}>
          {requests.length === 0 && <Muted>No requests sent yet.</Muted>}
          {requests.map(r => (
            <Card key={r.id} tone={r.staleAgainst !== null && r.status === 'PENDING' ? 'warn' : 'default'} testID={`dm-request-card-${r.label}`}>
              <Row wrap><Body bold>{r.label}</Body><Badge label={r.status.toLowerCase()} tone={r.status === 'ACCEPTED' || r.status === 'MODIFIED' ? 'good' : r.status === 'PENDING' ? 'warn' : 'bad'} /><Muted>→ {nameOf(r.targetId)}</Muted></Row>
              <Muted>Requested: {describeChanges(r.original)}</Muted>
              {r.playerModified && <Muted>Player changed it to: {describeChanges(r.playerModified)}</Muted>}
              {r.finalApplied && <Muted>Applied: {describeChanges(r.finalApplied)}{r.acknowledgedStale ? ' (character had changed)' : ''}</Muted>}
              {r.staleAgainst !== null && r.status === 'PENDING' && <Muted>The character changed since you sent this; the player has been told.</Muted>}
              {r.status === 'PENDING' && <Btn small kind="danger" label="Cancel request" disabled={offline} onPress={() => run(() => peer.cancelRequest(r.id))} />}
            </Card>
          ))}
        </Section>
      )}

      {tab === 'notes' && (
        <Section title="DM-only notes" hint="Never sent to the Host or any player. Shared with DM Preparation (offline).">
          {!prep && <Muted>Link a campaign first — notes live with its preparation.</Muted>}
          {prep && prep.notes.map(n => (
            <Card key={n.id}>
              <Body>{n.text}</Body>
              <Btn small kind="danger" label="Remove" onPress={() => { void runtime.prep.edit(prep.campaignId, x => removeItem(x, 'notes', n.id)).then(setPrep); }} />
            </Card>
          ))}
          {prep && (
            <>
              <Field label="New note" value={noteText} onChangeText={setNoteText} placeholder="Reminder, NPC detail, anything…" testID="dm-note-text" />
              <Btn small label="Add note" disabled={!noteText.trim()} testID="dm-note-add"
                onPress={() => {
                  void runtime.prep.edit(prep.campaignId, x => addNote(x, { id: `note_${Date.now().toString(36)}`, text: noteText.trim() })).then(setPrep);
                  setNoteText('');
                }} />
            </>
          )}
        </Section>
      )}

      <Section title="Session log">
        {(view?.audit ?? []).slice(-12).reverse().map((a, i) => <Muted key={`${a.revision}-${i}`}>#{a.revision} {a.text}</Muted>)}
      </Section>
    </LiveScreen>
  );
}

// ── Effect card (shared by the public/secret effect lists) ───────────────────

function EffectCard({ effectId, displayName, secret, effect, nameOf, offline, peer, run }: {
  effectId: string;
  displayName: string;
  secret: { description: string; notes: string } | null;
  effect: LiveEffect;
  nameOf: (id: string) => string;
  offline: boolean;
  peer: SessionPeer;
  run: (fn: () => unknown) => void;
}) {
  return (
    <Card tone={effect.definition.visibility === 'secret' ? 'secret' : 'default'} testID={`dm-live-effect-${displayName}`}>
      <Row wrap>
        <Body bold>{effect.definition.visibility === 'secret' ? '🔒 ' : ''}{displayName}</Body>
        <Badge label={effect.definition.visibility} tone={effect.definition.visibility === 'secret' ? 'secret' : 'default'} />
      </Row>
      {secret && <Muted>DM only: {secret.description}{secret.notes ? ` · ${secret.notes}` : ''}</Muted>}
      <Muted>{effect.definition.components.map(describeEffectComponent).join(', ') || 'no numeric change'}</Muted>
      {Object.values(effect.applications).map(a => (
        <Row wrap key={a.id}>
          <Body>{nameOf(a.targetId)}</Body>
          <Badge label={a.state === 'DUE_TO_END' ? 'due to end' : a.state.toLowerCase()} tone={a.state === 'ACTIVE' ? 'good' : a.state === 'DUE_TO_END' ? 'warn' : 'bad'} />
          {a.remaining !== null && a.state !== 'ENDED' && <Muted>{a.remaining} rd</Muted>}
          {a.state === 'ACTIVE' && <Btn small kind="ghost" label="Due" disabled={offline} onPress={() => run(() => peer.markDue(a.id))} testID={`dm-due-${displayName}-${nameOf(a.targetId)}`} />}
          {a.state !== 'ENDED' && <Btn small kind="danger" label={`End for ${nameOf(a.targetId)}`} disabled={offline} onPress={() => run(() => peer.endEffect(effectId, a.id))} testID={`dm-end-${displayName}-${nameOf(a.targetId)}`} />}
        </Row>
      ))}
      {Object.values(effect.applications).filter(a => a.state !== 'ENDED').length > 1 && (
        <Btn small kind="danger" label="End for everyone" disabled={offline} onPress={() => run(() => peer.endEffect(effectId))} testID={`dm-end-all-${displayName}`} />
      )}
    </Card>
  );
}
