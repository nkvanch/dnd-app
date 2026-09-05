// src/components/sheet/RestPreviewModal.tsx
// Preview a Short/Long Rest before committing — shows exactly what will
// change (HP, hit dice, spell slots, resources, exhaustion, concentration,
// until-rest conditions) using the generic simulate() primitive, so the
// preview can never drift from what actually happens on Confirm: both read
// from the same buildRestMutation() function exported here.
import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';
import { Entity, CampaignRules } from '../../engine/types';
import { takeRest } from '../../engine/rest';
import { expireOverrides } from '../../engine/dmOverride';
import { endWildShape } from '../../engine/combat';
import { simulate } from '../../engine/simulate';
import { spellRepo } from '../../content/spellRepo';
import { CONDITIONS_BY_ID } from '../../content/conditions/index';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../theme';

const SLOT_TIERS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;

/** The exact rest mutation the app applies — shared by the real handler in
 * app/sheet/[id].tsx and this preview, so they can never show/do different
 * things. */
export function buildRestMutation(kind: 'short' | 'long', rules: CampaignRules) {
  return (e: Entity): Entity => {
    let updated = takeRest(e, kind, rules);
    if (kind === 'long') updated = expireOverrides(updated, 'end_of_session', rules);
    if (updated.wildShapeState?.active) updated = endWildShape(updated, rules);
    return updated;
  };
}

export type Row = { label: string; note?: string };

export function buildRestSummaryRows(before: Entity, after: Entity): Row[] {
  const rows: Row[] = [];

  if (before.resources.hp.current !== after.resources.hp.current) {
    rows.push({
      label: `HP: ${before.resources.hp.current} → ${after.resources.hp.current} / ${after.resources.hp.maximum}`,
      note: before.resources.hp.temp > 0 ? 'Temporary HP cleared' : undefined,
    });
  }

  if (before.resources.hitDice.remaining !== after.resources.hitDice.remaining) {
    rows.push({
      label: `Hit Dice: ${before.resources.hitDice.remaining}/${before.resources.hitDice.total} → ${after.resources.hitDice.remaining}/${after.resources.hitDice.total}`,
    });
  }

  if (before.spellcasting && after.spellcasting) {
    for (const tier of SLOT_TIERS) {
      const b = before.spellcasting.slots[tier];
      const a = after.spellcasting.slots[tier];
      if (!a || a.total === 0) continue;
      if (b?.used !== a.used) {
        rows.push({ label: `Level ${tier} slots: ${a.total - (b?.used ?? 0)} → ${a.total - a.used} available` });
      }
    }
    const bPact = before.spellcasting.pactSlots;
    const aPact = after.spellcasting.pactSlots;
    if (aPact) {
      for (const tier of SLOT_TIERS) {
        const b = bPact?.[tier];
        const a = aPact[tier];
        if (!a || a.total === 0) continue;
        if (b?.used !== a.used) {
          rows.push({ label: `Pact slots (lvl ${tier}): ${a.total - (b?.used ?? 0)} → ${a.total - a.used} available` });
        }
      }
    }
  }

  for (const after_r of after.resources.custom) {
    const before_r = before.resources.custom.find(r => r.id === after_r.id);
    if (before_r && before_r.current !== after_r.current) {
      rows.push({ label: `${after_r.name}: ${before_r.current} → ${after_r.current} / ${after_r.maximum}` });
    }
  }

  if (before.conditionMonitor.exhaustion !== after.conditionMonitor.exhaustion) {
    rows.push({ label: `Exhaustion: ${before.conditionMonitor.exhaustion} → ${after.conditionMonitor.exhaustion}` });
  }

  if (before.spellcasting?.concentrating && !after.spellcasting?.concentrating) {
    const spellId = before.spellcasting.concentrating;
    const name = spellRepo.getSpellSync(spellId)?.name ?? spellId;
    rows.push({ label: `Concentration on ${name} dropped` });
  }

  const afterActiveIds = new Set(after.conditionMonitor.active.map(c => c.id));
  const removedConditions = before.conditionMonitor.active.filter(c => !afterActiveIds.has(c.id));
  if (removedConditions.length > 0) {
    const names = removedConditions.map(c => CONDITIONS_BY_ID[c.id]?.name ?? c.id).join(', ');
    rows.push({ label: `Conditions removed: ${names}` });
  }

  return rows;
}

interface Props {
  visible: boolean;
  kind:    'short' | 'long';
  entity:  Entity;
  rules:   CampaignRules;
  onConfirm: () => void;
  onCancel:  () => void;
}

export function RestPreviewModal({ visible, kind, entity, rules, onConfirm, onCancel }: Props) {
  // Only simulate while actually visible — no need to run a rest mutation
  // on every render of the (usually closed) sheet screen.
  let rows: Row[] = [];
  if (visible) {
    const { before, after } = simulate(entity, buildRestMutation(kind, rules), rules);
    rows = buildRestSummaryRows(before, after);
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable style={styles.sheet} onPress={e => e.stopPropagation()}>
          <Text style={styles.title}>{kind === 'short' ? '☕ Short Rest' : '🌙 Long Rest'}</Text>

          {rows.length === 0 ? (
            <Text style={styles.emptyTxt}>Nothing to restore.</Text>
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
