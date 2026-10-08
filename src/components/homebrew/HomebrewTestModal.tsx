// src/components/homebrew/HomebrewTestModal.tsx
// Generic, reusable read-only preview for a homebrew builder's "Test"
// button — shows what a draft piece of content would do to a scratch
// entity, via the same simulate() primitive the 4 in-play preview modals
// (Rest/Feat/Equipment/Level-up) use. Deliberately NOT a repurposed
// action-preview modal: there is no real character to commit to here,
// only a disposable scratch entity, so this has a single "Close" button
// rather than a Confirm/Cancel dichotomy that would wrongly imply a real
// commit is happening.
//
// Generic on purpose — each builder supplies its own `rows`, computed via
// whichever buildXSummaryRows fits that content type (buildFeatSummaryRows
// for feat-builder.tsx today; items/races/etc. would reuse or add their
// own row-builder later without needing a new modal).
import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../theme';

export type Row = { label: string; note?: string };

interface Props {
  visible: boolean;
  title:   string;
  rows:    Row[];
  emptyMessage?: string;
  onClose: () => void;
}

export function HomebrewTestModal({ visible, title, rows, emptyMessage, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={e => e.stopPropagation()}>
          <Text style={styles.title}>{title}</Text>

          {rows.length === 0 ? (
            <Text style={styles.emptyTxt}>
              {emptyMessage ?? 'No modeled effect on a fresh level-1 scratch character.'}
            </Text>
          ) : (
            <View style={styles.rowsBox}>
              {rows.map((row, i) => (
                <View key={i} style={styles.row}>
                  <Text style={styles.rowTxt}>{row.label}</Text>
                  {row.note && <Text style={styles.rowNote}>{row.note}</Text>}
                </View>
              ))}
            </View>
          )}

          <Pressable style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeTxt}>Close</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#000000cc', justifyContent: 'center', padding: Spacing.md },
  sheet: {
    backgroundColor: Colors.surfaceHigh,
    borderRadius: Radius.lg,
    padding: Spacing.md, gap: Spacing.sm,
  },
  title: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.gold, textAlign: 'center' },
  emptyTxt: { fontSize: FontSize.md, color: Colors.textDim, textAlign: 'center', paddingVertical: Spacing.md },

  rowsBox: {
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.sm, gap: Spacing.xs,
  },
  row: { paddingVertical: 2 },
  rowTxt: { fontSize: FontSize.sm, color: Colors.textPrimary },
  rowNote: { fontSize: FontSize.xs, color: Colors.textDim, marginTop: 1 },

  closeBtn: {
    backgroundColor: Colors.gold, borderRadius: Radius.md,
    padding: Spacing.md, alignItems: 'center', marginTop: Spacing.sm,
  },
  closeTxt: { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.md },
});
