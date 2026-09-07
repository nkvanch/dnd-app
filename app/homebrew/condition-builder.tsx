// app/homebrew/condition-builder.tsx
// Homebrew Condition builder — the 10th homebrew builder, closing the A-35
// gap (conditions were the one content type with no authoring UI at all).
// A Condition is the simplest content shape in the app: id + name +
// description + features[] — no rarity, no level, no class restriction. It
// reuses TraitListEditor (multi-trait authoring, same component race-builder
// and subrace-builder already use) rather than a single-trait picker like
// feat-builder, since a real condition can bundle more than one mechanical
// effect (e.g. Restrained: speed = 0 AND disadvantage on Dex saves).
//
// Resource-granting trait kinds are excluded (excludeKinds below) — Condition
// has no resources[] field, and a temporary/duration-bound content type
// carrying a persistent resource pool isn't a case anything in the app
// models. A condition applies via applyCondition() at runtime, not
// applyGrant() — the Test button below previews it the same way.
import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Condition, DraftTrait, Entity } from '../../src/engine/types';
import { validateRace } from '../../src/engine/homebrewValidator';
import { Alert } from '../../src/utils/alert';
import { useHomebrewStore } from '../../src/store/homebrewStore';
import { useSafeGoBack } from '../../src/hooks/useSafeGoBack';
import { SafeBottomView } from '../../src/components/SafeBottomView';
import { toId, buildTraitFeature, TraitListEditor } from '../../src/components/homebrew/TraitEditor';
import { applyCondition } from '../../src/engine/conditions';
import { simulate } from '../../src/engine/simulate';
import { buildFeatureGrantRows } from '../../src/components/sheet/featureGrantRows';
import { HomebrewTestModal, Row } from '../../src/components/homebrew/HomebrewTestModal';
import { makeEmptyEntity, DEFAULT_RULES } from '../../src/store/characterStore';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../src/theme';

export default function ConditionBuilderScreen() {
  const goBack   = useSafeGoBack('/(tabs)/homebrew');
  const saveItem = useHomebrewStore(s => s.saveItem);
  const conditions = useHomebrewStore(s => s.conditions);
  const { editId } = useLocalSearchParams<{ editId?: string }>();
  const editing  = editId ? conditions.find(c => c.id === editId) ?? null : null;

  const [name,        setName]        = useState('');
  const [description, setDescription] = useState('');
  const [traits,       setTraits]     = useState<DraftTrait[]>([]);

  const [saving, setSaving] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const [testRows, setTestRows] = useState<Row[]>([]);

  // Edit mode: hydrate the plain fields. The compiled Feature[] can't be
  // losslessly reversed back into DraftTrait[] (effects are already-compiled
  // Effect objects, not the authoring shape) — same accepted limitation
  // subclass-builder's edit-mode recovery has. Starts with an empty trait
  // list; the original mechanical effects stay in the saved condition until
  // traits are re-authored and the condition is saved again.
  useEffect(() => {
    if (!editing) return;
    setName(editing.name);
    setDescription(editing.description);
    setTraits([]);
  }, [editing?.id]);

  function buildCondition(): Condition {
    const id = editing?.id ?? (toId(name) || 'homebrew_condition');
    const features = [];
    const usedIds = new Set<string>();
    for (const t of traits) {
      const { feature, extraFeatures } = buildTraitFeature(t, { idPrefix: id, sourceKind: 'condition', sourceRefId: id, level: null, usedIds });
      features.push(feature, ...(extraFeatures ?? []));
      usedIds.add(feature.id);
    }
    return {
      id,
      name: name.trim(),
      description: description.trim(),
      features,
    };
  }

  // Read-only test on a disposable level-1 scratch entity — no save, no real
  // character touched. Uses applyCondition() directly, the same primitive
  // the real "Add Condition" flow uses, so the preview matches what actually
  // happens when a DM/player applies this condition in play.
  function runTest() {
    const cond = buildCondition();
    const empty = makeEmptyEntity('homebrew-test');
    const scratch: Entity = { ...empty, identity: { ...empty.identity, level: 1 } };
    const { before, after } = simulate(scratch, e => applyCondition(e, cond.id, 'test', DEFAULT_RULES, cond.features, null), DEFAULT_RULES);
    setTestRows(buildFeatureGrantRows(before, after));
    setTestOpen(true);
  }

  async function handleSave() {
    const cond = buildCondition();
    const { valid, errors, warnings } = validateRace(cond); // same shape: id + name + features[]
    if (!valid) {
      Alert.alert('Validation Errors', errors.join('\n'));
      return;
    }
    if (warnings.length > 0) {
      Alert.alert('Warnings', warnings.join('\n') + '\n\nSave anyway?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Save', onPress: () => doSave(cond) },
      ]);
      return;
    }
    doSave(cond);
  }

  async function doSave(cond: Condition) {
    if (saving) return;
    setSaving(true);
    try {
      await saveItem('condition', cond);
      goBack();
    } catch (e) {
      console.error('[condition-builder] save failed:', e);
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
        <Text style={styles.title}>{editing ? 'Edit Condition' : 'New Condition'}</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Name *</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName}
            placeholder="Condition name" placeholderTextColor={Colors.textDim} />
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Description *</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="What this condition does, in your own words…"
            placeholderTextColor={Colors.textDim}
            multiline textAlignVertical="top"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Mechanical Effects</Text>
          <Text style={styles.helperNote}>
            Add one trait per effect this condition applies — e.g. a speed=0 trait plus a
            separate disadvantage trait for something like Restrained. Effects with no clean
            mechanical mapping (auto-fail a check, advantage against the creature) are fine
            to leave undescribed here — put them in the description above instead.
          </Text>
          <TraitListEditor traits={traits} onChange={setTraits} excludeKinds={['resource_ability', 'spell_grant']} />
        </View>

      </ScrollView>

      <SafeBottomView>
        <View style={styles.footer}>
          <Pressable style={[styles.testBtn, !name.trim() && styles.btnDisabled]} onPress={runTest} disabled={!name.trim()}>
            <Text style={styles.testBtnTxt}>🧪 Test</Text>
          </Pressable>
          <Pressable style={[styles.saveBtn, (!name.trim() || !description.trim() || saving) && styles.btnDisabled]} onPress={handleSave} disabled={!name.trim() || !description.trim() || saving}>
            <Text style={styles.saveBtnTxt}>{saving ? 'Saving...' : 'Save Condition'}</Text>
          </Pressable>
        </View>
      </SafeBottomView>

      <HomebrewTestModal
        visible={testOpen}
        title={`Testing: ${name.trim() || 'New Condition'}`}
        rows={testRows}
        onClose={() => setTestOpen(false)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: Colors.bg },
  header: {
    backgroundColor: Colors.surfaceHigh, paddingTop: Spacing.xl + 8, paddingBottom: Spacing.md,
    paddingHorizontal: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: { marginBottom: 4 },
  backTxt: { color: Colors.gold, fontSize: FontSize.md, fontWeight: FontWeight.bold },
  title:   { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  scroll:  { flex: 1 },
  content: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xxl },
  field:   { gap: Spacing.xs },
  fieldLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, letterSpacing: 1, fontWeight: FontWeight.bold },
  helperNote: { fontSize: FontSize.xs, color: Colors.textDim, lineHeight: 16 },
  input: {
    backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.sm, color: Colors.textPrimary, fontSize: FontSize.md,
  },
  textArea:  { minHeight: 100 },
  footer:    { flexDirection: 'row', gap: Spacing.sm, padding: Spacing.sm, backgroundColor: Colors.surfaceHigh, borderTopWidth: 1, borderTopColor: Colors.border },
  testBtn:   { flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, alignItems: 'center' },
  testBtnTxt:  { color: Colors.textSecondary, fontWeight: FontWeight.bold, fontSize: FontSize.md },
  saveBtn:   { flex: 1, backgroundColor: Colors.gold, borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center' },
  btnDisabled: { opacity: 0.4 },
  saveBtnTxt:  { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.md },
});
