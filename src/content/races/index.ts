// ============================================================================
// FILE: src/content/races/index.ts
// All PHB races expressed as Feature/Effect arrays.
// ============================================================================
import { Race, Subrace } from '../../engine/types';

export const raceHuman: Race = {
  id: 'human',
  name: 'Human',
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
};

export const raceElf: Race = {
  id: 'elf',
  name: 'Elf',
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
      id: 'high_elf', name: 'High Elf', parentId: 'elf',
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
      id: 'wood_elf', name: 'Wood Elf', parentId: 'elf',
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
      id: 'drow', name: 'Dark Elf (Drow)', parentId: 'elf',
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
      id: 'hill_dwarf', name: 'Hill Dwarf', parentId: 'dwarf',
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
      id: 'mountain_dwarf', name: 'Mountain Dwarf', parentId: 'dwarf',
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
      id: 'lightfoot_halfling', name: 'Lightfoot Halfling', parentId: 'halfling',
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
      id: 'stout_halfling', name: 'Stout Halfling', parentId: 'halfling',
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

export const raceDragonborn: Race = {
  id: 'dragonborn',
  name: 'Dragonborn',
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
    {
      id: 'dragonborn_ancestry',
      name: 'Draconic Ancestry',
      description: 'You have draconic ancestry. Choose one type of dragon from the Draconic Ancestry table.',
      source: { kind: 'race', refId: 'dragonborn' },
      level: null, effects: [], actions: [], choices: [], passive: true,
    },
    {
      id: 'dragonborn_breath',
      name: 'Breath Weapon',
      description: 'You can use your action to exhale destructive energy determined by your draconic ancestry.',
      source: { kind: 'race', refId: 'dragonborn' },
      level: null, actions: [], choices: [], passive: false,
      effects: [],
      activation: {
        actionType: 'action',
        resourceCost: null,
        range: '15 feet cone or 30 feet line',
        target: 'area',
        requiresSave: { ability: 'dex', dc: 8 },
      },
      abilityEffects: [
        { type: 'damage', dice: '2d6', damageType: 'fire', saveOnSuccess: 'half' },
      ],
    },
    {
      id: 'dragonborn_resistance',
      name: 'Damage Resistance',
      description: 'You have resistance to the damage type associated with your draconic ancestry.',
      source: { kind: 'race', refId: 'dragonborn' },
      level: null, actions: [], choices: [], passive: true,
      effects: [
        { type: 'grant_resistance', target: 'fire', operation: 'resistance', value: null, condition: null },
      ],
    },
  ],
};

export const raceGnome: Race = {
  id: 'gnome',
  name: 'Gnome',
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
};

export const raceHalfElf: Race = {
  id: 'half_elf',
  name: 'Half-Elf',
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

export const raceSkeleton: Race = {
  id: 'skeleton',
  name: 'Skeleton',
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
      level: null, effects: [], actions: [], choices: [], passive: true,
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
      id: 'skeleton_giant', name: 'Giant', parentId: 'skeleton',
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

export const ALL_RACES = [
  raceHuman,
  raceElf,
  raceDwarf,
  raceHalfling,
  raceDragonborn,
  raceGnome,
  raceHalfElf,
  raceHalfOrc,
  raceTiefling,
  raceSkeleton,
];
