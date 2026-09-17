// src/store/__tests__/packageRoundTrip.test.ts
// HOMEBREW-PACKAGE-1 item 5: full export→import acceptance coverage for
// EVERY supported homebrew content type (not just the pairwise dependency
// cases packageConflicts.test.ts/contentDependencies.test.ts already cover).
// For each type: create a fixture -> build a package (createPackageContentPack,
// the same function PackageExportModal calls) -> JSON round-trip (simulating
// a real file write/read, since packageIO.ts's actual FileSystem calls are a
// thin, already-established wrapper — see backupIO.test.ts's own precedent
// for not re-testing expo-file-system itself) -> validate against a CLEAN
// (empty) local store -> detect conflicts (none expected) -> plan the import
// -> place the planned items into useHomebrewStore (the real store
// getMergedContentDB() reads from) -> confirm the content resolves through
// that SAME normal registry path, not just that the raw JSON round-tripped.
//
// Scoping note: this deliberately calls useHomebrewStore.setState() to place
// the planned items rather than useHomebrewStore.getState().saveItem() —
// saveItem() awaits a real SQLite write (contentCacheRepo.saveHomebrewContent)
// that throws under this test environment (Platform.OS reports 'ios' under
// jest-expo, not 'web', so saveHomebrewContent's web no-op guard doesn't
// apply, and no initDb() ever ran here) unless getDb() is mocked — mocking
// that DB layer is already covered elsewhere (src/db/__tests__/
// contentCacheRepo.test.ts) and isn't what this test is verifying. What THIS
// test verifies — the import PLAN produces correct, resolvable content — is
// fully exercised by placing toSave's items into store state directly, the
// same in-memory shape saveItem's own `set()` call would produce.
import { useHomebrewStore } from '../homebrewStore';
import { createPackageContentPack, GrimoirePackHomebrew, PackageContentRef } from '../../engine/backup';
import { validatePackageForImport } from '../../engine/packageValidation';
import { detectConflicts, planPackageImport, ConflictResolution } from '../../engine/packageConflicts';
import { HomebrewArrays } from '../homebrewLookup';
import { ContentCacheType, HomebrewContent } from '../../db/contentCacheRepo';
import { subclassEntriesForClassMerged } from '../../content/subclasses/subclassBrowse';
import { resolveMonsterById } from '../../content/contentResolution';
import type { CharClass, Feature } from '../../engine/types';

const EMPTY: HomebrewArrays = {
  races: [], subraces: [], classes: [], subclasses: [], spells: [],
  backgrounds: [], features: [], items: [], feats: [], monsters: [], conditions: [],
};

const CATEGORY_KEY: Record<ContentCacheType, keyof GrimoirePackHomebrew> = {
  race: 'races', subrace: 'subraces', class: 'classes', subclass: 'subclasses',
  spell: 'spells', background: 'backgrounds', feature: 'features', item: 'items',
  feat: 'feats', monster: 'monsters', condition: 'conditions',
};

/** One minimal-but-structurally-plausible fixture per supported content
 *  type, id-prefixed 'rt_' (round-trip) to avoid colliding with any other
 *  test's ids sharing this same store module instance. */
function fixtureFor(type: ContentCacheType): HomebrewContent {
  switch (type) {
    case 'race': return { id: 'rt_race', name: 'RT Race', features: [] } as unknown as HomebrewContent;
    case 'subrace': return { id: 'rt_subrace', name: 'RT Subrace', parentId: 'rt_race', features: [] } as unknown as HomebrewContent;
    case 'class': return { id: 'rt_class', name: 'RT Class', hitDie: 8, features: [] } as unknown as HomebrewContent;
    case 'subclass': return { id: 'rt_subclass', name: 'RT Subclass', classId: 'rt_class', entries: [] } as unknown as HomebrewContent;
    case 'background': return { id: 'rt_background', name: 'RT Background', features: [] } as unknown as HomebrewContent;
    case 'feat': return {
      id: 'rt_feat', name: 'RT Feat', prerequisite: null, description: 'A round-trip test feat.', source: 'Homebrew',
      feature: { id: 'rt_feat_feature', name: 'RT Feat', description: '', source: { kind: 'feat', refId: 'rt_feat' }, level: null, effects: [], actions: [], choices: [], passive: true },
    } as unknown as HomebrewContent;
    case 'spell': return {
      id: 'rt_spell', name: 'RT Spell', level: 1, school: 'Evocation',
      castingTime: '1 action', range: '30 feet', duration: 'Instantaneous', description: 'A round-trip test spell.',
    } as unknown as HomebrewContent;
    case 'item': return { id: 'rt_item', name: 'RT Item', weight: 1, cost: '1 gp', properties: [], features: [] } as unknown as HomebrewContent;
    case 'monster': return { id: 'rt_monster', name: 'RT Monster', cr: 1, size: 'medium', type: 'beast', alignment: 'unaligned', stats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, hp: { dice: '2d8', average: 9 }, ac: { value: 12, source: 'natural armor' }, speed: 30, features: [], savingThrows: [], skills: {}, senses: [], languages: [] } as unknown as HomebrewContent;
    case 'condition': return { id: 'rt_condition', name: 'RT Condition', description: '', features: [] } as unknown as HomebrewContent;
    case 'feature': return { id: 'rt_feature', name: 'RT Feature', description: '', source: { kind: 'race', refId: 'rt_race' }, level: null, effects: [], actions: [], choices: [], passive: true } as unknown as HomebrewContent;
  }
}

const ALL_TYPES: ContentCacheType[] = [
  'race', 'subrace', 'class', 'subclass', 'background', 'feat', 'spell', 'item', 'monster', 'condition',
];

function resetStore() {
  // Cast: EMPTY's arrays are typed generically as HomebrewContent[] (this
  // file's own shared shape) rather than per-type (Race[], CharClass[],
  // ...) — every value is [] regardless, so this is a type-level-only
  // widening, not a runtime behavior change.
  useHomebrewStore.setState({ ...EMPTY } as never);
}

/** Builds a single-item package the same shape PackageExportModal builds:
 *  one GrimoirePackHomebrew category populated, one matching PackageContentRef. */
function buildSinglePackage(type: ContentCacheType, item: HomebrewContent) {
  const homebrewPayload: GrimoirePackHomebrew = { [CATEGORY_KEY[type]]: [item] };
  const contents: PackageContentRef[] = [{ type, id: item.id, name: item.name, included: 'selected' }];
  return createPackageContentPack(homebrewPayload, contents, { name: `RT ${type} pack` }, null, '1.0.0');
}

describe('full package round trip — every supported content type (item 5)', () => {
  it.each(ALL_TYPES)('%s: create -> export -> JSON round-trip -> import into a clean store -> resolves via getMergedContentDB', (type) => {
    resetStore();
    const fixture = fixtureFor(type);

    // export
    const pack = buildSinglePackage(type, fixture);
    // JSON round-trip — simulates the real file write/read packageIO.ts does.
    const roundTripped = JSON.parse(JSON.stringify(pack));

    // import into a CLEAN store: lookup functions see nothing local.
    const emptyLookup = () => undefined;
    const emptyNameLookup = () => undefined;
    const validation = validatePackageForImport(roundTripped, new Set(['dnd5e-2014', 'dnd5e-2024']), emptyLookup);
    expect(validation.blocking).toEqual([]);

    const conflicts = detectConflicts(roundTripped.homebrew, emptyNameLookup);
    expect(conflicts).toEqual([]);

    const { toSave } = planPackageImport(roundTripped, conflicts, new Map());
    expect(toSave).toHaveLength(1);
    expect(toSave[0].resolution).toBe('no_conflict');
    expect(toSave[0].finalId).toBe(fixture.id);

    // "reload through the normal homebrew/content registry path" — place the
    // planned item into the store the same way saveItem's own set() call
    // would, then resolve it through whichever function real UI actually
    // uses to see this content type (NOT all 10 types route through
    // getMergedContentDB() — subrace attaches onto its parent race, and
    // subclass/monster are resolved through their own dedicated merge
    // functions; see each branch's comment for the real call site it mirrors).
    if (type === 'race') {
      // A race that also has an attached homebrew subrace is exercised by
      // the dedicated subrace case below; here just place the race itself.
      useHomebrewStore.setState(state => ({ races: [...state.races, toSave[0].item as never] }));
      const merged = useHomebrewStore.getState().getMergedContentDB();
      const resolved = merged.races.find(r => r.id === fixture.id);
      expect(resolved).toBeDefined();
      expect(resolved!.name).toBe(fixture.name);
    } else if (type === 'subrace') {
      // Real path: race-detail.tsx / getMergedContentDB() attaches a
      // standalone subrace onto its parent Race's own .subraces array —
      // there is no top-level ContentDB.subraces field.
      useHomebrewStore.setState(state => ({
        races: [{ id: 'rt_race', name: 'RT Race', features: [] } as never, ...state.races],
        subraces: [...state.subraces, toSave[0].item as never],
      }));
      const merged = useHomebrewStore.getState().getMergedContentDB();
      const parentRace = merged.races.find(r => r.id === 'rt_race');
      expect(parentRace).toBeDefined();
      const attached = (parentRace as unknown as { subraces?: HomebrewContent[] }).subraces?.find(s => s.id === fixture.id);
      expect(attached).toBeDefined();
      expect(attached!.name).toBe(fixture.name);
    } else if (type === 'subclass') {
      // Real path: SubclassPicker.tsx's subclassEntriesForClassMerged(classId, homebrewSubclasses).
      useHomebrewStore.setState(state => ({ subclasses: [...state.subclasses, toSave[0].item as never] }));
      const entries = subclassEntriesForClassMerged('rt_class', useHomebrewStore.getState().subclasses);
      const resolved = entries.find(e => e.id === fixture.id);
      expect(resolved).toBeDefined();
      expect(resolved!.name).toBe(fixture.name);
    } else if (type === 'monster') {
      // Real path: compendium.tsx/dm/monsters.tsx's resolveMonsterById/mergeMonsterIndex — monsters aren't part of ContentDB.
      useHomebrewStore.setState(state => ({ monsters: [...state.monsters, toSave[0].item as never] }));
      const resolved = resolveMonsterById(fixture.id, useHomebrewStore.getState().monsters);
      expect(resolved).toBeDefined();
      expect(resolved!.name).toBe(fixture.name);
    } else {
      // race/class/background/feat/spell/item/feature/condition all resolve
      // through the shared getMergedContentDB() merge point.
      useHomebrewStore.setState(state => {
        const key = CATEGORY_KEY[type] as keyof HomebrewArrays;
        return { [key]: [...(state as unknown as HomebrewArrays)[key], toSave[0].item] } as never;
      });
      const merged = useHomebrewStore.getState().getMergedContentDB();
      const resolvedKey = CATEGORY_KEY[type] as keyof typeof merged;
      const resolved = (merged[resolvedKey] as HomebrewContent[]).find(i => i.id === fixture.id);
      expect(resolved).toBeDefined();
      expect(resolved!.name).toBe(fixture.name);
      expect(JSON.parse(JSON.stringify(resolved))).toEqual(JSON.parse(JSON.stringify(fixture)));
    }
  });
});

type ClassWithRawProgression = {
  id: string; name: string; hitDie: number; features: unknown[];
  rawProgression: { classId: string; entries: { level: number; hpDie: number; choices: unknown[]; grants: { kind: string; value: { id: string } }[] }[] };
};

describe('Feature/supporting-definition round trip (item 6)', () => {
  it('a Class that depends on a separately-exported Feature (via rawProgression) round-trips and the dependent Class still resolves its own data correctly', () => {
    resetStore();
    const feature = { id: 'rt_granted_feature', name: 'Granted Feature', description: '', source: { kind: 'class', refId: 'rt_dep_class' }, level: null, effects: [], actions: [], choices: [], passive: true } as unknown as HomebrewContent;
    const cls = {
      id: 'rt_dep_class', name: 'RT Dependent Class', hitDie: 8, features: [],
      rawProgression: { classId: 'rt_dep_class', entries: [{ level: 1, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: feature }] }] },
    } as unknown as ClassWithRawProgression as HomebrewContent;

    const homebrewPayload: GrimoirePackHomebrew = { classes: [cls as unknown as CharClass], features: [feature as unknown as Feature] };
    const contents: PackageContentRef[] = [
      { type: 'class', id: cls.id, name: cls.name, included: 'selected' },
      { type: 'feature', id: feature.id, name: feature.name, included: 'dependency' },
    ];
    const pack = createPackageContentPack(homebrewPayload, contents, { name: 'RT dep pack' }, null, '1.0.0');
    const roundTripped = JSON.parse(JSON.stringify(pack));

    const validation = validatePackageForImport(roundTripped, new Set(), () => undefined);
    expect(validation.blocking).toEqual([]);
    const conflicts = detectConflicts(roundTripped.homebrew, () => undefined);
    const { toSave } = planPackageImport(roundTripped, conflicts, new Map());
    expect(toSave).toHaveLength(2);

    useHomebrewStore.setState(state => ({
      classes: [...state.classes, ...toSave.filter(e => e.type === 'class').map(e => e.item)],
      features: [...state.features, ...toSave.filter(e => e.type === 'feature').map(e => e.item)],
    } as never));

    const merged = useHomebrewStore.getState().getMergedContentDB();
    const resolvedClass = merged.classes.find(c => c.id === 'rt_dep_class') as unknown as ClassWithRawProgression;
    expect(resolvedClass).toBeDefined();
    // The class's own embedded feature-grant data survived the round trip —
    // this is what "dependent content still resolves" means for a type
    // (Feature) with no Homebrew Library row of its own.
    expect(resolvedClass.rawProgression.entries[0].grants[0].value.id).toBe('rt_granted_feature');
    const resolvedFeature = merged.features.find(f => f.id === 'rt_granted_feature');
    expect(resolvedFeature).toBeDefined();
  });
});

// HOMEBREW-PACKAGE-1 items 7/8/9: ruleset preservation, multi-ruleset
// packages, unsupported-ruleset import. packageValidation.test.ts already
// covers the Issue-emission logic in isolation (unit-level); these tests
// prove the SAME behavior survives the full export -> JSON round-trip ->
// import -> store-resolution pipeline, not just the validator call.
describe('ruleset preservation (items 7-9)', () => {
  function raceWithRuleset(id: string, rulesetId: string): HomebrewContent {
    return { id, name: id, features: [], rulesetId } as unknown as HomebrewContent;
  }

  it.each(['dnd5e-2014', 'dnd5e-2024'])('a %s-tagged race keeps that exact rulesetId after export -> import', (rulesetId) => {
    resetStore();
    const race = raceWithRuleset('rt_ruleset_race', rulesetId);
    const pack = buildSinglePackage('race', race);
    const roundTripped = JSON.parse(JSON.stringify(pack));
    const validation = validatePackageForImport(roundTripped, new Set(['dnd5e-2014', 'dnd5e-2024']), () => undefined);
    expect(validation.blocking).toEqual([]);
    // No 'unsupported ruleset' warning for a ruleset this device DOES support.
    expect(validation.issues.filter(i => i.code === 'package_unsupported_ruleset')).toEqual([]);
    const { toSave } = planPackageImport(roundTripped, [], new Map());
    useHomebrewStore.setState(state => ({ races: [...state.races, toSave[0].item as never] } as never));
    const resolved = useHomebrewStore.getState().getMergedContentDB().races.find(r => r.id === 'rt_ruleset_race');
    expect(resolved?.rulesetId).toBe(rulesetId);
  });

  it('a non-D&D fixture ruleset (registered "ose") round-trips with its exact rulesetId, not silently retagged or dropped', () => {
    resetStore();
    const race = raceWithRuleset('rt_ose_race', 'ose');
    const pack = buildSinglePackage('race', race);
    const roundTripped = JSON.parse(JSON.stringify(pack));
    const validation = validatePackageForImport(roundTripped, new Set(['dnd5e-2014', 'dnd5e-2024', 'ose']), () => undefined);
    expect(validation.blocking).toEqual([]);
    expect(validation.issues.filter(i => i.code === 'package_unsupported_ruleset')).toEqual([]);
    const { toSave } = planPackageImport(roundTripped, [], new Map());
    expect((toSave[0].item as unknown as { rulesetId: string }).rulesetId).toBe('ose');
    useHomebrewStore.setState(state => ({ races: [...state.races, toSave[0].item as never] } as never));
    const resolved = useHomebrewStore.getState().getMergedContentDB().races.find(r => r.id === 'rt_ose_race');
    expect(resolved?.rulesetId).toBe('ose');
  });

  it('an unsupported/unrecognized ruleset is preserved, not discarded or retagged, and surfaces a non-blocking warning', () => {
    resetStore();
    const race = raceWithRuleset('rt_scifi_race', 'some-future-scifi-ttrpg');
    const pack = buildSinglePackage('race', race);
    const roundTripped = JSON.parse(JSON.stringify(pack));
    // This device only knows about the 5e rulesets — 'some-future-scifi-ttrpg' is unrecognized.
    const validation = validatePackageForImport(roundTripped, new Set(['dnd5e-2014', 'dnd5e-2024']), () => undefined);
    expect(validation.blocking).toEqual([]); // structurally valid — allowed to import despite the unsupported ruleset
    const warning = validation.issues.find(i => i.code === 'package_unsupported_ruleset');
    expect(warning).toBeDefined();
    expect(warning!.severity).toBe('warning');

    const { toSave } = planPackageImport(roundTripped, [], new Map());
    // Not discarded, not retagged to a supported ruleset — exact string preserved.
    expect((toSave[0].item as unknown as { rulesetId: string }).rulesetId).toBe('some-future-scifi-ttrpg');
    useHomebrewStore.setState(state => ({ races: [...state.races, toSave[0].item as never] } as never));
    const resolved = useHomebrewStore.getState().getMergedContentDB().races.find(r => r.id === 'rt_scifi_race');
    expect(resolved).toBeDefined();
    expect(resolved?.rulesetId).toBe('some-future-scifi-ttrpg');
  });

  it('a package spanning multiple rulesets lists them all in compatibleRulesets[] and preserves each definition\'s OWN rulesetId individually after import (not homogenized to one)', () => {
    resetStore();
    const race2014 = raceWithRuleset('rt_mr_2014', 'dnd5e-2014');
    const race2024 = raceWithRuleset('rt_mr_2024', 'dnd5e-2024');
    const raceOse = raceWithRuleset('rt_mr_ose', 'ose');

    const homebrewPayload: GrimoirePackHomebrew = { races: [race2014, race2024, raceOse] as never };
    const contents: PackageContentRef[] = [
      { type: 'race', id: 'rt_mr_2014', name: 'rt_mr_2014', rulesetId: 'dnd5e-2014' as never, included: 'selected' },
      { type: 'race', id: 'rt_mr_2024', name: 'rt_mr_2024', rulesetId: 'dnd5e-2024' as never, included: 'selected' },
      { type: 'race', id: 'rt_mr_ose', name: 'rt_mr_ose', rulesetId: 'ose' as never, included: 'selected' },
    ];
    const pack = createPackageContentPack(homebrewPayload, contents, { name: 'Multi-Ruleset Pack' }, null, '1.0.0');
    expect(pack.compatibleRulesets?.slice().sort()).toEqual(['dnd5e-2014', 'dnd5e-2024', 'ose']);

    const roundTripped = JSON.parse(JSON.stringify(pack));
    const validation = validatePackageForImport(roundTripped, new Set(['dnd5e-2014', 'dnd5e-2024', 'ose']), () => undefined);
    expect(validation.blocking).toEqual([]);
    expect(validation.issues.filter(i => i.code === 'package_unsupported_ruleset')).toEqual([]);

    const { toSave } = planPackageImport(roundTripped, [], new Map());
    expect(toSave).toHaveLength(3);
    useHomebrewStore.setState(state => ({ races: [...state.races, ...toSave.map(e => e.item)] } as never));
    const merged = useHomebrewStore.getState().getMergedContentDB();
    expect(merged.races.find(r => r.id === 'rt_mr_2014')?.rulesetId).toBe('dnd5e-2014');
    expect(merged.races.find(r => r.id === 'rt_mr_2024')?.rulesetId).toBe('dnd5e-2024');
    expect(merged.races.find(r => r.id === 'rt_mr_ose')?.rulesetId).toBe('ose');
  });
});

// HOMEBREW-PACKAGE-1 item 10: full import-plan + COMMIT behavior (apply
// toSave to the real store, then verify through getMergedContentDB()) —
// packageConflicts.test.ts already proves planPackageImport's OWN output is
// correct in isolation; these prove that output, once actually committed,
// produces the right observable state for Keep Local / Replace / Copy,
// including reference rewriting through a Class→Feature→Spell chain and a
// Feat→Spell chain (item 10's own named examples), not just Race/Subrace.
describe('conflict resolution end-to-end: plan + commit (item 10)', () => {
  it('Keep Local: the local definition is untouched, and a newly-imported dependent resolves to the KEPT LOCAL definition', () => {
    resetStore();
    useHomebrewStore.setState(state => ({
      races: [...state.races, { id: 'tideborn', name: 'Tideborn (LOCAL, edited)', features: [] } as never],
    }));
    const incomingRace = { id: 'tideborn', name: 'Tideborn (incoming)', features: [] } as unknown as HomebrewContent;
    const incomingSubrace = { id: 'reefborn', name: 'Reefborn', parentId: 'tideborn', features: [] } as unknown as HomebrewContent;
    const pack = createPackageContentPack(
      { races: [incomingRace], subraces: [incomingSubrace] } as never,
      [
        { type: 'race', id: 'tideborn', name: 'Tideborn (incoming)', included: 'selected' },
        { type: 'subrace', id: 'reefborn', name: 'Reefborn', included: 'dependency' },
      ],
      { name: 'Keep Local test pack' }, null, '1.0.0',
    );
    const conflicts = [{ type: 'race' as const, id: 'tideborn', localName: 'Tideborn (LOCAL, edited)', incomingName: 'Tideborn (incoming)' }];
    const resolutions = new Map([['race:tideborn', 'keep_local' as const]]);
    const { toSave } = planPackageImport(pack, conflicts, resolutions);
    expect(toSave.find(e => e.type === 'race')).toBeUndefined(); // dropped, per Keep Local
    expect(toSave).toHaveLength(1); // only the subrace commits

    useHomebrewStore.setState(state => ({ subraces: [...state.subraces, ...toSave.map(e => e.item)] } as never));
    const merged = useHomebrewStore.getState().getMergedContentDB();
    const race = merged.races.find(r => r.id === 'tideborn');
    expect(race?.name).toBe('Tideborn (LOCAL, edited)'); // untouched
    const attachedSubrace = (race as unknown as { subraces?: HomebrewContent[] })?.subraces?.find(s => s.id === 'reefborn');
    expect(attachedSubrace).toBeDefined(); // imported dependent resolves against the kept-local race
  });

  it('Replace: the local definition is overwritten at the SAME id, and an existing "character" reference (by id) still resolves', () => {
    resetStore();
    useHomebrewStore.setState(state => ({
      races: [...state.races, { id: 'tideborn', name: 'Tideborn (LOCAL, stale)', features: [] } as never],
    }));
    const characterRaceId = 'tideborn'; // stands in for entity.identity.raceId — resolution is purely id-based
    const incomingRace = { id: 'tideborn', name: 'Tideborn (updated)', features: [] } as unknown as HomebrewContent;
    const pack = buildSinglePackage('race', incomingRace);
    const conflicts = [{ type: 'race' as const, id: 'tideborn', localName: 'Tideborn (LOCAL, stale)', incomingName: 'Tideborn (updated)' }];
    const resolutions = new Map([['race:tideborn', 'replace' as const]]);
    const { toSave } = planPackageImport(pack, conflicts, resolutions);
    expect(toSave[0].finalId).toBe('tideborn'); // id unchanged, per Replace semantics

    useHomebrewStore.setState(state => ({
      races: [...state.races.filter(r => r.id !== toSave[0].finalId), toSave[0].item as never],
    }));
    const merged = useHomebrewStore.getState().getMergedContentDB();
    const resolved = merged.races.find(r => r.id === characterRaceId);
    expect(resolved).toBeDefined(); // the character's existing raceId reference still resolves
    expect(resolved?.name).toBe('Tideborn (updated)'); // to the REPLACED content
  });

  it('Copy: a Class→Feature→Spell chain — the conflicting Spell is copied under a new id, and the Class\'s rawProgression Feature grant is rewritten to reference it', () => {
    resetStore();
    useHomebrewStore.setState(state => ({
      spells: [...state.spells, { id: 'fireball', name: 'Fireball (LOCAL)', level: 3, school: 'Evocation', castingTime: '1 action', range: '150 feet', duration: 'Instantaneous', description: 'Local version.' } as never],
    }));
    const grantedFeature = { id: 'storm_bond', name: 'Storm Bond', description: '', source: { kind: 'class', refId: 'stormcaller' }, level: null, effects: [{ type: 'grant_spell', target: 'na', operation: 'set', value: null, condition: null, spellIds: ['fireball'] }], actions: [], choices: [], passive: true };
    const incomingSpell = { id: 'fireball', name: 'Fireball (incoming)', level: 3, school: 'Evocation', castingTime: '1 action', range: '150 feet', duration: 'Instantaneous', description: 'Incoming version.' } as unknown as HomebrewContent;
    const cls = {
      id: 'stormcaller', name: 'Stormcaller', hitDie: 8, features: [],
      rawProgression: { classId: 'stormcaller', entries: [{ level: 1, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: grantedFeature }] }] },
    } as unknown as HomebrewContent;
    const pack = createPackageContentPack(
      { classes: [cls], spells: [incomingSpell] } as never,
      [
        { type: 'class', id: 'stormcaller', name: 'Stormcaller', included: 'selected' },
        { type: 'spell', id: 'fireball', name: 'Fireball (incoming)', included: 'dependency' },
      ],
      { name: 'Stormcaller pack' }, null, '1.0.0',
    );
    const conflicts = [{ type: 'spell' as const, id: 'fireball', localName: 'Fireball (LOCAL)', incomingName: 'Fireball (incoming)' }];
    const resolutions = new Map([['spell:fireball', 'copy' as const]]);
    const { toSave } = planPackageImport(pack, conflicts, resolutions);

    const savedSpell = toSave.find(e => e.type === 'spell')!;
    expect(savedSpell.finalId).not.toBe('fireball');
    const savedClass = toSave.find(e => e.type === 'class')! as unknown as { item: ClassWithRawProgression };
    expect(savedClass.item.rawProgression.entries[0].grants[0].value.id).toBe('storm_bond'); // the FEATURE's own id is untouched
    expect((savedClass.item.rawProgression.entries[0].grants[0].value as unknown as { effects: { spellIds: string[] }[] }).effects[0].spellIds[0]).toBe(savedSpell.finalId); // its SPELL reference is rewritten

    useHomebrewStore.setState(state => ({
      spells: [...state.spells, savedSpell.item as never],
      classes: [...state.classes, savedClass.item as never],
    }));
    const merged = useHomebrewStore.getState().getMergedContentDB();
    expect(merged.spells.find(s => s.id === 'fireball')?.name).toBe('Fireball (LOCAL)'); // original untouched
    expect(merged.spells.find(s => s.id === savedSpell.finalId)?.name).toBe('Fireball (incoming)'); // copy present under new id
  });

  it('Copy: a Feat→Spell chain — the conflicting Spell is copied, and the Feat\'s embedded Feature grant is rewritten to reference it', () => {
    resetStore();
    useHomebrewStore.setState(state => ({
      spells: [...state.spells, { id: 'shocking_grasp', name: 'Shocking Grasp (LOCAL)', level: 0, school: 'Evocation', castingTime: '1 action', range: 'Touch', duration: 'Instantaneous', description: 'Local.' } as never],
    }));
    const feat = {
      id: 'storm_touched', name: 'Storm-Touched', prerequisite: null, description: 'A round-trip test feat.',
      feature: { id: 'storm_touched_f', name: 'Storm-Touched', description: '', source: { kind: 'feat', refId: 'storm_touched' }, level: null, effects: [{ type: 'grant_spell', target: 'na', operation: 'set', value: null, condition: null, cantripIds: ['shocking_grasp'] }], actions: [], choices: [], passive: true },
    } as unknown as HomebrewContent;
    const incomingSpell = { id: 'shocking_grasp', name: 'Shocking Grasp (incoming)', level: 0, school: 'Evocation', castingTime: '1 action', range: 'Touch', duration: 'Instantaneous', description: 'Incoming.' } as unknown as HomebrewContent;
    const pack = createPackageContentPack(
      { feats: [feat], spells: [incomingSpell] } as never,
      [
        { type: 'feat', id: 'storm_touched', name: 'Storm-Touched', included: 'selected' },
        { type: 'spell', id: 'shocking_grasp', name: 'Shocking Grasp (incoming)', included: 'dependency' },
      ],
      { name: 'Storm-Touched pack' }, null, '1.0.0',
    );
    const conflicts = [{ type: 'spell' as const, id: 'shocking_grasp', localName: 'Shocking Grasp (LOCAL)', incomingName: 'Shocking Grasp (incoming)' }];
    const resolutions = new Map([['spell:shocking_grasp', 'copy' as const]]);
    const { toSave } = planPackageImport(pack, conflicts, resolutions);

    const savedSpell = toSave.find(e => e.type === 'spell')!;
    const savedFeat = toSave.find(e => e.type === 'feat')! as unknown as { item: { feature: { effects: { cantripIds: string[] }[] } } };
    expect(savedFeat.item.feature.effects[0].cantripIds[0]).toBe(savedSpell.finalId);

    useHomebrewStore.setState(state => ({
      spells: [...state.spells, savedSpell.item as never],
      feats: [...state.feats, savedFeat.item as never],
    }));
    const merged = useHomebrewStore.getState().getMergedContentDB();
    expect(merged.spells.find(s => s.id === 'shocking_grasp')?.name).toBe('Shocking Grasp (LOCAL)');
    expect(merged.spells.find(s => s.id === savedSpell.finalId)?.name).toBe('Shocking Grasp (incoming)');
    expect(merged.feats?.find(f => f.id === 'storm_touched')).toBeDefined();
  });
});

// HOMEBREW-PACKAGE-1 item 11: "Apply to all" bulk conflict resolution, then
// a per-entry override still taking effect afterward. The import screen's
// applyToAll(resolution) rebuilds the resolutions Map with every conflict
// key set to the same value (app/homebrew/import-package.tsx); a later
// setResolution(conflict, r) call sets just that one key. This test builds
// a Map the SAME way (bulk-then-one-override) and feeds it to the REAL
// consumer, planPackageImport, proving the plan actually reflects the
// override rather than testing Map.set() in isolation.
describe('apply-to-all conflict resolution, then a per-entry override (item 11)', () => {
  it('3 conflicts set to Keep Local via "apply to all", then ONE overridden to Copy — the plan reflects exactly that mix', () => {
    const races = [
      { id: 'race_a', name: 'Race A (incoming)', features: [] },
      { id: 'race_b', name: 'Race B (incoming)', features: [] },
      { id: 'race_c', name: 'Race C (incoming)', features: [] },
    ] as unknown as HomebrewContent[];
    const pack = createPackageContentPack(
      { races } as never,
      races.map(r => ({ type: 'race' as const, id: r.id, name: r.name, included: 'selected' as const })),
      { name: 'Bulk conflict pack' }, null, '1.0.0',
    );
    const conflicts = races.map(r => ({ type: 'race' as const, id: r.id, localName: `${r.name} (local)`, incomingName: r.name }));

    // "Apply Keep Local to all"
    let resolutions: Map<string, ConflictResolution> = new Map(conflicts.map(c => [`${c.type}:${c.id}`, 'keep_local' as ConflictResolution]));
    // Then override just race_b to Copy.
    resolutions = new Map(resolutions).set('race:race_b', 'copy');

    const { toSave, skipped } = planPackageImport(pack, conflicts, resolutions);
    expect(skipped.filter(e => e.resolution === 'keep_local').map(e => e.originalId).sort()).toEqual(['race_a', 'race_c']);
    const copied = toSave.find(e => e.originalId === 'race_b')!;
    expect(copied.resolution).toBe('copy');
    expect(copied.finalId).not.toBe('race_b');
    expect(toSave).toHaveLength(1); // only race_b actually gets saved — a and c were kept local
  });

  it('"Apply Replace to all" then override one back to Keep Local', () => {
    const races = [
      { id: 'race_a', name: 'Race A (incoming)', features: [] },
      { id: 'race_b', name: 'Race B (incoming)', features: [] },
    ] as unknown as HomebrewContent[];
    const pack = createPackageContentPack(
      { races } as never,
      races.map(r => ({ type: 'race' as const, id: r.id, name: r.name, included: 'selected' as const })),
      { name: 'Bulk conflict pack 2' }, null, '1.0.0',
    );
    const conflicts = races.map(r => ({ type: 'race' as const, id: r.id, localName: `${r.name} (local)`, incomingName: r.name }));

    let resolutions: Map<string, ConflictResolution> = new Map(conflicts.map(c => [`${c.type}:${c.id}`, 'replace' as ConflictResolution]));
    resolutions = new Map(resolutions).set('race:race_a', 'keep_local');

    const { toSave, skipped } = planPackageImport(pack, conflicts, resolutions);
    expect(skipped.map(e => e.originalId)).toEqual(['race_a']);
    expect(toSave.map(e => e.originalId)).toEqual(['race_b']);
    expect(toSave[0].resolution).toBe('replace');
    expect(toSave[0].finalId).toBe('race_b');
  });
});

// HOMEBREW-PACKAGE-1 item 21: Device A -> export A -> clean store B ->
// import A -> export B -> clean store C -> import B. Semantic content
// (rules/effects/features/stable IDs/parent refs/ruleset IDs) must remain
// equivalent across every hop; only metadata that's EXPECTED to change
// (packageId/createdAt/importedAt-shaped fields) is allowed to differ.
describe('round-trip semantic equivalence: A -> B -> C (item 21)', () => {
  it('a Race + dependent Subrace stay semantically identical after two full export/import hops', () => {
    // Device A
    const raceA = { id: 'tideborn', name: 'Tideborn', features: [], rulesetId: 'dnd5e-2014' } as unknown as HomebrewContent;
    const subraceA = { id: 'reefborn', name: 'Reefborn', parentId: 'tideborn', features: [] } as unknown as HomebrewContent;
    const homebrewA = { races: [raceA], subraces: [subraceA] } as unknown as GrimoirePackHomebrew;
    const contentsA: PackageContentRef[] = [
      { type: 'race', id: 'tideborn', name: 'Tideborn', included: 'selected' },
      { type: 'subrace', id: 'reefborn', name: 'Reefborn', included: 'dependency' },
    ];
    const packA = createPackageContentPack(homebrewA, contentsA, { name: 'Tideborn Collection', packageVersion: '1.0' }, 'device-a', '1.0.0');
    const roundTrippedA = JSON.parse(JSON.stringify(packA));

    // Clean store B: import A
    resetStore();
    const { toSave: toSaveB } = planPackageImport(roundTrippedA, [], new Map());
    useHomebrewStore.setState(state => ({
      races: [...state.races, ...toSaveB.filter(e => e.type === 'race').map(e => e.item)],
      subraces: [...state.subraces, ...toSaveB.filter(e => e.type === 'subrace').map(e => e.item)],
    } as never));

    // Export B (re-export what device B now has)
    const raceB = useHomebrewStore.getState().races.find(r => r.id === 'tideborn')!;
    const subraceB = useHomebrewStore.getState().subraces.find(s => s.id === 'reefborn')!;
    const packB = createPackageContentPack(
      { races: [raceB as never], subraces: [subraceB as never] }, contentsA,
      { name: 'Tideborn Collection', packageVersion: '1.0' }, 'device-b', '1.0.0',
    );
    const roundTrippedB = JSON.parse(JSON.stringify(packB));

    // Clean store C: import B
    resetStore();
    const { toSave: toSaveC } = planPackageImport(roundTrippedB, [], new Map());
    useHomebrewStore.setState(state => ({
      races: [...state.races, ...toSaveC.filter(e => e.type === 'race').map(e => e.item)],
      subraces: [...state.subraces, ...toSaveC.filter(e => e.type === 'subrace').map(e => e.item)],
    } as never));
    const raceC = useHomebrewStore.getState().races.find(r => r.id === 'tideborn')!;
    const subraceC = useHomebrewStore.getState().subraces.find(s => s.id === 'reefborn')!;

    // Semantic equivalence across all three hops — same content, not just same id.
    for (const race of [raceA, raceB, raceC]) {
      expect(race.id).toBe('tideborn');
      expect(race.name).toBe('Tideborn');
      expect((race as unknown as { rulesetId: string }).rulesetId).toBe('dnd5e-2014'); // ruleset id never drifts
    }
    for (const subrace of [subraceA, subraceB, subraceC]) {
      expect(subrace.id).toBe('reefborn');
      expect((subrace as unknown as { parentId: string }).parentId).toBe('tideborn'); // parent reference never drifts
    }
    // Package-level metadata IS allowed to differ (packageId/createdAt) —
    // confirm it actually does (different packageId per export), which is
    // the expected difference the spec explicitly carves out, not a bug.
    expect(packA.packageId).not.toBe(packB.packageId);
  });
});

// HOMEBREW-PACKAGE-1 item 22: import a package with a conflict resolved as
// Import As Copy -> export the COPIED content (now local, independent
// content under its new id) -> import it again elsewhere -> it behaves as
// a fully independent definition with correctly rewritten internal
// references, not tied back to the original package or original id at all.
describe('export/import of a previously-copied conflict (item 22)', () => {
  it('a Race resolved as Copy, then re-exported and imported elsewhere, keeps its NEW id and stays independently correct', () => {
    // Step 1: device B already has a local "tideborn" race; imports a
    // package with a conflicting "tideborn" + a dependent subrace, resolves Copy.
    resetStore();
    useHomebrewStore.setState(state => ({ races: [...state.races, { id: 'tideborn', name: 'Tideborn (LOCAL)', features: [] } as never] }));
    const incomingRace = { id: 'tideborn', name: 'Tideborn (incoming)', features: [] } as unknown as HomebrewContent;
    const incomingSubrace = { id: 'reefborn', name: 'Reefborn', parentId: 'tideborn', features: [] } as unknown as HomebrewContent;
    const pack1 = createPackageContentPack(
      { races: [incomingRace], subraces: [incomingSubrace] } as never,
      [
        { type: 'race', id: 'tideborn', name: 'Tideborn (incoming)', included: 'selected' },
        { type: 'subrace', id: 'reefborn', name: 'Reefborn', included: 'dependency' },
      ],
      { name: 'Tideborn Collection' }, null, '1.0.0',
    );
    const conflicts1 = [{ type: 'race' as const, id: 'tideborn', localName: 'Tideborn (LOCAL)', incomingName: 'Tideborn (incoming)' }];
    const { toSave: toSave1 } = planPackageImport(pack1, conflicts1, new Map([['race:tideborn', 'copy' as const]]));
    useHomebrewStore.setState(state => ({
      races: [...state.races, ...toSave1.filter(e => e.type === 'race').map(e => e.item)],
      subraces: [...state.subraces, ...toSave1.filter(e => e.type === 'subrace').map(e => e.item)],
    } as never));

    const copiedRaceId = toSave1.find(e => e.type === 'race')!.finalId;
    expect(copiedRaceId).not.toBe('tideborn');
    // The imported subrace's parentId was rewritten to the COPY's new id, not the stale original.
    const importedSubrace = useHomebrewStore.getState().subraces.find(s => s.id === 'reefborn')!;
    expect((importedSubrace as unknown as { parentId: string }).parentId).toBe(copiedRaceId);

    // Step 2: device B now exports the copy (a fresh, independent piece of
    // content — no back-reference to the original package or original id).
    const copiedRace = useHomebrewStore.getState().races.find(r => r.id === copiedRaceId)!;
    const pack2 = createPackageContentPack(
      { races: [copiedRace as never], subraces: [importedSubrace as never] },
      [
        { type: 'race', id: copiedRaceId, name: copiedRace.name, included: 'selected' },
        { type: 'subrace', id: 'reefborn', name: 'Reefborn', included: 'dependency' },
      ],
      { name: 'Re-exported Copy' }, null, '1.0.0',
    );
    const roundTripped2 = JSON.parse(JSON.stringify(pack2));

    // Step 3: import into a CLEAN device C — no conflicts (the copy's id is
    // fresh and doesn't collide with anything, proving it's truly independent).
    resetStore();
    const validation = validatePackageForImport(roundTripped2, new Set(), () => undefined);
    expect(validation.blocking).toEqual([]);
    const conflicts2 = detectConflicts(roundTripped2.homebrew, () => undefined);
    expect(conflicts2).toEqual([]);
    const { toSave: toSave2 } = planPackageImport(roundTripped2, conflicts2, new Map());
    useHomebrewStore.setState(state => ({
      races: [...state.races, ...toSave2.filter(e => e.type === 'race').map(e => e.item)],
      subraces: [...state.subraces, ...toSave2.filter(e => e.type === 'subrace').map(e => e.item)],
    } as never));

    const merged = useHomebrewStore.getState().getMergedContentDB();
    const finalRace = merged.races.find(r => r.id === copiedRaceId);
    expect(finalRace).toBeDefined();
    expect(finalRace!.name).toBe('Tideborn (incoming)');
    const attachedSubrace = (finalRace as unknown as { subraces?: HomebrewContent[] })?.subraces?.find(s => s.id === 'reefborn');
    expect(attachedSubrace).toBeDefined(); // the subrace still correctly resolves to the COPY's id on device C too
  });
});
