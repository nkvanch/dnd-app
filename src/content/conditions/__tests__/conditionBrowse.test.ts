// src/content/conditions/__tests__/conditionBrowse.test.ts
import { conditionSourceLabel, conditionSortOptions } from '../conditionBrowse';
import { sortByOption } from '../../contentQuery';
import type { Condition } from '../../../engine/types';

function mk(over: Partial<Condition>): Condition {
  return { id: 'x', name: 'X', description: '', features: [], ...over };
}

describe('conditionSourceLabel', () => {
  it('resolves official content to undefined (Condition has no srd field) and homebrew to "Local Homebrew"', () => {
    expect(conditionSourceLabel(mk({}), false)).toBeUndefined();
    expect(conditionSourceLabel(mk({}), true)).toBe('Local Homebrew');
  });
});

describe('conditionSortOptions', () => {
  it('offers exactly A-Z / Z-A / Source, in that order', () => {
    const options = conditionSortOptions(() => false);
    expect(options.map(o => o.id)).toEqual(['name_asc', 'name_desc', 'source']);
  });

  it('A-Z / Z-A sort by name correctly', () => {
    const options = conditionSortOptions(() => false);
    const blinded = mk({ id: 'b', name: 'Blinded' });
    const prone   = mk({ id: 'p', name: 'Prone' });
    expect(sortByOption([prone, blinded], options, 'name_asc').map(c => c.id)).toEqual(['b', 'p']);
    expect(sortByOption([blinded, prone], options, 'name_desc').map(c => c.id)).toEqual(['p', 'b']);
  });

  it('Source sorts homebrew ("Local Homebrew") before official (undefined)', () => {
    const options = conditionSortOptions(c => c.id === 'hb');
    const official = mk({ id: 'off', name: 'Zzz Official' });
    const homebrew = mk({ id: 'hb', name: 'Aaa Homebrew' });
    expect(sortByOption([official, homebrew], options, 'source').map(c => c.id)).toEqual(['hb', 'off']);
  });
});
