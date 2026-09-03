// app/homebrew/feat-builder.tsx
// Homebrew Feat builder — the first REAL feat authoring path (previously
// users could only fake one via the generic Feature Editor tagged
// source:{kind:'feat'}, which AsiFeatPicker.tsx already reshapes into a Feat
// by convention — that workaround stays, this is additive, not a migration).
//
// A Feat is metadata + ONE Feature (leveling.ts's applyFeatToEntity only
// ever applies a single Feature, no resource/extra-feature carrying path),
// plus two optional player-choice blocks (abilityChoice/skillChoice) that
// AsiFeatPicker.tsx already knows how to resolve generically for any Feat.
import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ability, DraftTrait, Feat } from '../../src/engine/types';
import { validateFeat } from '../../src/engine/homebrewValidator';
import { Alert } from '../../src/utils/alert';
import { useHomebrewStore } from '../../src/store/homebrewStore';
import { useSafeGoBack } from '../../src/hooks/useSafeGoBack';
import { SafeBottomView } from '../../src/components/SafeBottomView';
import { newDraftTrait, buildTraitFeature, TraitEditorModal } from '../../src/components/homebrew/TraitEditor';
import { toId } from '../../src/content/traitCompiler';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../src/theme';

const ABILITIES: Ability[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

const EFFECT_KIND_LABELS: Record<string, string> = {
  none: 'Flavor only', ability_score: 'Ability score bonus', unarmored_defense: 'Unarmored Defense',
  ac_bonus: 'AC bonus', skill_proficiency: 'Skill proficiency', tool_proficiency: 'Tool proficiency',
  advantage_disadvantage: 'Advantage/Disadvantage', sense: 'Grants a sense', movement: 'Grants movement',
  movement_condition: 'Movement conditions', damage_resistance: 'Resistance', damage_immunity: 'Immunity',
  damage_vulnerability: 'Vulnerability',
};

// Module scope — a component defined inside the screen body gets torn down
// and rebuilt every render, which breaks TextInput focus after one keystroke.
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

let skillPickSeq = 0;

export default function FeatBuilderScreen() {
  const goBack   = useSafeGoBack('/(tabs)');
  const saveItem = useHomebrewStore(s => s.saveItem);
  const feats    = useHomebrewStore(s => s.feats);
  const { editId } = useLocalSearchParams<{ editId?: string }>();
  const editing  = editId ? feats.find(f => f.id === editId) ?? null : null;

  const [name,         setName]         = useState('');
  const [prerequisite, setPrerequisite] = useState('');
  const [source,       setSource]       = useState('Homebrew');
  const [description,  setDescription]  = useState('');
  const [trait,        setTrait]        = useState<DraftTrait>(() => newDraftTrait('Effect'));
  const [traitOpen,    setTraitOpen]    = useState(false);

  const [abilityChoiceOn, setAbilityChoiceOn] = useState(false);
  const [abilityOptions,  setAbilityOptions]  = useState<Ability[]>(['str']);
  const [abilityAmount,   setAbilityAmount]   = useState('1');
  const [grantsSaveProf,  setGrantsSaveProf]  = useState(false);

  const [skillPicks, setSkillPicks] = useState<
    { id: string; label: string; mode: 'proficiency' | 'expertise'; from: 'any' | 'proficient' }[]
  >([]);

  const [saving, setSaving] = useState(false);

  // Edit mode: hydrate once when the existing feat first resolves.
  useEffect(() => {
    if (!editing) return;
    setName(editing.name);
    setPrerequisite(editing.prerequisite ?? '');
    setSource(editing.source);
    setDescription(editing.description);
    // The compiled Feature can't be losslessly reversed back into a DraftTrait
    // (effects are already-compiled Effect objects, not the authoring shape) —
    // edit mode starts the effect as "Flavor only" with the saved description,
    // same accepted limitation subclass-builder.tsx's edit-mode recovery has.
    setTrait({ ...newDraftTrait('Effect'), description: editing.feature.description });
    if (editing.abilityChoice) {
      setAbilityChoiceOn(true);
      setAbilityOptions(editing.abilityChoice.options);
      setAbilityAmount(String(editing.abilityChoice.amount));
      setGrantsSaveProf(!!editing.abilityChoice.grantsSaveProficiency);
    }
    if (editing.skillChoice) {
      setSkillPicks(editing.skillChoice.picks);
    }
  }, [editing?.id]);

  function toggleAbilityOption(a: Ability) {
    setAbilityOptions(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a]);
  }

  function addSkillPick() {
    skillPickSeq += 1;
    setSkillPicks(prev => [...prev, { id: `pick_${skillPickSeq}`, label: 'Choose a skill', mode: 'proficiency', from: 'any' }]);
  }
  function updateSkillPick(id: string, patch: Partial<typeof skillPicks[number]>) {
    setSkillPicks(prev => prev.map(p => p.id === id ? { ...p, ...patch } : p));
  }
  function removeSkillPick(id: string) {
    setSkillPicks(prev => prev.filter(p => p.id !== id));
  }

  function buildFeat(): Feat {
    const id = editing?.id ?? (toId(name) || 'homebrew_feat');
    const { feature } = buildTraitFeature(trait, { idPrefix: id, sourceKind: 'feat', sourceRefId: id, level: null });
    return {
      id,
      name: name.trim(),
      prerequisite: prerequisite.trim() || null,
      description: description.trim(),
      source: source.trim() || 'Homebrew',
      feature: { ...feature, id: `feat_${id}`, description: description.trim() },
      abilityChoice: abilityChoiceOn
        ? { options: abilityOptions, amount: parseInt(abilityAmount, 10) || 1, grantsSaveProficiency: grantsSaveProf }
        : undefined,
      skillChoice: skillPicks.length > 0 ? { picks: skillPicks } : undefined,
    };
  }

  async function handleSave() {
    const feat = buildFeat();
    const { valid, errors, warnings } = validateFeat(feat);
    if (!valid) {
      Alert.alert('Validation Errors', errors.join('\n'));
      return;
    }
    if (warnings.length > 0) {
      Alert.alert('Warnings', warnings.join('\n') + '\n\nSave anyway?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Save', onPress: () => doSave(feat) },
      ]);
      return;
    }
    doSave(feat);
  }

  async function doSave(feat: Feat) {
    if (saving) return;
    setSaving(true);
    try {
      await saveItem('feat', feat);
      goBack();
    } catch (e) {
      console.error('[feat-builder] save failed:', e);
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
        <Text style={styles.title}>{editing ? 'Edit Feat' : 'New Feat'}</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        <Field label="Name *">
          <TextInput style={styles.input} value={name} onChangeText={setName}
            placeholder="Feat name" placeholderTextColor={Colors.textDim} />
        </Field>

        <Field label="Prerequisite (optional)">
          <TextInput style={styles.input} value={prerequisite} onChangeText={setPrerequisite}
            placeholder="e.g. Strength 13 or higher" placeholderTextColor={Colors.textDim} />
        </Field>

        <Field label="Source">
          <TextInput style={styles.input} value={source} onChangeText={setSource}
            placeholder="Homebrew" placeholderTextColor={Colors.textDim} />
        </Field>

        <Field label="Description *">
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="What this feat does, in your own words…"
            placeholderTextColor={Colors.textDim}
            multiline textAlignVertical="top"
          />
        </Field>

        <Field label="Mechanical Effect">
          <Pressable style={styles.effectCard} onPress={() => setTraitOpen(true)}>
            <Text style={styles.effectCardName}>Edit Effect</Text>
            <Text style={styles.effectCardDesc}>{EFFECT_KIND_LABELS[trait.effectKind]}</Text>
          </Pressable>
        </Field>

        <Field label="Ability Score Choice (optional)">
          <Pressable style={[styles.toggle, abilityChoiceOn && styles.toggleActive]} onPress={() => setAbilityChoiceOn(v => !v)}>
            <Text style={[styles.toggleTxt, abilityChoiceOn && styles.toggleTxtActive]}>
              This feat lets the player choose an ability to increase
            </Text>
          </Pressable>
          {abilityChoiceOn && (
            <View style={{ gap: Spacing.sm, marginTop: Spacing.sm }}>
              <Text style={styles.subLabel}>Eligible abilities</Text>
              <View style={styles.chipRow}>
                {ABILITIES.map(a => {
                  const active = abilityOptions.includes(a);
                  return (
                    <Pressable key={a} style={[styles.chip, active && styles.chipActive]} onPress={() => toggleAbilityOption(a)}>
                      <Text style={[styles.chipTxt, active && styles.chipTxtActive]}>{a.toUpperCase()}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={styles.subLabel}>Amount</Text>
              <TextInput
                style={[styles.input, styles.smallInput]}
                value={abilityAmount}
                onChangeText={setAbilityAmount}
                keyboardType="number-pad"
                placeholderTextColor={Colors.textDim}
              />
              <Pressable style={[styles.toggle, grantsSaveProf && styles.toggleActive]} onPress={() => setGrantsSaveProf(v => !v)}>
                <Text style={[styles.toggleTxt, grantsSaveProf && styles.toggleTxtActive]}>
                  Also grants proficiency in that ability's saving throws (Resilient-style)
                </Text>
              </Pressable>
            </View>
          )}
        </Field>

        <Field label="Skill Choice (optional)">
          {skillPicks.length === 0 ? (
            <Text style={styles.emptyNote}>No skill picks added.</Text>
          ) : (
            skillPicks.map(p => (
              <View key={p.id} style={styles.skillPickRow}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={p.label}
                  onChangeText={v => updateSkillPick(p.id, { label: v })}
                  placeholder="Choose a skill"
                  placeholderTextColor={Colors.textDim}
                />
                <View style={styles.chipRow}>
                  {(['proficiency', 'expertise'] as const).map(mode => (
                    <Pressable key={mode} style={[styles.chip, p.mode === mode && styles.chipActive]} onPress={() => updateSkillPick(p.id, { mode })}>
                      <Text style={[styles.chipTxt, p.mode === mode && styles.chipTxtActive]}>{mode}</Text>
                    </Pressable>
                  ))}
                  {(['any', 'proficient'] as const).map(from => (
                    <Pressable key={from} style={[styles.chip, p.from === from && styles.chipActive]} onPress={() => updateSkillPick(p.id, { from })}>
                      <Text style={[styles.chipTxt, p.from === from && styles.chipTxtActive]}>{from}</Text>
                    </Pressable>
                  ))}
                  <Pressable style={styles.removeBtn} onPress={() => removeSkillPick(p.id)}>
                    <Text style={styles.removeBtnTxt}>✕</Text>
                  </Pressable>
                </View>
              </View>
            ))
          )}
          <Pressable style={styles.inlineAddBtn} onPress={addSkillPick}>
            <Text style={styles.inlineAddTxt}>+ Add Skill Pick</Text>
          </Pressable>
        </Field>

      </ScrollView>

      <SafeBottomView>
        <View style={styles.footer}>
          <Pressable style={[styles.saveBtn, (!name.trim() || !description.trim() || saving) && styles.btnDisabled]} onPress={handleSave} disabled={!name.trim() || !description.trim() || saving}>
            <Text style={styles.saveBtnTxt}>{saving ? 'Saving...' : 'Save Feat'}</Text>
          </Pressable>
        </View>
      </SafeBottomView>

      <TraitEditorModal
        trait={traitOpen ? trait : null}
        visible={traitOpen}
        onChange={setTrait}
        onDone={() => setTraitOpen(false)}
        onDelete={() => { setTrait(newDraftTrait('Effect')); setTraitOpen(false); }}
        excludeKinds={['resource_ability', 'spell_grant']}
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
  subLabel: { fontSize: FontSize.xs, color: Colors.textDim },
  input: {
    backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.sm, color: Colors.textPrimary, fontSize: FontSize.md,
  },
  smallInput: { width: 80 },
  textArea:  { minHeight: 100 },
  chipRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, alignItems: 'center' },
  chip:      { backgroundColor: Colors.surface, borderRadius: Radius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 4, borderWidth: 1, borderColor: Colors.border },
  chipActive:{ borderColor: Colors.gold, backgroundColor: Colors.gold + '22' },
  chipTxt:   { fontSize: FontSize.xs, color: Colors.textSecondary },
  chipTxtActive: { color: Colors.gold, fontWeight: FontWeight.bold },
  toggle:    { backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.sm, borderWidth: 1, borderColor: Colors.border },
  toggleActive: { borderColor: Colors.gold, backgroundColor: Colors.gold + '22' },
  toggleTxt:    { color: Colors.textSecondary, fontSize: FontSize.sm },
  toggleTxtActive: { color: Colors.gold, fontWeight: FontWeight.bold },
  effectCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, padding: Spacing.md,
  },
  effectCardName: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  effectCardDesc: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  emptyNote: { fontSize: FontSize.sm, color: Colors.textDim, fontStyle: 'italic' },
  skillPickRow: { gap: Spacing.xs, marginBottom: Spacing.sm },
  removeBtn: { paddingHorizontal: Spacing.sm, paddingVertical: 4 },
  removeBtnTxt: { color: Colors.red, fontSize: FontSize.sm },
  inlineAddBtn: { alignSelf: 'flex-start', paddingVertical: Spacing.xs },
  inlineAddTxt: { color: Colors.gold, fontWeight: FontWeight.bold, fontSize: FontSize.sm },
  footer:    { padding: Spacing.sm, backgroundColor: Colors.surfaceHigh, borderTopWidth: 1, borderTopColor: Colors.border },
  saveBtn:   { backgroundColor: Colors.gold, borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center' },
  btnDisabled: { opacity: 0.4 },
  saveBtnTxt:  { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.md },
});
