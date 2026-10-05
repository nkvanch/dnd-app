// ============================================================================
// FILE: src/content/classes2024/bard.ts
// Bard (2024 rules), System Reference Document 5.2.1 (Creative Commons Attribution 4.0).
// Bardic Inspiration uses equal your Charisma modifier (minimum 1) and the pool returns on a Short Rest
// from level 5. Full caster; the Prepared Spells column drives the spell picks. Magical Secrets and the
// College of Lore's Magical Discoveries draw on other classes' lists, which the spell picker does not
// offer, so those are described on the feature (add the spells with + Add Spell). Subclass: College of Lore.
// ============================================================================
import { ClassDef, classKit, activation, adv } from './builder';
import { ALL_TOOLS } from '../tools';

const classId = 'bard_2024';
const k = classKit(classId);
const ALL_SKILLS = ['acrobatics', 'animal_handling', 'arcana', 'athletics', 'deception', 'history', 'insight', 'intimidation', 'investigation',
  'medicine', 'nature', 'perception', 'performance', 'persuasion', 'religion', 'sleight_of_hand', 'stealth', 'survival'];

const insp = (die: string, extra = '') =>
  `You can supernaturally inspire others through words, music, or dance. Your Bardic Inspiration die is a ${die}. As a Bonus Action you can inspire another creature within 60 feet who can see or hear you; it gains one of your Bardic Inspiration dice (a creature can have only one at a time). Once within the next hour when that creature fails a D20 Test, it can roll the die and add the number to the d20, potentially turning the failure into a success; the die is expended when rolled. You can confer the die a number of times equal to your Charisma modifier (minimum of once), and you regain all expended uses when you finish a Long Rest. The die is a d6, becoming a d8 at level 5, a d10 at level 10, and a d12 at level 15.${extra}`;

export const bard2024: ClassDef = {
  key: 'bard', name: 'Bard', hitDie: 8, savingThrows: ['dex', 'cha'],
  description: 'An inspiring performer who weaves magic through words, music and dance. (2024 rules.)',
  armorProfs: ['light'], weaponProfs: ['simple'],
  startingProficiency: { armor: ['light'], weapons: ['simple'] },
  multiclass: { armor: ['light'], tools: ['Musical Instrument'] },
  asiLevels: [4, 8, 12, 16, 19],
  caster: {
    ability: 'cha', style: 'full', policy: 'known', ritual: 'known',
    cantrips: [2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
    prepared: [4, 5, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 17, 18, 18, 19, 20, 21, 22],
  },
  levels: {
    1: {
      choices: [
        k.skills(3, ALL_SKILLS),
        { id: `${classId}_instruments`, prompt: 'Choose 3 Musical Instruments.', kind: 'tool', count: 3, grants: [], required: true, resolved: false,
          pool: ALL_TOOLS.filter(t => t.category === 'musical_instrument').map(t => ({ id: t.id, label: t.name, value: t.id })) },
        k.equip('start', 'Starting equipment: (A) Leather Armor, 2 Daggers, a Musical Instrument, Entertainer\'s Pack, and 19 GP; or (B) 90 GP (add the gold on your sheet).', [
          { id: 'a', label: 'A: Leather Armor, 2 Daggers, Entertainer\'s Pack, 19 GP', items: ['leather_armor', 'dagger', 'dagger', 'entertainers_pack'] },
          { id: 'b', label: 'B: 90 GP', items: [] },
        ]),
      ],
      grants: [
        k.g('bardic_inspiration', 'Bardic Inspiration', 1, insp('d6'),
          { activation: activation('bonus_action', { resource: 'bardic_inspiration', range: '60 feet', target: 'single' }), tags: ['buff'] }),
        { kind: 'resource', value: { resourceId: 'bardic_inspiration', name: 'Bardic Inspiration', maximum: 1, recharge: 'long_rest', perAbilityModifier: 'cha' } },
        k.g('spellcasting', 'Spellcasting', 1, 'You cast spells through your bardic arts using Charisma as your spellcasting ability. You know two cantrips from the Bard spell list (a third at level 4, a fourth at level 10) and can replace one whenever you gain a Bard level. You prepare level 1+ spells from the Bard spell list, the number shown in the Prepared Spells column, and can replace one whenever you gain a Bard level. You regain all expended slots on a Long Rest. You can use a Musical Instrument as a Spellcasting Focus.'),
      ],
    },
    2: {
      choices: [k.expertise('expertise_2', 2, 'Expertise: choose two of your skill proficiencies. (Performance and Persuasion are recommended.)')],
      grants: [
        k.g('expertise', 'Expertise', 2, 'You gain Expertise in two of your skill proficiencies of your choice, and in two more at Bard level 9.'),
        k.g('jack_of_all_trades', 'Jack of All Trades', 2, 'You can add half your Proficiency Bonus (round down) to any ability check you make that uses a skill proficiency you lack and that doesn\'t otherwise use your Proficiency Bonus.'),
      ],
    },
    3: { choices: [k.subclassChoice('Bard Subclass')], grants: [k.g('subclass', 'Bard Subclass', 3, 'You gain a Bard subclass of your choice.')] },
    5: { grants: [
      { kind: 'resource_upgrade', value: { resourceId: 'bardic_inspiration', newMaximum: 1, recharge: 'short_rest' } },
      k.g('bardic_inspiration', 'Bardic Inspiration (d8)', 5, insp('d8'), { upgradeOf: 'bardic_inspiration', activation: activation('bonus_action', { resource: 'bardic_inspiration', range: '60 feet', target: 'single' }), tags: ['buff'] }),
      k.g('font_of_inspiration', 'Font of Inspiration', 5, 'You now regain all your expended uses of Bardic Inspiration when you finish a Short or Long Rest. In addition, you can expend a spell slot (no action required) to regain one expended use of Bardic Inspiration.'),
    ] },
    7: { grants: [k.g('countercharm', 'Countercharm', 7, 'If you or a creature within 30 feet of you fails a saving throw against an effect that applies the Charmed or Frightened condition, you can take a Reaction to cause the save to be rerolled, and the new roll has Advantage.',
      { trigger: 'You or a creature within 30 feet fails a saving throw against a Charmed or Frightened effect.', activation: activation('reaction', { range: '30 feet', target: 'single' }), tags: ['utility'] })] },
    9: { choices: [k.expertise('expertise_9', 2, 'Expertise: choose two more of your skill proficiencies.')] },
    10: { grants: [
      k.g('bardic_inspiration', 'Bardic Inspiration (d10)', 10, insp('d10'), { upgradeOf: 'bardic_inspiration', activation: activation('bonus_action', { resource: 'bardic_inspiration', range: '60 feet', target: 'single' }), tags: ['buff'] }),
      k.g('magical_secrets', 'Magical Secrets', 10, 'You\'ve learned secrets from various magical traditions. Whenever you reach a Bard level (including this one) and the Prepared Spells number increases, you can choose any of your new prepared spells from the Bard, Cleric, Druid, and Wizard spell lists, and the chosen spells count as Bard spells for you. In addition, whenever you replace a spell prepared for this class, you can replace it with a spell from those lists. (The spell picker shows the Bard list; add spells from the other lists with + Add Spell on your sheet.)'),
    ] },
    15: { grants: [k.g('bardic_inspiration', 'Bardic Inspiration (d12)', 15, insp('d12'), { upgradeOf: 'bardic_inspiration', activation: activation('bonus_action', { resource: 'bardic_inspiration', range: '60 feet', target: 'single' }), tags: ['buff'] })] },
    18: { grants: [k.g('superior_inspiration', 'Superior Inspiration', 18, 'When you roll Initiative, you regain expended uses of Bardic Inspiration until you have two if you have fewer than that.', { trigger: 'You roll Initiative.' })] },
    20: { grants: [k.g('words_of_creation', 'Words of Creation', 20, 'You have mastered two of the Words of Creation: the words of life and death. You always have the Power Word Heal and Power Word Kill spells prepared. When you cast either spell, you can target a second creature with it if that creature is within 10 feet of the first target.')] },
  },
  subclass: {
    id: 'lore_2024', name: 'College of Lore',
    entries: kit => [
      { level: 3, grants: [
        kit.g('lore_bonus_proficiencies', 'Bonus Proficiencies', 3, 'You gain proficiency with three skills of your choice.'),
        kit.g('lore_cutting_words', 'Cutting Words', 3, 'When a creature that you can see within 60 feet makes a damage roll or succeeds on an ability check or attack roll, you can take a Reaction to expend one use of your Bardic Inspiration; roll the die and subtract the number rolled from the creature\'s roll, reducing the damage or potentially turning the success into a failure.',
          { trigger: 'A creature within 60 feet makes a damage roll or succeeds on an ability check or attack roll.', activation: activation('reaction', { resource: 'bardic_inspiration', range: '60 feet', target: 'single' }), tags: ['control'] }),
      ], choices: [k.skills(3, ALL_SKILLS)] },
      { level: 6, grants: [kit.g('lore_magical_discoveries', 'Magical Discoveries', 6, 'You learn two spells of your choice from the Cleric, Druid, or Wizard spell list (any combination); each must be a cantrip or a spell for which you have spell slots. You always have them prepared, and whenever you gain a Bard level you can replace one with another that meets these requirements. (Add them with + Add Spell on your sheet.)')] },
      { level: 14, grants: [kit.g('lore_peerless_skill', 'Peerless Skill', 14, 'When you make an ability check or attack roll and fail, you can expend one use of Bardic Inspiration; roll the die and add the number to the d20, potentially turning the failure into a success. On a failure, the Bardic Inspiration isn\'t expended.',
        { trigger: 'You fail an ability check or attack roll.', activation: activation('free', { resource: 'bardic_inspiration' }), tags: ['buff'] })] },
    ],
  },
};
void adv;
