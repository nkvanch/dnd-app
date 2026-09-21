import {
  packageKindOf, PACKAGE_KIND_LABELS, summarizeComposition, compositionLabel, packageStatusOf, filterPackages,
  PACKAGE_SORT_OPTIONS, buildPackDetail, DEFAULT_PACKAGE_FILTER,
} from '../packageLibrary';
import { sortByOption } from '../../content/contentQuery';
import type { InstalledPack } from '../../db/packRegistryRepo';
import type { HomebrewContent } from '../../db/contentCacheRepo';
import type { DependencyRef } from '../contentDependencies';

const pack = (o: Partial<InstalledPack> & { id: string }): InstalledPack => ({
  name: o.id, importedAt: 0, itemRefs: [], ...o,
});

const stormbound = pack({
  id: 'p-storm', name: 'Stormbound Test Pack', importedAt: 300, packageVersion: '1.0', author: 'Grimoire',
  itemRefs: [
    { type: 'spell', id: 'bolt' }, { type: 'feat', id: 'stormbound' }, { type: 'item', id: 'spear' },
    { type: 'monster', id: 'hound' }, { type: 'condition', id: 'charged' },
  ],
});
const aster = pack({ id: 'p-aster', name: 'Aster Test Pack', importedAt: 100, itemRefs: [{ type: 'race', id: 'aster' }, { type: 'spell', id: 'lance' }, { type: 'spell', id: 'lance2' }] });
const empty = pack({ id: 'p-empty', name: 'Zed', importedAt: 200 });

describe('Package types (N)', () => {
  it('every installed package is a Content Pack — the registry records nothing else', () => {
    for (const p of [stormbound, aster, empty]) expect(packageKindOf(p)).toBe('content');
    expect(PACKAGE_KIND_LABELS.content).toBe('Content Pack');
  });

  it('distinguishes what packages contain', () => {
    expect(compositionLabel(stormbound)).toBe('1 feat · 1 spell · 1 item · 1 monster · 1 condition');
    expect(compositionLabel(aster)).toBe('1 race · 2 spells');
    expect(summarizeComposition(empty)).toEqual([]);
  });
});

describe('Package status and filtering (E)', () => {
  it('derives ok / warning / error from diagnostics', () => {
    expect(packageStatusOf([])).toBe('ok');
    expect(packageStatusOf([{ severity: 'warning' }])).toBe('warning');
    expect(packageStatusOf([{ severity: 'warning' }, { severity: 'error' }])).toBe('error');
  });

  const status = (p: InstalledPack) => (p.id === 'p-aster' ? 'warning' as const : 'ok' as const);

  it('searches name and author', () => {
    expect(filterPackages([stormbound, aster, empty], { ...DEFAULT_PACKAGE_FILTER, search: 'storm' }, status).map(p => p.id)).toEqual(['p-storm']);
    expect(filterPackages([stormbound, aster, empty], { ...DEFAULT_PACKAGE_FILTER, search: 'grimoire' }, status).map(p => p.id)).toEqual(['p-storm']);
  });

  it('filters by status and returns everything with no filter', () => {
    expect(filterPackages([stormbound, aster, empty], { ...DEFAULT_PACKAGE_FILTER, status: 'warning' }, status).map(p => p.id)).toEqual(['p-aster']);
    expect(filterPackages([stormbound, aster, empty], DEFAULT_PACKAGE_FILTER, status)).toHaveLength(3);
  });

  it('sorts newest / oldest / A–Z / most entries', () => {
    const ids = (s: string) => sortByOption([aster, stormbound, empty], PACKAGE_SORT_OPTIONS, s).map(p => p.id);
    expect(ids('newest')).toEqual(['p-storm', 'p-empty', 'p-aster']);
    expect(ids('oldest')).toEqual(['p-aster', 'p-empty', 'p-storm']);
    expect(ids('name')).toEqual(['p-aster', 'p-storm', 'p-empty']);
    expect(ids('size')[0]).toBe('p-storm');
  });
});

describe('Package detail', () => {
  const store: Record<string, Record<string, unknown>> = {
    'spell:bolt': { id: 'bolt', name: 'Stormbound Bolt', rulesetId: '5.5e' },
    'feat:stormbound': { id: 'stormbound', name: 'Stormbound', feature: { effects: [], abilityEffects: [] } },
    'item:spear': {
      id: 'spear', name: 'Stormbound Spear',
      features: [{ id: 'f', name: 'Strike', abilityEffects: [{ type: 'apply_condition', conditionId: 'charged' }], effects: [] }],
    },
    'condition:charged': { id: 'charged', name: 'Static-Charged', features: [] },
    // 'monster:hound' deliberately absent → reported missing
  };
  const lookup = (ref: DependencyRef) => store[`${ref.type}:${ref.id}`] as unknown as HomebrewContent | undefined;

  it('groups included content by type with current names, flags missing entries, and reports rulesets', () => {
    const d = buildPackDetail(stormbound, lookup);
    expect(d.kind).toBe('content');
    expect(d.groups.map(g => g.type)).toEqual(['feat', 'spell', 'item', 'monster', 'condition']);
    expect(d.groups.find(g => g.type === 'spell')!.entries[0].name).toBe('Stormbound Bolt');
    expect(d.missingCount).toBe(1);
    expect(d.groups.find(g => g.type === 'monster')!.entries[0]).toMatchObject({ id: 'hound', missing: true });
    expect(d.rulesets).toEqual(['5.5e']);
  });

  it('reports dependencies the pack does not own', () => {
    const noCondition = pack({ ...stormbound, id: 'p-partial', itemRefs: [{ type: 'item', id: 'spear' }] });
    const d = buildPackDetail(noCondition, lookup);
    expect(d.externalDeps).toEqual([{ type: 'condition', id: 'charged', name: 'Static-Charged', missing: false }]);
    // the full pack owns its condition, so nothing is external
    expect(buildPackDetail(stormbound, lookup).externalDeps).toEqual([]);
  });

  it('an empty pack has an empty detail', () => {
    expect(buildPackDetail(empty, lookup)).toMatchObject({ groups: [], externalDeps: [], missingCount: 0 });
  });
});

describe('Packages reflect only registry-backed package kinds', () => {
  const read = (rel: string) => (require('fs') as typeof import('fs')).readFileSync((require('path') as typeof import('path')).resolve(__dirname, '../../..', rel), 'utf8');

  it('the only kind is "content", matching what installed_packs records', () => {
    expect(Object.keys(PACKAGE_KIND_LABELS)).toEqual(['content']);
    const registry = read('src/db/packRegistryRepo.ts');
    // the registry has no package-type column/field and never registers backup imports
    expect(registry).not.toMatch(/packType|kind\s*:/);
    expect(registry).toMatch(/'backup' type[^]*?imports[^]*?never registered/);
  });

  it('the Packages view invents no other package type (no character packs, no kind filter)', () => {
    const view = read('src/components/compendium/InstalledPackagesView.tsx');
    expect(view).not.toMatch(/Character Pack|character pack/);
    expect(view).toContain("kind: 'all'");
    // list controls are search / status / sort only — no per-kind chips
    expect(view).not.toMatch(/PACKAGE_KIND_LABELS\)\.map|Object\.keys\(PACKAGE_KIND_LABELS/);
  });
});
