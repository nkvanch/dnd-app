// src/components/RepeatedChoicePicker.tsx
// CHOICE-EXPANSION-1: generic "pick N of a pool" mechanics shared by
// Expertise/Tool/Language pickers (and usable by any future ChoiceDefinition
// kind with the same shape). Mirrors SpellChoicePicker.tsx's established
// pattern (search box + toggle + disable-when-full + counter + commit
// button) — deliberately NOT a different UI, just generalized over any
// {id,label} option instead of a Spell specifically, plus optional grouping
// for a large categorized pool (Tools/Languages) that a small pool (a
// restricted 3-option Expertise/Language choice) doesn't need.
//
// Legality is entirely the CALLER's responsibility — `options` here is
// already the eligible pool (item 3: "the legal pool must be restricted...
// do not infer from display strings"). This component only enforces the
// selection-count mechanics (cap at N, dedupe, counter), not domain rules.
import { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, TextInput } from 'react-native';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../theme';

export type RepeatedChoiceOption = {
  id:       string;
  label:    string;
  sublabel?: string;
  /** Group key for section headers (e.g. a ToolCategory/LanguageCategory id) — omit for a flat list. */
  group?:   string;
};

interface Props {
  heading:       string;
  prompt:        string;
  requiredCount: number;
  /** Already legality-filtered by the caller — see file header. */
  options:       RepeatedChoiceOption[];
  /** Display label per group key, in display order. Omit for a flat (ungrouped) list. */
  groupLabels?:  Record<string, string>;
  groupOrder?:   string[];
  /** Defaults to true once the pool is large enough to warrant it (item 25: "For a tiny legal pool: simple list. For a large pool: search + collapsed filters"). */
  searchable?:   boolean;
  emptyMessage?: string;
  commitLabel:   (n: number) => string;
  onCommit:      (selectedIds: string[]) => void;
  onClose?:      () => void;
  /** Surfaced from a failed onCommit (e.g. an engine-level legality throw) — shown inline rather than crashing the screen. */
  error?:        string | null;
}

export function RepeatedChoicePicker({
  heading, prompt, requiredCount, options, groupLabels, groupOrder,
  searchable, emptyMessage, commitLabel, onCommit, onClose, error,
}: Props) {
  const [selected, setSelected] = useState<string[]>([]);
  const [search,   setSearch]   = useState('');

  const showSearch = searchable ?? options.length > 10;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter(o =>
      o.label.toLowerCase().includes(q) || (o.sublabel?.toLowerCase().includes(q) ?? false)
    );
  }, [options, search]);

  const groups = useMemo(() => {
    if (!groupLabels) return [{ key: undefined as string | undefined, label: undefined, items: filtered }];
    const order = groupOrder ?? Object.keys(groupLabels);
    return order
      .map(key => ({ key, label: groupLabels[key], items: filtered.filter(o => o.group === key) }))
      .filter(g => g.items.length > 0);
  }, [filtered, groupLabels, groupOrder]);

  function toggle(id: string) {
    setSelected(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= requiredCount) return prev;
      return [...prev, id];
    });
  }

  function commit() {
    if (selected.length !== requiredCount) return;
    onCommit(selected);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.headerRow}>
        <Text style={styles.heading}>{heading}</Text>
        {onClose && (
          <Pressable onPress={onClose} hitSlop={8}>
            <Text style={styles.close}>✕</Text>
          </Pressable>
        )}
      </View>
      <Text style={styles.sub}>{prompt}</Text>
      <Text style={styles.count}>Selected {selected.length}/{requiredCount}</Text>

      {error && <Text style={styles.error}>{error}</Text>}

      {showSearch && (
        <TextInput
          style={styles.search}
          placeholder="Search"
          placeholderTextColor={Colors.textDim}
          value={search}
          onChangeText={setSearch}
        />
      )}

      {groups.map(g => (
        <View key={g.key ?? '_flat'} style={styles.group}>
          {g.label && <Text style={styles.groupLabel}>{g.label}</Text>}
          <View style={styles.list}>
            {g.items.map(o => {
              const isSel = selected.includes(o.id);
              const disabled = !isSel && selected.length >= requiredCount;
              return (
                <Pressable
                  key={o.id}
                  style={[styles.row, isSel && styles.rowSelected, disabled && styles.rowDisabled]}
                  disabled={disabled}
                  onPress={() => toggle(o.id)}
                >
                  <Text style={styles.rowName}>{o.label}{isSel ? ' ✓' : ''}</Text>
                  {o.sublabel && <Text style={styles.rowMeta}>{o.sublabel}</Text>}
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}

      {filtered.length === 0 && (
        <Text style={styles.empty}>
          {emptyMessage ?? 'Nothing eligible to choose right now.'}
        </Text>
      )}

      <Pressable
        style={[styles.applyBtn, selected.length !== requiredCount && styles.applyBtnDisabled]}
        disabled={selected.length !== requiredCount}
        onPress={commit}
      >
        <Text style={styles.applyTxt}>{commitLabel(selected.length)}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content:   { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heading:   { flex: 1, flexShrink: 1, fontSize: FontSize.xxl, fontWeight: FontWeight.black, color: Colors.gold, marginBottom: Spacing.xs },
  close:     { fontSize: FontSize.xl, color: Colors.textSecondary, paddingLeft: Spacing.md },
  sub:       { fontSize: FontSize.md, color: Colors.textSecondary },
  count:     { fontSize: FontSize.sm, color: Colors.gold, fontWeight: FontWeight.bold, marginBottom: Spacing.md },
  error:     { fontSize: FontSize.sm, color: Colors.red, marginBottom: Spacing.sm },
  search: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    fontSize: FontSize.md, color: Colors.textPrimary, marginBottom: Spacing.md,
  },
  empty: { fontSize: FontSize.sm, color: Colors.textDim, fontStyle: 'italic', textAlign: 'center', padding: Spacing.lg },

  group:      { marginBottom: Spacing.md },
  groupLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: FontWeight.bold, letterSpacing: 1, textTransform: 'uppercase', marginBottom: Spacing.xs },
  list:       { gap: Spacing.sm },
  row: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.md,
  },
  rowSelected: { borderColor: Colors.gold, backgroundColor: Colors.gold + '22' },
  rowDisabled: { opacity: 0.4 },
  rowName: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  rowMeta: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },

  applyBtn: { backgroundColor: Colors.gold, borderRadius: Radius.md, paddingVertical: Spacing.md, alignItems: 'center', marginTop: Spacing.sm },
  applyBtnDisabled: { backgroundColor: Colors.goldDim },
  applyTxt: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.bg },
});
