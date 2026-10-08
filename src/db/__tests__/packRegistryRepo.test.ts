// ============================================================================
// FILE: src/db/__tests__/packRegistryRepo.test.ts
// A-36 foundations — same mock-the-db-connection technique already
// established by itemRepo.native.test.ts/spellRepo.native.test.ts.
// ============================================================================
describe('packRegistryRepo', () => {
  let repo: typeof import('../packRegistryRepo');
  let mockGetDb: jest.Mock;
  let runAsync: jest.Mock;
  let getAllAsync: jest.Mock;

  beforeEach(() => {
    jest.resetModules();
    runAsync = jest.fn().mockResolvedValue(undefined);
    getAllAsync = jest.fn().mockResolvedValue([]);
    jest.doMock('../db', () => ({ getDb: jest.fn() }));
    mockGetDb = require('../db').getDb;
    mockGetDb.mockReturnValue({ runAsync, getAllAsync });
    repo = require('../packRegistryRepo');
  });

  it('recordInstalledPack inserts with itemRefs JSON-stringified', async () => {
    const refs = [{ type: 'race' as const, id: 'homebrew_race' }, { type: 'spell' as const, id: 'homebrew_spell' }];
    await repo.recordInstalledPack('pack_1', 'My Pack', refs);

    expect(runAsync).toHaveBeenCalledTimes(1);
    const [sql, params] = runAsync.mock.calls[0];
    expect(sql).toMatch(/INSERT OR REPLACE INTO installed_packs/);
    expect(params[0]).toBe('pack_1');
    expect(params[1]).toBe('My Pack');
    expect(typeof params[2]).toBe('number'); // importedAt
    expect(JSON.parse(params[3])).toEqual(refs);
  });

  it('loadInstalledPacks parses stored rows back into typed InstalledPack objects', async () => {
    const refs = [{ type: 'item' as const, id: 'homebrew_item' }];
    getAllAsync.mockResolvedValue([
      { id: 'pack_1', name: 'My Pack', importedAt: 1234, itemRefs: JSON.stringify(refs) },
    ]);

    const packs = await repo.loadInstalledPacks();

    expect(packs).toEqual([{ id: 'pack_1', name: 'My Pack', importedAt: 1234, itemRefs: refs }]);
  });

  // HOMEBREW-PACKAGE-1 item 15: package provenance (packageVersion/author)
  // round-trips through the registry — added alongside items/importedAt.
  it('recordInstalledPack persists packageVersion/author when given, and loadInstalledPacks reads them back', async () => {
    await repo.recordInstalledPack('pack_2', 'Tideborn Collection', [{ type: 'race', id: 'tideborn' }], { packageVersion: '1.2', author: 'Test Author' });
    const [, params] = runAsync.mock.calls[0];
    expect(params[4]).toBe('1.2');
    expect(params[5]).toBe('Test Author');

    getAllAsync.mockResolvedValue([
      { id: 'pack_2', name: 'Tideborn Collection', importedAt: 5678, itemRefs: JSON.stringify([{ type: 'race', id: 'tideborn' }]), packageVersion: '1.2', author: 'Test Author' },
    ]);
    const packs = await repo.loadInstalledPacks();
    expect(packs[0].packageVersion).toBe('1.2');
    expect(packs[0].author).toBe('Test Author');
  });

  it('recordInstalledPack stores null (not the string "undefined") when packageVersion/author are omitted', async () => {
    await repo.recordInstalledPack('pack_3', 'No Metadata Pack', []);
    const [, params] = runAsync.mock.calls[0];
    expect(params[4]).toBeNull();
    expect(params[5]).toBeNull();
  });

  it('loadInstalledPacks returns an empty array when nothing is installed', async () => {
    getAllAsync.mockResolvedValue([]);
    expect(await repo.loadInstalledPacks()).toEqual([]);
  });

  it('deleteInstalledPack deletes by id only — does not touch content_cache', async () => {
    await repo.deleteInstalledPack('pack_1');

    expect(runAsync).toHaveBeenCalledTimes(1);
    const [sql, params] = runAsync.mock.calls[0];
    expect(sql).toMatch(/DELETE FROM installed_packs WHERE id = \?/);
    expect(params).toEqual(['pack_1']);
  });
});
