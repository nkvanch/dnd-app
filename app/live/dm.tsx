// app/live/dm.tsx
// DM LIVE SESSION. Requires the DM capability (assigned by the Host); being the Host is not enough.
// Prepared content stays inert until activated here. Secret effect identity is joined in from the
// DM's local vault and never leaves this device.
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { useSessionRuntime, getSessionRuntime } from '../../src/session/runtime';
import { CampaignPrep } from '../../src/session/prep';
import { describeDuration, describeEffectComponent } from '../../src/session/prepEdit';
import { describeChanges } from '../../src/session/roles';
import { LiveScreen, Section, Card, Btn, Chip, Row, Badge, Muted, Body, NotCapable } from '../../src/components/live/LiveUi';
import { Alert } from '../../src/utils/alert';

export default function DmLiveScreen() {
  const router = useRouter();
  const rt = useSessionRuntime();
  const runtime = getSessionRuntime();
  const peer = runtime.currentPeer;
  const [campaigns, setCampaigns] = useState<{ campaignId: string; name: string; campaignRevision: number }[]>([]);
  const [prep, setPrep] = useState<CampaignPrep | null>(null);
  const [targets, setTargets] = useState<string[]>([]);
  const [applyingFx, setApplyingFx] = useState<string | null>(null);
  const [requestingTpl, setRequestingTpl] = useState<string | null>(null);

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

  return (
    <LiveScreen title="DM" subtitle={view?.campaign ? `Campaign: ${view.campaign.name}` : 'No campaign linked yet'}>
      <Card testID="dm-status">
        <Row wrap>
          <Badge label={rt.status} tone={offline ? 'warn' : 'good'} />
          <Badge label={`revision ${view?.revision ?? 0}`} />
          {view?.ended && <Badge label="session ended" tone="bad" />}
        </Row>
        {offline && <Muted>You are disconnected. Your preparation is safe on this device; reconnect to keep playing.</Muted>}
        {offline && rt.mode === 'joined' && <Btn small label="Reconnect" kind="ghost" onPress={() => { void runtime.reconnect(); }} testID="dm-reconnect" />}
        <Muted>Players: {players.map(p => `${p.nickname}${p.connected ? '' : ' (offline)'}`).join(', ') || 'none yet'}</Muted>
      </Card>

      <Section title="Campaign" hint="Link one of your prepared campaigns to this Host's session. Nothing prepared becomes live by linking.">
        {campaigns.length === 0 && (
          <Card tone="warn"><Body>No prepared campaigns yet.</Body>
            <Btn small label="Open DM preparation" onPress={() => router.push('/live/prepare')} testID="dm-open-prepare" /></Card>
        )}
        {campaigns.map(c => (
          <Card key={c.campaignId} testID={`dm-campaign-${c.name}`}>
            <Row wrap><Body bold>{c.name}</Body>{linked === c.campaignId && <Badge label="linked" tone="good" />}<Muted>prep rev {c.campaignRevision}</Muted></Row>
            <Btn small label={linked === c.campaignId ? 'Re-link (send latest name)' : 'Use this campaign'} disabled={offline}
              onPress={() => run(() => peer.selectCampaign(c.campaignId))} testID={`dm-link-${c.name}`} />
          </Card>
        ))}
      </Section>

      {prep && (
        <Section title="Prepared (not live yet)" hint="Activate a piece to make it live. Prepared items are never sent until you do.">
          {prep.encounters.map(e => (
            <Card key={e.id} testID={`dm-prepared-encounter-${e.name}`}>
              <Body bold>⚔ {e.name}</Body>
              <Muted>{e.combatants.filter(c => !c.hidden).map(c => c.name).join(', ') || 'no visible combatants'}</Muted>
              <Btn small label="Start encounter" disabled={offline} onPress={() => run(() => peer.activateEncounter(prep.campaignId, e.id))} testID={`dm-start-${e.name}`} />
            </Card>
          ))}
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
          {prep.templates.map(t => (
            <Card key={t.id} testID={`dm-prepared-template-${t.label}`}>
              <Body bold>✎ {t.label}</Body>
              <Muted>{describeChanges(t.changes)}</Muted>
              {requestingTpl === t.id ? (
                <>
                  <Muted>Send to:</Muted>
                  <Row wrap>{players.map(p => (
                    <Chip key={p.id} label={p.nickname} active={false} testID={`dm-request-to-${p.nickname}`}
                      onPress={() => { run(() => peer.requestChangeFromTemplate(prep.campaignId, t.id, p.id)); setRequestingTpl(null); }} />
                  ))}</Row>
                  <Btn small kind="ghost" label="Cancel" onPress={() => setRequestingTpl(null)} />
                </>
              ) : (
                <Btn small label="Request change…" disabled={offline || players.length === 0} onPress={() => setRequestingTpl(t.id)} testID={`dm-request-${t.label}`} />
              )}
            </Card>
          ))}
          {prep.encounters.length + prep.effects.length + prep.templates.length === 0 && <Muted>This campaign has no prepared pieces yet.</Muted>}
        </Section>
      )}

      <Section title="Live now">
        {Object.values(view?.encounters ?? {}).filter(e => e.active).map(e => (
          <Card key={e.id} testID={`dm-live-encounter-${e.name}`}>
            <Body bold>⚔ {e.name} (live)</Body>
            <Muted>{e.combatants.map(c => c.name).join(', ')}</Muted>
            <Btn small kind="danger" label="End encounter" disabled={offline} onPress={() => run(() => peer.endEncounter(e.id))} testID={`dm-end-encounter-${e.name}`} />
          </Card>
        ))}

        {peer.dmEffects().map(({ effectId, displayName, secret, effect }) => (
          <Card key={effectId} tone={effect.definition.visibility === 'secret' ? 'secret' : 'default'} testID={`dm-live-effect-${displayName}`}>
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
        ))}
        {peer.dmEffects().some(e => Object.values(e.effect.applications).some(a => a.remaining !== null && a.state === 'ACTIVE')) && (
          <Btn small kind="ghost" label="Pass 1 round" disabled={offline} onPress={() => run(() => peer.tickRounds(1))} testID="dm-tick" />
        )}

        {Object.values(view?.requests ?? {}).map(r => (
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

      <Section title="Party">
        {Object.values(view?.characters ?? {}).map(c => (
          <Card key={c.participantId} testID={`dm-party-${c.summary.name}`}>
            <Body bold>{c.summary.name}</Body>
            <Muted>{nameOf(c.participantId)} · HP {c.summary.hp}/{c.summary.maxHp} · AC {c.summary.ac}</Muted>
          </Card>
        ))}
        {Object.keys(view?.characters ?? {}).length === 0 && <Muted>No character has reported in yet.</Muted>}
      </Section>

      <Section title="Session log">
        {(view?.audit ?? []).slice(-12).reverse().map((a, i) => <Muted key={`${a.revision}-${i}`}>#{a.revision} {a.text}</Muted>)}
      </Section>
    </LiveScreen>
  );
}
