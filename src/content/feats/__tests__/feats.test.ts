// src/content/feats/__tests__/feats.test.ts
// Regression coverage for the vault-authored feat batch (29 new feats from
// D:\Documents\Sort later\YSB\Obsidian Vault\DND\DND ჩემი\Feats\Official
// feats) — verifies content shape and that every REAL effect (ability
// bonuses, tool proficiencies, the Cartomancer cantrip) actually lands on
// an entity through the real engine, not just that the data typechecks.
import { makeEmptyEntity, DEFAULT_RULES } from '../../../store/characterStore';
import { applyGrant } from '../../../engine/leveling';
import { recomputeDerived } from '../../../engine/pipeline';
import { ALL_FEATS, FEATS_BY_ID } from '../index';
import { Ability, Feat } from '../../../engine/types';

/**
 * Replicates AsiFeatPicker.tsx's featureToApply()/commitFeat() logic: inject
 * the chosen ability's stat_modifier (and skill picks, unused by this
 * batch) into the feat's feature before applying it — duplicated here since
 * that logic is React-component-local, not an exported engine helper.
 */
function applyFeatSelection(feat: Feat, chosenAbility: Ability | null = null): ReturnType<typeof makeEmptyEntity> {
  let e = makeEmptyEntity('e1');
  const extra: Feat['feature']['effects'] = [];
  if (feat.abilityChoice && chosenAbility) {
    extra.push({ type: 'stat_modifier', target: chosenAbility, operation: 'add', value: feat.abilityChoice.amount, condition: null });
  }
  const feature = extra.length > 0 ? { ...feat.feature, effects: [...feat.feature.effects, ...extra] } : feat.feature;
  e = applyGrant(e, { kind: 'feature', value: { ...feature, isActive: true } }, 0);
  return recomputeDerived(e, DEFAULT_RULES);
}

describe('Feat library — content shape', () => {
  it('has no duplicate ids', () => {
    const ids = ALL_FEATS.map(f => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every feat has a non-empty name, description, and source', () => {
    for (const f of ALL_FEATS) {
      expect(f.name.length).toBeGreaterThan(0);
      expect(f.description.length).toBeGreaterThan(0);
      expect(f.source.length).toBeGreaterThan(0);
    }
  });

  it('includes all 29 new vault-authored feats', () => {
    const newIds = [
      'aberrant_dragonmark', 'adept_of_the_black_robes', 'adept_of_the_red_robes', 'adept_of_the_white_robes',
      'agent_of_order', 'baleful_scion', 'cartomancer', 'cohort_of_chaos', 'cruel', 'divinely_favored',
      'flash_recall', 'initiate_of_high_sorcery', 'knight_of_the_crown', 'knight_of_the_rose', 'knight_of_the_sword',
      'mystic_conflux', 'outlands_envoy', 'planar_wanderer', 'quicksmithing', 'remarkable_recovery',
      'righteous_heritor', 'scion_of_the_outer_planes', 'servo_crafting', 'spelldriver', 'squire_of_solamnia',
      'strixhaven_initiate', 'strixhaven_mascot', 'thrown_arms_master', 'vital_sacrifice',
    ];
    for (const id of newIds) expect(FEATS_BY_ID[id]).toBeDefined();
  });
});

describe('New vault feats — real mechanical effects', () => {
  it('Aberrant Dragonmark grants a real +1 Constitution', () => {
    const e = applyFeatSelection(FEATS_BY_ID['aberrant_dragonmark']);
    const effects = e.features.flatMap(f => f.effects);
    expect(effects).toEqual(expect.arrayContaining([
      { type: 'stat_modifier', target: 'con', operation: 'add', value: 1, condition: null },
    ]));
  });

  it('Remarkable Recovery grants a real +1 Constitution', () => {
    const e = applyFeatSelection(FEATS_BY_ID['remarkable_recovery']);
    const effects = e.features.flatMap(f => f.effects);
    expect(effects).toEqual(expect.arrayContaining([
      { type: 'stat_modifier', target: 'con', operation: 'add', value: 1, condition: null },
    ]));
  });

  it('Agent of Order, Baleful Scion, Cohort of Chaos, Outlands Envoy, and Righteous Heritor all offer a real any-ability +1 choice', () => {
    for (const id of ['agent_of_order', 'baleful_scion', 'cohort_of_chaos', 'outlands_envoy', 'righteous_heritor']) {
      const feat = FEATS_BY_ID[id];
      expect(feat.abilityChoice?.options).toEqual(['str', 'dex', 'con', 'int', 'wis', 'cha']);
      const e = applyFeatSelection(feat, 'wis');
      const effects = e.features.flatMap(f => f.effects);
      expect(effects).toEqual(expect.arrayContaining([
        { type: 'stat_modifier', target: 'wis', operation: 'add', value: 1, condition: null },
      ]));
    }
  });

  it('Knight of the Crown/Rose/Sword each offer their own real 3-ability choice', () => {
    expect(FEATS_BY_ID['knight_of_the_crown'].abilityChoice?.options).toEqual(['str', 'dex', 'con']);
    expect(FEATS_BY_ID['knight_of_the_rose'].abilityChoice?.options).toEqual(['con', 'wis', 'cha']);
    expect(FEATS_BY_ID['knight_of_the_sword'].abilityChoice?.options).toEqual(['int', 'wis', 'cha']);
    const e = applyFeatSelection(FEATS_BY_ID['knight_of_the_crown'], 'str');
    const effects = e.features.flatMap(f => f.effects);
    expect(effects).toEqual(expect.arrayContaining([
      { type: 'stat_modifier', target: 'str', operation: 'add', value: 1, condition: null },
    ]));
  });

  it('Thrown Arms Master offers a real Strength-or-Dexterity choice', () => {
    const e = applyFeatSelection(FEATS_BY_ID['thrown_arms_master'], 'dex');
    const effects = e.features.flatMap(f => f.effects);
    expect(effects).toEqual(expect.arrayContaining([
      { type: 'stat_modifier', target: 'dex', operation: 'add', value: 1, condition: null },
    ]));
  });

  it('Cartomancer grants a real Prestidigitation cantrip', () => {
    const e = applyFeatSelection(FEATS_BY_ID['cartomancer']);
    expect(e.spellcasting?.cantrips).toContain('prestidigitation');
  });

  it('Quicksmithing grants real proficiency with quicksmith\'s tools', () => {
    const e = applyFeatSelection(FEATS_BY_ID['quicksmithing']);
    expect(e.proficiencies.tools).toContain('quicksmiths tools');
  });

  it('Scion of the Outer Planes and Strixhaven Initiate stay fully descriptive (compound choice with no fitting mechanism)', () => {
    expect(FEATS_BY_ID['scion_of_the_outer_planes'].feature.effects).toEqual([]);
    expect(FEATS_BY_ID['strixhaven_initiate'].feature.effects).toEqual([]);
  });
});
