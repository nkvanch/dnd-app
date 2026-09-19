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
import { DraftTrait, HomebrewSubclass, LevelEntry, Grant, Entity, asSubclassId, RulesetId, Feature } from '../../src/engine/types';
import {
  ChoiceDefinitionEditorModal, DraftChoice, newDraftChoice,
} from '../../src/components/homebrew/ChoiceDefinitionEditor';
import { useHomebrewStore } from '../../src/store/homebrewStore';
import { usePendingSelectionStore } from '../../src/store/pendingSelectionStore';
import { GameRulesetPicker } from '../../src/components/homebrew/GameRulesetPicker';
import { gameIdForRuleset } from '../../src/content/rulesets';
import { Alert } from '../../src/utils/alert';
import { useSafeGoBack } from '../../src/hooks/useSafeGoBack';
import { SafeBottomView } from '../../src/components/SafeBottomView';
import { newDraftTrait, buildTraitFeature, TraitEditorModal } from '../../src/components/homebrew/TraitEditor';
import { toId, disambiguateId } from '../../src/content/traitCompiler';
import { FULL_SUBCLASS_LIBRARY } from '../../src/content/subclasses/index';
import { deriveSubclassId } from '../../src/content/subclasses/subclassBrowse';
import { simulate } from '../../src/engine/simulate';
import { applyGrant } from '../../src/engine/leveling';
import { buildFeatSummaryRows } from '../../src/components/FeatPreviewModal';
import { HomebrewTestModal, Row } from '../../src/components/homebrew/HomebrewTestModal';
import { useCharacterStore, makeEmptyEntity, DEFAULT_RULES } from '../../src/store/characterStore';
import { mergeHomebrewDefinition } from '../../src/engine/homebrewRoundTrip';
import { hydrateLeveledChoices, mergeSubclassEntries, LeveledLosslessDraftChoice, SubclassFeatureEdit } from '../../src/engine/homebrewNestedSerializers';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../src/theme';

// Re-audit A05: originalFeature carries the compiled Feature this DraftTrait
// was hydrated from (edit mode only — undefined for a freshly-added
// feature), so buildHomebrewSubclass can pass it through verbatim if the
// user never actually opens/edits this specific feature, instead of
// recompiling the "effectKind: none" placeholder hydration seeds it with.
type LevelFeature = DraftTrait & { level: number; originalFeature?: Feature };
type LevelChoice = LeveledLosslessDraftChoice;

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
      const f = grant.value as Feature;
      out.push({ ...newDraftTrait(f.name), level: entry.level, description: f.description, effectKind: 'none', originalFeature: f });
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
  // NESTED-HOMEBREW-1: an optional `classId` route param pre-selects the
  // parent class when reached from class-detail.tsx's/subclass.tsx's own
  // "+ Create New Homebrew Subclass" entry point (same pattern as
  // subrace-builder.tsx's `parentId` param).
  const { editId, classId: classIdParam } = useLocalSearchParams<{ editId?: string; classId?: string }>();
  const editing = editId ? homebrewSubclasses.find(sc => sc.id === editId) ?? null : null;
  // HOMEBREW-RULESET-1 (item 2): prefer the parent class's own ruleset (same
  // "most specific ambient default" precedent as subrace-builder.tsx),
  // falling back to the character/campaign draft's ruleset when no parent
  // class is known yet.
  const initialParentClass = classIdParam ? allClasses.find(c => c.id === classIdParam) ?? null : null;
  const draftRulesetId = useCharacterStore(s => s.draft?.rulesetId);
  const [rulesetId, setRulesetId] = useState<RulesetId | undefined>(
    () => editing ? editing.rulesetId : (initialParentClass?.rulesetId ?? draftRulesetId),
  );

  const [parentSearch, setParentSearch] = useState('');
  const [classId, setClassId] = useState<string | null>(classIdParam ?? null);
  const [name, setName] = useState('');
  const [levelFeatures, setLevelFeatures] = useState<LevelFeature[]>([]);
  // Re-audit A05: which feature localIds the user has actually opened and
  // edited this session — buildHomebrewSubclass uses this to decide whether
  // to preserve a feature's originalFeature verbatim or recompile it from
  // the DraftTrait. A freshly-added feature (no originalFeature) is always
  // compiled from its trait regardless of this set.
  const [touchedFeatureIds, setTouchedFeatureIds] = useState<Set<string>>(new Set());
  const [addLevel, setAddLevel] = useState('3');
  const [addName,  setAddName]  = useState('');
  const [openFeatureId, setOpenFeatureId] = useState<string | null>(null);
  const [levelChoicesList, setLevelChoicesList] = useState<LevelChoice[]>([]);
  const [addChoiceLevel, setAddChoiceLevel] = useState('3');
  const [openChoiceId, setOpenChoiceId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const [testRows, setTestRows] = useState<Row[]>([]);

  // Edit mode: a saved HomebrewSubclass is compiled ClassProgression.entries,
  // not a raw draft (subclasses have no homebrewDraft field — their features
  // are simpler than a race's flavor fields, so recovering name/description/
  // level from the compiled grants is lossless enough for display; the
  // mechanical effect kind itself isn't recoverable into the EDITOR UI, so
  // it shows as 'none' until opened. Re-audit A05: this is a display/re-
  // editing limitation only, not a data-loss one — draftFeaturesFromEntries
  // carries the real originalFeature alongside, and buildHomebrewSubclass
  // uses it verbatim for any feature the user never actually opens/edits.
  useEffect(() => {
    if (!editing) return;
    setClassId(editing.classId);
    setName(editing.name);
    setRulesetId(editing.rulesetId);
    setLevelFeatures(draftFeaturesFromEntries(editing.entries));
    setLevelChoicesList(hydrateLeveledChoices(editing.entries.map(e => ({ level: e.level, choices: e.choices })), editing.id));
    setTouchedFeatureIds(new Set());
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
    setTouchedFeatureIds(prev => new Set(prev).add(f.localId));
  }
  function deleteFeature(localId: string) {
    setLevelFeatures(prev => prev.filter(x => x.localId !== localId));
    setOpenFeatureId(null);
  }

  function addLevelChoice() {
    const lvl = parseInt(addChoiceLevel, 10);
    if (isNaN(lvl) || lvl < 1 || lvl > 20) return;
    const d: LevelChoice = { ...newDraftChoice('tool'), level: lvl };
    setLevelChoicesList(prev => [...prev, d]);
    setOpenChoiceId(d.localId);
  }
  function updateLevelChoice(d: DraftChoice) {
    setLevelChoicesList(prev => prev.map(x => x.localId === d.localId ? { ...x, ...d } : x));
  }
  function deleteLevelChoice(localId: string) {
    setLevelChoicesList(prev => prev.filter(x => x.localId !== localId));
    setOpenChoiceId(null);
  }

  const featuresByLevel = new Map<number, LevelFeature[]>();
  levelFeatures.forEach(f => {
    if (!featuresByLevel.has(f.level)) featuresByLevel.set(f.level, []);
    featuresByLevel.get(f.level)!.push(f);
  });
  const sortedLevels = Array.from(featuresByLevel.keys()).sort((a, b) => a - b);
  const openFeature = levelFeatures.find(f => f.localId === openFeatureId) ?? null;

  function buildHomebrewSubclass(): HomebrewSubclass | null {
    if (!classId || !parentClass) return null;
    // HOMEBREW-ID-COLLISION-1: see race-builder.tsx's identical fix.
    // SubclassProgression has no top-level `id` — its identity is derived
    // from its features' source.refId (see subclassBrowse.ts's own doc
    // comment); reuse that same derivation rather than inventing a second one.
    const takenSubclassIds = new Set([
      ...FULL_SUBCLASS_LIBRARY.map(deriveSubclassId),
      ...homebrewSubclasses.filter(s => s.id !== editing?.id).map(s => s.id),
    ]);
    const subclassId = editing?.id ?? disambiguateId(toId(name) || 'homebrew_subclass', takenSubclassIds);
    // Every official subclass file mirrors its parent class's hit die on
    // each entry — LevelEntry.hpDie is mandatory, so derive it rather than
    // asking the author to re-specify a value that's already determined by
    // which class they picked.
    const hpDie = parentClass.hitDie as 4 | 6 | 8 | 10 | 12;
    const featureEdits: SubclassFeatureEdit[] = [];
    for (let level = 1; level <= 20; level++) {
      const usedIds = new Set<string>();
      for (const f of (featuresByLevel.get(level) ?? [])) {
        if (f.originalFeature && !touchedFeatureIds.has(f.localId)) {
          featureEdits.push({ level, originalFeatureId: f.originalFeature.id, grants: [{ kind: 'feature', value: f.originalFeature }] });
          usedIds.add(f.originalFeature.id);
          continue;
        }
        const built = buildTraitFeature(f, { idPrefix: `${subclassId}_l${level}`, sourceKind: 'subclass', sourceRefId: subclassId, level, usedIds });
        const grants: Grant[] = [{ kind: 'feature', value: built.feature }];
        if (built.resource) grants.push({ kind: 'resource', value: built.resource });
        for (const feature of built.extraFeatures ?? []) grants.push({ kind: 'feature', value: feature });
        for (const resource of built.extraResources ?? []) grants.push({ kind: 'resource', value: resource });
        featureEdits.push({ level, originalFeatureId: f.originalFeature?.id, grants });
      }
    }
    const entries = mergeSubclassEntries(editing?.entries, featureEdits, levelChoicesList, hpDie, subclassId);
    return mergeHomebrewDefinition(editing, { id: asSubclassId(subclassId), name: name.trim(), classId, entries, rulesetId });
  }

  // Read-only test: apply EVERY authored level's grants to a disposable
  // level-1 scratch entity in one shot — deliberately NOT level-gated the
  // way the real applySubclassToEntity() is (leveling.ts:686-687, `if
  // (entry.level > ownClassLevel) continue`), since the goal here is "what
  // does this whole subclass do across its full progression," not "what
  // would a level-1 character have." collectAllEffects() (pipeline.ts)
  // only gates on Feature.isActive, never on level vs. the entity's own
  // identity.level, so combining every level's grants onto one level-1
  // scratch entity is safe and produces a correct combined diff — a
  // disclosure row makes the "combined, not level-gated" framing explicit
  // rather than letting a reader assume this is what a level-1 character
  // of this subclass actually has. Reuses buildFeatSummaryRows (ability/
  // derived/skill/save/HP) plus the same inline "new feature"/"new
  // resource" rows subrace/background-builder already use, since a
  // subclass can grant many of both across its levels.
  function runTest() {
    const subclass = buildHomebrewSubclass();
    if (!subclass) return;
    const empty = makeEmptyEntity('homebrew-test');
    const scratch: Entity = { ...empty, identity: { ...empty.identity, level: 1 } };
    const { before, after } = simulate(scratch, e => {
      let updated = e;
      for (const entry of subclass.entries) {
        for (const grant of entry.grants) {
          updated = applyGrant(updated, grant, entry.level, subclass.classId);
        }
      }
      return updated;
    }, DEFAULT_RULES);
    const rows = buildFeatSummaryRows(before, after);
    const beforeFeatureIds = new Set(before.features.map(f => f.id));
    for (const f of after.features) {
      if (!beforeFeatureIds.has(f.id)) rows.push({ label: `New feature: ${f.name}` });
    }
    const beforeResourceIds = new Set(before.resources.custom.map(r => r.id));
    for (const r of after.resources.custom) {
      if (!beforeResourceIds.has(r.id)) rows.push({ label: `New resource: ${r.name} (${r.maximum})` });
    }
    if (rows.length > 0) {
      rows.push({ label: 'Shown combined across all authored levels (1-20) at once — not what a level 1 character of this subclass would actually have yet.' });
    }
    setTestRows(rows);
    setTestOpen(true);
  }

  async function handleSave() {
    const subclass = buildHomebrewSubclass();
    if (!name.trim() || !subclass || saving) return;
    setSaving(true);
    try {
      await saveItem('subclass', subclass);
      // SAVE-AND-ADD-1: tell subclass.tsx's picker which subclass to
      // auto-select on return. No-op for any other caller.
      usePendingSelectionStore.getState().setPending('subclass_picker', subclass.id);
      goBack();
    } catch (e) {
      console.error('[subclass-builder] save failed:', e);
      Alert.alert('Save failed', e instanceof Error ? e.message : 'Something went wrong. Check the console for details.');
    } finally {
      setSaving(false);
    }
  }

  const canSave = !!name.trim() && !!classId && !saving;
  const canTest = !!name.trim() && !!classId;

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

        <Text style={[styles.fieldLabel, { marginTop: Spacing.md }]}>Game / Ruleset</Text>
        <GameRulesetPicker value={rulesetId} onChange={setRulesetId} defaultGameId={gameIdForRuleset(initialParentClass?.rulesetId ?? draftRulesetId)} />

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

        <Text style={[styles.fieldLabel, { marginTop: Spacing.md }]}>Per-Level Player Choices</Text>
        <Text style={styles.helperNote}>
          A real choice the player resolves at a specific level — e.g. "at level 6,
          choose one tool proficiency." Distinct from a Feature above: this doesn't
          grant anything by itself, it queues a pick.
        </Text>
        {levelChoicesList.length === 0 ? (
          <Text style={styles.emptyNote}>No player choices added yet.</Text>
        ) : (
          Array.from(new Set(levelChoicesList.map(c => c.level))).sort((a, b) => a - b).map(lvl => (
            <View key={lvl} style={styles.featureLevelGroup}>
              <Text style={styles.featureLevelLabel}>LEVEL {lvl}</Text>
              {levelChoicesList.filter(c => c.level === lvl).map(c => (
                <Pressable key={c.localId} style={styles.featureItem} onPress={() => setOpenChoiceId(c.localId)}>
                  <View style={styles.featureItemBody}>
                    <Text style={styles.featureItemName}>{c.kind === 'expertise' ? 'Expertise' : c.kind === 'tool' ? 'Tool Proficiency' : 'Language'} choice</Text>
                    <Text style={styles.featureItemDesc} numberOfLines={1}>Choose {c.count}</Text>
                  </View>
                  <Pressable style={styles.featureDeleteBtn} onPress={() => deleteLevelChoice(c.localId)} hitSlop={8}>
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
            value={addChoiceLevel}
            onChangeText={setAddChoiceLevel}
            keyboardType="number-pad"
            placeholder="Lv"
            placeholderTextColor={Colors.textDim}
          />
          <Pressable style={[styles.inlineAddBtn, { flex: 1 }]} onPress={addLevelChoice}>
            <Text style={styles.inlineAddTxt}>+ Add Player Choice</Text>
          </Pressable>
        </View>

      </ScrollView>

      <SafeBottomView>
        <View style={styles.footer}>
          <Pressable style={[styles.testBtn, !canTest && styles.btnDisabled]} onPress={runTest} disabled={!canTest}>
            <Text style={styles.testBtnTxt}>🧪 Test</Text>
          </Pressable>
          <Pressable style={[styles.saveBtn, !canSave && styles.btnDisabled]} onPress={() => { void handleSave(); }} disabled={!canSave}>
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

      <HomebrewTestModal
        visible={testOpen}
        title={`Testing: ${name.trim() || 'New Subclass'}`}
        rows={testRows}
        onClose={() => setTestOpen(false)}
      />

      <ChoiceDefinitionEditorModal
        draft={levelChoicesList.find(c => c.localId === openChoiceId) ?? null}
        visible={!!openChoiceId}
        onChange={updateLevelChoice}
        onDone={() => setOpenChoiceId(null)}
        onDelete={() => openChoiceId && deleteLevelChoice(openChoiceId)}
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

  footer:   { flexDirection: 'row', gap: Spacing.sm, padding: Spacing.sm, backgroundColor: Colors.surfaceHigh, borderTopWidth: 1, borderTopColor: Colors.border },
  testBtn:  { flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, alignItems: 'center' },
  testBtnTxt: { color: Colors.textSecondary, fontWeight: FontWeight.bold, fontSize: FontSize.md },
  saveBtn:  { flex: 1, backgroundColor: Colors.gold, borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center' },
  btnDisabled: { opacity: 0.4 },
  saveBtnTxt:  { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.md },
});
