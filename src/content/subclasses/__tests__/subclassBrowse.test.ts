// src/content/subclasses/__tests__/subclassBrowse.test.ts
// First test coverage for this file. Locks in a real fix:
// subclassEntriesForClassMerged used to plain-concatenate official +
// homebrew subclasses with no dedup, official listed first — a homebrew
// subclass sharing a derived id with an official one (a realistic
// collision, since both derive/author ids by slugifying the subclass name)
// showed as two entries, and any id-keyed lookup always resolved to the
// official one, the opposite of the homebrew-wins precedence used
// everywhere else (architecture review C1).
import {
  subclassEntriesForClassMerged, getSubclassEntryMerged, subclassAdditions, filterAndSortSubclassOptions,
} from '../subclassBrowse';
import { HomebrewSubclass, asSubclassId, Feature } from '../../../engine/types';
import { SubclassProgression } from '../index';

function homebrewThief(overrides: Partial<HomebrewSubclass> = {}): HomebrewSubclass {
  return {
    id: asSubclassId('thief'), name: 'Thief (Homebrew Reimagining)', classId: 'rogue',
    entries: [{ level: 3, grants: [], choices: [], hpDie: 8 }],
    ...overrides,
  };
}

describe('subclassEntriesForClassMerged — homebrew wins over official by id (audit finding C1)', () => {
  it('a homebrew subclass sharing an official derived id wins, and there is only one entry for that id', () => {
    const officialOnly = subclassEntriesForClassMerged('rogue', []);
    expect(officialOnly.some(s => s.id === 'thief')).toBe(true); // sanity: 'thief' really is the official Rogue Thief's derived id

    const merged = subclassEntriesForClassMerged('rogue', [homebrewThief()]);
    const matches = merged.filter(s => s.id === 'thief');
    expect(matches).toHaveLength(1); // no duplicate row — deduped, not just appended
    expect(matches[0].name).toBe('Thief (Homebrew Reimagining)');
  });

  it('getSubclassEntryMerged resolves the homebrew override, not the official one', () => {
    const entry = getSubclassEntryMerged('rogue', 'thief', [homebrewThief()]);
    expect(entry?.name).toBe('Thief (Homebrew Reimagining)');
  });

  it('a non-colliding homebrew subclass is simply added alongside the official ones', () => {
    const homebrewNovel = homebrewThief({ id: asSubclassId('shadow_walker'), name: 'Shadow Walker' });
    const merged = subclassEntriesForClassMerged('rogue', [homebrewNovel]);
    expect(merged.some(s => s.id === 'thief')).toBe(true); // official untouched
    expect(merged.some(s => s.id === 'shadow_walker')).toBe(true); // homebrew present
  });
});

// LIVE-RULESET-3 (item 4, 16): subclassEntriesForClassMerged's new
// activeRuleset filter. No OFFICIAL subclass in this app's content library
// is ruleset-tagged — confirmed by research: every official subclass here
// (2014 PHB + supplements) has no 2024-specific revision authored, so
// tagging one as "2024-only" would assert something factually untrue about
// the content. The filter MECHANISM is identical for official and homebrew
// entries (both flow through the same matchesRuleset check inside
// subclassEntriesForClassMerged/subclassEntriesForClass), so exercising it
// via homebrew fixtures — which genuinely CAN be tagged 2014-only/2024-only/
// untagged — is a real, honest test of the same code path. The official
// "untagged/shared" case is separately proven directly against real content:
// Rogue's own official Thief subclass (genuinely untagged) stays visible
// under every ruleset filter, confirming official entries aren't
// accidentally excluded by the new filter.
describe('subclassEntriesForClassMerged — ruleset filtering (item 4/16)', () => {
  const thief2014 = homebrewThief({ id: asSubclassId('gloomstalker_hb_2014'), name: '2014-only Homebrew Subclass', rulesetId: 'dnd5e-2014' as never });
  const thief2024 = homebrewThief({ id: asSubclassId('gloomstalker_hb_2024'), name: '2024-only Homebrew Subclass', rulesetId: 'dnd5e-2024' as never });
  const thiefUntagged = homebrewThief({ id: asSubclassId('gloomstalker_hb_shared'), name: 'Untagged/Shared Homebrew Subclass' });
  const homebrew = [thief2014, thief2024, thiefUntagged];

  it('under a dnd5e-2014 context: the 2014-only entry and the untagged entry are visible, the 2024-only one is excluded', () => {
    const ids = subclassEntriesForClassMerged('rogue', homebrew, 'dnd5e-2014' as never).map(s => s.id);
    expect(ids).toContain('gloomstalker_hb_2014');
    expect(ids).toContain('gloomstalker_hb_shared');
    expect(ids).not.toContain('gloomstalker_hb_2024');
  });

  it('under a dnd5e-2024 context: the 2024-only entry and the untagged entry are visible, the 2014-only one is excluded', () => {
    const ids = subclassEntriesForClassMerged('rogue', homebrew, 'dnd5e-2024' as never).map(s => s.id);
    expect(ids).toContain('gloomstalker_hb_2024');
    expect(ids).toContain('gloomstalker_hb_shared');
    expect(ids).not.toContain('gloomstalker_hb_2014');
  });

  it('with no active ruleset (global/all-compatible browse mode): every entry is visible, matching pre-existing unfiltered behavior', () => {
    const ids = subclassEntriesForClassMerged('rogue', homebrew).map(s => s.id);
    expect(ids).toContain('gloomstalker_hb_2014');
    expect(ids).toContain('gloomstalker_hb_2024');
    expect(ids).toContain('gloomstalker_hb_shared');
  });

  it('a real OFFICIAL subclass (Rogue\'s Thief — genuinely untagged, not a fabricated example) stays visible under every ruleset filter', () => {
    expect(subclassEntriesForClassMerged('rogue', [], 'dnd5e-2014' as never).some(s => s.id === 'thief')).toBe(true);
    expect(subclassEntriesForClassMerged('rogue', [], 'dnd5e-2024' as never).some(s => s.id === 'thief')).toBe(true);
  });

  it('SubclassEntry.rulesetId carries the tag through onto the browse-shaped entry', () => {
    const entry = subclassEntriesForClassMerged('rogue', homebrew).find(s => s.id === 'gloomstalker_hb_2014');
    expect(entry?.rulesetId).toBe('dnd5e-2014');
  });

  it('getSubclassEntryMerged honors the activeRuleset filter too', () => {
    expect(getSubclassEntryMerged('rogue', 'gloomstalker_hb_2024', homebrew, 'dnd5e-2014' as never)).toBeNull();
    expect(getSubclassEntryMerged('rogue', 'gloomstalker_hb_2024', homebrew, 'dnd5e-2024' as never)?.name).toBe('2024-only Homebrew Subclass');
  });
});

// SHARED-QUERY-1: "What it adds" — real, derived from grant/effect data,
// not a fabricated taxonomy. init_spellcasting is a Grant kind (not a
// Feature Effect); armor/weapon/skill/tool proficiency grants are Effects
// with a real, established target-prefix convention (see races/index.ts).
describe('subclassAdditions', () => {
  const feature = (effects: Feature['effects']): Feature => ({
    id: 'f', name: 'F', description: '', source: { kind: 'subclass', refId: 'test' },
    level: null, actions: [], choices: [], passive: true, effects,
  });

  it('detects spellcasting granted via the init_spellcasting Grant kind', () => {
    const sub: SubclassProgression = {
      classId: 'fighter', name: 'Eldritch Knight',
      entries: [{ level: 3, grants: [{ kind: 'init_spellcasting', value: { ability: 'int' } }], choices: [], hpDie: 10 }],
    };
    expect(subclassAdditions(sub)).toEqual(new Set(['spellcasting']));
  });

  it('detects spellcasting granted via a grant_spell Effect', () => {
    const sub: SubclassProgression = {
      classId: 'rogue', name: 'Arcane Trickster',
      entries: [{ level: 3, grants: [{ kind: 'feature', value: feature([{ type: 'grant_spell', target: 'mage_hand', operation: 'add', value: null, condition: null }]) }], choices: [], hpDie: 8 }],
    };
    expect(subclassAdditions(sub)).toEqual(new Set(['spellcasting']));
  });

  it('detects armor/weapon/skill/tool proficiency grants by their real target prefix', () => {
    const sub: SubclassProgression = {
      classId: 'wizard', name: 'War Magic',
      entries: [{
        level: 2, hpDie: 6, choices: [],
        grants: [{ kind: 'feature', value: feature([
          { type: 'grant_proficiency', target: 'armor:medium', operation: 'add', value: null, condition: null },
          { type: 'grant_proficiency', target: 'weapon:longsword', operation: 'add', value: null, condition: null },
          { type: 'grant_proficiency', target: 'skill:arcana', operation: 'add', value: null, condition: null },
          { type: 'grant_proficiency', target: 'tool:alchemists_supplies', operation: 'add', value: null, condition: null },
        ]) }],
      }],
    };
    expect(subclassAdditions(sub)).toEqual(new Set(['armor_prof', 'weapon_prof', 'skill_prof', 'tool_prof']));
  });

  it('returns an empty set for a subclass with no such grants', () => {
    const sub: SubclassProgression = {
      classId: 'barbarian', name: 'Berserker',
      entries: [{ level: 3, grants: [{ kind: 'feature', value: feature([]) }], choices: [], hpDie: 12 }],
    };
    expect(subclassAdditions(sub).size).toBe(0);
  });
});

describe('filterAndSortSubclassOptions (SUBCLASS-BROWSE-1) — SubclassPicker.tsx search/filter/sort', () => {
  const isHomebrewOf = (e: { id: string }) => e.id === 'shadow_walker';
  const base = () => subclassEntriesForClassMerged('rogue', [homebrewThief({ id: asSubclassId('shadow_walker'), name: 'Shadow Walker' })]);

  it('search narrows by name substring, case-insensitively', () => {
    const result = filterAndSortSubclassOptions(base(), {
      search: 'assassin', officialFilter: 'all', addsFilter: new Set(), sort: 'name_asc', isHomebrewOf,
    });
    expect(result.map(r => r.id)).toEqual(['assassin']);
  });

  it('a search matching nothing returns an empty array, not an error', () => {
    const result = filterAndSortSubclassOptions(base(), {
      search: 'nonexistent_xyz', officialFilter: 'all', addsFilter: new Set(), sort: 'name_asc', isHomebrewOf,
    });
    expect(result).toEqual([]);
  });

  it('Official/Homebrew filter narrows correctly', () => {
    const officialOnly = filterAndSortSubclassOptions(base(), {
      search: '', officialFilter: 'official', addsFilter: new Set(), sort: 'name_asc', isHomebrewOf,
    });
    expect(officialOnly.some(r => r.id === 'shadow_walker')).toBe(false);

    const homebrewOnly = filterAndSortSubclassOptions(base(), {
      search: '', officialFilter: 'homebrew', addsFilter: new Set(), sort: 'name_asc', isHomebrewOf,
    });
    expect(homebrewOnly.map(r => r.id)).toEqual(['shadow_walker']);
  });

  it('"what it adds" filter narrows to subclasses that actually grant that addition', () => {
    const result = filterAndSortSubclassOptions(base(), {
      search: '', officialFilter: 'all', addsFilter: new Set(['spellcasting']), sort: 'name_asc', isHomebrewOf,
    });
    expect(result.some(r => r.id === 'arcane_trickster')).toBe(true);
    expect(result.some(r => r.id === 'assassin')).toBe(false); // Assassin grants tool profs, not spellcasting
  });

  it('sorts A-Z and Z-A correctly', () => {
    const az = filterAndSortSubclassOptions(base(), {
      search: '', officialFilter: 'all', addsFilter: new Set(), sort: 'name_asc', isHomebrewOf,
    }).map(r => r.name);
    const za = filterAndSortSubclassOptions(base(), {
      search: '', officialFilter: 'all', addsFilter: new Set(), sort: 'name_desc', isHomebrewOf,
    }).map(r => r.name);
    expect(az).toEqual([...za].reverse());
    expect(az).toEqual([...az].sort((a, b) => a.localeCompare(b)));
  });

  it('search + official filter + sort combine correctly (item 27: intersection and ordering)', () => {
    const result = filterAndSortSubclassOptions(base(), {
      search: 'a', officialFilter: 'official', addsFilter: new Set(), sort: 'name_desc', isHomebrewOf,
    });
    // Every result contains "a", none are the homebrew Shadow Walker, and order is Z-A.
    expect(result.every(r => r.name.toLowerCase().includes('a'))).toBe(true);
    expect(result.some(r => r.id === 'shadow_walker')).toBe(false);
    const names = result.map(r => r.name);
    expect(names).toEqual([...names].sort((a, b) => b.localeCompare(a)));
    expect(result.length).toBeGreaterThan(1); // real coverage, not a degenerate single-match case
  });
});
