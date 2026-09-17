// src/content/backgrounds/__tests__/backgrounds2024.test.ts
// Content-shape correctness for bgAcolyte2024 (src/content/backgrounds/index.ts)
// — the Phase 5 proof that Background.flexibleAsi (2024's background-grants-ASI
// mechanic) is authored correctly, separate from rulesetTagging.test.ts's proof
// that the filtering PIPELINE works.
import { bgAcolyte2024, bgAcolyte } from '../index';

describe('bgAcolyte2024', () => {
  it('is tagged for the 5.5e ruleset, distinct id from classic Acolyte', () => {
    expect(bgAcolyte2024.rulesetId).toBe('dnd5e-2024');
    expect(bgAcolyte2024.id).not.toBe(bgAcolyte.id);
  });

  it('grants a restricted flexible ASI (Wisdom/Intelligence/Charisma only, unlike an unrestricted race flexibleAsi)', () => {
    expect(bgAcolyte2024.flexibleAsi).toBeDefined();
    expect(bgAcolyte2024.flexibleAsi!.mode.kind).toBe('two_one_or_three_one');
    if (bgAcolyte2024.flexibleAsi!.mode.kind === 'two_one_or_three_one') {
      expect(bgAcolyte2024.flexibleAsi!.mode.restrictTo).toEqual(['wis', 'int', 'cha']);
    }
  });

  it('grants no flat stat_modifier effects itself — the ASI is player-directed via flexibleAsi, not baked into a feature', () => {
    const hasStatModifier = bgAcolyte2024.features.some(f =>
      f.effects.some(e => e.type === 'stat_modifier')
    );
    expect(hasStatModifier).toBe(false);
  });

  it('keeps the same Insight/Religion skill proficiencies as classic Acolyte', () => {
    const grants = bgAcolyte2024.features.flatMap(f => f.effects).filter(e => e.type === 'grant_proficiency');
    const targets = grants.map(e => e.target).sort();
    expect(targets).toEqual(['skill:insight', 'skill:religion']);
  });
});
