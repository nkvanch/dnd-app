// src/components/LoadingScreen.tsx
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { Colors, FontSize } from '../theme';

interface Props {
  message?: string;
}

export function LoadingScreen({ message = 'Loading…' }: Props) {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={Colors.gold} />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: Colors.bg,
    alignItems: 'center', justifyContent: 'center', gap: 12,
  },
  text: { color: Colors.textSecondary, fontSize: FontSize.md },
});
