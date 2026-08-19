// src/components/sheet/TabInventory.tsx
// Tab — Equipped items, carried items, currency.
// Supports adding items from the content DB (or homebrew),
// removing items, and adjusting money per denomination.
// Large creature rules are surfaced when the character is Large-sized.
import { useState } from 'react';
import {
  ScrollView, View, Text, Pressable, StyleSheet,
  Modal, TextInput, Alert, SectionList,
} from 'react-native';
import { Entity, ItemInstance, Item, Currency, CampaignRules } from '../../engine/types';
import { globalContentDB } from '../../content/classes/library';
import { useHomebrewStore } from '../../store/homebrewStore';
import { usesLargeCreatureWeaponDice } from '../../engine/houseRules';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../theme';

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
  test:   (item: Item) => boolean;
};

// ── Classification helpers ─────────────────────────────────────────────

function propsLower(i: Item): string[] {
  return i.properties.map(p => p.toLowerCase());
}
function isMagic(i: Item): boolean {
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

function hasProp(i: Item, kw: string): boolean {
  return propsLower(i).some(p => p.includes(kw));
}

/** Recover a weapon's { martial, ranged } class from its name, or null. */
function classifyWeaponByName(i: Item): WeaponClass | null {
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
function isWeapon(i: Item): boolean {
  if (i.features.some(f => f.abilityEffects?.some(e => e.type === 'damage'))) return true;
  if (hasProp(i, 'magic weapon')) return true;
  return classifyWeaponByName(i) !== null;
}
function isRangedWeapon(i: Item): boolean {
  const cls = classifyWeaponByName(i);
  if (cls) return cls.ranged;
  const p = propsLower(i);
  if (p.some(x => x.includes('ammunition') || x.includes('thrown'))) return true;
  return i.features.some(f =>
    f.abilityEffects?.some(e => e.type === 'damage') &&
    f.activation?.range && !['5 feet', 'touch', '10 feet'].includes(f.activation.range)
  );
}
function isMartialWeapon(i: Item): boolean {
  const cls = classifyWeaponByName(i);
  if (cls) return cls.martial;
  const p = propsLower(i);
  if (p.some(x => x.includes('martial'))) return true;
  if (p.some(x => x.includes('simple'))) return false;
  return p.some(x => ['heavy', 'reach', 'two-handed', 'special'].some(kw => x.includes(kw)));
}

/** Recover armor weight from properties or base-armor name, or null. */
function armorWeight(i: Item): ArmorWeight | null {
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
function isArmorItem(i: Item): boolean {
  if (hasProp(i, 'armor')) return true;
  if (armorWeight(i) !== null) return true;
  const name = i.name.toLowerCase();
  // Shields are handled separately; don't let "mail"/"chain" steal a shield.
  if (isShield(i)) return false;
  return ARMOR_WORD_HINTS.some(w => name.includes(w));
}
function isArmor(i: Item, weight: 'heavy' | 'medium' | 'light'): boolean {
  return armorWeight(i) === weight;
}
function isShield(i: Item): boolean {
  return hasProp(i, 'shield') || /\bshield\b/.test(i.name.toLowerCase());
}
function isAmmo(i: Item): boolean {
  if (hasProp(i, 'ammunition')) return true;
  return /\b(arrow|arrows|bolt|bolts|bullet|bullets|sling stone|needle)\b/.test(i.name.toLowerCase());
}
function isToolOrKit(i: Item): boolean {
  if (propsLower(i).some(p => ['tool', 'kit', 'instrument', 'artisan'].some(kw => p.includes(kw)))) return true;
  return /\b(tools|kit|instrument|utensils|supplies)\b/.test(i.name.toLowerCase());
}
function isFocus(i: Item): boolean {
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

function categorise(items: Item[]): { cat: ItemCategory; items: Item[] }[] {
  const result: { cat: ItemCategory; items: Item[] }[] = [];
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
function rarityRank(i: Item): number {
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

function sortItems(items: Item[], mode: SortMode): Item[] {
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


  const allItems = [...globalContentDB.items, ...homebrewItems];
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
                    {owned ? (
                      <Text style={addStyles.ownedBadge}>In bag</Text>
                    ) : (
                      <Pressable
                        style={addStyles.addBtn}
                        onPress={() => { onAdd(item.id); }}
                      >
                        <Text style={addStyles.addBtnTxt}>+ Add</Text>
                      </Pressable>
                    )}
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
  itemRowOwned: { opacity: 0.5 },
  itemInfo:     { flex: 1 },
  itemName:     { fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: FontWeight.bold },
  itemNameOwned:{ color: Colors.textDim },
  itemProps:    { fontSize: FontSize.xs, color: Colors.textDim, marginTop: 1 },
  itemCost:     { fontSize: FontSize.xs, color: Colors.gold, marginTop: 1 },
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

// ── Item Row ───────────────────────────────────────────────────────────────────

function ItemRow({
  instance, equipped, allItems, onToggle, onRemove,
}: {
  instance: ItemInstance;
  equipped: boolean;
  allItems: Item[];
  onToggle: () => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const item  = allItems.find(i => i.id === instance.itemId);
  const name  = item?.name ?? instance.itemId;
  const props = item?.properties ?? [];
  const desc  = item?.features?.[0]?.description;

  return (
    <View style={styles.itemWrap}>
      <View style={styles.itemRow}>
        <Pressable style={styles.itemMain} onPress={() => setExpanded(e => !e)}>
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
          </View>
          <Text style={styles.expandCaret}>{expanded ? '▲' : '▼'}</Text>
        </Pressable>
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
  onUpdateCurrency:  (currency: Currency) => void;
  /** Active campaign rules — used to honour homebrew toggles (e.g. large-creature dice). */
  rules?:            CampaignRules;
}

export function TabInventory({
  entity, onEquip, onUnequip, onAddItem, onRemoveItem, onUpdateCurrency, rules,
}: Props) {
  const { inventory } = entity;
  const { currency }  = inventory;
  const [addOpen,  setAddOpen]  = useState(false);
  const [currOpen, setCurrOpen] = useState(false);

  const homebrewItemList = useHomebrewStore(s => s.items);
  const allItems = [...globalContentDB.items, ...homebrewItemList];

  const large          = isLargeCreature(entity);
  const carryCapacity  = entity.stats.str * (large ? 30 : 15);
  const totalWeight    = [...inventory.equipped, ...inventory.carried].reduce((sum, inst) => {
    const def = allItems.find(i => i.id === inst.itemId);
    return sum + (def?.weight ?? 0) * inst.quantity;
  }, 0);
  const weightPct  = carryCapacity > 0 ? totalWeight / carryCapacity : 0;
  const weightColor = weightPct > 1 ? Colors.red : weightPct >= 0.75 ? Colors.gold : Colors.green;

  const equippedIds = new Set(inventory.equipped.map(i => i.itemId));
  const carriedIds  = new Set(inventory.carried.map(i => i.itemId));

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
  itemInfo:  { flex: 1 },
  itemName:  { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  itemProps: { fontSize: FontSize.xs, color: Colors.textDim, marginTop: 1, lineHeight: 14 },
  itemQty:   { fontSize: FontSize.sm, color: Colors.textSecondary },
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

  removeBtn: { padding: 4 },
  removeTxt: { fontSize: FontSize.md, color: Colors.textDim },

  emptyNote: { color: Colors.textDim, fontSize: FontSize.sm, fontStyle: 'italic' },
});
