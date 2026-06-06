// app/creation/level-up.tsx
// Ability Score Improvement screen — resolves pending ASI choices.
// Supports +2 to one stat or +1/+1 to two different stats.
import { useState, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useCharacterStore } from '../../src/store/characterStore';
import { recomputeDerived } from '../../src/engine/pipeline';
import { Ability } from '../../src/engine/types';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../src/theme';

const ABILITIES: { key: Ability; label: string }[] = [
  { key: 'str', label: 'Strength'     },
  { key: 'dex', label: 'Dexterity'   },
  { key: 'con', label: 'Constitution' },
  { key: 'int', label: 'Intelligence' },
  { key: 'wis', label: 'Wisdom'       },
  { key: 'cha', label: 'Charisma'     },
];

type Mode = '+2' | '+1+1';

export default function LevelUpScreen() {
  // ── ALL hooks first — never call a hook conditionally or after an early return ──
  const router   = useRouter();
  const draft    = useCharacterStore(s => s.draft);
  const setDraft = useCharacterStore(s => s.setDraft);
  const rules    = useCharacterStore(s => s.rules);

  const [mode,   setMode]   = useState<Mode>('+2');
  const [first,  setFirst]  = useState<Ability | null>(null);
  const [second, setSecond] = useState<Ability | null>(null);

  const asiChoices = draft?.choices.filter(c => c.definition.kind === 'asi' && !c.resolved) ?? [];

  // Single navigation guard — runs in an effect, never during render.
  useEffect(() => {
    if (!draft) {
      router.replace('/creation/name');
    } else if (asiChoices.length === 0) {
      router.replace('/creation/hub');
    }
  }, [draft?.id, asiChoices.length]);

  // Early return AFTER all hooks have been called.
  if (!draft || asiChoices.length === 0) return null;

  const current  = asiChoices[0];
  const maxScore = rules.maxAbilityScore ?? 20;

  function canApply(): boolean {
    if (mode === '+2') return first !== null;
    return first !== null && second !== null && first !== second;
  }

  function handleApply() {
    if (!draft || !current || !canApply()) return;
    let updated = { ...draft };

    // Apply the stat increases
    const increases: Partial<Record<Ability, number>> = {};
    if (mode === '+2' && first) {
      increases[first] = 2;
    } else if (mode === '+1+1' && first && second) {
      increases[first]  = (increases[first]  ?? 0) + 1;
      increases[second] = (increases[second] ?? 0) + 1;
    }

    const newStats = { ...updated.stats };
    for (const [ab, bonus] of Object.entries(increases) as [Ability, number][]) {
      newStats[ab] = Math.min(maxScore, newStats[ab] + bonus);
    }
    updated = { ...updated, stats: newStats };

    // Mark the ASI choice resolved
    updated = {
      ...updated,
      choices: updated.choices.map(c =>
        c.id === current.id
          ? { ...c, resolved: true, selections: [mode === '+2' ? `${first}+2` : `${first}+1,${second}+1`] }
          : c
      ),
    };

    // Recompute derived stats
    updated = recomputeDerived(updated, rules);

    setDraft(updated);

    // Reset for next ASI if any remain
    setFirst(null);
    setSecond(null);
    setMode('+2');

    // Navigate back to hub — it will show next ASI or proceed
    router.push('/creation/hub');
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Ability Score Improvement</Text>
      <Text style={styles.sub}>{current.definition.prompt}</Text>

      {/* Mode picker */}
      <View style={styles.modeRow}>
        <Pressable
          style={[styles.modeBtn, mode === '+2' && styles.modeBtnActive]}
          onPress={() => { setMode('+2'); setFirst(null); setSecond(null); }}
        >
          <Text style={[styles.modeBtnTxt, mode === '+2' && styles.modeBtnTxtActive]}>+2 to one</Text>
        </Pressable>
        <Pressable
          style={[styles.modeBtn, mode === '+1+1' && styles.modeBtnActive]}
          onPress={() => { setMode('+1+1'); setFirst(null); setSecond(null); }}
        >
          <Text style={[styles.modeBtnTxt, mode === '+1+1' && styles.modeBtnTxtActive]}>+1 to two</Text>
        </Pressable>
      </View>

      {/* Ability grid */}
      <Text style={styles.pickLabel}>
        {mode === '+2'
          ? 'Pick one ability to increase by 2:'
          : first === null
            ? 'Pick first ability (+1):'
            : 'Pick second ability (+1):'}
      </Text>

      <View style={styles.abilityGrid}>
        {ABILITIES.map(({ key, label }) => {
          const score      = draft.stats[key];
          const isFirst    = first  === key;
          const isSecond   = second === key;
          const isSelected = isFirst || isSecond;
          const maxed      = score >= maxScore;
          const plusTwo    = mode === '+2' ? (isFirst ? 2 : 0) : (isFirst ? 1 : isSecond ? 1 : 0);
          const newScore   = Math.min(maxScore, score + plusTwo);

          return (
            <Pressable
              key={key}
              style={[styles.abilityBtn, isSelected && styles.abilityBtnSelected, maxed && styles.abilityBtnMaxed]}
              disabled={maxed}
              onPress={() => {
                if (mode === '+2') {
                  setFirst(key);
                } else {
                  if (first === null) {
                    setFirst(key);
                  } else if (second === null && key !== first) {
                    setSecond(key);
                  } else if (key === first) {
                    setFirst(second);
                    setSecond(null);
                  } else if (key === second) {
                    setSecond(null);
                  }
                }
              }}
            >
              <Text style={styles.abilityLabel}>{label}</Text>
              <Text style={styles.abilityScore}>
                {score}
                {isSelected && plusTwo > 0 ? (
                  <Text style={styles.abilityIncrease}> → {newScore}</Text>
                ) : null}
              </Text>
              {maxed && <Text style={styles.abilityMaxed}>Max</Text>}
            </Pressable>
          );
        })}
      </View>

      <Pressable
        style={[styles.applyBtn, !canApply() && styles.applyBtnDisabled]}
        onPress={handleApply}
        disabled={!canApply()}
      >
        <Text style={styles.applyBtnTxt}>Apply Improvement →</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content:   { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  heading:   { fontSize: FontSize.xxl, fontWeight: FontWeight.black, color: Colors.gold, marginBottom: Spacing.xs },
  sub:       { fontSize: FontSize.md, color: Colors.textSecondary, marginBottom: Spacing.xl },

  modeRow:       { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
  modeBtn: {
    flex: 1, padding: Spacing.md, borderRadius: Radius.md,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center',
  },
  modeBtnActive:   { borderColor: Colors.gold, backgroundColor: Colors.gold + '22' },
  modeBtnTxt:      { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textSecondary },
  modeBtnTxtActive:{ color: Colors.gold },

  pickLabel: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.md, fontWeight: FontWeight.bold },

  abilityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.xl },
  abilityBtn: {
    width: '30%', backgroundColor: Colors.surface, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.sm, alignItems: 'center',
  },
  abilityBtnSelected: { borderColor: Colors.gold, backgroundColor: Colors.gold + '22' },
  abilityBtnMaxed:    { opacity: 0.4 },
  abilityLabel:    { fontSize: FontSize.xs, color: Colors.textSecondary, letterSpacing: 1, fontWeight: FontWeight.bold },
  abilityScore:    { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginTop: 2 },
  abilityIncrease: { fontSize: FontSize.md, color: Colors.green },
  abilityMaxed:    { fontSize: FontSize.xs, color: Colors.red },

  applyBtn: {
    backgroundColor: Colors.gold, borderRadius: Radius.md,
    paddingVertical: Spacing.md, alignItems: 'center',
  },
  applyBtnDisabled: { backgroundColor: Colors.goldDim },
  applyBtnTxt:      { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.bg },
});
