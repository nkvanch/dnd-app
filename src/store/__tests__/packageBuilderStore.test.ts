import { usePackageBuilderStore } from '../packageBuilderStore';
import { computePackagePlan, PackageLookup } from '../../engine/packageBuilder';
import { filterLibraryEntries, buildLibraryEntries, DEFAULT_LIBRARY_FILTER } from '../../content/homebrewLibrary';
import type { HomebrewContent } from '../../db/contentCacheRepo';
import type { HomebrewArrays } from '../homebrewLookup';
import type { DependencyRef } from '../../engine/contentDependencies';

const hb = (o: Record<string, unknown>) => o as unknown as HomebrewContent;
const R = (type: string, id: string): DependencyRef => ({ type: type as DependencyRef['type'], id });
const empty = (): HomebrewArrays => ({
  races: [], subraces: [], classes: [], subclasses: [], spells: [], backgrounds: [], features: [], items: [], feats: [], monsters: [], conditions: [],
});

beforeEach(() => usePackageBuilderStore.getState().reset());
const st = () => usePackageBuilderStore.getState();

describe('Package builder selection (C, D)', () => {
  it('C. the picker stays open while many entries are selected: toggling never leaves the Select step', () => {
    for (const ref of [R('race', 'moonborn'), R('subclass', 'lunar_knight'), R('spell', 'moon_step'), R('spell', 'eclipse'), R('monster', 'eclipse_beast')]) st().toggle(ref);
    expect(st().explicit).toHaveLength(5);
    expect(st().step).toBe('select');
  });

  it('D. the selection survives search and type-filter changes', () => {
    st().toggle(R('spell', 'moon_step'));
    st().toggle(R('race', 'moonborn'));
    st().setField('search', 'zzz-matches-nothing');
    st().setCategory('monster');
    st().setField('search', '');
    st().setCategory('all');
    expect(st().explicit.map(r => r.id).sort()).toEqual(['moon_step', 'moonborn']);
  });

  it('selection also survives leaving to an editor and coming back (state is not component-local)', () => {
    st().toggle(R('spell', 'eclipse'));
    st().setField('name', 'Lunar');
    // the screen unmounts and remounts: the next read sees the same store
    expect(usePackageBuilderStore.getState().explicit).toEqual([R('spell', 'eclipse')]);
    expect(usePackageBuilderStore.getState().name).toBe('Lunar');
  });

  it('the type filter and search narrow the list without touching the selection', () => {
    const hbArrays = {
      ...empty(),
      spells: [hb({ id: 'moon_step', name: 'Moon Step' }), hb({ id: 'eclipse', name: 'Eclipse' })],
      races: [hb({ id: 'moonborn', name: 'Moonborn' })],
    };
    const entries = buildLibraryEntries(hbArrays, [], []);
    const base = { ...DEFAULT_LIBRARY_FILTER, packOwnership: new Map() };
    st().toggle(R('race', 'moonborn'));
    expect(filterLibraryEntries(entries, { ...base, category: 'spell' }).map(e => e.item.id).sort()).toEqual(['eclipse', 'moon_step']);
    expect(filterLibraryEntries(entries, { ...base, search: 'moon' }).map(e => e.item.id).sort()).toEqual(['moon_step', 'moonborn']);
    expect(st().explicit).toEqual([R('race', 'moonborn')]);
  });

  it('remove drops only that entry; dependencies are derived, never stored', () => {
    const lookup: PackageLookup = ref => ({
      'race:a': hb({ id: 'a', name: 'A', features: [{ effects: [{ type: 'grant_spell', cantripIds: ['s'] }], abilityEffects: [] }] }),
      'spell:s': hb({ id: 's', name: 'S' }),
    } as Record<string, HomebrewContent>)[`${ref.type}:${ref.id}`];
    st().toggle(R('race', 'a'));
    expect(computePackagePlan(st().explicit, lookup).counts.dependencies).toBe(1);
    st().remove(R('race', 'a'));
    expect(st().explicit).toEqual([]);
    expect(computePackagePlan(st().explicit, lookup).counts).toEqual({ selected: 0, dependencies: 0, total: 0 });
  });

  it('begin() seeds a fresh builder (library Select mode / installed package Export) without duplicates', () => {
    st().toggle(R('spell', 'old'));
    st().begin({ explicit: [R('spell', 'a'), R('spell', 'a'), R('race', 'b')], name: 'Seeded', version: '3.0', step: 'review' });
    expect(st().explicit).toEqual([R('spell', 'a'), R('race', 'b')]);
    expect(st().name).toBe('Seeded');
    expect(st().version).toBe('3.0');
    expect(st().step).toBe('review');
    st().begin();
    expect(st().explicit).toEqual([]);
    expect(st().step).toBe('select');
  });
});
