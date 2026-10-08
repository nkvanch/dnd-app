// src/components/sheet/MissingPacksBanner.tsx
// A character remembers which content packs it was built from (Entity.requiredPacks). When packs are the app's official content
// and one it needs is not installed (removed, or the character came from another device), the sheet says so and offers the
// install when the pack ships with the app. Nothing is shown with the built-in catalog (no packs installed) or when all are there.
import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import type { Entity } from '../../engine/types';
import { installedOfficialPacks } from '../../content/officialPackService';
import { mergeRequiredPacks, requiredPacksFor, packShortfalls, describeShortfall } from '../../content/requiredPacks';
import { BUNDLED_PACKS } from '../../content/bundledPacks';
import { useOfficialContentVersion } from '../../hooks/useOfficialContentVersion';
import { ContentPacksPrompt } from '../ContentPacksPrompt';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../theme';

export function MissingPacksBanner({ entity }: { entity: Entity }) {
  useOfficialContentVersion();
  const [open, setOpen] = useState(false);
  const packs = installedOfficialPacks();
  if (packs.length === 0) return null;
  const required = mergeRequiredPacks(entity.requiredPacks, requiredPacksFor(entity, packs));
  const shortfalls = packShortfalls(required, packs);
  if (shortfalls.length === 0) return null;
  const installable = shortfalls.map(s => s.id).filter(id => BUNDLED_PACKS.some(b => b.id === id));
  return (
    <>
      <View style={styles.banner} testID="missing-packs-banner">
        <Text style={styles.title}>Content packs this character needs</Text>
        <Text style={styles.body}>{shortfalls.map(describeShortfall).join('. ')}. Some of its content will be missing until {shortfalls.length === 1 ? 'it is' : 'they are'} installed.</Text>
        {installable.length > 0
          ? <Pressable style={styles.btn} onPress={() => setOpen(true)} testID="missing-packs-install"><Text style={styles.btnTxt}>Install</Text></Pressable>
          : <Text style={styles.body}>Import the pack file under Compendium → Packages.</Text>}
      </View>
      <ContentPacksPrompt visible={open} preselect={installable} onClose={() => setOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  banner: { backgroundColor: Colors.gold + '18', borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.gold + '88', padding: Spacing.md, gap: Spacing.xs, marginBottom: Spacing.sm },
  title: { fontSize: FontSize.md, color: Colors.gold, fontWeight: FontWeight.bold },
  body: { fontSize: FontSize.sm, color: Colors.textPrimary },
  btn: { alignSelf: 'flex-start', backgroundColor: Colors.gold, borderRadius: Radius.md, paddingVertical: 8, paddingHorizontal: Spacing.md },
  btnTxt: { color: Colors.bg, fontWeight: FontWeight.bold },
});
