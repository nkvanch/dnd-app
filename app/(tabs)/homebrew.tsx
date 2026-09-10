// app/(tabs)/homebrew.tsx
// Homebrew tab — Installed Packs, Create, and Library sections.
import { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { useHomebrewStore } from '../../src/store/homebrewStore';
import { useCharacterStore } from '../../src/store/characterStore';
import { Alert } from '../../src/utils/alert';
import { ContentCacheType, HomebrewContent } from '../../src/db/contentCacheRepo';
import { InstalledPack, loadInstalledPacks, deleteInstalledPack } from '../../src/db/packRegistryRepo';
import { diagnosePack, contentUsedBy } from '../../src/engine/packDiagnostics';
import { Issue } from '../../src/engine/types';
import { exportHomebrewItem, ExportFormat, ExportAction } from '../../src/io/exportShare';
import { ExportFormatSheet } from '../../src/components/ExportFormatSheet';
import { VersionHistoryModal } from '../../src/components/homebrew/VersionHistoryModal';
import { IssuesModal } from '../../src/components/sheet/IssuesModal';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../src/theme';

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
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [diagnosingPack, setDiagnosingPack] = useState<InstalledPack | null>(null);

  const refresh = useCallback(() => {
    loadInstalledPacks().then(setPacks).catch(e => console.error('[homebrew] loadInstalledPacks failed:', e));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const diagnosticsByPackId = useMemo(() => {
    const homebrew = { races, subraces, classes, subclasses, spells, backgrounds, features, items, feats, monsters, conditions };
    const map = new Map<string, Issue[]>();
    for (const pack of packs) map.set(pack.id, diagnosePack(pack, packs, homebrew, characters));
    return map;
  }, [packs, races, subraces, classes, subclasses, spells, backgrounds, features, items, feats, monsters, conditions, characters]);

  if (packs.length === 0) return null;

  function confirmRemove(pack: InstalledPack) {
    Alert.alert(
      'Remove Pack',
      `Remove "${pack.name}" and all ${pack.itemRefs.length} item${pack.itemRefs.length !== 1 ? 's' : ''} it installed? This can't be undone.`,
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
            <Pressable
              style={styles.libBtn}
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

function LibraryPanel() {
  const router = useRouter();
  const {
    races, subraces, classes, subclasses, spells, backgrounds, features, items, feats, monsters, conditions, deleteItem,
    getMergedContentDB,
  } = useHomebrewStore();
  const allRaces = getMergedContentDB().races;
  const allClasses = getMergedContentDB().classes;
  // Item 18 (homebrew improvements — reference usage): "Used by N" per row.
  const characters = useCharacterStore(s => s.characters);

  const [exportTarget, setExportTarget] = useState<{ type: ContentCacheType; item: HomebrewContent } | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [historyTarget, setHistoryTarget] = useState<{ type: ContentCacheType; item: HomebrewContent } | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<ContentCacheType | 'all'>('all');

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

  // Homebrew count only — drives the "no homebrew saved yet" messaging below.
  // Official conditions (isOfficial:true rows) are appended separately and
  // always present, so the panel is never truly empty once they're in it —
  // that's deliberate (A-46: conditions had no browse UI at all before this).
  const homebrewCount =
    races.length + subraces.length + classes.length + subclasses.length +
    items.length + spells.length + backgrounds.length + features.length +
    feats.length + monsters.length + conditions.length;

  const all = [
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
    // Bug fix (architecture review C11): this used to hand-concat homebrew
    // conditions AND the full official ALL_CONDITIONS catalog as two
    // separate pushes with no dedup — a homebrew condition overriding an
    // official one by id showed up as two rows instead of one. Use the
    // already-computed getMergedContentDB().conditions (in scope above,
    // already used for races/classes) — it dedups by id, homebrew wins,
    // matching the precedence used everywhere else. isOfficial is derived
    // per row by checking whether the WINNING entry actually came from the
    // homebrew store, preserving the exact same read-only-row gating below
    // (official conditions get no edit/history/export/delete affordances,
    // the same catalog the "Add Condition" apply-to-character flow uses).
    ...getMergedContentDB().conditions.map(c => ({
      type: 'condition' as const, item: c,
      isOfficial: !conditions.some(hb => hb.id === c.id),
    })),
  ];

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

  const filtered = all.filter(({ type, item }) => {
    if (categoryFilter !== 'all' && type !== categoryFilter) return false;
    if (search.trim() && !item.name.toLowerCase().includes(search.trim().toLowerCase())) return false;
    return true;
  });

  return (
    <View style={styles.panel}>
      <Text style={styles.panelTitle}>📚 Library ({all.length})</Text>
      {homebrewCount === 0 && (
        <Text style={styles.emptyTxt}>
          No homebrew content saved yet — create something above. The official Conditions
          reference below is always browsable.
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

      {filtered.length === 0 && (
        <Text style={styles.emptyTxt}>No homebrew matches your search or filter.</Text>
      )}

      {filtered.map(({ type, item, ...rest }) => {
        const editRoute = EDIT_ROUTES[type];
        const parentName = 'parentName' in rest ? rest.parentName : undefined;
        const isOfficial = 'isOfficial' in rest && rest.isOfficial === true;
        // Not shown for official rows — "used by" only means anything for
        // content the user actually owns/could change. contentUsedBy checks
        // typed fields (race/class/subclass/background/spell/item) plus an
        // untyped resolved-choice-selection fallback for everything else
        // (feature/feat/monster/condition), same conservative matching
        // diagnosePack's own pack-level check already uses.
        const usedBy = !isOfficial ? contentUsedBy(characters, type, item.id) : [];
        return (
          <View key={`${type}:${item.id}`} style={styles.libraryRow}>
            <View style={styles.libraryInfo}>
              <Text style={styles.libraryName}>
                {item.name}{parentName ? ` (${parentName})` : ''}
              </Text>
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
            {/* Official content is reference-only — no edit/history/export/delete,
                same rule any homebrew-owned action already implicitly follows
                (these buttons only ever meant anything for a user's own content). */}
            {!isOfficial && (
            <View style={styles.libraryActions}>
              {editRoute && (
                <Pressable
                  style={styles.libBtn}
                  onPress={() => router.push(`${editRoute}?editId=${item.id}` as any)}
                >
                  <Text style={styles.libBtnTxt}>✏️</Text>
                </Pressable>
              )}
              <Pressable
                style={styles.libBtn}
                onPress={() => setHistoryTarget({ type, item })}
              >
                <Text style={styles.libBtnTxt}>🕐</Text>
              </Pressable>
              <Pressable
                style={styles.libBtn}
                disabled={exportingId === item.id}
                onPress={() => setExportTarget({ type, item })}
              >
                {exportingId === item.id
                  ? <ActivityIndicator size="small" color={Colors.textPrimary} />
                  : <Text style={styles.libBtnTxt}>📤</Text>}
              </Pressable>
              <Pressable
                style={styles.libBtn}
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
      })}

      <ExportFormatSheet
        visible={!!exportTarget}
        title={exportTarget ? `Export "${exportTarget.item.name}"` : ''}
        onSelect={handleExportFormat}
        onClose={() => setExportTarget(null)}
        showPackOption
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
  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Homebrew</Text>
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <InstalledPacksPanel />
        <CreatePanel />
        <LibraryPanel />
      </ScrollView>
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
  },
  title:  { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.gold },
  scroll: { flex: 1 },
  content:{ padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xxl },

  panel: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.md, gap: Spacing.sm,
  },
  panelTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  panelSub:   { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },

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
  libraryInfo:    { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  libraryName:    { fontSize: FontSize.md, color: Colors.textPrimary, fontWeight: FontWeight.bold, flex: 1 },
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
});
