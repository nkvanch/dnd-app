// app/creation/skills.tsx
// Skill selection. Shows already-owned proficiencies at top, then choices below.
import { useState, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useCharacterStore } from '../../src/store/characterStore';
import { resolveChoice } from '../../src/engine/leveling';
import { ChoiceOption, SkillName } from '../../src/engine/types';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../src/theme';

const SKILL_LABELS: Record<string, string> = {
  athletics: 'Athletics', acrobatics: 'Acrobatics', sleight_of_hand: 'Sleight of Hand',
  stealth: 'Stealth', arcana: 'Arcana', history: 'History', investigation: 'Investigation',
  nature: 'Nature', religion: 'Religion', animal_handling: 'Animal Handling',
  insight: 'Insight', medicine: 'Medicine', perception: 'Perception', survival: 'Survival',
  deception: 'Deception', intimidation: 'Intimidation', performance: 'Performance',
  persuasion: 'Persuasion',
};

export default function SkillsScreen() {
  const router   = useRouter();
  const draft    = useCharacterStore(s => s.draft);
  const setDraft = useCharacterStore(s => s.setDraft);
  const rules    = useCharacterStore(s => s.rules);

  const skillChoices = draft
    ? draft.choices.filter(c => !c.resolved && c.definition.kind === 'skill')
    : [];

  // Already-owned skills from background / race / class grants
  const alreadyTrained = draft
    ? Object.entries(draft.skills.skills)
        .filter(([, entry]) => entry.trained)
        .map(([name]) => SKILL_LABELS[name] ?? name)
    : [];

  const [selections, setSelections] = useState<Record<string, string[]>>(
    Object.fromEntries(skillChoices.map(c => [c.id, []]))
  );

  // Redirect to name if no draft — must be in useEffect, not render
  useEffect(() => {
    if (!draft) router.replace('/creation/name');
  }, [draft]);

  if (!draft) return null;

  function toggle(choiceId: string, optId: string, max: number) {
    setSelections(prev => {
      const cur = prev[choiceId] ?? [];
      if (cur.includes(optId)) return { ...prev, [choiceId]: cur.filter(id => id !== optId) };
      if (cur.length >= max) return prev;
      return { ...prev, [choiceId]: [...cur, optId] };
    });
  }

  function canProceed() {
    return skillChoices.every(c => (selections[c.id]?.length ?? 0) === c.definition.count);
  }

  function handleConfirm() {
    let updated = draft!;
    for (const choice of skillChoices) {
      const chosen = selections[choice.id] ?? [];
      if (chosen.length === choice.definition.count) {
        updated = resolveChoice(updated, choice.id, chosen, rules);
      }
    }
    setDraft(updated);
    router.push('/creation/hub');
  }

  // No skill choices — show message with explicit Continue button
  if (skillChoices.length === 0) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.heading}>Skill Selection</Text>
        <View style={styles.divider} />
        <Text style={{ color: Colors.textSecondary, fontSize: FontSize.md, marginBottom: Spacing.xl }}>
          No additional skill choices for this class.
        </Text>
        <Pressable style={styles.nextBtn} onPress={() => router.push('/creation/hub')}>
          <Text style={styles.nextBtnText}>Continue →</Text>
        </Pressable>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Skill Selection</Text>
      <View style={styles.divider} />

      {/* Already owned */}
      {alreadyTrained.length > 0 && (
        <View style={styles.ownedBlock}>
          <Text style={styles.ownedTitle}>Skill Proficiencies already in possession:</Text>
          {alreadyTrained.map(s => (
            <Text key={s} style={styles.ownedSkill}>{s}</Text>
          ))}
          <View style={styles.divider} />
        </View>
      )}

      {/* Choices */}
      {skillChoices.map(choice => {
        const pool   = Array.isArray(choice.definition.pool) ? choice.definition.pool as ChoiceOption[] : [];
        const chosen = selections[choice.id] ?? [];
        return (
          <View key={choice.id} style={styles.choiceBlock}>
            <Text style={styles.choicePrompt}>Choose {choice.definition.count} Skills</Text>
            <Text style={styles.choiceCount}>Selected: {chosen.length} / {choice.definition.count}</Text>
            {pool.map(opt => {
              // A skill already proficient (from background/race/class) cannot be
              // picked again — disable it and tag it instead of letting the player
              // waste a class skill choice on it.
              const skillKey        = opt.value as SkillName;
              const isAlreadyTrained = draft!.skills.skills[skillKey]?.trained === true;
              const isSelected      = chosen.includes(opt.id);
              const isDisabled      = isAlreadyTrained || (!isSelected && chosen.length >= choice.definition.count);
              return (
                <Pressable
                  key={opt.id}
                  style={[styles.option, isSelected && styles.optionSelected, isDisabled && styles.optionDisabled]}
                  onPress={() => { if (!isAlreadyTrained) toggle(choice.id, opt.id, choice.definition.count); }}
                  disabled={isDisabled}
                >
                  <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                    {isSelected && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <Text style={[
                    styles.optionText,
                    isSelected && styles.optionTextSelected,
                    isAlreadyTrained && styles.optionTextMuted,
                  ]}>
                    {SKILL_LABELS[opt.label.toLowerCase().replace(/ /g,'_')] ?? opt.label}
                  </Text>
                  {isAlreadyTrained && <Text style={styles.alreadyTag}>From background</Text>}
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
        <Text style={styles.nextBtnText}>Confirm Skills</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content:   { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  heading:   { fontSize: FontSize.xxl, fontWeight: FontWeight.black, color: Colors.textPrimary, textAlign: 'center', marginBottom: Spacing.md },
  divider:   { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.lg },

  ownedBlock: { marginBottom: Spacing.sm },
  ownedTitle: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.sm, fontWeight: FontWeight.bold },
  ownedSkill: { fontSize: FontSize.md, color: Colors.green, marginBottom: Spacing.xs },

  choiceBlock:  { marginBottom: Spacing.xl },
  choicePrompt: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Spacing.xs },
  choiceCount:  { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.md },

  option: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    paddingVertical: Spacing.sm, paddingHorizontal: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  optionSelected: { backgroundColor: Colors.surfaceHigh },
  optionDisabled: { opacity: 0.4 },
  checkbox: {
    width: 22, height: 22, borderRadius: 4,
    borderWidth: 2, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxSelected: { backgroundColor: Colors.gold, borderColor: Colors.gold },
  checkmark:        { fontSize: 12, color: Colors.bg, fontWeight: FontWeight.bold },
  optionText:        { fontSize: FontSize.md, color: Colors.textPrimary, flex: 1 },
  optionTextSelected: { fontWeight: FontWeight.bold },
  optionTextMuted:   { color: Colors.textDim },
  alreadyTag:        { fontSize: FontSize.xs, color: Colors.green, fontWeight: FontWeight.bold },

  nextBtn: {
    backgroundColor: Colors.gold, borderRadius: Radius.md,
    paddingVertical: Spacing.md, alignItems: 'center', marginTop: Spacing.lg,
  },
  nextBtnDisabled: { backgroundColor: Colors.goldDim },
  nextBtnText: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.bg },
});
