// app/(tabs)/characters.tsx
// Character list — all saved characters. Tap to open sheet. Long press to delete.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, ScrollView, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { useCharacterStore } from '../../src/store/characterStore';
import { useCampaignStore } from '../../src/store/campaignStore';
import { Entity } from '../../src/engine/types';
import { Alert } from '../../src/utils/alert';
import { LoadingScreen } from '../../src/components/LoadingScreen';
import { EmptyState }    from '../../src/components/EmptyState';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../src/theme';

type SortMode = 'name' | 'date' | 'campaign';

function CharacterCard({
  character, campaignName, onPress, onLongPress,
}: {
  character: Entity; campaignName: string | null; onPress: () => void; onLongPress: () => void;
}) {
  const { identity, resources, derived } = character;
  const hpPercent = resources.hp.maximum > 0
    ? resources.hp.current / resources.hp.maximum
    : 1;
  const hpColor = hpPercent > 0.5 ? Colors.green : hpPercent > 0.25 ? Colors.gold : Colors.red;

  return (
    <Pressable style={styles.card} onPress={onPress} onLongPress={onLongPress}>
      <View style={styles.cardMain}>
        <Text style={styles.cardName}>{identity.name || 'Unnamed'}</Text>
        <Text style={styles.cardSub}>
          Level {identity.level}  ·  {identity.classId || '—'}  ·  {identity.raceId || '—'}
        </Text>
        {campaignName && (
          <View style={styles.campaignBadge}>
            <Text style={styles.campaignBadgeTxt}>🗺️ {campaignName}</Text>
          </View>
        )}

        <View style={styles.hpRow}>
          <View style={styles.hpBarOuter}>
            <View style={[styles.hpBarFill, {
              width: `${Math.round(Math.max(0, Math.min(1, hpPercent)) * 100)}%` as any,
              backgroundColor: hpColor,
            }]} />
          </View>
          <Text style={styles.hpText}>{resources.hp.current}/{resources.hp.maximum} HP</Text>
        </View>
      </View>

      <View style={styles.cardBadges}>
        <View style={styles.badge}>
          <Text style={styles.badgeLabel}>AC</Text>
          <Text style={styles.badgeValue}>{derived.ac}</Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeLabel}>Spd</Text>
          <Text style={styles.badgeValue}>{derived.speed}</Text>
        </View>
      </View>
    </Pressable>
  );
}

export default function CharactersScreen() {
  const router           = useRouter();
  const characters       = useCharacterStore(s => s.characters);
  const characterMeta    = useCharacterStore(s => s.characterMeta);
  const loadCharactersMeta = useCharacterStore(s => s.loadCharactersMeta);
  const deleteCharacter   = useCharacterStore(s => s.deleteCharacter);
  const isLoading         = useCharacterStore(s => s.isLoading);
  const campaigns         = useCampaignStore(s => s.campaigns);

  const [sortMode, setSortMode]         = useState<SortMode>('name');
  const [raceFilter, setRaceFilter]     = useState<string | null>(null);
  const [classFilter, setClassFilter]   = useState<string | null>(null);
  const [campaignFilter, setCampaignFilter] = useState<string | null>(null);
  // Item 20 (QoL) — the two sibling tabs shipped this session (Homebrew,
  // Compendium) both have a free-text search box; this screen only ever
  // had sort/filter chips. Matches that established convention.
  const [search, setSearch] = useState('');
  // CHARACTERS-DROPDOWN-1: search/sort/filter default collapsed behind one
  // toggle instead of permanently occupying screen space — a pure UI
  // visibility flag, not part of visibleCharacters' own deps below, so
  // expanding/collapsing never recomputes the list. All the real state
  // above (search/sortMode/*Filter) is untouched by this toggle, so it
  // survives a collapse exactly as-is.
  const [panelOpen, setPanelOpen] = useState(false);

  // updatedAt for "sort by date" — characters (full Entity[]) doesn't carry
  // it, only the lightweight meta table does (native only; empty on web,
  // see loadAllEntityMeta's Platform guard — date sort silently no-ops
  // there rather than crashing).
  useEffect(() => { void loadCharactersMeta(); }, [loadCharactersMeta]);
  const updatedAtById = useMemo(
    () => new Map(characterMeta.map(m => [m.id, m.updatedAt])),
    [characterMeta],
  );

  // One character can only be in one campaign's roster at a time in
  // practice (Campaign.characterIds) — first match wins if that ever isn't true.
  const campaignByCharId = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of campaigns) for (const cid of c.characterIds) if (!map.has(cid)) map.set(cid, c.name);
    return map;
  }, [campaigns]);

  const raceOptions = useMemo(
    () => Array.from(new Set(characters.map(c => c.identity.raceId).filter(Boolean))).sort(),
    [characters],
  );
  const classOptions = useMemo(
    () => Array.from(new Set(characters.map(c => c.identity.classId).filter(Boolean))).sort(),
    [characters],
  );
  const campaignOptions = useMemo(
    () => Array.from(new Set(campaignByCharId.values())).sort(),
    [campaignByCharId],
  );

  const visibleCharacters = useMemo(() => {
    let list = characters;
    const q = search.trim().toLowerCase();
    if (q) list = list.filter(c => (c.identity.name || 'unnamed').toLowerCase().includes(q));
    if (raceFilter)     list = list.filter(c => c.identity.raceId === raceFilter);
    if (classFilter)    list = list.filter(c => c.identity.classId === classFilter);
    if (campaignFilter) list = list.filter(c => campaignByCharId.get(c.id) === campaignFilter);

    const sorted = [...list];
    if (sortMode === 'name') {
      sorted.sort((a, b) => (a.identity.name || 'Unnamed').localeCompare(b.identity.name || 'Unnamed'));
    } else if (sortMode === 'date') {
      sorted.sort((a, b) => (updatedAtById.get(b.id) ?? 0) - (updatedAtById.get(a.id) ?? 0));
    } else if (sortMode === 'campaign') {
      sorted.sort((a, b) => (campaignByCharId.get(a.id) ?? '￿').localeCompare(campaignByCharId.get(b.id) ?? '￿'));
    }
    return sorted;
  }, [characters, search, raceFilter, classFilter, campaignFilter, sortMode, updatedAtById, campaignByCharId]);

  const activeFilterCount = (raceFilter ? 1 : 0) + (classFilter ? 1 : 0) + (campaignFilter ? 1 : 0);
  const sortLabel = sortMode === 'name' ? 'Name' : sortMode === 'date' ? 'Date' : 'Campaign';

  const openSheet = useCallback((id: string) => {
    router.push(`/sheet/${id}` as any);
  }, [router]);

  // Re-audit A09 (item 11): a persisted draft can exist here (restored on
  // boot, or just never finished this session) — jumping straight to
  // Name would silently orphan it once name.tsx starts editing THIS
  // existing draft in place rather than minting a new one. Offer the
  // choice instead of guessing, same confirm-dialog pattern
  // CreationHeader.tsx's Cancel button already uses.
  const startCreation = useCallback(() => {
    const draft = useCharacterStore.getState().draft;
    if (draft) {
      Alert.alert(
        'Resume character creation?',
        `You have an unfinished character${draft.identity.name ? ` ("${draft.identity.name}")` : ''}. Continue where you left off, or start a new one?`,
        [
          { text: 'Resume', onPress: () => router.push('/creation/hub') },
          {
            text: 'Start New', style: 'destructive',
            onPress: () => { useCharacterStore.getState().clearDraft(); router.push('/creation/name'); },
          },
        ]
      );
      return;
    }
    router.push('/creation/name');
  }, [router]);

  const handleLongPress = useCallback((character: Entity) => {
    Alert.alert(
      `Delete "${character.identity.name || 'Unnamed'}"?`,
      'This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteCharacter(character.id),
        },
      ]
    );
  }, [deleteCharacter]);



  if (isLoading) return <LoadingScreen message="Loading characters…" />;

  return (
    <View style={styles.screen} testID="characters-screen">
      <View style={styles.header}>
        <Text style={styles.title}>Characters</Text>
        <View style={styles.headerActions}>
          <Pressable style={styles.settingsBtn} onPress={() => router.push('/settings' as any)}>
            <Text style={styles.settingsBtnText}>⚙️</Text>
          </Pressable>
          <Pressable testID="import-character" accessibilityRole="button" accessibilityLabel="Import Character" style={styles.importBtn} onPress={() => router.push('/import-character')}>
            <Text style={styles.importBtnText}>⇩ Import</Text>
          </Pressable>
          <Pressable testID="create-character" accessibilityRole="button" accessibilityLabel="Create Character" style={styles.newBtn} onPress={startCreation}>
            <Text style={styles.newBtnText}>+ New</Text>
          </Pressable>
        </View>
      </View>

      {characters.length === 0 ? (
        <EmptyState
          icon="👤"
          title="No characters yet"
          subtitle='Tap "+ New" to begin your adventure'
          actionLabel="+ Create Character"
          onAction={startCreation}
        />
      ) : (
        <>
          <Pressable style={styles.collapsedBar} onPress={() => setPanelOpen(o => !o)}>
            <Text style={styles.collapsedLabel}>{panelOpen ? '▲' : '▼'} Search &amp; Filter</Text>
            <View style={styles.collapsedChips}>
              {search.trim() !== '' && (
                <View style={styles.summaryChip}>
                  <Text style={styles.summaryChipTxt} numberOfLines={1}>Search: "{search.trim()}"</Text>
                </View>
              )}
              {activeFilterCount > 0 && (
                <View style={styles.summaryChip}>
                  <Text style={styles.summaryChipTxt}>Filters: {activeFilterCount}</Text>
                </View>
              )}
              {sortMode !== 'name' && (
                <View style={styles.summaryChip}>
                  <Text style={styles.summaryChipTxt}>Sort: {sortLabel}</Text>
                </View>
              )}
            </View>
          </Pressable>

          {panelOpen && (
            <View style={styles.panel}>
              <View style={styles.searchWrap}>
                <TextInput
                  style={styles.searchInput}
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Search characters…"
                  placeholderTextColor={Colors.textDim}
                />
              </View>

              <View style={styles.sortFilterBar}>
                <Text style={styles.sortFilterLabel}>Sort</Text>
                <View style={styles.chipRow}>
                  {([['name', 'Name'], ['date', 'Date'], ['campaign', 'Campaign']] as [SortMode, string][]).map(([m, label]) => (
                    <Pressable key={m} style={[styles.chip, sortMode === m && styles.chipActive]} onPress={() => setSortMode(m)}>
                      <Text style={[styles.chipTxt, sortMode === m && styles.chipTxtActive]}>{label}</Text>
                    </Pressable>
                  ))}
                </View>

                {(raceOptions.length > 0 || classOptions.length > 0 || campaignOptions.length > 0) && (
                  <>
                    <Text style={[styles.sortFilterLabel, { marginTop: Spacing.xs }]}>Filter</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                      {raceOptions.map(r => (
                        <Pressable key={`race_${r}`} style={[styles.chip, raceFilter === r && styles.chipActive]}
                          onPress={() => setRaceFilter(f => f === r ? null : r)}>
                          <Text style={[styles.chipTxt, raceFilter === r && styles.chipTxtActive]}>{r}</Text>
                        </Pressable>
                      ))}
                      {classOptions.map(c => (
                        <Pressable key={`class_${c}`} style={[styles.chip, classFilter === c && styles.chipActive]}
                          onPress={() => setClassFilter(f => f === c ? null : c)}>
                          <Text style={[styles.chipTxt, classFilter === c && styles.chipTxtActive]}>{c}</Text>
                        </Pressable>
                      ))}
                      {campaignOptions.map(camp => (
                        <Pressable key={`camp_${camp}`} style={[styles.chip, campaignFilter === camp && styles.chipActive]}
                          onPress={() => setCampaignFilter(f => f === camp ? null : camp)}>
                          <Text style={[styles.chipTxt, campaignFilter === camp && styles.chipTxtActive]}>🗺️ {camp}</Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </>
                )}
              </View>
            </View>
          )}

          <FlatList
            data={visibleCharacters}
            keyExtractor={c => c.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <CharacterCard
                character={item}
                campaignName={campaignByCharId.get(item.id) ?? null}
                onPress={() => openSheet(item.id)}
                onLongPress={() => handleLongPress(item)}
              />
            )}
            ListEmptyComponent={
              <Text style={styles.noResultsTxt}>No characters match your search/filters.</Text>
            }
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },

  header: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: Spacing.md,
    paddingTop:        Spacing.xl + 8,
    paddingBottom:     Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title:      { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.gold },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  settingsBtn:     { padding: Spacing.sm },
  settingsBtnText: { fontSize: 20 },
  importBtn: { borderWidth: 1, borderColor: Colors.gold, borderRadius: Radius.md, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm },
  importBtnText: { color: Colors.gold, fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  newBtn: {
    backgroundColor: Colors.gold,
    paddingHorizontal: Spacing.md,
    paddingVertical:   Spacing.sm,
    borderRadius:      Radius.md,
  },

  collapsedBar: {
    flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: Spacing.xs,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  collapsedLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  collapsedChips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, flexShrink: 1 },
  summaryChip: {
    backgroundColor: Colors.gold + '22', borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.gold + '66',
    paddingHorizontal: Spacing.sm, paddingVertical: 2,
  },
  summaryChipTxt: { fontSize: FontSize.xs, color: Colors.gold, fontWeight: FontWeight.bold },
  panel: {},

  searchWrap: { paddingHorizontal: Spacing.md, paddingTop: Spacing.sm },
  searchInput: {
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.sm, paddingVertical: 8, color: Colors.textPrimary,
  },

  sortFilterBar: {
    paddingHorizontal: Spacing.md,
    paddingTop:      Spacing.sm,
    paddingBottom:   Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 4,
  },
  sortFilterLabel: {
    fontSize: FontSize.xs, color: Colors.textDim, fontWeight: FontWeight.bold,
    letterSpacing: 1, textTransform: 'uppercase',
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  chip: {
    backgroundColor: Colors.surface, borderRadius: Radius.full, borderWidth: 1,
    borderColor: Colors.border, paddingHorizontal: Spacing.sm, paddingVertical: 4,
  },
  chipActive: { borderColor: Colors.gold, backgroundColor: Colors.gold + '22' },
  chipTxt:    { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: FontWeight.bold },
  chipTxtActive: { color: Colors.gold },

  campaignBadge: { alignSelf: 'flex-start', marginTop: 2 },
  campaignBadgeTxt: { fontSize: FontSize.xs, color: Colors.gold },
  newBtnText: { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.md },

  list: { padding: Spacing.md, gap: Spacing.sm },
  noResultsTxt: { color: Colors.textDim, fontSize: FontSize.sm, fontStyle: 'italic', textAlign: 'center', padding: Spacing.lg },

  card: {
    backgroundColor: Colors.surface,
    borderRadius:    Radius.lg,
    borderWidth:     1,
    borderColor:     Colors.border,
    padding:         Spacing.md,
    flexDirection:   'row',
    alignItems:      'center',
    gap:             Spacing.md,
  },
  cardMain: { flex: 1, gap: 4 },
  cardName: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  cardSub:  { fontSize: FontSize.sm, color: Colors.textSecondary },

  hpRow:    { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: 4 },
  hpBarOuter: {
    flex: 1, height: 4, backgroundColor: Colors.border,
    borderRadius: Radius.full, overflow: 'hidden',
  },
  hpBarFill: { height: '100%', borderRadius: Radius.full },
  hpText:    { fontSize: FontSize.xs, color: Colors.textSecondary },

  cardBadges: { gap: Spacing.xs },
  badge: {
    backgroundColor: Colors.surfaceHigh,
    borderRadius:    Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical:   2,
    alignItems:      'center',
    minWidth:        44,
  },
  badgeLabel: { fontSize: FontSize.xs, color: Colors.textSecondary },
  badgeValue: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },

  empty: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    gap: Spacing.sm, padding: Spacing.xl,
  },
  emptyIcon:  { fontSize: 64 },
  emptyTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  emptySub:   { fontSize: FontSize.md, color: Colors.textSecondary, textAlign: 'center' },
  emptyBtn: {
    marginTop:       Spacing.md,
    backgroundColor: Colors.gold,
    borderRadius:    Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical:   Spacing.md,
  },
  emptyBtnText: { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.md },
});
