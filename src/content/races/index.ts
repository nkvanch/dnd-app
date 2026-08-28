// ============================================================================
// FILE: src/content/races/index.ts
// All PHB races expressed as Feature/Effect arrays.
// ============================================================================
import { Race, AncestryOption, RACE_CHOICE_PREFIX, ChoiceOption } from '../../engine/types';

const ALL_SKILL_OPTIONS: ChoiceOption[] = [
  'athletics', 'acrobatics', 'sleight_of_hand', 'stealth', 'arcana', 'history',
  'investigation', 'nature', 'religion', 'animal_handling', 'insight', 'medicine',
  'perception', 'survival', 'deception', 'intimidation', 'performance', 'persuasion',
].map(s => ({ id: s, label: s, value: s }));

export const raceHuman: Race = {
  id: 'human',
  name: 'Human',
  srd: true,
  features: [
    {
      id: 'human_asi',
      name: 'Ability Score Increase',
      description: 'Your ability scores each increase by 1.',
      source: { kind: 'race', refId: 'human' },
      level: null, actions: [], choices: [], passive: true,
      effects: [
        { type: 'stat_modifier', target: 'str', operation: 'add', value: 1, condition: null },
        { type: 'stat_modifier', target: 'dex', operation: 'add', value: 1, condition: null },
        { type: 'stat_modifier', target: 'con', operation: 'add', value: 1, condition: null },
        { type: 'stat_modifier', target: 'int', operation: 'add', value: 1, condition: null },
        { type: 'stat_modifier', target: 'wis', operation: 'add', value: 1, condition: null },
        { type: 'stat_modifier', target: 'cha', operation: 'add', value: 1, condition: null },
      ],
    },
    {
      id: 'human_extra_language',
      name: 'Languages',
      description: 'You can speak, read, and write Common and one extra language of your choice.',
      source: { kind: 'race', refId: 'human' },
      level: null, effects: [], actions: [], choices: [], passive: true,
    },
  ],
  // PHB optional Variant Human rule — an alternate, not mandatory, so plain
  // Human stays fully selectable (subracesOptional).
  subracesOptional: true,
  subraces: [
    {
      id: 'variant_human', name: 'Variant Human', parentId: 'human', srd: true,
      replacesBaseFeatureIds: ['human_asi'],
      flexibleAsi: {
        prompt: 'Two different ability scores of your choice each increase by 1.',
        mode: { kind: 'two_distinct_plus_one' },
      },
      pendingChoices: [
        {
          id: `${RACE_CHOICE_PREFIX}variant_human_skill`,
          prompt: 'Choose one skill to gain proficiency in.',
          kind: 'skill', count: 1, pool: ALL_SKILL_OPTIONS,
          grants: [], required: true, resolved: false,
        },
      ],
      features: [
        {
          id: 'variant_human_feat_note', name: 'Feat',
          description: 'You gain one feat of your choice. Take it on the Feats screen during creation (enable the "Feat at 1st level" campaign rule if it isn\'t already, so that screen is reachable).',
          source: { kind: 'race', refId: 'variant_human' },
          level: null, effects: [], actions: [], choices: [], passive: true,
        },
      ],
    },
  ],
};

export const raceElf: Race = {
  id: 'elf',
  name: 'Elf',
  srd: true,
  features: [
    {
      id: 'elf_asi',
      name: 'Ability Score Increase',
      description: 'Your Dexterity score increases by 2 and your Intelligence score increases by 1.',
      source: { kind: 'race', refId: 'elf' },
      level: null, actions: [], choices: [], passive: true,
      effects: [
        { type: 'stat_modifier', target: 'dex', operation: 'add', value: 2, condition: null },
        { type: 'stat_modifier', target: 'int', operation: 'add', value: 1, condition: null },
      ],
    },
    {
      id: 'elf_darkvision',
      name: 'Darkvision',
      description: 'You can see in dim light within 60 feet as if it were bright light, and in darkness as if it were dim light.',
      source: { kind: 'race', refId: 'elf' },
      level: null, effects: [], actions: [], choices: [], passive: true,
    },
    {
      id: 'elf_fey_ancestry',
      name: 'Fey Ancestry',
      description: 'You have advantage on saving throws against being charmed, and magic can\'t put you to sleep.',
      source: { kind: 'race', refId: 'elf' },
      level: null, actions: [], choices: [], passive: true,
      effects: [
        { type: 'grant_immunity', target: 'sleep_magic', operation: 'immunity', value: null, condition: null },
      ],
    },
    {
      id: 'elf_keen_senses',
      name: 'Keen Senses',
      description: 'You have proficiency in the Perception skill.',
      source: { kind: 'race', refId: 'elf' },
      level: null, actions: [], choices: [], passive: true,
      effects: [
        { type: 'grant_proficiency', target: 'skill:perception', operation: 'add', value: null, condition: null },
      ],
    },
    {
      id: 'elf_trance',
      name: 'Trance',
      description: 'Elves don\'t need to sleep. Instead, they meditate deeply for 4 hours a day.',
      source: { kind: 'race', refId: 'elf' },
      level: null, effects: [], actions: [], choices: [], passive: true,
    },
  ],
  subraces: [
    {
      id: 'high_elf', name: 'High Elf', parentId: 'elf', srd: true,
      features: [
        {
          id: 'high_elf_asi',
          name: 'Ability Score Increase',
          description: 'Your Intelligence score increases by 1.',
          source: { kind: 'race', refId: 'high_elf' },
          level: null, actions: [], choices: [], passive: true,
          effects: [{ type: 'stat_modifier', target: 'int', operation: 'add', value: 1, condition: null }],
        },
        {
          id: 'high_elf_cantrip',
          name: 'Cantrip',
          description: 'You know one cantrip of your choice from the wizard spell list. Intelligence is your spellcasting ability for it.',
          source: { kind: 'race', refId: 'high_elf' },
          level: null, effects: [], actions: [], choices: [], passive: true,
        },
      ],
    },
    {
      id: 'wood_elf', name: 'Wood Elf', parentId: 'elf', srd: true,
      features: [
        {
          id: 'wood_elf_asi',
          name: 'Ability Score Increase',
          description: 'Your Wisdom score increases by 1.',
          source: { kind: 'race', refId: 'wood_elf' },
          level: null, actions: [], choices: [], passive: true,
          effects: [{ type: 'stat_modifier', target: 'wis', operation: 'add', value: 1, condition: null }],
        },
        {
          id: 'wood_elf_speed',
          name: 'Fleet of Foot',
          description: 'Your base walking speed increases to 35 feet.',
          source: { kind: 'race', refId: 'wood_elf' },
          level: null, actions: [], choices: [], passive: true,
          effects: [{ type: 'stat_modifier', target: 'speed', operation: 'set', value: 35, condition: null }],
        },
        {
          id: 'mask_of_the_wild',
          name: 'Mask of the Wild',
          description: 'You can attempt to hide even when you are only lightly obscured by foliage, heavy rain, falling snow, mist, and other natural phenomena.',
          source: { kind: 'race', refId: 'wood_elf' },
          level: null, effects: [], actions: [], choices: [], passive: true,
        },
      ],
    },
    {
      id: 'drow', name: 'Dark Elf (Drow)', parentId: 'elf', srd: true,
      features: [
        {
          id: 'drow_asi',
          name: 'Ability Score Increase',
          description: 'Your Charisma score increases by 1.',
          source: { kind: 'race', refId: 'drow' },
          level: null, actions: [], choices: [], passive: true,
          effects: [{ type: 'stat_modifier', target: 'cha', operation: 'add', value: 1, condition: null }],
        },
        {
          id: 'sunlight_sensitivity',
          name: 'Sunlight Sensitivity',
          description: 'You have disadvantage on attack rolls and Perception checks that rely on sight when you, the target, or whatever you are trying to perceive is in direct sunlight.',
          source: { kind: 'race', refId: 'drow' },
          level: null, effects: [], actions: [], choices: [], passive: true,
        },
      ],
    },
  ],
};

export const raceDwarf: Race = {
  id: 'dwarf',
  name: 'Dwarf',
  srd: true,
  features: [
    {
      id: 'dwarf_asi',
      name: 'Ability Score Increase',
      description: 'Your Constitution score increases by 2.',
      source: { kind: 'race', refId: 'dwarf' },
      level: null, actions: [], choices: [], passive: true,
      effects: [
        { type: 'stat_modifier', target: 'con', operation: 'add', value: 2, condition: null },
      ],
    },
    {
      id: 'dwarf_speed',
      name: 'Speed',
      description: 'Your base walking speed is 25 feet. Your speed is not reduced by wearing heavy armor.',
      source: { kind: 'race', refId: 'dwarf' },
      level: null, actions: [], choices: [], passive: true,
      effects: [
        { type: 'stat_modifier', target: 'speed', operation: 'set', value: 25, condition: null },
      ],
    },
    {
      id: 'dwarf_darkvision',
      name: 'Darkvision',
      description: 'You can see in dim light within 60 feet as if it were bright light, and in darkness as if it were dim light.',
      source: { kind: 'race', refId: 'dwarf' },
      level: null, effects: [], actions: [], choices: [], passive: true,
    },
    {
      id: 'dwarf_resilience',
      name: 'Dwarven Resilience',
      description: 'You have advantage on saving throws against poison, and you have resistance against poison damage.',
      source: { kind: 'race', refId: 'dwarf' },
      level: null, actions: [], choices: [], passive: true,
      effects: [
        { type: 'grant_resistance', target: 'poison', operation: 'resistance', value: null, condition: null },
      ],
    },
    {
      id: 'dwarf_stonecunning',
      name: 'Stonecunning',
      description: 'Whenever you make a History check related to the origin of stonework, you are considered proficient in the History skill and add double your proficiency bonus.',
      source: { kind: 'race', refId: 'dwarf' },
      level: null, effects: [], actions: [], choices: [], passive: true,
    },
    {
      id: 'dwarf_combat_training',
      name: 'Dwarven Combat Training',
      description: 'You have proficiency with the battleaxe, handaxe, light hammer, and warhammer.',
      source: { kind: 'race', refId: 'dwarf' },
      level: null, effects: [], actions: [], choices: [], passive: true,
    },
  ],
  subraces: [
    {
      id: 'hill_dwarf', name: 'Hill Dwarf', parentId: 'dwarf', srd: true,
      features: [
        {
          id: 'hill_dwarf_asi',
          name: 'Ability Score Increase',
          description: 'Your Wisdom score increases by 1.',
          source: { kind: 'race', refId: 'hill_dwarf' },
          level: null, actions: [], choices: [], passive: true,
          effects: [{ type: 'stat_modifier', target: 'wis', operation: 'add', value: 1, condition: null }],
        },
        {
          id: 'dwarven_toughness',
          name: 'Dwarven Toughness',
          description: 'Your hit point maximum increases by 1, and it increases by 1 every time you gain a level.',
          source: { kind: 'race', refId: 'hill_dwarf' },
          level: null, effects: [], actions: [], choices: [], passive: true,
        },
      ],
    },
    {
      id: 'mountain_dwarf', name: 'Mountain Dwarf', parentId: 'dwarf', srd: true,
      features: [
        {
          id: 'mountain_dwarf_asi',
          name: 'Ability Score Increase',
          description: 'Your Strength score increases by 2.',
          source: { kind: 'race', refId: 'mountain_dwarf' },
          level: null, actions: [], choices: [], passive: true,
          effects: [{ type: 'stat_modifier', target: 'str', operation: 'add', value: 2, condition: null }],
        },
        {
          id: 'dwarven_armor_training',
          name: 'Dwarven Armor Training',
          description: 'You have proficiency with light and medium armor.',
          source: { kind: 'race', refId: 'mountain_dwarf' },
          level: null, effects: [], actions: [], choices: [], passive: true,
        },
      ],
    },
  ],
};

export const raceHalfling: Race = {
  id: 'halfling',
  name: 'Halfling',
  srd: true,
  features: [
    {
      id: 'halfling_asi',
      name: 'Ability Score Increase',
      description: 'Your Dexterity score increases by 2.',
      source: { kind: 'race', refId: 'halfling' },
      level: null, actions: [], choices: [], passive: true,
      effects: [
        { type: 'stat_modifier', target: 'dex', operation: 'add', value: 2, condition: null },
      ],
    },
    {
      id: 'halfling_speed',
      name: 'Speed',
      description: 'Your base walking speed is 25 feet.',
      source: { kind: 'race', refId: 'halfling' },
      level: null, actions: [], choices: [], passive: true,
      effects: [
        { type: 'stat_modifier', target: 'speed', operation: 'set', value: 25, condition: null },
      ],
    },
    {
      id: 'halfling_lucky',
      name: 'Lucky',
      description: 'When you roll a 1 on the d20 for an attack roll, ability check, or saving throw, you can reroll the die and must use the new roll.',
      source: { kind: 'race', refId: 'halfling' },
      level: null, effects: [], actions: [], choices: [], passive: true,
    },
    {
      id: 'halfling_brave',
      name: 'Brave',
      description: 'You have advantage on saving throws against being frightened.',
      source: { kind: 'race', refId: 'halfling' },
      level: null, effects: [], actions: [], choices: [], passive: true,
    },
    {
      id: 'halfling_nimbleness',
      name: 'Halfling Nimbleness',
      description: 'You can move through the space of any creature that is of a size larger than yours.',
      source: { kind: 'race', refId: 'halfling' },
      level: null, effects: [], actions: [], choices: [], passive: true,
    },
  ],
  subraces: [
    {
      id: 'lightfoot_halfling', name: 'Lightfoot Halfling', parentId: 'halfling', srd: true,
      features: [
        {
          id: 'lightfoot_asi',
          name: 'Ability Score Increase',
          description: 'Your Charisma score increases by 1.',
          source: { kind: 'race', refId: 'lightfoot_halfling' },
          level: null, actions: [], choices: [], passive: true,
          effects: [{ type: 'stat_modifier', target: 'cha', operation: 'add', value: 1, condition: null }],
        },
        {
          id: 'naturally_stealthy',
          name: 'Naturally Stealthy',
          description: 'You can attempt to hide even when you are obscured only by a creature that is at least one size larger than you.',
          source: { kind: 'race', refId: 'lightfoot_halfling' },
          level: null, effects: [], actions: [], choices: [], passive: true,
        },
      ],
    },
    {
      id: 'stout_halfling', name: 'Stout Halfling', parentId: 'halfling', srd: true,
      features: [
        {
          id: 'stout_asi',
          name: 'Ability Score Increase',
          description: 'Your Constitution score increases by 1.',
          source: { kind: 'race', refId: 'stout_halfling' },
          level: null, actions: [], choices: [], passive: true,
          effects: [{ type: 'stat_modifier', target: 'con', operation: 'add', value: 1, condition: null }],
        },
        {
          id: 'stout_resilience',
          name: 'Stout Resilience',
          description: 'You have advantage on saving throws against poison, and you have resistance against poison damage.',
          source: { kind: 'race', refId: 'stout_halfling' },
          level: null, actions: [], choices: [], passive: true,
          effects: [{ type: 'grant_resistance', target: 'poison', operation: 'resistance', value: null, condition: null }],
        },
      ],
    },
  ],
};

/**
 * Builds one PHB Draconic Ancestry option — a dragon color's Feature,
 * combining the passive Damage Resistance effect with the active Breath
 * Weapon ability in one Feature (same "passive + active on one Feature"
 * shape Rage already uses). Breath weapon damage is the flat level-1 value
 * (2d6) — this app has no mechanism yet for a single ability's dice to
 * scale with character level (true of cantrip scaling too, not unique to
 * this trait), so the 6th/11th/16th-level increases (3d6/4d6/5d6) are
 * disclosed in the description as reference-only, not mechanically applied.
 * The save DC (8 + proficiency bonus + CON modifier) has no formula slot in
 * requiresSave for a non-spellcaster DC — same convention Blood Hunter's
 * Hemocraft save DC already uses — so requiresSave is null and the DC is
 * spelled out in the description instead.
 */
function draconicAncestryOption(
  id: string, name: string, damageType: string,
  shape: '5 by 30 ft. line' | '15 ft. cone', saveAbility: 'DEX' | 'CON',
): AncestryOption {
  return {
    id, name, blurb: `${damageType[0].toUpperCase()}${damageType.slice(1)} damage, ${shape} breath weapon, ${saveAbility} save.`,
    feature: {
      id: `dragonborn_breath_${id}`,
      name: 'Breath Weapon',
      description: `You can use your action to exhale ${damageType} energy in a ${shape} (${saveAbility} save, DC = 8 + proficiency bonus + Constitution modifier). Each creature in the area takes 2d6 ${damageType} damage on a failed save, half as much on a success — this increases to 3d6 at 6th level, 4d6 at 11th, and 5d6 at 16th. You also have resistance to ${damageType} damage. Once used, the breath weapon can't be used again until you finish a short or long rest.`,
      source: { kind: 'race', refId: 'dragonborn' },
      level: null, actions: [], choices: [], passive: false,
      effects: [
        { type: 'grant_resistance', target: damageType, operation: 'resistance', value: null, condition: null },
      ],
      activation: {
        actionType: 'action',
        resourceCost: { resourceId: 'dragonborn_breath_pool', quantity: 1 },
        range: shape,
        target: 'area',
        requiresSave: null,
      },
      abilityEffects: [
        { type: 'damage', dice: '2d6', damageType, saveOnSuccess: 'half' },
      ],
    },
  };
}

export const raceDragonborn: Race = {
  id: 'dragonborn',
  name: 'Dragonborn',
  srd: true,
  // PHB Dragonborn is already a complete race — Draconblood/Ravenite below
  // are optional Wildemount variants, not a mandatory split (unlike Elf/
  // Dwarf/Halfling/Gnome, where every subrace is itself required).
  subracesOptional: true,
  resources: [
    { resourceId: 'dragonborn_breath_pool', name: 'Breath Weapon', maximum: 1, recharge: 'short_rest' },
  ],
  ancestryChoice: {
    prompt: 'Choose a type of dragon. This determines the damage type and shape of your Breath Weapon, and the type of damage you resist.',
    options: [
      draconicAncestryOption('black', 'Black', 'acid', '5 by 30 ft. line', 'DEX'),
      draconicAncestryOption('blue', 'Blue', 'lightning', '5 by 30 ft. line', 'DEX'),
      draconicAncestryOption('brass', 'Brass', 'fire', '5 by 30 ft. line', 'DEX'),
      draconicAncestryOption('bronze', 'Bronze', 'lightning', '5 by 30 ft. line', 'DEX'),
      draconicAncestryOption('copper', 'Copper', 'acid', '5 by 30 ft. line', 'DEX'),
      draconicAncestryOption('gold', 'Gold', 'fire', '15 ft. cone', 'DEX'),
      draconicAncestryOption('green', 'Green', 'poison', '15 ft. cone', 'CON'),
      draconicAncestryOption('red', 'Red', 'fire', '15 ft. cone', 'DEX'),
      draconicAncestryOption('silver', 'Silver', 'cold', '15 ft. cone', 'CON'),
      draconicAncestryOption('white', 'White', 'cold', '15 ft. cone', 'CON'),
    ],
  },
  features: [
    {
      id: 'dragonborn_asi',
      name: 'Ability Score Increase',
      description: 'Your Strength score increases by 2 and your Charisma score increases by 1.',
      source: { kind: 'race', refId: 'dragonborn' },
      level: null, actions: [], choices: [], passive: true,
      effects: [
        { type: 'stat_modifier', target: 'str', operation: 'add', value: 2, condition: null },
        { type: 'stat_modifier', target: 'cha', operation: 'add', value: 1, condition: null },
      ],
    },
  ],
  // Explorer's Guide to Wildemount subraces — each replaces PHB Dragonborn's
  // Ability Score Increase (and, per the book, "Damage Resistance", which in
  // this app's model lives inside the ancestryChoice Feature rather than a
  // separate base-race Feature; the ancestryChoice's resistance/breath
  // weapon are unaffected and still chosen normally alongside either
  // subrace).
  subraces: [
    {
      id: 'draconblood', name: 'Draconblood', parentId: 'dragonborn', srd: false, replacesBaseFeatureIds: ['dragonborn_asi'],
      features: [
        {
          id: 'draconblood_asi', name: 'Ability Score Increase',
          description: 'Your Intelligence score increases by 2, and your Charisma score increases by 1.',
          source: { kind: 'race', refId: 'draconblood' }, level: null, actions: [], choices: [], passive: true,
          effects: [
            { type: 'stat_modifier', target: 'int', operation: 'add', value: 2, condition: null },
            { type: 'stat_modifier', target: 'cha', operation: 'add', value: 1, condition: null },
          ],
        },
        {
          id: 'draconblood_darkvision', name: 'Darkvision',
          description: 'You can see in dim light within 60 feet as if it were bright light, and in darkness as if it were dim light.',
          source: { kind: 'race', refId: 'draconblood' }, level: null, effects: [], actions: [], choices: [], passive: true,
        },
        {
          id: 'draconblood_forceful_presence', name: 'Forceful Presence',
          description: 'Once per long rest, you can make an Intimidation or Persuasion check with advantage.',
          source: { kind: 'race', refId: 'draconblood' }, level: null, effects: [], actions: [], choices: [], passive: true,
        },
      ],
    },
    {
      id: 'ravenite', name: 'Ravenite', parentId: 'dragonborn', srd: false, replacesBaseFeatureIds: ['dragonborn_asi'],
      features: [
        {
          id: 'ravenite_asi', name: 'Ability Score Increase',
          description: 'Your Strength score increases by 2, and your Constitution score increases by 1.',
          source: { kind: 'race', refId: 'ravenite' }, level: null, actions: [], choices: [], passive: true,
          effects: [
            { type: 'stat_modifier', target: 'str', operation: 'add', value: 2, condition: null },
            { type: 'stat_modifier', target: 'con', operation: 'add', value: 1, condition: null },
          ],
        },
        {
          id: 'ravenite_darkvision', name: 'Darkvision',
          description: 'You can see in dim light within 60 feet as if it were bright light, and in darkness as if it were dim light.',
          source: { kind: 'race', refId: 'ravenite' }, level: null, effects: [], actions: [], choices: [], passive: true,
        },
        {
          id: 'ravenite_vengeful_assault', name: 'Vengeful Assault',
          description: 'Once per short or long rest, when you take damage from a creature within range of a weapon you\'re wielding, you can use your reaction to attack that creature.',
          source: { kind: 'race', refId: 'ravenite' }, level: null, effects: [], actions: [], choices: [], passive: true,
        },
      ],
    },
  ],
};

export const raceGnome: Race = {
  id: 'gnome',
  name: 'Gnome',
  srd: true,
  features: [
    {
      id: 'gnome_asi',
      name: 'Ability Score Increase',
      description: 'Your Intelligence score increases by 2.',
      source: { kind: 'race', refId: 'gnome' },
      level: null, actions: [], choices: [], passive: true,
      effects: [
        { type: 'stat_modifier', target: 'int', operation: 'add', value: 2, condition: null },
      ],
    },
    {
      id: 'gnome_speed',
      name: 'Speed',
      description: 'Your base walking speed is 25 feet.',
      source: { kind: 'race', refId: 'gnome' },
      level: null, actions: [], choices: [], passive: true,
      effects: [
        { type: 'stat_modifier', target: 'speed', operation: 'set', value: 25, condition: null },
      ],
    },
    {
      id: 'gnome_darkvision',
      name: 'Darkvision',
      description: 'You can see in dim light within 60 feet as if it were bright light, and in darkness as if it were dim light.',
      source: { kind: 'race', refId: 'gnome' },
      level: null, effects: [], actions: [], choices: [], passive: true,
    },
    {
      id: 'gnome_cunning',
      name: 'Gnome Cunning',
      description: 'You have advantage on all Intelligence, Wisdom, and Charisma saving throws against magic.',
      source: { kind: 'race', refId: 'gnome' },
      level: null, effects: [], actions: [], choices: [], passive: true,
    },
  ],
  subraces: [
    {
      id: 'forest_gnome', name: 'Forest Gnome', parentId: 'gnome', srd: true,
      features: [
        {
          id: 'forest_gnome_asi', name: 'Ability Score Increase',
          description: 'Your Dexterity score increases by 1.',
          source: { kind: 'race', refId: 'forest_gnome' }, level: null, actions: [], choices: [], passive: true,
          effects: [{ type: 'stat_modifier', target: 'dex', operation: 'add', value: 1, condition: null }],
        },
        {
          id: 'natural_illusionist', name: 'Natural Illusionist',
          description: 'You know the Minor Illusion cantrip. Intelligence is your spellcasting ability for it.',
          source: { kind: 'race', refId: 'forest_gnome' }, level: null, actions: [], choices: [], passive: true,
          effects: [
            { type: 'grant_spell', target: 'spell', operation: 'add', value: null, condition: null, cantripIds: ['minor_illusion'], spellcastingAbility: 'int' },
          ],
        },
        {
          id: 'speak_with_small_beasts', name: 'Speak with Small Beasts',
          description: 'Through sound and gestures, you can communicate simple ideas with Small or smaller beasts.',
          source: { kind: 'race', refId: 'forest_gnome' }, level: null, effects: [], actions: [], choices: [], passive: true,
        },
      ],
    },
    {
      id: 'rock_gnome', name: 'Rock Gnome', parentId: 'gnome', srd: true,
      features: [
        {
          id: 'rock_gnome_asi', name: 'Ability Score Increase',
          description: 'Your Constitution score increases by 1.',
          source: { kind: 'race', refId: 'rock_gnome' }, level: null, actions: [], choices: [], passive: true,
          effects: [{ type: 'stat_modifier', target: 'con', operation: 'add', value: 1, condition: null }],
        },
        {
          id: 'artificers_lore', name: "Artificer's Lore",
          description: 'Whenever you make an Intelligence (History) check related to magical, alchemical, or technological items, you can add twice your proficiency bonus, instead of any other proficiency bonus you normally apply.',
          source: { kind: 'race', refId: 'rock_gnome' }, level: null, effects: [], actions: [], choices: [], passive: true,
        },
        {
          id: 'gnome_tinker', name: 'Tinker',
          description: "You have proficiency with tinker's tools. Using them, you can spend 1 hour and 10 gp of materials to construct a Tiny clockwork device (AC 5, 1 hp) — a clockwork toy, a fire starter, or a music box — that stops functioning after 24 hours unless you spend 1 hour maintaining it, or when you dismantle it to reclaim the materials. You can have up to three devices active at once.",
          source: { kind: 'race', refId: 'rock_gnome' }, level: null, actions: [], choices: [], passive: true,
          effects: [
            { type: 'grant_proficiency', target: 'tool:tinkers_tools', operation: 'add', value: null, condition: null },
          ],
        },
      ],
    },
  ],
};

export const raceHalfElf: Race = {
  id: 'half_elf',
  name: 'Half-Elf',
  srd: true,
  flexibleAsi: {
    prompt: 'Two other ability scores of your choice each increase by 1.',
    mode: { kind: 'two_distinct_plus_one', exclude: ['cha'] },
  },
  features: [
    {
      id: 'half_elf_asi',
      name: 'Ability Score Increase',
      description: 'Your Charisma score increases by 2, and two other ability scores of your choice each increase by 1.',
      source: { kind: 'race', refId: 'half_elf' },
      level: null, actions: [], choices: [], passive: true,
      effects: [
        { type: 'stat_modifier', target: 'cha', operation: 'add', value: 2, condition: null },
      ],
    },
    {
      id: 'half_elf_darkvision',
      name: 'Darkvision',
      description: 'You can see in dim light within 60 feet as if it were bright light, and in darkness as if it were dim light.',
      source: { kind: 'race', refId: 'half_elf' },
      level: null, effects: [], actions: [], choices: [], passive: true,
    },
    {
      id: 'half_elf_fey_ancestry',
      name: 'Fey Ancestry',
      description: 'You have advantage on saving throws against being charmed, and magic can\'t put you to sleep.',
      source: { kind: 'race', refId: 'half_elf' },
      level: null, effects: [], actions: [], choices: [], passive: true,
    },
    {
      id: 'half_elf_skill_versatility',
      name: 'Skill Versatility',
      description: 'You gain proficiency in two skills of your choice.',
      source: { kind: 'race', refId: 'half_elf' },
      level: null, effects: [], actions: [], choices: [], passive: true,
    },
  ],
};

export const raceHalfOrc: Race = {
  id: 'half_orc',
  name: 'Half-Orc',
  srd: true,
  features: [
    {
      id: 'half_orc_asi',
      name: 'Ability Score Increase',
      description: 'Your Strength score increases by 2 and your Constitution score increases by 1.',
      source: { kind: 'race', refId: 'half_orc' },
      level: null, actions: [], choices: [], passive: true,
      effects: [
        { type: 'stat_modifier', target: 'str', operation: 'add', value: 2, condition: null },
        { type: 'stat_modifier', target: 'con', operation: 'add', value: 1, condition: null },
      ],
    },
    {
      id: 'half_orc_darkvision',
      name: 'Darkvision',
      description: 'You can see in dim light within 60 feet as if it were bright light, and in darkness as if it were dim light.',
      source: { kind: 'race', refId: 'half_orc' },
      level: null, effects: [], actions: [], choices: [], passive: true,
    },
    {
      id: 'half_orc_menacing',
      name: 'Menacing',
      description: 'You gain proficiency in the Intimidation skill.',
      source: { kind: 'race', refId: 'half_orc' },
      level: null, actions: [], choices: [], passive: true,
      effects: [
        { type: 'grant_proficiency', target: 'skill:intimidation', operation: 'add', value: null, condition: null },
      ],
    },
    {
      id: 'half_orc_relentless_endurance',
      name: 'Relentless Endurance',
      description: 'When you are reduced to 0 hit points but not killed outright, you can drop to 1 hit point instead. Once you use this trait, you can\'t use it again until you finish a long rest.',
      source: { kind: 'race', refId: 'half_orc' },
      level: null, effects: [], actions: [], choices: [], passive: false,
    },
    {
      id: 'half_orc_savage_attacks',
      name: 'Savage Attacks',
      description: 'When you score a critical hit with a melee weapon attack, you can roll one of the weapon\'s damage dice one additional time and add it to the extra damage of the critical hit.',
      source: { kind: 'race', refId: 'half_orc' },
      level: null, effects: [], actions: [], choices: [], passive: true,
    },
  ],
};

export const raceTiefling: Race = {
  id: 'tiefling',
  name: 'Tiefling',
  srd: true,
  features: [
    {
      id: 'tiefling_asi',
      name: 'Ability Score Increase',
      description: 'Your Intelligence score increases by 1 and your Charisma score increases by 2.',
      source: { kind: 'race', refId: 'tiefling' },
      level: null, actions: [], choices: [], passive: true,
      effects: [
        { type: 'stat_modifier', target: 'int', operation: 'add', value: 1, condition: null },
        { type: 'stat_modifier', target: 'cha', operation: 'add', value: 2, condition: null },
      ],
    },
    {
      id: 'tiefling_darkvision',
      name: 'Darkvision',
      description: 'You can see in dim light within 60 feet as if it were bright light, and in darkness as if it were dim light.',
      source: { kind: 'race', refId: 'tiefling' },
      level: null, effects: [], actions: [], choices: [], passive: true,
    },
    {
      id: 'tiefling_hellish_resistance',
      name: 'Hellish Resistance',
      description: 'You have resistance to fire damage.',
      source: { kind: 'race', refId: 'tiefling' },
      level: null, actions: [], choices: [], passive: true,
      effects: [
        { type: 'grant_resistance', target: 'fire', operation: 'resistance', value: null, condition: null },
      ],
    },
    {
      id: 'tiefling_infernal_legacy',
      name: 'Infernal Legacy',
      description: 'You know the Thaumaturgy cantrip. At 3rd level, you can cast Hellish Rebuke as a 2nd-level spell. At 5th level, you can cast Darkness.',
      source: { kind: 'race', refId: 'tiefling' },
      level: null, effects: [], actions: [], choices: [], passive: true,
    },
  ],
};

// NOT SRD — original homebrew race (references 'Notongue' invented language,
// Abyss Knight-adjacent lore). Not WotC content, so no legal risk, but
// doesn't belong presented as "official" content — same content-honesty
// treatment as the Abyssal Claim spell (see cantrips.ts). Should eventually
// move to an example-homebrew content pack (ROADMAP_1.0.md Step 1.3).
export const raceSkeleton: Race = {
  id: 'skeleton',
  name: 'Skeleton',
  srd: false,
  features: [
    {
      id: 'skeleton_undead_nature',
      name: 'Undead Nature',
      description: "You are the reanimated, fleshless bones of a once-living creature, held together by necromantic magic. You don't need to eat, drink, breathe, or sleep, though you can still do any of these if you wish. You are considered an undead creature for the purposes of effects that interact with that type, such as Turn Undead and many healing spells.",
      source: { kind: 'race', refId: 'skeleton' },
      level: null, effects: [], actions: [], choices: [], passive: true,
    },
    {
      id: 'skeleton_disease_poison_immunity',
      name: 'Disease and Poison Immunity',
      description: 'You are immune to disease and to the poisoned condition, and you have resistance to poison damage.',
      source: { kind: 'race', refId: 'skeleton' },
      level: null, actions: [], choices: [], passive: true,
      effects: [
        { type: 'condition_immunity', target: 'poisoned', operation: 'immunity', value: null, condition: null },
        { type: 'grant_resistance', target: 'poison', operation: 'resistance', value: null, condition: null },
      ],
    },
    {
      id: 'skeleton_doomed_touch',
      name: 'Doomed Touch',
      description: 'You know the chill touch cantrip and can cast it at will, without expending a spell slot. Constitution is your spellcasting ability for it.',
      source: { kind: 'race', refId: 'skeleton' },
      level: null,
      effects: [
        // Grants chill touch as a known cantrip. Initialises spellcasting
        // (CON) if the character has no spellcasting class yet. If they do
        // (e.g. Abyss Knight), chill_touch is added to their existing list.
        {
          type: 'grant_spell',
          cantripIds: ['chill_touch'],
          spellcastingAbility: 'con',
          target: '', operation: 'add', value: null, condition: null,
        } as import('../../engine/types').Effect,
      ],
      actions: [], choices: [], passive: true,
    },
    {
      id: 'skeleton_darkvision',
      name: 'Darkvision',
      description: "Necromancy restored your sight after death. You can see in dim light within 60 feet of you as if it were bright light, and in darkness as if it were dim light. You can't discern color in darkness, only shades of grey.",
      source: { kind: 'race', refId: 'skeleton' },
      level: null, effects: [], actions: [], choices: [], passive: true,
    },
    {
      id: 'skeleton_might_of_death',
      name: 'Might of Death',
      description: 'You have resistance to necrotic damage.',
      source: { kind: 'race', refId: 'skeleton' },
      level: null, actions: [], choices: [], passive: true,
      effects: [
        { type: 'grant_resistance', target: 'necrotic', operation: 'resistance', value: null, condition: null },
      ],
    },
    {
      id: 'skeleton_languages',
      name: 'Languages',
      description: 'You can speak, read, and write Common and Notongue — the creaking, cracking language of the undead, understood by almost all undead creatures.',
      source: { kind: 'race', refId: 'skeleton' },
      level: null, effects: [], actions: [], choices: [], passive: true,
    },
    {
      id: 'skeleton_restoring_limbs',
      name: 'Restoring Limbs',
      description: 'If one of your limbs is severed or destroyed, you can restore it by finding a suitable replacement limb and spending your action to attach it.',
      source: { kind: 'race', refId: 'skeleton' },
      level: null, effects: [], actions: [], choices: [], passive: true,
    },
  ],
  subraces: [
    {
      id: 'skeleton_giant', name: 'Giant', parentId: 'skeleton', srd: false,
      features: [
        {
          id: 'skeleton_giant_remains',
          name: 'Giant Remains',
          description: 'In life you were a giant, or several lesser skeletons were fused by foul alchemy into a single hulking form. Your size is Large. The considerable strength of your former body carries over and is already reflected in your recorded ability scores. Skeletons of this lineage are simple and straightforward by nature, and often become proud warriors.',
          source: { kind: 'race', refId: 'skeleton_giant' },
          level: null, effects: [], actions: [], choices: [], passive: true,
        },
      ],
    },
  ],
};

/**
 * Every playable race, unfiltered. Prefer ALL_RACES below in app code.
 * (raceSkeleton is intentionally not included here — see its own comment.)
 */
export const FULL_RACE_LIBRARY: Race[] = [
  raceHuman,
  raceElf,
  raceDwarf,
  raceHalfling,
  raceDragonborn,
  raceGnome,
  raceHalfElf,
  raceHalfOrc,
  raceTiefling,
];

const SRD_ONLY = process.env.EXPO_PUBLIC_SRD_ONLY === 'true';

/**
 * The race list the app should use — filtered to srd === true only on the
 * EAS `production` build profile (see eas.json). Personal/dev/preview
 * builds see every race unfiltered, same build-target-aware pattern as
 * spells (Step 1.3) and subclasses. See docs/ROADMAP_1.0.md Phase 1.
 */
export const ALL_RACES: Race[] = SRD_ONLY
  ? FULL_RACE_LIBRARY.filter(r => r.srd === true)
  : FULL_RACE_LIBRARY;
