// app/(tabs)/homebrew.tsx
// Homebrew tab — Create and Library sections.
import { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { useHomebrewStore } from '../../src/store/homebrewStore';
import { Alert } from '../../src/utils/alert';
import { ContentCacheType, HomebrewContent } from '../../src/db/contentCacheRepo';
import { exportHomebrewItem, ExportFormat, ExportAction } from '../../src/io/exportShare';
import { ExportFormatSheet } from '../../src/components/ExportFormatSheet';
import { VersionHistoryModal } from '../../src/components/homebrew/VersionHistoryModal';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../src/theme';

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
    races, subraces, classes, subclasses, spells, backgrounds, features, items, feats, monsters, deleteItem,
    getMergedContentDB,
  } = useHomebrewStore();
  const allRaces = getMergedContentDB().races;
  const allClasses = getMergedContentDB().classes;

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
  };

  if (all.length === 0) {
    return (
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>📚 Library</Text>
        <Text style={styles.emptyTxt}>No homebrew content saved yet. Create something above.</Text>
      </View>
    );
  }

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
  ];

  const filtered = all.filter(({ type, item }) => {
    if (categoryFilter !== 'all' && type !== categoryFilter) return false;
    if (search.trim() && !item.name.toLowerCase().includes(search.trim().toLowerCase())) return false;
    return true;
  });

  return (
    <View style={styles.panel}>
      <Text style={styles.panelTitle}>📚 Library ({all.length})</Text>

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
        return (
          <View key={`${type}:${item.id}`} style={styles.libraryRow}>
            <View style={styles.libraryInfo}>
              <Text style={styles.libraryName}>
                {item.name}{parentName ? ` (${parentName})` : ''}
              </Text>
              <View style={[styles.typeBadge, styles[`typeBadge_${type}`] ?? {}]}>
                <Text style={styles.typeBadgeTxt}>{type}</Text>
              </View>
            </View>
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
  libraryActions: { flexDirection: 'row', gap: Spacing.xs },
  libBtn: {
    backgroundColor: Colors.surfaceHigh, borderRadius: Radius.sm,
    padding: Spacing.xs, borderWidth: 1, borderColor: Colors.border,
  },
  libBtnTxt:  { fontSize: FontSize.md },
  emptyTxt:   { color: Colors.textDim, fontStyle: 'italic', fontSize: FontSize.sm },
});
