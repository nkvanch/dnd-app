// app/creation/equipment.tsx
// Step 7: Starting equipment choices.
// Always renders (never auto-skips during render).
// Sets equipmentVisited flag in notes on Continue so hub knows this step was reached.
import { useState, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useCharacterStore } from '../../src/store/characterStore';
import { resolveChoice } from '../../src/engine/leveling';
import { ChoiceOption, Entity } from '../../src/engine/types';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../src/theme';

/** Marks equipmentVisited in notes JSON. */
function markVisited(entity: Entity): Entity {
  let n: Record<string, unknown> = {};
  try { n = JSON.parse(entity.notes || '{}'); } catch { /* ignore */ }
  return { ...entity, notes: JSON.stringify({ ...n, equipmentVisited: true }) };
}

export default function EquipmentScreen() {
  const router   = useRouter();
  const draft    = useCharacterStore(s => s.draft);
  const setDraft = useCharacterStore(s => s.setDraft);
  const rules    = useCharacterStore(s => s.rules);

  // Redirect to name if no draft — must be in useEffect, not render
  useEffect(() => {
    if (!draft) router.replace('/creation/name');
  }, [draft]);

  const equipChoices = draft
    ? draft.choices.filter(c => !c.resolved && c.definition.kind === 'equipment')
    : [];

  const [selections, setSelections] = useState<Record<string, string[]>>(
    Object.fromEntries(equipChoices.map(c => [c.id, []]))
  );

  if (!draft) return null;

  function select(choiceId: string, optionId: string, max: number) {
    setSelections(prev => {
      const current = prev[choiceId] ?? [];
      if (current.includes(optionId)) {
        return { ...prev, [choiceId]: current.filter(id => id !== optionId) };
      }
      if (current.length >= max) {
        return { ...prev, [choiceId]: [optionId] };
      }
      return { ...prev, [choiceId]: [...current, optionId] };
    });
  }

  function canProceed(): boolean {
    if (equipChoices.length === 0) return true;
    return equipChoices.every(c => (selections[c.id]?.length ?? 0) === c.definition.count);
  }

  function handleConfirm() {
    let updated = draft!;
    for (const choice of equipChoices) {
      const chosen = selections[choice.id] ?? [];
      if (chosen.length === choice.definition.count) {
        updated = resolveChoice(updated, choice.id, chosen, rules);
      }
    }
    updated = markVisited(updated);
    setDraft(updated);
    router.push('/creation/spells');
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Starting Equipment</Text>

      {equipChoices.length === 0 ? (
        <View>
          <Text style={styles.sub}>No equipment choices for this class.</Text>
          <Pressable style={styles.nextBtn} onPress={handleConfirm}>
            <Text style={styles.nextBtnText}>Continue →</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <Text style={styles.sub}>Choose your starting gear.</Text>

          {equipChoices.map(choice => {
            const pool   = Array.isArray(choice.definition.pool) ? choice.definition.pool as ChoiceOption[] : [];
            const chosen = selections[choice.id] ?? [];
            return (
              <View key={choice.id} style={styles.choiceBlock}>
                <Text style={styles.choicePrompt}>{choice.definition.prompt}</Text>
                {pool.map(opt => {
                  const isSelected = chosen.includes(opt.id);
                  return (
                    <Pressable
                      key={opt.id}
                      style={[styles.option, isSelected && styles.optionSelected]}
                      onPress={() => select(choice.id, opt.id, choice.definition.count)}
                    >
                      <View style={[styles.radio, isSelected && styles.radioSelected]} />
                      <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            );
          })}

          <Pressable
            style={[styles.nextBtn, !canProceed() && styles.nextBtnDisabled]}
            onPress={handleConfirm}
            disabled={!canProceed()}
          >
            <Text style={styles.nextBtnText}>Next: Spells →</Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content:   { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  heading:   { fontSize: FontSize.xxl, fontWeight: FontWeight.black, color: Colors.gold, marginBottom: Spacing.xs },
  sub:       { fontSize: FontSize.md, color: Colors.textSecondary, marginBottom: Spacing.xl },
  choiceBlock:  { marginBottom: Spacing.xl },
  choicePrompt: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Spacing.md },
  option: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    padding: Spacing.md, borderRadius: Radius.md,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    marginBottom: Spacing.sm,
  },
  optionSelected:     { borderColor: Colors.gold },
  radio:              { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: Colors.border },
  radioSelected:      { borderColor: Colors.gold, backgroundColor: Colors.gold },
  optionText:         { fontSize: FontSize.md, color: Colors.textPrimary, flex: 1 },
  optionTextSelected: { color: Colors.gold, fontWeight: FontWeight.bold },
  nextBtn: {
    backgroundColor: Colors.gold, borderRadius: Radius.md,
    paddingVertical: Spacing.md, alignItems: 'center', marginTop: Spacing.lg,
  },
  nextBtnDisabled: { backgroundColor: Colors.goldDim },
  nextBtnText: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.bg },
});
