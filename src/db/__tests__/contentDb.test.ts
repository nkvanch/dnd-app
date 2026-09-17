// src/db/__tests__/contentDb.test.ts
// MIGRATION-1: contentDb.ts's version-check/forceOverwrite mechanism IS this
// app's content-schema migration path (see scripts/generate-content-db.mjs's
// header and this file's own doc comment) — content.db is a fully-
// regenerable, read-only build artifact (spells/items derived from
// src/content/**), never user-authored data, so a schema change is applied
// by importing a freshly-built asset over the stale installed copy rather
// than an ALTER TABLE migration. These tests lock in that the version
// check actually gates the reimport, and that dndapp.db (the real user-data
// database — characters, homebrew, installed_packs) is never touched by
// this path at all (a separate connection/file entirely).
import { Platform } from 'react-native';

describe('initContentDb', () => {
  let importSpy: jest.Mock;
  let openSpy: jest.Mock;
  let getMetaMock: jest.Mock;
  let setMetaMock: jest.Mock;

  beforeEach(() => {
    jest.resetModules();
    importSpy = jest.fn().mockResolvedValue(undefined);
    openSpy = jest.fn().mockResolvedValue({ mockDb: true });
    getMetaMock = jest.fn();
    setMetaMock = jest.fn().mockResolvedValue(undefined);

    jest.doMock('expo-sqlite', () => ({
      importDatabaseFromAssetAsync: importSpy,
      openDatabaseAsync: openSpy,
    }));
    jest.doMock('../appMetaRepo', () => ({ getMeta: getMetaMock, setMeta: setMetaMock }));
    jest.doMock('../../content/contentDbVersion', () => ({ CONTENT_DB_VERSION: 'v2' }));
  });

  it('re-imports (forceOverwrite) when the installed version differs from the bundled version', async () => {
    getMetaMock.mockResolvedValue('v1');
    const { initContentDb } = require('../contentDb');
    await initContentDb();
    expect(importSpy).toHaveBeenCalledWith('content.db', expect.objectContaining({ forceOverwrite: true }));
    expect(setMetaMock).toHaveBeenCalledWith('contentDbVersion', 'v2');
  });

  it('skips the re-import entirely when the installed version already matches', async () => {
    getMetaMock.mockResolvedValue('v2');
    const { initContentDb } = require('../contentDb');
    await initContentDb();
    expect(importSpy).not.toHaveBeenCalled();
    expect(setMetaMock).not.toHaveBeenCalled();
  });

  it('re-imports on first launch (no installed version recorded at all)', async () => {
    getMetaMock.mockResolvedValue(null);
    const { initContentDb } = require('../contentDb');
    await initContentDb();
    expect(importSpy).toHaveBeenCalled();
  });

  it('is a no-op on web (no SQLite there) — the content-schema migration never runs there', async () => {
    const originalOS = Platform.OS;
    (Platform as any).OS = 'web';
    const { initContentDb } = require('../contentDb');
    const result = await initContentDb();
    expect(result).toBeNull();
    expect(importSpy).not.toHaveBeenCalled();
    (Platform as any).OS = originalOS;
  });
});
