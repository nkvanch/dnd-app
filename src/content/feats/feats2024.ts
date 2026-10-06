// ============================================================================
// FILE: src/content/feats/feats2024.ts
// The General, Fighting Style and Epic Boon feats of the System Reference Document 5.2.1 (2024 rules / 5.5e), Creative
// Commons Attribution 4.0 ("This work includes material from the System Reference Document 5.2.1 by Wizards of the Coast
// LLC"). The Origin feats are in origin2024.ts. Tagged rulesetId 'dnd5e-2024'; `srd` stays false because that flag here means
// SRD 5.1. `category` says which of the four SRD categories a feat is in.
//
// Modeled: the ability score increases (the feat picker collects the choice), Truesight (a sense), Boon of Fate's use (a pool),
// the activated Boon of the Night Spirit and Boon of Dimensional Travel (cards), and the Defense AC bonus (a situational effect).
// Text only, because the engine has no hook for them: Archery's +2 to ranged attack rolls, Great Weapon Fighting, Two-Weapon
// Fighting, Grappler's and the Epic Boons' combat riders. The Epic Boons raise a score up to 30; the app applies the +1 and
// leaves the cap to the table.
// ============================================================================
import { Ability, Effect, Feat, FeatCategory, RulesetId } from '../../engine/types';
import { feature, activation } from '../homebrewPack/helpers';

const SOURCE = 'System Reference Document 5.2.1 (2024 rules)';
const RULESET = 'dnd5e-2024' as RulesetId;
const ALL: Ability[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

function feat(
  id: string, name: string, category: FeatCategory, prerequisite: string | null, description: string,
  f: Partial<Parameters<typeof feature>[0]> = {}, extra: Partial<Feat> = {},
): Feat {
  const label = { origin: 'Origin Feat', general: 'General Feat', fighting_style: 'Fighting Style Feat', epic_boon: 'Epic Boon Feat' }[category];
  return {
    id, name, category, prerequisite, description: `${label}${prerequisite ? ` (Prerequisite: ${prerequisite})` : ''}. ${description}`,
    source: SOURCE, rulesetId: RULESET, srd: false,
    feature: feature({ id: `feat_${id}`, name, description, source: { kind: 'feat', refId: id }, ...f }),
    ...extra,
  };
}

const L19 = 'Level 19+';
const boon = (id: string, name: string, options: Ability[], text: string, f: Partial<Parameters<typeof feature>[0]> = {}, extra: Partial<Feat> = {}, prerequisite = L19) =>
  feat(id, name, 'epic_boon', prerequisite,
    `Ability Score Increase. Increase ${options.length === 6 ? 'one ability score of your choice' : `your ${options.map(o => ({ str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' }[o])).join(', ').replace(/, ([^,]*)$/, ' or $1')} score`} by 1, to a maximum of 30. ${text}`,
    f, { abilityChoice: { options, amount: 1 }, ...extra });

const defenseAc: Effect = {
  type: 'stat_modifier', target: 'ac', operation: 'add', value: 1, condition: null,
  situational: { id: 'fighting_style_defense_armored', question: 'Are you wearing Light, Medium, or Heavy armor?' },
};

export const GENERAL_FEATS_2024: Feat[] = [
  feat('ability_score_improvement_2024', 'Ability Score Improvement', 'general', 'Level 4+',
    'Increase one ability score of your choice by 2, or increase two ability scores of your choice by 1. This feat can\'t increase an ability score above 20. Repeatable: you can take this feat more than once. (The Ability Improvements step already offers this directly, so the feat list leaves it out.)'),
  feat('grappler_2024', 'Grappler', 'general', 'Level 4+, Strength or Dexterity 13+',
    'Ability Score Increase: increase your Strength or Dexterity score by 1, to a maximum of 20. Punch and Grab: when you hit a creature with an Unarmed Strike as part of the Attack action on your turn, you can use both the Damage and the Grapple option; you can use this benefit only once per turn. Attack Advantage: you have Advantage on attack rolls against a creature Grappled by you. Fast Wrestler: you don\'t have to spend extra movement to move a creature Grappled by you if the creature is your size or smaller.',
    {}, { abilityChoice: { options: ['str', 'dex'], amount: 1 } }),
];

export const FIGHTING_STYLE_FEATS_2024: Feat[] = [
  feat('archery_2024', 'Archery', 'fighting_style', 'Fighting Style Feature', 'You gain a +2 bonus to attack rolls you make with Ranged weapons. (Add the +2 to your ranged attack rolls yourself; the sheet has no attack-roll bonus hook.)'),
  feat('defense_2024', 'Defense', 'fighting_style', 'Fighting Style Feature', 'While you\'re wearing Light, Medium, or Heavy armor, you gain a +1 bonus to Armor Class.', { effects: [defenseAc] }),
  feat('great_weapon_fighting_2024', 'Great Weapon Fighting', 'fighting_style', 'Fighting Style Feature',
    'When you roll damage for an attack you make with a Melee weapon that you are holding with two hands, you can treat any 1 or 2 on a damage die as a 3. The weapon must have the Two-Handed or Versatile property to gain this benefit.'),
  feat('two_weapon_fighting_2024', 'Two-Weapon Fighting', 'fighting_style', 'Fighting Style Feature',
    'When you make an extra attack as a result of using a weapon that has the Light property, you can add your ability modifier to the damage of that attack if you aren\'t already adding it to the damage.'),
];

export const EPIC_BOON_FEATS_2024: Feat[] = [
  boon('boon_of_combat_prowess_2024', 'Boon of Combat Prowess', ALL,
    'Peerless Aim: when you miss with an attack roll, you can hit instead. Once you use this benefit, you can\'t use it again until the start of your next turn.',
    { trigger: 'You miss with an attack roll.' }),
  boon('boon_of_dimensional_travel_2024', 'Boon of Dimensional Travel', ALL,
    'Blink Steps: immediately after you take the Attack action or the Magic action, you can teleport up to 30 feet to an unoccupied space you can see.',
    { trigger: 'You take the Attack action or the Magic action.', activation: activation('free', { range: '30 feet', target: 'self' }), tags: ['movement'] }),
  boon('boon_of_fate_2024', 'Boon of Fate', ALL,
    'Improve Fate: when you or another creature within 60 feet of you succeeds on or fails a D20 Test, you can roll 2d4 and apply the total rolled as a bonus or penalty to the d20 roll. Once you use this benefit, you can\'t use it again until you roll Initiative or finish a Short or Long Rest.',
    { trigger: 'You or a creature within 60 feet succeeds on or fails a D20 Test.', activation: activation('free', { resource: 'boon_of_fate_improve_fate', range: '60 feet', target: 'single' }), tags: ['utility'] },
    { resources: [{ resourceId: 'boon_of_fate_improve_fate', name: 'Boon of Fate: Improve Fate', maximum: 1, recharge: 'short_rest' }] }),
  boon('boon_of_irresistible_offense_2024', 'Boon of Irresistible Offense', ['str', 'dex'],
    'Overcome Defenses: the Bludgeoning, Piercing, and Slashing damage you deal always ignores Resistance. Overwhelming Strike: when you roll a 20 on the d20 for an attack roll, you can deal extra damage to the target equal to the ability score increased by this feat. The extra damage\'s type is the same as the attack\'s type.'),
  boon('boon_of_spell_recall_2024', 'Boon of Spell Recall', ['int', 'wis', 'cha'],
    'Free Casting: whenever you cast a spell with a level 1-4 spell slot, roll 1d4. If the number you roll is the same as the slot\'s level, the slot isn\'t expended.',
    { trigger: 'You cast a spell with a level 1-4 spell slot.' }, {}, 'Level 19+, Spellcasting Feature'),
  boon('boon_of_the_night_spirit_2024', 'Boon of the Night Spirit', ALL,
    'Merge with Shadows: while within Dim Light or Darkness, you can give yourself the Invisible condition as a Bonus Action. The condition ends on you immediately after you take an action, a Bonus Action, or a Reaction.',
    { activation: activation('bonus_action'), tags: ['utility'] }),
  boon('boon_of_truesight_2024', 'Boon of Truesight', ALL,
    'Truesight: you have Truesight with a range of 60 feet.',
    { effects: [{ type: 'grant_sense', target: 'sense', operation: 'add', value: null, condition: null, senseType: 'truesight', senseRange: 60 }] }),
];

/** Every feat this file defines. */
export const MORE_FEATS_2024: Feat[] = [...GENERAL_FEATS_2024, ...FIGHTING_STYLE_FEATS_2024, ...EPIC_BOON_FEATS_2024];
