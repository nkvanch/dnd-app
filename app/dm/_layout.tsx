// app/dm/_layout.tsx
// Shared DM-only route gate for every screen under app/dm/*.
//
// dashboard.tsx and encounter.tsx each had their own inline `if (!isDm)
// return <DM access only>` guard, but monsters.tsx, encounter-builder.tsx,
// encounters.tsx, and character/[id].tsx had none at all — since expo-router
// auto-generates a route for every file regardless of how a user normally
// reaches it, those four were reachable directly by URL (a web build, or a
// constructed deep link on native) with zero access control, exposing full
// DM override UI to a non-DM session (audit finding ROUTE-GUARD-1). One
// shared gate here covers every current and future screen in this route
// group instead of repeating the guard per-screen.
import { Stack } from 'expo-router';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useCampaignStore } from '../../src/store/campaignStore';
import { useSafeGoBack } from '../../src/hooks/useSafeGoBack';
import { Colors, FontSize, FontWeight } from '../../src/theme';

export default function DmLayout() {
  const isDm = useCampaignStore(s => s.isDm);
  const safeGoBack = useSafeGoBack('/(tabs)');

  if (!isDm) {
    return (
      <View style={styles.screen}>
        <Pressable style={styles.backBtn} onPress={safeGoBack}>
          <Text style={styles.backTxt}>← Back</Text>
        </Pressable>
        <View style={styles.center}>
          <Text style={styles.errorTxt}>DM access only.</Text>
        </View>
      </View>
    );
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg, padding: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorTxt: { color: Colors.red, fontSize: FontSize.lg },
  backBtn: { alignSelf: 'flex-start' },
  backTxt: { color: Colors.gold, fontSize: FontSize.md, fontWeight: FontWeight.bold },
});
