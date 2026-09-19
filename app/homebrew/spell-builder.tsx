// app/homebrew/spell-builder.tsx
// Homebrew spell builder — rebuilt with quick-pick presets (+ custom fallback)
// for level/school/casting time/range/duration, real V/S/M component
// checkboxes instead of comma-separated text, and spell-type tagging.
import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Entity, Spell, RulesetId } from '../../src/engine/types';
import { validateSpell } from '../../src/engine/homebrewValidator';
import { Alert } from '../../src/utils/alert';
import { useHomebrewStore } from '../../src/store/homebrewStore';
import { usePendingSelectionStore } from '../../src/store/pendingSelectionStore';
import { GameRulesetPicker } from '../../src/components/homebrew/GameRulesetPicker';
import { gameIdForRuleset } from '../../src/content/rulesets';
import { useSafeGoBack } from '../../src/hooks/useSafeGoBack';
import { SafeBottomView } from '../../src/components/SafeBottomView';
import { PickOrCustom } from '../../src/components/homebrew/PickOrCustom';
import { simulate } from '../../src/engine/simulate';
import { castConcentrationSpell } from '../../src/engine/combat';
import { buildFeatSummaryRows } from '../../src/components/FeatPreviewModal';
import { HomebrewTestModal, Row } from '../../src/components/homebrew/HomebrewTestModal';
import { useCharacterStore, makeEmptyEntity, DEFAULT_RULES } from '../../src/store/characterStore';
import { disambiguateId } from '../../src/content/traitCompiler';
import { FULL_SPELL_LIBRARY } from '../../src/content/spells/index';
import { mergeHomebrewDefinition } from '../../src/engine/homebrewRoundTrip';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../src/theme';

const LEVELS  = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const SCHOOLS = ['Abjuration','Conjuration','Divination','Enchantment','Evocation','Illusion','Necromancy','Transmutation'];

const CASTING_TIMES = ['1 action', '1 bonus action', '1 reaction', '1 minute', '10 minutes', '1 hour', '8 hours', '24 hours'];
const RANGES = ['Self', 'Touch', '30 feet', '60 feet', '90 feet', '120 feet', '150 feet', 'Sight', 'Unlimited'];
const DURATIONS = ['Instantaneous', '1 round', '1 minute', '10 minutes', '1 hour', '8 hours', '24 hours', 'Until dispelled'];

const COMPONENT_OPTIONS: { key: 'V' | 'S' | 'M'; label: string }[] = [
  { key: 'V', label: 'Verbal' }, { key: 'S', label: 'Somatic' }, { key: 'M', label: 'Material' },
];

const SPELL_TYPES = ['Damage', 'Buff', 'Debuff', 'Healing', 'Control', 'Utility', 'Summoning'];

function toId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

/** Moved to module scope — was previously defined INSIDE SpellBuilderScreen's
 *  function body, which meant React treated it as a brand-new component type
 *  on every render, tearing down and rebuilding any TextInput inside it after
 *  every keystroke. That's what caused "only one character types at a time."
 *  Classic React mistake, now fixed by giving it a stable identity here. */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

export default function SpellBuilderScreen() {
  const goBack   = useSafeGoBack('/(tabs)');
  const saveItem = useHomebrewStore(s => s.saveItem);
  const spells   = useHomebrewStore(s => s.spells);
  const { editId } = useLocalSearchParams<{ editId?: string }>();
  const editing  = editId ? spells.find(s => s.id === editId) ?? null : null;
  const draftRulesetId = useCharacterStore(s => s.draft?.rulesetId);
  const [rulesetId, setRulesetId] = useState<RulesetId | undefined>(() => editing ? editing.rulesetId : draftRulesetId);

  const [name,        setName]        = useState('');
  const [level,       setLevel]       = useState<number>(0);
  const [school,      setSchool]      = useState('Evocation');
  const [castingTime, setCastingTime] = useState('1 action');
  const [range,       setRange]       = useState('60 feet');
  const [components,  setComponents]  = useState<Set<'V'|'S'|'M'>>(new Set(['V', 'S']));
  const [duration,    setDuration]    = useState('Instantaneous');
  const [description, setDescription] = useState('');
  const [upcast,      setUpcast]      = useState('');
  const [ritual,      setRitual]      = useState(false);
  const [concentration, setConcentration] = useState(false);
  const [spellTypes,  setSpellTypes]  = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const [testRows, setTestRows] = useState<Row[]>([]);

  // Edit mode: load the existing spell's fields once, when it first resolves.
  useEffect(() => {
    if (!editing) return;
    setName(editing.name);
    setRulesetId(editing.rulesetId);
    setLevel(editing.level);
    setSchool(editing.school);
    setCastingTime(editing.castingTime);
    setRange(editing.range);
    setComponents(new Set(editing.components as ('V'|'S'|'M')[]));
    setDuration(editing.duration);
    setDescription(editing.description);
    setUpcast(editing.upcast ?? '');
    setRitual(editing.ritual);
    setConcentration(editing.concentration);
    setSpellTypes(editing.spellType ?? []);
  }, [editing?.id]);

  function toggleComponent(c: 'V' | 'S' | 'M') {
    setComponents(prev => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  }
  function toggleSpellType(t: string) {
    setSpellTypes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  }

  function buildSpell(): Spell {
    // HOMEBREW-ID-COLLISION-1: see race-builder.tsx's identical fix.
    const takenSpellIds = new Set([
      ...FULL_SPELL_LIBRARY.map(s => s.id),
      ...spells.filter(s => s.id !== editing?.id).map(s => s.id),
    ]);
    return mergeHomebrewDefinition(editing, {
      id:            editing?.id ?? disambiguateId(toId(name) || 'homebrew_spell', takenSpellIds),
      name:          name.trim(),
      level,
      school:        school.trim(),
      castingTime:   castingTime.trim(),
      range:         range.trim(),
      components:    Array.from(components),
      duration:      duration.trim(),
      description:   description.trim(),
      upcast:        upcast.trim() || null,
      ritual,
      concentration,
      spellType:     spellTypes.length > 0 ? spellTypes : undefined,
      rulesetId,
    });
  }

  // Item 18 (homebrew improvements — expanded test bench): the last of the
  // 10 real builders to get one (item/race/class/feat/background/condition/
  // feature-editor/monster/subclass/subrace already have it — confirmed via
  // grep). Reuses castConcentrationSpell (engine/combat.ts) — the exact real
  // function a live cast goes through — as the simulate() mutator, rather
  // than hand-rolling the feature-grant loop other builders use, since
  // onConcentrationFeatures is applied through a slightly different path
  // (also sets spellcasting.concentrating/concentratingDuration) that's
  // worth exercising for real rather than reimplementing.
  // Disclosed, not hidden: this builder currently has no UI to AUTHOR
  // onConcentrationFeatures at all (buildSpell() never sets it) — so every
  // test today correctly reports "no mechanical effect" via
  // HomebrewTestModal's own empty-state note, the same honest "mechanism
  // built, no content exercises it yet" situation this app already has
  // elsewhere (e.g. Feature.outcomes/trigger before any content set them).
  // Authoring that UI is separate, larger work — TraitEditorModal wiring
  // for a spell-specific one-off trait, not attempted here.
  function runTest() {
    const spell = buildSpell();
    const empty = makeEmptyEntity('homebrew-test');
    const scratch: Entity = {
      ...empty,
      identity: { ...empty.identity, level: 1 },
      spellcasting: {
        ability: 'int', cantrips: [], known: [], prepared: [], concentrating: null,
        slots: { '1': { total: 0, used: 0 }, '2': { total: 0, used: 0 }, '3': { total: 0, used: 0 }, '4': { total: 0, used: 0 }, '5': { total: 0, used: 0 }, '6': { total: 0, used: 0 }, '7': { total: 0, used: 0 }, '8': { total: 0, used: 0 }, '9': { total: 0, used: 0 } },
      },
    };
    const { before, after } = simulate(scratch, e => castConcentrationSpell(e, spell, DEFAULT_RULES), DEFAULT_RULES);
    setTestRows(buildFeatSummaryRows(before, after));
    setTestOpen(true);
  }

  function handleSave() {
    const spell = buildSpell();
    const { valid, errors, warnings } = validateSpell(spell);
    if (!valid) {
      Alert.alert('Validation Errors', errors.join('\n'));
      return;
    }
    if (warnings.length > 0) {
      Alert.alert('Warnings', warnings.join('\n') + '\n\nSave anyway?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Save', onPress: () => { void doSave(spell); } },
      ]);
      return;
    }
    void doSave(spell);
  }

  // Doesn't wait on the confirmation Alert's dismissal to navigate — saves
  // and goes back immediately, then shows the Alert as a non-blocking
  // confirmation. Alert's multi-button callback behavior can be unreliable
  // on web specifically; not depending on it for the actual save+navigate
  // is the more robust choice regardless of platform.
  async function doSave(spell: Spell) {
    if (saving) return;
    setSaving(true);
    try {
      await saveItem('spell', spell);
      usePendingSelectionStore.getState().setPending('spell_picker', spell.id);
      // ADDITIONAL-SPELL-1: a second, independent key so "+ Add Additional
      // Spell"'s own "Create New Homebrew Spell" entry (spells.tsx) can
      // tell this save apart from the Required-picker's own "+ Create new
      // homebrew spell" button, which also targets 'spell_picker' — the
      // Additional consumer adds the spell unconditionally (whole library,
      // no entitlement consumed), so it must never be confused with the
      // Required consumer's eligibility-gated add.
      usePendingSelectionStore.getState().setPending('spell_picker_additional', spell.id);
      goBack();
    } catch (e) {
      console.error('[spell-builder] save failed:', e);
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
        <Text style={styles.title}>{editing ? 'Edit Spell' : 'New Spell'}</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        <Field label="Name *">
          <TextInput style={styles.input} value={name} onChangeText={setName}
            placeholder="Spell name" placeholderTextColor={Colors.textDim} />
        </Field>

        <Field label="Game / Ruleset">
          <GameRulesetPicker value={rulesetId} onChange={setRulesetId} defaultGameId={gameIdForRuleset(draftRulesetId)} />
        </Field>

        <Field label="Level (0 = cantrip)">
          <PickOrCustom options={LEVELS} value={level} onChange={v => setLevel(v as number)} numeric />
          {level > 9 && (
            <Text style={styles.warnNote}>
              Note: levels beyond 9 have no spell-slot tier to consume from -- this spell
              will display correctly but can't be tracked as "slots remaining" the way
              standard levels are.
            </Text>
          )}
        </Field>

        <Field label="School">
          <PickOrCustom options={SCHOOLS} value={school} onChange={v => setSchool(v as string)} />
        </Field>

        <Field label="Casting Time">
          <PickOrCustom options={CASTING_TIMES} value={castingTime} onChange={v => setCastingTime(v as string)} />
        </Field>

        <Field label="Range">
          <PickOrCustom options={RANGES} value={range} onChange={v => setRange(v as string)} />
        </Field>

        <Field label="Duration">
          <PickOrCustom options={DURATIONS} value={duration} onChange={v => setDuration(v as string)} />
        </Field>

        <Field label="Components">
          <View style={styles.chipRow}>
            {COMPONENT_OPTIONS.map(c => {
              const active = components.has(c.key);
              return (
                <Pressable key={c.key} style={[styles.chip, active && styles.chipActive]} onPress={() => toggleComponent(c.key)}>
                  <Text style={[styles.chipTxt, active && styles.chipTxtActive]}>{c.key} - {c.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </Field>

        <Field label="Spell Type (optional, for filtering/browsing)">
          <View style={styles.chipRow}>
            {SPELL_TYPES.map(t => {
              const active = spellTypes.includes(t);
              return (
                <Pressable key={t} style={[styles.chip, active && styles.chipActive]} onPress={() => toggleSpellType(t)}>
                  <Text style={[styles.chipTxt, active && styles.chipTxtActive]}>{t}</Text>
                </Pressable>
              );
            })}
          </View>
        </Field>

        <Field label="Description *">
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Spell description..."
            placeholderTextColor={Colors.textDim}
            multiline textAlignVertical="top"
          />
        </Field>

        <Field label="At Higher Levels (optional)">
          <TextInput
            style={[styles.input, styles.textArea]}
            value={upcast}
            onChangeText={setUpcast}
            placeholder="When cast using a higher slot..."
            placeholderTextColor={Colors.textDim}
            multiline textAlignVertical="top"
          />
        </Field>

        <View style={styles.toggleRow}>
          <Pressable style={[styles.toggle, ritual && styles.toggleActive]} onPress={() => setRitual(r => !r)}>
            <Text style={[styles.toggleTxt, ritual && styles.toggleTxtActive]}>Ritual</Text>
          </Pressable>
          <Pressable style={[styles.toggle, concentration && styles.toggleActive]} onPress={() => setConcentration(c => !c)}>
            <Text style={[styles.toggleTxt, concentration && styles.toggleTxtActive]}>Concentration</Text>
          </Pressable>
        </View>

      </ScrollView>

      <SafeBottomView>
        <View style={styles.footer}>
          <Pressable style={[styles.testBtn, !name.trim() && styles.btnDisabled]} onPress={runTest} disabled={!name.trim()}>
            <Text style={styles.testBtnTxt}>🧪 Test</Text>
          </Pressable>
          <Pressable style={[styles.saveBtn, (!name.trim() || saving) && styles.btnDisabled]} onPress={handleSave} disabled={!name.trim() || saving}>
            <Text style={styles.saveBtnTxt}>{saving ? 'Saving...' : 'Save Spell'}</Text>
          </Pressable>
        </View>
      </SafeBottomView>

      <HomebrewTestModal
        visible={testOpen}
        title={`Testing: ${name.trim() || 'New Spell'}`}
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
  input: {
    backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.sm, color: Colors.textPrimary, fontSize: FontSize.md,
  },
  textArea:  { minHeight: 100 },
  chipRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  chip:      { backgroundColor: Colors.surface, borderRadius: Radius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 4, borderWidth: 1, borderColor: Colors.border },
  chipActive:{ borderColor: Colors.gold, backgroundColor: Colors.gold + '22' },
  chipTxt:   { fontSize: FontSize.xs, color: Colors.textSecondary },
  chipTxtActive: { color: Colors.gold, fontWeight: FontWeight.bold },
  warnNote: { fontSize: FontSize.xs, color: Colors.gold, lineHeight: 16, marginTop: 4 },
  toggleRow: { flexDirection: 'row', gap: Spacing.sm },
  toggle:    { flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.sm, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  toggleActive: { borderColor: Colors.gold, backgroundColor: Colors.gold + '22' },
  toggleTxt:    { color: Colors.textSecondary, fontSize: FontSize.sm },
  toggleTxtActive: { color: Colors.gold, fontWeight: FontWeight.bold },
  footer:    { flexDirection: 'row', gap: Spacing.sm, padding: Spacing.sm, backgroundColor: Colors.surfaceHigh, borderTopWidth: 1, borderTopColor: Colors.border },
  testBtn:   { flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, alignItems: 'center' },
  testBtnTxt:  { color: Colors.textSecondary, fontWeight: FontWeight.bold, fontSize: FontSize.md },
  saveBtn:   { flex: 1, backgroundColor: Colors.gold, borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center' },
  btnDisabled: { opacity: 0.4 },
  saveBtnTxt:  { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.md },
});
