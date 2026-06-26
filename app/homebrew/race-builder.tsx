// app/homebrew/race-builder.tsx
// Homebrew race builder.
import { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, TextInput, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Race, Feature, Ability, SenseType, Sense, MovementSpeeds } from '../../src/engine/types';
import { useHomebrewStore } from '../../src/store/homebrewStore';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../src/theme';

const ABILITIES: Ability[] = ['str','dex','con','int','wis','cha'];
const SENSE_TYPES: { key: SenseType; label: string }[] = [
  { key: 'darkvision', label: 'Darkvision' }, { key: 'blindsight', label: 'Blindsight' },
  { key: 'tremorsense', label: 'Tremorsense' }, { key: 'truesight', label: 'Truesight' },
];
type MoveType = 'fly' | 'swim' | 'climb' | 'burrow';
const MOVE_TYPES: { key: MoveType; label: string }[] = [
  { key: 'fly', label: 'Fly' }, { key: 'swim', label: 'Swim' },
  { key: 'climb', label: 'Climb' }, { key: 'burrow', label: 'Burrow' },
];

function toId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

export default function RaceBuilderScreen() {
  const router   = useRouter();
  const saveItem = useHomebrewStore(s => s.saveItem);

  const [name,        setName]        = useState('');
  const [speed,       setSpeed]       = useState('30');
  const [description, setDescription] = useState('');
  const [abiBonuses,  setAbiBonuses]  = useState<Record<Ability, string>>({
    str: '', dex: '', con: '', int: '', wis: '', cha: '',
  });
  const [senses, setSenses] = useState<Sense[]>([]);
  const [draftSenseType, setDraftSenseType] = useState<SenseType>('darkvision');
  const [draftSenseRange, setDraftSenseRange] = useState('60');
  const [draftSenseNote, setDraftSenseNote] = useState('');
  const [movement, setMovement] = useState<MovementSpeeds>({});
  const [draftMoveType, setDraftMoveType] = useState<MoveType>('fly');
  const [draftMoveRange, setDraftMoveRange] = useState('30');
  const [extraFeature, setExtraFeature] = useState('');

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
      ...prev.filter(s => s.type !== draftSenseType),  // one entry per type
      { type: draftSenseType, range: r, note: draftSenseNote.trim() || undefined },
    ]);
    setDraftSenseNote('');
  }
  function removeSense(t: SenseType) {
    setSenses(prev => prev.filter(s => s.type !== t));
  }

  function buildRace(): Race {
    const id = toId(name) || 'homebrew_race';
    const features: Feature[] = [];

    // Ability score increases
    const asiEffects = ABILITIES
      .filter(a => parseInt(abiBonuses[a], 10) > 0)
      .map(a => ({
        type:      'stat_modifier' as const,
        target:    a,
        operation: 'add'          as const,
        value:     parseInt(abiBonuses[a], 10),
        condition: null,
      }));

    if (asiEffects.length > 0) {
      features.push({
        id: `${id}_asi`, name: 'Ability Score Increase',
        description: 'Your ability scores increase as shown.',
        source: { kind: 'race', refId: id },
        level: null, actions: [], choices: [], passive: true,
        effects: asiEffects,
      });
    }

    // Speed
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

    // Senses — one feature carrying a grant_sense effect per chosen sense, so
    // they aggregate into derived.senses and show on the sheet's exploration panel.
    if (senses.length > 0) {
      features.push({
        id: `${id}_senses`, name: 'Senses',
        description: senses.map(s =>
          `${SENSE_TYPES.find(t => t.key === s.type)?.label ?? s.type} ${s.range} ft` +
          (s.note ? ` (${s.note})` : '')
        ).join('; '),
        source: { kind: 'race', refId: id },
        level: null, actions: [], choices: [], passive: true,
        effects: senses.map(s => ({
          type:      'grant_sense' as const,
          target:    'senses',
          operation: 'add' as const,
          value:     null,
          condition: null,
          senseType:  s.type,
          senseRange: s.range,
          senseNote:  s.note,
        })),
      });
    }

    // Movement — grant_movement effects feed derived.movement (Travel section).
    const moveEntries = (Object.entries(movement) as [MoveType, number][]).filter(([, v]) => v > 0);
    if (moveEntries.length > 0) {
      features.push({
        id: `${id}_movement`, name: 'Movement',
        description: moveEntries.map(([t, v]) =>
          `${MOVE_TYPES.find(m => m.key === t)?.label ?? t} ${v} ft`
        ).join('; '),
        source: { kind: 'race', refId: id },
        level: null, actions: [], choices: [], passive: true,
        effects: moveEntries.map(([t, v]) => ({
          type:      'grant_movement' as const,
          target:    'movement',
          operation: 'add' as const,
          value:     null,
          condition: null,
          movementType:  t,
          movementRange: v,
        })),
      });
    }

    // Extra feature
    if (extraFeature.trim()) {
      features.push({
        id: `${id}_trait`, name: extraFeature.trim(),
        description: description.trim() || extraFeature.trim(),
        source: { kind: 'race', refId: id },
        level: null, effects: [], actions: [], choices: [], passive: true,
      });
    }

    return { id, name: name.trim(), features };
  }

  async function handleSave() {
    if (!name.trim()) { Alert.alert('Name required'); return; }
    const race = buildRace();
    await saveItem('race', race);
    Alert.alert('Saved!', `"${race.name}" added to your homebrew library.`, [
      { text: 'OK', onPress: () => router.back() },
    ]);
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backTxt}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>New Race</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        <Text style={styles.fieldLabel}>Race Name *</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName}
          placeholder="e.g. Aasimar" placeholderTextColor={Colors.textDim} />

        <Text style={styles.fieldLabel}>Base Speed (ft)</Text>
        <TextInput style={styles.input} value={speed} onChangeText={setSpeed}
          keyboardType="number-pad" placeholderTextColor={Colors.textDim} />

        <Text style={styles.fieldLabel}>Ability Score Bonuses</Text>
        <View style={styles.abiGrid}>
          {ABILITIES.map(a => (
            <View key={a} style={styles.abiBox}>
              <Text style={styles.abiLabel}>{a.toUpperCase()}</Text>
              <TextInput
                style={styles.abiInput}
                value={abiBonuses[a]}
                onChangeText={v => setAbiBonuses(prev => ({ ...prev, [a]: v }))}
                keyboardType="numbers-and-punctuation"
                placeholder="0"
                placeholderTextColor={Colors.textDim}
                textAlign="center"
              />
            </View>
          ))}
        </View>

        <Text style={styles.fieldLabel}>Senses</Text>
        {senses.length > 0 && (
          <View style={styles.senseChips}>
            {senses.map(s => (
              <View key={s.type} style={styles.senseChip}>
                <Text style={styles.senseChipTxt}>
                  {SENSE_TYPES.find(t => t.key === s.type)?.label} {s.range}ft{s.note ? ` · ${s.note}` : ''}
                </Text>
                <Pressable onPress={() => removeSense(s.type)} hitSlop={8}>
                  <Text style={styles.senseX}>✕</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}
        <View style={styles.senseTypeRow}>
          {SENSE_TYPES.map(t => (
            <Pressable
              key={t.key}
              style={[styles.chip, draftSenseType === t.key && styles.chipActive]}
              onPress={() => setDraftSenseType(t.key)}
            >
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
                  <Text style={styles.senseX}>✕</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}
        <View style={styles.senseTypeRow}>
          {MOVE_TYPES.map(t => (
            <Pressable
              key={t.key}
              style={[styles.chip, draftMoveType === t.key && styles.chipActive]}
              onPress={() => setDraftMoveType(t.key)}
            >
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

        <Text style={styles.fieldLabel}>Extra Trait Name (optional)</Text>
        <TextInput style={styles.input} value={extraFeature} onChangeText={setExtraFeature}
          placeholder="e.g. Celestial Resistance" placeholderTextColor={Colors.textDim} />

        <Text style={styles.fieldLabel}>Description</Text>
        <TextInput style={[styles.input, styles.textArea]} value={description} onChangeText={setDescription}
          placeholder="Describe this race…" placeholderTextColor={Colors.textDim} multiline textAlignVertical="top" />

      </ScrollView>

      <View style={styles.footer}>
        <Pressable style={[styles.saveBtn, !name.trim() && styles.btnDisabled]} onPress={handleSave} disabled={!name.trim()}>
          <Text style={styles.saveBtnTxt}>💾 Save Race</Text>
        </Pressable>
      </View>
    </View>
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
  input: { backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, padding: Spacing.sm, color: Colors.textPrimary, fontSize: FontSize.md },
  textArea: { minHeight: 100 },
  abiGrid: { flexDirection: 'row', gap: Spacing.xs },
  abiBox:  { flex: 1, alignItems: 'center', gap: 4 },
  abiLabel:{ fontSize: FontSize.xs, color: Colors.textSecondary },
  abiInput:{ backgroundColor: Colors.surface, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border, padding: Spacing.xs, color: Colors.textPrimary, width: '100%', textAlign: 'center' },
  toggle: { backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.sm, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  toggleActive: { borderColor: Colors.gold, backgroundColor: Colors.gold + '22' },
  toggleTxt:    { color: Colors.textSecondary, fontSize: FontSize.sm },
  toggleTxtActive: { color: Colors.gold, fontWeight: FontWeight.bold },
  chip:      { backgroundColor: Colors.surfaceHigh, borderRadius: Radius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 4, borderWidth: 1, borderColor: Colors.border },
  chipActive:{ borderColor: Colors.gold, backgroundColor: Colors.gold + '22' },
  chipTxt:   { fontSize: FontSize.xs, color: Colors.textSecondary },
  chipTxtActive: { color: Colors.gold, fontWeight: FontWeight.bold },
  senseTypeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  senseInputRow: { flexDirection: 'row', gap: Spacing.xs, alignItems: 'center' },
  senseAddBtn: { backgroundColor: Colors.gold, borderRadius: Radius.md, paddingHorizontal: Spacing.md, justifyContent: 'center' },
  senseAddTxt: { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.sm },
  senseChips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  senseChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.blue + '22', borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.blue + '55', paddingHorizontal: Spacing.sm, paddingVertical: 4 },
  senseChipTxt: { fontSize: FontSize.xs, color: Colors.textPrimary, fontWeight: FontWeight.bold },
  senseX: { color: Colors.red, fontSize: FontSize.sm },
  footer:   { padding: Spacing.sm, backgroundColor: Colors.surfaceHigh, borderTopWidth: 1, borderTopColor: Colors.border },
  saveBtn:  { backgroundColor: Colors.gold, borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center' },
  btnDisabled: { opacity: 0.4 },
  saveBtnTxt:  { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.md },
});
