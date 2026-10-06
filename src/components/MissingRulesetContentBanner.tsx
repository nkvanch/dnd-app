// src/components/MissingRulesetContentBanner.tsx
// Shown on the creation screens when the character's edition has no content installed (a 5.5e character with no SRD 5.2.1
// pack): without it the lists look exactly like the 5e ones and nothing says why. Offers the install in one tap.
import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import type { RulesetId } from '../engine/types';
import { globalContentDB } from '../content/classes/library';
import { rulesetLabel } from '../content/rulesets';
import { BUNDLED_PACKS } from '../content/bundledPacks';
import { ContentPacksPrompt } from './ContentPacksPrompt';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../theme';

/** Whether any official class is written for this ruleset (the content that makes a character that edition). */
export function rulesetHasContent(ruleset: RulesetId | undefined): boolean {
  if (!ruleset) return true;
  return globalContentDB.classes.some(c => c.rulesetId === ruleset)
    || (ruleset === ('dnd5e-2014' as RulesetId) && globalContentDB.classes.length > 0);
}

export function MissingRulesetContentBanner({ ruleset }: { ruleset: RulesetId | undefined }) {
  const [open, setOpen] = useState(false);
  const [, bump] = useState(0);
  if (rulesetHasContent(ruleset)) return null;
  const pack = BUNDLED_PACKS.find(p => p.ruleset === ruleset);
  if (!pack) return null;   // no pack for this edition ships with the app
  return (
    <>
      <View style={styles.banner} testID="missing-ruleset-content">
        <Text style={styles.title}>No {rulesetLabel(ruleset)} content is installed</Text>
        <Text style={styles.body}>
          The lists below are the 5e (2014) ones. The {pack.name} pack adds the {rulesetLabel(ruleset)} classes, species, backgrounds, Origin feats and spells.
        </Text>
        <Pressable style={styles.btn} onPress={() => setOpen(true)} testID="missing-ruleset-install"><Text style={styles.btnTxt}>Install {pack.name}</Text></Pressable>
      </View>
      <ContentPacksPrompt visible={open} preselect={[pack.id]} onClose={() => { setOpen(false); bump(n => n + 1); }} />
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
