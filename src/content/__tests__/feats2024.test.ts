import { MORE_FEATS_2024, GENERAL_FEATS_2024, FIGHTING_STYLE_FEATS_2024, EPIC_BOON_FEATS_2024 } from '../feats/feats2024';
import { ORIGIN_FEATS_2024 } from '../feats/origin2024';
import { FULL_FEAT_LIBRARY } from '../feats';
import { buildSrd521Pack } from '../packs/srdPacks';
import { evaluatePrerequisite } from '../../engine/featPrereq';
import { makeEmptyEntity } from '../../store/characterStore';
import { Entity } from '../../engine/types';

function at(level: number, features: string[] = [], stats: Partial<Entity['stats']> = {}): Entity {
  const e = makeEmptyEntity('e1');
  return {
    ...e,
    identity: { ...e.identity, level },
    stats: { ...e.stats, ...stats },
    features: features.map(name => ({ id: name, name, description: '', source: { kind: 'class', refId: 'fighter' } })) as unknown as Entity['features'],
  };
}

describe('the 5.5e General, Fighting Style and Epic Boon feats', () => {
  it('there are 2 General, 4 Fighting Style and 7 Epic Boon feats, all 2024 and in their category', () => {
    expect(GENERAL_FEATS_2024).toHaveLength(2);
    expect(FIGHTING_STYLE_FEATS_2024).toHaveLength(4);
    expect(EPIC_BOON_FEATS_2024).toHaveLength(7);
    for (const f of MORE_FEATS_2024) expect(f.rulesetId).toBe('dnd5e-2024');
    expect(GENERAL_FEATS_2024.every(f => f.category === 'general')).toBe(true);
    expect(FIGHTING_STYLE_FEATS_2024.every(f => f.category === 'fighting_style')).toBe(true);
    expect(EPIC_BOON_FEATS_2024.every(f => f.category === 'epic_boon')).toBe(true);
    expect(ORIGIN_FEATS_2024.every(f => f.category === 'origin')).toBe(true);
  });

  it('are in the feat library and the SRD 5.2.1 pack, with unique ids', () => {
    const ids = FULL_FEAT_LIBRARY.map(f => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const f of MORE_FEATS_2024) expect(ids).toContain(f.id);
    const pack = buildSrd521Pack();
    expect(pack.manifest.counts?.feats).toBe(ORIGIN_FEATS_2024.length + MORE_FEATS_2024.length);
    expect(pack.homebrew?.feats).toHaveLength(ORIGIN_FEATS_2024.length + MORE_FEATS_2024.length);
  });

  it('every epic boon raises an ability by 1 and needs level 19', () => {
    for (const f of EPIC_BOON_FEATS_2024) {
      expect(f.abilityChoice?.amount).toBe(1);
      expect(f.prerequisite).toMatch(/^Level 19\+/);
    }
    expect(EPIC_BOON_FEATS_2024.find(f => f.id === 'boon_of_irresistible_offense_2024')?.abilityChoice?.options).toEqual(['str', 'dex']);
    expect(EPIC_BOON_FEATS_2024.find(f => f.id === 'boon_of_spell_recall_2024')?.abilityChoice?.options).toEqual(['int', 'wis', 'cha']);
  });

  it('Truesight grants a 60 ft sense and Boon of Fate has one use per short rest', () => {
    const ts = EPIC_BOON_FEATS_2024.find(f => f.id === 'boon_of_truesight_2024')!;
    expect(ts.feature.effects?.[0]).toMatchObject({ type: 'grant_sense', senseType: 'truesight', senseRange: 60 });
    const fate = EPIC_BOON_FEATS_2024.find(f => f.id === 'boon_of_fate_2024')!;
    expect(fate.resources?.[0]).toMatchObject({ maximum: 1, recharge: 'short_rest' });
  });
});

describe('2024 feat prerequisites', () => {
  it('"Level 4+" is met from level 4', () => {
    expect(evaluatePrerequisite(at(3), 'Level 4+').met).toBe(false);
    expect(evaluatePrerequisite(at(4), 'Level 4+').met).toBe(true);
  });

  it('Grappler needs level 4 and Strength or Dexterity 13', () => {
    const p = 'Level 4+, Strength or Dexterity 13+';
    expect(evaluatePrerequisite(at(3, [], { str: 15 }), p).met).toBe(false);
    expect(evaluatePrerequisite(at(4, [], { str: 10, dex: 10 }), p).met).toBe(false);
    expect(evaluatePrerequisite(at(4, [], { str: 13, dex: 8 }), p).met).toBe(true);
    expect(evaluatePrerequisite(at(4, [], { str: 8, dex: 14 }), p).met).toBe(true);
  });

  it('a Fighting Style feat needs the Fighting Style feature', () => {
    expect(evaluatePrerequisite(at(5), 'Fighting Style Feature').met).toBe(false);
    expect(evaluatePrerequisite(at(5, ['Fighting Style']), 'Fighting Style Feature').met).toBe(true);
  });

  it('epic boons need level 19', () => {
    expect(evaluatePrerequisite(at(18), 'Level 19+').met).toBe(false);
    expect(evaluatePrerequisite(at(19), 'Level 19+').met).toBe(true);
  });
});
