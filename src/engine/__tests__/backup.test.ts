// src/engine/__tests__/backup.test.ts
// First test coverage for this file. validateGrimoirePack only checked the
// pack ENVELOPE (formatVersion/packType/characters is an array) — it never
// validated any individual homebrew content item or character feature's
// structure. A structurally invalid Feature (e.g. one missing its `effects`
// array) previously imported silently, then crashed the app the moment any
// screen touching that character tried to render (collectAllEffects has no
// guard against a malformed effects array) — with only one global
// ErrorBoundary and no per-character isolation, a single malformed import
// could crash the entire app on every subsequent launch (architecture
// review C8). validatePackContents locks in the fix: reject a pack whose
// homebrew content or embedded character features don't pass the same
// per-type validators every in-app authoring form already uses.
import { createBackupPack, validatePackContents, GrimoirePackHomebrew } from '../backup';
import { makeEmptyEntity } from '../../store/characterStore';
import { Race, Feature, FeatureInstance, Entity } from '../types';

function emptyHomebrew(): GrimoirePackHomebrew {
  return {
    races: [], subraces: [], classes: [], subclasses: [], items: [], spells: [],
    backgrounds: [], features: [], feats: [], monsters: [], conditions: [],
  };
}

function validRace(id = 'r1'): Race {
  return { id, name: 'Test Race', features: [] };
}

function validFeature(id = 'f1') {
  return {
    id, name: 'Test Feature', description: '', source: { kind: 'race' as const, refId: id },
    level: null, effects: [], actions: [], choices: [], passive: true, isActive: true,
  };
}

describe('validatePackContents — homebrew content', () => {
  it('returns no problems for a pack with only well-formed content', () => {
    const hb = emptyHomebrew();
    hb.races = [validRace()];
    const pack = createBackupPack([], hb, null, '1.0.0');
    expect(validatePackContents(pack)).toEqual([]);
  });

  it('flags a race missing a required field', () => {
    const hb = emptyHomebrew();
    hb.races = [{ name: 'No Id' } as unknown as Race]; // missing id
    const pack = createBackupPack([], hb, null, '1.0.0');
    const problems = validatePackContents(pack);
    expect(problems.length).toBeGreaterThan(0);
    expect(problems[0]).toContain('race');
  });

  it('flags a malformed feature (missing effects array) via the "feature" content type', () => {
    const hb = emptyHomebrew();
    hb.features = [{ id: 'f1', name: 'Broken' } as unknown as Feature]; // missing effects/source
    const pack = createBackupPack([], hb, null, '1.0.0');
    const problems = validatePackContents(pack);
    expect(problems.some(p => p.includes('feature') && p.includes('f1'))).toBe(true);
  });

  it('is defensive against a homebrew array that is not actually an array (malformed/tampered file)', () => {
    const hb = emptyHomebrew();
    (hb as any).races = 'not an array';
    const pack = createBackupPack([], hb, null, '1.0.0');
    expect(() => validatePackContents(pack)).not.toThrow();
  });
});

describe('validatePackContents — embedded character features', () => {
  it('returns no problems for a character with well-formed features', () => {
    const e: Entity = { ...makeEmptyEntity('c1'), features: [validFeature()] };
    const pack = createBackupPack([e], emptyHomebrew(), null, '1.0.0');
    expect(validatePackContents(pack)).toEqual([]);
  });

  it('flags a character whose embedded feature is missing its effects array — the exact shape collectAllEffects crashes on', () => {
    const brokenFeature = { id: 'f1', name: 'Broken' } as unknown as FeatureInstance;
    const e: Entity = { ...makeEmptyEntity('c1'), identity: { ...makeEmptyEntity('c1').identity, name: 'Thren' }, features: [brokenFeature] };
    const pack = createBackupPack([e], emptyHomebrew(), null, '1.0.0');
    const problems = validatePackContents(pack);
    expect(problems.some(p => p.includes('Thren') && p.includes('features'))).toBe(true);
  });

  it('also checks equipped-item features (the other array collectAllEffects walks)', () => {
    const e: Entity = {
      ...makeEmptyEntity('c1'),
      inventory: {
        ...makeEmptyEntity('c1').inventory,
        equipped: [{ itemId: 'sword', quantity: 1, attuned: false, features: [{ id: 'x' } as unknown as Feature] }],
      },
    };
    const pack = createBackupPack([e], emptyHomebrew(), null, '1.0.0');
    const problems = validatePackContents(pack);
    expect(problems.some(p => p.includes('inventory.equipped[0].features[0]'))).toBe(true);
  });

  it('is defensive against a character whose own features field is malformed (not an array)', () => {
    const e = { ...makeEmptyEntity('c1'), features: 'not an array' } as unknown as Entity;
    const pack = createBackupPack([e], emptyHomebrew(), null, '1.0.0');
    expect(() => validatePackContents(pack)).not.toThrow();
  });

  // Re-audit A07: a character that's syntactically fine JSON but structurally
  // unsound (missing kind/stats/resources/inventory entirely — the exact
  // {id, identity.name, features} shape named in the re-audit) previously
  // passed every check this function ran, since only feature-array CONTENTS
  // were validated, never whether the entity's own required fields exist at
  // all. validateEntityShape now catches this first, before the per-feature
  // checks even run.
  it('rejects a structurally invalid character (missing stats/resources/inventory) even though its features array is well-formed', () => {
    const structurallyInvalid = {
      id: 'c1', identity: { name: 'Malformed', level: 1 }, features: [validFeature()],
    } as unknown as Entity;
    const pack = createBackupPack([structurallyInvalid], emptyHomebrew(), null, '1.0.0');
    const problems = validatePackContents(pack);
    expect(problems.some(p => p.includes('Malformed') && p.includes('stats'))).toBe(true);
  });

  it('one malformed character among healthy ones is reported without throwing, and doesn\'t block validation of the rest', () => {
    const good: Entity = { ...makeEmptyEntity('good'), identity: { ...makeEmptyEntity('good').identity, name: 'Good' }, features: [validFeature()] };
    const bad = { id: 'bad', identity: { name: 'Bad' }, features: [] } as unknown as Entity;
    const pack = createBackupPack([good, bad], emptyHomebrew(), null, '1.0.0');
    const problems = validatePackContents(pack);
    expect(problems.some(p => p.includes('Bad'))).toBe(true);
    expect(problems.some(p => p.includes('Good'))).toBe(false);
  });
});
