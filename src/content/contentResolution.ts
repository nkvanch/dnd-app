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
