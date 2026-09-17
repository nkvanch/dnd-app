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

  const goodEntity = { id: 'good', kind: 'character', identity: { name: 'Good', level: 1, classId: 'fighter' } };

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
    const secondEntity = { id: 'second', kind: 'character', identity: { name: 'Second', level: 2, classId: 'wizard' } };
    getAllAsync.mockResolvedValue([
      { id: 'good',   kind: 'character', data: JSON.stringify(goodEntity),   updatedAt: 2 },
      { id: 'second', kind: 'character', data: JSON.stringify(secondEntity), updatedAt: 1 },
    ]);

    const result = await repo.loadAllEntities();

    expect(result).toEqual([goodEntity, secondEntity]);
  });
});
