// ============================================================================
// FILE: src/content/classes2024/rogue.ts
// Rogue (2024 rules), System Reference Document 5.2.1 (Creative Commons Attribution 4.0).
// Sneak Attack scales with the Rogue level (ability effect with `diceByLevel`). Weapon Mastery covers the
// Rogue's proficient weapons (Simple, plus Martial with Finesse or Light). Cunning Strike options are
// listed on the feature with their die costs. Subclass: Thief. Climb Speed (Second-Story Work) is described.
// ============================================================================
import { ClassDef, classKit, activation } from './builder';
import { Effect } from '../../engine/types';
import { WEAPON_MASTERY_TABLE } from '../weaponMastery';

const classId = 'rogue_2024';
const k = classKit(classId);
const SNEAK_DICE = (lv: number) => `${Math.ceil(lv / 2)}d6`;
/** Martial weapons with the Finesse or Light property (the Rogue's extra weapon proficiency). */
const FINESSE_OR_LIGHT_MARTIAL = WEAPON_MASTERY_TABLE.filter(w => w.category === 'martial' && (w.properties.includes('finesse') || w.properties.includes('light'))).map(w => w.name);
const saveBonus = (ab: string): Effect => ({ type: 'stat_modifier', target: `savingThrows.${ab}`, operation: 'add', value: 0, condition: null, addProficiencyBonus: true } as Effect);

export const rogue2024: ClassDef = {
  key: 'rogue', name: 'Rogue', hitDie: 8, savingThrows: ['dex', 'int'],
  description: 'A scoundrel who uses stealth and trickery to overcome obstacles and enemies. (2024 rules.)',
  armorProfs: ['light'], weaponProfs: ['simple', ...FINESSE_OR_LIGHT_MARTIAL],
  toolProfs: ['thieves_tools'],
  startingProficiency: { armor: ['light'], weapons: ['simple', ...FINESSE_OR_LIGHT_MARTIAL], tools: ['thieves_tools'] },
  multiclass: { armor: ['light'], tools: ['thieves_tools'] },
  asiLevels: [4, 8, 10, 12, 16, 19],
  levels: {
    1: {
      choices: [
        k.skills(4, ['acrobatics', 'athletics', 'deception', 'insight', 'intimidation', 'investigation', 'perception', 'persuasion', 'sleight_of_hand', 'stealth']),
        k.equip('start', 'Starting equipment: (A) Leather Armor, 2 Daggers, Shortsword, Shortbow, 20 Arrows, Thieves\' Tools, Burglar\'s Pack, and 8 GP; or (B) 100 GP (add the gold on your sheet).', [
          { id: 'a', label: 'A: Leather Armor, 2 Daggers, Shortsword, Shortbow, 20 Arrows, Thieves\' Tools, Burglar\'s Pack, 8 GP', items: ['leather_armor', 'dagger', 'dagger', 'shortsword', 'shortbow', 'arrows_20', 'thieves_tools', 'burglars_pack'] },
          { id: 'b', label: 'B: 100 GP', items: [] },
        ]),
        k.expertise('expertise_1', 2, 'Expertise: choose two of your skill proficiencies. (Sleight of Hand and Stealth are recommended.)'),
      ],
      grants: [
        k.g('expertise', 'Expertise', 1, 'You gain Expertise in two of your skill proficiencies of your choice, and in two more at Rogue level 6.'),
        k.g('sneak_attack', 'Sneak Attack', 1, 'Once per turn, you can deal extra damage to one creature you hit with an attack roll if you have Advantage on the roll and the attack uses a Finesse or a Ranged weapon. The extra damage\'s type is the same as the weapon\'s type. You don\'t need Advantage if at least one of your allies is within 5 feet of the target, the ally doesn\'t have the Incapacitated condition, and you don\'t have Disadvantage on the attack roll. The extra damage is 1d6 at level 1 and grows by 1d6 every two Rogue levels, up to 10d6 at level 19.',
          { activation: activation('free', { range: 'weapon', target: 'single' }),
            abilityEffects: [{ type: 'damage', dice: SNEAK_DICE(1), damageType: 'weapon',
              diceByLevel: [3, 5, 7, 9, 11, 13, 15, 17, 19].map(level => ({ level, dice: SNEAK_DICE(level) })) }], tags: ['damage'] }),
        k.g('thieves_cant', 'Thieves\' Cant', 1, 'You know Thieves\' Cant and one other language of your choice from the language tables in Character Creation.'),
        k.mastery(1, 2, 'finesse_or_light', 'Your training with weapons allows you to use the mastery properties of two kinds of weapons of your choice with which you have proficiency, such as Daggers and Shortbows. Whenever you finish a Long Rest, you can change the kinds of weapons you chose.', true),
      ],
    },
    2: { grants: [k.g('cunning_action', 'Cunning Action', 2, 'On your turn, you can take one of the following actions as a Bonus Action: Dash, Disengage, or Hide.',
      { activation: activation('bonus_action'), tags: ['utility'] })] },
    3: { choices: [k.subclassChoice('Rogue Subclass')], grants: [
      k.g('subclass', 'Rogue Subclass', 3, 'You gain a Rogue subclass of your choice.'),
      k.g('steady_aim', 'Steady Aim', 3, 'As a Bonus Action, you give yourself Advantage on your next attack roll on the current turn. You can use this feature only if you haven\'t moved during this turn, and after you use it, your Speed is 0 until the end of the current turn.',
        { activation: activation('bonus_action'), tags: ['buff'] }),
    ] },
    5: { grants: [
      k.g('cunning_strike', 'Cunning Strike', 5, 'When you deal Sneak Attack damage, you can add one of these Cunning Strike effects, forgoing the listed number of Sneak Attack dice before rolling. If an effect requires a saving throw, the DC equals 8 plus your Dexterity modifier and Proficiency Bonus. Poison (cost 1d6): the target makes a Constitution saving throw or has the Poisoned condition for 1 minute, repeating the save at the end of each of its turns (you need a Poisoner\'s Kit on your person). Trip (cost 1d6): a Large or smaller target makes a Dexterity saving throw or has the Prone condition. Withdraw (cost 1d6): immediately after the attack you move up to half your Speed without provoking Opportunity Attacks.'),
      k.g('uncanny_dodge', 'Uncanny Dodge', 5, 'When an attacker that you can see hits you with an attack roll, you can take a Reaction to halve the attack\'s damage against you (round down).',
        { trigger: 'An attacker you can see hits you with an attack roll.', activation: activation('reaction', { range: 'self', target: 'self' }), tags: ['utility'] }),
    ] },
    6: { choices: [k.expertise('expertise_6', 2, 'Expertise: choose two more of your skill proficiencies.')] },
    7: { grants: [
      k.g('evasion', 'Evasion', 7, 'When you\'re subjected to an effect that allows you to make a Dexterity saving throw to take only half damage, you instead take no damage if you succeed on the saving throw and only half damage if you fail. You can\'t use this feature if you have the Incapacitated condition.'),
      k.g('reliable_talent', 'Reliable Talent', 7, 'Whenever you make an ability check that uses one of your skill or tool proficiencies, you can treat a d20 roll of 9 or lower as a 10.'),
    ] },
    11: { grants: [k.g('improved_cunning_strike', 'Improved Cunning Strike', 11, 'You can use up to two Cunning Strike effects when you deal Sneak Attack damage, paying the die cost for each effect.')] },
    14: { grants: [k.g('devious_strikes', 'Devious Strikes', 14, 'New Cunning Strike options: Daze (cost 2d6): the target makes a Constitution saving throw or on its next turn can do only one of the following: move, or take an action or a Bonus Action. Knock Out (cost 6d6): the target makes a Constitution saving throw or has the Unconscious condition for 1 minute or until it takes any damage, repeating the save at the end of each of its turns. Obscure (cost 3d6): the target makes a Dexterity saving throw or has the Blinded condition until the end of its next turn.')] },
    15: { grants: [k.g('slippery_mind', 'Slippery Mind', 15, 'Your cunning mind is exceptionally difficult to control. You gain proficiency in Wisdom and Charisma saving throws.',
      { effects: [saveBonus('wis'), saveBonus('cha')] })] },
    18: { grants: [k.g('elusive', 'Elusive', 18, 'No attack roll can have Advantage against you unless you have the Incapacitated condition.')] },
    20: { grants: [
      k.g('stroke_of_luck', 'Stroke of Luck', 20, 'If you fail a D20 Test, you can turn the roll into a 20. Once you use this feature, you can\'t use it again until you finish a Short or Long Rest.',
        { trigger: 'You fail a D20 Test.', activation: activation('free', { resource: 'stroke_of_luck' }), tags: ['utility'] }),
      k.pool('stroke_of_luck', 'Stroke of Luck', 1, 'short_rest'),
    ] },
  },
  subclass: {
    id: 'thief_2024', name: 'Thief',
    entries: kit => [
      { level: 3, grants: [
        kit.g('thief_fast_hands', 'Fast Hands', 3, 'As a Bonus Action, you can do one of the following. Sleight of Hand: make a Dexterity (Sleight of Hand) check to pick a lock or disarm a trap with Thieves\' Tools or to pick a pocket. Use an Object: take the Utilize action, or take the Magic action to use a magic item that requires that action.',
          { activation: activation('bonus_action'), tags: ['utility'] }),
        kit.g('thief_second_story_work', 'Second-Story Work', 3, 'You gain a Climb Speed equal to your Speed, and you can determine your jump distance using your Dexterity rather than your Strength.',
          { effects: [{ type: 'grant_movement', target: 'movement', operation: 'add', value: null, condition: null, movementType: 'climb', movementEqualsSpeed: true }] }),
      ] },
      { level: 9, grants: [kit.g('thief_supreme_sneak', 'Supreme Sneak', 9, 'You gain a Cunning Strike option. Stealth Attack (cost 1d6): if you have the Hide action\'s Invisible condition, this attack doesn\'t end that condition on you if you end the turn behind Three-Quarters Cover or Total Cover.')] },
      { level: 13, grants: [kit.g('thief_use_magic_device', 'Use Magic Device', 13, 'Attunement: you can attune to up to four magic items at once. Charges: whenever you use a magic item property that expends charges, roll 1d6; on a 6 you use the property without expending the charges. Scrolls: you can use any Spell Scroll, using Intelligence as your spellcasting ability for the spell. A cantrip or level 1 spell casts reliably; a higher-level spell needs an Intelligence (Arcana) check (DC 10 plus the spell\'s level), and on a failure the scroll disintegrates.')] },
      { level: 17, grants: [kit.g('thief_thiefs_reflexes', 'Thief\'s Reflexes', 17, 'You can take two turns during the first round of any combat. You take your first turn at your normal Initiative and your second turn at your Initiative minus 10.')] },
    ],
  },
};
