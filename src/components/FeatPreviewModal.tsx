// src/components/FeatPreviewModal.tsx
// Preview a feat before committing it (AsiFeatPicker.tsx's commitFeat) —
// shows what will actually change (effective ability scores, derived
// stats, new skill/save proficiencies, max HP) using the generic
// simulate() primitive. A feat's ability-score bonus is injected as a
// stat_modifier Effect (see AsiFeatPicker.tsx's featureToApply()), not
// written to entity.stats directly, so the row-builder diffs EFFECTIVE
// stats (applyStatModifiers + collectAllEffects), the same computation
// AsiFeatPicker.tsx already does for its own display.
import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';
import { Entity, Feat, Ability, SkillName, DerivedStats, DERIVED_NUMERIC_KEYS } from '../engine/types';
import { applyStatModifiers, collectAllEffects } from '../engine/pipeline';
import { DERIVED_LABELS } from './sheet/derivedStatLabels';
import { SKILL_LABELS } from './sheet/skillLabels';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../theme';

const ABILITIES: Ability[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

export type Row = { label: string; note?: string };

export function buildFeatSummaryRows(before: Entity, after: Entity): Row[] {
  const rows: Row[] = [];

  const beforeEff = applyStatModifiers(before.stats, collectAllEffects(before));
  const afterEff  = applyStatModifiers(after.stats,  collectAllEffects(after));
  for (const ab of ABILITIES) {
    if (beforeEff[ab] !== afterEff[ab]) {
      rows.push({ label: `${ab.toUpperCase()}: ${beforeEff[ab]} → ${afterEff[ab]}` });
    }
  }

  for (const key of DERIVED_NUMERIC_KEYS) {
    const k = key as keyof DerivedStats;
    const label = DERIVED_LABELS[k];
    if (!label) continue; // proficiencyBonus never changes from a feat — no label, skip
    const b = before.derived[k];
    const a = after.derived[k];
    if (b !== a) rows.push({ label: `${label}: ${b ?? '—'} → ${a ?? '—'}` });
  }

  for (const skill of Object.keys(after.skills.skills) as SkillName[]) {
    const b = before.skills.skills[skill];
    const a = after.skills.skills[skill];
    if (!b.trained && a.trained) rows.push({ label: `${SKILL_LABELS[skill]}: proficient` });
    else if (!b.expertise && a.expertise) rows.push({ label: `${SKILL_LABELS[skill]}: expertise` });
  }

  for (const ab of ABILITIES) {
    if (!before.proficiencies.savingThrows.includes(ab) && after.proficiencies.savingThrows.includes(ab)) {
      rows.push({ label: `${ab.toUpperCase()} saving throws: proficient` });
    }
  }

  if (before.resources.hp.maximum !== after.resources.hp.maximum) {
    rows.push({ label: `Max HP: ${before.resources.hp.maximum} → ${after.resources.hp.maximum}` });
  }

  return rows;
}

interface Props {
  visible: boolean;
  before:  Entity | null;
  after:   Entity | null;
  feat:    Feat | null;
  onConfirm: () => void;
  onCancel:  () => void;
}

export function FeatPreviewModal({ visible, before, after, feat, onConfirm, onCancel }: Props) {
  const rows = visible && before && after ? buildFeatSummaryRows(before, after) : [];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable style={styles.sheet} onPress={e => e.stopPropagation()}>
          <Text style={styles.title}>Taking {feat?.name}</Text>

          {rows.length === 0 ? (
            <Text style={styles.emptyTxt}>
              This feat's effects aren't automatically tracked — see its description above.
            </Text>
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
            <Pressable style={styles.confirmBtn} onPress={onConfirm}>
              <Text style={styles.confirmTxt}>Confirm</Text>
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
  title: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.gold, textAlign: 'center' },
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
    flex: 1, backgroundColor: Colors.gold, borderRadius: Radius.md,
    padding: Spacing.md, alignItems: 'center',
  },
  confirmTxt: { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.md },
});
