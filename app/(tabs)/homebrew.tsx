// app/(tabs)/homebrew.tsx
// Homebrew tab — Installed Packs, Create, and Library sections.
import { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, FlatList, Pressable, StyleSheet, ActivityIndicator, TextInput, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { useHomebrewStore } from '../../src/store/homebrewStore';
import { useCharacterStore } from '../../src/store/characterStore';
import { Alert } from '../../src/utils/alert';
import { ContentCacheType, HomebrewContent } from '../../src/db/contentCacheRepo';
import { InstalledPack, loadInstalledPacks, deleteInstalledPack, buildPackOwnershipIndex } from '../../src/db/packRegistryRepo';
import { loadAllEncounters } from '../../src/db/encounterRepo';
import { PreparedEncounter } from '../../src/engine/types';
import { getContentProvenance } from '../../src/content/provenance';
import { diagnosePack, contentUsedBy } from '../../src/engine/packDiagnostics';
import { Issue } from '../../src/engine/types';
import { exportHomebrewItem, ExportFormat, ExportAction } from '../../src/io/exportShare';
import { ExportFormatSheet } from '../../src/components/ExportFormatSheet';
import { VersionHistoryModal } from '../../src/components/homebrew/VersionHistoryModal';
import { PackageExportModal } from '../../src/components/homebrew/PackageExportModal';
import { IssuesModal } from '../../src/components/sheet/IssuesModal';
import { DependencyRef, collectContentDependencies } from '../../src/engine/contentDependencies';
import { makeHomebrewLookup } from '../../src/store/homebrewLookup';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../src/theme';

// ── View Pack Contents modal ─────────────────────────────────────────────────
// HOMEBREW-PACKAGE-1 item 16: a read-only listing of what an installed pack
// actually contains today (by stable id, resolved to a display name via the
// live homebrew store — so an item renamed since import shows its CURRENT
// name, not a stale snapshot). Close-only, same "read-only, no mutation"
// shell already established by HomebrewTestModal/VersionHistoryModal.
function ViewPackContentsModal({ pack, lookup, onClose }: {
  pack: InstalledPack | null;
  lookup: (ref: DependencyRef) => HomebrewContent | undefined;
  onClose: () => void;
}) {
  // HOMEBREW-PACKAGE-1 item 21: "Show Rulesets" / "Show Dependencies" —
  // both computed live from the pack's current itemRefs rather than a
  // separately-persisted snapshot, matching this same modal's existing
  // "resolve to CURRENT name" philosophy for its item rows above.
  const { rulesets, externalDeps } = useMemo(() => {
    const rulesetSet = new Set<string>();
    const ownedKeys = new Set((pack?.itemRefs ?? []).map(r => `${r.type}:${r.id}`));
    const depMap = new Map<string, { type: ContentCacheType; id: string; name: string }>();
    for (const ref of pack?.itemRefs ?? []) {
      const item = lookup({ type: ref.type, id: ref.id });
      if (!item) continue;
      const rid = (item as { rulesetId?: string }).rulesetId;
      if (rid) rulesetSet.add(rid);
      for (const dep of collectContentDependencies(ref.type, item)) {
        const key = `${dep.type}:${dep.id}`;
        if (ownedKeys.has(key) || depMap.has(key)) continue;
        const depItem = lookup(dep);
        depMap.set(key, { type: dep.type, id: dep.id, name: depItem?.name ?? dep.id });
      }
    }
    return { rulesets: Array.from(rulesetSet), externalDeps: Array.from(depMap.values()) };
  }, [pack, lookup]);

  return (
    <Modal visible={pack !== null} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={e => e.stopPropagation()}>
          <Text style={styles.sheetTitle}>{pack?.name}</Text>
          {pack?.packageVersion && <Text style={styles.sheetSub}>Version {pack.packageVersion}</Text>}
          {pack?.author && <Text style={styles.sheetSub}>By {pack.author}</Text>}
          {rulesets.length > 0 && <Text style={styles.sheetSub}>Rulesets: {rulesets.join(', ')}</Text>}
          <ScrollView style={{ maxHeight: 400 }}>
            {pack?.itemRefs.map(ref => {
              const item = lookup({ type: ref.type, id: ref.id });
              return (
                <View key={`${ref.type}:${ref.id}`} style={styles.sheetRow}>
                  <Text style={styles.sheetRowTxt}>{item?.name ?? `(missing: ${ref.id})`}</Text>
                  <Text style={styles.sheetRowType}>{ref.type}</Text>
                </View>
              );
            })}
            {externalDeps.length > 0 && (
              <>
                <Text style={[styles.sheetSub, { marginTop: Spacing.sm }]}>DEPENDS ON (outside this pack)</Text>
                {externalDeps.map(dep => (
                  <View key={`${dep.type}:${dep.id}`} style={styles.sheetRow}>
                    <Text style={styles.sheetRowTxt}>{dep.name}</Text>
                    <Text style={styles.sheetRowType}>{dep.type}</Text>
                  </View>
                ))}
              </>
            )}
          </ScrollView>
          <Pressable style={styles.sheetCloseBtn} onPress={onClose}>
            <Text style={styles.sheetCloseBtnTxt}>Close</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Installed Packs Panel ────────────────────────────────────────────────────
// A-36 foundations: content-packs (see app/backup.tsx's import flow) are
// registered as a group at import time. This lists them and lets a whole
// pack be uninstalled at once, rather than only item-by-item in the Library
// below. Native-only (SQLite) — loadInstalledPacks() returns [] on web, so
// this deliberately renders nothing there rather than showing a permanently-
// empty section.
function InstalledPacksPanel() {
  const deleteHomebrewItem = useHomebrewStore(s => s.deleteItem);
  // A-62: individually-selected (not one combined object literal) — same
  // reasoning as every other multi-field homebrew-store read in this file,
  // avoids a fresh-reference-every-render footgun feeding into useMemo below.
  const races       = useHomebrewStore(s => s.races);
  const subraces    = useHomebrewStore(s => s.subraces);
  const classes     = useHomebrewStore(s => s.classes);
  const subclasses  = useHomebrewStore(s => s.subclasses);
  const spells      = useHomebrewStore(s => s.spells);
  const backgrounds = useHomebrewStore(s => s.backgrounds);
  const features     = useHomebrewStore(s => s.features);
  const items        = useHomebrewStore(s => s.items);
  const feats         = useHomebrewStore(s => s.feats);
  const monsters       = useHomebrewStore(s => s.monsters);
  const conditions      = useHomebrewStore(s => s.conditions);
  const characters       = useCharacterStore(s => s.characters);
  const [packs, setPacks] = useState<InstalledPack[]>([]);
  // HOMEBREW-PACKAGE-1 item 17: "campaigns where applicable" — prepared
  // encounters (DM planning data) can reference a pack's monster/condition
  // content independently of any saved character.
  const [encounters, setEncounters] = useState<PreparedEncounter[]>([]);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [diagnosingPack, setDiagnosingPack] = useState<InstalledPack | null>(null);
  // HOMEBREW-PACKAGE-1: "Export Pack" — re-exports an already-installed
  // pack's CURRENT contents (which may have drifted from what was
  // originally imported, e.g. after an edit) as a fresh package file.
  const [exportingPackRefs, setExportingPackRefs] = useState<DependencyRef[] | null>(null);
  // HOMEBREW-PACKAGE-1 item 16: "View Contents".
  const [viewingPack, setViewingPack] = useState<InstalledPack | null>(null);
  const homebrewLookup = useMemo(
    () => makeHomebrewLookup({ races, subraces, classes, subclasses, spells, backgrounds, features, items, feats, monsters, conditions }),
    [races, subraces, classes, subclasses, spells, backgrounds, features, items, feats, monsters, conditions],
  );

  const refresh = useCallback(() => {
    loadInstalledPacks().then(setPacks).catch(e => console.error('[homebrew] loadInstalledPacks failed:', e));
    loadAllEncounters().then(setEncounters).catch(e => console.error('[homebrew] loadAllEncounters failed:', e));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const diagnosticsByPackId = useMemo(() => {
    const homebrew = { races, subraces, classes, subclasses, spells, backgrounds, features, items, feats, monsters, conditions };
    const map = new Map<string, Issue[]>();
    for (const pack of packs) map.set(pack.id, diagnosePack(pack, packs, homebrew, characters, encounters));
    return map;
  }, [packs, races, subraces, classes, subclasses, spells, backgrounds, features, items, feats, monsters, conditions, characters, encounters]);

  if (packs.length === 0) return null;

  function confirmRemove(pack: InstalledPack) {
    // Surface the already-computed pack_content_in_use warnings (which
    // characters depend on this pack) in the destructive-removal dialog
    // itself, instead of only via the separate ⚠️ badge a DM could bypass
    // entirely by going straight for the 🗑 button (audit finding
    // PACK-REMOVE-1). diagnosticsByPackId is already computed above.
    const dependents = (diagnosticsByPackId.get(pack.id) ?? []).filter(i => i.code === 'pack_content_in_use');
    const dependentWarning = dependents.length > 0
      ? '\n\n⚠️ ' + dependents.map(i => i.message).join('\n\n⚠️ ')
      : '';
    Alert.alert(
      'Remove Pack',
      `Remove "${pack.name}" and all ${pack.itemRefs.length} item${pack.itemRefs.length !== 1 ? 's' : ''} it installed? This can't be undone.${dependentWarning}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove', style: 'destructive', onPress: async () => {
            setRemovingId(pack.id);
            try {
              for (const ref of pack.itemRefs) {
                await deleteHomebrewItem(ref.type, ref.id);
              }
              await deleteInstalledPack(pack.id);
              refresh();
            } catch (e) {
              console.error('[homebrew] pack removal failed:', e);
              Alert.alert('Removal failed', 'Some items may not have been removed. Check the Library below.');
            } finally {
              setRemovingId(null);
            }
          },
        },
      ],
    );
  }

  return (
    <View style={styles.panel}>
      <Text style={styles.panelTitle}>📦 Installed Packs ({packs.length})</Text>
      <Text style={styles.panelSub}>Content imported together as a shared pack — remove one to uninstall everything it added.</Text>
      {packs.map(pack => {
        const packIssues = diagnosticsByPackId.get(pack.id) ?? [];
        return (
          <View key={pack.id} style={styles.libraryRow}>
            <View style={styles.libraryInfo}>
              <Text style={styles.libraryName}>{pack.name}</Text>
              <View style={styles.typeBadge}>
                <Text style={styles.typeBadgeTxt}>{pack.itemRefs.length} item{pack.itemRefs.length !== 1 ? 's' : ''}</Text>
              </View>
              {pack.packageVersion && <Text style={styles.packMeta}>v{pack.packageVersion}</Text>}
              {pack.author && <Text style={styles.packMeta}>by {pack.author}</Text>}
            </View>
            {/* A-62: only rendered when there's something to show, same
                "hidden when clean" rule the sheet's own Issues badge (A-54)
                uses in app/sheet/[id].tsx. */}
            {packIssues.length > 0 && (
              <Pressable style={styles.libBtn} onPress={() => setDiagnosingPack(pack)}>
                <Text style={styles.libBtnTxt}>
                  {packIssues.some(i => i.severity === 'error') ? '⛔' : '⚠️'} {packIssues.length}
                </Text>
              </Pressable>
            )}
            <Pressable style={styles.libBtn} accessibilityLabel="View pack contents" onPress={() => setViewingPack(pack)}>
              <Text style={styles.libBtnTxt}>👁</Text>
            </Pressable>
            {/* A whole installed pack only ever re-exports as a portable
                .grimoire-pack (there's no single "readable" form for a
                multi-item pack) — 📦 to match that same meaning everywhere
                else on this screen, rather than reusing 📤 (readable export)
                for a different action (re-audit item 16). */}
            <Pressable
              style={styles.libBtn}
              accessibilityLabel="Export portable homebrew package"
              onPress={() => setExportingPackRefs(pack.itemRefs.map(r => ({ type: r.type, id: r.id })))}
            >
              <Text style={styles.libBtnTxt}>📦</Text>
            </Pressable>
            <Pressable
              style={styles.libBtn}
              accessibilityLabel="Remove pack"
              disabled={removingId === pack.id}
              onPress={() => confirmRemove(pack)}
            >
              {removingId === pack.id
                ? <ActivityIndicator size="small" color={Colors.textPrimary} />
                : <Text style={styles.libBtnTxt}>🗑</Text>}
            </Pressable>
          </View>
        );
      })}

      <PackageExportModal
        visible={exportingPackRefs !== null}
        selected={exportingPackRefs ?? []}
        onClose={() => setExportingPackRefs(null)}
      />

      <ViewPackContentsModal
        pack={viewingPack}
        lookup={homebrewLookup}
        onClose={() => setViewingPack(null)}
      />

      <IssuesModal
        visible={diagnosingPack !== null}
        title={diagnosingPack ? `Pack Diagnostics: ${diagnosingPack.name}` : ''}
        issues={diagnosingPack ? diagnosticsByPackId.get(diagnosingPack.id) ?? [] : []}
        onClose={() => setDiagnosingPack(null)}
      />
    </View>
  );
}

// ── Create Panel ──────────────────────────────────────────────────────────────

function CreatePanel() {
  const router = useRouter();
  const ITEMS = [
    { label: '⚔️  New Race',        route: '/homebrew/race-builder'  },
    { label: '🧬  New Subrace',      route: '/homebrew/subrace-builder' },
    { label: '🎓  New Class',        route: '/homebrew/class-builder' },
    { label: '🎭  New Subclass',     route: '/homebrew/subclass-builder' },
    { label: '📜  New Background',   route: '/homebrew/background-builder' },
    { label: '🧰  New Item',         route: '/homebrew/item-builder'  },
    { label: '💎  Rare Items',       route: '/homebrew/rare-items'    },
    { label: '✨  New Spell',        route: '/homebrew/spell-builder' },
    { label: '📖  New Feature',      route: '/homebrew/feature-editor' },
    { label: '🌟  New Feat',         route: '/homebrew/feat-builder' },
    { label: '🐉  New Monster',      route: '/homebrew/monster-builder' },
    { label: '🩹  New Condition',    route: '/homebrew/condition-builder' },
  ];

  return (
    <View style={styles.panel}>
      <Text style={styles.panelTitle}>🛠 Create</Text>
      <Text style={styles.panelSub}>Build custom races, classes, spells, and features with the guided editors.</Text>
      <View style={styles.createGrid}>
        {ITEMS.map(item => (
          <Pressable
            key={item.route + item.label}
            style={styles.createBtn}
            onPress={() => router.push(item.route as any)}
          >
            <Text style={styles.createBtnTxt}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// ── Library Panel ─────────────────────────────────────────────────────────────

// Module-scope, not recreated per render — both are fixed mappings with no
// dependency on any component state/props. Previously redeclared inside
// LibraryPanel on every render, which (once renderRow became a real
// useCallback below, item 21) would have forced it to a new identity every
// render too, defeating the memoization.
const EDIT_ROUTES: Partial<Record<string, string>> = {
  race: '/homebrew/race-builder',
  subrace: '/homebrew/subrace-builder',
  class: '/homebrew/class-builder',
  subclass: '/homebrew/subclass-builder',
  item: '/homebrew/item-builder',
  spell: '/homebrew/spell-builder',
  background: '/homebrew/background-builder',
  feature: '/homebrew/feature-editor',
  feat: '/homebrew/feat-builder',
  monster: '/homebrew/monster-builder',
  condition: '/homebrew/condition-builder',
};

const CATEGORIES: { id: ContentCacheType | 'all'; label: string }[] = [
  { id: 'all',        label: 'All' },
  { id: 'race',       label: 'Races' },
  { id: 'subrace',    label: 'Subraces' },
  { id: 'class',      label: 'Classes' },
  { id: 'subclass',   label: 'Subclasses' },
  { id: 'background', label: 'Backgrounds' },
  { id: 'item',       label: 'Items' },
  { id: 'spell',      label: 'Spells' },
  { id: 'feature',    label: 'Features' },
  { id: 'feat',       label: 'Feats' },
  { id: 'monster',    label: 'Monsters' },
  { id: 'condition',  label: 'Conditions' },
];

function LibraryPanel({ headerContent }: { headerContent?: React.ReactNode }) {
  const router = useRouter();
  const {
    races, subraces, classes, subclasses, spells, backgrounds, features, items, feats, monsters, conditions, deleteItem,
    getMergedContentDB,
  } = useHomebrewStore();
  // Item 18 (homebrew improvements — reference usage): "Used by N" per row.
  const characters = useCharacterStore(s => s.characters);

  // PERF-1: getMergedContentDB() recomputes/merges on every call — memoize
  // against the individually-selected store fields above (same "explicit
  // dependency array, not the function reference" pattern InstalledPacksPanel
  // already uses for diagnosticsByPackId, to avoid the documented
  // fresh-reference-every-render footgun).
  const contentDB = useMemo(
    () => getMergedContentDB(),
    [races, subraces, classes, subclasses, spells, backgrounds, features, items, feats, monsters, conditions],
  );
  const allRaces = contentDB.races;
  const allClasses = contentDB.classes;

  const [exportTarget, setExportTarget] = useState<{ type: ContentCacheType; item: HomebrewContent } | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [historyTarget, setHistoryTarget] = useState<{ type: ContentCacheType; item: HomebrewContent } | null>(null);
  // HOMEBREW-PACKAGE-1 item 1: "Export This Entry" — routes through the SAME
  // dependency-aware PackageExportModal as Export Selected/Export Pack
  // (never a separate single-entry pack format). exportTarget/exportingId
  // above stay for the *human-readable* PDF/Markdown/Plain-Text formats
  // (ExportFormatSheet, a genuinely different feature — reading a homebrew
  // item outside the app) — the old "Grimoire Pack" option that used to sit
  // alongside those (via exportHomebrewItem/createContentPack, no
  // dependency closure) is removed below in favor of this.
  const [exportingEntryRef, setExportingEntryRef] = useState<DependencyRef | null>(null);
  // HOMEBREW-PACKAGE-1: multi-select for "Export Selected" — same local
  // useState<string[]> + toggle shape already established elsewhere in the
  // app (app/dm/encounter.tsx's QuickPanel selection mode) rather than a
  // shared component, since no reusable multi-select abstraction exists to
  // pull from yet (confirmed before writing this).
  const [selectMode, setSelectMode] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [showPackageExport, setShowPackageExport] = useState(false);
  // useCallback (not a plain function) since renderRow — item 21's own
  // memoized row renderer — depends on it; setSelectedKeys is a state
  // setter (stable identity), so an empty dep array is correct here.
  const toggleSelected = useCallback((type: ContentCacheType, id: string) => {
    const key = `${type}:${id}`;
    setSelectedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<ContentCacheType | 'all'>('all');
  // Ruleset — real field on most content types (not Feature, which has no
  // rulesetId at all), sparsely populated app-wide — auto-hides below at
  // <=1 distinct value. Official/Homebrew is N/A here by definition (this
  // whole panel IS the homebrew set). Game is BLOCKED (no game-system
  // concept anywhere in the app; matchesGame would also just no-op today
  // since Ruleset itself is barely populated).
  const [rulesetFilter, setRulesetFilter] = useState<string | null>(null);
  // PROVENANCE-1: Source/Pack, finished — real, via getContentProvenance()
  // + the pack-ownership index (buildPackOwnershipIndex(), derived from
  // InstalledPack.itemRefs, the one authoritative pack registry — no
  // duplicated packId field added to content). 'local' / a specific
  // installed pack's own id.
  const [sourceFilter, setSourceFilter] = useState<'all' | 'local' | string>('all');
  const [packs, setPacks] = useState<InstalledPack[]>([]);
  useEffect(() => {
    loadInstalledPacks().then(setPacks).catch(e => console.error('[homebrew] loadInstalledPacks failed:', e));
  }, []);
  const packOwnership = useMemo(() => buildPackOwnershipIndex(packs), [packs]);

  async function handleExportFormat(format: ExportFormat, action: ExportAction) {
    if (!exportTarget) return;
    const { type, item } = exportTarget;
    setExportTarget(null);
    setExportingId(item.id);
    try {
      await exportHomebrewItem(type, item, format, action);
    } catch (e: any) {
      Alert.alert('Export failed', e?.message ?? 'Something went wrong.');
    } finally {
      setExportingId(null);
    }
  }

  // Homebrew count — drives the "no homebrew saved yet" messaging below.
  const homebrewCount =
    races.length + subraces.length + classes.length + subclasses.length +
    items.length + spells.length + backgrounds.length + features.length +
    feats.length + monsters.length + conditions.length;

  // PERF-1: was recomputed unconditionally on every render (11 array spreads
  // plus a per-subrace/subclass .find() each); memoized against the same
  // store fields plus contentDB (already memoized above).
  const all = useMemo(() => [
    ...races.map(r       => ({ type: 'race'       as const, item: r })),
    ...subraces.map(sr   => ({ type: 'subrace'    as const, item: sr, parentName: allRaces.find(r => r.id === sr.parentId)?.name })),
    ...classes.map(c     => ({ type: 'class'      as const, item: c })),
    ...subclasses.map(sc => ({ type: 'subclass'   as const, item: sc, parentName: allClasses.find(c => c.id === sc.classId)?.name })),
    ...items.map(it      => ({ type: 'item'       as const, item: it })),
    ...spells.map(s      => ({ type: 'spell'      as const, item: s })),
    ...backgrounds.map(b => ({ type: 'background' as const, item: b })),
    ...features.map(f    => ({ type: 'feature'    as const, item: f })),
    ...feats.map(f       => ({ type: 'feat'       as const, item: f })),
    ...monsters.map(m    => ({ type: 'monster'    as const, item: m })),
    // HOMEBREW-COMPENDIUM-SEPARATION-1: this used to also include official
    // conditions (via contentDB.conditions) — the Homebrew Library is for
    // content the user authored/installed, not a browse surface for
    // official content; that's what the Compendium tab (app/(tabs)/
    // compendium.tsx) is for, and it already exists. Now homebrew-only,
    // matching every other content type in this same array (all sourced
    // directly from the raw homebrew-store arrays, never contentDB).
    ...conditions.map(c => ({ type: 'condition' as const, item: c, isOfficial: false })),
  ], [races, subraces, classes, subclasses, items, spells, backgrounds, features, feats, monsters, conditions, allRaces, allClasses]);

  const rulesetIdOf = (item: unknown): string | undefined =>
    (item && typeof item === 'object' && 'rulesetId' in item) ? (item as { rulesetId?: string }).rulesetId : undefined;
  const availableRulesets = useMemo(
    () => Array.from(new Set(all.map(({ item }) => rulesetIdOf(item)).filter((r): r is string => !!r))).sort(),
    [all],
  );
  const filtered = useMemo(() => all.filter(({ type, item }) => {
    if (categoryFilter !== 'all' && type !== categoryFilter) return false;
    if (search.trim() && !item.name.toLowerCase().includes(search.trim().toLowerCase())) return false;
    if (rulesetFilter && rulesetIdOf(item) !== rulesetFilter) return false;
    if (sourceFilter !== 'all') {
      // Feature.source is a FeatureSource OBJECT (provenance tracking for
      // where a Feature came from mechanically), not the free-text
      // sourcebook string every other content type's `.source` means here
      // — narrow it out rather than passing the wrong shape through.
      const itemForProvenance = { ...item, source: typeof (item as { source?: unknown }).source === 'string' ? (item as { source: string }).source : undefined };
      const prov = getContentProvenance(itemForProvenance, { isHomebrew: true, packOwnership, ownershipKey: `${type}:${item.id}` });
      if (sourceFilter === 'local' ? prov.originKind !== 'local_homebrew' : prov.packId !== sourceFilter) return false;
    }
    return true;
  }), [all, categoryFilter, search, rulesetFilter, sourceFilter, packOwnership]);

  // PERF-1: contentUsedBy() scans every character per row — was called fresh
  // per visible row on every render. Precompute once per filtered/characters
  // change, keyed the same way the row list itself is keyed (`${type}:${id}`).
  const usedByMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof contentUsedBy>>();
    for (const { type, item, ...rest } of filtered) {
      const isOfficial = 'isOfficial' in rest && rest.isOfficial === true;
      if (!isOfficial) {
        map.set(`${type}:${item.id}`, contentUsedBy(characters, type, item.id));
      }
    }
    return map;
  }, [filtered, characters]);

  // Re-audit item 21: this was a plain `.map()` over the full `filtered`
  // array inside the outer screen ScrollView — every row (races, classes,
  // spells, items, etc., potentially hundreds combined) mounted immediately
  // on open, and stayed mounted while scrolling. Restructured so THIS
  // FlatList is the screen's single scroll container (only it, not the
  // parent, actually scrolls now — see HomebrewScreen below): it only
  // renders rows near the viewport, and `headerContent`
  // (InstalledPacksPanel + CreatePanel, passed in by HomebrewScreen) plus
  // this panel's own search/filter controls ride along as
  // ListHeaderComponent so the whole screen still scrolls as one piece,
  // exactly as it did as a single ScrollView.
  const renderRow = useCallback(({ item: entry }: { item: typeof filtered[number] }) => {
    const { type, item, ...rest } = entry;
    const editRoute = EDIT_ROUTES[type];
    const parentName = 'parentName' in rest ? rest.parentName : undefined;
    const isOfficial = 'isOfficial' in rest && rest.isOfficial === true;
    // Not shown for official rows — "used by" only means anything for
    // content the user actually owns/could change. contentUsedBy checks
    // typed fields (race/class/subclass/background/spell/item) plus an
    // untyped resolved-choice-selection fallback for everything else
    // (feature/feat/monster/condition), same conservative matching
    // diagnosePack's own pack-level check already uses. Precomputed in
    // usedByMap above (PERF-1) rather than called fresh per row here.
    const usedBy = usedByMap.get(`${type}:${item.id}`) ?? [];
    const rowKey = `${type}:${item.id}`;
    const isSelected = selectedKeys.has(rowKey);
    return (
      <View style={styles.libraryRow}>
        {selectMode && !isOfficial && (
          <Pressable style={[styles.checkbox, isSelected && styles.checkboxChecked]} onPress={() => toggleSelected(type, item.id)}>
            {isSelected && <Text style={styles.checkboxMark}>✓</Text>}
          </Pressable>
        )}
        {/* Re-audit item 21 (readable rows): name and badges used to be
            flex-row SIBLINGS competing for the same horizontal space — a
            long name either got squeezed against the badges or wrapped
            underneath them with visible overlap. Stacked instead: the name
            gets its own line (up to 2, via numberOfLines + a real
            lineHeight), badges sit on their own row below it, clearly
            secondary — this is purely a name/badge layout fix, not the
            list's virtualization (handled by the FlatList wrapping this). */}
        <View style={styles.libraryInfo}>
          <Text style={styles.libraryName} numberOfLines={2}>
            {item.name}{parentName ? ` (${parentName})` : ''}
          </Text>
          <View style={styles.libraryBadgeRow}>
            <View style={[styles.typeBadge, styles[`typeBadge_${type}`] ?? {}]}>
              <Text style={styles.typeBadgeTxt}>{type}</Text>
            </View>
            {isOfficial && (
              <View style={styles.officialBadge}>
                <Text style={styles.officialBadgeTxt}>Official</Text>
              </View>
            )}
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
        </View>
            {/* Official content is reference-only — no edit/history/export/delete,
                same rule any homebrew-owned action already implicitly follows
                (these buttons only ever meant anything for a user's own content).
                Hidden in select mode too — that mode's only action is the
                checkbox above + the bulk "Export Selected" bar. */}
            {!isOfficial && !selectMode && (
            <View style={styles.libraryActions}>
              {editRoute && (
                <Pressable
                  style={styles.libBtn}
                  accessibilityLabel="Edit"
                  onPress={() => router.push(`${editRoute}?editId=${item.id}` as any)}
                >
                  <Text style={styles.libBtnTxt}>✏️</Text>
                </Pressable>
              )}
              <Pressable
                style={styles.libBtn}
                accessibilityLabel="Version history"
                onPress={() => setHistoryTarget({ type, item })}
              >
                <Text style={styles.libBtnTxt}>🕐</Text>
              </Pressable>
              {/* Re-audit item 16: these two are deliberately distinct
                  actions — Readable Export (PDF/Markdown/Plain Text, for a
                  person to read) vs Portable Homebrew (a re-importable
                  .grimoire-pack, for another device/player). Distinguished
                  via accessibilityLabel here; a fuller visual grouping with
                  real labels is item 21's row-readability pass, not this one. */}
              <Pressable
                style={styles.libBtn}
                accessibilityLabel="Readable export (PDF, Markdown, Plain Text)"
                disabled={exportingId === item.id}
                onPress={() => setExportTarget({ type, item })}
              >
                {exportingId === item.id
                  ? <ActivityIndicator size="small" color={Colors.textPrimary} />
                  : <Text style={styles.libBtnTxt}>📤</Text>}
              </Pressable>
              <Pressable
                style={styles.libBtn}
                accessibilityLabel="Export portable homebrew package"
                onPress={() => setExportingEntryRef({ type, id: item.id })}
              >
                <Text style={styles.libBtnTxt}>📦</Text>
              </Pressable>
              <Pressable
                style={styles.libBtn}
                accessibilityLabel="Delete"
                onPress={() => {
                  Alert.alert('Delete', `Delete "${item.name}"?`, [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Delete', style: 'destructive', onPress: () => deleteItem(type, item.id) },
                  ]);
                }}
              >
                <Text style={styles.libBtnTxt}>🗑</Text>
              </Pressable>
            </View>
            )}
      </View>
    );
  }, [usedByMap, selectedKeys, selectMode, toggleSelected, router, setHistoryTarget, exportingId, setExportTarget, setExportingEntryRef, deleteItem]);

  return (
    <View style={styles.panelWrap}>
      <FlatList
        style={styles.scroll}
        contentContainerStyle={styles.content}
        data={filtered}
        keyExtractor={({ type, item }) => `${type}:${item.id}`}
        renderItem={renderRow}
        initialNumToRender={12}
        windowSize={9}
        ListEmptyComponent={filtered.length === 0 ? <Text style={styles.emptyTxt}>No homebrew matches your search or filter.</Text> : null}
        ListHeaderComponent={
          <View style={styles.headerStack}>
            {headerContent}
            <View style={styles.panel}>
            <View style={styles.libraryHeaderRow}>
              <Text style={styles.panelTitle}>📚 Library ({all.length})</Text>
              {homebrewCount > 0 && (
                <Pressable
                  style={styles.selectModeBtn}
                  onPress={() => { setSelectMode(v => !v); setSelectedKeys(new Set()); }}
                >
                  <Text style={styles.selectModeBtnTxt}>{selectMode ? 'Cancel' : 'Select'}</Text>
                </Pressable>
              )}
            </View>

            {selectMode && (
              <View style={styles.selectBar}>
                <Text style={styles.selectBarTxt}>{selectedKeys.size} selected</Text>
                <Pressable
                  style={[styles.selectBarBtn, selectedKeys.size === 0 && styles.btnDisabled]}
                  disabled={selectedKeys.size === 0}
                  onPress={() => setShowPackageExport(true)}
                >
                  <Text style={styles.selectBarBtnTxt}>Export Selected →</Text>
                </Pressable>
              </View>
            )}

            {homebrewCount === 0 && (
              <Text style={styles.emptyTxt}>
                No homebrew content saved yet — create something above. Browse official content
                in the Compendium tab.
              </Text>
            )}

            <TextInput
              style={styles.search}
              placeholder="Search your homebrew"
              placeholderTextColor={Colors.textDim}
              value={search}
              onChangeText={setSearch}
            />

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryRow} contentContainerStyle={styles.categoryRowContent}>
              {CATEGORIES.map(cat => {
                const count = cat.id === 'all' ? all.length : all.filter(a => a.type === cat.id).length;
                if (cat.id !== 'all' && count === 0) return null;
                const active = categoryFilter === cat.id;
                return (
                  <Pressable
                    key={cat.id}
                    style={[styles.categoryChip, active && styles.categoryChipActive]}
                    onPress={() => setCategoryFilter(cat.id)}
                  >
                    <Text style={[styles.categoryChipTxt, active && styles.categoryChipTxtActive]}>
                      {cat.label} ({count})
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {availableRulesets.length > 1 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryRow} contentContainerStyle={styles.categoryRowContent}>
                <Pressable
                  style={[styles.categoryChip, !rulesetFilter && styles.categoryChipActive]}
                  onPress={() => setRulesetFilter(null)}
                >
                  <Text style={[styles.categoryChipTxt, !rulesetFilter && styles.categoryChipTxtActive]}>All rulesets</Text>
                </Pressable>
                {availableRulesets.map(r => (
                  <Pressable
                    key={r}
                    style={[styles.categoryChip, rulesetFilter === r && styles.categoryChipActive]}
                    onPress={() => setRulesetFilter(v => v === r ? null : r)}
                  >
                    <Text style={[styles.categoryChipTxt, rulesetFilter === r && styles.categoryChipTxtActive]}>{r}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}

            {packs.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryRow} contentContainerStyle={styles.categoryRowContent}>
                <Pressable
                  style={[styles.categoryChip, sourceFilter === 'all' && styles.categoryChipActive]}
                  onPress={() => setSourceFilter('all')}
                >
                  <Text style={[styles.categoryChipTxt, sourceFilter === 'all' && styles.categoryChipTxtActive]}>All sources</Text>
                </Pressable>
                <Pressable
                  style={[styles.categoryChip, sourceFilter === 'local' && styles.categoryChipActive]}
                  onPress={() => setSourceFilter(v => v === 'local' ? 'all' : 'local')}
                >
                  <Text style={[styles.categoryChipTxt, sourceFilter === 'local' && styles.categoryChipTxtActive]}>Locally Authored</Text>
                </Pressable>
                {packs.map(p => (
                  <Pressable
                    key={p.id}
                    style={[styles.categoryChip, sourceFilter === p.id && styles.categoryChipActive]}
                    onPress={() => setSourceFilter(v => v === p.id ? 'all' : p.id)}
                  >
                    <Text style={[styles.categoryChipTxt, sourceFilter === p.id && styles.categoryChipTxtActive]}>{p.name}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
            </View>
          </View>
        }
      />

      <ExportFormatSheet
        visible={!!exportTarget}
        title={exportTarget ? `Export "${exportTarget.item.name}"` : ''}
        onSelect={handleExportFormat}
        onClose={() => setExportTarget(null)}
      />

      <PackageExportModal
        visible={showPackageExport}
        selected={Array.from(selectedKeys).map(key => {
          const [type, id] = key.split(':') as [ContentCacheType, string];
          return { type, id };
        })}
        onClose={() => { setShowPackageExport(false); setSelectMode(false); setSelectedKeys(new Set()); }}
      />

      <PackageExportModal
        visible={exportingEntryRef !== null}
        selected={exportingEntryRef ? [exportingEntryRef] : []}
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

// ── Homebrew Screen ───────────────────────────────────────────────────────────

export default function HomebrewScreen() {
  const router = useRouter();
  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Homebrew</Text>
        <Pressable style={styles.importBtn} onPress={() => router.push('/homebrew/import-package')}>
          <Text style={styles.importBtnTxt}>⬇️ Import Homebrew</Text>
        </Pressable>
      </View>
      {/* Re-audit item 21: LibraryPanel's own FlatList is now the single
          scroll container for the whole screen (see its own header comment)
          — InstalledPacksPanel/CreatePanel ride along as its
          ListHeaderComponent instead of both this ScrollView AND a nested
          list fighting over which one actually scrolls. */}
      <LibraryPanel headerContent={<><InstalledPacksPanel /><CreatePanel /></>} />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  header: {
    paddingTop: Spacing.xl + 8, paddingBottom: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm,
  },
  title:  { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.gold },
  importBtn: {
    backgroundColor: Colors.surfaceHigh, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.gold + '66',
    paddingHorizontal: Spacing.sm, paddingVertical: 6,
  },
  importBtnTxt: { fontSize: FontSize.xs, color: Colors.gold, fontWeight: FontWeight.bold },
  scroll: { flex: 1 },
  // Re-audit item 21: no `gap` here anymore — this is now a FlatList's
  // contentContainerStyle (LibraryPanel), and a contentContainerStyle gap
  // would insert the same large gap between every virtualized ROW, not
  // just between the header and the first row. headerStack (below) carries
  // that spacing instead, scoped to just the header block.
  content:{ padding: Spacing.md, paddingBottom: Spacing.xxl },
  headerStack: { gap: Spacing.md, marginBottom: Spacing.md },

  libraryHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  selectModeBtn: {
    backgroundColor: Colors.surfaceHigh, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.sm, paddingVertical: 4,
  },
  selectModeBtnTxt: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: FontWeight.bold },
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

  panel: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.md, gap: Spacing.sm,
  },
  panelTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  panelSub:   { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  // Re-audit item 21: LibraryPanel's own top-level wrapper (flex:1, so its
  // FlatList can actually fill the screen) and the search/filter block
  // inside its ListHeaderComponent (kept in its own `panel` card, same look
  // as InstalledPacksPanel/CreatePanel above it — see the header comment on
  // renderRow for why the ROWS themselves render as a plain list below that
  // card rather than inside one continuous bordered card with the header,
  // now that they're virtualized).
  panelWrap:     { flex: 1 },
  libraryHeader: { gap: Spacing.sm },

  createGrid: { gap: Spacing.xs },
  createBtn: {
    backgroundColor: Colors.surfaceHigh, borderRadius: Radius.md,
    padding: Spacing.md, borderWidth: 1, borderColor: Colors.border,
  },
  createBtnTxt: { fontSize: FontSize.md, color: Colors.textPrimary },

  search: {
    backgroundColor: Colors.surfaceHigh, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    fontSize: FontSize.md, color: Colors.textPrimary,
  },
  categoryRow:        { flexGrow: 0 },
  categoryRowContent: { gap: Spacing.xs, paddingVertical: 2 },
  categoryChip: {
    backgroundColor: Colors.surfaceHigh, borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.sm, paddingVertical: 4,
  },
  categoryChipActive:   { backgroundColor: Colors.gold + '22', borderColor: Colors.gold + '66' },
  categoryChipTxt:      { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: FontWeight.bold },
  categoryChipTxtActive:{ color: Colors.gold },

  libraryRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  // Re-audit item 21 (readable rows): name and badges stacked, not
  // flex-row siblings — a long name gets its own line(s) (up to 2, via
  // numberOfLines on the Text below) with a real lineHeight, instead of
  // being squeezed against or overlapped by the type/official/used-by
  // badges, which now sit clearly secondary on their own row underneath.
  libraryInfo:     { flex: 1, gap: 4 },
  libraryName:     { fontSize: FontSize.md, lineHeight: 20, color: Colors.textPrimary, fontWeight: FontWeight.bold },
  libraryBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, flexWrap: 'wrap' },
  typeBadge:      { backgroundColor: Colors.surfaceHigh, borderRadius: Radius.sm, paddingHorizontal: 6, paddingVertical: 2 },
  typeBadgeTxt:   { fontSize: FontSize.xs, color: Colors.textDim },
  typeBadge_race:       { backgroundColor: Colors.green  + '22' },
  typeBadge_subrace:    { backgroundColor: Colors.green  + '22' },
  typeBadge_class:      { backgroundColor: Colors.gold   + '22' },
  typeBadge_subclass:   { backgroundColor: Colors.gold   + '22' },
  typeBadge_spell:      { backgroundColor: Colors.blue   + '22' },
  typeBadge_background: { backgroundColor: Colors.purple + '22' },
  typeBadge_feature:    { backgroundColor: Colors.surfaceHigh },
  typeBadge_item:       { backgroundColor: Colors.red + '22' },
  typeBadge_feat:       { backgroundColor: Colors.gold + '22' },
  typeBadge_monster:    { backgroundColor: Colors.red + '22' },
  typeBadge_condition:  { backgroundColor: Colors.blue + '22' },
  officialBadge:    { backgroundColor: Colors.surfaceHigh, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 6, paddingVertical: 2 },
  officialBadgeTxt: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: FontWeight.bold },
  usedByBadge:    { backgroundColor: Colors.blue + '22', borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.blue + '66', paddingHorizontal: 6, paddingVertical: 2 },
  usedByBadgeTxt: { fontSize: FontSize.xs, color: Colors.blue, fontWeight: FontWeight.bold },
  libraryActions: { flexDirection: 'row', gap: Spacing.xs },
  libBtn: {
    backgroundColor: Colors.surfaceHigh, borderRadius: Radius.sm,
    padding: Spacing.xs, borderWidth: 1, borderColor: Colors.border,
  },
  libBtnTxt:  { fontSize: FontSize.md },
  emptyTxt:   { color: Colors.textDim, fontStyle: 'italic', fontSize: FontSize.sm },

  packMeta: { fontSize: FontSize.xs, color: Colors.textDim },

  // ViewPackContentsModal
  backdrop: { flex: 1, backgroundColor: '#000000cc', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.surfaceHigh, borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg,
    padding: Spacing.lg, maxHeight: '80%',
  },
  sheetTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.gold },
  sheetSub:   { fontSize: FontSize.xs, color: Colors.textDim, marginTop: 2 },
  sheetRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: Spacing.xs, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  sheetRowTxt:  { fontSize: FontSize.sm, color: Colors.textPrimary, flex: 1 },
  sheetRowType: { fontSize: FontSize.xs, color: Colors.textDim, marginLeft: Spacing.sm },
  sheetCloseBtn: {
    alignItems: 'center', backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, paddingVertical: Spacing.sm, marginTop: Spacing.md,
  },
  sheetCloseBtnTxt: { color: Colors.textSecondary, fontWeight: FontWeight.bold },
});
