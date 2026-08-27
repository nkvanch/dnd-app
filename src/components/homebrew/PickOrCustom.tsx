// src/components/homebrew/PickOrCustom.tsx
// A chip row with a built-in "Custom" option that reveals a free-text/number
// fallback. Extracted from spell-builder.tsx (its original home) so
// monster-builder.tsx can reuse it instead of forking a copy.
import { useState } from 'react';
import { View, Pressable, Text, TextInput, StyleSheet } from 'react-native';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../theme';

export function PickOrCustom({ options, value, onChange, numeric }: {
  options: (string | number)[];
  value: string | number;
  onChange: (v: string | number) => void;
  numeric?: boolean;
}) {
  const isPreset = options.includes(value);
  const [customMode, setCustomMode] = useState(!isPreset);

  return (
    <View>
      <View style={styles.chipRow}>
        {options.map(opt => (
          <Pressable
            key={opt}
            style={[styles.chip, !customMode && value === opt && styles.chipActive]}
            onPress={() => { setCustomMode(false); onChange(opt); }}
          >
            <Text style={[styles.chipTxt, !customMode && value === opt && styles.chipTxtActive]}>{opt}</Text>
          </Pressable>
        ))}
        <Pressable
          style={[styles.chip, customMode && styles.chipActive]}
          onPress={() => setCustomMode(true)}
        >
          <Text style={[styles.chipTxt, customMode && styles.chipTxtActive]}>Custom</Text>
        </Pressable>
      </View>
      {customMode && (
        <TextInput
          style={[styles.input, { marginTop: Spacing.xs }]}
          value={String(value)}
          onChangeText={v => onChange(numeric ? (parseInt(v, 10) || 0) : v)}
          keyboardType={numeric ? 'number-pad' : 'default'}
          placeholder={numeric ? 'Enter a number' : "Enter your own..."}
          placeholderTextColor={Colors.textDim}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  chipRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  chip:      { backgroundColor: Colors.surface, borderRadius: Radius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 4, borderWidth: 1, borderColor: Colors.border },
  chipActive:{ borderColor: Colors.gold, backgroundColor: Colors.gold + '22' },
  chipTxt:   { fontSize: FontSize.xs, color: Colors.textSecondary },
  chipTxtActive: { color: Colors.gold, fontWeight: FontWeight.bold },
  input: {
    backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.sm, color: Colors.textPrimary, fontSize: FontSize.md,
  },
});
