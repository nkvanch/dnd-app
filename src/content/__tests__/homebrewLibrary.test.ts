import {
  buildLibraryEntries, filterLibraryEntries, libraryRulesets, editHrefFor, originLabel, descriptionOf,
  LIBRARY_SORT_OPTIONS, LIBRARY_CATEGORIES, LibraryEntry, PackOwnershipIndex,
} from '../homebrewLibrary';
import { sortByOption } from '../contentQuery';
import type { HomebrewArrays } from '../../store/homebrewLookup';
import type { HomebrewContent } from '../../db/contentCacheRepo';

const c = (o: Record<string, unknown>) => o as unknown as HomebrewContent;
const empty = (): HomebrewArrays => ({
  races: [], subraces: [], classes: [], subclasses: [], spells: [], backgrounds: [],
  features: [], items: [], feats: [], monsters: [], conditions: [],
});

function sample(): HomebrewArrays {
  return {
    ...empty(),
    races: [c({ id: 'tidewalker', name: 'Tidewalker', rulesetId: '5.5e' })],
    subraces: [c({ id: 'deep_tidewalker', name: 'Deep', parentId: 'tidewalker' })],
    subclasses: [c({ id: 'undertow', name: 'Undertow', classId: 'fighter' })],
    spells: [c({ id: 'storm_bolt', name: 'Stormbound Bolt', description: 'A bolt of lightning.' })],
    feats: [c({ id: 'aster_focus', name: 'Aster Focus', source: 'My Book' })],
    items: [c({ id: 'spear', name: 'Stormbound Spear' })],
  };
}

const owners: PackOwnershipIndex = new Map([['spell:storm_bolt', { packId: 'pack-1', packName: 'Stormbound Pack' }]]);

describe('Homebrew library entries (D)', () => {
  const entries = buildLibraryEntries(sample(), [{ id: 'tidewalker', name: 'Tidewalker' }], [{ id: 'fighter', name: 'Fighter' }]);

  it('lists every homebrew entry with its type, and only homebrew', () => {
    expect(entries.map(e => `${e.type}:${e.item.id}`).sort()).toEqual([
      'feat:aster_focus', 'item:spear', 'race:tidewalker', 'spell:storm_bolt', 'subclass:undertow', 'subrace:deep_tidewalker',
    ]);
  });

  it('labels subraces and subclasses with their parent', () => {
    expect(entries.find(e => e.type === 'subrace')!.parentName).toBe('Tidewalker');
    expect(entries.find(e => e.type === 'subclass')!.parentName).toBe('Fighter');
  });

  it('non-SRD-flagged homebrew is visible (library has no exposure filter) (M)', () => {
    expect(entries.some(e => e.type === 'item' && (e.item as { srd?: boolean }).srd !== true)).toBe(true);
  });

  it('an empty homebrew set gives an empty library', () => {
    expect(buildLibraryEntries(empty(), [], [])).toEqual([]);
  });
});

describe('Homebrew library search / filter / sort', () => {
  const entries = buildLibraryEntries(sample(), [], []);
  const base = { search: '', category: 'all' as const, ruleset: null, source: 'all', packOwnership: owners };

  it('searches by name, case-insensitively', () => {
    expect(filterLibraryEntries(entries, { ...base, search: 'STORM' }).map(e => e.item.id).sort()).toEqual(['spear', 'storm_bolt']);
  });

  it('filters by category and by ruleset', () => {
    expect(filterLibraryEntries(entries, { ...base, category: 'spell' }).map(e => e.item.id)).toEqual(['storm_bolt']);
    expect(filterLibraryEntries(entries, { ...base, ruleset: '5.5e' }).map(e => e.item.id)).toEqual(['tidewalker']);
    expect(libraryRulesets(entries)).toEqual(['5.5e']);
  });

  it('filters by source: locally authored vs a specific installed pack', () => {
    expect(filterLibraryEntries(entries, { ...base, source: 'pack-1' }).map(e => e.item.id)).toEqual(['storm_bolt']);
    expect(filterLibraryEntries(entries, { ...base, source: 'local' }).map(e => e.item.id)).not.toContain('storm_bolt');
    expect(filterLibraryEntries(entries, { ...base, source: 'local' })).toHaveLength(entries.length - 1);
  });

  it('sorts A–Z, Z–A and by type', () => {
    const names = (id: string) => sortByOption(entries, LIBRARY_SORT_OPTIONS, id).map(e => e.item.name);
    expect(names('name_asc')[0]).toBe('Aster Focus');
    expect(names('name_desc')[0]).toBe('Undertow');
    expect(sortByOption(entries, LIBRARY_SORT_OPTIONS, 'type')[0].type).toBe('race');
  });

  it('offers a category for every content type the store holds', () => {
    expect(LIBRARY_CATEGORIES.map(x => x.id)).toEqual(
      ['all', 'race', 'subrace', 'class', 'subclass', 'background', 'item', 'spell', 'feature', 'feat', 'monster', 'condition'],
    );
  });
});

describe('Provenance, editing, details', () => {
  const entries: LibraryEntry[] = buildLibraryEntries(sample(), [], []);

  it('shows pack provenance for imported entries and Local Homebrew otherwise', () => {
    expect(originLabel(entries.find(e => e.item.id === 'storm_bolt')!, owners)).toBe('Pack: Stormbound Pack');
    expect(originLabel(entries.find(e => e.item.id === 'spear')!, owners)).toBe('Local Homebrew');
  });

  it('routes editing to the existing builder with ?editId=', () => {
    expect(editHrefFor('feat', 'aster_focus')).toBe('/homebrew/feat-builder?editId=aster_focus');
    expect(editHrefFor('spell', 'storm_bolt')).toBe('/homebrew/spell-builder?editId=storm_bolt');
  });

  it('exposes a description only when the type carries one', () => {
    expect(descriptionOf(entries.find(e => e.item.id === 'storm_bolt')!)).toBe('A bolt of lightning.');
    expect(descriptionOf(entries.find(e => e.item.id === 'spear')!)).toBeUndefined();
  });
});
