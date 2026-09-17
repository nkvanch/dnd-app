// src/content/items/itemBrowse.ts
// SHARED-QUERY-1: item classification + sort, extracted from
// TabInventory.tsx's AddItemModal so the shared architecture's independent-
// axis rule ("do not encode combined concepts such as 'Magic Weapons —
// Martial Melee' as the canonical taxonomy") has one real place to live.
// Category/WeaponClass/WeaponRange/ArmorWeight/Magical are each represented
// as their OWN independent field here — TabInventory.tsx's pre-existing
// ITEM_CATEGORIES list (25 combined "Magic Weapons — Martial Melee"-style
// entries) stays as-is for the results screen's own SectionList grouping
// (a presentation concern — "derive visual grouping if desired" per the
// spec), but filtering itself now goes through these independent
// predicates instead of matching against one of those 25 combined labels.
//
// Damage Type and Consumable/Charges are NOT offered as filters: neither is
// a real Tier-1 (or even Tier-2) structured field anywhere in this content
// model — confirmed against ItemIndexEntry's own doc comment and the Item
// type in engine/types.ts. Disclosed as BLOCKED rather than fabricated.
import type { ItemIndexEntry } from '../itemRepo.types';
import type { ItemFilterConstraint, Item } from '../../engine/types';
import { SortOption, nameSortOptions, sourceSortOption } from '../contentQuery';
import { getContentProvenance } from '../provenance';

function propsLower(i: ItemIndexEntry): string[] {
  return i.properties.map(p => p.toLowerCase());
}
function hasProp(i: ItemIndexEntry, kw: string): boolean {
  return propsLower(i).some(p => p.includes(kw));
}

export function isMagic(i: ItemIndexEntry): boolean {
  return propsLower(i).some(p => p.includes('magic') || p.includes('wondrous') || p.includes('artifact'));
}

// Canonical D&D 5e base weapons → { martial, ranged }. Magic weapons are typed
// only "Magic Weapon", so we recover the class from the base-weapon name in
// the item name (e.g. "Flame Tongue Greatsword" → greatsword → martial melee).
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
// ITEMS-PERF-2: sorted-by-length key lists computed once (module scope),
// not re-sorted on every classification call — see TabInventory.tsx's own
// original comment for why this matters at ~891 items.
const BASE_WEAPON_KEYS_BY_LENGTH = Object.keys(BASE_WEAPONS).sort((a, b) => b.length - a.length);
const WEAPON_WORD_FALLBACK_KEYS_BY_LENGTH = Object.keys(WEAPON_WORD_FALLBACK).sort((a, b) => b.length - a.length);

export type ArmorWeight = 'heavy' | 'medium' | 'light';
const BASE_ARMORS: Record<string, ArmorWeight> = {
  padded: 'light', leather: 'light', 'studded leather': 'light',
  hide: 'medium', 'chain shirt': 'medium', 'scale mail': 'medium',
  breastplate: 'medium', 'half plate': 'medium',
  'ring mail': 'heavy', 'chain mail': 'heavy', splint: 'heavy', plate: 'heavy',
};
const BASE_ARMOR_KEYS_BY_LENGTH = Object.keys(BASE_ARMORS).sort((a, b) => b.length - a.length);
const ARMOR_WORD_HINTS = ['armor', 'mail', 'plate', 'cuirass', 'breastplate', 'chain'];

/** Recover a weapon's { martial, ranged } class from its name, or null. */
export function classifyWeaponByName(i: ItemIndexEntry): WeaponClass | null {
  const name = i.name.toLowerCase();
  for (const base of BASE_WEAPON_KEYS_BY_LENGTH) {
    if (name.includes(base)) return BASE_WEAPONS[base];
  }
  for (const w of WEAPON_WORD_FALLBACK_KEYS_BY_LENGTH) {
    if (name.includes(w)) return WEAPON_WORD_FALLBACK[w];
  }
  return null;
}

export function isWeapon(i: ItemIndexEntry): boolean {
  if (i.hasDamageEffect) return true;
  if (hasProp(i, 'magic weapon')) return true;
  return classifyWeaponByName(i) !== null;
}
export function isRangedWeapon(i: ItemIndexEntry): boolean {
  const cls = classifyWeaponByName(i);
  if (cls) return cls.ranged;
  const p = propsLower(i);
  // Explicit override first (symmetric with isMartialWeapon's explicit
  // 'martial'/'simple' check below) — lets homebrew content declare its
  // own range directly instead of relying only on the ammunition/thrown
  // heuristic, which doesn't cover every real ranged weapon shape.
  if (p.some(x => x.includes('ranged'))) return true;
  if (p.some(x => x.includes('melee'))) return false;
  if (p.some(x => x.includes('ammunition') || x.includes('thrown'))) return true;
  return i.hasDamageEffect &&
    !!i.weaponRange && !['5 feet', 'touch', '10 feet'].includes(i.weaponRange);
}
export function isMartialWeapon(i: ItemIndexEntry): boolean {
  const cls = classifyWeaponByName(i);
  if (cls) return cls.martial;
  const p = propsLower(i);
  if (p.some(x => x.includes('martial'))) return true;
  if (p.some(x => x.includes('simple'))) return false;
  return p.some(x => ['heavy', 'reach', 'two-handed', 'special'].some(kw => x.includes(kw)));
}

export function armorWeight(i: ItemIndexEntry): ArmorWeight | null {
  const p = propsLower(i);
  if (p.some(x => x.includes('heavy armor')))  return 'heavy';
  if (p.some(x => x.includes('medium armor'))) return 'medium';
  if (p.some(x => x.includes('light armor')))  return 'light';
  const name = i.name.toLowerCase();
  for (const base of BASE_ARMOR_KEYS_BY_LENGTH) {
    if (name.includes(base)) return BASE_ARMORS[base];
  }
  return null;
}
export function isArmorItem(i: ItemIndexEntry): boolean {
  if (hasProp(i, 'armor')) return true;
  if (armorWeight(i) !== null) return true;
  const name = i.name.toLowerCase();
  if (isShield(i)) return false;
  return ARMOR_WORD_HINTS.some(w => name.includes(w));
}
export function isShield(i: ItemIndexEntry): boolean {
  return hasProp(i, 'shield') || /\bshield\b/.test(i.name.toLowerCase());
}
export function isAmmo(i: ItemIndexEntry): boolean {
  if (hasProp(i, 'ammunition')) return true;
  return /\b(arrow|arrows|bolt|bolts|bullet|bullets|sling stone|needle)\b/.test(i.name.toLowerCase());
}
export function isToolOrKit(i: ItemIndexEntry): boolean {
  if (propsLower(i).some(p => ['tool', 'kit', 'instrument', 'artisan'].some(kw => p.includes(kw)))) return true;
  return /\b(tools|kit|instrument|utensils|supplies)\b/.test(i.name.toLowerCase());
}
export function isFocus(i: ItemIndexEntry): boolean {
  if (propsLower(i).some(p => ['focus', 'spellbook', 'component pouch'].some(kw => p.includes(kw)))) return true;
  return /\b(wand|rod|staff|orb|crystal|talisman|spellbook|component pouch)\b/.test(i.name.toLowerCase());
}

/** Independent top-level Category — one mutually-exclusive bucket, checked
 *  in this fixed priority order (mirrors the priority TabInventory.tsx's
 *  original combined ITEM_CATEGORIES list already used, just without also
 *  encoding Magical/WeaponClass/WeaponRange into the same field). */
export type ItemCategoryId = 'weapon' | 'armor' | 'shield' | 'ammunition' | 'tool' | 'focus' | 'gear';
export const ITEM_CATEGORY_LABELS: Record<ItemCategoryId, string> = {
  weapon: 'Weapons', armor: 'Armor', shield: 'Shields', ammunition: 'Ammunition',
  tool: 'Tools & Kits', focus: 'Spellcasting Focuses', gear: 'Adventuring Gear',
};
export function itemCategory(i: ItemIndexEntry): ItemCategoryId {
  if (isWeapon(i)) return 'weapon';
  if (isShield(i)) return 'shield';
  if (isArmorItem(i)) return 'armor';
  if (isAmmo(i)) return 'ammunition';
  if (isToolOrKit(i)) return 'tool';
  if (isFocus(i)) return 'focus';
  return 'gear';
}

// D&D rarity tiers (low → high). Items with no rarity property sort/filter
// as 0 ("Mundane" — not a real rarity tier, but the only honest bucket for
// items with no rarity property at all).
export const RARITY_RANK: Record<string, number> = {
  common: 1, uncommon: 2, rare: 3, 'very rare': 4, legendary: 5, artifact: 6,
};
export const RARITY_TIERS = ['common', 'uncommon', 'rare', 'very rare', 'legendary', 'artifact'] as const;
export function rarityOf(i: ItemIndexEntry): string | null {
  for (const p of i.properties) {
    if (RARITY_RANK[p.toLowerCase()]) return p.toLowerCase();
  }
  return null;
}
export function rarityRank(i: ItemIndexEntry): number {
  const r = rarityOf(i);
  return r ? RARITY_RANK[r] : 0;
}

/** Parses a cost string ("50 gp", "2 sp", "—") into a copper-piece value. */
export function costInCopper(cost: string): number {
  if (!cost || cost === '—') return -1; // unknown cost sorts/filters last
  const m = cost.match(/([\d.]+)\s*(pp|gp|ep|sp|cp)/i);
  if (!m) return -1;
  const amt = parseFloat(m[1]);
  const unit = m[2].toLowerCase();
  const mult = unit === 'pp' ? 1000 : unit === 'gp' ? 100 : unit === 'ep' ? 50 : unit === 'sp' ? 10 : 1;
  return amt * mult;
}

export function itemSourceLabel(item: ItemIndexEntry, isHomebrew: boolean): string | undefined {
  return getContentProvenance(item, { isHomebrew }).sourceLabel;
}

export function itemSortOptions(isHomebrewOf: (item: ItemIndexEntry) => boolean): SortOption<ItemIndexEntry>[] {
  return [
    ...nameSortOptions<ItemIndexEntry>(),
    {
      id: 'rarity', label: 'Rarity',
      compare: (a, b) => rarityRank(b) - rarityRank(a) || a.name.localeCompare(b.name),
    },
    {
      id: 'value', label: 'Value',
      compare: (a, b) => costInCopper(b.cost) - costInCopper(a.cost) || a.name.localeCompare(b.name),
    },
    {
      id: 'weight', label: 'Weight',
      compare: (a, b) => (a.weight ?? 0) - (b.weight ?? 0) || a.name.localeCompare(b.name),
    },
    sourceSortOption<ItemIndexEntry>(i => itemSourceLabel(i, isHomebrewOf(i))),
  ];
}

// ── STARTING-EQUIPMENT-1 ─────────────────────────────────────────────────────

/** ADDITIONAL-ITEM-1: the "Create Simple Custom Item" mechanism — a
 *  lightweight, throwaway homebrew Item (no builder screens, no structured
 *  effects), distinct from full homebrew authoring (Item Builder). Reused
 *  by both TabInventory.tsx's in-play quick-add and the creation flow's
 *  "+ Add Additional Item" menu, so the two never drift into two slightly
 *  different id-generation/shape rules. */
export function buildSimpleCustomItem(name: string, propsText: string, description: string): Item {
  const id = 'hb_' + name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') + '_' + Date.now().toString(36);
  const properties = propsText.trim() ? propsText.split(',').map(p => p.trim().toLowerCase()).filter(Boolean) : [];
  return {
    id, name, weight: 0, cost: '—',
    properties,
    features: [{
      id: id + '_desc',
      name,
      description: description.trim() || name,
      source: { kind: 'item', refId: id },
      level: null, effects: [], actions: [], choices: [], passive: true,
    }],
  };
}

/** Every clause in `constraint` is AND-combined; an empty constraint matches
 *  everything. Reuses the exact same independent-axis predicates the Item
 *  Compendium filter already uses — one real definition of "is this a
 *  Martial Melee Weapon," not a second one duplicated for equipment
 *  choices. */
export function itemMatchesConstraint(item: ItemIndexEntry, constraint: ItemFilterConstraint): boolean {
  if (constraint.category && itemCategory(item) !== constraint.category) return false;
  if (constraint.weaponClass) {
    if (itemCategory(item) !== 'weapon') return false;
    if (isMartialWeapon(item) !== (constraint.weaponClass === 'martial')) return false;
  }
  if (constraint.weaponRange) {
    if (itemCategory(item) !== 'weapon') return false;
    if (isRangedWeapon(item) !== (constraint.weaponRange === 'ranged')) return false;
  }
  if (constraint.armorWeight && armorWeight(item) !== constraint.armorWeight) return false;
  return true;
}
