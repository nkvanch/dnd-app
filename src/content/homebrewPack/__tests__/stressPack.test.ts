// Behavior of the Creator Stress-Test Pack content, run through the real engine.
import { makeEmptyEntity, DEFAULT_RULES } from '../../../store/characterStore';
import { recomputeDerived } from '../../../engine/pipeline';
import { applyFeatToEntity, applyGrant } from '../../../engine/leveling';
import { applyCondition } from '../../../engine/conditions';
import { applyAbilityEffects } from '../../../engine/combat';
import { equipItem } from '../../../engine/inventory';
import { takeDawn, takeRest } from '../../../engine/rest';
import { grantRewardTier, currentRewardTier } from '../../../engine/rewardTracks';
import { registerHomebrewConditions } from '../../conditions/index';
import { BUILTIN_HOMEBREW } from '../../builtinHomebrew';
import {
  anchorOfCommand, bracedCondition, heldFastCondition, takeABrace, standardOfTheUnyieldingLine,
  weightOfAuthorityTiers, commandTheField,
} from '../stressPack';
import { Entity } from '../../../engine/types';

const base = (): Entity => {
  const e = makeEmptyEntity('pack');
  return recomputeDerived({ ...e, identity: { ...e.identity, level: 5 }, resources: { ...e.resources, hp: { current: 40, maximum: 40, temp: 0 } } }, DEFAULT_RULES);
};
const tierFeatures = (tier: number) => weightOfAuthorityTiers.filter(f => f.rewardTrack?.tier === tier);

describe('registration', () => {
  it('every piece of the pack is exposed through BUILTIN_HOMEBREW', () => {
    expect(BUILTIN_HOMEBREW.feats.map(f => f.id)).toEqual(expect.arrayContaining(['anchor_of_command', 'take_a_brace']));
    expect(BUILTIN_HOMEBREW.conditions.map(c => c.id)).toEqual(expect.arrayContaining(['braced', 'held_fast']));
    expect(BUILTIN_HOMEBREW.spells.map(s => s.id)).toContain('command_the_field');
    expect(BUILTIN_HOMEBREW.items.map(i => i.id)).toContain('standard_of_the_unyielding_line');
    expect(BUILTIN_HOMEBREW.features.filter(f => f.rewardTrack?.trackId === 'weight_of_authority')).toHaveLength(4);
  });
});

describe('Braced', () => {
  it('speed -10, +1 AC, and Dash is disabled', () => {
    const before = base();
    const after = applyCondition(before, 'braced', 'test', DEFAULT_RULES, bracedCondition.features, { unit: 'rounds', remaining: 1 });
    expect(after.derived.speed).toBe(before.derived.speed - 10);
    expect(after.derived.ac).toBe(before.derived.ac + 1);
    expect(after.derived.advantageStates.filter(a => a.state === 'advantage').map(a => a.target)).toEqual(
      expect.arrayContaining([expect.stringContaining('moved against your will'), expect.stringContaining('knocked prone')]));
    const { collectAllEffects } = require('../../../engine/pipeline');
    expect(collectAllEffects(after).some((a: any) => a.effect.target === 'disable_action:dash')).toBe(true);
    expect(collectAllEffects(before).some((a: any) => a.effect.target === 'disable_action:dash')).toBe(false);
  });

  it('Take a Brace applies it for real once the homebrew condition is registered', () => {
    registerHomebrewConditions([bracedCondition, heldFastCondition]);
    const e = base();
    const fx = takeABrace.feature;
    const after = applyAbilityEffects(applyGrant(e, { kind: 'feature', value: { ...fx, isActive: true } }, 1), fx.abilityEffects!, DEFAULT_RULES, fx.activation);
    expect(after.conditions.some(c => c.id === 'braced')).toBe(true);
    expect(after.derived.ac).toBe(e.derived.ac + 1);
  });
});

describe('Anchor of Command', () => {
  const taken = () => applyFeatToEntity(base(), 'c1', 4, anchorOfCommand.feature, 'anchor_of_command', DEFAULT_RULES,
    undefined, anchorOfCommand.resources);

  it('grants the once-per-long-rest Hold Fast pool and a CON/CHA +1 choice', () => {
    expect(anchorOfCommand.abilityChoice).toEqual({ options: ['con', 'cha'], amount: 1 });
    expect(taken().resources.custom.find(r => r.id === 'anchor_hold_fast')).toMatchObject({ current: 1, maximum: 1, recharge: 'long_rest' });
  });

  it('Hold Fast sets speed to 0 through the applied Held Fast condition', () => {
    registerHomebrewConditions([bracedCondition, heldFastCondition]);
    const e = taken();
    const after = applyAbilityEffects(e, anchorOfCommand.feature.abilityEffects!, DEFAULT_RULES, anchorOfCommand.feature.activation);
    expect(after.conditions.some(c => c.id === 'held_fast')).toBe(true);
    expect(after.derived.speed).toBe(0);
  });
});

describe('Standard of the Unyielding Line', () => {
  const equipped = () => {
    const e = base();
    const withItem: Entity = { ...e, inventory: { ...e.inventory, carried: [{ itemId: standardOfTheUnyieldingLine.id, quantity: 1, attuned: true, features: [] }] } };
    return equipItem(withItem, standardOfTheUnyieldingLine.id, standardOfTheUnyieldingLine, DEFAULT_RULES);
  };

  it('creates a 3-charge pool the first time it is equipped, and re-equipping never refills a spent pool', () => {
    let e = equipped();
    expect(e.resources.custom.find(r => r.id === 'standard_charges')).toMatchObject({ current: 3, maximum: 3, recharge: 'dawn:1d3' });
    e = { ...e, resources: { ...e.resources, custom: e.resources.custom.map(r => r.id === 'standard_charges' ? { ...r, current: 1 } : r) } };
    const { unequipItem } = require('../../../engine/inventory');
    e = equipItem(unequipItem(e, standardOfTheUnyieldingLine.id, DEFAULT_RULES), standardOfTheUnyieldingLine.id, standardOfTheUnyieldingLine, DEFAULT_RULES);
    expect(e.resources.custom.find(r => r.id === 'standard_charges')!.current).toBe(1);
  });

  it('regains 1d3 expended charges at dawn, capped at the maximum, and is untouched by a rest', () => {
    let e = equipped();
    e = { ...e, resources: { ...e.resources, custom: e.resources.custom.map(r => r.id === 'standard_charges' ? { ...r, current: 0 } : r) } };
    expect(takeRest(e, 'long', DEFAULT_RULES).resources.custom.find(r => r.id === 'standard_charges')!.current).toBe(0);
    for (let i = 0; i < 30; i++) {
      const dawn = takeDawn(e, DEFAULT_RULES).resources.custom.find(r => r.id === 'standard_charges')!.current;
      expect(dawn).toBeGreaterThanOrEqual(1);
      expect(dawn).toBeLessThanOrEqual(3);
    }
    const nearlyFull = { ...e, resources: { ...e.resources, custom: e.resources.custom.map(r => r.id === 'standard_charges' ? { ...r, current: 2 } : r) } };
    for (let i = 0; i < 30; i++) expect(takeDawn(nearlyFull, DEFAULT_RULES).resources.custom.find(r => r.id === 'standard_charges')!.current).toBeLessThanOrEqual(3);
  });

  it('gives advantage against being frightened to its attuned bearer', () => {
    expect(equipped().derived.advantageStates).toContainEqual({ target: 'saving throws against being frightened', state: 'advantage' });
  });
});

describe('Weight of Authority tiers replace, never stack', () => {
  it('Tier I -> II -> III nets +5 / +10 / +15 max HP, +1/+2/+3 initiative, and 1/2/3 reroll uses', () => {
    const e0 = base();
    const e1 = grantRewardTier(e0, tierFeatures(1));
    expect(e1.resources.hp.maximum).toBe(45);
    expect(e1.derived.initiative).toBe(e0.derived.initiative + 1);
    expect(e1.resources.custom.find(r => r.id === 'weight_of_authority_reroll')!.maximum).toBe(1);

    const e2 = grantRewardTier(e1, tierFeatures(2));
    expect(e2.resources.hp.maximum).toBe(50);
    expect(e2.derived.initiative).toBe(e0.derived.initiative + 2);
    expect(e2.resources.custom.find(r => r.id === 'weight_of_authority_reroll')!.maximum).toBe(2);
    expect(e2.features.filter(f => f.rewardTrack?.tier === 1)).toHaveLength(0);

    const e3 = grantRewardTier(e2, tierFeatures(3));
    expect(e3.resources.hp.maximum).toBe(55);
    expect(e3.derived.initiative).toBe(e0.derived.initiative + 3);
    expect(e3.resources.custom.find(r => r.id === 'weight_of_authority_reroll')!.maximum).toBe(3);
    expect(e3.resources.custom.find(r => r.id === 'weight_of_authority_stand')).toMatchObject({ current: 1, maximum: 1 });
    expect(currentRewardTier(e3, 'weight_of_authority')).toBe(3);
  });

  it('re-granting a lower or equal tier is a no-op', () => {
    const e2 = grantRewardTier(base(), tierFeatures(2));
    expect(grantRewardTier(e2, tierFeatures(1))).toBe(e2);
    expect(grantRewardTier(e2, tierFeatures(2))).toBe(e2);
  });

  it('a tier can be granted directly without the ones before it', () => {
    const e = grantRewardTier(base(), tierFeatures(3));
    expect(e.resources.hp.maximum).toBe(55);
  });
});

describe('Command the Field', () => {
  it('is a 3rd-level concentration enchantment with upcast target scaling', () => {
    expect(commandTheField).toMatchObject({ level: 3, school: 'Enchantment', concentration: true });
    expect(commandTheField.upcast).toMatch(/one additional creature for each slot level above 3rd/);
  });
});
