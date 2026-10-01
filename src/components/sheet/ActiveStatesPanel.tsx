// src/components/sheet/ActiveStatesPanel.tsx
// Timed states a feature switched ON (Conqueror's Tempo, Avatar of
// Tenochtitlan, Royal Panoply …): Grimoire tracks no clock, so the player ends
// them here when the duration is up. Lists every feature whose use sets a flag
// that is currently on.
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Entity } from '../../engine/types';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../theme';

export function activeStates(entity: Entity): { flag: string; featureName: string }[] {
  const flags = entity.conditionMonitor.flags;
  const out: { flag: string; featureName: string }[] = [];
  for (const f of entity.features) {
    if (!f.isActive) continue;
    for (const ae of f.abilityEffects ?? []) {
      if (ae.type === 'set_flag' && ae.value === true && flags[ae.flag] === true && ae.flag !== 'concentrating' && !out.some(o => o.flag === ae.flag)) {
        out.push({ flag: ae.flag, featureName: f.name });
      }
    }
  }
  return out;
}

export function ActiveStatesPanel({ entity, onEntityUpdate }: { entity: Entity; onEntityUpdate?: (e: Entity) => void }) {
  const states = activeStates(entity);
  if (states.length === 0 || !onEntityUpdate) return null;
  return (
    <View style={styles.panel}>
      <Text style={styles.title}>ACTIVE NOW</Text>
      {states.map(s => (
        <View key={s.flag} style={styles.row}>
          <Text style={styles.name}>{s.featureName}</Text>
          <Pressable style={styles.btn} onPress={() => onEntityUpdate({
            ...entity, conditionMonitor: { ...entity.conditionMonitor, flags: { ...entity.conditionMonitor.flags, [s.flag]: false } },
          })}>
            <Text style={styles.btnTxt}>End</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.gold, padding: Spacing.md, gap: Spacing.xs },
  title: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.gold, letterSpacing: 1 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { color: Colors.textPrimary, fontSize: FontSize.md, fontWeight: FontWeight.bold },
  btn: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.sm, paddingHorizontal: Spacing.md, paddingVertical: 4 },
  btnTxt: { color: Colors.textSecondary, fontSize: FontSize.sm },
});
