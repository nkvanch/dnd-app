// app/homebrew/class-builder.tsx
// Homebrew class builder — basic fields + saves to library.
import { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, TextInput, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { CharClass } from '../../src/engine/types';
import { useHomebrewStore } from '../../src/store/homebrewStore';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../src/theme';

const HIT_DICE = [4, 6, 8, 10, 12] as const;

function toId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

export default function ClassBuilderScreen() {
  const router   = useRouter();
  const saveItem = useHomebrewStore(s => s.saveItem);

  const [name,    setName]    = useState('');
  const [hitDie,  setHitDie]  = useState<4|6|8|10|12>(8);
  const [description, setDescription] = useState('');

  async function handleSave() {
    if (!name.trim()) { Alert.alert('Name required'); return; }
    const cls: CharClass = {
      id:      toId(name) || 'homebrew_class',
      name:    name.trim(),
      hitDie,
      features: [],
      description: description.trim(),
    };
    await saveItem('class', cls);
    Alert.alert('Saved!', `"${cls.name}" added to your homebrew library.`, [
      { text: 'OK', onPress: () => router.back() },
    ]);
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backTxt}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>New Class</Text>
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        <Text style={styles.fieldLabel}>Class Name *</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName}
          placeholder="e.g. Blood Hunter" placeholderTextColor={Colors.textDim} />

        <Text style={styles.fieldLabel}>Hit Die</Text>
        <View style={styles.chipRow}>
          {HIT_DICE.map(d => (
            <Pressable key={d} style={[styles.chip, hitDie === d && styles.chipActive]} onPress={() => setHitDie(d)}>
              <Text style={[styles.chipTxt, hitDie === d && styles.chipTxtActive]}>d{d}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.fieldLabel}>Description</Text>
        <TextInput style={[styles.input, styles.textArea]} value={description} onChangeText={setDescription}
          placeholder="Describe this class…" placeholderTextColor={Colors.textDim}
          multiline textAlignVertical="top" />

        <View style={styles.infoCard}>
          <Text style={styles.infoTxt}>
            💡 Saving this class makes it selectable in creation right away. It gets a
            basic level 1–20 progression automatically: HP grows by this hit die
            every level, and Ability Score Improvements appear at levels 4, 8, 12,
            16, and 19 — same as most official classes. Saving throws, armor/weapon
            proficiencies, spellcasting, and per-level features aren't generated
            yet; a full level-by-level editor for those is planned.
          </Text>
        </View>
      </ScrollView>
      <View style={styles.footer}>
        <Pressable style={[styles.saveBtn, !name.trim() && styles.btnDisabled]} onPress={handleSave} disabled={!name.trim()}>
          <Text style={styles.saveBtnTxt}>💾 Save Class</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  header: { backgroundColor: Colors.surfaceHigh, paddingTop: Spacing.xl+8, paddingBottom: Spacing.md, paddingHorizontal: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backBtn: { marginBottom: 4 },
  backTxt: { color: Colors.gold, fontSize: FontSize.md, fontWeight: FontWeight.bold },
  title:   { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  scroll:  { flex: 1 },
  content: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: Spacing.xxl },
  fieldLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, letterSpacing: 1, fontWeight: FontWeight.bold },
  input:  { backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, padding: Spacing.sm, color: Colors.textPrimary, fontSize: FontSize.md },
  textArea: { minHeight: 120 },
  chipRow: { flexDirection: 'row', gap: Spacing.sm },
  chip:    { backgroundColor: Colors.surface, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderWidth: 1, borderColor: Colors.border },
  chipActive: { borderColor: Colors.gold, backgroundColor: Colors.gold + '22' },
  chipTxt:    { color: Colors.textSecondary, fontWeight: FontWeight.bold },
  chipTxtActive: { color: Colors.gold },
  infoCard: { backgroundColor: Colors.surfaceHigh, borderRadius: Radius.md, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  infoTxt:  { color: Colors.textDim, fontSize: FontSize.sm, lineHeight: 20 },
  footer:   { padding: Spacing.sm, backgroundColor: Colors.surfaceHigh, borderTopWidth: 1, borderTopColor: Colors.border },
  saveBtn:  { backgroundColor: Colors.gold, borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center' },
  btnDisabled: { opacity: 0.4 },
  saveBtnTxt:  { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.md },
});
