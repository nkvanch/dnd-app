// src/content/rulesets.ts
// GAME↔RULESET-1: the Game/Ruleset hierarchy. A Game (D&D, Pathfinder, …) is
// never stored directly on content — only a RulesetId is (see every content
// type's existing optional `rulesetId?` field) — a content item's Game is
// always DERIVED by resolving its RulesetId through this registry. This
// keeps Game/Ruleset a single source of truth: adding a new ruleset here
// automatically makes every already-tagged piece of content filterable by
// Game too, with nothing duplicated onto the content itself.
//
// Scope note: this is a REGISTRY of known rulesets, not an engine
// generalization. Only 'dnd5e-2014'/'dnd5e-2024' have any real content
// tagged today (2 proof-of-concept entries — see the paused ruleset-
// migration track). The other entries exist so the Game/Ruleset filter
// hierarchy is genuinely correct and extensible, not because this app's
// engine (abilities/skills/action economy) works for them yet — that
// remains a separate, larger, explicitly-paused effort (see
// project_grimoire_fundamental_architecture memory / this repo's own
// planning doc, Phases 6-8). A Ruleset entry existing here does not imply
// the app can create a Pathfinder or 4e character.
import { GameId, RulesetId } from '../engine/types';

export type Game = { id: GameId; name: string };
export type RulesetDefinition = { id: RulesetId; gameId: GameId; name: string };

export const GAMES: Record<string, Game> = {
  dnd:        { id: 'dnd' as GameId,        name: 'Dungeons & Dragons' },
  pathfinder: { id: 'pathfinder' as GameId, name: 'Pathfinder' },
  ose:        { id: 'ose' as GameId,        name: 'Old-School Essentials' },
};

export const RULESETS: Record<string, RulesetDefinition> = {
  'dnd5e-2014': { id: 'dnd5e-2014' as RulesetId, gameId: GAMES.dnd.id, name: 'D&D 5e (2014)' },
  'dnd5e-2024': { id: 'dnd5e-2024' as RulesetId, gameId: GAMES.dnd.id, name: 'D&D 5e (2024)' },
  'dnd4e':      { id: 'dnd4e' as RulesetId,      gameId: GAMES.dnd.id, name: 'D&D 4th Edition' },
  'dnd3.5e':    { id: 'dnd3.5e' as RulesetId,    gameId: GAMES.dnd.id, name: 'D&D 3.5' },
  'adnd1e':     { id: 'adnd1e' as RulesetId,     gameId: GAMES.dnd.id, name: 'AD&D 1st Edition' },
  'adnd2e':     { id: 'adnd2e' as RulesetId,     gameId: GAMES.dnd.id, name: 'AD&D 2nd Edition' },
  'pf1e':       { id: 'pf1e' as RulesetId,       gameId: GAMES.pathfinder.id, name: 'Pathfinder 1e' },
  'pf2e':       { id: 'pf2e' as RulesetId,       gameId: GAMES.pathfinder.id, name: 'Pathfinder 2e' },
  'ose':        { id: 'ose' as RulesetId,        gameId: GAMES.ose.id, name: 'Old-School Essentials' },
};

/** Looks up which Game a RulesetId belongs to. Undefined if the ruleset id
 *  is untagged OR isn't registered above (fails open — an unrecognized
 *  ruleset id shouldn't crash a filter, it just won't resolve a Game). */
export function gameIdForRuleset(rulesetId: RulesetId | undefined): GameId | undefined {
  if (!rulesetId) return undefined;
  return RULESETS[rulesetId]?.gameId;
}

export function rulesetLabel(rulesetId: RulesetId | undefined): string | undefined {
  if (!rulesetId) return undefined;
  return RULESETS[rulesetId]?.name ?? rulesetId;
}

export function gameLabel(gameId: GameId | undefined): string | undefined {
  if (!gameId) return undefined;
  return Object.values(GAMES).find(g => g.id === gameId)?.name ?? gameId;
}

/**
 * Same "untagged = shared/matches everything" compatibility policy as
 * matchesRuleset (engine/types.ts) — a content item with NO rulesetId at
 * all is compatible with every Game filter. Distinct from a content item
 * that DOES carry a rulesetId but one this registry doesn't recognize
 * (e.g. a homebrew author's own custom ruleset string): that case fails
 * CLOSED under an active Game filter — the content explicitly claims some
 * ruleset, just not one we can resolve a Game for, so silently treating it
 * as "matches every game" would be misleading under a specific Game
 * filter. It still shows up whenever no Game filter is active at all.
 */
export function matchesGame(contentRulesetId: RulesetId | undefined, activeGame: GameId | undefined): boolean {
  if (activeGame === undefined) return true;
  if (contentRulesetId === undefined) return true;
  return gameIdForRuleset(contentRulesetId) === activeGame;
}
