// ============================================================================
// FILE: src/db/__tests__/syncRepo.test.ts
// First coverage for this file. Regression lock for audit finding
// SYNC-QUEUE-PARSE-1: getUnflushedEvents used to parse every sync_events row
// inside one unguarded .map() — a single malformed payload (e.g. a half-write
// from an app kill mid-queueSyncEvent) threw on every future call, and since
// the bad row was never marked applied, it permanently stalled that device's
// entire outbound sync queue, not just the one corrupted event. Same
// mock-the-db-connection technique already established by entityRepo.test.ts
// (PERSIST-4).
// ============================================================================
describe('syncRepo', () => {
  let repo: typeof import('../syncRepo');
  let mockGetDb: jest.Mock;
  let getAllAsync: jest.Mock;
  let runAsync: jest.Mock;

  const goodEvent = {
    id: 'good', sessionId: 's1', entityId: 'e1', changeType: 'patch',
    payload: { foo: 'bar' }, authorDeviceId: 'd1', timestamp: 1, applied: false,
  };

  beforeEach(() => {
    jest.resetModules();
    getAllAsync = jest.fn().mockResolvedValue([]);
    runAsync    = jest.fn().mockResolvedValue(undefined);
    jest.doMock('../db', () => ({ getDb: jest.fn() }));
    mockGetDb = require('../db').getDb;
    mockGetDb.mockReturnValue({ getAllAsync, runAsync });
    repo = require('../syncRepo');
  });

  it('getUnflushedEvents returns valid events and skips a malformed one instead of throwing', async () => {
    getAllAsync.mockResolvedValue([
      { id: 'good', sessionId: 's1', entityId: 'e1', changeType: 'patch', payload: JSON.stringify(goodEvent.payload), authorDeviceId: 'd1', timestamp: 1, applied: 0 },
      { id: 'bad',  sessionId: 's1', entityId: 'e2', changeType: 'patch', payload: 'not json{',                       authorDeviceId: 'd1', timestamp: 2, applied: 0 },
    ]);

    const result = await repo.getUnflushedEvents('s1');

    expect(result).toEqual([goodEvent]);
  });

  it('getUnflushedEvents marks the malformed row applied so it stops blocking future calls', async () => {
    getAllAsync.mockResolvedValue([
      { id: 'bad', sessionId: 's1', entityId: 'e2', changeType: 'patch', payload: 'not json{', authorDeviceId: 'd1', timestamp: 2, applied: 0 },
    ]);

    await repo.getUnflushedEvents('s1');

    expect(runAsync).toHaveBeenCalledWith(
      'UPDATE sync_events SET applied = 1 WHERE id = ?',
      ['bad'],
    );
  });

  it('getUnflushedEvents returns every event when all rows are valid', async () => {
    const secondEvent = { ...goodEvent, id: 'second', timestamp: 2 };
    getAllAsync.mockResolvedValue([
      { id: 'good',   sessionId: 's1', entityId: 'e1', changeType: 'patch', payload: JSON.stringify(goodEvent.payload),   authorDeviceId: 'd1', timestamp: 1, applied: 0 },
      { id: 'second', sessionId: 's1', entityId: 'e1', changeType: 'patch', payload: JSON.stringify(secondEvent.payload), authorDeviceId: 'd1', timestamp: 2, applied: 0 },
    ]);

    const result = await repo.getUnflushedEvents('s1');

    expect(result).toEqual([goodEvent, secondEvent]);
    expect(runAsync).not.toHaveBeenCalled();
  });
});
