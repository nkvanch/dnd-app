// src/components/homebrew/HomebrewExportModal.tsx
// "Export Homebrew" — the review step for exporting ONE Homebrew entry.
//
// The file is a normal .grimoire-pack (one importer for everything) whose
// manifest has a single primary entry, plus — automatically — the Homebrew
// content that entry genuinely requires, so the recipient never gets a broken
// file. No package name or version has to be invented to send one entry, and
// the required content is shown but is not something the user selects.
import { useState, useMemo } from 'react';
import { Modal, View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useHomebrewStore } from '../../store/homebrewStore';
import { makeHomebrewLookup } from '../../store/homebrewLookup';
import type { DependencyRef } from '../../engine/contentDependencies';
import {
  computeSingleExportPlan, buildPackagePayload, singleExportMeta, reviewWarnings, externalizedReferences,
  PACKAGE_TYPE_LABELS,
} from '../../engine/packageBuilder';
import { isOfficialRef } from '../../content/officialRefs';
import { exportPackage } from '../../io/packageIO';
import type { ExportAction } from '../../io/exportShare';
import { Alert } from '../../utils/alert';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../theme';

interface Props {
  visible: boolean;
  /** The one Homebrew entry being exported; null while closed. */
  entry:   DependencyRef | null;
  onClose: () => void;
}

export function HomebrewExportModal({ visible, entry, onClose }: Props) {
  const races       = useHomebrewStore(s => s.races);
  const subraces    = useHomebrewStore(s => s.subraces);
  const classes     = useHomebrewStore(s => s.classes);
  const subclasses  = useHomebrewStore(s => s.subclasses);
  const spells      = useHomebrewStore(s => s.spells);
  const backgrounds = useHomebrewStore(s => s.backgrounds);
  const features    = useHomebrewStore(s => s.features);
  const items       = useHomebrewStore(s => s.items);
  const feats       = useHomebrewStore(s => s.feats);
  const monsters    = useHomebrewStore(s => s.monsters);
  const conditions  = useHomebrewStore(s => s.conditions);
  const lookup = useMemo(
    () => makeHomebrewLookup({ races, subraces, classes, subclasses, spells, backgrounds, features, items, feats, monsters, conditions }),
    [races, subraces, classes, subclasses, spells, backgrounds, features, items, feats, monsters, conditions],
  );
  const [exporting, setExporting] = useState(false);

  const plan = useMemo(() => (visible && entry ? computeSingleExportPlan(entry, lookup) : null), [visible, entry, lookup]);
  const warnings = useMemo(() => (plan ? reviewWarnings(plan, isOfficialRef) : []), [plan]);
  const external = useMemo(() => (plan ? externalizedReferences(plan, isOfficialRef) : []), [plan]);
  const primary = plan?.selected[0];

  async function handleExport(action: ExportAction) {
    if (!plan || !primary || exporting) return;
    setExporting(true);
    try {
      const { homebrew, contents } = buildPackagePayload(plan, lookup);
      const meta = singleExportMeta(primary.name);
      await exportPackage(homebrew, contents, meta, null, action, `${primary.name}-${primary.type}`);
      onClose();
    } catch (e: unknown) {
      Alert.alert('Export failed', (e as Error)?.message ?? 'Something went wrong.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable style={s.sheet} onPress={e => e.stopPropagation()} testID="homebrew-export-review">
          <ScrollView>
            <Text style={s.title}>Export Homebrew</Text>
            <Text style={s.sub}>One entry, plus anything it needs to work. The file imports through Homebrew → Import Homebrew.</Text>

            <Text style={s.section}>PRIMARY CONTENT</Text>
            {primary ? (
              <Text style={s.row}>✓ {primary.name} <Text style={s.type}>({PACKAGE_TYPE_LABELS[primary.type][0]})</Text></Text>
            ) : (
              <Text style={s.warn}>This entry no longer exists in your library.</Text>
            )}

            {plan && plan.dependencies.length > 0 && (
              <>
                <Text style={s.section}>REQUIRED DEPENDENCIES ({plan.dependencies.length}) · INCLUDED AUTOMATICALLY</Text>
                {plan.dependencies.map(d => (
                  <Text key={`${d.type}:${d.id}`} style={s.row}>
                    🔗 {d.name} <Text style={s.type}>({PACKAGE_TYPE_LABELS[d.type][0]})</Text>
                  </Text>
                ))}
              </>
            )}

            {external.length > 0 && (
              <Text style={s.note}>
                Not bundled, because it is official content every install already has: {external.map(e => `${e.type} "${e.id}"`).join(', ')}.
              </Text>
            )}
            {warnings.map((w, i) => <Text key={i} style={s.warn}>⚠️ {w.message}</Text>)}

            <Text style={s.summary}>
              {plan ? `${plan.counts.total} entr${plan.counts.total === 1 ? 'y' : 'ies'} will be exported (1 chosen${plan.counts.dependencies ? `, ${plan.counts.dependencies} required` : ''}).` : ''}
            </Text>

            <View style={s.btnRow}>
              <Pressable style={s.cancelBtn} onPress={onClose} disabled={exporting}>
                <Text style={s.cancelTxt}>Cancel</Text>
              </Pressable>
              <Pressable style={[s.secondaryBtn, (!primary || exporting) && s.disabled]} disabled={!primary || exporting} onPress={() => { void handleExport('save'); }}>
                <Text style={s.secondaryTxt}>Save File</Text>
              </Pressable>
              <Pressable style={[s.primaryBtn, (!primary || exporting) && s.disabled]} disabled={!primary || exporting} onPress={() => { void handleExport('share'); }}>
                {exporting ? <ActivityIndicator color={Colors.bg} /> : <Text style={s.primaryTxt}>Share</Text>}
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
  title: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.gold },
  sub: { fontSize: FontSize.xs, color: Colors.textDim, marginTop: 2, marginBottom: Spacing.sm },
  section: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.textSecondary, letterSpacing: 1, marginTop: Spacing.md, marginBottom: Spacing.xs },
  row: { fontSize: FontSize.md, color: Colors.textPrimary, marginBottom: 3 },
  type: { fontSize: FontSize.xs, color: Colors.textDim },
  note: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: Spacing.sm, lineHeight: 16 },
  warn: { fontSize: FontSize.xs, color: Colors.red, marginTop: Spacing.xs, lineHeight: 16 },
  summary: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: Spacing.md, fontStyle: 'italic' },
  btnRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.lg, marginBottom: Spacing.sm },
  cancelBtn: { flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, paddingVertical: Spacing.sm, alignItems: 'center' },
  cancelTxt: { color: Colors.textSecondary, fontWeight: FontWeight.bold },
  secondaryBtn: { flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.gold + '66', paddingVertical: Spacing.sm, alignItems: 'center' },
  secondaryTxt: { color: Colors.gold, fontWeight: FontWeight.bold },
  primaryBtn: { flex: 1, backgroundColor: Colors.gold, borderRadius: Radius.md, paddingVertical: Spacing.sm, alignItems: 'center' },
  primaryTxt: { color: Colors.bg, fontWeight: FontWeight.bold },
  disabled: { opacity: 0.5 },
});
