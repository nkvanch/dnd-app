// app/homebrew/feature-editor.tsx
// Homebrew feature editor — name, description, effects, activation toggle.
import { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Feature, Effect, Entity } from '../../src/engine/types';
import { Alert } from '../../src/utils/alert';
import { useHomebrewStore } from '../../src/store/homebrewStore';
import { useSafeGoBack } from '../../src/hooks/useSafeGoBack';
import { SafeBottomView } from '../../src/components/SafeBottomView';
import { simulate } from '../../src/engine/simulate';
import { applyGrant } from '../../src/engine/leveling';
import { buildFeatSummaryRows } from '../../src/components/FeatPreviewModal';
import { HomebrewTestModal, Row } from '../../src/components/homebrew/HomebrewTestModal';
import { makeEmptyEntity, DEFAULT_RULES } from '../../src/store/characterStore';
import { mergeHomebrewDefinition } from '../../src/engine/homebrewRoundTrip';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../src/theme';

const EFFECT_TYPES = [
  'stat_modifier', 'grant_proficiency', 'grant_resistance',
  'grant_immunity', 'apply_condition', 'base_ac_formula',
] as const;

type EffectType = typeof EFFECT_TYPES[number];

const EFFECT_TYPE_LABELS: Record<EffectType, string> = {
  stat_modifier:     'Stat modifier',
  grant_proficiency: 'Grant proficiency',
  grant_resistance:  'Grant resistance',
  grant_immunity:    'Grant immunity',
  apply_condition:   'Apply condition',
  base_ac_formula:   'Base AC formula',
};

function toId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function EffectRow({ effect, onRemove }: { effect: Effect; onRemove: () => void }) {
  return (
    <View style={styles.effectRow}>
      <Text style={styles.effectTxt}>{EFFECT_TYPE_LABELS[effect.type as EffectType] ?? effect.type}: {effect.target} {effect.operation} {String(effect.value)}</Text>
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
            <Text style={[styles.chipTxt, type === t && styles.chipTxtActive]}>{EFFECT_TYPE_LABELS[t]}</Text>
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
  const goBack   = useSafeGoBack('/(tabs)');
  const saveItem = useHomebrewStore(s => s.saveItem);
  const homebrewFeatures = useHomebrewStore(s => s.features);
  const { editId } = useLocalSearchParams<{ editId?: string }>();
  const editing  = editId ? homebrewFeatures.find(f => f.id === editId) ?? null : null;

  const [name,        setName]        = useState('');
  const [description, setDescription] = useState('');
  const [effects,     setEffects]     = useState<Effect[]>([]);
  const [passive,     setPassive]     = useState(true);
  const [saving, setSaving] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const [testRows, setTestRows] = useState<Row[]>([]);

  // Edit mode: Feature.effects is stored as the exact same shape used at
  // runtime (unlike Race/Item, there's no separate compiled-vs-draft split
  // here), so this is a direct 1:1 reload, no reverse-engineering needed.
  useEffect(() => {
    if (!editing) return;
    setName(editing.name);
    setDescription(editing.description);
    setEffects(editing.effects);
    setPassive(editing.passive);
  }, [editing?.id]);

  function buildFeature(): Feature {
    const id = editing?.id ?? (toId(name) || 'homebrew_feature');
    return mergeHomebrewDefinition(editing, {
      id, name: name.trim(), description: description.trim(),
      source: editing?.source ?? { kind: 'feat', refId: id },
      level: editing?.level ?? null, effects, actions: editing?.actions ?? [], choices: editing?.choices ?? [], passive,
    });
  }

  // Read-only test on a disposable level-1 scratch entity — same pattern
  // feat-builder.tsx's runTest() uses (a bare Feature grant via
  // applyGrant() has no choice-resolution to worry about, unlike a full
  // Feat). Reuses FeatPreviewModal's buildFeatSummaryRows() as-is — a
  // Feature is exactly the shape it already diffs.
  function runTest() {
    const feature = buildFeature();
    const empty = makeEmptyEntity('homebrew-test');
    const scratch: Entity = { ...empty, identity: { ...empty.identity, level: 1 } };
    const { before, after } = simulate(scratch, e => applyGrant(e, { kind: 'feature', value: feature }, 0), DEFAULT_RULES);
    setTestRows(buildFeatSummaryRows(before, after));
    setTestOpen(true);
  }

  async function handleSave() {
    if (!name.trim() || saving) return;
    setSaving(true);
    const feature = buildFeature();
    try {
      await saveItem('feature', feature);
      goBack();
    } catch (e) {
      console.error('[feature-editor] save failed:', e);
      Alert.alert('Save failed', e instanceof Error ? e.message : 'Something went wrong. Check the console for details.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={goBack}>
          <Text style={styles.backTxt}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>{editing ? 'Edit Feature' : 'New Feature'}</Text>
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

      <SafeBottomView>
        <View style={styles.footer}>
          <Pressable style={[styles.testBtn, !name.trim() && styles.btnDisabled]} onPress={runTest} disabled={!name.trim()}>
            <Text style={styles.testBtnTxt}>🧪 Test</Text>
          </Pressable>
          <Pressable style={[styles.saveBtn, (!name.trim() || saving) && styles.btnDisabled]} onPress={() => { void handleSave(); }} disabled={!name.trim() || saving}>
            <Text style={styles.saveBtnTxt}>{saving ? 'Saving...' : 'Save Feature'}</Text>
          </Pressable>
        </View>
      </SafeBottomView>

      <HomebrewTestModal
        visible={testOpen}
        title={`Testing: ${name.trim() || 'New Feature'}`}
        rows={testRows}
        onClose={() => setTestOpen(false)}
      />
    </KeyboardAvoidingView>
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
  footer:    { flexDirection: 'row', gap: Spacing.sm, padding: Spacing.sm, backgroundColor: Colors.surfaceHigh, borderTopWidth: 1, borderTopColor: Colors.border },
  testBtn:   { flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, alignItems: 'center' },
  testBtnTxt:{ color: Colors.textSecondary, fontWeight: FontWeight.bold, fontSize: FontSize.md },
  saveBtn:   { flex: 1, backgroundColor: Colors.gold, borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center' },
  saveBtnTxt:{ color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.md },
});
