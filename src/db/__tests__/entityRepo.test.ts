// ============================================================================
// FILE: src/db/__tests__/entityRepo.test.ts
// First coverage for this file. Regression lock for audit finding
// PERSIST-4: loadAllEntities/loadEntitiesByKind used to parse every row
// inside one unguarded .map() — a single malformed row threw and silently
// returned an empty list, hiding every other valid character. Same
// mock-the-db-connection technique already established by
// packRegistryRepo.test.ts.
// ============================================================================
describe('entityRepo', () => {
  let repo: typeof import('../entityRepo');
  let mockGetDb: jest.Mock;
  let getAllAsync: jest.Mock;

  // Re-audit A07: validateEntityShape now runs inside parseEntityRow, so
  // these fixtures need every field it requires (stats/resources/features/
  // inventory), not just identity — a minimal {id, identity, kind} object
  // is exactly the "structurally invalid" shape that check now (correctly)
  // rejects.
  function validEntity(overrides: Record<string, unknown>) {
    return {
      kind: 'character',
      stats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      resources: { hp: { current: 10, maximum: 10 } },
      features: [],
      inventory: { equipped: [], carried: [] },
      ...overrides,
    };
  }
  const goodEntity = validEntity({ id: 'good', identity: { name: 'Good', level: 1, classId: 'fighter' } });

  beforeEach(() => {
    jest.resetModules();
    getAllAsync = jest.fn().mockResolvedValue([]);
    jest.doMock('../db', () => ({ getDb: jest.fn() }));
    mockGetDb = require('../db').getDb;
    mockGetDb.mockReturnValue({ getAllAsync, runAsync: jest.fn().mockResolvedValue(undefined) });
    jest.doMock('../../engine/multiclass', () => ({ migrateEntity: (e: unknown) => e }));
    repo = require('../entityRepo');
  });

  it('loadAllEntities returns valid rows and skips a malformed one instead of throwing', async () => {
    getAllAsync.mockResolvedValue([
      { id: 'good', kind: 'character', data: JSON.stringify(goodEntity), updatedAt: 2 },
      { id: 'bad',  kind: 'character', data: 'not json{',                updatedAt: 1 },
    ]);

    const result = await repo.loadAllEntities();

    expect(result).toEqual([goodEntity]);
  });

  it('loadEntitiesByKind returns valid rows and skips a malformed one instead of throwing', async () => {
    getAllAsync.mockResolvedValue([
      { id: 'good', kind: 'character', data: JSON.stringify(goodEntity), updatedAt: 2 },
      { id: 'bad',  kind: 'character', data: 'not json{',                updatedAt: 1 },
    ]);

    const result = await repo.loadEntitiesByKind('character');

    expect(result).toEqual([goodEntity]);
  });

  it('loadAllEntities returns every entity when all rows are valid', async () => {
    const secondEntity = validEntity({ id: 'second', identity: { name: 'Second', level: 2, classId: 'wizard' } });
    getAllAsync.mockResolvedValue([
      { id: 'good',   kind: 'character', data: JSON.stringify(goodEntity),   updatedAt: 2 },
      { id: 'second', kind: 'character', data: JSON.stringify(secondEntity), updatedAt: 1 },
    ]);

    const result = await repo.loadAllEntities();

    expect(result).toEqual([goodEntity, secondEntity]);
  });

  // Re-audit A07: a row that IS valid JSON but structurally missing required
  // fields (the exact {id, identity.name, features} shape the re-audit
  // named) must be quarantined the same way a JSON-syntax error is —
  // skipped and logged, not silently returned as a "healthy" character and
  // not allowed to take down the rest of the load.
  it('quarantines a syntactically-valid-JSON but structurally invalid row, loading the rest normally', async () => {
    const structurallyInvalid = { id: 'bad', identity: { name: 'Bad' }, features: [] }; // missing kind/stats/resources/inventory
    getAllAsync.mockResolvedValue([
      { id: 'good', kind: 'character', data: JSON.stringify(goodEntity),          updatedAt: 2 },
      { id: 'bad',  kind: 'character', data: JSON.stringify(structurallyInvalid), updatedAt: 1 },
    ]);

    const result = await repo.loadAllEntities();

    expect(result).toEqual([goodEntity]);
  });
});
