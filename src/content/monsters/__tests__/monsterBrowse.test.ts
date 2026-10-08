// src/content/monsters/__tests__/monsterBrowse.test.ts
import { MONSTER_SIZE_ORDER, monsterSourceLabel, monsterSortOptions } from '../monsterBrowse';
import { sortByOption } from '../../contentQuery';
import type { MonsterTemplate } from '../types';

function mk(over: Partial<MonsterTemplate>): MonsterTemplate {
  return {
    id: 'x', name: 'X', cr: 1, size: 'medium', type: 'beast', alignment: 'unaligned',
    stats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    hp: { dice: '2d8', average: 9 }, ac: { value: 10, source: 'natural armor' },
    speed: 30, features: [], savingThrows: [], skills: {}, senses: [], languages: [],
    ...over,
  };
}

describe('MONSTER_SIZE_ORDER', () => {
  it('is lowercase, matching MonsterTemplate.size\'s real field values (a prior capitalized version silently broke the size sort)', () => {
    expect(MONSTER_SIZE_ORDER).toEqual(['tiny', 'small', 'medium', 'large', 'huge', 'gargantuan']);
    for (const s of MONSTER_SIZE_ORDER) expect(s).toBe(s.toLowerCase());
  });
});

describe('monsterSourceLabel', () => {
  it('resolves SRD official content to "SRD 5.1", homebrew to "Local Homebrew"', () => {
    expect(monsterSourceLabel(mk({ srd: true }), false)).toBe('SRD 5.1');
    expect(monsterSourceLabel(mk({}), true)).toBe('Local Homebrew');
  });
});

describe('monsterSortOptions', () => {
  const options = monsterSortOptions(() => false);

  it('offers exactly A-Z / Z-A / CR / Creature Type / Size / Source, in that order', () => {
    expect(options.map(o => o.id)).toEqual(['name_asc', 'name_desc', 'cr', 'type', 'size', 'source']);
  });

  it('CR sorts lowest first, then alphabetically within a tier', () => {
    const goblin = mk({ id: 'g', name: 'Goblin', cr: 0.25 });
    const dragon = mk({ id: 'd', name: 'Dragon', cr: 10 });
    expect(sortByOption([dragon, goblin], options, 'cr').map(m => m.id)).toEqual(['g', 'd']);
  });

  it('Creature Type sorts alphabetically by type, then name', () => {
    const undead = mk({ id: 'u', name: 'U', type: 'undead' });
    const beast  = mk({ id: 'b', name: 'B', type: 'beast' });
    expect(sortByOption([undead, beast], options, 'type').map(m => m.id)).toEqual(['b', 'u']);
  });

  it('Size sorts in real D&D size order (tiny -> gargantuan), not alphabetically', () => {
    const huge   = mk({ id: 'h', name: 'H', size: 'huge' });
    const tiny   = mk({ id: 't', name: 'T', size: 'tiny' });
    const medium = mk({ id: 'm', name: 'M', size: 'medium' });
    // alphabetical would be gargantuan < huge < ... — confirm it's NOT that
    expect(sortByOption([huge, tiny, medium], options, 'size').map(m => m.id)).toEqual(['t', 'm', 'h']);
  });
});
