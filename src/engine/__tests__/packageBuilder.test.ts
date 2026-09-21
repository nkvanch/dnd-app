import {
  computePackagePlan, computeSingleExportPlan, buildPackagePayload, buildPackage, singleExportMeta,
  toggleRef, removeRef, dedupeRefs, groupByType, groupPackContents, reviewWarnings, externalizedReferences,
  PACKAGE_CONTENT_TYPES, PACKAGE_CATEGORY_KEY, PackageLookup,
} from '../packageBuilder';
import { validateGrimoirePack, validatePackContents } from '../backup';
import { validatePackageForImport } from '../packageValidation';
import { detectConflicts, planPackageImport, findDuplicateIdsInPackage } from '../packageConflicts';
import type { HomebrewContent } from '../../db/contentCacheRepo';
import type { DependencyRef } from '../contentDependencies';

const hb = (o: Record<string, unknown>) => o as unknown as HomebrewContent & { rulesetId?: string };

const spell = (id: string, name: string) => hb({ id, name, level: 1, school: 'Evocation', castingTime: '1 action', range: '30 feet', duration: 'Instantaneous', description: 'Test spell.', ritual: false, concentration: false, classes: [] });
const src = (kind: string, refId: string) => ({ kind, refId });

// A small Lunar library: species + subclass + monster + item + two spells + condition + feat,
// wired so that dependencies genuinely exist and one is shared.
const LIB: Record<string, HomebrewContent & { rulesetId?: string }> = {
  'race:moonborn': hb({
    id: 'moonborn', name: 'Moonborn', features: [{ id: 'mb1', name: 'Moon Step Gift', source: src('race', 'moonborn'), level: null, passive: true, actions: [], choices: [], effects: [{ type: 'grant_spell', target: '', operation: 'add', value: null, condition: null, cantripIds: ['moon_step'] }], abilityEffects: [] }],
  }),
  'subclass:lunar_knight': hb({
    id: 'lunar_knight', name: 'Lunar Knight', classId: 'fighter',
    entries: [{ level: 3, choices: [], hpDie: 10, grants: [{ kind: 'known_spells', value: { spellIds: ['eclipse'] } }] }],
  }),
  'monster:eclipse_beast': hb({
    id: 'eclipse_beast', name: 'Eclipse Beast', cr: 1, size: 'medium', type: 'monstrosity', alignment: 'unaligned', stats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, hp: { dice: '2d8', average: 9 }, ac: { value: 12, source: 'natural' }, speed: 30, savingThrows: [], skills: {}, senses: [], languages: [],
    features: [{ id: 'eb1', name: 'Umbral Bite', source: src('campaign', 'eclipse_beast'), level: null, passive: false, actions: [], choices: [], effects: [], abilityEffects: [{ type: 'apply_condition', conditionId: 'eclipsed', duration: { unit: 'rounds', remaining: 2 } }] }],
  }),
  'item:moon_blade': hb({
    id: 'moon_blade', name: 'Moon Blade', weight: 3, cost: '-', properties: [],
    features: [{ id: 'mbl1', name: 'Eclipse Edge', source: src('item', 'moon_blade'), level: null, passive: false, actions: [], choices: [], effects: [], abilityEffects: [{ type: 'apply_condition', conditionId: 'eclipsed', duration: { unit: 'rounds', remaining: 1 } }] }],
  }),
  'spell:moon_step': spell('moon_step', 'Moon Step'),
  'spell:eclipse': spell('eclipse', 'Eclipse'),
  'spell:silver_lance': spell('silver_lance', 'Silver Lance'),
  'spell:crescent_ward': spell('crescent_ward', 'Crescent Ward'),
  'item:moon_charm': hb({ id: 'moon_charm', name: 'Moon Charm', weight: 0, cost: '-', properties: [], features: [] }),
  'condition:eclipsed': hb({ id: 'eclipsed', name: 'Eclipsed', features: [] }),
  'feat:lunar_adept': hb({ id: 'lunar_adept', name: 'Lunar Adept', prerequisite: null, description: '', feature: { id: 'la1', name: 'Adept', source: src('feat', 'lunar_adept'), level: null, passive: true, actions: [], choices: [], effects: [], abilityEffects: [] } }),
};
const lookup: PackageLookup = ref => LIB[`${ref.type}:${ref.id}`];
const isOfficial = (r: { type: string; id: string }) => r.type === 'class' && r.id === 'fighter';

const R = (type: string, id: string): DependencyRef => ({ type: type as DependencyRef['type'], id });

describe('Export Homebrew — one entry plus what it requires', () => {
  it('A. one feat exports as exactly one primary entry', () => {
    const plan = computeSingleExportPlan(R('feat', 'lunar_adept'), lookup);
    expect(plan.selected.map(e => e.id)).toEqual(['lunar_adept']);
    expect(plan.counts).toEqual({ selected: 1, dependencies: 0, total: 1 });
    const { homebrew, contents } = buildPackagePayload(plan, lookup);
    expect(homebrew.feats).toHaveLength(1);
    expect(contents).toEqual([expect.objectContaining({ type: 'feat', id: 'lunar_adept', included: 'selected' })]);
  });

  it('B. a dependent spell/condition is included automatically and marked as a dependency', () => {
    const plan = computeSingleExportPlan(R('race', 'moonborn'), lookup);
    expect(plan.selected.map(e => e.id)).toEqual(['moonborn']);
    expect(plan.dependencies.map(e => e.id)).toEqual(['moon_step']);
    expect(plan.dependencies[0].requiredBy).toEqual(['Moonborn']);
    const { contents } = buildPackagePayload(plan, lookup);
    expect(contents.map(c => `${c.id}:${c.included}`).sort()).toEqual(['moon_step:dependency', 'moonborn:selected']);
  });

  it('C. unrelated library entries are excluded', () => {
    const { homebrew, contents } = buildPackagePayload(computeSingleExportPlan(R('spell', 'moon_step'), lookup), lookup);
    expect(contents.map(c => c.id)).toEqual(['moon_step']);
    expect(Object.keys(homebrew)).toEqual(['spells']);
    expect(homebrew.races).toBeUndefined();
    expect(homebrew.subclasses).toBeUndefined();
    expect(homebrew.monsters).toBeUndefined();
  });

  it('a subclass of an official class does not bundle the class, and says so instead of warning', () => {
    const plan = computeSingleExportPlan(R('subclass', 'lunar_knight'), lookup);
    expect(plan.dependencies.map(e => e.id)).toEqual(['eclipse']);
    expect(externalizedReferences(plan, isOfficial)).toEqual([{ type: 'class', id: 'fighter' }]);
    expect(reviewWarnings(plan, isOfficial)).toEqual([]);
    // without the official check the same reference is reported as unresolved
    expect(reviewWarnings(plan)).toHaveLength(1);
  });

  it('single export needs no invented package name: it defaults to the entry name, version 1.0', () => {
    expect(singleExportMeta('Storm Knight')).toEqual({ name: 'Storm Knight', packageVersion: '1.0', author: undefined, description: undefined });
  });

  it('F. the file passes envelope + content validation and the package importer', () => {
    const pack = JSON.parse(JSON.stringify(buildPackage(computeSingleExportPlan(R('race', 'moonborn'), lookup), lookup, singleExportMeta('Moonborn'), null, '1.0.0')));
    expect(validateGrimoirePack(pack)).toBeNull();
    expect(validatePackContents(pack)).toEqual([]);
    const v = validatePackageForImport(pack, new Set(['dnd5e-2014', 'dnd5e-2024']), () => undefined);
    expect(v.blocking).toEqual([]);
    expect(v.issues.filter(i => i.code === 'package_missing_dependency')).toEqual([]);
    expect(pack.packType).toBe('content-pack');
  });
});

describe('Export Package — several chosen entries, one file', () => {
  const chosen = [R('race', 'moonborn'), R('subclass', 'lunar_knight'), R('spell', 'silver_lance'), R('monster', 'eclipse_beast'), R('item', 'moon_blade')];

  it('A/B. every explicitly selected entry is included, across several content types', () => {
    const plan = computePackagePlan(chosen, lookup);
    expect(plan.selected.map(e => e.id).sort()).toEqual(['eclipse_beast', 'lunar_knight', 'moon_blade', 'moonborn', 'silver_lance']);
    expect(new Set(plan.selected.map(e => e.type)).size).toBe(5);
  });

  it('a package can hold 1 species, 1 subclass, 4 spells, 2 items, 1 monster and 1 condition', () => {
    const refs = [
      R('race', 'moonborn'), R('subclass', 'lunar_knight'),
      R('spell', 'moon_step'), R('spell', 'eclipse'), R('spell', 'silver_lance'), R('spell', 'crescent_ward'), R('spell', 'moon_step'),
      R('item', 'moon_blade'), R('item', 'moon_charm'), R('monster', 'eclipse_beast'), R('condition', 'eclipsed'),
    ];
    const plan = computePackagePlan(refs, lookup);
    const { homebrew } = buildPackagePayload(plan, lookup);
    expect(homebrew.races).toHaveLength(1);
    expect(homebrew.subclasses).toHaveLength(1);
    expect(homebrew.spells).toHaveLength(4); // moon_step selected twice, still once
    expect(homebrew.items).toHaveLength(2);
    expect(homebrew.monsters).toHaveLength(1);
    expect(homebrew.conditions).toHaveLength(1);
  });

  it('every portable content type the format supports can be part of a package', () => {
    expect(PACKAGE_CONTENT_TYPES.sort()).toEqual(
      ['background', 'class', 'condition', 'feat', 'feature', 'item', 'monster', 'race', 'spell', 'subclass', 'subrace'],
    );
    expect(new Set(Object.values(PACKAGE_CATEGORY_KEY)).size).toBe(PACKAGE_CONTENT_TYPES.length);
  });

  it('E. the dependency closure is added', () => {
    const plan = computePackagePlan(chosen, lookup);
    expect(plan.dependencies.map(e => e.id).sort()).toEqual(['eclipse', 'eclipsed', 'moon_step']);
  });

  it('F. a dependency required by two selected entries appears once', () => {
    const plan = computePackagePlan([R('monster', 'eclipse_beast'), R('item', 'moon_blade')], lookup);
    const eclipsed = plan.dependencies.filter(e => e.id === 'eclipsed');
    expect(eclipsed).toHaveLength(1);
    expect(eclipsed[0].requiredBy.sort()).toEqual(['Eclipse Beast', 'Moon Blade']);
    const { homebrew } = buildPackagePayload(plan, lookup);
    expect(homebrew.conditions).toHaveLength(1);
  });

  it('G. removing a selected entry removes dependencies nothing else requires', () => {
    let explicit = dedupeRefs(chosen);
    expect(computePackagePlan(explicit, lookup).dependencies.map(e => e.id)).toContain('moon_step');
    explicit = removeRef(explicit, R('race', 'moonborn')); // moon_step only came from Moonborn
    const after = computePackagePlan(explicit, lookup);
    expect(after.dependencies.map(e => e.id)).not.toContain('moon_step');
    expect(after.dependencies.map(e => e.id).sort()).toEqual(['eclipse', 'eclipsed']);
    // eclipsed is still required by the monster and the item, so it stays
    explicit = removeRef(explicit, R('monster', 'eclipse_beast'));
    expect(computePackagePlan(explicit, lookup).dependencies.map(e => e.id)).toContain('eclipsed');
    explicit = removeRef(explicit, R('item', 'moon_blade'));
    expect(computePackagePlan(explicit, lookup).dependencies.map(e => e.id)).not.toContain('eclipsed');
  });

  it('H. an explicitly selected dependency stays, as "selected", after nothing requires it any more', () => {
    let explicit = [R('race', 'moonborn'), R('spell', 'moon_step')];
    let plan = computePackagePlan(explicit, lookup);
    expect(plan.selected.map(e => e.id).sort()).toEqual(['moon_step', 'moonborn']);
    expect(plan.dependencies).toEqual([]); // explicit picks win the label
    explicit = removeRef(explicit, R('race', 'moonborn'));
    plan = computePackagePlan(explicit, lookup);
    expect(plan.selected.map(e => e.id)).toEqual(['moon_step']);
  });

  it('I. the review counts distinguish selected, dependency and total', () => {
    const plan = computePackagePlan(chosen, lookup);
    expect(plan.counts).toEqual({ selected: 5, dependencies: 3, total: 8 });
    const two = computePackagePlan([R('subclass', 'lunar_knight'), R('monster', 'eclipse_beast')], lookup);
    expect(two.counts).toEqual({ selected: 2, dependencies: 2, total: 4 });
  });

  it('J. exports ONE package containing the full reviewed set', () => {
    const plan = computePackagePlan(chosen, lookup);
    const pack = buildPackage(plan, lookup, { name: 'My Lunar Collection', packageVersion: '2.1', author: 'Nika' }, null, '1.0.0');
    expect(pack.packType).toBe('content-pack');
    expect(pack.name).toBe('My Lunar Collection');
    expect(pack.packageVersion).toBe('2.1');
    expect(pack.contents).toHaveLength(8);
    expect(pack.contents!.filter(c => c.included === 'selected')).toHaveLength(5);
    expect(pack.contents!.filter(c => c.included === 'dependency')).toHaveLength(3);
    const flat = Object.values(pack.homebrew!).reduce((n, arr) => n + (arr as unknown[]).length, 0);
    expect(flat).toBe(8);
  });

  it('toggle adds then removes; the same id is never selected twice', () => {
    let e = toggleRef([], R('spell', 'eclipse'));
    e = toggleRef(e, R('spell', 'eclipse'));
    expect(e).toEqual([]);
    e = toggleRef(toggleRef([], R('spell', 'eclipse')), R('spell', 'moon_step'));
    expect(dedupeRefs([...e, ...e])).toHaveLength(2);
  });

  it('a selected entry that was deleted since is reported and not exported', () => {
    const plan = computePackagePlan([R('spell', 'moon_step'), R('spell', 'gone')], lookup);
    expect(plan.counts.selected).toBe(1);
    expect(plan.missingSelected).toEqual([R('spell', 'gone')]);
    expect(reviewWarnings(plan)[0].kind).toBe('missing_selected');
    expect(buildPackagePayload(plan, lookup).contents.map(c => c.id)).toEqual(['moon_step']);
  });

  it('groups review entries by type in a stable order', () => {
    const g = groupByType(computePackagePlan(chosen, lookup).selected);
    expect(g.map(x => x.type)).toEqual(['race', 'subclass', 'spell', 'item', 'monster']);
  });
});

describe('Import preview and validation', () => {
  const chosen = [R('race', 'moonborn'), R('subclass', 'lunar_knight'), R('spell', 'silver_lance'), R('monster', 'eclipse_beast')];
  const make = () => JSON.parse(JSON.stringify(buildPackage(computePackagePlan(chosen, lookup), lookup, { name: 'Lunar' }, null, '1.0.0')));

  it('previews a multi-entry package grouped by type, with dependencies apart from the content', () => {
    const groups = groupPackContents(make());
    expect(groups.content.map(g => `${g.type}:${g.entries.map(e => e.name).join('|')}`)).toEqual([
      'race:Moonborn', 'subclass:Lunar Knight', 'spell:Silver Lance', 'monster:Eclipse Beast',
    ]);
    expect(groups.dependencies.map(g => `${g.type}:${g.entries.map(e => e.name).sort().join('|')}`)).toEqual([
      'spell:Eclipse|Moon Step', 'condition:Eclipsed',
    ]);
    expect(groups.counts).toEqual({ content: 4, dependencies: 3, total: 7 });
  });

  it('a single-entry export previews as one content entry and no dependencies', () => {
    const one = JSON.parse(JSON.stringify(buildPackage(computeSingleExportPlan(R('feat', 'lunar_adept'), lookup), lookup, singleExportMeta('Lunar Adept'), null, '1.0.0')));
    expect(groupPackContents(one).counts).toEqual({ content: 1, dependencies: 0, total: 1 });
  });

  it('a package with no manifest (older export) previews every entry as content', () => {
    const legacy = make();
    delete legacy.contents;
    expect(groupPackContents(legacy).counts).toEqual({ content: 7, dependencies: 0, total: 7 });
  });

  it('import all: the plan saves every entry, with no conflicts against an empty library', () => {
    const pack = make();
    expect(validatePackageForImport(pack, new Set(['dnd5e-2014', 'dnd5e-2024']), () => undefined).blocking).toEqual([]);
    const conflicts = detectConflicts(pack.homebrew, () => undefined);
    expect(conflicts).toEqual([]);
    const { toSave, skipped } = planPackageImport(pack, conflicts, new Map());
    expect(toSave).toHaveLength(7);
    expect(skipped).toHaveLength(0);
    expect(toSave.every(e => e.resolution === 'no_conflict')).toBe(true);
  });

  it('a missing dependency is reported as a non-blocking issue and nothing throws', () => {
    const pack = make();
    pack.homebrew.spells = pack.homebrew.spells.filter((s: { id: string }) => s.id !== 'moon_step');
    pack.contents = pack.contents.filter((c: { id: string }) => c.id !== 'moon_step');
    const v = validatePackageForImport(pack, new Set(['dnd5e-2014', 'dnd5e-2024']), () => undefined);
    expect(v.blocking).toEqual([]);
    expect(v.issues.some(i => i.code === 'package_missing_dependency')).toBe(true);
  });

  it('a structurally invalid package (duplicate ids) is rejected as blocking, before anything is planned', () => {
    const pack = make();
    pack.homebrew.spells.push({ ...pack.homebrew.spells[0] });
    expect(findDuplicateIdsInPackage(pack.homebrew)).not.toEqual([]);
    const v = validatePackageForImport(pack, new Set(['dnd5e-2014', 'dnd5e-2024']), () => undefined);
    expect(v.blocking.length).toBeGreaterThan(0);
  });

  it('a malformed entry is rejected by content validation', () => {
    const pack = make();
    pack.homebrew.spells[0].level = 'high';
    const problems = validatePackContents(pack);
    expect(problems.length).toBeGreaterThan(0);
  });
});
