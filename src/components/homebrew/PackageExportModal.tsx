// src/components/homebrew/PackageExportModal.tsx
// HOMEBREW-PACKAGE-1: the dependency-preview + metadata step shown before
// any multi-item export actually happens — "Export Selected" (Homebrew
// Library, multi-select) and "Export Pack" (re-exporting an installed
// pack's current contents) both funnel through this one modal rather than
// two slightly-different flows, since the shape of the decision (what's
// selected, what's a required dependency, name/author/description) is
// identical either way.
import { useState, useMemo } from 'react';
import { Modal, View, Text, Pressable, TextInput, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useHomebrewStore } from '../../store/homebrewStore';
import { makeHomebrewLookup } from '../../store/homebrewLookup';
import { buildDependencyClosure, DependencyRef } from '../../engine/contentDependencies';
import { GrimoirePackHomebrew, PackageContentRef, PackageMeta } from '../../engine/backup';
import { ContentCacheType, HomebrewContent } from '../../db/contentCacheRepo';
import { exportPackage } from '../../io/packageIO';
import { ExportAction } from '../../io/exportShare';
import { Alert } from '../../utils/alert';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../theme';

const CATEGORY_KEY: Record<ContentCacheType, keyof GrimoirePackHomebrew> = {
  race: 'races', subrace: 'subraces', class: 'classes', subclass: 'subclasses',
  spell: 'spells', background: 'backgrounds', feature: 'features', item: 'items',
  feat: 'feats', monster: 'monsters', condition: 'conditions',
};

interface Props {
  visible:  boolean;
  /** The items the user explicitly picked (Export Selected) or that make
   *  up an installed pack's current contents (Export Pack / re-export a
   *  single entry via "Export This Entry"'s pack format). */
  selected: DependencyRef[];
  onClose:  () => void;
}

export function PackageExportModal({ visible, selected, onClose }: Props) {
  const homebrew = useHomebrewStore();
  const lookup = useMemo(() => makeHomebrewLookup(homebrew), [homebrew]);

  const [includeDeps, setIncludeDeps] = useState(true);
  const [name, setName] = useState('');
  const [author, setAuthor] = useState('');
  const [description, setDescription] = useState('');
  const [packageVersion, setPackageVersion] = useState('1.0');
  const [exporting, setExporting] = useState(false);

  const { closure, unresolved } = useMemo(
    () => visible ? buildDependencyClosure(selected, lookup) : { closure: [], unresolved: [] },
    [visible, selected, lookup]
  );
  const selectedEntries = closure.filter(c => c.included === 'selected');
  const dependencyEntries = closure.filter(c => c.included === 'dependency');
  const entriesToExport = includeDeps ? closure : selectedEntries;

  function reset() {
    setName(''); setAuthor(''); setDescription(''); setPackageVersion('1.0'); setIncludeDeps(true);
  }

  async function handleExport(action: ExportAction) {
    if (!name.trim() || exporting) return;
    setExporting(true);
    try {
      const homebrewPayload: GrimoirePackHomebrew = {};
      const contents: PackageContentRef[] = [];
      for (const entry of entriesToExport) {
        const item = lookup({ type: entry.type, id: entry.id });
        if (!item) continue; // shouldn't happen — closure only contains resolved items
        const key = CATEGORY_KEY[entry.type];
        (homebrewPayload[key] as HomebrewContent[] | undefined) ??= [];
        (homebrewPayload[key] as HomebrewContent[]).push(item);
        contents.push({ type: entry.type, id: entry.id, name: entry.name, rulesetId: entry.rulesetId as any, included: entry.included });
      }
      const meta: PackageMeta = { name: name.trim(), author: author.trim() || undefined, description: description.trim() || undefined, packageVersion: packageVersion.trim() || undefined };
      await exportPackage(homebrewPayload, contents, meta, null, action);
      reset();
      onClose();
    } catch (e: any) {
      Alert.alert('Export failed', e?.message ?? 'Something went wrong.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable style={s.sheet} onPress={e => e.stopPropagation()}>
          <ScrollView>
            <Text style={s.title}>Export Package</Text>

            <Text style={s.label}>Package Name *</Text>
            <TextInput style={s.input} value={name} onChangeText={setName} placeholder="e.g. Tideborn Collection" placeholderTextColor={Colors.textDim} />

            <View style={s.row}>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>Author (optional)</Text>
                <TextInput style={s.input} value={author} onChangeText={setAuthor} placeholderTextColor={Colors.textDim} />
              </View>
              <View style={{ width: 90 }}>
                <Text style={s.label}>Version</Text>
                <TextInput style={s.input} value={packageVersion} onChangeText={setPackageVersion} placeholderTextColor={Colors.textDim} />
              </View>
            </View>

            <Text style={s.label}>Description (optional)</Text>
            <TextInput style={[s.input, s.inputMulti]} value={description} onChangeText={setDescription} multiline placeholderTextColor={Colors.textDim} />

            <Text style={s.sectionLabel}>SELECTED ({selectedEntries.length})</Text>
            {selectedEntries.map(e => (
              <Text key={`${e.type}:${e.id}`} style={s.itemRow}>• {e.name} <Text style={s.itemType}>({e.type})</Text></Text>
            ))}

            {dependencyEntries.length > 0 && (
              <>
                <Text style={s.sectionLabel}>REQUIRED DEPENDENCIES ({dependencyEntries.length})</Text>
                {dependencyEntries.map(e => (
                  <Text key={`${e.type}:${e.id}`} style={s.itemRow}>• {e.name} <Text style={s.itemType}>({e.type})</Text></Text>
                ))}
                <Pressable style={s.toggleRow} onPress={() => setIncludeDeps(v => !v)}>
                  <View style={[s.checkbox, includeDeps && s.checkboxChecked]}>
                    {includeDeps && <Text style={s.checkboxMark}>✓</Text>}
                  </View>
                  <Text style={s.toggleTxt}>Include required dependencies</Text>
                </Pressable>
                {!includeDeps && (
                  <Text style={s.warningTxt}>
                    ⚠️ Excluding dependencies means this package will be INCOMPLETE — importers won't have {dependencyEntries.map(e => e.name).join(', ')} unless they already do.
                  </Text>
                )}
              </>
            )}

            {unresolved.length > 0 && (
              <Text style={s.warningTxt}>
                ⚠️ Unresolved reference{unresolved.length === 1 ? '' : 's'}: {unresolved.map(u => `${u.type} "${u.id}"`).join(', ')} — not found locally, so it can't be bundled. The exported content may be incomplete.
              </Text>
            )}

            <Text style={s.summaryTxt}>{entriesToExport.length} item{entriesToExport.length === 1 ? '' : 's'} will be exported.</Text>

            <View style={s.btnRow}>
              <Pressable style={s.cancelBtn} onPress={onClose} disabled={exporting}>
                <Text style={s.cancelTxt}>Cancel</Text>
              </Pressable>
              <Pressable style={[s.exportBtn, (!name.trim() || exporting) && s.btnDisabled]} disabled={!name.trim() || exporting} onPress={() => { void handleExport('share'); }}>
                {exporting ? <ActivityIndicator color={Colors.bg} /> : <Text style={s.exportTxt}>Share Package</Text>}
              </Pressable>
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#000000cc', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.surfaceHigh, borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg,
    padding: Spacing.lg, maxHeight: '85%',
  },
  title: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Spacing.md },
  label: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: FontWeight.bold, marginTop: Spacing.sm, marginBottom: 4 },
  input: {
    backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.sm, color: Colors.textPrimary, fontSize: FontSize.md,
  },
  inputMulti: { minHeight: 60, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: Spacing.sm },
  sectionLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.textSecondary, letterSpacing: 1, marginTop: Spacing.md, marginBottom: Spacing.xs },
  itemRow: { fontSize: FontSize.sm, color: Colors.textPrimary, marginBottom: 2 },
  itemType: { color: Colors.textDim, fontSize: FontSize.xs },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.sm },
  checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: Colors.gold, borderColor: Colors.gold },
  checkboxMark: { fontSize: 12, color: Colors.bg, fontWeight: FontWeight.bold },
  toggleTxt: { fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: FontWeight.bold },
  warningTxt: { fontSize: FontSize.xs, color: Colors.red, marginTop: Spacing.xs, lineHeight: 16 },
  summaryTxt: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: Spacing.md, fontStyle: 'italic' },
  btnRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.lg, marginBottom: Spacing.sm },
  cancelBtn: { flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, paddingVertical: Spacing.sm, alignItems: 'center' },
  cancelTxt: { color: Colors.textSecondary, fontWeight: FontWeight.bold },
  exportBtn: { flex: 2, backgroundColor: Colors.gold, borderRadius: Radius.md, paddingVertical: Spacing.sm, alignItems: 'center' },
  exportTxt: { color: Colors.bg, fontWeight: FontWeight.bold },
  btnDisabled: { opacity: 0.5 },
});
