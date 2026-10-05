// ============================================================================
// FILE: src/content/classes2024/monk.ts
// Monk (2024 rules), System Reference Document 5.2.1 (Creative Commons Attribution 4.0).
// Focus Points are a pool that equals the Monk level (from level 2). The Martial Arts die is d6 / d8 at 5 /
// d10 at 11 / d12 at 17 and drives the Unarmed Strike entry (engine/pipeline.ts). Unarmored Movement is an
// upgrade chain (+10/+15/+20/+25/+30 ft.). The 2024 Monk has no Weapon Mastery.
// Subclass: Warrior of the Open Hand.
// ============================================================================
import { ClassDef, classKit, activation, stat } from './builder';
import { ALL_TOOLS } from '../tools';
import { Effect } from '../../engine/types';
import { WEAPON_MASTERY_TABLE } from '../weaponMastery';

const classId = 'monk_2024';
/** Martial weapons that have the Light property (the Monk's extra weapon proficiency). */
export const LIGHT_MARTIAL_WEAPONS = WEAPON_MASTERY_TABLE.filter(w => w.category === 'martial' && w.properties.includes('light')).map(w => w.name);
const k = classKit(classId);
const FOCUS_DC = { ability: 'wis' as const, dc: { ability: 'wis' as const } };
const MOVE = (feet: number, extra = '') => `Your speed increases by ${feet} feet while you aren't wearing armor or wielding a Shield.${extra}`;
const speed = (feet: number): Effect => stat('speed', 'add', feet);
const focus = (extra: object = {}) => activation('free', { resource: 'focus_points', ...extra });

/** Disciplined Survivor: proficiency in the four saves a Monk lacks (Strength and Dexterity are already proficient). */
const allSaves: Effect[] = (['con', 'int', 'wis', 'cha'] as const).map(ab =>
  ({ ...stat(`savingThrows.${ab}`, 'add', 0), addProficiencyBonus: true } as Effect));

export const monk2024: ClassDef = {
  key: 'monk', name: 'Monk', hitDie: 8, savingThrows: ['str', 'dex'],
  description: 'A master of martial arts, harnessing the power of the body in pursuit of perfection. (2024 rules.)',
  armorProfs: [], weaponProfs: ['simple', ...LIGHT_MARTIAL_WEAPONS],
  startingProficiency: { armor: [], weapons: ['simple', ...LIGHT_MARTIAL_WEAPONS] },
  multiclass: {},
  asiLevels: [4, 8, 12, 16, 19],
  levels: {
    1: {
      choices: [
        k.skills(2, ['acrobatics', 'athletics', 'history', 'insight', 'religion', 'stealth']),
        { id: `${classId}_tool`, prompt: 'Choose one type of Artisan\'s Tools or one Musical Instrument.', kind: 'tool', count: 1, grants: [], required: true, resolved: false,
          pool: ALL_TOOLS.filter(t => t.category === 'artisan' || t.category === 'musical_instrument').map(t => ({ id: t.id, label: t.name, value: t.id })) },
        k.equip('start', 'Starting equipment: (A) Spear, 5 Daggers, the tool you chose, Explorer\'s Pack, and 11 GP; or (B) 50 GP (add the gold on your sheet).', [
          { id: 'a', label: 'A: Spear, 5 Daggers, Explorer\'s Pack, 11 GP', items: ['spear', 'dagger', 'dagger', 'dagger', 'dagger', 'dagger', 'explorers_pack'] },
          { id: 'b', label: 'B: 50 GP', items: [] },
        ]),
      ],
      grants: [
        k.g('martial_arts', 'Martial Arts', 1, 'Your practice of martial arts gives you mastery of combat styles that use your Unarmed Strike and Monk weapons (Simple Melee weapons and Martial Melee weapons with the Light property). While you are unarmed or wielding only Monk weapons and aren\'t wearing armor or wielding a Shield: Bonus Unarmed Strike (you can make an Unarmed Strike as a Bonus Action); Martial Arts Die (roll 1d6 in place of the normal damage of your Unarmed Strike or Monk weapons; it becomes 1d8 at level 5, 1d10 at level 11 and 1d12 at level 17); Dexterous Attacks (use Dexterity instead of Strength for attack and damage rolls with them, and for the save DC of Grapple and Shove).',
          { activation: activation('bonus_action', { range: '5 feet', target: 'single' }), tags: ['damage'] }),
        k.g('unarmored_defense', 'Unarmored Defense', 1, 'While you aren\'t wearing armor or wielding a Shield, your base Armor Class equals 10 plus your Dexterity and Wisdom modifiers.',
          { effects: [{ type: 'base_ac_formula', target: 'ac', operation: 'set', value: 10, condition: null, formulaAbilities: ['dex', 'wis'] }] }),
      ],
    },
    2: { grants: [
      k.g('monks_focus', 'Monk\'s Focus', 2, 'Your focus and martial training let you harness a well of energy represented by Focus Points; you have a number equal to your Monk level. When you expend a Focus Point it is unavailable until you finish a Short or Long Rest, at the end of which you regain all expended points. Some features that use Focus Points require a saving throw; the DC equals 8 plus your Wisdom modifier and Proficiency Bonus. You start knowing three such features: Flurry of Blows, Patient Defense and Step of the Wind.'),
      { kind: 'resource', value: { resourceId: 'focus_points', name: 'Focus Points', maximum: 2, recharge: 'short_rest', perLevel: 1 } },
      k.g('flurry_of_blows', 'Flurry of Blows', 2, 'You can expend 1 Focus Point to make two Unarmed Strikes as a Bonus Action. (Three Unarmed Strikes from level 10.)',
        { activation: activation('bonus_action', { resource: 'focus_points', range: '5 feet', target: 'single' }), tags: ['damage'] }),
      k.g('patient_defense', 'Patient Defense', 2, 'You can take the Disengage action as a Bonus Action. Alternatively, you can expend 1 Focus Point to take both the Disengage and the Dodge actions as a Bonus Action. From level 10, when you expend a Focus Point for it you also gain Temporary Hit Points equal to two rolls of your Martial Arts die.',
        { activation: activation('bonus_action', { resource: 'focus_points' }), tags: ['utility'] }),
      k.g('step_of_the_wind', 'Step of the Wind', 2, 'You can take the Dash action as a Bonus Action. Alternatively, you can expend 1 Focus Point to take both the Disengage and Dash actions as a Bonus Action, and your jump distance is doubled for the turn. From level 10, when you expend a Focus Point for it you can also move a willing Large or smaller creature within 5 feet with you until the end of your turn (its movement doesn\'t provoke Opportunity Attacks).',
        { activation: activation('bonus_action', { resource: 'focus_points' }), tags: ['utility'] }),
      k.g('unarmored_movement', 'Unarmored Movement', 2, MOVE(10, ' This bonus increases at levels 6, 10, 14 and 18.'), { effects: [speed(10)] }),
      k.pool('uncanny_metabolism', 'Uncanny Metabolism', 1, 'long_rest'),
      k.g('uncanny_metabolism', 'Uncanny Metabolism', 2, 'When you roll Initiative, you can regain all expended Focus Points. When you do so, roll your Martial Arts die, and regain a number of Hit Points equal to your Monk level plus the number rolled. Once you use this feature, you can\'t use it again until you finish a Long Rest.',
        { trigger: 'You roll Initiative.', activation: activation('free', { resource: 'uncanny_metabolism' }), abilityEffects: [{ type: 'heal', dice: '1d6' }], tags: ['healing'] }),
    ] },
    3: { choices: [k.subclassChoice('Monk Subclass')], grants: [
      k.g('subclass', 'Monk Subclass', 3, 'You gain a Monk subclass of your choice.'),
      k.g('deflect_attacks', 'Deflect Attacks', 3, 'When an attack roll hits you and its damage includes Bludgeoning, Piercing, or Slashing damage, you can take a Reaction to reduce the attack\'s total damage against you by 1d10 plus your Dexterity modifier and Monk level. If you reduce the damage to 0, you can expend 1 Focus Point to redirect some of the attack\'s force: choose a creature you can see within 5 feet (melee attack) or within 60 feet and not behind Total Cover (ranged attack). It must succeed on a Dexterity saving throw or take damage equal to two rolls of your Martial Arts die plus your Dexterity modifier, of the type dealt by the attack.',
        { trigger: 'An attack roll hits you.', activation: activation('reaction', { range: 'self', target: 'self' }), tags: ['utility'] }),
    ] },
    4: { grants: [
      k.g('slow_fall', 'Slow Fall', 4, 'You can take a Reaction when you fall to reduce any damage you take from the fall by an amount equal to five times your Monk level.',
        { trigger: 'You fall.', activation: activation('reaction', { range: 'self', target: 'self' }), tags: ['utility'] }),
    ] },
    5: { grants: [
      k.extraAttack(5),
      k.g('stunning_strike', 'Stunning Strike', 5, 'Once per turn when you hit a creature with a Monk weapon or an Unarmed Strike, you can expend 1 Focus Point to attempt a stunning strike. The target must make a Constitution saving throw. On a failed save, the target has the Stunned condition until the start of your next turn. On a successful save, the target\'s Speed is halved until the start of your next turn, and the next attack roll made against the target before then has Advantage.',
        { activation: focus({ range: '5 feet', target: 'single', requiresSave: { ability: 'con', dc: FOCUS_DC.dc } }), tags: ['control', 'save'] }),
    ] },
    6: { grants: [
      k.g('unarmored_movement', 'Unarmored Movement (+15 ft.)', 6, MOVE(15), { upgradeOf: 'unarmored_movement', effects: [speed(15)] }),
      k.g('empowered_strikes', 'Empowered Strikes', 6, 'Whenever you deal damage with your Unarmed Strike, it can deal your choice of Force damage or its normal damage type.'),
    ] },
    7: { grants: [k.g('evasion', 'Evasion', 7, 'When you\'re subjected to an effect that allows you to make a Dexterity saving throw to take only half damage, you instead take no damage if you succeed on the saving throw and only half damage if you fail. You don\'t benefit from this feature if you have the Incapacitated condition.')] },
    9: { grants: [k.g('acrobatic_movement', 'Acrobatic Movement', 9, 'While you aren\'t wearing armor or wielding a Shield, you can move along vertical surfaces and across liquids on your turn without falling during the movement.')] },
    10: { grants: [
      k.g('unarmored_movement', 'Unarmored Movement (+20 ft.)', 10, MOVE(20), { upgradeOf: 'unarmored_movement', effects: [speed(20)] }),
      k.g('heightened_focus', 'Heightened Focus', 10, 'Your Flurry of Blows, Patient Defense and Step of the Wind improve. Flurry of Blows: you can expend 1 Focus Point to make three Unarmed Strikes with it instead of two. Patient Defense: when you expend a Focus Point to use it, you gain Temporary Hit Points equal to two rolls of your Martial Arts die. Step of the Wind: when you expend a Focus Point to use it, you can choose a willing Large or smaller creature within 5 feet and move it with you until the end of your turn; its movement doesn\'t provoke Opportunity Attacks.'),
      k.g('self_restoration', 'Self-Restoration', 10, 'Through sheer force of will, you can remove one of the following conditions from yourself at the end of each of your turns: Charmed, Frightened, or Poisoned. In addition, forgoing food and drink doesn\'t give you levels of Exhaustion.'),
    ] },
    13: { grants: [k.g('deflect_energy', 'Deflect Energy', 13, 'You can now use your Deflect Attacks feature against attacks that deal any damage type, not just Bludgeoning, Piercing, or Slashing.')] },
    14: { grants: [
      k.g('unarmored_movement', 'Unarmored Movement (+25 ft.)', 14, MOVE(25), { upgradeOf: 'unarmored_movement', effects: [speed(25)] }),
      k.g('disciplined_survivor', 'Disciplined Survivor', 14, 'Your physical and mental discipline grant you proficiency in all saving throws. Additionally, whenever you make a saving throw and fail, you can expend 1 Focus Point to reroll it, and you must use the new roll.',
        { effects: allSaves, trigger: 'You fail a saving throw.', activation: focus(), tags: ['utility'] }),
    ] },
    15: { grants: [k.g('perfect_focus', 'Perfect Focus', 15, 'When you roll Initiative and don\'t use Uncanny Metabolism, you regain expended Focus Points until you have 4 if you have 3 or fewer.', { trigger: 'You roll Initiative.' })] },
    18: { grants: [
      k.g('unarmored_movement', 'Unarmored Movement (+30 ft.)', 18, MOVE(30), { upgradeOf: 'unarmored_movement', effects: [speed(30)] }),
      k.g('superior_defense', 'Superior Defense', 18, 'At the start of your turn, you can expend 3 Focus Points to bolster yourself against harm for 1 minute or until you have the Incapacitated condition. During that time, you have Resistance to all damage except Force damage.',
        { activation: focus({ cost: 3 }), tags: ['utility'] }),
    ] },
    20: { grants: [k.g('body_and_mind', 'Body and Mind', 20, 'You have developed your body and mind to new heights. Your Dexterity and Wisdom scores increase by 4, to a maximum of 25.',
      { effects: [stat('dex', 'add', 4), stat('wis', 'add', 4)] })] },
  },
  subclass: {
    id: 'open_hand_2024', name: 'Warrior of the Open Hand',
    entries: kit => [
      { level: 3, grants: [kit.g('open_hand_technique', 'Open Hand Technique', 3, 'Whenever you hit a creature with an attack granted by your Flurry of Blows, you can impose one of these effects on that target. Addle: it can\'t make Opportunity Attacks until the start of its next turn. Push: it must succeed on a Strength saving throw or be pushed up to 15 feet away from you. Topple: it must succeed on a Dexterity saving throw or have the Prone condition.')] },
      { level: 6, grants: [
        kit.g('open_hand_wholeness_of_body', 'Wholeness of Body', 6, 'As a Bonus Action, you can roll your Martial Arts die. You regain a number of Hit Points equal to the number rolled plus your Wisdom modifier (minimum of 1 Hit Point regained). You can use this feature a number of times equal to your Wisdom modifier (minimum of once), and you regain all expended uses when you finish a Long Rest.',
          { activation: activation('bonus_action', { resource: 'wholeness_of_body' }), abilityEffects: [{ type: 'heal', dice: '1d8' }], tags: ['healing'] }),
        { kind: 'resource', value: { resourceId: 'wholeness_of_body', name: 'Wholeness of Body', maximum: 1, recharge: 'long_rest', perAbilityModifier: 'wis' } },
      ] },
      { level: 11, grants: [kit.g('open_hand_fleet_step', 'Fleet Step', 11, 'When you take a Bonus Action other than Step of the Wind, you can also use Step of the Wind immediately after that Bonus Action.')] },
      { level: 17, grants: [kit.g('open_hand_quivering_palm', 'Quivering Palm', 17, 'When you hit a creature with an Unarmed Strike, you can expend 4 Focus Points to start imperceptible vibrations in its body, which last for a number of days equal to your Monk level and are harmless unless you take an action to end them (or, when you take the Attack action, you forgo one of the attacks to end them). You and the target must be on the same plane. When you end them, the target makes a Constitution saving throw, taking 10d12 Force damage on a failed save or half as much on a successful one. Only one creature can be under the effect at a time; you can end the vibrations harmlessly (no action required).',
        { activation: focus({ cost: 4, range: '5 feet', target: 'single', requiresSave: { ability: 'con', dc: FOCUS_DC.dc } }),
          abilityEffects: [{ type: 'damage', dice: '10d12', damageType: 'force', saveOnSuccess: 'half' }], tags: ['damage', 'save'] })] },
    ],
  },
};
