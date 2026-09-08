// src/content/subclasses/__tests__/subclassBrowse.test.ts
// First test coverage for this file. Locks in a real fix:
// subclassEntriesForClassMerged used to plain-concatenate official +
// homebrew subclasses with no dedup, official listed first — a homebrew
// subclass sharing a derived id with an official one (a realistic
// collision, since both derive/author ids by slugifying the subclass name)
// showed as two entries, and any id-keyed lookup always resolved to the
// official one, the opposite of the homebrew-wins precedence used
// everywhere else (architecture review C1).
import { subclassEntriesForClassMerged, getSubclassEntryMerged } from '../subclassBrowse';
import { HomebrewSubclass, asSubclassId } from '../../../engine/types';

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
