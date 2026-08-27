// ============================================================================
// FILE: src/content/subclasses/fighter.ts
// Fighter subclasses: Battle Master, Champion
// ============================================================================
import { ClassProgression, ChoiceOption, Feature, Grant } from '../../engine/types';
import { THIRD_CASTER_SLOTS } from '../classes/spellSlotTables';

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

// ── Arcane Archer ─────────────────────────────────────────────────────────────
// Arcane Shot save DC (8+prof+INT) has the same missing-formula-slot issue
// documented above for maneuvers — omitted from requiresSave, stated in text.

function arcaneShot(
  id: string, name: string, description: string,
  abilityEffects: Feature['abilityEffects'] = [],
): Feature {
  return {
    id, name, description,
    source: { kind: 'subclass', refId: 'arcane_archer' },
    level: null, effects: [], actions: [], choices: [], passive: false,
    activation: { actionType: 'free', resourceCost: { resourceId: 'arcane_shot_pool', quantity: 1 }, range: '150 feet', target: 'single', requiresSave: null },
    abilityEffects,
  };
}

const ARCANE_SHOT_POOL: ChoiceOption[] = [
  { id: 'banishing_arrow', label: 'Banishing Arrow', value: arcaneShot('shot_banishing', 'Banishing Arrow', 'The target makes a CHA save or is banished to a harmless spot in the Feywild until the end of its next turn (speed 0, incapacitated there). Deals an extra 2d6 force damage from level 18.') },
  { id: 'beguiling_arrow', label: 'Beguiling Arrow', value: arcaneShot('shot_beguiling', 'Beguiling Arrow', 'On a hit, deal 2d6 psychic damage (4d6 at level 18); the target makes a WIS save or is charmed by an ally you choose within 30 feet until the start of your next turn.', [{ type: 'damage', dice: '2d6', damageType: 'psychic' }]) },
  { id: 'bursting_arrow', label: 'Bursting Arrow', value: arcaneShot('shot_bursting', 'Bursting Arrow', 'On a hit, the target and everything within 10 feet of it take 2d6 force damage (4d6 at level 18).', [{ type: 'damage', dice: '2d6', damageType: 'force' }]) },
  { id: 'enfeebling_arrow', label: 'Enfeebling Arrow', value: arcaneShot('shot_enfeebling', 'Enfeebling Arrow', 'On a hit, deal 2d6 necrotic damage (4d6 at level 18); the target makes a CON save or its weapon damage is halved until the start of your next turn.', [{ type: 'damage', dice: '2d6', damageType: 'necrotic' }]) },
  { id: 'grasping_arrow', label: 'Grasping Arrow', value: arcaneShot('shot_grasping', 'Grasping Arrow', 'On a hit, deal 2d6 poison damage (4d6 at level 18); the target\'s speed is reduced by 10 feet and it takes 2d6 slashing damage the first time it moves at least 1 foot on a turn, until the brambles are removed (STR (Athletics) vs. your Arcane Shot DC) or 1 minute passes.', [{ type: 'damage', dice: '2d6', damageType: 'poison' }]) },
  { id: 'piercing_arrow', label: 'Piercing Arrow', value: arcaneShot('shot_piercing', 'Piercing Arrow', 'No attack roll — fire a 1-foot-wide, 30-foot line ignoring cover and objects. Each creature in the line makes a DEX save, taking normal arrow damage plus 1d6 piercing (2d6 at level 18) on a failure, half on a success.', [{ type: 'damage', dice: '1d6', damageType: 'piercing', saveOnSuccess: 'half' }]) },
  { id: 'seeking_arrow', label: 'Seeking Arrow', value: arcaneShot('shot_seeking', 'Seeking Arrow', 'No attack roll — target a creature you\'ve seen in the last minute; the arrow curves around corners and partial cover to find it. DEX save; on a failure the target takes normal arrow damage plus 1d6 force (2d6 at level 18) and you learn its location, half damage and no location on a success.', [{ type: 'damage', dice: '1d6', damageType: 'force', saveOnSuccess: 'half' }]) },
  { id: 'shadow_arrow', label: 'Shadow Arrow', value: arcaneShot('shot_shadow', 'Shadow Arrow', 'On a hit, deal 2d6 psychic damage (4d6 at level 18); the target makes a WIS save or can\'t see past 5 feet until the start of your next turn.', [{ type: 'damage', dice: '2d6', damageType: 'psychic' }]) },
];

export const arcaneArcherProgression: SubclassProgression = {
  classId: 'fighter', name: 'Arcane Archer', srd: false,
  entries: [
    {
      level: 3, hpDie: 10,
      choices: [{
        id: 'arcane_archer_lore', prompt: 'Choose Arcana or Nature proficiency, and Prestidigitation or Druidcraft.',
        kind: 'skill', count: 1, pool: [
          { id: 'arcana', label: 'Arcana', value: 'arcana' },
          { id: 'nature', label: 'Nature', value: 'nature' },
        ], grants: [], required: true, resolved: false,
      }, {
        id: 'arcane_shot_options_3', prompt: 'Choose 2 Arcane Shot options.',
        kind: 'feature_pool', count: 2, pool: ARCANE_SHOT_POOL, grants: [], required: true, resolved: false,
      }],
      grants: [
        { kind: 'resource', value: { resourceId: 'arcane_shot_pool', name: 'Arcane Shot', maximum: 2, recharge: 'short_rest' } },
        { kind: 'feature', value: { id: 'arcane_shot', name: 'Arcane Shot', description: 'Once per turn when you fire an arrow from a shortbow or longbow as part of the Attack action, apply one of your known Arcane Shot options to it. You gain more options at levels 7, 10, 15, and 18, and each option improves at level 18.', source: { kind: 'subclass', refId: 'arcane_archer' }, level: 3, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    {
      level: 7, hpDie: 10,
      choices: [{ id: 'arcane_shot_options_7', prompt: 'Choose 1 more Arcane Shot option.', kind: 'feature_pool', count: 1, pool: ARCANE_SHOT_POOL, grants: [], required: true, resolved: false }],
      grants: [
        { kind: 'feature', value: { id: 'magic_arrow', name: 'Magic Arrow', description: 'Any nonmagical arrow you fire from a shortbow or longbow counts as magical for overcoming resistance and immunity to nonmagical attacks, until it hits or misses.', source: { kind: 'subclass', refId: 'arcane_archer' }, level: 7, effects: [], actions: [], choices: [], passive: true } },
        { kind: 'feature', value: { id: 'curving_shot', name: 'Curving Shot', description: 'When a magic arrow attack misses, use a bonus action to reroll the attack against a different target within 60 feet of the original.', source: { kind: 'subclass', refId: 'arcane_archer' }, level: 7, effects: [], actions: [], choices: [], passive: false } },
      ],
    },
    {
      level: 10, hpDie: 10,
      choices: [{ id: 'arcane_shot_options_10', prompt: 'Choose 1 more Arcane Shot option.', kind: 'feature_pool', count: 1, pool: ARCANE_SHOT_POOL, grants: [], required: true, resolved: false }],
      grants: [],
    },
    {
      level: 15, hpDie: 10,
      choices: [{ id: 'arcane_shot_options_15', prompt: 'Choose 1 more Arcane Shot option.', kind: 'feature_pool', count: 1, pool: ARCANE_SHOT_POOL, grants: [], required: true, resolved: false }],
      grants: [
        { kind: 'feature', value: { id: 'ever_ready_shot', name: 'Ever-Ready Shot', description: 'When you roll initiative and have no Arcane Shot uses remaining, you regain one use.', source: { kind: 'subclass', refId: 'arcane_archer' }, level: 15, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    {
      level: 18, hpDie: 10,
      choices: [{ id: 'arcane_shot_options_18', prompt: 'Choose 1 more Arcane Shot option.', kind: 'feature_pool', count: 1, pool: ARCANE_SHOT_POOL, grants: [], required: true, resolved: false }],
      grants: [],
    },
  ],
};

// ── Banneret (Purple Dragon Knight) ───────────────────────────────────────────
// Every feature here modifies another fighter base-class feature (Second
// Wind, Action Surge, Indomitable) — there's no cross-feature trigger hook
// in the engine, so these stay description-only active/passive notes.

export const bannaretProgression: SubclassProgression = {
  classId: 'fighter', name: 'Banneret', srd: false,
  entries: [
    { level: 3, hpDie: 10, choices: [], grants: [
      { kind: 'feature', value: { id: 'rallying_cry', name: 'Rallying Cry', description: 'When you use Second Wind, up to three allies within 60 feet who can see or hear you each regain HP equal to your fighter level.', source: { kind: 'subclass', refId: 'banneret' }, level: 3, effects: [], actions: [], choices: [], passive: false } },
    ] },
    { level: 7, hpDie: 10, choices: [], grants: [
      { kind: 'feature', value: { id: 'royal_envoy', name: 'Royal Envoy', description: 'Gain Persuasion proficiency (or, if already proficient, one of Animal Handling/Insight/Intimidation/Performance). Your proficiency bonus is doubled on Persuasion checks.', source: { kind: 'subclass', refId: 'banneret' }, level: 7, effects: [
        { type: 'grant_proficiency', target: 'skill:persuasion', operation: 'add', value: null, condition: null },
      ], actions: [], choices: [], passive: true } },
    ] },
    { level: 10, hpDie: 10, choices: [], grants: [
      { kind: 'feature', value: { id: 'inspiring_surge', name: 'Inspiring Surge', description: 'When you use Action Surge, one ally within 60 feet who can see or hear you can immediately make one weapon attack with its reaction (two allies from level 18).', source: { kind: 'subclass', refId: 'banneret' }, level: 10, effects: [], actions: [], choices: [], passive: false } },
    ] },
    { level: 15, hpDie: 10, choices: [], grants: [
      { kind: 'feature', value: { id: 'bulwark', name: 'Bulwark', description: 'When you use Indomitable to reroll an INT, WIS, or CHA save, an ally within 60 feet who failed the same save and can see or hear you can also reroll it and must use the new result.', source: { kind: 'subclass', refId: 'banneret' }, level: 15, effects: [], actions: [], choices: [], passive: false } },
    ] },
  ],
};

// ── Cavalier ───────────────────────────────────────────────────────────────────

export const cavalierProgression: SubclassProgression = {
  classId: 'fighter', name: 'Cavalier', srd: false,
  entries: [
    { level: 3, hpDie: 10, choices: [], grants: [
      { kind: 'feature', value: { id: 'born_to_the_saddle', name: 'Born to the Saddle', description: 'Advantage on saves to avoid falling off your mount; land on your feet if you fall 10 feet or less off it (unless incapacitated). Mounting or dismounting costs only 5 feet of movement.', source: { kind: 'subclass', refId: 'cavalier' }, level: 3, effects: [], actions: [], choices: [], passive: true } },
      { kind: 'resource', value: { resourceId: 'unwavering_mark_pool', name: 'Unwavering Mark', maximum: 1, recharge: 'long_rest' } },
      { kind: 'feature', value: { id: 'unwavering_mark', name: 'Unwavering Mark', description: 'When you hit a creature with a melee attack, mark it until the end of your next turn. While within 5 feet of you, the marked creature has disadvantage on attacks not against you; if it damages someone else, you can make a special melee attack against it as a bonus action on your next turn (advantage, +half your fighter level damage on a hit). Usable a number of times equal to your STR modifier (min 1) per long rest.', source: { kind: 'subclass', refId: 'cavalier' }, level: 3, effects: [], actions: [], choices: [], passive: false,
        activation: { actionType: 'bonus_action', resourceCost: { resourceId: 'unwavering_mark_pool', quantity: 1 }, range: '5 feet', target: 'single', requiresSave: null },
        abilityEffects: [],
      } },
    ] },
    { level: 7, hpDie: 10, choices: [], grants: [
      { kind: 'feature', value: { id: 'warding_maneuver', name: 'Warding Maneuver', description: 'As a reaction when you or a creature within 5 feet is hit by an attack (while you wield a melee weapon or shield), roll 1d8 and add it to the target\'s AC against that attack — if it still hits, the target has resistance to the damage. Usable a number of times equal to your CON modifier (min 1) per long rest.', source: { kind: 'subclass', refId: 'cavalier' }, level: 7, effects: [], actions: [], choices: [], passive: false,
        activation: { actionType: 'reaction', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
        abilityEffects: [],
      } },
    ] },
    { level: 10, hpDie: 10, choices: [], grants: [
      { kind: 'feature', value: { id: 'hold_the_line', name: 'Hold the Line', description: 'Creatures provoke an opportunity attack from you when they move 5+ feet while within your reach; hitting with such an attack reduces the target\'s speed to 0 until the end of the current turn.', source: { kind: 'subclass', refId: 'cavalier' }, level: 10, effects: [], actions: [], choices: [], passive: true } },
    ] },
    { level: 15, hpDie: 10, choices: [], grants: [
      { kind: 'feature', value: { id: 'ferocious_charger', name: 'Ferocious Charger', description: 'If you move at least 10 feet in a straight line before hitting a creature, it makes a STR save (DC 8 + proficiency bonus + STR modifier) or is knocked prone. Once per turn.', source: { kind: 'subclass', refId: 'cavalier' }, level: 15, effects: [], actions: [], choices: [], passive: false } },
    ] },
    { level: 18, hpDie: 10, choices: [], grants: [
      { kind: 'feature', value: { id: 'vigilant_defender', name: 'Vigilant Defender', description: 'You gain a special reaction usable once on every other creature\'s turn (not your own), only to make an opportunity attack — separate from your normal reaction.', source: { kind: 'subclass', refId: 'cavalier' }, level: 18, effects: [], actions: [], choices: [], passive: true } },
    ] },
  ],
};

// ── Echo Knight ────────────────────────────────────────────────────────────────

export const echoKnightProgression: SubclassProgression = {
  classId: 'fighter', name: 'Echo Knight', srd: false,
  entries: [
    { level: 3, hpDie: 10, choices: [], grants: [
      { kind: 'resource', value: { resourceId: 'unleash_incarnation_pool', name: 'Unleash Incarnation', maximum: 1, recharge: 'long_rest' } },
      { kind: 'feature', value: { id: 'manifest_echo', name: 'Manifest Echo', description: 'As a bonus action, manifest a translucent echo of yourself in an unoccupied space within 15 feet (AC 14 + proficiency bonus, 1 HP, immune to all conditions, uses your save bonuses). It moves up to 30 feet on your turn at no action cost and is destroyed if ever more than 30 feet from you at turn\'s end. You can swap places with it (bonus action, costs 15 feet of movement), attack from its space instead of yours, and make an opportunity attack from its space as a reaction when a creature moves away from it.', source: { kind: 'subclass', refId: 'echo_knight' }, level: 3, effects: [], actions: [], choices: [], passive: false } },
      { kind: 'feature', value: { id: 'unleash_incarnation', name: 'Unleash Incarnation', description: 'When you take the Attack action, make one additional melee attack from your echo\'s position. Usable a number of times equal to your CON modifier (min 1) per long rest.', source: { kind: 'subclass', refId: 'echo_knight' }, level: 3, effects: [], actions: [], choices: [], passive: false,
        activation: { actionType: 'free', resourceCost: { resourceId: 'unleash_incarnation_pool', quantity: 1 }, range: '15 feet', target: 'single', requiresSave: null },
        abilityEffects: [],
      } },
    ] },
    { level: 7, hpDie: 10, choices: [], grants: [
      { kind: 'feature', value: { id: 'echo_avatar', name: 'Echo Avatar', description: 'As an action, transfer your senses into your echo (you\'re deafened and blinded meanwhile) for up to 10 minutes; while used this way, the echo can range up to 1,000 feet from you without being destroyed.', source: { kind: 'subclass', refId: 'echo_knight' }, level: 7, effects: [], actions: [], choices: [], passive: false } },
    ] },
    { level: 10, hpDie: 10, choices: [], grants: [
      { kind: 'feature', value: { id: 'shadow_martyr', name: 'Shadow Martyr', description: 'As a reaction before an attack roll against another creature you can see resolves, teleport your echo into the attack\'s path so the roll targets the echo instead. Usable once per short or long rest.', source: { kind: 'subclass', refId: 'echo_knight' }, level: 10, effects: [], actions: [], choices: [], passive: false,
        activation: { actionType: 'reaction', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
        abilityEffects: [],
      } },
    ] },
    { level: 15, hpDie: 10, choices: [], grants: [
      { kind: 'feature', value: { id: 'reclaim_potential', name: 'Reclaim Potential', description: 'When your echo is destroyed by damage, gain 2d6 + CON modifier temporary HP (if you have none already). Usable a number of times equal to your CON modifier (min 1) per long rest.', source: { kind: 'subclass', refId: 'echo_knight' }, level: 15, effects: [], actions: [], choices: [], passive: false } },
    ] },
    { level: 18, hpDie: 10, choices: [], grants: [
      { kind: 'feature', value: { id: 'legion_of_one', name: 'Legion of One', description: 'Manifest Echo can now create two coexisting echoes (creating a third destroys the first two); either can be used for any of your echo abilities. When you roll initiative with no Unleash Incarnation uses left, you regain one.', source: { kind: 'subclass', refId: 'echo_knight' }, level: 18, effects: [], actions: [], choices: [], passive: true } },
    ] },
  ],
};

// ── Eldritch Knight ────────────────────────────────────────────────────────────

export const eldritchKnightProgression: SubclassProgression = {
  classId: 'fighter', name: 'Eldritch Knight', srd: false,
  entries: [
    { level: 3, hpDie: 10, choices: [], grants: [
      { kind: 'init_spellcasting', value: { ability: 'int' } } as Grant,
      { kind: 'spell_slots', value: { level: 3, slotsTable: THIRD_CASTER_SLOTS } } as Grant,
      { kind: 'feature', value: { id: 'ek_spellcasting', name: 'Spellcasting', description: 'You learn two wizard cantrips (a third at level 10) and a small number of wizard spells, mostly from abjuration and evocation, using INT as your spellcasting ability.', source: { kind: 'subclass', refId: 'eldritch_knight' }, level: 3, effects: [], actions: [], choices: [], passive: true } },
      { kind: 'feature', value: { id: 'weapon_bond', name: 'Weapon Bond', description: 'After an hour-long ritual (usable during a short rest), bond up to two weapons to yourself. You can\'t be disarmed of a bonded weapon unless incapacitated, and can summon one bonded weapon to your hand as a bonus action if it\'s on the same plane.', source: { kind: 'subclass', refId: 'eldritch_knight' }, level: 3, effects: [], actions: [], choices: [], passive: false } },
    ] },
    { level: 7, hpDie: 10, choices: [], grants: [
      { kind: 'spell_slots', value: { level: 7, slotsTable: THIRD_CASTER_SLOTS } } as Grant,
      { kind: 'feature', value: { id: 'war_magic', name: 'War Magic', description: 'When you use your action to cast a cantrip, you can make one weapon attack as a bonus action.', source: { kind: 'subclass', refId: 'eldritch_knight' }, level: 7, effects: [], actions: [], choices: [], passive: true } },
    ] },
    { level: 10, hpDie: 10, choices: [], grants: [
      { kind: 'spell_slots', value: { level: 10, slotsTable: THIRD_CASTER_SLOTS } } as Grant,
      { kind: 'feature', value: { id: 'eldritch_strike', name: 'Eldritch Strike', description: 'When you hit a creature with a weapon attack, it has disadvantage on the next save it makes against a spell you cast before the end of your next turn.', source: { kind: 'subclass', refId: 'eldritch_knight' }, level: 10, effects: [], actions: [], choices: [], passive: true } },
    ] },
    { level: 13, hpDie: 10, choices: [], grants: [{ kind: 'spell_slots', value: { level: 13, slotsTable: THIRD_CASTER_SLOTS } } as Grant] },
    { level: 15, hpDie: 10, choices: [], grants: [
      { kind: 'spell_slots', value: { level: 15, slotsTable: THIRD_CASTER_SLOTS } } as Grant,
      { kind: 'feature', value: { id: 'arcane_charge', name: 'Arcane Charge', description: 'When you use Action Surge, you can teleport up to 30 feet to an unoccupied space you can see, before or after the extra action.', source: { kind: 'subclass', refId: 'eldritch_knight' }, level: 15, effects: [], actions: [], choices: [], passive: false } },
    ] },
    { level: 16, hpDie: 10, choices: [], grants: [{ kind: 'spell_slots', value: { level: 16, slotsTable: THIRD_CASTER_SLOTS } } as Grant] },
    { level: 18, hpDie: 10, choices: [], grants: [
      { kind: 'spell_slots', value: { level: 18, slotsTable: THIRD_CASTER_SLOTS } } as Grant,
      { kind: 'feature', value: { id: 'improved_war_magic', name: 'Improved War Magic', description: 'When you use your action to cast any spell (not just a cantrip), you can make one weapon attack as a bonus action.', source: { kind: 'subclass', refId: 'eldritch_knight' }, level: 18, effects: [], actions: [], choices: [], passive: true } },
    ] },
    { level: 19, hpDie: 10, choices: [], grants: [{ kind: 'spell_slots', value: { level: 19, slotsTable: THIRD_CASTER_SLOTS } } as Grant] },
    { level: 20, hpDie: 10, choices: [], grants: [{ kind: 'spell_slots', value: { level: 20, slotsTable: THIRD_CASTER_SLOTS } } as Grant] },
  ],
};

// ── Psi Warrior ────────────────────────────────────────────────────────────────

export const psiWarriorProgression: SubclassProgression = {
  classId: 'fighter', name: 'Psi Warrior', srd: false,
  entries: [
    { level: 3, hpDie: 10, choices: [], grants: [
      { kind: 'resource', value: { resourceId: 'psionic_energy_pool', name: 'Psionic Energy Dice (d6, upgrading to d8 at 5, d10 at 11, d12 at 17)', maximum: 4, recharge: 'long_rest' } },
      { kind: 'feature', value: { id: 'protective_field', name: 'Protective Field', description: 'As a reaction when you or a creature within 30 feet takes damage, expend a Psionic Energy die and reduce the damage by the roll + your INT modifier (min 1).', source: { kind: 'subclass', refId: 'psi_warrior' }, level: 3, effects: [], actions: [], choices: [], passive: false,
        activation: { actionType: 'reaction', resourceCost: { resourceId: 'psionic_energy_pool', quantity: 1 }, range: '30 feet', target: 'single', requiresSave: null },
        abilityEffects: [],
      } },
      { kind: 'feature', value: { id: 'psionic_strike', name: 'Psionic Strike', description: 'Once per turn after you hit with a weapon attack within 30 feet, expend a Psionic Energy die to deal extra force damage equal to the roll + your INT modifier.', source: { kind: 'subclass', refId: 'psi_warrior' }, level: 3, effects: [], actions: [], choices: [], passive: false,
        activation: { actionType: 'free', resourceCost: { resourceId: 'psionic_energy_pool', quantity: 1 }, range: '30 feet', target: 'single', requiresSave: null },
        abilityEffects: [{ type: 'damage', dice: '1d6', damageType: 'force' }],
      } },
      { kind: 'feature', value: { id: 'telekinetic_movement', name: 'Telekinetic Movement', description: 'As an action, move a Large or smaller loose object or a willing creature (other than yourself) within 30 feet up to 30 feet to an unoccupied space you can see. Usable once per short or long rest, or again by expending a Psionic Energy die.', source: { kind: 'subclass', refId: 'psi_warrior' }, level: 3, effects: [], actions: [], choices: [], passive: false } },
    ] },
    { level: 7, hpDie: 10, choices: [], grants: [
      { kind: 'feature', value: { id: 'psi_powered_leap', name: 'Psi-Powered Leap', description: 'As a bonus action, gain a flying speed equal to twice your walking speed until the end of the turn. Usable once per short or long rest, or again by expending a Psionic Energy die.', source: { kind: 'subclass', refId: 'psi_warrior' }, level: 7, effects: [], actions: [], choices: [], passive: false,
        activation: { actionType: 'bonus_action', resourceCost: null, range: 'self', target: 'self', requiresSave: null },
        abilityEffects: [{ type: 'grant_speed', speedType: 'fly', amount: 60, duration: { unit: 'rounds', remaining: 1 } }],
      } },
      { kind: 'feature', value: { id: 'telekinetic_thrust', name: 'Telekinetic Thrust', description: 'When you deal Psionic Strike damage, force a STR save (DC 8 + proficiency bonus + INT modifier); on a failure, knock the target prone or push it up to 10 feet.', source: { kind: 'subclass', refId: 'psi_warrior' }, level: 7, effects: [], actions: [], choices: [], passive: false } },
    ] },
    { level: 10, hpDie: 10, choices: [], grants: [
      { kind: 'feature', value: { id: 'guarded_mind', name: 'Guarded Mind', description: 'You have resistance to psychic damage. If you start your turn charmed or frightened, you can expend a Psionic Energy die to end those conditions on yourself.', source: { kind: 'subclass', refId: 'psi_warrior' }, level: 10, effects: [
        { type: 'grant_resistance', target: 'psychic', operation: 'resistance', value: null, condition: null },
      ], actions: [], choices: [], passive: true } },
    ] },
    { level: 15, hpDie: 10, choices: [], grants: [
      { kind: 'feature', value: { id: 'bulwark_of_force', name: 'Bulwark of Force', description: 'As a bonus action, grant half cover for 1 minute to creatures you choose within 30 feet (including yourself), up to a number equal to your INT modifier (min 1). Usable once per long rest, or again by expending a Psionic Energy die.', source: { kind: 'subclass', refId: 'psi_warrior' }, level: 15, effects: [], actions: [], choices: [], passive: false,
        activation: { actionType: 'bonus_action', resourceCost: null, range: '30 feet', target: 'multiple', requiresSave: null },
        abilityEffects: [],
      } },
    ] },
    { level: 18, hpDie: 10, choices: [], grants: [
      { kind: 'feature', value: { id: 'telekinetic_master', name: 'Telekinetic Master', description: 'Cast Telekinesis at will, no components, INT-based, once per long rest (or again by expending a Psionic Energy die); while concentrating you can make one weapon attack as a bonus action each turn.', source: { kind: 'subclass', refId: 'psi_warrior' }, level: 18, effects: [], actions: [], choices: [], passive: false } },
    ] },
  ],
};

// ── Rune Knight ────────────────────────────────────────────────────────────────

function rune(id: string, name: string, description: string): Feature {
  return {
    id, name, description,
    source: { kind: 'subclass', refId: 'rune_knight' },
    level: null, effects: [], actions: [], choices: [], passive: true,
  };
}

const RUNE_POOL: ChoiceOption[] = [
  { id: 'cloud_rune', label: 'Cloud Rune', value: rune('rune_cloud', 'Cloud Rune', 'Advantage on Sleight of Hand and Deception checks while worn/carried. As a reaction when you or a creature within 30 feet is hit, redirect the attack to a different creature within 30 feet using the same roll. Once per short or long rest.') },
  { id: 'fire_rune', label: 'Fire Rune', value: rune('rune_fire', 'Fire Rune', 'Double proficiency bonus on tool checks while worn/carried. On a weapon hit, invoke fiery shackles: 2d6 fire damage, STR save or restrained for 1 minute taking 2d6 fire damage each turn (save ends, repeatable each turn). Once per short or long rest.') },
  { id: 'frost_rune', label: 'Frost Rune', value: rune('rune_frost', 'Frost Rune', 'Advantage on Animal Handling and Intimidation checks while worn/carried. As a bonus action, gain +2 to STR/CON checks and saves for 10 minutes. Once per short or long rest.') },
  { id: 'stone_rune', label: 'Stone Rune', value: rune('rune_stone', 'Stone Rune', 'Advantage on Insight checks and 120-foot darkvision while worn/carried. As a reaction, force a creature within 30 feet that ended its turn there to make a WIS save or be charmed (speed 0, incapacitated) for 1 minute, repeating the save each turn. Once per short or long rest.') },
  { id: 'hill_rune', label: 'Hill Rune (level 7+)', value: rune('rune_hill', 'Hill Rune', 'Advantage on saves against poison and resistance to poison damage while worn/carried. As a bonus action, gain resistance to bludgeoning, piercing, and slashing damage for 1 minute. Once per short or long rest.') },
  { id: 'storm_rune', label: 'Storm Rune (level 7+)', value: rune('rune_storm', 'Storm Rune', 'Advantage on Arcana checks and immunity to being surprised (while not incapacitated) whie worn/carried. As a bonus action, enter a prophetic state for 1 minute — as a reaction, force advantage or disadvantage on a roll made by you or a creature within 60 feet. Once per short or long rest.') },
];

export const runeKnightProgression: SubclassProgression = {
  classId: 'fighter', name: 'Rune Knight', srd: false,
  entries: [
    { level: 3, hpDie: 10,
      choices: [{ id: 'rune_carver_3', prompt: 'Choose 2 runes.', kind: 'feature_pool', count: 2, pool: RUNE_POOL, grants: [], required: true, resolved: false }],
      grants: [
        { kind: 'proficiency', value: { tools: ['smiths_tools'], languages: ['giant'] } },
        { kind: 'feature', value: { id: 'rune_carver', name: 'Rune Carver', description: 'On a long rest, inscribe a different known rune onto each of a number of held/worn objects equal to runes known; each rune lasts until your next long rest. You may swap one known rune for another whenever you gain a level in this class.', source: { kind: 'subclass', refId: 'rune_knight' }, level: 3, effects: [], actions: [], choices: [], passive: true } },
        { kind: 'feature', value: { id: 'giants_might', name: "Giant's Might", description: 'As a bonus action, become Large (if smaller, room permitting), gain advantage on STR checks/saves, and once per turn deal an extra 1d6 damage on a weapon or unarmed hit — all for 1 minute. The bonus damage becomes 1d8 at level 10 and 1d10 at level 18. Usable a number of times equal to your proficiency bonus per long rest.', source: { kind: 'subclass', refId: 'rune_knight' }, level: 3, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'bonus_action', resourceCost: null, range: 'self', target: 'self', requiresSave: null },
          abilityEffects: [],
        } },
      ] },
    { level: 7, hpDie: 10,
      choices: [{ id: 'rune_carver_7', prompt: 'Choose 1 more rune (3 known total).', kind: 'feature_pool', count: 1, pool: RUNE_POOL, grants: [], required: true, resolved: false }],
      grants: [
        { kind: 'feature', value: { id: 'runic_shield', name: 'Runic Shield', description: 'As a reaction when a creature within 60 feet is hit by an attack roll, force the attacker to reroll the d20 and use the new result. Usable a number of times equal to your proficiency bonus per long rest.', source: { kind: 'subclass', refId: 'rune_knight' }, level: 7, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'reaction', resourceCost: null, range: '60 feet', target: 'single', requiresSave: null },
          abilityEffects: [],
        } },
      ] },
    { level: 10, hpDie: 10,
      choices: [{ id: 'rune_carver_10', prompt: 'Choose 1 more rune (4 known total).', kind: 'feature_pool', count: 1, pool: RUNE_POOL, grants: [], required: true, resolved: false }],
      grants: [
        { kind: 'feature', value: { id: 'great_stature', name: 'Great Stature', description: 'Your rune magic permanently grows you a few inches taller (roll 3d4). Giant\'s Might\'s bonus damage increases to 1d8.', source: { kind: 'subclass', refId: 'rune_knight' }, level: 10, effects: [], actions: [], choices: [], passive: true } },
      ] },
    { level: 15, hpDie: 10,
      choices: [{ id: 'rune_carver_15', prompt: 'Choose 1 more rune (5 known total).', kind: 'feature_pool', count: 1, pool: RUNE_POOL, grants: [], required: true, resolved: false }],
      grants: [
        { kind: 'feature', value: { id: 'master_of_runes', name: 'Master of Runes', description: 'You can invoke each rune-granted active ability twice instead of once between rests, and now regain all uses on a short or long rest.', source: { kind: 'subclass', refId: 'rune_knight' }, level: 15, effects: [], actions: [], choices: [], passive: true } },
      ] },
    { level: 18, hpDie: 10, choices: [], grants: [
      { kind: 'feature', value: { id: 'runic_juggernaut', name: 'Runic Juggernaut', description: 'Giant\'s Might\'s bonus damage increases to 1d10, and while it\'s active you can grow to Huge size, gaining an extra 5 feet of reach.', source: { kind: 'subclass', refId: 'rune_knight' }, level: 18, effects: [], actions: [], choices: [], passive: true } },
    ] },
  ],
};

// ── Samurai ────────────────────────────────────────────────────────────────────

export const samuraiProgression: SubclassProgression = {
  classId: 'fighter', name: 'Samurai', srd: false,
  entries: [
    { level: 3, hpDie: 10, choices: [], grants: [
      { kind: 'resource', value: { resourceId: 'fighting_spirit_pool', name: 'Fighting Spirit', maximum: 3, recharge: 'long_rest' } },
      { kind: 'feature', value: { id: 'fighting_spirit', name: 'Fighting Spirit', description: 'As a bonus action, gain advantage on all weapon attack rolls until the end of the turn, and gain 5 temporary HP (10 at level 10, 15 at level 15). Usable 3 times per long rest.', source: { kind: 'subclass', refId: 'samurai' }, level: 3, effects: [], actions: [], choices: [], passive: false,
        activation: { actionType: 'bonus_action', resourceCost: { resourceId: 'fighting_spirit_pool', quantity: 1 }, range: 'self', target: 'self', requiresSave: null },
        abilityEffects: [],
      } },
    ] },
    { level: 7, hpDie: 10, choices: [], grants: [
      { kind: 'feature', value: { id: 'elegant_courtier', name: 'Elegant Courtier', description: 'Add your WIS modifier as a bonus on Persuasion checks. Gain proficiency in WIS saves (or, if you already have it, INT or CHA saves instead).', source: { kind: 'subclass', refId: 'samurai' }, level: 7, effects: [], actions: [], choices: [], passive: true } },
    ] },
    { level: 10, hpDie: 10, choices: [], grants: [
      { kind: 'feature', value: { id: 'tireless_spirit', name: 'Tireless Spirit', description: 'When you roll initiative and have no Fighting Spirit uses left, you regain one use.', source: { kind: 'subclass', refId: 'samurai' }, level: 10, effects: [], actions: [], choices: [], passive: true } },
    ] },
    { level: 15, hpDie: 10, choices: [], grants: [
      { kind: 'feature', value: { id: 'rapid_strike', name: 'Rapid Strike', description: 'If you have advantage on an attack roll during your Attack action, you can forgo the advantage to make one additional weapon attack against the same target as part of the action. Once per turn.', source: { kind: 'subclass', refId: 'samurai' }, level: 15, effects: [], actions: [], choices: [], passive: false } },
    ] },
    { level: 18, hpDie: 10, choices: [], grants: [
      { kind: 'feature', value: { id: 'strength_before_death', name: 'Strength Before Death', description: 'When damage would drop you to 0 HP, use your reaction to instead delay falling unconscious and immediately take an extra turn (still subject to death saves and the normal 3-failure limit at 0 HP). You fall unconscious when the extra turn ends if still at 0 HP. Usable once per long rest.', source: { kind: 'subclass', refId: 'samurai' }, level: 18, effects: [], actions: [], choices: [], passive: false } },
    ] },
  ],
};

export const FIGHTER_SUBCLASSES: SubclassProgression[] = [
  championProgression,
  battleMasterProgression,
  arcaneArcherProgression,
  bannaretProgression,
  cavalierProgression,
  echoKnightProgression,
  eldritchKnightProgression,
  psiWarriorProgression,
  runeKnightProgression,
  samuraiProgression,
];
