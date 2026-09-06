// src/components/sheet/ConcentrationModal.tsx
// Shared concentration-check modal — used by both the player sheet
// (TabCharacter.tsx) and the DM quick panel (app/dm/encounter.tsx).
//
// Delegates the actual save to engine/combat.ts's concentrationCheck(),
// run through simulate() so the modal never re-derives the CON save bonus
// or the War Caster advantage rule itself — concentrationCheck already
// reads entity.derived.savingThrows.con (proficiency/Resilient-aware) and
// already rolls twice-take-higher when feat_war_caster is active.
import { useState } from 'react';
import { View, Text, Pressable, Modal, StyleSheet } from 'react-native';
import { Entity, CampaignRules } from '../../engine/types';
import { concentrationCheck } from '../../engine/combat';
import { simulate } from '../../engine/simulate';
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
  const spellName = entity.spellcasting?.concentrating ?? 'spell';
  const dc        = Math.max(10, Math.floor(damageTaken / 2));
  const conBonus  = entity.derived.savingThrows.con;

  function handleRoll() {
    const { after } = simulate(entity, e => concentrationCheck(e, damageTaken, rules), rules);
    setPassed(after.spellcasting?.concentrating === entity.spellcasting?.concentrating);
    onResolve(after);
  }

  function handleClose() {
    setPassed(null);
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
            <Pressable style={styles.rollBtn} onPress={handleRoll}>
              <Text style={styles.rollBtnTxt}>🎲 Roll CON Save</Text>
            </Pressable>
          ) : (
            <View style={[styles.concResult, passed ? styles.concPass : styles.concFail]}>
              <Text style={styles.concResultLabel}>
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
  rollBtn:          { backgroundColor: Colors.blue, borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center' },
  rollBtnTxt:       { color: Colors.white, fontWeight: FontWeight.bold, fontSize: FontSize.md },
  concResult:       { borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center', gap: Spacing.xs },
  concPass:         { backgroundColor: Colors.green + '22', borderWidth: 1, borderColor: Colors.green + '66' },
  concFail:         { backgroundColor: Colors.red   + '22', borderWidth: 1, borderColor: Colors.red   + '66' },
  concResultLabel:  { fontSize: FontSize.md, color: Colors.textPrimary, textAlign: 'center' },
  closeBtnSm:       { backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.sm, alignItems: 'center' },
  closeBtnSmTxt:    { color: Colors.textSecondary, fontSize: FontSize.md },
});
