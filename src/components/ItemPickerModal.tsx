// src/components/ItemPickerModal.tsx
// STARTING-EQUIPMENT-1 / ADDITIONAL-ITEM-1: one shared Item browser/picker
// with two context-aware modes, reusing itemBrowse.ts's independent-axis
// filters/sort — the same primitives TabInventory.tsx's AddItemModal and
// the Compendium's Item mode already use — rather than a third, parallel
// item-browsing implementation.
//
//   'required'   — RequiredEquipmentChoice context: a mandatory
//                  ItemFilterConstraint narrows the pool (never
//                  broadened by the player's own optional filters — those
//                  only narrow FURTHER), multi-select up to `quantity`
//                  (duplicates allowed, e.g. "2 Simple Melee Weapons" can
//                  legally be two daggers), Confirm enabled only at
//                  exactly `quantity` selected.
//   'additional'  — AdditionalEquipment context: unconstrained (or an
//                  initial Official/Homebrew preset for the "Browse Item
//                  Library" vs "Browse Homebrew" menu split), tap-to-add
//                  repeatedly, modal stays open (mirrors AddItemModal's
//                  own in-play behavior) — selections here never count
//                  toward a required-equipment counter.
import { itemsForRuleset } from '../content/itemEditions';
import { useState, useMemo, useEffect, useCallback } from 'react';
import { Modal, View, Text, Pressable, TextInput, StyleSheet, FlatList } from 'react-native';
import { ItemFilterConstraint } from '../engine/types';
import { ItemIndexEntry } from '../content/itemRepo.types';
import { useHomebrewStore } from '../store/homebrewStore';
import { useCharacterStore } from '../store/characterStore';
import { useBrowseStateStore } from '../store/browseStateStore';
import { mergeItemIndex } from '../content/contentResolution';
import {
  itemCategory, ITEM_CATEGORY_LABELS, type ItemCategoryId, isMagic, rarityOf, RARITY_TIERS,
  itemSortOptions, itemMatchesConstraint,
} from '../content/items/itemBrowse';
import { sortByOption, matchesSearchText } from '../content/contentQuery';
import { SortControl } from './SortControl';
import { FilterSection, FilterChipRow, MultiSelectChipRow, OfficialHomebrewChipRow } from './FilterChipRow';
import { NonSrdBadge, isNonSrd } from './NonSrdBadge';
import { Colors, Spacing, Radius, FontSize, FontWeight, scrollBottomPadding } from '../theme';
import { isStartingEquipmentItem } from '../content/items/equipmentDisplay';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Props {
  visible: boolean;
  title:   string;
  mode:    'required' | 'additional';
  /** 'required' mode only — the legal constraint, authoritative and never
   *  broadened by the player's own optional filters. */
  constraint?: ItemFilterConstraint;
  /** 'required' mode only — how many items must be selected. Default 1. */
  quantity?: number;
  /** 'additional' mode only — preset Official/Homebrew split for the
   *  "Browse Item Library" vs "Browse Homebrew" menu entries. */
  initialOfficialFilter?: 'all' | 'official' | 'homebrew';
  /** 'required' mode only — CONTROLLED selection (owned by the caller, not
   *  this component). Item ids selected so far, duplicates allowed. Lifted
   *  to the parent specifically so a "Create New Homebrew Item" trip into
   *  the builder and back doesn't lose in-progress picks — this
   *  component's own local state wouldn't reliably survive that round
   *  trip. Defaults to [] if omitted. */
  selected?: string[];
  onSelectedChange?: (next: string[]) => void;
  /** BROWSE-STATE-1: optional session-local persistence key for this
   *  picker's own search/filters/sort — "where practical" per the
   *  Starting Equipment spec; omit for a picker instance that doesn't need
   *  it (no risk to existing callers, since it's optional). */
  browseStateKey?: string;
  onConfirmRequired?: (itemIds: string[]) => void;
  onAddAdditional?:   (itemId: string) => void;
  /** 'required' mode only — renders a "+ Create New Homebrew Item" entry,
   *  called with the CURRENT remaining count (quantity - selected.length)
   *  so the caller can preserve it across the trip. Callback prop, not a
   *  direct useRouter import — same established pattern as
   *  AsiFeatPicker/SubclassPicker's onCreateNew* props, keeping this
   *  component importable by any future non-route consumer. */
  onCreateNewItem?: (remaining: number) => void;
  onClose: () => void;
}

export function ItemPickerModal({
  visible, title, mode, constraint, quantity = 1, initialOfficialFilter = 'all',
  selected: selectedProp, onSelectedChange, browseStateKey,
  onConfirmRequired, onAddAdditional, onCreateNewItem, onClose,
}: Props) {
  const insets = useSafeAreaInsets();
  const homebrewItems = useHomebrewStore(s => s.items);
  const draftRuleset = useCharacterStore(s => s.draft?.rulesetId);
  const allItems = useMemo(() => itemsForRuleset(mergeItemIndex(homebrewItems), draftRuleset), [homebrewItems, draftRuleset]);
  const homebrewIds = useMemo(() => new Set(homebrewItems.map(i => i.id)), [homebrewItems]);

  const savedBrowse = browseStateKey ? useBrowseStateStore.getState().getBrowseState(browseStateKey) : {};
  const savedFilters = savedBrowse.filters ?? {};
  const [search, setSearch] = useState(savedBrowse.search ?? '');
  const [officialFilter, setOfficialFilter] = useState<'all' | 'official' | 'homebrew'>(
    (savedFilters.officialFilter as 'all' | 'official' | 'homebrew') ?? initialOfficialFilter
  );
  const [categoryFilter, setCategoryFilter] = useState<ItemCategoryId | null>((savedFilters.categoryFilter as ItemCategoryId) ?? null);
  const [magicalFilter, setMagicalFilter] = useState<'all' | 'magical' | 'mundane'>((savedFilters.magicalFilter as 'all' | 'magical' | 'mundane') ?? 'all');
  const [rarityFilter, setRarityFilter] = useState<Set<string>>(new Set((savedFilters.rarityFilter as string[] | undefined) ?? []));
  const [sort, setSort] = useState(savedBrowse.sort ?? 'name_asc');
  const [filtersOpen, setFiltersOpen] = useState(false);
  // 'required' mode: item ids selected so far, duplicates allowed —
  // controlled from the parent (see selectedProp doc comment above).
  const selected = selectedProp ?? [];
  function setSelected(next: string[]) { onSelectedChange?.(next); }

  useEffect(() => {
    if (!browseStateKey) return;
    useBrowseStateStore.getState().setBrowseState(browseStateKey, {
      search, sort,
      filters: { officialFilter, categoryFilter, magicalFilter, rarityFilter: Array.from(rarityFilter) },
    });
  }, [browseStateKey, search, sort, officialFilter, categoryFilter, magicalFilter, rarityFilter]);

  const sortOptions = itemSortOptions(i => homebrewIds.has(i.id));

  const q = search.trim().toLowerCase();
  const filtered = useMemo(() => sortByOption(allItems.filter(i => {
    // The legal requirement is authoritative — never relaxed by the
    // player's own filters below, only narrowed further.
    if (mode === 'required' && (!isStartingEquipmentItem(i) || (constraint && !itemMatchesConstraint(i, constraint)))) return false;
    if (!matchesSearchText(i.name, [], q)) return false;
    if (officialFilter !== 'all' && (officialFilter === 'homebrew') !== homebrewIds.has(i.id)) return false;
    // Category is only offered as an optional filter when the constraint
    // itself hasn't already fixed it — re-showing a redundant, already-
    // pinned axis would just be confusing.
    if (!constraint?.category && categoryFilter && itemCategory(i) !== categoryFilter) return false;
    if (magicalFilter !== 'all' && (magicalFilter === 'magical') !== isMagic(i)) return false;
    if (rarityFilter.size > 0 && (rarityOf(i) === null || !rarityFilter.has(rarityOf(i)!))) return false;
    return true;
  }), sortOptions, sort), [allItems, q, officialFilter, categoryFilter, magicalFilter, rarityFilter, mode, constraint, sort, sortOptions, homebrewIds]);

  const availableRarities = RARITY_TIERS.filter(r => filtered.some(i => rarityOf(i) === r) || rarityFilter.has(r));

  function selectedCountFor(itemId: string): number {
    return selected.filter(id => id === itemId).length;
  }
  function addSelection(itemId: string) {
    if (selected.length >= quantity) return;
    setSelected([...selected, itemId]);
  }
  function removeSelection(itemId: string) {
    const idx = selected.indexOf(itemId);
    if (idx === -1) return;
    setSelected([...selected.slice(0, idx), ...selected.slice(idx + 1)]);
  }

  function handleClose() {
    setSearch('');
    onClose();
  }

  // Re-audit item 19: this modal's item row list used to be a plain
  // ScrollView + .map over the FULL merged catalog (hundreds of official
  // items alone) — every row mounted up front, blocking both
  // time-to-visible AND time-to-interactive (RN's touch responder wiring
  // for an unmounted-yet screen has to walk every mounted view). FlatList
  // only mounts what's near the visible window, virtualizing the rest.
  const renderRow = useCallback(({ item }: { item: ItemIndexEntry }) => {
    const count = selectedCountFor(item.id);
    return (
      <View style={s.row}>
        <View style={s.rowInfo}>
          <View style={s.rowNameLine}>
            <Text style={s.rowName}>{item.name}</Text>
            {!homebrewIds.has(item.id) && isNonSrd(item.srd, item.rulesetId) && <NonSrdBadge />}
          </View>
          {item.cost && item.cost !== '—' && <Text style={s.rowMeta}>{item.cost}</Text>}
        </View>
        {mode === 'required' ? (
          count > 0 ? (
            <View style={s.selectedControls}>
              <Pressable style={s.stepBtn} onPress={() => removeSelection(item.id)}><Text style={s.stepBtnTxt}>−</Text></Pressable>
              <Text style={s.selectedCount}>{count}</Text>
              <Pressable style={[s.stepBtn, selected.length >= quantity && s.stepBtnDisabled]} onPress={() => addSelection(item.id)} disabled={selected.length >= quantity}><Text style={s.stepBtnTxt}>+</Text></Pressable>
            </View>
          ) : (
            <Pressable style={[s.addBtn, selected.length >= quantity && s.addBtnDisabled]} onPress={() => addSelection(item.id)} disabled={selected.length >= quantity}>
              <Text style={s.addBtnTxt}>Select</Text>
            </Pressable>
          )
        ) : (
          <Pressable style={s.addBtn} onPress={() => onAddAdditional?.(item.id)}>
            <Text style={s.addBtnTxt}>+ Add</Text>
          </Pressable>
        )}
      </View>
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, selected, quantity, homebrewIds, onAddAdditional]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      {/* SCROLL-TOUCH-1: sheet is a plain View, backdrop a sibling — a Pressable
          ancestor claims touches on non-touchable rows and blocks list drags. */}
      <View style={s.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} accessible={false} />
        <View style={[s.sheet, { paddingBottom: scrollBottomPadding(insets.bottom, Spacing.md) }]}>
          <View style={s.headerRow}>
            <Text style={s.title}>{title}</Text>
            {mode === 'required' && (
              <Text style={s.progress}>Selected {selected.length}/{quantity}, Remaining {quantity - selected.length}</Text>
            )}
          </View>

          <TextInput
            style={s.search}
            value={search}
            onChangeText={setSearch}
            placeholder="Search items…"
            placeholderTextColor={Colors.textDim}
          />

          <View style={s.filterBar}>
            <Pressable style={s.filterToggle} onPress={() => setFiltersOpen(o => !o)}>
              <Text style={s.filterToggleTxt}>{filtersOpen ? '▲' : '▼'} Filters</Text>
            </Pressable>
            <SortControl options={sortOptions} value={sort} onChange={setSort} />
          </View>

          {filtersOpen && (
            <View style={s.filterPanel}>
              {!constraint?.category && (
                <FilterSection label="Category">
                  <FilterChipRow options={(Object.keys(ITEM_CATEGORY_LABELS) as ItemCategoryId[]).map(id => ({ id, label: ITEM_CATEGORY_LABELS[id] }))} value={categoryFilter} onChange={setCategoryFilter} scrollable />
                </FilterSection>
              )}
              <FilterSection label="Magical / Mundane">
                <FilterChipRow options={[{ id: 'magical' as const, label: 'Magical' }, { id: 'mundane' as const, label: 'Mundane' }]} value={magicalFilter === 'all' ? null : magicalFilter} onChange={v => setMagicalFilter(v ?? 'all')} />
              </FilterSection>
              {availableRarities.length > 0 && (
                <FilterSection label="Rarity">
                  <MultiSelectChipRow options={availableRarities.map(r => ({ id: r, label: r[0].toUpperCase() + r.slice(1) }))} values={rarityFilter} onChange={setRarityFilter} />
                </FilterSection>
              )}
              <FilterSection label="Official / Homebrew">
                <OfficialHomebrewChipRow value={officialFilter} onChange={setOfficialFilter} />
              </FilterSection>
            </View>
          )}

          {filtered.length === 0 ? (
            <Text style={s.empty}>No items match these filters.</Text>
          ) : (
            <FlatList
              style={s.results}
              data={filtered}
              keyExtractor={item => item.id}
              renderItem={renderRow}
              initialNumToRender={16}
              windowSize={7}
            />
          )}

          {mode === 'required' ? (
            <>
              {onCreateNewItem && (
                <Pressable style={s.createNewBtn} onPress={() => onCreateNewItem(quantity - selected.length)}>
                  <Text style={s.createNewBtnTxt}>+ Create New Homebrew Item</Text>
                </Pressable>
              )}
              <Pressable
                style={[s.confirmBtn, selected.length !== quantity && s.confirmBtnDisabled]}
                disabled={selected.length !== quantity}
                onPress={() => { onConfirmRequired?.(selected); setSelected([]); }}
              >
                <Text style={s.confirmBtnTxt}>Confirm ({selected.length}/{quantity})</Text>
              </Pressable>
            </>
          ) : (
            <Pressable style={s.doneBtn} onPress={handleClose}>
              <Text style={s.doneBtnTxt}>Done</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#000000cc', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.surfaceHigh,
    borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg,
    padding: Spacing.md, gap: Spacing.xs, paddingBottom: Spacing.xl, maxHeight: '90%',
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary, flex: 1 },
  progress: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.gold },
  search: {
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.sm, color: Colors.textPrimary, fontSize: FontSize.md,
  },
  filterBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.xs },
  filterToggle: {
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.sm, paddingVertical: 5,
  },
  filterToggleTxt: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.bold },
  filterPanel: {
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.xs, gap: 2,
  },
  results: { maxHeight: 340 },
  createNewBtn: {
    borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.gold,
    paddingVertical: Spacing.sm, alignItems: 'center', marginTop: Spacing.sm,
  },
  createNewBtnTxt: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.gold },
  empty: { color: Colors.textDim, fontStyle: 'italic', textAlign: 'center', padding: Spacing.lg },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingVertical: Spacing.sm, paddingHorizontal: Spacing.xs,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  rowInfo: { flex: 1 },
  rowNameLine: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  rowName: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  rowMeta: { fontSize: FontSize.xs, color: Colors.textDim, marginTop: 1 },
  addBtn: {
    backgroundColor: Colors.gold + '22', borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.gold + '66',
    paddingHorizontal: Spacing.sm, paddingVertical: 4,
  },
  addBtnDisabled: { opacity: 0.4 },
  addBtnTxt: { fontSize: FontSize.xs, color: Colors.gold, fontWeight: FontWeight.bold },
  selectedControls: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  stepBtn: {
    width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.gold, borderWidth: 1, borderColor: Colors.gold,
  },
  stepBtnDisabled: { backgroundColor: Colors.goldDim, borderColor: Colors.goldDim },
  stepBtnTxt: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.bg },
  selectedCount: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary, minWidth: 16, textAlign: 'center' },
  confirmBtn: {
    backgroundColor: Colors.gold, borderRadius: Radius.md,
    padding: Spacing.md, alignItems: 'center', marginTop: Spacing.sm,
  },
  confirmBtnDisabled: { backgroundColor: Colors.goldDim },
  confirmBtnTxt: { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.md },
  doneBtn: {
    backgroundColor: Colors.gold, borderRadius: Radius.md,
    padding: Spacing.md, alignItems: 'center', marginTop: Spacing.sm,
  },
  doneBtnTxt: { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.md },
});
