// src/components/SafeBottomView.tsx
// Wraps bottom-anchored content so it sits above the Android nav bar.
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scrollBottomPadding } from '../theme';

interface Props {
  children: React.ReactNode;
  minPadding?: number;
}

/**
 * Adds the ordinary visual spacing on top of the device's safe-area inset to
 * its children.
 * Use this around any button row that sits at the very bottom of a screen
 * to prevent it being obscured by the Android navigation bar.
 */
export function SafeBottomView({ children, minPadding = 16 }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ paddingBottom: scrollBottomPadding(insets.bottom, minPadding) }}>
      {children}
    </View>
  );
}
