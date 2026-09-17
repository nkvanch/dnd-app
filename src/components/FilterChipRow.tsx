// src/components/FilterChipRow.tsx
// Shared single-select filter chip row — the exact visual/behavioral
// pattern that was independently duplicated in app/dm/monsters.tsx,
// app/creation/class.tsx, app/creation/race.tsx, and
// src/components/AsiFeatPicker.tsx before this extraction. One generic
// component instead of four near-identical copies (CREATION-FILTERS-2).
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../theme';

export type ChipOption<T extends string> = { id: T; label: string };

/** Labeled group inside a filter panel — "grouped sections" per the shared
 *  filter UI spec, instead of a long flat list of unrelated toggles. */
export function FilterSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{label}</Text>
      {children}
    </View>
  );
}

/** The two filters that apply almost everywhere: Official/Homebrew (always
 *  real — see NonSrdBadge/homebrew-store membership) and Ruleset (real
 *  field, sparsely populated — most content has no rulesetId at all,
 *  meaning "available under every ruleset"; only shown when at least 2
 *  distinct ruleset values are actually present, so it never renders a
 *  meaningless single-option row). */
export function OfficialHomebrewChipRow({
  value, onChange,
}: { value: 'all' | 'official' | 'homebrew'; onChange: (v: 'all' | 'official' | 'homebrew') => void }) {
  return (
    <FilterChipRow
      options={[
        { id: 'all' as const, label: 'All' },
        { id: 'official' as const, label: 'Official' },
        { id: 'homebrew' as const, label: 'Homebrew' },
      ]}
      value={value}
      onChange={v => onChange(v ?? 'all')}
    />
  );
}

/** Multi-select variant — selected values combine with OR within this one
 *  field (e.g. Creature Type = Undead OR Fiend), while the field as a whole
 *  still combines with every OTHER active filter via AND. Same visual
 *  language as FilterChipRow; the only behavioral difference is toggling
 *  adds/removes from a Set instead of replacing a single value. */
export function MultiSelectChipRow<T extends string>({
  options, values, onChange, scrollable = false,
}: {
  options:    ChipOption<T>[];
  values:     Set<T>;
  onChange:   (values: Set<T>) => void;
  scrollable?: boolean;
}) {
  if (options.length <= 1) return null;
  function toggle(id: T) {
    const next = new Set(values);
    if (next.has(id)) next.delete(id); else next.add(id);
    onChange(next);
  }
  const chips = options.map(opt => (
    <Pressable
      key={opt.id}
      style={[styles.chip, values.has(opt.id) && styles.chipActive]}
      onPress={() => toggle(opt.id)}
    >
      <Text style={[styles.chipTxt, values.has(opt.id) && styles.chipTxtActive]}>{opt.label}</Text>
    </Pressable>
  ));
  return scrollable ? (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {chips}
    </ScrollView>
  ) : (
    <View style={styles.row}>{chips}</View>
  );
}

export function FilterChipRow<T extends string>({
  options, value, onChange, scrollable = false,
}: {
  options:    ChipOption<T>[];
  value:      T | null;
  onChange:   (id: T | null) => void;
  /** Wrap in a horizontal ScrollView instead of flex-wrapping — use when
   *  the option count is large/unbounded (e.g. every present monster type)
   *  rather than a small fixed set. */
  scrollable?: boolean;
}) {
  if (options.length <= 1) return null;
  const chips = options.map(opt => (
    <Pressable
      key={opt.id}
      style={[styles.chip, value === opt.id && styles.chipActive]}
      onPress={() => onChange(value === opt.id ? null : opt.id)}
    >
      <Text style={[styles.chipTxt, value === opt.id && styles.chipTxtActive]}>{opt.label}</Text>
    </Pressable>
  ));
  return scrollable ? (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {chips}
    </ScrollView>
  ) : (
    <View style={styles.row}>{chips}</View>
  );
}

/** Active-filter chip strip + "Clear all" — the pattern from Monster
 *  Library's filter panel, generalized. Each entry clears itself on tap. */
export function ActiveFilterChips({
  chips, onClearAll,
}: {
  chips: { key: string; label: string; onClear: () => void }[];
  onClearAll: () => void;
}) {
  if (chips.length === 0) return null;
  return (
    <View style={styles.activeRow}>
      {chips.map(c => (
        <Pressable key={c.key} style={styles.activeChip} onPress={c.onClear}>
          <Text style={styles.activeChipTxt}>{c.label} ×</Text>
        </Pressable>
      ))}
      <Pressable onPress={onClearAll}>
        <Text style={styles.clearAllTxt}>Clear all</Text>
      </Pressable>
    </View>
  );
}

/** "No results match your filters. [Clear Filters]" — distinguishes
 *  filter-excluded from actually-empty; use `emptyMessage` for the
 *  genuinely-nothing-exists case (e.g. "No homebrew items yet"). */
export function ZeroResultsState({
  hasActiveFilters, emptyMessage, onClearFilters,
}: {
  hasActiveFilters: boolean;
  emptyMessage?: string;
  onClearFilters: () => void;
}) {
  return (
    <View style={styles.zeroState}>
      <Text style={styles.zeroTxt}>
        {hasActiveFilters ? 'No results match your filters.' : (emptyMessage ?? 'No results match your search.')}
      </Text>
      {hasActiveFilters && (
        <Pressable style={styles.clearBtn} onPress={onClearFilters}>
          <Text style={styles.clearBtnTxt}>Clear Filters</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: Spacing.sm },
  sectionLabel: {
    fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.textDim,
    letterSpacing: 1, textTransform: 'uppercase',
    paddingHorizontal: Spacing.lg, marginBottom: 4,
  },
  row: {
    flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs,
    paddingHorizontal: Spacing.lg, marginBottom: Spacing.sm,
  },
  chip: {
    paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface,
  },
  chipActive:   { backgroundColor: Colors.gold, borderColor: Colors.gold },
  chipTxt:      { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: FontWeight.bold },
  chipTxtActive: { color: Colors.bg },

  activeRow: {
    flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.xs,
    paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xs,
  },
  activeChip: {
    backgroundColor: Colors.gold + '22', borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.gold + '66',
    paddingHorizontal: Spacing.sm, paddingVertical: 2,
  },
  activeChipTxt: { fontSize: FontSize.xs, color: Colors.gold, fontWeight: FontWeight.bold },
  clearAllTxt:   { fontSize: FontSize.xs, color: Colors.textDim, textDecorationLine: 'underline' },

  zeroState: { alignItems: 'center', gap: Spacing.sm, padding: Spacing.lg },
  zeroTxt:   { fontSize: FontSize.sm, color: Colors.textDim, textAlign: 'center' },
  clearBtn: {
    borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.gold,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs,
  },
  clearBtnTxt: { color: Colors.gold, fontWeight: FontWeight.bold },
});
