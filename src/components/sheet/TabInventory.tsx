// src/components/sheet/TabInventory.tsx
// Tab — Equipped items, carried items, currency.
// Supports adding items from the content DB (or homebrew),
// removing items, and adjusting money per denomination.
// Large creature rules are surfaced when the character is Large-sized.
import { useState } from 'react';
import {
  ScrollView, View, Text, Pressable, StyleSheet,
  Modal, TextInput, SectionList, Image,
} from 'react-native';
import { Entity, ItemInstance, Item, Currency, CampaignRules } from '../../engine/types';
import { Alert } from '../../utils/alert';
import { applyStatModifiers, collectAllEffects } from '../../engine/pipeline';
import type { ItemIndexEntry } from '../../content/itemRepo.types';
import { mergeItemIndex, resolveItemById } from '../../content/contentResolution';
import { useHomebrewStore } from '../../store/homebrewStore';
import { usesLargeCreatureWeaponDice } from '../../engine/houseRules';
import { ALL_INFUSIONS, maxInfusedItems } from '../../content/infusions';
import { itemRequiresAttunement, attunementCap, countAttuned } from '../../engine/inventory';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../theme';

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

type ItemCategory = {
  label:  string;
  emoji:  string;
  test:   (item: ItemIndexEntry) => boolean;
};

// ── Classification helpers ─────────────────────────────────────────────
// These all operate on ItemIndexEntry (Tier 1 — id/name/weight/cost/
// properties/hasDamageEffect/weaponRange) rather than the full Item record,
// since the Add Item browse list works off the lightweight index. A full
// Item satisfies ItemIndexEntry structurally, so these are just as usable
// wherever a real Item is already in hand (they're pure inspection
// functions — no mutation, no dependency on `features` beyond the two
// derived fields).

function propsLower(i: ItemIndexEntry): string[] {
  return i.properties.map(p => p.toLowerCase());
}
function isMagic(i: ItemIndexEntry): boolean {
  return propsLower(i).some(p => p.includes('magic') || p.includes('wondrous') || p.includes('artifact'));
}
// Canonical D&D 5e base weapons → { martial, ranged }. Magic weapons are typed
// only "Magic Weapon", so we recover the class from the base-weapon name in the
// item name (e.g. "Flame Tongue Greatsword" → greatsword → martial melee).
type WeaponClass = { martial: boolean; ranged: boolean };
const BASE_WEAPONS: Record<string, WeaponClass> = {
  club: { martial: false, ranged: false },
  dagger: { martial: false, ranged: false },
  greatclub: { martial: false, ranged: false },
  handaxe: { martial: false, ranged: false },
  javelin: { martial: false, ranged: false },
  'light hammer': { martial: false, ranged: false },
  mace: { martial: false, ranged: false },
  quarterstaff: { martial: false, ranged: false },
  sickle: { martial: false, ranged: false },
  spear: { martial: false, ranged: false },
  yklwa: { martial: false, ranged: false },
  'light crossbow': { martial: false, ranged: true },
  dart: { martial: false, ranged: true },
  shortbow: { martial: false, ranged: true },
  sling: { martial: false, ranged: true },
  battleaxe: { martial: true, ranged: false },
  flail: { martial: true, ranged: false },
  glaive: { martial: true, ranged: false },
  greataxe: { martial: true, ranged: false },
  greatsword: { martial: true, ranged: false },
  halberd: { martial: true, ranged: false },
  lance: { martial: true, ranged: false },
  longsword: { martial: true, ranged: false },
  maul: { martial: true, ranged: false },
  morningstar: { martial: true, ranged: false },
  pike: { martial: true, ranged: false },
  rapier: { martial: true, ranged: false },
  scimitar: { martial: true, ranged: false },
  shortsword: { martial: true, ranged: false },
  trident: { martial: true, ranged: false },
  'war pick': { martial: true, ranged: false },
  warhammer: { martial: true, ranged: false },
  whip: { martial: true, ranged: false },
  blowgun: { martial: true, ranged: true },
  'hand crossbow': { martial: true, ranged: true },
  'heavy crossbow': { martial: true, ranged: true },
  longbow: { martial: true, ranged: true },
  net: { martial: true, ranged: true },
};
const WEAPON_WORD_FALLBACK: Record<string, WeaponClass> = {
  sword: { martial: true, ranged: false },
  blade: { martial: true, ranged: false },
  axe: { martial: true, ranged: false },
  hammer: { martial: true, ranged: false },
  bow: { martial: true, ranged: true },
};

type ArmorWeight = 'heavy' | 'medium' | 'light';
const BASE_ARMORS: Record<string, ArmorWeight> = {
  padded: 'light', leather: 'light', 'studded leather': 'light',
  hide: 'medium', 'chain shirt': 'medium', 'scale mail': 'medium',
  breastplate: 'medium', 'half plate': 'medium',
  'ring mail': 'heavy', 'chain mail': 'heavy', splint: 'heavy', plate: 'heavy',
};
// Words that signal an item is ARMOR even when no specific base armor is named
// (e.g. "Adamantine Armor", "Demon Armor", "Elven Chain", "Glamoured Studded").
// Weight is unknown for these, so they route to the "— Other" armor bucket.
const ARMOR_WORD_HINTS = ['armor', 'mail', 'plate', 'cuirass', 'breastplate', 'chain'];

function hasProp(i: ItemIndexEntry, kw: string): boolean {
  return propsLower(i).some(p => p.includes(kw));
}

/** Recover a weapon's { martial, ranged } class from its name, or null. */
function classifyWeaponByName(i: ItemIndexEntry): WeaponClass | null {
  const name = i.name.toLowerCase();
  const bases = Object.keys(BASE_WEAPONS).sort((a, b) => b.length - a.length);
  for (const base of bases) {
    if (name.includes(base)) return BASE_WEAPONS[base];
  }
  const words = Object.keys(WEAPON_WORD_FALLBACK).sort((a, b) => b.length - a.length);
  for (const w of words) {
    if (name.includes(w)) return WEAPON_WORD_FALLBACK[w];
  }
  return null;
}

/** True if the item is a weapon (mundane attack feature, "magic weapon"
 *  property, or a recognizable base-weapon name). */
function isWeapon(i: ItemIndexEntry): boolean {
  if (i.hasDamageEffect) return true;
  if (hasProp(i, 'magic weapon')) return true;
  return classifyWeaponByName(i) !== null;
}
function isRangedWeapon(i: ItemIndexEntry): boolean {
  const cls = classifyWeaponByName(i);
  if (cls) return cls.ranged;
  const p = propsLower(i);
  if (p.some(x => x.includes('ammunition') || x.includes('thrown'))) return true;
  return i.hasDamageEffect &&
    !!i.weaponRange && !['5 feet', 'touch', '10 feet'].includes(i.weaponRange);
}
function isMartialWeapon(i: ItemIndexEntry): boolean {
  const cls = classifyWeaponByName(i);
  if (cls) return cls.martial;
  const p = propsLower(i);
  if (p.some(x => x.includes('martial'))) return true;
  if (p.some(x => x.includes('simple'))) return false;
  return p.some(x => ['heavy', 'reach', 'two-handed', 'special'].some(kw => x.includes(kw)));
}

/** Recover armor weight from properties or base-armor name, or null. */
function armorWeight(i: ItemIndexEntry): ArmorWeight | null {
  const p = propsLower(i);
  if (p.some(x => x.includes('heavy armor')))  return 'heavy';
  if (p.some(x => x.includes('medium armor'))) return 'medium';
  if (p.some(x => x.includes('light armor')))  return 'light';
  const name = i.name.toLowerCase();
  const bases = Object.keys(BASE_ARMORS).sort((a, b) => b.length - a.length);
  for (const base of bases) {
    if (name.includes(base)) return BASE_ARMORS[base];
  }
  return null;
}
/** True if the item is body armor (specific weight OR a generic armor name). */
function isArmorItem(i: ItemIndexEntry): boolean {
  if (hasProp(i, 'armor')) return true;
  if (armorWeight(i) !== null) return true;
  const name = i.name.toLowerCase();
  // Shields are handled separately; don't let "mail"/"chain" steal a shield.
  if (isShield(i)) return false;
  return ARMOR_WORD_HINTS.some(w => name.includes(w));
}
function isArmor(i: ItemIndexEntry, weight: 'heavy' | 'medium' | 'light'): boolean {
  return armorWeight(i) === weight;
}
function isShield(i: ItemIndexEntry): boolean {
  return hasProp(i, 'shield') || /\bshield\b/.test(i.name.toLowerCase());
}
function isAmmo(i: ItemIndexEntry): boolean {
  if (hasProp(i, 'ammunition')) return true;
  return /\b(arrow|arrows|bolt|bolts|bullet|bullets|sling stone|needle)\b/.test(i.name.toLowerCase());
}
function isToolOrKit(i: ItemIndexEntry): boolean {
  if (propsLower(i).some(p => ['tool', 'kit', 'instrument', 'artisan'].some(kw => p.includes(kw)))) return true;
  return /\b(tools|kit|instrument|utensils|supplies)\b/.test(i.name.toLowerCase());
}
function isFocus(i: ItemIndexEntry): boolean {
  if (propsLower(i).some(p => ['focus', 'spellbook', 'component pouch'].some(kw => p.includes(kw)))) return true;
  return /\b(wand|rod|staff|orb|crystal|talisman|spellbook|component pouch)\b/.test(i.name.toLowerCase());
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

type SortMode = 'name' | 'value' | 'weight' | 'rarity';

const SORT_LABELS: Record<SortMode, string> = {
  name:   'A–Z',
  value:  'Value',
  weight: 'Weight',
  rarity: 'Rarity',
};

// D&D rarity tiers (low → high). Items with no rarity sort as 0 (mundane).
const RARITY_RANK: Record<string, number> = {
  common: 1, uncommon: 2, rare: 3, 'very rare': 4, legendary: 5, artifact: 6,
};
function rarityRank(i: ItemIndexEntry): number {
  for (const p of i.properties) {
    const r = RARITY_RANK[p.toLowerCase()];
    if (r) return r;
  }
  return 0;
}

/** Parses a cost string ("50 gp", "2 sp", "—") into a copper-piece value for sorting. */
function costInCopper(cost: string): number {
  if (!cost || cost === '—') return -1; // unknown cost sorts last on value
  const m = cost.match(/([\d.]+)\s*(pp|gp|ep|sp|cp)/i);
  if (!m) return -1;
  const amt = parseFloat(m[1]);
  const unit = m[2].toLowerCase();
  const mult = unit === 'pp' ? 1000 : unit === 'gp' ? 100 : unit === 'ep' ? 50 : unit === 'sp' ? 10 : 1;
  return amt * mult;
}

function sortItems(items: ItemIndexEntry[], mode: SortMode): ItemIndexEntry[] {
  const copy = [...items];
  switch (mode) {
    case 'value':
      // Highest value first; unknown (−1) sinks to the bottom.
      return copy.sort((a, b) => costInCopper(b.cost) - costInCopper(a.cost));
    case 'weight':
      // Lightest first.
      return copy.sort((a, b) => (a.weight ?? 0) - (b.weight ?? 0));
    case 'rarity':
      // Highest rarity first, then alphabetical within a tier.
      return copy.sort((a, b) => rarityRank(b) - rarityRank(a) || a.name.localeCompare(b.name));
    case 'name':
    default:
      return copy.sort((a, b) => a.name.localeCompare(b.name));
  }
}

// ── Add Item Modal ─────────────────────────────────────────────────────────────

function AddItemModal({
  visible, equippedIds, carriedIds, onAdd, onClose,
}: {
  visible:     boolean;
  equippedIds: Set<string>;
  carriedIds:  Set<string>;
  onAdd:       (itemId: string) => void;
  onClose:     () => void;
}) {
  const homebrewItems = useHomebrewStore(s => s.items);
  const saveHomebrew  = useHomebrewStore(s => s.saveItem);
  const [search,    setSearch]    = useState('');
  const [expanded, setExpanded]  = useState<string | null>(null);
  // Active category filter (null = all). When set, only that category shows.
  const [catFilter, setCatFilter] = useState<string | null>(null);
  const [sortMode,  setSortMode]  = useState<SortMode>('name');
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
    const id = 'hb_' + name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') + '_' + Date.now().toString(36);
    const props = qType.trim() ? qType.split(',').map(p => p.trim().toLowerCase()).filter(Boolean) : [];
    const custom: Item = {
      id, name, weight: 0, cost: '\u2014',
      properties: props,
      features: [{
        id: id + '_desc',
        name,
        description: qDesc.trim() || name,
        source: { kind: 'item', refId: id },
        level: null, effects: [], actions: [], choices: [], passive: true,
      }],
    };
    await saveHomebrew('item', custom);
    onAdd(id);
    setQName(''); setQType(''); setQDesc(''); setQuickOpen(false);
  }


  // Deduped by id, homebrew wins on collision — see contentResolution.ts.
  // (Previously a plain concat with no dedup: a homebrew item reusing an
  // official id would show up as two separate rows.)
  const allItems: ItemIndexEntry[] = mergeItemIndex(homebrewItems);
  const q = search.trim().toLowerCase();
  const searchFiltered = q
    ? allItems.filter(i => i.name.toLowerCase().includes(q) ||
        i.properties.some(p => p.toLowerCase().includes(q)))
    : allItems;

  const allGroups = categorise(searchFiltered).map(g => ({
    ...g,
    items: sortItems(g.items, sortMode),
  }));
  const groups = catFilter ? allGroups.filter(g => g.cat.label === catFilter) : allGroups;

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

          {/* Filters dropdown toggle + sort inline */}
          <View style={addStyles.filterBar}>
            <Pressable style={addStyles.filterToggle} onPress={() => setFiltersOpen(o => !o)}>
              <Text style={addStyles.filterToggleTxt}>
                {filtersOpen ? '▲' : '▼'} Filters{catFilter ? ' (1)' : ''}
              </Text>
            </Pressable>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              style={addStyles.sortInlineRow} contentContainerStyle={addStyles.chipRowContent}>
              {(Object.keys(SORT_LABELS) as SortMode[]).map(mode => (
                <Pressable
                  key={mode}
                  style={[addStyles.sortBtn, sortMode === mode && addStyles.sortBtnActive]}
                  onPress={() => setSortMode(mode)}
                >
                  <Text style={[addStyles.sortTxt, sortMode === mode && addStyles.sortTxtActive]}>
                    {SORT_LABELS[mode]}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          {filtersOpen && (
            <View style={addStyles.filterPanel}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={addStyles.chipRow}
                contentContainerStyle={addStyles.chipRowContent}
              >
                <Pressable
                  style={[addStyles.chip, !catFilter && addStyles.chipActive]}
                  onPress={() => setCatFilter(null)}
                >
                  <Text style={[addStyles.chipTxt, !catFilter && addStyles.chipTxtActive]}>All</Text>
                </Pressable>
                {allGroups.map(({ cat, items }) => (
                  <Pressable
                    key={cat.label}
                    style={[addStyles.chip, catFilter === cat.label && addStyles.chipActive]}
                    onPress={() => setCatFilter(c => c === cat.label ? null : cat.label)}
                  >
                    <Text style={[addStyles.chipTxt, catFilter === cat.label && addStyles.chipTxtActive]}>
                      {cat.emoji} {cat.label.replace('Weapons — ', '').replace(' Armor', '')} ({items.length})
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}

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
                data: (expanded === cat.label || !!q || catFilter === cat.label) ? items : [],
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
                      <Text style={[addStyles.itemName, owned && addStyles.itemNameOwned]}>
                        {item.name}
                      </Text>
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
  chipRow: { flexGrow: 0, marginBottom: Spacing.xs },
  chipRowContent: { gap: Spacing.xs, paddingVertical: 2 },
  chip: {
    backgroundColor: Colors.surface, borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.sm, paddingVertical: 4,
  },
  chipActive: { backgroundColor: Colors.gold + '22', borderColor: Colors.gold },
  chipTxt:       { fontSize: FontSize.xs, color: Colors.textSecondary },
  chipTxtActive: { color: Colors.gold, fontWeight: FontWeight.bold },
  filterBar: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginBottom: 2 },
  filterToggle: {
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.sm, paddingVertical: 5,
  },
  filterToggleTxt: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.bold },
  sortInlineRow: { flexGrow: 0 },
  filterPanel: {
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.xs, marginBottom: Spacing.xs,
  },
  sortBtn: {
    backgroundColor: Colors.surface, borderRadius: Radius.sm,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.sm, paddingVertical: 3,
  },
  sortBtnActive: { backgroundColor: Colors.blue + '22', borderColor: Colors.blue },
  sortTxt:       { fontSize: FontSize.xs, color: Colors.textSecondary },
  sortTxtActive: { color: Colors.blue, fontWeight: FontWeight.bold },
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
}

export function TabInventory({
  entity, onEquip, onUnequip, onAddItem, onRemoveItem, onUpdateQuantity, onSetQuantity, onUpdateCurrency, rules,
  onApplyInfusion, onRemoveInfusion, onToggleAttune,
}: Props) {
  const { inventory } = entity;
  const { currency }  = inventory;
  const [addOpen,    setAddOpen]    = useState(false);
  const [currOpen,   setCurrOpen]   = useState(false);
  const [infuseOpen, setInfuseOpen] = useState(false);
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
  // not the raw base score.
  const effectiveStr  = applyStatModifiers(entity.stats, collectAllEffects(entity)).str;
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

      <AddItemModal
        visible={addOpen}
        equippedIds={equippedIds}
        carriedIds={carriedIds}
        onAdd={onAddItem}
        onClose={() => setAddOpen(false)}
      />

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
});
