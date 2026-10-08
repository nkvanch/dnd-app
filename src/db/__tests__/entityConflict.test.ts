describe('persistedCharacterExists', () => {
  beforeEach(() => jest.resetModules());

  it('queries only a persisted character row with the exact id', async () => {
    const getFirstAsync = jest.fn().mockResolvedValue({ present: 1 });
    jest.doMock('../db', () => ({ getDb: () => ({ getFirstAsync }) }));
    const { persistedCharacterExists } = require('../entityRepo') as typeof import('../entityRepo');
    await expect(persistedCharacterExists('char-alice')).resolves.toBe(true);
    expect(getFirstAsync).toHaveBeenCalledWith(
      expect.stringMatching(/WHERE id = \? AND kind = 'character'/),
      ['char-alice'],
    );
  });

  it('returns false when no persisted character row exists', async () => {
    const getFirstAsync = jest.fn().mockResolvedValue(null);
    jest.doMock('../db', () => ({ getDb: () => ({ getFirstAsync }) }));
    const { persistedCharacterExists } = require('../entityRepo') as typeof import('../entityRepo');
    await expect(persistedCharacterExists('deleted-character')).resolves.toBe(false);
  });
});
