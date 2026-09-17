// app/dm/encounter-builder.tsx
// Prepared Encounter editor — planning data only (see PreparedEncounter's
// own doc comment in engine/types.ts). Edits a local draft, explicit Save
// persists via encounterStore, same pattern every homebrew builder already
// uses (race-builder.tsx, class-builder.tsx, etc.) rather than autosaving
// every keystroke.
import { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, TextInput, Modal } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert } from '../../src/utils/alert';
import { useEncounterStore } from '../../src/store/encounterStore';
import { useHomebrewStore } from '../../src/store/homebrewStore';
import { mergeMonsterIndex } from '../../src/content/contentResolution';
import { ALL_CONDITIONS } from '../../src/content/conditions/index';
import {
  PreparedEncounter, PreparedCombatant, PreparedCombatantHpMode, EncounterStatus,
  EncounterWaveTriggerKind, EncounterRewardKind,
} from '../../src/engine/types';
import {
  newPreparedCombatant, newEncounterGroup, newEncounterWave, newEnvironmentEntry, newReward,
} from '../../src/engine/preparedEncounter';
import { useSafeGoBack } from '../../src/hooks/useSafeGoBack';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../src/theme';

const HP_MODE_LABEL: Record<PreparedCombatantHpMode, string> = {
  average: 'Average', max: 'Max', roll: 'Roll', manual: 'Manual',
};

function crLabel(cr: number): string {
  if (cr === 0.125) return '1/8';
  if (cr === 0.25)  return '1/4';
  if (cr === 0.5)   return '1/2';
  return String(cr);
}

// ── Section shell ────────────────────────────────────────────────────────────

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle ? <Text style={styles.sectionSub}>{subtitle}</Text> : null}
      {children}
    </View>
  );
}

// ── Add-monster picker ───────────────────────────────────────────────────────

function AddMonsterModal({ visible, onClose, onPick }: {
  visible: boolean;
  onClose: () => void;
  onPick: (monsterId: string) => void;
}) {
  const homebrewMonsters = useHomebrewStore(s => s.monsters);
  const [search, setSearch] = useState('');
  const allTemplates = useMemo(() => mergeMonsterIndex(homebrewMonsters), [homebrewMonsters]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allTemplates.slice(0, 30);
    return allTemplates.filter(t => t.name.toLowerCase().includes(q) || t.type.toLowerCase().includes(q)).slice(0, 30);
  }, [allTemplates, search]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.pickerSheet} onPress={e => e.stopPropagation()}>
          <Text style={styles.pickerTitle}>Add Monster</Text>
          <TextInput
            style={styles.pickerSearch}
            value={search}
            onChangeText={setSearch}
            placeholder="Search monsters…"
            placeholderTextColor={Colors.textDim}
            autoFocus
          />
          <ScrollView style={{ maxHeight: 400 }}>
            {filtered.map(t => (
              <Pressable key={t.id} style={styles.pickerRow} onPress={() => { onPick(t.id); onClose(); setSearch(''); }}>
                <Text style={styles.pickerRowName}>{t.name}</Text>
                <Text style={styles.pickerRowMeta}>CR {crLabel(t.cr)} · {t.type}</Text>
              </Pressable>
            ))}
            {filtered.length === 0 && <Text style={styles.pickerEmpty}>No monsters match.</Text>}
          </ScrollView>
          <Pressable style={styles.pickerClose} onPress={onClose}>
            <Text style={styles.pickerCloseTxt}>Close</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Combatant row ────────────────────────────────────────────────────────────

function CombatantRow({ combatant, monsterName, monsterCr, groups, waves, onChange, onRemove, onDuplicate }: {
  combatant: PreparedCombatant;
  monsterName: string;
  monsterCr: number | null;
  groups: { id: string; name: string }[];
  waves: { id: string; name: string }[];
  onChange: (patch: Partial<PreparedCombatant>) => void;
  onRemove: () => void;
  onDuplicate: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <View style={styles.combatantCard}>
      <Pressable style={styles.combatantTop} onPress={() => setExpanded(x => !x)}>
        <View style={{ flex: 1 }}>
          <Text style={styles.combatantName}>
            {combatant.displayName?.trim() || monsterName}
            {combatant.quantity > 1 ? ` ×${combatant.quantity}` : ''}
          </Text>
          <Text style={styles.combatantMeta}>
            {monsterCr !== null ? `CR ${crLabel(monsterCr)} · ` : ''}
            HP: {HP_MODE_LABEL[combatant.hpMode]}
            {combatant.hidden ? ' · Hidden' : ''}
            {combatant.waveId ? ` · ${waves.find(w => w.id === combatant.waveId)?.name ?? 'Wave'}` : ''}
          </Text>
        </View>
        <Text style={styles.expandTxt}>{expanded ? '▲' : '▼'}</Text>
      </Pressable>

      {expanded && (
        <View style={styles.combatantBody}>
          <Text style={styles.fieldLabel}>Display name (optional override)</Text>
          <TextInput
            style={styles.input}
            value={combatant.displayName ?? ''}
            onChangeText={t => onChange({ displayName: t })}
            placeholder={monsterName}
            placeholderTextColor={Colors.textDim}
          />

          <Text style={styles.fieldLabel}>Quantity</Text>
          <View style={styles.stepperRow}>
            <Pressable style={styles.stepperBtn} onPress={() => onChange({ quantity: Math.max(1, combatant.quantity - 1) })}>
              <Text style={styles.stepperBtnTxt}>−</Text>
            </Pressable>
            <Text style={styles.stepperVal}>{combatant.quantity}</Text>
            <Pressable style={styles.stepperBtn} onPress={() => onChange({ quantity: combatant.quantity + 1 })}>
              <Text style={styles.stepperBtnTxt}>+</Text>
            </Pressable>
          </View>

          <Text style={styles.fieldLabel}>HP</Text>
          <View style={styles.chipRow}>
            {(Object.keys(HP_MODE_LABEL) as PreparedCombatantHpMode[]).map(mode => (
              <Pressable
                key={mode}
                style={[styles.chip, combatant.hpMode === mode && styles.chipActive]}
                onPress={() => onChange({ hpMode: mode })}
              >
                <Text style={[styles.chipTxt, combatant.hpMode === mode && styles.chipTxtActive]}>{HP_MODE_LABEL[mode]}</Text>
              </Pressable>
            ))}
          </View>
          {combatant.hpMode === 'manual' && (
            <TextInput
              style={styles.input}
              value={combatant.manualHp ? String(combatant.manualHp) : ''}
              onChangeText={t => onChange({ manualHp: parseInt(t, 10) || undefined })}
              keyboardType="number-pad"
              placeholder="HP amount"
              placeholderTextColor={Colors.textDim}
            />
          )}

          {groups.length > 0 && (
            <>
              <Text style={styles.fieldLabel}>Group</Text>
              <View style={styles.chipRow}>
                <Pressable style={[styles.chip, !combatant.groupId && styles.chipActive]} onPress={() => onChange({ groupId: undefined })}>
                  <Text style={[styles.chipTxt, !combatant.groupId && styles.chipTxtActive]}>None</Text>
                </Pressable>
                {groups.map(g => (
                  <Pressable key={g.id} style={[styles.chip, combatant.groupId === g.id && styles.chipActive]} onPress={() => onChange({ groupId: g.id })}>
                    <Text style={[styles.chipTxt, combatant.groupId === g.id && styles.chipTxtActive]}>{g.name}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}

          {waves.length > 0 && (
            <>
              <Text style={styles.fieldLabel}>Deployment</Text>
              <View style={styles.chipRow}>
                <Pressable style={[styles.chip, !combatant.waveId && styles.chipActive]} onPress={() => onChange({ waveId: undefined })}>
                  <Text style={[styles.chipTxt, !combatant.waveId && styles.chipTxtActive]}>Present from start</Text>
                </Pressable>
                {waves.map(w => (
                  <Pressable key={w.id} style={[styles.chip, combatant.waveId === w.id && styles.chipActive]} onPress={() => onChange({ waveId: w.id })}>
                    <Text style={[styles.chipTxt, combatant.waveId === w.id && styles.chipTxtActive]}>{w.name}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}

          <Text style={styles.fieldLabel}>Starting conditions</Text>
          <View style={styles.chipRow}>
            {ALL_CONDITIONS.slice(0, 12).map(c => {
              const active = (combatant.startingConditionIds ?? []).includes(c.id);
              return (
                <Pressable
                  key={c.id}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => {
                    const current = combatant.startingConditionIds ?? [];
                    onChange({
                      startingConditionIds: active ? current.filter(id => id !== c.id) : [...current, c.id],
                    });
                  }}
                >
                  <Text style={[styles.chipTxt, active && styles.chipTxtActive]}>{c.name}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.fieldLabel}>Notes</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={combatant.notes ?? ''}
            onChangeText={t => onChange({ notes: t })}
            placeholder="Tactics, flavor, anything DM-only…"
            placeholderTextColor={Colors.textDim}
            multiline
          />

          <Pressable style={styles.toggleRow} onPress={() => onChange({ hidden: !combatant.hidden })}>
            <Text style={styles.toggleTxt}>{combatant.hidden ? '☑' : '☐'} Hidden (not yet revealed to players)</Text>
          </Pressable>

          <View style={styles.rowActions}>
            <Pressable style={styles.rowActionBtn} onPress={onDuplicate}>
              <Text style={styles.rowActionTxt}>⧉ Duplicate</Text>
            </Pressable>
            <Pressable style={styles.rowActionBtn} onPress={onRemove}>
              <Text style={[styles.rowActionTxt, { color: Colors.red }]}>🗑 Remove</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function EncounterBuilderScreen() {
  const router = useRouter();
  const safeGoBack = useSafeGoBack('/dm/encounters');
  const { id } = useLocalSearchParams<{ id: string }>();
  const encounters = useEncounterStore(s => s.encounters);
  const saveDraft = useEncounterStore(s => s.saveEncounterDraft);
  const setStatus = useEncounterStore(s => s.setEncounterStatus);
  const homebrewMonsters = useHomebrewStore(s => s.monsters);
  const allTemplates = useMemo(() => mergeMonsterIndex(homebrewMonsters), [homebrewMonsters]);

  const source = encounters.find(e => e.id === id);
  const [draft, setDraft] = useState<PreparedEncounter | null>(source ?? null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);

  if (!draft) {
    return (
      <View style={styles.screen}>
        <View style={styles.center}>
          <Text style={styles.errorTxt}>Encounter not found.</Text>
          <Pressable style={styles.backBtn} onPress={safeGoBack}><Text style={styles.backTxt}>← Back</Text></Pressable>
        </View>
      </View>
    );
  }

  function patch(p: Partial<PreparedEncounter>) {
    setDraft(d => d ? { ...d, ...p } : d);
  }

  function patchCombatant(cid: string, p: Partial<PreparedCombatant>) {
    setDraft(d => d ? { ...d, combatants: d.combatants.map(c => c.id === cid ? { ...c, ...p } : c) } : d);
  }

  async function handleSave() {
    if (!draft) return;
    setSaving(true);
    try {
      await saveDraft(draft);
      Alert.alert('Saved', `"${draft.name}" saved.`);
    } finally {
      setSaving(false);
    }
  }

  function addMonster(monsterId: string) {
    setDraft(d => d ? { ...d, combatants: [...d.combatants, newPreparedCombatant(monsterId)] } : d);
  }

  function removeCombatant(cid: string) {
    setDraft(d => d ? { ...d, combatants: d.combatants.filter(c => c.id !== cid) } : d);
  }

  function duplicateCombatant(cid: string) {
    setDraft(d => {
      if (!d) return d;
      const source = d.combatants.find(c => c.id === cid);
      if (!source) return d;
      const copy = { ...source, id: `pc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}` };
      return { ...d, combatants: [...d.combatants, copy] };
    });
  }

  function addGroup() {
    setDraft(d => d ? { ...d, groups: [...d.groups, newEncounterGroup(`Group ${d.groups.length + 1}`)] } : d);
  }
  function renameGroup(gid: string, name: string) {
    setDraft(d => d ? { ...d, groups: d.groups.map(g => g.id === gid ? { ...g, name } : g) } : d);
  }
  function removeGroup(gid: string) {
    setDraft(d => d ? {
      ...d,
      groups: d.groups.filter(g => g.id !== gid),
      combatants: d.combatants.map(c => c.groupId === gid ? { ...c, groupId: undefined } : c),
    } : d);
  }

  function addWave() {
    setDraft(d => d ? { ...d, waves: [...d.waves, newEncounterWave(`Wave ${d.waves.length + 1}`)] } : d);
  }
  function patchWave(wid: string, p: Partial<PreparedEncounter['waves'][number]>) {
    setDraft(d => d ? { ...d, waves: d.waves.map(w => w.id === wid ? { ...w, ...p } : w) } : d);
  }
  function removeWave(wid: string) {
    setDraft(d => d ? {
      ...d,
      waves: d.waves.filter(w => w.id !== wid),
      combatants: d.combatants.map(c => c.waveId === wid ? { ...c, waveId: undefined } : c),
    } : d);
  }

  function addEnvironment() {
    setDraft(d => d ? { ...d, environment: [...d.environment, newEnvironmentEntry('New environmental note')] } : d);
  }
  function patchEnvironment(eid: string, p: Partial<PreparedEncounter['environment'][number]>) {
    setDraft(d => d ? { ...d, environment: d.environment.map(e => e.id === eid ? { ...e, ...p } : e) } : d);
  }
  function removeEnvironment(eid: string) {
    setDraft(d => d ? { ...d, environment: d.environment.filter(e => e.id !== eid) } : d);
  }

  function addReward(kind: EncounterRewardKind) {
    setDraft(d => d ? { ...d, rewards: [...d.rewards, newReward(kind, kind === 'xp' ? 'XP' : kind === 'currency' ? 'Currency' : kind === 'item' ? 'Item' : 'Reward')] } : d);
  }
  function patchReward(rid: string, p: Partial<PreparedEncounter['rewards'][number]>) {
    setDraft(d => d ? { ...d, rewards: d.rewards.map(r => r.id === rid ? { ...r, ...p } : r) } : d);
  }
  function removeReward(rid: string) {
    setDraft(d => d ? { ...d, rewards: d.rewards.filter(r => r.id !== rid) } : d);
  }

  function addTag() {
    const t = tagInput.trim();
    if (!t) return;
    setDraft(d => d && !d.tags.includes(t) ? { ...d, tags: [...d.tags, t] } : d);
    setTagInput('');
  }

  const combatantCount = draft.combatants.reduce((sum, c) => sum + Math.max(1, c.quantity), 0);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable style={styles.backBtnSm} onPress={safeGoBack}>
          <Text style={styles.backTxt}>← Back</Text>
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>{draft.name || 'Untitled Encounter'}</Text>
        <Pressable style={styles.saveBtn} onPress={() => { void handleSave(); }} disabled={saving}>
          <Text style={styles.saveBtnTxt}>{saving ? 'Saving…' : 'Save'}</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Section title="Basics">
          <Text style={styles.fieldLabel}>Name</Text>
          <TextInput style={styles.input} value={draft.name} onChangeText={t => patch({ name: t })} placeholder="Encounter name" placeholderTextColor={Colors.textDim} />

          <Text style={styles.fieldLabel}>Description</Text>
          <TextInput style={[styles.input, styles.textArea]} value={draft.description ?? ''} onChangeText={t => patch({ description: t })} placeholder="What's happening here…" placeholderTextColor={Colors.textDim} multiline />

          <Text style={styles.fieldLabel}>Location</Text>
          <TextInput style={styles.input} value={draft.location ?? ''} onChangeText={t => patch({ location: t })} placeholder="North Gate, the Sunken Temple…" placeholderTextColor={Colors.textDim} />

          <Text style={styles.fieldLabel}>DM Notes</Text>
          <TextInput style={[styles.input, styles.textArea]} value={draft.dmNotes ?? ''} onChangeText={t => patch({ dmNotes: t })} placeholder="Private planning notes…" placeholderTextColor={Colors.textDim} multiline />

          <Text style={styles.fieldLabel}>Expected Party</Text>
          <TextInput style={styles.input} value={draft.expectedPartyNote ?? ''} onChangeText={t => patch({ expectedPartyNote: t })} placeholder="e.g. 4 players, level 5" placeholderTextColor={Colors.textDim} />

          <Text style={styles.fieldLabel}>Status</Text>
          <View style={styles.chipRow}>
            {(['draft', 'ready', 'completed', 'archived'] as EncounterStatus[]).map(s => (
              <Pressable key={s} style={[styles.chip, draft.status === s && styles.chipActive]} onPress={() => { patch({ status: s }); void setStatus(draft.id, s); }}>
                <Text style={[styles.chipTxt, draft.status === s && styles.chipTxtActive]}>{s}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.fieldLabel}>Tags</Text>
          <View style={styles.tagInputRow}>
            <TextInput style={[styles.input, { flex: 1 }]} value={tagInput} onChangeText={setTagInput} placeholder="Add a tag…" placeholderTextColor={Colors.textDim} onSubmitEditing={addTag} />
            <Pressable style={styles.tagAddBtn} onPress={addTag}><Text style={styles.tagAddTxt}>Add</Text></Pressable>
          </View>
          <View style={styles.tagRow}>
            {draft.tags.map(t => (
              <Pressable key={t} style={styles.tag} onPress={() => patch({ tags: draft.tags.filter(x => x !== t) })}>
                <Text style={styles.tagTxt}>{t} ✕</Text>
              </Pressable>
            ))}
          </View>
        </Section>

        <Section title={`Combatants (${combatantCount})`} subtitle="Add from the compendium — official or homebrew.">
          {draft.combatants.map(c => {
            const template = allTemplates.find(t => t.id === c.monsterId);
            return (
              <CombatantRow
                key={c.id}
                combatant={c}
                monsterName={template?.name ?? c.monsterId}
                monsterCr={template?.cr ?? null}
                groups={draft.groups}
                waves={draft.waves}
                onChange={p => patchCombatant(c.id, p)}
                onRemove={() => removeCombatant(c.id)}
                onDuplicate={() => duplicateCombatant(c.id)}
              />
            );
          })}
          <Pressable style={styles.addBtn} onPress={() => setPickerOpen(true)}>
            <Text style={styles.addBtnTxt}>+ Add Monster</Text>
          </Pressable>
        </Section>

        <Section title="Groups" subtitle="Organize the DM UI — e.g. North Gate, Courtyard. Optional.">
          {draft.groups.map(g => (
            <View key={g.id} style={styles.listRow}>
              <TextInput style={[styles.input, { flex: 1 }]} value={g.name} onChangeText={t => renameGroup(g.id, t)} />
              <Pressable style={styles.removeBtn} onPress={() => removeGroup(g.id)}><Text style={styles.removeTxt}>✕</Text></Pressable>
            </View>
          ))}
          <Pressable style={styles.addBtn} onPress={addGroup}><Text style={styles.addBtnTxt}>+ Add Group</Text></Pressable>
        </Section>

        <Section title="Waves / Reinforcements" subtitle="A combatant assigned to a wave stays out of the fight until the DM deploys it.">
          {draft.waves.map(w => (
            <View key={w.id} style={styles.waveCard}>
              <TextInput style={styles.input} value={w.name} onChangeText={t => patchWave(w.id, { name: t })} />
              <View style={styles.chipRow}>
                {(['manual', 'round', 'descriptive'] as EncounterWaveTriggerKind[]).map(k => (
                  <Pressable key={k} style={[styles.chip, w.triggerKind === k && styles.chipActive]} onPress={() => patchWave(w.id, { triggerKind: k })}>
                    <Text style={[styles.chipTxt, w.triggerKind === k && styles.chipTxtActive]}>{k}</Text>
                  </Pressable>
                ))}
              </View>
              {w.triggerKind === 'round' && (
                <TextInput style={styles.input} value={w.triggerRound ? String(w.triggerRound) : ''} onChangeText={t => patchWave(w.id, { triggerRound: parseInt(t, 10) || undefined })} keyboardType="number-pad" placeholder="Round number" placeholderTextColor={Colors.textDim} />
              )}
              {w.triggerKind === 'descriptive' && (
                <TextInput style={styles.input} value={w.triggerNote ?? ''} onChangeText={t => patchWave(w.id, { triggerNote: t })} placeholder="e.g. When the alarm bell rings" placeholderTextColor={Colors.textDim} />
              )}
              <Pressable style={styles.removeBtnInline} onPress={() => removeWave(w.id)}><Text style={styles.removeTxt}>Remove Wave</Text></Pressable>
            </View>
          ))}
          <Pressable style={styles.addBtn} onPress={addWave}><Text style={styles.addBtnTxt}>+ Add Wave</Text></Pressable>
        </Section>

        <Section title="Environment" subtitle="Difficult terrain, darkness, hazards — descriptive by default.">
          {draft.environment.map(e => (
            <View key={e.id} style={styles.waveCard}>
              <TextInput style={styles.input} value={e.label} onChangeText={t => patchEnvironment(e.id, { label: t })} />
              <TextInput style={[styles.input, styles.textArea]} value={e.description ?? ''} onChangeText={t => patchEnvironment(e.id, { description: t })} placeholder="Effect, description…" placeholderTextColor={Colors.textDim} multiline />
              <Text style={styles.fieldLabel}>Linked condition (optional mechanical effect)</Text>
              <View style={styles.chipRow}>
                <Pressable style={[styles.chip, !e.conditionId && styles.chipActive]} onPress={() => patchEnvironment(e.id, { conditionId: undefined })}>
                  <Text style={[styles.chipTxt, !e.conditionId && styles.chipTxtActive]}>None (descriptive only)</Text>
                </Pressable>
                {ALL_CONDITIONS.slice(0, 10).map(c => (
                  <Pressable key={c.id} style={[styles.chip, e.conditionId === c.id && styles.chipActive]} onPress={() => patchEnvironment(e.id, { conditionId: c.id })}>
                    <Text style={[styles.chipTxt, e.conditionId === c.id && styles.chipTxtActive]}>{c.name}</Text>
                  </Pressable>
                ))}
              </View>
              <Pressable style={styles.removeBtnInline} onPress={() => removeEnvironment(e.id)}><Text style={styles.removeTxt}>Remove</Text></Pressable>
            </View>
          ))}
          <Pressable style={styles.addBtn} onPress={addEnvironment}><Text style={styles.addBtnTxt}>+ Add Environment Note</Text></Pressable>
        </Section>

        <Section title="Tactics & Outcomes">
          <Text style={styles.fieldLabel}>Tactics Notes</Text>
          <TextInput style={[styles.input, styles.textArea]} value={draft.tacticsNotes ?? ''} onChangeText={t => patch({ tacticsNotes: t })} placeholder="How the monsters fight…" placeholderTextColor={Colors.textDim} multiline />
          <Text style={styles.fieldLabel}>Victory / Retreat Notes</Text>
          <TextInput style={[styles.input, styles.textArea]} value={draft.victoryNotes ?? ''} onChangeText={t => patch({ victoryNotes: t })} placeholder="What happens if the party wins/loses/retreats…" placeholderTextColor={Colors.textDim} multiline />
        </Section>

        <Section title="Rewards" subtitle="Optional — not every table tracks XP.">
          {draft.rewards.map(r => (
            <View key={r.id} style={styles.listRow}>
              <View style={styles.rewardKindChip}><Text style={styles.rewardKindTxt}>{r.kind}</Text></View>
              <TextInput style={[styles.input, { flex: 1 }]} value={r.label} onChangeText={t => patchReward(r.id, { label: t })} />
              <Pressable style={styles.removeBtn} onPress={() => removeReward(r.id)}><Text style={styles.removeTxt}>✕</Text></Pressable>
            </View>
          ))}
          <View style={styles.chipRow}>
            <Pressable style={styles.addBtnSm} onPress={() => addReward('xp')}><Text style={styles.addBtnTxt}>+ XP</Text></Pressable>
            <Pressable style={styles.addBtnSm} onPress={() => addReward('currency')}><Text style={styles.addBtnTxt}>+ Currency</Text></Pressable>
            <Pressable style={styles.addBtnSm} onPress={() => addReward('item')}><Text style={styles.addBtnTxt}>+ Item</Text></Pressable>
            <Pressable style={styles.addBtnSm} onPress={() => addReward('custom')}><Text style={styles.addBtnTxt}>+ Custom</Text></Pressable>
          </View>
        </Section>

        <Pressable
          style={styles.startBtn}
          onPress={() => {
            void handleSave();
            router.push({ pathname: '/dm/encounter', params: { preparedId: draft.id } } as any);
          }}
        >
          <Text style={styles.startBtnTxt}>▶ Review & Start Encounter</Text>
        </Pressable>
      </ScrollView>

      <AddMonsterModal visible={pickerOpen} onClose={() => setPickerOpen(false)} onPick={addMonster} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
  errorTxt: { color: Colors.textSecondary },
  // ENCOUNTER-HEADER-1: was a flat `padding: Spacing.md` — every sibling DM
  // screen (dashboard.tsx, encounters.tsx, encounter.tsx) instead reserves
  // extra top clearance (paddingTop: Spacing.xl + 8) for the status bar/
  // notch, this screen was the one outlier missing it, sitting noticeably
  // higher/tighter against the top than the Encounter Library screen this
  // is reached from.
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: Spacing.xl + 8, paddingBottom: Spacing.md, paddingHorizontal: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.border, gap: Spacing.sm,
  },
  backBtn: { padding: Spacing.xs },
  backBtnSm: { padding: Spacing.xs, width: 60 },
  backTxt: { color: Colors.gold, fontSize: FontSize.md },
  title: { flex: 1, fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary, textAlign: 'center' },
  saveBtn: { backgroundColor: Colors.gold, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, width: 70, alignItems: 'center' },
  saveBtnTxt: { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.sm },
  scroll: { flex: 1 },
  content: { padding: Spacing.md, gap: Spacing.lg, paddingBottom: Spacing.xl * 2 },
  section: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.md, gap: Spacing.xs,
  },
  sectionTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.gold },
  sectionSub: { fontSize: FontSize.xs, color: Colors.textDim, marginBottom: Spacing.xs },
  fieldLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: FontWeight.bold, marginTop: Spacing.xs },
  input: {
    backgroundColor: Colors.bg, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.sm, color: Colors.textPrimary, fontSize: FontSize.sm,
  },
  textArea: { minHeight: 60, textAlignVertical: 'top' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  chip: { paddingHorizontal: Spacing.sm, paddingVertical: 6, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg },
  chipActive: { backgroundColor: Colors.gold, borderColor: Colors.gold },
  chipTxt: { fontSize: FontSize.xs, color: Colors.textSecondary },
  chipTxtActive: { color: Colors.bg, fontWeight: FontWeight.bold },
  tagInputRow: { flexDirection: 'row', gap: Spacing.xs, marginTop: 4 },
  tagAddBtn: { backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.sm, justifyContent: 'center' },
  tagAddTxt: { color: Colors.textPrimary, fontSize: FontSize.sm },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  tag: { backgroundColor: Colors.bg, borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: Colors.border },
  tagTxt: { fontSize: 10, color: Colors.textSecondary },
  addBtn: { marginTop: Spacing.sm, backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.gold, borderRadius: Radius.md, padding: Spacing.sm, alignItems: 'center' },
  addBtnSm: { backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.gold, borderRadius: Radius.md, paddingHorizontal: Spacing.sm, paddingVertical: 6 },
  addBtnTxt: { color: Colors.gold, fontWeight: FontWeight.bold, fontSize: FontSize.sm },
  combatantCard: { backgroundColor: Colors.bg, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, marginTop: Spacing.xs },
  combatantTop: { flexDirection: 'row', alignItems: 'center', padding: Spacing.sm },
  combatantName: { color: Colors.textPrimary, fontWeight: FontWeight.bold, fontSize: FontSize.sm },
  combatantMeta: { color: Colors.textDim, fontSize: FontSize.xs, marginTop: 2 },
  expandTxt: { color: Colors.textDim, fontSize: FontSize.xs },
  combatantBody: { padding: Spacing.sm, paddingTop: 0, gap: 4 },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: 4 },
  stepperBtn: { width: 32, height: 32, borderRadius: Radius.md, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  stepperBtnTxt: { color: Colors.textPrimary, fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  stepperVal: { color: Colors.textPrimary, fontSize: FontSize.md, fontWeight: FontWeight.bold, minWidth: 24, textAlign: 'center' },
  toggleRow: { marginTop: Spacing.xs },
  toggleTxt: { color: Colors.textSecondary, fontSize: FontSize.sm },
  rowActions: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.xs },
  rowActionBtn: { padding: 2 },
  rowActionTxt: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: FontWeight.bold },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: 4 },
  removeBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  removeBtnInline: { marginTop: Spacing.xs, alignSelf: 'flex-start' },
  removeTxt: { color: Colors.red, fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  waveCard: { backgroundColor: Colors.bg, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, padding: Spacing.sm, gap: 4, marginTop: Spacing.xs },
  rewardKindChip: { backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 4 },
  rewardKindTxt: { fontSize: 10, color: Colors.textSecondary, textTransform: 'uppercase' },
  pickerBackdrop: {},
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  pickerSheet: { backgroundColor: Colors.surface, borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg, padding: Spacing.md, gap: Spacing.sm, maxHeight: '80%' },
  pickerTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  pickerSearch: { backgroundColor: Colors.bg, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, padding: Spacing.sm, color: Colors.textPrimary },
  pickerRow: { paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  pickerRowName: { color: Colors.textPrimary, fontWeight: FontWeight.bold, fontSize: FontSize.sm },
  pickerRowMeta: { color: Colors.textDim, fontSize: FontSize.xs },
  pickerEmpty: { color: Colors.textDim, textAlign: 'center', padding: Spacing.md },
  pickerClose: { alignItems: 'center', padding: Spacing.sm },
  pickerCloseTxt: { color: Colors.textDim },
  startBtn: { backgroundColor: Colors.gold, borderRadius: Radius.lg, padding: Spacing.md, alignItems: 'center', marginTop: Spacing.sm },
  startBtnTxt: { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.md },
});
