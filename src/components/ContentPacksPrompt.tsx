// src/components/ContentPacksPrompt.tsx
// "Choose content packs": install the SRD 5.1 pack, the SRD 5.2.1 pack, or both, from the files that ship with the app.
// Used on first launch, from the Packages list and from the banner that tells a 5.5e character creator the 2024 content
// is not installed. Nothing is installed until the player taps; skipping changes nothing.
import { useState } from 'react';
import { View, Text, Pressable, Modal, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { BUNDLED_PACKS, installBundledPacks } from '../content/bundledPacks';
import { installedOfficialPacks } from '../content/officialPackService';
import { sqlitePackStore } from '../content/officialPackStore';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../theme';

export function ContentPacksPrompt({ visible, onClose, preselect = [] }: {
  visible: boolean; onClose: (installed: boolean) => void; preselect?: readonly string[];
}) {
  const [chosen, setChosen] = useState<string[]>([...preselect]);
  const [busy, setBusy] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);
  const installed = new Set(installedOfficialPacks().map(p => p.manifest.id));

  function toggle(id: string) { setChosen(c => c.includes(id) ? c.filter(x => x !== id) : [...c, id]); }
  async function install(ids: string[]) {
    setBusy(true); setProblems([]);
    // Yield a frame so the spinner shows before the (CPU-heavy) hash check starts.
    await new Promise(r => setTimeout(r, 30));
    const result = await installBundledPacks(ids, sqlitePackStore);
    setBusy(false);
    if (result.ok) onClose(true); else setProblems(result.problems);
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => onClose(false)}>
      <View style={styles.backdrop}>
        <View style={styles.sheet} testID="content-packs-prompt">
          <Text style={styles.title}>Choose content packs</Text>
          <Text style={styles.sub}>Rules content comes in packs. Install the ones you play with; you can add or remove them later under Compendium → Packages.</Text>
          <ScrollView style={{ maxHeight: 320 }}>
            {BUNDLED_PACKS.map(p => {
              const on = installed.has(p.id) || chosen.includes(p.id);
              return (
                <Pressable key={p.id} style={[styles.row, on && styles.rowOn]} disabled={installed.has(p.id) || busy} onPress={() => toggle(p.id)}
                  accessibilityState={{ selected: on, disabled: installed.has(p.id) }}>
                  <Text style={styles.name}>{on ? '✓ ' : ''}{p.name}{installed.has(p.id) ? '  (installed)' : ''}</Text>
                  <Text style={styles.desc}>{p.summary}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <Text style={styles.note}>Installing replaces the built-in catalog with what the packs contain. Homebrew and characters are not changed.</Text>
          {problems.map((p, i) => <Text key={i} style={styles.problem}>{p}</Text>)}
          {busy ? <ActivityIndicator color={Colors.gold} /> : (
            <View style={styles.col}>
              <Pressable style={styles.primary} onPress={() => { void install(BUNDLED_PACKS.map(p => p.id)); }} testID="content-packs-both">
                <Text style={styles.primaryTxt}>Install both (recommended)</Text>
              </Pressable>
              <Pressable style={[styles.secondary, chosen.length === 0 && { opacity: 0.45 }]} disabled={chosen.length === 0} onPress={() => { void install(chosen); }} testID="content-packs-chosen">
                <Text style={styles.secondaryTxt}>Install selected{chosen.length > 0 ? ` (${chosen.length})` : ''}</Text>
              </Pressable>
              <Pressable style={styles.skip} onPress={() => onClose(false)} testID="content-packs-skip"><Text style={styles.skipTxt}>Skip for now</Text></Pressable>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#000000cc', justifyContent: 'center', padding: Spacing.md },
  sheet: { backgroundColor: Colors.surfaceHigh, borderRadius: Radius.lg, padding: Spacing.md, gap: Spacing.sm },
  title: { fontSize: FontSize.xl, fontWeight: FontWeight.black, color: Colors.gold, textAlign: 'center' },
  sub: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center' },
  row: { backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, padding: Spacing.sm, marginBottom: Spacing.xs, gap: 2 },
  rowOn: { borderColor: Colors.gold },
  name: { fontSize: FontSize.md, color: Colors.textPrimary, fontWeight: FontWeight.bold },
  desc: { fontSize: FontSize.sm, color: Colors.textSecondary },
  note: { fontSize: FontSize.xs, color: Colors.textDim },
  problem: { fontSize: FontSize.sm, color: Colors.red },
  col: { gap: Spacing.xs },
  primary: { backgroundColor: Colors.gold, borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center' },
  primaryTxt: { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.md },
  secondary: { backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.gold + '88', padding: Spacing.sm, alignItems: 'center' },
  secondaryTxt: { color: Colors.gold, fontWeight: FontWeight.bold },
  skip: { padding: Spacing.sm, alignItems: 'center' },
  skipTxt: { color: Colors.textSecondary },
});
