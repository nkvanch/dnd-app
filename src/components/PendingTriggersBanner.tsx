// src/components/PendingTriggersBanner.tsx
// Zero-HP triggers (Death Burst, Pressure Collapse) that fired and are waiting
// for the table: shows the rules text plus the ready damage roll, and a
// "Resolved" button. Grimoire never applies this damage to other creatures.
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Entity } from '../engine/types';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../theme';

export function PendingTriggersBanner({ entity, onDismiss }: { entity: Entity; onDismiss: (triggerId: string) => void }) {
  const list = entity.pendingTriggers ?? [];
  if (list.length === 0) return null;
  return (
    <View style={styles.wrap}>
      {list.map(t => (
        <View key={t.id} style={styles.card}>
          <Text style={styles.title}>{t.name} — {entity.identity.name || 'creature'} dropped to 0 HP</Text>
          <Text style={styles.body}>{t.text}{t.area ? ` (${t.area})` : ''}</Text>
          {t.save && <Text style={styles.body}>DC {t.save.dc} {t.save.ability.toUpperCase()} save · {t.save.onSuccess === 'half' ? 'half damage on a success' : 'no effect on a success'}</Text>}
          {t.rolled && <Text style={styles.roll}>Rolled {t.rolled.total} ({t.rolled.dice}){t.rolled.damageType ? ` ${t.rolled.damageType}` : ''} damage — apply it to each creature that fails (the app does not).</Text>}
          <Pressable style={styles.btn} onPress={() => onDismiss(t.id)}><Text style={styles.btnTxt}>Resolved</Text></Pressable>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.xs, padding: Spacing.sm },
  card: { backgroundColor: Colors.red + '22', borderColor: Colors.red, borderWidth: 1, borderRadius: Radius.md, padding: Spacing.sm, gap: 2 },
  title: { color: Colors.red, fontWeight: FontWeight.bold, fontSize: FontSize.sm },
  body: { color: Colors.textPrimary, fontSize: FontSize.xs },
  roll: { color: Colors.gold, fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  btn: { alignSelf: 'flex-start', borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 4, marginTop: 2 },
  btnTxt: { color: Colors.textSecondary, fontSize: FontSize.xs },
});
