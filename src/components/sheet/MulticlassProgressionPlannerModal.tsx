// src/components/sheet/MulticlassProgressionPlannerModal.tsx
// A-61: multiclass counterpart to ProgressionPlannerModal — read-only,
// Close-only, same "compute fresh off the real entity every render, never
// touch the store" rule. The single-class planner jumps straight to a
// target LEVEL; multiclassing has no single "next level" — the player
// picks which class levels up at each step (Fighter 5/Wizard 2 → +1
// Wizard → +1 Fighter → +1 Wizard), so this builds an ORDERED SEQUENCE of
// per-class steps instead of a level-target stepper, reusing
// projectMulticlassSequence() (src/engine/leveling.ts) and
// buildProjectionRows (ProgressionPlannerModal.tsx, unchanged) for the row
// diff.
import { useState, useMemo } from 'react';
import { Modal, View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Entity, CampaignRules, ClassProgression, CharClass } from '../../engine/types';
import { getClassLevels } from '../../engine/multiclass';
import { projectMulticlassSequence, MulticlassPlanStep } from '../../engine/leveling';
import { buildProjectionRows } from './ProgressionPlannerModal';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../theme';

type SequenceStep = MulticlassPlanStep & { name: string };

interface Props {
  visible:            boolean;
  entity:              Entity;
  rules:               CampaignRules;
  availableToAdd:      CharClass[];
  classDefinitions?: readonly CharClass[];
  resolveProgression: (classId: string, subclassId: string | null) => ClassProgression | null;
  classLabel:          (id: string) => string;
  onClose:             () => void;
}

export function MulticlassProgressionPlannerModal({
  visible, entity, rules, availableToAdd, classDefinitions, resolveProgression, classLabel, onClose,
}: Props) {
  const [sequence, setSequence] = useState<SequenceStep[]>([]);
  const maxLevel = rules.maxLevel ?? 20;

  // Recomputed fresh off the REAL entity on every sequence change —
  // projectMulticlassSequence()/recomputeDerived() are pure, so this never
  // touches the store and never commits, no matter how long the sequence
  // grows while the modal is open.
  const projected = useMemo(() => {
    if (sequence.length === 0) return entity;
    return projectMulticlassSequence(entity, sequence, rules, classDefinitions);
  }, [entity, sequence, rules, classDefinitions]);

  const projectedClasses = useMemo(() => getClassLevels(projected), [projected]);
  const stillAddable = availableToAdd.filter(c => !projectedClasses.some(pc => pc.classId === c.id));
  const totalLevel = entity.identity.level + sequence.length;
  const atCap = totalLevel >= maxLevel;

  function addStep(classId: string, name: string, targetClass?: CharClass) {
    if (atCap) return;
    const existing = projectedClasses.find(c => c.classId === classId);
    const progression = resolveProgression(classId, existing?.subclassId ?? null);
    if (!progression) return;
    setSequence(s => [...s, { classId, name, progression, targetClass }]);
  }
  function undoLast() { setSequence(s => s.slice(0, -1)); }
  function reset()    { setSequence([]); }

  const rows = useMemo(() => {
    if (sequence.length === 0) return [];
    return buildProjectionRows(entity, projected);
  }, [entity, projected, sequence.length]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={e => e.stopPropagation()}>
          <Text style={styles.title}>Progression Planner</Text>
          <Text style={styles.subtitle}>Max HP assumed for all projected levels — read-only, changes nothing.</Text>

          {sequence.length > 0 && (
            <View style={styles.sequenceBox}>
              {sequence.map((step, i) => (
                <Text key={i} style={styles.sequenceItem}>
                  {i + 1}. {step.name}
                </Text>
              ))}
            </View>
          )}

          <View style={styles.pickRow}>
            {projectedClasses.map(c => (
              <Pressable
                key={c.classId}
                style={[styles.pickBtn, atCap && styles.pickBtnDisabled]}
                disabled={atCap}
                onPress={() => addStep(c.classId, classLabel(c.classId))}
              >
                <Text style={styles.pickBtnTxt}>+1 {classLabel(c.classId)} (→ {c.level + 1})</Text>
              </Pressable>
            ))}
            {stillAddable.map(c => (
              <Pressable
                key={c.id}
                style={[styles.pickBtn, atCap && styles.pickBtnDisabled]}
                disabled={atCap}
                onPress={() => addStep(c.id, c.name, c)}
              >
                <Text style={styles.pickBtnTxt}>+ Add {c.name}</Text>
              </Pressable>
            ))}
          </View>

          {sequence.length > 0 && (
            <View style={styles.undoRow}>
              <Pressable style={styles.undoBtn} onPress={undoLast}>
                <Text style={styles.undoBtnTxt}>↩ Undo last</Text>
              </Pressable>
              <Pressable style={styles.undoBtn} onPress={reset}>
                <Text style={styles.undoBtnTxt}>Reset</Text>
              </Pressable>
            </View>
          )}

          {sequence.length === 0 ? (
            <Text style={styles.emptyTxt}>Tap a class above to plan its next level.</Text>
          ) : rows.length === 0 ? (
            <Text style={styles.emptyTxt}>No mechanical change projected.</Text>
          ) : (
            <ScrollView style={styles.rowsBox}>
              {rows.map((row, i) => (
                <View key={i} style={styles.row}>
                  <Text style={styles.rowTxt}>{row.label}</Text>
                  {row.note && <Text style={styles.rowNote}>{row.note}</Text>}
                </View>
              ))}
            </ScrollView>
          )}

          <Pressable style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeTxt}>Close</Text>
          </Pressable>
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
    padding: Spacing.md, gap: Spacing.sm, maxHeight: '85%',
  },
  title:    { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.gold, textAlign: 'center' },
  subtitle: { fontSize: FontSize.xs, color: Colors.textDim, textAlign: 'center' },

  sequenceBox: {
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.sm, gap: 2,
  },
  sequenceItem: { fontSize: FontSize.sm, color: Colors.textSecondary },

  pickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, justifyContent: 'center' },
  pickBtn: {
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.gold + '66',
    paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs,
  },
  pickBtnDisabled: { opacity: 0.4 },
  pickBtnTxt: { fontSize: FontSize.xs, color: Colors.gold, fontWeight: FontWeight.bold },

  undoRow: { flexDirection: 'row', gap: Spacing.sm, justifyContent: 'center' },
  undoBtn: { paddingHorizontal: Spacing.sm, paddingVertical: 4 },
  undoBtnTxt: { fontSize: FontSize.xs, color: Colors.textDim, textDecorationLine: 'underline' },

  emptyTxt: { fontSize: FontSize.md, color: Colors.textDim, textAlign: 'center', paddingVertical: Spacing.md },
  rowsBox: {
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.sm, gap: Spacing.xs, flexGrow: 0,
  },
  row: { paddingVertical: 2 },
  rowTxt: { fontSize: FontSize.sm, color: Colors.textPrimary },
  rowNote: { fontSize: FontSize.xs, color: Colors.textDim, marginTop: 1 },

  closeBtn: {
    backgroundColor: Colors.gold, borderRadius: Radius.md,
    padding: Spacing.md, alignItems: 'center', marginTop: Spacing.sm,
  },
  closeTxt: { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.md },
});
