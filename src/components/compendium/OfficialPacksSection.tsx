// src/components/compendium/OfficialPacksSection.tsx
// Compendium → Packages: the first-party content packs (the SRD packs) installed on this device, with Remove. Shown only
// when there is at least one. Removal is refused (with the reason) if another installed pack needs the one removed, and
// removing the last pack puts the built-in catalog back.
import { shareText } from '../../io/exportShare';
import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { installedOfficialPacks, onOfficialPacksChanged, removeOfficialPack } from '../../content/officialPackService';
import { sqlitePackStore } from '../../content/officialPackStore';
import { Alert } from '../../utils/alert';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../theme';

export function OfficialPacksSection() {
  const [packs, setPacks] = useState(() => [...installedOfficialPacks()]);
  useEffect(() => onOfficialPacksChanged(() => setPacks([...installedOfficialPacks()])), []);
  if (packs.length === 0) return null;

  /** The pack file as it was installed (signature included), to send to another device or to upload where others can download it. */
  async function sharePack(pack: (typeof packs)[number]) {
    try { await shareText(JSON.stringify(pack), `${pack.manifest.id}-${pack.manifest.version}.grimoire-pack`, 'json', 'share'); }
    catch (e) { Alert.alert('Could not share the pack', e instanceof Error ? e.message : String(e)); }
  }

  function confirmRemove(id: string, name: string) {
    Alert.alert(`Remove ${name}?`, 'Characters that use its content keep their saved data, but the content is hidden until a pack that has it is installed again. Your homebrew is not touched.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => { void removeOfficialPack(id, sqlitePackStore).then(r => { if (!r.ok) Alert.alert('Can’t remove it', r.problems.join('\n')); }); } },
    ]);
  }

  return (
    <View style={styles.wrap} testID="official-packs-section">
      <Text style={styles.title}>OFFICIAL CONTENT PACKS</Text>
      {packs.map(p => {
        const m = p.manifest;
        return (
          <View key={m.id} style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{m.name} <Text style={styles.ver}>v{m.version}</Text></Text>
              <Text style={styles.meta}>{m.ruleset} · {m.license} · {Object.entries(m.counts).map(([k, v]) => `${v} ${k}`).join(', ')}</Text>
            </View>
            <Pressable style={styles.shareBtn} onPress={() => { void sharePack(p); }} accessibilityLabel={`Share ${m.name}`} testID={`share-pack-${m.id}`}>
              <Text style={styles.shareTxt}>Share</Text>
            </Pressable>
            <Pressable style={styles.btn} onPress={() => confirmRemove(m.id, m.name)} accessibilityLabel={`Remove ${m.name}`}>
              <Text style={styles.btnTxt}>Remove</Text>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.gold + '66', padding: Spacing.sm, gap: Spacing.xs, marginBottom: Spacing.sm },
  title: { fontSize: FontSize.xs, color: Colors.gold, fontWeight: FontWeight.bold, letterSpacing: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  name: { fontSize: FontSize.md, color: Colors.textPrimary, fontWeight: FontWeight.bold },
  ver: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.normal },
  meta: { fontSize: FontSize.xs, color: Colors.textDim },
  shareBtn: { backgroundColor: Colors.surfaceHigh, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.gold + '88', paddingHorizontal: Spacing.sm, paddingVertical: 6 },
  shareTxt: { fontSize: FontSize.xs, color: Colors.gold, fontWeight: FontWeight.bold },
  btn: { backgroundColor: Colors.surfaceHigh, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.red + '88', paddingHorizontal: Spacing.sm, paddingVertical: 6 },
  btnTxt: { fontSize: FontSize.xs, color: Colors.red, fontWeight: FontWeight.bold },
});
