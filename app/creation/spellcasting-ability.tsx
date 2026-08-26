// app/creation/spellcasting-ability.tsx
// Resolves a pending 'spellcasting_ability' choice — the rare-case screen for
// homebrew classes where the player picks their casting ability at creation
// (see CharClass.spellcastingAbilityOptions). Was missing entirely: the
// engine-side choice definition and resolveChoice handling existed, but
// nothing ever presented it to the player, so the feature was genuinely
// incomplete, not just unpolished.
import { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useCharacterStore } from '../../src/store/characterStore';
import { resolveChoice } from '../../src/engine/leveling';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../src/theme';

export default function SpellcastingAbilityScreen() {
  const router   = useRouter();
  const draft    = useCharacterStore(s => s.draft);
  const setDraft = useCharacterStore(s => s.setDraft);
  const rules    = useCharacterStore(s => s.rules);

  useEffect(() => {
    if (!draft) router.replace('/creation/name');
  }, [draft]);

  if (!draft) return null;

  const pending = draft.choices.find(c => c.definition.kind === 'spellcasting_ability' && !c.resolved);

  // Nothing pending (already resolved, or this class doesn't need it) —
  // just go back to the hub rather than show an empty screen.
  useEffect(() => {
    if (draft && !pending) router.replace('/creation/hub');
  }, [draft, pending]);

  if (!pending) return null;

  function choose(optionId: string) {
    const updated = resolveChoice(draft!, pending!.id, [optionId], rules);
    setDraft(updated);
    router.replace('/creation/hub');
  }

  const options = Array.isArray(pending.definition.pool) ? pending.definition.pool : [];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Spellcasting Ability</Text>
      <Text style={styles.prompt}>{pending.definition.prompt}</Text>

      <View style={styles.optionList}>
        {options.map(opt => (
          <Pressable key={opt.id} style={styles.optionRow} onPress={() => choose(opt.id)}>
            <Text style={styles.optionLabel}>{opt.label}</Text>
            <Text style={styles.optionChevron}>{'>'}</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content:   { padding: Spacing.lg, paddingTop: Spacing.xl + 8 },
  heading:   { fontSize: FontSize.xxl, fontWeight: FontWeight.black, color: Colors.textPrimary, marginBottom: Spacing.sm },
  prompt:    { fontSize: FontSize.md, color: Colors.textSecondary, marginBottom: Spacing.lg, lineHeight: 22 },
  optionList: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border, overflow: 'hidden',
  },
  optionRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  optionLabel:    { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  optionChevron:  { fontSize: FontSize.lg, color: Colors.gold },
});
