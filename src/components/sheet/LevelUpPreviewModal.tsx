// src/components/sheet/LevelUpPreviewModal.tsx
// Preview a level-up before committing it — shows HP/hit dice, spell slot,
// new feature, new resource, and derived stat changes, using the generic
// simulate() primitive. Fourth consumer of simulate(). Unlike the other
// three, the title is caller-supplied rather than computed from a `kind`
// prop — TabCharacter.tsx's LevelUpSection already knows exactly which of
// 3 cases it's in (single-class, leveling an existing multiclass entry, or
// adding a brand-new class) and can format the right title directly.
//
// CRITICAL correctness point: the caller must apply the `after` entity
// this component was given verbatim on Confirm — never call levelUp()/
// levelUpClass() a second time. CampaignRules.hpMode can be 'rolled'
// (Math.random() inside applyHP), so re-invoking the mutator would apply
// a DIFFERENT roll than the one just previewed. See LevelUpSection's
// confirmPendingLevelUp().
import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';
import { Entity, DerivedStats, DERIVED_NUMERIC_KEYS } from '../../engine/types';
import { DERIVED_LABELS } from './derivedStatLabels';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../theme';

const SLOT_TIERS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;

export type Row = { label: string; note?: string };

export function buildLevelUpSummaryRows(before: Entity, after: Entity): Row[] {
  const rows: Row[] = [];

  if (before.resources.hp.maximum !== after.resources.hp.maximum) {
    rows.push({ label: `Max HP: ${before.resources.hp.maximum} → ${after.resources.hp.maximum}` });
  }
  if (before.resources.hitDice.total !== after.resources.hitDice.total) {
    // A multiclass level-up can introduce a second hit-die size (see
    // HitDiceBlock's doc comment) — show the whole pool breakdown rather
    // than just the die size this one level happened to add.
    const dieLabel = after.resources.hitDice.pools
      ? after.resources.hitDice.pools.map(p => `d${p.die}×${p.total}`).join(' + ')
      : `d${after.resources.hitDice.die}`;
    rows.push({ label: `Hit Dice: ${before.resources.hitDice.total} → ${after.resources.hitDice.total} (${dieLabel})` });
  }

  if (before.spellcasting && after.spellcasting) {
    for (const tier of SLOT_TIERS) {
      const b = before.spellcasting.slots[tier];
      const a = after.spellcasting.slots[tier];
      if (!a || a.total === 0) continue;
      if (b?.used !== a.used || b?.total !== a.total) {
        rows.push({ label: `Level ${tier} slots: ${(b?.total ?? 0) - (b?.used ?? 0)} → ${a.total - a.used} available` });
      }
    }
  }

  const beforeFeatureIds = new Set(before.features.map(f => f.id));
  for (const f of after.features) {
    if (!beforeFeatureIds.has(f.id)) rows.push({ label: `New feature: ${f.name}` });
  }

  const beforeResourceIds = new Set(before.resources.custom.map(r => r.id));
  for (const r of after.resources.custom) {
    if (!beforeResourceIds.has(r.id)) rows.push({ label: `New resource: ${r.name} (${r.maximum})` });
  }

  for (const key of DERIVED_NUMERIC_KEYS) {
    const k = key as keyof DerivedStats;
    const label = DERIVED_LABELS[k];
    if (!label) continue;
    const b = before.derived[k];
    const a = after.derived[k];
    if (b !== a) rows.push({ label: `${label}: ${b ?? '—'} → ${a ?? '—'}` });
  }

  return rows;
}

interface Props {
  visible: boolean;
  title:   string;
  before:  Entity | null;
  after:   Entity | null;
  onConfirm: () => void;
  onCancel:  () => void;
}

export function LevelUpPreviewModal({ visible, title, before, after, onConfirm, onCancel }: Props) {
  const rows = visible && before && after ? buildLevelUpSummaryRows(before, after) : [];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable style={styles.sheet} onPress={e => e.stopPropagation()}>
          <Text style={styles.title}>{title}</Text>

          {rows.length === 0 ? (
            <Text style={styles.emptyTxt}>
              No mechanical change yet — resolve any pending choices on the Features tab.
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
