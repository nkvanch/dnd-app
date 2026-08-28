// app/homebrew/subclass-builder.tsx
// Attach a homebrew subclass to ANY existing class — official (PHB) or
// homebrew. There is no other homebrew subclass path today: subclasses live
// entirely in the static src/content/subclasses/ registry with no builder,
// no ContentCacheType entry, and no homebrewStore field before this screen.
// Mirrors app/homebrew/subrace-builder.tsx's shape (parent picker + a list
// of authored entries, here per-level features instead of per-race traits),
// and app/homebrew/class-builder.tsx's per-level feature authoring UI.
//
// Scope: makes homebrew subclasses author-able and BROWSABLE at parity with
// official ones (they show up in class-detail.tsx / subclass-detail.tsx).
// It does NOT wire subclass SELECTION during play — the subclass_unlock
// pending choice in src/engine/leveling.ts still queues an empty pool for
// every class, official or homebrew, pending a separately-tracked backlog
// item. Nothing regresses: official subclasses are equally unselectable today.
import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet, TextInput,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { DraftTrait, HomebrewSubclass, LevelEntry, Grant } from '../../src/engine/types';
import { useHomebrewStore } from '../../src/store/homebrewStore';
import { Alert } from '../../src/utils/alert';
import { useSafeGoBack } from '../../src/hooks/useSafeGoBack';
import { SafeBottomView } from '../../src/components/SafeBottomView';
import { newDraftTrait, buildTraitFeature, TraitEditorModal } from '../../src/components/homebrew/TraitEditor';
import { toId } from '../../src/content/traitCompiler';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../src/theme';

type LevelFeature = DraftTrait & { level: number };

const EFFECT_KIND_LABELS: Record<string, string> = {
  none: 'Flavor only', ability_score: 'Ability score bonus', skill_proficiency: 'Skill proficiency',
  tool_proficiency: 'Tool proficiency', advantage_disadvantage: 'Advantage/Disadvantage',
  sense: 'Grants a sense', movement: 'Grants movement', resource_ability: 'Limited-use ability',
};

/** Recovers a DraftTrait+level from a compiled LevelEntry's feature grants, for edit mode. */
function draftFeaturesFromEntries(entries: LevelEntry[]): LevelFeature[] {
  const out: LevelFeature[] = [];
  for (const entry of entries) {
    for (const grant of entry.grants) {
      if (grant.kind !== 'feature') continue;
      const f = grant.value as { id: string; name: string; description: string };
      out.push({ ...newDraftTrait(f.name), level: entry.level, description: f.description, effectKind: 'none' });
    }
  }
  return out;
}

export default function SubclassBuilderScreen() {
  const goBack   = useSafeGoBack('/(tabs)');
  const saveItem = useHomebrewStore(s => s.saveItem);
  const homebrewSubclasses = useHomebrewStore(s => s.subclasses);
  // See subrace-builder.tsx's comment on the same pattern — select the
  // function reference, call it in the render body, never select its
  // (freshly-object-per-call) return value directly.
  const getMergedContentDB = useHomebrewStore(s => s.getMergedContentDB);
  const allClasses = getMergedContentDB().classes;
  const { editId } = useLocalSearchParams<{ editId?: string }>();
  const editing = editId ? homebrewSubclasses.find(sc => sc.id === editId) ?? null : null;

  const [parentSearch, setParentSearch] = useState('');
  const [classId, setClassId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [levelFeatures, setLevelFeatures] = useState<LevelFeature[]>([]);
  const [addLevel, setAddLevel] = useState('3');
  const [addName,  setAddName]  = useState('');
  const [openFeatureId, setOpenFeatureId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Edit mode: a saved HomebrewSubclass is compiled ClassProgression.entries,
  // not a raw draft (subclasses have no homebrewDraft field — their features
  // are simpler than a race's flavor fields, so recovering name/description/
  // level from the compiled grants is lossless enough; only the mechanical
  // effect kind itself isn't recoverable, so it resets to 'none' on reload,
  // same disclosed tradeoff as any "edit compiled data" flow).
  useEffect(() => {
    if (!editing) return;
    setClassId(editing.classId);
    setName(editing.name);
    setLevelFeatures(draftFeaturesFromEntries(editing.entries));
  }, [editing?.id]);

  const parentClass = classId ? allClasses.find(c => c.id === classId) ?? null : null;
  const parentResults = parentSearch.trim().length > 0
    ? allClasses.filter(c => c.name.toLowerCase().includes(parentSearch.trim().toLowerCase())).slice(0, 12)
    : [];

  function addFeature() {
    const lvl = parseInt(addLevel, 10);
    const nm  = addName.trim();
    if (!nm || isNaN(lvl) || lvl < 1 || lvl > 20) return;
    const f: LevelFeature = { ...newDraftTrait(nm), level: lvl };
    setLevelFeatures(prev => [...prev, f]);
    setAddName('');
    setOpenFeatureId(f.localId);
  }
  function updateFeature(f: LevelFeature) {
    setLevelFeatures(prev => prev.map(x => x.localId === f.localId ? f : x));
  }
  function deleteFeature(localId: string) {
    setLevelFeatures(prev => prev.filter(x => x.localId !== localId));
    setOpenFeatureId(null);
  }

  const featuresByLevel = new Map<number, LevelFeature[]>();
  levelFeatures.forEach(f => {
    if (!featuresByLevel.has(f.level)) featuresByLevel.set(f.level, []);
    featuresByLevel.get(f.level)!.push(f);
  });
  const sortedLevels = Array.from(featuresByLevel.keys()).sort((a, b) => a - b);
  const openFeature = levelFeatures.find(f => f.localId === openFeatureId) ?? null;

  async function handleSave() {
    if (!name.trim() || !classId || !parentClass || saving) return;
    setSaving(true);
    const subclassId = editing?.id ?? (toId(name) || 'homebrew_subclass');
    // Every official subclass file mirrors its parent class's hit die on
    // each entry — LevelEntry.hpDie is mandatory, so derive it rather than
    // asking the author to re-specify a value that's already determined by
    // which class they picked.
    const hpDie = parentClass.hitDie as 4 | 6 | 8 | 10 | 12;
    const entries: LevelEntry[] = [];
    for (let level = 1; level <= 20; level++) {
      const grants: Grant[] = [];
      for (const f of (featuresByLevel.get(level) ?? [])) {
        const { feature, resource, extraFeatures, extraResources } = buildTraitFeature(f, {
          idPrefix: `${subclassId}_l${level}`, sourceKind: 'subclass', sourceRefId: subclassId, level,
        });
        grants.push({ kind: 'feature', value: feature });
        if (resource) grants.push({ kind: 'resource', value: resource });
        for (const ef of extraFeatures ?? []) grants.push({ kind: 'feature', value: ef });
        for (const er of extraResources ?? []) grants.push({ kind: 'resource', value: er });
      }
      entries.push({ level, hpDie, choices: [], grants });
    }
    const subclass: HomebrewSubclass = { id: subclassId, name: name.trim(), classId, entries };
    try {
      await saveItem('subclass', subclass);
      goBack();
    } catch (e) {
      console.error('[subclass-builder] save failed:', e);
      Alert.alert('Save failed', e instanceof Error ? e.message : 'Something went wrong. Check the console for details.');
    } finally {
      setSaving(false);
    }
  }

  const canSave = !!name.trim() && !!classId && !saving;

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={goBack}>
          <Text style={styles.backTxt}>{'<- Back'}</Text>
        </Pressable>
        <Text style={styles.title}>{editing ? 'Edit Subclass' : 'New Subclass'}</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        <Text style={styles.fieldLabel}>Parent Class *</Text>
        <Text style={styles.helperNote}>
          Works on official classes too — e.g. add a new subclass to Fighter or Wizard.
        </Text>
        {parentClass ? (
          <Pressable style={styles.selectedParent} onPress={() => setClassId(null)}>
            <Text style={styles.selectedParentTxt}>{parentClass.name}</Text>
            <Text style={styles.selectedParentChange}>Change</Text>
          </Pressable>
        ) : (
          <>
            <TextInput
              style={styles.input}
              value={parentSearch}
              onChangeText={setParentSearch}
              placeholder="Search classes…"
              placeholderTextColor={Colors.textDim}
            />
            {parentResults.length > 0 && (
              <View style={styles.parentResults}>
                {parentResults.map(c => (
                  <Pressable key={c.id} style={styles.parentResultRow} onPress={() => { setClassId(c.id); setParentSearch(''); }}>
                    <Text style={styles.parentResultTxt}>{c.name}</Text>
                    <Text style={styles.parentResultAdd}>Select</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </>
        )}

        <Text style={[styles.fieldLabel, { marginTop: Spacing.md }]}>Subclass Name *</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName}
          placeholder="e.g. Way of the Storm" placeholderTextColor={Colors.textDim} />

        <Text style={[styles.fieldLabel, { marginTop: Spacing.md }]}>Per-Level Features</Text>
        <Text style={styles.helperNote}>
          Add a feature by level and name, then tap it to optionally add a description and
          choose what it actually does — an ability score bonus, a skill proficiency, a sense,
          extra movement, or a limited-use ability.
        </Text>

        {sortedLevels.length === 0 ? (
          <Text style={styles.emptyNote}>No features added yet.</Text>
        ) : (
          sortedLevels.map(lvl => (
            <View key={lvl} style={styles.featureLevelGroup}>
              <Text style={styles.featureLevelLabel}>LEVEL {lvl}</Text>
              {featuresByLevel.get(lvl)!.map(f => (
                <Pressable key={f.localId} style={styles.featureItem} onPress={() => setOpenFeatureId(f.localId)}>
                  <View style={styles.featureItemBody}>
                    <Text style={styles.featureItemName}>{f.name}</Text>
                    <Text style={styles.featureItemDesc} numberOfLines={1}>{EFFECT_KIND_LABELS[f.effectKind]}</Text>
                  </View>
                  <Pressable style={styles.featureDeleteBtn} onPress={() => deleteFeature(f.localId)} hitSlop={8}>
                    <Text style={styles.featureDeleteTxt}>✕</Text>
                  </Pressable>
                </Pressable>
              ))}
            </View>
          ))
        )}

        <View style={styles.inlineAddRow}>
          <TextInput
            style={[styles.input, styles.smallInput]}
            value={addLevel}
            onChangeText={setAddLevel}
            keyboardType="number-pad"
            placeholder="Lv"
            placeholderTextColor={Colors.textDim}
          />
          <TextInput
            style={[styles.input, { flex: 1 }]}
            value={addName}
            onChangeText={setAddName}
            placeholder="Feature name (e.g. Storm Aura)"
            placeholderTextColor={Colors.textDim}
            onSubmitEditing={addFeature}
          />
          <Pressable style={styles.inlineAddBtn} onPress={addFeature}>
            <Text style={styles.inlineAddTxt}>Add</Text>
          </Pressable>
        </View>

      </ScrollView>

      <SafeBottomView>
        <View style={styles.footer}>
          <Pressable style={[styles.saveBtn, !canSave && styles.btnDisabled]} onPress={handleSave} disabled={!canSave}>
            <Text style={styles.saveBtnTxt}>{saving ? 'Saving...' : 'Save Subclass'}</Text>
          </Pressable>
        </View>
      </SafeBottomView>

      <TraitEditorModal
        trait={openFeature}
        visible={!!openFeature}
        onChange={t => updateFeature(t as LevelFeature)}
        onDone={() => setOpenFeatureId(null)}
        onDelete={() => openFeature && deleteFeature(openFeature.localId)}
      />
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
  smallInput: { width: 60 },

  selectedParent: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.gold + '11', borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.gold + '66',
    padding: Spacing.sm,
  },
  selectedParentTxt: { color: Colors.textPrimary, fontSize: FontSize.md, fontWeight: FontWeight.bold },
  selectedParentChange: { color: Colors.gold, fontSize: FontSize.xs, fontWeight: FontWeight.bold },

  parentResults: {
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, marginTop: 4, overflow: 'hidden',
  },
  parentResultRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  parentResultTxt: { color: Colors.textPrimary, fontSize: FontSize.sm, flex: 1 },
  parentResultAdd: { color: Colors.gold, fontSize: FontSize.xs, fontWeight: FontWeight.bold },

  emptyNote:         { color: Colors.textDim, fontSize: FontSize.sm, fontStyle: 'italic' },
  featureLevelGroup: { gap: Spacing.xs },
  featureLevelLabel: {
    fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.textDim,
    letterSpacing: 2, marginTop: Spacing.sm,
  },
  featureItem: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.sm, gap: Spacing.sm,
  },
  featureItemBody:  { flex: 1 },
  featureItemName:  { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  featureItemDesc:  { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2, lineHeight: 15 },
  featureDeleteBtn: { paddingLeft: Spacing.xs },
  featureDeleteTxt: { color: Colors.textDim, fontSize: FontSize.md },

  inlineAddRow: { flexDirection: 'row', gap: Spacing.xs, marginTop: Spacing.xs },
  inlineAddBtn: { backgroundColor: Colors.gold, borderRadius: Radius.md, paddingHorizontal: Spacing.md, justifyContent: 'center' },
  inlineAddTxt: { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.sm },

  footer:   { padding: Spacing.sm, backgroundColor: Colors.surfaceHigh, borderTopWidth: 1, borderTopColor: Colors.border },
  saveBtn:  { backgroundColor: Colors.gold, borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center' },
  btnDisabled: { opacity: 0.4 },
  saveBtnTxt:  { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.md },
});
