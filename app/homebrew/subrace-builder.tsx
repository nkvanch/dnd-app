// app/homebrew/subrace-builder.tsx
// Attach a homebrew subrace to ANY existing race — official (SRD) or
// homebrew. Complements race-builder.tsx's inline SubraceEditor, which is
// still the right tool when you're authoring a brand-new race from scratch
// and want to add subraces to it as part of the same draft; this screen is
// for the "I want to add a subrace to Elf" case, which the inline editor
// can't do (it only edits races the player already owns/authored — see
// race-builder.tsx's editId lookup, which searches homebrewRaces only).
import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet, TextInput,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ability, DraftTrait, Entity, RulesetId, RACE_CHOICE_PREFIX } from '../../src/engine/types';
import {
  ChoiceDefinitionListEditor, DraftChoice,
} from '../../src/components/homebrew/ChoiceDefinitionEditor';
import { definitionToDraftChoice } from '../../src/content/choiceDefinitionCompiler';
import { useHomebrewStore } from '../../src/store/homebrewStore';
import { usePendingSelectionStore } from '../../src/store/pendingSelectionStore';
import { GameRulesetPicker } from '../../src/components/homebrew/GameRulesetPicker';
import { gameIdForRuleset } from '../../src/content/rulesets';
import { Alert } from '../../src/utils/alert';
import { useSafeGoBack } from '../../src/hooks/useSafeGoBack';
import { SafeBottomView } from '../../src/components/SafeBottomView';
import {
  newDraftSubrace, buildSubrace, AbilityScoreGrid, TraitListEditor,
} from '../../src/components/homebrew/TraitEditor';
import { simulate } from '../../src/engine/simulate';
import { applyGrant } from '../../src/engine/leveling';
import { buildFeatSummaryRows } from '../../src/components/FeatPreviewModal';
import { HomebrewTestModal, Row } from '../../src/components/homebrew/HomebrewTestModal';
import { useCharacterStore, makeEmptyEntity, DEFAULT_RULES } from '../../src/store/characterStore';
import { mergeHomebrewDefinition } from '../../src/engine/homebrewRoundTrip';
import { hydrateLosslessChoices, serializeDraftTraits, serializeLosslessChoices } from '../../src/engine/homebrewNestedSerializers';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../src/theme';

export default function SubraceBuilderScreen() {
  const goBack   = useSafeGoBack('/(tabs)');
  const saveItem = useHomebrewStore(s => s.saveItem);
  const homebrewSubraces = useHomebrewStore(s => s.subraces);
  // Select the FUNCTION reference (stable across renders), then call it in
  // the render body — selecting `s => s.getMergedContentDB()` directly would
  // hand useSyncExternalStore a brand-new object every call, which it reads
  // as "the store changed" and infinite-loops ("Maximum update depth
  // exceeded"). Re-derives on every render, which is fine here — this
  // screen doesn't re-render often enough for that to matter.
  const getMergedContentDB = useHomebrewStore(s => s.getMergedContentDB);
  const allRaces = getMergedContentDB().races;
  // NESTED-HOMEBREW-1: an optional `parentId` route param pre-selects the
  // parent race when this screen is reached from race-detail.tsx's own
  // "+ Create New Homebrew Subrace" button (which already knows exactly
  // which race the player was looking at) — retains that context instead
  // of making the player re-search for the race they came from. The
  // "I want to add a subrace to X, starting from the Homebrew tab" case
  // (no param) keeps its existing search-based picker unchanged.
  const { editId, parentId: parentIdParam } = useLocalSearchParams<{ editId?: string; parentId?: string }>();
  const editing = editId ? homebrewSubraces.find(sr => sr.id === editId) ?? null : null;
  // HOMEBREW-RULESET-1 (item 2): a subrace's most specific available default
  // is its own PARENT race's ruleset (when launched with a parentId, e.g.
  // from race-detail.tsx's "+ Create New Homebrew Subrace") — falls back to
  // the character/campaign draft's ruleset only when no parent is known yet
  // (the Homebrew-tab, no-param entry point). Never applied when editing.
  const initialParentRace = parentIdParam ? allRaces.find(r => r.id === parentIdParam) ?? null : null;
  const draftRulesetId = useCharacterStore(s => s.draft?.rulesetId);
  const [rulesetId, setRulesetId] = useState<RulesetId | undefined>(
    () => editing ? editing.rulesetId : (initialParentRace?.rulesetId ?? draftRulesetId),
  );

  const [parentSearch, setParentSearch] = useState('');
  const [parentId, setParentId] = useState<string | null>(parentIdParam ?? null);
  const [name, setName] = useState('');
  const [abiBonuses, setAbiBonuses] = useState<Record<Ability, string>>({
    str: '', dex: '', con: '', int: '', wis: '', cha: '',
  });
  const [traits, setTraits] = useState<DraftTrait[]>([]);
  const [pendingChoices, setPendingChoices] = useState<DraftChoice[]>([]);
  const [saving, setSaving] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const [testRows, setTestRows] = useState<Row[]>([]);

  // Edit mode: restore the exact authoring state from homebrewDraft, same
  // lossless-reload approach as race-builder.tsx (see Subrace.homebrewDraft's
  // doc comment in engine/types.ts).
  useEffect(() => {
    if (!editing) return;
    setParentId(editing.parentId);
    setName(editing.name);
    setRulesetId(editing.rulesetId);
    const draft = editing.homebrewDraft as Record<string, unknown> | undefined;
    if (draft) {
      if (draft.abiBonuses) setAbiBonuses(draft.abiBonuses as Record<Ability, string>);
      if (draft.traits) setTraits(draft.traits as DraftTrait[]);
      if (draft.pendingChoices) setPendingChoices(hydrateLosslessChoices(editing.pendingChoices, RACE_CHOICE_PREFIX));
    }
    // CHOICE-AUTHORING-1: see race-builder.tsx's identical fallback comment.
    if (!draft?.pendingChoices && editing.pendingChoices) {
      const reconstructed = editing.pendingChoices
        .map(def => definitionToDraftChoice(def, RACE_CHOICE_PREFIX))
        .filter((d): d is DraftChoice => d !== null);
      if (reconstructed.length > 0) setPendingChoices(reconstructed);
    }
  }, [editing?.id]);

  const parentRace = parentId ? allRaces.find(r => r.id === parentId) ?? null : null;
  const parentResults = parentSearch.trim().length > 0
    ? allRaces.filter(r => r.name.toLowerCase().includes(parentSearch.trim().toLowerCase())).slice(0, 12)
    : [];

  async function handleSave() {
    if (!name.trim() || !parentId || saving) return;
    setSaving(true);
    const draft = { ...newDraftSubrace(name.trim()), abiBonuses, traits };
    const compiled = buildSubrace(draft, parentId);
    const originalDraft = editing?.homebrewDraft as (Record<string, unknown> & { traitOwners?: any[] }) | undefined;
    const generatedIds = compiled.features.filter(f => f.id.endsWith('_asi')).map(f => f.id);
    const generated = compiled.features.filter(f => generatedIds.includes(f.id));
    const serializedTraits = serializeDraftTraits({ originalFeatures: editing?.features ?? [], originalResources: editing?.resources,
      originalDrafts: (originalDraft?.traits as DraftTrait[] | undefined) ?? [], editedDrafts: traits, idPrefix: compiled.id,
      sourceKind: 'race', sourceRefId: compiled.id, generatedFeatures: generated, generatedIds, owners: originalDraft?.traitOwners });
    const subrace = { ...compiled, rulesetId, features: serializedTraits.features, resources: serializedTraits.resources.length ? serializedTraits.resources : undefined,
      pendingChoices: serializeLosslessChoices(editing?.pendingChoices, pendingChoices, RACE_CHOICE_PREFIX),
      homebrewDraft: { abiBonuses, traits, pendingChoices, traitOwners: serializedTraits.owners } };
    // A standalone subrace keeps the editId (if editing) so re-saving
    // updates the same record rather than minting a new one — buildSubrace
    // derives an id from the name, which would drift if the name changed.
    const finalSubrace = editing
      ? mergeHomebrewDefinition(editing, {
          ...subrace, id: editing.id,
          // Imported definitions without an authoring draft cannot be safely
          // reverse-compiled; preserve their structured mechanics on rename.
          ...(!editing.homebrewDraft ? {
            features: editing.features, resources: editing.resources,
            pendingChoices: editing.pendingChoices,
          } : {}),
        })
      : subrace;
    try {
      await saveItem('subrace', finalSubrace);
      // SAVE-AND-ADD-1: tell race-detail.tsx's subrace picker which subrace
      // to auto-select on return. No-op for any other caller (nothing else
      // consumes this key).
      usePendingSelectionStore.getState().setPending('subrace_picker', finalSubrace.id);
      goBack();
    } catch (e) {
      console.error('[subrace-builder] save failed:', e);
      Alert.alert('Save failed', e instanceof Error ? e.message : 'Something went wrong. Check the console for details.');
    } finally {
      setSaving(false);
    }
  }

  const canSave = !!name.trim() && !!parentId && !saving;
  const canTest = !!name.trim() && !!parentId;

  // Read-only test: apply the draft subrace's features/resources to a
  // disposable level-1 scratch entity, same shape race-detail.tsx's own
  // selectRace() uses for a REAL subrace pick (loop applyGrant over
  // .features, then .resources) — no real character touched. Reuses
  // FeatPreviewModal's buildFeatSummaryRows as the base — it already diffs
  // EFFECTIVE ability scores (a flat ASI, which nearly every subrace has,
  // is a stat_modifier effect exactly like a feat's), every
  // DERIVED_NUMERIC_KEYS stat, new skill/save proficiencies, and max HP.
  // Layered on top: a subrace, unlike a single feat, can grant MULTIPLE
  // features and resource pools, so "new feature"/"new resource" rows are
  // appended the same way LevelUpPreviewModal's own builder computes them
  // (small enough not to warrant extracting into a shared helper for a
  // two-use case). CHOICE-AUTHORING-1: a drafted subrace CAN now carry
  // Subrace.pendingChoices — deliberately NOT applied/queued here, same as
  // race-builder.tsx's own test doesn't resolve them: a queued choice has
  // no single "correct" test answer to pre-resolve, so it's left out of
  // this read-only preview rather than guessed. .flexibleAsi remains
  // unauthorable from this builder, same as before.
  function runTest() {
    if (!parentId) return;
    const draft = { ...newDraftSubrace(name.trim()), abiBonuses, traits };
    const subrace = buildSubrace(draft, parentId);
    const empty = makeEmptyEntity('homebrew-test');
    const scratch: Entity = { ...empty, identity: { ...empty.identity, level: 1 } };
    const { before, after } = simulate(scratch, e => {
      let updated = e;
      for (const feature of subrace.features) {
        updated = applyGrant(updated, { kind: 'feature', value: { ...feature, isActive: true } }, feature.level ?? 0);
      }
      for (const resource of subrace.resources ?? []) {
        updated = applyGrant(updated, { kind: 'resource', value: resource }, 0, undefined, { kind: 'subrace', id: subrace.id });
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
    setTestRows(rows);
    setTestOpen(true);
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={goBack}>
          <Text style={styles.backTxt}>{'<- Back'}</Text>
        </Pressable>
        <Text style={styles.title}>{editing ? 'Edit Subrace' : 'New Subrace'}</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        <Text style={styles.fieldLabel}>Parent Race *</Text>
        <Text style={styles.helperNote}>
          Works on official races too, not just ones you've authored — e.g. add a
          new subrace to Elf or Dwarf.
        </Text>
        {parentRace ? (
          <Pressable style={styles.selectedParent} onPress={() => setParentId(null)}>
            <Text style={styles.selectedParentTxt}>{parentRace.name}</Text>
            <Text style={styles.selectedParentChange}>Change</Text>
          </Pressable>
        ) : (
          <>
            <TextInput
              style={styles.input}
              value={parentSearch}
              onChangeText={setParentSearch}
              placeholder="Search races…"
              placeholderTextColor={Colors.textDim}
            />
            {parentResults.length > 0 && (
              <View style={styles.parentResults}>
                {parentResults.map(r => (
                  <Pressable key={r.id} style={styles.parentResultRow} onPress={() => { setParentId(r.id); setParentSearch(''); }}>
                    <Text style={styles.parentResultTxt}>{r.name}</Text>
                    <Text style={styles.parentResultAdd}>Select</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </>
        )}

        <Text style={[styles.fieldLabel, { marginTop: Spacing.md }]}>Subrace Name *</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName}
          placeholder="e.g. Fire Pandafolk" placeholderTextColor={Colors.textDim} />

        <Text style={[styles.fieldLabel, { marginTop: Spacing.md }]}>Game / Ruleset</Text>
        <GameRulesetPicker value={rulesetId} onChange={setRulesetId} defaultGameId={gameIdForRuleset(initialParentRace?.rulesetId ?? draftRulesetId)} />

        <Text style={[styles.fieldLabel, { marginTop: Spacing.md }]}>Ability Score Bonuses</Text>
        <AbilityScoreGrid values={abiBonuses} onChange={(a, v) => setAbiBonuses(prev => ({ ...prev, [a]: v }))} />

        <Text style={[styles.fieldLabel, { marginTop: Spacing.md }]}>Extra Traits</Text>
        <Text style={styles.helperNote}>
          Add a trait by name, then tap it to optionally add a description and choose
          what it actually does.
        </Text>
        <TraitListEditor traits={traits} onChange={setTraits} />

        <Text style={[styles.fieldLabel, { marginTop: Spacing.md }]}>Player Choices (optional)</Text>
        <Text style={styles.helperNote}>
          A real choice the player resolves when they pick this subrace — e.g. proficiency
          in one tool of their choice, or an extra language.
        </Text>
        <ChoiceDefinitionListEditor choices={pendingChoices} onChange={setPendingChoices} />

      </ScrollView>

      <SafeBottomView>
        <View style={styles.footer}>
          <Pressable style={[styles.testBtn, !canTest && styles.btnDisabled]} onPress={runTest} disabled={!canTest}>
            <Text style={styles.testBtnTxt}>🧪 Test</Text>
          </Pressable>
          <Pressable style={[styles.saveBtn, !canSave && styles.btnDisabled]} onPress={() => { void handleSave(); }} disabled={!canSave}>
            <Text style={styles.saveBtnTxt}>{saving ? 'Saving...' : 'Save Subrace'}</Text>
          </Pressable>
        </View>
      </SafeBottomView>

      <HomebrewTestModal
        visible={testOpen}
        title={`Testing: ${name.trim() || 'New Subrace'}`}
        rows={testRows}
        onClose={() => setTestOpen(false)}
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

  footer:   { flexDirection: 'row', gap: Spacing.sm, padding: Spacing.sm, backgroundColor: Colors.surfaceHigh, borderTopWidth: 1, borderTopColor: Colors.border },
  testBtn:  { flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, alignItems: 'center' },
  testBtnTxt: { color: Colors.textSecondary, fontWeight: FontWeight.bold, fontSize: FontSize.md },
  saveBtn:  { flex: 1, backgroundColor: Colors.gold, borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center' },
  btnDisabled: { opacity: 0.4 },
  saveBtnTxt:  { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.md },
});
