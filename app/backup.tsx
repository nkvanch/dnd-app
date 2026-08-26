// app/backup.tsx
// Backup & Restore — export all characters + homebrew to a .grimoire-pack
// file via the OS share sheet, or import one back in. This is the ONLY way
// a character survives a lost/reset device (see docs/PRIVACY_POLICY.md —
// there is no cloud backup by design). docs/ROADMAP_1.0.md Phase 3.2.
import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useCharacterStore } from '../src/store/characterStore';
import { useHomebrewStore } from '../src/store/homebrewStore';
import { useSessionStore } from '../src/store/sessionStore';
import { exportBackup, pickAndValidateBackup, ImportPreview } from '../src/io/backupIO';
import { useSafeGoBack } from '../src/hooks/useSafeGoBack';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../src/theme';

export default function BackupScreen() {
  const router = useRouter();
  const safeGoBack = useSafeGoBack('/(tabs)');
  const characters = useCharacterStore(s => s.characters);
  const applyIncomingEntity = useCharacterStore(s => s.applyIncomingEntity);
  const homebrew = useHomebrewStore(s => s);
  const saveHomebrewItem = useHomebrewStore(s => s.saveItem);
  const deviceId = useSessionStore(s => s.session?.deviceId ?? null);

  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [committing, setCommitting] = useState(false);
  const [resultMsg, setResultMsg] = useState<string | null>(null);

  async function handleExport() {
    setExporting(true);
    setResultMsg(null);
    try {
      await exportBackup(
        characters,
        {
          races:       homebrew.races,
          classes:     homebrew.classes,
          items:       homebrew.items,
          spells:      homebrew.spells,
          backgrounds: homebrew.backgrounds,
          features:    homebrew.features,
        },
        deviceId,
      );
    } catch (e: any) {
      Alert.alert('Export failed', e?.message ?? 'Something went wrong.');
    } finally {
      setExporting(false);
    }
  }

  async function handlePickFile() {
    setImporting(true);
    setResultMsg(null);
    try {
      const result = await pickAndValidateBackup();
      if (result) setPreview(result);
    } catch (e: any) {
      Alert.alert('That file couldn\u2019t be imported', e?.message ?? 'Unknown error.');
    } finally {
      setImporting(false);
    }
  }

  async function handleConfirmImport() {
    if (!preview) return;
    setCommitting(true);
    try {
      // Characters: applyIncomingEntity already handles add-or-replace-by-id
      // and persists to SQLite — same function the sync system uses.
      for (const entity of preview.pack.characters) {
        applyIncomingEntity(entity);
      }
      // Homebrew: saveItem is an upsert per category.
      const hb = preview.pack.homebrew;
      if (hb) {
        for (const r of hb.races ?? [])       await saveHomebrewItem('race', r);
        for (const c of hb.classes ?? [])     await saveHomebrewItem('class', c);
        for (const s of hb.spells ?? [])      await saveHomebrewItem('spell', s);
        for (const b of hb.backgrounds ?? []) await saveHomebrewItem('background', b);
        for (const f of hb.features ?? [])    await saveHomebrewItem('feature', f);
        for (const it of hb.items ?? [])      await saveHomebrewItem('item', it);
      }
      setResultMsg(
        `Imported ${preview.characterCount} character${preview.characterCount !== 1 ? 's' : ''}` +
        (preview.homebrewCount > 0 ? ` and ${preview.homebrewCount} homebrew item${preview.homebrewCount !== 1 ? 's' : ''}.` : '.')
      );
      setPreview(null);
    } catch (e: any) {
      Alert.alert('Import failed partway through', e?.message ?? 'Some data may have been imported. Check your character list.');
    } finally {
      setCommitting(false);
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>

      <View style={styles.headerRow}>
        <Pressable onPress={safeGoBack}>
          <Text style={styles.back}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>Backup & Restore</Text>
        <View style={{ width: 60 }} />
      </View>

      <Section title="Why this matters">
        <Text style={styles.body}>
          Grimoire stores everything only on this device — there's no cloud
          account, so a lost or reset phone means lost characters unless you've
          backed up. A backup is a single file you save wherever you like
          (your own cloud drive, email to yourself, etc.) — Grimoire never
          sends it anywhere on its own.
        </Text>
      </Section>

      <Section title="Export">
        <Text style={styles.body}>
          Creates a .grimoire-pack file with all {characters.length} of your
          characters and your homebrew content, then opens the share sheet
          so you choose where to save it.
        </Text>
        <Pressable style={[styles.actionBtn, exporting && styles.actionBtnDisabled]} onPress={handleExport} disabled={exporting}>
          {exporting ? <ActivityIndicator color={Colors.bg} /> : <Text style={styles.actionBtnTxt}>Export Backup</Text>}
        </Pressable>
      </Section>

      <Section title="Import">
        <Text style={styles.body}>
          Pick a .grimoire-pack file to restore. You'll see what's inside
          before anything is added — existing characters with the same ID
          are updated, not duplicated.
        </Text>
        <Pressable style={[styles.actionBtnSecondary, importing && styles.actionBtnDisabled]} onPress={handlePickFile} disabled={importing}>
          {importing ? <ActivityIndicator color={Colors.gold} /> : <Text style={styles.actionBtnSecondaryTxt}>Choose File…</Text>}
        </Pressable>

        {resultMsg && (
          <View style={styles.resultBox}>
            <Text style={styles.resultTxt}>✓ {resultMsg}</Text>
          </View>
        )}
      </Section>

      {/* Import preview / confirm */}
      {preview && (
        <View style={styles.previewOverlay}>
          <View style={styles.previewSheet}>
            <Text style={styles.previewTitle}>Ready to import</Text>
            <View style={styles.previewRow}>
              <Text style={styles.previewLabel}>Characters</Text>
              <Text style={styles.previewValue}>{preview.characterCount}</Text>
            </View>
            <View style={styles.previewRow}>
              <Text style={styles.previewLabel}>Homebrew items</Text>
              <Text style={styles.previewValue}>{preview.homebrewCount}</Text>
            </View>
            <Text style={styles.previewNote}>
              Created {new Date(preview.pack.createdAt).toLocaleDateString()}
              {'  \u00b7  '}Grimoire v{preview.pack.appVersion}
            </Text>
            <View style={styles.previewBtnRow}>
              <Pressable style={styles.previewCancelBtn} onPress={() => setPreview(null)} disabled={committing}>
                <Text style={styles.previewCancelTxt}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.previewConfirmBtn, committing && styles.actionBtnDisabled]} onPress={handleConfirmImport} disabled={committing}>
                {committing ? <ActivityIndicator color={Colors.bg} /> : <Text style={styles.previewConfirmTxt}>Import</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      )}

    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title.toUpperCase()}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: Colors.bg },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xxl, gap: Spacing.lg },

  headerRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    paddingTop:     Spacing.xl + 8,
    marginBottom:   Spacing.md,
  },
  back:  { color: Colors.gold, fontSize: FontSize.md, fontWeight: FontWeight.bold },
  title: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },

  section:      { gap: Spacing.sm },
  sectionTitle: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.textSecondary, letterSpacing: 2 },
  sectionBody: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.md, gap: Spacing.sm,
  },
  body: { fontSize: FontSize.sm, color: Colors.textPrimary, lineHeight: 20 },

  actionBtn: {
    backgroundColor: Colors.gold, borderRadius: Radius.md,
    paddingVertical: Spacing.sm, alignItems: 'center', marginTop: Spacing.xs,
  },
  actionBtnTxt: { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.md },
  actionBtnSecondary: {
    backgroundColor: Colors.surfaceHigh, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.gold + '66',
    paddingVertical: Spacing.sm, alignItems: 'center', marginTop: Spacing.xs,
  },
  actionBtnSecondaryTxt: { color: Colors.gold, fontWeight: FontWeight.bold, fontSize: FontSize.md },
  actionBtnDisabled: { opacity: 0.5 },

  resultBox: {
    backgroundColor: Colors.green + '15', borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.green + '55',
    padding: Spacing.sm,
  },
  resultTxt: { color: Colors.green, fontSize: FontSize.sm, fontWeight: FontWeight.bold },

  previewOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: '#000000bb',
    alignItems: 'center', justifyContent: 'center',
    padding: Spacing.lg,
  },
  previewSheet: {
    backgroundColor: Colors.surfaceHigh, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.gold + '55',
    padding: Spacing.lg, gap: Spacing.sm, width: '100%',
  },
  previewTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary, textAlign: 'center' },
  previewRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  previewLabel: { fontSize: FontSize.sm, color: Colors.textSecondary },
  previewValue: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  previewNote: { fontSize: FontSize.xs, color: Colors.textDim, textAlign: 'center', marginTop: 4 },
  previewBtnRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  previewCancelBtn: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, paddingVertical: Spacing.sm, alignItems: 'center',
  },
  previewCancelTxt: { color: Colors.textSecondary, fontWeight: FontWeight.bold, fontSize: FontSize.sm },
  previewConfirmBtn: {
    flex: 1, backgroundColor: Colors.gold, borderRadius: Radius.md,
    paddingVertical: Spacing.sm, alignItems: 'center',
  },
  previewConfirmTxt: { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.sm },
});
