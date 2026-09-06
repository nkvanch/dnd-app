// src/components/sheet/__tests__/featureGrantRows.test.ts
// Tests buildFeatureGrantRows directly (pure logic), matching this
// codebase's established preference for testing row-builders without
// rendering the RN component. Shared by RemoveFeatureModal (removal
// direction) and the later AddCustomFeatureModal (grant direction) — tests
// exercise both, since the function is meant to be symmetric.
import { buildFeatureGrantRows } from '../featureGrantRows';
import { removeFeature } from '../../../engine/leveling';
import { recomputeDerived } from '../../../engine/pipeline';
import { makeEmptyEntity, DEFAULT_RULES } from '../../../store/characterStore';
import { Entity, FeatureInstance } from '../../../engine/types';

function baseEntity(features: FeatureInstance[] = []): Entity {
  const e = makeEmptyEntity('grant-rows-test');
  const withLevel: Entity = {
    ...e,
    identity: { ...e.identity, level: 1 },
    features: [...e.features, ...features],
  };
  return recomputeDerived(withLevel, DEFAULT_RULES);
}

function manualFeature(id: string, overrides: Partial<FeatureInstance> = {}): FeatureInstance {
  return {
    id, name: id, description: '', level: null,
    effects: [], actions: [], choices: [], passive: true, isActive: true,
    source: { kind: 'manual', refId: id },
    ...overrides,
  };
}

function rowLabels(before: Entity, after: Entity): string[] {
  return buildFeatureGrantRows(before, after).map(r => r.label);
}

describe('buildFeatureGrantRows — removal direction (via removeFeature)', () => {
  it('reports an effective ability-score change when a stat_modifier feature is removed', () => {
    const before = baseEntity([
      manualFeature('str_bonus', { effects: [{ type: 'stat_modifier', target: 'str', operation: 'add', value: 2, condition: null }] }),
    ]);
    const after = recomputeDerived(removeFeature(before, 'str_bonus'), DEFAULT_RULES);
    // before's EFFECTIVE str already includes the +2 (the feature is active
    // in `before`); after removal it drops back to the raw base score.
    expect(rowLabels(before, after)).toContain(`STR: ${before.stats.str + 2} → ${before.stats.str}`);
  });

  it('reports a removed resource the feature owned', () => {
    const before = baseEntity([manualFeature('limited_ability')]);
    const withResource: Entity = {
      ...before,
      resources: {
        ...before.resources,
        custom: [...before.resources.custom, { id: 'limited_ability_pool', name: 'Limited Ability (Uses)', current: 1, maximum: 1, recharge: 'long_rest', sourceKind: 'manual', sourceId: 'limited_ability' }],
      },
    };
    const after = recomputeDerived(removeFeature(withResource, 'limited_ability'), DEFAULT_RULES);
    expect(rowLabels(withResource, after)).toContain('Resource removed: Limited Ability (Uses)');
  });

  // NOTE: skill (and tool/weapon/armor) proficiency granted via a
  // grant_proficiency Effect turns out to be STICKY once recomputeDerived
  // sets entity.skills.skills[x].trained = true — recomputeDerived only ever
  // ADDS trained flags from active effects (pipeline.ts:151-177), it never
  // clears one back to false when the granting effect disappears. So
  // removeFeature cannot actually revoke a skill proficiency a feature
  // granted, even though the row-builder itself is fully able to show that
  // diff (proven below, against hand-constructed entities) — a real,
  // confirmed engine characteristic, not a gap in removeFeature or in this
  // row-builder. Same shape of blind spot the Phase 4 plan already flagged
  // for background skill-retraining (class-choice-trained skills have no
  // backing Effect at all) — this shows it's actually broader: even
  // Effect-driven training is one-way once applied.
  it('does NOT revoke skill training on removal — documents the engine\'s additive-only proficiency behavior, not a regression', () => {
    const before = baseEntity([
      manualFeature('skill_bonus', { effects: [{ type: 'grant_proficiency', target: 'skill:athletics', operation: 'add', value: null, condition: null }] }),
    ]);
    expect(before.skills.skills.athletics.trained).toBe(true);
    const after = recomputeDerived(removeFeature(before, 'skill_bonus'), DEFAULT_RULES);
    expect(after.skills.skills.athletics.trained).toBe(true); // still trained — not reverted
    expect(rowLabels(before, after)).not.toContain('Athletics: no longer proficient');
  });
});

describe('buildFeatureGrantRows — row-builder diff logic in isolation (hand-constructed entities)', () => {
  // Saving-throw proficiency isn't Effect-driven in this engine (unlike
  // skills/tools/weapons/armor via grant_proficiency) — entity.proficiencies
  // .savingThrows is a flat array with no per-feature linkage, so no real
  // mutator (removeFeature included) can be used to exercise this row.
  // Tested directly against hand-constructed before/after entities instead
  // (same approach FeatPreviewModal.test.ts already uses for the gain
  // direction) — proves the row-builder's own diff logic works correctly.
  it('reports a lost saving-throw proficiency as "no longer proficient"', () => {
    const plain = baseEntity();
    const proficient: Entity = recomputeDerived({
      ...plain,
      proficiencies: { ...plain.proficiencies, savingThrows: [...plain.proficiencies.savingThrows, 'wis'] },
    }, DEFAULT_RULES);
    expect(rowLabels(proficient, recomputeDerived(plain, DEFAULT_RULES))).toContain('WIS saving throws: no longer proficient');
  });

  it('reports a gained skill proficiency as "proficient" and a gained expertise as "expertise"', () => {
    const plain = baseEntity();
    const trained: Entity = {
      ...plain,
      skills: { skills: { ...plain.skills.skills, athletics: { ...plain.skills.skills.athletics, trained: true } } },
    };
    expect(rowLabels(plain, trained)).toContain('Athletics: proficient');

    const expert: Entity = {
      ...trained,
      skills: { skills: { ...trained.skills.skills, athletics: { ...trained.skills.skills.athletics, expertise: true } } },
    };
    expect(rowLabels(trained, expert)).toContain('Athletics: expertise');
  });
});

describe('buildFeatureGrantRows — grant direction (symmetric, for the later add-feature modal)', () => {
  it('reports an effective ability-score gain and a new resource when a feature is added', () => {
    const before = baseEntity();
    const grantedFeature = manualFeature('new_power', {
      effects: [{ type: 'stat_modifier', target: 'dex', operation: 'add', value: 1, condition: null }],
    });
    const withFeature: Entity = { ...before, features: [...before.features, grantedFeature] };
    const withResource: Entity = {
      ...withFeature,
      resources: {
        ...withFeature.resources,
        custom: [...withFeature.resources.custom, { id: 'new_power_pool', name: 'New Power (Uses)', current: 1, maximum: 1, recharge: 'long_rest', sourceKind: 'manual', sourceId: 'new_power' }],
      },
    };
    const after = recomputeDerived(withResource, DEFAULT_RULES);
    const labels = rowLabels(before, after);
    expect(labels).toContain(`DEX: ${before.stats.dex} → ${before.stats.dex + 1}`);
    expect(labels).toContain('New resource: New Power (Uses) (1)');
  });
});

describe('buildFeatureGrantRows — no-op case', () => {
  it('returns an empty array when nothing tracked actually changed', () => {
    const e = baseEntity();
    expect(buildFeatureGrantRows(e, e)).toEqual([]);
  });
});
