// app/homebrew/background-builder.tsx
// Homebrew background builder — the one content type that had no builder at
// all (create or edit) until now. Skill proficiencies use the same
// grant_proficiency (skill:X) effect pattern as race traits — confirmed by
// reading class-detail.tsx's clearClassData() that a GENERIC effect-based
// check already runs before the hardcoded official-13-backgrounds fallback,
// so a homebrew background's skills correctly survive a class change with
// zero extra engine wiring needed.
import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet, TextInput, Modal,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Background, Feature, SkillName, Entity, RulesetId, BACKGROUND_CHOICE_PREFIX } from '../../src/engine/types';
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
import { simulate } from '../../src/engine/simulate';
import { applyGrant } from '../../src/engine/leveling';
import { buildFeatSummaryRows } from '../../src/components/FeatPreviewModal';
import { HomebrewTestModal, Row } from '../../src/components/homebrew/HomebrewTestModal';
import { useCharacterStore, makeEmptyEntity, DEFAULT_RULES } from '../../src/store/characterStore';
import { disambiguateId } from '../../src/content/traitCompiler';
import { globalContentDB } from '../../src/content/classes/library';
import { mergeHomebrewDefinition } from '../../src/engine/homebrewRoundTrip';
import { hydrateLosslessChoices, serializeBackgroundFeatures, serializeLosslessChoices } from '../../src/engine/homebrewNestedSerializers';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../src/theme';

// Same 18-skill list used in race-builder.tsx and the PDF export.
const SKILLS: { id: SkillName; label: string }[] = [
  { id: 'athletics', label: 'Athletics' }, { id: 'acrobatics', label: 'Acrobatics' },
  { id: 'sleight_of_hand', label: 'Sleight of Hand' }, { id: 'stealth', label: 'Stealth' },
  { id: 'arcana', label: 'Arcana' }, { id: 'history', label: 'History' },
  { id: 'investigation', label: 'Investigation' }, { id: 'nature', label: 'Nature' },
  { id: 'religion', label: 'Religion' }, { id: 'animal_handling', label: 'Animal Handling' },
  { id: 'insight', label: 'Insight' }, { id: 'medicine', label: 'Medicine' },
  { id: 'perception', label: 'Perception' }, { id: 'survival', label: 'Survival' },
  { id: 'deception', label: 'Deception' }, { id: 'intimidation', label: 'Intimidation' },
  { id: 'performance', label: 'Performance' }, { id: 'persuasion', label: 'Persuasion' },
];

function toId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

const COMMON_TOOLS = [
  "Thieves' Tools", 'Herbalism Kit', "Alchemist's Supplies", "Smith's Tools",
  "Carpenter's Tools", "Mason's Tools", "Weaver's Tools", "Woodcarver's Tools",
  "Cook's Utensils", "Brewer's Supplies", "Calligrapher's Supplies", "Painter's Supplies",
  "Potter's Tools", "Leatherworker's Tools", "Navigator's Tools", "Cartographer's Tools",
  'Disguise Kit', 'Forgery Kit', "Poisoner's Kit", 'Vehicles (land)', 'Vehicles (water)',
];

// ── Special feature (Acolyte's "Shelter of the Faithful", etc.) ────────────
// Reuses the same name-first-add pattern as race traits for consistency, even
// though a real background typically has just one. Kept flexible rather than
// hard-limited to exactly one, in case a homebrew background wants more.

type DraftFeature = { localId: string; name: string; description: string };

function newDraftFeature(name: string): DraftFeature {
  return { localId: `f_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`, name, description: '' };
}

function FeatureListEditor({ features, onChange }: {
  features: DraftFeature[];
  onChange: (f: DraftFeature[]) => void;
}) {
  const [newName, setNewName] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  function add() {
    const name = newName.trim();
    if (!name) return;
    const f = newDraftFeature(name);
    onChange([...features, f]);
    setNewName('');
    setOpenId(f.localId);
  }
  function update(f: DraftFeature) {
    onChange(features.map(x => x.localId === f.localId ? f : x));
  }
  function remove(localId: string) {
    onChange(features.filter(x => x.localId !== localId));
    setOpenId(null);
  }

  const open = features.find(f => f.localId === openId) ?? null;

  return (
    <View style={{ gap: Spacing.xs }}>
      {features.map(f => (
        <Pressable key={f.localId} style={styles.traitCard} onPress={() => setOpenId(f.localId)}>
          <View style={{ flex: 1 }}>
            <Text style={styles.traitCardName}>{f.name}</Text>
            <Text style={styles.traitCardMeta} numberOfLines={1}>{f.description || 'No description yet'}</Text>
          </View>
          <Text style={styles.traitCardCaret}>{'>'}</Text>
        </Pressable>
      ))}
      <View style={styles.inputRow}>
        <TextInput style={[styles.input, { flex: 1 }]} value={newName} onChangeText={setNewName}
          placeholder="Feature name (e.g. Shelter of the Faithful)" placeholderTextColor={Colors.textDim}
          onSubmitEditing={add} />
        <Pressable style={styles.addBtn} onPress={add}>
          <Text style={styles.addBtnTxt}>Add</Text>
        </Pressable>
      </View>

      <Modal visible={!!open} transparent animationType="slide" onRequestClose={() => setOpenId(null)}>
        <Pressable style={styles.backdrop} onPress={() => setOpenId(null)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ width: '100%' }}>
          <Pressable style={styles.modalSheet} onPress={e => e.stopPropagation()}>
            {open && (
              <ScrollView keyboardShouldPersistTaps="handled">
                <Text style={styles.modalTitle}>{open.name}</Text>
                <Text style={styles.fieldLabel}>Description</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={open.description}
                  onChangeText={v => update({ ...open, description: v })}
                  placeholder="What does this feature let you do?"
                  placeholderTextColor={Colors.textDim}
                  multiline textAlignVertical="top"
                />
                <SafeBottomView>
                  <View style={styles.modalBtnRow}>
                    <Pressable style={styles.deleteBtn} onPress={() => remove(open.localId)}>
                      <Text style={styles.deleteBtnTxt}>Delete</Text>
                    </Pressable>
                    <Pressable style={styles.doneBtn} onPress={() => setOpenId(null)}>
                      <Text style={styles.doneBtnTxt}>Done</Text>
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

export default function BackgroundBuilderScreen() {
  const goBack   = useSafeGoBack('/(tabs)');
  const saveItem = useHomebrewStore(s => s.saveItem);
  const homebrewBackgrounds = useHomebrewStore(s => s.backgrounds);
  const { editId } = useLocalSearchParams<{ editId?: string }>();
  const editing = editId ? homebrewBackgrounds.find(b => b.id === editId) ?? null : null;
  const draftRulesetId = useCharacterStore(s => s.draft?.rulesetId);
  const [rulesetId, setRulesetId] = useState<RulesetId | undefined>(() => editing ? editing.rulesetId : draftRulesetId);

  const [name, setName] = useState('');
  const [skills, setSkills] = useState<SkillName[]>([]);
  const [toolProfs, setToolProfs] = useState<string[]>([]);
  const [newTool, setNewTool] = useState('');
  const [languages, setLanguages] = useState('');
  const [equipmentNote, setEquipmentNote] = useState('');
  const [features, setFeatures] = useState<DraftFeature[]>([]);
  const [pendingChoices, setPendingChoices] = useState<DraftChoice[]>([]);
  const [testOpen, setTestOpen] = useState(false);
  const [testRows, setTestRows] = useState<Row[]>([]);

  // Edit mode: restore from homebrewDraft (same rationale as race/item —
  // skills/features compile into Effect/Feature data that's lossy to
  // reverse-engineer, so the raw authoring state rides alongside it).
  useEffect(() => {
    if (!editing) return;
    setName(editing.name);
    setRulesetId(editing.rulesetId);
    const draft = editing.homebrewDraft as Record<string, unknown> | undefined;
    if (draft) {
      setSkills((draft.skills as SkillName[]) ?? []);
      setToolProfs((draft.toolProfs as string[]) ?? []);
      setLanguages(String(draft.languages ?? ''));
      setEquipmentNote(String(draft.equipmentNote ?? ''));
      setFeatures((draft.features as DraftFeature[]) ?? []);
      if (draft.pendingChoices) setPendingChoices(hydrateLosslessChoices(editing.pendingChoices, BACKGROUND_CHOICE_PREFIX));
    }
    // CHOICE-AUTHORING-1: see race-builder.tsx's identical fallback comment.
    if (!draft?.pendingChoices && editing.pendingChoices) {
      const reconstructed = editing.pendingChoices
        .map(def => definitionToDraftChoice(def, BACKGROUND_CHOICE_PREFIX))
        .filter((d): d is DraftChoice => d !== null);
      if (reconstructed.length > 0) setPendingChoices(reconstructed);
    }
  }, [editing?.id]);

  function toggleSkill(s: SkillName) {
    setSkills(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  }
  function addTool() {
    const t = newTool.trim();
    if (!t || toolProfs.includes(t)) return;
    setToolProfs(prev => [...prev, t]);
    setNewTool('');
  }
  function toggleTool(t: string) {
    setToolProfs(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  }
  function removeTool(t: string) {
    setToolProfs(prev => prev.filter(x => x !== t));
  }

  function buildBackground(): Background {
    // HOMEBREW-ID-COLLISION-1: see race-builder.tsx's identical fix.
    const takenBgIds = new Set([
      ...globalContentDB.backgrounds.map(b => b.id),
      ...homebrewBackgrounds.filter(b => b.id !== editing?.id).map(b => b.id),
    ]);
    const id = editing?.id ?? disambiguateId(toId(name) || 'homebrew_background', takenBgIds);
    const bgFeatures: Feature[] = [];

    // Skills — same grant_proficiency (skill:X) pattern as race traits,
    // confirmed to work correctly with the existing class-change re-apply
    // logic in class-detail.tsx without needing the hardcoded BG_SKILL_MAP.
    if (skills.length > 0) {
      bgFeatures.push({
        id: `${id}_skills`, name: 'Skill Proficiencies',
        description: `You are proficient in ${skills.map(s => SKILLS.find(x => x.id === s)?.label ?? s).join(' and ')}.`,
        source: { kind: 'background', refId: id },
        level: null, actions: [], choices: [], passive: true,
        effects: skills.map(s => ({
          type: 'grant_proficiency' as const, target: `skill:${s}`,
          operation: 'add' as const, value: null, condition: null,
        })),
      });
    }

    // Tools/languages/equipment: informational only (matches how the app's
    // proficiencies.tools/languages blocks are populated elsewhere — a real
    // grant_proficiency effect for tools works the same as skills, so wire
    // those for real; equipment stays descriptive since backgrounds have no
    // grant mechanism for starting gear the way classes now do).
    if (toolProfs.length > 0) {
      bgFeatures.push({
        id: `${id}_tools`, name: 'Tool Proficiencies',
        description: `You are proficient with ${toolProfs.join(', ')}.`,
        source: { kind: 'background', refId: id },
        level: null, actions: [], choices: [], passive: true,
        effects: [{ type: 'grant_proficiency', target: 'tools', operation: 'add', value: toolProfs, condition: null }],
      });
    }
    if (languages.trim()) {
      bgFeatures.push({
        id: `${id}_languages`, name: 'Languages',
        description: `You know ${languages.trim()}.`,
        source: { kind: 'background', refId: id },
        level: null, actions: [], choices: [], passive: true, effects: [],
      });
    }
    if (equipmentNote.trim()) {
      bgFeatures.push({
        id: `${id}_equipment`, name: 'Equipment',
        description: equipmentNote.trim(),
        source: { kind: 'background', refId: id },
        level: null, actions: [], choices: [], passive: true, effects: [],
      });
    }
    // Bug fix: this used to build each custom feature's id as
    // `${id}_${toId(f.name)}` with no collision check — two custom features
    // with the same (or same-once-slugified) name silently produced the
    // identical Feature.id, with the second silently shadowing lookups for
    // the first. Seed usedIds with the 4 reserved ids above (only the ones
    // actually pushed) plus every already-pushed custom feature id, same
    // "_2/_3 disambiguation" pattern already used by the trait-based
    // builders (race/monster/subclass/condition-builder) via
    // traitCompiler's disambiguateId.
    const generatedIds = bgFeatures.map(f => f.id);
    const originalDraft = editing?.homebrewDraft as Record<string, unknown> | undefined;
    const serializedFeatures = serializeBackgroundFeatures(editing, (originalDraft?.features as DraftFeature[] | undefined) ?? [], features, id, bgFeatures, generatedIds);

    return mergeHomebrewDefinition(editing, {
      // Imported definitions without an authoring draft cannot be safely
      // reverse-compiled by this UI; preserve structured mechanics.
      ...(editing && !editing.homebrewDraft ? {
        features: editing.features, pendingChoices: editing.pendingChoices,
      } : {}),
      id, name: name.trim(), features: serializedFeatures.features, rulesetId,
      pendingChoices: serializeLosslessChoices(editing?.pendingChoices, pendingChoices, BACKGROUND_CHOICE_PREFIX),
      homebrewDraft: { skills, toolProfs, languages, equipmentNote, features, pendingChoices, traitOwners: serializedFeatures.owners },
    });
  }

  // Read-only test: apply the draft background's features to a disposable
  // level-1 scratch entity, same mechanism app/creation/background.tsx's
  // real selectBackground() uses (loop applyGrant over bg.features at
  // level 0) — no real character touched. Reuses FeatPreviewModal's
  // buildFeatSummaryRows (diffs effective ability scores/derived stats/
  // skill+save proficiencies/HP) plus an inline "new feature" pass for
  // anything that grants no numeric effect (this screen's tool/language/
  // equipment/special-feature entries are description-only — see
  // buildBackground() above — so they'd otherwise be invisible in the
  // test). This screen has no flexibleAsi picker (unlike the real
  // in-play background-selection screen, which does support one per the
  // 5.5e background-ASI work — see Background.flexibleAsi) so there's no
  // player-directed-choice gap to disclose: buildBackground() never sets
  // that field, nothing is left out of what this builder can actually
  // produce.
  function runTest() {
    const bg = buildBackground();
    const empty = makeEmptyEntity('homebrew-test');
    const scratch: Entity = { ...empty, identity: { ...empty.identity, level: 1 } };
    const { before, after } = simulate(scratch, e => {
      let updated = e;
      for (const feature of bg.features) {
        updated = applyGrant(updated, { kind: 'feature', value: { ...feature, isActive: true } }, 0);
      }
      return updated;
    }, DEFAULT_RULES);
    const rows = buildFeatSummaryRows(before, after);
    const beforeFeatureIds = new Set(before.features.map(f => f.id));
    for (const f of after.features) {
      if (!beforeFeatureIds.has(f.id)) rows.push({ label: `New feature: ${f.name}` });
    }
    setTestRows(rows);
    setTestOpen(true);
  }

  function handleSave() {
    if (!name.trim()) { Alert.alert('Name required'); return; }
    if (skills.length !== 2) {
      Alert.alert(
        'Skill count',
        `Standard backgrounds grant exactly 2 skill proficiencies (you have ${skills.length}). Save anyway?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Save', onPress: () => { void doSave(); } },
        ],
      );
      return;
    }
    void doSave();
  }

  const [saving, setSaving] = useState(false);

  async function doSave() {
    if (saving) return;
    setSaving(true);
    const bg = buildBackground();
    try {
      await saveItem('background', bg);
      usePendingSelectionStore.getState().setPending('background_picker', bg.id);
      goBack();
    } catch (e) {
      console.error('[background-builder] save failed:', e);
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
        <Text style={styles.title}>{editing ? 'Edit Background' : 'New Background'}</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        <Text style={styles.fieldLabel}>Background Name *</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName}
          placeholder="e.g. Wandering Scholar" placeholderTextColor={Colors.textDim} />

        <Text style={styles.fieldLabel}>Game / Ruleset</Text>
        <GameRulesetPicker value={rulesetId} onChange={setRulesetId} defaultGameId={gameIdForRuleset(draftRulesetId)} />

        <Text style={styles.fieldLabel}>Skill Proficiencies (standard: 2)</Text>
        <View style={styles.chipWrap}>
          {SKILLS.map(s => {
            const active = skills.includes(s.id);
            return (
              <Pressable key={s.id} style={[styles.chip, active && styles.chipActive]} onPress={() => toggleSkill(s.id)}>
                <Text style={[styles.chipTxt, active && styles.chipTxtActive]}>{s.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.fieldLabel}>Tool Proficiencies (optional)</Text>
        <Text style={styles.hint}>Tap to add a common tool, or type your own below.</Text>
        <View style={styles.chipWrap}>
          {COMMON_TOOLS.map(t => {
            const active = toolProfs.includes(t);
            return (
              <Pressable key={t} style={[styles.chip, active && styles.chipActive]} onPress={() => toggleTool(t)}>
                <Text style={[styles.chipTxt, active && styles.chipTxtActive]}>{t}</Text>
              </Pressable>
            );
          })}
        </View>
        {toolProfs.filter(t => !COMMON_TOOLS.includes(t)).length > 0 && (
          <View style={styles.chipWrap}>
            {toolProfs.filter(t => !COMMON_TOOLS.includes(t)).map(t => (
              <Pressable key={t} style={[styles.chip, styles.chipActive]} onPress={() => removeTool(t)}>
                <Text style={[styles.chipTxt, styles.chipTxtActive]}>{t} X</Text>
              </Pressable>
            ))}
          </View>
        )}
        <View style={styles.inputRow}>
          <TextInput style={[styles.input, { flex: 1 }]} value={newTool} onChangeText={setNewTool}
            placeholder="Something not listed above" placeholderTextColor={Colors.textDim} onSubmitEditing={addTool} />
          <Pressable style={styles.addBtn} onPress={addTool}>
            <Text style={styles.addBtnTxt}>Add</Text>
          </Pressable>
        </View>

        <Text style={styles.fieldLabel}>Languages (optional, descriptive)</Text>
        <TextInput style={styles.input} value={languages} onChangeText={setLanguages}
          placeholder="e.g. Common and Sylvan" placeholderTextColor={Colors.textDim} />
        <Text style={styles.hint}>
          For a FIXED language (always known), just list it here. For a real player
          choice ("choose one language of your choice"), use Player Choices below
          instead -- typing that phrase here has no mechanical effect.
        </Text>

        <Text style={[styles.fieldLabel, { marginTop: Spacing.md }]}>Player Choices (optional)</Text>
        <Text style={styles.hint}>
          A real choice the player resolves when they select this background -- e.g.
          "choose one artisan's tool" or "learn two languages of your choice." Unlike
          the fixed fields above, this queues a pick the player actually makes.
        </Text>
        <ChoiceDefinitionListEditor choices={pendingChoices} onChange={setPendingChoices} />

        <Text style={[styles.fieldLabel, { marginTop: Spacing.md }]}>Starting Equipment (optional, descriptive)</Text>
        <TextInput style={[styles.input, styles.textArea]} value={equipmentNote} onChangeText={setEquipmentNote}
          placeholder="e.g. a set of common clothes, a belt pouch containing 10 gp..."
          placeholderTextColor={Colors.textDim} multiline textAlignVertical="top" />
        <Text style={styles.hint}>
          Descriptive only -- backgrounds don't have a grant mechanism for starting
          gear the way classes do, so this shows as text rather than adding real items.
        </Text>

        <Text style={[styles.fieldLabel, { marginTop: Spacing.md }]}>Special Feature(s)</Text>
        <Text style={styles.hint}>
          The flavor/utility feature every background has (e.g. Acolyte's Shelter of
          the Faithful). Add by name, then tap to write its description.
        </Text>
        <FeatureListEditor features={features} onChange={setFeatures} />

      </ScrollView>

      <SafeBottomView>
        <View style={styles.footer}>
          <Pressable style={[styles.testBtn, !name.trim() && styles.btnDisabled]} onPress={runTest} disabled={!name.trim()}>
            <Text style={styles.testBtnTxt}>🧪 Test</Text>
          </Pressable>
          <Pressable style={[styles.saveBtn, (!name.trim() || saving) && styles.btnDisabled]} onPress={handleSave} disabled={!name.trim() || saving}>
            <Text style={styles.saveBtnTxt}>{saving ? 'Saving...' : 'Save Background'}</Text>
          </Pressable>
        </View>
      </SafeBottomView>

      <HomebrewTestModal
        visible={testOpen}
        title={`Testing: ${name.trim() || 'New Background'}`}
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
  fieldLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, letterSpacing: 1, fontWeight: FontWeight.bold, marginTop: Spacing.xs },
  hint:    { fontSize: FontSize.xs, color: Colors.textDim, lineHeight: 16, fontStyle: 'italic' },
  input:   { backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, padding: Spacing.sm, color: Colors.textPrimary, fontSize: FontSize.md },
  textArea:{ minHeight: 90 },
  chipWrap:{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  chip:      { backgroundColor: Colors.surfaceHigh, borderRadius: Radius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 4, borderWidth: 1, borderColor: Colors.border },
  chipActive:{ borderColor: Colors.gold, backgroundColor: Colors.gold + '22' },
  chipTxt:   { fontSize: FontSize.xs, color: Colors.textSecondary },
  chipTxtActive: { color: Colors.gold, fontWeight: FontWeight.bold },
  inputRow: { flexDirection: 'row', gap: Spacing.xs, alignItems: 'center' },
  addBtn: { backgroundColor: Colors.gold, borderRadius: Radius.md, paddingHorizontal: Spacing.md, justifyContent: 'center' },
  addBtnTxt: { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.sm },

  traitCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.sm,
  },
  traitCardName: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  traitCardMeta: { fontSize: FontSize.xs, color: Colors.textDim, marginTop: 2 },
  traitCardCaret: { fontSize: FontSize.lg, color: Colors.textDim },

  backdrop: { flex: 1, backgroundColor: '#000000bb', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: Colors.surfaceHigh,
    borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg,
    padding: Spacing.lg, maxHeight: '85%',
  },
  modalTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.gold, marginBottom: Spacing.md, textAlign: 'center' },
  modalBtnRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.lg },
  deleteBtn: { flex: 1, backgroundColor: Colors.red + '22', borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.red + '66', padding: Spacing.sm, alignItems: 'center' },
  deleteBtnTxt: { color: Colors.red, fontWeight: FontWeight.bold, fontSize: FontSize.sm },
  doneBtn: { flex: 2, backgroundColor: Colors.gold, borderRadius: Radius.md, padding: Spacing.sm, alignItems: 'center' },
  doneBtnTxt: { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.sm },

  footer:   { flexDirection: 'row', gap: Spacing.sm, padding: Spacing.sm, backgroundColor: Colors.surfaceHigh, borderTopWidth: 1, borderTopColor: Colors.border },
  testBtn:  { flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, alignItems: 'center' },
  testBtnTxt: { color: Colors.textSecondary, fontWeight: FontWeight.bold, fontSize: FontSize.md },
  saveBtn:  { flex: 1, backgroundColor: Colors.gold, borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center' },
  btnDisabled: { opacity: 0.4 },
  saveBtnTxt:  { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.md },
});
