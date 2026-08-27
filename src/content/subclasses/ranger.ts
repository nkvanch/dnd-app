// ============================================================================
// FILE: src/content/subclasses/ranger.ts
// Ranger subclasses: Hunter, Beast Master, Drakewarden, Fey Wanderer, Gloom
// Stalker, Horizon Walker, Monster Slayer, Swarmkeeper
//
// Bonus spells known: like the Paladin oath-spell gap, none of the "learn an
// extra spell at levels 3/5/9/11-13/17" tables below are wired via
// known_spells Grants. Roughly a third of the referenced spells (Mislead,
// Rope Trick, Seeming, Protection from Evil and Good, Teleportation Circle,
// Zone of Truth, Magic Circle, Web, Arcane Eye, Summon Fey, Etherealness)
// aren't in this codebase's spell library yet, and wiring only the available
// ones per subclass would produce the same kind of inconsistent per-level
// patchwork already avoided in the Paladin batch. Left fully unwired and
// disclosed instead.
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

// ── Drakewarden ──────────────────────────────────────────────────────────────
export const drakewardenProgression: SubclassProgression = {
  classId: 'ranger', name: 'Drakewarden', srd: false,
  entries: [
    { level: 3, hpDie: 10, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'draconic_gift', name: 'Draconic Gift', description: 'Learn the Thaumaturgy cantrip (a ranger spell for you) and to speak, read, and write Draconic or one other language.', source: { kind: 'subclass', refId: 'drakewarden' }, level: 3, effects: [
          { type: 'grant_spell', target: 'cantrip', operation: 'add', value: null, condition: null, cantripIds: ['thaumaturgy'] },
        ], actions: [], choices: [], passive: true } },
        { kind: 'resource', value: { resourceId: 'drake_companion_pool', name: 'Drake Companion', maximum: 1, recharge: 'long_rest' } },
        { kind: 'feature', value: { id: 'drake_companion', name: 'Drake Companion', description: 'As an action, summon your bound drake into an unoccupied space within 30 feet (AC 14 + proficiency bonus, HP 5 + 5 per ranger level, speed 40 ft., a Bite attack, and Infused Strikes adding 1d6 damage of your chosen essence type to nearby allies\' weapon hits). It acts on your initiative, defaults to Dodge unless commanded, and remains until reduced to 0 HP, resummoned, or you die. Usable once per long rest, or again by spending a 1st-level spell slot.', source: { kind: 'subclass', refId: 'drakewarden' }, level: 3, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'action', resourceCost: { resourceId: 'drake_companion_pool', quantity: 1 }, range: '30 feet', target: 'single', requiresSave: null },
          abilityEffects: [] } },
      ] },
    { level: 7, hpDie: 10, choices: [], grants: [{ kind: 'feature', value: { id: 'bond_of_fang_and_scale', name: 'Bond of Fang and Scale', description: 'While your drake is summoned, it gains a flying speed equal to its walking speed and grows to Medium size so you can ride it (it can\'t use its flying speed while ridden), its Bite deals an extra 1d6 damage of its essence type, and you gain resistance to that damage type. The essence type is chosen fresh at each summon — no fixed resistance target to wire.', source: { kind: 'subclass', refId: 'drakewarden' }, level: 7, effects: [], actions: [], choices: [], passive: true } }] },
    { level: 11, hpDie: 10, choices: [],
      grants: [
        { kind: 'resource', value: { resourceId: 'drakes_breath_pool', name: "Drake's Breath", maximum: 1, recharge: 'long_rest' } },
        { kind: 'feature', value: { id: 'drakes_breath', name: "Drake's Breath", description: 'As an action, you or your drake exhale a 30-foot cone of acid, cold, fire, lightning, or poison damage (your choice, independent of the drake\'s essence). Each creature in the cone makes a Dexterity save against your spell save DC, taking 8d6 damage (10d6 at level 15) on a failure, half on a success. Usable once per long rest, or again by spending a 3rd-level spell slot.', source: { kind: 'subclass', refId: 'drakewarden' }, level: 11, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'action', resourceCost: { resourceId: 'drakes_breath_pool', quantity: 1 }, range: '30 feet', target: 'multiple', requiresSave: { ability: 'dex', dc: 'spell_save_dc' } },
          abilityEffects: [{ type: 'damage', dice: '8d6', damageType: 'acid', saveOnSuccess: 'half' }] } },
      ] },
    { level: 15, hpDie: 10, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'perfected_bond', name: 'Perfected Bond', description: 'While your drake is summoned, its Bite deals a total of 2d6 extra essence damage, it grows to Large size and can fly while ridden, and you both gain Reflexive Resistance.', source: { kind: 'subclass', refId: 'drakewarden' }, level: 15, effects: [], actions: [], choices: [], passive: true } },
        { kind: 'feature', value: { id: 'reflexive_resistance', name: 'Reflexive Resistance', description: 'When you or your drake takes damage while within 30 feet of each other, use your reaction to give yourself or the drake resistance to that instance of damage. Usable a number of times equal to your proficiency bonus per long rest — tracked here as a single-use pool; increase its maximum to match.', source: { kind: 'subclass', refId: 'drakewarden' }, level: 15, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'reaction', resourceCost: null, range: '30 feet', target: 'self', requiresSave: null },
          abilityEffects: [] } },
      ] },
  ],
};

// ── Fey Wanderer ─────────────────────────────────────────────────────────────
export const feyWandererProgression: SubclassProgression = {
  classId: 'ranger', name: 'Fey Wanderer', srd: false,
  entries: [
    { level: 3, hpDie: 10,
      choices: [{ id: 'fey_wanderer_skill_3', prompt: 'Choose a skill proficiency: Deception, Performance, or Persuasion.', kind: 'skill', count: 1, pool: [
        { id: 'deception', label: 'Deception', value: 'deception' },
        { id: 'performance', label: 'Performance', value: 'performance' },
        { id: 'persuasion', label: 'Persuasion', value: 'persuasion' },
      ], grants: [], required: true, resolved: false }],
      grants: [
        { kind: 'feature', value: { id: 'dreadful_strikes', name: 'Dreadful Strikes', description: 'Once per turn when you hit a creature with a weapon, deal an extra 1d4 psychic damage (1d6 at level 11).', source: { kind: 'subclass', refId: 'fey_wanderer' }, level: 3, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'free', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
          abilityEffects: [{ type: 'damage', dice: '1d4', damageType: 'psychic' }] } },
        { kind: 'feature', value: { id: 'otherworldly_glamour', name: 'Otherworldly Glamour', description: 'Add your Wisdom modifier (minimum +1) to Charisma checks. No formula slot exists for a WIS-into-CHA-check bonus — apply manually.', source: { kind: 'subclass', refId: 'fey_wanderer' }, level: 3, effects: [], actions: [], choices: [], passive: true } },
      ] },
    { level: 7, hpDie: 10, choices: [], grants: [{ kind: 'feature', value: { id: 'beguiling_twist', name: 'Beguiling Twist', description: 'You have advantage on saving throws against being charmed or frightened. In addition, whenever you or a creature you can see within 120 feet succeeds on such a save, use your reaction to force a different creature within 120 feet to make a Wisdom save against your spell save DC or be charmed or frightened by you (your choice) for 1 minute, repeatable each turn.', source: { kind: 'subclass', refId: 'fey_wanderer' }, level: 7, effects: [
      { type: 'stat_modifier', target: 'saving throws against being charmed or frightened', operation: 'advantage', value: null, condition: null },
    ], actions: [], choices: [], passive: true } }] },
    { level: 11, hpDie: 10, choices: [], grants: [{ kind: 'feature', value: { id: 'fey_reinforcements', name: 'Fey Reinforcements', description: 'Learn Summon Fey (doesn\'t count against ranger spells known, castable without material components); cast it once free per long rest, optionally trading concentration for a fixed 1-minute duration. Summon Fey isn\'t in this codebase\'s spell library yet — no cast_spell hook until it\'s added.', source: { kind: 'subclass', refId: 'fey_wanderer' }, level: 11, effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'action', resourceCost: null, range: '30 feet', target: 'self', requiresSave: null },
      abilityEffects: [] } }] },
    { level: 15, hpDie: 10, choices: [],
      grants: [
        { kind: 'resource', value: { resourceId: 'misty_wanderer_pool', name: 'Misty Wanderer (scales with Wisdom modifier)', maximum: 1, recharge: 'long_rest' } },
        { kind: 'feature', value: { id: 'misty_wanderer', name: 'Misty Wanderer', description: 'Cast Misty Step without a spell slot, and bring a willing creature within 5 feet along with you. Usable a number of times equal to your Wisdom modifier (minimum once) per long rest — tracked here as a single-use pool; increase its maximum to match.', source: { kind: 'subclass', refId: 'fey_wanderer' }, level: 15, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'bonus_action', resourceCost: { resourceId: 'misty_wanderer_pool', quantity: 1 }, range: 'self', target: 'self', requiresSave: null },
          abilityEffects: [{ type: 'cast_spell', spellId: 'misty_step' }] } },
      ] },
  ],
};

// ── Gloom Stalker ────────────────────────────────────────────────────────────
export const gloomStalkerProgression: SubclassProgression = {
  classId: 'ranger', name: 'Gloom Stalker', srd: false,
  entries: [
    { level: 3, hpDie: 10, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'dread_ambusher', name: 'Dread Ambusher', description: 'Add your Wisdom modifier to initiative rolls. No formula slot exists for a WIS-based initiative bonus — apply manually.', source: { kind: 'subclass', refId: 'gloom_stalker' }, level: 3, effects: [], actions: [], choices: [], passive: true } },
        { kind: 'feature', value: { id: 'dread_ambusher_first_strike', name: 'Dread Ambusher: First Strike', description: 'At the start of your first turn of combat, your walking speed increases by 10 feet until the end of that turn, and if you take the Attack action, make one additional weapon attack; on a hit it deals an extra 1d8 damage of the weapon\'s type.', source: { kind: 'subclass', refId: 'gloom_stalker' }, level: 3, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'free', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
          abilityEffects: [{ type: 'damage', dice: '1d8', damageType: 'weapon' }] } },
        { kind: 'feature', value: { id: 'umbral_sight', name: 'Umbral Sight', description: 'Gain darkvision to 60 feet (or +30 feet if you already have it). While in darkness, you\'re invisible to any creature relying on darkvision to see you there.', source: { kind: 'subclass', refId: 'gloom_stalker' }, level: 3, effects: [
          { type: 'grant_sense', target: 'senses', operation: 'add', value: null, condition: null, senseType: 'darkvision', senseRange: 60 },
        ], actions: [], choices: [], passive: true } },
      ] },
    { level: 7, hpDie: 10, choices: [], grants: [{ kind: 'feature', value: { id: 'iron_mind', name: 'Iron Mind', description: 'Gain proficiency in Wisdom saving throws; if you already have it, gain proficiency in Intelligence or Charisma saving throws instead. No saving-throw-proficiency grant hook exists in the engine yet — apply manually.', source: { kind: 'subclass', refId: 'gloom_stalker' }, level: 7, effects: [], actions: [], choices: [], passive: true } }] },
    { level: 11, hpDie: 10, choices: [], grants: [{ kind: 'feature', value: { id: 'stalkers_flurry', name: "Stalker's Flurry", description: 'Once on each of your turns when you miss with a weapon attack, make another weapon attack as part of the same action.', source: { kind: 'subclass', refId: 'gloom_stalker' }, level: 11, effects: [], actions: [], choices: [], passive: true } }] },
    { level: 15, hpDie: 10, choices: [], grants: [{ kind: 'feature', value: { id: 'shadowy_dodge', name: 'Shadowy Dodge', description: 'Whenever a creature makes an attack roll against you without advantage, use your reaction (before knowing the result) to impose disadvantage on it.', source: { kind: 'subclass', refId: 'gloom_stalker' }, level: 15, effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'reaction', resourceCost: null, range: 'self', target: 'self', requiresSave: null },
      abilityEffects: [] } }] },
  ],
};

// ── Horizon Walker ───────────────────────────────────────────────────────────
export const horizonWalkerProgression: SubclassProgression = {
  classId: 'ranger', name: 'Horizon Walker', srd: false,
  entries: [
    { level: 3, hpDie: 10, choices: [],
      grants: [
        { kind: 'resource', value: { resourceId: 'detect_portal_pool', name: 'Detect Portal', maximum: 1, recharge: 'short_rest' } },
        { kind: 'feature', value: { id: 'detect_portal', name: 'Detect Portal', description: 'As an action, sense the distance and direction to the nearest planar portal within 1 mile. Usable once per short or long rest.', source: { kind: 'subclass', refId: 'horizon_walker' }, level: 3, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'action', resourceCost: { resourceId: 'detect_portal_pool', quantity: 1 }, range: '1 mile', target: 'self', requiresSave: null },
          abilityEffects: [] } },
        { kind: 'feature', value: { id: 'planar_warrior', name: 'Planar Warrior', description: 'As a bonus action, choose a creature within 30 feet; the next time you hit it this turn with a weapon attack, the damage becomes force damage and it takes an extra 1d8 force damage (2d8 at level 11). Unlimited uses.', source: { kind: 'subclass', refId: 'horizon_walker' }, level: 3, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'bonus_action', resourceCost: null, range: '30 feet', target: 'single', requiresSave: null },
          abilityEffects: [{ type: 'damage', dice: '1d8', damageType: 'force' }] } },
      ] },
    { level: 7, hpDie: 10, choices: [],
      grants: [
        { kind: 'resource', value: { resourceId: 'ethereal_step_pool', name: 'Ethereal Step', maximum: 1, recharge: 'short_rest' } },
        { kind: 'feature', value: { id: 'ethereal_step', name: 'Ethereal Step', description: 'As a bonus action, cast Etherealness without a spell slot, but it ends at the end of the current turn. Usable once per short or long rest. Etherealness isn\'t in this codebase\'s spell library yet — no cast_spell hook until it\'s added.', source: { kind: 'subclass', refId: 'horizon_walker' }, level: 7, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'bonus_action', resourceCost: { resourceId: 'ethereal_step_pool', quantity: 1 }, range: 'self', target: 'self', requiresSave: null },
          abilityEffects: [] } },
      ] },
    { level: 11, hpDie: 10, choices: [], grants: [{ kind: 'feature', value: { id: 'distant_strike', name: 'Distant Strike', description: 'When you use the Attack action, teleport up to 10 feet to an unoccupied space you can see before each attack. If you attack at least two different creatures with the action, make one additional attack against a third creature.', source: { kind: 'subclass', refId: 'horizon_walker' }, level: 11, effects: [], actions: [], choices: [], passive: true } }] },
    { level: 15, hpDie: 10, choices: [], grants: [{ kind: 'feature', value: { id: 'spectral_defense', name: 'Spectral Defense', description: 'When you take damage from an attack, use your reaction to give yourself resistance to all of that attack\'s damage this turn.', source: { kind: 'subclass', refId: 'horizon_walker' }, level: 15, effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'reaction', resourceCost: null, range: 'self', target: 'self', requiresSave: null },
      abilityEffects: [] } }] },
  ],
};

// ── Monster Slayer ───────────────────────────────────────────────────────────
export const monsterSlayerProgression: SubclassProgression = {
  classId: 'ranger', name: 'Monster Slayer', srd: false,
  entries: [
    { level: 3, hpDie: 10, choices: [],
      grants: [
        { kind: 'resource', value: { resourceId: 'hunters_sense_pool', name: "Hunter's Sense (scales with Wisdom modifier)", maximum: 1, recharge: 'long_rest' } },
        { kind: 'feature', value: { id: 'hunters_sense', name: "Hunter's Sense", description: 'As an action, learn a creature\'s damage immunities, resistances, and vulnerabilities within 60 feet (or that it has none, if hidden from divination). Usable a number of times equal to your Wisdom modifier (minimum once) per long rest — tracked here as a single-use pool; increase its maximum to match.', source: { kind: 'subclass', refId: 'monster_slayer' }, level: 3, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'action', resourceCost: { resourceId: 'hunters_sense_pool', quantity: 1 }, range: '60 feet', target: 'single', requiresSave: null },
          abilityEffects: [] } },
        { kind: 'feature', value: { id: 'slayers_prey', name: "Slayer's Prey", description: 'As a bonus action, designate one creature within 60 feet as your prey until you finish a rest or redesignate. Unlimited uses.', source: { kind: 'subclass', refId: 'monster_slayer' }, level: 3, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'bonus_action', resourceCost: null, range: '60 feet', target: 'single', requiresSave: null },
          abilityEffects: [] } },
        { kind: 'feature', value: { id: 'slayers_prey_bane', name: "Slayer's Prey: Mark's Bane", description: 'The first time each turn you hit your Slayer\'s Prey target with a weapon, it takes an extra 1d6 damage.', source: { kind: 'subclass', refId: 'monster_slayer' }, level: 3, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'free', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
          abilityEffects: [{ type: 'damage', dice: '1d6', damageType: 'weapon' }] } },
      ] },
    { level: 7, hpDie: 10, choices: [], grants: [{ kind: 'feature', value: { id: 'supernatural_defense', name: 'Supernatural Defense', description: 'Whenever your Slayer\'s Prey target forces you to make a saving throw, or you make an ability check to escape its grapple, add 1d6 to the roll.', source: { kind: 'subclass', refId: 'monster_slayer' }, level: 7, effects: [], actions: [], choices: [], passive: true } }] },
    { level: 11, hpDie: 10, choices: [],
      grants: [
        { kind: 'resource', value: { resourceId: 'magic_users_nemesis_pool', name: "Magic-User's Nemesis", maximum: 1, recharge: 'short_rest' } },
        { kind: 'feature', value: { id: 'magic_users_nemesis', name: "Magic-User's Nemesis", description: 'When you see a creature within 60 feet casting a spell or teleporting, use your reaction to force a Wisdom save against your spell save DC; on a failure the spell or teleport fails and is wasted. Usable once per short or long rest.', source: { kind: 'subclass', refId: 'monster_slayer' }, level: 11, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'reaction', resourceCost: { resourceId: 'magic_users_nemesis_pool', quantity: 1 }, range: '60 feet', target: 'single', requiresSave: { ability: 'wis', dc: 'spell_save_dc' } },
          abilityEffects: [] } },
      ] },
    { level: 15, hpDie: 10, choices: [], grants: [{ kind: 'feature', value: { id: 'slayers_counter', name: "Slayer's Counter", description: 'If your Slayer\'s Prey target forces you to make a saving throw, use your reaction to make one weapon attack against it before the save; if the attack hits, your save automatically succeeds in addition to the attack\'s normal effects.', source: { kind: 'subclass', refId: 'monster_slayer' }, level: 15, effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'reaction', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
      abilityEffects: [] } }] },
  ],
};

// ── Swarmkeeper ──────────────────────────────────────────────────────────────
export const swarmkeeperProgression: SubclassProgression = {
  classId: 'ranger', name: 'Swarmkeeper', srd: false,
  entries: [
    { level: 3, hpDie: 10, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'gathered_swarm', name: 'Gathered Swarm', description: 'A swarm of nature spirits bonds to you. Once on each of your turns, immediately after you hit a creature with an attack, choose one option below (only one per turn).', source: { kind: 'subclass', refId: 'swarmkeeper' }, level: 3, effects: [], actions: [], choices: [], passive: true } },
        { kind: 'feature', value: { id: 'swarm_strike', name: 'Swarm Strike', description: 'The attack\'s target takes 1d6 piercing damage from the swarm (1d8 at level 11).', source: { kind: 'subclass', refId: 'swarmkeeper' }, level: 3, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'free', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
          abilityEffects: [{ type: 'damage', dice: '1d6', damageType: 'piercing' }] } },
        { kind: 'feature', value: { id: 'swarm_shove', name: 'Swarm Shove', description: 'The attack\'s target makes a Strength save against your spell save DC or is moved by the swarm up to 15 feet horizontally in a direction you choose (also knocked prone on a failure, at level 11).', source: { kind: 'subclass', refId: 'swarmkeeper' }, level: 3, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'free', resourceCost: null, range: '5 feet', target: 'single', requiresSave: { ability: 'str', dc: 'spell_save_dc' } },
          abilityEffects: [] } },
        { kind: 'feature', value: { id: 'swarm_glide', name: 'Swarm Glide', description: 'You are moved by the swarm 5 feet horizontally in a direction you choose.', source: { kind: 'subclass', refId: 'swarmkeeper' }, level: 3, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'free', resourceCost: null, range: 'self', target: 'self', requiresSave: null },
          abilityEffects: [] } },
        { kind: 'feature', value: { id: 'swarmkeeper_magic', name: 'Swarmkeeper Magic', description: 'Learn the Mage Hand cantrip, taking the form of your swarm.', source: { kind: 'subclass', refId: 'swarmkeeper' }, level: 3, effects: [
          { type: 'grant_spell', target: 'cantrip', operation: 'add', value: null, condition: null, cantripIds: ['mage_hand'] },
        ], actions: [], choices: [], passive: true } },
      ] },
    { level: 7, hpDie: 10, choices: [],
      grants: [
        { kind: 'resource', value: { resourceId: 'writhing_tide_pool', name: 'Writhing Tide (scales with proficiency bonus)', maximum: 1, recharge: 'long_rest' } },
        { kind: 'feature', value: { id: 'writhing_tide', name: 'Writhing Tide', description: 'As a bonus action, gain a 10-foot flying speed and the ability to hover for 1 minute or until incapacitated. Usable a number of times equal to your proficiency bonus per long rest — tracked here as a single-use pool; increase its maximum to match.', source: { kind: 'subclass', refId: 'swarmkeeper' }, level: 7, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'bonus_action', resourceCost: { resourceId: 'writhing_tide_pool', quantity: 1 }, range: 'self', target: 'self', requiresSave: null },
          abilityEffects: [{ type: 'grant_speed', speedType: 'fly', amount: 10, duration: { unit: 'minutes', remaining: 1 } }] } },
      ] },
    { level: 11, hpDie: 10, choices: [], grants: [{ kind: 'feature', value: { id: 'mighty_swarm', name: 'Mighty Swarm', description: 'Gathered Swarm improves: Swarm Strike deals 1d8, a target that fails its Swarm Shove save is also knocked prone, and Swarm Glide gives you half cover until the start of your next turn.', source: { kind: 'subclass', refId: 'swarmkeeper' }, level: 11, effects: [], actions: [], choices: [], passive: true } }] },
    { level: 15, hpDie: 10, choices: [],
      grants: [
        { kind: 'resource', value: { resourceId: 'swarming_dispersal_pool', name: 'Swarming Dispersal (scales with proficiency bonus)', maximum: 1, recharge: 'long_rest' } },
        { kind: 'feature', value: { id: 'swarming_dispersal', name: 'Swarming Dispersal', description: 'When you take damage, use your reaction to gain resistance to that damage, discorporate, and teleport to an unoccupied space you can see within 30 feet, reappearing with your swarm. Usable a number of times equal to your proficiency bonus per long rest — tracked here as a single-use pool; increase its maximum to match.', source: { kind: 'subclass', refId: 'swarmkeeper' }, level: 15, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'reaction', resourceCost: { resourceId: 'swarming_dispersal_pool', quantity: 1 }, range: '30 feet', target: 'self', requiresSave: null },
          abilityEffects: [] } },
      ] },
  ],
};

export const RANGER_SUBCLASSES: SubclassProgression[] = [
  hunterProgression, beastMasterProgression, drakewardenProgression, feyWandererProgression,
  gloomStalkerProgression, horizonWalkerProgression, monsterSlayerProgression, swarmkeeperProgression,
];
