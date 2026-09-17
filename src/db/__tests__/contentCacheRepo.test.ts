// ============================================================================
// FILE: src/db/__tests__/contentCacheRepo.test.ts
// First coverage for this file. Regression lock for audit finding
// CONTENT-CACHE-PARSE-1: loadHomebrewByType/loadAllHomebrew used to parse
// every content_cache row inside one unguarded .map() — a single malformed
// row (e.g. a half-written record from an app kill mid-save) threw and took
// down the entire homebrew library, not just the corrupted item. Same
// mock-the-db-connection technique already established by entityRepo.test.ts
// (PERSIST-4) and campaignRepo.test.ts.
// ============================================================================
describe('contentCacheRepo', () => {
  let repo: typeof import('../contentCacheRepo');
  let mockGetDb: jest.Mock;
  let getAllAsync: jest.Mock;
  let getFirstAsync: jest.Mock;
  let runAsync: jest.Mock;
  let withTransactionAsync: jest.Mock;

  const goodRace = { id: 'good_race', name: 'Good Race' };

  beforeEach(() => {
    jest.resetModules();
    getAllAsync = jest.fn().mockResolvedValue([]);
    getFirstAsync = jest.fn().mockResolvedValue(null); // "no existing row" — every save is a fresh insert
    runAsync = jest.fn().mockResolvedValue(undefined);
    // Real expo-sqlite awaits the callback and commits/rolls back around it —
    // mocked here as "just run the callback," so a throw inside it propagates
    // to the caller exactly like a real rollback-then-reject would.
    withTransactionAsync = jest.fn(async (cb: () => Promise<void>) => cb());
    jest.doMock('../db', () => ({ getDb: jest.fn() }));
    mockGetDb = require('../db').getDb;
    mockGetDb.mockReturnValue({ getAllAsync, getFirstAsync, runAsync, withTransactionAsync });
    repo = require('../contentCacheRepo');
  });

  it('loadHomebrewByType returns valid rows and skips a malformed one instead of throwing', async () => {
    getAllAsync.mockResolvedValue([
      { id: 'race:good_race', type: 'race', data: JSON.stringify(goodRace), version: '1' },
      { id: 'race:bad_race',  type: 'race', data: 'not json{',              version: '1' },
    ]);

    const result = await repo.loadHomebrewByType('race');

    expect(result).toEqual([goodRace]);
  });

  it('loadHomebrewByType returns every item when all rows are valid', async () => {
    const secondRace = { id: 'second_race', name: 'Second Race' };
    getAllAsync.mockResolvedValue([
      { id: 'race:good_race',   type: 'race', data: JSON.stringify(goodRace),   version: '1' },
      { id: 'race:second_race', type: 'race', data: JSON.stringify(secondRace), version: '1' },
    ]);

    const result = await repo.loadHomebrewByType('race');

    expect(result).toEqual([goodRace, secondRace]);
  });

  it('loadAllHomebrew returns valid rows across types and skips a malformed one instead of throwing', async () => {
    const goodSpell = { id: 'good_spell', name: 'Good Spell' };
    getAllAsync.mockResolvedValue([
      { id: 'race:good_race',   type: 'race',  data: JSON.stringify(goodRace),  version: '1' },
      { id: 'race:bad_race',    type: 'race',  data: 'not json{',               version: '1' },
      { id: 'spell:good_spell', type: 'spell', data: JSON.stringify(goodSpell), version: '1' },
    ]);

    const result = await repo.loadAllHomebrew();

    expect(result).toEqual({ race: [goodRace], spell: [goodSpell] });
  });

  // HOMEBREW-PACKAGE-1 item 14: saveHomebrewContentBatch — the atomic
  // multi-item save the package-import commit handler uses.
  describe('saveHomebrewContentBatch', () => {
    it('writes every item inside exactly ONE transaction, not one per item', async () => {
      const items = [
        { type: 'race' as const, content: { id: 'race_a', name: 'Race A' } as any },
        { type: 'race' as const, content: { id: 'race_b', name: 'Race B' } as any },
        { type: 'spell' as const, content: { id: 'spell_a', name: 'Spell A' } as any },
      ];
      await repo.saveHomebrewContentBatch(items);
      expect(withTransactionAsync).toHaveBeenCalledTimes(1);
      // One INSERT per item, all inside that single transaction call.
      expect(runAsync.mock.calls.filter((c: unknown[]) => String(c[0]).includes('INSERT INTO content_cache '))).toHaveLength(3);
    });

    it('a failure partway through the batch propagates (the transaction never resolves successfully) instead of silently continuing', async () => {
      const items = [
        { type: 'race' as const, content: { id: 'race_a', name: 'Race A' } as any },
        { type: 'race' as const, content: { id: 'race_b', name: 'Race B' } as any },
        { type: 'race' as const, content: { id: 'race_c', name: 'Race C' } as any },
      ];
      // Second item's own upsert fails (simulating a disk error / constraint violation mid-batch).
      runAsync.mockImplementation((sql: string) => {
        if (sql.includes('INSERT INTO content_cache ') && runAsync.mock.calls.length === 2) {
          throw new Error('simulated write failure');
        }
        return Promise.resolve(undefined);
      });
      await expect(repo.saveHomebrewContentBatch(items)).rejects.toThrow('simulated write failure');
      // The third item's upsert must never have been attempted — the batch
      // aborts at the first failure rather than "best effort"-ing the rest.
      expect(runAsync.mock.calls.filter((c: unknown[]) => String((c[1] as unknown[] | undefined)?.[0] ?? '').includes('race_c'))).toHaveLength(0);
    });

    it('is a no-op for an empty list — no transaction opened at all', async () => {
      await repo.saveHomebrewContentBatch([]);
      expect(withTransactionAsync).not.toHaveBeenCalled();
    });

    it('archives an existing row into content_cache_history before overwriting it, same as the single-item saveHomebrewContent', async () => {
      getFirstAsync.mockResolvedValue({ id: 'race:race_a', type: 'race', data: JSON.stringify({ id: 'race_a', name: 'Old Name' }), version: '1' });
      await repo.saveHomebrewContentBatch([{ type: 'race', content: { id: 'race_a', name: 'New Name' } as any }]);
      expect(runAsync.mock.calls.some((c: unknown[]) => String(c[0]).includes('INSERT INTO content_cache_history'))).toBe(true);
      expect(runAsync.mock.calls.some((c: unknown[]) => String(c[0]).includes('UPDATE content_cache SET'))).toBe(true);
    });
  });
});
