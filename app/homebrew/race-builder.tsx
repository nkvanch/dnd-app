// app/homebrew/race-builder.tsx
// Homebrew race builder.
import { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, TextInput, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Race, Feature, Ability } from '../../src/engine/types';
import { useHomebrewStore } from '../../src/store/homebrewStore';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../src/theme';

const ABILITIES: Ability[] = ['str','dex','con','int','wis','cha'];

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
  const [darkvision, setDarkvision] = useState(false);
  const [extraFeature, setExtraFeature] = useState('');

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

    // Darkvision
    if (darkvision) {
      features.push({
        id: `${id}_darkvision`, name: 'Darkvision',
        description: 'You can see in dim light within 60 feet as if it were bright light.',
        source: { kind: 'race', refId: id },
        level: null, effects: [], actions: [], choices: [], passive: true,
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

        <Pressable style={[styles.toggle, darkvision && styles.toggleActive]} onPress={() => setDarkvision(d => !d)}>
          <Text style={[styles.toggleTxt, darkvision && styles.toggleTxtActive]}>👁 Darkvision (60 ft)</Text>
        </Pressable>

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
  footer:   { padding: Spacing.sm, backgroundColor: Colors.surfaceHigh, borderTopWidth: 1, borderTopColor: Colors.border },
  saveBtn:  { backgroundColor: Colors.gold, borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center' },
  btnDisabled: { opacity: 0.4 },
  saveBtnTxt:  { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.md },
});
