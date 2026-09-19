import { makeEmptyEntity } from '../../store/characterStore';

describe('entityRepo quarantine boundary', () => {
  let repo: typeof import('../entityRepo');
  let getAllAsync: jest.Mock;
  const valid = (id: string) => ({ ...makeEmptyEntity(id), identity: { ...makeEmptyEntity(id).identity, name: id } });
  const good = valid('healthy-a');

  beforeEach(() => {
    jest.resetModules();
    getAllAsync = jest.fn().mockResolvedValue([]);
    jest.doMock('../db', () => ({ getDb: jest.fn(() => ({ getAllAsync, runAsync: jest.fn() })) }));
    jest.doMock('../../engine/multiclass', () => ({ migrateEntity: (e: any) => e?.legacyFixture ? good : e }));
    repo = require('../entityRepo');
  });

  it.each([
    ['missing conditionMonitor', (e: any) => { delete e.conditionMonitor; }],
    ['malformed conditionMonitor flags', (e: any) => { e.conditionMonitor.flags = []; }],
    ['malformed active condition entry', (e: any) => { e.conditionMonitor.active = [{ id: '', sourceId: 42, duration: { unit: 'turns', remaining: -1 }, suppressedBy: [null] }]; }],
    ['malformed derived block', (e: any) => { e.derived = null; }],
    ['malformed hit dice', (e: any) => { e.resources.hitDice.remaining = Infinity; }],
  ])('loads healthy A and C around quarantined B with %s', async (_label, corrupt) => {
    const bad = valid('bad'); corrupt(bad);
    const healthyC = valid('healthy-c');
    getAllAsync.mockResolvedValue([
      { id: good.id, kind: good.kind, data: JSON.stringify(good), updatedAt: 3 },
      { id: bad.id, kind: bad.kind, data: JSON.stringify(bad), updatedAt: 2 },
      { id: healthyC.id, kind: healthyC.kind, data: JSON.stringify(healthyC), updatedAt: 1 },
    ]);
    await expect(repo.loadAllEntities()).resolves.toEqual([good, healthyC]);
  });

  it('skips invalid JSON without hiding healthy rows', async () => {
    getAllAsync.mockResolvedValue([
      { id: good.id, kind: good.kind, data: JSON.stringify(good), updatedAt: 2 },
      { id: 'bad', kind: 'character', data: 'not json{', updatedAt: 1 },
    ]);
    await expect(repo.loadAllEntities()).resolves.toEqual([good]);
  });

  it('migrates supported legacy data before validation', async () => {
    getAllAsync.mockResolvedValue([{ id: 'legacy', kind: 'character', data: JSON.stringify({ legacyFixture: true }), updatedAt: 1 }]);
    await expect(repo.loadAllEntities()).resolves.toEqual([good]);
  });
});
