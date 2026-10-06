// src/components/OfficialPackImportCard.tsx
// The confirm step of importing a first-party content pack (the SRD packs): what the pack is, what installing it does,
// and why it cannot be installed when it cannot. Nothing is installed until the player presses the button.
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import type { OfficialPackPreview } from '../content/officialPackService';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../theme';

const ACTION_LABEL = { install: 'Install Pack', update: 'Update Pack', same: 'Reinstall Pack' } as const;

export function OfficialPackImportCard({ preview, busy, onInstall, onCancel }: {
  preview: OfficialPackPreview; busy: boolean; onInstall: () => void; onCancel: () => void;
}) {
  if (!preview.ok) {
    return (
      <View style={styles.warn} testID="official-pack-problems">
        <Text style={styles.warnTitle}>This pack can’t be installed</Text>
        {preview.problems.map((p, i) => <Text key={i} style={styles.warnTxt}>{p}</Text>)}
        <Pressable style={styles.cancel} onPress={onCancel}><Text style={styles.cancelTxt}>Close</Text></Pressable>
      </View>
    );
  }
  const m = preview.manifest;
  return (
    <View style={styles.card} testID="official-pack-preview">
      <Text style={styles.badge}>OFFICIAL CONTENT PACK</Text>
      <Text style={styles.name}>{m.name}</Text>
      <Text style={styles.meta}>Version {m.version} · {m.ruleset} · {m.license}</Text>
      {preview.notes.map((n, i) => <Text key={i} style={styles.body}>{n}</Text>)}
      <Text style={styles.attribution}>{m.attribution}</Text>
      <View style={styles.row}>
        <Pressable style={styles.cancel} onPress={onCancel} disabled={busy}><Text style={styles.cancelTxt}>Cancel</Text></Pressable>
        <Pressable style={[styles.confirm, busy && { opacity: 0.6 }]} onPress={onInstall} disabled={busy} testID="official-pack-install">
          {busy ? <ActivityIndicator color={Colors.bg} /> : <Text style={styles.confirmTxt}>{ACTION_LABEL[preview.action]}</Text>}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.gold + '88', padding: Spacing.md, gap: Spacing.sm },
  badge: { fontSize: FontSize.xs, color: Colors.gold, fontWeight: FontWeight.bold, letterSpacing: 1 },
  name: { fontSize: FontSize.xl, color: Colors.textPrimary, fontWeight: FontWeight.black },
  meta: { fontSize: FontSize.sm, color: Colors.textSecondary },
  body: { fontSize: FontSize.sm, color: Colors.textPrimary, lineHeight: 19 },
  attribution: { fontSize: FontSize.xs, color: Colors.textDim, lineHeight: 16 },
  row: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
  cancel: { flex: 1, backgroundColor: Colors.surfaceHigh, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, alignItems: 'center' },
  cancelTxt: { color: Colors.textSecondary, fontWeight: FontWeight.bold },
  confirm: { flex: 1, backgroundColor: Colors.gold, borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center' },
  confirmTxt: { color: Colors.bg, fontWeight: FontWeight.bold },
  warn: { backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.red, padding: Spacing.md, gap: Spacing.sm },
  warnTitle: { color: Colors.red, fontSize: FontSize.md, fontWeight: FontWeight.bold },
  warnTxt: { color: Colors.textPrimary, fontSize: FontSize.sm },
});
