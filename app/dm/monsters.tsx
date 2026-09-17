// app/dm/monsters.tsx
// Monster library — browse SRD monsters, preview stat blocks, spawn into encounter.
import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, FlatList, Pressable, StyleSheet,
  TextInput, Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useCombatStore }   from '../../src/store/combatStore';
import { useCharacterStore } from '../../src/store/characterStore';
import { useHomebrewStore } from '../../src/store/homebrewStore';
import { spawnMonster }     from '../../src/engine/monsterFactory';
import { MonsterTemplate }  from '../../src/content/monsters/types';
import { mergeMonsterIndex } from '../../src/content/contentResolution';
import { useSafeGoBack } from '../../src/hooks/useSafeGoBack';
import { NonSrdBadge, isNonSrd } from '../../src/components/NonSrdBadge';
import { FilterChipRow, MultiSelectChipRow, FilterSection, OfficialHomebrewChipRow } from '../../src/components/FilterChipRow';
import {
  MONSTER_SIZE_ORDER, MONSTER_MOVEMENT_TYPES, monsterMovementTypes, monsterResistances,
  monsterImmunities, monsterConditionImmunities, monsterHasDarkvision, monsterIsSpellcaster, crLabel,
  monsterSortOptions,
} from '../../src/content/monsters/monsterBrowse';
import { sortByOption } from '../../src/content/contentQuery';
import { SortControl } from '../../src/components/SortControl';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../src/theme';
import { useBrowseStateStore } from '../../src/store/browseStateStore';

const SCREEN_KEY = 'monster_library';

const monsterKeyExtractor = (t: MonsterTemplate) => t.id;
// COMPENDIUM-1: SIZE_ORDER/MOVEMENT_TYPES/the derivation helpers below moved
// to src/content/monsters/monsterBrowse.ts so the Compendium's Monster
// browser shares the exact same logic, not a second copy.
const SIZE_ORDER = MONSTER_SIZE_ORDER;
const MOVEMENT_TYPES = MONSTER_MOVEMENT_TYPES;

// ── Monster preview modal ─────────────────────────────────────────────────────

function MonsterPreview({ template, isHomebrew, onSpawn, onClose }: {
  template: MonsterTemplate;
  isHomebrew: boolean;
  onSpawn: () => void;
  onClose: () => void;
}) {
  const ABILITIES = ['str','dex','con','int','wis','cha'] as const;
  const modStr = (score: number) => {
    const m = Math.floor((score - 10) / 2);
    return `${score} (${m >= 0 ? '+' : ''}${m})`;
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.previewSheet} onPress={e => e.stopPropagation()}>
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View style={styles.rowNameLine}>
              <Text style={styles.monsterName}>{template.name}</Text>
              {!isHomebrew && isNonSrd(template.srd) && <NonSrdBadge />}
            </View>
            <Text style={styles.monsterType}>
              {template.size} {template.type}, {template.alignment}
            </Text>

            <View style={styles.divider} />

            {/* Core stats */}
            <Text style={styles.statLine}><Text style={styles.statKey}>AC:</Text> {template.ac.value} ({template.ac.source})</Text>
            <Text style={styles.statLine}><Text style={styles.statKey}>HP:</Text> {template.hp.average} ({template.hp.dice})</Text>
            <Text style={styles.statLine}><Text style={styles.statKey}>Speed:</Text> {template.speed} ft</Text>
            <Text style={styles.statLine}><Text style={styles.statKey}>CR:</Text> {crLabel(template.cr)}</Text>

            <View style={styles.divider} />

            {/* Ability scores */}
            <View style={styles.abilityRow}>
              {ABILITIES.map(a => (
                <View key={a} style={styles.abilityBox}>
                  <Text style={styles.abilityLabel}>{a.toUpperCase()}</Text>
                  <Text style={styles.abilityVal}>{modStr(template.stats[a])}</Text>
                </View>
              ))}
            </View>

            <View style={styles.divider} />

            {/* Senses / Languages */}
            {template.senses.length > 0 && (
              <Text style={styles.statLine}><Text style={styles.statKey}>Senses:</Text> {template.senses.join(', ')}</Text>
            )}
            {template.languages.length > 0 && (
              <Text style={styles.statLine}><Text style={styles.statKey}>Languages:</Text> {template.languages.join(', ')}</Text>
            )}

            {/* Features */}
            {template.features.length > 0 && (
              <>
                <View style={styles.divider} />
                <Text style={styles.featuresTitle}>ACTIONS & TRAITS</Text>
                {template.features.map(f => (
                  <View key={f.id} style={styles.featureBlock}>
                    <Text style={styles.featureName}>{f.name}.</Text>
                    <Text style={styles.featureDesc}> {f.description}</Text>
                  </View>
                ))}
              </>
            )}
          </ScrollView>

          <Pressable style={styles.spawnBtn} onPress={onSpawn}>
            <Text style={styles.spawnBtnTxt}>⚔️ Spawn in Encounter</Text>
          </Pressable>
          <Pressable style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeTxt}>Close</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Monsters Screen ───────────────────────────────────────────────────────────

export default function MonstersScreen() {
  const router       = useRouter();
  const safeGoBack   = useSafeGoBack('/(tabs)');
  const rules        = useCharacterStore(s => s.rules);
  const inCombat     = useCombatStore(s => s.combat.active);

  const saved = useBrowseStateStore.getState().getBrowseState(SCREEN_KEY);
  const setBrowseState = useBrowseStateStore(s => s.setBrowseState);
  const savedFilters = saved.filters ?? {};
  const [search,   setSearch]   = useState(saved.search ?? '');
  const [crMin,    setCrMin]    = useState((savedFilters.crMin as string) ?? '');
  const [crMax,    setCrMax]    = useState((savedFilters.crMax as string) ?? '');
  const [preview,  setPreview]  = useState<MonsterTemplate | null>(null);
  // MONSTER-LIB-FILTERS-1: type/size/official-homebrew — the fields
  // MonsterTemplate actually carries (confirmed against the real content
  // type before building this; no environment/tags field exists on
  // MonsterTemplate, so those aren't offered — see the final report's
  // "Filter coverage by content type" section). Kept behind a collapsible
  // panel (filtersOpen) rather than permanent controls, per "don't overload
  // the screen."
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [typeFilter,  setTypeFilter]  = useState<string | null>((savedFilters.typeFilter as string) ?? null);
  const [sizeFilter,  setSizeFilter]  = useState<string | null>((savedFilters.sizeFilter as string) ?? null);
  const [sourceFilter, setSourceFilter] = useState<'all' | 'official' | 'homebrew'>((savedFilters.sourceFilter as 'all' | 'official' | 'homebrew') ?? 'all');
  const [alignmentFilter, setAlignmentFilter] = useState<string | null>((savedFilters.alignmentFilter as string) ?? null);
  const [legendaryOnly, setLegendaryOnly] = useState(!!savedFilters.legendaryOnly);
  const [lairOnly,      setLairOnly]      = useState(!!savedFilters.lairOnly);
  const [darkvisionOnly, setDarkvisionOnly] = useState(!!savedFilters.darkvisionOnly);
  const [spellcasterOnly, setSpellcasterOnly] = useState(!!savedFilters.spellcasterOnly);
  const [movementFilter, setMovementFilter] = useState<Set<string>>(new Set((savedFilters.movementFilter as string[]) ?? []));
  const [resistanceFilter, setResistanceFilter] = useState<Set<string>>(new Set((savedFilters.resistanceFilter as string[]) ?? []));
  const [immunityFilter, setImmunityFilter] = useState<Set<string>>(new Set((savedFilters.immunityFilter as string[]) ?? []));
  const [condImmunityFilter, setCondImmunityFilter] = useState<Set<string>>(new Set((savedFilters.condImmunityFilter as string[]) ?? []));
  const [languageFilter, setLanguageFilter] = useState<Set<string>>(new Set((savedFilters.languageFilter as string[]) ?? []));
  // Ruleset: real field (MonsterTemplate.rulesetId), but confirmed zero
  // monsters currently carry a real (non-undefined) value — every official
  // monster and every homebrew one so far is "available under every
  // ruleset." The filter logic below is fully wired for when that changes;
  // FilterChipRow itself only renders once 2+ distinct values actually
  // exist, so this correctly stays invisible rather than showing a
  // meaningless single-option control.
  const [rulesetFilter, setRulesetFilter] = useState<string | null>((savedFilters.rulesetFilter as string) ?? null);

  const homebrewMonsters = useHomebrewStore(s => s.monsters);
  // mergeMonsterIndex dedups by id, homebrew wins — extracted to
  // contentResolution.ts once a second consumer needed it (preparedEncounter.ts).
  const allTemplates = useMemo(() => mergeMonsterIndex(homebrewMonsters), [homebrewMonsters]);
  const homebrewIds = useMemo(() => new Set(homebrewMonsters.map(m => m.id)), [homebrewMonsters]);
  const sortOptions = useMemo(() => monsterSortOptions(t => homebrewIds.has(t.id)), [homebrewIds]);
  const [sort, setSort] = useState(saved.sort ?? 'name_asc');
  useEffect(() => {
    setBrowseState(SCREEN_KEY, {
      search, sort,
      filters: {
        crMin, crMax, typeFilter, sizeFilter, sourceFilter, alignmentFilter,
        legendaryOnly, lairOnly, darkvisionOnly, spellcasterOnly,
        movementFilter: Array.from(movementFilter), resistanceFilter: Array.from(resistanceFilter),
        immunityFilter: Array.from(immunityFilter), condImmunityFilter: Array.from(condImmunityFilter),
        languageFilter: Array.from(languageFilter), rulesetFilter,
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    search, sort, crMin, crMax, typeFilter, sizeFilter, sourceFilter, alignmentFilter,
    legendaryOnly, lairOnly, darkvisionOnly, spellcasterOnly, movementFilter, resistanceFilter,
    immunityFilter, condImmunityFilter, languageFilter, rulesetFilter,
  ]);

  // Real, present values only — not a fabricated fixed enum. Sizes still
  // sort in the standard D&D size order (real data, common ordering) rather
  // than alphabetically.
  const availableTypes = useMemo(
    () => Array.from(new Set(allTemplates.map(t => t.type))).sort(),
    [allTemplates],
  );
  const availableSizes = useMemo(
    () => Array.from(new Set(allTemplates.map(t => t.size)))
      .sort((a, b) => SIZE_ORDER.indexOf(a) - SIZE_ORDER.indexOf(b)),
    [allTemplates],
  );
  const availableAlignments = useMemo(
    () => Array.from(new Set(allTemplates.map(t => t.alignment))).sort(),
    [allTemplates],
  );
  const availableRulesets = useMemo(
    () => Array.from(new Set(allTemplates.map(t => t.rulesetId).filter((r): r is NonNullable<typeof r> => !!r).map(String))).sort(),
    [allTemplates],
  );
  const availableResistances = useMemo(
    () => Array.from(new Set(allTemplates.flatMap(t => Array.from(monsterResistances(t))))).sort(),
    [allTemplates],
  );
  const availableImmunities = useMemo(
    () => Array.from(new Set(allTemplates.flatMap(t => Array.from(monsterImmunities(t))))).sort(),
    [allTemplates],
  );
  const availableCondImmunities = useMemo(
    () => Array.from(new Set(allTemplates.flatMap(t => Array.from(monsterConditionImmunities(t))))).sort(),
    [allTemplates],
  );
  const availableLanguages = useMemo(
    () => Array.from(new Set(allTemplates.flatMap(t => t.languages))).sort(),
    [allTemplates],
  );

  const filtered = useMemo(() => {
    return sortByOption(allTemplates.filter(t => {
      const matchName = t.name.toLowerCase().includes(search.toLowerCase()) ||
                        t.type.toLowerCase().includes(search.toLowerCase());
      const min = parseFloat(crMin);
      const max = parseFloat(crMax);
      const matchCr = (isNaN(min) || t.cr >= min) && (isNaN(max) || t.cr <= max);
      const matchType = !typeFilter || t.type === typeFilter;
      const matchSize = !sizeFilter || t.size === sizeFilter;
      const matchAlignment = !alignmentFilter || t.alignment === alignmentFilter;
      const matchRuleset = !rulesetFilter || t.rulesetId === rulesetFilter;
      const isHomebrew = homebrewIds.has(t.id);
      const matchSource = sourceFilter === 'all' || (sourceFilter === 'homebrew' ? isHomebrew : !isHomebrew);
      const matchLegendary = !legendaryOnly || (t.legendaryActions ?? 0) > 0;
      const matchLair = !lairOnly || (t.lairActions?.length ?? 0) > 0;
      const matchDarkvision = !darkvisionOnly || monsterHasDarkvision(t);
      const matchSpellcaster = !spellcasterOnly || monsterIsSpellcaster(t);
      // Multi-select fields: OR within the field (any selected value
      // matches), AND against every other filter.
      const matchMovement = movementFilter.size === 0 ||
        Array.from(movementFilter).some(m => monsterMovementTypes(t).has(m));
      const matchResistance = resistanceFilter.size === 0 ||
        Array.from(resistanceFilter).some(r => monsterResistances(t).has(r));
      const matchImmunity = immunityFilter.size === 0 ||
        Array.from(immunityFilter).some(i => monsterImmunities(t).has(i));
      const matchCondImmunity = condImmunityFilter.size === 0 ||
        Array.from(condImmunityFilter).some(c => monsterConditionImmunities(t).has(c));
      const matchLanguage = languageFilter.size === 0 ||
        Array.from(languageFilter).some(l => t.languages.includes(l));
      return matchName && matchCr && matchType && matchSize && matchAlignment && matchRuleset &&
        matchSource && matchLegendary && matchLair && matchDarkvision && matchSpellcaster &&
        matchMovement && matchResistance && matchImmunity && matchCondImmunity && matchLanguage;
    }), sortOptions, sort);
  }, [
    allTemplates, search, crMin, crMax, typeFilter, sizeFilter, alignmentFilter, rulesetFilter,
    sourceFilter, homebrewIds, legendaryOnly, lairOnly, darkvisionOnly, spellcasterOnly,
    movementFilter, resistanceFilter, immunityFilter, condImmunityFilter, languageFilter,
    sortOptions, sort,
  ]);

  const activeFilterChips: { key: string; label: string; onClear: () => void }[] = [
    ...(typeFilter ? [{ key: 'type', label: typeFilter, onClear: () => setTypeFilter(null) }] : []),
    ...(sizeFilter ? [{ key: 'size', label: sizeFilter, onClear: () => setSizeFilter(null) }] : []),
    ...(alignmentFilter ? [{ key: 'alignment', label: alignmentFilter, onClear: () => setAlignmentFilter(null) }] : []),
    ...(rulesetFilter ? [{ key: 'ruleset', label: rulesetFilter, onClear: () => setRulesetFilter(null) }] : []),
    ...(sourceFilter !== 'all' ? [{ key: 'source', label: sourceFilter === 'official' ? 'Official' : 'Homebrew', onClear: () => setSourceFilter('all') }] : []),
    ...(crMin.trim() || crMax.trim() ? [{ key: 'cr', label: `CR ${crMin || '0'}–${crMax || '30'}`, onClear: () => { setCrMin(''); setCrMax(''); } }] : []),
    ...(legendaryOnly ? [{ key: 'legendary', label: 'Legendary Actions', onClear: () => setLegendaryOnly(false) }] : []),
    ...(lairOnly ? [{ key: 'lair', label: 'Lair Actions', onClear: () => setLairOnly(false) }] : []),
    ...(darkvisionOnly ? [{ key: 'darkvision', label: 'Darkvision', onClear: () => setDarkvisionOnly(false) }] : []),
    ...(spellcasterOnly ? [{ key: 'spellcaster', label: 'Spellcaster', onClear: () => setSpellcasterOnly(false) }] : []),
    ...Array.from(movementFilter).map(m => ({ key: `move_${m}`, label: m, onClear: () => setMovementFilter(s => { const n = new Set(s); n.delete(m); return n; }) })),
    ...Array.from(resistanceFilter).map(r => ({ key: `res_${r}`, label: `Resist ${r}`, onClear: () => setResistanceFilter(s => { const n = new Set(s); n.delete(r); return n; }) })),
    ...Array.from(immunityFilter).map(i => ({ key: `imm_${i}`, label: `Immune ${i}`, onClear: () => setImmunityFilter(s => { const n = new Set(s); n.delete(i); return n; }) })),
    ...Array.from(condImmunityFilter).map(c => ({ key: `condimm_${c}`, label: `Immune ${c}`, onClear: () => setCondImmunityFilter(s => { const n = new Set(s); n.delete(c); return n; }) })),
    ...Array.from(languageFilter).map(l => ({ key: `lang_${l}`, label: l, onClear: () => setLanguageFilter(s => { const n = new Set(s); n.delete(l); return n; }) })),
  ];
  function clearAllFilters() {
    setTypeFilter(null); setSizeFilter(null); setSourceFilter('all'); setCrMin(''); setCrMax('');
    setAlignmentFilter(null); setRulesetFilter(null); setLegendaryOnly(false); setLairOnly(false);
    setDarkvisionOnly(false); setSpellcasterOnly(false);
    setMovementFilter(new Set()); setResistanceFilter(new Set()); setImmunityFilter(new Set());
    setCondImmunityFilter(new Set()); setLanguageFilter(new Set());
  }

  function handleSpawn(template: MonsterTemplate) {
    const monster = spawnMonster(template, rules);
    if (inCombat) {
      // Route through the store's own addEntities action (not a raw
      // setState) — it's the one thing that also gives the monster a real
      // InitiativeEntry via addToEncounter() and persists/broadcasts the
      // result, all of which a bare setState silently skipped (audit
      // finding: spawning while an encounter was already active never
      // showed up in the initiative tracker and could be lost on restart).
      useCombatStore.getState().addEntities([monster]);
      setPreview(null);
      safeGoBack();
    } else {
      // Outside an active encounter, combatStore.entities is inert — it's
      // fully replaced (not merged) by startCombat() the next time an
      // encounter actually starts (app/dm/encounter.tsx), so there's no
      // existing "pre-combat roster" mechanism to wire this into here.
      // Preserve that pre-existing (already-inert) behavior rather than
      // inventing new pre-combat roster architecture — out of this
      // finding's scope.
      useCombatStore.setState(s => ({
        entities: s.entities.some(e => e.id === monster.id) ? s.entities : [...s.entities, monster],
      }));
      setPreview(null);
    }
  }

  const renderMonsterRow = useCallback(({ item: t }: { item: MonsterTemplate }) => (
    <Pressable style={styles.monsterRow} onPress={() => setPreview(t)}>
      <View>
        <View style={styles.rowNameLine}>
          <Text style={styles.rowName}>{t.name}</Text>
          {!homebrewIds.has(t.id) && isNonSrd(t.srd) && <NonSrdBadge />}
        </View>
        <Text style={styles.rowType}>{t.size} {t.type}</Text>
      </View>
      <View style={styles.rowRight}>
        <View style={styles.crBadge}>
          <Text style={styles.crTxt}>CR {crLabel(t.cr)}</Text>
        </View>
        <Text style={styles.hpTxt}>{t.hp.average} HP</Text>
      </View>
    </Pressable>
  ), [homebrewIds]);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={safeGoBack}>
          <Text style={styles.backTxt}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>Monster Library</Text>
      </View>

      {/* Filter row */}
      <View style={styles.filters}>
        <TextInput
          style={[styles.filterInput, { flex: 2 }]}
          value={search}
          onChangeText={setSearch}
          placeholder="Search name or type…"
          placeholderTextColor={Colors.textDim}
        />
        <TextInput
          style={styles.filterInput}
          value={crMin}
          onChangeText={setCrMin}
          placeholder="CR min"
          placeholderTextColor={Colors.textDim}
          keyboardType="decimal-pad"
        />
        <TextInput
          style={styles.filterInput}
          value={crMax}
          onChangeText={setCrMax}
          placeholder="CR max"
          placeholderTextColor={Colors.textDim}
          keyboardType="decimal-pad"
        />
      </View>

      <View style={styles.controlsRow}>
        <Pressable
          style={[styles.filtersToggle, filtersOpen && styles.filtersToggleActive]}
          onPress={() => setFiltersOpen(v => !v)}
        >
          <Text style={[styles.filtersToggleTxt, filtersOpen && styles.filtersToggleTxtActive]}>
            Filters{activeFilterChips.length > 0 ? ` (${activeFilterChips.length})` : ''}
          </Text>
        </Pressable>
        <SortControl options={sortOptions} value={sort} onChange={setSort} />
      </View>

      {filtersOpen && (
        <View style={styles.filterPanel}>
          <FilterSection label="Type">
            <FilterChipRow options={availableTypes.map(t => ({ id: t, label: t }))} value={typeFilter} onChange={setTypeFilter} scrollable />
          </FilterSection>
          <FilterSection label="Size">
            <FilterChipRow options={availableSizes.map(s => ({ id: s, label: s }))} value={sizeFilter} onChange={setSizeFilter} scrollable />
          </FilterSection>
          <FilterSection label="Alignment">
            <FilterChipRow options={availableAlignments.map(a => ({ id: a, label: a }))} value={alignmentFilter} onChange={setAlignmentFilter} scrollable />
          </FilterSection>
          {/* Ruleset — real field, currently a no-op (renders nothing) since
              no monster has ever been tagged with a non-default value yet. */}
          <FilterSection label="Ruleset">
            <FilterChipRow options={availableRulesets.map(r => ({ id: r, label: r }))} value={rulesetFilter} onChange={setRulesetFilter} scrollable />
          </FilterSection>
          <FilterSection label="Source">
            <OfficialHomebrewChipRow value={sourceFilter} onChange={setSourceFilter} />
          </FilterSection>
          <FilterSection label="Movement">
            <MultiSelectChipRow options={MOVEMENT_TYPES.map(m => ({ id: m, label: m }))} values={movementFilter} onChange={setMovementFilter} />
          </FilterSection>
          <FilterSection label="Resistances">
            <MultiSelectChipRow options={availableResistances.map(r => ({ id: r, label: r }))} values={resistanceFilter} onChange={setResistanceFilter} scrollable />
          </FilterSection>
          <FilterSection label="Immunities">
            <MultiSelectChipRow options={availableImmunities.map(i => ({ id: i, label: i }))} values={immunityFilter} onChange={setImmunityFilter} scrollable />
          </FilterSection>
          <FilterSection label="Condition Immunities">
            <MultiSelectChipRow options={availableCondImmunities.map(c => ({ id: c, label: c }))} values={condImmunityFilter} onChange={setCondImmunityFilter} scrollable />
          </FilterSection>
          <FilterSection label="Languages">
            <MultiSelectChipRow options={availableLanguages.map(l => ({ id: l, label: l }))} values={languageFilter} onChange={setLanguageFilter} scrollable />
          </FilterSection>
          <FilterSection label="Other">
            <View style={styles.chipRow}>
              <Pressable style={[styles.chip, legendaryOnly && styles.chipActive]} onPress={() => setLegendaryOnly(v => !v)}>
                <Text style={[styles.chipTxt, legendaryOnly && styles.chipTxtActive]}>Legendary Actions</Text>
              </Pressable>
              <Pressable style={[styles.chip, lairOnly && styles.chipActive]} onPress={() => setLairOnly(v => !v)}>
                <Text style={[styles.chipTxt, lairOnly && styles.chipTxtActive]}>Lair Actions</Text>
              </Pressable>
              <Pressable style={[styles.chip, darkvisionOnly && styles.chipActive]} onPress={() => setDarkvisionOnly(v => !v)}>
                <Text style={[styles.chipTxt, darkvisionOnly && styles.chipTxtActive]}>Darkvision</Text>
              </Pressable>
              <Pressable style={[styles.chip, spellcasterOnly && styles.chipActive]} onPress={() => setSpellcasterOnly(v => !v)}>
                <Text style={[styles.chipTxt, spellcasterOnly && styles.chipTxtActive]}>Spellcaster</Text>
              </Pressable>
            </View>
          </FilterSection>
        </View>
      )}

      {/* Active filter chips + result count — same pattern to be reused by
          other browsers as their turn comes (see final report). */}
      {activeFilterChips.length > 0 && (
        <View style={styles.activeFilterRow}>
          {activeFilterChips.map(c => (
            <Pressable key={c.key} style={styles.activeChip} onPress={c.onClear}>
              <Text style={styles.activeChipTxt}>{c.label} ×</Text>
            </Pressable>
          ))}
          <Pressable onPress={clearAllFilters}>
            <Text style={styles.clearAllTxt}>Clear all</Text>
          </Pressable>
        </View>
      )}
      <Text style={styles.resultCount}>{filtered.length} result{filtered.length === 1 ? '' : 's'}</Text>

      <FlatList
        style={styles.scroll}
        contentContainerStyle={styles.content}
        data={filtered}
        keyExtractor={monsterKeyExtractor}
        renderItem={renderMonsterRow}
        // MONSTER-LIB-PERF-1: was a ScrollView + .map() mounting all ~322
        // rows immediately on every open, regardless of viewport — the
        // dominant cause of felt open-latency. FlatList windows rendering
        // to what's actually visible (+ a small overscan buffer), so
        // opening cost no longer scales with catalog size.
        initialNumToRender={12}
        windowSize={7}
        removeClippedSubviews
        ListEmptyComponent={
          // ZERO-RESULT-UX-1: distinguish "nothing exists" from "your
          // filters excluded everything" — the former basically can't
          // happen here (322 official monsters always exist), but the
          // homebrew-only view can genuinely be empty, which is a
          // different message than "no matches."
          <View style={styles.emptyState}>
            <Text style={styles.emptyTxt}>
              {sourceFilter === 'homebrew' && homebrewMonsters.length === 0
                ? 'No homebrew monsters yet.'
                : 'No monsters match your filters.'}
            </Text>
            {activeFilterChips.length > 0 && (
              <Pressable style={styles.clearFiltersBtn} onPress={clearAllFilters}>
                <Text style={styles.clearFiltersBtnTxt}>Clear Filters</Text>
              </Pressable>
            )}
          </View>
        }
      />

      {preview && (
        <MonsterPreview
          template={preview}
          isHomebrew={homebrewIds.has(preview.id)}
          onSpawn={() => handleSpawn(preview)}
          onClose={() => setPreview(null)}
        />
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  header: {
    backgroundColor: Colors.surfaceHigh,
    paddingTop: Spacing.xl + 8, paddingBottom: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: { alignSelf: 'flex-start', marginBottom: 4 },
  backTxt: { color: Colors.gold, fontSize: FontSize.md, fontWeight: FontWeight.bold },
  title:   { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },

  filters: { flexDirection: 'row', gap: Spacing.xs, padding: Spacing.sm, backgroundColor: Colors.surfaceHigh },
  controlsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: Spacing.xs, paddingHorizontal: Spacing.sm },
  filterInput: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.sm, color: Colors.textPrimary, fontSize: FontSize.sm,
  },

  filtersToggle: {
    borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.surface, paddingHorizontal: Spacing.sm, justifyContent: 'center',
  },
  filtersToggleActive: { backgroundColor: Colors.gold, borderColor: Colors.gold },
  filtersToggleTxt:     { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.bold },
  filtersToggleTxtActive: { color: Colors.bg },

  filterPanel: {
    backgroundColor: Colors.surfaceHigh, paddingHorizontal: Spacing.sm, paddingBottom: Spacing.sm, gap: 4,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  chipRow: { flexDirection: 'row', gap: Spacing.xs, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface,
  },
  chipActive:   { backgroundColor: Colors.gold, borderColor: Colors.gold },
  chipTxt:      { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: FontWeight.bold },
  chipTxtActive:{ color: Colors.bg },

  activeFilterRow: {
    flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.xs,
    paddingHorizontal: Spacing.sm, paddingTop: Spacing.xs,
  },
  activeChip: {
    backgroundColor: Colors.gold + '22', borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.gold + '66',
    paddingHorizontal: Spacing.sm, paddingVertical: 2,
  },
  activeChipTxt: { fontSize: FontSize.xs, color: Colors.gold, fontWeight: FontWeight.bold },
  clearAllTxt:   { fontSize: FontSize.xs, color: Colors.textDim, textDecorationLine: 'underline' },
  resultCount:   { fontSize: FontSize.xs, color: Colors.textDim, paddingHorizontal: Spacing.sm, paddingTop: 4 },

  emptyState: { alignItems: 'center', gap: Spacing.sm },
  clearFiltersBtn: {
    borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.gold,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs,
  },
  clearFiltersBtnTxt: { color: Colors.gold, fontWeight: FontWeight.bold },

  scroll:  { flex: 1 },
  content: { padding: Spacing.sm, gap: Spacing.xs, paddingBottom: Spacing.xxl },

  monsterRow: {
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.sm, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between',
  },
  rowNameLine: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  rowName:   { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  rowType:   { fontSize: FontSize.xs, color: Colors.textSecondary },
  rowRight:  { alignItems: 'flex-end', gap: 4 },
  crBadge: {
    backgroundColor: Colors.red + '33', borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm, paddingVertical: 2,
    borderWidth: 1, borderColor: Colors.red + '66',
  },
  crTxt:    { fontSize: FontSize.xs, color: Colors.red, fontWeight: FontWeight.bold },
  hpTxt:    { fontSize: FontSize.xs, color: Colors.textDim },
  emptyTxt: { color: Colors.textDim, textAlign: 'center', padding: Spacing.xl },

  // Preview modal
  backdrop: { flex: 1, backgroundColor: '#000000bb', justifyContent: 'flex-end' },
  previewSheet: {
    backgroundColor: Colors.surfaceHigh,
    borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg,
    padding: Spacing.lg, maxHeight: '80%',
  },
  monsterName: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  monsterType: { fontSize: FontSize.sm, color: Colors.textSecondary, fontStyle: 'italic' },
  divider:     { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.sm },
  statLine:    { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: 2 },
  statKey:     { fontWeight: FontWeight.bold, color: Colors.textPrimary },
  abilityRow:  { flexDirection: 'row', justifyContent: 'space-around' },
  abilityBox:  { alignItems: 'center' },
  abilityLabel:{ fontSize: FontSize.xs, color: Colors.textSecondary },
  abilityVal:  { fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: FontWeight.bold },
  featuresTitle:{ fontSize: FontSize.xs, color: Colors.textDim, letterSpacing: 2, marginBottom: Spacing.xs },
  featureBlock: { marginBottom: Spacing.xs },
  featureName:  { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  featureDesc:  { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 18 },
  spawnBtn: {
    backgroundColor: Colors.red, borderRadius: Radius.md,
    padding: Spacing.md, alignItems: 'center', marginTop: Spacing.md,
  },
  spawnBtnTxt: { color: Colors.white, fontWeight: FontWeight.bold, fontSize: FontSize.md },
  closeBtn:    { alignItems: 'center', padding: Spacing.sm },
  closeTxt:    { color: Colors.textSecondary, fontSize: FontSize.md },
});
