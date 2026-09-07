// src/content/__tests__/contentResolution.test.ts
// Coverage for the centralized homebrew/official precedence + ruleset filter
// that replaced 5 independent ad hoc implementations (4 duplicated spell
// merges, plus a 5th item merge that had no dedup at all — see the A-52
// content-precedence audit). spellRepo/itemRepo are mocked with a small
// fixed fixture rather than depending on real seeded content — Jest resolves
// the .native (SQLite-backed) repo variants by default, which return an
// empty index until init() actually opens a device DB, so asserting against
// real content here would be meaningless without a real DB connection.
import { Spell, Item } from '../../engine/types';
import type { SpellIndexEntry } from '../spellRepo.types';
import type { ItemIndexEntry } from '../itemRepo.types';

const OFFICIAL_SPELL: SpellIndexEntry = {
  id: 'fireball', name: 'Fireball', level: 3, school: 'Evocation',
  castingTime: '1 action', ritual: false, concentration: false,
};
const OFFICIAL_ITEM: ItemIndexEntry = {
  id: 'longsword', name: 'Longsword', weight: 3, cost: '15 gp',
  properties: ['versatile'], hasDamageEffect: true, weaponRange: '5 feet',
};

jest.mock('../spellRepo', () => ({
  spellRepo: {
    getIndex: () => [OFFICIAL_SPELL],
    getSpellSync: (id: string) => (id === 'fireball' ? { ...OFFICIAL_SPELL, description: '', components: [], duration: '', upcast: null, range: '' } : undefined),
  },
}));
jest.mock('../itemRepo', () => ({
  itemRepo: {
    getIndex: () => [OFFICIAL_ITEM],
    getItemSync: (id: string) => (id === 'longsword' ? { id: 'longsword', name: 'Longsword', weight: 3, cost: '15 gp', properties: ['versatile'], features: [] } : undefined),
  },
}));

import { mergeSpellIndex, resolveSpellById, mergeItemIndex, resolveItemById } from '../contentResolution';

function makeSpell(overrides: Partial<Spell> & { id: string; name: string }): Spell {
  return {
    level: 1, school: 'Evocation', castingTime: '1 action', range: '30 feet',
    components: ['V'], duration: 'Instantaneous', description: '', upcast: null,
    ritual: false, concentration: false,
    ...overrides,
  };
}

function makeItem(overrides: Partial<Item> & { id: string; name: string }): Item {
  return { weight: 0, cost: '—', properties: [], features: [], ...overrides };
}

describe('mergeSpellIndex', () => {
  it('includes the official spell when homebrew is empty', () => {
    expect(mergeSpellIndex([])).toEqual([OFFICIAL_SPELL]);
  });

  it('homebrew spell with a new id is added alongside official', () => {
    const merged = mergeSpellIndex([makeSpell({ id: 'hb_new_spell', name: 'New Spell' })]);
    expect(merged).toHaveLength(2);
    expect(merged.some(s => s.id === 'hb_new_spell')).toBe(true);
  });

  it('homebrew spell sharing an official id overrides it, not duplicates it', () => {
    const override = makeSpell({ id: 'fireball', name: 'Reflavored Fireball' });
    const merged = mergeSpellIndex([override]);
    expect(merged).toHaveLength(1);
    expect(merged[0].name).toBe('Reflavored Fireball');
  });

  it('filters homebrew spells by ruleset when an active ruleset is passed', () => {
    const other = makeSpell({ id: 'hb_other', name: 'Other Ruleset Spell', rulesetId: 'other-ruleset' as never });
    expect(mergeSpellIndex([other], 'my-ruleset' as never).some(s => s.id === 'hb_other')).toBe(false);
    expect(mergeSpellIndex([other]).some(s => s.id === 'hb_other')).toBe(true);
  });
});

describe('resolveSpellById', () => {
  it('falls back to official when no homebrew match exists', () => {
    expect(resolveSpellById('fireball', [])?.id).toBe('fireball');
  });

  it('homebrew wins over an official spell sharing the same id', () => {
    const override = makeSpell({ id: 'fireball', name: 'Reflavored Fireball' });
    expect(resolveSpellById('fireball', [override])?.name).toBe('Reflavored Fireball');
  });

  it('returns undefined for an id present in neither', () => {
    expect(resolveSpellById('nonexistent', [])).toBeUndefined();
  });
});

describe('mergeItemIndex', () => {
  it('homebrew item sharing an official id overrides it, not duplicates it (the real bug this closes)', () => {
    const override = makeItem({ id: 'longsword', name: 'Reflavored Longsword' });
    const merged = mergeItemIndex([override]);
    expect(merged).toHaveLength(1);
    expect(merged[0].name).toBe('Reflavored Longsword');
  });

  it('adds a new-id homebrew item alongside official', () => {
    const merged = mergeItemIndex([makeItem({ id: 'hb_new_item', name: 'New Item' })]);
    expect(merged).toHaveLength(2);
  });
});

describe('resolveItemById', () => {
  it('homebrew wins over an official item sharing the same id', () => {
    const override = makeItem({ id: 'longsword', name: 'Reflavored Longsword' });
    expect(resolveItemById('longsword', [override])?.name).toBe('Reflavored Longsword');
  });

  it('falls back to official when no homebrew match exists', () => {
    expect(resolveItemById('longsword', [])?.id).toBe('longsword');
  });
});
