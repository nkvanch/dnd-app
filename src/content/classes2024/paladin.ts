// ============================================================================
// FILE: src/content/classes2024/paladin.ts
// Paladin (2024 rules), System Reference Document 5.2.1 (Creative Commons Attribution 4.0).
// Half caster that casts from level 1 (slots follow the Artificer-style half-caster table: 2 slots at level 1).
// Lay On Hands is a pool of five times the Paladin level. Divine Smite is a spell (spells2024.ts) that
// Paladin's Smite always has prepared and casts once free per Long Rest; Find Steed is the same at level 5.
// Aura of Protection adds the Charisma modifier to every saving throw (the allies' share is table play).
// Subclass: Oath of Devotion.
// ============================================================================
import { ClassDef, classKit, activation } from './builder';
import { ARTIFICER_SLOTS } from '../classes/spellSlotTables';
import { styles } from './fighter';
import { Effect } from '../../engine/types';

const classId = 'paladin_2024';
const k = classKit(classId);
const CHANNEL = (lv: number) => (lv >= 11 ? 3 : 2);
const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;
const auraSaves: Effect[] = ABILITIES.map(ab =>
  ({ type: 'stat_modifier', target: `savingThrows.${ab}`, operation: 'add', value: 0, condition: null, addAbilityModifier: 'cha' } as Effect));
const immune = (condition: string): Effect => ({ type: 'condition_immunity', target: condition, operation: 'immunity', value: null, condition: null });

export const paladin2024: ClassDef = {
  key: 'paladin', name: 'Paladin', hitDie: 10, savingThrows: ['wis', 'cha'],
  description: 'A holy warrior bound to a sacred oath, who smites foes and shields allies. (2024 rules.)',
  armorProfs: ['light', 'medium', 'heavy', 'shield'], weaponProfs: ['simple', 'martial'],
  startingProficiency: { armor: ['light', 'medium', 'heavy', 'shield'], weapons: ['simple', 'martial'] },
  multiclass: { weapons: ['martial'], armor: ['light', 'medium', 'shield'] },
  asiLevels: [4, 8, 12, 16, 19],
  caster: {
    ability: 'cha', style: 'half', policy: 'known', slotsTable: ARTIFICER_SLOTS,
    cantrips: new Array(20).fill(0),
    prepared: [2, 3, 4, 5, 6, 6, 7, 7, 9, 9, 10, 10, 11, 11, 12, 12, 14, 14, 15, 15],
  },
  levels: {
    1: {
      choices: [
        k.skills(2, ['athletics', 'insight', 'intimidation', 'medicine', 'persuasion', 'religion']),
        k.equip('start', 'Starting equipment: (A) Chain Mail, Shield, Longsword, 6 Javelins, Holy Symbol, Priest\'s Pack, and 9 GP; or (B) 150 GP (add the gold on your sheet).', [
          { id: 'a', label: 'A: Chain Mail, Shield, Longsword, 6 Javelins, Holy Symbol, Priest\'s Pack, 9 GP', items: ['chain_mail', 'shield', 'longsword', 'javelin', 'javelin', 'javelin', 'javelin', 'javelin', 'javelin', 'holy_symbol', 'priests_pack'] },
          { id: 'b', label: 'B: 150 GP', items: [] },
        ]),
      ],
      grants: [
        k.g('lay_on_hands', 'Lay On Hands', 1, 'Your blessed touch can heal wounds. You have a pool of healing power, equal to five times your Paladin level, that replenishes when you finish a Long Rest. As a Bonus Action, touch a creature (which could be yourself) and restore Hit Points to it, up to the amount remaining in the pool. You can also expend 5 Hit Points from the pool to remove the Poisoned condition from the creature; those points don\'t also restore Hit Points.',
          { activation: activation('bonus_action', { resource: 'lay_on_hands', range: 'touch', target: 'single' }), tags: ['healing'] }),
        { kind: 'resource', value: { resourceId: 'lay_on_hands', name: 'Lay On Hands', maximum: 5, recharge: 'long_rest', perLevel: 5 } },
        k.g('spellcasting', 'Spellcasting', 1, 'You cast spells through prayer and meditation using Charisma as your spellcasting ability. You prepare the number of level 1+ Paladin spells shown in the Prepared Spells column, of a level for which you have slots, and can replace one after each Long Rest. You can use a Holy Symbol as a Spellcasting Focus.'),
        k.mastery(1, 2, 'any', 'Your training with weapons allows you to use the mastery properties of two kinds of weapons of your choice with which you have proficiency, such as Longswords and Javelins. Whenever you finish a Long Rest, you can change the kinds of weapons you chose.', true),
      ],
    },
    2: {
      choices: [k.pick('fighting_style', 'Fighting Style: choose a Fighting Style feat, or Blessed Warrior.', 1, [
        ...styles(k),
        k.option('fighting_style_blessed_warrior', 'Blessed Warrior', 2, 'You learn two Cleric cantrips of your choice (Guidance and Sacred Flame are recommended). They count as Paladin spells for you, and Charisma is your spellcasting ability for them. Whenever you gain a Paladin level, you can replace one of these cantrips with another Cleric cantrip. (Add them with + Add Spell on your sheet.)'),
      ])],
      grants: [
        k.g('fighting_style', 'Fighting Style', 2, 'You gain a Fighting Style feat of your choice, or the Blessed Warrior option.'),
        k.g('paladins_smite', 'Paladin\'s Smite', 2, 'You always have the Divine Smite spell prepared. In addition, you can cast it without expending a spell slot, but you must finish a Long Rest before you can cast it in this way again.',
          { activation: activation('free', { resource: 'paladins_smite' }), tags: ['damage'] }),
        k.pool('paladins_smite', 'Paladin\'s Smite (free Divine Smite)', 1, 'long_rest'),
        { kind: 'known_spells', value: { spellIds: ['divine_smite'] } },
      ],
    },
    3: { choices: [k.subclassChoice('Paladin Subclass')], grants: [
      k.g('subclass', 'Paladin Subclass', 3, 'You gain a Paladin subclass of your choice.'),
      k.g('channel_divinity', 'Channel Divinity', 3, 'You can channel divine energy directly from the Outer Planes. You can use it twice (a third use at level 11); you regain one expended use on a Short Rest and all on a Long Rest. If an effect requires a saving throw, the DC equals your spell save DC. You start with Divine Sense; other Paladin features add options.'),
      k.pool('channel_divinity', 'Channel Divinity', CHANNEL(3), 'long_rest'),
      k.g('divine_sense', 'Divine Sense', 3, 'As a Bonus Action, you can open your awareness to detect Celestials, Fiends, and Undead. For the next 10 minutes or until you have the Incapacitated condition, you know the location of any creature of those types within 60 feet and its creature type. Within the same radius you also detect any place or object that has been consecrated or desecrated, as with the Hallow spell.',
        { activation: activation('bonus_action', { resource: 'channel_divinity', range: '60 feet', target: 'area' }), tags: ['utility'] }),
    ] },
    5: { grants: [
      k.extraAttack(5),
      k.g('faithful_steed', 'Faithful Steed', 5, 'You can call on the aid of an otherworldly steed. You always have the Find Steed spell prepared. You can also cast it once without expending a spell slot, and you regain the ability to do so when you finish a Long Rest.',
        { activation: activation('free', { resource: 'faithful_steed' }), tags: ['utility'] }),
      k.pool('faithful_steed', 'Faithful Steed (free Find Steed)', 1, 'long_rest'),
      { kind: 'known_spells', value: { spellIds: ['find_steed'] } },
    ] },
    6: { grants: [k.g('aura_of_protection', 'Aura of Protection', 6, 'You radiate a protective, unseeable aura in a 10-foot Emanation that originates from you; it is inactive while you have the Incapacitated condition. You and your allies in the aura gain a bonus to saving throws equal to your Charisma modifier (minimum bonus of +1). If another Paladin is present, a creature can benefit from only one Aura of Protection at a time. (Your own bonus is applied to your saving throws; allies add it themselves.)',
      { effects: auraSaves })] },
    9: { grants: [k.g('abjure_foes', 'Abjure Foes', 9, 'As a Magic action, you can expend one use of Channel Divinity to overwhelm foes with awe. Target a number of creatures equal to your Charisma modifier (minimum of one) that you can see within 60 feet. Each must succeed on a Wisdom saving throw or have the Frightened condition for 1 minute or until it takes any damage. While Frightened this way, a target can do only one of the following on its turns: move, take an action, or take a Bonus Action.',
      { activation: activation('action', { resource: 'channel_divinity', range: '60 feet', target: 'multiple', requiresSave: { ability: 'wis', dc: 'spell_save_dc' } }), tags: ['control', 'save'] })] },
    10: { grants: [k.g('aura_of_courage', 'Aura of Courage', 10, 'You and your allies have Immunity to the Frightened condition while in your Aura of Protection. If a Frightened ally enters the aura, that condition has no effect on that ally while there.',
      { effects: [immune('frightened')] })] },
    11: { grants: [
      k.raise('channel_divinity', CHANNEL(11)),
      k.g('radiant_strikes', 'Radiant Strikes', 11, 'Your strikes now carry supernatural power. When you hit a target with an attack roll using a Melee weapon or an Unarmed Strike, the target takes an extra 1d8 Radiant damage.',
        { activation: activation('free', { range: '5 feet', target: 'single' }), abilityEffects: [{ type: 'damage', dice: '1d8', damageType: 'radiant' }], tags: ['damage'] }),
    ] },
    14: { grants: [k.g('restoring_touch', 'Restoring Touch', 14, 'When you use Lay On Hands on a creature, you can also remove one or more of these conditions from it: Blinded, Charmed, Deafened, Frightened, Paralyzed, or Stunned. You must expend 5 Hit Points from the healing pool for each condition you remove; those points don\'t also restore Hit Points.')] },
    18: { grants: [k.g('aura_expansion', 'Aura Expansion', 18, 'Your Aura of Protection is now a 30-foot Emanation.')] },
  },
  subclass: {
    id: 'devotion_2024', name: 'Oath of Devotion',
    entries: kit => [
      { level: 3, grants: [
        kit.g('devotion_oath_spells', 'Oath of Devotion Spells', 3, 'You always have certain spells prepared: Protection from Evil and Good and Shield of Faith (level 3); Aid and Zone of Truth (level 5); Beacon of Hope and Dispel Magic (level 9); Freedom of Movement and Guardian of Faith (level 13); Commune and Flame Strike (level 17). They don\'t count against your prepared spells.'),
        { kind: 'known_spells', value: { spellIds: ['protection_from_evil_and_good', 'shield_of_faith'] } },
        kit.g('devotion_sacred_weapon', 'Sacred Weapon', 3, 'When you take the Attack action, you can expend one use of Channel Divinity to imbue one Melee weapon you are holding with positive energy. For 10 minutes or until you use this feature again, you add your Charisma modifier to attack rolls with that weapon (minimum bonus of +1), and each time you hit with it you can cause it to deal its normal damage type or Radiant damage. The weapon emits Bright Light in a 20-foot radius and Dim Light 20 feet beyond that. It ends early if you aren\'t carrying the weapon.',
          { activation: activation('free', { resource: 'channel_divinity' }), tags: ['buff'] }),
      ] },
      { level: 5, grants: [{ kind: 'known_spells', value: { spellIds: ['aid', 'zone_of_truth'] } }] },
      { level: 7, grants: [kit.g('devotion_aura_of_devotion', 'Aura of Devotion', 7, 'You and your allies have Immunity to the Charmed condition while in your Aura of Protection. If a Charmed ally enters the aura, that condition has no effect on that ally while there.',
        { effects: [immune('charmed')] })] },
      { level: 9, grants: [{ kind: 'known_spells', value: { spellIds: ['beacon_of_hope', 'dispel_magic'] } }] },
      { level: 13, grants: [{ kind: 'known_spells', value: { spellIds: ['freedom_of_movement', 'guardian_of_faith'] } }] },
      { level: 15, grants: [kit.g('devotion_smite_of_protection', 'Smite of Protection', 15, 'Your magical smite now radiates protective energy. Whenever you cast Divine Smite, you and your allies have Half Cover while in your Aura of Protection. The aura has this benefit until the start of your next turn.')] },
      { level: 17, grants: [{ kind: 'known_spells', value: { spellIds: ['commune', 'flame_strike'] } }] },
      { level: 20, grants: [
        kit.g('devotion_holy_nimbus', 'Holy Nimbus', 20, 'As a Bonus Action, you can imbue your Aura of Protection with holy power for 10 minutes or until you end it (no action required). Holy Ward: you have Advantage on any saving throw you are forced to make by a Fiend or an Undead. Radiant Damage: whenever an enemy starts its turn in the aura, it takes Radiant damage equal to your Charisma modifier plus your Proficiency Bonus. Sunlight: the aura is filled with Bright Light that is sunlight. Once you use this feature you can\'t use it again until you finish a Long Rest, but you can restore it by expending a level 5 spell slot (no action required).',
          { activation: activation('bonus_action', { resource: 'holy_nimbus' }), tags: ['buff'] }),
        { kind: 'resource', value: { resourceId: 'holy_nimbus', name: 'Holy Nimbus', maximum: 1, recharge: 'long_rest' } },
      ] },
    ],
  },
};
