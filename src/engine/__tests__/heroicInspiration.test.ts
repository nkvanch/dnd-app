import { makeEmptyEntity, DEFAULT_RULES } from '../../store/characterStore';
import { gainHeroicInspiration, spendHeroicInspiration, hasHeroicInspiration, grantsHeroicInspirationOnLongRest } from '../heroicInspiration';
import { takeRest } from '../rest';
import { ALL_RACES as RACES } from '../../content/races/index';

const human = RACES.find((r: any) => r.id === 'human_2024')!;

describe('Heroic Inspiration (2024)', () => {
  it('is gained once, never stacks, and reports the overflow', () => {
    const e = makeEmptyEntity('t');
    expect(hasHeroicInspiration(e)).toBe(false);
    const first = gainHeroicInspiration(e);
    expect(first.entity.heroicInspiration).toBe(true);
    expect(first.overflow).toBe(false);
    const second = gainHeroicInspiration(first.entity);
    expect(second.overflow).toBe(true);
    expect(second.entity).toBe(first.entity);
  });

  it('spending clears it and is a no-op when there is none', () => {
    const e = makeEmptyEntity('t');
    expect(spendHeroicInspiration(e)).toBe(e);
    const had = gainHeroicInspiration(e).entity;
    expect(hasHeroicInspiration(spendHeroicInspiration(had))).toBe(false);
  });

  it('Human Resourceful restores it on a Long Rest, not on a Short Rest; other characters do not get it', () => {
    let e = makeEmptyEntity('t');
    e = { ...e, rulesetId: 'dnd5e-2024' as never, features: [...e.features, human.features.find((f: any) => f.id === 'human_2024_resourceful') as never] };
    expect(grantsHeroicInspirationOnLongRest(e)).toBe(true);
    expect(hasHeroicInspiration(takeRest(e, 'short', DEFAULT_RULES))).toBe(false);
    const rested = takeRest(e, 'long', DEFAULT_RULES);
    expect(hasHeroicInspiration(rested)).toBe(true);
    expect(hasHeroicInspiration(takeRest(rested, 'long', DEFAULT_RULES))).toBe(true);   // still just one
    expect(hasHeroicInspiration(takeRest(makeEmptyEntity('o'), 'long', DEFAULT_RULES))).toBe(false);
  });
});
