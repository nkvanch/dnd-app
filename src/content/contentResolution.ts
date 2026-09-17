// src/content/contentResolution.ts
// Centralizes "homebrew overrides official by id" precedence for spell/item
// content — previously reimplemented ad hoc in 4 separate places for spells
// (AddSpellModal, SpellChoicePicker, TraitEditor, TabSpells), all copying the
// same 3-line filter+concat, plus a 5th (TabInventory's AddItemModal item
// picker) that used a DIFFERENT shape and never deduped at all — a homebrew
// item sharing an id with an official one would show up as two separate
// rows. Found during the A-52 content-precedence audit.
//
// LIVE-RULESET-3 (items 5, 6): ruleset filtering now covers BOTH sides.
// mergeSpellIndex/mergeItemIndex filter the homebrew side by `activeRuleset`
// (unchanged). resolveSpellById/resolveItemById take an optional
// `activeRuleset` too — when passed, a resolved candidate (homebrew OR
// official — SpellIndexEntry/ItemIndexEntry/the full Spell/Item record all
// carry a real rulesetId field, TIER1-EXT-1) whose OWN ruleset doesn't match
// is treated as NOT FOUND rather than silently returned, mirroring exactly
// how rulesetChange.ts already categorizes a wrong-ruleset feat/condition as
// "incompatible" rather than resolving it. Omitting `activeRuleset` (every
// pre-existing call site) keeps today's exact unfiltered behavior — this is
// additive, not a breaking change. No spell/item content is ruleset-tagged
// yet (see rulesetChange.test.ts's synthetic fixtures for the proof this
// mechanism actually filters correctly), so this is currently a no-op for
// every real official/homebrew spell and item — same "mechanism built and
// tested, no real content exercises it yet" situation the race/background
// 2024 proof-of-concept content was in before it existed.
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

/**
 * Picks the ruleset-appropriate candidate among every item sharing one id —
 * the actual "same identity, multiple edition definitions" case (item 5/6's
 * explicit ask), distinct from "one candidate, reject it if wrong ruleset."
 * With no active filter, first-wins (today's exact pre-existing behavior,
 * for the common case of zero or one candidate). With a filter: an EXACT
 * ruleset match wins outright; failing that, a genuinely untagged/universal
 * candidate is used (matching every other content pool's "untagged = shared"
 * rule); failing THAT, undefined — never an arbitrary same-id candidate
 * tagged for some OTHER, non-matching ruleset.
 */
function pickByRuleset<T extends { rulesetId?: RulesetId }>(candidates: T[], activeRuleset: RulesetId | undefined): T | undefined {
  if (candidates.length === 0) return undefined;
  if (activeRuleset === undefined) return candidates[0];
  return candidates.find(c => c.rulesetId === activeRuleset) ?? candidates.find(c => c.rulesetId === undefined);
}

/**
 * Homebrew-first, official fallback — the single-id version of
 * mergeSpellIndex's precedence. `activeRuleset`, when passed, makes this
 * ruleset-aware via pickByRuleset (see above) — a homebrew candidate that
 * resolves by id but is tagged for a DIFFERENT ruleset (with no untagged
 * fallback candidate sharing that id) is treated as not found here, never
 * silently returned as if compatible, and a same-id homebrew entry tagged
 * for the REQUESTED ruleset always wins even if it's not array-first.
 * Callers that need to know WHY something didn't resolve (e.g. "belongs to
 * a different ruleset" vs. "doesn't exist at all") should use
 * rulesetChange.ts's own compatibility categorization instead, which already
 * distinguishes those two cases via a structured Issue. Omit `activeRuleset`
 * to resolve unconditionally, exactly as before (every pre-existing call
 * site — this is additive, not a breaking change).
 */
export function resolveSpellById(id: string, homebrewSpells: Spell[], activeRuleset?: RulesetId): Spell | undefined {
  const candidates = homebrewSpells.filter(s => s.id === id);
  const homebrew = pickByRuleset(candidates, activeRuleset);
  if (homebrew) return homebrew;
  // Homebrew candidate(s) exist for this id but none fit the requested
  // ruleset — homebrew already wins by id precedence, so this must NOT fall
  // through to an official spell that happens to share the same id.
  if (candidates.length > 0) return undefined;
  const official = spellRepo.getSpellSync(id);
  if (!official) return undefined;
  return matchesRuleset(official.rulesetId, activeRuleset) ? official : undefined;
}

/** Official item index + homebrew, deduped by id (homebrew wins), homebrew filtered by ruleset. */
export function mergeItemIndex(homebrewItems: Item[], activeRuleset?: RulesetId): ItemIndexEntry[] {
  const inScope = homebrewItems.filter(i => matchesRuleset(i.rulesetId, activeRuleset));
  const homebrewIds = new Set(inScope.map(i => i.id));
  const official = itemRepo.getIndex().filter(i => !homebrewIds.has(i.id));
  return [...official, ...inScope.map(toItemIndexEntry)];
}

/** Homebrew-first, official fallback — the single-id version of
 *  mergeItemIndex's precedence. `activeRuleset` behaves exactly as
 *  resolveSpellById's own parameter does — see that function's doc comment,
 *  including the pickByRuleset same-id-multiple-editions handling. */
export function resolveItemById(id: string, homebrewItems: Item[], activeRuleset?: RulesetId): Item | undefined {
  const candidates = homebrewItems.filter(i => i.id === id);
  const homebrew = pickByRuleset(candidates, activeRuleset);
  if (homebrew) return homebrew;
  if (candidates.length > 0) return undefined;
  const official = itemRepo.getItemSync(id);
  if (!official) return undefined;
  return matchesRuleset(official.rulesetId, activeRuleset) ? official : undefined;
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
