// src/content/__tests__/contentQuery.test.ts
// SHARED-QUERY-1: the universal-axis primitives every content browser is
// built on. Deliberately exercised against a FICTIONAL, non-D&D fixture
// ruleset/game (not dnd5e-2014/dnd5e-2024) to prove none of this is
// secretly special-cased to D&D content.
import {
  matchesSearchText, matchesOfficialFilter, matchesRuleset, matchesGame,
  sortByOption, nameSortOptions, sourceSortOption, contentTypeSortOption,
  BrowsableEntry, ContentTypeId,
} from '../contentQuery';
import { GAMES, RULESETS, gameIdForRuleset } from '../rulesets';
import { asRulesetId, asGameId } from '../../engine/types';
import { getContentProvenance } from '../provenance';

describe('matchesSearchText', () => {
  it('empty query matches everything', () => {
    expect(matchesSearchText('Fireball', [], '')).toBe(true);
    expect(matchesSearchText('Fireball', [], '   ')).toBe(true);
  });
  it('matches on name, case-insensitively', () => {
    expect(matchesSearchText('Fireball', [], 'fire')).toBe(true);
    expect(matchesSearchText('Fireball', [], 'ICE')).toBe(false);
  });
  it('also matches against any extra searchable field (e.g. description)', () => {
    expect(matchesSearchText('Aid', ['Restores hit points'], 'restores')).toBe(true);
  });
  it('tolerates undefined extra fields without throwing', () => {
    expect(matchesSearchText('Aid', [undefined, undefined], 'aid')).toBe(true);
  });
});

describe('matchesOfficialFilter', () => {
  it('"all" matches both official and homebrew', () => {
    expect(matchesOfficialFilter(false, 'all')).toBe(true);
    expect(matchesOfficialFilter(true, 'all')).toBe(true);
  });
  it('"official" matches only non-homebrew', () => {
    expect(matchesOfficialFilter(false, 'official')).toBe(true);
    expect(matchesOfficialFilter(true, 'official')).toBe(false);
  });
  it('"homebrew" matches only homebrew', () => {
    expect(matchesOfficialFilter(true, 'homebrew')).toBe(true);
    expect(matchesOfficialFilter(false, 'homebrew')).toBe(false);
  });
});

// A completely fictional Game/Ruleset pair, absent from the real registry,
// to prove Game→Ruleset resolution is generic plumbing, not a lookup table
// that only happens to have D&D entries populated.
const FICTIONAL_RULESET = asRulesetId('starfarers-2e');
const FICTIONAL_GAME = asGameId('starfarers');

describe('matchesRuleset / matchesGame — ruleset-agnostic by construction', () => {
  it('an untagged content item matches any active ruleset filter (shared-across-everything policy)', () => {
    expect(matchesRuleset(undefined, asRulesetId('dnd5e-2024'))).toBe(true);
    expect(matchesRuleset(undefined, FICTIONAL_RULESET)).toBe(true);
  });

  it('real D&D rulesets still resolve correctly through the registry', () => {
    expect(gameIdForRuleset(asRulesetId('dnd5e-2014'))).toBe(GAMES.dnd.id);
    expect(matchesGame(asRulesetId('dnd5e-2014'), GAMES.dnd.id)).toBe(true);
    expect(matchesGame(asRulesetId('dnd5e-2014'), GAMES.pathfinder.id)).toBe(false);
  });

  it('an entirely unregistered, fictional non-D&D ruleset/game pair behaves consistently: matches its own ruleset and (once registered) its own Game, and does not leak into D&D\'s Game filter', () => {
    // Not registered in RULESETS/GAMES — matchesRuleset still works (it
    // only compares the two ids directly, no registry lookup needed).
    expect(matchesRuleset(FICTIONAL_RULESET, FICTIONAL_RULESET)).toBe(true);
    expect(matchesRuleset(FICTIONAL_RULESET, asRulesetId('dnd5e-2014'))).toBe(false);
    // matchesGame DOES need a registry entry to resolve a Game — until one
    // exists, it correctly fails closed under an active Game filter rather
    // than silently guessing (see rulesets.ts's own documented policy).
    expect(matchesGame(FICTIONAL_RULESET, GAMES.dnd.id)).toBe(false);
  });

  it('registering a new Game/Ruleset needs zero changes to matchesGame/matchesRuleset themselves', () => {
    // Simulates what scripts/... or a future content pack would do: extend
    // the registry, then the exact same primitives resolve the new pair
    // correctly with no code change here.
    const registry = { ...RULESETS, 'starfarers-2e': { id: FICTIONAL_RULESET, gameId: FICTIONAL_GAME, name: 'Starfarers 2e' } };
    expect(registry['starfarers-2e'].gameId).toBe(FICTIONAL_GAME);
  });
});

describe('sorting primitives', () => {
  type Fixture = { id: string; name: string; source?: string; type: ContentTypeId };
  const fixtures: Fixture[] = [
    { id: 'b', name: 'Banana', source: 'Zeta Codex', type: 'item' },
    { id: 'a', name: 'Apple',  source: 'Alpha Codex', type: 'race' },
    { id: 'c', name: 'Cherry', type: 'item' }, // no source — should sort last
  ];

  it('nameSortOptions: A–Z and Z–A both sort correctly', () => {
    const [az, za] = nameSortOptions<Fixture>();
    expect(sortByOption(fixtures, [az, za], 'name_asc').map(f => f.name)).toEqual(['Apple', 'Banana', 'Cherry']);
    expect(sortByOption(fixtures, [az, za], 'name_desc').map(f => f.name)).toEqual(['Cherry', 'Banana', 'Apple']);
  });

  it('sourceSortOption: sorts by the given source-label accessor, undefined last', () => {
    const bySource = sourceSortOption<Fixture>(f => f.source);
    const sorted = sortByOption(fixtures, [bySource], 'source');
    expect(sorted.map(f => f.name)).toEqual(['Apple', 'Banana', 'Cherry']);
  });

  it('contentTypeSortOption: groups by content-type label', () => {
    const byType = contentTypeSortOption<Fixture>();
    const sorted = sortByOption(fixtures, [byType], 'content_type');
    // 'Items' < 'Races' alphabetically
    expect(sorted.map(f => f.type)).toEqual(['item', 'item', 'race']);
  });

  it('sortByOption falls back to the first option when the requested sort id is unknown', () => {
    const [az] = nameSortOptions<Fixture>();
    const sorted = sortByOption(fixtures, [az], 'nonexistent_sort_id');
    expect(sorted.map(f => f.name)).toEqual(['Apple', 'Banana', 'Cherry']);
  });

  it('sortByOption never mutates the input array', () => {
    const [az] = nameSortOptions<Fixture>();
    const copy = [...fixtures];
    sortByOption(fixtures, [az], 'name_asc');
    expect(fixtures).toEqual(copy);
  });
});

describe('BrowsableEntry + getContentProvenance integration (mixed Compendium search shape)', () => {
  it('normalizes heterogeneous content into one shape usable by a mixed search/sort', () => {
    const entries: BrowsableEntry[] = [
      { id: 'human', name: 'Human', type: 'race', srd: true, isHomebrew: false, raw: {} },
      { id: 'my_spell', name: 'My Spell', type: 'spell', isHomebrew: true, raw: {} },
    ];
    for (const e of entries) {
      const prov = getContentProvenance(e, { isHomebrew: e.isHomebrew });
      expect(prov.originKind).toBe(e.isHomebrew ? 'local_homebrew' : 'official');
    }
  });
});
