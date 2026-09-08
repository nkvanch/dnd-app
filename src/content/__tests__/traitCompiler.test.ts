// src/content/__tests__/traitCompiler.test.ts
// First test coverage for this file. Focuses on Phase 5 of the engine-
// hardening track: buildTraitFeature/buildTraitFeatureCore derive a
// Feature's id from `${idPrefix}_${toId(name)}` — two DraftTraits with the
// same (or same-once-slugified) name under one idPrefix used to silently
// collide into one Feature.id. These tests lock in the fix: an optional
// `usedIds` Set threaded through disambiguates collisions by appending
// `_2`, `_3`, etc., while every caller that doesn't pass one keeps the
// exact prior (collision-prone but unchanged) behavior.
import { buildTraitFeature, buildSubrace, newDraftTrait, newDraftSubrace, disambiguateId } from '../traitCompiler';
import { DraftTrait } from '../../engine/types';

function trait(name: string, overrides: Partial<DraftTrait> = {}): DraftTrait {
  return { ...newDraftTrait(name), ...overrides };
}

const baseOpts = { idPrefix: 'test_id', sourceKind: 'class' as const, sourceRefId: 'test_id', level: null };

describe('buildTraitFeature — id derivation', () => {
  it('derives the id from idPrefix + slugified name', () => {
    const { feature } = buildTraitFeature(trait('Second Wind'), baseOpts);
    expect(feature.id).toBe('test_id_second_wind');
  });

  it('without usedIds, two same-named traits collide into the identical id (pre-existing, unchanged behavior)', () => {
    const a = buildTraitFeature(trait('Resilience'), baseOpts);
    const b = buildTraitFeature(trait('Resilience'), baseOpts);
    expect(a.feature.id).toBe(b.feature.id);
  });
});

describe('disambiguateId — exported directly for callers that build Feature ids without going through buildTraitFeature (audit bug #8)', () => {
  it('is a no-op when usedIds is omitted', () => {
    expect(disambiguateId('bg_custom_feature')).toBe('bg_custom_feature');
  });

  it('leaves a non-colliding id untouched and records it', () => {
    const usedIds = new Set<string>();
    expect(disambiguateId('bg_keen_senses', usedIds)).toBe('bg_keen_senses');
    expect(usedIds.has('bg_keen_senses')).toBe(true);
  });

  it('appends _2, _3 for repeated collisions', () => {
    const usedIds = new Set<string>();
    expect(disambiguateId('bg_gift', usedIds)).toBe('bg_gift');
    expect(disambiguateId('bg_gift', usedIds)).toBe('bg_gift_2');
    expect(disambiguateId('bg_gift', usedIds)).toBe('bg_gift_3');
  });

  it('matches background-builder.tsx\'s own usage: seeding usedIds with the reserved skills/tools/languages/equipment ids first still disambiguates a colliding custom feature name', () => {
    // Mirrors buildBackground()'s own seed: reserved ids that were actually
    // pushed, then one call per custom feature in order.
    const usedIds = new Set(['bg_acolyte_skills', 'bg_acolyte_languages']);
    const first  = disambiguateId(`bg_acolyte_${'gift'}`, usedIds);
    const second = disambiguateId(`bg_acolyte_${'gift'}`, usedIds); // same slugified name authored twice
    expect(first).toBe('bg_acolyte_gift');
    expect(second).toBe('bg_acolyte_gift_2'); // no longer silently collides with `first`
  });
});

describe('buildTraitFeature — usedIds disambiguation', () => {
  it('leaves the first occurrence of a name untouched', () => {
    const usedIds = new Set<string>();
    const { feature } = buildTraitFeature(trait('Resilience'), { ...baseOpts, usedIds });
    expect(feature.id).toBe('test_id_resilience');
  });

  it('disambiguates a second same-named trait with _2, not silently colliding', () => {
    const usedIds = new Set<string>();
    const a = buildTraitFeature(trait('Resilience'), { ...baseOpts, usedIds });
    const b = buildTraitFeature(trait('Resilience'), { ...baseOpts, usedIds });
    expect(a.feature.id).toBe('test_id_resilience');
    expect(b.feature.id).toBe('test_id_resilience_2');
    expect(a.feature.id).not.toBe(b.feature.id);
  });

  it('disambiguates three+ collisions sequentially (_2, _3, ...)', () => {
    const usedIds = new Set<string>();
    const ids = [
      buildTraitFeature(trait('Resilience'), { ...baseOpts, usedIds }).feature.id,
      buildTraitFeature(trait('Resilience'), { ...baseOpts, usedIds }).feature.id,
      buildTraitFeature(trait('Resilience'), { ...baseOpts, usedIds }).feature.id,
    ];
    expect(ids).toEqual(['test_id_resilience', 'test_id_resilience_2', 'test_id_resilience_3']);
    expect(new Set(ids).size).toBe(3); // all unique
  });

  it('does not disambiguate traits with genuinely different names', () => {
    const usedIds = new Set<string>();
    const a = buildTraitFeature(trait('Resilience'), { ...baseOpts, usedIds });
    const b = buildTraitFeature(trait('Fortitude'), { ...baseOpts, usedIds });
    expect(a.feature.id).toBe('test_id_resilience');
    expect(b.feature.id).toBe('test_id_fortitude');
  });

  it("a limited-use trait's resource pool id is derived from the disambiguated feature id, not recomputed", () => {
    const usedIds = new Set<string>();
    const a = buildTraitFeature(trait('Channel Power', { effectKind: 'ac_bonus', acBonusAmount: '1', limitedUse: true, uses: '1' }), { ...baseOpts, usedIds });
    const b = buildTraitFeature(trait('Channel Power', { effectKind: 'ac_bonus', acBonusAmount: '1', limitedUse: true, uses: '1' }), { ...baseOpts, usedIds });
    expect(a.feature.activation?.resourceCost?.resourceId).toBe('test_id_channel_power_pool');
    expect(b.feature.activation?.resourceCost?.resourceId).toBe('test_id_channel_power_2_pool');
    expect(a.resource?.resourceId).toBe(a.feature.activation?.resourceCost?.resourceId);
    expect(b.resource?.resourceId).toBe(b.feature.activation?.resourceCost?.resourceId);
  });
});

describe('buildSubrace — collision-proofing threaded through the trait loop', () => {
  it('gives two identically-named traits on one subrace distinct feature ids', () => {
    const draft = newDraftSubrace('Hill Dwarf');
    draft.traits = [trait('Toughness'), trait('Toughness')];
    const subrace = buildSubrace(draft, 'dwarf');
    const ids = subrace.features.map(f => f.id);
    expect(new Set(ids).size).toBe(ids.length); // no duplicates
    expect(ids).toContain('dwarf_hill_dwarf_toughness');
    expect(ids).toContain('dwarf_hill_dwarf_toughness_2');
  });

  it('a trait named "Ability Score Increase" does not collide with the subrace\'s own generated ASI feature', () => {
    const draft = newDraftSubrace('Odd Elf');
    draft.abiBonuses = { str: '', dex: '1', con: '', int: '', wis: '', cha: '' };
    draft.traits = [trait('Ability Score Increase')]; // deliberately colliding name
    const subrace = buildSubrace(draft, 'elf');
    const ids = subrace.features.map(f => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('elf_odd_elf_asi'); // the hand-authored ASI feature, untouched
    expect(ids).toContain('elf_odd_elf_ability_score_increase'); // the trait, not colliding with it
  });
});
