// src/content/companions/__tests__/companions.test.ts
// First test coverage for companion content. Proves the item 9 (context-
// dependent/three-state mechanics) real-content fix: the Ranger's wolf
// companion's Pack Tactics used to be an unconditional advantage effect —
// the app has no battlefield-positioning data, so it silently applied
// "advantage on attack rolls" regardless of whether an ally was actually
// within 5 feet, every time. It's now gated behind an explicit situational
// question via Effect.situational, defaulting to not-applying until a
// person explicitly answers Yes — see pipeline.test.ts's synthetic-fixture
// coverage of the underlying mechanism; this file proves the REAL content
// is wired to it correctly, through the real spawn pipeline.
import { createCompanion } from '../../../engine/companion';
import { COMPANION_TEMPLATES_BY_GRANT_FEATURE } from '../index';
import { collectAllEffects } from '../../../engine/pipeline';
import { makeEmptyEntity, DEFAULT_RULES } from '../../../store/characterStore';

describe("Ranger's wolf companion — Pack Tactics", () => {
  const template = COMPANION_TEMPLATES_BY_GRANT_FEATURE.rangers_companion;
  const owner = makeEmptyEntity('owner1');

  it("is tagged situational, not an unconditional advantage effect", () => {
    const packTactics = template.features.find(f => f.id === 'rangers_wolf_pack_tactics')!;
    const effect = packTactics.effects[0];
    expect(effect.situational).toEqual({
      id: 'ally_within_5ft_of_target',
      question: expect.stringContaining('within 5 feet'),
    });
  });

  it('does NOT appear in collectAllEffects for a freshly-spawned wolf (no answer yet — the old bug)', () => {
    const wolf = createCompanion(owner, template, DEFAULT_RULES);
    const active = collectAllEffects(wolf).filter(ae => ae.sourceId === 'rangers_wolf_pack_tactics');
    expect(active).toHaveLength(0);
  });

  it('appears once the situational question is explicitly answered Yes', () => {
    let wolf = createCompanion(owner, template, DEFAULT_RULES);
    wolf = { ...wolf, situationalAnswers: { ally_within_5ft_of_target: true } };
    const active = collectAllEffects(wolf).filter(ae => ae.sourceId === 'rangers_wolf_pack_tactics');
    expect(active).toHaveLength(1);
  });
});
