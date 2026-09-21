// app/(tabs)/homebrew.tsx
// Homebrew tab — CREATION and editing entry points (the Create panel, Custom
// Rule Profiles, and Import Homebrew). The Homebrew LIBRARY (browse/manage
// existing content) and the INSTALLED PACKAGES list moved to
// Compendium → Homebrew / Compendium → Packages; this screen keeps small
// shortcuts to them and redirects the old `?view=library|packages` links.
import { useEffect } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../src/theme';
import { useCustomRuleProfileStore } from '../../src/store/customRuleProfileStore';
import { useCompendiumModeStore } from '../../src/store/compendiumModeStore';
import { compendiumHref, legacyHomebrewViewRedirect, CompendiumMode } from '../../src/content/compendiumModes';

// ── Create Panel ──────────────────────────────────────────────────────────────

function CreatePanel() {
  const router = useRouter();
  const ruleProfiles = useCustomRuleProfileStore(s => s.profiles);
  const ITEMS = [
    { label: '⚔️  New Race',        route: '/homebrew/race-builder'  },
    { label: '🧬  New Subrace',      route: '/homebrew/subrace-builder' },
    { label: '🎓  New Class',        route: '/homebrew/class-builder' },
    { label: '🎭  New Subclass',     route: '/homebrew/subclass-builder' },
    { label: '📜  New Background',   route: '/homebrew/background-builder' },
    { label: '🧰  New Item',         route: '/homebrew/item-builder'  },
    { label: '💎  Rare Items',       route: '/homebrew/rare-items'    },
    { label: '✨  New Spell',        route: '/homebrew/spell-builder' },
    { label: '📖  New Feature',      route: '/homebrew/feature-editor' },
    { label: '🌟  New Feat',         route: '/homebrew/feat-builder' },
    { label: '🐉  New Monster',      route: '/homebrew/monster-builder' },
    { label: '🩹  New Condition',    route: '/homebrew/condition-builder' },
    { label: '⚙️  Custom Rule Profile', route: '/homebrew/rule-profile' },
  ];

  return (
    <View style={styles.panel}>
      <Text style={styles.panelTitle}>🛠 Create</Text>
      <Text style={styles.panelSub}>Build custom races, classes, spells, and features with the guided editors.</Text>
      <View style={styles.createGrid}>
        {ITEMS.map(item => (
          <Pressable
            key={item.route + item.label}
            style={styles.createBtn}
            onPress={() => router.push(item.route as any)}
          >
            <Text style={styles.createBtnTxt}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
      {ruleProfiles.length > 0 && <View style={{ marginTop: Spacing.sm }}>
        <Text style={styles.panelSub}>Saved Custom Rule Profiles</Text>
        {ruleProfiles.map(profile => <Pressable key={profile.id} style={styles.createBtn} onPress={() => router.push(('/homebrew/rule-profile?editId=' + profile.id) as any)}><Text style={styles.createBtnTxt}>⚙️ {profile.name}</Text></Pressable>)}
      </View>}
    </View>
  );
}

// ── Homebrew Screen ───────────────────────────────────────────────────────────

export default function HomebrewScreen() {
  const router = useRouter();
  const { view } = useLocalSearchParams<{ view?: string }>();

  // Old deep links to the two views that moved into the Compendium. Only the
  // library/packages views are redirected — creation routes are never touched.
  const legacyTarget = legacyHomebrewViewRedirect(view);
  useEffect(() => {
    if (legacyTarget) router.replace(legacyTarget);
  }, [legacyTarget, router]);

  function openInCompendium(mode: CompendiumMode) {
    useCompendiumModeStore.getState().setMode(mode);
    router.navigate(compendiumHref(mode));
  }

  if (legacyTarget) return <View style={styles.screen} />;

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Homebrew</Text>
        <Pressable style={styles.importBtn} onPress={() => router.push('/homebrew/import-package')}>
          <Text style={styles.importBtnTxt}>⬇️ Import Homebrew</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <CreatePanel />
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>📚 Your content</Text>
          <Text style={styles.panelSub}>Browse, edit, export and delete what you've made — and manage installed packages — in the Compendium.</Text>
          <View style={styles.linkRow}>
            <Pressable style={styles.linkBtn} testID="homebrew-open-library" onPress={() => openInCompendium('homebrew')}>
              <Text style={styles.linkBtnTxt}>Compendium → Homebrew</Text>
            </Pressable>
            <Pressable style={styles.linkBtn} testID="homebrew-open-packages" onPress={() => openInCompendium('packages')}>
              <Text style={styles.linkBtnTxt}>Compendium → Packages</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  header: {
    paddingTop: Spacing.xl + 8, paddingBottom: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm,
  },
  title:  { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.gold },
  importBtn: {
    backgroundColor: Colors.surfaceHigh, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.gold + '66',
    paddingHorizontal: Spacing.sm, paddingVertical: 6,
  },
  importBtnTxt: { fontSize: FontSize.xs, color: Colors.gold, fontWeight: FontWeight.bold },
  content: { padding: Spacing.md, paddingBottom: Spacing.xxl, gap: Spacing.md },

  panel: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.md, gap: Spacing.sm,
  },
  panelTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  panelSub:   { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },

  createGrid: { gap: Spacing.xs },
  createBtn: {
    backgroundColor: Colors.surfaceHigh, borderRadius: Radius.md,
    padding: Spacing.md, borderWidth: 1, borderColor: Colors.border,
  },
  createBtnTxt: { fontSize: FontSize.md, color: Colors.textPrimary },

  linkRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  linkBtn: {
    backgroundColor: Colors.surfaceHigh, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.gold + '66',
    paddingHorizontal: Spacing.sm, paddingVertical: 8,
  },
  linkBtnTxt: { fontSize: FontSize.xs, color: Colors.gold, fontWeight: FontWeight.bold },
});
