// app/homebrew/monster-builder.tsx
// Homebrew Monster builder. A MonsterTemplate is a flat stat-block record,
// not a leveled progression — spawnMonster() (src/engine/monsterFactory.ts)
// turns it into a real live Entity reusing 100% of the same Feature/Effect/
// recomputeDerived machinery player characters use.
//
// Scope cut, explicit: mechanically-rollable attacks (to-hit/damage) aren't
// authorable here — traitCompiler.ts has no effect kind for that shape yet
// (official monster attacks are hand-authored Features with a `damage`
// abilityEffect). Author attacks as "Flavor only" traits with the full stat
// block text in the description; they'll display correctly, just not roll
// automatically — same disclosed gap as several official feats already ship
// with. Lair actions and per-skill bonuses are also deferred — see the
// commit/plan notes for why.
import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ability, DraftTrait, ResourceGrant, Feature } from '../../src/engine/types';
import { MonsterTemplate } from '../../src/content/monsters/types';
import { Alert } from '../../src/utils/alert';
import { validateMonster } from '../../src/engine/homebrewValidator';
import { useHomebrewStore } from '../../src/store/homebrewStore';
import { useSafeGoBack } from '../../src/hooks/useSafeGoBack';
import { SafeBottomView } from '../../src/components/SafeBottomView';
import { AbilityScoreGrid, TraitListEditor, buildTraitFeature } from '../../src/components/homebrew/TraitEditor';
import { toId } from '../../src/content/traitCompiler';
import { PickOrCustom } from '../../src/components/homebrew/PickOrCustom';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../src/theme';

const SIZES: MonsterTemplate['size'][] = ['tiny', 'small', 'medium', 'large', 'huge', 'gargantuan'];
const CRS = [0, 0.125, 0.25, 0.5, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const TYPES = ['humanoid', 'beast', 'undead', 'giant', 'dragon', 'fiend', 'celestial', 'construct', 'fey', 'elemental', 'monstrosity', 'ooze', 'plant', 'aberration'];
const ABILITIES: Ability[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

/** Simple dice-average formula: numDice*(sides+1)/2 + flatMod, rounded down. */
function averageFromDice(dice: string): number | null {
  const m = dice.trim().match(/^(\d+)d(\d+)([+-]\d+)?$/);
  if (!m) return null;
  const [, numStr, sidesStr, modStr] = m;
  const num = parseInt(numStr, 10);
  const sides = parseInt(sidesStr, 10);
  const mod = modStr ? parseInt(modStr, 10) : 0;
  return Math.floor(num * (sides + 1) / 2) + mod;
}

export default function MonsterBuilderScreen() {
  const goBack   = useSafeGoBack('/(tabs)');
  const saveItem = useHomebrewStore(s => s.saveItem);
  const monsters = useHomebrewStore(s => s.monsters);
  const { editId } = useLocalSearchParams<{ editId?: string }>();
  const editing  = editId ? monsters.find(m => m.id === editId) ?? null : null;

  const [name,      setName]      = useState('');
  const [cr,        setCr]        = useState<number>(1);
  const [size,      setSize]      = useState<MonsterTemplate['size']>('medium');
  const [type,      setType]      = useState('humanoid');
  const [alignment, setAlignment] = useState('unaligned');
  const [stats, setStats] = useState<Record<Ability, string>>({ str: '10', dex: '10', con: '10', int: '10', wis: '10', cha: '10' });
  const [hpDice,     setHpDice]     = useState('2d8');
  const [hpAverage,  setHpAverage]  = useState('9');
  const [acValue,    setAcValue]    = useState('12');
  const [acSource,   setAcSource]   = useState('natural armor');
  const [speed,      setSpeed]      = useState('30');
  const [savingThrows, setSavingThrows] = useState<Ability[]>([]);
  const [senses,      setSenses]      = useState('');
  const [languages,   setLanguages]   = useState('');
  const [legendaryActions, setLegendaryActions] = useState('');
  const [traits, setTraits] = useState<DraftTrait[]>([]);
  const [saving, setSaving] = useState(false);

  // Edit mode: hydrate once when the existing monster first resolves.
  useEffect(() => {
    if (!editing) return;
    setName(editing.name);
    setCr(editing.cr);
    setSize(editing.size);
    setType(editing.type);
    setAlignment(editing.alignment);
    setStats({
      str: String(editing.stats.str), dex: String(editing.stats.dex), con: String(editing.stats.con),
      int: String(editing.stats.int), wis: String(editing.stats.wis), cha: String(editing.stats.cha),
    });
    setHpDice(editing.hp.dice);
    setHpAverage(String(editing.hp.average));
    setAcValue(String(editing.ac.value));
    setAcSource(editing.ac.source);
    setSpeed(String(editing.speed));
    setSavingThrows(editing.savingThrows);
    setSenses(editing.senses.join(', '));
    setLanguages(editing.languages.join(', '));
    setLegendaryActions(editing.legendaryActions ? String(editing.legendaryActions) : '');
    // Same accepted limitation as race-builder/subclass-builder's edit-mode
    // recovery: already-compiled Features can't be losslessly reversed back
    // into authoring-shape DraftTraits, so features start as flavor-only
    // entries seeded from the saved name/description.
    setTraits(editing.features.map(f => ({
      localId: `t_${f.id}`, name: f.name, description: f.description, effectKind: 'none' as const,
      abilityTarget: 'str', abilityAmount: '1', unarmoredBase: '10', unarmoredAbilities: ['dex'], unarmoredCaps: {},
      skillTarget: 'history', skillExpertise: false, toolName: '', advDirection: 'advantage', advTarget: '',
      senseType: 'darkvision', senseRange: '60', moveType: 'fly', moveRange: '30',
      moveCondTargets: [], moveCondFlavor: '', damageType: 'fire',
      spellGrantCantripId: '', spellGrantAbility: 'cha', spellGrants: [],
      actionType: 'bonus_action', actionTypeOther: '', recharge: 'short_rest', rechargeOther: '', uses: '1', healDice: '1d8',
    })));
  }, [editing?.id]);

  function toggleSavingThrow(a: Ability) {
    setSavingThrows(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a]);
  }

  function handleHpDiceBlur() {
    const avg = averageFromDice(hpDice);
    if (avg !== null) setHpAverage(String(avg));
  }

  function buildMonster(): MonsterTemplate {
    const id = editing?.id ?? (toId(name) || 'homebrew_monster');
    const features: Feature[] = [];
    const resources: ResourceGrant[] = [];
    for (const t of traits) {
      const { feature, resource, extraFeatures, extraResources } = buildTraitFeature(t, { idPrefix: id, sourceKind: 'campaign', sourceRefId: id, level: null });
      features.push(feature, ...(extraFeatures ?? []));
      if (resource) resources.push(resource);
      resources.push(...(extraResources ?? []));
    }

    return {
      id,
      name: name.trim(),
      cr,
      size,
      type: type.trim(),
      alignment: alignment.trim(),
      stats: {
        str: parseInt(stats.str, 10) || 10, dex: parseInt(stats.dex, 10) || 10, con: parseInt(stats.con, 10) || 10,
        int: parseInt(stats.int, 10) || 10, wis: parseInt(stats.wis, 10) || 10, cha: parseInt(stats.cha, 10) || 10,
      },
      hp: { dice: hpDice.trim(), average: parseInt(hpAverage, 10) || 1 },
      ac: { value: parseInt(acValue, 10) || 10, source: acSource.trim() },
      speed: parseInt(speed, 10) || 0,
      features,
      savingThrows,
      skills: {},
      senses: senses.trim() ? senses.split(',').map(s => s.trim()).filter(Boolean) : [],
      languages: languages.trim() ? languages.split(',').map(l => l.trim()).filter(Boolean) : [],
      legendaryActions: legendaryActions.trim() ? parseInt(legendaryActions, 10) : undefined,
      resources: resources.length > 0 ? resources : undefined,
    };
  }

  async function handleSave() {
    const monster = buildMonster();
    const { valid, errors, warnings } = validateMonster(monster);
    if (!valid) {
      Alert.alert('Validation Errors', errors.join('\n'));
      return;
    }
    if (warnings.length > 0) {
      Alert.alert('Warnings', warnings.join('\n') + '\n\nSave anyway?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Save', onPress: () => doSave(monster) },
      ]);
      return;
    }
    doSave(monster);
  }

  async function doSave(monster: MonsterTemplate) {
    if (saving) return;
    setSaving(true);
    try {
      await saveItem('monster', monster);
      goBack();
    } catch (e) {
      console.error('[monster-builder] save failed:', e);
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
        <Text style={styles.title}>{editing ? 'Edit Monster' : 'New Monster'}</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        <Field label="Name *">
          <TextInput style={styles.input} value={name} onChangeText={setName}
            placeholder="Monster name" placeholderTextColor={Colors.textDim} />
        </Field>

        <Field label="Challenge Rating">
          <PickOrCustom options={CRS} value={cr} onChange={v => setCr(v as number)} numeric />
        </Field>

        <Field label="Size">
          <View style={styles.chipRow}>
            {SIZES.map(s => (
              <Pressable key={s} style={[styles.chip, size === s && styles.chipActive]} onPress={() => setSize(s)}>
                <Text style={[styles.chipTxt, size === s && styles.chipTxtActive]}>{s}</Text>
              </Pressable>
            ))}
          </View>
        </Field>

        <Field label="Type">
          <PickOrCustom options={TYPES} value={type} onChange={v => setType(v as string)} />
        </Field>

        <Field label="Alignment">
          <TextInput style={styles.input} value={alignment} onChangeText={setAlignment}
            placeholder="e.g. chaotic evil, any non-lawful" placeholderTextColor={Colors.textDim} />
        </Field>

        <Field label="Ability Scores">
          <AbilityScoreGrid values={stats} onChange={(a, v) => setStats(prev => ({ ...prev, [a]: v }))} />
        </Field>

        <Field label="Hit Points">
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.subLabel}>Dice</Text>
              <TextInput style={styles.input} value={hpDice} onChangeText={setHpDice} onBlur={handleHpDiceBlur}
                placeholder="2d8" placeholderTextColor={Colors.textDim} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.subLabel}>Average</Text>
              <TextInput style={styles.input} value={hpAverage} onChangeText={setHpAverage}
                keyboardType="number-pad" placeholderTextColor={Colors.textDim} />
            </View>
          </View>
        </Field>

        <Field label="Armor Class">
          <View style={styles.row}>
            <View style={{ width: 80 }}>
              <Text style={styles.subLabel}>Value</Text>
              <TextInput style={styles.input} value={acValue} onChangeText={setAcValue}
                keyboardType="number-pad" placeholderTextColor={Colors.textDim} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.subLabel}>Source</Text>
              <TextInput style={styles.input} value={acSource} onChangeText={setAcSource}
                placeholder="natural armor, chain mail…" placeholderTextColor={Colors.textDim} />
            </View>
          </View>
        </Field>

        <Field label="Speed (ft)">
          <TextInput style={[styles.input, styles.smallInput]} value={speed} onChangeText={setSpeed}
            keyboardType="number-pad" placeholderTextColor={Colors.textDim} />
        </Field>

        <Field label="Saving Throw Proficiencies">
          <View style={styles.chipRow}>
            {ABILITIES.map(a => {
              const active = savingThrows.includes(a);
              return (
                <Pressable key={a} style={[styles.chip, active && styles.chipActive]} onPress={() => toggleSavingThrow(a)}>
                  <Text style={[styles.chipTxt, active && styles.chipTxtActive]}>{a.toUpperCase()}</Text>
                </Pressable>
              );
            })}
          </View>
        </Field>

        <Field label="Senses (comma-separated)">
          <TextInput style={styles.input} value={senses} onChangeText={setSenses}
            placeholder="darkvision 60 ft, passive Perception 12" placeholderTextColor={Colors.textDim} />
        </Field>

        <Field label="Languages (comma-separated)">
          <TextInput style={styles.input} value={languages} onChangeText={setLanguages}
            placeholder="Common, Goblin" placeholderTextColor={Colors.textDim} />
        </Field>

        <Field label="Legendary Actions per round (optional)">
          <TextInput style={[styles.input, styles.smallInput]} value={legendaryActions} onChangeText={setLegendaryActions}
            keyboardType="number-pad" placeholder="0" placeholderTextColor={Colors.textDim} />
        </Field>

        <Field label="Traits & Abilities">
          <Text style={styles.helperNote}>
            Passive traits and limited-use abilities. Attacks aren't mechanically rollable here —
            describe them as "Flavor only" with the full stat block text (e.g. "Bite. Melee Weapon
            Attack: +4 to hit, reach 5 ft. Hit: 5 (1d6+2) piercing.").
          </Text>
          <TraitListEditor traits={traits} onChange={setTraits} />
        </Field>

      </ScrollView>

      <SafeBottomView>
        <View style={styles.footer}>
          <Pressable style={[styles.saveBtn, (!name.trim() || saving) && styles.btnDisabled]} onPress={handleSave} disabled={!name.trim() || saving}>
            <Text style={styles.saveBtnTxt}>{saving ? 'Saving...' : 'Save Monster'}</Text>
          </Pressable>
        </View>
      </SafeBottomView>
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
  subLabel: { fontSize: FontSize.xs, color: Colors.textDim, marginBottom: 2 },
  helperNote: { fontSize: FontSize.xs, color: Colors.textDim, lineHeight: 16, marginBottom: Spacing.xs },
  input: {
    backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.sm, color: Colors.textPrimary, fontSize: FontSize.md,
  },
  smallInput: { width: 80 },
  row: { flexDirection: 'row', gap: Spacing.sm },
  chipRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  chip:      { backgroundColor: Colors.surface, borderRadius: Radius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 4, borderWidth: 1, borderColor: Colors.border },
  chipActive:{ borderColor: Colors.gold, backgroundColor: Colors.gold + '22' },
  chipTxt:   { fontSize: FontSize.xs, color: Colors.textSecondary },
  chipTxtActive: { color: Colors.gold, fontWeight: FontWeight.bold },
  footer:    { padding: Spacing.sm, backgroundColor: Colors.surfaceHigh, borderTopWidth: 1, borderTopColor: Colors.border },
  saveBtn:   { backgroundColor: Colors.gold, borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center' },
  btnDisabled: { opacity: 0.4 },
  saveBtnTxt:  { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.md },
});
