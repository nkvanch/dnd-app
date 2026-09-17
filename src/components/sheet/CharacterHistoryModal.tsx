// src/components/sheet/CharacterHistoryModal.tsx
// Phase B of the undo/redo + mechanical timeline track — a read-only,
// persistent log of every updateCharacter() mutation for this character,
// newest first. Mirrors VersionHistoryModal.tsx's list-newest-first UI
// pattern, minus the restore action: restoring an ARBITRARY past character
// snapshot is a much bigger, riskier feature than restoring a homebrew
// content version (undo/redo already covers "step back a few actions" —
// see the plan's own reasoning), so this is deliberately look-only.
import { useState, useEffect, useMemo } from 'react';
import { Modal, View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { loadTimeline, TimelineEntry, TimelineCategory } from '../../db/timelineRepo';
import { SessionLogEntry } from '../../engine/types';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../theme';

interface Props {
  visible:  boolean;
  entityId: string;
  onClose:  () => void;
  /**
   * Item 17 (timeline improvements — session grouping). The active
   * campaign's session log, if this character belongs to one — grouping
   * is entirely derived from comparing each entry's timestamp against
   * each session's [startedAt, endedAt] range, no schema change to
   * character_timeline needed. Omitted (no campaign, or a campaign with
   * no real session data yet) falls back to today's flat list unchanged.
   */
  sessionLog?: SessionLogEntry[];
}

/** A pseudo-session id for entries that fall outside every real session's
 *  range (recorded between sessions, or before session-tracking existed). */
const NO_SESSION = '__no_session__';

type HistoryGroup = { sessionId: string; title: string; subtitle: string | null; entries: TimelineEntry[] };

/**
 * Buckets entries by which session's [startedAt, endedAt] range contains
 * their timestamp. A session missing startedAt (every hand-added note from
 * before item 14 existed) can never claim an entry. The currently-active
 * session (startedAt set, endedAt not) has an open-ended range — anything
 * at or after its start, up to the next-newer session's start (there can
 * be only one active session at a time — see engine/session.ts). Sessions
 * are checked newest-first so a later session's start correctly cuts off
 * an earlier one's open (or stale) range.
 */
export function groupBySession(entries: TimelineEntry[], sessionLog: SessionLogEntry[]): HistoryGroup[] {
  const real = sessionLog.filter(s => s.startedAt !== undefined);
  if (real.length === 0) return [{ sessionId: NO_SESSION, title: '', subtitle: null, entries }];

  // Newest first, matching startSession's own prepend order — used both to
  // number sessions (oldest = Session 1) and to find each entry's bucket.
  const newestFirst = [...real].sort((a, b) => b.startedAt! - a.startedAt!);
  const oldestFirst = [...newestFirst].reverse();

  const buckets = new Map<string, TimelineEntry[]>();
  const outside: TimelineEntry[] = [];
  for (const entry of entries) {
    const session = newestFirst.find(s => entry.timestamp >= s.startedAt! && (s.endedAt === undefined || entry.timestamp <= s.endedAt));
    if (!session) { outside.push(entry); continue; }
    if (!buckets.has(session.id)) buckets.set(session.id, []);
    buckets.get(session.id)!.push(entry);
  }

  const groups: HistoryGroup[] = [];
  // Render newest session first, matching the entries' own newest-first order.
  for (let i = oldestFirst.length - 1; i >= 0; i--) {
    const session = oldestFirst[i];
    const rows = buckets.get(session.id);
    if (!rows || rows.length === 0) continue;
    groups.push({
      sessionId: session.id,
      title: `Session ${i + 1}`,
      subtitle: new Date(session.startedAt!).toLocaleDateString(),
      entries: rows,
    });
  }
  if (outside.length > 0) {
    groups.push({ sessionId: NO_SESSION, title: 'Outside a session', subtitle: null, entries: outside });
  }
  return groups;
}

// A-63: 'all' plus every TimelineCategory, in display order. A row whose
// category is null (every entry recorded before this feature existed, or
// any future call site that still omits one) falls under 'other' rather
// than being hidden or crashing the filter.
const FILTERS: { key: TimelineCategory | 'all'; label: string }[] = [
  { key: 'all',       label: 'All' },
  { key: 'combat',    label: 'Combat' },
  { key: 'rest',      label: 'Rest' },
  { key: 'inventory', label: 'Inventory' },
  { key: 'spells',    label: 'Spells' },
  { key: 'leveling',  label: 'Leveling' },
  { key: 'features',  label: 'Features' },
  { key: 'ruleset',   label: 'Ruleset' },
  { key: 'other',     label: 'Other' },
];

export function CharacterHistoryModal({ visible, entityId, onClose, sessionLog }: Props) {
  const [history, setHistory] = useState<TimelineEntry[] | null>(null);
  const [filter, setFilter] = useState<TimelineCategory | 'all'>('all');
  // Cap the initial render to the most recent N entries — item 17
  // (navigation): loadTimeline has no LIMIT and a well-played character can
  // accumulate dozens of rows per session; rendering all of them into one
  // ScrollView on every open is real, avoidable work. "Show more" expands
  // in fixed steps rather than loading everything at once.
  const [visibleCount, setVisibleCount] = useState(25);

  // Fetched fresh every open, same as VersionHistoryModal.tsx — the
  // timeline isn't kept in any store at rest, so a re-open naturally shows
  // whatever's accumulated since with no extra plumbing.
  useEffect(() => {
    if (!visible) { setHistory(null); setFilter('all'); setVisibleCount(25); return; }
    let cancelled = false;
    void loadTimeline(entityId).then(h => { if (!cancelled) setHistory(h); });
    return () => { cancelled = true; };
  }, [visible, entityId]);

  const filtered = useMemo(() => {
    if (!history || filter === 'all') return history ?? [];
    return history.filter(h => (h.category ?? 'other') === filter);
  }, [history, filter]);

  const visibleEntries = filtered.slice(0, visibleCount);
  const groups = useMemo(
    () => groupBySession(visibleEntries, sessionLog ?? []),
    [visibleEntries, sessionLog],
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={e => e.stopPropagation()}>
          <Text style={styles.title}>History</Text>

          {history !== null && history.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={styles.filterRowContent}>
              {FILTERS.map(f => (
                <Pressable
                  key={f.key}
                  style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
                  onPress={() => setFilter(f.key)}
                >
                  <Text style={[styles.filterChipTxt, filter === f.key && styles.filterChipTxtActive]}>{f.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
          )}

          {history === null ? (
            <ActivityIndicator color={Colors.gold} style={{ marginVertical: Spacing.lg }} />
          ) : history.length === 0 ? (
            <Text style={styles.emptyTxt}>No history yet.</Text>
          ) : filtered.length === 0 ? (
            <Text style={styles.emptyTxt}>No history in this category.</Text>
          ) : (
            <ScrollView style={styles.list}>
              {groups.map(g => (
                <View key={g.sessionId}>
                  {g.title !== '' && (
                    <View style={styles.groupHeader}>
                      <Text style={styles.groupTitle}>{g.title}</Text>
                      {g.subtitle && <Text style={styles.groupSubtitle}>{g.subtitle}</Text>}
                    </View>
                  )}
                  {g.entries.map(h => (
                    <View key={h.id} style={styles.row}>
                      <Text style={styles.rowLabel}>{h.label}</Text>
                      <Text style={styles.rowHint}>{new Date(h.timestamp).toLocaleString()}</Text>
                    </View>
                  ))}
                </View>
              ))}
              {filtered.length > visibleEntries.length && (
                <Pressable style={styles.showMoreBtn} onPress={() => setVisibleCount(c => c + 25)}>
                  <Text style={styles.showMoreTxt}>Show {Math.min(25, filtered.length - visibleEntries.length)} more…</Text>
                </Pressable>
              )}
            </ScrollView>
          )}

          <Pressable style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelTxt}>Close</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#000000cc', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.surfaceHigh,
    borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg,
    padding: Spacing.md, gap: Spacing.sm, paddingBottom: Spacing.xl, maxHeight: '80%',
  },
  title: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.gold, textAlign: 'center' },
  emptyTxt: { fontSize: FontSize.sm, color: Colors.textDim, fontStyle: 'italic', textAlign: 'center', padding: Spacing.lg },

  filterRow: { flexGrow: 0 },
  filterRowContent: { gap: Spacing.xs, paddingVertical: 2 },
  filterChip: {
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.sm, paddingVertical: 4,
  },
  filterChipActive: { backgroundColor: Colors.gold, borderColor: Colors.gold },
  filterChipTxt: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: FontWeight.bold },
  filterChipTxtActive: { color: Colors.bg },

  list: { flexGrow: 0 },
  groupHeader: { marginTop: Spacing.sm, marginBottom: 2, flexDirection: 'row', alignItems: 'baseline', gap: Spacing.xs },
  groupTitle: { fontSize: FontSize.xs, color: Colors.gold, fontWeight: FontWeight.bold, letterSpacing: 1 },
  groupSubtitle: { fontSize: FontSize.xs, color: Colors.textDim },
  showMoreBtn: { alignItems: 'center', padding: Spacing.sm },
  showMoreTxt: { fontSize: FontSize.sm, color: Colors.gold, fontWeight: FontWeight.bold },
  row: {
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.sm, marginBottom: Spacing.xs,
  },
  rowLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  rowHint:  { fontSize: FontSize.xs, color: Colors.textDim, marginTop: 2 },

  cancelBtn: { alignItems: 'center', padding: Spacing.sm, marginTop: Spacing.xs },
  cancelTxt: { fontSize: FontSize.md, color: Colors.textSecondary, fontWeight: FontWeight.bold },
});
