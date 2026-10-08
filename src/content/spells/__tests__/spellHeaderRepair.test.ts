import { FULL_SPELL_LIBRARY, repairSpellHeader } from '../index';
import { Spell } from '../../../engine/types';

describe('spell header repair', () => {
  it('no library spell is left with an empty range, duration, casting time or description', () => {
    const bad = (FULL_SPELL_LIBRARY as Spell[]).filter(s => !s.range || !s.duration || !s.castingTime || !s.description).map(s => s.id);
    expect(bad).toEqual([]);
    expect((FULL_SPELL_LIBRARY as Spell[]).filter(s => /\*\*/.test(s.castingTime)).map(s => s.id)).toEqual([]);
  });

  it('splits a merged header back into its fields and keeps a good record untouched', () => {
    const merged = { id: 'x', castingTime: '1 action **Range**: Touch **Components**: V, S, M (a pinch) **Duration**: Until dispelled', range: '', duration: '', components: [] } as unknown as Spell;
    expect(repairSpellHeader(merged)).toMatchObject({ castingTime: '1 action', range: 'Touch', duration: 'Until dispelled', components: ['V', 'S', 'M'] });
    const fine = { id: 'y', castingTime: '1 action', range: '30 feet', duration: '1 hour', components: ['V'] } as unknown as Spell;
    expect(repairSpellHeader(fine)).toBe(fine);
  });

  it('Symbol and Delayed Blast Fireball read correctly', () => {
    const by = (id: string) => (FULL_SPELL_LIBRARY as Spell[]).find(s => s.id === id)!;
    expect(by('symbol')).toMatchObject({ castingTime: '1 minute', range: 'Touch', duration: 'Until dispelled or triggered' });
    expect(by('delayed_blast_fireball').duration).toBe('Concentration, up to 1 minute');
  });
});
