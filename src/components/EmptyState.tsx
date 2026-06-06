// src/components/EmptyState.tsx
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../theme';

interface Props {
  icon?:       string;
  title:       string;
  subtitle?:   string;
  actionLabel?: string;
  onAction?:   () => void;
}

export function EmptyState({ icon = '📭', title, subtitle, actionLabel, onAction }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      {actionLabel && onAction && (
        <Pressable style={styles.btn} onPress={onAction}>
          <Text style={styles.btnTxt}>{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    padding: Spacing.xl, gap: Spacing.sm,
  },
  icon:     { fontSize: 56 },
  title:    { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary, textAlign: 'center' },
  subtitle: { fontSize: FontSize.md, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  btn: {
    marginTop: Spacing.md, backgroundColor: Colors.gold,
    borderRadius: Radius.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
  },
  btnTxt: { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.md },
});
