// src/content/contentResolution.ts
// Centralizes "homebrew overrides official by id" precedence for spell/item
// content — previously reimplemented ad hoc in 4 separate places for spells
// (AddSpellModal, SpellChoicePicker, TraitEditor, TabSpells), all copying the
// same 3-line filter+concat, plus a 5th (TabInventory's AddItemModal item
// picker) that used a DIFFERENT shape and never deduped at all — a homebrew
// item sharing an id with an official one would show up as two separate
// rows. Found during the A-52 content-precedence audit.
//
// Ruleset filtering is applied to the HOMEBREW side only, since homebrew
// Spell/Item records already carry rulesetId in memory. The OFFICIAL side
// (spellRepo/itemRepo's Tier-1 index) can't be filtered yet — SpellIndexEntry/
// ItemIndexEntry don't carry rulesetId, and adding it means a SQLite schema +
// generator-script change on native, not just this file. Harmless today (no
// spell/item content sets rulesetId at all yet) — a real, disclosed gap to
// close if 5.5e ever ships ruleset-tagged official spells/items.
import { Spell, Item, RulesetId, matchesRuleset } from '../engine/types';
import { spellRepo } from './spellRepo';
import { itemRepo } from './itemRepo';
import { toItemIndexEntry } from './itemRepo.types';
import type { SpellIndexEntry } from './spellRepo.types';
import type { ItemIndexEntry } from './itemRepo.types';
import { MonsterTemplate } from './monsters/types';
import { ALL_MONSTER_TEMPLATES } from './monsters/srd';

/** Official spell index + homebrew, deduped by id (homebrew wins), homebrew filtered by ruleset. */
export function mergeSpellIndex(homebrewSpells: Spell[], activeRuleset?: RulesetId): SpellIndexEntry[] {
  const inScope = homebrewSpells.filter(s => matchesRuleset(s.rulesetId, activeRuleset));
  const homebrewIds = new Set(inScope.map(s => s.id));
  const official = spellRepo.getIndex().filter(s => !homebrewIds.has(s.id));
  return [...official, ...inScope];
}

/** Homebrew-first, official fallback — the single-id version of mergeSpellIndex's precedence. */
export function resolveSpellById(id: string, homebrewSpells: Spell[]): Spell | undefined {
  return homebrewSpells.find(s => s.id === id) ?? spellRepo.getSpellSync(id);
}

/** Official item index + homebrew, deduped by id (homebrew wins), homebrew filtered by ruleset. */
export function mergeItemIndex(homebrewItems: Item[], activeRuleset?: RulesetId): ItemIndexEntry[] {
  const inScope = homebrewItems.filter(i => matchesRuleset(i.rulesetId, activeRuleset));
  const homebrewIds = new Set(inScope.map(i => i.id));
  const official = itemRepo.getIndex().filter(i => !homebrewIds.has(i.id));
  return [...official, ...inScope.map(toItemIndexEntry)];
}

/** Homebrew-first, official fallback — the single-id version of mergeItemIndex's precedence. */
export function resolveItemById(id: string, homebrewItems: Item[]): Item | undefined {
  return homebrewItems.find(i => i.id === id) ?? itemRepo.getItemSync(id);
}

/**
 * Official SRD monster list + homebrew, deduped by id (homebrew wins).
 * Monsters have no Tier-1/Tier-2 lazy-loading split like spells/items — the
 * official side is already a plain in-memory array — so this is the same
 * precedence rule with no repo indirection needed. Extracted here once a
 * second consumer needed it (app/dm/monsters.tsx's own local version, and
 * preparedEncounter.ts's instantiation logic) — was previously a known,
 * deliberately-deferred gap (architecture-review finding C6).
 */
export function mergeMonsterIndex(homebrewMonsters: MonsterTemplate[], activeRuleset?: RulesetId): MonsterTemplate[] {
  const inScope = homebrewMonsters.filter(m => matchesRuleset(m.rulesetId, activeRuleset));
  const homebrewIds = new Set(inScope.map(m => m.id));
  const official = ALL_MONSTER_TEMPLATES.filter(m => !homebrewIds.has(m.id));
  return [...official, ...inScope];
}

/** Homebrew-first, official fallback — the single-id version of mergeMonsterIndex's precedence. */
export function resolveMonsterById(id: string, homebrewMonsters: MonsterTemplate[]): MonsterTemplate | undefined {
  return homebrewMonsters.find(m => m.id === id) ?? ALL_MONSTER_TEMPLATES.find(m => m.id === id);
}
