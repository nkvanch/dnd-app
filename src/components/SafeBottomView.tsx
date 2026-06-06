// src/components/SafeBottomView.tsx
// Wraps bottom-anchored content so it sits above the Android nav bar.
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Props {
  children: React.ReactNode;
  minPadding?: number;
}

/**
 * Adds paddingBottom = max(safeArea.bottom, minPadding) to its children.
 * Use this around any button row that sits at the very bottom of a screen
 * to prevent it being obscured by the Android navigation bar.
 */
export function SafeBottomView({ children, minPadding = 16 }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ paddingBottom: Math.max(insets.bottom, minPadding) }}>
      {children}
    </View>
  );
}
