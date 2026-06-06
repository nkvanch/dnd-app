// app/sheet/HpModal.tsx
// Damage / Heal input modal.
import { useState } from 'react';
import { Modal, View, Text, Pressable, TextInput, StyleSheet } from 'react-native';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../theme';

interface Props {
  visible:  boolean;
  currentHp: number;
  maxHp:     number;
  onDamage:  (amount: number) => void;
  onHeal:    (amount: number) => void;
  onClose:   () => void;
}

export function HpModal({ visible, currentHp, maxHp, onDamage, onHeal, onClose }: Props) {
  const [text, setText] = useState('');
  const amount = parseInt(text, 10);
  const valid  = !isNaN(amount) && amount > 0;

  function submit(type: 'damage' | 'heal') {
    if (!valid) return;
    type === 'damage' ? onDamage(amount) : onHeal(amount);
    setText('');
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
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

          <Pressable style={styles.cancelBtn} onPress={onClose}>
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
