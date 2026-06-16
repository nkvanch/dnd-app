// app/settings.tsx
// Settings screen — exposes CampaignRules to the player/DM.
// "The app adapts to your table." Every default here can be overridden.
import { View, Text, Pressable, StyleSheet, Switch, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useCharacterStore, DEFAULT_RULES } from '../src/store/characterStore';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../src/theme';

type HpMode = 'fixed' | 'rolled' | 'max';

const HP_MODES: { value: HpMode; label: string; description: string }[] = [
  { value: 'fixed',  label: 'Fixed (PHB)',  description: 'Floor(die/2)+1 per level. Consistent and fair.' },
  { value: 'rolled', label: 'Rolled',       description: 'Roll your hit die each level. More exciting, less predictable.' },
  { value: 'max',    label: 'Max HP',       description: 'Always take the maximum. Heroic campaigns.' },
];

export default function SettingsScreen() {
  const router   = useRouter();
  const rules    = useCharacterStore(s => s.rules);
  const setRules = useCharacterStore(s => s.setRules);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>

      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>Settings</Text>
        <Pressable onPress={() => setRules(DEFAULT_RULES)}>
          <Text style={styles.reset}>Reset</Text>
        </Pressable>
      </View>

      {/* ── HP Mode ─────────────────────────────────────────────── */}
      <Section title="HP on Level Up">
        {HP_MODES.map(m => (
          <Pressable
            key={m.value}
            style={[styles.optionRow, rules.hpMode === m.value && styles.optionRowActive]}
            onPress={() => setRules({ hpMode: m.value })}
          >
            <View style={[styles.radio, rules.hpMode === m.value && styles.radioActive]}>
              {rules.hpMode === m.value && <View style={styles.radioDot} />}
            </View>
            <View style={styles.optionText}>
              <Text style={styles.optionLabel}>{m.label}</Text>
              <Text style={styles.optionDesc}>{m.description}</Text>
            </View>
          </Pressable>
        ))}
      </Section>

      {/* ── Level cap ───────────────────────────────────────────── */}
      <Section title="Maximum Level">
        <View style={styles.chipRow}>
          {[5, 10, 15, 20].map(lvl => (
            <Pressable
              key={lvl}
              style={[styles.chip, rules.maxLevel === lvl && styles.chipActive]}
              onPress={() => setRules({ maxLevel: lvl })}
            >
              <Text style={[styles.chipTxt, rules.maxLevel === lvl && styles.chipTxtActive]}>
                {lvl}
              </Text>
            </Pressable>
          ))}
          <Pressable
            style={[styles.chip, rules.maxLevel === null && styles.chipActive]}
            onPress={() => setRules({ maxLevel: null })}
          >
            <Text style={[styles.chipTxt, rules.maxLevel === null && styles.chipTxtActive]}>
              Uncapped
            </Text>
          </Pressable>
        </View>
        <Text style={styles.hint}>
          {rules.maxLevel === null
            ? 'Currently: Uncapped. Characters can level up to 20, the highest level any class progression in Grimoire defines.'
            : `Currently: Level ${rules.maxLevel ?? 20}. Characters cannot level beyond this.`}
        </Text>
      </Section>

      {/* ── Toggle rules ────────────────────────────────────────── */}
      <Section title="Table Rules">
        <ToggleRow
          label="Feats"
          description="Allow taking a Feat instead of an Ability Score Improvement."
          value={rules.customRules?.featsEnabled !== false}
          onToggle={v => setRules({ customRules: { ...rules.customRules, featsEnabled: v } })}
        />
        <ToggleRow
          label="Multiclassing"
          description="Allow characters to gain levels in more than one class."
          value={rules.allowMulticlass}
          onToggle={v => setRules({ allowMulticlass: v })}
        />
        <ToggleRow
          label="XP Tracking"
          description="Track experience points instead of milestone leveling."
          value={rules.useXP}
          onToggle={v => setRules({ useXP: v })}
        />
      </Section>

      {/* ── Ability score cap ───────────────────────────────────── */}
      <Section title="Ability Score Maximum">
        <View style={styles.chipRow}>
          {[18, 20, 24, 30].map(cap => (
            <Pressable
              key={cap}
              style={[styles.chip, rules.maxAbilityScore === cap && styles.chipActive]}
              onPress={() => setRules({ maxAbilityScore: cap })}
            >
              <Text style={[styles.chipTxt, rules.maxAbilityScore === cap && styles.chipTxtActive]}>
                {cap}
              </Text>
            </Pressable>
          ))}
          <Pressable
            style={[styles.chip, rules.maxAbilityScore === null && styles.chipActive]}
            onPress={() => setRules({ maxAbilityScore: null })}
          >
            <Text style={[styles.chipTxt, rules.maxAbilityScore === null && styles.chipTxtActive]}>
              Uncapped
            </Text>
          </Pressable>
        </View>
        <Text style={styles.hint}>
          {rules.maxAbilityScore === null
            ? 'Currently: Uncapped. Ability Score Improvements and feats always apply in full, with no ceiling.'
            : `Currently: ${rules.maxAbilityScore ?? 20}. Applies to ability score improvements. Standard D&D 5e is 20.`}
        </Text>
      </Section>

    </ScrollView>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title.toUpperCase()}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function ToggleRow({
  label, description, value, onToggle,
}: {
  label: string; description: string; value: boolean; onToggle: (v: boolean) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <View style={styles.toggleText}>
        <Text style={styles.toggleLabel}>{label}</Text>
        <Text style={styles.optionDesc}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: Colors.border, true: Colors.gold + '88' }}
        thumbColor={value ? Colors.gold : Colors.textDim}
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: Colors.bg },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xxl, gap: Spacing.lg },

  headerRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    paddingTop:     Spacing.xl + 8,
    marginBottom:   Spacing.md,
  },
  back:  { color: Colors.gold, fontSize: FontSize.md, fontWeight: FontWeight.bold },
  title: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  reset: { color: Colors.red, fontSize: FontSize.sm, fontWeight: FontWeight.bold },

  section:      { gap: Spacing.sm },
  sectionTitle: {
    fontSize:    FontSize.xs,
    fontWeight:  FontWeight.bold,
    color:       Colors.textSecondary,
    letterSpacing: 2,
  },
  sectionBody: {
    backgroundColor: Colors.surface,
    borderRadius:    Radius.lg,
    borderWidth:     1,
    borderColor:     Colors.border,
    overflow:        'hidden',
  },

  optionRow: {
    flexDirection: 'row',
    alignItems:    'center',
    padding:       Spacing.md,
    gap:           Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  optionRowActive: { backgroundColor: Colors.gold + '11' },
  optionText:  { flex: 1 },
  optionLabel: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  optionDesc:  { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2, lineHeight: 16 },

  radio: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  radioActive: { borderColor: Colors.gold },
  radioDot:    { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.gold },

  chipRow:  { flexDirection: 'row', padding: Spacing.sm, gap: Spacing.sm, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical:   Spacing.xs,
    borderRadius:      Radius.full,
    borderWidth:       1,
    borderColor:       Colors.border,
    backgroundColor:   Colors.surfaceHigh,
  },
  chipActive:    { borderColor: Colors.gold, backgroundColor: Colors.gold + '22' },
  chipTxt:       { fontSize: FontSize.md, color: Colors.textSecondary, fontWeight: FontWeight.bold },
  chipTxtActive: { color: Colors.gold },
  hint: {
    fontSize:    FontSize.xs,
    color:       Colors.textDim,
    fontStyle:   'italic',
    padding:     Spacing.md,
    paddingTop:  0,
  },

  toggleRow: {
    flexDirection:     'row',
    alignItems:        'center',
    padding:           Spacing.md,
    gap:               Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  toggleText:  { flex: 1 },
  toggleLabel: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
});
