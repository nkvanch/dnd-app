// ============================================================================
// FILE: src/content/subclasses/ranger.ts
// Ranger subclasses: Hunter, Beast Master
// ============================================================================
import { ClassProgression, ChoiceOption, Feature } from '../../engine/types';

export type SubclassProgression = ClassProgression & { name: string };

// ── Hunter's four sub-choices ────────────────────────────────────────────────
// Resolved via applyPoolChoiceToEntity (leveling.ts) — same bypass mechanism
// as Battle Master's maneuvers, since resolveChoice can't give different
// pool options different outcomes.
function hunterFeature(
  id: string, name: string, description: string,
  activation?: Feature['activation'], abilityEffects?: Feature['abilityEffects'],
  effects: Feature['effects'] = [],
): Feature {
  return {
    id, name, description, source: { kind: 'subclass', refId: 'hunter' },
    level: null, actions: [], choices: [], passive: !activation, effects,
    activation, abilityEffects,
  };
}

const HUNTERS_PREY_POOL: ChoiceOption[] = [
  { id: 'colossus_slayer', label: 'Colossus Slayer', value: hunterFeature(
    'colossus_slayer', 'Colossus Slayer',
    'Once per turn, when you hit a creature that is below its hit point maximum, deal an extra 1d8 damage.',
    { actionType: 'free', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
    [{ type: 'damage', dice: '1d8', damageType: 'weapon' }],
  ) },
  { id: 'giant_killer', label: 'Giant Killer', value: hunterFeature(
    'giant_killer', 'Giant Killer',
    'When a Large or larger creature within 5 feet of you misses you with an attack, use your reaction to make a melee weapon attack against it.',
    { actionType: 'reaction', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
  ) },
  { id: 'horde_breaker', label: 'Horde Breaker', value: hunterFeature(
    'horde_breaker', 'Horde Breaker',
    'Once on each of your turns when you make a weapon attack, you can make another weapon attack against a different creature within 5 feet of the original target and within range of your weapon.',
    { actionType: 'free', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
  ) },
];

const DEFENSIVE_TACTICS_POOL: ChoiceOption[] = [
  { id: 'steel_will', label: 'Steel Will', value: hunterFeature(
    'steel_will', 'Steel Will', 'You have advantage on saving throws against being frightened.',
    undefined, undefined,
    [{ type: 'stat_modifier', target: 'saving throws against being frightened', operation: 'advantage', value: null, condition: null }],
  ) },
  { id: 'escape_the_horde', label: 'Escape the Horde', value: hunterFeature(
    'escape_the_horde', 'Escape the Horde',
    'Opportunity attacks against you are made with disadvantage. No opportunity-attack-suppression mechanism exists — resolve manually.',
  ) },
  { id: 'multiattack_defense', label: 'Multiattack Defense', value: hunterFeature(
    'multiattack_defense', 'Multiattack Defense',
    'When a creature hits you with an attack, you gain a +4 bonus to AC against all subsequent attacks made by that creature for the rest of the turn. No per-turn AC-swing trigger exists — resolve manually.',
  ) },
];

const MULTIATTACK_HUNTER_POOL: ChoiceOption[] = [
  { id: 'volley', label: 'Volley', value: hunterFeature(
    'volley', 'Volley',
    'You can make a ranged attack against any number of creatures within 10 feet of a point you can see within your weapon\'s range. No multi-target attack resolution exists — resolve manually.',
  ) },
  { id: 'whirlwind_attack', label: 'Whirlwind Attack', value: hunterFeature(
    'whirlwind_attack', 'Whirlwind Attack',
    'You can make a melee attack against any number of creatures within 5 feet of you, with a separate attack roll for each target. No multi-target attack resolution exists — resolve manually.',
  ) },
];

const SUPERIOR_HUNTERS_DEFENSE_POOL: ChoiceOption[] = [
  { id: 'evasion_hunter', label: 'Evasion', value: hunterFeature(
    'evasion_hunter', 'Evasion',
    'When subjected to an effect that lets you make a Dexterity saving throw to take only half damage, you instead take no damage on a success and half on a failure.',
    { actionType: 'reaction', resourceCost: null, range: 'self', target: 'self', requiresSave: null },
  ) },
  { id: 'stand_against_the_tide', label: 'Stand Against the Tide', value: hunterFeature(
    'stand_against_the_tide', 'Stand Against the Tide',
    'When a hostile creature misses you with a melee attack, you can use your reaction to force it to repeat the same attack against another creature (other than itself) of your choice.',
    { actionType: 'reaction', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
  ) },
  { id: 'uncanny_dodge_hunter', label: 'Uncanny Dodge', value: hunterFeature(
    'uncanny_dodge_hunter', 'Uncanny Dodge',
    'When an attacker you can see hits you with an attack, use your reaction to halve the attack\'s damage against you.',
    { actionType: 'reaction', resourceCost: null, range: 'self', target: 'self', requiresSave: null },
  ) },
];

export const hunterProgression: SubclassProgression = {
  classId: 'ranger', name: 'Hunter', srd: true,
  entries: [
    { level: 3, hpDie: 10,
      choices: [{ id: 'hunters_prey_3', prompt: "Choose your Hunter's Prey.", kind: 'feature_pool', count: 1, pool: HUNTERS_PREY_POOL, grants: [], required: true, resolved: false }],
      grants: [] },
    { level: 7, hpDie: 10,
      choices: [{ id: 'defensive_tactics_7', prompt: 'Choose your Defensive Tactics.', kind: 'feature_pool', count: 1, pool: DEFENSIVE_TACTICS_POOL, grants: [], required: true, resolved: false }],
      grants: [] },
    { level: 11, hpDie: 10,
      choices: [{ id: 'multiattack_hunter_11', prompt: 'Choose your Multiattack style.', kind: 'feature_pool', count: 1, pool: MULTIATTACK_HUNTER_POOL, grants: [], required: true, resolved: false }],
      grants: [] },
    { level: 15, hpDie: 10,
      choices: [{ id: 'superior_hunters_defense_15', prompt: "Choose your Superior Hunter's Defense.", kind: 'feature_pool', count: 1, pool: SUPERIOR_HUNTERS_DEFENSE_POOL, grants: [], required: true, resolved: false }],
      grants: [] },
  ],
};

export const beastMasterProgression: SubclassProgression = {
  classId: 'ranger', name: 'Beast Master', srd: false,
  entries: [
    { level: 3, hpDie: 10, choices: [], grants: [{ kind: 'feature', value: { id: 'rangers_companion', name: "Ranger's Companion", description: 'Choose a beast of CR 1/4 or lower. It obeys your commands and uses your proficiency bonus for attack/damage. It acts on your initiative.', source: { kind: 'subclass', refId: 'beast_master' }, level: 3, effects: [], actions: [], choices: [], passive: true } }] },
    { level: 7, hpDie: 10, choices: [], grants: [{ kind: 'feature', value: { id: 'exceptional_training', name: 'Exceptional Training', description: 'Your companion can use Dash, Disengage, Dodge, or Help on its turn as a bonus action. Its attacks count as magical.', source: { kind: 'subclass', refId: 'beast_master' }, level: 7, effects: [], actions: [], choices: [], passive: true } }] },
    { level: 11, hpDie: 10, choices: [], grants: [{ kind: 'feature', value: { id: 'bestial_fury', name: 'Bestial Fury', description: 'Your companion can make two attacks when you command it to attack.', source: { kind: 'subclass', refId: 'beast_master' }, level: 11, effects: [], actions: [], choices: [], passive: true } }] },
    { level: 15, hpDie: 10, choices: [], grants: [{ kind: 'feature', value: { id: 'share_spells', name: 'Share Spells', description: 'When you cast a spell targeting yourself, you can also affect your companion if within 30 feet.', source: { kind: 'subclass', refId: 'beast_master' }, level: 15, effects: [], actions: [], choices: [], passive: true } }] },
  ],
};

export const RANGER_SUBCLASSES: SubclassProgression[] = [hunterProgression, beastMasterProgression];
