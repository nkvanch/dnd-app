// src/components/sheet/HpModal.tsx
// Damage / Heal input modal.
import { useState } from 'react';
import { Modal, View, Text, Pressable, TextInput, StyleSheet } from 'react-native';
import { COMMON_DAMAGE_TYPES } from '../../content/traitCompiler';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../theme';

const NONMAGICAL_QUALIFYING_TYPES = new Set(['bludgeoning', 'piercing', 'slashing']);

interface Props {
  visible:  boolean;
  currentHp: number;
  maxHp:     number;
  onDamage:  (amount: number, damageType?: string, isNonmagicalAttack?: boolean) => void;
  onHeal:    (amount: number) => void;
  onClose:   () => void;
  /** Rules-engine blocker RE-AUDIT closure (3A): true only while the
   * character is transformed into a BeastForm that actually declares
   * `nonmagicalPhysicalResistance` — the same bounded, table-first
   * per-hit fact the DM's Wild Shape damage controls already expose
   * (app/dm/encounter.tsx), now available to the player's own HP modal. */
  showNonmagicalOption?: boolean;
}

export function HpModal({ visible, currentHp, maxHp, onDamage, onHeal, onClose, showNonmagicalOption }: Props) {
  const [text, setText] = useState('');
  const [damageType, setDamageType] = useState('');
  const [nonmagicalAttack, setNonmagicalAttack] = useState(false);
  const amount = parseInt(text, 10);
  const valid  = !isNaN(amount) && amount > 0;
  const nonmagicalOptionShown = !!showNonmagicalOption && NONMAGICAL_QUALIFYING_TYPES.has(damageType);

  function setDamageTypeChecked(next: string) {
    setDamageType(next);
    if (!NONMAGICAL_QUALIFYING_TYPES.has(next)) setNonmagicalAttack(false);
  }

  function submit(type: 'damage' | 'heal') {
    if (!valid) return;
    if (type === 'damage') onDamage(amount, damageType.trim() || undefined, nonmagicalOptionShown ? nonmagicalAttack : undefined);
    else onHeal(amount);
    reset();
    onClose();
  }

  function reset() {
    setText('');
    setDamageType('');
    setNonmagicalAttack(false);
  }

  function handleClose() {
    reset();
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <Pressable style={styles.backdrop} onPress={handleClose}>
        <Pressable style={styles.sheet} onPress={e => e.stopPropagation()}>
          <Text style={styles.title}>HP: {currentHp} / {maxHp}</Text>

          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            keyboardType="number-pad"
            placeholder="Enter amount"
            placeholderTextColor={Colors.textDim}
            autoFocus
          />

          <Text style={styles.typeLabel}>Damage type (optional — only matters for resistance/immunity)</Text>
          <View style={styles.typeRow}>
            <TextInput
              style={styles.typeInput}
              value={damageType}
              onChangeText={setDamageTypeChecked}
              placeholder="Unspecified"
              placeholderTextColor={Colors.textDim}
            />
            <View style={styles.typeChipWrap}>
              {COMMON_DAMAGE_TYPES.map(t => (
                <Pressable key={t} style={[styles.typeChip, damageType === t && styles.typeChipActive]}
                  onPress={() => setDamageTypeChecked(damageType === t ? '' : t)}>
                  <Text style={[styles.typeChipTxt, damageType === t && styles.typeChipTxtActive]}>{t}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Rules-engine blocker RE-AUDIT closure (3A/3D): table-first, per-hit
              fact — only meaningful (and only shown) while transformed into a
              form with nonmagicalPhysicalResistance and hitting with a
              bludgeoning/piercing/slashing type; never inferred automatically. */}
          {nonmagicalOptionShown && (
            <Pressable style={styles.typeChipWrap} onPress={() => setNonmagicalAttack(v => !v)}>
              <View style={[styles.typeChip, nonmagicalAttack && styles.typeChipActive]}>
                <Text style={[styles.typeChipTxt, nonmagicalAttack && styles.typeChipTxtActive]}>
                  {nonmagicalAttack ? '☑' : '☐'} Nonmagical attack
                </Text>
              </View>
            </Pressable>
          )}

          <View style={styles.btnRow}>
            <Pressable
              style={[styles.btn, styles.dmgBtn, !valid && styles.btnDisabled]}
              onPress={() => submit('damage')}
              disabled={!valid}
            >
              <Text style={styles.btnTxt}>⚔️  Damage</Text>
            </Pressable>
            <Pressable
              style={[styles.btn, styles.healBtn, !valid && styles.btnDisabled]}
              onPress={() => submit('heal')}
              disabled={!valid}
            >
              <Text style={styles.btnTxt}>💚  Heal</Text>
            </Pressable>
          </View>

          <Pressable style={styles.cancelBtn} onPress={handleClose}>
            <Text style={styles.cancelTxt}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: '#000000bb',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.surfaceHigh,
    borderTopLeftRadius:  Radius.lg,
    borderTopRightRadius: Radius.lg,
    padding: Spacing.lg,
    gap:     Spacing.md,
  },
  title: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary, textAlign: 'center' },
  input: {
    backgroundColor: Colors.surface,
    borderRadius:    Radius.md,
    borderWidth:     1,
    borderColor:     Colors.border,
    padding:         Spacing.md,
    fontSize:        FontSize.xl,
    color:           Colors.textPrimary,
    textAlign:       'center',
    fontWeight:      FontWeight.bold,
  },
  typeLabel: { fontSize: FontSize.xs, color: Colors.textDim },
  typeRow:   { gap: Spacing.xs },
  typeInput: {
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.sm, color: Colors.textPrimary, fontSize: FontSize.sm,
  },
  typeChipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  typeChip: {
    backgroundColor: Colors.surface, borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm, paddingVertical: 3, borderWidth: 1, borderColor: Colors.border,
  },
  typeChipActive: { borderColor: Colors.gold, backgroundColor: Colors.gold + '22' },
  typeChipTxt:    { fontSize: 11, color: Colors.textSecondary },
  typeChipTxtActive: { color: Colors.gold, fontWeight: FontWeight.bold },
  btnRow:      { flexDirection: 'row', gap: Spacing.sm },
  btn: {
    flex: 1, borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center',
  },
  dmgBtn:      { backgroundColor: Colors.red },
  healBtn:     { backgroundColor: Colors.green },
  btnDisabled: { opacity: 0.4 },
  btnTxt:      { color: Colors.white, fontWeight: FontWeight.bold, fontSize: FontSize.md },
  cancelBtn:   { alignItems: 'center', padding: Spacing.sm },
  cancelTxt:   { color: Colors.textSecondary, fontSize: FontSize.md },
});
