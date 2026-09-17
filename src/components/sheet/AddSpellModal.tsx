// src/components/sheet/AddSpellModal.tsx
// In-sheet spell browser — add any spell to a character at any time.
// Rich multi-axis filtering over the fields the Spell type actually carries:
//   level, school, class, casting time (action type), concentration, ritual,
//   Official/Homebrew.
//
// Ruleset, Source/Pack, and Components (V/S/M) are NOT offered: all three
// live only on the full Spell record (Tier 2), not the lightweight
// SpellIndexEntry (Tier 1) this browser filters against — bulk-loading
// Tier 2 for the whole pool just to filter would mean reloading the full
// spell catalog per keystroke. BLOCKED until spellRepo's Tier-1 index
// (spellRepo.ts's web array + spellRepo.native.ts's SQLite `spells` table)
// is extended to carry those fields. Damage-type/saving-throw/subclass
// filters are also not offered: not structured fields on Spell at all.
import { useState, useMemo, useEffect } from 'react';
import {
  Modal, View, Text, Pressable, TextInput, StyleSheet, ScrollView, SectionList,
} from 'react-native';
import { Entity, Spell, CharClass, matchesRuleset } from '../../engine/types';
import { spellRepo } from '../../content/spellRepo';
import type { SpellIndexEntry } from '../../content/spellRepo.types';
import { mergeSpellIndex } from '../../content/contentResolution';
import { actionType, ACTION_TYPES } from '../../content/spellFilterUtils';
import { spellSortOptions } from '../../content/spells/spellBrowse';
import { classDisplayName } from '../../content/classes/classBrowse';
import { sortByOption } from '../../content/contentQuery';
import { SortControl } from '../SortControl';
import { useHomebrewStore } from '../../store/homebrewStore';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../theme';

interface Props {
  visible: boolean;
  entity:  Entity;
  onAdd:   (spellId: string, isCantrip: boolean) => void;
  onClose: () => void;
  /** Preset for the Official/Homebrew chip on open — e.g. the "Browse Spell
   *  Library" vs "Browse Homebrew" split in an "+ Add Additional Spell"
   *  menu. Defaults to 'all'; the chip stays fully editable afterward. */
  initialOfficialFilter?: 'all' | 'official' | 'homebrew';
}

const LEVEL_LABELS = ['Cantrip', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th'];

export function AddSpellModal({ visible, entity, onAdd, onClose, initialOfficialFilter = 'all' }: Props) {
  const homebrewSpells = useHomebrewStore(s => s.spells);
  const getMergedContentDB = useHomebrewStore(s => s.getMergedContentDB);
  const allClasses = getMergedContentDB().classes as CharClass[];

  // Merges the lightweight official index (Tier 1 — id/name/level/school/
  // classes/castingTime/ritual/concentration, no description) with homebrew,
  // which overrides by id — see contentResolution.ts. LIVE-RULESET-2 (item
  // 7): base-filtered by the character's own entity.rulesetId via the same
  // "untagged = shared" rule every other content pool uses — an untagged
  // spell (nearly all of them, spells have no real 5.5e-tagged content yet)
  // stays visible regardless; a spell explicitly tagged for a DIFFERENT
  // ruleset than the character's own is hidden. The manual Ruleset filter
  // chip row below stays a separate, narrower, player-driven override on
  // top of this base filter, not a replacement for it.
  const allSpells = useMemo<SpellIndexEntry[]>(
    () => mergeSpellIndex(homebrewSpells).filter(s => matchesRuleset(s.rulesetId, entity.rulesetId)),
    [homebrewSpells, entity.rulesetId],
  );

  const homebrewIds = useMemo(() => new Set(homebrewSpells.map(s => s.id)), [homebrewSpells]);

  // Full record for the currently-expanded row only — Tier 1 doesn't carry
  // description/upcast/components/duration/range, so fetch them on demand
  // (SQLite point-lookup by id, effectively instant) the moment a row is
  // expanded, rather than pulling every spell's full data into memory.
  const [expandedSpell, setExpandedSpell] = useState<Spell | null>(null);

  // Already on the character (cantrips + known)
  const ownedIds = useMemo(
    () => new Set([...(entity.spellcasting?.cantrips ?? []), ...(entity.spellcasting?.known ?? [])]),
    [entity.spellcasting],
  );

  // ── Filter state ──
  const [search,       setSearch]       = useState('');
  const [levelFilter,  setLevelFilter]  = useState<number | null>(null);
  const [schoolFilter, setSchoolFilter] = useState<string | null>(null);
  const [classFilter,  setClassFilter]  = useState<string | null>(null);
  const [actionFilter, setActionFilter] = useState<string | null>(null);
  const [concOnly,     setConcOnly]     = useState(false);
  const [ritualOnly,   setRitualOnly]   = useState(false);
  const [officialFilter, setOfficialFilter] = useState<'all' | 'official' | 'homebrew'>(initialOfficialFilter);
  // TIER1-EXT-1: Ruleset/Components(V/S/M) — now real, Tier-1 fields.
  const [rulesetFilter, setRulesetFilter] = useState<string | null>(null);
  const [componentFilter, setComponentFilter] = useState<Set<string>>(new Set());
  // LIVE-RULESET-2 (item 8): this modal stays mounted across opens (visible
  // toggles, the component doesn't unmount), so a manually-chosen Ruleset
  // chip survives a live character ruleset switch. Left alone, it would
  // become an impossible stale filter — exact-matching a ruleset the
  // character (and the base filter above) has already moved on from,
  // potentially hiding every result. Reset ONLY this one filter on a real
  // ruleset change; every other filter/search/sort is untouched.
  useEffect(() => {
    setRulesetFilter(null);
  }, [entity.rulesetId]);
  const sortOptions = spellSortOptions(s => homebrewIds.has(s.id));
  const [sort,         setSort]         = useState('level');

  // Distinct schools & classes present, for the chip rows.
  const schools = useMemo(
    () => Array.from(new Set(allSpells.map(s => s.school))).sort(),
    [allSpells],
  );
  const classes = useMemo(
    () => Array.from(new Set(allSpells.flatMap(s => s.classes ?? []))).sort(),
    [allSpells],
  );
  const rulesets = useMemo(
    () => Array.from(new Set(allSpells.map(s => s.rulesetId).filter((r): r is NonNullable<typeof r> => !!r))).map(String).sort(),
    [allSpells],
  );
  const components = useMemo(
    () => Array.from(new Set(allSpells.flatMap(s => s.components ?? []))).sort(),
    [allSpells],
  );

  const q = search.trim().toLowerCase();
  const filtered = allSpells.filter(s => {
    if (q && !s.name.toLowerCase().includes(q) && !s.school.toLowerCase().includes(q)) return false;
    if (levelFilter !== null && s.level !== levelFilter) return false;
    if (schoolFilter && s.school !== schoolFilter) return false;
    if (classFilter && !(s.classes ?? []).includes(classFilter)) return false;
    if (actionFilter && actionType(s) !== actionFilter) return false;
    if (concOnly && !s.concentration) return false;
    if (ritualOnly && !s.ritual) return false;
    if (officialFilter !== 'all' && (officialFilter === 'homebrew') !== homebrewIds.has(s.id)) return false;
    if (rulesetFilter && s.rulesetId !== rulesetFilter) return false;
    if (componentFilter.size > 0 && !Array.from(componentFilter).some(c => (s.components ?? []).includes(c))) return false;
    return true;
  });

  // Grouped by level for SectionList (virtualized — previously a plain
  // ScrollView.map() over the full spell corpus, which could be 300+ spells
  // with no filters applied. See docs/ROADMAP_1.0.md Phase 3.5.)
  const sections = useMemo(() => {
    const m = new Map<number, SpellIndexEntry[]>();
    for (const s of filtered) {
      if (!m.has(s.level)) m.set(s.level, []);
      m.get(s.level)!.push(s);
    }
    const levels = Array.from(m.keys()).sort((a, b) => a - b);
    return levels.map(lvl => ({
      level: lvl,
      title: lvl === 0 ? 'CANTRIPS' : `LEVEL ${lvl}`,
      data:  sortByOption(m.get(lvl)!, sortOptions, sort),
    }));
  }, [filtered, sort, sortOptions]);

  const activeFilterCount =
    (levelFilter !== null ? 1 : 0) + (schoolFilter ? 1 : 0) + (classFilter ? 1 : 0) +
    (actionFilter ? 1 : 0) + (concOnly ? 1 : 0) + (ritualOnly ? 1 : 0) +
    (officialFilter !== 'all' ? 1 : 0) + (rulesetFilter ? 1 : 0) + componentFilter.size;

  function clearFilters() {
    setLevelFilter(null); setSchoolFilter(null); setClassFilter(null);
    setActionFilter(null); setConcOnly(false); setRitualOnly(false);
    setOfficialFilter('all'); setRulesetFilter(null); setComponentFilter(new Set());
  }

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    if (!expandedId) { setExpandedSpell(null); return; }
    const homebrew = homebrewSpells.find(s => s.id === expandedId);
    if (homebrew) { setExpandedSpell(homebrew); return; }
    let cancelled = false;
    setExpandedSpell(null);
    spellRepo.ensureLoaded([expandedId]).then(() => {
      if (!cancelled) setExpandedSpell(spellRepo.getSpellSync(expandedId) ?? null);
    });
    return () => { cancelled = true; };
  }, [expandedId, homebrewSpells]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable style={s.sheet} onPress={e => e.stopPropagation()}>

          <View style={s.headerRow}>
            <Text style={s.title}>Add Spell</Text>
          </View>

          <TextInput
            style={s.search}
            value={search}
            onChangeText={setSearch}
            placeholder="Search spells…"
            placeholderTextColor={Colors.textDim}
            autoFocus
          />

          {/* Filters dropdown toggle */}
          <View style={s.filterBar}>
            <View style={s.filterBarLeft}>
              <Pressable style={s.filterToggle} onPress={() => setFiltersOpen(o => !o)}>
                <Text style={s.filterToggleTxt}>
                  {filtersOpen ? '▲' : '▼'} Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
                </Text>
              </Pressable>
              {activeFilterCount > 0 && (
                <Pressable style={s.clearBtn} onPress={clearFilters}>
                  <Text style={s.clearTxt}>Clear ({activeFilterCount})</Text>
                </Pressable>
              )}
            </View>
            <SortControl options={sortOptions} value={sort} onChange={setSort} />
          </View>

          {filtersOpen && (
            <View style={s.filterPanel}>
              {/* Level filter chips */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false}
                style={s.chipRow} contentContainerStyle={s.chipRowContent}>
                <FilterChip label="All levels" active={levelFilter === null} onPress={() => setLevelFilter(null)} />
                {LEVEL_LABELS.map((lbl, lvl) => (
                  <FilterChip key={lvl} label={lbl} active={levelFilter === lvl}
                    onPress={() => setLevelFilter(l => l === lvl ? null : lvl)} />
                ))}
              </ScrollView>

              {/* School filter chips */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false}
                style={s.chipRow} contentContainerStyle={s.chipRowContent}>
                <FilterChip label="All schools" active={!schoolFilter} onPress={() => setSchoolFilter(null)} />
                {schools.map(sc => (
                  <FilterChip key={sc} label={sc} active={schoolFilter === sc}
                    onPress={() => setSchoolFilter(p => p === sc ? null : sc)} />
                ))}
              </ScrollView>

              {/* Class filter chips */}
              {classes.length > 1 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}
                  style={s.chipRow} contentContainerStyle={s.chipRowContent}>
                  <FilterChip label="All classes" active={!classFilter} onPress={() => setClassFilter(null)} />
                  {classes.map(c => (
                    <FilterChip key={c} label={classDisplayName(c, allClasses)} active={classFilter === c}
                      onPress={() => setClassFilter(p => p === c ? null : c)} />
                  ))}
                </ScrollView>
              )}

              {/* Action-type + toggles */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false}
                style={s.chipRow} contentContainerStyle={s.chipRowContent}>
                {ACTION_TYPES.map(at => (
                  <FilterChip key={at} label={at} active={actionFilter === at}
                    onPress={() => setActionFilter(p => p === at ? null : at)} />
                ))}
                <FilterChip label="🧠 Concentration" active={concOnly} onPress={() => setConcOnly(v => !v)} />
                <FilterChip label="📿 Ritual" active={ritualOnly} onPress={() => setRitualOnly(v => !v)} />
              </ScrollView>

              {/* Official/Homebrew */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false}
                style={s.chipRow} contentContainerStyle={s.chipRowContent}>
                <FilterChip label="All" active={officialFilter === 'all'} onPress={() => setOfficialFilter('all')} />
                <FilterChip label="Official" active={officialFilter === 'official'} onPress={() => setOfficialFilter(p => p === 'official' ? 'all' : 'official')} />
                <FilterChip label="Homebrew" active={officialFilter === 'homebrew'} onPress={() => setOfficialFilter(p => p === 'homebrew' ? 'all' : 'homebrew')} />
              </ScrollView>

              {/* Ruleset — real, sparsely populated; TIER1-EXT-1 */}
              {rulesets.length > 1 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}
                  style={s.chipRow} contentContainerStyle={s.chipRowContent}>
                  <FilterChip label="All rulesets" active={!rulesetFilter} onPress={() => setRulesetFilter(null)} />
                  {rulesets.map(r => (
                    <FilterChip key={r} label={r} active={rulesetFilter === r}
                      onPress={() => setRulesetFilter(p => p === r ? null : r)} />
                  ))}
                </ScrollView>
              )}

              {/* Components (V/S/M) — real, TIER1-EXT-1 */}
              {components.length > 1 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}
                  style={s.chipRow} contentContainerStyle={s.chipRowContent}>
                  {components.map(c => (
                    <FilterChip key={c} label={c} active={componentFilter.has(c)}
                      onPress={() => setComponentFilter(prev => {
                        const next = new Set(prev);
                        if (next.has(c)) next.delete(c); else next.add(c);
                        return next;
                      })} />
                  ))}
                </ScrollView>
              )}
            </View>
          )}

          {/* Results grouped by level with gold headers — SectionList for
              virtualization, since this can be the full spell corpus with no
              filters applied. */}
          <SectionList
            style={s.results}
            sections={sections}
            keyExtractor={item => item.id}
            showsVerticalScrollIndicator={false}
            stickySectionHeadersEnabled={false}
            ListEmptyComponent={<Text style={s.empty}>No spells match these filters.</Text>}
            renderSectionHeader={({ section }) => (
              <View style={s.levelHeaderRow}>
                <Text style={s.levelHeader}>{section.title}</Text>
                <View style={s.levelHeaderLine} />
                <Text style={s.levelHeaderCount}>{section.data.length}</Text>
              </View>
            )}
            renderItem={({ item: spell }) => {
              const owned = ownedIds.has(spell.id);
              const open  = expandedId === spell.id;
              return (
                <View style={[s.spellRow, owned && s.spellRowOwned]}>
                  <Pressable style={s.spellMain} onPress={() => setExpandedId(o => o === spell.id ? null : spell.id)}>
                    <View style={s.spellInfo}>
                      <View style={s.spellNameRow}>
                        <Text style={[s.spellName, owned && s.spellNameOwned]}>{spell.name}</Text>
                        {homebrewIds.has(spell.id) && (
                          <View style={s.hbTag}><Text style={s.hbTagTxt}>HB</Text></View>
                        )}
                      </View>
                      <Text style={s.spellMeta} numberOfLines={1}>
                        {spell.school} · {spell.castingTime}
                        {spell.concentration ? ' · Conc' : ''}
                        {spell.ritual ? ' · Ritual' : ''}
                      </Text>
                      {open && (
                        <Text style={s.spellDesc}>
                          {expandedSpell?.id === spell.id ? expandedSpell.description : 'Loading…'}
                        </Text>
                      )}
                    </View>
                  </Pressable>
                  {owned ? (
                    <Text style={s.ownedBadge}>Known</Text>
                  ) : (
                    <Pressable style={s.addBtn} onPress={() => onAdd(spell.id, spell.level === 0)}>
                      <Text style={s.addBtnTxt}>+ Add</Text>
                    </Pressable>
                  )}
                </View>
              );
            }}
          />

          <Pressable style={s.doneBtn} onPress={onClose}>
            <Text style={s.doneTxt}>Done</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={[s.chip, active && s.chipActive]} onPress={onPress}>
      <Text style={[s.chipTxt, active && s.chipTxtActive]}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#000000cc', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.surfaceHigh,
    borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg,
    padding: Spacing.md, gap: Spacing.xs, paddingBottom: Spacing.xl, maxHeight: '94%',
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  clearBtn: {
    backgroundColor: Colors.red + '22', borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.red + '44',
    paddingHorizontal: Spacing.sm, paddingVertical: 3,
  },
  clearTxt: { fontSize: FontSize.xs, color: Colors.red, fontWeight: FontWeight.bold },
  filterBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: Spacing.xs, marginBottom: 2 },
  filterBarLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  filterToggle: {
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.sm, paddingVertical: 5,
  },
  filterToggleTxt: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.bold },
  filterPanel: {
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.xs, gap: 2, marginBottom: Spacing.xs,
  },
  search: {
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.sm, color: Colors.textPrimary, fontSize: FontSize.md,
    marginVertical: Spacing.xs,
  },

  chipRow: { flexGrow: 0, marginBottom: 2 },
  chipRowContent: { gap: Spacing.xs, paddingVertical: 2 },
  chip: {
    backgroundColor: Colors.surface, borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.sm, paddingVertical: 4,
  },
  chipActive: { backgroundColor: Colors.gold + '22', borderColor: Colors.gold },
  chipTxt:       { fontSize: FontSize.xs, color: Colors.textSecondary },
  chipTxtActive: { color: Colors.gold, fontWeight: FontWeight.bold },

  results: { maxHeight: 420, marginTop: Spacing.xs },
  empty: { color: Colors.textDim, fontStyle: 'italic', textAlign: 'center', padding: Spacing.lg },

  levelBlock: { marginBottom: Spacing.sm },
  levelHeaderRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    marginTop: Spacing.sm, marginBottom: Spacing.xs,
  },
  levelHeader: {
    fontSize: FontSize.lg, fontWeight: FontWeight.black,
    color: Colors.gold, letterSpacing: 2,
  },
  levelHeaderLine: { flex: 1, height: 2, backgroundColor: Colors.gold + '44', borderRadius: 1 },
  levelHeaderCount: { fontSize: FontSize.sm, color: Colors.textDim },

  spellRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingVertical: Spacing.sm, paddingHorizontal: Spacing.xs,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  spellRowOwned: { opacity: 0.5 },
  spellMain: { flex: 1 },
  spellInfo: { flex: 1 },
  spellNameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  spellName:     { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  spellNameOwned:{ color: Colors.textDim },
  spellMeta:     { fontSize: FontSize.xs, color: Colors.textDim, marginTop: 1 },
  spellDesc:     { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: Spacing.xs, lineHeight: 19 },
  hbTag: {
    backgroundColor: Colors.gold + '22', borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.gold + '66', paddingHorizontal: 5, paddingVertical: 1,
  },
  hbTagTxt: { fontSize: 9, color: Colors.gold, fontWeight: FontWeight.bold },
  addBtn: {
    backgroundColor: Colors.gold + '22', borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.gold + '66',
    paddingHorizontal: Spacing.sm, paddingVertical: 4,
  },
  addBtnTxt: { fontSize: FontSize.xs, color: Colors.gold, fontWeight: FontWeight.bold },
  ownedBadge: { fontSize: FontSize.xs, color: Colors.textDim, fontStyle: 'italic' },

  doneBtn: {
    backgroundColor: Colors.gold, borderRadius: Radius.md,
    padding: Spacing.md, alignItems: 'center', marginTop: Spacing.sm,
  },
  doneTxt: { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.md },
});
