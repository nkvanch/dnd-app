// ============================================================================
// FILE: src/content/classes2024/ranger.ts
// Ranger (2024 rules), System Reference Document 5.2.1 (Creative Commons Attribution 4.0).
// Half caster that casts from level 1. Favored Enemy is Hunter's Mark, always prepared and castable
// free 2/3/4/5/6 times per Long Rest. Weapon Mastery covers any proficient weapon (2 kinds). Roving's Climb
// and Swim speeds follow the final Speed (movementEqualsSpeed). Subclass: Hunter.
// ============================================================================
import { ClassDef, classKit, activation, stat } from './builder';
import { ARTIFICER_SLOTS } from '../classes/spellSlotTables';
import { styles } from './fighter';
import { Effect } from '../../engine/types';

const classId = 'ranger_2024';
const equalsSpeed = (movementType: 'climb' | 'swim' | 'fly'): Effect =>
  ({ type: 'grant_movement', target: 'movement', operation: 'add', value: null, condition: null, movementType, movementEqualsSpeed: true });
const k = classKit(classId);
const FAVORED = (lv: number) => (lv >= 17 ? 6 : lv >= 13 ? 5 : lv >= 9 ? 4 : lv >= 5 ? 3 : 2);
const blindsight = (range: number): Effect =>
  ({ type: 'grant_sense', target: 'sense', operation: 'add', value: null, condition: null, senseType: 'blindsight', senseRange: range });

export const ranger2024: ClassDef = {
  key: 'ranger', name: 'Ranger', hitDie: 10, savingThrows: ['str', 'dex'],
  description: 'A warrior of the wilds, who hunts foes with martial skill and primal magic. (2024 rules.)',
  armorProfs: ['light', 'medium', 'shield'], weaponProfs: ['simple', 'martial'],
  startingProficiency: { armor: ['light', 'medium', 'shield'], weapons: ['simple', 'martial'] },
  multiclass: { weapons: ['martial'], armor: ['light', 'medium', 'shield'] },
  asiLevels: [4, 8, 12, 16, 19],
  caster: {
    ability: 'wis', style: 'half', policy: 'known', slotsTable: ARTIFICER_SLOTS,
    cantrips: new Array(20).fill(0),
    prepared: [2, 3, 4, 5, 6, 6, 7, 7, 9, 9, 10, 10, 11, 11, 12, 12, 14, 14, 15, 15],
  },
  levels: {
    1: {
      choices: [
        k.skills(3, ['animal_handling', 'athletics', 'insight', 'investigation', 'nature', 'perception', 'stealth', 'survival']),
        k.equip('start', 'Starting equipment: (A) Studded Leather Armor, Scimitar, Shortsword, Longbow, 20 Arrows, Quiver, Druidic Focus, Explorer\'s Pack, and 7 GP; or (B) 150 GP.', [
          { id: 'a', label: 'A: Studded Leather, Scimitar, Shortsword, Longbow, 20 Arrows, Druidic Focus, Explorer\'s Pack, 7 GP', items: ['studded_leather', 'scimitar', 'shortsword', 'longbow', 'arrows_20', 'quiver', 'druidic_focus', 'explorers_pack'], gold: 7 },
          { id: 'b', label: 'B: 150 GP', items: [], gold: 150 },
        ]),
      ],
      grants: [
        k.g('spellcasting', 'Spellcasting', 1, 'You channel the magical essence of nature to cast spells using Wisdom as your spellcasting ability. You prepare the number of level 1+ Ranger spells shown in the Prepared Spells column, of a level for which you have slots, and can replace one after each Long Rest. You can use a Druidic Focus as a Spellcasting Focus.'),
        k.g('favored_enemy', 'Favored Enemy', 1, 'You always have the Hunter\'s Mark spell prepared. You can cast it twice without expending a spell slot, and you regain all expended uses of this ability when you finish a Long Rest. The number of free casts increases to 3 at level 5, 4 at level 9, 5 at level 13 and 6 at level 17.',
          { activation: activation('bonus_action', { resource: 'favored_enemy', range: '90 feet', target: 'single' }), tags: ['damage'] }),
        k.pool('favored_enemy', 'Favored Enemy (free Hunter\'s Mark)', FAVORED(1), 'long_rest'),
        { kind: 'known_spells', value: { spellIds: ['hunters_mark'] } },
        k.mastery(1, 2, 'any', 'Your training with weapons allows you to use the mastery properties of two kinds of weapons of your choice with which you have proficiency, such as Longbows and Shortswords. Whenever you finish a Long Rest, you can change the kinds of weapons you chose.', true),
      ],
    },
    2: {
      choices: [
        k.expertise('deft_explorer_expertise', 1, 'Deft Explorer: choose one of your skill proficiencies to gain Expertise in.'),
        k.pick('fighting_style', 'Fighting Style: choose a Fighting Style feat, or Druidic Warrior.', 1, [
          ...styles(k),
          k.option('fighting_style_druidic_warrior', 'Druidic Warrior', 2, 'You learn two Druid cantrips of your choice (Guidance and Starry Wisp are recommended). They count as Ranger spells for you, and Wisdom is your spellcasting ability for them. Whenever you gain a Ranger level, you can replace one of these cantrips with another Druid cantrip.',
            { grantsChoices: [k.spellsFrom('druidic_warrior_cantrips', 2, 'Druidic Warrior: choose two Druid cantrips (Guidance and Starry Wisp are recommended).', { lists: ['druid_2024'], label: 'Druidic Warrior (Druid cantrips)' })] }),
        ]),
      ],
      grants: [
        k.g('deft_explorer', 'Deft Explorer', 2, 'Thanks to your travels, you gain Expertise in one skill proficiency of your choice and you know two languages of your choice from the language tables in Character Creation.'),
        k.g('fighting_style', 'Fighting Style', 2, 'You gain a Fighting Style feat of your choice, or the Druidic Warrior option.'),
      ],
    },
    3: { choices: [k.subclassChoice('Ranger Subclass')], grants: [k.g('subclass', 'Ranger Subclass', 3, 'You gain a Ranger subclass of your choice.')] },
    5: { grants: [k.extraAttack(5), k.raise('favored_enemy', FAVORED(5))] },
    6: { grants: [k.g('roving', 'Roving', 6, 'Your Speed increases by 10 feet while you aren\'t wearing Heavy armor. You also have a Climb Speed and a Swim Speed equal to your Speed.', { effects: [{ ...stat('speed', 'add', 10), condition: 'worn:not_heavy' }, equalsSpeed('climb'), equalsSpeed('swim')] })] },
    9: { choices: [k.expertise('expertise_9', 2, 'Expertise: choose two of your skill proficiencies with which you lack Expertise.')],
      grants: [k.g('expertise', 'Expertise', 9, 'Choose two of your skill proficiencies with which you lack Expertise. You gain Expertise in those skills.'), k.raise('favored_enemy', FAVORED(9))] },
    10: { grants: [
      k.g('tireless', 'Tireless', 10, 'Primal forces now help fuel you on your journeys. Temporary Hit Points: as a Magic action, you can give yourself Temporary Hit Points equal to 1d8 plus your Wisdom modifier (minimum of 1), a number of times equal to your Wisdom modifier (minimum of once), regaining all uses on a Long Rest. Decrease Exhaustion: whenever you finish a Short Rest, your Exhaustion level, if any, decreases by 1.',
        { activation: activation('action', { resource: 'tireless' }), abilityEffects: [{ type: 'heal', dice: '1d8' }], tags: ['utility'] }),
      { kind: 'resource', value: { resourceId: 'tireless', name: 'Tireless (Temporary Hit Points)', maximum: 1, recharge: 'long_rest', perAbilityModifier: 'wis' } },
    ] },
    13: { grants: [
      k.raise('favored_enemy', FAVORED(13)),
      k.g('relentless_hunter', 'Relentless Hunter', 13, 'Taking damage can\'t break your Concentration on Hunter\'s Mark.'),
    ] },
    14: { grants: [
      k.g('natures_veil', 'Nature\'s Veil', 14, 'You invoke spirits of nature to magically hide yourself. As a Bonus Action, you can give yourself the Invisible condition until the end of your next turn. You can use this feature a number of times equal to your Wisdom modifier (minimum of once), and you regain all expended uses when you finish a Long Rest.',
        { activation: activation('bonus_action', { resource: 'natures_veil' }), tags: ['utility'] }),
      { kind: 'resource', value: { resourceId: 'natures_veil', name: 'Nature\'s Veil', maximum: 1, recharge: 'long_rest', perAbilityModifier: 'wis' } },
    ] },
    17: { grants: [
      k.raise('favored_enemy', FAVORED(17)),
      k.g('precise_hunter', 'Precise Hunter', 17, 'You have Advantage on attack rolls against the creature currently marked by your Hunter\'s Mark.'),
    ] },
    18: { grants: [k.g('feral_senses', 'Feral Senses', 18, 'Your connection to the forces of nature grants you Blindsight with a range of 30 feet.', { effects: [blindsight(30)] })] },
    20: { grants: [k.g('foe_slayer', 'Foe Slayer', 20, 'The damage die of your Hunter\'s Mark is a d10 rather than a d6.')] },
  },
  subclass: {
    id: 'hunter_2024', name: 'Hunter',
    entries: kit => [
      { level: 3, choices: [kit.pick('hunters_prey', 'Hunter\'s Prey: choose one option. (Whenever you finish a Short or Long Rest you can swap it on the Features tab.)', 1, [
          kit.option('hunters_prey_colossus_slayer', 'Colossus Slayer', 3, 'Your tenacity can wear down even the most resilient foes. When you hit a creature with a weapon, the weapon deals an extra 1d8 damage to the target if it\'s missing any of its Hit Points. You can deal this extra damage only once per turn.',
            { activation: activation('free', { range: 'weapon', target: 'single' }), abilityEffects: [{ type: 'damage', dice: '1d8', damageType: 'weapon' }], tags: ['damage'] }),
          kit.option('hunters_prey_horde_breaker', 'Horde Breaker', 3, 'Once on each of your turns when you make an attack with a weapon, you can make another attack with the same weapon against a different creature that is within 5 feet of the original target, that is within the weapon\'s range, and that you haven\'t attacked this turn.'),
        ], { timing: 'rest', rule: 'Whenever you finish a Short or Long Rest, you can replace this with the other option.' })],
        grants: [
          kit.g('hunter_hunters_lore', 'Hunter\'s Lore', 3, 'While a creature is marked by your Hunter\'s Mark, you know whether that creature has any Immunities, Resistances, or Vulnerabilities, and if it has any, you know what they are.'),
          kit.g('hunter_hunters_prey', 'Hunter\'s Prey', 3, 'You gain one of two feature options of your choice: Colossus Slayer or Horde Breaker. Whenever you finish a Short or Long Rest, you can replace the chosen option with the other one.'),
        ] },
      { level: 7, choices: [kit.pick('defensive_tactics', 'Defensive Tactics: choose one option. (Swap it after a Short or Long Rest on the Features tab.)', 1, [
          kit.option('defensive_tactics_escape_the_horde', 'Escape the Horde', 7, 'Opportunity Attacks have Disadvantage against you.'),
          kit.option('defensive_tactics_multiattack_defense', 'Multiattack Defense', 7, 'When a creature hits you with an attack roll, that creature has Disadvantage on all other attack rolls against you this turn.'),
        ], { timing: 'rest', rule: 'Whenever you finish a Short or Long Rest, you can replace this with the other option.' })],
        grants: [kit.g('hunter_defensive_tactics', 'Defensive Tactics', 7, 'You gain one of two feature options of your choice: Escape the Horde or Multiattack Defense. Whenever you finish a Short or Long Rest, you can replace the chosen option with the other one.')] },
      { level: 11, grants: [kit.g('hunter_superior_hunters_prey', 'Superior Hunter\'s Prey', 11, 'Once per turn when you deal damage to a creature marked by your Hunter\'s Mark, you can also deal that spell\'s extra damage to a different creature that you can see within 30 feet of the first creature.')] },
      { level: 15, grants: [kit.g('hunter_superior_hunters_defense', 'Superior Hunter\'s Defense', 15, 'When you take damage, you can take a Reaction to give yourself Resistance to that damage and any other damage of the same type until the end of the current turn.',
        { trigger: 'You take damage.', activation: activation('reaction', { range: 'self', target: 'self' }), tags: ['utility'] })] },
    ],
  },
};
