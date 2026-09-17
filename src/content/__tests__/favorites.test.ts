// src/content/__tests__/favorites.test.ts
import * as appMetaRepo from '../../db/appMetaRepo';
import { favoriteKey, loadFavorites, saveFavorites } from '../favorites';

describe('favoriteKey', () => {
  it('composes a stable type:id key', () => {
    expect(favoriteKey('condition', 'blinded')).toBe('condition:blinded');
    expect(favoriteKey('spell', 'fireball')).toBe('spell:fireball');
  });
});

describe('loadFavorites', () => {
  afterEach(() => jest.restoreAllMocks());

  it('returns the stored generalized favorites set when present', async () => {
    jest.spyOn(appMetaRepo, 'getMeta').mockResolvedValueOnce(JSON.stringify(['spell:fireball', 'condition:blinded']));
    const favs = await loadFavorites();
    expect(favs).toEqual(new Set(['spell:fireball', 'condition:blinded']));
  });

  it('migrates the legacy Condition-only key when the new key has never been written, preserving existing favorited conditions', async () => {
    const getMetaSpy = jest.spyOn(appMetaRepo, 'getMeta')
      .mockResolvedValueOnce(null) // new key: unset
      .mockResolvedValueOnce(JSON.stringify(['blinded', 'prone'])); // legacy key
    const setMetaSpy = jest.spyOn(appMetaRepo, 'setMeta').mockResolvedValue(undefined);

    const favs = await loadFavorites();

    expect(favs).toEqual(new Set(['condition:blinded', 'condition:prone']));
    // Migration is persisted back under the new key so it only runs once.
    expect(setMetaSpy).toHaveBeenCalledWith('compendium_favorites', JSON.stringify(['condition:blinded', 'condition:prone']));
    getMetaSpy.mockRestore();
  });

  it('returns an empty set when neither key has ever been written', async () => {
    jest.spyOn(appMetaRepo, 'getMeta').mockResolvedValue(null);
    expect(await loadFavorites()).toEqual(new Set());
  });

  it('starts fresh (does not throw) if the stored value is corrupted JSON', async () => {
    jest.spyOn(appMetaRepo, 'getMeta')
      .mockResolvedValueOnce('{not valid json') // new key: corrupted
      .mockResolvedValueOnce(null);             // legacy key: unset
    await expect(loadFavorites()).resolves.toEqual(new Set());
  });
});

describe('saveFavorites', () => {
  it('writes the set as a JSON array under the generalized key', async () => {
    const setMetaSpy = jest.spyOn(appMetaRepo, 'setMeta').mockResolvedValue(undefined);
    await saveFavorites(new Set(['item:longsword', 'race:human']));
    expect(setMetaSpy).toHaveBeenCalledWith('compendium_favorites', JSON.stringify(['item:longsword', 'race:human']));
    setMetaSpy.mockRestore();
  });
});
