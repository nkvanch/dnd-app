// src/components/sheet/IssuesModal.tsx
// Read-only display for validateEntity()'s Issue[] (A-54) — mirrors
// HomebrewTestModal.tsx's shell (backdrop/sheet/rows/Close-only), since
// this is display-only the same way: nothing here mutates the character,
// there's nothing to confirm.
import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';
import { Issue } from '../../engine/types';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../theme';

const SEVERITY_ICON: Record<Issue['severity'], string> = {
  error: '⛔', warning: '⚠️', info: 'ℹ️',
};
const SEVERITY_COLOR: Record<Issue['severity'], string> = {
  error: Colors.red, warning: Colors.gold, info: Colors.textDim,
};

interface Props {
  visible: boolean;
  issues:  Issue[];
  title?:  string;
  onClose: () => void;
}

export function IssuesModal({ visible, issues, title, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={e => e.stopPropagation()}>
          <Text style={styles.title}>{title ?? 'Character Issues'}</Text>

          {issues.length === 0 ? (
            <Text style={styles.emptyTxt}>No issues found — this character opens cleanly.</Text>
          ) : (
            <View style={styles.rowsBox}>
              {issues.map((issue, i) => (
                <View key={i} style={styles.row}>
                  <Text style={[styles.rowTxt, { color: SEVERITY_COLOR[issue.severity] }]}>
                    {SEVERITY_ICON[issue.severity]} {issue.message}
                  </Text>
                  {issue.suggestedFix && <Text style={styles.rowNote}>{issue.suggestedFix}</Text>}
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
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.sm, gap: Spacing.sm,
  },
  row: { paddingVertical: 2 },
  rowTxt: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  rowNote: { fontSize: FontSize.xs, color: Colors.textDim, marginTop: 2 },

  closeBtn: {
    backgroundColor: Colors.gold, borderRadius: Radius.md,
    padding: Spacing.md, alignItems: 'center', marginTop: Spacing.sm,
  },
  closeTxt: { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.md },
});
