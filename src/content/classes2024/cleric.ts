// ============================================================================
// FILE: src/content/classes2024/cleric.ts
// Cleric (2024 rules), System Reference Document 5.2.1 (Creative Commons Attribution 4.0).
// Channel Divinity is a pool (2, then 3 at level 6, 4 at level 18). Divine Order is a real choice
// (Protector grants Martial weapons and Heavy armor). Blessed Strikes is a real choice; Divine Strike's die
// scales at 14. Clerics prepare from the whole list, so only cantrips are picked at creation.
// Subclass: Life Domain, whose domain spells are always prepared.
// ============================================================================
import { ClassDef, classKit, activation } from './builder';

const classId = 'cleric_2024';
const k = classKit(classId);
const CHANNEL = (lv: number) => (lv >= 18 ? 4 : lv >= 6 ? 3 : 2);

export const cleric2024: ClassDef = {
  key: 'cleric', name: 'Cleric', hitDie: 8, savingThrows: ['wis', 'cha'],
  description: 'A priestly champion who wields divine magic in service of a higher power. (2024 rules.)',
  armorProfs: ['light', 'medium', 'shield'], weaponProfs: ['simple'],
  startingProficiency: { armor: ['light', 'medium', 'shield'], weapons: ['simple'] },
  multiclass: { armor: ['light', 'medium', 'shield'] },
  asiLevels: [4, 8, 12, 16, 19],
  caster: {
    ability: 'wis', style: 'full', policy: 'full_list_prepared', ritual: 'prepared', pickPrepared: false,
    cantrips: [3, 3, 3, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
    prepared: [4, 5, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 17, 18, 18, 19, 20, 21, 22],
  },
  levels: {
    1: {
      choices: [
        k.skills(2, ['history', 'insight', 'medicine', 'persuasion', 'religion']),
        k.equip('start', 'Starting equipment: (A) Chain Shirt, Shield, Mace, Holy Symbol, Priest\'s Pack, and 7 GP; or (B) 110 GP.', [
          { id: 'a', label: 'A: Chain Shirt, Shield, Mace, Holy Symbol, Priest\'s Pack, 7 GP', items: ['chain_shirt', 'shield', 'mace', 'holy_symbol', 'priests_pack'], gold: 7 },
          { id: 'b', label: 'B: 110 GP', items: [], gold: 110 },
        ]),
        k.pick('divine_order', 'Divine Order: choose a sacred role.', 1, [
          k.option('divine_order_protector', 'Protector', 1, 'Trained for battle, you gain proficiency with Martial weapons and training with Heavy armor.',
            { effects: [{ type: 'grant_proficiency', target: 'weapon:martial', operation: 'add', value: null, condition: null }, { type: 'grant_proficiency', target: 'armor:heavy', operation: 'add', value: null, condition: null }] }),
          k.option('divine_order_thaumaturge', 'Thaumaturge', 1, 'You know one extra cantrip from the Cleric spell list (choose it below). In addition, your mystical connection to the divine gives you a bonus to your Intelligence (Arcana or Religion) checks equal to your Wisdom modifier (minimum of +1).',
            { grantsChoices: [k.spellsFrom('thaumaturge_cantrip', 1, 'Thaumaturge: choose one extra Cleric cantrip.', { lists: ['cleric_2024'], label: 'Thaumaturge cantrip' })] }),
        ]),
      ],
      grants: [
        k.g('spellcasting', 'Spellcasting', 1, 'You cast spells through prayer and meditation using Wisdom as your spellcasting ability. You know three cantrips from the Cleric spell list (a fourth at level 4, a fifth at level 10) and can replace one whenever you gain a Cleric level. You prepare level 1+ spells from the whole Cleric list, the number shown in the Prepared Spells column, and can change the list after each Long Rest. You can use a Holy Symbol as a Spellcasting Focus.'),
        k.g('divine_order', 'Divine Order', 1, 'You have dedicated yourself to a sacred role of your choice: Protector (Martial weapons and Heavy armor) or Thaumaturge (an extra cantrip and a Wisdom-modifier bonus to Arcana and Religion checks).'),
      ],
    },
    2: { grants: [
      k.pool('channel_divinity', 'Channel Divinity', CHANNEL(2), 'long_rest'),
      k.g('channel_divinity', 'Channel Divinity', 2, 'You can channel divine energy to fuel magical effects: Divine Spark and Turn Undead, with more options at higher levels (and from your subclass). You can use Channel Divinity twice (three times from level 6, four from level 18); you regain one expended use on a Short Rest and all on a Long Rest. If an effect requires a saving throw, the DC equals your spell save DC.'),
      k.g('divine_spark', 'Divine Spark', 2, 'As a Magic action, point your Holy Symbol at another creature you can see within 30 feet. Roll 1d8 and add your Wisdom modifier. You either restore Hit Points to the creature equal to that total or force it to make a Constitution saving throw; on a failed save it takes Necrotic or Radiant damage (your choice) equal to that total, and half as much on a success. You roll an additional d8 at Cleric levels 7 (2d8), 13 (3d8) and 18 (4d8).',
        { activation: activation('action', { resource: 'channel_divinity', range: '30 feet', target: 'single', requiresSave: { ability: 'con', dc: 'spell_save_dc' } }),
          abilityEffects: [{ type: 'damage', dice: '1d8', damageType: 'radiant', saveOnSuccess: 'half', diceByLevel: [{ level: 7, dice: '2d8' }, { level: 13, dice: '3d8' }, { level: 18, dice: '4d8' }] }], tags: ['damage', 'healing', 'save'] }),
      k.g('turn_undead', 'Turn Undead', 2, 'As a Magic action, you present your Holy Symbol and censure Undead creatures. Each Undead of your choice within 30 feet must make a Wisdom saving throw. On a failure it has the Frightened and Incapacitated conditions for 1 minute and tries to move as far from you as it can; the effect ends early if it takes any damage, if you have the Incapacitated condition, or if you die.',
        { activation: activation('action', { resource: 'channel_divinity', range: '30 feet', target: 'area', requiresSave: { ability: 'wis', dc: 'spell_save_dc' } }), tags: ['control', 'save'] }),
    ] },
    3: { choices: [k.subclassChoice('Cleric Subclass')], grants: [k.g('subclass', 'Cleric Subclass', 3, 'You gain a Cleric subclass of your choice.')] },
    5: { grants: [k.g('sear_undead', 'Sear Undead', 5, 'Whenever you use Turn Undead, you can roll a number of d8s equal to your Wisdom modifier (minimum 1d8) and add the rolls together. Each Undead that fails its saving throw against that use takes Radiant damage equal to the total. This damage doesn\'t end the turn effect.')] },
    6: { grants: [k.raise('channel_divinity', CHANNEL(6))] },
    7: {
      choices: [k.pick('blessed_strikes', 'Blessed Strikes: choose one option.', 1, [
        k.option('blessed_divine_strike', 'Divine Strike', 7, 'Once on each of your turns when you hit a creature with an attack roll using a weapon, you can cause the target to take an extra 1d8 Necrotic or Radiant damage (your choice). The extra damage becomes 2d8 at level 14.',
          { activation: activation('free', { range: '5 feet', target: 'single' }), abilityEffects: [{ type: 'damage', dice: '1d8', damageType: 'radiant', diceByLevel: [{ level: 14, dice: '2d8' }] }], tags: ['damage'] }),
        k.option('blessed_potent_spellcasting', 'Potent Spellcasting', 7, 'Add your Wisdom modifier to the damage you deal with any Cleric cantrip. At level 14, when you cast a Cleric cantrip and deal damage with it, you can grant yourself or another creature within 60 feet Temporary Hit Points equal to twice your Wisdom modifier.'),
      ])],
      grants: [k.g('blessed_strikes', 'Blessed Strikes', 7, 'Divine power infuses you in battle. You gain one of two options of your choice: Divine Strike or Potent Spellcasting. At level 14 the chosen option grows more powerful (Improved Blessed Strikes).')],
    },
    10: { grants: [
      k.pool('divine_intervention', 'Divine Intervention', 1, 'long_rest'),
      k.g('divine_intervention', 'Divine Intervention', 10, 'You can call on your deity or pantheon to intervene on your behalf. As a Magic action, choose any Cleric spell of level 5 or lower that doesn\'t require a Reaction to cast and cast it without expending a spell slot or needing Material components. You can\'t use this feature again until you finish a Long Rest.',
        { activation: activation('action', { resource: 'divine_intervention' }), tags: ['utility'] }),
    ] },
    14: { grants: [k.g('improved_blessed_strikes', 'Improved Blessed Strikes', 14, 'The option you chose for Blessed Strikes grows more powerful. Divine Strike: the extra damage increases to 2d8. Potent Spellcasting: when you cast a Cleric cantrip and deal damage to a creature with it, you can grant yourself or another creature within 60 feet Temporary Hit Points equal to twice your Wisdom modifier.')] },
    18: { grants: [k.raise('channel_divinity', CHANNEL(18))] },
    20: { grants: [k.g('greater_divine_intervention', 'Greater Divine Intervention', 20, 'When you use Divine Intervention you can choose Wish when you select a spell. If you do so, you can\'t use Divine Intervention again until you finish 2d4 Long Rests.')] },
  },
  subclass: {
    id: 'life_2024', name: 'Life Domain',
    entries: kit => [
      { level: 3, grants: [
        kit.g('life_disciple_of_life', 'Disciple of Life', 3, 'When a spell you cast with a spell slot restores Hit Points to a creature, that creature regains additional Hit Points on the turn you cast the spell, equal to 2 plus the spell slot\'s level.'),
        kit.g('life_domain_spells', 'Life Domain Spells', 3, 'You always have certain spells prepared: Aid, Bless, Cure Wounds and Lesser Restoration (level 3); Mass Healing Word and Revivify (level 5); Aura of Life and Death Ward (level 7); Greater Restoration and Mass Cure Wounds (level 9). They don\'t count against your prepared spells.'),
        kit.g('life_preserve_life', 'Preserve Life', 3, 'As a Magic action, you present your Holy Symbol and expend a use of your Channel Divinity to evoke healing energy that can restore a number of Hit Points equal to five times your Cleric level. Choose Bloodied creatures within 30 feet (which can include you) and divide those Hit Points among them. This feature can restore a creature to no more than half its Hit Point maximum.',
          { activation: activation('action', { resource: 'channel_divinity', range: '30 feet', target: 'multiple' }), tags: ['healing'] }),
        { kind: 'known_spells', value: { spellIds: ['aid', 'bless', 'cure_wounds', 'lesser_restoration'] } },
      ] },
      { level: 5, grants: [{ kind: 'known_spells', value: { spellIds: ['mass_healing_word', 'revivify'] } }] },
      { level: 6, grants: [kit.g('life_blessed_healer', 'Blessed Healer', 6, 'The healing spells you cast on others heal you as well. Immediately after you cast a spell with a spell slot that restores Hit Points to one or more creatures other than yourself, you regain Hit Points equal to 2 plus the spell slot\'s level.')] },
      { level: 7, grants: [{ kind: 'known_spells', value: { spellIds: ['aura_of_life', 'death_ward'] } }] },
      { level: 9, grants: [{ kind: 'known_spells', value: { spellIds: ['greater_restoration', 'mass_cure_wounds'] } }] },
      { level: 17, grants: [kit.g('life_supreme_healing', 'Supreme Healing', 17, 'When you would normally roll one or more dice to restore Hit Points to a creature with a spell or Channel Divinity, don\'t roll those dice for the healing; instead use the highest number possible for each die. For example, instead of restoring 2d6 Hit Points you restore 12.')] },
    ],
  },
};
