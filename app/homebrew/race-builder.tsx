// app/homebrew/race-builder.tsx
// Homebrew race builder — full rebuild. Adds: Age/Size/Languages (previously
// only official races could show these, via a hardcoded lookup table homebrew
// races had no way into — see the Race type's doc comment in engine/types.ts),
// a real multi-trait system (name-first add, optional description, and a real
// mechanical-effect picker per trait instead of one shared free-text field),
// and full subrace support (each with its own ability bonuses + trait list,
// consumed by the already-existing subrace picker in creation/race-detail.tsx).
import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet, TextInput, Modal,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Alert } from '../../src/utils/alert';
import {
  Race, Subrace, Feature, Ability, SenseType, Sense,
  MovementSpeeds, ResourceGrant, DraftTrait,
} from '../../src/engine/types';
import { useHomebrewStore } from '../../src/store/homebrewStore';
import { useSafeGoBack } from '../../src/hooks/useSafeGoBack';
import { SafeBottomView } from '../../src/components/SafeBottomView';
import {
  ABILITIES, SENSE_TYPES, MOVE_TYPES, MoveType, toId,
  DraftSubrace, newDraftSubrace, buildSubrace, buildTraitFeature,
  AbilityScoreGrid, TraitListEditor,
} from '../../src/components/homebrew/TraitEditor';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../src/theme';

const SIZES = ['Tiny', 'Small', 'Medium', 'Large'] as const;

// ── Subrace editor ───────────────────────────────────────────────────────────

function SubraceEditor({ subraces, onChange }: {
  subraces: DraftSubrace[];
  onChange: (s: DraftSubrace[]) => void;
}) {
  const [newName, setNewName] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  function addSubrace() {
    const name = newName.trim();
    if (!name) return;
    const sr = newDraftSubrace(name);
    onChange([...subraces, sr]);
    setNewName('');
    setOpenId(sr.localId);
  }
  function updateSubrace(sr: DraftSubrace) {
    onChange(subraces.map(x => x.localId === sr.localId ? sr : x));
  }
  function deleteSubrace(localId: string) {
    onChange(subraces.filter(x => x.localId !== localId));
    setOpenId(null);
  }

  const open = subraces.find(s => s.localId === openId) ?? null;

  return (
    <View style={{ gap: Spacing.xs }}>
      {subraces.map(sr => (
        <Pressable key={sr.localId} style={styles.traitCard} onPress={() => setOpenId(sr.localId)}>
          <View style={{ flex: 1 }}>
            <Text style={styles.traitCardName}>{sr.name}</Text>
            <Text style={styles.traitCardMeta}>{sr.traits.length} trait{sr.traits.length !== 1 ? 's' : ''}</Text>
          </View>
          <Text style={styles.traitCardCaret}>{'>'}</Text>
        </Pressable>
      ))}
      <View style={styles.senseInputRow}>
        <TextInput
          style={[styles.input, { flex: 1 }]}
          value={newName}
          onChangeText={setNewName}
          placeholder="Subrace name (e.g. Fire Pandafolk)"
          placeholderTextColor={Colors.textDim}
          onSubmitEditing={addSubrace}
        />
        <Pressable style={styles.senseAddBtn} onPress={addSubrace}>
          <Text style={styles.senseAddTxt}>Add</Text>
        </Pressable>
      </View>

      {/* Subrace detail modal — its own ASI grid + its own trait list, same pattern as the parent race */}
      <Modal visible={!!open} transparent animationType="slide" onRequestClose={() => setOpenId(null)}>
        <Pressable style={styles.backdrop} onPress={() => setOpenId(null)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ width: '100%' }}>
          <Pressable style={styles.traitModalSheet} onPress={e => e.stopPropagation()}>
            {open && (
              <ScrollView keyboardShouldPersistTaps="handled">
                <Text style={styles.traitModalTitle}>{open.name}</Text>

                <Text style={styles.fieldLabel}>Ability Score Bonuses</Text>
                <AbilityScoreGrid
                  values={open.abiBonuses}
                  onChange={(a, v) => updateSubrace({ ...open, abiBonuses: { ...open.abiBonuses, [a]: v } })}
                />

                <Text style={[styles.fieldLabel, { marginTop: Spacing.md }]}>Extra Traits</Text>
                <TraitListEditor
                  traits={open.traits}
                  onChange={traits => updateSubrace({ ...open, traits })}
                />

                <SafeBottomView>
                  <View style={styles.traitModalBtnRow}>
                    <Pressable style={styles.traitDeleteBtn} onPress={() => deleteSubrace(open.localId)}>
                      <Text style={styles.traitDeleteTxt}>Delete Subrace</Text>
                    </Pressable>
                    <Pressable style={styles.traitDoneBtn} onPress={() => setOpenId(null)}>
                      <Text style={styles.traitDoneTxt}>Done</Text>
                    </Pressable>
                  </View>
                </SafeBottomView>
              </ScrollView>
            )}
          </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>
    </View>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────────

export default function RaceBuilderScreen() {
  const goBack   = useSafeGoBack('/(tabs)');
  const saveItem = useHomebrewStore(s => s.saveItem);
  const homebrewRaces = useHomebrewStore(s => s.races);
  const { editId } = useLocalSearchParams<{ editId?: string }>();
  const editing = editId ? homebrewRaces.find(r => r.id === editId) ?? null : null;

  const [name,        setName]        = useState('');
  const [age,          setAge]         = useState('');
  const [size,         setSize]        = useState<typeof SIZES[number]>('Medium');
  const [speed,        setSpeed]       = useState('30');
  const [languages,    setLanguages]   = useState('Common');
  const [description,  setDescription] = useState('');
  const [abiBonuses,   setAbiBonuses]  = useState<Record<Ability, string>>({
    str: '', dex: '', con: '', int: '', wis: '', cha: '',
  });
  const [senses, setSenses] = useState<Sense[]>([]);
  const [draftSenseType, setDraftSenseType] = useState<SenseType>('darkvision');
  const [draftSenseRange, setDraftSenseRange] = useState('60');
  const [draftSenseNote, setDraftSenseNote] = useState('');
  const [movement, setMovement] = useState<MovementSpeeds>({});
  const [draftMoveType, setDraftMoveType] = useState<MoveType>('fly');
  const [draftMoveRange, setDraftMoveRange] = useState('30');
  const [traits, setTraits] = useState<DraftTrait[]>([]);
  const [subraces, setSubraces] = useState<DraftSubrace[]>([]);
  const [saving, setSaving] = useState(false);

  // Edit mode: restore the exact authoring state from homebrewDraft (see that
  // field's doc comment in engine/types.ts) rather than reverse-engineering
  // it from compiled Features — lossless, since homebrewDraft IS the state
  // this screen wrote when the race was last saved.
  useEffect(() => {
    if (!editing) return;
    setName(editing.name);
    setAge(editing.age ?? '');
    setSize(editing.size ?? 'Medium');
    setLanguages((editing.languages ?? ['Common']).join(', '));
    const draft = editing.homebrewDraft as Record<string, unknown> | undefined;
    if (draft) {
      setSpeed(String(draft.speed ?? '30'));
      setDescription(String(draft.description ?? ''));
      if (draft.abiBonuses) setAbiBonuses(draft.abiBonuses as Record<Ability, string>);
      if (draft.senses) setSenses(draft.senses as Sense[]);
      if (draft.movement) setMovement(draft.movement as MovementSpeeds);
      if (draft.traits) setTraits(draft.traits as DraftTrait[]);
      if (draft.subraces) setSubraces(draft.subraces as DraftSubrace[]);
    }
    // No draft (shouldn't happen for a race created by this builder, but
    // defensive for any other source) — the basics above still loaded, the
    // rest just starts blank rather than crashing.
  }, [editing?.id]);

  function addMovement() {
    const r = parseInt(draftMoveRange, 10);
    if (isNaN(r) || r <= 0) return;
    setMovement(prev => ({ ...prev, [draftMoveType]: r }));
  }
  function removeMovement(t: MoveType) {
    setMovement(prev => { const next = { ...prev }; delete next[t]; return next; });
  }
  function addSense() {
    const r = parseInt(draftSenseRange, 10);
    if (isNaN(r) || r <= 0) return;
    setSenses(prev => [
      ...prev.filter(s => s.type !== draftSenseType),
      { type: draftSenseType, range: r, note: draftSenseNote.trim() || undefined },
    ]);
    setDraftSenseNote('');
  }
  function removeSense(t: SenseType) {
    setSenses(prev => prev.filter(s => s.type !== t));
  }

  function buildRace(): Race {
    const id = editing?.id ?? (toId(name) || 'homebrew_race');
    const features: Feature[] = [];
    const resources: ResourceGrant[] = [];

    const asiEffects = ABILITIES
      .filter(a => parseInt(abiBonuses[a], 10) > 0)
      .map(a => ({
        type: 'stat_modifier' as const, target: a, operation: 'add' as const,
        value: parseInt(abiBonuses[a], 10), condition: null,
      }));
    if (asiEffects.length > 0) {
      features.push({
        id: `${id}_asi`, name: 'Ability Score Increase',
        description: 'Your ability scores increase as shown.',
        source: { kind: 'race', refId: id },
        level: null, actions: [], choices: [], passive: true, effects: asiEffects,
      });
    }

    const speedVal = parseInt(speed, 10) || 30;
    if (speedVal !== 30) {
      features.push({
        id: `${id}_speed`, name: 'Speed',
        description: `Your base walking speed is ${speedVal} feet.`,
        source: { kind: 'race', refId: id },
        level: null, actions: [], choices: [], passive: true,
        effects: [{ type: 'stat_modifier', target: 'speed', operation: 'set', value: speedVal, condition: null }],
      });
    }

    if (senses.length > 0) {
      features.push({
        id: `${id}_senses`, name: 'Senses',
        description: senses.map(s =>
          `${SENSE_TYPES.find(t => t.key === s.type)?.label ?? s.type} ${s.range} ft` + (s.note ? ` (${s.note})` : '')
        ).join('; '),
        source: { kind: 'race', refId: id },
        level: null, actions: [], choices: [], passive: true,
        effects: senses.map(s => ({
          type: 'grant_sense' as const, target: 'senses', operation: 'add' as const,
          value: null, condition: null, senseType: s.type, senseRange: s.range, senseNote: s.note,
        })),
      });
    }

    const moveEntries = (Object.entries(movement) as [MoveType, number][]).filter(([, v]) => v > 0);
    if (moveEntries.length > 0) {
      features.push({
        id: `${id}_movement`, name: 'Movement',
        description: moveEntries.map(([t, v]) => `${MOVE_TYPES.find(m => m.key === t)?.label ?? t} ${v} ft`).join('; '),
        source: { kind: 'race', refId: id },
        level: null, actions: [], choices: [], passive: true,
        effects: moveEntries.map(([t, v]) => ({
          type: 'grant_movement' as const, target: 'movement', operation: 'add' as const,
          value: null, condition: null, movementType: t, movementRange: v,
        })),
      });
    }

    for (const t of traits) {
      const { feature, resource, extraFeatures, extraResources } = buildTraitFeature(t, { idPrefix: id, sourceKind: 'race', sourceRefId: id, level: null });
      features.push(feature, ...(extraFeatures ?? []));
      if (resource) resources.push(resource);
      resources.push(...(extraResources ?? []));
    }

    const compiledSubraces: Subrace[] = subraces.map(sr => buildSubrace(sr, id));

    return {
      id, name: name.trim(), features,
      resources: resources.length > 0 ? resources : undefined,
      subraces: compiledSubraces.length > 0 ? compiledSubraces : undefined,
      age: age.trim() || undefined,
      size,
      languages: languages.trim() ? languages.split(',').map(l => l.trim()).filter(Boolean) : undefined,
      homebrewDraft: { speed, description, abiBonuses, senses, movement, traits, subraces },
    };
  }

  async function handleSave() {
    if (!name.trim() || saving) return;
    setSaving(true);
    const race = buildRace();
    try {
      await saveItem('race', race);
      goBack();
    } catch (e) {
      console.error('[race-builder] save failed:', e);
      Alert.alert('Save failed', e instanceof Error ? e.message : 'Something went wrong. Check the console for details.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={goBack}>
          <Text style={styles.backTxt}>{'<- Back'}</Text>
        </Pressable>
        <Text style={styles.title}>{editing ? 'Edit Race' : 'New Race'}</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        <Text style={styles.fieldLabel}>Race Name *</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName}
          placeholder="e.g. Pandafolk" placeholderTextColor={Colors.textDim} />

        <Text style={styles.fieldLabel}>Age (optional)</Text>
        <TextInput style={styles.input} value={age} onChangeText={setAge}
          placeholder="e.g. Reach adulthood around 16, live up to 250" placeholderTextColor={Colors.textDim} />

        <Text style={styles.fieldLabel}>Size</Text>
        <View style={styles.chipWrap}>
          {SIZES.map(s => (
            <Pressable key={s} style={[styles.chip, size === s && styles.chipActive]} onPress={() => setSize(s)}>
              <Text style={[styles.chipTxt, size === s && styles.chipTxtActive]}>{s}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.fieldLabel}>Base Speed (ft)</Text>
        <TextInput style={styles.input} value={speed} onChangeText={setSpeed}
          keyboardType="number-pad" placeholderTextColor={Colors.textDim} />

        <Text style={styles.fieldLabel}>Languages (comma-separated)</Text>
        <TextInput style={styles.input} value={languages} onChangeText={setLanguages}
          placeholder="e.g. Common, Draconic" placeholderTextColor={Colors.textDim} />

        <Text style={styles.fieldLabel}>Ability Score Bonuses</Text>
        <AbilityScoreGrid values={abiBonuses} onChange={(a, v) => setAbiBonuses(prev => ({ ...prev, [a]: v }))} />

        <Text style={styles.fieldLabel}>Senses</Text>
        {senses.length > 0 && (
          <View style={styles.senseChips}>
            {senses.map(s => (
              <View key={s.type} style={styles.senseChip}>
                <Text style={styles.senseChipTxt}>
                  {SENSE_TYPES.find(t => t.key === s.type)?.label} {s.range}ft{s.note ? ` (${s.note})` : ''}
                </Text>
                <Pressable onPress={() => removeSense(s.type)} hitSlop={8}>
                  <Text style={styles.senseX}>X</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}
        <View style={styles.senseTypeRow}>
          {SENSE_TYPES.map(t => (
            <Pressable key={t.key} style={[styles.chip, draftSenseType === t.key && styles.chipActive]}
              onPress={() => setDraftSenseType(t.key)}>
              <Text style={[styles.chipTxt, draftSenseType === t.key && styles.chipTxtActive]}>{t.label}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.senseInputRow}>
          <TextInput style={[styles.input, { flex: 1 }]} value={draftSenseRange} onChangeText={setDraftSenseRange}
            keyboardType="number-pad" placeholder="Range (ft)" placeholderTextColor={Colors.textDim} />
          <TextInput style={[styles.input, { flex: 2 }]} value={draftSenseNote} onChangeText={setDraftSenseNote}
            placeholder="Note (e.g. in color, heat)" placeholderTextColor={Colors.textDim} />
          <Pressable style={styles.senseAddBtn} onPress={addSense}>
            <Text style={styles.senseAddTxt}>Add</Text>
          </Pressable>
        </View>

        <Text style={styles.fieldLabel}>Movement (fly / swim / climb / burrow)</Text>
        {Object.keys(movement).length > 0 && (
          <View style={styles.senseChips}>
            {(Object.entries(movement) as [MoveType, number][]).map(([t, v]) => (
              <View key={t} style={styles.senseChip}>
                <Text style={styles.senseChipTxt}>{MOVE_TYPES.find(m => m.key === t)?.label} {v}ft</Text>
                <Pressable onPress={() => removeMovement(t)} hitSlop={8}>
                  <Text style={styles.senseX}>X</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}
        <View style={styles.senseTypeRow}>
          {MOVE_TYPES.map(t => (
            <Pressable key={t.key} style={[styles.chip, draftMoveType === t.key && styles.chipActive]}
              onPress={() => setDraftMoveType(t.key)}>
              <Text style={[styles.chipTxt, draftMoveType === t.key && styles.chipTxtActive]}>{t.label}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.senseInputRow}>
          <TextInput style={[styles.input, { flex: 1 }]} value={draftMoveRange} onChangeText={setDraftMoveRange}
            keyboardType="number-pad" placeholder="Speed (ft)" placeholderTextColor={Colors.textDim} />
          <Pressable style={styles.senseAddBtn} onPress={addMovement}>
            <Text style={styles.senseAddTxt}>Add</Text>
          </Pressable>
        </View>

        <Text style={styles.fieldLabel}>Extra Traits</Text>
        <Text style={styles.helperNote}>
          Add a trait by name, then tap it to optionally add a description and choose
          what it actually does -- an ability score bonus, a skill proficiency, a sense,
          extra movement, or a limited-use ability like a bonus-action self-heal.
        </Text>
        <TraitListEditor traits={traits} onChange={setTraits} />

        <Text style={[styles.fieldLabel, { marginTop: Spacing.md }]}>Subraces (optional)</Text>
        <Text style={styles.helperNote}>
          If added, players choosing this race will be required to pick one --
          each subrace gets its own ability score bonuses and its own trait list.
        </Text>
        <SubraceEditor subraces={subraces} onChange={setSubraces} />

        <Text style={[styles.fieldLabel, { marginTop: Spacing.md }]}>Overview Description</Text>
        <TextInput style={[styles.input, styles.textArea]} value={description} onChangeText={setDescription}
          placeholder="A short flavor overview of this race..." placeholderTextColor={Colors.textDim} multiline textAlignVertical="top" />

      </ScrollView>

      <SafeBottomView>
        <View style={styles.footer}>
          <Pressable style={[styles.saveBtn, (!name.trim() || saving) && styles.btnDisabled]} onPress={handleSave} disabled={!name.trim() || saving}>
            <Text style={styles.saveBtnTxt}>{saving ? 'Saving...' : 'Save Race'}</Text>
          </Pressable>
        </View>
      </SafeBottomView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: Colors.bg },
  header: { backgroundColor: Colors.surfaceHigh, paddingTop: Spacing.xl + 8, paddingBottom: Spacing.md, paddingHorizontal: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backBtn: { marginBottom: 4 },
  backTxt: { color: Colors.gold, fontSize: FontSize.md, fontWeight: FontWeight.bold },
  title:   { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  scroll:  { flex: 1 },
  content: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: Spacing.xxl },
  fieldLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, letterSpacing: 1, fontWeight: FontWeight.bold },
  helperNote: { fontSize: FontSize.xs, color: Colors.textDim, lineHeight: 16, marginTop: -4 },
  input: { backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, padding: Spacing.sm, color: Colors.textPrimary, fontSize: FontSize.md },
  smallInput: { width: 80 },
  textArea: { minHeight: 100 },
  abiGrid: { flexDirection: 'row', gap: Spacing.xs },
  abiBox:  { flex: 1, alignItems: 'center', gap: 4 },
  abiLabel:{ fontSize: FontSize.xs, color: Colors.textSecondary },
  abiInput:{ backgroundColor: Colors.surface, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border, padding: Spacing.xs, color: Colors.textPrimary, width: '100%', textAlign: 'center' },
  chip:      { backgroundColor: Colors.surfaceHigh, borderRadius: Radius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 4, borderWidth: 1, borderColor: Colors.border },
  chipActive:{ borderColor: Colors.gold, backgroundColor: Colors.gold + '22' },
  chipTxt:   { fontSize: FontSize.xs, color: Colors.textSecondary },
  chipTxtActive: { color: Colors.gold, fontWeight: FontWeight.bold },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  senseTypeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  senseInputRow: { flexDirection: 'row', gap: Spacing.xs, alignItems: 'center' },
  senseAddBtn: { backgroundColor: Colors.gold, borderRadius: Radius.md, paddingHorizontal: Spacing.md, justifyContent: 'center' },
  senseAddTxt: { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.sm },
  senseChips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  senseChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.blue + '22', borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.blue + '55', paddingHorizontal: Spacing.sm, paddingVertical: 4 },
  senseChipTxt: { fontSize: FontSize.xs, color: Colors.textPrimary, fontWeight: FontWeight.bold },
  senseX: { color: Colors.red, fontSize: FontSize.sm },

  traitCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.sm,
  },
  traitCardName: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  traitCardMeta: { fontSize: FontSize.xs, color: Colors.textDim, marginTop: 2 },
  traitCardCaret: { fontSize: FontSize.lg, color: Colors.textDim },

  backdrop: { flex: 1, backgroundColor: '#000000bb', justifyContent: 'flex-end' },
  traitModalSheet: {
    backgroundColor: Colors.surfaceHigh,
    borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg,
    padding: Spacing.lg, maxHeight: '85%',
  },
  traitModalTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.gold, marginBottom: Spacing.md, textAlign: 'center' },
  effectPanel: {
    backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.sm, gap: Spacing.sm, marginTop: Spacing.xs,
  },
  effectNote: { fontSize: FontSize.xs, color: Colors.textDim, lineHeight: 16, fontStyle: 'italic' },
  rowInline: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  inlineLabel: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.bold },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  checkbox: { width: 18, height: 18, borderRadius: 4, borderWidth: 2, borderColor: Colors.border },
  checkboxChecked: { backgroundColor: Colors.gold, borderColor: Colors.gold },
  toggleTxt: { fontSize: FontSize.sm, color: Colors.textSecondary, flex: 1 },

  traitModalBtnRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.lg },
  traitDeleteBtn: { flex: 1, backgroundColor: Colors.red + '22', borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.red + '66', padding: Spacing.sm, alignItems: 'center' },
  traitDeleteTxt: { color: Colors.red, fontWeight: FontWeight.bold, fontSize: FontSize.sm },
  traitDoneBtn: { flex: 2, backgroundColor: Colors.gold, borderRadius: Radius.md, padding: Spacing.sm, alignItems: 'center' },
  traitDoneTxt: { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.sm },

  footer:   { padding: Spacing.sm, backgroundColor: Colors.surfaceHigh, borderTopWidth: 1, borderTopColor: Colors.border },
  saveBtn:  { backgroundColor: Colors.gold, borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center' },
  btnDisabled: { opacity: 0.4 },
  saveBtnTxt:  { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.md },
});
