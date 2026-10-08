// src/components/ContentSearchPicker.tsx
// Generic "search string + filter by name + tap to select" picker — the 4th
// near-identical inline instance of this pattern found across the homebrew
// builders (subrace-builder.tsx's parent-race search, subclass-builder.tsx's
// parent-class search, class-builder.tsx's equipment search) before this one
// (ChangeBackgroundModal, live feature/background editing Phase 4). Extracted
// now that a 4th consumer needs the exact same UI, matching this codebase's
// own "extract on the 2nd/3rd+ use" precedent (e.g. derivedStatLabels.ts).
// Migrating the 3 existing inline instances onto this is a separate,
// deliberately out-of-scope cleanup — not required for this consumer.
import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../theme';

interface Props<T extends { id: string; name: string }> {
  items:        T[];
  onSelect:     (item: T) => void;
  placeholder?: string;
  /** Max results shown at once. Default 12, matching every existing inline instance. */
  limit?: number;
}

export function ContentSearchPicker<T extends { id: string; name: string }>({
  items, onSelect, placeholder = 'Search…', limit = 12,
}: Props<T>) {
  const [search, setSearch] = useState('');
  const results = search.trim().length > 0
    ? items.filter(i => i.name.toLowerCase().includes(search.trim().toLowerCase())).slice(0, limit)
    : [];

  return (
    <View>
      <TextInput
        style={styles.input}
        value={search}
        onChangeText={setSearch}
        placeholder={placeholder}
        placeholderTextColor={Colors.textDim}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {results.length > 0 && (
        <View style={styles.results}>
          {results.map(item => (
            <Pressable
              key={item.id}
              style={styles.resultRow}
              onPress={() => { onSelect(item); setSearch(''); }}
            >
              <Text style={styles.resultTxt}>{item.name}</Text>
              <Text style={styles.resultAdd}>Select</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.sm, color: Colors.textPrimary, fontSize: FontSize.md,
  },
  results: {
    marginTop: Spacing.xs, backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, overflow: 'hidden',
  },
  resultRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  resultTxt: { color: Colors.textPrimary, fontSize: FontSize.sm, flex: 1 },
  resultAdd: { color: Colors.gold, fontWeight: FontWeight.bold, fontSize: FontSize.xs },
});
