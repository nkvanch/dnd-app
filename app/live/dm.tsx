// app/live/dm.tsx
// DM LIVE SESSION — the operational cockpit for running a campaign live (DM_SCREEN_SPEC.md).
// Requires the DM capability (assigned by the Host); being the Host is not enough. Prepared
// content stays inert until activated here. Secret effect identity is joined in from the DM's
// local vault and never leaves this device.
//
// Phase 1 (reorganize into tabs, Party Dashboard fast actions, session overview, alerts queue,
// campaign rules quick panel, DM-only notes) and Phase 2 (initiative/turn tracking) are done.
// Phase 3, in progress: Quick Override (item 12) is built below, on the existing dm.apply_effect
// op (peer.applyQuickEffect) — no new wire protocol needed, just a faster UI than pre-authoring
// in DM Preparation. Rule suggestions, monster visibility controls, player-to-player visibility
// ("Public Persona"), and Rewards each need real new wire protocol of their own and are NOT in
// this pass. Full character data isn't available here either — only what a Player's device
// reports (ReportedCharacter.summary: name/hp/maxHp/ac) — so "DM Character View" is scoped to
// that, not a full sheet mirror; disclosed inline rather than silently pretending otherwise.
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { useSessionRuntime, getSessionRuntime } from '../../src/session/runtime';
import { CampaignPrep } from '../../src/session/prep';
import { addNote, describeDuration, describeEffectComponent, parseSignedInt, removeItem } from '../../src/session/prepEdit';
import { describeChanges } from '../../src/session/roles';
import { CharacterChange, LiveEffect, LiveEncounter, PublicParticipant, EffectComponent, EffectDuration } from '../../src/session/types';
import { SessionPeer } from '../../src/session/peer';
import { LiveScreen, Section, Card, Btn, Chip, Field, Row, Badge, Muted, Body, NotCapable } from '../../src/components/live/LiveUi';
import { Alert } from '../../src/utils/alert';

type Tab = 'dashboard' | 'encounter' | 'effects' | 'requests' | 'suggestions' | 'notes';
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
  const [quickOverrideOpen, setQuickOverrideOpen] = useState(false);
  const [modifyingSuggestion, setModifyingSuggestion] = useState<string | null>(null);
  const [modifyText, setModifyText] = useState('');

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
  const ruleSuggestions = Object.values(view?.ruleSuggestions ?? {});
  const pendingSuggestions = ruleSuggestions.filter(s => s.status === 'PENDING');

  const alertCount = pendingRequests.length + dueEffects.length + disconnectedPlayers.length + pendingSuggestions.length;

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
        {(['dashboard', 'encounter', 'effects', 'requests', 'suggestions', 'notes'] as Tab[]).map(t => (
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
              {pendingSuggestions.length > 0 && <Muted>• {pendingSuggestions.length} rule suggestion{pendingSuggestions.length === 1 ? '' : 's'} pending</Muted>}
            </Section>
          )}

          <Section title="Quick Override" hint="A one-off exception without rewriting campaign rules — always shows as 'DM Override' to whoever sees it.">
            {quickOverrideOpen ? (
              <QuickOverrideForm players={players} offline={offline} peer={dmPeer} run={run} onDone={() => setQuickOverrideOpen(false)} />
            ) : (
              <Btn small label="+ Quick Override" onPress={() => setQuickOverrideOpen(true)} testID="dm-quick-override-open" />
            )}
          </Section>

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
              <ActiveEncounterPanel key={e.id} encounter={e} players={players} nameOf={nameOf} offline={offline} peer={dmPeer} run={run} />
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

      {tab === 'suggestions' && (
        <Section title={`Rule suggestions (${pendingSuggestions.length} pending)`} hint="Accepting or modifying records the decision for the table — campaign configuration itself is still edited in DM Preparation.">
          {ruleSuggestions.length === 0 && <Muted>No suggestions yet.</Muted>}
          {ruleSuggestions.map(s => {
            const modifying = modifyingSuggestion === s.id;
            return (
              <Card key={s.id} testID={`dm-suggestion-card-${s.rule}`}>
                <Row wrap><Body bold>{s.rule}</Body><Badge label={s.status.toLowerCase()} tone={s.status === 'ACCEPTED' || s.status === 'MODIFIED' ? 'good' : s.status === 'PENDING' ? 'warn' : 'bad'} /><Muted>from {nameOf(s.playerId)}</Muted></Row>
                <Muted>Proposed: {s.proposedValue}</Muted>
                {!!s.note && <Muted>Note: {s.note}</Muted>}
                {s.dmResponse && <Muted>DM's version: {s.dmResponse}</Muted>}
                {s.status === 'PENDING' && (
                  modifying ? (
                    <>
                      <Field label="Your version" value={modifyText} onChangeText={setModifyText} testID={`dm-suggestion-modify-text-${s.rule}`} />
                      <Row>
                        <Btn small label="Send" disabled={!modifyText.trim() || offline} testID={`dm-suggestion-modify-send-${s.rule}`}
                          onPress={() => { run(() => peer.resolveRuleSuggestion(s.id, 'modify', modifyText.trim())); setModifyingSuggestion(null); setModifyText(''); }} />
                        <Btn small kind="ghost" label="Cancel" onPress={() => setModifyingSuggestion(null)} />
                      </Row>
                    </>
                  ) : (
                    <Row wrap>
                      <Btn small label="Accept" disabled={offline} testID={`dm-suggestion-accept-${s.rule}`} onPress={() => run(() => peer.resolveRuleSuggestion(s.id, 'accept'))} />
                      <Btn small kind="ghost" label="Modify" disabled={offline} testID={`dm-suggestion-modify-${s.rule}`} onPress={() => { setModifyingSuggestion(s.id); setModifyText(s.proposedValue); }} />
                      <Btn small kind="danger" label="Reject" disabled={offline} testID={`dm-suggestion-reject-${s.rule}`} onPress={() => run(() => peer.resolveRuleSuggestion(s.id, 'reject'))} />
                    </Row>
                  )
                )}
              </Card>
            );
          })}
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

// ── Quick Override form (DM_SCREEN_SPEC.md item 12) ───────────────────────────────────────────
// Reuses the existing effect system (dm.apply_effect via peer.applyQuickEffect) — a Quick
// Override IS an effect, just built on the spot instead of pre-authored in DM Preparation.
// Disclosed limit: the effect component model is additive-only (no 'set exact value', so
// "speed becomes 0" isn't representable) and purely numeric (no "advantage on next save" /
// "immunity to one effect" — those stay a label-only override with no mechanical component,
// same as a prepared effect with no stat picked).

const QO_STATS: EffectComponent['stat'][] = ['ac', 'speed', 'initiative', 'save', 'spell_attack', 'spell_dc'];
const QO_STAT_LABEL: Record<EffectComponent['stat'], string> = { ac: 'AC', speed: 'Speed', initiative: 'Initiative', save: 'Saves', spell_attack: 'Spell attack', spell_dc: 'Spell save DC' };

function QuickOverrideForm({ players, offline, peer, run, onDone }: {
  players: PublicParticipant[];
  offline: boolean;
  peer: SessionPeer;
  run: (fn: () => unknown) => void;
  onDone: () => void;
}) {
  const [targets, setTargets] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'target'>('public');
  const [stat, setStat] = useState<EffectComponent['stat'] | null>(null);
  const [value, setValue] = useState('1');
  const [rounds, setRounds] = useState('');

  const n = parseSignedInt(value);
  const r = rounds.trim() ? parseSignedInt(rounds) : null;
  const valid = name.trim().length > 0 && targets.length > 0 && (!stat || n !== null) && (rounds.trim() === '' || (r !== null && r >= 1));

  function toggleTarget(id: string) { setTargets(t => t.includes(id) ? t.filter(x => x !== id) : [...t, id]); }

  function submit() {
    if (!valid) return;
    const components: EffectComponent[] = stat && n !== null ? [{ stat, operation: 'add', value: n }] : [];
    const duration: EffectDuration = r ? { unit: 'rounds', total: r, remaining: r } : { unit: 'manual' };
    run(() => peer.applyQuickEffect({ name: name.trim(), description: description.trim() || undefined, visibility, components, duration }, targets));
    onDone();
  }

  return (
    <Card testID="dm-quick-override-form">
      <Muted>Targets:</Muted>
      <Row wrap>{players.map(p => <Chip key={p.id} label={p.nickname} active={targets.includes(p.id)} onPress={() => toggleTarget(p.id)} testID={`dm-qo-target-${p.nickname}`} />)}</Row>
      <Field label="Label" value={name} onChangeText={setName} placeholder="Blessed Ground" testID="dm-qo-name" />
      <Field label="Note (optional)" value={description} onChangeText={setDescription} placeholder="Why — shown to whoever can see this override" testID="dm-qo-desc" />
      <Row wrap>
        <Chip label="Public" active={visibility === 'public'} onPress={() => setVisibility('public')} testID="dm-qo-vis-public" />
        <Chip label="Target only" active={visibility === 'target'} onPress={() => setVisibility('target')} testID="dm-qo-vis-target" />
      </Row>
      <Muted>Changes a number (optional):</Muted>
      <Row wrap>
        <Chip label="None" active={stat === null} onPress={() => setStat(null)} testID="dm-qo-stat-none" />
        {QO_STATS.map(s => <Chip key={s} label={QO_STAT_LABEL[s]} active={stat === s} onPress={() => setStat(s)} testID={`dm-qo-stat-${s}`} />)}
      </Row>
      {stat && <Field label="Amount (whole number, may be negative)" value={value} onChangeText={setValue} keyboardType="numbers-and-punctuation" testID="dm-qo-value" />}
      <Field label="Duration in rounds (blank = manual)" value={rounds} onChangeText={setRounds} keyboardType="number-pad" testID="dm-qo-rounds" />
      <Row>
        <Btn small label="Apply" disabled={!valid || offline} testID="dm-qo-apply" onPress={submit} />
        <Btn small kind="ghost" label="Cancel" onPress={onDone} />
      </Row>
    </Card>
  );
}

// ── Active encounter panel (initiative/turn tracking — DM_SCREEN_SPEC.md item 6) ─────────────
// No numeric initiative is tracked on the wire; the DM rolls/tracks it at the table and taps
// actors here in the resulting order. turnOrder entries are either a LiveCombatant id or a
// ParticipantId — a player's own character takes a turn too, not just monsters.

function ActiveEncounterPanel({ encounter, players, nameOf, offline, peer, run }: {
  encounter: LiveEncounter;
  players: PublicParticipant[];
  nameOf: (id: string) => string;
  offline: boolean;
  peer: SessionPeer;
  run: (fn: () => unknown) => void;
}) {
  const [settingOrder, setSettingOrder] = useState(false);
  const [orderDraft, setOrderDraft] = useState<string[]>([]);
  const [addingCombatant, setAddingCombatant] = useState(false);
  const [newName, setNewName] = useState('');
  const [newAc, setNewAc] = useState('');

  const actors = [
    ...encounter.combatants.map(c => ({ id: c.id, label: c.name })),
    ...players.map(p => ({ id: p.id, label: p.nickname })),
  ];
  const labelOf = (id: string) => actors.find(a => a.id === id)?.label ?? nameOf(id);
  const toggleDraft = (id: string) => setOrderDraft(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const HP_CYCLE: Record<LiveEncounter['combatants'][number]['hpState'], LiveEncounter['combatants'][number]['hpState']> = {
    healthy: 'bloodied', bloodied: 'down', down: 'healthy',
  };

  return (
    <Card testID={`dm-live-encounter-${encounter.name}`}>
      <Row wrap>
        <Body bold>⚔ {encounter.name} (live)</Body>
        {encounter.currentTurnIndex !== null && <Badge label={`Round ${encounter.round}`} tone="good" />}
      </Row>

      {encounter.turnOrder.length > 0 ? (
        <>
          <Row wrap>
            {encounter.turnOrder.map((id, i) => (
              <Badge key={id} label={`${i === encounter.currentTurnIndex ? '▶ ' : ''}${labelOf(id)}`} tone={i === encounter.currentTurnIndex ? 'good' : 'default'} />
            ))}
          </Row>
          <Row wrap>
            <Btn small kind="ghost" label="◂ Previous" disabled={offline} onPress={() => run(() => peer.previousTurn(encounter.id))} testID={`dm-prev-turn-${encounter.name}`} />
            <Btn small label="Next ▸" disabled={offline} onPress={() => run(() => peer.nextTurn(encounter.id))} testID={`dm-next-turn-${encounter.name}`} />
          </Row>
        </>
      ) : (
        <Muted>No turn order set yet.</Muted>
      )}

      {settingOrder ? (
        <>
          <Muted>Tap in turn order (the order you rolled at the table). Tap again to remove.</Muted>
          <Row wrap>
            {actors.map(a => {
              const pos = orderDraft.indexOf(a.id);
              return <Chip key={a.id} label={pos === -1 ? a.label : `${pos + 1}. ${a.label}`} active={pos !== -1} onPress={() => toggleDraft(a.id)} testID={`dm-order-pick-${a.label}`} />;
            })}
          </Row>
          <Row>
            <Btn small label="Set order" disabled={orderDraft.length === 0 || offline} testID={`dm-order-confirm-${encounter.name}`}
              onPress={() => { run(() => peer.setTurnOrder(encounter.id, orderDraft)); setSettingOrder(false); setOrderDraft([]); }} />
            <Btn small kind="ghost" label="Cancel" onPress={() => { setSettingOrder(false); setOrderDraft([]); }} />
          </Row>
        </>
      ) : (
        <Btn small kind="ghost" label={encounter.turnOrder.length > 0 ? 'Change turn order' : 'Set turn order'}
          onPress={() => { setSettingOrder(true); setOrderDraft(encounter.turnOrder); }} testID={`dm-order-open-${encounter.name}`} />
      )}

      <Muted>Combatants:</Muted>
      {encounter.combatants.map(c => (
        <Row wrap key={c.id}>
          <Body>{c.name}</Body>
          <Badge label={c.hpState} tone={c.hpState === 'healthy' ? 'good' : c.hpState === 'bloodied' ? 'warn' : 'bad'} />
          <Btn small kind="ghost" label="Cycle HP" disabled={offline} onPress={() => run(() => peer.setCombatantHpState(encounter.id, c.id, HP_CYCLE[c.hpState]))} testID={`dm-cycle-hp-${c.name}`} />
          <Btn small kind="danger" label="Remove" disabled={offline} onPress={() => run(() => peer.removeCombatant(encounter.id, c.id))} testID={`dm-remove-combatant-${c.name}`} />
        </Row>
      ))}
      {encounter.combatants.length === 0 && <Muted>No combatants left.</Muted>}

      {addingCombatant ? (
        <Row wrap>
          <Field label="Name" value={newName} onChangeText={setNewName} testID={`dm-newcombatant-name-${encounter.name}`} />
          <Field label="AC (optional)" value={newAc} onChangeText={setNewAc} keyboardType="number-pad" testID={`dm-newcombatant-ac-${encounter.name}`} />
          <Btn small label="Add" disabled={!newName.trim() || offline} testID={`dm-newcombatant-confirm-${encounter.name}`}
            onPress={() => {
              const ac = newAc.trim() ? Number(newAc.trim()) : undefined;
              run(() => peer.addCombatant(encounter.id, { id: `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`, name: newName.trim(), ...(ac !== undefined && Number.isFinite(ac) ? { ac } : {}) }));
              setAddingCombatant(false); setNewName(''); setNewAc('');
            }} />
          <Btn small kind="ghost" label="Cancel" onPress={() => setAddingCombatant(false)} />
        </Row>
      ) : (
        <Btn small kind="ghost" label="+ Add combatant" onPress={() => setAddingCombatant(true)} testID={`dm-add-combatant-${encounter.name}`} />
      )}

      <Btn small kind="danger" label="End encounter" disabled={offline} onPress={() => run(() => peer.endEncounter(encounter.id))} testID={`dm-end-encounter-${encounter.name}`} />
    </Card>
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
