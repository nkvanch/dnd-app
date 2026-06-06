// app/homebrew/spell-builder.tsx
// Homebrew spell builder — all Spell fields with validation + save.
import { useState } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  TextInput, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Spell } from '../../src/engine/types';
import { validateSpell } from '../../src/engine/homebrewValidator';
import { useHomebrewStore } from '../../src/store/homebrewStore';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../src/theme';

const SCHOOLS = ['Abjuration','Conjuration','Divination','Enchantment','Evocation','Illusion','Necromancy','Transmutation'];
const LEVELS  = [0,1,2,3,4,5,6,7,8,9];

function toId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

export default function SpellBuilderScreen() {
  const router   = useRouter();
  const saveItem = useHomebrewStore(s => s.saveItem);

  const [name,        setName]        = useState('');
  const [level,       setLevel]       = useState<number>(0);
  const [school,      setSchool]      = useState('Evocation');
  const [castingTime, setCastingTime] = useState('1 action');
  const [range,       setRange]       = useState('60 feet');
  const [components,  setComponents]  = useState('V, S');
  const [duration,    setDuration]    = useState('Instantaneous');
  const [description, setDescription] = useState('');
  const [upcast,      setUpcast]      = useState('');
  const [ritual,      setRitual]      = useState(false);
  const [concentration, setConcentration] = useState(false);

  function buildSpell(): Spell {
    return {
      id:            toId(name) || 'homebrew_spell',
      name:          name.trim(),
      level:         level as Spell['level'],
      school,
      castingTime:   castingTime.trim(),
      range:         range.trim(),
      components:    components.split(',').map(s => s.trim()).filter(Boolean),
      duration:      duration.trim(),
      description:   description.trim(),
      upcast:        upcast.trim() || null,
      ritual,
      concentration,
    };
  }

  async function handleSave() {
    const spell = buildSpell();
    const { valid, errors, warnings } = validateSpell(spell);
    if (!valid) {
      Alert.alert('Validation Errors', errors.join('\n'));
      return;
    }
    if (warnings.length > 0) {
      Alert.alert('Warnings', warnings.join('\n') + '\n\nSave anyway?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Save', onPress: () => doSave(spell) },
      ]);
      return;
    }
    doSave(spell);
  }

  async function doSave(spell: Spell) {
    await saveItem('spell', spell);
    Alert.alert('Saved!', `"${spell.name}" added to your homebrew library.`, [
      { text: 'OK', onPress: () => router.back() },
    ]);
  }

  const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backTxt}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>New Spell</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        <Field label="Name *">
          <TextInput style={styles.input} value={name} onChangeText={setName}
            placeholder="Spell name" placeholderTextColor={Colors.textDim} />
        </Field>

        <Field label="Level (0 = cantrip)">
          <View style={styles.chipRow}>
            {LEVELS.map(l => (
              <Pressable key={l} style={[styles.chip, level === l && styles.chipActive]} onPress={() => setLevel(l)}>
                <Text style={[styles.chipTxt, level === l && styles.chipTxtActive]}>{l}</Text>
              </Pressable>
            ))}
          </View>
        </Field>

        <Field label="School">
          <View style={styles.chipRow}>
            {SCHOOLS.map(s => (
              <Pressable key={s} style={[styles.chip, school === s && styles.chipActive]} onPress={() => setSchool(s)}>
                <Text style={[styles.chipTxt, school === s && styles.chipTxtActive]}>{s}</Text>
              </Pressable>
            ))}
          </View>
        </Field>

        <Field label="Casting Time"><TextInput style={styles.input} value={castingTime} onChangeText={setCastingTime} placeholderTextColor={Colors.textDim} /></Field>
        <Field label="Range"><TextInput style={styles.input} value={range} onChangeText={setRange} placeholderTextColor={Colors.textDim} /></Field>
        <Field label="Components (comma-separated)"><TextInput style={styles.input} value={components} onChangeText={setComponents} placeholderTextColor={Colors.textDim} /></Field>
        <Field label="Duration"><TextInput style={styles.input} value={duration} onChangeText={setDuration} placeholderTextColor={Colors.textDim} /></Field>

        <Field label="Description *">
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Spell description…"
            placeholderTextColor={Colors.textDim}
            multiline textAlignVertical="top"
          />
        </Field>

        <Field label="At Higher Levels (optional)">
          <TextInput
            style={[styles.input, styles.textArea]}
            value={upcast}
            onChangeText={setUpcast}
            placeholder="When cast using a higher slot…"
            placeholderTextColor={Colors.textDim}
            multiline textAlignVertical="top"
          />
        </Field>

        <View style={styles.toggleRow}>
          <Pressable style={[styles.toggle, ritual && styles.toggleActive]} onPress={() => setRitual(r => !r)}>
            <Text style={[styles.toggleTxt, ritual && styles.toggleTxtActive]}>🔮 Ritual</Text>
          </Pressable>
          <Pressable style={[styles.toggle, concentration && styles.toggleActive]} onPress={() => setConcentration(c => !c)}>
            <Text style={[styles.toggleTxt, concentration && styles.toggleTxtActive]}>🧠 Concentration</Text>
          </Pressable>
        </View>

      </ScrollView>

      <View style={styles.footer}>
        <Pressable style={[styles.saveBtn, !name.trim() && styles.btnDisabled]} onPress={handleSave} disabled={!name.trim()}>
          <Text style={styles.saveBtnTxt}>💾 Save Spell</Text>
        </Pressable>
      </View>
    </View>
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
  toggleRow: { flexDirection: 'row', gap: Spacing.sm },
  toggle:    { flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.sm, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  toggleActive: { borderColor: Colors.gold, backgroundColor: Colors.gold + '22' },
  toggleTxt:    { color: Colors.textSecondary, fontSize: FontSize.sm },
  toggleTxtActive: { color: Colors.gold, fontWeight: FontWeight.bold },
  footer:    { padding: Spacing.sm, backgroundColor: Colors.surfaceHigh, borderTopWidth: 1, borderTopColor: Colors.border },
  saveBtn:   { backgroundColor: Colors.gold, borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center' },
  btnDisabled: { opacity: 0.4 },
  saveBtnTxt:  { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.md },
});
