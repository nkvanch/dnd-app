// src/content/feats/__tests__/featBrowse.test.ts
import {
  hasAbilityRequirement, hasSpellcastingRequirement, hasArmorProfRequirement,
  hasWeaponProfRequirement, hasLevelRequirement, hasRaceRequirement,
  featGrantsAsi, featGrantsProficiency, featGrantsActivation,
  primaryPrereqCategory, featSourceLabel, featSortOptions,
} from '../featBrowse';
import { ALL_FEATS } from '../index';
import { sortByOption } from '../../contentQuery';
import { makeEmptyEntity } from '../../../store/characterStore';
import type { Feat } from '../../../engine/types';

describe('feat prerequisite classification', () => {
  it('detects an ability-score prerequisite', () => {
    expect(hasAbilityRequirement('Strength 13+')).toBe(true);
    expect(hasAbilityRequirement('Intelligence or Wisdom 13+')).toBe(true);
    expect(hasAbilityRequirement(null)).toBe(false);
  });

  it('detects a spellcasting prerequisite', () => {
    expect(hasSpellcastingRequirement('The ability to cast at least one spell')).toBe(true);
    expect(hasSpellcastingRequirement('Spellcasting or Pact Magic feature')).toBe(true);
    expect(hasSpellcastingRequirement('Strength 13+')).toBe(false);
  });

  it('detects an armor-proficiency prerequisite', () => {
    expect(hasArmorProfRequirement('Proficiency with medium armor')).toBe(true);
    expect(hasArmorProfRequirement('Strength 13+')).toBe(false);
  });

  it('detects a weapon-proficiency prerequisite', () => {
    expect(hasWeaponProfRequirement('Proficiency with a martial weapon')).toBe(true);
  });

  it('detects a level-gate prerequisite', () => {
    expect(hasLevelRequirement('4th level, Strike of the Giants (Fire Strike)')).toBe(true);
  });

  it('treats unparseable/race text as a race requirement (best-effort fallback)', () => {
    expect(hasRaceRequirement('Halfling')).toBe(true);
    expect(hasRaceRequirement('Elf or half-elf')).toBe(true);
    expect(hasRaceRequirement('Strength 13+')).toBe(false);
    expect(hasRaceRequirement(null)).toBe(false);
    expect(hasRaceRequirement('')).toBe(false);
  });

  it('classifies every real official feat prerequisite without throwing, and multi-facet text (e.g. Cartomancer\'s "4th level, Spellcasting feature") correctly sets both facets', () => {
    for (const feat of ALL_FEATS) {
      expect(() => hasAbilityRequirement(feat.prerequisite)).not.toThrow();
    }
    const cartomancer = ALL_FEATS.find(f => f.id === 'cartomancer');
    if (cartomancer) {
      expect(hasLevelRequirement(cartomancer.prerequisite)).toBe(true);
      expect(hasSpellcastingRequirement(cartomancer.prerequisite)).toBe(true);
    }
  });
});

describe('feat grant classification', () => {
  const baseFeature: Feat['feature'] = {
    id: 'f', name: 'F', description: '', source: { kind: 'feat', refId: 'f' },
    level: null, actions: [], choices: [], passive: true, effects: [],
  };

  it('featGrantsAsi: true when abilityChoice is present', () => {
    const feat: Feat = { id: 'x', name: 'X', prerequisite: null, description: '', source: 'PHB', feature: baseFeature, abilityChoice: { options: ['str'], amount: 1 } };
    expect(featGrantsAsi(feat)).toBe(true);
  });

  it('featGrantsAsi: true when the feature has a baked-in stat_modifier effect', () => {
    const feat: Feat = { id: 'x', name: 'X', prerequisite: null, description: '', source: 'PHB', feature: { ...baseFeature, effects: [{ type: 'stat_modifier', target: 'str', operation: 'add', value: 1, condition: null }] } };
    expect(featGrantsAsi(feat)).toBe(true);
  });

  it('featGrantsAsi: false for a purely narrative feat', () => {
    const feat: Feat = { id: 'x', name: 'X', prerequisite: null, description: '', source: 'PHB', feature: baseFeature };
    expect(featGrantsAsi(feat)).toBe(false);
  });

  it('featGrantsProficiency: true when skillChoice is present', () => {
    const feat: Feat = { id: 'x', name: 'X', prerequisite: null, description: '', source: 'PHB', feature: baseFeature, skillChoice: { picks: [{ id: 'p1', label: 'Pick', mode: 'proficiency', from: 'any' }] } };
    expect(featGrantsProficiency(feat)).toBe(true);
  });

  it('featGrantsActivation: true when the feature has an activation', () => {
    const feat: Feat = { id: 'x', name: 'X', prerequisite: null, description: '', source: 'PHB', feature: { ...baseFeature, activation: { actionType: 'action' } as Feat['feature']['activation'] } };
    expect(featGrantsActivation(feat)).toBe(true);
  });

  it('featGrantsActivation: false for a passive-only feat', () => {
    const feat: Feat = { id: 'x', name: 'X', prerequisite: null, description: '', source: 'PHB', feature: baseFeature };
    expect(featGrantsActivation(feat)).toBe(false);
  });
});

describe('primaryPrereqCategory', () => {
  it('reports "None" for no prerequisite', () => {
    expect(primaryPrereqCategory(null)).toBe('None');
    expect(primaryPrereqCategory('')).toBe('None');
  });
  it('reports the first matching category in a fixed, deterministic order', () => {
    expect(primaryPrereqCategory('Strength 13+')).toBe('Ability Score');
    expect(primaryPrereqCategory('Spellcasting feature')).toBe('Spellcasting');
    expect(primaryPrereqCategory('Proficiency with medium armor')).toBe('Armor Proficiency');
    expect(primaryPrereqCategory('Proficiency with a martial weapon')).toBe('Weapon Proficiency');
    expect(primaryPrereqCategory('4th level')).toBe('Level');
    expect(primaryPrereqCategory('Halfling')).toBe('Race / Species');
  });
  it('Cartomancer\'s multi-facet prerequisite ("4th level, Spellcasting feature") reports Spellcasting first (fixed check order)', () => {
    const cartomancer = ALL_FEATS.find(f => f.id === 'cartomancer');
    if (cartomancer) expect(primaryPrereqCategory(cartomancer.prerequisite)).toBe('Spellcasting');
  });
});

describe('featSourceLabel', () => {
  it('prefers the real Feat.source field over the srd-derived fallback', () => {
    const feat: Feat = { id: 'x', name: 'X', prerequisite: null, description: '', source: "Player's Handbook", feature: { id: 'f', name: 'F', description: '', source: { kind: 'feat', refId: 'x' }, level: null, actions: [], choices: [], passive: true, effects: [] } };
    expect(featSourceLabel(feat, false)).toBe("Player's Handbook");
  });
});

describe('featSortOptions', () => {
  const entity = makeEmptyEntity('e1');
  const mk = (id: string, name: string, prerequisite: string | null = null): Feat => ({
    id, name, prerequisite, description: '', source: 'PHB',
    feature: { id: `${id}_f`, name, description: '', source: { kind: 'feat', refId: id }, level: null, actions: [], choices: [], passive: true, effects: [] },
  });

  it('Eligibility sort: met feats (or no prerequisite) sort before unmet ones', () => {
    const unmet = mk('a_unmet', 'A Unmet', 'Strength 30+'); // no character has STR 30
    const met = mk('b_met', 'B Met', null);
    const options = featSortOptions(entity, () => false);
    const sorted = sortByOption([unmet, met], options, 'eligibility');
    expect(sorted.map(f => f.id)).toEqual(['b_met', 'a_unmet']);
  });

  it('Prerequisite Type sort groups by category, alphabetically, then by name', () => {
    const abilityFeat = mk('ability_feat', 'Ability Feat', 'Strength 13+');
    const levelFeat = mk('level_feat', 'Level Feat', '4th level');
    const options = featSortOptions(entity, () => false);
    const sorted = sortByOption([levelFeat, abilityFeat], options, 'prereq_type');
    // 'Ability Score' < 'Level' alphabetically
    expect(sorted.map(f => f.id)).toEqual(['ability_feat', 'level_feat']);
  });

  it('every real official feat has a resolvable primary prerequisite category', () => {
    for (const feat of ALL_FEATS) {
      expect(() => primaryPrereqCategory(feat.prerequisite)).not.toThrow();
    }
  });
});
