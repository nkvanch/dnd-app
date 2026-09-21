// app/homebrew/package-builder.tsx
// Package Builder — reached from Compendium → Packages → Create Package (also
// from the Homebrew library's Select mode and from an installed package's
// Export). Two steps on one screen:
//
//   1. Select Content  — repeated selection across every Homebrew type; the
//                        picker stays open, and the selection survives search
//                        and filter changes.
//   2. Review          — name / version / description, what YOU selected, what
//                        is INCLUDED AUTOMATICALLY because it is required, the
//                        counts, warnings, and only then the export actions.
//
// Nothing is written or shared until an export button in step 2 is pressed.
// Dependencies are derived from the explicit selection every render
// (engine/packageBuilder.ts), so removing a selected entry also drops anything
// no other selected entry still requires.
//
// This is package ASSEMBLY, not Homebrew creation: entries are made on the
// Homebrew tab and merely picked here.
import { useMemo, useState, useEffect, useCallback } from 'react';
import { View, Text, Pressable, TextInput, FlatList, ScrollView, StyleSheet, ActivityIndicator, BackHandler } from 'react-native';
import { useHomebrewStore } from '../../src/store/homebrewStore';
import { makeHomebrewLookup } from '../../src/store/homebrewLookup';
import { usePackageBuilderStore } from '../../src/store/packageBuilderStore';
import {
  computePackagePlan, buildPackagePayload, reviewWarnings, externalizedReferences, groupByType, isSelected, refKey,
  PACKAGE_TYPE_LABELS,
} from '../../src/engine/packageBuilder';
import { LibraryEntry, LIBRARY_CATEGORIES, buildLibraryEntries, filterLibraryEntries } from '../../src/content/homebrewLibrary';
import { isOfficialRef } from '../../src/content/officialRefs';
import { exportPackage } from '../../src/io/packageIO';
import type { ExportAction } from '../../src/io/exportShare';
import type { PackageMeta } from '../../src/engine/backup';
import { Alert } from '../../src/utils/alert';
import { useSafeGoBack } from '../../src/hooks/useSafeGoBack';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../src/theme';

const NO_OWNERSHIP = new Map<string, { packId: string; packName: string }>();

export default function PackageBuilderScreen() {
  const goBack = useSafeGoBack('/(tabs)/compendium');
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
  const getMergedContentDB = useHomebrewStore(s => s.getMergedContentDB);

  const { explicit, step, name, version, author, description, search, category } = usePackageBuilderStore();
  const { toggle, remove, setStep, setField, setCategory, reset } = usePackageBuilderStore.getState();
  const [exporting, setExporting] = useState(false);

  const homebrew = useMemo(
    () => ({ races, subraces, classes, subclasses, spells, backgrounds, features, items, feats, monsters, conditions }),
    [races, subraces, classes, subclasses, spells, backgrounds, features, items, feats, monsters, conditions],
  );
  const lookup = useMemo(() => makeHomebrewLookup(homebrew), [homebrew]);

  const needsParents = subraces.length > 0 || subclasses.length > 0;
  const parents = useMemo(() => {
    if (!needsParents) return { races: [], classes: [] };
    const db = getMergedContentDB();
    return { races: db.races, classes: db.classes };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsParents, getMergedContentDB, races, classes]);
  const entries = useMemo(() => buildLibraryEntries(homebrew, parents.races, parents.classes), [homebrew, parents]);
  const visible = useMemo(
    () => filterLibraryEntries(entries, { search, category, ruleset: null, source: 'all', packOwnership: NO_OWNERSHIP })
      .sort((a, b) => a.item.name.localeCompare(b.item.name)),
    [entries, search, category],
  );
  const categoryCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of entries) m.set(e.type, (m.get(e.type) ?? 0) + 1);
    return m;
  }, [entries]);

  const plan = useMemo(() => computePackagePlan(explicit, lookup), [explicit, lookup]);
  const dependencyKeys = useMemo(() => new Set(plan.dependencies.map(refKey)), [plan]);
  const warnings = useMemo(() => reviewWarnings(plan, isOfficialRef), [plan]);
  const external = useMemo(() => externalizedReferences(plan, isOfficialRef), [plan]);

  // Hardware Back steps from Review back to Select instead of leaving the screen.
  useEffect(() => {
    if (step !== 'review') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { setStep('select'); return true; });
    return () => sub.remove();
  }, [step, setStep]);

  const onBack = useCallback(() => {
    if (step === 'review') setStep('select');
    else goBack();
  }, [step, setStep, goBack]);

  async function handleExport(action: ExportAction) {
    if (!name.trim() || plan.counts.selected === 0 || exporting) return;
    setExporting(true);
    try {
      const { homebrew: payload, contents } = buildPackagePayload(plan, lookup);
      const meta: PackageMeta = {
        name: name.trim(),
        author: author.trim() || undefined,
        description: description.trim() || undefined,
        packageVersion: version.trim() || undefined,
      };
      await exportPackage(payload, contents, meta, null, action);
      reset();
      goBack();
    } catch (e: unknown) {
      Alert.alert('Export failed', (e as Error)?.message ?? 'Something went wrong.');
    } finally {
      setExporting(false);
    }
  }

  // ── Step 1: Select Content ────────────────────────────────────────────────
  if (step === 'select') {
    return (
      <View style={s.screen} testID="package-builder-screen">
        <View style={s.headerRow}>
          <Pressable onPress={onBack} testID="package-builder-back"><Text style={s.back}>← Back</Text></Pressable>
          <Text style={s.title}>Select Content</Text>
          <View style={{ width: 60 }} />
        </View>
        <Text style={s.selectedCount} testID="package-builder-selected-count">Selected {plan.counts.selected}</Text>
        {plan.counts.dependencies > 0 && (
          <Text style={s.depHint}>+ {plan.counts.dependencies} required, added automatically</Text>
        )}

        <View style={s.controls}>
          <TextInput
            testID="package-builder-search"
            style={s.search}
            value={search}
            onChangeText={v => setField('search', v)}
            placeholder="Search your homebrew…"
            placeholderTextColor={Colors.textDim}
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
            {LIBRARY_CATEGORIES.map(cat => {
              const count = cat.id === 'all' ? entries.length : (categoryCounts.get(cat.id) ?? 0);
              if (cat.id !== 'all' && count === 0) return null;
              const active = category === cat.id;
              return (
                <Pressable key={cat.id} testID={`package-builder-type-${cat.id}`} style={[s.chip, active && s.chipActive]} onPress={() => setCategory(cat.id)}>
                  <Text style={[s.chipTxt, active && s.chipTxtActive]}>{cat.label} ({count})</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <FlatList
          style={{ flex: 1 }}
          contentContainerStyle={s.list}
          data={visible}
          extraData={explicit}
          keyExtractor={e => `${e.type}:${e.item.id}`}
          initialNumToRender={14}
          windowSize={9}
          ListEmptyComponent={
            <Text style={s.empty}>
              {entries.length === 0 ? 'No Homebrew content yet. Create some on the Homebrew tab, then come back to package it.' : 'No homebrew matches your search or filter.'}
            </Text>
          }
          renderItem={({ item: e }: { item: LibraryEntry }) => {
            const ref = { type: e.type, id: e.item.id };
            const picked = isSelected(explicit, ref);
            const auto = !picked && dependencyKeys.has(refKey(ref));
            return (
              <Pressable style={[s.row, picked && s.rowPicked]} testID={`package-select-row-${refKey(ref)}`} onPress={() => toggle(ref)}>
                <View style={[s.checkbox, picked && s.checkboxChecked]}>{picked && <Text style={s.checkMark}>✓</Text>}</View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={s.rowName} numberOfLines={2}>{e.item.name}{e.parentName ? ` (${e.parentName})` : ''}</Text>
                  <View style={s.badgeRow}>
                    <View style={s.typeBadge}><Text style={s.typeBadgeTxt}>{PACKAGE_TYPE_LABELS[e.type][0]}</Text></View>
                    {auto && <Text style={s.autoBadge}>🔗 included automatically</Text>}
                  </View>
                </View>
              </Pressable>
            );
          }}
        />

        <View style={s.footer}>
          <Pressable style={[s.footerBtn, plan.counts.selected === 0 && s.disabled]} disabled={plan.counts.selected === 0} testID="package-builder-review" onPress={() => setStep('review')}>
            <Text style={s.footerBtnTxt}>Review Package ({plan.counts.selected})</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ── Step 2: Review ────────────────────────────────────────────────────────
  const selectedGroups = groupByType(plan.selected);
  const dependencyGroups = groupByType(plan.dependencies);
  const canExport = !!name.trim() && plan.counts.selected > 0 && !exporting;

  return (
    <View style={s.screen} testID="package-builder-review-screen">
      <View style={s.headerRow}>
        <Pressable onPress={onBack} testID="package-builder-back"><Text style={s.back}>← Back</Text></Pressable>
        <Text style={s.title}>Review Package</Text>
        <View style={{ width: 60 }} />
      </View>
      <ScrollView contentContainerStyle={s.reviewContent}>
        <Text style={s.label}>Package name *</Text>
        <TextInput testID="package-builder-name" style={s.input} value={name} onChangeText={v => setField('name', v)} placeholder="e.g. My Lunar Collection" placeholderTextColor={Colors.textDim} />
        <View style={s.twoCol}>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>Author (optional)</Text>
            <TextInput style={s.input} value={author} onChangeText={v => setField('author', v)} placeholderTextColor={Colors.textDim} />
          </View>
          <View style={{ width: 90 }}>
            <Text style={s.label}>Version</Text>
            <TextInput style={s.input} value={version} onChangeText={v => setField('version', v)} placeholderTextColor={Colors.textDim} />
          </View>
        </View>
        <Text style={s.label}>Description (optional)</Text>
        <TextInput style={[s.input, s.inputMulti]} value={description} onChangeText={v => setField('description', v)} multiline placeholderTextColor={Colors.textDim} />

        <View style={s.counts} testID="package-review-counts">
          <View style={s.countCell}><Text style={s.countNum} testID="package-count-selected">{plan.counts.selected}</Text><Text style={s.countLbl}>Selected by you</Text></View>
          <View style={s.countCell}><Text style={s.countNum} testID="package-count-dependencies">{plan.counts.dependencies}</Text><Text style={s.countLbl}>Required dependencies</Text></View>
          <View style={s.countCell}><Text style={s.countNum} testID="package-count-total">{plan.counts.total}</Text><Text style={s.countLbl}>Total exported</Text></View>
        </View>

        <Text style={s.section}>SELECTED BY YOU ({plan.counts.selected})</Text>
        {selectedGroups.map(g => (
          <View key={g.type} style={s.group}>
            <Text style={s.groupTitle}>{PACKAGE_TYPE_LABELS[g.type][g.entries.length === 1 ? 0 : 1]}</Text>
            {g.entries.map(e => (
              <View key={refKey(e)} style={s.entryRow}>
                <Text style={s.entryName}>✓ {e.name}</Text>
                <Pressable hitSlop={8} testID={`package-remove-${refKey(e)}`} accessibilityLabel={`Remove ${e.name}`} onPress={() => remove({ type: e.type, id: e.id })}>
                  <Text style={s.removeTxt}>✕</Text>
                </Pressable>
              </View>
            ))}
          </View>
        ))}
        <Pressable style={s.addBtn} testID="package-builder-add" onPress={() => setStep('select')}>
          <Text style={s.addBtnTxt}>+ Add Content</Text>
        </Pressable>

        {plan.dependencies.length > 0 && (
          <>
            <Text style={s.section}>INCLUDED AUTOMATICALLY ({plan.counts.dependencies})</Text>
            <Text style={s.note}>Required for the selected content to work. They can't be removed without removing what needs them.</Text>
            {dependencyGroups.map(g => (
              <View key={g.type} style={s.group}>
                <Text style={s.groupTitle}>{PACKAGE_TYPE_LABELS[g.type][g.entries.length === 1 ? 0 : 1]}</Text>
                {g.entries.map(e => (
                  <View key={refKey(e)} style={s.entryCol}>
                    <Text style={s.entryName}>🔗 {e.name}</Text>
                    {e.requiredBy.length > 0 && <Text style={s.requiredBy}>required by {e.requiredBy.join(', ')}</Text>}
                  </View>
                ))}
              </View>
            ))}
          </>
        )}

        {external.length > 0 && (
          <Text style={s.note}>Not bundled, because it is official content every install already has: {external.map(x => `${x.type} "${x.id}"`).join(', ')}.</Text>
        )}
        {warnings.length > 0 && (
          <View style={s.warnBox}>
            <Text style={s.warnTitle}>Warnings</Text>
            {warnings.map((w, i) => <Text key={i} style={s.warnTxt}>⚠️ {w.message}</Text>)}
          </View>
        )}

        <View style={s.btnRow}>
          <Pressable style={[s.saveBtn, !canExport && s.disabled]} disabled={!canExport} testID="package-export-save" onPress={() => { void handleExport('save'); }}>
            <Text style={s.saveBtnTxt}>Export Package: Save File</Text>
          </Pressable>
          <Pressable style={[s.shareBtn, !canExport && s.disabled]} disabled={!canExport} testID="package-export-share" onPress={() => { void handleExport('share'); }}>
            {exporting ? <ActivityIndicator color={Colors.bg} /> : <Text style={s.shareBtnTxt}>Export Package: Share</Text>}
          </Pressable>
        </View>
        {!name.trim() && <Text style={s.note}>Give the package a name to export it.</Text>}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: Spacing.xl + 8, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.sm },
  back: { color: Colors.gold, fontSize: FontSize.md, fontWeight: FontWeight.bold },
  title: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  selectedCount: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.gold, paddingHorizontal: Spacing.lg },
  depHint: { fontSize: FontSize.xs, color: Colors.textSecondary, paddingHorizontal: Spacing.lg },
  controls: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, gap: Spacing.xs },
  search: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.sm, paddingVertical: 8, fontSize: FontSize.md, color: Colors.textPrimary },
  chipRow: { gap: Spacing.xs, paddingVertical: 2 },
  chip: { backgroundColor: Colors.surface, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.sm, paddingVertical: 4 },
  chipActive: { backgroundColor: Colors.gold + '22', borderColor: Colors.gold + '66' },
  chipTxt: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: FontWeight.bold },
  chipTxtActive: { color: Colors.gold },
  list: { padding: Spacing.lg, gap: Spacing.xs },
  empty: { color: Colors.textDim, fontStyle: 'italic', fontSize: FontSize.sm, textAlign: 'center', paddingVertical: Spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, padding: Spacing.sm },
  rowPicked: { borderColor: Colors.gold, backgroundColor: Colors.gold + '10' },
  checkbox: { width: 24, height: 24, borderRadius: 5, borderWidth: 2, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: Colors.gold, borderColor: Colors.gold },
  checkMark: { fontSize: 14, color: Colors.bg, fontWeight: FontWeight.bold },
  rowName: { fontSize: FontSize.md, color: Colors.textPrimary, fontWeight: FontWeight.bold },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, flexWrap: 'wrap' },
  typeBadge: { backgroundColor: Colors.surfaceHigh, borderRadius: Radius.sm, paddingHorizontal: 6, paddingVertical: 2 },
  typeBadgeTxt: { fontSize: FontSize.xs, color: Colors.textDim },
  autoBadge: { fontSize: FontSize.xs, color: Colors.textSecondary },
  footer: { padding: Spacing.lg, borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.bg },
  footerBtn: { backgroundColor: Colors.gold, borderRadius: Radius.md, paddingVertical: Spacing.md, alignItems: 'center' },
  footerBtnTxt: { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.md },
  disabled: { opacity: 0.4 },

  reviewContent: { padding: Spacing.lg, paddingBottom: Spacing.xxl, gap: Spacing.xs },
  label: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: FontWeight.bold, marginTop: Spacing.sm },
  input: { backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, padding: Spacing.sm, color: Colors.textPrimary, fontSize: FontSize.md },
  inputMulti: { minHeight: 60, textAlignVertical: 'top' },
  twoCol: { flexDirection: 'row', gap: Spacing.sm },
  counts: { flexDirection: 'row', gap: Spacing.xs, marginTop: Spacing.md },
  countCell: { flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, paddingVertical: Spacing.sm, alignItems: 'center' },
  countNum: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.gold },
  countLbl: { fontSize: FontSize.xs, color: Colors.textSecondary, textAlign: 'center' },
  section: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.textSecondary, letterSpacing: 1, marginTop: Spacing.md },
  group: { backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, padding: Spacing.sm, gap: 4, marginTop: Spacing.xs },
  groupTitle: { fontSize: FontSize.xs, color: Colors.textDim, fontWeight: FontWeight.bold },
  entryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  entryCol: { gap: 1 },
  entryName: { fontSize: FontSize.sm, color: Colors.textPrimary },
  requiredBy: { fontSize: FontSize.xs, color: Colors.textDim },
  removeTxt: { fontSize: FontSize.md, color: Colors.red, paddingHorizontal: Spacing.xs },
  addBtn: { alignSelf: 'flex-start', backgroundColor: Colors.surfaceHigh, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.gold + '66', paddingHorizontal: Spacing.sm, paddingVertical: 6, marginTop: Spacing.xs },
  addBtnTxt: { fontSize: FontSize.xs, color: Colors.gold, fontWeight: FontWeight.bold },
  note: { fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 16 },
  warnBox: { backgroundColor: Colors.red + '15', borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.red + '55', padding: Spacing.sm, gap: 4, marginTop: Spacing.sm },
  warnTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.red },
  warnTxt: { fontSize: FontSize.xs, color: Colors.red, lineHeight: 16 },
  btnRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.lg },
  saveBtn: { flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.gold + '66', paddingVertical: Spacing.md, alignItems: 'center' },
  saveBtnTxt: { color: Colors.gold, fontWeight: FontWeight.bold, fontSize: FontSize.sm },
  shareBtn: { flex: 1, backgroundColor: Colors.gold, borderRadius: Radius.md, paddingVertical: Spacing.md, alignItems: 'center' },
  shareBtnTxt: { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.sm },
});
