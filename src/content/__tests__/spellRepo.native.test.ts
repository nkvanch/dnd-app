// ============================================================================
// FILE: src/content/__tests__/spellRepo.native.test.ts
// Regression lock for the error-isolation fix (R-31): a malformed row or a
// SQLite hiccup in spellRepo.native.ts must degrade gracefully (empty index /
// uncached id, logged) rather than throwing — the old behavior propagated
// out of init()/ensureLoaded() and aborted the entire app/_layout.tsx boot
// sequence, so no character ever loaded from one bad spell row.
// ============================================================================
describe('spellRepo.native error handling', () => {
  let spellRepo: typeof import('../spellRepo.native').spellRepo;
  let mockGetContentDb: jest.Mock;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    // Reset the module registry between tests so each test gets a fresh
    // spellRepo module (its index/fullCache are module-level singletons) —
    // which means the contentDb mock must also be re-registered per test,
    // since resetModules() invalidates any earlier jest.mock() factory
    // instance too (a stale top-level mock reference would silently
    // control a module the fresh spellRepo import never talks to).
    jest.resetModules();
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.doMock('../../db/contentDb', () => ({ getContentDb: jest.fn() }));
    mockGetContentDb = require('../../db/contentDb').getContentDb;
    spellRepo = require('../spellRepo.native').spellRepo;
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it('init() degrades to an empty index when the query throws, without rejecting', async () => {
    mockGetContentDb.mockReturnValue({
      getAllAsync: jest.fn().mockRejectedValue(new Error('SQLite hiccup')),
    });

    await expect(spellRepo.init()).resolves.toBeUndefined();
    expect(spellRepo.getIndex()).toEqual([]);
    expect(errorSpy).toHaveBeenCalled();
  });

  it('init() skips a row with malformed JSON but keeps the rest of the index', async () => {
    mockGetContentDb.mockReturnValue({
      getAllAsync: jest.fn().mockResolvedValue([
        { id: 'good', name: 'Good Spell', level: 1, school: 'evocation', castingTime: '1 action', ritual: 0, concentration: 0, classes: '["wizard"]', srd: 1 },
        { id: 'bad', name: 'Bad Spell', level: 1, school: 'evocation', castingTime: '1 action', ritual: 0, concentration: 0, classes: '{not valid json', srd: 1 },
      ]),
    });

    await spellRepo.init();

    expect(spellRepo.getIndex().map(e => e.id)).toEqual(['good']);
    expect(errorSpy).toHaveBeenCalled();
  });

  it('ensureLoaded() leaves ids uncached (retryable) when the query throws, without rejecting', async () => {
    mockGetContentDb.mockReturnValue({
      getAllAsync: jest.fn().mockRejectedValue(new Error('SQLite hiccup')),
    });

    await expect(spellRepo.ensureLoaded(['fireball'])).resolves.toBeUndefined();
    expect(spellRepo.getSpellSync('fireball')).toBeUndefined();
  });

  it('ensureLoaded() skips a malformed record but caches the valid ones', async () => {
    mockGetContentDb.mockReturnValue({
      getAllAsync: jest.fn().mockResolvedValue([
        { id: 'good', data: JSON.stringify({ id: 'good', name: 'Good Spell' }) },
        { id: 'bad', data: '{not valid json' },
      ]),
    });

    await spellRepo.ensureLoaded(['good', 'bad']);

    expect(spellRepo.getSpellSync('good')).toEqual({ id: 'good', name: 'Good Spell' });
    expect(spellRepo.getSpellSync('bad')).toBeUndefined();
    expect(errorSpy).toHaveBeenCalled();
  });

  // TIER1-EXT-1: round-trip for the newly-added rulesetId/components columns.
  it('init() parses rulesetId and components from the SQLite row into the index entry', async () => {
    mockGetContentDb.mockReturnValue({
      getAllAsync: jest.fn().mockResolvedValue([
        {
          id: 'fireball', name: 'Fireball', level: 3, school: 'evocation', castingTime: '1 action',
          ritual: 0, concentration: 0, classes: '["wizard","sorcerer"]', srd: 1,
          rulesetId: 'dnd5e-2014', components: '["V","S","M"]',
        },
      ]),
    });

    await spellRepo.init();
    const entry = spellRepo.getIndex()[0];
    expect(entry.rulesetId).toBe('dnd5e-2014');
    expect(entry.components).toEqual(['V', 'S', 'M']);
  });

  // A pre-TIER1-EXT-1 row (as if the app hadn't re-imported the updated
  // bundled asset yet, or the columns are simply absent/NULL) must not
  // crash the index build — rulesetId/components are optional fields.
  it('init() tolerates a row with rulesetId/components columns absent (pre-migration shape)', async () => {
    mockGetContentDb.mockReturnValue({
      getAllAsync: jest.fn().mockResolvedValue([
        {
          id: 'old_spell', name: 'Old Spell', level: 1, school: 'evocation', castingTime: '1 action',
          ritual: 0, concentration: 0, classes: null, srd: 1,
          rulesetId: null, components: null,
        },
      ]),
    });

    await spellRepo.init();
    const entry = spellRepo.getIndex()[0];
    expect(entry.rulesetId).toBeUndefined();
    expect(entry.components).toBeUndefined();
  });
});
