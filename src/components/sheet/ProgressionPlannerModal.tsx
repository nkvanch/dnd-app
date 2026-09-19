// src/components/sheet/ProgressionPlannerModal.tsx
// Read-only "what would my character look like at level N" projection.
// Rides on projectToLevel() (src/engine/leveling.ts) and reuses
// LevelUpPreviewModal's buildLevelUpSummaryRows for the determinate rows —
// same diff logic a real level-up already uses, just applied to a
// multi-level jump. Deliberately Close-only, no Confirm — same precedent
// HomebrewTestModal.tsx established for the homebrew test bench: nothing
// here is ever committed, this is a read-only projection against the real
// character, not a pending real mutation.
import { useState, useMemo } from 'react';
import { Modal, View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Entity, CampaignRules, ClassProgression, CharClass } from '../../engine/types';
import { projectToLevel } from '../../engine/leveling';
import { buildLevelUpSummaryRows, Row } from './LevelUpPreviewModal';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../theme';

export function buildProjectionRows(before: Entity, after: Entity): Row[] {
  const rows = buildLevelUpSummaryRows(before, after);

  // Disclose pending choices the projection queued but couldn't
  // auto-resolve (ASI/feat, subclass, ...) rather than silently omitting
  // them — same "show what's determinate, disclose the rest" pattern the
  // homebrew test bench uses for a feat's unresolved ability/skill choice.
  const beforeChoiceIds = new Set(before.choices.map(c => c.id));
  for (const c of after.choices) {
    if (c.resolved || beforeChoiceIds.has(c.id)) continue;
    rows.push({
      label: `Level ${c.grantedAt}: ${c.definition.prompt}`,
      note: 'Pending choice — not shown here, resolve on the Features tab',
    });
  }

  return rows;
}

interface Props {
  visible:     boolean;
  entity:      Entity;
  rules:       CampaignRules;
  progression: ClassProgression;
  classDefinitions?: readonly CharClass[];
  onClose:     () => void;
}

export function ProgressionPlannerModal({ visible, entity, rules, progression, classDefinitions, onClose }: Props) {
  const maxLevel = rules.maxLevel ?? 20;
  const currentLevel = entity.identity.level;
  const [targetLevel, setTargetLevel] = useState(Math.min(currentLevel + 1, maxLevel));

  // Recomputed fresh on every stepper move, directly off the real current
  // entity — projectToLevel()/recomputeDerived() are pure, so this never
  // touches the store and never commits anything, regardless of how many
  // times the target level changes while the modal is open.
  const rows = useMemo(() => {
    if (!visible || targetLevel <= currentLevel) return [];
    const after = projectToLevel(entity, targetLevel, progression, rules, classDefinitions);
    return buildProjectionRows(entity, after);
  }, [visible, entity, targetLevel, progression, rules, currentLevel, classDefinitions]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={e => e.stopPropagation()}>
          <Text style={styles.title}>Progression Planner</Text>
          <Text style={styles.subtitle}>Max HP assumed for all projected levels — read-only, changes nothing.</Text>

          <View style={styles.stepperRow}>
            <Pressable
              style={[styles.stepBtn, targetLevel <= currentLevel + 1 && styles.stepBtnDisabled]}
              disabled={targetLevel <= currentLevel + 1}
              onPress={() => setTargetLevel(l => Math.max(currentLevel + 1, l - 1))}
            >
              <Text style={styles.stepBtnTxt}>−</Text>
            </Pressable>
            <Text style={styles.stepperLabel}>Level {targetLevel}</Text>
            <Pressable
              style={[styles.stepBtn, targetLevel >= maxLevel && styles.stepBtnDisabled]}
              disabled={targetLevel >= maxLevel}
              onPress={() => setTargetLevel(l => Math.min(maxLevel, l + 1))}
            >
              <Text style={styles.stepBtnTxt}>+</Text>
            </Pressable>
          </View>

          {rows.length === 0 ? (
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

  stepperRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.md, marginVertical: Spacing.xs },
  stepBtn: {
    width: 40, height: 40, borderRadius: Radius.md,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  stepBtnDisabled: { opacity: 0.4 },
  stepBtnTxt: { fontSize: FontSize.lg, color: Colors.gold, fontWeight: FontWeight.bold },
  stepperLabel: { fontSize: FontSize.md, color: Colors.textPrimary, fontWeight: FontWeight.bold, minWidth: 80, textAlign: 'center' },

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
