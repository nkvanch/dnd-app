// app/settings.tsx
// App Settings — device/app-level preferences. Game-rule configuration
// (HP mode, level cap, table rules, ability score cap, house rules) lives in
// Campaign Settings instead (app/creation/rules.tsx) — moved there since
// those are campaign concerns, not app-level ones. This screen links to it.
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeGoBack } from '../src/hooks/useSafeGoBack';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../src/theme';

export default function SettingsScreen() {
  const router = useRouter();
  const safeGoBack = useSafeGoBack('/(tabs)');

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>

      <View style={styles.headerRow}>
        <Pressable onPress={safeGoBack}>
          <Text style={styles.back}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>Settings</Text>
        <View style={{ width: 60 }} />
      </View>

      <Section title="Game Rules">
        <Pressable style={styles.linkRow} onPress={() => router.push('/creation/rules')}>
          <View style={styles.linkText}>
            <Text style={styles.optionLabel}>Campaign Settings</Text>
            <Text style={styles.optionDesc}>
              HP mode, level cap, ability score cap, feats/multiclassing/XP,
              and all house rules live here now.
            </Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      </Section>

      <Section title="Data">
        <Pressable style={styles.linkRow} onPress={() => router.push('/backup')}>
          <Text style={styles.optionLabel}>Backup &amp; Restore</Text>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      </Section>

      <Section title="About">
        <Pressable style={styles.linkRow} onPress={() => router.push('/about')}>
          <Text style={styles.optionLabel}>About &amp; Legal</Text>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      </Section>

    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title.toUpperCase()}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

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

  section:      { gap: Spacing.sm },
  sectionTitle: {
    fontSize:      FontSize.xs,
    fontWeight:    FontWeight.bold,
    color:         Colors.textSecondary,
    letterSpacing: 2,
  },
  sectionBody: {
    backgroundColor: Colors.surface,
    borderRadius:    Radius.lg,
    borderWidth:     1,
    borderColor:     Colors.border,
    overflow:        'hidden',
  },

  linkRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    padding:        Spacing.md,
    gap:            Spacing.md,
  },
  linkText:    { flex: 1 },
  optionLabel: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  optionDesc:  { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2, lineHeight: 16 },
  chevron:     { fontSize: FontSize.lg, color: Colors.textSecondary },
});
