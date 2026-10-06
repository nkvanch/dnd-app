// src/components/EditionBadge.tsx
// Which edition a piece of content is from, on every row and detail header that lists classes, species, backgrounds,
// subclasses and feats. Content tagged for a ruleset shows that ruleset; official content with no tag is the original
// 5e (2014) content; homebrew with no tag works in every edition and shows nothing.
import { View, Text, StyleSheet } from 'react-native';
import type { RulesetId } from '../engine/types';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../theme';

const SHORT: Record<string, string> = {
  'dnd5e-2014': '5e · 2014',
  'dnd5e-2024': '5.5e · 2024',
  'dnd4e': '4e', 'dnd3.5e': '3.5e', adnd1e: 'AD&D 1e', adnd2e: 'AD&D 2e', pf1e: 'PF 1e', pf2e: 'PF 2e', ose: 'OSE',
};

/** The short edition label for a piece of content, or undefined when it belongs to no particular edition. */
export function editionLabel(item: { rulesetId?: RulesetId }, official: boolean): string | undefined {
  if (item.rulesetId) return SHORT[item.rulesetId] ?? item.rulesetId;
  return official ? SHORT['dnd5e-2014'] : undefined;
}

export function EditionBadge({ item, official = true }: { item: { rulesetId?: RulesetId }; official?: boolean }) {
  const label = editionLabel(item, official);
  if (!label) return null;
  const is2024 = item.rulesetId === ('dnd5e-2024' as RulesetId);
  return (
    <View style={[styles.badge, is2024 && styles.badge2024]} testID="edition-badge" accessibilityLabel={`Edition: ${label}`}>
      <Text style={[styles.txt, is2024 && styles.txt2024]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: Colors.surfaceHigh, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.sm, paddingVertical: 2,
  },
  badge2024: { backgroundColor: Colors.gold + '22', borderColor: Colors.gold + '88' },
  txt: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: FontWeight.bold },
  txt2024: { color: Colors.gold },
});
