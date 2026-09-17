// src/components/NonSrdBadge.tsx
// Flags official content whose `srd` field isn't confirmed `true` — i.e.
// content that is NOT covered by the SRD 5.1 / CC-BY-4.0 license and is
// therefore excluded from any public/distributed build (see
// EXPO_PUBLIC_SRD_ONLY in eas.json and each content type's own `srd?`
// field doc comment in src/engine/types.ts). Purely informational on
// personal/dev builds, where all content is visible regardless — this is
// what lets a non-SRD item be told apart from an SRD-safe one at a glance
// while browsing, rather than only discovering the distinction by reading
// source. Never shown on homebrew content — homebrew is the user's own
// work, not Wizards IP, so "non-SRD" doesn't apply to it (use the existing
// "Homebrew" badge for that instead).
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../theme';

export function NonSrdBadge() {
  return (
    <View style={styles.badge}>
      <Text style={styles.txt}>Non-SRD</Text>
    </View>
  );
}

/** True when official content (never homebrew) should show the badge —
 *  `srd !== true` covers both explicitly-false and not-yet-audited
 *  (undefined) content, matching the same "unsafe by default" rule the
 *  EXPO_PUBLIC_SRD_ONLY build filter already uses. */
export function isNonSrd(srd: boolean | undefined): boolean {
  return srd !== true;
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: Colors.red + '22', borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.red + '66',
    paddingHorizontal: Spacing.sm, paddingVertical: 2,
  },
  txt: { fontSize: FontSize.xs, color: Colors.red, fontWeight: FontWeight.bold },
});
