// app/live/player.tsx
// PLAYER view of a live session: your character, DM change requests (accept / modify / reject),
// the effects you are subject to, and the table's public state. Requires the player capability.
import { useState } from 'react';
import { useSessionRuntime, getSessionRuntime } from '../../src/session/runtime';
import { describeChanges } from '../../src/session/roles';
import { describeEffectComponent, parseSignedInt } from '../../src/session/prepEdit';
import { ChangeRequest, CharacterChange } from '../../src/session/types';
import { LiveScreen, Section, Card, Btn, Field, Row, Badge, Muted, Body, NotCapable } from '../../src/components/live/LiveUi';
import { Alert } from '../../src/utils/alert';

// temp_hp carries `amount` (never negative, 5e doesn't stack it); every other kind carries
// `delta`. These two keep the editor below generic over both instead of assuming `.delta` everywhere.
function amountOf(c: CharacterChange): number { return c.kind === 'temp_hp' ? c.amount : c.delta; }
function withAmount(c: CharacterChange, n: number): CharacterChange { return c.kind === 'temp_hp' ? { ...c, amount: n } : { ...c, delta: n }; }

/** Re-uses the DM's change kinds but lets the player edit each amount. */
function ModifyEditor({ request, onSubmit, onCancel }: {
  request: ChangeRequest; onSubmit: (changes: CharacterChange[]) => void; onCancel: () => void;
}) {
  const [amounts, setAmounts] = useState<string[]>(request.original.map(c => String(amountOf(c))));
  const parsed = amounts.map(parseSignedInt);
  const valid = parsed.every((n, i) => n !== null && (request.original[i].kind === 'temp_hp' ? n >= 0 : n !== 0));
  return (
    <Card testID="player-modify-editor">
      <Muted>Change the amounts, then accept your version. The DM sees both.</Muted>
      {request.original.map((c, i) => (
        <Field key={i} label={describeChanges([withAmount(c, 0)]).replace(/ [+-]?0$/, '')} value={amounts[i]}
          onChangeText={t => setAmounts(a => a.map((x, j) => j === i ? t : x))}
          keyboardType="numbers-and-punctuation" testID={`player-modify-amount-${i}`} />
      ))}
      <Row>
        <Btn small label="Accept my version" disabled={!valid} testID="player-modify-submit"
          onPress={() => onSubmit(request.original.map((c, i) => withAmount(c, parsed[i] as number)))} />
        <Btn small kind="ghost" label="Cancel" onPress={onCancel} />
      </Row>
    </Card>
  );
}

export default function PlayerScreen() {
  const rt = useSessionRuntime();
  const runtime = getSessionRuntime();
  const peer = runtime.currentPeer;
  const [modifying, setModifying] = useState<string | null>(null);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestRule, setSuggestRule] = useState('');
  const [suggestValue, setSuggestValue] = useState('');
  const [suggestNote, setSuggestNote] = useState('');

  if (!rt.capabilities.includes('player') || !peer) {
    return <LiveScreen title="Player"><NotCapable needs="a Player" /></LiveScreen>;
  }

  const view = rt.view;
  const me = rt.participantId ?? '';
  const mine = Object.values(view?.requests ?? {}).filter(r => r.targetId === me);
  const pending = mine.filter(r => r.status === 'PENDING');
  const history = mine.filter(r => r.status !== 'PENDING');
  const character = view?.characters[me];
  const effects = peer.visibleEffects();
  const encounters = Object.values(view?.encounters ?? {}).filter(e => e.active);
  const mySuggestions = Object.values(view?.ruleSuggestions ?? {});
  const offline = rt.status !== 'connected';
  const send = (fn: () => unknown) => { try { fn(); } catch (e) { Alert.alert('Not sent', (e as Error).message); } };

  return (
    <LiveScreen title="Player" subtitle={character ? character.summary.name : 'No character reported yet'}>
      <Card testID="player-status">
        <Row wrap>
          <Badge label={rt.status} tone={offline ? 'warn' : 'good'} />
          <Badge label={`revision ${view?.revision ?? 0}`} />
          {view?.ended && <Badge label="session ended" tone="bad" />}
        </Row>
        {character && <Body bold>HP {character.summary.hp}/{character.summary.maxHp} · AC {character.summary.ac}</Body>}
        {view?.campaign && <Muted>Campaign: {view.campaign.name}</Muted>}
        {offline && <Muted>You are offline. Your sheet still works; changes sync when you reconnect.</Muted>}
        {offline && <Btn small kind="ghost" label="Reconnect" onPress={() => { void runtime.reconnect(); }} testID="player-reconnect" />}
      </Card>

      {encounters.map(e => {
        const nameOf = (id: string) => e.combatants.find(c => c.id === id)?.name ?? view?.participants[id]?.nickname ?? id;
        const myTurn = e.currentTurnIndex !== null && e.turnOrder[e.currentTurnIndex] === me;
        return (
          <Card key={e.id} tone={myTurn ? 'warn' : 'default'} testID={`player-encounter-${e.name}`}>
            <Body bold>⚔ {e.name}</Body>
            <Muted>{e.combatants.map(c => {
              const hp = c.hpState && c.hpState !== 'healthy' ? ` (${c.hpState})` : '';
              const ac = c.ac !== undefined ? ` AC ${c.ac}` : '';
              const exact = c.exactHp ? ` ${c.exactHp.current}/${c.exactHp.max} HP` : '';
              return `${c.name}${hp}${ac}${exact}`;
            }).join(', ')}</Muted>
            {e.currentTurnIndex !== null && (
              <Row wrap>
                <Badge label={`Round ${e.round}`} />
                <Badge label={myTurn ? "It's your turn!" : `${nameOf(e.turnOrder[e.currentTurnIndex])}'s turn`} tone={myTurn ? 'good' : 'default'} />
              </Row>
            )}
          </Card>
        );
      })}

      <Section title={`DM requests (${pending.length})`} hint="Your character stays yours. Nothing changes until you accept.">
        {pending.length === 0 && <Muted>Nothing waiting for you.</Muted>}
        {pending.map(r => {
          const stale = r.staleAgainst !== null;
          return (
            <Card key={r.id} tone={stale ? 'warn' : 'default'} testID={`player-request-${r.label}`}>
              <Body bold>{r.label}</Body>
              <Body>{describeChanges(r.original)}</Body>
              {stale && <Muted>Your character changed since the DM sent this. You can still accept it.</Muted>}
              {modifying === r.id ? (
                <ModifyEditor request={r} onCancel={() => setModifying(null)}
                  onSubmit={(changes) => { send(() => peer.respond(r.id, 'modify', { modified: changes, ...(stale ? { acknowledgeStale: true } : {}) })); setModifying(null); }} />
              ) : (
                <Row wrap>
                  <Btn small label={stale ? 'Accept anyway' : 'Accept'} disabled={offline} testID={`player-accept-${r.label}`}
                    onPress={() => send(() => peer.respond(r.id, 'accept', stale ? { acknowledgeStale: true } : {}))} />
                  <Btn small kind="ghost" label="Modify" disabled={offline} onPress={() => setModifying(r.id)} testID={`player-modify-${r.label}`} />
                  <Btn small kind="danger" label="Reject" disabled={offline} onPress={() => send(() => peer.respond(r.id, 'reject'))} testID={`player-reject-${r.label}`} />
                </Row>
              )}
            </Card>
          );
        })}
      </Section>

      <Section title={`Effects on you (${effects.filter(e => e.app.targetId === me).length})`}>
        {effects.length === 0 && <Muted>No active effects.</Muted>}
        {effects.map(({ effectId, label, components, app }) => (
          <Card key={app.id} testID={`player-effect-${label ?? 'unknown'}`}>
            <Row wrap>
              <Body bold>{label ?? 'Unknown effect'}</Body>
              {app.targetId !== me && <Muted>on {view?.participants[app.targetId]?.nickname ?? effectId}</Muted>}
              <Badge label={app.state === 'DUE_TO_END' ? 'due to end' : 'active'} tone={app.state === 'DUE_TO_END' ? 'warn' : 'good'} />
            </Row>
            <Muted>{components.map(describeEffectComponent).join(', ') || 'no numeric change'}</Muted>
            {app.state === 'DUE_TO_END' && <Muted>The DM should end this soon.</Muted>}
          </Card>
        ))}
      </Section>

      {history.length > 0 && (
        <Section title="Resolved requests">
          {history.map(r => (
            <Card key={r.id} testID={`player-history-${r.label}`}>
              <Row wrap><Body bold>{r.label}</Body><Badge label={r.status.toLowerCase()} tone={r.status === 'ACCEPTED' || r.status === 'MODIFIED' ? 'good' : 'bad'} /></Row>
              <Muted>Asked: {describeChanges(r.original)}</Muted>
              {r.finalApplied && <Muted>Applied: {describeChanges(r.finalApplied)}</Muted>}
            </Card>
          ))}
        </Section>
      )}

      <Section title="Rule suggestions" hint="Propose a house-rule change for the DM to review.">
        {mySuggestions.map(s => (
          <Card key={s.id} testID={`player-suggestion-${s.rule}`}>
            <Row wrap><Body bold>{s.rule}</Body><Badge label={s.status.toLowerCase()} tone={s.status === 'ACCEPTED' || s.status === 'MODIFIED' ? 'good' : s.status === 'PENDING' ? 'warn' : 'bad'} /></Row>
            <Muted>Proposed: {s.proposedValue}</Muted>
            {s.dmResponse && <Muted>DM's version: {s.dmResponse}</Muted>}
          </Card>
        ))}
        {suggestOpen ? (
          <>
            <Field label="Rule" value={suggestRule} onChangeText={setSuggestRule} placeholder="Flanking" testID="player-suggest-rule" />
            <Field label="Proposed change" value={suggestValue} onChangeText={setSuggestValue} placeholder="Grant advantage when flanking" testID="player-suggest-value" />
            <Field label="Why (optional)" value={suggestNote} onChangeText={setSuggestNote} multiline testID="player-suggest-note" />
            <Row>
              <Btn small label="Send" disabled={!suggestRule.trim() || !suggestValue.trim() || offline} testID="player-suggest-send"
                onPress={() => {
                  send(() => peer.suggestRule(suggestRule.trim(), suggestValue.trim(), suggestNote.trim()));
                  setSuggestOpen(false); setSuggestRule(''); setSuggestValue(''); setSuggestNote('');
                }} />
              <Btn small kind="ghost" label="Cancel" onPress={() => setSuggestOpen(false)} />
            </Row>
          </>
        ) : (
          <Btn small kind="ghost" label="+ Suggest a rule change" onPress={() => setSuggestOpen(true)} testID="player-suggest-open" />
        )}
      </Section>
    </LiveScreen>
  );
}
