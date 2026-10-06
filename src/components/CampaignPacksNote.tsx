// src/components/CampaignPacksNote.tsx
// A campaign names the content packs its ruleset needs (Campaign.requiredPacks). A player who has not installed one is told, with
// the install when the pack ships with the app. Shown only when packs are the official content and something is missing.
import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import type { Campaign } from '../engine/types';
import { installedOfficialPacks } from '../content/officialPackService';
import { packShortfalls, describeShortfall, mergeRequiredPacks } from '../content/requiredPacks';
import { BUNDLED_PACKS } from '../content/bundledPacks';
import { useOfficialContentVersion } from '../hooks/useOfficialContentVersion';
import { ContentPacksPrompt } from './ContentPacksPrompt';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../theme';

export function CampaignPacksNote({ campaign }: { campaign: Pick<Campaign, 'requiredPacks' | 'rulesetId'> }) {
  useOfficialContentVersion();
  const [open, setOpen] = useState(false);
  const packs = installedOfficialPacks();
  if (packs.length === 0) return null;
  const shortfalls = packShortfalls(mergeRequiredPacks(campaign.requiredPacks, []), packs);
  if (shortfalls.length === 0) return null;
  const installable = shortfalls.map(s => s.id).filter(id => BUNDLED_PACKS.some(b => b.id === id));
  return (
    <>
      <View style={styles.banner} testID="campaign-packs-note">
        <Text style={styles.title}>This campaign needs content packs</Text>
        <Text style={styles.body}>{shortfalls.map(describeShortfall).join('. ')}.</Text>
        {installable.length > 0 && <Pressable style={styles.btn} onPress={() => setOpen(true)}><Text style={styles.btnTxt}>Install</Text></Pressable>}
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
