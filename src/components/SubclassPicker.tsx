// src/components/SubclassPicker.tsx
// Resolves a 'subclass' pending choice — the real picker that was missing
// entirely before this pass (every class previously either had no choice at
// all, or Rogue's broken pool:'all'-with-no-picker choice). Mirrors
// AsiFeatPicker.tsx's shape: presentational, applies through a dedicated
// engine helper (applySubclassToEntity — bypasses resolveChoice the same
// reason ASI/feat do, since the pool is the 'all' sentinel), hands the
// updated entity back via onResolved. Shared by creation and in-play sheet.
import { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, TextInput } from 'react-native';
import { applySubclassToEntity } from '../engine/leveling';
import {
  subclassEntriesForClassMerged, subclassFeaturesByLevel,
  subclassAdditions, SUBCLASS_ADDITION_LABELS, subclassSortOptions,
  filterAndSortSubclassOptions, SubclassAddition, SubclassEntry,
} from '../content/subclasses/subclassBrowse';
import { useHomebrewStore } from '../store/homebrewStore';
import { useBrowseStateStore } from '../store/browseStateStore';
import {
  FilterSection, MultiSelectChipRow, OfficialHomebrewChipRow, ActiveFilterChips,
} from './FilterChipRow';
import { SortControl } from './SortControl';
import { Entity, ChoiceState, CampaignRules } from '../engine/types';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../theme';

export function SubclassPicker({
  entity,
  choice,
  rules,
  onResolved,
  onClose,
  onCreateNewSubclass,
}: {
  entity:     Entity;
  choice:     ChoiceState;
  rules:      CampaignRules;
  onResolved: (updated: Entity) => void;
  onClose?:   () => void;
  /** NESTED-HOMEBREW-1: renders a "+ Create New Homebrew Subclass" entry
   *  point when provided. Deliberately a callback prop, not a direct
   *  `useRouter` import — this component is shared by both a route screen
   *  (app/creation/subclass.tsx) and non-route components
   *  (TabFeatures.tsx), and importing expo-router at module scope in a
   *  component reachable from non-route code breaks Jest for every
   *  consumer (the same bug found and fixed once already this session for
   *  AsiFeatPicker.tsx). Route-context callers pass this in; others omit it. */
  onCreateNewSubclass?: () => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const homebrewSubclasses = useHomebrewStore(s => s.subclasses);

  // Multiclass-aware: a choice queued by levelUpClass() tags which class it
  // belongs to (choice.definition.forClassId). Falls back to the primary
  // classId for single-class characters and pre-existing choices without
  // the tag, so nothing changes for the common case.
  const forClassId = choice.definition.forClassId ?? entity.identity.classId;

  // LIVE-RULESET-2/3 (items 4, 7): subclassEntriesForClassMerged now carries
  // real ruleset filtering for BOTH official and homebrew subclasses (see
  // subclassBrowse.ts) — no manual raw-record cross-reference needed here
  // anymore, this picker just passes the character's own ruleset through.
  const options = useMemo(
    () => subclassEntriesForClassMerged(forClassId, homebrewSubclasses, entity.rulesetId),
    [forClassId, homebrewSubclasses, entity.rulesetId],
  );

  // SUBCLASS-BROWSE-1: search/filter/sort, keyed per-CLASS (not one shared
  // key) — mirrors race-detail.tsx's per-race subrace browse-state key for
  // the identical reason: a Fighter-scoped search string shouldn't leak
  // into a Wizard's subclass list. Deliberately does NOT offer Game/Ruleset/
  // Parent-Class filters here — class is already fixed by context, same
  // rule subrace-detail.tsx already applies to Parent Race.
  const screenKey = `subclass_picker:${forClassId}`;
  const savedBrowse = useBrowseStateStore.getState().getBrowseState(screenKey);
  const [search, setSearch] = useState(savedBrowse.search ?? '');
  const [officialFilter, setOfficialFilter] = useState<'all' | 'official' | 'homebrew'>(
    (savedBrowse.filters?.officialFilter as 'all' | 'official' | 'homebrew') ?? 'all'
  );
  const [addsFilter, setAddsFilter] = useState<Set<SubclassAddition>>(
    new Set((savedBrowse.filters?.addsFilter as SubclassAddition[] | undefined) ?? [])
  );
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sort, setSort] = useState(savedBrowse.sort ?? 'name_asc');

  useEffect(() => {
    useBrowseStateStore.getState().setBrowseState(screenKey, {
      search, sort, filters: { officialFilter, addsFilter: Array.from(addsFilter) },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, officialFilter, addsFilter, sort]);

  const homebrewIds = useMemo(() => new Set<string>(homebrewSubclasses.map(s => s.id)), [homebrewSubclasses]);
  const isHomebrewOf = (e: SubclassEntry) => homebrewIds.has(e.id);
  const sortOpts = subclassSortOptions(isHomebrewOf);
  const availableAdds = Array.from(
    new Set(options.flatMap(o => Array.from(subclassAdditions(o.progression)))),
  ).map(a => ({ id: a, label: SUBCLASS_ADDITION_LABELS[a] }));
  const filteredOptions = filterAndSortSubclassOptions(options, {
    search, officialFilter, addsFilter, sort, isHomebrewOf,
  });
  const activeChips = [
    ...(officialFilter !== 'all' ? [{ key: 'official', label: officialFilter === 'official' ? 'Official' : 'Homebrew', onClear: () => setOfficialFilter('all') }] : []),
    ...Array.from(addsFilter).map(a => ({ key: `adds_${a}`, label: SUBCLASS_ADDITION_LABELS[a], onClear: () => setAddsFilter(prev => { const n = new Set(prev); n.delete(a); return n; }) })),
  ];

  function commit(subclassId: string) {
    const entry = options.find(o => o.id === subclassId);
    if (!entry) return;
    const updated = applySubclassToEntity(
      entity, choice.id, subclassId, entry.progression, rules,
      choice.definition.forClassId, // undefined for single-class — preserves existing behavior
    );
    setExpandedId(null);
    onResolved(updated);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.headerRow}>
        <Text style={styles.heading}>Choose Your Subclass</Text>
        {onClose && (
          <Pressable onPress={onClose} hitSlop={8}>
            <Text style={styles.close}>✕</Text>
          </Pressable>
        )}
      </View>
      <Text style={styles.sub}>
        {choice.resolved
          ? 'Pick a different subclass to change your selection.'
          : choice.definition.prompt}
      </Text>

      {onCreateNewSubclass && (
        <Pressable style={styles.createNewBtn} onPress={onCreateNewSubclass}>
          <Text style={styles.createNewTxt}>+ Create New Homebrew Subclass</Text>
        </Pressable>
      )}

      {options.length > 0 && (
        <>
          <View style={styles.searchRow}>
            <TextInput
              style={[styles.search, styles.searchFlex]}
              placeholder={`Search ${options.length} subclasses…`}
              placeholderTextColor={Colors.textDim}
              value={search}
              onChangeText={setSearch}
            />
          </View>
          <View style={styles.controlsRow}>
            <Pressable
              style={[styles.filtersToggle, filtersOpen && styles.filtersToggleActive]}
              onPress={() => setFiltersOpen(o => !o)}
            >
              <Text style={[styles.filtersToggleTxt, filtersOpen && styles.filtersToggleTxtActive]}>Filters</Text>
            </Pressable>
            <SortControl options={sortOpts} value={sort} onChange={setSort} />
          </View>
          {filtersOpen && (
            <View style={styles.filterPanel}>
              {options.some(isHomebrewOf) && options.some(o => !isHomebrewOf(o)) && (
                <FilterSection label="Official / Homebrew">
                  <OfficialHomebrewChipRow value={officialFilter} onChange={setOfficialFilter} />
                </FilterSection>
              )}
              {availableAdds.length > 0 && (
                <FilterSection label="What It Adds">
                  <MultiSelectChipRow options={availableAdds} values={addsFilter} onChange={setAddsFilter} scrollable />
                </FilterSection>
              )}
            </View>
          )}
          <ActiveFilterChips
            chips={activeChips}
            onClearAll={() => { setOfficialFilter('all'); setAddsFilter(new Set()); }}
          />
        </>
      )}

      {options.length === 0 ? (
        <Text style={styles.empty}>
          No subclasses defined for this class yet — author one in the Homebrew tab, or check
          back once official content is added.
        </Text>
      ) : filteredOptions.length === 0 ? (
        <Text style={styles.empty}>No subclasses match your search/filters.</Text>
      ) : (
        <View style={styles.list}>
          {filteredOptions.map(o => {
            const expanded = expandedId === o.id;
            const isCurrent = choice.resolved && choice.selections[0] === o.id;
            const featureRows = expanded ? subclassFeaturesByLevel(o.progression) : [];
            return (
              <Pressable
                key={o.id}
                style={[styles.row, expanded && styles.rowExpanded, isCurrent && styles.rowCurrent]}
                onPress={() => setExpandedId(expanded ? null : o.id)}
              >
                <View style={styles.rowHeader}>
                  <Text style={styles.rowName}>{o.name}</Text>
                  {isCurrent && (
                    <View style={styles.currentBadge}>
                      <Text style={styles.currentBadgeTxt}>Current</Text>
                    </View>
                  )}
                  <Text style={styles.rowLevel}>Unlocks Lv {o.unlockLevel}</Text>
                </View>
                <Text style={styles.rowBlurb} numberOfLines={expanded ? undefined : 2}>{o.blurb}</Text>
                {expanded && featureRows.length > 0 && (
                  <View style={styles.featureList}>
                    {featureRows.map(({ feature, level }) => (
                      <View key={feature.id} style={styles.featureRow}>
                        <Text style={styles.featureLevel}>Lv {level}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.featureName}>{feature.name}</Text>
                          <Text style={styles.featureDesc}>{feature.description}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
                {expanded && (
                  <Pressable style={styles.takeBtn} onPress={() => commit(o.id)}>
                    <Text style={styles.takeTxt}>Take {o.name} →</Text>
                  </Pressable>
                )}
              </Pressable>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content:   { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heading:   { fontSize: FontSize.xxl, fontWeight: FontWeight.black, color: Colors.gold, marginBottom: Spacing.xs },
  close:     { fontSize: FontSize.xl, color: Colors.textSecondary, paddingLeft: Spacing.md },
  sub:       { fontSize: FontSize.md, color: Colors.textSecondary, marginBottom: Spacing.xl },
  empty:     { fontSize: FontSize.sm, color: Colors.textDim, fontStyle: 'italic', textAlign: 'center', padding: Spacing.lg },
  createNewBtn: {
    borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.gold,
    paddingVertical: Spacing.sm, alignItems: 'center', marginBottom: Spacing.md,
  },
  createNewTxt: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.gold },

  search: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    fontSize: FontSize.sm, color: Colors.textPrimary,
  },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginBottom: Spacing.sm },
  searchFlex: { flex: 1 },
  controlsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: Spacing.xs, marginBottom: Spacing.sm },
  filtersToggle: {
    borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.surface, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm,
  },
  filtersToggleActive: { borderColor: Colors.gold, backgroundColor: Colors.gold + '22' },
  filtersToggleTxt: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: FontWeight.bold },
  filtersToggleTxtActive: { color: Colors.gold },
  filterPanel: { marginBottom: Spacing.xs },

  list: { gap: Spacing.sm },
  row: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.md,
  },
  rowExpanded: { borderColor: Colors.gold, backgroundColor: Colors.gold + '11' },
  rowCurrent: { borderColor: Colors.green },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.sm },
  rowName:   { flex: 1, flexShrink: 1, fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  rowLevel:  { fontSize: FontSize.xs, color: Colors.textDim, fontWeight: FontWeight.bold },
  currentBadge: {
    backgroundColor: Colors.green + '22', borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.green + '66',
    paddingHorizontal: Spacing.sm, paddingVertical: 2,
  },
  currentBadgeTxt: { fontSize: FontSize.xs, color: Colors.green, fontWeight: FontWeight.bold },
  rowBlurb:  { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 4, lineHeight: 18 },

  featureList: { marginTop: Spacing.sm, gap: Spacing.xs },
  featureRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start' },
  featureLevel: { fontSize: FontSize.xs, color: Colors.gold, fontWeight: FontWeight.bold, width: 40 },
  featureName: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  featureDesc: { fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 16, marginTop: 1 },

  takeBtn: {
    marginTop: Spacing.md, backgroundColor: Colors.gold, borderRadius: Radius.md,
    paddingVertical: Spacing.sm, alignItems: 'center',
  },
  takeTxt: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.bg },
});
