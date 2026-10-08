describe('sessionDocRepo (SQLite-backed KeyValueStore)', () => {
  let getFirstAsync: jest.Mock;
  let runAsync: jest.Mock;
  let getAllAsync: jest.Mock;
  let repo: typeof import('../sessionDocRepo');

  beforeEach(() => {
    jest.resetModules();
    getFirstAsync = jest.fn();
    runAsync = jest.fn().mockResolvedValue(undefined);
    getAllAsync = jest.fn().mockResolvedValue([]);
    jest.doMock('../db', () => ({ getDb: () => ({ getFirstAsync, runAsync, getAllAsync }) }));
    repo = require('../sessionDocRepo');
    repo.setSessionKvForTests(null);
  });

  it('round-trips JSON and upserts', async () => {
    const kv = repo.getSessionKv();
    await kv.set('k1', { a: 1 });
    expect(runAsync.mock.calls[0][0]).toMatch(/INSERT INTO session_docs/);
    expect(runAsync.mock.calls[0][1][0]).toBe('k1');
    expect(JSON.parse(runAsync.mock.calls[0][1][1])).toEqual({ a: 1 });
    getFirstAsync.mockResolvedValue({ key: 'k1', data: '{"a":1}' });
    expect(await kv.get('k1')).toEqual({ a: 1 });
    getFirstAsync.mockResolvedValue(null);
    expect(await kv.get('missing')).toBeNull();
  });

  it('a malformed stored document reads as null instead of throwing', async () => {
    getFirstAsync.mockResolvedValue({ key: 'k', data: 'oops{' });
    expect(await repo.getSessionKv().get('k')).toBeNull();
  });

  it('prefix listing escapes LIKE wildcards so a prefix cannot match more than it names', async () => {
    getAllAsync.mockResolvedValue([{ key: 'session.prep.a' }]);
    expect(await repo.getSessionKv().keys('session.prep.')).toEqual(['session.prep.a']);
    await repo.getSessionKv().keys('100%_x');
    expect(getAllAsync.mock.calls[1][1][0]).toBe('100\\%\\_x%');
  });

  it('delete issues a keyed DELETE', async () => {
    await repo.getSessionKv().delete('k');
    expect(runAsync.mock.calls[0][0]).toMatch(/DELETE FROM session_docs/);
  });
});
