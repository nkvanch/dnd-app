// ============================================================================
// FILE: src/content/classes2024/fighter.ts
// Fighter (2024 rules), System Reference Document 5.2.1 (Creative Commons Attribution 4.0).
// Second Wind, Action Surge and Indomitable are pools; Extra Attack scales to 2/3/4 attacks; Weapon
// Mastery is 3 kinds (up to 6). Fighting Style is the 2024 "Fighting Style feat" choice, authored here
// as the four SRD styles; Additional Fighting Style (Champion, level 7) draws from the same pool.
// Subclass: Champion.
// ============================================================================
import { ClassDef, classKit, activation, adv, stat } from './builder';
import { ChoiceOption, Effect } from '../../engine/types';

const classId = 'fighter_2024';
const k = classKit(classId);
const SECOND_WIND = (lv: number) => (lv >= 10 ? 4 : lv >= 4 ? 3 : 2);
const MASTERY = (lv: number) => (lv >= 16 ? 6 : lv >= 10 ? 5 : lv >= 4 ? 4 : 3);

/** The Fighting Style feats of the SRD (Archery, Defense, Great Weapon Fighting, Two-Weapon Fighting). */
export const styles = (kit: ReturnType<typeof classKit>): ChoiceOption[] => [
  kit.option('fighting_style_archery', 'Archery', 1, 'You gain a +2 bonus to attack rolls you make with Ranged weapons.'),
  kit.option('fighting_style_defense', 'Defense', 1, 'While you\'re wearing Light, Medium, or Heavy armor, you gain a +1 bonus to Armor Class.',
    { effects: [{ ...stat('ac', 'add', 1), situational: { id: 'fighting_style_defense_armored', question: 'Are you wearing Light, Medium, or Heavy armor?' } } as Effect] }),
  kit.option('fighting_style_great_weapon_fighting', 'Great Weapon Fighting', 1, 'When you roll damage for an attack you make with a Melee weapon that you are holding with two hands, you can treat any 1 or 2 on a damage die as a 3. The weapon must have the Two-Handed or Versatile property to gain this benefit.'),
  kit.option('fighting_style_two_weapon_fighting', 'Two-Weapon Fighting', 1, 'When you make an extra attack as a result of using a weapon that has the Light property, you can add your ability modifier to the damage of that attack if you aren\'t already adding it to the damage.'),
];

export const fighter2024: ClassDef = {
  key: 'fighter', name: 'Fighter', hitDie: 10, savingThrows: ['str', 'con'],
  description: 'A master of martial combat, skilled with a variety of weapons and armor. (2024 rules.)',
  armorProfs: ['light', 'medium', 'heavy', 'shield'], weaponProfs: ['simple', 'martial'],
  startingProficiency: { armor: ['light', 'medium', 'heavy', 'shield'], weapons: ['simple', 'martial'] },
  multiclass: { weapons: ['martial'], armor: ['light', 'medium', 'shield'] },
  asiLevels: [4, 6, 8, 12, 14, 16, 19],
  levels: {
    1: {
      choices: [
        k.skills(2, ['acrobatics', 'animal_handling', 'athletics', 'history', 'insight', 'intimidation', 'persuasion', 'perception', 'survival']),
        k.equip('start', 'Starting equipment: (A) Chain Mail, Greatsword, Flail, 8 Javelins, Dungeoneer\'s Pack, 4 GP; (B) Studded Leather Armor, Scimitar, Shortsword, Longbow, 20 Arrows, Quiver, Dungeoneer\'s Pack, 11 GP; or (C) 155 GP (add the gold on your sheet).', [
          { id: 'a', label: 'A: Chain Mail, Greatsword, Flail, 8 Javelins, Dungeoneer\'s Pack, 4 GP', items: ['chain_mail', 'greatsword', 'flail', 'javelin', 'javelin', 'javelin', 'javelin', 'javelin', 'javelin', 'javelin', 'javelin', 'dungeoneers_pack'] },
          { id: 'b', label: 'B: Studded Leather, Scimitar, Shortsword, Longbow, 20 Arrows, Dungeoneer\'s Pack, 11 GP', items: ['studded_leather', 'scimitar', 'shortsword', 'longbow', 'arrows_20', 'dungeoneers_pack'] },
          { id: 'c', label: 'C: 155 GP', items: [] },
        ]),
        k.pick('fighting_style', 'Fighting Style: choose a Fighting Style feat. (Defense is recommended; you can replace it whenever you gain a Fighter level by removing it on the Features tab.)', 1, styles(k)),
      ],
      grants: [
        k.g('fighting_style', 'Fighting Style', 1, 'You have honed your martial prowess and gain a Fighting Style feat of your choice. Whenever you gain a Fighter level, you can replace the feat you chose with a different Fighting Style feat.'),
        k.g('second_wind', 'Second Wind', 1, 'You have a limited well of physical and mental stamina. As a Bonus Action, you regain Hit Points equal to 1d10 plus your Fighter level. You can use this feature twice (three times from level 4, four from level 10); you regain one expended use when you finish a Short Rest and all expended uses when you finish a Long Rest.',
          { activation: activation('bonus_action', { resource: 'second_wind' }), abilityEffects: [{ type: 'heal', dice: '1d10' }], tags: ['healing'] }),
        k.pool('second_wind', 'Second Wind', SECOND_WIND(1), 'long_rest'),
        k.mastery(1, MASTERY(1), 'any', 'Your training with weapons allows you to use the mastery properties of three kinds of Simple or Martial weapons of your choice. Whenever you finish a Long Rest, you can practice weapon drills and change one of those weapon choices. You gain the ability to use the mastery properties of more kinds of weapons as you gain levels (4 at level 4, 5 at level 10, 6 at level 16).', true),
      ],
    },
    2: { grants: [
      k.g('action_surge', 'Action Surge', 2, 'You can push yourself beyond your normal limits for a moment. On your turn, you can take one additional action, except the Magic action. Once you use this feature you can\'t do so again until you finish a Short or Long Rest. From level 17 you can use it twice before a rest but only once on a turn.',
        { activation: activation('free', { resource: 'action_surge' }), tags: ['buff'] }),
      k.pool('action_surge', 'Action Surge', 1, 'short_rest'),
      k.g('tactical_mind', 'Tactical Mind', 2, 'When you fail an ability check, you can expend a use of your Second Wind to push yourself toward success. Rather than regaining Hit Points, you roll 1d10 and add the number rolled to the ability check, potentially turning it into a success. If the check still fails, this use of Second Wind isn\'t expended.',
        { trigger: 'You fail an ability check.' }),
    ] },
    3: { choices: [k.subclassChoice('Fighter Subclass')], grants: [k.g('subclass', 'Fighter Subclass', 3, 'You gain a Fighter subclass of your choice.')] },
    4: { grants: [k.raise('second_wind', SECOND_WIND(4)), k.mastery(4, MASTERY(4), 'any', 'You can use the mastery properties of four kinds of Simple or Martial weapons.')] },
    5: { grants: [
      k.extraAttack(5),
      k.g('tactical_shift', 'Tactical Shift', 5, 'Whenever you activate your Second Wind with a Bonus Action, you can move up to half your Speed without provoking Opportunity Attacks.'),
    ] },
    9: { grants: [
      k.g('indomitable', 'Indomitable', 9, 'If you fail a saving throw, you can reroll it with a bonus equal to your Fighter level. You must use the new roll, and you can\'t use this feature again until you finish a Long Rest. You can use it twice before a Long Rest from level 13 and three times from level 17.',
        { trigger: 'You fail a saving throw.', activation: activation('free', { resource: 'indomitable' }), tags: ['utility'] }),
      k.pool('indomitable', 'Indomitable', 1, 'long_rest'),
      k.g('tactical_master', 'Tactical Master', 9, 'When you attack with a weapon whose mastery property you can use, you can replace that property with the Push, Sap, or Slow property for that attack.'),
    ] },
    10: { grants: [k.raise('second_wind', SECOND_WIND(10)), k.mastery(10, MASTERY(10), 'any', 'You can use the mastery properties of five kinds of Simple or Martial weapons.')] },
    11: { grants: [k.g('extra_attack_2', 'Two Extra Attacks', 11, 'You can attack three times instead of once whenever you take the Attack action on your turn.', { effects: [stat('extra_attack', 'set', 2)] })] },
    13: { grants: [
      k.raise('indomitable', 2),
      k.g('studied_attacks', 'Studied Attacks', 13, 'If you make an attack roll against a creature and miss, you have Advantage on your next attack roll against that creature before the end of your next turn.'),
    ] },
    16: { grants: [k.mastery(16, MASTERY(16), 'any', 'You can use the mastery properties of six kinds of Simple or Martial weapons.')] },
    17: { grants: [
      k.raise('action_surge', 2),
      k.raise('indomitable', 3),
    ] },
    20: { grants: [k.g('extra_attack_3', 'Three Extra Attacks', 20, 'You can attack four times instead of once whenever you take the Attack action on your turn.', { effects: [stat('extra_attack', 'set', 3)] })] },
  },
  subclass: {
    id: 'champion_2024', name: 'Champion',
    entries: kit => [
      { level: 3, grants: [
        kit.g('champion_improved_critical', 'Improved Critical', 3, 'Your attack rolls with weapons and Unarmed Strikes can score a Critical Hit on a roll of 19 or 20 on the d20.'),
        kit.g('champion_remarkable_athlete', 'Remarkable Athlete', 3, 'You have Advantage on Initiative rolls and Strength (Athletics) checks. In addition, immediately after you score a Critical Hit, you can move up to half your Speed without provoking Opportunity Attacks.',
          { effects: [adv('initiative'), adv('Strength (Athletics) checks')] }),
      ] },
      { level: 7, choices: [kit.pick('additional_fighting_style', 'Additional Fighting Style: choose another Fighting Style feat.', 1, styles(kit))],
        grants: [kit.g('champion_additional_fighting_style', 'Additional Fighting Style', 7, 'You gain another Fighting Style feat of your choice.')] },
      { level: 10, grants: [kit.g('champion_heroic_warrior', 'Heroic Warrior', 10, 'The thrill of battle drives you toward victory. During combat, you can give yourself Heroic Inspiration whenever you start your turn without it.')] },
      { level: 15, grants: [kit.g('champion_superior_critical', 'Superior Critical', 15, 'Your attack rolls with weapons and Unarmed Strikes can now score a Critical Hit on a roll of 18-20 on the d20.')] },
      { level: 18, grants: [kit.g('champion_survivor', 'Survivor', 18, 'You attain the pinnacle of resilience in battle. Defy Death: you have Advantage on Death Saving Throws, and when you roll 18-20 on a Death Saving Throw you gain the benefit of rolling a 20. Heroic Rally: at the start of each of your turns, you regain Hit Points equal to 5 plus your Constitution modifier if you are Bloodied and have at least 1 Hit Point.',
        { effects: [adv('death saving throws')] })] },
    ],
  },
};
