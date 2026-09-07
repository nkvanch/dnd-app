// app/homebrew/rare-items.tsx
// Rare/uncommon item browser — a dedicated, rarity-filtered view over the
// SAME item catalog (official + homebrew) TabInventory's Add Item modal
// already searches. Not a separate content source: pulls itemRepo.getIndex()
// (official, Tier 1) + useHomebrewStore's items (homebrew, full records —
// only homebrew items ever carry a photo, see Item.imageUri) and filters to
// anything tagged with a magic-item rarity in its properties, the same
// convention item-builder.tsx already writes rarity into.
import { useMemo, useState } from 'react';
import { View, Text, ScrollView, FlatList, Pressable, StyleSheet, TextInput, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Item } from '../../src/engine/types';
import { itemRepo } from '../../src/content/itemRepo';
import { toItemIndexEntry } from '../../src/content/itemRepo.types';
import type { ItemIndexEntry } from '../../src/content/itemRepo.types';
import { useHomebrewStore } from '../../src/store/homebrewStore';
import { useSafeGoBack } from '../../src/hooks/useSafeGoBack';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../src/theme';

const RARITIES = ['uncommon', 'rare', 'very rare', 'legendary', 'artifact'];

function rarityOf(properties: string[]): string | null {
  const lower = properties.map(p => p.toLowerCase());
  return RARITIES.find(r => lower.includes(r)) ?? null;
}
function rarityRank(r: string | null): number {
  return r ? RARITIES.indexOf(r) : -1;
}

function RareItemRow({ entry, rarity, homebrewItem, onEdit }: {
  entry: ItemIndexEntry;
  rarity: string | null;
  homebrewItem: Item | null;
  onEdit: (() => void) | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const desc = homebrewItem?.features?.[0]?.description
    ?? (homebrewItem?.homebrewDraft?.description as string | undefined);

  return (
    <Pressable style={styles.row} onPress={() => setExpanded(e => !e)}>
      <View style={styles.rowMain}>
        {homebrewItem?.imageUri && (
          <Image source={{ uri: homebrewItem.imageUri }} style={styles.thumb} />
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.itemName}>{entry.name}</Text>
          <View style={styles.metaRow}>
            {rarity && (
              <View style={styles.rarityChip}>
                <Text style={styles.rarityChipTxt}>{rarity}</Text>
              </View>
            )}
            {entry.cost !== '-' && entry.cost && <Text style={styles.costTxt}>{entry.cost}</Text>}
          </View>
        </View>
        {onEdit && (
          <Pressable style={styles.editBtn} onPress={onEdit} hitSlop={8}>
            <Text style={styles.editBtnTxt}>✎</Text>
          </Pressable>
        )}
      </View>
      {expanded && (
        <View style={styles.expanded}>
          {entry.properties.length > 0 && (
            <Text style={styles.propsTxt}>{entry.properties.join(' · ')}</Text>
          )}
          {desc && <Text style={styles.descTxt}>{desc}</Text>}
        </View>
      )}
    </Pressable>
  );
}

export default function RareItemsScreen() {
  const goBack = useSafeGoBack('/(tabs)/homebrew');
  const router = useRouter();
  const homebrewItems = useHomebrewStore(s => s.items);
  const [search, setSearch] = useState('');
  const [rarityFilter, setRarityFilter] = useState<string | null>(null);

  const homebrewById = useMemo(() => new Map(homebrewItems.map(i => [i.id, i])), [homebrewItems]);

  const allEntries = useMemo(() => {
    const official = itemRepo.getIndex();
    const homebrew = homebrewItems.map(toItemIndexEntry);
    return [...official, ...homebrew];
  }, [homebrewItems]);

  // Rarity is computed once per entry here (was previously recomputed by
  // both the sort comparator and RareItemRow itself — redundant work
  // multiplied across every entry, meaningful once the official catalog's
  // ~600 rarity-tagged items are in play) and carried alongside each entry
  // rather than re-derived downstream.
  const rareEntries = useMemo(() => {
    const withRarity = allEntries
      .map(entry => ({ entry, rarity: rarityOf(entry.properties) }))
      .filter((x): x is { entry: ItemIndexEntry; rarity: string } => x.rarity !== null);
    let list = rarityFilter ? withRarity.filter(x => x.rarity === rarityFilter) : withRarity;
    const q = search.trim().toLowerCase();
    if (q) list = list.filter(x => x.entry.name.toLowerCase().includes(q));
    return [...list].sort((a, b) => {
      const rDiff = rarityRank(b.rarity) - rarityRank(a.rarity);
      return rDiff !== 0 ? rDiff : a.entry.name.localeCompare(b.entry.name);
    });
  }, [allEntries, rarityFilter, search]);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={goBack}>
          <Text style={styles.backTxt}>{'<- Back'}</Text>
        </Pressable>
        <Text style={styles.title}>Rare Items</Text>
        <Pressable style={styles.newBtn} onPress={() => router.push('/homebrew/item-builder' as any)}>
          <Text style={styles.newBtnTxt}>+ New</Text>
        </Pressable>
      </View>

      <View style={styles.filterBar}>
        <TextInput
          style={styles.search}
          value={search}
          onChangeText={setSearch}
          placeholder="Search rare items…"
          placeholderTextColor={Colors.textDim}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          <Pressable style={[styles.chip, rarityFilter === null && styles.chipActive]} onPress={() => setRarityFilter(null)}>
            <Text style={[styles.chipTxt, rarityFilter === null && styles.chipTxtActive]}>All</Text>
          </Pressable>
          {RARITIES.map(r => (
            <Pressable key={r} style={[styles.chip, rarityFilter === r && styles.chipActive]} onPress={() => setRarityFilter(r)}>
              <Text style={[styles.chipTxt, rarityFilter === r && styles.chipTxtActive]}>{r}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {rareEntries.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTxt}>No rare items match yet.</Text>
          <Text style={styles.emptySub}>
            Items show up here once tagged uncommon/rare/very rare/legendary/artifact
            — item-builder's Rarity picker does this automatically.
          </Text>
        </View>
      ) : (
        <FlatList
          data={rareEntries}
          keyExtractor={x => x.entry.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <RareItemRow
              entry={item.entry}
              rarity={item.rarity}
              homebrewItem={homebrewById.get(item.entry.id) ?? null}
              onEdit={homebrewById.has(item.entry.id)
                ? () => router.push({ pathname: '/homebrew/item-builder', params: { editId: item.entry.id } } as any)
                : null}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: Colors.bg },
  header:  {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.surfaceHigh, paddingTop: Spacing.xl + 8, paddingBottom: Spacing.md,
    paddingHorizontal: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: {},
  backTxt: { color: Colors.gold, fontSize: FontSize.md, fontWeight: FontWeight.bold },
  title:   { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  newBtn:  { backgroundColor: Colors.gold, borderRadius: Radius.md, paddingHorizontal: Spacing.sm, paddingVertical: 6 },
  newBtnTxt: { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.sm },

  filterBar: { padding: Spacing.md, gap: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  search: {
    backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.sm, color: Colors.textPrimary, fontSize: FontSize.md,
  },
  chipRow: { gap: Spacing.xs },
  chip: {
    backgroundColor: Colors.surface, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.sm, paddingVertical: 4,
  },
  chipActive: { borderColor: Colors.gold, backgroundColor: Colors.gold + '22' },
  chipTxt:    { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: FontWeight.bold },
  chipTxtActive: { color: Colors.gold },

  list: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: Spacing.xxl },

  row: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.sm,
  },
  rowMain: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  thumb:   { width: 44, height: 44, borderRadius: Radius.sm, backgroundColor: Colors.surfaceHigh },
  itemName: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: 2 },
  rarityChip: {
    backgroundColor: Colors.purple + '22', borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.purple + '55',
    paddingHorizontal: Spacing.sm, paddingVertical: 1,
  },
  rarityChipTxt: { fontSize: FontSize.xs, color: Colors.purple, fontWeight: FontWeight.bold, textTransform: 'capitalize' },
  costTxt: { fontSize: FontSize.xs, color: Colors.gold },
  editBtn: { padding: Spacing.xs },
  editBtnTxt: { fontSize: FontSize.md, color: Colors.gold },

  expanded: { marginTop: Spacing.sm, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border, gap: 4 },
  propsTxt: { fontSize: FontSize.xs, color: Colors.textDim },
  descTxt:  { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 19 },

  empty:    { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl, gap: Spacing.xs },
  emptyTxt: { fontSize: FontSize.md, color: Colors.textSecondary, fontWeight: FontWeight.bold },
  emptySub: { fontSize: FontSize.sm, color: Colors.textDim, textAlign: 'center' },
});
