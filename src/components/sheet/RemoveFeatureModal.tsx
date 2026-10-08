// src/components/sheet/RemoveFeatureModal.tsx
// Preview + confirm before removing a feature live (both players and DMs,
// mid-session) — the first consumer of the live feature/background editing
// track. Same "compute once, apply the stored `after` verbatim on Confirm"
// rule as every other preview modal (simulate()), and reuses
// featureGrantRows.ts's buildFeatureGrantRows (shared with the later
// add-custom-feature modal) for the diff.
import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';
import { Entity, CampaignRules } from '../../engine/types';
import { removeFeature } from '../../engine/leveling';
import { simulate } from '../../engine/simulate';
import { buildFeatureGrantRows } from './featureGrantRows';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../theme';

interface Props {
  visible:   boolean;
  entity:    Entity;
  rules:     CampaignRules;
  featureId: string | null;
  onConfirm: (updated: Entity) => void;
  onCancel:  () => void;
}

export function RemoveFeatureModal({ visible, entity, rules, featureId, onConfirm, onCancel }: Props) {
  const feature = featureId ? entity.features.find(f => f.id === featureId) : undefined;
  const { before, after } = featureId
    ? simulate(entity, e => removeFeature(e, featureId), rules)
    : { before: entity, after: entity };
  const rows = visible && featureId ? buildFeatureGrantRows(before, after) : [];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable style={styles.sheet} onPress={e => e.stopPropagation()}>
          <Text style={styles.title}>Remove {feature?.name ?? 'Feature'}?</Text>

          {rows.length === 0 ? (
            <Text style={styles.emptyTxt}>No other tracked change.</Text>
          ) : (
            <View style={styles.rowsBox}>
              {rows.map((row, i) => (
                <View key={i} style={styles.row}>
                  <Text style={styles.rowTxt}>{row.label}</Text>
                  {row.note && <Text style={styles.rowNote}>{row.note}</Text>}
                </View>
              ))}
            </View>
          )}

          <View style={styles.actions}>
            <Pressable style={styles.cancelBtn} onPress={onCancel}>
              <Text style={styles.cancelTxt}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.confirmBtn} onPress={() => onConfirm(after)}>
              <Text style={styles.confirmTxt}>Remove</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#000000cc', justifyContent: 'center', padding: Spacing.md },
  sheet: {
    backgroundColor: Colors.surfaceHigh,
    borderRadius: Radius.lg,
    padding: Spacing.md, gap: Spacing.sm,
  },
  title: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.red, textAlign: 'center' },
  emptyTxt: { fontSize: FontSize.md, color: Colors.textDim, textAlign: 'center', paddingVertical: Spacing.md },

  rowsBox: {
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.sm, gap: Spacing.xs,
  },
  row: { paddingVertical: 2 },
  rowTxt: { fontSize: FontSize.sm, color: Colors.textPrimary },
  rowNote: { fontSize: FontSize.xs, color: Colors.textDim, marginTop: 1 },

  actions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  cancelBtn: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, alignItems: 'center',
  },
  cancelTxt: { color: Colors.textSecondary, fontWeight: FontWeight.bold, fontSize: FontSize.md },
  confirmBtn: {
    flex: 1, backgroundColor: Colors.red, borderRadius: Radius.md,
    padding: Spacing.md, alignItems: 'center',
  },
  confirmTxt: { color: Colors.white, fontWeight: FontWeight.bold, fontSize: FontSize.md },
});
