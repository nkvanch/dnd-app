// ============================================================================
// FILE: src/content/subclasses/fighter.ts
// Fighter subclasses: Battle Master, Champion
// ============================================================================
import { ClassProgression, ChoiceOption, Feature } from '../../engine/types';

export type SubclassProgression = ClassProgression & { name: string };

// ── Battle Master maneuvers ──────────────────────────────────────────────────
// 7 of the 16 PHB maneuvers get real mechanics (activation + resourceCost
// against the superiority_dice pool already granted at L3; a few also get a
// real apply_condition/heal rider for card classification/display — note
// applyAbilityEffects() doesn't yet auto-apply apply_condition to a target,
// same disclosed gap monster stat blocks already ship with, see combat.ts).
// Maneuver save DC (8+prof+STR/DEX) has no formula slot on
// FeatureActivation.requiresSave (spell_save_dc or a fixed number only), so
// requiresSave is omitted — the DC is stated in the description text.
// The other 9 maneuvers stay pure description-only pool entries (opposed
// checks, cross-entity effects, or multi-target math with no engine hook).
function maneuver(
  id: string, name: string, description: string,
  actionType: 'free' | 'reaction' | 'bonus_action',
  abilityEffects: Feature['abilityEffects'] = [],
): Feature {
  return {
    id, name, description,
    source: { kind: 'subclass', refId: 'battle_master' },
    level: null, effects: [], actions: [], choices: [], passive: false,
    activation: {
      actionType, resourceCost: { resourceId: 'superiority_dice', quantity: 1 },
      range: '5 feet', target: 'single', requiresSave: null,
    },
    abilityEffects,
  };
}
function flavorManeuver(id: string, name: string, description: string): Feature {
  return {
    id, name, description,
    source: { kind: 'subclass', refId: 'battle_master' },
    level: null, effects: [], actions: [], choices: [], passive: true,
  };
}

const MANEUVER_POOL: ChoiceOption[] = [
  { id: 'trip_attack', label: 'Trip Attack', value: maneuver(
    'maneuver_trip_attack', 'Trip Attack',
    'On a hit, add a superiority die to the damage roll. The target must succeed on a Strength saving throw (DC 8 + proficiency bonus + STR or DEX modifier) or be knocked prone.',
    'free', [{ type: 'apply_condition', conditionId: 'prone', duration: { unit: 'rounds', remaining: 1 } }],
  ) },
  { id: 'menacing_attack', label: 'Menacing Attack', value: maneuver(
    'maneuver_menacing_attack', 'Menacing Attack',
    'On a hit, add a superiority die to the damage roll. The target must succeed on a Wisdom saving throw (DC 8 + proficiency bonus + STR or DEX modifier) or be frightened of you until the end of your next turn.',
    'free', [{ type: 'apply_condition', conditionId: 'frightened', duration: { unit: 'rounds', remaining: 1 } }],
  ) },
  { id: 'disarming_attack', label: 'Disarming Attack', value: maneuver(
    'maneuver_disarming_attack', 'Disarming Attack',
    'On a hit, add a superiority die to the damage roll. The target must succeed on a Strength saving throw (DC 8 + proficiency bonus + STR or DEX modifier) or drop the item of your choice that it is holding.',
    'free',
  ) },
  { id: 'precision_attack', label: 'Precision Attack', value: maneuver(
    'maneuver_precision_attack', 'Precision Attack',
    'When you make a weapon attack roll, you can add a superiority die to the roll, either before or after making it, to increase your chance of hitting.',
    'free',
  ) },
  { id: 'pushing_attack', label: 'Pushing Attack', value: maneuver(
    'maneuver_pushing_attack', 'Pushing Attack',
    'On a hit, add a superiority die to the damage roll. If the target is Large or smaller, it must make a Strength saving throw (DC 8 + proficiency bonus + STR or DEX modifier) or be pushed up to 15 feet away.',
    'free',
  ) },
  { id: 'riposte', label: 'Riposte', value: maneuver(
    'maneuver_riposte', 'Riposte',
    'When a creature misses you with a melee attack, you can use your reaction to make a melee weapon attack against it. If you hit, add a superiority die to the damage roll.',
    'reaction',
  ) },
  { id: 'rally', label: 'Rally', value: maneuver(
    'maneuver_rally', 'Rally',
    'On your turn, use a bonus action and expend one superiority die to bolster an ally\'s resolve. The chosen ally gains temporary hit points equal to the superiority die roll + your Charisma modifier.',
    'bonus_action', [{ type: 'heal', dice: '1d8' }],
  ) },
  { id: 'commanders_strike', label: "Commander's Strike", value: flavorManeuver(
    'maneuver_commanders_strike', "Commander's Strike",
    'Forgo one of your attacks to direct an ally to strike, adding a superiority die to their damage. No hook exists for delegating an attack to another creature — track manually.',
  ) },
  { id: 'distracting_strike', label: 'Distracting Strike', value: flavorManeuver(
    'maneuver_distracting_strike', 'Distracting Strike',
    'On a hit, add a superiority die to the damage roll. Choose an ally; that ally has advantage on its next attack roll against the target. No hook for granting advantage on another creature\'s future roll — track manually.',
  ) },
  { id: 'goading_attack', label: 'Goading Attack', value: flavorManeuver(
    'maneuver_goading_attack', 'Goading Attack',
    'On a hit, add a superiority die to the damage roll. The target must make a Wisdom save or have disadvantage on attacks against anyone but you until the end of your next turn. No cross-entity disadvantage hook — track manually.',
  ) },
  { id: 'feinting_attack', label: 'Feinting Attack', value: flavorManeuver(
    'maneuver_feinting_attack', 'Feinting Attack',
    'You have advantage on your next attack against a creature this turn; if it hits, add a superiority die to the damage. No hook for a self-targeted future-attack advantage — track manually.',
  ) },
  { id: 'evasive_footwork', label: 'Evasive Footwork', value: flavorManeuver(
    'maneuver_evasive_footwork', 'Evasive Footwork',
    'While you move, add a superiority die to your AC until you stop moving. No movement-tracking hook — track manually.',
  ) },
  { id: 'lunging_attack', label: 'Lunging Attack', value: flavorManeuver(
    'maneuver_lunging_attack', 'Lunging Attack',
    'Extend your reach by 5 feet for one melee attack; on a hit, add a superiority die to the damage. No reach-extension hook — track manually.',
  ) },
  { id: 'maneuvering_attack', label: 'Maneuvering Attack', value: flavorManeuver(
    'maneuver_maneuvering_attack', 'Maneuvering Attack',
    'On a hit, add a superiority die to the damage roll; an ally can then use its reaction to move up to half its speed without provoking. No cross-entity movement hook — track manually.',
  ) },
  { id: 'sweeping_attack', label: 'Sweeping Attack', value: flavorManeuver(
    'maneuver_sweeping_attack', 'Sweeping Attack',
    'On a hit, you can expend a superiority die to deal its damage to a second creature within 5 feet of the first, if the attack would also hit it. No multi-target attack resolution — track manually.',
  ) },
  { id: 'parry', label: 'Parry', value: flavorManeuver(
    'maneuver_parry', 'Parry',
    'When you take damage from an attacking creature, use your reaction and expend a superiority die to reduce the damage by the die roll + your Dexterity modifier. No incoming-damage-reduction hook — track manually.',
  ) },
];

// ── Champion ──────────────────────────────────────────────────────────────────

export const championProgression: SubclassProgression = {
  classId: 'fighter',
  name: 'Champion',
  srd: true,
  entries: [
    {
      level: 3, hpDie: 10, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'improved_critical', name: 'Improved Critical', description: 'Your weapon attacks score a critical hit on a roll of 19 or 20.', source: { kind: 'subclass', refId: 'champion' }, level: 3, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    {
      level: 7, hpDie: 10, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'remarkable_athlete', name: 'Remarkable Athlete', description: 'Add half your proficiency bonus (rounded up) to any STR, DEX, or CON check that doesn\'t already use your proficiency bonus. Your running long jump distance increases by your STR modifier.', source: { kind: 'subclass', refId: 'champion' }, level: 7, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    {
      level: 10, hpDie: 10, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'additional_fighting_style', name: 'Additional Fighting Style', description: 'You can choose a second option from the Fighting Style class feature.', source: { kind: 'subclass', refId: 'champion' }, level: 10, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    {
      level: 15, hpDie: 10, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'superior_critical', name: 'Superior Critical', description: 'Your weapon attacks score a critical hit on a roll of 18–20.', source: { kind: 'subclass', refId: 'champion' }, level: 15, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    {
      level: 18, hpDie: 10, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'survivor', name: 'Survivor', description: 'At the start of each of your turns, you regain HP equal to 5 + your CON modifier if you have no more than half your HP remaining and you aren\'t at 0 HP.', source: { kind: 'subclass', refId: 'champion' }, level: 18, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
  ],
};

// ── Battle Master ─────────────────────────────────────────────────────────────

export const battleMasterProgression: SubclassProgression = {
  classId: 'fighter',
  name: 'Battle Master',
  srd: false,
  entries: [
    {
      level: 3, hpDie: 10,
      choices: [{
        id: 'battle_master_maneuvers_3', prompt: 'Choose 3 maneuvers. You know 3 maneuvers of your choice.',
        kind: 'feature_pool', count: 3, pool: MANEUVER_POOL, grants: [], required: true, resolved: false,
      }],
      grants: [
        { kind: 'feature', value: { id: 'combat_superiority', name: 'Combat Superiority', description: 'You learn maneuvers that are fueled by special dice called superiority dice (d8, 4 dice). You regain all expended superiority dice after a short or long rest.', source: { kind: 'subclass', refId: 'battle_master' }, level: 3, effects: [], actions: [], choices: [], passive: true } },
        { kind: 'resource', value: { resourceId: 'superiority_dice', name: 'Superiority Dice', maximum: 4, recharge: 'short_rest' } },
        { kind: 'feature', value: { id: 'student_of_war', name: 'Student of War', description: 'You gain proficiency with one type of artisan\'s tools of your choice.', source: { kind: 'subclass', refId: 'battle_master' }, level: 3, effects: [], actions: [], choices: [], passive: true } },
        { kind: 'feature', value: { id: 'know_your_enemy', name: 'Know Your Enemy', description: 'If you spend at least 1 minute observing or interacting with another creature, the DM tells you if that creature is superior to you, inferior to you, or roughly equal in STR, DEX, CON, AC, current HP, total class levels, or fighter class levels.', source: { kind: 'subclass', refId: 'battle_master' }, level: 3, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    {
      level: 7, hpDie: 10,
      choices: [{
        id: 'battle_master_maneuvers_7', prompt: 'Choose 2 more maneuvers (5 known total).',
        kind: 'feature_pool', count: 2, pool: MANEUVER_POOL, grants: [], required: true, resolved: false,
      }],
      grants: [
        { kind: 'resource_upgrade', value: { resourceId: 'superiority_dice', newMaximum: 5 } },
      ],
    },
    {
      level: 10, hpDie: 10, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'improved_combat_superiority_d10', name: 'Improved Combat Superiority', description: 'Your superiority dice become d10s.', source: { kind: 'subclass', refId: 'battle_master' }, level: 10, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    {
      level: 15, hpDie: 10,
      choices: [{
        id: 'battle_master_maneuvers_15', prompt: 'Choose 2 more maneuvers (7 known total).',
        kind: 'feature_pool', count: 2, pool: MANEUVER_POOL, grants: [], required: true, resolved: false,
      }],
      grants: [
        { kind: 'resource_upgrade', value: { resourceId: 'superiority_dice', newMaximum: 6 } },
      ],
    },
    {
      level: 18, hpDie: 10, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'improved_combat_superiority_d12', name: 'Improved Combat Superiority', description: 'Your superiority dice become d12s.', source: { kind: 'subclass', refId: 'battle_master' }, level: 18, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
  ],
};

export const FIGHTER_SUBCLASSES: SubclassProgression[] = [
  championProgression,
  battleMasterProgression,
];
