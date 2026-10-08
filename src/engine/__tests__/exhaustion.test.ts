import { exhaustionEffectText, exhaustionSpeedPenalty, usesCumulativeExhaustion } from '../exhaustion';
import { recomputeDerived } from '../pipeline';
import { makeEmptyEntity, DEFAULT_RULES } from '../../store/characterStore';
import { Entity, RulesetId } from '../types';

function entity(ruleset: string | undefined, exhaustion: number): Entity {
  const e = makeEmptyEntity('e1');
  return { ...e, rulesetId: ruleset as RulesetId | undefined, resources: { ...e.resources, speed: 30 }, conditionMonitor: { ...e.conditionMonitor, exhaustion } };
}

describe('Exhaustion', () => {
  it('2024 rules: each level takes 5 feet off Speed and 2 off D20 Tests', () => {
    expect(usesCumulativeExhaustion(entity('dnd5e-2024', 0))).toBe(true);
    expect(exhaustionSpeedPenalty(entity('dnd5e-2024', 2))).toBe(10);
    expect(exhaustionEffectText(3, entity('dnd5e-2024', 3))).toMatch(/D20 Tests −6, Speed −15 ft/);
    expect(exhaustionEffectText(6, entity('dnd5e-2024', 6))).toBe('Death');
    expect(recomputeDerived(entity('dnd5e-2024', 0), DEFAULT_RULES).derived.speed).toBe(30);
    expect(recomputeDerived(entity('dnd5e-2024', 2), DEFAULT_RULES).derived.speed).toBe(20);
    expect(recomputeDerived(entity('dnd5e-2024', 6), DEFAULT_RULES).derived.speed).toBe(0);
  });

  it('2014 rules keep their tiers and compute no speed penalty', () => {
    expect(exhaustionSpeedPenalty(entity('dnd5e-2014', 4))).toBe(0);
    expect(exhaustionSpeedPenalty(entity(undefined, 4))).toBe(0);
    expect(exhaustionEffectText(2, entity('dnd5e-2014', 2))).toBe('Speed halved');
    expect(recomputeDerived(entity(undefined, 3), DEFAULT_RULES).derived.speed).toBe(30);
  });
});
