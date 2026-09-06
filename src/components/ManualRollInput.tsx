// src/components/ManualRollInput.tsx
// "Or enter your own total" — lets a player rolling physical dice at a real
// table skip the app's own roller. Collapsed by default (a small text link)
// so it stays secondary to the primary digital Roll button next to it.
// Pure leaf component: knows nothing about diceLogStore or any modal's own
// state — it just hands the caller a DiceRoll via onSubmit.
import { useState } from 'react';
import { View, Text, Pressable, TextInput, StyleSheet } from 'react-native';
import { DiceRoll } from '../engine/types';
import { manualRoll } from '../engine/dice';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../theme';

interface Props {
  expression: string;
  label?:     string | null;
  onSubmit:   (roll: DiceRoll) => void;
}

export function ManualRollInput({ expression, label, onSubmit }: Props) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const amount = parseInt(text, 10);
  const valid  = text.trim() !== '' && !isNaN(amount);

  function submit() {
    if (!valid) return;
    onSubmit(manualRoll(expression, amount, label ?? undefined));
    setText('');
    setOpen(false);
  }

  if (!open) {
    return (
      <Pressable onPress={() => setOpen(true)} hitSlop={6}>
        <Text style={styles.link}>or enter your own total</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.row}>
      <TextInput
        style={styles.input}
        value={text}
        onChangeText={setText}
        keyboardType="number-pad"
        placeholder="Total"
        placeholderTextColor={Colors.textDim}
        autoFocus
      />
      <Pressable style={[styles.useBtn, !valid && styles.useBtnDisabled]} onPress={submit} disabled={!valid}>
        <Text style={styles.useBtnTxt}>Use</Text>
      </Pressable>
      <Pressable onPress={() => { setText(''); setOpen(false); }} hitSlop={6}>
        <Text style={styles.cancelTxt}>Cancel</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  link: {
    fontSize:  FontSize.xs,
    color:     Colors.textSecondary,
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
  row: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           Spacing.xs,
  },
  input: {
    flex:            1,
    backgroundColor: Colors.surface,
    borderRadius:    Radius.md,
    borderWidth:     1,
    borderColor:     Colors.border,
    paddingHorizontal: Spacing.sm,
    paddingVertical:   Spacing.xs,
    fontSize:        FontSize.md,
    color:           Colors.textPrimary,
    textAlign:       'center',
    fontWeight:      FontWeight.bold,
  },
  useBtn: {
    backgroundColor:   Colors.gold,
    borderRadius:      Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical:   Spacing.xs,
  },
  useBtnDisabled: { backgroundColor: Colors.surfaceHigh, borderWidth: 1, borderColor: Colors.border },
  useBtnTxt:      { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.sm },
  cancelTxt:      { color: Colors.textSecondary, fontSize: FontSize.sm },
});
