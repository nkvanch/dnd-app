// ============================================================================
// FILE: src/db/__tests__/combatRepo.test.ts
// First coverage for this file. Regression lock for audit finding
// PERSIST-2: combat_state used to persist only {active, round, turnIndex,
// order, encounterId} — never the live `entities` array — so an app kill
// mid-encounter lost every monster/NPC's HP/conditions and left the DM
// restoring to ghost initiative rows. Same mock-the-db-connection
// technique already established by packRegistryRepo.test.ts.
// ============================================================================
import { CombatState } from '../../engine/combat';

describe('combatRepo', () => {
  let repo: typeof import('../combatRepo');
  let mockGetDb: jest.Mock;
  let runAsync: jest.Mock;
  let getFirstAsync: jest.Mock;

  const combat: CombatState = {
    active: true, round: 2, turnIndex: 1,
    order: [{ entityId: 'a', name: 'A', initiative: 10, tiebreak: 5, isPlayer: false, hasTakenTurn: false }],
    encounterId: 'enc1',
  };
  const entities = [{ id: 'a', kind: 'monster' } as unknown as import('../../engine/types').Entity];

  beforeEach(() => {
    jest.resetModules();
    runAsync = jest.fn().mockResolvedValue(undefined);
    getFirstAsync = jest.fn().mockResolvedValue(null);
    jest.doMock('../db', () => ({ getDb: jest.fn() }));
    mockGetDb = require('../db').getDb;
    mockGetDb.mockReturnValue({ runAsync, getFirstAsync });
    repo = require('../combatRepo');
  });

  it('saveCombatState persists combat AND entities together in one blob', async () => {
    await repo.saveCombatState(combat, entities);

    expect(runAsync).toHaveBeenCalledTimes(1);
    const [sql, params] = runAsync.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO combat_state/);
    const saved = JSON.parse(params[0]);
    expect(saved).toEqual({ combat, entities });
  });

  it('loadCombatState round-trips a row saved by the current shape', async () => {
    getFirstAsync.mockResolvedValue({ data: JSON.stringify({ combat, entities }) });

    const result = await repo.loadCombatState();

    expect(result).toEqual({ combat, entities });
  });

  it('loadCombatState returns null when nothing is saved', async () => {
    getFirstAsync.mockResolvedValue(null);
    expect(await repo.loadCombatState()).toBeNull();
  });

  it('loadCombatState normalizes a pre-migration row (bare CombatState, no entities) instead of throwing', async () => {
    // The exact old shape: saveCombatState used to JSON.stringify the
    // CombatState object directly, with no {combat, entities} wrapper.
    getFirstAsync.mockResolvedValue({ data: JSON.stringify(combat) });

    const result = await repo.loadCombatState();

    expect(result).toEqual({ combat, entities: [] });
  });

  it('loadCombatState returns null on malformed JSON rather than throwing', async () => {
    getFirstAsync.mockResolvedValue({ data: 'not json{' });
    expect(await repo.loadCombatState()).toBeNull();
  });
});
