// app/live/player.tsx
// PLAYER view of a live session: your character, DM change requests (accept / modify / reject),
// the effects you are subject to, and the table's public state. Requires the player capability.
import { useState } from 'react';
import { useSessionRuntime, getSessionRuntime } from '../../src/session/runtime';
import { describeChanges, describeRewardKind, describeSessionLogKind, formatContentId } from '../../src/session/roles';
import { describeEffectComponent, parseSignedInt } from '../../src/session/prepEdit';
import { ChangeRequest, CharacterChange, PublicPersona } from '../../src/session/types';
import { LiveScreen, Section, Card, Btn, Field, Row, Badge, Muted, Body, NotCapable, Chip } from '../../src/components/live/LiveUi';
import { Alert } from '../../src/utils/alert';

function parsePositiveInt(s: string): number | null {
  const n = Number(s.trim());
  return Number.isInteger(n) && n >= 0 ? n : null;
}

/** Edits a PublicPersona (LAN_PLAYER_SCREEN_SPEC.md's "What others see"). Pre-fills from the
 *  existing persona if one is set, otherwise from the real summary — an untouched field already
 *  means "show the truth for this one," since there's no per-field omit option on the wire. */
function PersonaEditor({ real, initial, onSave, onCancel }: {
  real: { name: string; hp: number; maxHp: number; ac: number };
  initial: PublicPersona | undefined;
  onSave: (p: PublicPersona) => void; onCancel: () => void;
}) {
  const base = initial ?? { enabled: true, ...real };
  const [name, setName] = useState(base.name);
  const [hp, setHp] = useState(String(base.hp));
  const [maxHp, setMaxHp] = useState(String(base.maxHp));
  const [ac, setAc] = useState(String(base.ac));
  const parsedHp = parsePositiveInt(hp);
  const parsedMaxHp = parsePositiveInt(maxHp);
  const parsedAc = parsePositiveInt(ac);
  const valid = name.trim().length > 0 && parsedHp !== null && parsedMaxHp !== null && parsedMaxHp >= 1 && parsedAc !== null;
  return (
    <Card testID="player-persona-editor">
      <Muted>These values replace your real name, HP, max HP and AC for every other player at the table. The DM always sees your real sheet too.</Muted>
      <Field label="Name shown to others" value={name} onChangeText={setName} testID="player-persona-name" />
      <Field label="HP shown" value={hp} onChangeText={setHp} keyboardType="number-pad" testID="player-persona-hp" />
      <Field label="Max HP shown" value={maxHp} onChangeText={setMaxHp} keyboardType="number-pad" testID="player-persona-maxhp" />
      <Field label="AC shown" value={ac} onChangeText={setAc} keyboardType="number-pad" testID="player-persona-ac" />
      <Row wrap>
        <Btn small label="Save" disabled={!valid} testID="player-persona-save"
          onPress={() => onSave({ enabled: true, name: name.trim(), hp: parsedHp as number, maxHp: parsedMaxHp as number, ac: parsedAc as number })} />
        <Btn small kind="ghost" label="Cancel" onPress={onCancel} />
      </Row>
    </Card>
  );
}

/** Free-text counter-proposal for a Reward's modify response (RewardKind has nothing numeric to
 *  edit like a ChangeRequest's amounts — see Reward's own doc comment in types.ts). */
function RewardModifyEditor({ onSubmit, onCancel }: { onSubmit: (note: string) => void; onCancel: () => void }) {
  const [note, setNote] = useState('');
  return (
    <Card testID="player-reward-modify-editor">
      <Field label="Your version" value={note} onChangeText={setNote} multiline testID="player-reward-modify-text" />
      <Row wrap>
        <Btn small label="Accept with my note" disabled={!note.trim()} testID="player-reward-modify-submit" onPress={() => onSubmit(note.trim())} />
        <Btn small kind="ghost" label="Cancel" onPress={onCancel} />
      </Row>
    </Card>
  );
}

// temp_hp carries `amount` (never negative, 5e doesn't stack it); the numeric kinds carry `delta`;
// condition/concentration/stabilize carry neither — they're not editable here, just accepted or
// rejected as the DM proposed them (see isNumericChange below).
type NumericChange = Extract<CharacterChange, { kind: 'exhaustion' | 'max_hp' | 'ability' | 'hp' | 'temp_hp' }>;
function isNumericChange(c: CharacterChange): c is NumericChange {
  return c.kind === 'exhaustion' || c.kind === 'max_hp' || c.kind === 'ability' || c.kind === 'hp' || c.kind === 'temp_hp';
}
function amountOf(c: CharacterChange): number { return isNumericChange(c) ? (c.kind === 'temp_hp' ? c.amount : c.delta) : 0; }
function withAmount(c: CharacterChange, n: number): CharacterChange {
  if (!isNumericChange(c)) return c;
  return c.kind === 'temp_hp' ? { ...c, amount: n } : { ...c, delta: n };
}

/** Re-uses the DM's change kinds but lets the player edit each amount. */
function ModifyEditor({ request, onSubmit, onCancel }: {
  request: ChangeRequest; onSubmit: (changes: CharacterChange[]) => void; onCancel: () => void;
}) {
  const [amounts, setAmounts] = useState<string[]>(request.original.map(c => String(amountOf(c))));
  const parsed = amounts.map(parseSignedInt);
  const valid = parsed.every((n, i) => {
    const c = request.original[i];
    if (!isNumericChange(c)) return true;
    return n !== null && (c.kind === 'temp_hp' ? n >= 0 : n !== 0);
  });
  return (
    <Card testID="player-modify-editor">
      <Muted>Change the amounts, then accept your version. The DM sees both.</Muted>
      {request.original.map((c, i) => (
        isNumericChange(c) ? (
          <Field key={i} label={describeChanges([withAmount(c, 0)]).replace(/ [+-]?0$/, '')} value={amounts[i]}
            onChangeText={t => setAmounts(a => a.map((x, j) => j === i ? t : x))}
            keyboardType="numbers-and-punctuation" testID={`player-modify-amount-${i}`} />
        ) : (
          <Body key={i}>{describeChanges([c])}</Body>
        )
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
  const [modifyingReward, setModifyingReward] = useState<string | null>(null);
  const [editingPersona, setEditingPersona] = useState(false);
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
  const myRewards = Object.values(view?.rewards ?? {});
  const pendingRewards = myRewards.filter(r => r.status === 'PENDING');
  const resolvedRewards = myRewards.filter(r => r.status !== 'PENDING');
  const rewardLabelOf = (id: string): string => myRewards.find(x => x.id === id)?.label ?? id;
  const party = peer.partyView();
  const persona = character?.persona;
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

      <Section title="Public Persona" hint="Show the rest of the table a different name, HP, max HP and AC than your real sheet. The DM always sees your real numbers alongside this.">
        {editingPersona ? (
          character ? (
            <PersonaEditor real={character.summary} initial={persona}
              onCancel={() => setEditingPersona(false)}
              onSave={(p) => { send(() => peer.setPersona(p)); setEditingPersona(false); }} />
          ) : <Muted>Report your character first.</Muted>
        ) : (
          <Card testID="player-persona-status">
            <Row wrap>
              <Badge label={persona?.enabled ? 'Showing a cover identity' : 'Showing your real sheet'} tone={persona?.enabled ? 'secret' : 'default'} />
            </Row>
            {persona?.enabled && <Body>Others see: {persona.name} · HP {persona.hp}/{persona.maxHp} · AC {persona.ac}</Body>}
            <Row wrap>
              <Btn small label={persona?.enabled ? 'Edit' : 'Set up a cover identity'} disabled={offline || !character}
                onPress={() => setEditingPersona(true)} testID="player-persona-edit" />
              {persona?.enabled && (
                <Btn small kind="ghost" label="Show my real sheet" disabled={offline} testID="player-persona-disable"
                  onPress={() => send(() => peer.setPersona({ ...persona, enabled: false }))} />
              )}
            </Row>
          </Card>
        )}
      </Section>

      {party.length > 0 && (
        <Section title="Party">
          {party.map(c => (
            <Card key={c.participantId} testID={`player-party-${c.summary.name}`}>
              <Body bold>{c.summary.name}</Body>
              <Muted>HP {c.summary.hp}/{c.summary.maxHp} · AC {c.summary.ac}</Muted>
            </Card>
          ))}
        </Section>
      )}

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
              const conditions = c.conditions && c.conditions.length > 0 ? ` [${c.conditions.map(formatContentId).join(', ')}]` : '';
              return `${c.name}${hp}${ac}${exact}${conditions}`;
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

      <Section title={`Rewards (${pendingRewards.length} pending)`} hint="The DM proposed these. Nothing changes until you respond.">
        {pendingRewards.length === 0 && <Muted>Nothing waiting for you.</Muted>}
        {pendingRewards.map(r => (
          <Card key={r.id} testID={`player-reward-${r.label}`}>
            <Row wrap><Body bold>{r.label}</Body><Badge label={describeRewardKind(r.kind)} /></Row>
            {!!r.description && <Body>{r.description}</Body>}
            {!!r.tierTrack && <Muted>Tier track: {r.tierTrack}</Muted>}
            {modifyingReward === r.id ? (
              <RewardModifyEditor onCancel={() => setModifyingReward(null)}
                onSubmit={(note) => { send(() => peer.respondReward(r.id, 'modify', note)); setModifyingReward(null); }} />
            ) : (
              <Row wrap>
                <Btn small label="Accept" disabled={offline} testID={`player-reward-accept-${r.label}`} onPress={() => send(() => peer.respondReward(r.id, 'accept'))} />
                <Btn small kind="ghost" label="Modify" disabled={offline} onPress={() => setModifyingReward(r.id)} testID={`player-reward-modify-${r.label}`} />
                <Btn small kind="danger" label="Reject" disabled={offline} onPress={() => send(() => peer.respondReward(r.id, 'reject'))} testID={`player-reward-reject-${r.label}`} />
              </Row>
            )}
          </Card>
        ))}
        {resolvedRewards.length > 0 && (
          <>
            <Muted>Resolved:</Muted>
            {resolvedRewards.map(r => (
              <Card key={r.id} testID={`player-reward-resolved-${r.label}`}>
                <Row wrap>
                  <Body bold>{r.label}</Body>
                  <Badge label={r.status.toLowerCase()} tone={r.status === 'ACCEPTED' || r.status === 'MODIFIED' ? 'good' : r.status === 'SUPERSEDED' ? 'default' : 'bad'} />
                </Row>
                {!!r.playerNote && <Muted>Your note: {r.playerNote}</Muted>}
                {r.status === 'SUPERSEDED' && r.supersededBy && <Muted>Replaced by: {rewardLabelOf(r.supersededBy)}</Muted>}
              </Card>
            ))}
          </>
        )}
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

      {(view?.sessionLog ?? []).length > 0 && (
        <Section title="Session log" hint="The DM's narrative recap of major events.">
          {[...(view?.sessionLog ?? [])].reverse().slice(0, 12).map(e => (
            <Muted key={e.id}>{describeSessionLogKind(e.kind)}: {e.text}</Muted>
          ))}
        </Section>
      )}
    </LiveScreen>
  );
}
