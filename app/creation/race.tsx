// app/creation/race.tsx
// Race list — tap row to navigate to detail, long-press chevron to expand description.
import { View, Text, FlatList, Pressable, StyleSheet, TextInput } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { globalContentDB } from '../../src/content/classes/library';
import { useHomebrewStore } from '../../src/store/homebrewStore';
import { NonSrdBadge, isNonSrd } from '../../src/components/NonSrdBadge';
import { FilterChipRow, MultiSelectChipRow, FilterSection, OfficialHomebrewChipRow, ActiveFilterChips } from '../../src/components/FilterChipRow';
import {
  RACE_SIZE_ORDER, RACE_MOVEMENT_TYPES, hasDarkvision, raceMovementTypes, hasSubraces, raceSortOptions,
} from '../../src/content/races/raceBrowse';
import { sortByOption } from '../../src/content/contentQuery';
import { SortControl } from '../../src/components/SortControl';
import { useBrowseStateStore } from '../../src/store/browseStateStore';
import { usePendingSelectionStore } from '../../src/store/pendingSelectionStore';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../src/theme';

const SCREEN_KEY = 'race_picker';

const RACE_DESCRIPTIONS: Record<string, string> = {
  human:      'Humans are the most adaptable and ambitious people among the common races. +1 to all ability scores, one extra language, one extra skill.',
  elf:        'Elves are a magical people of otherworldly grace. DEX +2, INT +1. Darkvision 60 ft. Advantage on saves vs charm, immune to magical sleep.',
  dwarf:      'Bold and hardy, dwarves are known for skilled warriors and smiths. CON +2. Darkvision 60 ft. Resistance to poison. Speed 25 ft, not reduced by heavy armor.',
  halfling:   "The comforts of home are the goals of most halflings' lives. DEX +2. Lucky — reroll 1s. Brave — advantage vs fear. Speed 25 ft.",
  dragonborn: 'Born of dragons, dragonborn walk proudly through a world. STR +2, CHA +1. Breath weapon based on draconic ancestry. Resistance to that damage type.',
  gnome:      "A gnome's energy and enthusiasm for living shines through. INT +2. Darkvision 60 ft. Advantage on INT/WIS/CHA saves vs magic. Speed 25 ft.",
  half_elf:   'Half-elves combine the best of both human and elf heritage. CHA +2, +1 to two other stats. Darkvision 60 ft. Two extra skill proficiencies.',
  half_orc:   "Half-orcs' orcish blood gives them a resilient nature. STR +2, CON +1. Darkvision 60 ft. Relentless Endurance. Savage Attacks on crits.",
  tiefling:   'Tieflings are derived from humans who made a deal with devils. INT +1, CHA +2. Darkvision 60 ft. Resistance to fire. Hellish Rebuke and Darkness spells.',
};

// COMPENDIUM-1: SIZE_ORDER/hasDarkvision/raceMovementTypes moved to
// src/content/races/raceBrowse.ts (imported above) so the Compendium's
// Race browser shares the exact same derivation, not a second copy.
const SIZE_ORDER = RACE_SIZE_ORDER;

export default function RaceScreen() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  // BROWSE-STATE-1: restore search/filters/sort saved before navigating away
  // (e.g. into "+ Create new homebrew race") — session-local, see
  // browseStateStore.ts's header comment.
  const saved = useBrowseStateStore.getState().getBrowseState(SCREEN_KEY);
  const setBrowseState = useBrowseStateStore(s => s.setBrowseState);
  const savedFilters = saved.filters ?? {};
  const [search,   setSearch]   = useState(saved.search ?? '');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [sizeFilter, setSizeFilter] = useState<string | null>((savedFilters.sizeFilter as string) ?? null);
  const [darkvisionOnly, setDarkvisionOnly] = useState(!!savedFilters.darkvisionOnly);
  const [movementFilter, setMovementFilter] = useState<Set<string>>(new Set((savedFilters.movementFilter as string[]) ?? []));
  const [rulesetFilter, setRulesetFilter] = useState<string | null>((savedFilters.rulesetFilter as string) ?? null);
  const [officialFilter, setOfficialFilter] = useState<'all' | 'official' | 'homebrew'>((savedFilters.officialFilter as 'all' | 'official' | 'homebrew') ?? 'all');
  const [hasSubracesOnly, setHasSubracesOnly] = useState(!!savedFilters.hasSubracesOnly);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sort, setSort] = useState(saved.sort ?? 'name_asc');
  useEffect(() => {
    setBrowseState(SCREEN_KEY, {
      search, sort,
      filters: { sizeFilter, darkvisionOnly, movementFilter: Array.from(movementFilter), rulesetFilter, officialFilter, hasSubracesOnly },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, sort, sizeFilter, darkvisionOnly, movementFilter, rulesetFilter, officialFilter, hasSubracesOnly]);
  const homebrewRaces = useHomebrewStore(s => s.races);
  const sortOptions = raceSortOptions(r => homebrewRaces.some(hr => hr.id === r.id));

  // SAVE-AND-ADD-1: if we're returning from "+ Create new" having just
  // saved a homebrew race, go straight to that race's detail screen — the
  // same place tapping it in the list would take the player, so nothing
  // about the "select a race" flow silently forces or skips a choice.
  // useFocusEffect (not a plain useEffect keyed on homebrewRaces) is
  // required here: this screen stays MOUNTED but unfocused while the
  // builder is on top of it in the stack, and Zustand's homebrewStore
  // subscription doesn't care about focus — a plain effect fired the
  // instant the builder's saveItem() resolved (while still backgrounded),
  // racing against the builder's own goBack() and losing almost every
  // time (confirmed via live testing: the consume+navigate call landed,
  // but was immediately clobbered by the builder's back-navigation
  // completing a moment later). useFocusEffect defers this to the moment
  // the screen actually regains focus, after that race is long over.
  useFocusEffect(
    useCallback(() => {
      const newId = usePendingSelectionStore.getState().consumePending(SCREEN_KEY);
      if (newId) router.replace(`/creation/race-detail?id=${newId}`);
    }, [router])
  );

  // CREATION-FILTERS-1: real, present field only (Race.size is a closed
  // union) — sizes actually present in the official list, in standard
  // D&D size order rather than alphabetically.
  const availableSizes = SIZE_ORDER.filter(s => globalContentDB.races.some(r => r.size === s));
  const availableMovement = RACE_MOVEMENT_TYPES.filter(m => globalContentDB.races.some(r => raceMovementTypes(r).includes(m)))
    .map(m => ({ id: m, label: m[0].toUpperCase() + m.slice(1) }));
  // Ruleset — real field, sparsely populated app-wide (see FilterChipRow's
  // own <=1-option auto-hide) — lights up once ruleset-tagged races exist.
  const availableRulesets = Array.from(new Set(globalContentDB.races.map(r => r.rulesetId).filter((r): r is NonNullable<typeof r> => !!r)))
    .map(String).sort().map(r => ({ id: r, label: r }));

  const races = officialFilter === 'homebrew' ? [] : sortByOption(globalContentDB.races.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase()) &&
    (!sizeFilter || r.size === sizeFilter) &&
    (!darkvisionOnly || hasDarkvision(r)) &&
    (movementFilter.size === 0 || Array.from(movementFilter).some(m => raceMovementTypes(r).includes(m))) &&
    (!rulesetFilter || r.rulesetId === rulesetFilter) &&
    (!hasSubracesOnly || hasSubraces(r))
  ), sortOptions, sort);
  const filteredHomebrewRaces = officialFilter === 'official' ? [] : homebrewRaces.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase())
  );
  const activeFilterChips = [
    ...(sizeFilter ? [{ key: 'size', label: sizeFilter, onClear: () => setSizeFilter(null) }] : []),
    ...(darkvisionOnly ? [{ key: 'dv', label: 'Darkvision', onClear: () => setDarkvisionOnly(false) }] : []),
    ...Array.from(movementFilter).map(m => ({ key: `mv_${m}`, label: m, onClear: () => setMovementFilter(prev => { const n = new Set(prev); n.delete(m); return n; }) })),
    ...(rulesetFilter ? [{ key: 'ruleset', label: rulesetFilter, onClear: () => setRulesetFilter(null) }] : []),
    ...(officialFilter !== 'all' ? [{ key: 'official', label: officialFilter === 'official' ? 'Official' : 'Homebrew', onClear: () => setOfficialFilter('all') }] : []),
    ...(hasSubracesOnly ? [{ key: 'has_subraces', label: 'Has Subraces', onClear: () => setHasSubracesOnly(false) }] : []),
  ];
  function clearAllFilters() {
    setSizeFilter(null); setDarkvisionOnly(false); setMovementFilter(new Set());
    setRulesetFilter(null); setOfficialFilter('all'); setHasSubracesOnly(false);
  }

  return (
    <View style={styles.container}>

      <Text style={styles.heading}>Select Race</Text>
      <View style={styles.divider} />

      <View style={styles.searchRow}>
        <TextInput
          style={[styles.search, styles.searchFlex]}
          placeholder="Search"
          placeholderTextColor={Colors.textDim}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* PERF-SORT-1 (item 3): Filters + Sort share one row, pinned to
          opposite ends, consistent with every other browse screen. */}
      <View style={styles.controlsRow}>
        <Pressable
          style={[styles.darkvisionToggle, filtersOpen && styles.darkvisionToggleActive]}
          onPress={() => setFiltersOpen(v => !v)}
        >
          <Text style={[styles.darkvisionToggleTxt, filtersOpen && styles.darkvisionToggleTxtActive]}>Filters</Text>
        </Pressable>
        <SortControl options={sortOptions} value={sort} onChange={setSort} />
      </View>

      {filtersOpen && (
        <View style={styles.filterPanel}>
          <FilterSection label="Size">
            <FilterChipRow options={availableSizes.map(sz => ({ id: sz, label: sz }))} value={sizeFilter} onChange={setSizeFilter} />
          </FilterSection>
          <FilterSection label="Movement">
            <MultiSelectChipRow options={availableMovement} values={movementFilter} onChange={setMovementFilter} />
          </FilterSection>
          <FilterSection label="Ruleset">
            <FilterChipRow options={availableRulesets} value={rulesetFilter} onChange={setRulesetFilter} />
          </FilterSection>
          <FilterSection label="Official / Homebrew">
            <OfficialHomebrewChipRow value={officialFilter} onChange={setOfficialFilter} />
          </FilterSection>
          <Pressable
            style={[styles.darkvisionToggle, hasSubracesOnly && styles.darkvisionToggleActive, styles.darkvisionToggleInline]}
            onPress={() => setHasSubracesOnly(v => !v)}
          >
            <Text style={[styles.darkvisionToggleTxt, hasSubracesOnly && styles.darkvisionToggleTxtActive]}>
              {hasSubracesOnly ? '✓ ' : ''}Has Subraces / Variants
            </Text>
          </Pressable>
          <Pressable
            style={[styles.darkvisionToggle, darkvisionOnly && styles.darkvisionToggleActive, styles.darkvisionToggleInline]}
            onPress={() => setDarkvisionOnly(v => !v)}
          >
            <Text style={[styles.darkvisionToggleTxt, darkvisionOnly && styles.darkvisionToggleTxtActive]}>
              {darkvisionOnly ? '✓ ' : ''}Darkvision only
            </Text>
          </Pressable>
        </View>
      )}
      <ActiveFilterChips chips={activeFilterChips} onClearAll={clearAllFilters} />

      <FlatList
        data={races}
        keyExtractor={r => r.id}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + Spacing.xxl }]}
        renderItem={({ item }) => {
          const isOpen = expanded === item.id;
          const desc   = RACE_DESCRIPTIONS[item.id];
          return (
            <View style={styles.itemWrap}>
              {/* Primary tap → navigate to detail. Chevron tap → expand description. */}
              <Pressable
                style={styles.row}
                onPress={() => router.push(`/creation/race-detail?id=${item.id}`)}
              >
                <Text style={styles.rowName}>{item.name}</Text>
                {/* Distinguishes same-named ruleset variants (e.g. the
                    paused 5.5e proof-slice's "Human" alongside the classic
                    one) — non-production builds show every race unfiltered
                    regardless of ruleset, so without this they were
                    genuinely indistinguishable (audit finding
                    RULESET-DUP-1). */}
                {item.rulesetId && (
                  <View style={styles.rulesetTag}>
                    <Text style={styles.rulesetTagTxt}>{item.rulesetId}</Text>
                  </View>
                )}
                {isNonSrd(item.srd) && <NonSrdBadge />}
                <Pressable
                  hitSlop={12}
                  onPress={e => { e.stopPropagation(); setExpanded(isOpen ? null : item.id); }}
                >
                  <Text style={styles.rowCaret}>{isOpen ? '▲' : '▼'}</Text>
                </Pressable>
                <Text style={styles.rowArrow}>›</Text>
              </Pressable>

              {/* Inline dropdown description */}
              {isOpen && (
                <View style={styles.dropdown}>
                  {desc && <Text style={styles.dropdownDesc}>{desc}</Text>}
                  <Text style={styles.dropdownFeatures}>
                    Features: {item.features.map(f => f.name).join(', ') || 'None'}
                  </Text>
                </View>
              )}
            </View>
          );
        }}
        ListFooterComponent={
          <View style={styles.homebrewSection}>
            <View style={styles.homebrewHeader}>
              <Text style={styles.homebrewHeading}>HOMEBREW RACES</Text>
              <Pressable
                style={styles.createNewBtn}
                onPress={() => router.push('/homebrew/race-builder')}
              >
                <Text style={styles.createNewTxt}>+ Create new</Text>
              </Pressable>
            </View>
            {filteredHomebrewRaces.length === 0 ? (
              <Text style={styles.homebrewEmptyText}>No homebrew races yet.</Text>
            ) : (
              filteredHomebrewRaces.map(item => {
                const isOpen = expanded === item.id;
                return (
                  <View key={item.id} style={styles.itemWrap}>
                    <Pressable
                      style={styles.row}
                      onPress={() => router.push(`/creation/race-detail?id=${item.id}`)}
                    >
                      <Text style={styles.rowName}>{item.name}</Text>
                      <View style={styles.homebrewTag}>
                        <Text style={styles.homebrewTagTxt}>Homebrew</Text>
                      </View>
                      <Pressable
                        hitSlop={12}
                        onPress={e => { e.stopPropagation(); setExpanded(isOpen ? null : item.id); }}
                      >
                        <Text style={styles.rowCaret}>{isOpen ? '▲' : '▼'}</Text>
                      </Pressable>
                      <Text style={styles.rowArrow}>›</Text>
                    </Pressable>
                    {isOpen && (
                      <View style={styles.dropdown}>
                        <Text style={styles.dropdownFeatures}>
                          Features: {item.features.map(f => f.name).join(', ') || 'None'}
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  backBtn:   { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
  backBtnText: { fontSize: FontSize.md, color: Colors.gold, fontWeight: FontWeight.bold },
  heading: {
    fontSize: FontSize.xl, fontWeight: FontWeight.black,
    color: Colors.textPrimary, textAlign: 'center',
    paddingTop: Spacing.sm, paddingHorizontal: Spacing.lg,
  },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.md },
  search: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    fontSize: FontSize.md, color: Colors.textPrimary,
    marginHorizontal: Spacing.lg, marginBottom: Spacing.sm,
  },
  list: { paddingHorizontal: Spacing.lg },

  searchRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginHorizontal: Spacing.lg, marginBottom: Spacing.sm },
  controlsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: Spacing.xs, marginHorizontal: Spacing.lg, marginBottom: Spacing.sm },
  searchFlex: { flex: 1, marginHorizontal: 0, marginBottom: 0 },
  filterPanel: { marginBottom: Spacing.xs },

  darkvisionToggle: {
    alignSelf: 'flex-start', marginHorizontal: Spacing.lg, marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface,
  },
  darkvisionToggleInline: { marginHorizontal: Spacing.lg },
  darkvisionToggleActive: { backgroundColor: Colors.gold, borderColor: Colors.gold },
  darkvisionToggleTxt:    { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: FontWeight.bold },
  darkvisionToggleTxtActive: { color: Colors.bg },

  itemWrap: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: Spacing.md, gap: Spacing.sm,
  },
  rowName:  { fontSize: FontSize.md, color: Colors.textPrimary, flex: 1 },
  rowCaret: { fontSize: FontSize.sm, color: Colors.textDim, paddingHorizontal: 4 },
  rowArrow: { fontSize: FontSize.xl, color: Colors.textDim },

  dropdown: {
    backgroundColor: Colors.surfaceHigh, borderRadius: Radius.md,
    padding: Spacing.md, marginBottom: Spacing.sm,
  },
  dropdownDesc:     { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.xs, lineHeight: 20 },
  dropdownFeatures: { fontSize: FontSize.sm, color: Colors.textDim },

  homebrewSection: {
    marginTop: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  homebrewHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: Spacing.sm,
  },
  homebrewHeading: {
    fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.textDim,
    letterSpacing: 2,
  },
  createNewBtn: {
    backgroundColor: Colors.gold + '22', borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.gold + '66',
    paddingHorizontal: Spacing.sm, paddingVertical: 2,
  },
  createNewTxt: { fontSize: FontSize.xs, color: Colors.gold, fontWeight: FontWeight.bold },
  homebrewEmptyText: { fontSize: FontSize.sm, color: Colors.textDim, fontStyle: 'italic', paddingVertical: Spacing.sm },
  homebrewTag: {
    backgroundColor: Colors.gold + '22', borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.gold + '66',
    paddingHorizontal: Spacing.sm, paddingVertical: 2,
  },
  homebrewTagTxt: { fontSize: FontSize.xs, color: Colors.gold, fontWeight: FontWeight.bold },
  rulesetTag: {
    backgroundColor: Colors.textSecondary + '22', borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.textSecondary + '66',
    paddingHorizontal: Spacing.sm, paddingVertical: 2,
  },
  rulesetTagTxt: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: FontWeight.bold },
});
