// src/content/spells/__tests__/spellBrowse.test.ts
import { spellSourceLabel, spellSortOptions } from '../spellBrowse';
import { sortByOption } from '../../contentQuery';
import type { SpellIndexEntry } from '../../spellRepo.types';

function mk(over: Partial<SpellIndexEntry>): SpellIndexEntry {
  return {
    id: 'x', name: 'X', level: 0, school: 'Abjuration', castingTime: '1 action',
    ritual: false, concentration: false,
    ...over,
  };
}

describe('spellSourceLabel', () => {
  it('resolves SRD official content to "SRD 5.1"', () => {
    expect(spellSourceLabel(mk({ srd: true }), false)).toBe('SRD 5.1');
  });
  it('resolves non-SRD official content to undefined (no per-item sourcebook field)', () => {
    expect(spellSourceLabel(mk({ srd: false }), false)).toBeUndefined();
  });
  it('resolves homebrew content to "Local Homebrew"', () => {
    expect(spellSourceLabel(mk({}), true)).toBe('Local Homebrew');
  });
});

describe('spellSortOptions', () => {
  const isHomebrewOf = () => false;
  const options = spellSortOptions(isHomebrewOf);

  it('offers exactly A-Z / Z-A / Spell Level / School / Casting Time / Source, in that order', () => {
    expect(options.map(o => o.id)).toEqual(['name_asc', 'name_desc', 'level', 'school', 'casting_time', 'source']);
  });

  it('Spell Level sorts by level then name', () => {
    const a = mk({ id: 'a', name: 'Zephyr Strike', level: 1 });
    const b = mk({ id: 'b', name: 'Acid Splash', level: 0 });
    expect(sortByOption([a, b], options, 'level').map(s => s.id)).toEqual(['b', 'a']);
  });

  it('School sorts alphabetically by school, then name', () => {
    const a = mk({ id: 'a', name: 'A', school: 'Evocation' });
    const b = mk({ id: 'b', name: 'B', school: 'Abjuration' });
    expect(sortByOption([a, b], options, 'school').map(s => s.id)).toEqual(['b', 'a']);
  });

  it('Casting Time sorts Action before Bonus Action before Reaction before Ritual/Long', () => {
    const reaction = mk({ id: 'r', name: 'R', castingTime: '1 reaction, which you take when...' });
    const action   = mk({ id: 'a', name: 'A', castingTime: '1 action' });
    const bonus    = mk({ id: 'b', name: 'B', castingTime: '1 bonus action' });
    const ritual   = mk({ id: 'rit', name: 'Rit', castingTime: '10 minutes' });
    expect(sortByOption([ritual, reaction, bonus, action], options, 'casting_time').map(s => s.id))
      .toEqual(['a', 'b', 'r', 'rit']);
  });

  it('Source sorts SRD-official before undefined-source content', () => {
    const srd = mk({ id: 's', name: 'Zzz', srd: true });
    const unattributed = mk({ id: 'u', name: 'Aaa', srd: false });
    expect(sortByOption([unattributed, srd], options, 'source').map(s => s.id)).toEqual(['s', 'u']);
  });
});
