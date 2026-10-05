// ============================================================================
// FILE: src/content/classes2024/druid.ts
// Druid (2024 rules), System Reference Document 5.2.1 (Creative Commons Attribution 4.0).
// Wild Shape is a pool (2 uses, 3 from level 6, 4 from level 17) and each beast form the app has is a
// Transform feature. The SRD gives 4/6/8 known forms by level; the app's monster library has only three
// beast forms (Wolf, Giant Spider, Brown Bear), so Wolf comes at level 2 and the other two at level 8
// (Challenge Rating 1), and Known Forms is not a picker. Elemental Fury is a real choice. Subclass:
// Circle of the Land, whose land type is chosen once (the SRD lets you change it after every Long Rest:
// remove the feature and choose again) and whose circle spells arrive at Druid levels 3, 5, 7 and 9.
// ============================================================================
import { ClassDef, classKit, activation } from './builder';
import { Effect } from '../../engine/types';

const classId = 'druid_2024';
const k = classKit(classId);
const WILD = (lv: number) => (lv >= 17 ? 4 : lv >= 6 ? 3 : 2);

const spell = (ids: string[], fromLevel: number): Effect =>
  ({ type: 'grant_spell', target: '', operation: 'add', value: null, condition: null, spellIds: ids, spellcastingAbility: 'wis', minLevel: fromLevel });
const cantrip = (ids: string[]): Effect =>
  ({ type: 'grant_spell', target: '', operation: 'add', value: null, condition: null, cantripIds: ids, spellcastingAbility: 'wis', minLevel: 3 });
const wardResist = (type: string): Effect => ({ type: 'grant_resistance', target: type, operation: 'resistance', value: null, condition: null, minLevel: 10 });

const wildShape = (key: string, name: string, level: number, formId: string, cr: string) =>
  k.g(`wild_shape_${key}`, `Wild Shape: ${name}`, level,
    `As a Bonus Action you shape-shift into a ${name} (Beast, CR ${cr}). You stay in the form for a number of hours equal to half your Druid level or until you use Wild Shape again, have the Incapacitated condition, or die; you can leave it early as a Bonus Action. When you assume the form you gain Temporary Hit Points equal to your Druid level. Your game statistics are replaced by the Beast's, but you keep your creature type, Hit Points, Intelligence, Wisdom and Charisma scores, class features and proficiencies. You can't cast spells (shapeshifting doesn't break Concentration).`,
    { activation: activation('bonus_action', { resource: 'wild_shape_pool' }), abilityEffects: [{ type: 'transform', formId }], tags: ['transformation'] });

export const druid2024: ClassDef = {
  key: 'druid', name: 'Druid', hitDie: 8, savingThrows: ['int', 'wis'],
  description: 'A priest of the old faith who wields nature\'s power and assumes animal forms. (2024 rules.)',
  armorProfs: ['light', 'shield'], weaponProfs: ['simple'], toolProfs: ['Herbalism Kit'],
  startingProficiency: { armor: ['light', 'shield'], weapons: ['simple'], tools: ['Herbalism Kit'] },
  multiclass: { armor: ['light', 'shield'] },
  asiLevels: [4, 8, 12, 16, 19],
  caster: {
    ability: 'wis', style: 'full', policy: 'full_list_prepared', ritual: 'prepared', pickPrepared: false,
    cantrips: [2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
    prepared: [4, 5, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 17, 18, 18, 19, 20, 21, 22],
  },
  levels: {
    1: {
      choices: [
        k.skills(2, ['animal_handling', 'arcana', 'insight', 'medicine', 'nature', 'perception', 'religion', 'survival']),
        k.equip('start', 'Starting equipment: (A) Leather Armor, Shield, Sickle, Druidic Focus (Quarterstaff), Explorer\'s Pack, Herbalism Kit, and 9 GP; or (B) 50 GP.', [
          { id: 'a', label: 'A: Leather Armor, Shield, Sickle, Druidic Focus, Explorer\'s Pack, 9 GP', items: ['leather_armor', 'shield', 'sickle', 'druidic_focus', 'explorers_pack'], gold: 9 },
          { id: 'b', label: 'B: 50 GP', items: [], gold: 50 },
        ]),
        k.pick('primal_order', 'Primal Order: choose a sacred role.', 1, [
          k.option('primal_order_magician', 'Magician', 1, 'You know one extra cantrip from the Druid spell list (choose it below). Your mystical connection to nature gives you a bonus to your Intelligence (Arcana or Nature) checks equal to your Wisdom modifier (minimum +1).',
            { grantsChoices: [k.spellsFrom('magician_cantrip', 1, 'Magician: choose one extra Druid cantrip.', { lists: ['druid_2024'], label: 'Magician cantrip' })] }),
          k.option('primal_order_warden', 'Warden', 1, 'Trained for battle, you gain proficiency with Martial weapons and training with Medium armor.',
            { effects: [{ type: 'grant_proficiency', target: 'weapon:martial', operation: 'add', value: null, condition: null }, { type: 'grant_proficiency', target: 'armor:medium', operation: 'add', value: null, condition: null }] }),
        ]),
      ],
      grants: [
        k.g('spellcasting', 'Spellcasting', 1, 'You cast spells through the mystical forces of nature using Wisdom as your spellcasting ability. You know two cantrips from the Druid spell list (a third at level 4, a fourth at level 10) and can replace one whenever you gain a Druid level. You prepare level 1+ spells from the whole Druid list, the number shown in the Prepared Spells column, and can change the list after each Long Rest. You can use a Druidic Focus as a Spellcasting Focus.'),
        k.g('druidic', 'Druidic', 1, 'You know Druidic, the secret language of Druids, and can use it to leave hidden messages (others spot a message with a DC 15 Intelligence (Investigation) check but can\'t decipher it without magic). You always have the Speak with Animals spell prepared.'),
        { kind: 'known_spells', value: { spellIds: ['speak_with_animals'] } },
        k.g('primal_order', 'Primal Order', 1, 'You have dedicated yourself to a sacred role of your choice: Magician (an extra cantrip and a Wisdom-modifier bonus to Arcana and Nature checks) or Warden (Martial weapons and Medium armor).'),
      ],
    },
    2: { grants: [
      k.pool('wild_shape_pool', 'Wild Shape', WILD(2), 'long_rest'),
      k.g('wild_shape', 'Wild Shape', 2, 'The power of nature allows you to assume the form of an animal. You can use Wild Shape twice (three times from level 6, four from level 17); you regain one expended use on a Short Rest and all expended uses on a Long Rest. Use the beast form features below to shape-shift. At level 8 you can adopt a form that has a Fly Speed.'),
      wildShape('wolf', 'Wolf', 2, 'wolf', '1/4'),
      k.g('wild_companion', 'Wild Companion', 2, 'As a Magic action, you can expend a spell slot or a use of Wild Shape to cast the Find Familiar spell without Material components. When you cast it this way the familiar is Fey and disappears when you finish a Long Rest.',
        { activation: activation('action', { range: '10 feet' }), abilityEffects: [{ type: 'cast_spell', spellId: 'find_familiar' }], tags: ['utility'] }),
    ] },
    3: { choices: [k.subclassChoice('Druid Subclass')], grants: [k.g('subclass', 'Druid Subclass', 3, 'You gain a Druid subclass of your choice.')] },
    5: { grants: [k.g('wild_resurgence', 'Wild Resurgence', 5, 'Once on each of your turns, if you have no uses of Wild Shape left, you can give yourself one use by expending a spell slot (no action required). In addition, you can expend one use of Wild Shape (no action required) to give yourself a level 1 spell slot, but you can\'t do so again until you finish a Long Rest.')] },
    6: { grants: [k.raise('wild_shape_pool', WILD(6))] },
    7: {
      choices: [k.pick('elemental_fury', 'Elemental Fury: choose one option.', 1, [
        k.option('fury_potent_spellcasting', 'Potent Spellcasting', 7, 'Add your Wisdom modifier to the damage you deal with any Druid cantrip. At level 15, when you cast a Druid cantrip with a range of 10 feet or greater, the spell\'s range increases by 300 feet.'),
        k.option('fury_primal_strike', 'Primal Strike', 7, 'Once on each of your turns when you hit a creature with an attack roll using a weapon or a Beast form\'s attack in Wild Shape, you can cause the target to take an extra 1d8 Cold, Fire, Lightning, or Thunder damage (choose when you hit). At level 15 the extra damage increases to 2d8.',
          { activation: activation('free', { range: '5 feet', target: 'single' }), abilityEffects: [{ type: 'damage', dice: '1d8', damageType: 'fire', diceByLevel: [{ level: 15, dice: '2d8' }] }], tags: ['damage'] }),
      ])],
      grants: [k.g('elemental_fury', 'Elemental Fury', 7, 'The might of the elements flows through you. You gain one of two options of your choice: Potent Spellcasting or Primal Strike. At level 15 the chosen option grows more powerful (Improved Elemental Fury).')],
    },
    8: { grants: [
      wildShape('giant_spider', 'Giant Spider', 8, 'giant_spider', '1'),
      wildShape('brown_bear', 'Brown Bear', 8, 'brown_bear', '1'),
    ] },
    15: { grants: [k.g('improved_elemental_fury', 'Improved Elemental Fury', 15, 'The option you chose for Elemental Fury grows more powerful. Potent Spellcasting: when you cast a Druid cantrip with a range of 10 feet or greater, the spell\'s range increases by 300 feet. Primal Strike: the extra damage increases to 2d8.')] },
    17: { grants: [k.raise('wild_shape_pool', WILD(17))] },
    18: { grants: [k.g('beast_spells', 'Beast Spells', 18, 'While using Wild Shape, you can cast spells in Beast form, except for any spell that has a Material component with a cost specified or that consumes its Material component.')] },
    20: { grants: [k.g('archdruid', 'Archdruid', 20, 'The vitality of nature constantly blooms within you. Evergreen Wild Shape: whenever you roll Initiative and have no uses of Wild Shape left, you regain one expended use. Nature Magician: you can convert unexpended uses of Wild Shape into a single spell slot (no action required), each use contributing 2 spell levels; once you use this benefit you can\'t do so again until you finish a Long Rest. Longevity: for every ten years that pass, your body ages only one year.')] },
  },
  subclass: {
    id: 'land_2024', name: 'Circle of the Land',
    entries: kit => {
      const land = (key: string, name: string, c3: string[], cantrips: string[], s5: string, s7: string, s9: string, resist: string) =>
        kit.option(key, `${name} Land`, 3,
          `Circle Spells (${name}): ${[...cantrips, ...c3].join(', ')} at level 3, then ${s5.replace(/_/g, ' ')} (5), ${s7.replace(/_/g, ' ')} (7) and ${s9.replace(/_/g, ' ')} (9) are always prepared. At level 10 you also have Resistance to ${resist} damage (Nature's Ward).`,
          { effects: [cantrip(cantrips), spell(c3, 3), spell([s5], 5), spell([s7], 7), spell([s9], 9), wardResist(resist)] });
      return [
        { level: 3, choices: [kit.pick('land_type', 'Circle Spells: choose a type of land (arid, polar, temperate, or tropical).', 1, [
            land('arid', 'Arid', ['blur', 'burning_hands'], ['firebolt'], 'fireball', 'blight', 'wall_of_stone', 'fire'),
            land('polar', 'Polar', ['fog_cloud', 'hold_person'], ['ray_of_frost'], 'sleet_storm', 'ice_storm', 'cone_of_cold', 'cold'),
            land('temperate', 'Temperate', ['misty_step', 'sleep_spell'], ['shocking_grasp'], 'lightning_bolt', 'freedom_of_movement', 'tree_stride', 'lightning'),
            land('tropical', 'Tropical', ['ray_of_sickness', 'web'], ['acid_splash'], 'stinking_cloud', 'polymorph', 'insect_plague', 'poison'),
          ])],
          grants: [
            kit.g('land_circle_spells', 'Circle of the Land Spells', 3, 'Whenever you finish a Long Rest you choose one type of land (arid, polar, temperate, or tropical); you have the spells listed for your Druid level and lower prepared. (Choose your land below; to change it after a Long Rest, remove the land feature on the Features tab and choose again.)'),
            kit.g('land_lands_aid', "Land's Aid", 3, 'As a Magic action, you can expend a use of your Wild Shape and choose a point within 60 feet. Vitality-giving flowers and life-draining thorns appear in a 10-foot-radius Sphere centered on that point. Each creature of your choice in the Sphere makes a Constitution saving throw against your spell save DC, taking 2d6 Necrotic damage on a failed save or half as much on a success. One creature of your choice in the area regains 2d6 Hit Points. The damage and healing increase by 1d6 at Druid levels 10 (3d6) and 14 (4d6).',
              { activation: activation('action', { resource: 'wild_shape_pool', range: '60 feet', target: 'area', requiresSave: { ability: 'con', dc: 'spell_save_dc' } }),
                abilityEffects: [{ type: 'damage', dice: '2d6', damageType: 'necrotic', saveOnSuccess: 'half', diceByLevel: [{ level: 10, dice: '3d6' }, { level: 14, dice: '4d6' }] }], tags: ['damage', 'healing', 'aoe', 'save'] }),
          ] },
        { level: 6, grants: [kit.g('land_natural_recovery', 'Natural Recovery', 6, 'You can cast one of the level 1+ spells you have prepared from your Circle Spells feature without expending a spell slot, and must finish a Long Rest before you do so again. In addition, when you finish a Short Rest you can choose expended spell slots to recover, with a combined level equal to or less than half your Druid level (round up) and none of them level 6+; once you recover slots this way you can\'t do so again until you finish a Long Rest.')] },
        { level: 10, grants: [kit.g('land_natures_ward', "Nature's Ward", 10, 'You are immune to the Poisoned condition, and you have Resistance to a damage type associated with your current land choice: Fire (arid), Cold (polar), Lightning (temperate), or Poison (tropical).',
          { effects: [{ type: 'condition_immunity', target: 'poisoned', operation: 'immunity', value: null, condition: null }] })] },
        { level: 14, grants: [kit.g('land_natures_sanctuary', "Nature's Sanctuary", 14, 'As a Magic action, you can expend a use of your Wild Shape and cause spectral trees and vines to appear in a 15-foot Cube on the ground within 120 feet. They last 1 minute or until you have the Incapacitated condition or die. You and your allies have Half Cover while in that area, and your allies gain the current Resistance of your Nature\'s Ward while there. As a Bonus Action you can move the Cube up to 60 feet to ground within 120 feet.',
          { activation: activation('action', { resource: 'wild_shape_pool', range: '120 feet', target: 'area' }), tags: ['buff', 'aoe'] })] },
      ];
    },
  },
};
