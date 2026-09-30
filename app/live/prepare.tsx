// app/live/prepare.tsx
// DM PREPARATION. Persistent, owned by the DM, and fully usable with no Host and no network.
// Everything here is a definition or template. Nothing becomes live until the DM activates it
// from the DM Live screen while connected to a Host. Campaign revision advances on every edit.
import { useCallback, useEffect, useState } from 'react';
import { getSessionRuntime } from '../../src/session/runtime';
import { CampaignPrep } from '../../src/session/prep';
import {
  addEffect, addEncounter, addNote, addPlan, addTemplate, describeDuration, describeEffectComponent,
  importPlannerEncounter, parseSignedInt, removeItem, togglePlanItem,
} from '../../src/session/prepEdit';
import { describeChanges } from '../../src/session/roles';
import { EffectComponent, EffectVisibility, CharacterChange } from '../../src/session/types';
import { useEncounterStore } from '../../src/store/encounterStore';
import { useHomebrewStore } from '../../src/store/homebrewStore';
import { resolveMonsterById } from '../../src/content/contentResolution';
import { LiveScreen, Section, Card, Btn, Chip, Field, Row, Badge, Muted, Body } from '../../src/components/live/LiveUi';
import { Alert } from '../../src/utils/alert';

function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

type CampaignSummary = { campaignId: string; name: string; campaignRevision: number };
type Form = null | 'encounter' | 'effect' | 'template' | 'note' | 'plan' | 'import';

const STATS: EffectComponent['stat'][] = ['ac', 'speed', 'initiative', 'save', 'spell_attack', 'spell_dc'];
const STAT_LABEL: Record<EffectComponent['stat'], string> = { ac: 'AC', speed: 'Speed', initiative: 'Initiative', save: 'Saves', spell_attack: 'Spell attack', spell_dc: 'Spell save DC' };

export default function PrepareScreen() {
  const runtime = getSessionRuntime();
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
  const [current, setCurrent] = useState<CampaignPrep | null>(null);
  const [newName, setNewName] = useState('');
  const [form, setForm] = useState<Form>(null);
  const planned = useEncounterStore(s => s.encounters);
  const homebrewMonsters = useHomebrewStore(s => s.monsters);

  const refresh = useCallback(async (id?: string) => {
    setCampaigns(await runtime.prep.list());
    if (id) setCurrent(await runtime.prep.load(id));
  }, [runtime]);

  useEffect(() => { void refresh(); }, [refresh]);

  async function edit(mut: (p: CampaignPrep) => CampaignPrep) {
    if (!current) return;
    try {
      setCurrent(await runtime.prep.edit(current.campaignId, mut));
      setCampaigns(await runtime.prep.list());
      setForm(null);
    } catch (e) {
      Alert.alert('Could not save', (e as Error).message);
    }
  }

  async function createCampaign() {
    const name = newName.trim();
    if (!name) return;
    const prep = await runtime.prep.create(uid('camp'), name);
    setNewName('');
    await refresh(prep.campaignId);
  }

  if (!current) {
    return (
      <LiveScreen title="DM Preparation" subtitle="Works offline. Saved on this device.">
        <Section title="Your campaigns" hint="Preparation belongs to you, not to any Host. Reuse the same campaign with any Host.">
          {campaigns.length === 0 && <Muted>No campaigns yet.</Muted>}
          {campaigns.map(c => (
            <Card key={c.campaignId} testID={`prep-campaign-${c.name}`}>
              <Body bold>{c.name}</Body>
              <Muted>Preparation revision {c.campaignRevision}</Muted>
              <Row>
                <Btn small label="Open" onPress={() => { void refresh(c.campaignId); }} testID={`prep-open-${c.name}`} />
                <Btn small kind="danger" label="Delete" onPress={() => Alert.alert(`Delete "${c.name}"?`, 'This removes its preparation from this device.', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Delete', style: 'destructive', onPress: () => { void runtime.prep.remove(c.campaignId).then(() => refresh()); } },
                ])} />
              </Row>
            </Card>
          ))}
        </Section>
        <Section title="New campaign">
          <Field label="Campaign name" value={newName} onChangeText={setNewName} placeholder="Automation Campaign" testID="prep-new-name" />
          <Btn label="Create campaign" onPress={() => { void createCampaign(); }} disabled={!newName.trim()} testID="prep-create" />
        </Section>
      </LiveScreen>
    );
  }

  const p = current;
  return (
    <LiveScreen title={p.name} subtitle={`Preparation revision ${p.campaignRevision} · offline-safe`} backTo="/live/prepare">
      <Btn label="← All campaigns" kind="ghost" onPress={() => { setCurrent(null); setForm(null); void refresh(); }} testID="prep-all" />

      <Section title={`Encounters (${p.encounters.length})`} hint="Only the public projection (names and coarse state) is sent when you start one. Notes and hidden combatants stay here.">
        {p.encounters.map(e => (
          <Card key={e.id} testID={`prep-encounter-${e.name}`}>
            <Body bold>{e.name}</Body>
            <Muted>{e.combatants.map(c => c.hidden ? `(${c.name})` : c.name).join(', ') || 'No combatants'}</Muted>
            <Btn small kind="danger" label="Remove" onPress={() => { void edit(x => removeItem(x, 'encounters', e.id)); }} />
          </Card>
        ))}
        <Row wrap>
          <Btn small label="＋ Encounter" onPress={() => setForm(form === 'encounter' ? null : 'encounter')} testID="prep-add-encounter" />
          {planned.length > 0 && <Btn small kind="ghost" label="Import from Encounter Planner" onPress={() => setForm(form === 'import' ? null : 'import')} testID="prep-import-planner" />}
        </Row>
        {form === 'encounter' && <EncounterForm onSave={(v) => { void edit(x => addEncounter(x, { id: uid('enc'), ...v })); }} />}
        {form === 'import' && planned.map(pe => (
          <Btn key={pe.id} small kind="ghost" label={`Import "${pe.name || 'Untitled'}"`} onPress={() => {
            void edit(x => importPlannerEncounter(x, pe, uid('enc'), id => resolveMonsterById(id, homebrewMonsters)?.name ?? id));
          }} />
        ))}
      </Section>

      <Section title={`Effects (${p.effects.length})`} hint="Definitions only. Applying one to targets happens live. Secret effects keep their name, description and notes on this device.">
        {p.effects.map(f => (
          <Card key={f.id} tone={f.visibility === 'secret' ? 'secret' : 'default'} testID={`prep-effect-${f.name}`}>
            <Row wrap><Body bold>{f.name}</Body><Badge label={f.visibility} tone={f.visibility === 'secret' ? 'secret' : 'default'} /></Row>
            <Muted>{f.components.map(describeEffectComponent).join(', ') || 'No numeric change'} · {describeDuration(f.duration)}</Muted>
            <Btn small kind="danger" label="Remove" onPress={() => { void edit(x => removeItem(x, 'effects', f.id)); }} />
          </Card>
        ))}
        <Btn small label="＋ Effect" onPress={() => setForm(form === 'effect' ? null : 'effect')} testID="prep-add-effect" />
        {form === 'effect' && <EffectForm onSave={(v) => { void edit(x => addEffect(x, { id: uid('fx'), ...v })); }} />}
      </Section>

      <Section title={`Change templates (${p.templates.length})`} hint="Reusable requests. A live request is created only when you send one to a player, and the player can accept, modify or reject it.">
        {p.templates.map(t => (
          <Card key={t.id} testID={`prep-template-${t.label}`}>
            <Body bold>{t.label}</Body>
            <Muted>{describeChanges(t.changes)}</Muted>
            <Btn small kind="danger" label="Remove" onPress={() => { void edit(x => removeItem(x, 'templates', t.id)); }} />
          </Card>
        ))}
        <Btn small label="＋ Change template" onPress={() => setForm(form === 'template' ? null : 'template')} testID="prep-add-template" />
        {form === 'template' && <TemplateForm onSave={(label, changes) => { void edit(x => addTemplate(x, { id: uid('tpl'), label, changes })); }} />}
      </Section>

      <Section title={`DM-only notes (${p.notes.length})`} hint="Never sent to the Host or any player.">
        {p.notes.map(n => (
          <Card key={n.id}>
            <Body>{n.text}</Body>
            <Btn small kind="danger" label="Remove" onPress={() => { void edit(x => removeItem(x, 'notes', n.id)); }} />
          </Card>
        ))}
        <Btn small label="＋ Note" onPress={() => setForm(form === 'note' ? null : 'note')} testID="prep-add-note" />
        {form === 'note' && <NoteForm onSave={(text) => { void edit(x => addNote(x, { id: uid('note'), text })); }} />}
      </Section>

      <Section title={`Session plans (${p.plans.length})`} hint="Group the prepared pieces you expect to use in one session.">
        {p.plans.map(pl => (
          <Card key={pl.id} testID={`prep-plan-${pl.name}`}>
            <Body bold>{pl.name}</Body>
            <Row wrap>
              {p.encounters.map(e => <Chip key={e.id} label={`⚔ ${e.name}`} active={pl.encounterIds.includes(e.id)} onPress={() => { void edit(x => togglePlanItem(x, pl.id, 'encounterIds', e.id)); }} />)}
              {p.effects.map(f => <Chip key={f.id} label={`✦ ${f.name}`} active={pl.effectIds.includes(f.id)} onPress={() => { void edit(x => togglePlanItem(x, pl.id, 'effectIds', f.id)); }} />)}
              {p.templates.map(t => <Chip key={t.id} label={`✎ ${t.label}`} active={pl.templateIds.includes(t.id)} onPress={() => { void edit(x => togglePlanItem(x, pl.id, 'templateIds', t.id)); }} />)}
            </Row>
            <Btn small kind="danger" label="Remove plan" onPress={() => { void edit(x => removeItem(x, 'plans', pl.id)); }} />
          </Card>
        ))}
        <Btn small label="＋ Session plan" onPress={() => setForm(form === 'plan' ? null : 'plan')} testID="prep-add-plan" />
        {form === 'plan' && <NoteForm label="Plan name" onSave={(name) => { void edit(x => addPlan(x, { id: uid('plan'), name })); }} />}
      </Section>

      <Section title="Content" hint="Homebrew packs banned from this campaign are managed in Campaigns → Content restrictions.">
        <Muted>{p.contentManifest.bannedPackIds.length} banned pack(s) recorded in this preparation.</Muted>
      </Section>
    </LiveScreen>
  );
}

// ── Forms ────────────────────────────────────────────────────────────────────

function EncounterForm({ onSave }: { onSave: (v: { name: string; combatantsText: string; dmNotes: string }) => void }) {
  const [name, setName] = useState('');
  const [combatantsText, setCombatants] = useState('');
  const [dmNotes, setNotes] = useState('');
  return (
    <Card>
      <Field label="Encounter name" value={name} onChangeText={setName} placeholder="Bridge Ambush" testID="prep-enc-name" />
      <Field label="Combatants (comma separated; start with ? to hide)" value={combatantsText} onChangeText={setCombatants} placeholder="Bandit, Bandit Captain" testID="prep-enc-combatants" />
      <Field label="DM notes (private)" value={dmNotes} onChangeText={setNotes} multiline testID="prep-enc-notes" />
      <Btn label="Save encounter" disabled={!name.trim()} onPress={() => onSave({ name, combatantsText, dmNotes })} testID="prep-enc-save" />
    </Card>
  );
}

function EffectForm({ onSave }: { onSave: (v: {
  name: string; description: string; source: string; notes: string; hiddenDurationReason: string;
  visibility: EffectVisibility; components: EffectComponent[]; duration: { unit: 'manual' } | { unit: 'rounds'; total: number; remaining: number };
}) => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<EffectVisibility>('public');
  const [stat, setStat] = useState<EffectComponent['stat'] | null>(null);
  const [value, setValue] = useState('1');
  const [rounds, setRounds] = useState('');
  const [notes, setNotes] = useState('');
  const n = parseSignedInt(value);
  const r = rounds.trim() ? parseSignedInt(rounds) : null;
  const valid = name.trim().length > 0 && (!stat || n !== null) && (rounds.trim() === '' || (r !== null && r >= 1));
  return (
    <Card>
      <Field label="Effect name" value={name} onChangeText={setName} placeholder="Blessing" testID="prep-fx-name" />
      <Field label="Description" value={description} onChangeText={setDescription} multiline testID="prep-fx-desc" />
      <Row wrap>
        {(['public', 'target', 'secret'] as EffectVisibility[]).map(v => (
          <Chip key={v} label={v === 'public' ? 'Public' : v === 'target' ? 'Target only' : 'Secret'} active={visibility === v} onPress={() => setVisibility(v)} testID={`prep-fx-vis-${v}`} />
        ))}
      </Row>
      <Muted>Changes a number:</Muted>
      <Row wrap>
        <Chip label="None" active={stat === null} onPress={() => setStat(null)} />
        {STATS.map(s => <Chip key={s} label={STAT_LABEL[s]} active={stat === s} onPress={() => setStat(s)} testID={`prep-fx-stat-${s}`} />)}
      </Row>
      {stat && <Field label="Amount (whole number, may be negative)" value={value} onChangeText={setValue} keyboardType="numbers-and-punctuation" testID="prep-fx-value" />}
      <Field label="Duration in rounds (blank = manual)" value={rounds} onChangeText={setRounds} keyboardType="number-pad" testID="prep-fx-rounds" />
      {visibility === 'secret' && <Field label="Private DM notes" value={notes} onChangeText={setNotes} multiline testID="prep-fx-notes" />}
      <Btn label="Save effect" disabled={!valid} testID="prep-fx-save" onPress={() => onSave({
        name, description, source: '', notes, hiddenDurationReason: '', visibility,
        components: stat && n !== null ? [{ stat, operation: 'add', value: n }] : [],
        duration: r ? { unit: 'rounds', total: r, remaining: r } : { unit: 'manual' },
      })} />
    </Card>
  );
}

function TemplateForm({ onSave }: { onSave: (label: string, changes: CharacterChange[]) => void }) {
  const [label, setLabel] = useState('');
  const [kind, setKind] = useState<'exhaustion' | 'max_hp' | 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha'>('exhaustion');
  const [delta, setDelta] = useState('1');
  const d = parseSignedInt(delta);
  const changes: CharacterChange[] = d === null || d === 0 ? [] : [kind === 'exhaustion' || kind === 'max_hp' ? { kind, delta: d } : { kind: 'ability', ability: kind, delta: d }];
  return (
    <Card>
      <Field label="Template name" value={label} onChangeText={setLabel} placeholder="Exhaustion Increase" testID="prep-tpl-label" />
      <Row wrap>
        {(['exhaustion', 'max_hp', 'str', 'dex', 'con', 'int', 'wis', 'cha'] as const).map(k => (
          <Chip key={k} label={k === 'max_hp' ? 'Max HP' : k === 'exhaustion' ? 'Exhaustion' : k.toUpperCase()} active={kind === k} onPress={() => setKind(k)} testID={`prep-tpl-kind-${k}`} />
        ))}
      </Row>
      <Field label="Change (whole number)" value={delta} onChangeText={setDelta} keyboardType="numbers-and-punctuation" testID="prep-tpl-delta" />
      <Btn label="Save template" disabled={!label.trim() || changes.length === 0} onPress={() => onSave(label, changes)} testID="prep-tpl-save" />
    </Card>
  );
}

function NoteForm({ onSave, label = 'Note' }: { onSave: (text: string) => void; label?: string }) {
  const [text, setText] = useState('');
  return (
    <Card>
      <Field label={label} value={text} onChangeText={setText} multiline={label === 'Note'} testID="prep-note-text" />
      <Btn label="Save" disabled={!text.trim()} onPress={() => onSave(text)} testID="prep-note-save" />
    </Card>
  );
}
