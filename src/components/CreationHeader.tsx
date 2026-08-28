// src/components/CreationHeader.tsx
// Shared header for the creation wizard screens.
// Adds safe-area top padding (so the back button isn't hidden under the status
// bar / clock) and a Cancel (✕) button on the right that discards the draft and
// returns to the home tab.
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useCharacterStore } from '../store/characterStore';
import { useSafeGoBack } from '../hooks/useSafeGoBack';
import { Alert } from '../utils/alert';
import { Colors, Spacing, FontSize, FontWeight } from '../theme';

interface Props {
  /** Show the back button (default true). Hidden on the first step. */
  showBack?: boolean;
  /** Override the default router.back() behaviour. */
  onBack?: () => void;
}

export function CreationHeader({ showBack = true, onBack }: Props) {
  const insets    = useSafeAreaInsets();
  const router    = useRouter();
  const safeGoBack = useSafeGoBack('/(tabs)');
  const clearDraft = useCharacterStore(s => s.clearDraft);

  function handleCancel() {
    Alert.alert(
      'Cancel character creation?',
      'Your progress will be discarded.',
      [
        { text: 'Keep editing', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => {
            clearDraft();
            router.replace('/(tabs)/');
          },
        },
      ],
    );
  }

  return (
    <View style={[styles.bar, { paddingTop: insets.top + Spacing.sm }]}>
      {showBack ? (
        <Pressable
          style={styles.btn}
          onPress={() => (onBack ? onBack() : safeGoBack())}
          hitSlop={8}
        >
          <Text style={styles.backTxt}>← Back</Text>
        </Pressable>
      ) : (
        <View style={styles.btn} />
      )}

      <Pressable style={styles.btn} onPress={handleCancel} hitSlop={8}>
        <Text style={styles.cancelTxt}>✕ Cancel</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
    backgroundColor: Colors.bg,
  },
  btn:       { paddingVertical: 4 },
  backTxt:   { fontSize: FontSize.md, color: Colors.gold, fontWeight: FontWeight.bold },
  cancelTxt: { fontSize: FontSize.md, color: Colors.textSecondary, fontWeight: FontWeight.bold },
});
