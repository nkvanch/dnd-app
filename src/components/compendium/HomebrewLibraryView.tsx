// src/components/compendium/HomebrewLibraryView.tsx
// Compendium → Homebrew: the Homebrew LIBRARY (browse / manage existing
// content). Moved here from the Homebrew tab; creation stays on that tab
// (app/(tabs)/homebrew.tsx). Editing an entry opens the SAME builder route it
// always did (`?editId=`); the builder's back action returns here because the
// selected Compendium mode lives in compendiumModeStore, not in this view.
//
// Only Homebrew-scoped data is read: this view never touches the official
// content DB, so it can't reintroduce anything SRD-only hides in Official mode.
import { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, FlatList, Pressable, StyleSheet, ActivityIndicator, TextInput } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useHomebrewStore } from '../../store/homebrewStore';
import { useCharacterStore } from '../../store/characterStore';
import { useBrowseStateStore } from '../../store/browseStateStore';
import { Alert } from '../../utils/alert';
import type { ContentCacheType, HomebrewContent } from '../../db/contentCacheRepo';
import { InstalledPack, loadInstalledPacks, buildPackOwnershipIndex } from '../../db/packRegistryRepo';
import { contentUsedBy } from '../../engine/packDiagnostics';
import { exportHomebrewItem, ExportFormat, ExportAction } from '../../io/exportShare';
import { ExportFormatSheet } from '../ExportFormatSheet';
import { VersionHistoryModal } from '../homebrew/VersionHistoryModal';
import { HomebrewExportModal } from '../homebrew/HomebrewExportModal';
import { usePackageBuilderStore } from '../../store/packageBuilderStore';
import { SortControl } from '../SortControl';
import { sortByOption } from '../../content/contentQuery';
import type { DependencyRef } from '../../engine/contentDependencies';
import {
  LibraryEntry, LIBRARY_CATEGORIES, LIBRARY_SORT_OPTIONS, buildLibraryEntries, filterLibraryEntries,
  libraryRulesets, editHrefFor, originLabel, descriptionOf, rulesetIdOf,
} from '../../content/homebrewLibrary';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../theme';

const STATE_KEY = 'compendium.homebrew';

export function HomebrewLibraryView() {
  const router = useRouter();
  // Individually selected (never one combined object) — same fresh-reference
  // footgun avoidance as every other homebrew-store read in the app.
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
  const deleteItem  = useHomebrewStore(s => s.deleteItem);
  const characters  = useCharacterStore(s => s.characters);

  // Parent names for subraces/subclasses need the parent race/class even when
  // the parent is official — resolved lazily against just the homebrew set
  // plus the merged DB only when a subrace/subclass exists to label.
  const getMergedContentDB = useHomebrewStore(s => s.getMergedContentDB);
  const needsParents = subraces.length > 0 || subclasses.length > 0;
  const parents = useMemo(() => {
    if (!needsParents) return { races: [], classes: [] };
    const db = getMergedContentDB();
    return { races: db.races, classes: db.classes };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsParents, getMergedContentDB, races, classes]);

  const entries = useMemo(
    () => buildLibraryEntries(
      { races, subraces, classes, subclasses, spells, backgrounds, features, items, feats, monsters, conditions },
      parents.races, parents.classes,
    ),
    [races, subraces, classes, subclasses, spells, backgrounds, features, items, feats, monsters, conditions, parents],
  );

  // Per-mode UI state, restored once (lazy) and written back on change.
  const saved = useBrowseStateStore.getState().getBrowseState(STATE_KEY);
  const setBrowseState = useBrowseStateStore(s => s.setBrowseState);
  const [search, setSearch] = useState(saved.search ?? '');
  const [sort, setSort] = useState(saved.sort ?? 'name_asc');
  const [category, setCategory] = useState<ContentCacheType | 'all'>((saved.filters?.category as ContentCacheType | 'all') ?? 'all');
  const [rulesetFilter, setRulesetFilter] = useState<string | null>((saved.filters?.ruleset as string | null) ?? null);
  const [sourceFilter, setSourceFilter] = useState<'all' | 'local' | string>((saved.filters?.source as string) ?? 'all');
  useEffect(() => {
    setBrowseState(STATE_KEY, { search, sort, filters: { category, ruleset: rulesetFilter, source: sourceFilter } });
  }, [search, sort, category, rulesetFilter, sourceFilter, setBrowseState]);

  const [packs, setPacks] = useState<InstalledPack[]>([]);
  // Re-read on focus so pack provenance is current after an import/uninstall elsewhere.
  useFocusEffect(useCallback(() => {
    loadInstalledPacks().then(setPacks).catch(e => console.error('[compendium] loadInstalledPacks failed:', e));
  }, []));
  const packOwnership = useMemo(() => buildPackOwnershipIndex(packs), [packs]);

  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [exportTarget, setExportTarget] = useState<{ type: ContentCacheType; item: HomebrewContent } | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [historyTarget, setHistoryTarget] = useState<{ type: ContentCacheType; item: HomebrewContent } | null>(null);
  // Export Homebrew: the ONE entry being exported (review step shows it + what it requires).
  const [exportingEntryRef, setExportingEntryRef] = useState<DependencyRef | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const toggleSelected = useCallback((type: ContentCacheType, id: string) => {
    const key = `${type}:${id}`;
    setSelectedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  async function handleExportFormat(format: ExportFormat, action: ExportAction) {
    if (!exportTarget) return;
    const { type, item } = exportTarget;
    setExportTarget(null);
    // Export Homebrew: one entry + what it requires, reviewed before anything is written or shared.
    if (format === 'pack') { setExportingEntryRef({ type, id: item.id }); return; }
    setExportingId(item.id);
    try {
      await exportHomebrewItem(type, item, format, action);
    } catch (e: unknown) {
      Alert.alert('Export failed', (e as Error)?.message ?? 'Something went wrong.');
    } finally {
      setExportingId(null);
    }
  }

  const availableRulesets = useMemo(() => libraryRulesets(entries), [entries]);
  const filtered = useMemo(
    () => sortByOption(
      filterLibraryEntries(entries, { search, category, ruleset: rulesetFilter, source: sourceFilter, packOwnership }),
      LIBRARY_SORT_OPTIONS, sort,
    ),
    [entries, search, category, rulesetFilter, sourceFilter, packOwnership, sort],
  );
  const categoryCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of entries) m.set(e.type, (m.get(e.type) ?? 0) + 1);
    return m;
  }, [entries]);

  // contentUsedBy scans every character per row — precompute once per list/character change.
  const usedByMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof contentUsedBy>>();
    for (const { type, item } of filtered) map.set(`${type}:${item.id}`, contentUsedBy(characters, type, item.id));
    return map;
  }, [filtered, characters]);

  const confirmDelete = useCallback((entry: LibraryEntry, usedByNames: string[]) => {
    const inUse = usedByNames.length > 0
      ? `\n\n⚠️ Used by ${usedByNames.length} character${usedByNames.length === 1 ? '' : 's'}: ${usedByNames.join(', ')}. They keep what they already have but may lose the ability to edit it.`
      : '';
    Alert.alert('Delete', `Delete "${entry.item.name}"?${inUse}`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { void deleteItem(entry.type, entry.item.id); } },
    ]);
  }, [deleteItem]);

  const renderRow = useCallback(({ item: entry }: { item: LibraryEntry }) => {
    const { type, item, parentName } = entry;
    const key = `${type}:${item.id}`;
    const editHref = editHrefFor(type, item.id);
    const usedBy = usedByMap.get(key) ?? [];
    const isSelected = selectedKeys.has(key);
    const expanded = expandedKey === key;
    const desc = expanded ? descriptionOf(entry) : undefined;
    const ruleset = rulesetIdOf(item);
    return (
      <View style={[styles.row, styles[`accent_${type}`] ?? null]} testID={`homebrew-row-${key}`}>
        <View style={styles.rowTop}>
          {selectMode && (
            <Pressable style={[styles.checkbox, isSelected && styles.checkboxChecked]} onPress={() => toggleSelected(type, item.id)}>
              {isSelected && <Text style={styles.checkboxMark}>✓</Text>}
            </Pressable>
          )}
          <Pressable style={styles.libraryInfo} testID={`homebrew-row-toggle-${key}`} onPress={() => selectMode ? toggleSelected(type, item.id) : setExpandedKey(expanded ? null : key)}>
            <Text style={styles.libraryName} numberOfLines={expanded ? undefined : 2}>
              {item.name}{parentName ? ` (${parentName})` : ''}
            </Text>
            <View style={styles.badgeRow}>
              <View style={styles.typeBadge}><Text style={styles.typeBadgeTxt}>{type}</Text></View>
              <View style={styles.provBadge}><Text style={styles.provBadgeTxt}>{originLabel(entry, packOwnership)}</Text></View>
              {usedBy.length > 0 && (
                <Pressable
                  style={styles.usedByBadge}
                  onPress={() => Alert.alert(
                    `Used by ${usedBy.length} character${usedBy.length === 1 ? '' : 's'}`,
                    usedBy.map(c => c.identity.name || 'Unnamed').join('\n'),
                  )}
                >
                  <Text style={styles.usedByBadgeTxt}>Used by {usedBy.length}</Text>
                </Pressable>
              )}
            </View>
          </Pressable>
          {!selectMode && (
            <View style={styles.actions}>
              {editHref && (
                <Pressable style={styles.libBtn} accessibilityLabel="Edit" onPress={() => router.push(editHref)}>
                  <Text style={styles.libBtnTxt}>✏️</Text>
                </Pressable>
              )}
              <Pressable style={styles.libBtn} accessibilityLabel="Version history" onPress={() => setHistoryTarget({ type, item })}>
                <Text style={styles.libBtnTxt}>🕐</Text>
              </Pressable>
              <Pressable
                style={styles.libBtn}
                testID={`homebrew-export-${key}`}
                accessibilityLabel="Export Homebrew"
                disabled={exportingId === item.id}
                onPress={() => setExportTarget({ type, item })}
              >
                {exportingId === item.id ? <ActivityIndicator size="small" color={Colors.textPrimary} /> : <Text style={styles.libBtnTxt}>📤</Text>}
              </Pressable>
              <Pressable style={styles.libBtn} accessibilityLabel="Delete" onPress={() => confirmDelete(entry, usedBy.map(c => c.identity.name || 'Unnamed'))}>
                <Text style={styles.libBtnTxt}>🗑</Text>
              </Pressable>
            </View>
          )}
        </View>
        {expanded && !selectMode && (
          <View style={styles.detail}>
            {desc ? <Text style={styles.detailTxt}>{desc}</Text> : <Text style={styles.detailDim}>No description.</Text>}
            <Text style={styles.detailDim}>
              {originLabel(entry, packOwnership)}{ruleset ? ` · Ruleset ${ruleset}` : ''}
            </Text>
            <Text style={styles.detailDim}>Tap 🕐 for version history.</Text>
          </View>
        )}
      </View>
    );
  }, [usedByMap, selectedKeys, selectMode, expandedKey, packOwnership, toggleSelected, router, exportingId, confirmDelete]);

  return (
    <View style={styles.wrap} testID="compendium-homebrew-screen">
      <FlatList
        style={styles.scroll}
        contentContainerStyle={styles.content}
        data={filtered}
        keyExtractor={({ type, item }) => `${type}:${item.id}`}
        renderItem={renderRow}
        initialNumToRender={12}
        windowSize={9}
        ListEmptyComponent={
          entries.length === 0 ? (
            <View style={styles.emptyBox} testID="homebrew-empty">
              <Text style={styles.emptyTxt}>No Homebrew content yet.</Text>
              <Text style={styles.emptyHint}>Create content from the Homebrew tab.</Text>
              <Pressable style={styles.emptyBtn} onPress={() => router.navigate('/(tabs)/homebrew')}>
                <Text style={styles.emptyBtnTxt}>Open Homebrew tab</Text>
              </Pressable>
            </View>
          ) : <Text style={styles.emptyTxt}>No homebrew matches your search or filter.</Text>
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.headerRow}>
              <Text style={styles.count}>{entries.length} entr{entries.length === 1 ? 'y' : 'ies'}</Text>
              {entries.length > 0 && (
                <Pressable style={styles.selectBtn} onPress={() => { setSelectMode(v => !v); setSelectedKeys(new Set()); }}>
                  <Text style={styles.selectBtnTxt}>{selectMode ? 'Cancel' : 'Select'}</Text>
                </Pressable>
              )}
            </View>

            {selectMode && (
              <View style={styles.selectBar}>
                <Text style={styles.selectBarTxt}>{selectedKeys.size} selected</Text>
                <Pressable
                  style={[styles.selectBarBtn, selectedKeys.size === 0 && styles.btnDisabled]}
                  disabled={selectedKeys.size === 0}
                  testID="homebrew-create-package"
                  onPress={() => {
                    const refs = Array.from(selectedKeys).map(k => { const [type, id] = k.split(':') as [ContentCacheType, string]; return { type, id }; });
                    usePackageBuilderStore.getState().begin({ explicit: refs });
                    setSelectMode(false); setSelectedKeys(new Set());
                    router.push('/homebrew/package-builder');
                  }}
                >
                  <Text style={styles.selectBarBtnTxt}>Create Package →</Text>
                </Pressable>
              </View>
            )}

            <TextInput
              testID="compendium-homebrew-search"
              accessibilityLabel="Search your homebrew"
              style={styles.search}
              placeholder="Search your homebrew"
              placeholderTextColor={Colors.textDim}
              value={search}
              onChangeText={setSearch}
            />

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow} contentContainerStyle={styles.chipRowContent}>
              {LIBRARY_CATEGORIES.map(cat => {
                const count = cat.id === 'all' ? entries.length : (categoryCounts.get(cat.id) ?? 0);
                if (cat.id !== 'all' && count === 0) return null;
                const active = category === cat.id;
                return (
                  <Pressable key={cat.id} style={[styles.chip, active && styles.chipActive]} onPress={() => setCategory(cat.id)}>
                    <Text style={[styles.chipTxt, active && styles.chipTxtActive]}>{cat.label} ({count})</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {availableRulesets.length > 1 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow} contentContainerStyle={styles.chipRowContent}>
                <Pressable style={[styles.chip, !rulesetFilter && styles.chipActive]} onPress={() => setRulesetFilter(null)}>
                  <Text style={[styles.chipTxt, !rulesetFilter && styles.chipTxtActive]}>All rulesets</Text>
                </Pressable>
                {availableRulesets.map(r => (
                  <Pressable key={r} style={[styles.chip, rulesetFilter === r && styles.chipActive]} onPress={() => setRulesetFilter(v => v === r ? null : r)}>
                    <Text style={[styles.chipTxt, rulesetFilter === r && styles.chipTxtActive]}>{r}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}

            {packs.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow} contentContainerStyle={styles.chipRowContent}>
                <Pressable style={[styles.chip, sourceFilter === 'all' && styles.chipActive]} onPress={() => setSourceFilter('all')}>
                  <Text style={[styles.chipTxt, sourceFilter === 'all' && styles.chipTxtActive]}>All sources</Text>
                </Pressable>
                <Pressable style={[styles.chip, sourceFilter === 'local' && styles.chipActive]} onPress={() => setSourceFilter(v => v === 'local' ? 'all' : 'local')}>
                  <Text style={[styles.chipTxt, sourceFilter === 'local' && styles.chipTxtActive]}>Locally Authored</Text>
                </Pressable>
                {packs.map(p => (
                  <Pressable key={p.id} style={[styles.chip, sourceFilter === p.id && styles.chipActive]} onPress={() => setSourceFilter(v => v === p.id ? 'all' : p.id)}>
                    <Text style={[styles.chipTxt, sourceFilter === p.id && styles.chipTxtActive]}>{p.name}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}

            <SortControl options={LIBRARY_SORT_OPTIONS} value={sort} onChange={setSort} />
          </View>
        }
      />

      <ExportFormatSheet
        visible={!!exportTarget}
        kind="homebrew"
        title={exportTarget ? `Export "${exportTarget.item.name}"` : ''}
        onSelect={(format, action) => { void handleExportFormat(format, action); }}
        onClose={() => setExportTarget(null)}
      />
      <HomebrewExportModal
        visible={exportingEntryRef !== null}
        entry={exportingEntryRef}
        onClose={() => setExportingEntryRef(null)}
      />
      <VersionHistoryModal
        visible={!!historyTarget}
        type={historyTarget?.type ?? null}
        id={historyTarget?.item.id ?? null}
        name={historyTarget?.item.name ?? ''}
        onClose={() => setHistoryTarget(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap:    { flex: 1 },
  scroll:  { flex: 1 },
  content: { padding: Spacing.md, paddingBottom: Spacing.xxl, gap: Spacing.xs },
  header:  { gap: Spacing.sm, marginBottom: Spacing.xs },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  count:   { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.bold },
  selectBtn: {
    backgroundColor: Colors.surfaceHigh, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.sm, paddingVertical: 4,
  },
  selectBtnTxt: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: FontWeight.bold },
  selectBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.gold + '18', borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.gold + '55',
    paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs,
  },
  selectBarTxt: { fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: FontWeight.bold },
  selectBarBtn: { backgroundColor: Colors.gold, borderRadius: Radius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 4 },
  selectBarBtnTxt: { fontSize: FontSize.xs, color: Colors.bg, fontWeight: FontWeight.bold },
  btnDisabled: { opacity: 0.4 },
  checkbox: {
    width: 22, height: 22, borderRadius: 4, borderWidth: 2, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: Colors.gold, borderColor: Colors.gold },
  checkboxMark: { fontSize: 13, color: Colors.bg, fontWeight: FontWeight.bold },

  search: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, paddingHorizontal: Spacing.sm, paddingVertical: 8,
    fontSize: FontSize.md, color: Colors.textPrimary,
  },
  chipRow:        { flexGrow: 0 },
  chipRowContent: { gap: Spacing.xs, paddingVertical: 2 },
  chip: {
    backgroundColor: Colors.surface, borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.sm, paddingVertical: 4,
  },
  chipActive:    { backgroundColor: Colors.gold + '22', borderColor: Colors.gold + '66' },
  chipTxt:       { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: FontWeight.bold },
  chipTxtActive: { color: Colors.gold },

  // Cards keep a thin type-colour accent on the left edge (same idea as the
  // Official list), never a saturated card body.
  row: {
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderLeftWidth: 4, borderColor: Colors.border, padding: Spacing.sm, gap: Spacing.xs,
  },
  accent_race:       { borderLeftColor: Colors.green },
  accent_subrace:    { borderLeftColor: Colors.green },
  accent_class:      { borderLeftColor: Colors.gold },
  accent_subclass:   { borderLeftColor: Colors.gold },
  accent_feat:       { borderLeftColor: Colors.gold },
  accent_spell:      { borderLeftColor: Colors.blue },
  accent_condition:  { borderLeftColor: Colors.blue },
  accent_background: { borderLeftColor: Colors.purple },
  accent_item:       { borderLeftColor: Colors.red },
  accent_monster:    { borderLeftColor: Colors.red },
  accent_feature:    { borderLeftColor: Colors.textDim },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  libraryInfo: { flex: 1, gap: 4 },
  libraryName: { fontSize: FontSize.md, lineHeight: 20, color: Colors.textPrimary, fontWeight: FontWeight.bold },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, flexWrap: 'wrap' },
  typeBadge:    { backgroundColor: Colors.surfaceHigh, borderRadius: Radius.sm, paddingHorizontal: 6, paddingVertical: 2 },
  typeBadgeTxt: { fontSize: FontSize.xs, color: Colors.textDim },
  // Homebrew provenance: secondary information, gold outline, no fill.
  provBadge:    { borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.gold + '55', paddingHorizontal: 6, paddingVertical: 2 },
  provBadgeTxt: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: FontWeight.bold },
  usedByBadge:    { backgroundColor: Colors.blue + '22', borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.blue + '66', paddingHorizontal: 6, paddingVertical: 2 },
  usedByBadgeTxt: { fontSize: FontSize.xs, color: Colors.blue, fontWeight: FontWeight.bold },
  actions: { flexDirection: 'row', gap: Spacing.xs },
  libBtn: { backgroundColor: Colors.surfaceHigh, borderRadius: Radius.sm, padding: Spacing.xs, borderWidth: 1, borderColor: Colors.border },
  libBtnTxt: { fontSize: FontSize.md },
  detail:    { borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.xs, gap: 4 },
  detailTxt: { fontSize: FontSize.sm, color: Colors.textSecondary },
  detailDim: { fontSize: FontSize.xs, color: Colors.textDim },

  emptyBox:   { alignItems: 'center', gap: Spacing.xs, paddingVertical: Spacing.lg },
  emptyTxt:   { color: Colors.textDim, fontStyle: 'italic', fontSize: FontSize.sm },
  emptyHint:  { color: Colors.textSecondary, fontSize: FontSize.xs },
  emptyBtn:   { backgroundColor: Colors.surfaceHigh, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.gold + '66', paddingHorizontal: Spacing.md, paddingVertical: 6, marginTop: Spacing.xs },
  emptyBtnTxt: { fontSize: FontSize.xs, color: Colors.gold, fontWeight: FontWeight.bold },
});
