// src/components/SortControl.tsx
// SHARED-QUERY-1: the one reusable `[Sort: A–Z ▼]` control every browser/
// picker built on src/content/contentQuery.ts uses — a single dropdown
// selector (not a chip row, and not a separate asc/desc toggle), matching
// the shared default-picker-UX mock: search + Filters button on one row,
// Sort on its own row directly below.
import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { SortOption } from '../content/contentQuery';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../theme';

export function SortControl<T>({
  options, value, onChange,
}: {
  options: SortOption<T>[];
  value:   string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  if (options.length <= 1) return null;
  const current = options.find(o => o.id === value) ?? options[0];
  return (
    <View style={styles.wrap}>
      <Pressable style={styles.toggle} onPress={() => setOpen(o => !o)}>
        <Text style={styles.toggleTxt}>Sort: {current.label}</Text>
        <Text style={styles.chevron}>{open ? '▲' : '▼'}</Text>
      </Pressable>
      {open && (
        <View style={styles.menu}>
          {options.map(o => {
            const active = o.id === current.id;
            return (
              <Pressable
                key={o.id}
                style={[styles.option, active && styles.optionActive]}
                onPress={() => { onChange(o.id); setOpen(false); }}
              >
                <Text style={[styles.optionTxt, active && styles.optionTxtActive]}>{o.label}</Text>
                {active && <Text style={styles.optionCheck}>✓</Text>}
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: Spacing.sm },
  toggle: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    alignSelf: 'flex-start', gap: Spacing.xs,
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.sm, paddingVertical: 6,
  },
  toggleTxt: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: FontWeight.bold },
  chevron:   { fontSize: FontSize.xs, color: Colors.textDim },
  menu: {
    marginTop: 2, backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, overflow: 'hidden', alignSelf: 'flex-start', minWidth: 160,
  },
  option: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  optionActive: { backgroundColor: Colors.gold + '22' },
  optionTxt:    { fontSize: FontSize.sm, color: Colors.textPrimary },
  optionTxtActive: { color: Colors.gold, fontWeight: FontWeight.bold },
  optionCheck:  { fontSize: FontSize.sm, color: Colors.gold, fontWeight: FontWeight.bold },
});
