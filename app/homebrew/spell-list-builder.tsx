// app/homebrew/spell-list-builder.tsx
// Homebrew Spell List builder — the 11th homebrew builder. A SpellList is the
// simplest content shape in the app after Condition: id + name + description +
// optional classId + spellIds[]. It exists to give a class an ALTERNATE pool
// to draw from (most commonly a homebrew class with no official spell list of
// its own) without retagging every individual spell's own `classes` field —
// see SpellList's doc comment in engine/types.ts and content/spellLists.ts,
// which is where a class's spellcasting UI actually consumes these.
import { useState, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SpellList, RulesetId } from '../../src/engine/types';
import { validateSpellList } from '../../src/engine/homebrewValidator';
import { Alert } from '../../src/utils/alert';
import { useHomebrewStore } from '../../src/store/homebrewStore';
import { mergeSpellIndex } from '../../src/content/contentResolution';
import { useCharacterStore, DEFAULT_RULES } from '../../src/store/characterStore';
import { useSafeGoBack } from '../../src/hooks/useSafeGoBack';
import { SafeBottomView } from '../../src/components/SafeBottomView';
import { toId, disambiguateId } from '../../src/components/homebrew/TraitEditor';
import { GameRulesetPicker } from '../../src/components/homebrew/GameRulesetPicker';
import { gameIdForRuleset } from '../../src/content/rulesets';
import { mergeHomebrewDefinition } from '../../src/engine/homebrewRoundTrip';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../src/theme';

export default function SpellListBuilderScreen() {
  const goBack       = useSafeGoBack('/(tabs)/homebrew');
  const saveItem     = useHomebrewStore(s => s.saveItem);
  const spellLists   = useHomebrewStore(s => s.spellLists);
  const homebrewSpells = useHomebrewStore(s => s.spells);
  const getMergedContentDB = useHomebrewStore(s => s.getMergedContentDB);
  const { editId }   = useLocalSearchParams<{ editId?: string }>();
  const editing      = editId ? spellLists.find(l => l.id === editId) ?? null : null;
  const draftRulesetId = useCharacterStore(s => s.draft?.rulesetId);
  const [rulesetId, setRulesetId] = useState<RulesetId | undefined>(() => editing ? editing.rulesetId : draftRulesetId);

  const [name,        setName]        = useState('');
  const [description, setDescription] = useState('');
  const [classId,     setClassId]     = useState<string | null>(null);
  const [spellIds,    setSpellIds]    = useState<string[]>([]);
  const [search,       setSearch]     = useState('');
  const [saving,       setSaving]     = useState(false);
  // The full library is ~490 spells; mounting every row at once is what made this screen slow to open.
  // Render a page at a time and let the player ask for more (searching narrows the list first).
  const [shown, setShown] = useState(40);

  useEffect(() => {
    if (!editing) return;
    setName(editing.name);
    setDescription(editing.description ?? '');
    setClassId(editing.classId ?? null);
    setSpellIds(editing.spellIds);
    setRulesetId(editing.rulesetId);
  }, [editing?.id]);

  const classes = useMemo(() => getMergedContentDB(rulesetId).classes, [getMergedContentDB, rulesetId]);
  const allSpells = useMemo(() => mergeSpellIndex(homebrewSpells), [homebrewSpells]);

  const q = search.trim().toLowerCase();
  const visibleSpells = useMemo(() => {
    return allSpells
      .filter(s => !q || s.name.toLowerCase().includes(q))
      .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
  }, [allSpells, q]);

  useEffect(() => { setShown(40); }, [q]);
  const pageOfSpells = useMemo(() => visibleSpells.slice(0, shown), [visibleSpells, shown]);

  function toggleSpell(id: string) {
    setSpellIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  function buildSpellList(): SpellList {
    const takenIds = new Set([
      ...spellLists.filter(l => l.id !== editing?.id).map(l => l.id),
    ]);
    const id = editing?.id ?? disambiguateId(toId(name) || 'homebrew_spell_list', takenIds);
    return mergeHomebrewDefinition(editing, {
      id,
      name: name.trim(),
      description: description.trim() || undefined,
      classId: classId ?? undefined,
      spellIds,
      rulesetId,
    });
  }

  function handleSave() {
    const list = buildSpellList();
    const { valid, errors, warnings } = validateSpellList(list);
    if (!valid) {
      Alert.alert('Validation Errors', errors.join('\n'));
      return;
    }
    if (warnings.length > 0) {
      Alert.alert('Warnings', warnings.join('\n') + '\n\nSave anyway?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Save', onPress: () => { void doSave(list); } },
      ]);
      return;
    }
    void doSave(list);
  }

  async function doSave(list: SpellList) {
    if (saving) return;
    setSaving(true);
    try {
      await saveItem('spellList', list);
      goBack();
    } catch (e) {
      console.error('[spell-list-builder] save failed:', e);
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
        <Text style={styles.title}>{editing ? 'Edit Spell List' : 'New Spell List'}</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Name *</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName}
            placeholder="Spell list name" placeholderTextColor={Colors.textDim} />
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Game / Ruleset</Text>
          <GameRulesetPicker value={rulesetId} onChange={setRulesetId} defaultGameId={gameIdForRuleset(draftRulesetId)} />
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="What this list is for, in your own words…"
            placeholderTextColor={Colors.textDim}
            multiline textAlignVertical="top"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Suggested Class</Text>
          <Text style={styles.helperNote}>
            Optional — the class this list is meant for. Doesn't restrict who can pick it; a DM can
            still offer the same list to any class at their table.
          </Text>
          <View style={styles.chipRow}>
            <Pressable style={[styles.chip, classId === null && styles.chipActive]} onPress={() => setClassId(null)}>
              <Text style={[styles.chipTxt, classId === null && styles.chipTxtActive]}>None</Text>
            </Pressable>
            {classes.map(c => (
              <Pressable key={c.id} style={[styles.chip, classId === c.id && styles.chipActive]} onPress={() => setClassId(c.id)}>
                <Text style={[styles.chipTxt, classId === c.id && styles.chipTxtActive]}>{c.name}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Spells ({spellIds.length} selected)</Text>
          <TextInput style={styles.input} value={search} onChangeText={setSearch}
            placeholder="Search spells…" placeholderTextColor={Colors.textDim} />
          <View style={styles.spellList}>
            {pageOfSpells.map(s => {
              const on = spellIds.includes(s.id);
              return (
                <Pressable key={s.id} style={[styles.spellRow, on && styles.spellRowActive]} onPress={() => toggleSpell(s.id)}>
                  <Text style={[styles.spellRowTxt, on && styles.spellRowTxtActive]}>
                    {on ? '☑' : '☐'}  {s.name}
                  </Text>
                  <Text style={styles.spellRowLevel}>{s.level === 0 ? 'Cantrip' : `Lv ${s.level}`}</Text>
                </Pressable>
              );
            })}
            {visibleSpells.length > shown && (
              <Pressable style={styles.chip} onPress={() => setShown(n => n + 60)}>
                <Text style={styles.chipTxt}>Show more ({visibleSpells.length - shown} more)</Text>
              </Pressable>
            )}
            {visibleSpells.length === 0 && <Text style={styles.emptyNote}>No spells match "{search}".</Text>}
          </View>
        </View>

      </ScrollView>

      <SafeBottomView>
        <View style={styles.footer}>
          <Pressable style={[styles.saveBtn, (!name.trim() || saving) && styles.btnDisabled]} onPress={handleSave} disabled={!name.trim() || saving}>
            <Text style={styles.saveBtnTxt}>{saving ? 'Saving...' : 'Save Spell List'}</Text>
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
  helperNote: { fontSize: FontSize.xs, color: Colors.textDim, lineHeight: 16 },
  input: {
    backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.sm, color: Colors.textPrimary, fontSize: FontSize.md,
  },
  textArea:  { minHeight: 80 },
  chipRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  chip: {
    backgroundColor: Colors.surface, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.sm, paddingVertical: 6,
  },
  chipActive:   { backgroundColor: Colors.gold + '22', borderColor: Colors.gold },
  chipTxt:      { fontSize: FontSize.sm, color: Colors.textSecondary },
  chipTxtActive:{ color: Colors.gold, fontWeight: FontWeight.bold },
  spellList:   { gap: 2, maxHeight: 360 },
  spellRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 8, paddingHorizontal: Spacing.sm, borderRadius: Radius.sm,
  },
  spellRowActive:    { backgroundColor: Colors.gold + '15' },
  spellRowTxt:       { fontSize: FontSize.sm, color: Colors.textPrimary },
  spellRowTxtActive: { color: Colors.gold, fontWeight: FontWeight.bold },
  spellRowLevel:     { fontSize: FontSize.xs, color: Colors.textDim },
  emptyNote: { color: Colors.textDim, fontSize: FontSize.sm, fontStyle: 'italic', padding: Spacing.sm },
  footer:    { flexDirection: 'row', gap: Spacing.sm, padding: Spacing.sm, backgroundColor: Colors.surfaceHigh, borderTopWidth: 1, borderTopColor: Colors.border },
  saveBtn:   { flex: 1, backgroundColor: Colors.gold, borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center' },
  btnDisabled: { opacity: 0.4 },
  saveBtnTxt:  { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.md },
});
