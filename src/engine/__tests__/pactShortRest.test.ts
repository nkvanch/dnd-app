// Regression: a SOLO pact caster built through levelUp keeps its slots in
// spellcasting.pactSlots; a short rest must restore them (it used to restore only `.slots`).
import { makeEmptyEntity, DEFAULT_RULES } from '../../store/characterStore';
import { levelUp } from '../leveling';
import { takeRest } from '../rest';
import { warlockProgression } from '../../content/classes';
import type { Entity } from '../types';

it('official Warlock: spent pact slots come back on a short rest', () => {
  const e0 = makeEmptyEntity('w');
  const e = levelUp({ ...e0, identity: { ...e0.identity, classId: 'warlock', level: 0 } }, 3, warlockProgression, DEFAULT_RULES);
  const block = e.spellcasting!;
  const key = block.pactSlots ? 'pactSlots' : 'slots';
  const slots = (block as any)[key];
  const tier = (['1', '2', '3', '4', '5'] as const).find(t => slots[t].total > 0)!;
  const spent: Entity = { ...e, spellcasting: { ...block, [key]: { ...slots, [tier]: { total: slots[tier].total, used: slots[tier].total } } } as any };
  expect((takeRest(spent, 'short', DEFAULT_RULES).spellcasting as any)[key][tier].used).toBe(0);
});
