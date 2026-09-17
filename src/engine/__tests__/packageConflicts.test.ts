// src/engine/__tests__/packageConflicts.test.ts
import {
  detectConflicts, detectConflictsDetailed, isContentIdentical,
  findDuplicateIdsInPackage, planPackageImport, ConflictResolution, PackageConflict,
} from '../packageConflicts';
import { createPackageContentPack } from '../backup';
import type { Subrace, HomebrewSubclass, Feature, Race } from '../../engine/types';
import type { GrimoirePackHomebrew } from '../backup';

function mkFeature(over: Partial<Feature> = {}): Feature {
  return {
    id: 'f1', name: 'F1', description: '', source: { kind: 'race', refId: 'x' },
    level: null, effects: [], actions: [], choices: [], passive: true,
    ...over,
  };
}

describe('detectConflicts', () => {
  it('finds a conflict when the package and local homebrew share a {type,id}', () => {
    const hb: GrimoirePackHomebrew = { races: [{ id: 'tideborn', name: 'Tideborn (v2)', features: [] } as Race] };
    const localLookup = (type: string, id: string) => (type === 'race' && id === 'tideborn') ? 'Tideborn (local)' : undefined;
    const conflicts = detectConflicts(hb, localLookup);
    expect(conflicts).toEqual([{ type: 'race', id: 'tideborn', localName: 'Tideborn (local)', incomingName: 'Tideborn (v2)' }]);
  });

  it('reports no conflicts when nothing overlaps', () => {
    const hb: GrimoirePackHomebrew = { races: [{ id: 'tideborn', name: 'Tideborn', features: [] } as Race] };
    expect(detectConflicts(hb, () => undefined)).toEqual([]);
  });
});

describe('isContentIdentical (item 17)', () => {
  it('returns true for byte-for-byte identical content', () => {
    const a: Race = { id: 'tideborn', name: 'Tideborn', features: [mkFeature()] } as Race;
    const b: Race = { id: 'tideborn', name: 'Tideborn', features: [mkFeature()] } as Race;
    expect(isContentIdentical(a, b)).toBe(true);
  });

  it('returns false when any field differs, e.g. name', () => {
    const a: Race = { id: 'tideborn', name: 'Tideborn', features: [] } as Race;
    const b: Race = { id: 'tideborn', name: 'Tideborn (v2)', features: [] } as Race;
    expect(isContentIdentical(a, b)).toBe(false);
  });

  it('returns false when a nested feature field differs', () => {
    const a: Race = { id: 'tideborn', name: 'Tideborn', features: [mkFeature({ description: 'old' })] } as Race;
    const b: Race = { id: 'tideborn', name: 'Tideborn', features: [mkFeature({ description: 'new' })] } as Race;
    expect(isContentIdentical(a, b)).toBe(false);
  });
});

describe('detectConflictsDetailed (item 17)', () => {
  it('partitions a same-id, byte-identical match into `identical`, not `conflicts`', () => {
    const race: Race = { id: 'tideborn', name: 'Tideborn', features: [] } as Race;
    const hb: GrimoirePackHomebrew = { races: [{ ...race }] };
    const localLookup = (type: string, id: string) => (type === 'race' && id === 'tideborn') ? race : undefined;
    const { conflicts, identical } = detectConflictsDetailed(hb, localLookup as never);
    expect(conflicts).toEqual([]);
    expect(identical).toEqual([{ type: 'race', id: 'tideborn', localName: 'Tideborn', incomingName: 'Tideborn' }]);
  });

  it('partitions a same-id, differing match into `conflicts`, not `identical`', () => {
    const local: Race = { id: 'tideborn', name: 'Tideborn (local)', features: [] } as Race;
    const incoming: Race = { id: 'tideborn', name: 'Tideborn (v2)', features: [] } as Race;
    const hb: GrimoirePackHomebrew = { races: [incoming] };
    const localLookup = (type: string, id: string) => (type === 'race' && id === 'tideborn') ? local : undefined;
    const { conflicts, identical } = detectConflictsDetailed(hb, localLookup as never);
    expect(identical).toEqual([]);
    expect(conflicts).toEqual([{ type: 'race', id: 'tideborn', localName: 'Tideborn (local)', incomingName: 'Tideborn (v2)' }]);
  });

  it('reports nothing for either bucket when there is no local match at all', () => {
    const hb: GrimoirePackHomebrew = { races: [{ id: 'tideborn', name: 'Tideborn', features: [] } as Race] };
    const { conflicts, identical } = detectConflictsDetailed(hb, () => undefined);
    expect(conflicts).toEqual([]);
    expect(identical).toEqual([]);
  });
});

describe('findDuplicateIdsInPackage', () => {
  it('flags two definitions of the same type sharing an id within one package', () => {
    const hb: GrimoirePackHomebrew = {
      races: [
        { id: 'tideborn', name: 'Tideborn A', features: [] } as Race,
        { id: 'tideborn', name: 'Tideborn B', features: [] } as Race,
      ],
    };
    const issues = findDuplicateIdsInPackage(hb);
    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe('package_duplicate_id');
    expect(issues[0].severity).toBe('error');
  });

  it('the same id across DIFFERENT types is not a duplicate', () => {
    const hb: GrimoirePackHomebrew = {
      races: [{ id: 'x', name: 'Race X', features: [] } as Race],
      items: [{ id: 'x', name: 'Item X', weight: 0, cost: '-', properties: [], features: [] } as any],
    };
    expect(findDuplicateIdsInPackage(hb)).toEqual([]);
  });
});

describe('planPackageImport — resolution semantics', () => {
  const RACE: Race = { id: 'tideborn', name: 'Tideborn', features: [] } as Race;
  const SUBRACE: Subrace = { id: 'reefborn', name: 'Reefborn', parentId: 'tideborn', features: [] };

  function makePack() {
    return createPackageContentPack(
      { races: [RACE], subraces: [SUBRACE] },
      [
        { type: 'race', id: 'tideborn', name: 'Tideborn', included: 'selected' },
        { type: 'subrace', id: 'reefborn', name: 'Reefborn', included: 'selected' },
      ],
      { name: 'Tideborn Collection' },
      null, '1.0.0',
    );
  }

  it('keep_local: the conflicting item is dropped from the save plan entirely', () => {
    const pack = makePack();
    const conflicts = [{ type: 'race' as const, id: 'tideborn', localName: 'Local Tideborn', incomingName: 'Tideborn' }];
    const resolutions = new Map<string, ConflictResolution>([['race:tideborn', 'keep_local']]);
    const { toSave, skipped } = planPackageImport(pack, conflicts, resolutions);
    expect(toSave.find(e => e.type === 'race')).toBeUndefined();
    expect(skipped.find(e => e.type === 'race')?.resolution).toBe('keep_local');
    // The subrace has no conflict of its own — still imported, and since
    // the race was kept local (same id either way), its parentId reference
    // is still valid without any rewrite.
    const savedSubrace = toSave.find(e => e.type === 'subrace')!;
    expect((savedSubrace.item as Subrace).parentId).toBe('tideborn');
  });

  it('replace: the local definition is overwritten at the SAME id, no rewrite needed', () => {
    const pack = makePack();
    const conflicts = [{ type: 'race' as const, id: 'tideborn', localName: 'Local Tideborn', incomingName: 'Tideborn' }];
    const resolutions = new Map<string, ConflictResolution>([['race:tideborn', 'replace']]);
    const { toSave } = planPackageImport(pack, conflicts, resolutions);
    const savedRace = toSave.find(e => e.type === 'race')!;
    expect(savedRace.finalId).toBe('tideborn');
    expect(savedRace.resolution).toBe('replace');
  });

  it('copy: the conflicting item gets a NEW id, and every other imported item referencing it is rewritten to the new id', () => {
    const pack = makePack();
    const conflicts = [{ type: 'race' as const, id: 'tideborn', localName: 'Local Tideborn', incomingName: 'Tideborn' }];
    const resolutions = new Map<string, ConflictResolution>([['race:tideborn', 'copy']]);
    const { toSave } = planPackageImport(pack, conflicts, resolutions);

    const savedRace = toSave.find(e => e.type === 'race')!;
    expect(savedRace.finalId).not.toBe('tideborn');
    expect(savedRace.finalId).toMatch(/^tideborn_copy_/);
    expect((savedRace.item as Race).id).toBe(savedRace.finalId);

    // The subrace (not itself conflicting) must now point at the COPY's
    // new id, not the stale original — "Class A must reference F2, not
    // old F" from the spec, applied to Race/Subrace here.
    const savedSubrace = toSave.find(e => e.type === 'subrace')!;
    expect((savedSubrace.item as Subrace).parentId).toBe(savedRace.finalId);
  });

  it('a subclass import rewrites its classId when the parent class was resolved as copy', () => {
    const CLASS = { id: 'stormcaller', name: 'Stormcaller', hitDie: 8, features: [] } as any;
    const SUBCLASS: HomebrewSubclass = {
      id: 'thunder_path' as any, name: 'Path of Thunder', classId: 'stormcaller',
      entries: [{ level: 3, hpDie: 8, choices: [], grants: [] }],
    };
    const pack = createPackageContentPack(
      { classes: [CLASS], subclasses: [SUBCLASS] },
      [
        { type: 'class', id: 'stormcaller', name: 'Stormcaller', included: 'selected' },
        { type: 'subclass', id: 'thunder_path', name: 'Path of Thunder', included: 'selected' },
      ],
      { name: 'Stormcaller Pack' }, null, '1.0.0',
    );
    const conflicts = [{ type: 'class' as const, id: 'stormcaller', localName: 'Local Stormcaller', incomingName: 'Stormcaller' }];
    const resolutions = new Map<string, ConflictResolution>([['class:stormcaller', 'copy']]);
    const { toSave } = planPackageImport(pack, conflicts, resolutions);

    const savedClass = toSave.find(e => e.type === 'class')!;
    const savedSubclass = toSave.find(e => e.type === 'subclass')!;
    expect((savedSubclass.item as HomebrewSubclass).classId).toBe(savedClass.finalId);
  });

  it('non-conflicting items pass through unchanged', () => {
    const pack = makePack();
    const { toSave } = planPackageImport(pack, [], new Map());
    expect(toSave).toHaveLength(2);
    expect(toSave.every(e => e.resolution === 'no_conflict')).toBe(true);
    expect(toSave.find(e => e.type === 'race')!.finalId).toBe('tideborn');
  });

  it('identical (item 17): an item marked identical is always skipped, regardless of any resolution set for its key', () => {
    const pack = makePack();
    const identical: PackageConflict[] = [{ type: 'race', id: 'tideborn', localName: 'Tideborn', incomingName: 'Tideborn' }];
    // Even if a resolution happened to be present for this key (shouldn't
    // normally happen alongside `identical`, but the identical check must
    // win regardless), the item must still be skipped, never saved.
    const resolutions = new Map<string, ConflictResolution>([['race:tideborn', 'replace']]);
    const { toSave, skipped } = planPackageImport(pack, [], resolutions, identical);

    expect(toSave.find(e => e.type === 'race')).toBeUndefined();
    const skippedRace = skipped.find(e => e.type === 'race')!;
    expect(skippedRace.resolution).toBe('identical');
    expect(skippedRace.finalId).toBe('tideborn');

    // The subrace (not itself identical/conflicting) still imports normally.
    expect(toSave.find(e => e.type === 'subrace')).toBeDefined();
  });

  it('identical defaults to an empty list when omitted — no behavior change for existing 3-arg callers', () => {
    const pack = makePack();
    const { toSave, skipped } = planPackageImport(pack, [], new Map());
    expect(toSave).toHaveLength(2);
    expect(skipped).toEqual([]);
  });
});
