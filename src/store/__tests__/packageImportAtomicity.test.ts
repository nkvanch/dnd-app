// A multi-entry package import is all-or-nothing: if the batch write fails, no entry
// reaches the library (saveItems wraps the whole set in one transaction and only
// updates in-memory state after it succeeds).
import * as repo from '../../db/contentCacheRepo';
import { useHomebrewStore } from '../homebrewStore';

jest.mock('../../db/contentCacheRepo', () => {
  const actual = jest.requireActual('../../db/contentCacheRepo');
  return { ...actual, saveHomebrewContentBatch: jest.fn() };
});

const spell = (id: string) => ({ id, name: id, level: 1, school: 'Evocation', castingTime: '1 action', range: '30 feet', duration: 'Instant', description: '', ritual: false, concentration: false, classes: [] }) as never;
const race = () => ({ id: 'r', name: 'R', features: [] }) as never;

beforeEach(() => {
  useHomebrewStore.setState({ races: [], spells: [], monsters: [], conditions: [], items: [], feats: [] } as never);
  (repo.saveHomebrewContentBatch as jest.Mock).mockReset();
});

describe('package import atomicity', () => {
  it('a failing batch write leaves the library exactly as it was', async () => {
    (repo.saveHomebrewContentBatch as jest.Mock).mockRejectedValue(new Error('disk full'));
    await expect(useHomebrewStore.getState().saveItems([
      { type: 'spell', item: spell('a') },
      { type: 'spell', item: spell('b') },
      { type: 'race', item: race() },
    ])).rejects.toThrow('disk full');
    expect(useHomebrewStore.getState().spells).toEqual([]);
    expect(useHomebrewStore.getState().races).toEqual([]);
  });

  it('a successful batch makes every entry available together', async () => {
    (repo.saveHomebrewContentBatch as jest.Mock).mockResolvedValue(undefined);
    await useHomebrewStore.getState().saveItems([
      { type: 'spell', item: spell('a') },
      { type: 'spell', item: spell('b') },
      { type: 'race', item: race() },
    ]);
    expect(useHomebrewStore.getState().spells.map(s => s.id)).toEqual(['a', 'b']);
    expect(useHomebrewStore.getState().races.map(r => r.id)).toEqual(['r']);
    expect(repo.saveHomebrewContentBatch).toHaveBeenCalledTimes(1); // one transaction, not one per entry
  });
});
