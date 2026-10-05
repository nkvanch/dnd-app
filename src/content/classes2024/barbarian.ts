// ============================================================================
// FILE: src/content/classes2024/barbarian.ts
// Barbarian (2024 rules), System Reference Document 5.2.1 (Creative Commons Attribution 4.0).
// Rage is a resource whose uses follow the Rages column; while Rage is on (a flag the Rage action sets)
// the damage resistances apply. Rage's bonus damage, Brutal Strike and the other riders are described
// on the cards; the app does not resolve attacks. Subclass: Path of the Berserker.
// ============================================================================
import { ClassDef, classKit, stat, adv, activation } from './builder';
import { Effect } from '../../engine/types';

const classId = 'barbarian_2024';
const k = classKit(classId);
const RAGES = [2, 2, 3, 3, 3, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 6, 6, 6, 6];

const rageResist = (type: string): Effect => ({ type: 'grant_resistance', target: type, operation: 'resistance', value: null, condition: 'rage_active' });

export const barbarian2024: ClassDef = {
  key: 'barbarian', name: 'Barbarian', hitDie: 12, savingThrows: ['str', 'con'],
  description: 'A fierce warrior of primal power whose Rage grants extraordinary might and resilience. (2024 rules.)',
  armorProfs: ['light', 'medium', 'shield'], weaponProfs: ['simple', 'martial'],
  startingProficiency: { armor: ['light', 'medium', 'shield'], weapons: ['simple', 'martial'] },
  multiclass: { weapons: ['martial'], armor: ['shield'] },
  asiLevels: [4, 8, 12, 16, 19],
  levels: {
    1: {
      choices: [
        k.skills(2, ['animal_handling', 'athletics', 'intimidation', 'nature', 'perception', 'survival']),
        k.equip('start', 'Starting equipment: (A) Greataxe, 4 Handaxes, Explorer\'s Pack, and 15 GP; or (B) 75 GP (add the gold on your sheet).', [
          { id: 'a', label: 'A: Greataxe, 4 Handaxes, Explorer\'s Pack, 15 GP', items: ['greataxe', 'handaxe', 'handaxe', 'handaxe', 'handaxe', 'explorers_pack'] },
          { id: 'b', label: 'B: 75 GP', items: [] },
        ]),
      ],
      grants: [
        k.g('rage', 'Rage', 1,
          'You can imbue yourself with a primal power called Rage. You can enter it as a Bonus Action if you aren\'t wearing Heavy armor. You can enter your Rage the number of times shown for your Barbarian level in the Rages column; you regain one expended use when you finish a Short Rest and all expended uses when you finish a Long Rest. While active: Damage Resistance to Bludgeoning, Piercing and Slashing damage. Rage Damage: when you make an attack using Strength (with a weapon or an Unarmed Strike) and deal damage, you gain a bonus to the damage: +2 at levels 1-8, +3 at 9-15, +4 at 16-20. Strength Advantage: Advantage on Strength checks and Strength saving throws. No Concentration or Spells: you can\'t maintain Concentration and can\'t cast spells. Duration: until the end of your next turn, ending early if you don Heavy armor or have the Incapacitated condition; you can extend it each turn by making an attack roll against an enemy, forcing an enemy to make a saving throw, or taking a Bonus Action, for up to 10 minutes.',
          {
            effects: [rageResist('bludgeoning'), rageResist('piercing'), rageResist('slashing'),
              { type: 'stat_modifier', target: 'Strength checks and Strength saving throws', operation: 'advantage', value: null, condition: 'rage_active' }],
            activation: activation('bonus_action', { resource: 'rage_pool' }),
            abilityEffects: [{ type: 'set_flag', flag: 'rage_active', value: true }], tags: ['buff'],
          }),
        k.pool('rage_pool', 'Rage', RAGES[0], 'long_rest'),
        k.g('unarmored_defense', 'Unarmored Defense', 1, 'While you aren\'t wearing any armor, your base Armor Class equals 10 plus your Dexterity and Constitution modifiers. You can use a Shield and still gain this benefit.',
          { effects: [{ type: 'base_ac_formula', target: 'ac', operation: 'set', value: 10, condition: null, formulaAbilities: ['dex', 'con'] }] }),
        k.mastery(1, 2, 'melee', 'Your training with weapons allows you to use the mastery properties of two kinds of Simple or Martial Melee weapons of your choice, such as Greataxes and Handaxes. Whenever you finish a Long Rest, you can practice weapon drills and change one of those weapon choices. You gain the ability to use the mastery properties of more kinds of weapons as shown in the Weapon Mastery column (3 at level 4, 4 at level 10).', true),
      ],
    },
    2: { grants: [
      k.raise('rage_pool', RAGES[1]),
      k.g('danger_sense', 'Danger Sense', 2, 'You have Advantage on Dexterity saving throws unless you have the Incapacitated condition.', { effects: [adv('Dexterity saving throws')] }),
      k.g('reckless_attack', 'Reckless Attack', 2, 'When you make your first attack roll on your turn, you can decide to attack recklessly. Doing so gives you Advantage on attack rolls using Strength until the start of your next turn, but attack rolls against you have Advantage during that time.',
        { activation: activation('free'), tags: ['buff'] }),
    ] },
    3: {
      choices: [k.subclassChoice('Barbarian Subclass'), k.skills(1, ['animal_handling', 'athletics', 'intimidation', 'nature', 'perception', 'survival'])],
      grants: [
        k.raise('rage_pool', RAGES[2]),
        k.g('subclass', 'Barbarian Subclass', 3, 'You gain a Barbarian subclass of your choice. A subclass grants you features at certain Barbarian levels.'),
        k.g('primal_knowledge', 'Primal Knowledge', 3, 'You gain proficiency in another skill of your choice from the Barbarian skill list. In addition, while your Rage is active, whenever you make an ability check using Acrobatics, Intimidation, Perception, Stealth, or Survival, you can make it as a Strength check even if it normally uses a different ability.'),
      ],
    },
    4: { grants: [k.raise('rage_pool', RAGES[3]), k.mastery(4, 3, 'melee', 'You can use the mastery properties of three kinds of Simple or Martial Melee weapons.')] },
    5: { grants: [
      k.raise('rage_pool', RAGES[4]),
      k.extraAttack(5),
      k.g('fast_movement', 'Fast Movement', 5, 'Your Speed increases by 10 feet while you aren\'t wearing Heavy armor.', { effects: [{ ...stat('speed', 'add', 10), condition: 'worn:not_heavy' }] }),
    ] },
    6: { grants: [k.raise('rage_pool', RAGES[5])] },
    7: { grants: [
      k.raise('rage_pool', RAGES[6]),
      k.g('feral_instinct', 'Feral Instinct', 7, 'Your instincts are so honed that you have Advantage on Initiative rolls.', { effects: [adv('initiative')] }),
      k.g('instinctive_pounce', 'Instinctive Pounce', 7, 'As part of the Bonus Action you take to enter your Rage, you can move up to half your Speed.'),
    ] },
    8: { grants: [k.raise('rage_pool', RAGES[7])] },
    9: { grants: [
      k.raise('rage_pool', RAGES[8]),
      k.g('brutal_strike', 'Brutal Strike', 9, 'If you use Reckless Attack, you can forgo any Advantage on one Strength-based attack roll of your choice on your turn (the chosen roll mustn\'t have Disadvantage). If it hits, the target takes an extra 1d10 damage of the same type dealt by the weapon or Unarmed Strike, and you can cause one Brutal Strike effect. Forceful Blow: the target is pushed 15 feet straight away from you, and you can then move up to half your Speed straight toward it without provoking Opportunity Attacks. Hamstring Blow: the target\'s Speed is reduced by 15 feet until the start of your next turn (only the most recent Hamstring Blow applies).',
        { activation: activation('free', { range: '5 feet', target: 'single' }), abilityEffects: [{ type: 'damage', dice: '1d10', damageType: 'extra' }], tags: ['damage'] }),
    ] },
    10: { grants: [k.raise('rage_pool', RAGES[9]), k.mastery(10, 4, 'melee', 'You can use the mastery properties of four kinds of Simple or Martial Melee weapons.')] },
    11: { grants: [
      k.raise('rage_pool', RAGES[10]),
      k.g('relentless_rage', 'Relentless Rage', 11, 'If you drop to 0 Hit Points while your Rage is active and don\'t die outright, you can make a DC 10 Constitution saving throw. If you succeed, your Hit Points instead change to a number equal to twice your Barbarian level. Each time you use this feature after the first, the DC increases by 5. When you finish a Short or Long Rest, the DC resets to 10.',
        { trigger: 'You drop to 0 Hit Points while your Rage is active and don\'t die outright.' }),
    ] },
    12: { grants: [k.raise('rage_pool', RAGES[11])] },
    13: { grants: [
      k.raise('rage_pool', RAGES[12]),
      k.g('improved_brutal_strike_13', 'Improved Brutal Strike (13)', 13, 'The following effects are now among your Brutal Strike options. Staggering Blow: the target has Disadvantage on the next saving throw it makes, and it can\'t make Opportunity Attacks until the start of your next turn. Sundering Blow: before the start of your next turn, the next attack roll made by another creature against the target gains a +5 bonus to the roll (an attack roll can gain only one Sundering Blow bonus).'),
    ] },
    14: { grants: [k.raise('rage_pool', RAGES[13])] },
    15: { grants: [
      k.raise('rage_pool', RAGES[14]),
      k.g('persistent_rage', 'Persistent Rage', 15, 'When you roll Initiative, you can regain all expended uses of Rage (once, until you finish a Long Rest). In addition, your Rage lasts for 10 minutes without you needing to do anything to extend it; it ends early if you have the Unconscious condition (not just Incapacitated) or don Heavy armor.',
        { trigger: 'You roll Initiative.' }),
    ] },
    16: { grants: [k.raise('rage_pool', RAGES[15])] },
    17: { grants: [
      k.raise('rage_pool', RAGES[16]),
      k.g('improved_brutal_strike_17', 'Improved Brutal Strike (17)', 17, 'The extra damage of your Brutal Strike increases to 2d10. In addition, you can use two different Brutal Strike effects whenever you use your Brutal Strike feature.',
        { upgradeOf: 'brutal_strike', activation: activation('free', { range: '5 feet', target: 'single' }), abilityEffects: [{ type: 'damage', dice: '2d10', damageType: 'extra' }], tags: ['damage'] }),
    ] },
    18: { grants: [
      k.raise('rage_pool', RAGES[17]),
      k.g('indomitable_might', 'Indomitable Might', 18, 'If your total for a Strength check or Strength saving throw is less than your Strength score, you can use that score in place of the total.'),
    ] },
    19: { grants: [k.raise('rage_pool', RAGES[18])] },
    20: { grants: [
      k.raise('rage_pool', RAGES[19]),
      k.g('primal_champion', 'Primal Champion', 20, 'You embody primal power. Your Strength and Constitution scores increase by 4, to a maximum of 25.',
        { effects: [stat('str', 'add', 4), stat('con', 'add', 4)] }),
    ] },
  },
  subclass: { id: 'berserker_2024', name: 'Path of the Berserker', entries: kit => [
    { level: 3, grants: [kit.g('berserker_frenzy', 'Frenzy', 3, 'If you use Reckless Attack while your Rage is active, you deal extra damage to the first target you hit on your turn with a Strength-based attack. Roll a number of d6s equal to your Rage Damage bonus and add them together; the damage has the same type as the weapon or Unarmed Strike used.',
      { activation: activation('free', { range: '5 feet', target: 'single' }), tags: ['damage'] })] },
    { level: 6, grants: [kit.g('berserker_mindless_rage', 'Mindless Rage', 6, 'You have Immunity to the Charmed and Frightened conditions while your Rage is active. If you\'re Charmed or Frightened when you enter your Rage, the condition ends on you.',
      { effects: [{ type: 'condition_immunity', target: 'charmed', operation: 'immunity', value: null, condition: 'rage_active' }, { type: 'condition_immunity', target: 'frightened', operation: 'immunity', value: null, condition: 'rage_active' }] })] },
    { level: 10, grants: [kit.g('berserker_retaliation', 'Retaliation', 10, 'When you take damage from a creature that is within 5 feet of you, you can take a Reaction to make one melee attack against that creature, using a weapon or an Unarmed Strike.',
      { trigger: 'You take damage from a creature within 5 feet of you.', activation: activation('reaction', { range: '5 feet', target: 'single' }), tags: ['attack'] })] },
    { level: 14, grants: [kit.g('berserker_intimidating_presence', 'Intimidating Presence', 14, 'As a Bonus Action, you strike terror into others. Each creature of your choice in a 30-foot Emanation originating from you must make a Wisdom saving throw (DC 8 plus your Strength modifier and Proficiency Bonus). On a failed save a creature has the Frightened condition for 1 minute, repeating the save at the end of each of its turns. Once you use this feature you can\'t use it again until you finish a Long Rest, unless you expend a use of your Rage (no action required) to restore it.',
      { activation: activation('bonus_action', { resource: 'berserker_presence', range: '30 feet', target: 'area', requiresSave: { ability: 'wis', dc: { ability: 'str' } } }), tags: ['control', 'save'],
        resources: [{ resourceId: 'berserker_presence', name: 'Intimidating Presence', maximum: 1, recharge: 'long_rest' }] })] },
  ] },
};
