// src/components/sheet/ConcentrationModal.tsx
// Shared concentration-check modal — used by both the player sheet
// (TabCharacter.tsx) and the DM quick panel (app/dm/encounter.tsx).
//
// Table-first resolution: manual Success/Failure are the primary actions —
// the DM/player rolled the save at the table and taps the result directly.
// "Roll in App" is a secondary convenience that computes the same save
// (rollConcentrationSave, reading entity.derived.savingThrows.con and the
// War Caster advantage rule) and then calls the EXACT SAME resolution path
// (resolveConcentrationOutcome) the manual buttons call — never a separate
// consequence path. concentrationCheck() itself is left untouched for any
// other existing caller; this modal now composes its two halves directly.
import { useState } from 'react';
import { View, Text, Pressable, Modal, StyleSheet } from 'react-native';
import { Entity, CampaignRules } from '../../engine/types';
import { rollConcentrationSave, resolveConcentrationOutcome } from '../../engine/combat';
import { recomputeDerived } from '../../engine/pipeline';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../theme';

interface Props {
  visible:     boolean;
  damageTaken: number;
  entity:      Entity;
  rules:       CampaignRules;
  onResolve:   (updated: Entity) => void;
  onClose:     () => void;
}

export function ConcentrationModal({ visible, damageTaken, entity, rules, onResolve, onClose }: Props) {
  const [passed, setPassed] = useState<boolean | null>(null);
  const [rolled, setRolled] = useState<number | null>(null);
  // Recomputed once up front — the same normalization simulate() applied
  // here previously (recomputeDerived before reading/mutating), so a
  // possibly-stale `entity` prop never leaks into the displayed DC/bonus,
  // the roll, or the final resolution.
  const freshEntity = recomputeDerived(entity, rules);
  const spellName = freshEntity.spellcasting?.concentrating ?? 'spell';
  const dc        = Math.max(10, Math.floor(damageTaken / 2));
  const conBonus  = freshEntity.derived.savingThrows.con;

  function resolve(didPass: boolean, roll: number | null) {
    setPassed(didPass);
    setRolled(roll);
    onResolve(recomputeDerived(resolveConcentrationOutcome(freshEntity, didPass), rules));
  }

  function handleRoll() {
    const result = rollConcentrationSave(freshEntity, damageTaken);
    resolve(result.passed, result.roll);
  }

  function handleClose() {
    setPassed(null);
    setRolled(null);
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <Pressable style={styles.backdrop} onPress={handleClose}>
        <Pressable style={styles.concSheet} onPress={e => e.stopPropagation()}>
          <Text style={styles.concTitle}>🧠 Concentration Check</Text>
          <Text style={styles.concSpell}>Concentrating on: {spellName}</Text>
          <Text style={styles.concDc}>DC {dc} Constitution save (+{conBonus})</Text>

          {passed === null ? (
            <>
              {/* Primary — table-first: the save was already made at the table. */}
              <View style={styles.concBtnRow}>
                <Pressable style={[styles.concBtn, styles.concBtnFail]} onPress={() => resolve(false, null)}>
                  <Text style={styles.concBtnFailTxt}>✖ Failure</Text>
                </Pressable>
                <Pressable style={[styles.concBtn, styles.concBtnPass]} onPress={() => resolve(true, null)}>
                  <Text style={styles.concBtnPassTxt}>✔ Success</Text>
                </Pressable>
              </View>
              {/* Secondary convenience — rolls, then resolves through the same path. */}
              <Pressable style={styles.rollBtn} onPress={handleRoll}>
                <Text style={styles.rollBtnTxt}>🎲 Roll in App</Text>
              </Pressable>
            </>
          ) : (
            <View style={[styles.concResult, passed ? styles.concPass : styles.concFail]}>
              <Text style={styles.concResultLabel}>
                {rolled !== null ? `Rolled ${rolled} — ` : ''}
                {passed ? '✅ Pass — Concentration kept' : '❌ Fail — Concentration dropped'}
              </Text>
            </View>
          )}

          <Pressable style={styles.closeBtnSm} onPress={handleClose}>
            <Text style={styles.closeBtnSmTxt}>Done</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop:   { flex: 1, backgroundColor: '#000000bb', justifyContent: 'center', padding: Spacing.lg },
  concSheet: {
    backgroundColor: Colors.surfaceHigh, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.blue + '44',
    padding: Spacing.lg, gap: Spacing.sm,
  },
  concTitle:        { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.blue, textAlign: 'center' },
  concSpell:        { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center' },
  concDc:           { fontSize: FontSize.md, color: Colors.textPrimary, textAlign: 'center', fontWeight: FontWeight.bold },
  concBtnRow:       { flexDirection: 'row', gap: Spacing.sm },
  concBtn:          { flex: 1, borderRadius: Radius.md, borderWidth: 1, padding: Spacing.md, alignItems: 'center' },
  concBtnFail:      { backgroundColor: Colors.red   + '22', borderColor: Colors.red   + '66' },
  concBtnFailTxt:   { color: Colors.red,   fontWeight: FontWeight.bold, fontSize: FontSize.md },
  concBtnPass:      { backgroundColor: Colors.green + '22', borderColor: Colors.green + '66' },
  concBtnPassTxt:   { color: Colors.green, fontWeight: FontWeight.bold, fontSize: FontSize.md },
  rollBtn:          { backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.sm, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  rollBtnTxt:       { color: Colors.textSecondary, fontWeight: FontWeight.bold, fontSize: FontSize.sm },
  concResult:       { borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center', gap: Spacing.xs },
  concPass:         { backgroundColor: Colors.green + '22', borderWidth: 1, borderColor: Colors.green + '66' },
  concFail:         { backgroundColor: Colors.red   + '22', borderWidth: 1, borderColor: Colors.red   + '66' },
  concResultLabel:  { fontSize: FontSize.md, color: Colors.textPrimary, textAlign: 'center' },
  closeBtnSm:       { backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.sm, alignItems: 'center' },
  closeBtnSmTxt:    { color: Colors.textSecondary, fontSize: FontSize.md },
});
