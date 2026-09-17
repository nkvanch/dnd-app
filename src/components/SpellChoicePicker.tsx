// src/components/SpellChoicePicker.tsx
// Resolves a 'spell' pending choice — a known-spell caster (Sorcerer, Bard,
// Warlock, Ranger) gaining new spells/cantrips known at level-up, or a
// Wizard adding to their spellbook. Mirrors InfusionPicker.tsx's shape:
// presentational, applies through applySpellChoiceToEntity (bypasses
// resolveChoice — the pool is the 'all' sentinel, same reason ASI/subclass/
// infusion do). Whether this is a cantrip choice or a leveled-spell choice
// is read off choice.definition.id (see the classes/index.ts choices this
// resolves — every id contains 'cantrip' or it doesn't), rather than a new
// ChoiceDefinition field, so the engine/type layer didn't need to grow.
import { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, TextInput } from 'react-native';
import { applySpellChoiceToEntity } from '../engine/leveling';
import type { SpellIndexEntry } from '../content/spellRepo.types';
import { mergeSpellIndex } from '../content/contentResolution';
import { useHomebrewStore } from '../store/homebrewStore';
import { Entity, ChoiceState, CampaignRules } from '../engine/types';
import { SortOption, nameSortOptions, sortByOption } from '../content/contentQuery';
import { SortControl } from './SortControl';
import { FilterChipRow, FilterSection, ActiveFilterChips, ZeroResultsState } from './FilterChipRow';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../theme';

export function SpellChoicePicker({
  entity,
  choice,
  rules,
  onResolved,
  onClose,
  progressNote,
}: {
  entity:     Entity;
  choice:     ChoiceState;
  rules:      CampaignRules;
  onResolved: (updated: Entity) => void;
  onClose?:   () => void;
  /** SPELL-ACCUMULATION-2: "N more cantrip/spell choices after this one" —
   *  same prop shape as AsiFeatPicker's, shown when a caller (TabFeatures.tsx)
   *  chains this picker through several same-group pending choices in a row. */
  progressNote?: string;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [search,   setSearch]   = useState('');
  const [schoolFilter, setSchoolFilter] = useState<string | null>(null);
  const [castFilter, setCastFilter] = useState<'all' | 'ritual' | 'concentration'>('all');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sort, setSort] = useState('name_asc');
  const homebrewSpells = useHomebrewStore(s => s.spells);

  const isCantripChoice = choice.definition.id.includes('cantrip');
  const classId = entity.identity.classId;
  const spellcasting = entity.spellcasting;

  // Highest spell slot tier this entity currently has any slots in — caps
  // which leveled spells are choosable (a caster can't learn a spell above
  // what they can currently cast). Cantrips have no such cap.
  const maxCastableLevel = useMemo(() => {
    if (!spellcasting) return 0;
    const tiers = ['9','8','7','6','5','4','3','2','1'] as const;
    for (const t of tiers) {
      if ((spellcasting.slots[t]?.total ?? 0) > 0) return Number(t);
    }
    return 0;
  }, [spellcasting]);

  const allSpells: SpellIndexEntry[] = useMemo(() => mergeSpellIndex(homebrewSpells), [homebrewSpells]);

  const known = new Set([...(spellcasting?.cantrips ?? []), ...(spellcasting?.known ?? [])]);
  const q = search.trim().toLowerCase();

  // Sort options: name always; Spell Level only meaningful for the
  // non-cantrip pool (a cantrip choice's pool is entirely level 0, so a
  // Level sort would be a no-op — omitted per item 26's "unless the option
  // set is too small to justify" allowance rather than shown decoratively.
  const sortOptions: SortOption<SpellIndexEntry>[] = useMemo(() => [
    ...nameSortOptions<SpellIndexEntry>(),
    ...(isCantripChoice ? [] : [{
      id: 'level', label: 'Spell Level',
      compare: (a: SpellIndexEntry, b: SpellIndexEntry) => a.level - b.level || a.name.localeCompare(b.name),
    }]),
    {
      id: 'school', label: 'School',
      compare: (a, b) => a.school.localeCompare(b.school) || a.name.localeCompare(b.name),
    },
  ], [isCantripChoice]);

  const preFilterOptions = useMemo(() => {
    return allSpells.filter(s => {
      if (known.has(s.id)) return false;
      if (!s.classes || s.classes.length === 0 || s.classes.includes(classId)) {
        // class-restricted (or legacy-untagged, included per the same
        // fallback creation's spell picker uses) — keep checking
      } else {
        return false;
      }
      if (isCantripChoice) {
        if (s.level !== 0) return false;
      } else {
        if (s.level === 0 || s.level > maxCastableLevel) return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allSpells, classId, isCantripChoice, maxCastableLevel]);

  // School chips reflect only what's actually present in THIS constrained
  // pool (not every school ever) — same "don't show a filter with nothing
  // to filter" rule FilterChipRow's own <=1-option auto-hide enforces.
  const availableSchools = useMemo(
    () => Array.from(new Set(preFilterOptions.map(s => s.school))).sort().map(sc => ({ id: sc, label: sc })),
    [preFilterOptions],
  );

  const options = useMemo(() => sortByOption(preFilterOptions.filter(s => {
    if (q && !s.name.toLowerCase().includes(q) && !s.school.toLowerCase().includes(q)) return false;
    if (schoolFilter && s.school !== schoolFilter) return false;
    if (castFilter === 'ritual' && !s.ritual) return false;
    if (castFilter === 'concentration' && !s.concentration) return false;
    return true;
  }), sortOptions, sort), [preFilterOptions, q, schoolFilter, castFilter, sortOptions, sort]);

  const activeFilterChips = [
    ...(schoolFilter ? [{ key: 'school', label: schoolFilter, onClear: () => setSchoolFilter(null) }] : []),
    ...(castFilter !== 'all' ? [{ key: 'cast', label: castFilter === 'ritual' ? 'Ritual' : 'Concentration', onClear: () => setCastFilter('all') }] : []),
  ];
  function clearAllFilters() { setSchoolFilter(null); setCastFilter('all'); }

  function toggle(id: string) {
    setSelected(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= choice.definition.count) return prev;
      return [...prev, id];
    });
  }

  function commit() {
    if (selected.length !== choice.definition.count) return;
    const getLevel = (id: string) => allSpells.find(s => s.id === id)?.level;
    onResolved(applySpellChoiceToEntity(entity, choice.id, selected, getLevel, rules));
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.headerRow}>
        <Text style={styles.heading}>{isCantripChoice ? 'Choose Cantrips' : 'Choose Spells'}</Text>
        {onClose && (
          <Pressable onPress={onClose} hitSlop={8}>
            <Text style={styles.close}>✕</Text>
          </Pressable>
        )}
      </View>
      <Text style={styles.sub}>{choice.definition.prompt}</Text>
      {progressNote && <Text style={styles.progressNote}>{progressNote}</Text>}
      <Text style={styles.count}>Selected {selected.length}/{choice.definition.count}</Text>

      <TextInput
        style={styles.search}
        placeholder="Search"
        placeholderTextColor={Colors.textDim}
        value={search}
        onChangeText={setSearch}
      />

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
          <FilterSection label="School">
            <FilterChipRow options={availableSchools} value={schoolFilter} onChange={setSchoolFilter} scrollable />
          </FilterSection>
          <FilterSection label="Ritual / Concentration">
            <FilterChipRow
              options={[{ id: 'ritual' as const, label: 'Ritual' }, { id: 'concentration' as const, label: 'Concentration' }]}
              value={castFilter === 'all' ? null : castFilter}
              onChange={v => setCastFilter(v ?? 'all')}
            />
          </FilterSection>
        </View>
      )}
      <ActiveFilterChips chips={activeFilterChips} onClearAll={clearAllFilters} />

      <View style={styles.list}>
        {options.map(s => {
          const isSel = selected.includes(s.id);
          const disabled = !isSel && selected.length >= choice.definition.count;
          return (
            <Pressable
              key={s.id}
              style={[styles.row, isSel && styles.rowSelected, disabled && styles.rowDisabled]}
              disabled={disabled}
              onPress={() => toggle(s.id)}
            >
              <View style={styles.rowHeader}>
                <Text style={styles.rowName}>{s.name}{isSel ? ' ✓' : ''}</Text>
                <Text style={styles.rowLevel}>{s.level === 0 ? 'Cantrip' : `Lv ${s.level}`}</Text>
              </View>
              <Text style={styles.rowMeta}>{s.school}{s.concentration ? ' · Concentration' : ''}{s.ritual ? ' · Ritual' : ''}</Text>
            </Pressable>
          );
        })}
        {options.length === 0 && (activeFilterChips.length > 0 || q) && (
          <ZeroResultsState hasActiveFilters onClearFilters={() => { clearAllFilters(); setSearch(''); }} />
        )}
        {options.length === 0 && activeFilterChips.length === 0 && !q && (
          <Text style={styles.empty}>
            No {isCantripChoice ? 'new cantrips' : 'new spells'} available to choose right now.
          </Text>
        )}
      </View>

      <Pressable
        style={[styles.applyBtn, selected.length !== choice.definition.count && styles.applyBtnDisabled]}
        disabled={selected.length !== choice.definition.count}
        onPress={commit}
      >
        <Text style={styles.applyTxt}>Learn {selected.length} {isCantripChoice ? 'Cantrip' : 'Spell'}{selected.length !== 1 ? 's' : ''} →</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content:   { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heading:   { flex: 1, flexShrink: 1, fontSize: FontSize.xxl, fontWeight: FontWeight.black, color: Colors.gold, marginBottom: Spacing.xs },
  close:     { fontSize: FontSize.xl, color: Colors.textSecondary, paddingLeft: Spacing.md },
  sub:       { fontSize: FontSize.md, color: Colors.textSecondary },
  progressNote: { fontSize: FontSize.xs, color: Colors.gold, fontWeight: FontWeight.bold, marginTop: 4 },
  count:     { fontSize: FontSize.sm, color: Colors.gold, fontWeight: FontWeight.bold, marginBottom: Spacing.md },
  search: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    fontSize: FontSize.md, color: Colors.textPrimary, marginBottom: Spacing.sm,
  },
  controlsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  filtersToggle: {
    backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.sm, paddingVertical: 6,
  },
  filtersToggleActive: { backgroundColor: Colors.gold + '22', borderColor: Colors.gold },
  filtersToggleTxt: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: FontWeight.bold },
  filtersToggleTxtActive: { color: Colors.gold },
  filterPanel: { marginTop: Spacing.sm },
  empty:     { fontSize: FontSize.sm, color: Colors.textDim, fontStyle: 'italic', textAlign: 'center', padding: Spacing.lg },

  list: { gap: Spacing.sm, marginBottom: Spacing.lg },
  row: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.md,
  },
  rowSelected: { borderColor: Colors.gold, backgroundColor: Colors.gold + '22' },
  rowDisabled: { opacity: 0.4 },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowName: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  rowLevel: { fontSize: FontSize.xs, color: Colors.textDim, fontWeight: FontWeight.bold },
  rowMeta: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },

  applyBtn: { backgroundColor: Colors.gold, borderRadius: Radius.md, paddingVertical: Spacing.md, alignItems: 'center' },
  applyBtnDisabled: { backgroundColor: Colors.goldDim },
  applyTxt: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.bg },
});
