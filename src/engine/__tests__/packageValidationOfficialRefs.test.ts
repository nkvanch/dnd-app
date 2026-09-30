// A package dependency is satisfied by (1) the package itself, (2) homebrew already installed, or
// (3) official content bundled in this build. Regression for the creator stress test: a subclass
// pack for the built-in Bard/Fighter used to warn "references a class ("bard") that … doesn't already
// exist on this device".
import { validatePackageForImport } from '../packageValidation';
import { createPackageContentPack } from '../backup';
import { buildBreadthPack, buildUnderstudyPack } from '../../../demo/sample-packs/samplePacks';
import type { DependencyRef } from '../contentDependencies';

const KNOWN = new Set(['dnd5e-2014', 'dnd5e-2024']);
const NO_LOCAL = () => undefined;
const missing = (r: ReturnType<typeof validatePackageForImport>) => r.issues.filter(i => i.code === 'package_missing_dependency');

function subclassPack(classId: string, extra: { classes?: unknown[] } = {}) {
  const sub = { id: 'test_sub', name: 'Test Sub', classId, entries: [] } as any;
  return createPackageContentPack(
    { subclasses: [sub], ...(extra.classes ? { classes: extra.classes as any } : {}) },
    [
      { type: 'subclass', id: 'test_sub', name: 'Test Sub', included: 'selected' },
      ...(extra.classes ? [{ type: 'class' as const, id: (extra.classes[0] as any).id, name: 'In-Pack Class', included: 'dependency' as const }] : []),
    ],
    { name: 'Subclass Pack' }, null, '1.0.0',
  );
}

/** Loads officialRefs with the build mode set the way the app fixes it at module load. */
function loadIsOfficialRef(srdOnly: boolean): (r: DependencyRef) => boolean {
  const previous = process.env.EXPO_PUBLIC_SRD_ONLY;
  process.env.EXPO_PUBLIC_SRD_ONLY = srdOnly ? 'true' : 'false';
  let fn!: (r: DependencyRef) => boolean;
  try {
    jest.isolateModules(() => {
      jest.doMock('../../content/spellRepo', () => jest.requireActual('../../content/spellRepo.ts'));
      jest.doMock('../../content/itemRepo', () => jest.requireActual('../../content/itemRepo.ts'));
      fn = require('../../content/officialRefs').isOfficialRef;
    });
  } finally {
    if (previous === undefined) delete process.env.EXPO_PUBLIC_SRD_ONLY; else process.env.EXPO_PUBLIC_SRD_ONLY = previous;
  }
  return fn;
}

describe('subclass packs against bundled official classes (SRD-only build, as creators get it)', () => {
  const official = loadIsOfficialRef(true);

  it('subclass -> official Bard: no missing-class warning', () => {
    expect(missing(validatePackageForImport(subclassPack('bard'), KNOWN, NO_LOCAL, official))).toEqual([]);
  });

  it('subclass -> official Fighter: no missing-class warning', () => {
    expect(missing(validatePackageForImport(subclassPack('fighter'), KNOWN, NO_LOCAL, official))).toEqual([]);
  });

  it('the real Understudy pack (Bard) validates clean', () => {
    const r = validatePackageForImport(JSON.parse(JSON.stringify(buildUnderstudyPack())), KNOWN, NO_LOCAL, official);
    expect(r.blocking).toEqual([]);
    expect(missing(r)).toEqual([]);
  });

  it('the real Breadth pack (Fighter) validates clean', () => {
    const r = validatePackageForImport(JSON.parse(JSON.stringify(buildBreadthPack())), KNOWN, NO_LOCAL, official);
    expect(r.blocking).toEqual([]);
    expect(missing(r)).toEqual([]);
  });

  it('still warns for a class that exists nowhere (the check is not suppressed)', () => {
    const w = missing(validatePackageForImport(subclassPack('totally_made_up_class'), KNOWN, NO_LOCAL, official));
    expect(w).toHaveLength(1);
    expect(w[0].affectedId).toBe('totally_made_up_class');
  });

  it('an official id of a DIFFERENT type does not satisfy a class reference', () => {
    // "human" is an official race, not a class
    expect(missing(validatePackageForImport(subclassPack('human'), KNOWN, NO_LOCAL, official))).toHaveLength(1);
  });

  it('content not exposed in this build is not treated as available (consistent with runtime)', () => {
    // Artificer is bundled in source but hidden in the SRD-only build, so a pack targeting it can't work there.
    expect(missing(validatePackageForImport(subclassPack('artificer'), KNOWN, NO_LOCAL, official))).toHaveLength(1);
  });
});

describe('the other two ways a dependency is satisfied', () => {
  it('subclass -> installed homebrew class: no warning (even with no official content known)', () => {
    const local = (ref: DependencyRef) => (ref.type === 'class' && ref.id === 'stormcaller' ? ({ id: 'stormcaller', name: 'Stormcaller' } as any) : undefined);
    expect(missing(validatePackageForImport(subclassPack('stormcaller'), KNOWN, local))).toEqual([]);
  });

  it('subclass -> class bundled in the same pack: no warning', () => {
    const cls = { id: 'stormcaller', name: 'Stormcaller', hitDie: 8, features: [] };
    expect(missing(validatePackageForImport(subclassPack('stormcaller', { classes: [cls] }), KNOWN, NO_LOCAL))).toEqual([]);
  });

  it('without the official predicate the old behavior remains (official content unknown to the pure validator)', () => {
    expect(missing(validatePackageForImport(subclassPack('bard'), KNOWN, NO_LOCAL))).toHaveLength(1);
  });
});

describe('full/private build: broader official classes count as available', () => {
  it('Artificer resolves when the build exposes it', () => {
    const official = loadIsOfficialRef(false);
    expect(official({ type: 'class', id: 'artificer' })).toBe(true);
    expect(missing(validatePackageForImport(subclassPack('artificer'), KNOWN, NO_LOCAL, official))).toEqual([]);
  });
});
