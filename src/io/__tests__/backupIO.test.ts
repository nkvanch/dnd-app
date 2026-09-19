// src/io/__tests__/backupIO.test.ts
// First coverage for this file. Regression lock for audit finding
// BACKUP-1: importing an old backup used to unconditionally overwrite a
// character that had been played further since, with zero recency signal —
// Entity carries no timestamp of its own, so findStaleCharacterOverwrites
// compares the pack's overall createdAt against each local character's own
// SQLite updatedAt instead.
import { findStaleCharacterOverwrites, findHomebrewIdCollisions, prepareImportedPack } from '../backupIO';
import { GrimoirePack, GrimoirePackHomebrew } from '../../engine/backup';
import { EntityMeta } from '../../db/entityRepo';
import { makeEmptyEntity } from '../../store/characterStore';

function packWithCharacters(createdAt: number, characterIds: string[]): GrimoirePack {
  return {
    formatVersion: 1,
    packType: 'backup',
    createdAt,
    appVersion: '1.0.0',
    deviceId: null,
    characters: characterIds.map(id => {
      const e = makeEmptyEntity(id, 'character');
      return { ...e, identity: { ...e.identity, name: `Character ${id}` } };
    }),
    homebrew: {},
  };
}

function meta(id: string, updatedAt: number): EntityMeta {
  return { id, kind: 'character', name: '', level: 1, classId: '', hp: 0, updatedAt };
}

describe('findStaleCharacterOverwrites', () => {
  it('flags a character whose local copy is newer than the pack', () => {
    const pack = packWithCharacters(1000, ['c1']);
    const warnings = findStaleCharacterOverwrites(pack, [meta('c1', 2000)]);
    expect(warnings).toEqual(['Character c1']);
  });

  it('does not flag a character whose local copy is older than (or equal to) the pack', () => {
    const pack = packWithCharacters(2000, ['c1']);
    expect(findStaleCharacterOverwrites(pack, [meta('c1', 1000)])).toEqual([]);
    expect(findStaleCharacterOverwrites(pack, [meta('c1', 2000)])).toEqual([]);
  });

  it('does not flag a character with no local copy at all (nothing to lose)', () => {
    const pack = packWithCharacters(1000, ['brand_new']);
    expect(findStaleCharacterOverwrites(pack, [])).toEqual([]);
  });

  it('flags only the characters that are actually stale, in a mixed pack', () => {
    const pack = packWithCharacters(1000, ['stale', 'fresh', 'unknown']);
    const warnings = findStaleCharacterOverwrites(pack, [
      meta('stale', 5000),
      meta('fresh', 500),
    ]);
    expect(warnings).toEqual(['Character stale']);
  });
});

// Regression for audit finding INV-2: importing a shared content-pack used
// to blindly upsert homebrew content by id, with no warning when that id
// already existed locally — silently overwriting a hand-authored (not
// pack-tracked) piece of content with the same name-derived slug.
describe('findHomebrewIdCollisions', () => {
  it('flags a race whose id already exists locally, even though neither copy came from an installed pack', () => {
    const incoming: GrimoirePackHomebrew = { races: [{ id: 'ironclad', name: 'Ironclad (v2)', features: [] }] };
    const local: GrimoirePackHomebrew = { races: [{ id: 'ironclad', name: 'Ironclad (original)', features: [] }] };

    const collisions = findHomebrewIdCollisions(incoming, local);

    expect(collisions).toEqual([
      { type: 'races', id: 'ironclad', incomingName: 'Ironclad (v2)', localName: 'Ironclad (original)' },
    ]);
  });

  it('does not flag an id that only exists in the incoming pack', () => {
    const incoming: GrimoirePackHomebrew = { races: [{ id: 'brand_new', name: 'Brand New', features: [] }] };
    const local: GrimoirePackHomebrew = { races: [{ id: 'ironclad', name: 'Ironclad', features: [] }] };

    expect(findHomebrewIdCollisions(incoming, local)).toEqual([]);
  });

  it('checks each content type independently — same id, different types, is not a collision', () => {
    const incoming: GrimoirePackHomebrew = { items: [{ id: 'shared_id', name: 'A Magic Item', weight: 0, cost: '', properties: [], features: [] }] };
    const local: GrimoirePackHomebrew = { races: [{ id: 'shared_id', name: 'A Race', features: [] }] };

    expect(findHomebrewIdCollisions(incoming, local)).toEqual([]);
  });

  it('returns an empty array when there is no local homebrew at all', () => {
    const incoming: GrimoirePackHomebrew = { races: [{ id: 'ironclad', name: 'Ironclad', features: [] }] };
    expect(findHomebrewIdCollisions(incoming, {})).toEqual([]);
  });
});


describe('prepareImportedPack validation boundary', () => {
  it('rejects malformed nested entity data before producing a commit-ready pack', () => {
    const pack = packWithCharacters(Date.now(), ['unsafe']);
    (pack.characters[0] as any).resources.custom = [{ id: 'bad', name: 'Bad', current: 2, maximum: 1 }];
    expect(() => prepareImportedPack(pack)).toThrow(/unsafe|Character unsafe|resources\.custom/);
  });

  it('rejects malformed conditionMonitor before producing a commit-ready pack', () => {
    const pack = packWithCharacters(Date.now(), ['unsafe-monitor']);
    (pack.characters[0] as any).conditionMonitor.flags = [];
    expect(() => prepareImportedPack(pack)).toThrow(/unsafe-monitor|conditionMonitor/);
  });

  it('rejects a malformed active condition entry before producing a commit-ready pack', () => {
    const pack = packWithCharacters(Date.now(), ['unsafe-active']);
    (pack.characters[0] as any).conditionMonitor.active = [{ id: '', sourceId: 4, duration: { unit: 'turns', remaining: -1 }, suppressedBy: [null] }];
    expect(() => prepareImportedPack(pack)).toThrow(/unsafe-active|conditionMonitor\.active/);
  });

  it('returns migrated, deeply valid entities for the later persistence stage', () => {
    const pack = packWithCharacters(Date.now(), ['safe']);
    expect(prepareImportedPack(pack).characters[0].id).toBe('safe');
  });
});
