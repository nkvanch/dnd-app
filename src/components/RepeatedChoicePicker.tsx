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
import { SafeBottomView } from './SafeBottomView';

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
  /**
   * Expertise-choice deadlock/edit closure: the EFFECTIVE completion count
   * — already capped by the caller at however many distinct legal options
   * actually exist (see leveling.ts's effectiveRequiredCount) — not the
   * choice's raw nominal count. This is what gates the commit button and
   * drives "Selected X/Y"/"Remaining Z" below. May be 0 (Part C: zero
   * eligible options is a legitimately complete choice with nothing to
   * pick).
   */
  requiredCount: number;
  /**
   * The choice's own unadjusted nominal count, ONLY for the explanatory
   * note shown when it differs from `requiredCount` (fewer legal options
   * exist than normally requested). Omit (or pass equal to requiredCount)
   * when there's nothing to explain — every existing caller that hasn't
   * been updated for effective-count capping keeps working unchanged.
   */
  nominalCount?: number;
  /** Already legality-filtered by the caller — see file header. */
  options:       RepeatedChoiceOption[];
  /**
   * Expertise-choice deadlock/edit closure (Part D/E): the choice's CURRENT
   * selections, when reopening an already-resolved choice for editing —
   * seeds initial state so the existing picks show as selected immediately
   * (no Back → Back round trip to see what's already chosen). Omit for a
   * brand-new, never-resolved choice (starts empty, unchanged behavior).
   */
  initialSelected?: string[];
  /**
   * Expertise stale-eligibility closure: the subset of `options` (by id)
   * that's actually LEGAL right now — distinct from the full displayed set,
   * which may also include a stale/no-longer-eligible previous selection
   * kept visible so the user can see and remove it (see
   * app/creation/repeated-choice.tsx's mergeStaleSelections). When omitted,
   * every displayed option is treated as legal — the original, unchanged
   * behavior for every caller that hasn't been updated for this distinction
   * (Tool/Language today). Drives the "Selected X/Y" count, the commit
   * gate, and what's actually passed to onCommit — a stale option can be
   * TOGGLED (so it's visibly removable) but never counts toward completion
   * and is never included in a submitted selection.
   */
  legalOptionIds?: Set<string>;
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
  heading, prompt, requiredCount, nominalCount, options, initialSelected, legalOptionIds, groupLabels, groupOrder,
  searchable, emptyMessage, commitLabel, onCommit, onClose, error,
}: Props) {
  // Falls back to "every displayed option is legal" when the caller doesn't
  // distinguish (Tool/Language, or any other unmodified caller) — preserves
  // every existing behavior exactly.
  const legalIds = legalOptionIds ?? new Set(options.map(o => o.id));

  // Dedupe a caller-supplied initialSelected against the CURRENT displayed
  // pool — but deliberately NOT clamped to requiredCount: a stale selection
  // (legal count may have shrunk since it was picked) must still show up as
  // selected/removable even when requiredCount is now lower than the raw
  // selection count (Part 4/5 of the stale-eligibility closure) — the
  // toggle-cap logic below is what then naturally forces removing it before
  // a new LEGAL pick can be added.
  const [selected, setSelected] = useState<string[]>(() =>
    (initialSelected ?? []).filter(id => options.some(o => o.id === id))
  );
  const [search,   setSearch]   = useState('');

  // The only count that ever matters for completion/progress — a stale
  // selected option is excluded (Part 6: it must never satisfy a required
  // slot), even though it stays toggled "on" in `selected` until the user
  // deliberately removes it.
  const legalSelectedCount = selected.filter(id => legalIds.has(id)).length;

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
    if (legalSelectedCount !== requiredCount) return;
    // Defense in depth: by construction (the toggle cap below is raw-
    // length-based) a stale selection can never coexist with a full legal
    // set at the moment commit becomes enabled, but filtering here too
    // means a stale id is NEVER what gets submitted, even if that
    // invariant is ever violated by a future change.
    onCommit(selected.filter(id => legalIds.has(id)));
  }

  return (
    <>
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.headerRow}>
        <Text style={styles.heading}>{heading}</Text>
        {onClose && (
          <Pressable onPress={onClose} hitSlop={8}>
            <Text style={styles.close}>✕</Text>
          </Pressable>
        )}
      </View>
      <Text style={styles.sub}>{prompt}</Text>
      {requiredCount > 0 && (
        <>
          <Text style={styles.count}>Selected {legalSelectedCount}/{requiredCount}</Text>
          <Text style={styles.remaining}>Remaining {Math.max(0, requiredCount - legalSelectedCount)}</Text>
          {/* Expertise-choice deadlock/edit closure: only shown when the
              caller's effective (capped) count differs from the choice's
              own nominal count — i.e. fewer legal distinct options exist
              than the choice normally asks for. */}
          {nominalCount !== undefined && nominalCount > requiredCount && (
            <Text style={styles.capNote}>
              {requiredCount} eligible option{requiredCount === 1 ? '' : 's'} available ({nominalCount} normally requested)
            </Text>
          )}
        </>
      )}

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
              // Deliberately the RAW selected count (not legalSelectedCount)
              // — this is what forces a stale selection to be removed
              // before a new LEGAL one can be added when they'd otherwise
              // together exceed requiredCount (stale-eligibility closure):
              // e.g. requiredCount=1 with a stale item already selected
              // leaves no room to add a legal replacement until the stale
              // one is tapped off first.
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

    </ScrollView>
    <SafeBottomView>
      <View style={styles.footer}>
        <Pressable
          style={[styles.applyBtn, legalSelectedCount !== requiredCount && styles.applyBtnDisabled]}
          disabled={legalSelectedCount !== requiredCount}
          onPress={commit}
        >
          {/* Part C/5: zero eligible options is a legitimately COMPLETE choice
              with nothing to pick — "Grant Expertise in 0 Skills →" would be a
              confusing label for that, so this is the one case the picker
              overrides commitLabel itself rather than pushing an n===0 special
              case onto every caller. */}
          <Text style={styles.applyTxt}>{requiredCount === 0 ? 'Continue' : commitLabel(legalSelectedCount)}</Text>
        </Pressable>
      </View>
    </SafeBottomView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content:   { padding: Spacing.lg },
  footer:    { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heading:   { flex: 1, flexShrink: 1, fontSize: FontSize.xxl, fontWeight: FontWeight.black, color: Colors.gold, marginBottom: Spacing.xs },
  close:     { fontSize: FontSize.xl, color: Colors.textSecondary, paddingLeft: Spacing.md },
  sub:       { fontSize: FontSize.md, color: Colors.textSecondary },
  count:     { fontSize: FontSize.sm, color: Colors.gold, fontWeight: FontWeight.bold },
  remaining: { fontSize: FontSize.xs, color: Colors.textDim, marginBottom: Spacing.xs },
  capNote:   { fontSize: FontSize.xs, color: Colors.textDim, fontStyle: 'italic', marginBottom: Spacing.md },
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
