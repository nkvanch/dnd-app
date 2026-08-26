// app/about.tsx
// About & Legal — SRD 5.1 attribution (required by the CC-BY-4.0 license,
// see docs/ROADMAP_1.0.md Phase 1 Step 1.5), plus a short "what is this app"
// note and a link to the source document.
import { View, Text, Pressable, StyleSheet, ScrollView, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeGoBack } from '../src/hooks/useSafeGoBack';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../src/theme';

const SRD_URL = 'https://dnd.wizards.com/resources/systems-reference-document';

export default function AboutScreen() {
  const router = useRouter();
  const safeGoBack = useSafeGoBack('/(tabs)');

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>

      <View style={styles.headerRow}>
        <Pressable onPress={safeGoBack}>
          <Text style={styles.back}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>About &amp; Legal</Text>
        <View style={{ width: 60 }} />
      </View>

      <Section title="About Grimoire">
        <Text style={styles.body}>
          Grimoire is a table companion app for 5th-edition-compatible tabletop
          roleplaying games, built for personal use at a physical table.
          Character sheets, homebrew content, and campaign sync all stay on
          your devices — nothing is collected or sent anywhere.
        </Text>
      </Section>

      <Section title="Content License">
        <Text style={styles.body}>
          This work includes material taken from the System Reference
          Document 5.1 ("SRD 5.1") by Wizards of the Coast LLC and available
          at{' '}
          <Text style={styles.link} onPress={() => Linking.openURL(SRD_URL)}>
            dnd.wizards.com/resources/systems-reference-document
          </Text>
          . The SRD 5.1 is licensed under the Creative Commons Attribution
          4.0 International License, available at{' '}
          <Text
            style={styles.link}
            onPress={() => Linking.openURL('https://creativecommons.org/licenses/by/4.0/legalcode')}
          >
            creativecommons.org/licenses/by/4.0
          </Text>
          .
        </Text>
        <Text style={[styles.body, styles.bodySpaced]}>
          Grimoire is not affiliated with, endorsed by, or sponsored by
          Wizards of the Coast. Dungeons &amp; Dragons and its logo are
          trademarks of Wizards of the Coast LLC, and their use here is
          purely descriptive.
        </Text>
      </Section>

      <Section title="Your Content">
        <Text style={styles.body}>
          Some content in Grimoire is original homebrew, not derived from any
          published rulebook. It's provided as-is for your table and is
          clearly your own creative work, not official game content.
        </Text>
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
    padding:         Spacing.md,
    gap:             Spacing.sm,
  },

  body: {
    fontSize:  FontSize.sm,
    color:     Colors.textPrimary,
    lineHeight: 20,
  },
  bodySpaced: { marginTop: Spacing.xs },
  link: {
    color: Colors.gold,
    textDecorationLine: 'underline',
  },
});
