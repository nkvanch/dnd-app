// src/components/sheet/EquipmentPreviewModal.tsx
// Preview an equip/unequip before committing it — shows AC, other derived
// stat changes, new/removed weapon attack bonuses, and resistance/immunity
// gained or lost, using the generic simulate() primitive. Third consumer
// of simulate(), after RestPreviewModal and FeatPreviewModal.
import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';
import { Entity, DerivedStats, DERIVED_NUMERIC_KEYS } from '../../engine/types';
import { collectAllEffects } from '../../engine/pipeline';
import { DERIVED_LABELS } from './derivedStatLabels';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../theme';

export type Row = { label: string; note?: string };

export function buildEquipmentSummaryRows(before: Entity, after: Entity): Row[] {
  const rows: Row[] = [];

  for (const key of DERIVED_NUMERIC_KEYS) {
    const k = key as keyof DerivedStats;
    const label = DERIVED_LABELS[k];
    if (!label) continue;
    const b = before.derived[k];
    const a = after.derived[k];
    if (b !== a) rows.push({ label: `${label}: ${b ?? '—'} → ${a ?? '—'}` });
  }

  // Weapon attack bonuses — by id, since equip/unequip adds/removes an
  // entry wholesale rather than just changing an existing one's value.
  const beforeAtk = new Map(before.derived.attackBonuses.map(a => [a.id, a]));
  const afterAtk  = new Map(after.derived.attackBonuses.map(a => [a.id, a]));
  for (const [id, a] of afterAtk) {
    if (!beforeAtk.has(id)) {
      rows.push({ label: `New attack: ${a.name} (+${a.bonus} to hit, ${a.damageDice}+${a.damageBonus} ${a.damageType})` });
    }
  }
  for (const [id, b] of beforeAtk) {
    if (!afterAtk.has(id)) rows.push({ label: `Attack removed: ${b.name}` });
  }

  // Resistance/immunity — not part of DerivedStats (surfaced elsewhere only
  // as informational action cards, see actionCards.ts) — walk
  // collectAllEffects for the two grant types and diff the target sets.
  const resistanceSet = (e: Entity) => new Set(
    collectAllEffects(e)
      .filter(ae => ae.effect.type === 'grant_resistance' || ae.effect.type === 'grant_immunity')
      .map(ae => `${ae.effect.type === 'grant_immunity' ? 'Immunity' : 'Resistance'}: ${ae.effect.target}`)
  );
  const beforeRes = resistanceSet(before);
  const afterRes  = resistanceSet(after);
  for (const r of afterRes)  if (!beforeRes.has(r)) rows.push({ label: `Gained ${r}` });
  for (const r of beforeRes) if (!afterRes.has(r))  rows.push({ label: `Lost ${r}` });

  return rows;
}

interface Props {
  visible:  boolean;
  kind:     'equip' | 'unequip';
  itemName: string;
  before:   Entity | null;
  after:    Entity | null;
  onConfirm: () => void;
  onCancel:  () => void;
}

export function EquipmentPreviewModal({ visible, kind, itemName, before, after, onConfirm, onCancel }: Props) {
  const rows = visible && before && after ? buildEquipmentSummaryRows(before, after) : [];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable style={styles.sheet} onPress={e => e.stopPropagation()}>
          <Text style={styles.title}>{kind === 'equip' ? 'Equip' : 'Unequip'} {itemName}</Text>

          {rows.length === 0 ? (
            <Text style={styles.emptyTxt}>No mechanical change.</Text>
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
