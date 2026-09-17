// ============================================================================
// FILE: src/db/__tests__/encounterRepo.test.ts
// First coverage for this file. Regression lock for audit finding
// ENCOUNTER-PARSE-1: loadAllEncounters used to parse every prepared_encounters
// row inside one unguarded .map() — a single malformed row threw and made
// the whole DM Encounter Library unusable, not just the corrupted encounter.
// Same mock-the-db-connection technique already established by
// entityRepo.test.ts (PERSIST-4).
// ============================================================================
describe('encounterRepo', () => {
  let repo: typeof import('../encounterRepo');
  let mockGetDb: jest.Mock;
  let getAllAsync: jest.Mock;
  let getFirstAsync: jest.Mock;

  const goodEncounter = { id: 'good', campaignId: null, status: 'draft', name: 'Good Encounter' };

  beforeEach(() => {
    jest.resetModules();
    getAllAsync   = jest.fn().mockResolvedValue([]);
    getFirstAsync = jest.fn().mockResolvedValue(null);
    jest.doMock('../db', () => ({ getDb: jest.fn() }));
    mockGetDb = require('../db').getDb;
    mockGetDb.mockReturnValue({ getAllAsync, getFirstAsync, runAsync: jest.fn().mockResolvedValue(undefined) });
    repo = require('../encounterRepo');
  });

  it('loadAllEncounters returns valid rows and skips a malformed one instead of throwing', async () => {
    getAllAsync.mockResolvedValue([
      { id: 'good', campaignId: null, status: 'draft', data: JSON.stringify(goodEncounter), updatedAt: 2 },
      { id: 'bad',  campaignId: null, status: 'draft', data: 'not json{',                    updatedAt: 1 },
    ]);

    const result = await repo.loadAllEncounters();

    expect(result).toEqual([goodEncounter]);
  });

  it('loadAllEncounters returns every encounter when all rows are valid', async () => {
    const secondEncounter = { id: 'second', campaignId: null, status: 'draft', name: 'Second Encounter' };
    getAllAsync.mockResolvedValue([
      { id: 'good',   campaignId: null, status: 'draft', data: JSON.stringify(goodEncounter),   updatedAt: 2 },
      { id: 'second', campaignId: null, status: 'draft', data: JSON.stringify(secondEncounter), updatedAt: 1 },
    ]);

    const result = await repo.loadAllEncounters();

    expect(result).toEqual([goodEncounter, secondEncounter]);
  });

  it('loadEncounter returns null instead of throwing when the row is malformed', async () => {
    getFirstAsync.mockResolvedValue({ id: 'bad', campaignId: null, status: 'draft', data: 'not json{', updatedAt: 1 });

    const result = await repo.loadEncounter('bad');

    expect(result).toBeNull();
  });

  it('loadEncounter returns the parsed encounter when the row is valid', async () => {
    getFirstAsync.mockResolvedValue({ id: 'good', campaignId: null, status: 'draft', data: JSON.stringify(goodEncounter), updatedAt: 2 });

    const result = await repo.loadEncounter('good');

    expect(result).toEqual(goodEncounter);
  });
});
