// src/io/__tests__/exportText.test.ts
// First test coverage for this file. Regression test for a real bug found
// during an R-29 hygiene audit (engine-hardening Phase 6): buildCharacterMarkdown
// read entity.stats directly (the character's BASE ability scores) instead of
// the effective (stat_modifier-effect-aware) values — the sibling
// characterSheetPdf.ts already had this fixed (see its own header comment);
// this file never got the same fix, so an exported character sheet silently
// printed pre-racial/item/feat-bonus numbers for ability scores, saves, and
// skills.
import { buildCharacterMarkdown, ResolveName } from '../exportText';
import { makeEmptyEntity, DEFAULT_RULES } from '../../store/characterStore';
import { recomputeDerived } from '../../engine/pipeline';
import { Entity, FeatureInstance } from '../../engine/types';

const resolveName: ResolveName = (_kind, id) => id;

function entityWithStrBonus(): Entity {
  const e = makeEmptyEntity('e1');
  const bonusFeature: FeatureInstance = {
    id: 'test_str_bonus', name: 'Test STR Bonus', description: '', level: null,
    source: { kind: 'race', refId: 'test_race' }, isActive: true, passive: true,
    actions: [], choices: [],
    effects: [{ type: 'stat_modifier', target: 'str', operation: 'add', value: 2, condition: null }],
  };
  const withFeature: Entity = {
    ...e,
    identity: { ...e.identity, level: 1 }, // profBonus = +2, exactly (Math.ceil(1 + 1/4))
    features: [...e.features, bonusFeature],
    stats: { ...e.stats, str: 14 }, // base 14 (+2 mod) + effect = effective 16 (+3 mod)
    proficiencies: { ...e.proficiencies, savingThrows: ['str'] },
  };
  return recomputeDerived(withFeature, DEFAULT_RULES);
}

describe('buildCharacterMarkdown — effective vs. base stats', () => {
  it('shows the effective (bonused) ability score and modifier, not the raw base score', () => {
    const md = buildCharacterMarkdown(entityWithStrBonus(), resolveName);
    expect(md).toContain('| Strength | 16 | +3 |'); // effective 16, not base 14
    expect(md).not.toContain('| Strength | 14 |');
  });

  it('computes the STR saving throw off the effective score, not the base', () => {
    const md = buildCharacterMarkdown(entityWithStrBonus(), resolveName);
    // effective mod +3, proficient (profBonus at level 1 = +2) → +5
    expect(md).toContain('**Strength** +5');
  });

  it('leaves an unbonused character unaffected (no drift for the common case)', () => {
    const e = recomputeDerived(makeEmptyEntity('e2'), DEFAULT_RULES);
    const md = buildCharacterMarkdown(e, resolveName);
    expect(md).toContain(`| Strength | ${e.stats.str} |`);
  });
});
