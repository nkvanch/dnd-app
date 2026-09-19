// ============================================================================
// FILE: src/db/__tests__/draftRepo.test.ts
// First coverage for this file. Re-audit A09 (item 11): the in-progress
// character creation draft used to live ONLY in Zustand memory — an app
// kill mid-creation lost the player's progress outright. Same mock-the-db-
// connection technique already established by combatRepo.test.ts.
// ============================================================================
import { Entity } from '../../engine/types';
import { makeEmptyEntity } from '../../store/characterStore';

describe('draftRepo', () => {
  let repo: typeof import('../draftRepo');
  let mockGetDb: jest.Mock;
  let runAsync: jest.Mock;
  let getFirstAsync: jest.Mock;

  const draft: Entity = { ...makeEmptyEntity('draft1'), identity: { ...makeEmptyEntity('draft1').identity, name: 'Thren' } };

  beforeEach(() => {
    jest.resetModules();
    runAsync = jest.fn().mockResolvedValue(undefined);
    getFirstAsync = jest.fn().mockResolvedValue(null);
    jest.doMock('../db', () => ({ getDb: jest.fn() }));
    mockGetDb = require('../db').getDb;
    mockGetDb.mockReturnValue({ runAsync, getFirstAsync });
    repo = require('../draftRepo');
  });

  it('saveDraftState upserts the draft as a single-row (id=1) blob', async () => {
    await repo.saveDraftState(draft);

    expect(runAsync).toHaveBeenCalledTimes(1);
    const [sql, params] = runAsync.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO character_draft/);
    expect(sql).toMatch(/ON CONFLICT\(id\) DO UPDATE/);
    expect(JSON.parse(params[0])).toEqual(draft);
  });

  it('loadDraftState round-trips a saved draft', async () => {
    getFirstAsync.mockResolvedValue({ data: JSON.stringify(draft) });
    expect(await repo.loadDraftState()).toEqual(draft);
  });

  it('loadDraftState returns null when nothing is saved', async () => {
    getFirstAsync.mockResolvedValue(null);
    expect(await repo.loadDraftState()).toBeNull();
  });

  it('loadDraftState returns null on malformed JSON rather than throwing', async () => {
    getFirstAsync.mockResolvedValue({ data: 'not json{' });
    expect(await repo.loadDraftState()).toBeNull();
  });

  it('clearDraftState deletes the single row', async () => {
    await repo.clearDraftState();
    expect(runAsync).toHaveBeenCalledWith(expect.stringMatching(/DELETE FROM character_draft/));
  });

  it('clearDraftState swallows errors rather than throwing', async () => {
    runAsync.mockRejectedValueOnce(new Error('disk full'));
    await expect(repo.clearDraftState()).resolves.toBeUndefined();
  });
});
