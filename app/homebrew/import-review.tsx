// app/homebrew/import-review.tsx
// Review screen after Claude parses imported content.
// Shows parsed data, warnings, errors; lets user save or discard.
import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  ActivityIndicator, Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { importFromUrl, importFromText, HomebrewImportResult } from '../../src/engine/wikiImporter';
import { useHomebrewStore } from '../../src/store/homebrewStore';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../src/theme';

export default function ImportReviewScreen() {
  const { mode, payload } = useLocalSearchParams<{ mode: 'url' | 'text'; payload: string }>();
  const router            = useRouter();
  const saveItem          = useHomebrewStore(s => s.saveItem);

  const [loading, setLoading]     = useState(true);
  const [result,  setResult]      = useState<HomebrewImportResult | null>(null);
  const [saving,  setSaving]      = useState(false);

  useEffect(() => {
    if (!payload) return;
    (async () => {
      try {
        const r = mode === 'url'
          ? await importFromUrl(payload)
          : await importFromText(payload);
        setResult(r);
      } catch (e) {
        setResult({
          success: false, type: null, content: null,
          warnings: [], errors: [String(e)],
        });
      } finally {
        setLoading(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSave() {
    if (!result?.content || !result?.type) return;
    setSaving(true);
    try {
      await saveItem(result.type, result.content);
      Alert.alert('Saved!', `"${(result.content as any).name}" added to your homebrew library.`, [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e) {
      Alert.alert('Error', String(e));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.screen}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.gold} />
          <Text style={styles.loadingTxt}>Claude is parsing your content…</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backTxt}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>Import Review</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

        {/* Status */}
        <View style={[styles.statusCard, result?.success ? styles.statusSuccess : styles.statusError]}>
          <Text style={styles.statusIcon}>{result?.success ? '✅' : '❌'}</Text>
          <Text style={styles.statusTxt}>
            {result?.success
              ? `Parsed as ${result.type}: "${(result.content as any)?.name}"`
              : 'Parse failed'}
          </Text>
        </View>

        {/* Errors */}
        {(result?.errors ?? []).length > 0 && (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Errors</Text>
            {result!.errors.map((e, i) => (
              <Text key={i} style={styles.errorItem}>• {e}</Text>
            ))}
          </View>
        )}

        {/* Warnings */}
        {(result?.warnings ?? []).length > 0 && (
          <View style={styles.warnCard}>
            <Text style={styles.warnTitle}>Warnings</Text>
            {result!.warnings.map((w, i) => (
              <Text key={i} style={styles.warnItem}>• {w}</Text>
            ))}
          </View>
        )}

        {/* Parsed content preview */}
        {result?.content && (
          <View style={styles.previewCard}>
            <Text style={styles.previewTitle}>Parsed Content</Text>
            <Text style={styles.previewJson}>
              {JSON.stringify(result.content, null, 2)}
            </Text>
          </View>
        )}

      </ScrollView>

      {/* Action buttons */}
      <View style={styles.actionBar}>
        {result?.success && result.content ? (
          <Pressable
            style={[styles.saveBtn, saving && styles.btnDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator color={Colors.bg} />
              : <Text style={styles.saveBtnTxt}>💾 Save to Library</Text>
            }
          </Pressable>
        ) : null}
        <Pressable style={styles.discardBtn} onPress={() => router.back()}>
          <Text style={styles.discardBtnTxt}>Discard</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: Colors.bg },
  center:  { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
  loadingTxt: { color: Colors.textSecondary, fontSize: FontSize.md },

  header: {
    backgroundColor: Colors.surfaceHigh,
    paddingTop: Spacing.xl + 8, paddingBottom: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: { marginBottom: 4 },
  backTxt: { color: Colors.gold, fontSize: FontSize.md, fontWeight: FontWeight.bold },
  title:   { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },

  scroll:   { flex: 1 },
  content:  { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xxl },

  statusCard:    { borderRadius: Radius.lg, padding: Spacing.md, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  statusSuccess: { backgroundColor: Colors.green + '22', borderWidth: 1, borderColor: Colors.green + '66' },
  statusError:   { backgroundColor: Colors.red   + '22', borderWidth: 1, borderColor: Colors.red   + '66' },
  statusIcon:    { fontSize: 24 },
  statusTxt:     { fontSize: FontSize.md, color: Colors.textPrimary, flex: 1 },

  errorCard: { backgroundColor: Colors.red + '11', borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.red + '44', padding: Spacing.md, gap: Spacing.xs },
  errorTitle:{ fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.red },
  errorItem: { fontSize: FontSize.sm, color: Colors.red },

  warnCard:  { backgroundColor: Colors.gold + '11', borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.gold + '44', padding: Spacing.md, gap: Spacing.xs },
  warnTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.gold },
  warnItem:  { fontSize: FontSize.sm, color: Colors.gold },

  previewCard:  { backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, padding: Spacing.md },
  previewTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textSecondary, marginBottom: Spacing.xs },
  previewJson:  { fontSize: 11, color: Colors.textDim, fontFamily: 'monospace' },

  actionBar: {
    padding: Spacing.sm, gap: Spacing.sm,
    backgroundColor: Colors.surfaceHigh,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  saveBtn:      { backgroundColor: Colors.gold, borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center' },
  btnDisabled:  { opacity: 0.4 },
  saveBtnTxt:   { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.md },
  discardBtn:   { alignItems: 'center', padding: Spacing.sm },
  discardBtnTxt:{ color: Colors.textSecondary, fontSize: FontSize.md },
});
