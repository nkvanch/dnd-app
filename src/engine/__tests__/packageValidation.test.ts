// src/engine/__tests__/packageValidation.test.ts
import { validatePackageForImport, MAX_PACKAGE_CONTENT_ENTRIES } from '../packageValidation';
import { createPackageContentPack, GRIMOIRE_PACK_FORMAT_VERSION } from '../backup';
import { asRulesetId } from '../types';
import type { Race, Subrace } from '../../engine/types';

const KNOWN_RULESETS = new Set(['dnd5e-2014', 'dnd5e-2024', 'dnd4e', 'dnd3.5e', 'adnd1e', 'adnd2e', 'pf1e', 'pf2e', 'ose']);
const NO_LOCAL = () => undefined;

describe('validatePackageForImport — envelope/structural errors (blocking)', () => {
  it('rejects a non-object payload', () => {
    const { blocking } = validatePackageForImport('not a pack', KNOWN_RULESETS, NO_LOCAL);
    expect(blocking.length).toBeGreaterThan(0);
  });

  it('rejects invalid JSON-shaped-but-malformed data (missing formatVersion)', () => {
    const { blocking } = validatePackageForImport({ packType: 'content-pack', characters: [] }, KNOWN_RULESETS, NO_LOCAL);
    expect(blocking.length).toBeGreaterThan(0);
  });

  it('rejects a newer-than-supported formatVersion', () => {
    const pack = { formatVersion: GRIMOIRE_PACK_FORMAT_VERSION + 1, packType: 'content-pack', characters: [], createdAt: 0, appVersion: '1', deviceId: null };
    const { blocking } = validatePackageForImport(pack, KNOWN_RULESETS, NO_LOCAL);
    expect(blocking.length).toBeGreaterThan(0);
  });

  it('rejects duplicate stable ids within the package', () => {
    const pack = createPackageContentPack(
      { races: [{ id: 'x', name: 'X1', features: [] } as Race, { id: 'x', name: 'X2', features: [] } as Race] },
      [{ type: 'race', id: 'x', name: 'X1', included: 'selected' }],
      { name: 'Bad Pack' }, null, '1.0.0',
    );
    const { blocking } = validatePackageForImport(pack, KNOWN_RULESETS, NO_LOCAL);
    expect(blocking.some(b => b.includes('more than one'))).toBe(true);
  });

  it('rejects a malformed content item (fails validateContent)', () => {
    const pack = createPackageContentPack(
      { races: [{ id: 'x' } as any] }, // missing name/features — structurally invalid
      [{ type: 'race', id: 'x', name: 'X', included: 'selected' }],
      { name: 'Bad Pack' }, null, '1.0.0',
    );
    const { blocking } = validatePackageForImport(pack, KNOWN_RULESETS, NO_LOCAL);
    expect(blocking.length).toBeGreaterThan(0);
  });

  // Item 36: oversized/pathological payload — a package with far more
  // content entries than any real package should have is rejected before
  // the heavier structural/dependency checks run against it.
  it('rejects a package with more content entries than MAX_PACKAGE_CONTENT_ENTRIES', () => {
    const races: Race[] = Array.from({ length: MAX_PACKAGE_CONTENT_ENTRIES + 1 }, (_, i) => ({ id: `r${i}`, name: `R${i}`, features: [] }));
    const pack = createPackageContentPack({ races }, [], { name: 'Huge Pack' }, null, '1.0.0');
    const { blocking } = validatePackageForImport(pack, KNOWN_RULESETS, NO_LOCAL);
    expect(blocking.some(b => b.includes('content entries'))).toBe(true);
  });

  it('does not reject a package right at the entry-count limit', () => {
    const races: Race[] = Array.from({ length: MAX_PACKAGE_CONTENT_ENTRIES }, (_, i) => ({ id: `r${i}`, name: `R${i}`, features: [] }));
    const pack = createPackageContentPack({ races }, [], { name: 'Big Pack' }, null, '1.0.0');
    const { blocking } = validatePackageForImport(pack, KNOWN_RULESETS, NO_LOCAL);
    expect(blocking.some(b => b.includes('content entries'))).toBe(false);
  });

  // Item 13/23: schemaVersion must actually be checked, not just set-and-ignored.
  it('rejects a newer-than-supported schemaVersion', () => {
    const pack = createPackageContentPack({}, [], { name: 'Pack' }, null, '1.0.0');
    (pack as unknown as { schemaVersion: number }).schemaVersion = 999;
    const { blocking } = validatePackageForImport(pack, KNOWN_RULESETS, NO_LOCAL);
    expect(blocking.some(b => b.includes('schema'))).toBe(true);
  });

  it('does not reject a MISSING schemaVersion (older packages / single-item createContentPack() never set it)', () => {
    const pack = createPackageContentPack({}, [], { name: 'Pack' }, null, '1.0.0');
    delete (pack as unknown as { schemaVersion?: number }).schemaVersion;
    const { blocking } = validatePackageForImport(pack, KNOWN_RULESETS, NO_LOCAL);
    expect(blocking).toEqual([]);
  });

  it('rejects an unrecognized content-category key instead of silently dropping it', () => {
    const pack = createPackageContentPack({}, [], { name: 'Pack' }, null, '1.0.0');
    (pack as unknown as { homebrew: Record<string, unknown> }).homebrew = { monster_templates_v2: [{ id: 'x', name: 'X' }] };
    const { blocking } = validatePackageForImport(pack, KNOWN_RULESETS, NO_LOCAL);
    expect(blocking.some(b => b.includes('monster_templates_v2'))).toBe(true);
  });

  it('rejects a Subrace with a missing/malformed parentId (invalid dependency reference structure)', () => {
    const pack = createPackageContentPack(
      { subraces: [{ id: 'reefborn', name: 'Reefborn', features: [] } as any] }, // no parentId at all
      [{ type: 'subrace', id: 'reefborn', name: 'Reefborn', included: 'selected' }],
      { name: 'Pack' }, null, '1.0.0',
    );
    const { blocking } = validatePackageForImport(pack, KNOWN_RULESETS, NO_LOCAL);
    expect(blocking.some(b => b.includes('parentId'))).toBe(true);
  });

  // HOMEBREW-PACKAGE-1 item 27: structured diagnostics for blocking failures too.
  it('every blocking failure is ALSO reported as a structured Issue with the right code', () => {
    const formatCase = validatePackageForImport({ formatVersion: 999, packType: 'content-pack', characters: [], createdAt: 0, appVersion: '1', deviceId: null }, KNOWN_RULESETS, NO_LOCAL);
    expect(formatCase.blockingIssues).toEqual([expect.objectContaining({ severity: 'error', code: 'package_incompatible_version' })]);

    const schemaCase = validatePackageForImport({ ...createPackageContentPack({}, [], { name: 'P' }, null, '1.0.0'), schemaVersion: 999 }, KNOWN_RULESETS, NO_LOCAL);
    expect(schemaCase.blockingIssues).toEqual([expect.objectContaining({ severity: 'error', code: 'package_incompatible_version' })]);

    const dupCase = validatePackageForImport(
      createPackageContentPack(
        { races: [{ id: 'x', name: 'X1', features: [] } as Race, { id: 'x', name: 'X2', features: [] } as Race] },
        [{ type: 'race', id: 'x', name: 'X1', included: 'selected' }], { name: 'Bad' }, null, '1.0.0',
      ), KNOWN_RULESETS, NO_LOCAL,
    );
    expect(dupCase.blockingIssues).toEqual([expect.objectContaining({ severity: 'error', code: 'package_duplicate_id' })]);

    const malformedCase = validatePackageForImport(
      createPackageContentPack({ races: [{ id: 'x' } as any] }, [{ type: 'race', id: 'x', name: 'X', included: 'selected' }], { name: 'Bad' }, null, '1.0.0'),
      KNOWN_RULESETS, NO_LOCAL,
    );
    expect(malformedCase.blockingIssues.some(i => i.code === 'package_corrupt')).toBe(true);
  });

  it('a fully valid package has zero blockingIssues', () => {
    const pack = createPackageContentPack(
      { races: [{ id: 'tideborn', name: 'Tideborn', features: [] } as Race] },
      [{ type: 'race', id: 'tideborn', name: 'Tideborn', included: 'selected' }],
      { name: 'Pack' }, null, '1.0.0',
    );
    const { blockingIssues } = validatePackageForImport(pack, KNOWN_RULESETS, NO_LOCAL);
    expect(blockingIssues).toEqual([]);
  });

  it('rejects a HomebrewSubclass with a non-string classId', () => {
    const pack = createPackageContentPack(
      { subclasses: [{ id: 'thief2', name: 'Thief II', classId: 123, entries: [] } as any] },
      [{ type: 'subclass', id: 'thief2', name: 'Thief II', included: 'selected' }],
      { name: 'Pack' }, null, '1.0.0',
    );
    const { blocking } = validatePackageForImport(pack, KNOWN_RULESETS, NO_LOCAL);
    expect(blocking.some(b => b.includes('classId'))).toBe(true);
  });
});

describe('validatePackageForImport — unsupported ruleset (non-blocking, preserved)', () => {
  it('a recognized non-D&D ruleset (ose) produces no warning', () => {
    const race: Race = { id: 'delver', name: 'Delver', features: [], rulesetId: asRulesetId('ose') } as Race;
    const pack = createPackageContentPack(
      { races: [race] },
      [{ type: 'race', id: 'delver', name: 'Delver', rulesetId: asRulesetId('ose'), included: 'selected' }],
      { name: 'OSE Pack' }, null, '1.0.0',
    );
    const { blocking, issues } = validatePackageForImport(pack, KNOWN_RULESETS, NO_LOCAL);
    expect(blocking).toEqual([]);
    expect(issues.some(i => i.code === 'package_unsupported_ruleset')).toBe(false);
    expect(pack.compatibleRulesets).toEqual(['ose']);
  });

  it('a completely unknown/fabricated ruleset id is preserved, not discarded, but flagged', () => {
    const race: Race = { id: 'starforged', name: 'Starforged', features: [], rulesetId: asRulesetId('some-future-scifi-ttrpg') } as Race;
    const pack = createPackageContentPack(
      { races: [race] },
      [{ type: 'race', id: 'starforged', name: 'Starforged', rulesetId: asRulesetId('some-future-scifi-ttrpg'), included: 'selected' }],
      { name: 'Scifi Pack' }, null, '1.0.0',
    );
    const { blocking, issues } = validatePackageForImport(pack, KNOWN_RULESETS, NO_LOCAL);
    expect(blocking).toEqual([]); // never blocks — data is preserved
    const warning = issues.find(i => i.code === 'package_unsupported_ruleset');
    expect(warning).toBeDefined();
    expect(warning!.severity).toBe('warning');
    // The actual content is untouched — still carries its real rulesetId,
    // never silently retagged to anything else.
    expect(pack.homebrew!.races![0].rulesetId).toBe('some-future-scifi-ttrpg');
  });
});

describe('validatePackageForImport — missing dependency (non-blocking warning)', () => {
  it('flags a Subrace whose parent Race is neither in the package nor available locally', () => {
    const sr: Subrace = { id: 'reefborn', name: 'Reefborn', parentId: 'tideborn', features: [] };
    const pack = createPackageContentPack(
      { subraces: [sr] },
      [{ type: 'subrace', id: 'reefborn', name: 'Reefborn', included: 'selected' }],
      { name: 'Incomplete Pack' }, null, '1.0.0',
    );
    const { blocking, issues } = validatePackageForImport(pack, KNOWN_RULESETS, NO_LOCAL);
    expect(blocking).toEqual([]); // warns, doesn't block
    const warning = issues.find(i => i.code === 'package_missing_dependency');
    expect(warning).toBeDefined();
    expect(warning!.affectedId).toBe('tideborn');
  });

  it('does not flag a dependency that already exists locally', () => {
    const sr: Subrace = { id: 'reefborn', name: 'Reefborn', parentId: 'tideborn', features: [] };
    const pack = createPackageContentPack(
      { subraces: [sr] },
      [{ type: 'subrace', id: 'reefborn', name: 'Reefborn', included: 'selected' }],
      { name: 'Pack' }, null, '1.0.0',
    );
    const localRace = { id: 'tideborn', name: 'Tideborn (local)' } as any;
    const { issues } = validatePackageForImport(pack, KNOWN_RULESETS, ref => (ref.type === 'race' && ref.id === 'tideborn') ? localRace : undefined);
    expect(issues.find(i => i.code === 'package_missing_dependency')).toBeUndefined();
  });

  it('does not flag missing spell/item references (excluded — see file comment on why)', () => {
    const cls = { id: 'stormcaller', name: 'Stormcaller', hitDie: 8, features: [], startingEquipment: ['longsword'] } as any;
    const pack = createPackageContentPack(
      { classes: [cls] },
      [{ type: 'class', id: 'stormcaller', name: 'Stormcaller', included: 'selected' }],
      { name: 'Pack' }, null, '1.0.0',
    );
    const { issues } = validatePackageForImport(pack, KNOWN_RULESETS, NO_LOCAL);
    expect(issues.find(i => i.code === 'package_missing_dependency')).toBeUndefined();
  });
});

describe('validatePackageForImport — clean package', () => {
  it('a self-contained, valid package produces zero blocking errors and zero issues', () => {
    const race: Race = { id: 'tideborn', name: 'Tideborn', features: [] } as Race;
    const sr: Subrace = { id: 'reefborn', name: 'Reefborn', parentId: 'tideborn', features: [] };
    const pack = createPackageContentPack(
      { races: [race], subraces: [sr] },
      [
        { type: 'race', id: 'tideborn', name: 'Tideborn', included: 'selected' },
        { type: 'subrace', id: 'reefborn', name: 'Reefborn', included: 'selected' },
      ],
      { name: 'Tideborn Collection' }, null, '1.0.0',
    );
    const { blocking, issues } = validatePackageForImport(pack, KNOWN_RULESETS, NO_LOCAL);
    expect(blocking).toEqual([]);
    expect(issues).toEqual([]);
  });
});
