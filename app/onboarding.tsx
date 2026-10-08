// app/onboarding.tsx
// First-launch onboarding — 3 skippable screens, then either creates a real
// character or seeds the sample character (built via buildDemoCharacter,
// the real engine pipeline — see src/engine/demoCharacter.ts).
// docs/ROADMAP_1.0.md Phase 3.3.
import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, useWindowDimensions, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { setMeta } from '../src/db/appMetaRepo';
import { useCharacterStore } from '../src/store/characterStore';
import { buildDemoCharacter } from '../src/engine/demoCharacter';
import { spellRepo } from '../src/content/spellRepo';
import { spellIdsOnEntity } from '../src/content/spellRepo.types';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../src/theme';

const PANELS = [
  {
    emoji: '📖',
    title: 'Welcome to Grimoire',
    body: 'A table companion for 5th-edition-compatible tabletop games. Character sheets, dice, and campaign sync \u2014 built for playing at a real table.',
  },
  {
    emoji: '📶',
    title: 'Offline-first, always',
    body: "Everything lives on your device. Campaign sync connects phones directly over the same WiFi \u2014 no account, no internet required, no data leaves the room.",
  },
  {
    emoji: '\u2728',
    title: 'Ready to start?',
    body: 'Create your own character, or explore a ready-made level-3 Fighter to see how everything works first.',
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [panel, setPanel] = useState(0);
  const [buildingDemo, setBuildingDemo] = useState(false);

  const rules = useCharacterStore(s => s.rules);
  const saveDraft = useCharacterStore(s => s.saveDraft);
  const setDraft = useCharacterStore(s => s.setDraft);

  const isLast = panel === PANELS.length - 1;

  async function finish() {
    await setMeta('onboarding_complete', 'true').catch(() => {});
  }

  async function handleSkip() {
    await finish();
    router.replace('/(tabs)');
  }

  async function handleCreateReal() {
    await finish();
    router.replace('/creation/name');
  }

  async function handleTryDemo() {
    setBuildingDemo(true);
    try {
      const demo = buildDemoCharacter(rules);
      await spellRepo.ensureLoaded(spellIdsOnEntity(demo));
      setDraft(demo);
      const saved = await saveDraft();
      await finish();
      // saveDraft() (re-audit A09, item 11) now only clears the draft and
      // commits it to the character list once the SQLite write actually
      // succeeds — navigating to the sheet on a failed save would open a
      // character that was never actually persisted.
      router.replace(saved ? (`/sheet/${demo.id}` as any) : '/(tabs)');
    } catch (e) {
      console.error('[onboarding] buildDemoCharacter failed:', e);
      setBuildingDemo(false);
      // Fall back to just entering the app rather than getting stuck.
      await finish();
      router.replace('/(tabs)');
    }
  }

  const p = PANELS[panel];

  return (
    <View style={styles.screen}>
      {panel < PANELS.length - 1 && (
        <Pressable style={styles.skipBtn} onPress={handleSkip}>
          <Text style={styles.skipTxt}>Skip</Text>
        </Pressable>
      )}

      <View style={styles.content}>
        <Text style={styles.emoji}>{p.emoji}</Text>
        <Text style={styles.title}>{p.title}</Text>
        <Text style={styles.body}>{p.body}</Text>
      </View>

      <View style={styles.dots}>
        {PANELS.map((_, i) => (
          <View key={i} style={[styles.dot, i === panel && styles.dotActive]} />
        ))}
      </View>

      {!isLast ? (
        <Pressable style={styles.nextBtn} onPress={() => setPanel(panel + 1)}>
          <Text style={styles.nextBtnTxt}>Next</Text>
        </Pressable>
      ) : (
        <View style={styles.finalBtnRow}>
          <Pressable
            style={[styles.demoBtn, buildingDemo && styles.btnDisabled]}
            onPress={handleTryDemo}
            disabled={buildingDemo}
          >
            {buildingDemo
              ? <ActivityIndicator color={Colors.gold} />
              : <Text style={styles.demoBtnTxt}>Try Sample Character</Text>}
          </Pressable>
          <Pressable
            style={[styles.createBtn, buildingDemo && styles.btnDisabled]}
            onPress={handleCreateReal}
            disabled={buildingDemo}
          >
            <Text style={styles.createBtnTxt}>Create My Own</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1, backgroundColor: Colors.bg,
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.xl + 8, paddingBottom: Spacing.xl,
    justifyContent: 'space-between',
  },
  skipBtn: { alignSelf: 'flex-end' },
  skipTxt: { color: Colors.textSecondary, fontSize: FontSize.md, fontWeight: FontWeight.bold },

  content: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
  emoji: { fontSize: 64 },
  title: { fontSize: FontSize.xxl, fontWeight: FontWeight.black, color: Colors.textPrimary, textAlign: 'center' },
  body: { fontSize: FontSize.md, color: Colors.textSecondary, textAlign: 'center', lineHeight: 24, maxWidth: 320 },

  dots: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.xs, marginBottom: Spacing.lg },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.border },
  dotActive: { backgroundColor: Colors.gold, width: 20 },

  nextBtn: {
    backgroundColor: Colors.gold, borderRadius: Radius.md,
    paddingVertical: Spacing.md, alignItems: 'center',
  },
  nextBtnTxt: { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.lg },

  finalBtnRow: { gap: Spacing.sm },
  demoBtn: {
    backgroundColor: Colors.surfaceHigh, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.gold + '66',
    paddingVertical: Spacing.md, alignItems: 'center',
  },
  demoBtnTxt: { color: Colors.gold, fontWeight: FontWeight.bold, fontSize: FontSize.md },
  createBtn: {
    backgroundColor: Colors.gold, borderRadius: Radius.md,
    paddingVertical: Spacing.md, alignItems: 'center',
  },
  createBtnTxt: { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.md },
  btnDisabled: { opacity: 0.5 },
});
