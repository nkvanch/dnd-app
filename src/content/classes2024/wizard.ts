// ============================================================================
// FILE: src/content/classes2024/wizard.ts
// Wizard (2024 rules), System Reference Document 5.2.1 (Creative Commons Attribution 4.0).
// Full caster with a spellbook: six level 1 spells at creation and two more spells at every level after the
// first (those picks are the spellbook; the Prepared Spells column is how many of them you prepare, chosen
// on the spell tab). Arcane Recovery and Signature Spells are pools. Subclass: Evoker (Evocation Savant adds
// free Evocation spells to the spellbook at each new slot level).
// ============================================================================
import { ClassDef, classKit, activation } from './builder';

const classId = 'wizard_2024';
const k = classKit(classId);
const NEW_SLOT_LEVELS = [5, 7, 9, 11, 13, 15, 17];   // Wizard levels at which a new level of spell slots first appears (after 3)

const spellbookLevels: ClassDef['levels'] = {};
for (let lv = 2; lv <= 20; lv++) spellbookLevels[lv] = { choices: [k.spells(`spellbook_${lv}`, 2, 'Add 2 Wizard spells to your spellbook (of a level for which you have spell slots).')] };

export const wizard2024: ClassDef = {
  key: 'wizard', name: 'Wizard', hitDie: 6, savingThrows: ['int', 'wis'],
  description: 'A scholarly magic-user capable of manipulating the structures of reality with a spellbook. (2024 rules.)',
  armorProfs: [], weaponProfs: ['simple'],
  startingProficiency: { armor: [], weapons: ['simple'] },
  multiclass: {},
  asiLevels: [4, 8, 12, 16, 19],
  caster: {
    ability: 'int', style: 'full', policy: 'spellbook_prepared', ritual: 'spellbook', pickPrepared: false,
    cantrips: [3, 3, 3, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
    prepared: [4, 5, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 18, 19, 21, 22, 23, 24, 25],
  },
  levels: {
    ...spellbookLevels,
    1: {
      choices: [
        k.skills(2, ['arcana', 'history', 'insight', 'investigation', 'medicine', 'nature', 'religion']),
        k.equip('start', 'Starting equipment: (A) 2 Daggers, Arcane Focus (Quarterstaff), Robe, Spellbook, Scholar\'s Pack, and 5 GP; or (B) 55 GP (add the gold on your sheet).', [
          { id: 'a', label: 'A: 2 Daggers, Quarterstaff, Spellbook, Scholar\'s Pack, 5 GP', items: ['dagger', 'dagger', 'quarterstaff', 'spellbook', 'scholars_pack'] },
          { id: 'b', label: 'B: 55 GP', items: [] },
        ]),
        k.spells('spellbook_1', 6, 'Choose six level 1 Wizard spells for your spellbook. (Detect Magic, Feather Fall, Mage Armor, Magic Missile, Sleep and Thunderwave are recommended.)'),
      ],
      grants: [
        k.g('spellcasting', 'Spellcasting', 1, 'As a student of arcane magic, you cast spells using Intelligence as your spellcasting ability. You know three Wizard cantrips (a fourth at level 4, a fifth at level 10); whenever you finish a Long Rest you can replace one. Your spellbook holds your level 1+ spells: six at the start, and two more whenever you gain a Wizard level after 1. You prepare the number of spells in the Prepared Spells column from the book (of a level for which you have slots) and can change the list after each Long Rest. You can use an Arcane Focus or your spellbook as a Spellcasting Focus.'),
        k.g('ritual_adept', 'Ritual Adept', 1, 'You can cast any spell as a Ritual if that spell has the Ritual tag and the spell is in your spellbook. You needn\'t have the spell prepared, but you must read from the book to cast a spell in this way.'),
        k.g('arcane_recovery', 'Arcane Recovery', 1, 'When you finish a Short Rest, you can choose expended spell slots to recover. The slots can have a combined level equal to no more than half your Wizard level (round up), and none of them can be level 6 or higher. Once you use this feature, you can\'t do so again until you finish a Long Rest.',
          { activation: activation('free', { resource: 'arcane_recovery' }), tags: ['utility'] }),
        k.pool('arcane_recovery', 'Arcane Recovery', 1, 'long_rest'),
      ],
    },
    2: {
      choices: [...(spellbookLevels[2]?.choices ?? []), k.expertise('scholar', 1, 'Scholar: choose one of Arcana, History, Investigation, Medicine, Nature, or Religion in which you have proficiency to gain Expertise.')],
      grants: [k.g('scholar', 'Scholar', 2, 'While studying magic, you also specialized in another field of study. Choose one of the following skills in which you have proficiency: Arcana, History, Investigation, Medicine, Nature, or Religion. You have Expertise in the chosen skill.')],
    },
    3: { choices: [...(spellbookLevels[3]?.choices ?? []), k.subclassChoice('Wizard Subclass')], grants: [k.g('subclass', 'Wizard Subclass', 3, 'You gain a Wizard subclass of your choice.')] },
    5: { choices: spellbookLevels[5]?.choices, grants: [k.g('memorize_spell', 'Memorize Spell', 5, 'Whenever you finish a Short Rest, you can study your spellbook and replace one of the level 1+ Wizard spells you have prepared for your Spellcasting feature with another level 1+ spell from the book.')] },
    18: { choices: spellbookLevels[18]?.choices, grants: [k.g('spell_mastery', 'Spell Mastery', 18, 'Choose a level 1 and a level 2 spell in your spellbook that have a casting time of an action. You always have those spells prepared, and you can cast them at their lowest level without expending a spell slot. To cast either spell at a higher level, you must expend a spell slot. Whenever you finish a Long Rest, you can study your spellbook and replace one of those spells with an eligible spell of the same level from the book.')] },
    20: { choices: spellbookLevels[20]?.choices, grants: [
      k.g('signature_spells', 'Signature Spells', 20, 'Choose two level 3 spells in your spellbook as your signature spells. You always have these spells prepared, and you can cast each of them once at level 3 without expending a spell slot. When you do so, you can\'t cast them in this way again until you finish a Short or Long Rest. To cast either spell at a higher level, you must expend a spell slot.',
        { activation: activation('free', { resource: 'signature_spells' }), tags: ['utility'] }),
      k.pool('signature_spells', 'Signature Spells (free casts)', 2, 'short_rest'),
    ] },
  },
  subclass: {
    id: 'evoker_2024', name: 'Evoker',
    entries: kit => [
      { level: 3,
        choices: [kit.spells('evocation_savant_3', 2, 'Evocation Savant: choose two Wizard spells from the Evocation school, each no higher than level 2, to add to your spellbook for free.')],
        grants: [
          kit.g('evoker_evocation_savant', 'Evocation Savant', 3, 'Choose two Wizard spells from the Evocation school, each no higher than level 2, and add them to your spellbook for free. In addition, whenever you gain access to a new level of spell slots as a Wizard, you can add one Wizard spell from the Evocation school to your spellbook for free; it must be of a level for which you have spell slots.'),
          kit.g('evoker_potent_cantrip', 'Potent Cantrip', 3, 'Your damaging cantrips affect even creatures that avoid the brunt of the effect. When you cast a cantrip at a creature and you miss with the attack roll or the target succeeds on a saving throw against the cantrip, the target takes half the cantrip\'s damage (if any) but suffers no additional effect from the cantrip.'),
        ] },
      ...NEW_SLOT_LEVELS.map(lv => ({ level: lv, grants: [], choices: [kit.spells(`evocation_savant_${lv}`, 1, 'Evocation Savant: you gained a new level of spell slots. Add one Wizard spell from the Evocation school to your spellbook for free.')] })),
      { level: 6, grants: [kit.g('evoker_sculpt_spells', 'Sculpt Spells', 6, 'When you cast an Evocation spell that affects other creatures that you can see, you can choose a number of them equal to 1 plus the spell\'s level. The chosen creatures automatically succeed on their saving throws against the spell, and they take no damage if they would normally take half damage on a successful save.')] },
      { level: 10, grants: [kit.g('evoker_empowered_evocation', 'Empowered Evocation', 10, 'Whenever you cast a Wizard spell from the Evocation school, you can add your Intelligence modifier to one damage roll of that spell.')] },
      { level: 14, grants: [kit.g('evoker_overchannel', 'Overchannel', 14, 'When you cast a Wizard spell with a spell slot of levels 1-5 that deals damage, you can deal maximum damage with that spell on the turn you cast it. The first time you do so, you suffer no adverse effect. If you use this feature again before you finish a Long Rest, you take 2d12 Necrotic damage for each level of the spell slot immediately after you cast it, and this damage ignores Resistance and Immunity. Each time you use it again before finishing a Long Rest, the Necrotic damage per spell level increases by 1d12.',
        { activation: activation('free'), tags: ['damage'] })] },
    ],
  },
};
