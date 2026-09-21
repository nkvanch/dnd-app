// src/components/ExportFormatSheet.tsx
// Shared PDF/TXT/MD format picker, used by the homebrew Library screen and
// the character sheet header. Same Modal + backdrop-Pressable + sheet-Pressable
// idiom as FreeEditModal.tsx/AuditModal.tsx/DmOverrideModal.tsx.
import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';
import { Platform } from 'react-native';
import { ExportFormat, ExportAction } from '../io/exportShare';
import { ExportKind, exportFormatsFor } from '../io/exportFormats';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../theme';

// expo-print has no web implementation — offering PDF there would just throw
// at share-time with no useful error, so it's disabled rather than shown.
const PDF_AVAILABLE_HERE = Platform.OS !== 'web';

interface Props {
  visible: boolean;
  kind:    ExportKind;
  title:   string;
  onSelect: (format: ExportFormat, action: ExportAction) => void;
  onClose:  () => void;
}

/**
 * This sheet offers ONE portable option per kind (Export Character or
 * Export Homebrew, never both) plus the readable copies (PDF/Markdown/Plain Text —
 * for a person to read). Re-audit item 16: a "Grimoire Pack" row used to
 * live in this same sheet behind an unused `showPackOption` prop (never
 * actually passed `true` anywhere) — a second, metadata-less path to the
 * same .grimoire-pack format PackageExportModal already produces properly
 * (dependency closure, name/author/description). Removed rather than left
 * dormant: a live but unreachable shortcut here would be an easy trap for
 * a future call site to wire up instead of the real "Portable Homebrew"
 * flow (PackageExportModal — see its own header comment for the intended
 * Readable/Portable split).
 */
export function ExportFormatSheet({ visible, kind, title, onSelect, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={e => e.stopPropagation()}>
          <View style={styles.header}>
            <Text style={styles.title} numberOfLines={1}>{title}</Text>
            <Text style={styles.subtitle}>Tap a format to save it — or use ⤴ to share instead</Text>
          </View>

          {exportFormatsFor(kind).map(f => {
            const disabled = f.id === 'pdf' && !PDF_AVAILABLE_HERE;
            return (
              <Pressable
                key={f.id}
                testID={`export-format-${f.id}`}
                style={[styles.row, disabled && styles.rowDisabled]}
                disabled={disabled}
                onPress={() => onSelect(f.id, 'save')}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowLabel}>{f.label}</Text>
                  <Text style={styles.rowHint}>
                    {disabled ? 'Not available on web — use the mobile app' : f.hint}
                  </Text>
                </View>
                {!disabled && (
                  <Pressable
                    style={styles.shareBtn}
                    hitSlop={8}
                    onPress={() => onSelect(f.id, 'share')}
                  >
                    <Text style={styles.shareIcon}>⤴</Text>
                  </Pressable>
                )}
              </Pressable>
            );
          })}

          <Pressable style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelTxt}>Cancel</Text>
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
    padding: Spacing.md, gap: Spacing.sm, paddingBottom: Spacing.xl,
  },
  header: { alignItems: 'center', gap: 2, marginBottom: Spacing.xs },
  title:    { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.gold },
  subtitle: { fontSize: FontSize.xs, color: Colors.textDim },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.md,
  },
  rowDisabled: { opacity: 0.4 },
  rowLabel: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  rowHint:  { fontSize: FontSize.xs, color: Colors.textDim, marginTop: 2 },

  shareBtn: {
    paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs,
    borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border,
  },
  shareIcon: { fontSize: FontSize.lg, color: Colors.textSecondary },

  cancelBtn: { alignItems: 'center', padding: Spacing.sm, marginTop: Spacing.xs },
  cancelTxt: { fontSize: FontSize.md, color: Colors.textSecondary, fontWeight: FontWeight.bold },
});
