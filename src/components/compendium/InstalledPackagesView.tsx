// src/components/compendium/InstalledPackagesView.tsx
// Compendium → Packages: the INSTALLED PACKAGES library. Moved here from the
// Homebrew tab's "Installed Packs" panel; package IMPORT still lives on the
// Homebrew tab's Import button (a shortcut to the same screen is offered here,
// the import flow itself is unchanged).
//
// The list and the package detail are two states of the same view. Which
// package is open lives in compendiumModeStore, so opening a content entry
// (an editor) from a package's detail and pressing Back returns to that same
// detail, and pressing Back again (or the "‹ Packages" row) returns to the list.
import { useState, useMemo, useCallback, useEffect } from 'react';
import { View, Text, ScrollView, FlatList, Pressable, StyleSheet, ActivityIndicator, TextInput, BackHandler } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useHomebrewStore } from '../../store/homebrewStore';
import { useCharacterStore } from '../../store/characterStore';
import { useBrowseStateStore } from '../../store/browseStateStore';
import { useCompendiumModeStore } from '../../store/compendiumModeStore';
import { Alert } from '../../utils/alert';
import { InstalledPack, loadInstalledPacks, deleteInstalledPack } from '../../db/packRegistryRepo';
import { loadAllEncounters } from '../../db/encounterRepo';
import type { PreparedEncounter, Issue } from '../../engine/types';
import { diagnosePack } from '../../engine/packDiagnostics';
import { makeHomebrewLookup } from '../../store/homebrewLookup';
import { sortByOption } from '../../content/contentQuery';
import { editHrefFor } from '../../content/homebrewLibrary';
import {
  PACKAGE_KIND_LABELS, PACKAGE_SORT_OPTIONS, PACKAGE_STATUS_LABELS, PackageStatus, PackageFilter,
  packageKindOf, packageStatusOf, compositionLabel, filterPackages, buildPackDetail, CONTENT_TYPE_PLURALS, PackDetail,
} from '../../engine/packageLibrary';
import { SortControl } from '../SortControl';
import { usePackageBuilderStore } from '../../store/packageBuilderStore';
import { IssuesModal } from '../sheet/IssuesModal';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../theme';

const STATE_KEY = 'compendium.packages';

const STATUS_COLOR: Record<PackageStatus, string> = { ok: Colors.green, warning: Colors.gold, error: Colors.red };

function formatDate(ts: number): string {
  try { return new Date(ts).toLocaleDateString(); } catch { return ''; }
}

export function InstalledPackagesView() {
  const router = useRouter();
  const deleteHomebrewItem = useHomebrewStore(s => s.deleteItem);
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
  const characters  = useCharacterStore(s => s.characters);

  const selectedPackId = useCompendiumModeStore(s => s.selectedPackId);
  const openPack = useCompendiumModeStore(s => s.openPack);
  const closePack = useCompendiumModeStore(s => s.closePack);

  const [packs, setPacks] = useState<InstalledPack[]>([]);
  const [encounters, setEncounters] = useState<PreparedEncounter[]>([]);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [diagnosingPackId, setDiagnosingPackId] = useState<string | null>(null);

  const refresh = useCallback(() => {
    loadInstalledPacks().then(setPacks).catch(e => console.error('[compendium] loadInstalledPacks failed:', e));
    loadAllEncounters().then(setEncounters).catch(e => console.error('[compendium] loadAllEncounters failed:', e));
  }, []);
  // Re-read on every focus so a package imported from the import screen shows up on return.
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const homebrew = useMemo(
    () => ({ races, subraces, classes, subclasses, spells, backgrounds, features, items, feats, monsters, conditions }),
    [races, subraces, classes, subclasses, spells, backgrounds, features, items, feats, monsters, conditions],
  );
  const lookup = useMemo(() => makeHomebrewLookup(homebrew), [homebrew]);

  const diagnostics = useMemo(() => {
    const map = new Map<string, Issue[]>();
    for (const p of packs) map.set(p.id, diagnosePack(p, packs, homebrew, characters, encounters));
    return map;
  }, [packs, homebrew, characters, encounters]);
  const statusOf = useCallback((p: InstalledPack) => packageStatusOf(diagnostics.get(p.id) ?? []), [diagnostics]);
  const details = useMemo(() => {
    const map = new Map<string, PackDetail>();
    for (const p of packs) map.set(p.id, buildPackDetail(p, lookup));
    return map;
  }, [packs, lookup]);

  // Per-mode list state (search / sort / filters), restored once and written back.
  const saved = useBrowseStateStore.getState().getBrowseState(STATE_KEY);
  const setBrowseState = useBrowseStateStore(s => s.setBrowseState);
  const [search, setSearch] = useState(saved.search ?? '');
  const [sort, setSort] = useState(saved.sort ?? 'newest');
  const [statusFilter, setStatusFilter] = useState<PackageFilter['status']>((saved.filters?.status as PackageFilter['status']) ?? 'all');
  useEffect(() => {
    setBrowseState(STATE_KEY, { search, sort, filters: { status: statusFilter } });
  }, [search, sort, statusFilter, setBrowseState]);

  const visible = useMemo(
    () => sortByOption(filterPackages(packs, { search, kind: 'all', status: statusFilter }, statusOf), PACKAGE_SORT_OPTIONS, sort),
    [packs, search, statusFilter, statusOf, sort],
  );

  // Hardware Back closes an open package detail first, instead of leaving the tab.
  useEffect(() => {
    if (!selectedPackId) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { closePack(); return true; });
    return () => sub.remove();
  }, [selectedPackId, closePack]);

  /** Export Package for an installed pack: opens the Package Builder at Review, seeded with what the
   *  pack's author selected (dependencies are recomputed, so they stay 'included automatically'). */
  function exportPack(pack: InstalledPack) {
    const explicit = pack.itemRefs.filter(r => r.included !== 'dependency').map(r => ({ type: r.type, id: r.id }));
    usePackageBuilderStore.getState().begin({
      explicit, name: pack.name, version: pack.packageVersion ?? '1.0', author: pack.author ?? '', step: 'review',
    });
    router.push('/homebrew/package-builder');
  }

  function confirmRemove(pack: InstalledPack) {
    // Surface the already-computed pack_content_in_use warnings (which
    // characters depend on this pack) in the destructive dialog itself.
    const dependents = (diagnostics.get(pack.id) ?? []).filter(i => i.code === 'pack_content_in_use');
    const dependentWarning = dependents.length > 0 ? '\n\n⚠️ ' + dependents.map(i => i.message).join('\n\n⚠️ ') : '';
    Alert.alert(
      'Remove Pack',
      `Remove "${pack.name}" and all ${pack.itemRefs.length} item${pack.itemRefs.length !== 1 ? 's' : ''} it installed? This can't be undone.${dependentWarning}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove', style: 'destructive', onPress: () => { void (async () => {
            setRemovingId(pack.id);
            try {
              for (const ref of pack.itemRefs) await deleteHomebrewItem(ref.type, ref.id);
              await deleteInstalledPack(pack.id);
              if (useCompendiumModeStore.getState().selectedPackId === pack.id) closePack();
              refresh();
            } catch (e) {
              console.error('[compendium] pack removal failed:', e);
              Alert.alert('Removal failed', 'Some items may not have been removed. Check the Homebrew library.');
            } finally {
              setRemovingId(null);
            }
          })(); },
        },
      ],
    );
  }

  const selectedPack = selectedPackId ? packs.find(p => p.id === selectedPackId) ?? null : null;
  const diagnosingPack = diagnosingPackId ? packs.find(p => p.id === diagnosingPackId) ?? null : null;

  const modals = (
    <>
      <IssuesModal
        visible={diagnosingPack !== null}
        title={diagnosingPack ? `Pack Diagnostics: ${diagnosingPack.name}` : ''}
        issues={diagnosingPack ? diagnostics.get(diagnosingPack.id) ?? [] : []}
        onClose={() => setDiagnosingPackId(null)}
      />
    </>
  );

  // ── Detail ────────────────────────────────────────────────────────────────
  if (selectedPackId && selectedPack) {
    const d = details.get(selectedPack.id);
    const issues = diagnostics.get(selectedPack.id) ?? [];
    const status = packageStatusOf(issues);
    return (
      <View style={styles.wrap} testID="compendium-package-detail">
        <ScrollView contentContainerStyle={styles.content}>
          <Pressable style={styles.backRow} testID="package-detail-back" onPress={closePack}>
            <Text style={styles.backTxt}>‹ Packages</Text>
          </Pressable>

          <View style={styles.card}>
            <Text style={styles.packName}>{selectedPack.name}</Text>
            <View style={styles.badgeRow}>
              <View style={styles.kindBadge}><Text style={styles.kindBadgeTxt}>{PACKAGE_KIND_LABELS[packageKindOf(selectedPack)]}</Text></View>
              {status !== 'ok' && (
                <Pressable style={[styles.statusBadge, { borderColor: STATUS_COLOR[status] }]} onPress={() => setDiagnosingPackId(selectedPack.id)}>
                  <Text style={[styles.statusBadgeTxt, { color: STATUS_COLOR[status] }]}>{status === 'error' ? '⛔' : '⚠️'} {issues.length}</Text>
                </Pressable>
              )}
            </View>
            {selectedPack.packageVersion && <Text style={styles.meta}>Version {selectedPack.packageVersion}</Text>}
            {selectedPack.author && <Text style={styles.meta}>By {selectedPack.author}</Text>}
            <Text style={styles.meta}>Installed {formatDate(selectedPack.importedAt)} · {compositionLabel(selectedPack)}</Text>
            {d && d.rulesets.length > 0 && <Text style={styles.meta}>Rulesets: {d.rulesets.join(', ')}</Text>}
            <View style={styles.actionRow}>
              <Pressable
                style={styles.actionBtn}
                testID="package-detail-export"
                accessibilityLabel="Export Package"
                onPress={() => exportPack(selectedPack)}
              >
                <Text style={styles.actionBtnTxt}>📦 Export Package</Text>
              </Pressable>
              <Pressable style={styles.actionBtn} accessibilityLabel="Remove pack" disabled={removingId === selectedPack.id} onPress={() => confirmRemove(selectedPack)}>
                {removingId === selectedPack.id ? <ActivityIndicator size="small" color={Colors.textPrimary} /> : <Text style={styles.actionBtnTxt}>🗑 Remove</Text>}
              </Pressable>
            </View>
          </View>

          {d?.groups.map(g => (
            <View key={g.type} style={styles.card}>
              <Text style={styles.groupTitle}>{CONTENT_TYPE_PLURALS[g.type][1].toUpperCase()} ({g.entries.length})</Text>
              {g.entries.map(e => {
                const href = e.missing ? null : editHrefFor(e.type, e.id);
                return (
                  <Pressable
                    key={`${e.type}:${e.id}`}
                    style={styles.entryRow}
                    disabled={!href}
                    onPress={() => href && router.push(href)}
                  >
                    <Text style={[styles.entryName, e.missing && styles.entryMissing]}>{e.missing ? `(missing: ${e.id})` : e.name}</Text>
                    {e.included === 'dependency' && <Text style={styles.entryAuto}>🔗 included automatically</Text>}
                    {href && <Text style={styles.entryChevron}>✏️</Text>}
                  </Pressable>
                );
              })}
            </View>
          ))}

          {d && d.externalDeps.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.groupTitle}>DEPENDS ON (outside this pack)</Text>
              {d.externalDeps.map(dep => (
                <View key={`${dep.type}:${dep.id}`} style={styles.entryRow}>
                  <Text style={[styles.entryName, dep.missing && styles.entryMissing]}>{dep.missing ? `(missing: ${dep.id})` : dep.name}</Text>
                  <Text style={styles.entryType}>{dep.type}</Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
        {modals}
      </View>
    );
  }

  // ── List ──────────────────────────────────────────────────────────────────
  return (
    <View style={styles.wrap} testID="compendium-packages-screen">
      <FlatList
        style={styles.scroll}
        contentContainerStyle={styles.content}
        data={visible}
        keyExtractor={p => p.id}
        ListEmptyComponent={
          packs.length === 0
            ? <Text style={styles.emptyTxt} testID="packages-empty">No installed packages.</Text>
            : <Text style={styles.emptyTxt}>No packages match your search or filter.</Text>
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.headerRow}>
              <Text style={styles.count}>{packs.length} package{packs.length === 1 ? '' : 's'}</Text>
              <View style={styles.headerBtns}>
                <Pressable style={styles.importBtn} testID="packages-create" onPress={() => { usePackageBuilderStore.getState().begin(); router.push('/homebrew/package-builder'); }}>
                  <Text style={styles.importBtnTxt}>＋ Create Package</Text>
                </Pressable>
                <Pressable style={styles.importBtn} testID="packages-import" onPress={() => router.push('/homebrew/import-package')}>
                  <Text style={styles.importBtnTxt}>⬇️ Import</Text>
                </Pressable>
              </View>
            </View>
            {packs.length > 0 && (
              <>
                <TextInput
                  testID="compendium-packages-search"
                  accessibilityLabel="Search packages"
                  style={styles.search}
                  placeholder="Search packages"
                  placeholderTextColor={Colors.textDim}
                  value={search}
                  onChangeText={setSearch}
                />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow} contentContainerStyle={styles.chipRowContent}>
                  {(['all', 'ok', 'warning', 'error'] as const).map(s => {
                    const active = statusFilter === s;
                    return (
                      <Pressable key={s} style={[styles.chip, active && styles.chipActive]} onPress={() => setStatusFilter(s)}>
                        <Text style={[styles.chipTxt, active && styles.chipTxtActive]}>{s === 'all' ? 'All' : PACKAGE_STATUS_LABELS[s]}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
                <SortControl options={PACKAGE_SORT_OPTIONS} value={sort} onChange={setSort} />
              </>
            )}
          </View>
        }
        renderItem={({ item: pack }) => {
          const issues = diagnostics.get(pack.id) ?? [];
          const status = packageStatusOf(issues);
          const d = details.get(pack.id);
          const depLabel = !d ? '' : d.missingCount > 0 ? `${d.missingCount} missing`
            : d.externalDeps.length > 0 ? `${d.externalDeps.length} external dependenc${d.externalDeps.length === 1 ? 'y' : 'ies'}` : 'Self-contained';
          return (
            <Pressable style={styles.packRow} testID={`package-row-${pack.id}`} onPress={() => openPack(pack.id)}>
              <View style={styles.packInfo}>
                <Text style={styles.packName} numberOfLines={2}>{pack.name}</Text>
                <View style={styles.badgeRow}>
                  <View style={styles.kindBadge}><Text style={styles.kindBadgeTxt}>{PACKAGE_KIND_LABELS[packageKindOf(pack)]}</Text></View>
                  {pack.packageVersion && <Text style={styles.meta}>v{pack.packageVersion}</Text>}
                  <Text style={styles.meta}>{pack.itemRefs.length} item{pack.itemRefs.length === 1 ? '' : 's'}</Text>
                </View>
                <Text style={styles.meta} numberOfLines={1}>{compositionLabel(pack)}</Text>
                <Text style={styles.meta} numberOfLines={1}>
                  {pack.author ? `by ${pack.author} · ` : ''}Installed {formatDate(pack.importedAt)} · {depLabel}
                </Text>
              </View>
              {status !== 'ok' && (
                <View style={[styles.statusBadge, { borderColor: STATUS_COLOR[status] }]}>
                  <Text style={[styles.statusBadgeTxt, { color: STATUS_COLOR[status] }]}>{status === 'error' ? '⛔' : '⚠️'} {issues.length}</Text>
                </View>
              )}
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          );
        }}
      />
      {modals}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap:    { flex: 1 },
  scroll:  { flex: 1 },
  content: { padding: Spacing.md, paddingBottom: Spacing.xxl, gap: Spacing.sm },
  header:  { gap: Spacing.sm, marginBottom: Spacing.xs },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  count:   { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.bold },
  headerBtns: { flexDirection: 'row', gap: Spacing.xs },
  importBtn: {
    backgroundColor: Colors.surfaceHigh, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.gold + '66',
    paddingHorizontal: Spacing.sm, paddingVertical: 4,
  },
  importBtnTxt: { fontSize: FontSize.xs, color: Colors.gold, fontWeight: FontWeight.bold },
  search: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, paddingHorizontal: Spacing.sm, paddingVertical: 8,
    fontSize: FontSize.md, color: Colors.textPrimary,
  },
  chipRow:        { flexGrow: 0 },
  chipRowContent: { gap: Spacing.xs, paddingVertical: 2 },
  chip: { backgroundColor: Colors.surface, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.sm, paddingVertical: 4 },
  chipActive:    { backgroundColor: Colors.gold + '22', borderColor: Colors.gold + '66' },
  chipTxt:       { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: FontWeight.bold },
  chipTxtActive: { color: Colors.gold },

  // Packages use package-type/status accents, not the content-type colours.
  packRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderLeftWidth: 4, borderColor: Colors.border, borderLeftColor: Colors.goldDim,
    padding: Spacing.sm,
  },
  packInfo: { flex: 1, gap: 3 },
  packName: { fontSize: FontSize.md, lineHeight: 20, color: Colors.textPrimary, fontWeight: FontWeight.bold },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, flexWrap: 'wrap' },
  kindBadge:    { backgroundColor: Colors.gold + '22', borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.gold + '66', paddingHorizontal: 6, paddingVertical: 2 },
  kindBadgeTxt: { fontSize: FontSize.xs, color: Colors.gold, fontWeight: FontWeight.bold },
  statusBadge:    { borderRadius: Radius.sm, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2 },
  statusBadgeTxt: { fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  meta:    { fontSize: FontSize.xs, color: Colors.textDim },
  chevron: { fontSize: FontSize.xl, color: Colors.textDim },
  emptyTxt: { color: Colors.textDim, fontStyle: 'italic', fontSize: FontSize.sm, textAlign: 'center', paddingVertical: Spacing.lg },

  backRow: { alignSelf: 'flex-start', paddingVertical: 4 },
  backTxt: { fontSize: FontSize.md, color: Colors.gold, fontWeight: FontWeight.bold },
  card: { backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, padding: Spacing.sm, gap: Spacing.xs },
  actionRow: { flexDirection: 'row', gap: Spacing.xs, marginTop: Spacing.xs },
  actionBtn: { backgroundColor: Colors.surfaceHigh, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.sm, paddingVertical: 6 },
  actionBtnTxt: { fontSize: FontSize.xs, color: Colors.textPrimary, fontWeight: FontWeight.bold },
  groupTitle: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: FontWeight.bold, letterSpacing: 1 },
  entryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: Colors.border },
  entryName: { fontSize: FontSize.sm, color: Colors.textPrimary, flex: 1 },
  entryMissing: { color: Colors.red, fontStyle: 'italic' },
  entryType: { fontSize: FontSize.xs, color: Colors.textDim, marginLeft: Spacing.sm },
  entryChevron: { fontSize: FontSize.sm, marginLeft: Spacing.sm },
  entryAuto: { fontSize: FontSize.xs, color: Colors.textDim, marginLeft: Spacing.sm },
});
