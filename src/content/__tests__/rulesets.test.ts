// src/content/__tests__/rulesets.test.ts
// GAME↔RULESET-1: the Game/Ruleset hierarchy registry — Game is always
// derived from a content item's RulesetId, never stored on the content
// itself. These tests lock in the derivation and its "untagged = matches
// everything" fallback policy (same rule matchesRuleset already uses one
// level down, at the Ruleset axis).
import { GAMES, RULESETS, gameIdForRuleset, rulesetLabel, gameLabel, matchesGame } from '../rulesets';
import { asRulesetId } from '../../engine/types';

describe('Game/Ruleset registry', () => {
  it('every registered ruleset belongs to a registered game', () => {
    const gameIds = new Set(Object.values(GAMES).map(g => g.id));
    for (const ruleset of Object.values(RULESETS)) {
      expect(gameIds.has(ruleset.gameId)).toBe(true);
    }
  });

  it('resolves dnd5e-2014 and dnd5e-2024 to the same Game (dnd)', () => {
    expect(gameIdForRuleset(asRulesetId('dnd5e-2014'))).toBe(GAMES.dnd.id);
    expect(gameIdForRuleset(asRulesetId('dnd5e-2024'))).toBe(GAMES.dnd.id);
  });

  it('resolves pf1e/pf2e to the Pathfinder game, distinct from dnd', () => {
    expect(gameIdForRuleset(asRulesetId('pf1e'))).toBe(GAMES.pathfinder.id);
    expect(gameIdForRuleset(asRulesetId('pf2e'))).toBe(GAMES.pathfinder.id);
    expect(gameIdForRuleset(asRulesetId('pf1e'))).not.toBe(gameIdForRuleset(asRulesetId('dnd5e-2014')));
  });

  it('an untagged (undefined) rulesetId resolves to no Game', () => {
    expect(gameIdForRuleset(undefined)).toBeUndefined();
  });

  it('an unregistered ruleset id fails open (undefined Game, not a throw)', () => {
    expect(gameIdForRuleset(asRulesetId('some_unknown_ruleset'))).toBeUndefined();
  });

  it('rulesetLabel/gameLabel resolve to their registered display names', () => {
    expect(rulesetLabel(asRulesetId('dnd5e-2024'))).toBe('D&D 5e (2024)');
    expect(gameLabel(GAMES.dnd.id)).toBe('Dungeons & Dragons');
  });

  describe('matchesGame', () => {
    it('no active game filter matches everything', () => {
      expect(matchesGame(asRulesetId('pf2e'), undefined)).toBe(true);
      expect(matchesGame(undefined, undefined)).toBe(true);
    });

    it('untagged content matches any active game filter (shared-across-everything policy)', () => {
      expect(matchesGame(undefined, GAMES.dnd.id)).toBe(true);
      expect(matchesGame(undefined, GAMES.pathfinder.id)).toBe(true);
    });

    it('content tagged for one game does not match a different active game filter', () => {
      expect(matchesGame(asRulesetId('pf2e'), GAMES.dnd.id)).toBe(false);
      expect(matchesGame(asRulesetId('dnd5e-2024'), GAMES.pathfinder.id)).toBe(false);
    });

    it('content tagged for a game matches that game\'s active filter', () => {
      expect(matchesGame(asRulesetId('dnd5e-2014'), GAMES.dnd.id)).toBe(true);
      expect(matchesGame(asRulesetId('dnd5e-2024'), GAMES.dnd.id)).toBe(true);
    });

    it('an unregistered ruleset id under an active game filter fails closed (excluded, not crashed)', () => {
      expect(matchesGame(asRulesetId('some_unknown_ruleset'), GAMES.dnd.id)).toBe(false);
    });
  });
});

// LIVE-RULESET-4 (item 9, 19): regression coverage for the boot-time
// "asGameId is not a function" crash. Root cause: this module's own GAMES/
// RULESETS object literals used to call a cross-module runtime helper
// (asGameId/asRulesetId — themselves just identity functions, `id => id`,
// existing purely for compile-time nominal branding) at MODULE TOP LEVEL,
// which on a genuinely cold Metro/web boot (confirmed via repeated fresh
// server restarts + a purged transform cache, so not a stale-bundle
// artifact) observably ran before engine/types.ts's own export of that
// helper was live at this call site, despite every other diagnostic
// (module dependency graph, evaluation order, a single module instance,
// no throwing code in between) showing it should have been. Fixed by
// replacing the runtime calls with equivalent `as GameId`/`as RulesetId`
// type assertions — a pure compile-time construct with NO runtime
// dependency on engine/types.ts at all for this job, which removes the
// hazard by construction rather than working around its symptom. The same
// pattern was fixed in src/content/races/index.ts and
// src/content/backgrounds/index.ts (their own top-level asRulesetId calls).
//
// Jest's CommonJS module system doesn't reproduce Metro/web's specific
// bundling behavior, so this can't be a literal repro of the original
// crash — it's a data-correctness lock on the actual fix: proves the
// registry initializes with fully-populated, correct values (not
// `undefined` ids, which is exactly what the bug manifested as) via a
// completely fresh module load, isolated with jest.resetModules() so this
// test can't accidentally pass just because some OTHER test file already
// warmed up a working copy of the module earlier in the run.
describe('module initialization safety (item 9/19 regression)', () => {
  it('GAMES and RULESETS are fully populated (non-undefined ids) on a fresh module load, not the "asGameId is not a function" failure mode', () => {
    jest.resetModules();
    const fresh = require('../rulesets');
    expect(fresh.GAMES.dnd.id).toBe('dnd');
    expect(fresh.GAMES.pathfinder.id).toBe('pathfinder');
    expect(fresh.GAMES.ose.id).toBe('ose');
    for (const [key, ruleset] of Object.entries(fresh.RULESETS as typeof RULESETS)) {
      expect(ruleset.id).toBe(key);
      expect(typeof ruleset.id).toBe('string');
      expect(ruleset.gameId).toBeTruthy();
    }
  });

  it('the Compendium\'s own import chain (contentQuery.ts -> rulesets.ts) initializes without throwing', () => {
    jest.resetModules();
    expect(() => require('../contentQuery')).not.toThrow();
  });
});
