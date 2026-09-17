// ============================================================================
// FILE: src/content/__tests__/itemRepo.native.test.ts
// Regression lock for the error-isolation fix (R-31) — mirrors
// spellRepo.native.test.ts exactly, see that file's header for the full
// rationale.
// ============================================================================
describe('itemRepo.native error handling', () => {
  let itemRepo: typeof import('../itemRepo.native').itemRepo;
  let mockGetContentDb: jest.Mock;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    // Reset the module registry between tests so each test gets a fresh
    // itemRepo module (its index/fullCache are module-level singletons) —
    // which means the contentDb mock must also be re-registered per test,
    // since resetModules() invalidates any earlier jest.mock() factory
    // instance too (a stale top-level mock reference would silently
    // control a module the fresh itemRepo import never talks to).
    jest.resetModules();
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.doMock('../../db/contentDb', () => ({ getContentDb: jest.fn() }));
    mockGetContentDb = require('../../db/contentDb').getContentDb;
    itemRepo = require('../itemRepo.native').itemRepo;
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it('init() degrades to an empty index when the query throws, without rejecting', async () => {
    mockGetContentDb.mockReturnValue({
      getAllAsync: jest.fn().mockRejectedValue(new Error('SQLite hiccup')),
    });

    await expect(itemRepo.init()).resolves.toBeUndefined();
    expect(itemRepo.getIndex()).toEqual([]);
    expect(errorSpy).toHaveBeenCalled();
  });

  it('init() skips a row with malformed JSON but keeps the rest of the index', async () => {
    mockGetContentDb.mockReturnValue({
      getAllAsync: jest.fn().mockResolvedValue([
        { id: 'good', name: 'Good Item', weight: 1, cost: '1 gp', properties: '["light"]', hasDamageEffect: 0, weaponRange: null, srd: 1 },
        { id: 'bad', name: 'Bad Item', weight: 1, cost: '1 gp', properties: '{not valid json', hasDamageEffect: 0, weaponRange: null, srd: 1 },
      ]),
    });

    await itemRepo.init();

    expect(itemRepo.getIndex().map(e => e.id)).toEqual(['good']);
    expect(errorSpy).toHaveBeenCalled();
  });

  it('ensureLoaded() leaves ids uncached (retryable) when the query throws, without rejecting', async () => {
    mockGetContentDb.mockReturnValue({
      getAllAsync: jest.fn().mockRejectedValue(new Error('SQLite hiccup')),
    });

    await expect(itemRepo.ensureLoaded(['longsword'])).resolves.toBeUndefined();
    expect(itemRepo.getItemSync('longsword')).toBeUndefined();
  });

  it('ensureLoaded() skips a malformed record but caches the valid ones', async () => {
    mockGetContentDb.mockReturnValue({
      getAllAsync: jest.fn().mockResolvedValue([
        { id: 'good', data: JSON.stringify({ id: 'good', name: 'Good Item' }) },
        { id: 'bad', data: '{not valid json' },
      ]),
    });

    await itemRepo.ensureLoaded(['good', 'bad']);

    expect(itemRepo.getItemSync('good')).toEqual({ id: 'good', name: 'Good Item' });
    expect(itemRepo.getItemSync('bad')).toBeUndefined();
    expect(errorSpy).toHaveBeenCalled();
  });

  // TIER1-EXT-1: round-trip for the newly-added rulesetId column.
  it('init() parses rulesetId from the SQLite row into the index entry', async () => {
    mockGetContentDb.mockReturnValue({
      getAllAsync: jest.fn().mockResolvedValue([
        { id: 'ring_1', name: 'Ring of Testing', weight: 0, cost: '—', properties: '["magic item"]', hasDamageEffect: 0, weaponRange: null, srd: 0, rulesetId: 'dnd5e-2024' },
      ]),
    });

    await itemRepo.init();
    expect(itemRepo.getIndex()[0].rulesetId).toBe('dnd5e-2024');
  });

  // A pre-TIER1-EXT-1 row (rulesetId column absent/NULL) must not crash.
  it('init() tolerates a row with the rulesetId column absent (pre-migration shape)', async () => {
    mockGetContentDb.mockReturnValue({
      getAllAsync: jest.fn().mockResolvedValue([
        { id: 'old_item', name: 'Old Item', weight: 1, cost: '1 gp', properties: '[]', hasDamageEffect: 0, weaponRange: null, srd: 1, rulesetId: null },
      ]),
    });

    await itemRepo.init();
    expect(itemRepo.getIndex()[0].rulesetId).toBeUndefined();
  });
});
