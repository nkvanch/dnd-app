// src/components/sheet/CharacterHistoryModal.tsx
// Phase B of the undo/redo + mechanical timeline track — a read-only,
// persistent log of every updateCharacter() mutation for this character,
// newest first. Mirrors VersionHistoryModal.tsx's list-newest-first UI
// pattern, minus the restore action: restoring an ARBITRARY past character
// snapshot is a much bigger, riskier feature than restoring a homebrew
// content version (undo/redo already covers "step back a few actions" —
// see the plan's own reasoning), so this is deliberately look-only.
import { useState, useEffect } from 'react';
import { Modal, View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { loadTimeline, TimelineEntry } from '../../db/timelineRepo';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../theme';

interface Props {
  visible:  boolean;
  entityId: string;
  onClose:  () => void;
}

export function CharacterHistoryModal({ visible, entityId, onClose }: Props) {
  const [history, setHistory] = useState<TimelineEntry[] | null>(null);

  // Fetched fresh every open, same as VersionHistoryModal.tsx — the
  // timeline isn't kept in any store at rest, so a re-open naturally shows
  // whatever's accumulated since with no extra plumbing.
  useEffect(() => {
    if (!visible) { setHistory(null); return; }
    let cancelled = false;
    void loadTimeline(entityId).then(h => { if (!cancelled) setHistory(h); });
    return () => { cancelled = true; };
  }, [visible, entityId]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={e => e.stopPropagation()}>
          <Text style={styles.title}>History</Text>

          {history === null ? (
            <ActivityIndicator color={Colors.gold} style={{ marginVertical: Spacing.lg }} />
          ) : history.length === 0 ? (
            <Text style={styles.emptyTxt}>No history yet.</Text>
          ) : (
            <ScrollView style={styles.list}>
              {history.map(h => (
                <View key={h.id} style={styles.row}>
                  <Text style={styles.rowLabel}>{h.label}</Text>
                  <Text style={styles.rowHint}>{new Date(h.timestamp).toLocaleString()}</Text>
                </View>
              ))}
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

  list: { flexGrow: 0 },
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
