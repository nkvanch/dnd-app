// app/homebrew/feature-editor.tsx
// Homebrew feature editor — name, description, effects, activation toggle.
import { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, TextInput, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Feature, Effect } from '../../src/engine/types';
import { useHomebrewStore } from '../../src/store/homebrewStore';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../src/theme';

const EFFECT_TYPES = [
  'stat_modifier', 'grant_proficiency', 'grant_resistance',
  'grant_immunity', 'apply_condition', 'base_ac_formula',
] as const;

type EffectType = typeof EFFECT_TYPES[number];

function toId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function EffectRow({ effect, onRemove }: { effect: Effect; onRemove: () => void }) {
  return (
    <View style={styles.effectRow}>
      <Text style={styles.effectTxt}>{effect.type}: {effect.target} {effect.operation} {String(effect.value)}</Text>
      <Pressable onPress={onRemove} hitSlop={8}>
        <Text style={styles.removeBtn}>✕</Text>
      </Pressable>
    </View>
  );
}

function AddEffectPanel({ onAdd }: { onAdd: (e: Effect) => void }) {
  const [type,   setType]   = useState<EffectType>('stat_modifier');
  const [target, setTarget] = useState('');
  const [value,  setValue]  = useState('');

  function handleAdd() {
    if (!target.trim()) return;
    const numVal = parseFloat(value);
    onAdd({
      type,
      target:    target.trim(),
      operation: 'add',
      value:     isNaN(numVal) ? (value.trim() || null) : numVal,
      condition: null,
    } as Effect);
    setTarget(''); setValue('');
  }

  return (
    <View style={styles.addEffectPanel}>
      <Text style={styles.addEffectTitle}>Add Effect</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.xs }}>
        {EFFECT_TYPES.map(t => (
          <Pressable key={t} style={[styles.chip, type === t && styles.chipActive]} onPress={() => setType(t)}>
            <Text style={[styles.chipTxt, type === t && styles.chipTxtActive]}>{t}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <View style={styles.effectInputRow}>
        <TextInput style={[styles.input, { flex: 1 }]} value={target} onChangeText={setTarget}
          placeholder="Target (e.g. str, speed)" placeholderTextColor={Colors.textDim} />
        <TextInput style={[styles.input, { width: 80 }]} value={value} onChangeText={setValue}
          placeholder="Value" placeholderTextColor={Colors.textDim} keyboardType="numbers-and-punctuation" />
        <Pressable style={[styles.addBtn, !target.trim() && styles.btnDisabled]} onPress={handleAdd} disabled={!target.trim()}>
          <Text style={styles.addBtnTxt}>Add</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function FeatureEditorScreen() {
  const router   = useRouter();
  const saveItem = useHomebrewStore(s => s.saveItem);

  const [name,        setName]        = useState('');
  const [description, setDescription] = useState('');
  const [effects,     setEffects]     = useState<Effect[]>([]);
  const [passive,     setPassive]     = useState(true);

  async function handleSave() {
    if (!name.trim()) { Alert.alert('Name required'); return; }
    const id = toId(name) || 'homebrew_feature';
    const feature: Feature = {
      id, name: name.trim(), description: description.trim(),
      source: { kind: 'feat', refId: id },
      level: null, effects, actions: [], choices: [], passive,
    };
    await saveItem('feature', feature);
    Alert.alert('Saved!', `"${feature.name}" added to your homebrew library.`, [
      { text: 'OK', onPress: () => router.back() },
    ]);
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backTxt}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>New Feature</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.fieldLabel}>Feature Name *</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName}
          placeholder="e.g. Dark Vision Enhancement" placeholderTextColor={Colors.textDim} />

        <Text style={styles.fieldLabel}>Description</Text>
        <TextInput style={[styles.input, styles.textArea]} value={description} onChangeText={setDescription}
          placeholder="Describe what this feature does…" placeholderTextColor={Colors.textDim}
          multiline textAlignVertical="top" />

        <Pressable style={[styles.toggle, !passive && styles.toggleActive]} onPress={() => setPassive(p => !p)}>
          <Text style={[styles.toggleTxt, !passive && styles.toggleTxtActive]}>
            {passive ? '🔒 Passive (always active)' : '⚡ Active (needs activation)'}
          </Text>
        </Pressable>

        {effects.length > 0 && (
          <View style={styles.effectsList}>
            <Text style={styles.fieldLabel}>EFFECTS ({effects.length})</Text>
            {effects.map((e, i) => (
              <EffectRow key={i} effect={e} onRemove={() => setEffects(prev => prev.filter((_, j) => j !== i))} />
            ))}
          </View>
        )}

        <AddEffectPanel onAdd={e => setEffects(prev => [...prev, e])} />
      </ScrollView>

      <View style={styles.footer}>
        <Pressable style={[styles.saveBtn, !name.trim() && styles.btnDisabled]} onPress={handleSave} disabled={!name.trim()}>
          <Text style={styles.saveBtnTxt}>💾 Save Feature</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: Colors.bg },
  header:  { backgroundColor: Colors.surfaceHigh, paddingTop: Spacing.xl+8, paddingBottom: Spacing.md, paddingHorizontal: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backBtn: { marginBottom: 4 },
  backTxt: { color: Colors.gold, fontSize: FontSize.md, fontWeight: FontWeight.bold },
  title:   { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  scroll:  { flex: 1 },
  content: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: Spacing.xxl },
  fieldLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, letterSpacing: 1, fontWeight: FontWeight.bold },
  input:   { backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, padding: Spacing.sm, color: Colors.textPrimary, fontSize: FontSize.md },
  textArea:{ minHeight: 100 },
  toggle:  { backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.sm, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  toggleActive: { borderColor: Colors.gold, backgroundColor: Colors.gold + '22' },
  toggleTxt:    { color: Colors.textSecondary, fontSize: FontSize.sm },
  toggleTxtActive: { color: Colors.gold, fontWeight: FontWeight.bold },
  effectsList: { gap: Spacing.xs },
  effectRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.surfaceHigh, borderRadius: Radius.sm, padding: Spacing.sm },
  effectTxt:  { flex: 1, fontSize: FontSize.sm, color: Colors.textSecondary, fontFamily: 'monospace' },
  removeBtn:  { color: Colors.red, fontSize: FontSize.md },
  addEffectPanel: { backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, gap: Spacing.sm },
  addEffectTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textSecondary },
  chip:      { backgroundColor: Colors.surfaceHigh, borderRadius: Radius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 4, borderWidth: 1, borderColor: Colors.border },
  chipActive:{ borderColor: Colors.gold, backgroundColor: Colors.gold + '22' },
  chipTxt:   { fontSize: FontSize.xs, color: Colors.textSecondary },
  chipTxtActive: { color: Colors.gold, fontWeight: FontWeight.bold },
  effectInputRow: { flexDirection: 'row', gap: Spacing.xs, alignItems: 'center' },
  addBtn:    { backgroundColor: Colors.gold, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  btnDisabled: { opacity: 0.4 },
  addBtnTxt: { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.sm },
  footer:    { padding: Spacing.sm, backgroundColor: Colors.surfaceHigh, borderTopWidth: 1, borderTopColor: Colors.border },
  saveBtn:   { backgroundColor: Colors.gold, borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center' },
  saveBtnTxt:{ color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.md },
});
