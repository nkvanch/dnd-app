// src/components/homebrew/VersionHistoryModal.tsx
// Shared version-history browser/restore modal — generic over
// ContentCacheType, works for all 10 homebrew categories. Same Modal +
// backdrop-Pressable + sheet-Pressable idiom as ExportFormatSheet.tsx.
import { useState, useEffect } from 'react';
import { Modal, View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useHomebrewStore } from '../../store/homebrewStore';
import { ContentCacheType, ContentVersionEntry } from '../../db/contentCacheRepo';
import { Alert } from '../../utils/alert';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../theme';

interface Props {
  visible: boolean;
  type:    ContentCacheType | null;
  id:      string | null;
  name:    string;
  onClose: () => void;
}

export function VersionHistoryModal({ visible, type, id, name, onClose }: Props) {
  const [history, setHistory] = useState<ContentVersionEntry[] | null>(null);
  const [restoring, setRestoring] = useState<string | null>(null);

  // Fetched fresh every open — never cached across opens, so a re-open
  // right after a restore naturally shows the updated list with no extra
  // plumbing (history isn't kept in the store at rest; see homebrewStore.ts).
  useEffect(() => {
    if (!visible || !type || !id) { setHistory(null); return; }
    let cancelled = false;
    useHomebrewStore.getState().loadVersionHistory(type, id).then(h => {
      if (!cancelled) setHistory(h);
    });
    return () => { cancelled = true; };
  }, [visible, type, id]);

  function handleRestore(version: string) {
    if (!type || !id) return;
    Alert.alert(
      'Restore version',
      `This will make Version ${version} the current version. Full history is preserved — you can restore any version again later.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          onPress: async () => {
            setRestoring(version);
            try {
              await useHomebrewStore.getState().restoreVersion(type, id, version);
              const refreshed = await useHomebrewStore.getState().loadVersionHistory(type, id);
              setHistory(refreshed);
            } catch (e) {
              Alert.alert('Restore failed', e instanceof Error ? e.message : 'Something went wrong.');
            } finally {
              setRestoring(null);
            }
          },
        },
      ],
    );
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={e => e.stopPropagation()}>
          <View style={styles.header}>
            <Text style={styles.title} numberOfLines={1}>Version History</Text>
            <Text style={styles.subtitle}>{name}</Text>
          </View>

          {history === null ? (
            <ActivityIndicator color={Colors.gold} style={{ marginVertical: Spacing.lg }} />
          ) : history.length === 0 ? (
            <Text style={styles.emptyTxt}>No previous versions yet.</Text>
          ) : (
            history.map(h => (
              <View key={h.version} style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowLabel}>Version {h.version}</Text>
                  <Text style={styles.rowHint}>{new Date(h.savedAt).toLocaleString()}</Text>
                </View>
                <Pressable
                  style={styles.restoreBtn}
                  disabled={restoring === h.version}
                  onPress={() => handleRestore(h.version)}
                >
                  {restoring === h.version
                    ? <ActivityIndicator size="small" color={Colors.bg} />
                    : <Text style={styles.restoreBtnTxt}>Restore</Text>}
                </Pressable>
              </View>
            ))
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
    padding: Spacing.md, gap: Spacing.sm, paddingBottom: Spacing.xl,
  },
  header: { alignItems: 'center', gap: 2, marginBottom: Spacing.xs },
  title:    { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.gold },
  subtitle: { fontSize: FontSize.xs, color: Colors.textDim },

  emptyTxt: { fontSize: FontSize.sm, color: Colors.textDim, fontStyle: 'italic', textAlign: 'center', padding: Spacing.lg },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.md,
  },
  rowLabel: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  rowHint:  { fontSize: FontSize.xs, color: Colors.textDim, marginTop: 2 },
  restoreBtn: { backgroundColor: Colors.gold, borderRadius: Radius.sm, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, minWidth: 64, alignItems: 'center' },
  restoreBtnTxt: { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.sm },

  cancelBtn: { alignItems: 'center', padding: Spacing.sm, marginTop: Spacing.xs },
  cancelTxt: { fontSize: FontSize.md, color: Colors.textSecondary, fontWeight: FontWeight.bold },
});
