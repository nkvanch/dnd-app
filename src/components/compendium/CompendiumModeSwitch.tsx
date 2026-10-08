// src/components/compendium/CompendiumModeSwitch.tsx
// The Official / Homebrew / Packages same-page segmented switch. Deliberately
// the SAME look as the Combat / Exploration switch on the character sheet
// (app/sheet/[id].tsx: modeSwitch/modeBtn) — compact, full-width segments,
// gold selected state, no navigation.
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../theme';
import { COMPENDIUM_MODES, COMPENDIUM_MODE_LABELS, CompendiumMode } from '../../content/compendiumModes';

export function CompendiumModeSwitch({ mode, onChange }: { mode: CompendiumMode; onChange: (m: CompendiumMode) => void }) {
  return (
    <View style={styles.modeSwitch} accessibilityRole="tablist">
      {COMPENDIUM_MODES.map(m => {
        const active = mode === m;
        return (
          <Pressable
            key={m}
            testID={`compendium-mode-${m}`}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={[styles.modeBtn, active && styles.modeBtnActive]}
            onPress={() => onChange(m)}
          >
            <Text style={[styles.modeTxt, active && styles.modeTxtActive]}>{COMPENDIUM_MODE_LABELS[m]}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  modeSwitch: {
    flexDirection: 'row', gap: Spacing.xs,
    padding: Spacing.sm,
    backgroundColor: Colors.bg,
  },
  modeBtn: {
    flex: 1, paddingVertical: Spacing.sm, alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
  },
  modeBtnActive: { backgroundColor: Colors.gold + '22', borderColor: Colors.gold },
  modeTxt:       { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.bold },
  modeTxtActive: { color: Colors.gold },
});
