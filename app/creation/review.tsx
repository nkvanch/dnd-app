// app/creation/review.tsx
// Step 9: Summary review before saving.
// Shows the final computed character and lets the player confirm or go back.
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { useCharacterStore } from '../../src/store/characterStore';
import { useHomebrewStore } from '../../src/store/homebrewStore';
import { recomputeDerived } from '../../src/engine/pipeline';
import { recalculateAllHP } from '../../src/engine/leveling';
import { getProgressionForClass } from '../../src/content/classes/progressions';
import { Ability } from '../../src/engine/types';
import { useSafeGoBack } from '../../src/hooks/useSafeGoBack';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../src/theme';

const ABILITIES: Ability[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
const ABILITY_LABELS: Record<Ability, string> = {
  str: 'STR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'WIS', cha: 'CHA',
};

export default function ReviewScreen() {
  // ── ALL hooks first — never declare a hook after a conditional return ──
  const router    = useRouter();
  const safeGoBack = useSafeGoBack('/(tabs)');
  const draft     = useCharacterStore(s => s.draft);
  const saveDraft = useCharacterStore(s => s.saveDraft);
  // These were previously declared AFTER the `if (!draft) return null` guard
  // below, so on the render where draft flips from null → set the hook count
  // changed and React threw "Rendered fewer hooks than expected".
  const setDraft  = useCharacterStore(s => s.setDraft);
  const rules     = useCharacterStore(s => s.rules);
  const getMergedContentDB = useHomebrewStore(s => s.getMergedContentDB);
  // Re-audit A09/A01 (item 11): saveDraft() now reports whether the
  // durable write actually succeeded (see characterStore.ts's own doc
  // comment) instead of always clearing the draft and navigating away
  // optimistically. A failed save must leave the player on this screen,
  // with the draft still intact, able to retry — not silently lose the
  // character with no way back.
  const [saving,    setSaving]    = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!draft) router.replace('/creation/name');
  }, [draft?.id]);

  // Early return AFTER all hooks have been called.
  if (!draft) return null;

  const { identity, stats, derived, resources, features, choices } = draft;
  const pendingChoices = choices.filter(c => !c.resolved);

  // Compute race bonuses to show effective scores in the grid
  const raceBonuses: Partial<Record<Ability, number>> = {};
  for (const feature of features) {
    for (const effect of feature.effects) {
      if (
        effect.type === 'stat_modifier' &&
        effect.operation === 'add' &&
        typeof effect.value === 'number' &&
        ['str','dex','con','int','wis','cha'].includes(effect.target)
      ) {
        const ab = effect.target as Ability;
        raceBonuses[ab] = (raceBonuses[ab] ?? 0) + (effect.value as number);
      }
    }
  }
  const effectiveScore = (ab: Ability) => stats[ab] + (raceBonuses[ab] ?? 0);

  const mod = (s: number) => {
    const m = Math.floor((s - 10) / 2);
    return m >= 0 ? `+${m}` : `${m}`;
  };

  async function handleSave() {
    if (!draft || saving) return;
    setSaving(true);
    setSaveError(null);
    // 1. Recompute all derived stats with final scores + race bonuses applied.
    // 2. Recalculate HP from scratch so creation order doesn't affect the result.
    //    (If class was chosen before scores, HP was computed with ability mod 0.)
    //    Resolve the real hpAbility from the class's progression — defaults to
    //    CON for every official class and any homebrew class that didn't set
    //    one, so this is a no-op change for everything except homebrew classes
    //    that explicitly reflavor HP around a different ability.
    // getMergedContentDB() so a homebrew class sharing an official id
    // correctly wins — this resolution feeds hpAbility, which gets baked
    // directly into the character's persisted starting HP below, so the
    // previous official-wins bypass was real data corruption, not just a
    // display bug (audit finding CONTENT-1/2/3/4).
    const cls = getMergedContentDB().classes.find(c => c.id === draft.identity.classId);
    const hpAbility: Ability = (cls ? getProgressionForClass(cls).hpAbility : undefined) ?? 'con';
    let finalDraft = recomputeDerived(draft, rules);
    finalDraft     = recalculateAllHP(finalDraft, rules, hpAbility);
    // 3. Run recomputeDerived one more time so derived.ac etc. use the corrected stats.
    finalDraft     = recomputeDerived(finalDraft, rules);
    setDraft(finalDraft);
    const saved = await saveDraft();
    setSaving(false);
    if (saved) {
      router.replace('/(tabs)/');
    } else {
      // Draft (and its persisted SQLite row) are untouched by a failed
      // save — stay here so the player can just press Save again.
      setSaveError("Couldn't save your character — check your device storage and try again. Your progress is safe.");
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Review Character</Text>

      {/* Identity */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Identity</Text>
        <Row label="Name"       value={identity.name} />
        <Row label="Level"      value={String(identity.level)} />
        <Row label="Race"       value={identity.raceId || '—'} />
        <Row label="Class"      value={identity.classId || '—'} />
        <Row label="Background" value={identity.backgroundId || '—'} />
      </View>

      {/* Combat stats */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Combat</Text>
        <Row label="HP"         value={`${resources.hp.maximum}`} />
        <Row label="AC"         value={String(derived.ac)} />
        <Row label="Initiative" value={derived.initiative >= 0 ? `+${derived.initiative}` : String(derived.initiative)} />
        <Row label="Speed"      value={`${derived.speed} ft`} />
        <Row label="Prof. Bonus" value={`+${derived.proficiencyBonus}`} />
      </View>

      {/* Ability scores */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Ability Scores</Text>
        <View style={styles.abilityGrid}>
          {ABILITIES.map(ab => (
            <View key={ab} style={styles.abilityCard}>
              <Text style={styles.abilityLabel}>{ABILITY_LABELS[ab]}</Text>
              <Text style={styles.abilityScore}>{effectiveScore(ab)}</Text>
              <Text style={styles.abilityMod}>{mod(effectiveScore(ab))}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Features */}
      {features.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Features ({features.length})</Text>
          {features.map(f => (
            <View key={f.id} style={styles.featureRow}>
              <Text style={styles.featureName}>{f.name}</Text>
              <Text style={styles.featureSource}>{f.source.kind}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Pending choices */}
      {pendingChoices.length > 0 && (
        <View style={styles.warningBox}>
          <Text style={styles.warningTitle}>⚠️  {pendingChoices.length} choice(s) still pending</Text>
          <Text style={styles.warningText}>
            You can resolve these later from the character sheet. They won't block saving.
          </Text>
          {pendingChoices.map(c => (
            <Text key={c.id} style={styles.warningItem}>· {c.definition.prompt}</Text>
          ))}
        </View>
      )}

      {/* Save */}
      {saveError && (
        <View style={styles.warningBox}>
          <Text style={styles.warningTitle}>⚠️  Save failed</Text>
          <Text style={styles.warningText}>{saveError}</Text>
        </View>
      )}
      <Pressable style={[styles.saveBtn, saving && styles.saveBtnDisabled]} onPress={handleSave} disabled={saving}>
        <Text style={styles.saveBtnText}>{saving ? 'Saving…' : '⚔️  Save Character'}</Text>
      </Pressable>

      <Pressable style={styles.backBtn} onPress={safeGoBack}>
        <Text style={styles.backBtnText}>← Go back</Text>
      </Pressable>
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content:   { padding: Spacing.lg, paddingBottom: Spacing.xxl },

  heading: { fontSize: FontSize.xxl, fontWeight: FontWeight.black, color: Colors.gold, marginBottom: Spacing.xl },

  section: {
    backgroundColor: Colors.surface,
    borderRadius:    Radius.lg,
    borderWidth:     1,
    borderColor:     Colors.border,
    padding:         Spacing.md,
    marginBottom:    Spacing.md,
  },
  sectionTitle: {
    fontSize:     FontSize.sm,
    fontWeight:   FontWeight.bold,
    color:        Colors.textSecondary,
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  row: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  rowLabel: { fontSize: FontSize.md, color: Colors.textSecondary },
  rowValue: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },

  abilityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, justifyContent: 'space-between' },
  abilityCard: {
    width:           '30%',
    backgroundColor: Colors.surfaceHigh,
    borderRadius:    Radius.md,
    padding:         Spacing.sm,
    alignItems:      'center',
    marginBottom:    Spacing.sm,
  },
  abilityLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.textSecondary },
  abilityScore: { fontSize: FontSize.xl, fontWeight: FontWeight.black, color: Colors.textPrimary },
  abilityMod:   { fontSize: FontSize.sm, color: Colors.gold },

  featureRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  featureName:   { fontSize: FontSize.sm, color: Colors.textPrimary, flex: 1 },
  featureSource: { fontSize: FontSize.xs, color: Colors.textSecondary, textTransform: 'uppercase' },

  warningBox: {
    backgroundColor: Colors.redDim,
    borderRadius:    Radius.md,
    borderWidth:     1,
    borderColor:     Colors.red,
    padding:         Spacing.md,
    marginBottom:    Spacing.md,
  },
  warningTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Spacing.xs },
  warningText:  { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.sm },
  warningItem:  { fontSize: FontSize.sm, color: Colors.textPrimary, marginTop: 2 },

  saveBtn: {
    backgroundColor: Colors.gold,
    borderRadius:    Radius.md,
    paddingVertical: Spacing.md,
    alignItems:      'center',
    marginBottom:    Spacing.sm,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.bg },

  backBtn: {
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  backBtnText: { fontSize: FontSize.md, color: Colors.textSecondary },
});
