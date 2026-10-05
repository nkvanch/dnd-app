// ============================================================================
// FILE: src/content/classes2024/sorcerer.ts
// Sorcerer (2024 rules), System Reference Document 5.2.1 (Creative Commons Attribution 4.0).
// Full caster. Sorcery Points equal the Sorcerer level (from level 2) and are a pool; Innate Sorcery is a
// two-use pool. Metamagic is a real choice (2 options at 2, +2 at 10, +2 at 17) from the ten SRD options,
// each a feature with its Sorcery Point cost. Subclass: Draconic Sorcery (Elemental Affinity is a real choice).
// ============================================================================
import { ClassDef, classKit, activation } from './builder';
import { ChoiceOption, Effect } from '../../engine/types';

const classId = 'sorcerer_2024';
const k = classKit(classId);
const resist = (type: string): Effect => ({ type: 'grant_resistance', target: type, operation: 'resistance', value: null, condition: null });
const sp = (n: number) => activation('free', { resource: 'sorcery_points', cost: n });

const metamagic = (kit: ReturnType<typeof classKit>): ChoiceOption[] => [
  kit.option('metamagic_careful', 'Careful Spell (1 SP)', 2, 'When you cast a spell that forces other creatures to make a saving throw, spend 1 Sorcery Point and choose a number of those creatures up to your Charisma modifier (minimum of one). A chosen creature automatically succeeds on its saving throw against the spell, and it takes no damage if it would normally take half damage on a successful save.', { activation: sp(1), tags: ['utility'] }),
  kit.option('metamagic_distant', 'Distant Spell (1 SP)', 2, 'When you cast a spell that has a range of at least 5 feet, you can spend 1 Sorcery Point to double the spell\'s range. Or when you cast a spell that has a range of Touch, you can spend 1 Sorcery Point to make the spell\'s range 30 feet.', { activation: sp(1), tags: ['utility'] }),
  kit.option('metamagic_empowered', 'Empowered Spell (1 SP)', 2, 'When you roll damage for a spell, you can spend 1 Sorcery Point to reroll a number of the damage dice up to your Charisma modifier (minimum of one), and you must use the new rolls. You can use Empowered Spell even if you\'ve already used a different Metamagic option during the casting of the spell.', { activation: sp(1), tags: ['damage'] }),
  kit.option('metamagic_extended', 'Extended Spell (1 SP)', 2, 'When you cast a spell that has a duration of 1 minute or longer, you can spend 1 Sorcery Point to double its duration to a maximum of 24 hours. If the affected spell requires Concentration, you have Advantage on any saving throw you make to maintain that Concentration.', { activation: sp(1), tags: ['utility'] }),
  kit.option('metamagic_heightened', 'Heightened Spell (2 SP)', 2, 'When you cast a spell that forces a creature to make a saving throw, you can spend 2 Sorcery Points to give one target of the spell Disadvantage on saves against the spell.', { activation: sp(2), tags: ['control'] }),
  kit.option('metamagic_quickened', 'Quickened Spell (2 SP)', 2, 'When you cast a spell that has a casting time of an action, you can spend 2 Sorcery Points to change the casting time to a Bonus Action for this casting. You can\'t modify a spell this way if you\'ve already cast a level 1+ spell on the current turn, nor can you cast a level 1+ spell on this turn after modifying a spell this way.', { activation: sp(2), tags: ['utility'] }),
  kit.option('metamagic_seeking', 'Seeking Spell (1 SP)', 2, 'If you make an attack roll for a spell and miss, you can spend 1 Sorcery Point to reroll the d20, and you must use the new roll. You can use Seeking Spell even if you\'ve already used a different Metamagic option during the casting of the spell.', { activation: sp(1), tags: ['utility'] }),
  kit.option('metamagic_subtle', 'Subtle Spell (1 SP)', 2, 'When you cast a spell, you can spend 1 Sorcery Point to cast it without any Verbal, Somatic, or Material components, except Material components that are consumed by the spell or that have a cost specified in the spell.', { activation: sp(1), tags: ['utility'] }),
  kit.option('metamagic_transmuted', 'Transmuted Spell (1 SP)', 2, 'When you cast a spell that deals a type of damage from the following list, you can spend 1 Sorcery Point to change that damage type to one of the other listed types: Acid, Cold, Fire, Lightning, Poison, Thunder.', { activation: sp(1), tags: ['utility'] }),
  kit.option('metamagic_twinned', 'Twinned Spell (1 SP)', 2, 'When you cast a spell, such as Charm Person, that can be cast with a higher-level spell slot to target an additional creature, you can spend 1 Sorcery Point to increase the spell\'s effective level by 1.', { activation: sp(1), tags: ['utility'] }),
];

export const sorcerer2024: ClassDef = {
  key: 'sorcerer', name: 'Sorcerer', hitDie: 6, savingThrows: ['con', 'cha'],
  description: 'A spellcaster who draws on innate magic from a gift or bloodline. (2024 rules.)',
  armorProfs: [], weaponProfs: ['simple'],
  startingProficiency: { armor: [], weapons: ['simple'] },
  multiclass: {},
  asiLevels: [4, 8, 12, 16, 19],
  caster: {
    ability: 'cha', style: 'full', policy: 'known', ritual: undefined,
    cantrips: [4, 4, 4, 5, 5, 5, 5, 5, 5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6],
    prepared: [2, 4, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 17, 18, 18, 19, 20, 21, 22],
  },
  levels: {
    1: {
      choices: [
        k.skills(2, ['arcana', 'deception', 'insight', 'intimidation', 'persuasion', 'religion']),
        k.equip('start', 'Starting equipment: (A) Spear, 2 Daggers, Arcane Focus (crystal), Dungeoneer\'s Pack, and 28 GP; or (B) 50 GP (add the gold on your sheet).', [
          { id: 'a', label: 'A: Spear, 2 Daggers, Arcane Focus, Dungeoneer\'s Pack, 28 GP', items: ['spear', 'dagger', 'dagger', 'arcane_focus_orb', 'dungeoneers_pack'] },
          { id: 'b', label: 'B: 50 GP', items: [] },
        ]),
      ],
      grants: [
        k.g('spellcasting', 'Spellcasting', 1, 'Drawing from your innate magic, you cast spells using Charisma as your spellcasting ability. You know four Sorcerer cantrips (a fifth at level 4, a sixth at level 10) and prepare the number of level 1+ Sorcerer spells shown in the Prepared Spells column, of a level for which you have slots. Whenever you gain a Sorcerer level you can replace one cantrip and one prepared spell. You can use an Arcane Focus as a Spellcasting Focus.'),
        k.g('innate_sorcery', 'Innate Sorcery', 1, 'An event in your past left an indelible mark on you, infusing you with simmering magic. As a Bonus Action, you can unleash that magic for 1 minute, during which the spell save DC of your Sorcerer spells increases by 1 and you have Advantage on the attack rolls of Sorcerer spells you cast. You can use this feature twice, and you regain all expended uses when you finish a Long Rest.',
          { activation: activation('bonus_action', { resource: 'innate_sorcery' }), tags: ['buff'] }),
        k.pool('innate_sorcery', 'Innate Sorcery', 2, 'long_rest'),
      ],
    },
    2: {
      choices: [k.pick('metamagic_2', 'Metamagic: choose two options.', 2, metamagic(k), { timing: 'level_up', rule: 'Whenever you gain a Sorcerer level, you can replace this with a different one.' })],
      grants: [
        k.g('font_of_magic', 'Font of Magic', 2, 'You can tap into the wellspring of magic within yourself, represented by Sorcery Points (a number equal to your Sorcerer level; you regain all of them on a Long Rest). Converting Spell Slots to Sorcery Points: expend a spell slot to gain Sorcery Points equal to the slot\'s level (no action required). Creating Spell Slots: as a Bonus Action, spend Sorcery Points to create a spell slot of level 1 (2 points, from Sorcerer level 2), 2 (3 points, level 3), 3 (5 points, level 5), 4 (6 points, level 7) or 5 (7 points, level 9). Slots created this way vanish when you finish a Long Rest.',
          { activation: activation('bonus_action', { resource: 'sorcery_points' }), tags: ['utility'] }),
        { kind: 'resource', value: { resourceId: 'sorcery_points', name: 'Sorcery Points', maximum: 2, recharge: 'long_rest', perLevel: 1 } },
        k.g('metamagic', 'Metamagic', 2, 'You gain two Metamagic options of your choice (two more at level 10 and two more at level 17). You can use only one Metamagic option on a spell when you cast it unless otherwise noted. Whenever you gain a Sorcerer level, you can replace one of your Metamagic options with one you don\'t know (swap it on the Features tab).'),
      ],
    },
    3: { choices: [k.subclassChoice('Sorcerer Subclass')], grants: [k.g('subclass', 'Sorcerer Subclass', 3, 'You gain a Sorcerer subclass of your choice.')] },
    5: { grants: [k.g('sorcerous_restoration', 'Sorcerous Restoration', 5, 'When you finish a Short Rest, you can regain expended Sorcery Points, but no more than a number equal to half your Sorcerer level (round down). Once you use this feature, you can\'t do so again until you finish a Long Rest.',
      { activation: activation('free', { resource: 'sorcerous_restoration' }), tags: ['utility'] }),
      k.pool('sorcerous_restoration', 'Sorcerous Restoration', 1, 'long_rest')] },
    7: { grants: [k.g('sorcery_incarnate', 'Sorcery Incarnate', 7, 'If you have no uses of Innate Sorcery left, you can use it if you spend 2 Sorcery Points when you take the Bonus Action to activate it. In addition, while your Innate Sorcery feature is active, you can use up to two of your Metamagic options on each spell you cast.')] },
    10: { choices: [k.pick('metamagic_10', 'Metamagic: choose two more options.', 2, metamagic(k), { timing: 'level_up', rule: 'Whenever you gain a Sorcerer level, you can replace this with a different one.' })], grants: [k.g('metamagic_10', 'Metamagic (two more)', 10, 'You gain two more Metamagic options of your choice.')] },
    17: { choices: [k.pick('metamagic_17', 'Metamagic: choose two more options.', 2, metamagic(k), { timing: 'level_up', rule: 'Whenever you gain a Sorcerer level, you can replace this with a different one.' })], grants: [k.g('metamagic_17', 'Metamagic (two more)', 17, 'You gain two more Metamagic options of your choice.')] },
    20: { grants: [k.g('arcane_apotheosis', 'Arcane Apotheosis', 20, 'While your Innate Sorcery feature is active, you can use one Metamagic option on each of your turns without spending Sorcery Points on it.')] },
  },
  subclass: {
    id: 'draconic_2024', name: 'Draconic Sorcery',
    entries: kit => [
      { level: 3, grants: [
        kit.g('draconic_resilience', 'Draconic Resilience', 3, 'The magic in your body manifests physical traits of your draconic gift. Your Hit Point maximum increases by 3, and it increases by 1 whenever you gain another Sorcerer level. Parts of you are also covered by dragon-like scales: while you aren\'t wearing armor, your base Armor Class equals 10 plus your Dexterity and Charisma modifiers.',
          { effects: [
            { type: 'stat_modifier', target: 'max_hp', operation: 'add', value: 0, addPerLevel: 1, condition: null } as Effect,
            { type: 'base_ac_formula', target: 'ac', operation: 'set', value: 10, condition: null, formulaAbilities: ['dex', 'cha'] } as Effect,
          ] }),
        kit.g('draconic_spells', 'Draconic Spells', 3, 'You always have certain spells prepared: Alter Self, Chromatic Orb, Command and Dragon\'s Breath (level 3); Fear and Fly (level 5); Arcane Eye and Charm Monster (level 7); Legend Lore and Summon Dragon (level 9). They don\'t count against your prepared spells.'),
        { kind: 'known_spells', value: { spellIds: ['alter_self', 'chromatic_orb', 'command', 'dragons_breath'] } },
      ] },
      { level: 5, grants: [{ kind: 'known_spells', value: { spellIds: ['fear', 'fly'] } }] },
      { level: 6, choices: [kit.pick('elemental_affinity', 'Elemental Affinity: choose a damage type.', 1,
          ['acid', 'cold', 'fire', 'lightning', 'poison'].map(t => kit.option(`elemental_affinity_${t}`, t[0].toUpperCase() + t.slice(1), 6, `You have Resistance to ${t} damage, and when you cast a spell that deals ${t} damage, you can add your Charisma modifier to one damage roll of that spell.`, { effects: [resist(t)] })))],
        grants: [kit.g('draconic_elemental_affinity', 'Elemental Affinity', 6, 'Your draconic magic has an affinity with a damage type associated with dragons: Acid, Cold, Fire, Lightning, or Poison. You have Resistance to that damage type, and when you cast a spell that deals damage of that type, you can add your Charisma modifier to one damage roll of that spell.')] },
      { level: 7, grants: [{ kind: 'known_spells', value: { spellIds: ['arcane_eye', 'charm_monster'] } }] },
      { level: 9, grants: [{ kind: 'known_spells', value: { spellIds: ['legend_lore', 'summon_dragon'] } }] },
      { level: 14, grants: [
        kit.g('draconic_dragon_wings', 'Dragon Wings', 14, 'As a Bonus Action, you can cause draconic wings to appear on your back. The wings last for 1 hour or until you dismiss them (no action required). For the duration, you have a Fly Speed of 60 feet. Once you use this feature, you can\'t use it again until you finish a Long Rest unless you spend 3 Sorcery Points (no action required) to restore your use of it.',
          { activation: activation('bonus_action', { resource: 'dragon_wings' }), tags: ['movement'],
            effects: [{ type: 'grant_movement', target: 'movement', operation: 'add', value: null, condition: null, movementType: 'fly', movementRange: 60,
              situational: { id: 'dragon_wings_out', question: 'Are your draconic wings out?' } }] }),
        { kind: 'resource', value: { resourceId: 'dragon_wings', name: 'Dragon Wings', maximum: 1, recharge: 'long_rest' } },
      ] },
      { level: 18, grants: [
        kit.g('draconic_dragon_companion', 'Dragon Companion', 18, 'You can cast Summon Dragon without a Material component. You can also cast it once without a spell slot, and you regain the ability to cast it in this way when you finish a Long Rest. Whenever you start casting the spell, you can modify it so that it doesn\'t require Concentration; if you do so, the spell\'s duration becomes 1 minute for that casting.',
          { activation: activation('action', { resource: 'dragon_companion' }), tags: ['utility'] }),
        { kind: 'resource', value: { resourceId: 'dragon_companion', name: 'Dragon Companion (free Summon Dragon)', maximum: 1, recharge: 'long_rest' } },
      ] },
    ],
  },
};
