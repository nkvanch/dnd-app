// app/creation/class.tsx
// Class list — tap row to navigate to detail, chevron to expand description.
import { View, Text, FlatList, Pressable, StyleSheet, TextInput } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { globalContentDB } from '../../src/content/classes/library';
import { useHomebrewStore } from '../../src/store/homebrewStore';
import { usePendingSelectionStore } from '../../src/store/pendingSelectionStore';
import { NonSrdBadge, isNonSrd } from '../../src/components/NonSrdBadge';
import { FilterChipRow, MultiSelectChipRow, FilterSection, OfficialHomebrewChipRow, ActiveFilterChips } from '../../src/components/FilterChipRow';
import { SortControl } from '../../src/components/SortControl';
import { CASTER_TYPE, CASTER_TYPES, classSortOptions } from '../../src/content/classes/classBrowse';
import { sortByOption } from '../../src/content/contentQuery';
import { Ability } from '../../src/engine/types';
import { useBrowseStateStore } from '../../src/store/browseStateStore';

const SCREEN_KEY = 'class_picker';

const ABILITY_LABELS: Record<Ability, string> = { str: 'STR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'WIS', cha: 'CHA' };
const ARMOR_LABELS: Record<string, string> = { light: 'Light', medium: 'Medium', heavy: 'Heavy', shield: 'Shield' };
const WEAPON_LABELS: Record<string, string> = { simple: 'Simple', martial: 'Martial' };
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../src/theme';

const CLASS_DESCRIPTIONS: Record<string, string> = {
  barbarian: 'A fierce warrior who can enter a battle rage to deal devastating damage and shrug off attacks. STR-based martial combatant. Hit Die: d12.',
  bard:      'An inspiring spellcaster who weaves magic through music and words. Skills, buffs, and versatile spells. Hit Die: d8.',
  cleric:    'A priestly champion who wields divine magic. Powerful healer with heavy-armor proficiency and a deity-based subclass. Hit Die: d8.',
  druid:     'A nature priest who can Wild Shape into beasts and wield nature-themed spells. Highly versatile. Hit Die: d8.',
  fighter:   'A master of martial combat skilled with all weapons and armor. Action Surge and multiple attacks make fighters powerful damage dealers. Hit Die: d10.',
  monk:      'A martial artist who channels ki energy for speed, stunning strikes, and wall-running. Unarmored agility. Hit Die: d8.',
  paladin:   'A holy warrior bound to a sacred oath. Divine Smite delivers burst damage; lay on hands provides healing. Hit Die: d10.',
  ranger:    'A wilderness warrior with a favored enemy and natural explorer features. Mix of martial prowess and spellcasting. Hit Die: d10.',
  rogue:     'A stealthy trickster who deals Sneak Attack damage and excels at skills. Cunning Action grants bonus-action mobility. Hit Die: d8.',
  sorcerer:  'An innate spellcaster powered by bloodline magic. Metamagic lets you shape spells in unique ways. Fewer spell slots than wizard. Hit Die: d6.',
  warlock:   'A pact-magic spellcaster empowered by a patron. Short-rest spell slot recharge, Eldritch Invocations, and flexible Pact Boon. Hit Die: d8.',
  wizard:    'A scholarly spellcaster with the broadest spell list in the game. Arcane Recovery and spellbook give unmatched flexibility. Hit Die: d6.',
  artificer: "An inventor who infuses mundane objects with magic. INT-based half-caster that casts from level 1, with a specialist subclass (Armorer, Alchemist, Artillerist, or Battle Smith) chosen at level 3. Hit Die: d8.",
};

export default function ClassScreen() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const saved = useBrowseStateStore.getState().getBrowseState(SCREEN_KEY);
  const setBrowseState = useBrowseStateStore(s => s.setBrowseState);
  const savedFilters = saved.filters ?? {};
  const [search,   setSearch]   = useState(saved.search ?? '');
  const [expanded, setExpanded] = useState<string | null>(null);
  // CREATION-FILTERS-1: Caster Type — real, already-computed data (the
  // CASTER_TYPE map above already backs the subtitle text on every row),
  // just not previously filterable. Homebrew classes have no reliable way
  // to derive caster type (no CASTER_TYPE entry, and unlike official
  // classes there's no guaranteed spellcastingStyle), so the filter only
  // applies to the official list — homebrew stays unfiltered below,
  // consistent with not fabricating a caster-type guess for content that
  // doesn't declare one.
  const [casterFilter, setCasterFilter] = useState<typeof CASTER_TYPES[number] | null>((savedFilters.casterFilter as typeof CASTER_TYPES[number]) ?? null);
  // CREATION-FILTERS-3: Hit Die — real, populated field on every official
  // CharClass (confirmed d6/d8/d10/d12 across all 13 entries).
  const [hitDieFilter, setHitDieFilter] = useState<number | null>((savedFilters.hitDieFilter as number) ?? null);
  // Ruleset — real field, sparsely populated app-wide (no official class
  // currently sets it) — the shared FilterChipRow auto-hides at <=1 option,
  // so this is a no-op today and lights up once ruleset-tagged classes exist.
  const [rulesetFilter, setRulesetFilter] = useState<string | null>((savedFilters.rulesetFilter as string) ?? null);
  const [officialFilter, setOfficialFilter] = useState<'all' | 'official' | 'homebrew'>((savedFilters.officialFilter as 'all' | 'official' | 'homebrew') ?? 'all');
  // FILTER-METADATA-1: real, now-populated fields on official CharClass
  // entries (src/content/classes/index.ts) — Saving-Throw/Armor/Weapon
  // Proficiency. Homebrew classes only get these when the class-builder set
  // them, so a homebrew class missing one simply never matches — same
  // "don't fabricate" rule already applied to Caster Type above.
  const [saveFilter, setSaveFilter] = useState<Set<Ability>>(new Set((savedFilters.saveFilter as Ability[]) ?? []));
  const [armorFilter, setArmorFilter] = useState<Set<string>>(new Set((savedFilters.armorFilter as string[]) ?? []));
  const [weaponFilter, setWeaponFilter] = useState<Set<string>>(new Set((savedFilters.weaponFilter as string[]) ?? []));
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sort, setSort] = useState(saved.sort ?? 'name_asc');
  useEffect(() => {
    setBrowseState(SCREEN_KEY, {
      search, sort,
      filters: {
        casterFilter, hitDieFilter, rulesetFilter, officialFilter,
        saveFilter: Array.from(saveFilter), armorFilter: Array.from(armorFilter), weaponFilter: Array.from(weaponFilter),
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, sort, casterFilter, hitDieFilter, rulesetFilter, officialFilter, saveFilter, armorFilter, weaponFilter]);

  // NESTED-HOMEBREW-1 / SAVE-AND-ADD-1: navigate straight to a homebrew
  // class's own detail screen once its builder saves and returns here —
  // same useFocusEffect pattern already proven for race.tsx/background.tsx
  // (a plain useEffect keyed on a Zustand-subscribed value fires the
  // instant the builder's save resolves, while this screen is still
  // backgrounded behind it, racing against and usually losing to the
  // builder's own goBack(); useFocusEffect only fires once this screen
  // genuinely regains focus, after that race is already over).
  useFocusEffect(
    useCallback(() => {
      const newId = usePendingSelectionStore.getState().consumePending('class_picker');
      if (newId) router.push(`/creation/class-detail?id=${newId}`);
    }, [router])
  );

  const homebrewClasses = useHomebrewStore(s => s.classes);
  const sortOptions = classSortOptions(c => homebrewClasses.some(hc => hc.id === c.id));

  const availableHitDice = Array.from(new Set(globalContentDB.classes.map(c => c.hitDie))).sort((a, b) => a - b);
  const availableRulesets = Array.from(new Set(globalContentDB.classes.map(c => c.rulesetId).filter((r): r is NonNullable<typeof r> => !!r)))
    .map(String).sort().map(r => ({ id: r, label: r }));
  const availableSaves = (Array.from(new Set(globalContentDB.classes.flatMap(c => c.savingThrows ?? []))) as Ability[])
    .map(a => ({ id: a, label: ABILITY_LABELS[a] }));
  const availableArmor = Array.from(new Set(globalContentDB.classes.flatMap(c => c.armorProfs ?? [])))
    .map(a => ({ id: a, label: ARMOR_LABELS[a] ?? a }));
  const availableWeapons = Array.from(new Set(globalContentDB.classes.flatMap(c => c.weaponProfs ?? [])))
    .map(w => ({ id: w, label: WEAPON_LABELS[w] ?? w }));

  const classes = officialFilter === 'homebrew' ? [] : sortByOption(globalContentDB.classes.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) &&
    (!casterFilter || (CASTER_TYPE[c.id] ?? 'Martial') === casterFilter) &&
    (!hitDieFilter || c.hitDie === hitDieFilter) &&
    (!rulesetFilter || c.rulesetId === rulesetFilter) &&
    (saveFilter.size === 0 || Array.from(saveFilter).some(a => c.savingThrows?.includes(a))) &&
    (armorFilter.size === 0 || Array.from(armorFilter).some(a => c.armorProfs?.includes(a))) &&
    (weaponFilter.size === 0 || Array.from(weaponFilter).some(w => c.weaponProfs?.includes(w)))
  ), sortOptions, sort);
  const filteredHomebrewClasses = officialFilter === 'official' ? [] : homebrewClasses.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );
  const activeFilterChips = [
    ...(casterFilter ? [{ key: 'caster', label: casterFilter, onClear: () => setCasterFilter(null) }] : []),
    ...(hitDieFilter ? [{ key: 'hd', label: `d${hitDieFilter}`, onClear: () => setHitDieFilter(null) }] : []),
    ...(rulesetFilter ? [{ key: 'ruleset', label: rulesetFilter, onClear: () => setRulesetFilter(null) }] : []),
    ...(officialFilter !== 'all' ? [{ key: 'official', label: officialFilter === 'official' ? 'Official' : 'Homebrew', onClear: () => setOfficialFilter('all') }] : []),
    ...Array.from(saveFilter).map(a => ({ key: `save_${a}`, label: `${ABILITY_LABELS[a]} save`, onClear: () => setSaveFilter(prev => { const n = new Set(prev); n.delete(a); return n; }) })),
    ...Array.from(armorFilter).map(a => ({ key: `armor_${a}`, label: `${ARMOR_LABELS[a] ?? a} armor`, onClear: () => setArmorFilter(prev => { const n = new Set(prev); n.delete(a); return n; }) })),
    ...Array.from(weaponFilter).map(w => ({ key: `weapon_${w}`, label: `${WEAPON_LABELS[w] ?? w} weapons`, onClear: () => setWeaponFilter(prev => { const n = new Set(prev); n.delete(w); return n; }) })),
  ];
  function clearAllFilters() {
    setCasterFilter(null); setHitDieFilter(null); setRulesetFilter(null); setOfficialFilter('all');
    setSaveFilter(new Set()); setArmorFilter(new Set()); setWeaponFilter(new Set());
  }

  return (
    <View style={styles.container}>

      <Text style={styles.heading}>Select Class</Text>
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

      <View style={styles.controlsRow}>
        <Pressable
          style={[styles.filtersToggle, filtersOpen && styles.filtersToggleActive]}
          onPress={() => setFiltersOpen(v => !v)}
        >
          <Text style={[styles.filtersToggleTxt, filtersOpen && styles.filtersToggleTxtActive]}>Filters</Text>
        </Pressable>
        <SortControl options={sortOptions} value={sort} onChange={setSort} />
      </View>

      {filtersOpen && (
        <View style={styles.filterPanel}>
          <FilterSection label="Caster Type">
            <FilterChipRow options={CASTER_TYPES.map(ct => ({ id: ct, label: ct }))} value={casterFilter} onChange={setCasterFilter} />
          </FilterSection>
          <FilterSection label="Hit Die">
            <FilterChipRow
              options={availableHitDice.map(d => ({ id: String(d), label: `d${d}` }))}
              value={hitDieFilter === null ? null : String(hitDieFilter)}
              onChange={v => setHitDieFilter(v === null ? null : Number(v))}
            />
          </FilterSection>
          <FilterSection label="Ruleset">
            <FilterChipRow options={availableRulesets} value={rulesetFilter} onChange={setRulesetFilter} />
          </FilterSection>
          <FilterSection label="Saving Throw Proficiency">
            <MultiSelectChipRow options={availableSaves} values={saveFilter} onChange={setSaveFilter} />
          </FilterSection>
          <FilterSection label="Armor Proficiency">
            <MultiSelectChipRow options={availableArmor} values={armorFilter} onChange={setArmorFilter} />
          </FilterSection>
          <FilterSection label="Weapon Proficiency">
            <MultiSelectChipRow options={availableWeapons} values={weaponFilter} onChange={setWeaponFilter} />
          </FilterSection>
          <FilterSection label="Official / Homebrew">
            <OfficialHomebrewChipRow value={officialFilter} onChange={setOfficialFilter} />
          </FilterSection>
        </View>
      )}
      <ActiveFilterChips chips={activeFilterChips} onClearAll={clearAllFilters} />

      <FlatList
        data={classes}
        keyExtractor={c => c.id}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + Spacing.xxl }]}
        renderItem={({ item }) => {
          const isOpen    = expanded === item.id;
          const desc      = CLASS_DESCRIPTIONS[item.id];
          const casterType = CASTER_TYPE[item.id] ?? 'Martial';
          return (
            <View style={styles.itemWrap}>
              {/* Primary tap → navigate to detail. Chevron tap → expand description. */}
              <Pressable
                style={styles.row}
                onPress={() => router.push(`/creation/class-detail?id=${item.id}`)}
              >
                <View style={styles.rowInfo}>
                  <View style={styles.rowNameLine}>
                    <Text style={styles.rowName}>{item.name}</Text>
                    {isNonSrd(item.srd) && <NonSrdBadge />}
                  </View>
                  <Text style={styles.rowSub}>{casterType} · d{item.hitDie}</Text>
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
                  {desc && <Text style={styles.dropdownDesc}>{desc}</Text>}
                </View>
              )}
            </View>
          );
        }}
        ListFooterComponent={
          <View style={styles.homebrewSection}>
            <View style={styles.homebrewHeader}>
              <Text style={styles.homebrewHeading}>HOMEBREW CLASSES</Text>
              <Pressable
                style={styles.createNewBtn}
                onPress={() => router.push('/homebrew/class-builder')}
              >
                <Text style={styles.createNewTxt}>+ Create new</Text>
              </Pressable>
            </View>
            {filteredHomebrewClasses.length === 0 ? (
              <Text style={styles.homebrewEmptyText}>No homebrew classes yet.</Text>
            ) : (
              filteredHomebrewClasses.map(item => {
                const isOpen = expanded === item.id;
                return (
                  <View key={item.id} style={styles.itemWrap}>
                    <Pressable
                      style={styles.row}
                      onPress={() => router.push(`/creation/class-detail?id=${item.id}`)}
                    >
                      <View style={styles.rowInfo}>
                        <Text style={styles.rowName}>{item.name}</Text>
                        <Text style={styles.rowSub}>Homebrew · d{item.hitDie}</Text>
                      </View>
                      <View style={styles.homebrewTag}>
                        <Text style={styles.homebrewTagTxt}>Homebrew</Text>
                      </View>
                      {item.description && (
                        <Pressable
                          hitSlop={12}
                          onPress={e => { e.stopPropagation(); setExpanded(isOpen ? null : item.id); }}
                        >
                          <Text style={styles.rowCaret}>{isOpen ? '▲' : '▼'}</Text>
                        </Pressable>
                      )}
                      <Text style={styles.rowArrow}>›</Text>
                    </Pressable>
                    {isOpen && item.description && (
                      <View style={styles.dropdown}>
                        <Text style={styles.dropdownDesc}>{item.description}</Text>
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
  filtersToggle: {
    borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.surface, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm,
  },
  filtersToggleActive:  { borderColor: Colors.gold, backgroundColor: Colors.gold + '22' },
  filtersToggleTxt:     { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: FontWeight.bold },
  filtersToggleTxtActive: { color: Colors.gold },
  filterPanel: { marginBottom: Spacing.xs },

  itemWrap: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: Spacing.md, gap: Spacing.sm,
  },
  rowInfo:  { flex: 1 },
  rowNameLine: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  rowName:  { fontSize: FontSize.md, color: Colors.textPrimary },
  rowSub:   { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  rowCaret: { fontSize: FontSize.sm, color: Colors.textDim, paddingHorizontal: 4 },
  rowArrow: { fontSize: FontSize.xl, color: Colors.textDim },

  dropdown: {
    backgroundColor: Colors.surfaceHigh, borderRadius: Radius.md,
    padding: Spacing.md, marginBottom: Spacing.sm,
  },
  dropdownDesc: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },

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
});
