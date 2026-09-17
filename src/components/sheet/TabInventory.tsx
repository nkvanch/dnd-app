// src/components/sheet/TabInventory.tsx
// Tab — Equipped items, carried items, currency.
// Supports adding items from the content DB (or homebrew),
// removing items, and adjusting money per denomination.
// Large creature rules are surfaced when the character is Large-sized.
import { useState, useMemo, useEffect, memo } from 'react';
import {
  ScrollView, View, Text, Pressable, StyleSheet,
  Modal, TextInput, SectionList, Image,
} from 'react-native';
import { Entity, ItemInstance, Item, Currency, CampaignRules, matchesRuleset, RulesetId } from '../../engine/types';
import { Alert } from '../../utils/alert';
import { applyStatModifiers, collectAllEffects } from '../../engine/pipeline';
import type { ItemIndexEntry } from '../../content/itemRepo.types';
import { mergeItemIndex, resolveItemById } from '../../content/contentResolution';
import { useHomebrewStore } from '../../store/homebrewStore';
import { usesLargeCreatureWeaponDice } from '../../engine/houseRules';
import { ALL_INFUSIONS, maxInfusedItems } from '../../content/infusions';
import { itemRequiresAttunement, attunementCap, countAttuned } from '../../engine/inventory';
import { NonSrdBadge, isNonSrd } from '../NonSrdBadge';
import {
  isMagic, isWeapon, isRangedWeapon, isMartialWeapon, armorWeight, isArmorItem,
  isShield, isAmmo, isToolOrKit, isFocus, itemCategory, ITEM_CATEGORY_LABELS,
  type ItemCategoryId, RARITY_TIERS, rarityOf, itemSortOptions, buildSimpleCustomItem,
} from '../../content/items/itemBrowse';
import { sortByOption } from '../../content/contentQuery';
import { SortControl } from '../SortControl';
import { FilterChipRow, MultiSelectChipRow, FilterSection, OfficialHomebrewChipRow, ActiveFilterChips } from '../FilterChipRow';
import { useBrowseStateStore } from '../../store/browseStateStore';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../theme';

const ITEM_PICKER_SCREEN_KEY = 'item_picker';

const DAMAGE_TYPES = [
  'acid', 'bludgeoning', 'cold', 'fire', 'force', 'lightning', 'necrotic',
  'piercing', 'poison', 'psychic', 'radiant', 'slashing', 'thunder',
];

// ── Large creature detection ───────────────────────────────────────────────────

const LARGE_SUBRACE_IDS  = new Set(['skeleton_giant']);
const LARGE_RACE_IDS     = new Set<string>(); // extend as more Large races are added

function isLargeCreature(entity: Entity): boolean {
  if (entity.identity.subRaceId && LARGE_SUBRACE_IDS.has(entity.identity.subRaceId)) return true;
  if (entity.identity.raceId    && LARGE_RACE_IDS.has(entity.identity.raceId))       return true;
  return entity.features.some(f => f.id === 'skeleton_giant_remains');
}

// ── Currency helpers ───────────────────────────────────────────────────────────

const COIN_KEYS: (keyof Currency)[] = ['pp', 'gp', 'ep', 'sp', 'cp'];
const COIN_COLORS: Record<keyof Currency, string> = {
  pp: Colors.blue,
  gp: Colors.gold,
  ep: Colors.textSecondary,
  sp: Colors.textSecondary,
  cp: Colors.textSecondary,
};

// ── Item categories ───────────────────────────────────────────────────────────
// Classification helpers (isMagic/isWeapon/isRangedWeapon/isMartialWeapon/
// armorWeight/isArmorItem/isShield/isAmmo/isToolOrKit/isFocus) now live in
// src/content/items/itemBrowse.ts as the shared, independent-axis primitives
// — see that file's header. ITEM_CATEGORIES/categorise below stay as the
// results screen's own PRESENTATION grouping (a combined "Magic Weapons —
// Martial Melee"-style label reads fine as a section header); the actual
// FILTER controls in AddItemModal go through itemBrowse.ts's independent
// Category/Magical/WeaponClass/WeaponRange/ArmorWeight fields instead of
// matching against one of these 25 combined labels.

type ItemCategory = {
  label:  string;
  emoji:  string;
  test:   (item: ItemIndexEntry) => boolean;
};

function isArmor(i: ItemIndexEntry, weight: 'heavy' | 'medium' | 'light'): boolean {
  return armorWeight(i) === weight;
}

const ITEM_CATEGORIES: ItemCategory[] = [
  // ── Magic equipment, sub-typed like mundane gear ──
  {
    label: 'Magic Weapons — Martial Melee',
    emoji: '✨⚔️',
    test: i => isMagic(i) && isWeapon(i) && !isRangedWeapon(i) && isMartialWeapon(i),
  },
  {
    label: 'Magic Weapons — Simple Melee',
    emoji: '✨🗡️',
    test: i => isMagic(i) && isWeapon(i) && !isRangedWeapon(i) && !isMartialWeapon(i),
  },
  {
    label: 'Magic Weapons — Martial Ranged',
    emoji: '✨🏹',
    test: i => isMagic(i) && isWeapon(i) && isRangedWeapon(i) && isMartialWeapon(i),
  },
  {
    label: 'Magic Weapons — Simple Ranged',
    emoji: '✨🎟️',
    test: i => isMagic(i) && isWeapon(i) && isRangedWeapon(i) && !isMartialWeapon(i),
  },
  {
    label: 'Magic Weapons — Other',
    emoji: '✨☄️',
    test: i => isMagic(i) && isWeapon(i),  // weapon but base type unidentifiable
  },
  { label: 'Magic Heavy Armor',  emoji: '✨🛡️', test: i => isMagic(i) && isArmor(i, 'heavy') },
  { label: 'Magic Medium Armor', emoji: '✨🥋', test: i => isMagic(i) && isArmor(i, 'medium') },
  { label: 'Magic Light Armor',  emoji: '✨👕', test: i => isMagic(i) && isArmor(i, 'light') },
  { label: 'Magic Armor — Other', emoji: '✨🧥', test: i => isMagic(i) && isArmorItem(i) },
  { label: 'Magic Shields',      emoji: '✨🔰', test: i => isMagic(i) && isShield(i) },
  { label: 'Magic Ammunition',   emoji: '✨🎯', test: i => isMagic(i) && isAmmo(i) },
  { label: 'Magic Tools & Kits', emoji: '✨🔧', test: i => isMagic(i) && isToolOrKit(i) },
  { label: 'Magic Focuses',      emoji: '✨🔮', test: i => isMagic(i) && isFocus(i) },
  { label: 'Wondrous & Other Magic', emoji: '✨', test: i => isMagic(i) }, // remaining magic

  // ── Mundane weapons by category ──
  { label: 'Weapons — Martial Melee',  emoji: '⚔️', test: i => isWeapon(i) && !isRangedWeapon(i) && isMartialWeapon(i) },
  { label: 'Weapons — Simple Melee',   emoji: '🗡️', test: i => isWeapon(i) && !isRangedWeapon(i) && !isMartialWeapon(i) },
  { label: 'Weapons — Martial Ranged', emoji: '🏹', test: i => isWeapon(i) && isRangedWeapon(i) && isMartialWeapon(i) },
  { label: 'Weapons — Simple Ranged',  emoji: '🎟️', test: i => isWeapon(i) && isRangedWeapon(i) && !isMartialWeapon(i) },

  // ── Mundane armor by weight ──
  { label: 'Heavy Armor',  emoji: '🛡️', test: i => isArmor(i, 'heavy') },
  { label: 'Medium Armor', emoji: '🥋', test: i => isArmor(i, 'medium') },
  { label: 'Light Armor',  emoji: '👕', test: i => isArmor(i, 'light') },
  { label: 'Armor — Other', emoji: '🧥', test: i => isArmorItem(i) },
  { label: 'Shields',      emoji: '🔰', test: i => isShield(i) },
  { label: 'Ammunition',   emoji: '🎯', test: i => isAmmo(i) && !isWeapon(i) },
  { label: 'Tools & Kits', emoji: '🔧', test: i => isToolOrKit(i) },
  { label: 'Spellcasting Focuses', emoji: '🔮', test: i => isFocus(i) },
  { label: 'Adventuring Gear', emoji: '🎒', test: () => true }, // catch-all
];

function categorise(items: ItemIndexEntry[]): { cat: ItemCategory; items: ItemIndexEntry[] }[] {
  const result: { cat: ItemCategory; items: ItemIndexEntry[] }[] = [];
  const assigned = new Set<string>();
  for (const cat of ITEM_CATEGORIES) {
    const matched = items.filter(i => !assigned.has(i.id) && cat.test(i));
    if (matched.length > 0) {
      matched.forEach(i => assigned.add(i.id));
      result.push({ cat, items: matched });
    }
  }
  return result;
}

// ── Sorting ─────────────────────────────────────────────────────────────
// Sort options (A–Z/Z–A/Rarity/Value/Weight/Source) now come from the
// shared itemSortOptions()/SortControl (src/content/items/itemBrowse.ts),
// same pattern as every other content type this pass.

// ── Add Item Modal ─────────────────────────────────────────────────────────────

function AddItemModal({
  visible, entityRulesetId, equippedIds, carriedIds, onAdd, onClose,
}: {
  visible:     boolean;
  /** LIVE-RULESET-2 (item 7): the character's entity.rulesetId, passed by
   *  name rather than the whole Entity — this modal otherwise has no need
   *  for one. Base-filters the pool the same "untagged = shared" way every
   *  other content pool does. */
  entityRulesetId: Entity['rulesetId'];
  equippedIds: Set<string>;
  carriedIds:  Set<string>;
  onAdd:       (itemId: string) => void;
  onClose:     () => void;
}) {
  const homebrewItems = useHomebrewStore(s => s.items);
  const saveHomebrew  = useHomebrewStore(s => s.saveItem);
  const homebrewItemIds = new Set(homebrewItems.map(i => i.id));
  // BROWSE-STATE-1: this modal is conditionally mounted (`{addOpen &&
  // <AddItemModal/>}` in the parent, for perf — see that call site's own
  // comment), so its internal state would otherwise reset every time it's
  // reopened. Restore/persist via the shared browseStateStore instead.
  const savedItemPicker = useBrowseStateStore.getState().getBrowseState(ITEM_PICKER_SCREEN_KEY);
  const setBrowseState = useBrowseStateStore(s => s.setBrowseState);
  const savedItemFilters = savedItemPicker.filters ?? {};
  const [search,    setSearch]    = useState(savedItemPicker.search ?? '');
  const [expanded, setExpanded]  = useState<string | null>(null);
  // Independent-axis filters (SHARED-QUERY-1): Category/Magical/WeaponClass/
  // WeaponRange/ArmorWeight/Rarity are each their own field — never combined
  // into one taxonomy string like the old "Magic Weapons — Martial Melee"
  // catFilter this replaces. See itemBrowse.ts's header comment.
  const [categoryFilter, setCategoryFilter] = useState<ItemCategoryId | null>((savedItemFilters.categoryFilter as ItemCategoryId) ?? null);
  const [magicalFilter, setMagicalFilter] = useState<'all' | 'magical' | 'mundane'>((savedItemFilters.magicalFilter as 'all' | 'magical' | 'mundane') ?? 'all');
  const [weaponClassFilter, setWeaponClassFilter] = useState<'martial' | 'simple' | null>((savedItemFilters.weaponClassFilter as 'martial' | 'simple') ?? null);
  const [weaponRangeFilter, setWeaponRangeFilter] = useState<'melee' | 'ranged' | null>((savedItemFilters.weaponRangeFilter as 'melee' | 'ranged') ?? null);
  const [armorWeightFilter, setArmorWeightFilter] = useState<'heavy' | 'medium' | 'light' | null>((savedItemFilters.armorWeightFilter as 'heavy' | 'medium' | 'light') ?? null);
  const [rarityFilter, setRarityFilter] = useState<Set<string>>(new Set((savedItemFilters.rarityFilter as string[]) ?? []));
  const sortOptions = itemSortOptions(i => homebrewItemIds.has(i.id));
  const [sort, setSort] = useState(savedItemPicker.sort ?? 'name_asc');
  // Official/Homebrew — real, homebrewItemIds membership (already computed
  // below for the row badge, now also drives an actual filter). Requires
  // Attunement — real, itemRequiresAttunement() works off Tier-1 fields
  // (id/properties) alone, no Tier-2 load needed. Ruleset — TIER1-EXT-1:
  // now a real Tier-1 field too (ItemIndexEntry was extended). Source/Pack
  // via getContentProvenance() is not wired here: Item has no per-item
  // sourcebook field at all (only Feat does), so the derived label would
  // only ever be "SRD 5.1" or undefined — the existing NonSrdBadge per row
  // already communicates that narrower signal.
  const [officialFilter, setOfficialFilter] = useState<'all' | 'official' | 'homebrew'>((savedItemFilters.officialFilter as 'all' | 'official' | 'homebrew') ?? 'all');
  const [attunementOnly, setAttunementOnly] = useState(!!savedItemFilters.attunementOnly);
  // LIVE-RULESET-2 (item 8): this filter is persisted via browseStateStore
  // and shared by KEY across every character/session (ITEM_PICKER_SCREEN_KEY
  // isn't per-character) — restoring it blindly on mount (this modal is
  // conditionally mounted, remounting fresh every time the picker opens)
  // could resurrect a filter chosen for a DIFFERENT character's ruleset,
  // which combined with the ruleset-aware base filter below could leave
  // the picker showing zero items with no obvious reason why. Restored
  // only when it was persisted alongside a matching rulesetFilterSetFor —
  // every other persisted filter/search/sort restores unconditionally, so
  // this doesn't cost any of that preservation.
  const [rulesetFilter, setRulesetFilter] = useState<string | null>(
    savedItemFilters.rulesetFilterSetFor === entityRulesetId ? (savedItemFilters.rulesetFilter as string) ?? null : null
  );
  useEffect(() => {
    setBrowseState(ITEM_PICKER_SCREEN_KEY, {
      search, sort,
      filters: {
        categoryFilter, magicalFilter, weaponClassFilter, weaponRangeFilter, armorWeightFilter,
        rarityFilter: Array.from(rarityFilter), officialFilter, attunementOnly, rulesetFilter,
        // LIVE-RULESET-2 (item 8): which character's ruleset rulesetFilter
        // was actually chosen under — read back on next mount to decide
        // whether it's still valid. See the state init above.
        rulesetFilterSetFor: entityRulesetId,
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, sort, categoryFilter, magicalFilter, weaponClassFilter, weaponRangeFilter, armorWeightFilter, rarityFilter, officialFilter, attunementOnly, rulesetFilter, entityRulesetId]);
  // Quick-add custom item form
  const [quickOpen, setQuickOpen] = useState(false);
  const [qName,  setQName]  = useState('');
  const [qType,  setQType]  = useState('');
  const [qDesc,  setQDesc]  = useState('');
  // Collapsible filters dropdown
  const [filtersOpen, setFiltersOpen] = useState(false);

  async function handleQuickAdd() {
    const name = qName.trim();
    if (!name) return;
    const custom = buildSimpleCustomItem(name, qType, qDesc);
    await saveHomebrew('item', custom);
    onAdd(custom.id);
    setQName(''); setQType(''); setQDesc(''); setQuickOpen(false);
  }


  // Deduped by id, homebrew wins on collision — see contentResolution.ts.
  // (Previously a plain concat with no dedup: a homebrew item reusing an
  // official id would show up as two separate rows.)
  const allItems: ItemIndexEntry[] = mergeItemIndex(homebrewItems);
  const q = search.trim().toLowerCase();
  // LIVE-RULESET-2 (item 7/8): the manual Ruleset chip OVERRIDES the
  // character's own ruleset when set (an explicit "show me ONLY this
  // ruleset's items" ask), otherwise falls back to matchesRuleset against
  // entityRulesetId — the same "untagged = shared, tagged-different =
  // hidden" rule every other content pool uses, so the picker defaults to
  // the character's own ruleset with nothing chosen. Stacking both
  // (base-filter AND a differently-valued manual chip) would make the
  // manual chip permanently show zero results whenever it names a ruleset
  // other than the character's own — override, not intersect.
  const effectiveRulesetFilter = (rulesetFilter as RulesetId | null) ?? entityRulesetId;
  const searchFiltered = allItems
    .filter(i => !q || i.name.toLowerCase().includes(q) || i.properties.some(p => p.toLowerCase().includes(q)))
    .filter(i => officialFilter === 'all' || (officialFilter === 'homebrew') === homebrewItemIds.has(i.id))
    .filter(i => !attunementOnly || itemRequiresAttunement(i))
    .filter(i => matchesRuleset(i.rulesetId, effectiveRulesetFilter))
    .filter(i => !categoryFilter || itemCategory(i) === categoryFilter)
    .filter(i => magicalFilter === 'all' || (magicalFilter === 'magical') === isMagic(i))
    .filter(i => !weaponClassFilter || (itemCategory(i) === 'weapon' && (weaponClassFilter === 'martial' ? isMartialWeapon(i) : !isMartialWeapon(i))))
    .filter(i => !weaponRangeFilter || (itemCategory(i) === 'weapon' && (weaponRangeFilter === 'ranged' ? isRangedWeapon(i) : !isRangedWeapon(i))))
    .filter(i => !armorWeightFilter || armorWeight(i) === armorWeightFilter)
    .filter(i => rarityFilter.size === 0 || (rarityOf(i) !== null && rarityFilter.has(rarityOf(i)!)));
  const availableItemRulesets = Array.from(new Set(allItems.map(i => i.rulesetId).filter((r): r is NonNullable<typeof r> => !!r))).map(String);
  const availableRarities = RARITY_TIERS.filter(r => allItems.some(i => rarityOf(i) === r));

  const groups = categorise(searchFiltered).map(g => ({
    ...g,
    items: sortByOption(g.items, sortOptions, sort),
  }));
  const activeFilterCount =
    (categoryFilter ? 1 : 0) + (magicalFilter !== 'all' ? 1 : 0) + (weaponClassFilter ? 1 : 0) +
    (weaponRangeFilter ? 1 : 0) + (armorWeightFilter ? 1 : 0) + rarityFilter.size +
    (officialFilter !== 'all' ? 1 : 0) + (attunementOnly ? 1 : 0) + (rulesetFilter ? 1 : 0);
  function clearAllItemFilters() {
    setCategoryFilter(null); setMagicalFilter('all'); setWeaponClassFilter(null);
    setWeaponRangeFilter(null); setArmorWeightFilter(null); setRarityFilter(new Set());
    setOfficialFilter('all'); setAttunementOnly(false); setRulesetFilter(null);
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={addStyles.backdrop} onPress={onClose}>
        <Pressable style={addStyles.sheet} onPress={e => e.stopPropagation()}>
          <View style={addStyles.titleRow}>
            <Text style={addStyles.title}>Add Item</Text>
            <Pressable
              style={[addStyles.quickToggle, quickOpen && addStyles.quickToggleActive]}
              onPress={() => setQuickOpen(o => !o)}
            >
              <Text style={[addStyles.quickToggleTxt, quickOpen && addStyles.quickToggleTxtActive]}>
                {quickOpen ? '× Cancel' : '+ Custom item'}
              </Text>
            </Pressable>
          </View>

          {/* Quick-add custom (homebrew) item form */}
          {quickOpen && (
            <View style={addStyles.quickForm}>
              <TextInput
                style={addStyles.quickInput}
                value={qName}
                onChangeText={setQName}
                placeholder="Item name (required)"
                placeholderTextColor={Colors.textDim}
                autoFocus
              />
              <TextInput
                style={addStyles.quickInput}
                value={qType}
                onChangeText={setQType}
                placeholder="Properties, comma-separated (e.g. magic item, wondrous)"
                placeholderTextColor={Colors.textDim}
              />
              <TextInput
                style={[addStyles.quickInput, addStyles.quickInputMulti]}
                value={qDesc}
                onChangeText={setQDesc}
                placeholder="Description (optional)"
                placeholderTextColor={Colors.textDim}
                multiline
              />
              <Pressable
                style={[addStyles.quickAddBtn, !qName.trim() && addStyles.quickAddBtnDisabled]}
                onPress={handleQuickAdd}
                disabled={!qName.trim()}
              >
                <Text style={addStyles.quickAddBtnTxt}>Create & Add to Bag</Text>
              </Pressable>
            </View>
          )}
          <TextInput
            style={addStyles.search}
            value={search}
            onChangeText={setSearch}
            placeholder="Search all items…"
            placeholderTextColor={Colors.textDim}
            autoFocus
          />

          {/* Filters dropdown toggle */}
          <View style={addStyles.filterBar}>
            <Pressable style={addStyles.filterToggle} onPress={() => setFiltersOpen(o => !o)}>
              <Text style={addStyles.filterToggleTxt}>
                {filtersOpen ? '▲' : '▼'} Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
              </Text>
            </Pressable>
            <SortControl options={sortOptions} value={sort} onChange={setSort} />
          </View>

          {filtersOpen && (
            <View style={addStyles.filterPanel}>
              <FilterSection label="Category">
                <FilterChipRow
                  options={(Object.keys(ITEM_CATEGORY_LABELS) as ItemCategoryId[]).map(id => ({ id, label: ITEM_CATEGORY_LABELS[id] }))}
                  value={categoryFilter}
                  onChange={setCategoryFilter}
                  scrollable
                />
              </FilterSection>
              <FilterSection label="Magical / Mundane">
                <FilterChipRow
                  options={[{ id: 'magical' as const, label: 'Magical' }, { id: 'mundane' as const, label: 'Mundane' }]}
                  value={magicalFilter === 'all' ? null : magicalFilter}
                  onChange={v => setMagicalFilter(v ?? 'all')}
                />
              </FilterSection>
              {categoryFilter === 'weapon' && (
                <>
                  <FilterSection label="Weapon Class">
                    <FilterChipRow
                      options={[{ id: 'martial' as const, label: 'Martial' }, { id: 'simple' as const, label: 'Simple' }]}
                      value={weaponClassFilter}
                      onChange={setWeaponClassFilter}
                    />
                  </FilterSection>
                  <FilterSection label="Weapon Range">
                    <FilterChipRow
                      options={[{ id: 'melee' as const, label: 'Melee' }, { id: 'ranged' as const, label: 'Ranged' }]}
                      value={weaponRangeFilter}
                      onChange={setWeaponRangeFilter}
                    />
                  </FilterSection>
                </>
              )}
              {categoryFilter === 'armor' && (
                <FilterSection label="Armor Class">
                  <FilterChipRow
                    options={[{ id: 'heavy' as const, label: 'Heavy' }, { id: 'medium' as const, label: 'Medium' }, { id: 'light' as const, label: 'Light' }]}
                    value={armorWeightFilter}
                    onChange={setArmorWeightFilter}
                  />
                </FilterSection>
              )}
              {availableRarities.length > 0 && (
                <FilterSection label="Rarity">
                  <MultiSelectChipRow
                    options={availableRarities.map(r => ({ id: r, label: r[0].toUpperCase() + r.slice(1) }))}
                    values={rarityFilter}
                    onChange={setRarityFilter}
                  />
                </FilterSection>
              )}
              <FilterSection label="Official / Homebrew">
                <OfficialHomebrewChipRow value={officialFilter} onChange={setOfficialFilter} />
              </FilterSection>
              <Pressable
                style={[addStyles.chip, attunementOnly && addStyles.chipActive, addStyles.attunementToggle]}
                onPress={() => setAttunementOnly(v => !v)}
              >
                <Text style={[addStyles.chipTxt, attunementOnly && addStyles.chipTxtActive]}>Requires Attunement</Text>
              </Pressable>
              {availableItemRulesets.length > 1 && (
                <FilterSection label="Ruleset">
                  <FilterChipRow
                    options={availableItemRulesets.map(r => ({ id: r, label: r }))}
                    value={rulesetFilter}
                    onChange={setRulesetFilter}
                  />
                </FilterSection>
              )}
            </View>
          )}
          <ActiveFilterChips
            chips={[
              ...(categoryFilter ? [{ key: 'cat', label: ITEM_CATEGORY_LABELS[categoryFilter], onClear: () => setCategoryFilter(null) }] : []),
              ...(magicalFilter !== 'all' ? [{ key: 'magic', label: magicalFilter === 'magical' ? 'Magical' : 'Mundane', onClear: () => setMagicalFilter('all') }] : []),
              ...(weaponClassFilter ? [{ key: 'wclass', label: weaponClassFilter === 'martial' ? 'Martial' : 'Simple', onClear: () => setWeaponClassFilter(null) }] : []),
              ...(weaponRangeFilter ? [{ key: 'wrange', label: weaponRangeFilter === 'ranged' ? 'Ranged' : 'Melee', onClear: () => setWeaponRangeFilter(null) }] : []),
              ...(armorWeightFilter ? [{ key: 'aweight', label: armorWeightFilter[0].toUpperCase() + armorWeightFilter.slice(1), onClear: () => setArmorWeightFilter(null) }] : []),
              ...Array.from(rarityFilter).map(r => ({ key: `rarity_${r}`, label: r[0].toUpperCase() + r.slice(1), onClear: () => setRarityFilter(prev => { const n = new Set(prev); n.delete(r); return n; }) })),
              ...(officialFilter !== 'all' ? [{ key: 'official', label: officialFilter === 'official' ? 'Official' : 'Homebrew', onClear: () => setOfficialFilter('all') }] : []),
              ...(attunementOnly ? [{ key: 'attune', label: 'Requires Attunement', onClear: () => setAttunementOnly(false) }] : []),
              ...(rulesetFilter ? [{ key: 'ruleset', label: rulesetFilter, onClear: () => setRulesetFilter(null) }] : []),
            ]}
            onClearAll={clearAllItemFilters}
          />

          {/* Results grouped by category — SectionList for virtualization,
              since a broad search can force-expand many categories at once
              across a 920-item catalog. See docs/ROADMAP_1.0.md Phase 3.5. */}
          {groups.length === 0 ? (
            <Text style={addStyles.empty}>No items match "{search}".</Text>
          ) : (
            <SectionList
              style={{ maxHeight: 420 }}
              sections={groups.map(({ cat, items }) => ({
                catLabel:   cat.label,
                emoji:      cat.emoji,
                totalCount: items.length,
                // Collapsed categories render zero items (still show their
                // header) — same UX as before, but now virtualized for
                // whichever section(s) actually have visible data.
                data: (expanded === cat.label || !!q || !!categoryFilter) ? items : [],
              }))}
              keyExtractor={item => item.id}
              showsVerticalScrollIndicator={false}
              stickySectionHeadersEnabled={false}
              renderSectionHeader={({ section }) => (
                <Pressable
                  style={addStyles.groupHeader}
                  onPress={() => setExpanded(e => e === section.catLabel ? null : section.catLabel)}
                >
                  <Text style={addStyles.groupEmoji}>{section.emoji}</Text>
                  <Text style={addStyles.groupLabel}>{section.catLabel}</Text>
                  <Text style={addStyles.groupCount}>({section.totalCount})</Text>
                  <Text style={addStyles.groupCaret}>
                    {expanded === section.catLabel || q ? '▲' : '▼'}
                  </Text>
                </Pressable>
              )}
              renderItem={({ item }) => {
                // Owning one already doesn't block adding more — carrying
                // multiple of the same item (arrows, potions, torches) is
                // normal, so "+ Add" always stays tappable; it stacks onto
                // the existing carried entry (see handleAddItem) rather
                // than blocking or duplicating a row.
                const owned = equippedIds.has(item.id) || carriedIds.has(item.id);
                return (
                  <View style={[addStyles.itemRow, owned && addStyles.itemRowOwned]}>
                    <View style={addStyles.itemInfo}>
                      <View style={addStyles.itemNameLine}>
                        <Text style={[addStyles.itemName, owned && addStyles.itemNameOwned]}>
                          {item.name}
                        </Text>
                        {!homebrewItemIds.has(item.id) && isNonSrd(item.srd) && <NonSrdBadge />}
                      </View>
                      {item.properties.length > 0 && (
                        <Text style={addStyles.itemProps} numberOfLines={1}>
                          {item.properties.join(' · ')}
                        </Text>
                      )}
                      {item.cost !== '0 gp' && item.cost && (
                        <Text style={addStyles.itemCost}>{item.cost}</Text>
                      )}
                    </View>
                    <View style={addStyles.itemActions}>
                      {owned && (
                        <Text style={addStyles.ownedBadge}>
                          {equippedIds.has(item.id) ? 'Equipped' : 'In bag'}
                        </Text>
                      )}
                      <Pressable
                        style={addStyles.addBtn}
                        onPress={() => { onAdd(item.id); }}
                      >
                        <Text style={addStyles.addBtnTxt}>{owned ? '+1' : '+ Add'}</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              }}
            />
          )}
          <Pressable style={addStyles.cancelBtn} onPress={onClose}>
            <Text style={addStyles.cancelTxt}>Close</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const addStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#000000bb', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.surfaceHigh,
    borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg,
    padding: Spacing.md, gap: Spacing.sm, paddingBottom: Spacing.xxl,
    maxHeight: '90%',
  },
  title:  { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  quickToggle: {
    backgroundColor: Colors.gold + '22', borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.gold + '66',
    paddingHorizontal: Spacing.sm, paddingVertical: 3,
  },
  quickToggleActive: { backgroundColor: Colors.red + '22', borderColor: Colors.red + '66' },
  quickToggleTxt: { fontSize: FontSize.xs, color: Colors.gold, fontWeight: FontWeight.bold },
  quickToggleTxtActive: { color: Colors.red },
  quickForm: {
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.gold + '44',
    padding: Spacing.sm, gap: Spacing.xs,
  },
  quickInput: {
    backgroundColor: Colors.surfaceHigh, borderRadius: Radius.sm,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.sm, color: Colors.textPrimary, fontSize: FontSize.sm,
  },
  quickInputMulti: { minHeight: 60, textAlignVertical: 'top' },
  quickAddBtn: {
    backgroundColor: Colors.gold, borderRadius: Radius.md,
    padding: Spacing.sm, alignItems: 'center',
  },
  quickAddBtnDisabled: { opacity: 0.4 },
  quickAddBtnTxt: { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.sm },
  chipRowContent: { gap: Spacing.xs, paddingVertical: 2 },
  chip: {
    backgroundColor: Colors.surface, borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.sm, paddingVertical: 4,
  },
  chipActive: { backgroundColor: Colors.gold + '22', borderColor: Colors.gold },
  chipTxt:       { fontSize: FontSize.xs, color: Colors.textSecondary },
  chipTxtActive: { color: Colors.gold, fontWeight: FontWeight.bold },
  attunementToggle: { alignSelf: 'flex-start', marginBottom: Spacing.sm },
  filterBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: Spacing.xs, marginBottom: 2 },
  filterToggle: {
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.sm, paddingVertical: 5,
  },
  filterToggleTxt: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.bold },
  filterPanel: {
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.xs, marginBottom: Spacing.xs,
  },
  search: {
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.sm, color: Colors.textPrimary, fontSize: FontSize.md,
  },
  group:       { marginBottom: 2 },
  groupHeader: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    backgroundColor: Colors.surface, borderRadius: Radius.sm,
    paddingVertical: Spacing.xs, paddingHorizontal: Spacing.sm, marginBottom: 2,
  },
  groupEmoji:  { fontSize: FontSize.sm },
  groupLabel:  { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: FontWeight.bold, letterSpacing: 1, flex: 1 },
  groupCount:  { fontSize: FontSize.xs, color: Colors.textDim },
  groupCaret:  { fontSize: FontSize.xs, color: Colors.textDim, marginLeft: 4 },
  itemRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: Spacing.sm, paddingHorizontal: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    gap: Spacing.sm,
  },
  // Owned rows used to dim to 0.5 opacity — dropped that now that "+ Add"
  // stays live on them (they're still addable, not a disabled state).
  itemRowOwned: {},
  itemInfo:     { flex: 1 },
  itemNameLine: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  itemName:     { fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: FontWeight.bold },
  itemNameOwned:{ color: Colors.textPrimary },
  itemProps:    { fontSize: FontSize.xs, color: Colors.textDim, marginTop: 1 },
  itemCost:     { fontSize: FontSize.xs, color: Colors.gold, marginTop: 1 },
  itemActions:  { alignItems: 'flex-end', gap: 4 },
  addBtn: {
    backgroundColor: Colors.gold + '22', borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.gold + '66',
    paddingHorizontal: Spacing.sm, paddingVertical: 3,
  },
  addBtnTxt:   { fontSize: FontSize.xs, color: Colors.gold, fontWeight: FontWeight.bold },
  ownedBadge:  { fontSize: FontSize.xs, color: Colors.textDim, fontStyle: 'italic' },
  empty:       { color: Colors.textDim, fontStyle: 'italic', textAlign: 'center', padding: Spacing.lg },
  cancelBtn:   { alignItems: 'center', padding: Spacing.sm },
  cancelTxt:   { color: Colors.textSecondary, fontSize: FontSize.md },
});

// ── Currency Modal ─────────────────────────────────────────────────────────────

function CurrencyModal({
  visible, currency, onSave, onClose,
}: {
  visible:  boolean;
  currency: Currency;
  onSave:   (c: Currency) => void;
  onClose:  () => void;
}) {
  const [values, setValues] = useState<Record<keyof Currency, string>>({
    pp: String(currency.pp),
    gp: String(currency.gp),
    ep: String(currency.ep),
    sp: String(currency.sp),
    cp: String(currency.cp),
  });

  function handleSave() {
    const next: Currency = {
      pp: Math.max(0, parseInt(values.pp, 10) || 0),
      gp: Math.max(0, parseInt(values.gp, 10) || 0),
      ep: Math.max(0, parseInt(values.ep, 10) || 0),
      sp: Math.max(0, parseInt(values.sp, 10) || 0),
      cp: Math.max(0, parseInt(values.cp, 10) || 0),
    };
    onSave(next);
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={currStyles.backdrop} onPress={onClose}>
        <Pressable style={currStyles.sheet} onPress={e => e.stopPropagation()}>
          <Text style={currStyles.title}>Edit Currency</Text>
          <View style={currStyles.grid}>
            {COIN_KEYS.map(key => (
              <View key={key} style={currStyles.coinEdit}>
                <Text style={[currStyles.coinLabel, { color: COIN_COLORS[key] }]}>
                  {key.toUpperCase()}
                </Text>
                <TextInput
                  style={currStyles.coinInput}
                  value={values[key]}
                  onChangeText={v => setValues(prev => ({ ...prev, [key]: v }))}
                  keyboardType="numeric"
                  selectTextOnFocus
                />
              </View>
            ))}
          </View>
          <View style={currStyles.btns}>
            <Pressable style={currStyles.cancelBtn} onPress={onClose}>
              <Text style={currStyles.cancelTxt}>Cancel</Text>
            </Pressable>
            <Pressable style={currStyles.saveBtn} onPress={handleSave}>
              <Text style={currStyles.saveTxt}>Save</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const currStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#000000bb', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.surfaceHigh,
    borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg,
    padding: Spacing.lg, gap: Spacing.md, paddingBottom: Spacing.xxl,
  },
  title: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  grid:  { flexDirection: 'row', gap: Spacing.sm },
  coinEdit:  { flex: 1, alignItems: 'center', gap: Spacing.xs },
  coinLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, letterSpacing: 1 },
  coinInput: {
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.sm, color: Colors.textPrimary,
    fontSize: FontSize.lg, fontWeight: FontWeight.bold,
    textAlign: 'center', width: '100%',
  },
  btns: { flexDirection: 'row', gap: Spacing.sm },
  cancelBtn: { flex: 1, alignItems: 'center', padding: Spacing.sm },
  cancelTxt: { color: Colors.textSecondary, fontSize: FontSize.md },
  saveBtn:   { flex: 2, backgroundColor: Colors.gold, borderRadius: Radius.md, padding: Spacing.sm, alignItems: 'center' },
  saveTxt:   { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.md },
});

// ── Infuse Item Modal ───────────────────────────────────────────────────────────

function InfuseItemModal({
  visible, entity, allItems, onApply, onClose,
}: {
  visible:  boolean;
  entity:   Entity;
  allItems: Item[];
  onApply:  (itemId: string, infusionId: string, damageType?: string) => void;
  onClose:  () => void;
}) {
  const known = entity.knownInfusionIds ?? [];
  const knownInfusions = ALL_INFUSIONS.filter(i => known.includes(i.id));
  const [selectedInfusion, setSelectedInfusion] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [damageType, setDamageType] = useState<string>('fire');

  const cap = maxInfusedItems(entity.identity.level);
  const infusedInstances = [...entity.inventory.equipped, ...entity.inventory.carried].filter(i => i.infusedWith);
  const atCap = infusedInstances.length >= cap;
  const ownedInstances = [...entity.inventory.equipped, ...entity.inventory.carried].filter(i => !i.infusedWith);

  function reset() {
    setSelectedInfusion(null);
    setSelectedItem(null);
    setDamageType('fire');
  }

  function handleClose() {
    reset();
    onClose();
  }

  function handleApply() {
    if (!selectedInfusion || !selectedItem || atCap) return;
    onApply(selectedItem, selectedInfusion, selectedInfusion === 'resistant_armor' ? damageType : undefined);
    reset();
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <Pressable style={addStyles.backdrop} onPress={handleClose}>
        <Pressable style={addStyles.sheet} onPress={e => e.stopPropagation()}>
          <Text style={addStyles.title}>Infuse an Item</Text>
          <Text style={infuseStyles.capNote}>{infusedInstances.length}/{cap} items currently infused</Text>
          {atCap && <Text style={infuseStyles.warn}>At capacity — remove an infusion before adding another.</Text>}

          <Text style={infuseStyles.stepLabel}>1. Choose infusion</Text>
          <ScrollView style={infuseStyles.pickList}>
            {knownInfusions.map(inf => (
              <Pressable
                key={inf.id}
                style={[infuseStyles.row, selectedInfusion === inf.id && infuseStyles.rowSelected]}
                onPress={() => setSelectedInfusion(inf.id)}
              >
                <Text style={infuseStyles.rowTxt}>{inf.name}{!inf.feature ? ' (flavor-only)' : ''}</Text>
              </Pressable>
            ))}
            {knownInfusions.length === 0 && <Text style={addStyles.empty}>No infusions known yet.</Text>}
          </ScrollView>

          {selectedInfusion === 'resistant_armor' && (
            <>
              <Text style={infuseStyles.stepLabel}>Damage type</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={addStyles.chipRowContent}>
                {DAMAGE_TYPES.map(dt => (
                  <Pressable
                    key={dt}
                    style={[addStyles.chip, damageType === dt && addStyles.chipActive]}
                    onPress={() => setDamageType(dt)}
                  >
                    <Text style={[addStyles.chipTxt, damageType === dt && addStyles.chipTxtActive]}>{dt}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </>
          )}

          <Text style={infuseStyles.stepLabel}>2. Choose item</Text>
          <ScrollView style={infuseStyles.pickList}>
            {ownedInstances.map((inst, idx) => {
              const def = allItems.find(i => i.id === inst.itemId);
              return (
                <Pressable
                  key={`${inst.itemId}_${idx}`}
                  style={[infuseStyles.row, selectedItem === inst.itemId && infuseStyles.rowSelected]}
                  onPress={() => setSelectedItem(inst.itemId)}
                >
                  <Text style={infuseStyles.rowTxt}>{def?.name ?? inst.itemId}</Text>
                </Pressable>
              );
            })}
            {ownedInstances.length === 0 && <Text style={addStyles.empty}>No un-infused items to choose from.</Text>}
          </ScrollView>

          <Pressable
            style={[addStyles.quickAddBtn, (!selectedInfusion || !selectedItem || atCap) && addStyles.quickAddBtnDisabled]}
            disabled={!selectedInfusion || !selectedItem || atCap}
            onPress={handleApply}
          >
            <Text style={addStyles.quickAddBtnTxt}>Infuse Item</Text>
          </Pressable>
          <Pressable style={addStyles.cancelBtn} onPress={handleClose}>
            <Text style={addStyles.cancelTxt}>Close</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const infuseStyles = StyleSheet.create({
  capNote:   { fontSize: FontSize.xs, color: Colors.textSecondary },
  warn:      { fontSize: FontSize.xs, color: Colors.red },
  stepLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.gold, marginTop: Spacing.xs },
  pickList:  { maxHeight: 140 },
  row: {
    backgroundColor: Colors.surface, borderRadius: Radius.sm,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.sm, marginBottom: 4,
  },
  rowSelected: { borderColor: Colors.gold, backgroundColor: Colors.gold + '22' },
  rowTxt:      { fontSize: FontSize.sm, color: Colors.textPrimary },
});

// ── Item Row ───────────────────────────────────────────────────────────────────

function ItemRow({
  instance, equipped, allItems, onToggle, onRemove, onRemoveInfusion, onQuantityChange, onSetQuantity,
  onToggleAttune,
}: {
  instance: ItemInstance;
  equipped: boolean;
  allItems: Item[];
  onToggle: () => void;
  onRemove: () => void;
  onRemoveInfusion?: () => void;
  /** Carried-only — equipped rows don't get a stepper (see Props.onUpdateQuantity). */
  onQuantityChange?: (delta: number) => void;
  /** Carried-only — jump straight to an exact count (a stack of 20 arrows
   * doesn't want 20 taps of the +1 stepper). Committed on blur/submit, same
   * pattern as the Abilities tab's manual-bonus inputs. */
  onSetQuantity?: (quantity: number) => void;
  /** Present only when the item's definition requires attunement — the cap
   * check/explanatory Alert lives in the parent (it needs the whole
   * inventory to count), this just renders the toggle and calls back. */
  onToggleAttune?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const item  = allItems.find(i => i.id === instance.itemId);
  const name  = item?.name ?? instance.itemId;
  const props = item?.properties ?? [];
  const desc  = item?.features?.[0]?.description;
  const infusion = instance.infusedWith ? ALL_INFUSIONS.find(i => i.id === instance.infusedWith) : null;
  const needsAttunement = itemRequiresAttunement(item);

  return (
    <View style={styles.itemWrap}>
      <View style={styles.itemRow}>
        <Pressable style={styles.itemMain} onPress={() => setExpanded(e => !e)}>
          {item?.imageUri && <Image source={{ uri: item.imageUri }} style={styles.itemThumb} />}
          <View style={styles.itemInfo}>
            <Text style={styles.itemName}>{name}</Text>
            {props.length > 0 && (
              <Text style={styles.itemProps} numberOfLines={expanded ? undefined : 1}>
                {props.join(' · ')}
              </Text>
            )}
            {instance.quantity > 1 && (
              <Text style={styles.itemQty}>×{instance.quantity}</Text>
            )}
            {infusion && (
              <Text style={styles.itemInfused}>✨ Infused: {infusion.name}</Text>
            )}
            {needsAttunement && (
              <Text style={styles.itemAttunement}>{instance.attuned ? '🔗 Attuned' : '⚬ Requires attunement'}</Text>
            )}
          </View>
          <Text style={styles.expandCaret}>{expanded ? '▲' : '▼'}</Text>
        </Pressable>
        {needsAttunement && onToggleAttune && (
          <Pressable
            style={[styles.attuneBtn, instance.attuned && styles.attuneBtnActive]}
            onPress={onToggleAttune}
            hitSlop={8}
          >
            <Text style={[styles.attuneTxt, instance.attuned && styles.attuneTxtActive]}>
              {instance.attuned ? 'Attuned' : 'Attune'}
            </Text>
          </Pressable>
        )}
        <Pressable
          style={[styles.toggleBtn, equipped && styles.toggleBtnEquipped]}
          onPress={onToggle}
        >
          <Text style={[styles.toggleTxt, equipped && styles.toggleTxtEquipped]}>
            {equipped ? 'Unequip' : 'Equip'}
          </Text>
        </Pressable>
        <Pressable style={styles.removeBtn} onPress={onRemove} hitSlop={8}>
          <Text style={styles.removeTxt}>✕</Text>
        </Pressable>
      </View>
      {expanded && desc && (
        <View style={styles.itemDesc}>
          <Text style={styles.itemDescTxt}>{desc}</Text>
        </View>
      )}
      {expanded && onQuantityChange && (
        <View style={styles.qtyStepperRow}>
          <Text style={styles.qtyStepperLabel}>Quantity</Text>
          <View style={styles.qtyStepper}>
            <Pressable style={styles.qtyBtn} onPress={() => onQuantityChange(-1)} hitSlop={8}>
              <Text style={styles.qtyBtnTxt}>−</Text>
            </Pressable>
            {onSetQuantity ? (
              <TextInput
                key={instance.quantity}
                style={styles.qtyInput}
                defaultValue={String(instance.quantity)}
                keyboardType="number-pad"
                onEndEditing={e => {
                  const n = parseInt(e.nativeEvent.text, 10);
                  if (!isNaN(n) && n >= 0) onSetQuantity(n);
                }}
                onBlur={e => {
                  // react-native-web doesn't fire onEndEditing on blur (only
                  // native does) — read the live DOM value instead.
                  const raw = (e.target as unknown as { value?: string })?.value;
                  const n = raw !== undefined ? parseInt(raw, 10) : NaN;
                  if (!isNaN(n) && n >= 0) onSetQuantity(n);
                }}
              />
            ) : (
              <Text style={styles.qtyValue}>{instance.quantity}</Text>
            )}
            <Pressable style={styles.qtyBtn} onPress={() => onQuantityChange(1)} hitSlop={8}>
              <Text style={styles.qtyBtnTxt}>+</Text>
            </Pressable>
          </View>
        </View>
      )}
      {expanded && infusion && onRemoveInfusion && (
        <Pressable style={styles.removeInfusionBtn} onPress={onRemoveInfusion}>
          <Text style={styles.removeInfusionTxt}>Remove Infusion</Text>
        </Pressable>
      )}
    </View>
  );
}

// ── Main Tab ───────────────────────────────────────────────────────────────────

interface Props {
  entity:            Entity;
  onEquip:           (itemId: string) => void;
  onUnequip:         (itemId: string) => void;
  onAddItem:         (itemId: string) => void;
  onRemoveItem:      (itemId: string) => void;
  /** +/- stepper on a carried stack — delta is +1 or -1. Not offered for
   * equipped items (stacking multiple of a worn/wielded item doesn't mean
   * anything the sheet tracks). */
  onUpdateQuantity:  (itemId: string, delta: number) => void;
  /** Jump straight to an exact carried-stack count (typed, not tapped). */
  onSetQuantity:     (itemId: string, quantity: number) => void;
  onUpdateCurrency:  (currency: Currency) => void;
  /** Active campaign rules — used to honour homebrew toggles (e.g. large-creature dice). */
  rules?:            CampaignRules;
  /** Present only for classes with Infuse Item (Artificer) — omitted elsewhere. */
  onApplyInfusion?:  (itemId: string, infusionId: string, damageType?: string) => void;
  onRemoveInfusion?: (itemId: string) => void;
  onToggleAttune?:   (itemId: string) => void;
  /** Item 13 (loadouts) — save/apply/delete a named (equipped items,
   *  prepared spells) snapshot. Omitted entirely hides the section (same
   *  optional-prop pattern as onApplyInfusion). */
  onSaveLoadout?:    (name: string) => void;
  onApplyLoadout?:   (loadoutId: string) => void;
  onDeleteLoadout?:  (loadoutId: string) => void;
}

function TabInventoryInner({
  entity, onEquip, onUnequip, onAddItem, onRemoveItem, onUpdateQuantity, onSetQuantity, onUpdateCurrency, rules,
  onApplyInfusion, onRemoveInfusion, onToggleAttune, onSaveLoadout, onApplyLoadout, onDeleteLoadout,
}: Props) {
  const { inventory } = entity;
  const { currency }  = inventory;
  const [addOpen,    setAddOpen]    = useState(false);
  const [currOpen,   setCurrOpen]   = useState(false);
  const [infuseOpen, setInfuseOpen] = useState(false);
  const [loadoutName, setLoadoutName] = useState('');
  const knownInfusionIds = entity.knownInfusionIds ?? [];

  const homebrewItemList = useHomebrewStore(s => s.items);
  // Full records — only for equipped/carried instance ids (already warmed
  // via characterStore.ts's loadCharacters()/handleEquip/handleAddItem).
  // NOT the whole catalog — that's what itemRepo.getIndex() (Tier 1) is for,
  // used by AddItemModal. resolveItemById gives homebrew-first precedence —
  // see contentResolution.ts.
  const instanceIds = new Set([...inventory.equipped, ...inventory.carried].map(i => i.itemId));
  const allItems: Item[] = Array.from(instanceIds)
    .map(id => resolveItemById(id, homebrewItemList))
    .filter((i): i is Item => !!i);

  const large          = isLargeCreature(entity);
  // Effective STR (race/feat bonuses) — matches the engine's derived values,
  // not the raw base score. Memoized (ITEMS-PERF-3): was recomputed
  // (full effect-collection pass over entity.features) on every render of
  // this tab, including renders triggered by unrelated local state
  // (currOpen/infuseOpen/loadoutName toggles) that don't touch stats/effects.
  const effectiveStr  = useMemo(
    () => applyStatModifiers(entity.stats, collectAllEffects(entity)).str,
    [entity],
  );
  const carryCapacity  = effectiveStr * (large ? 30 : 15);
  const totalWeight    = [...inventory.equipped, ...inventory.carried].reduce((sum, inst) => {
    const def = allItems.find(i => i.id === inst.itemId);
    return sum + (def?.weight ?? 0) * inst.quantity;
  }, 0);
  const weightPct  = carryCapacity > 0 ? totalWeight / carryCapacity : 0;
  const weightColor = weightPct > 1 ? Colors.red : weightPct >= 0.75 ? Colors.gold : Colors.green;

  const equippedIds = new Set(inventory.equipped.map(i => i.itemId));
  const carriedIds  = new Set(inventory.carried.map(i => i.itemId));

  const attunedCount = countAttuned(entity);
  const attuneCap    = attunementCap(entity);

  function handleAttuneToggle(inst: ItemInstance) {
    if (!onToggleAttune) return;
    if (!inst.attuned && attunedCount >= attuneCap) {
      Alert.alert('Attunement Full', `You're already attuned to ${attuneCap} item${attuneCap === 1 ? '' : 's'} — un-attune from one first.`);
      return;
    }
    onToggleAttune(inst.itemId);
  }

  function confirmRemove(itemId: string) {
    const item = allItems.find(i => i.id === itemId);
    Alert.alert('Remove Item', `Remove ${item?.name ?? itemId} from your inventory?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => onRemoveItem(itemId) },
    ]);
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

      {/* Carry Weight */}
      <View style={styles.section}>
        <View style={styles.weightHeader}>
          <Text style={styles.sectionTitle}>WEIGHT</Text>
          <Text style={[styles.weightValue, { color: weightColor }]}>
            {Math.round(totalWeight * 10) / 10} / {carryCapacity} lbs
          </Text>
        </View>
        <View style={styles.weightBarOuter}>
          <View style={[styles.weightBarFill, {
            width: `${Math.round(Math.min(1, weightPct) * 100)}%` as any,
            backgroundColor: weightColor,
          }]} />
        </View>
        {weightPct > 1 && <Text style={styles.overweight}>⚠ Encumbered — over carry capacity</Text>}
        {large && (
          <Text style={styles.largePCNote}>
            🦴 Large creature — carry capacity doubled (STR × 30).
            {rules && usesLargeCreatureWeaponDice(rules)
              ? ' Homebrew: this creature rolls double weapon damage dice with appropriately sized weapons.'
              : ' (Standard rules: weapon damage dice are unaffected by size.)'}
          </Text>
        )}
      </View>

      {/* Currency */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>CURRENCY</Text>
          <Pressable style={styles.editCurrBtn} onPress={() => setCurrOpen(true)}>
            <Text style={styles.editCurrTxt}>Edit</Text>
          </Pressable>
        </View>
        <View style={styles.currencyRow}>
          {COIN_KEYS.map(key => (
            <View key={key} style={styles.coinBox}>
              <Text style={[styles.coinValue, { color: COIN_COLORS[key] }]}>{currency[key]}</Text>
              <Text style={styles.coinLabel}>{key.toUpperCase()}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Attunement — only shown once the character owns something that needs it */}
      {[...inventory.equipped, ...inventory.carried].some(inst => itemRequiresAttunement(allItems.find(i => i.id === inst.itemId))) && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ATTUNEMENT ({attunedCount}/{attuneCap})</Text>
        </View>
      )}

      {/* Infusions — only shown for classes that know at least one (Artificer) */}
      {onApplyInfusion && knownInfusionIds.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>
              INFUSIONS ({[...inventory.equipped, ...inventory.carried].filter(i => i.infusedWith).length}/{maxInfusedItems(entity.identity.level)})
            </Text>
            <Pressable style={styles.addBtn} onPress={() => setInfuseOpen(true)}>
              <Text style={styles.addBtnTxt}>+ Infuse Item</Text>
            </Pressable>
          </View>
          <Text style={styles.emptyNote}>
            Known: {knownInfusionIds.map(id => ALL_INFUSIONS.find(i => i.id === id)?.name ?? id).join(', ')}
          </Text>
        </View>
      )}

      {/* Loadouts (item 13) — named saved (equipped items, prepared
          spells) snapshots the player can swap between. Only shown when
          the parent screen wires the callbacks (mirrors onApplyInfusion's
          optional-prop pattern). */}
      {onSaveLoadout && (
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>LOADOUTS ({(entity.loadouts ?? []).length})</Text>
          </View>
          <View style={styles.loadoutSaveRow}>
            <TextInput
              style={styles.loadoutInput}
              value={loadoutName}
              onChangeText={setLoadoutName}
              placeholder="e.g. Dungeon, Social…"
              placeholderTextColor={Colors.textDim}
            />
            <Pressable
              style={[styles.addBtn, !loadoutName.trim() && styles.addBtnDisabled]}
              disabled={!loadoutName.trim()}
              onPress={() => { onSaveLoadout(loadoutName.trim()); setLoadoutName(''); }}
            >
              <Text style={styles.addBtnTxt}>💾 Save Current</Text>
            </Pressable>
          </View>
          {(entity.loadouts ?? []).length === 0 ? (
            <Text style={styles.emptyNote}>No saved loadouts yet</Text>
          ) : (
            (entity.loadouts ?? []).map(l => (
              <View key={l.id} style={styles.loadoutRow}>
                <View style={styles.loadoutInfo}>
                  <Text style={styles.loadoutName}>{l.name}</Text>
                  <Text style={styles.loadoutMeta}>
                    {l.equippedItemIds.length} equipped · {l.preparedSpellIds.length} prepared
                  </Text>
                </View>
                <Pressable style={styles.loadoutBtn} onPress={() => onApplyLoadout?.(l.id)}>
                  <Text style={styles.loadoutBtnTxt}>Apply</Text>
                </Pressable>
                <Pressable style={styles.loadoutBtnDelete} onPress={() => onDeleteLoadout?.(l.id)}>
                  <Text style={styles.loadoutBtnDeleteTxt}>✕</Text>
                </Pressable>
              </View>
            ))
          )}
        </View>
      )}

      {/* Equipped */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>EQUIPPED ({inventory.equipped.length})</Text>
          <Pressable style={styles.addBtn} onPress={() => setAddOpen(true)}>
            <Text style={styles.addBtnTxt}>+ Add Item</Text>
          </Pressable>
        </View>
        {inventory.equipped.length === 0 ? (
          <Text style={styles.emptyNote}>Nothing equipped</Text>
        ) : (
          inventory.equipped.map((inst, idx) => (
            <ItemRow
              key={`eq_${inst.itemId}_${idx}`}
              instance={inst}
              equipped
              allItems={allItems}
              onToggle={() => onUnequip(inst.itemId)}
              onRemove={() => confirmRemove(inst.itemId)}
              onRemoveInfusion={onRemoveInfusion ? () => onRemoveInfusion(inst.itemId) : undefined}
              onToggleAttune={onToggleAttune ? () => handleAttuneToggle(inst) : undefined}
            />
          ))
        )}
      </View>

      {/* Carried */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>CARRIED ({inventory.carried.length})</Text>
          {inventory.equipped.length > 0 ? null : (
            <Pressable style={styles.addBtn} onPress={() => setAddOpen(true)}>
              <Text style={styles.addBtnTxt}>+ Add Item</Text>
            </Pressable>
          )}
        </View>
        {inventory.carried.length === 0 ? (
          <Text style={styles.emptyNote}>Bag is empty — tap + Add Item to add gear</Text>
        ) : (
          inventory.carried.map((inst, idx) => (
            <ItemRow
              key={`ca_${inst.itemId}_${idx}`}
              instance={inst}
              equipped={false}
              allItems={allItems}
              onToggle={() => onEquip(inst.itemId)}
              onRemove={() => confirmRemove(inst.itemId)}
              onRemoveInfusion={onRemoveInfusion ? () => onRemoveInfusion(inst.itemId) : undefined}
              onQuantityChange={delta => onUpdateQuantity(inst.itemId, delta)}
              onSetQuantity={qty => onSetQuantity(inst.itemId, qty)}
              onToggleAttune={onToggleAttune ? () => handleAttuneToggle(inst) : undefined}
            />
          ))
        )}
        {/* Always show Add Item in carried section when bag is empty */}
        {inventory.carried.length === 0 && inventory.equipped.length > 0 && (
          <Pressable style={styles.addItemRow} onPress={() => setAddOpen(true)}>
            <Text style={styles.addBtnTxt}>+ Add Item to bag</Text>
          </Pressable>
        )}
      </View>

      {/* ITEMS-PERF-1: was unconditionally mounted with only `visible` gating
          RN Modal's native visibility — the component body (full ~891-item
          catalog merge + 27-category classification pass + sort, none of it
          memoized) still ran on every TabInventory render regardless of
          whether the picker was open. Gating the element itself means that
          work only happens while the picker is actually open. */}
      {addOpen && (
        <AddItemModal
          visible={addOpen}
          entityRulesetId={entity.rulesetId}
          equippedIds={equippedIds}
          carriedIds={carriedIds}
          onAdd={onAddItem}
          onClose={() => setAddOpen(false)}
        />
      )}

      <CurrencyModal
        visible={currOpen}
        currency={currency}
        onSave={onUpdateCurrency}
        onClose={() => setCurrOpen(false)}
      />

      {onApplyInfusion && (
        <InfuseItemModal
          visible={infuseOpen}
          entity={entity}
          allItems={allItems}
          onApply={onApplyInfusion}
          onClose={() => setInfuseOpen(false)}
        />
      )}

    </ScrollView>
  );
}

// EDIT-PERF-1: see TabCharacter.tsx's identical comment.
export const TabInventory = memo(TabInventoryInner);

const styles = StyleSheet.create({
  scroll:   { flex: 1 },
  content:  { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xxl },

  section: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, gap: Spacing.sm,
  },
  sectionTitle: { fontSize: FontSize.xs, color: Colors.textSecondary, letterSpacing: 2, fontWeight: FontWeight.bold },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  // Weight
  weightHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  weightValue:    { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  weightBarOuter: {
    width: '100%', height: 6, backgroundColor: Colors.border,
    borderRadius: Radius.full, overflow: 'hidden', marginTop: 2,
  },
  weightBarFill: { height: '100%', borderRadius: Radius.full },
  overweight:    { fontSize: FontSize.xs, color: Colors.red },
  largePCNote:   {
    fontSize: FontSize.xs, color: Colors.gold, lineHeight: 16,
    backgroundColor: Colors.gold + '11', borderRadius: Radius.sm,
    padding: Spacing.xs, borderLeftWidth: 2, borderLeftColor: Colors.gold,
  },

  // Currency
  editCurrBtn: {
    backgroundColor: Colors.surfaceHigh, borderRadius: Radius.sm,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.sm, paddingVertical: 2,
  },
  editCurrTxt:  { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: FontWeight.bold },
  currencyRow:  { flexDirection: 'row', justifyContent: 'space-around' },
  coinBox:      { alignItems: 'center', gap: 2 },
  coinValue:    { fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  coinLabel:    { fontSize: FontSize.xs, color: Colors.textDim, letterSpacing: 1 },

  // Add item button
  addBtn: {
    backgroundColor: Colors.gold + '22', borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.gold + '66',
    paddingHorizontal: Spacing.sm, paddingVertical: 2,
  },
  addBtnTxt: { fontSize: FontSize.xs, color: Colors.gold, fontWeight: FontWeight.bold },
  addBtnDisabled: { opacity: 0.4 },
  addItemRow: {
    paddingVertical: Spacing.sm, alignItems: 'center',
    borderTopWidth: 1, borderTopColor: Colors.border, marginTop: Spacing.xs,
  },

  // Item rows
  itemWrap: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  itemRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: Spacing.sm, gap: Spacing.xs,
  },
  itemMain:  { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  itemThumb: { width: 36, height: 36, borderRadius: Radius.sm, backgroundColor: Colors.surfaceHigh },
  itemInfo:  { flex: 1 },
  itemName:  { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  itemProps: { fontSize: FontSize.xs, color: Colors.textDim, marginTop: 1, lineHeight: 14 },
  itemQty:   { fontSize: FontSize.sm, color: Colors.textSecondary },
  itemInfused: { fontSize: FontSize.xs, color: Colors.purple, marginTop: 2, fontWeight: FontWeight.bold },
  itemAttunement: { fontSize: FontSize.xs, color: Colors.textDim, marginTop: 2 },
  qtyStepperRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.xs, paddingBottom: Spacing.xs,
  },
  qtyStepperLabel: { fontSize: FontSize.xs, color: Colors.textDim, fontWeight: FontWeight.bold },
  qtyStepper: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  qtyBtn: {
    width: 28, height: 28, borderRadius: Radius.sm, backgroundColor: Colors.surfaceHigh,
    borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center',
  },
  qtyBtnTxt: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.gold },
  qtyValue:  { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary, minWidth: 24, textAlign: 'center' },
  qtyInput: {
    fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary,
    minWidth: 40, textAlign: 'center', backgroundColor: Colors.surfaceHigh,
    borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border,
    paddingVertical: 2, paddingHorizontal: 4,
  },
  removeInfusionBtn: {
    alignItems: 'center', paddingVertical: Spacing.xs, marginBottom: Spacing.xs,
    backgroundColor: Colors.red + '11', borderRadius: Radius.sm,
  },
  removeInfusionTxt: { fontSize: FontSize.xs, color: Colors.red, fontWeight: FontWeight.bold },
  expandCaret: { fontSize: FontSize.xs, color: Colors.textDim, paddingHorizontal: 4 },
  itemDesc: {
    backgroundColor: Colors.surfaceHigh, borderRadius: Radius.sm,
    padding: Spacing.sm, marginBottom: Spacing.xs,
  },
  itemDescTxt: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },

  toggleBtn: {
    backgroundColor: Colors.surfaceHigh, borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm, paddingVertical: 4,
    borderWidth: 1, borderColor: Colors.border,
  },
  toggleBtnEquipped: { borderColor: Colors.gold + '88', backgroundColor: Colors.gold + '22' },
  toggleTxt:         { fontSize: FontSize.sm, color: Colors.textSecondary },
  toggleTxtEquipped: { color: Colors.gold, fontWeight: FontWeight.bold },

  attuneBtn: {
    backgroundColor: Colors.surfaceHigh, borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm, paddingVertical: 4,
    borderWidth: 1, borderColor: Colors.border,
  },
  attuneBtnActive: { borderColor: Colors.purple + '88', backgroundColor: Colors.purple + '22' },
  attuneTxt:        { fontSize: FontSize.sm, color: Colors.textSecondary },
  attuneTxtActive:  { color: Colors.purple, fontWeight: FontWeight.bold },

  removeBtn: { padding: 4 },
  removeTxt: { fontSize: FontSize.md, color: Colors.textDim },

  emptyNote: { color: Colors.textDim, fontSize: FontSize.sm, fontStyle: 'italic' },

  loadoutSaveRow: { flexDirection: 'row', gap: Spacing.xs, alignItems: 'center', marginTop: Spacing.xs },
  loadoutInput: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.sm, paddingVertical: 6, color: Colors.textPrimary,
  },
  loadoutRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    paddingVertical: Spacing.xs, borderTopWidth: 1, borderTopColor: Colors.border, marginTop: Spacing.xs,
  },
  loadoutInfo: { flex: 1 },
  loadoutName: { fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: FontWeight.bold },
  loadoutMeta: { fontSize: FontSize.xs, color: Colors.textDim },
  loadoutBtn: {
    backgroundColor: Colors.gold + '22', borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.gold + '66',
    paddingHorizontal: Spacing.sm, paddingVertical: 4,
  },
  loadoutBtnTxt: { fontSize: FontSize.xs, color: Colors.gold, fontWeight: FontWeight.bold },
  loadoutBtnDelete: { padding: 4 },
  loadoutBtnDeleteTxt: { fontSize: FontSize.md, color: Colors.textDim },
});
