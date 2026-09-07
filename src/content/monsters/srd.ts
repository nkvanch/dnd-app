// ============================================================================
// FILE: src/content/monsters/srd.ts
// SRD monster templates — priority 12 for DM use.
// ============================================================================
import { MonsterTemplate } from './types';

export const monsterGoblin: MonsterTemplate = {
  id: 'goblin', name: 'Goblin', cr: 0.25, srd: true,
  size: 'small', type: 'humanoid (goblinoid)', alignment: 'neutral evil',
  stats: { str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8 },
  hp: { dice: '2d6', average: 7 },
  ac: { value: 15, source: 'leather armor, shield' },
  speed: 30,
  savingThrows: [],
  skills: { stealth: 6 },
  senses: ['darkvision 60 ft', 'passive Perception 9'],
  languages: ['Common', 'Goblin'],
  features: [
    {
      id: 'goblin_nimble_escape', name: 'Nimble Escape',
      description: 'The goblin can take the Disengage or Hide action as a bonus action on each of its turns.',
      source: { kind: 'race', refId: 'goblin' }, level: null,
      effects: [], actions: [], choices: [], passive: true,
    },
    {
      id: 'goblin_scimitar', name: 'Scimitar',
      description: 'Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 5 (1d6+2) slashing damage.',
      source: { kind: 'race', refId: 'goblin' }, level: null,
      effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'action', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
      abilityEffects: [{ type: 'damage', dice: '1d6+2', damageType: 'slashing' }],
    },
    {
      id: 'goblin_shortbow', name: 'Shortbow',
      description: 'Ranged Weapon Attack: +4 to hit, range 80/320 ft., one target. Hit: 5 (1d6+2) piercing damage.',
      source: { kind: 'race', refId: 'goblin' }, level: null,
      effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'action', resourceCost: null, range: '80 feet', target: 'single', requiresSave: null },
      abilityEffects: [{ type: 'damage', dice: '1d6+2', damageType: 'piercing' }],
    },
  ],
};

export const monsterOrc: MonsterTemplate = {
  id: 'orc', name: 'Orc', cr: 0.5, srd: true,
  size: 'medium', type: 'humanoid (orc)', alignment: 'chaotic evil',
  stats: { str: 16, dex: 12, con: 16, int: 7, wis: 11, cha: 10 },
  hp: { dice: '2d8+6', average: 15 },
  ac: { value: 13, source: 'hide armor' },
  speed: 30,
  savingThrows: [],
  skills: { intimidation: 2 },
  senses: ['darkvision 60 ft', 'passive Perception 10'],
  languages: ['Common', 'Orc'],
  features: [
    {
      id: 'orc_aggressive', name: 'Aggressive',
      description: 'As a bonus action, the orc can move up to its speed toward a hostile creature that it can see.',
      source: { kind: 'race', refId: 'orc' }, level: null,
      effects: [], actions: [], choices: [], passive: true,
    },
    {
      id: 'orc_greataxe', name: 'Greataxe',
      description: 'Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 9 (1d12+3) slashing damage.',
      source: { kind: 'race', refId: 'orc' }, level: null,
      effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'action', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
      abilityEffects: [{ type: 'damage', dice: '1d12+3', damageType: 'slashing' }],
    },
  ],
};

export const monsterSkeleton: MonsterTemplate = {
  id: 'skeleton', name: 'Skeleton', cr: 0.25, srd: true,
  size: 'medium', type: 'undead', alignment: 'lawful evil',
  stats: { str: 10, dex: 14, con: 15, int: 6, wis: 8, cha: 5 },
  hp: { dice: '2d8+4', average: 13 },
  ac: { value: 13, source: 'armor scraps' },
  speed: 30,
  savingThrows: [],
  skills: {},
  senses: ['darkvision 60 ft', 'passive Perception 9'],
  languages: [],
  features: [
    {
      id: 'skeleton_shortsword', name: 'Shortsword',
      description: 'Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 5 (1d6+2) piercing damage.',
      source: { kind: 'race', refId: 'skeleton' }, level: null,
      effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'action', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
      abilityEffects: [{ type: 'damage', dice: '1d6+2', damageType: 'piercing' }],
    },
    {
      id: 'skeleton_shortbow', name: 'Shortbow',
      description: 'Ranged Weapon Attack: +4 to hit, range 80/320 ft., one target. Hit: 5 (1d6+2) piercing damage.',
      source: { kind: 'race', refId: 'skeleton' }, level: null,
      effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'action', resourceCost: null, range: '80 feet', target: 'single', requiresSave: null },
      abilityEffects: [{ type: 'damage', dice: '1d6+2', damageType: 'piercing' }],
    },
  ],
};

export const monsterZombie: MonsterTemplate = {
  id: 'zombie', name: 'Zombie', cr: 0.25, srd: true,
  size: 'medium', type: 'undead', alignment: 'neutral evil',
  stats: { str: 13, dex: 6, con: 16, int: 3, wis: 6, cha: 5 },
  hp: { dice: '3d8+9', average: 22 },
  ac: { value: 8, source: 'natural armor' },
  speed: 20,
  savingThrows: ['wis'],
  skills: {},
  senses: ['darkvision 60 ft', 'passive Perception 8'],
  languages: [],
  features: [
    {
      id: 'zombie_undead_fortitude', name: 'Undead Fortitude',
      description: 'If damage reduces the zombie to 0 HP, it must make a CON saving throw with a DC of 5+damage. On success, it drops to 1 HP instead.',
      source: { kind: 'race', refId: 'zombie' }, level: null,
      effects: [], actions: [], choices: [], passive: true,
    },
    {
      id: 'zombie_slam', name: 'Slam',
      description: 'Melee Weapon Attack: +3 to hit, reach 5 ft., one target. Hit: 4 (1d6+1) bludgeoning damage.',
      source: { kind: 'race', refId: 'zombie' }, level: null,
      effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'action', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
      abilityEffects: [{ type: 'damage', dice: '1d6+1', damageType: 'bludgeoning' }],
    },
  ],
};

export const monsterWolf: MonsterTemplate = {
  id: 'wolf', name: 'Wolf', cr: 0.25, srd: true,
  size: 'medium', type: 'beast', alignment: 'unaligned',
  stats: { str: 12, dex: 15, con: 12, int: 3, wis: 12, cha: 6 },
  hp: { dice: '2d8+2', average: 11 },
  ac: { value: 13, source: 'natural armor' },
  speed: 40,
  savingThrows: [],
  skills: { perception: 3, stealth: 4 },
  senses: ['passive Perception 13'],
  languages: [],
  features: [
    {
      id: 'wolf_keen_senses', name: 'Keen Hearing and Smell',
      description: 'The wolf has advantage on Perception checks that rely on hearing or smell.',
      source: { kind: 'race', refId: 'wolf' }, level: null,
      effects: [], actions: [], choices: [], passive: true,
    },
    {
      id: 'wolf_bite', name: 'Bite',
      description: 'Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 7 (2d4+2) piercing damage. DC 11 STR save or knocked prone.',
      source: { kind: 'race', refId: 'wolf' }, level: null,
      effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'action', resourceCost: null, range: '5 feet', target: 'single', requiresSave: { ability: 'str', dc: 11 } },
      abilityEffects: [{ type: 'damage', dice: '2d4+2', damageType: 'piercing' }],
    },
  ],
};

export const monsterGiantSpider: MonsterTemplate = {
  id: 'giant_spider', name: 'Giant Spider', cr: 1, srd: true,
  size: 'large', type: 'beast', alignment: 'unaligned',
  stats: { str: 14, dex: 16, con: 12, int: 2, wis: 11, cha: 4 },
  hp: { dice: '4d10+4', average: 26 },
  ac: { value: 14, source: 'natural armor' },
  speed: 30,
  savingThrows: [],
  skills: { stealth: 7 },
  senses: ['blindsight 10 ft', 'darkvision 60 ft', 'passive Perception 10'],
  languages: [],
  features: [
    {
      id: 'spider_bite', name: 'Bite',
      description: 'Melee Weapon Attack: +5 to hit, reach 5 ft., one creature. Hit: 7 (1d8+3) piercing damage, plus 9 (2d8) poison damage (CON DC 11 halves).',
      source: { kind: 'race', refId: 'giant_spider' }, level: null,
      effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'action', resourceCost: null, range: '5 feet', target: 'single', requiresSave: { ability: 'con', dc: 11 } },
      abilityEffects: [{ type: 'damage', dice: '1d8+3', damageType: 'piercing' }],
    },
  ],
};

export const monsterBandit: MonsterTemplate = {
  id: 'bandit', name: 'Bandit', cr: 0.125, srd: true,
  size: 'medium', type: 'humanoid (any race)', alignment: 'any non-lawful',
  stats: { str: 11, dex: 12, con: 12, int: 10, wis: 10, cha: 10 },
  hp: { dice: '2d8+2', average: 11 },
  ac: { value: 12, source: 'leather armor' },
  speed: 30,
  savingThrows: [],
  skills: {},
  senses: ['passive Perception 10'],
  languages: ['any one language (usually Common)'],
  features: [
    {
      id: 'bandit_scimitar', name: 'Scimitar',
      description: 'Melee Weapon Attack: +3 to hit, reach 5 ft., one target. Hit: 4 (1d6+1) slashing damage.',
      source: { kind: 'race', refId: 'bandit' }, level: null,
      effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'action', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
      abilityEffects: [{ type: 'damage', dice: '1d6+1', damageType: 'slashing' }],
    },
  ],
};

export const monsterGuard: MonsterTemplate = {
  id: 'guard', name: 'Guard', cr: 0.125, srd: true,
  size: 'medium', type: 'humanoid (any race)', alignment: 'any alignment',
  stats: { str: 13, dex: 12, con: 12, int: 10, wis: 11, cha: 10 },
  hp: { dice: '2d8+2', average: 11 },
  ac: { value: 16, source: 'chain shirt, shield' },
  speed: 30,
  savingThrows: [],
  skills: { perception: 2 },
  senses: ['passive Perception 12'],
  languages: ['any one language (usually Common)'],
  features: [
    {
      id: 'guard_spear', name: 'Spear',
      description: 'Melee or Ranged Weapon Attack: +3 to hit, reach 5 ft. or range 20/60 ft., one target. Hit: 4 (1d6+1) piercing damage.',
      source: { kind: 'race', refId: 'guard' }, level: null,
      effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'action', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
      abilityEffects: [{ type: 'damage', dice: '1d6+1', damageType: 'piercing' }],
    },
  ],
};

export const monsterOgre: MonsterTemplate = {
  id: 'ogre', name: 'Ogre', cr: 2, srd: true,
  size: 'large', type: 'giant', alignment: 'chaotic evil',
  stats: { str: 19, dex: 8, con: 16, int: 5, wis: 7, cha: 7 },
  hp: { dice: '7d10+21', average: 59 },
  ac: { value: 11, source: 'hide armor' },
  speed: 40,
  savingThrows: [],
  skills: {},
  senses: ['darkvision 60 ft', 'passive Perception 8'],
  languages: ['Common', 'Giant'],
  features: [
    {
      id: 'ogre_greatclub', name: 'Greatclub',
      description: 'Melee Weapon Attack: +6 to hit, reach 5 ft., one target. Hit: 13 (2d8+4) bludgeoning damage.',
      source: { kind: 'race', refId: 'ogre' }, level: null,
      effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'action', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
      abilityEffects: [{ type: 'damage', dice: '2d8+4', damageType: 'bludgeoning' }],
    },
    {
      id: 'ogre_javelin', name: 'Javelin',
      description: 'Melee or Ranged Weapon Attack: +6 to hit, reach 5 ft. or range 30/120 ft., one target. Hit: 11 (2d6+4) piercing damage.',
      source: { kind: 'race', refId: 'ogre' }, level: null,
      effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'action', resourceCost: null, range: '30 feet', target: 'single', requiresSave: null },
      abilityEffects: [{ type: 'damage', dice: '2d6+4', damageType: 'piercing' }],
    },
  ],
};

export const monsterTroll: MonsterTemplate = {
  id: 'troll', name: 'Troll', cr: 5, srd: true,
  size: 'large', type: 'giant', alignment: 'chaotic evil',
  stats: { str: 18, dex: 13, con: 20, int: 7, wis: 9, cha: 7 },
  hp: { dice: '8d10+40', average: 84 },
  ac: { value: 15, source: 'natural armor' },
  speed: 30,
  savingThrows: [],
  skills: { perception: 2 },
  senses: ['darkvision 60 ft', 'passive Perception 12'],
  languages: ['Giant'],
  features: [
    {
      id: 'troll_regeneration', name: 'Regeneration',
      description: 'The troll regains 10 hit points at the start of its turn. If the troll takes acid or fire damage, this trait doesn\'t function at the start of the troll\'s next turn.',
      source: { kind: 'race', refId: 'troll' }, level: null,
      effects: [], actions: [], choices: [], passive: true,
    },
    {
      id: 'troll_claw', name: 'Claw',
      description: 'Melee Weapon Attack: +7 to hit, reach 5 ft., one target. Hit: 11 (2d6+4) slashing damage.',
      source: { kind: 'race', refId: 'troll' }, level: null,
      effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'action', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
      abilityEffects: [{ type: 'damage', dice: '2d6+4', damageType: 'slashing' }],
    },
  ],
};

export const monsterYoungRedDragon: MonsterTemplate = {
  id: 'young_red_dragon', name: 'Young Red Dragon', cr: 10, srd: true,
  size: 'large', type: 'dragon', alignment: 'chaotic evil',
  stats: { str: 23, dex: 10, con: 21, int: 14, wis: 11, cha: 19 },
  hp: { dice: '17d10+85', average: 178 },
  ac: { value: 18, source: 'natural armor' },
  speed: 40,
  savingThrows: ['dex', 'con', 'wis', 'cha'],
  skills: { perception: 8, stealth: 4 },
  senses: ['blindsight 30 ft', 'darkvision 120 ft', 'passive Perception 18'],
  languages: ['Common', 'Draconic'],
  features: [
    {
      id: 'dragon_fire_breath', name: 'Fire Breath',
      description: 'The dragon exhales fire in a 30-foot cone. DC 18 DEX save, 56 (16d6) fire damage on fail, half on success.',
      source: { kind: 'race', refId: 'young_red_dragon' }, level: null,
      effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'action', resourceCost: null, range: '30 feet cone', target: 'area', requiresSave: { ability: 'dex', dc: 18 } },
      abilityEffects: [{ type: 'damage', dice: '16d6', damageType: 'fire', saveOnSuccess: 'half' }],
    },
    {
      id: 'dragon_bite', name: 'Bite',
      description: 'Melee Weapon Attack: +10 to hit, reach 10 ft., one target. Hit: 17 (2d10+6) piercing damage plus 3 (1d6) fire damage.',
      source: { kind: 'race', refId: 'young_red_dragon' }, level: null,
      effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'action', resourceCost: null, range: '10 feet', target: 'single', requiresSave: null },
      abilityEffects: [{ type: 'damage', dice: '2d10+6', damageType: 'piercing' }],
    },
  ],
};

export const monsterLich: MonsterTemplate = {
  id: 'lich', name: 'Lich', cr: 21, srd: true,
  size: 'medium', type: 'undead', alignment: 'any evil',
  stats: { str: 11, dex: 16, con: 16, int: 20, wis: 14, cha: 16 },
  hp: { dice: '18d8+54', average: 135 },
  ac: { value: 17, source: 'natural armor' },
  speed: 30,
  savingThrows: ['con', 'int', 'wis'],
  skills: { arcana: 18, history: 12, insight: 9, perception: 9 },
  senses: ['truesight 120 ft', 'passive Perception 19'],
  languages: ['Common plus up to 5 other languages'],
  legendaryActions: 3,
  features: [
    {
      id: 'lich_paralyzing_touch', name: 'Paralyzing Touch',
      description: 'Melee Spell Attack: +12 to hit. Hit: 10 (3d6) cold damage. DC 18 CON save or paralyzed for 1 minute.',
      source: { kind: 'race', refId: 'lich' }, level: null,
      effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'action', resourceCost: null, range: '5 feet', target: 'single', requiresSave: { ability: 'con', dc: 18 } },
      abilityEffects: [
        { type: 'damage', dice: '3d6', damageType: 'cold' },
        { type: 'apply_condition', conditionId: 'paralyzed', duration: { unit: 'minutes', remaining: 1 } },
      ],
    },
  ],
};

export const monsterKobold: MonsterTemplate = {
  id: 'kobold', name: 'Kobold', cr: 0.125, srd: true,
  size: 'small', type: 'humanoid (kobold)', alignment: 'lawful evil',
  stats: { str: 7, dex: 15, con: 9, int: 8, wis: 7, cha: 8 },
  hp: { dice: '2d6-2', average: 5 },
  ac: { value: 12, source: 'dex' },
  speed: 30,
  savingThrows: [],
  skills: {},
  senses: ['darkvision 60 ft', 'passive Perception 8'],
  languages: ['Common', 'Draconic'],
  features: [
    {
      id: 'kobold_sunlight_sensitivity', name: 'Sunlight Sensitivity',
      description: 'While in sunlight, the kobold has disadvantage on attack rolls, as well as on Wisdom (Perception) checks that rely on sight.',
      source: { kind: 'race', refId: 'kobold' }, level: null,
      effects: [], actions: [], choices: [], passive: true,
    },
    {
      id: 'kobold_pack_tactics', name: 'Pack Tactics',
      description: 'The kobold has advantage on an attack roll against a creature if at least one of the kobold\'s allies is within 5 ft. of the creature and the ally isn\'t incapacitated.',
      source: { kind: 'race', refId: 'kobold' }, level: null,
      effects: [], actions: [], choices: [], passive: true,
    },
    {
      id: 'kobold_dagger', name: 'Dagger',
      description: 'Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 4 (1d4+2) piercing damage.',
      source: { kind: 'race', refId: 'kobold' }, level: null,
      effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'action', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
      abilityEffects: [{ type: 'damage', dice: '1d4+2', damageType: 'piercing' }],
    },
    {
      id: 'kobold_sling', name: 'Sling',
      description: 'Ranged Weapon Attack: +4 to hit, range 30/120 ft., one target. Hit: 4 (1d4+2) bludgeoning damage.',
      source: { kind: 'race', refId: 'kobold' }, level: null,
      effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'action', resourceCost: null, range: '30 feet', target: 'single', requiresSave: null },
      abilityEffects: [{ type: 'damage', dice: '1d4+2', damageType: 'bludgeoning' }],
    },
  ],
};

export const monsterGiantRat: MonsterTemplate = {
  id: 'giant_rat', name: 'Giant Rat', cr: 0.125, srd: true,
  size: 'small', type: 'beast', alignment: 'unaligned',
  stats: { str: 7, dex: 15, con: 11, int: 2, wis: 10, cha: 4 },
  hp: { dice: '2d6', average: 7 },
  ac: { value: 12, source: 'dex' },
  speed: 30,
  savingThrows: [],
  skills: {},
  senses: ['darkvision 60 ft', 'passive Perception 10'],
  languages: [],
  features: [
    {
      id: 'giant_rat_keen_smell', name: 'Keen Smell',
      description: 'The rat has advantage on Wisdom (Perception) checks that rely on smell.',
      source: { kind: 'race', refId: 'giant_rat' }, level: null,
      effects: [], actions: [], choices: [], passive: true,
    },
    {
      id: 'giant_rat_pack_tactics', name: 'Pack Tactics',
      description: 'The rat has advantage on an attack roll against a creature if at least one of the rat\'s allies is within 5 ft. of the creature and the ally isn\'t incapacitated.',
      source: { kind: 'race', refId: 'giant_rat' }, level: null,
      effects: [], actions: [], choices: [], passive: true,
    },
    {
      id: 'giant_rat_bite', name: 'Bite',
      description: 'Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 4 (1d4+2) piercing damage.',
      source: { kind: 'race', refId: 'giant_rat' }, level: null,
      effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'action', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
      abilityEffects: [{ type: 'damage', dice: '1d4+2', damageType: 'piercing' }],
    },
  ],
};

export const monsterStirge: MonsterTemplate = {
  id: 'stirge', name: 'Stirge', cr: 0.125, srd: true,
  size: 'tiny', type: 'beast', alignment: 'unaligned',
  stats: { str: 4, dex: 16, con: 11, int: 2, wis: 8, cha: 6 },
  hp: { dice: '1d4', average: 2 },
  ac: { value: 14, source: 'natural armor' },
  speed: 10,
  savingThrows: [],
  skills: {},
  senses: ['darkvision 60 ft', 'passive Perception 9'],
  languages: [],
  features: [
    {
      id: 'stirge_blood_drain', name: 'Blood Drain',
      description: 'Melee Weapon Attack: +5 to hit, reach 5 ft., one creature. Hit: 5 (1d4+3) piercing damage, and the stirge attaches to the target. While attached, the stirge doesn\'t attack; instead, at the start of each of its turns, the target loses 5 (1d4+3) HP from blood loss. The stirge can detach by spending 5 feet of movement, and does so after draining 10 HP or the target dies. A creature (including the target) can use its action to detach it.',
      source: { kind: 'race', refId: 'stirge' }, level: null,
      effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'action', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
      abilityEffects: [{ type: 'damage', dice: '1d4+3', damageType: 'piercing' }],
    },
  ],
};

export const monsterHobgoblin: MonsterTemplate = {
  id: 'hobgoblin', name: 'Hobgoblin', cr: 0.5, srd: true,
  size: 'medium', type: 'humanoid (goblinoid)', alignment: 'lawful evil',
  stats: { str: 13, dex: 12, con: 12, int: 10, wis: 10, cha: 9 },
  hp: { dice: '2d8+2', average: 11 },
  ac: { value: 18, source: 'chain mail, shield' },
  speed: 30,
  savingThrows: [],
  skills: {},
  senses: ['darkvision 60 ft', 'passive Perception 10'],
  languages: ['Common', 'Goblin'],
  features: [
    {
      id: 'hobgoblin_martial_advantage', name: 'Martial Advantage',
      description: 'Once per turn, the hobgoblin can deal an extra 7 (2d6) damage to a creature it hits with a weapon attack if that creature is within 5 ft. of an ally of the hobgoblin that isn\'t incapacitated.',
      source: { kind: 'race', refId: 'hobgoblin' }, level: null,
      effects: [], actions: [], choices: [], passive: true,
    },
    {
      id: 'hobgoblin_longsword', name: 'Longsword',
      description: 'Melee Weapon Attack: +3 to hit, reach 5 ft., one target. Hit: 5 (1d8+1) slashing damage, or 6 (1d10+1) if used two-handed.',
      source: { kind: 'race', refId: 'hobgoblin' }, level: null,
      effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'action', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
      abilityEffects: [{ type: 'damage', dice: '1d8+1', damageType: 'slashing' }],
    },
    {
      id: 'hobgoblin_longbow', name: 'Longbow',
      description: 'Ranged Weapon Attack: +3 to hit, range 150/600 ft., one target. Hit: 5 (1d8+1) piercing damage.',
      source: { kind: 'race', refId: 'hobgoblin' }, level: null,
      effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'action', resourceCost: null, range: '150 feet', target: 'single', requiresSave: null },
      abilityEffects: [{ type: 'damage', dice: '1d8+1', damageType: 'piercing' }],
    },
  ],
};

export const monsterBugbear: MonsterTemplate = {
  id: 'bugbear', name: 'Bugbear', cr: 1, srd: true,
  size: 'medium', type: 'humanoid (goblinoid)', alignment: 'chaotic evil',
  stats: { str: 15, dex: 14, con: 13, int: 8, wis: 11, cha: 9 },
  hp: { dice: '5d8+5', average: 27 },
  ac: { value: 16, source: 'hide armor, shield' },
  speed: 30,
  savingThrows: [],
  skills: { stealth: 6, survival: 2 },
  senses: ['darkvision 60 ft', 'passive Perception 10'],
  languages: ['Common', 'Goblin'],
  features: [
    {
      id: 'bugbear_brute', name: 'Brute',
      description: 'A melee weapon deals one extra die of its damage when the bugbear hits with it (already included).',
      source: { kind: 'race', refId: 'bugbear' }, level: null,
      effects: [], actions: [], choices: [], passive: true,
    },
    {
      id: 'bugbear_surprise_attack', name: 'Surprise Attack',
      description: 'If the bugbear surprises a creature and hits it with an attack during the first round of combat, the target takes an extra 7 (2d6) damage from the attack.',
      source: { kind: 'race', refId: 'bugbear' }, level: null,
      effects: [], actions: [], choices: [], passive: true,
    },
    {
      id: 'bugbear_morningstar', name: 'Morningstar',
      description: 'Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 11 (2d8+2) piercing damage.',
      source: { kind: 'race', refId: 'bugbear' }, level: null,
      effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'action', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
      abilityEffects: [{ type: 'damage', dice: '2d8+2', damageType: 'piercing' }],
    },
    {
      id: 'bugbear_javelin', name: 'Javelin',
      description: 'Melee or Ranged Weapon Attack: +4 to hit, reach 5 ft. or range 30/120 ft., one target. Hit: 9 (2d6+2) piercing damage in melee, or 5 (1d6+2) at range.',
      source: { kind: 'race', refId: 'bugbear' }, level: null,
      effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'action', resourceCost: null, range: '30 feet', target: 'single', requiresSave: null },
      abilityEffects: [{ type: 'damage', dice: '2d6+2', damageType: 'piercing' }],
    },
  ],
};

export const monsterGhoul: MonsterTemplate = {
  id: 'ghoul', name: 'Ghoul', cr: 1, srd: true,
  size: 'medium', type: 'undead', alignment: 'chaotic evil',
  stats: { str: 13, dex: 15, con: 10, int: 7, wis: 10, cha: 6 },
  hp: { dice: '5d8', average: 22 },
  ac: { value: 12, source: 'dex' },
  speed: 30,
  savingThrows: [],
  skills: {},
  senses: ['darkvision 60 ft', 'passive Perception 10'],
  languages: ['Common'],
  features: [
    {
      id: 'ghoul_traits', name: 'Undead Traits',
      description: 'The ghoul is immune to poison damage, and to the poisoned, charmed, and exhaustion conditions.',
      source: { kind: 'race', refId: 'ghoul' }, level: null,
      effects: [], actions: [], choices: [], passive: true,
    },
    {
      id: 'ghoul_bite', name: 'Bite',
      description: 'Melee Weapon Attack: +2 to hit, reach 5 ft., one creature. Hit: 9 (2d6+2) piercing damage.',
      source: { kind: 'race', refId: 'ghoul' }, level: null,
      effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'action', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
      abilityEffects: [{ type: 'damage', dice: '2d6+2', damageType: 'piercing' }],
    },
    {
      id: 'ghoul_claws', name: 'Claws',
      description: 'Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 7 (2d4+2) slashing damage. If the target is a creature other than an elf or undead, it must succeed on a DC 10 Constitution saving throw or be paralyzed for 1 minute — repeatable at the end of each of its turns to end early.',
      source: { kind: 'race', refId: 'ghoul' }, level: null,
      effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'action', resourceCost: null, range: '5 feet', target: 'single', requiresSave: { ability: 'con', dc: 10 } },
      abilityEffects: [
        { type: 'damage', dice: '2d4+2', damageType: 'slashing' },
        { type: 'apply_condition', conditionId: 'paralyzed', duration: { unit: 'minutes', remaining: 1 } },
      ],
    },
  ],
};

export const monsterMimic: MonsterTemplate = {
  id: 'mimic', name: 'Mimic', cr: 2, srd: true,
  size: 'medium', type: 'monstrosity (shapechanger)', alignment: 'neutral',
  stats: { str: 17, dex: 12, con: 15, int: 5, wis: 13, cha: 8 },
  hp: { dice: '9d8+18', average: 58 },
  ac: { value: 12, source: 'natural armor' },
  speed: 15,
  savingThrows: [],
  skills: { stealth: 5 },
  senses: ['darkvision 60 ft', 'passive Perception 11'],
  languages: [],
  features: [
    {
      id: 'mimic_shapechanger', name: 'Shapechanger',
      description: 'The mimic can use its action to polymorph into an object or back into its true, amorphous form. Its statistics are the same in each form. Equipment isn\'t transformed. It reverts to its true form if it dies.',
      source: { kind: 'race', refId: 'mimic' }, level: null,
      effects: [], actions: [], choices: [], passive: true,
    },
    {
      id: 'mimic_adhesive', name: 'Adhesive (Object Form Only)',
      description: 'The mimic adheres to anything that touches it. A Huge or smaller creature adhered to the mimic is also grappled by it (escape DC 13, with disadvantage on the check).',
      source: { kind: 'race', refId: 'mimic' }, level: null,
      effects: [], actions: [], choices: [], passive: true,
    },
    {
      id: 'mimic_false_appearance', name: 'False Appearance (Object Form Only)',
      description: 'While the mimic remains motionless, it is indistinguishable from an ordinary object.',
      source: { kind: 'race', refId: 'mimic' }, level: null,
      effects: [], actions: [], choices: [], passive: true,
    },
    {
      id: 'mimic_grappler', name: 'Grappler',
      description: 'The mimic has advantage on attack rolls against any creature grappled by it.',
      source: { kind: 'race', refId: 'mimic' }, level: null,
      effects: [], actions: [], choices: [], passive: true,
    },
    {
      id: 'mimic_pseudopod', name: 'Pseudopod',
      description: 'Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 7 (1d8+3) bludgeoning damage. In object form, the target is also subjected to Adhesive.',
      source: { kind: 'race', refId: 'mimic' }, level: null,
      effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'action', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
      abilityEffects: [{ type: 'damage', dice: '1d8+3', damageType: 'bludgeoning' }],
    },
    {
      id: 'mimic_bite', name: 'Bite',
      description: 'Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 7 (1d8+3) piercing damage plus 4 (1d8) acid damage.',
      source: { kind: 'race', refId: 'mimic' }, level: null,
      effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'action', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
      abilityEffects: [
        { type: 'damage', dice: '1d8+3', damageType: 'piercing' },
        { type: 'damage', dice: '1d8', damageType: 'acid' },
      ],
    },
  ],
};

export const monsterGelatinousCube: MonsterTemplate = {
  id: 'gelatinous_cube', name: 'Gelatinous Cube', cr: 2, srd: true,
  size: 'large', type: 'ooze', alignment: 'unaligned',
  stats: { str: 14, dex: 3, con: 20, int: 1, wis: 6, cha: 1 },
  hp: { dice: '8d10+40', average: 84 },
  ac: { value: 6, source: 'dex' },
  speed: 15,
  savingThrows: [],
  skills: {},
  senses: ['blindsight 60 ft (blind beyond this radius)', 'passive Perception 8'],
  languages: [],
  features: [
    {
      id: 'gelatinous_cube_traits', name: 'Ooze Cube',
      description: 'The cube takes up its entire space. Other creatures can enter its space but are subjected to Engulf with disadvantage on the save. Creatures inside have total cover. A creature within 5 ft. can take an action to pull a creature or object out with a DC 12 Strength check, taking 10 (3d6) acid damage in the attempt. Holds one Large creature or up to four Medium-or-smaller. Immune to being blinded, charmed, deafened, exhausted, frightened, or knocked prone.',
      source: { kind: 'race', refId: 'gelatinous_cube' }, level: null,
      effects: [], actions: [], choices: [], passive: true,
    },
    {
      id: 'gelatinous_cube_transparent', name: 'Transparent',
      description: 'Even in plain sight, it takes a successful DC 15 Wisdom (Perception) check to spot a cube that hasn\'t moved or attacked. A creature that tries to enter its space while unaware of it is surprised by the cube.',
      source: { kind: 'race', refId: 'gelatinous_cube' }, level: null,
      effects: [], actions: [], choices: [], passive: true,
    },
    {
      id: 'gelatinous_cube_pseudopod', name: 'Pseudopod',
      description: 'Melee Weapon Attack: +4 to hit, reach 5 ft., one creature. Hit: 10 (3d6) acid damage.',
      source: { kind: 'race', refId: 'gelatinous_cube' }, level: null,
      effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'action', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
      abilityEffects: [{ type: 'damage', dice: '3d6', damageType: 'acid' }],
    },
    {
      id: 'gelatinous_cube_engulf', name: 'Engulf',
      description: 'The cube moves up to its speed, entering Large-or-smaller creatures\' spaces. Each entered creature makes a DC 12 DEX save. Success: pushed 5 ft. aside (or takes engulf effects if it chooses not to be pushed). Failure: takes 10 (3d6) acid damage and is engulfed — can\'t breathe, is restrained, and takes 21 (6d6) acid damage at the start of each of the cube\'s turns. An engulfed creature can escape with a DC 12 Strength check as an action.',
      source: { kind: 'race', refId: 'gelatinous_cube' }, level: null,
      effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'action', resourceCost: null, range: 'self (speed)', target: 'area', requiresSave: { ability: 'dex', dc: 12 } },
      abilityEffects: [{ type: 'damage', dice: '3d6', damageType: 'acid' }],
    },
  ],
};

export const monsterOwlbear: MonsterTemplate = {
  id: 'owlbear', name: 'Owlbear', cr: 3, srd: true,
  size: 'large', type: 'monstrosity', alignment: 'unaligned',
  stats: { str: 20, dex: 12, con: 17, int: 3, wis: 12, cha: 7 },
  hp: { dice: '7d10+21', average: 59 },
  ac: { value: 13, source: 'natural armor' },
  speed: 40,
  savingThrows: [],
  skills: { perception: 3 },
  senses: ['darkvision 60 ft', 'passive Perception 13'],
  languages: [],
  features: [
    {
      id: 'owlbear_keen_sight_smell', name: 'Keen Sight and Smell',
      description: 'The owlbear has advantage on Wisdom (Perception) checks that rely on sight or smell.',
      source: { kind: 'race', refId: 'owlbear' }, level: null,
      effects: [], actions: [], choices: [], passive: true,
    },
    {
      id: 'owlbear_multiattack', name: 'Multiattack',
      description: 'The owlbear makes two attacks: one with its beak and one with its claws. Shown as two separate action cards — no automated multiattack sequencing, consistent with the app having no attack-roll automation anywhere else.',
      source: { kind: 'race', refId: 'owlbear' }, level: null,
      effects: [], actions: [], choices: [], passive: true,
    },
    {
      id: 'owlbear_beak', name: 'Beak',
      description: 'Melee Weapon Attack: +7 to hit, reach 5 ft., one creature. Hit: 10 (1d10+5) piercing damage.',
      source: { kind: 'race', refId: 'owlbear' }, level: null,
      effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'action', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
      abilityEffects: [{ type: 'damage', dice: '1d10+5', damageType: 'piercing' }],
    },
    {
      id: 'owlbear_claws', name: 'Claws',
      description: 'Melee Weapon Attack: +7 to hit, reach 5 ft., one target. Hit: 14 (2d8+5) slashing damage.',
      source: { kind: 'race', refId: 'owlbear' }, level: null,
      effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'action', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
      abilityEffects: [{ type: 'damage', dice: '2d8+5', damageType: 'slashing' }],
    },
  ],
};

export const monsterWight: MonsterTemplate = {
  id: 'wight', name: 'Wight', cr: 3, srd: true,
  size: 'medium', type: 'undead', alignment: 'neutral evil',
  stats: { str: 15, dex: 14, con: 16, int: 10, wis: 13, cha: 15 },
  hp: { dice: '6d8+18', average: 45 },
  ac: { value: 14, source: 'studded leather armor' },
  speed: 30,
  savingThrows: [],
  skills: { perception: 3, stealth: 4 },
  senses: ['darkvision 60 ft', 'passive Perception 13'],
  languages: ['the languages it knew in life'],
  features: [
    {
      id: 'wight_sunlight_sensitivity', name: 'Sunlight Sensitivity',
      description: 'While in sunlight, the wight has disadvantage on attack rolls, as well as on Wisdom (Perception) checks that rely on sight.',
      source: { kind: 'race', refId: 'wight' }, level: null,
      effects: [], actions: [], choices: [], passive: true,
    },
    {
      id: 'wight_traits', name: 'Undead Traits',
      description: 'Resistant to necrotic damage and to bludgeoning, piercing, and slashing damage from nonmagical attacks that aren\'t silvered. Immune to poison damage and the poisoned/exhaustion conditions.',
      source: { kind: 'race', refId: 'wight' }, level: null,
      effects: [], actions: [], choices: [], passive: true,
    },
    {
      id: 'wight_multiattack', name: 'Multiattack',
      description: 'The wight makes two longsword attacks or two longbow attacks. It can use Life Drain in place of one longsword attack. Shown as separate action cards — no automated multiattack sequencing.',
      source: { kind: 'race', refId: 'wight' }, level: null,
      effects: [], actions: [], choices: [], passive: true,
    },
    {
      id: 'wight_life_drain', name: 'Life Drain',
      description: 'Melee Weapon Attack: +4 to hit, reach 5 ft., one creature. Hit: 5 (1d6+2) necrotic damage. Target must succeed a DC 13 CON save or its HP maximum is reduced by the damage taken until it finishes a long rest; dies if this reduces its max HP to 0. A humanoid slain this way rises in 24 hours as a zombie under the wight\'s control (max 12 at once) unless restored to life or its body destroyed.',
      source: { kind: 'race', refId: 'wight' }, level: null,
      effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'action', resourceCost: null, range: '5 feet', target: 'single', requiresSave: { ability: 'con', dc: 13 } },
      abilityEffects: [{ type: 'damage', dice: '1d6+2', damageType: 'necrotic' }],
    },
    {
      id: 'wight_longsword', name: 'Longsword',
      description: 'Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 6 (1d8+2) slashing damage, or 7 (1d10+2) if used two-handed.',
      source: { kind: 'race', refId: 'wight' }, level: null,
      effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'action', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
      abilityEffects: [{ type: 'damage', dice: '1d8+2', damageType: 'slashing' }],
    },
    {
      id: 'wight_longbow', name: 'Longbow',
      description: 'Ranged Weapon Attack: +4 to hit, range 150/600 ft., one target. Hit: 6 (1d8+2) piercing damage.',
      source: { kind: 'race', refId: 'wight' }, level: null,
      effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'action', resourceCost: null, range: '150 feet', target: 'single', requiresSave: null },
      abilityEffects: [{ type: 'damage', dice: '1d8+2', damageType: 'piercing' }],
    },
  ],
};

export const monsterGiantToad: MonsterTemplate = {
  id: 'giant_toad', name: 'Giant Toad', cr: 1, srd: true,
  size: 'large', type: 'beast', alignment: 'unaligned',
  stats: { str: 15, dex: 13, con: 13, int: 2, wis: 10, cha: 3 },
  hp: { dice: '6d10+6', average: 39 },
  ac: { value: 11, source: 'dex' },
  speed: 20,
  savingThrows: [],
  skills: {},
  senses: ['darkvision 30 ft', 'passive Perception 10'],
  languages: [],
  features: [
    {
      id: 'giant_toad_amphibious', name: 'Amphibious',
      description: 'The toad can breathe air and water.',
      source: { kind: 'race', refId: 'giant_toad' }, level: null,
      effects: [], actions: [], choices: [], passive: true,
    },
    {
      id: 'giant_toad_bite', name: 'Bite',
      description: 'Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 7 (1d10+2) piercing damage plus 5 (1d10) poison damage, and the target is grappled (escape DC 13) and restrained until the grapple ends; while grappling, the toad can\'t bite another target. On a grappled target it can instead Swallow: the target is blinded and restrained with total cover, taking 10 (3d6) acid damage at the start of each of the toad\'s turns, until it escapes or the toad dies.',
      source: { kind: 'race', refId: 'giant_toad' }, level: null,
      effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'action', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
      abilityEffects: [
        { type: 'damage', dice: '1d10+2', damageType: 'piercing' },
        { type: 'damage', dice: '1d10', damageType: 'poison' },
      ],
    },
  ],
};

export const monsterHarpy: MonsterTemplate = {
  id: 'harpy', name: 'Harpy', cr: 1, srd: true,
  size: 'medium', type: 'monstrosity', alignment: 'chaotic evil',
  stats: { str: 12, dex: 13, con: 12, int: 7, wis: 10, cha: 13 },
  hp: { dice: '7d8+7', average: 38 },
  ac: { value: 11, source: 'dex' },
  speed: 20,
  savingThrows: [],
  skills: {},
  senses: ['passive Perception 10'],
  languages: ['Common'],
  features: [
    {
      id: 'harpy_multiattack', name: 'Multiattack',
      description: 'The harpy makes two attacks: one with its claws and one with its club. Shown as separate action cards — no automated multiattack sequencing.',
      source: { kind: 'race', refId: 'harpy' }, level: null,
      effects: [], actions: [], choices: [], passive: true,
    },
    {
      id: 'harpy_luring_song', name: 'Luring Song',
      description: 'The harpy sings a magical melody. Every humanoid/giant within 300 ft. that can hear it must succeed on a DC 11 Wisdom save or be charmed until the song ends (incapacitated, must move toward the harpy each turn) — a bonus action sustains the song each round. Damage from another source, or moving into damaging terrain, lets the target re-save; a successful save grants 24-hour immunity to this harpy\'s song.',
      source: { kind: 'race', refId: 'harpy' }, level: null,
      effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'action', resourceCost: null, range: '300 feet', target: 'area', requiresSave: { ability: 'wis', dc: 11 } },
      abilityEffects: [{ type: 'apply_condition', conditionId: 'charmed', duration: { unit: 'permanent', remaining: 0 } }],
    },
    {
      id: 'harpy_claws', name: 'Claws',
      description: 'Melee Weapon Attack: +3 to hit, reach 5 ft., one target. Hit: 6 (2d4+1) slashing damage.',
      source: { kind: 'race', refId: 'harpy' }, level: null,
      effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'action', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
      abilityEffects: [{ type: 'damage', dice: '2d4+1', damageType: 'slashing' }],
    },
    {
      id: 'harpy_club', name: 'Club',
      description: 'Melee Weapon Attack: +3 to hit, reach 5 ft., one target. Hit: 3 (1d4+1) bludgeoning damage.',
      source: { kind: 'race', refId: 'harpy' }, level: null,
      effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'action', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
      abilityEffects: [{ type: 'damage', dice: '1d4+1', damageType: 'bludgeoning' }],
    },
  ],
};

export const monsterBasilisk: MonsterTemplate = {
  id: 'basilisk', name: 'Basilisk', cr: 3, srd: true,
  size: 'medium', type: 'monstrosity', alignment: 'unaligned',
  stats: { str: 16, dex: 8, con: 15, int: 2, wis: 8, cha: 7 },
  hp: { dice: '8d8+16', average: 52 },
  ac: { value: 12, source: 'natural armor' },
  speed: 20,
  savingThrows: [],
  skills: {},
  senses: ['darkvision 60 ft', 'passive Perception 9'],
  languages: [],
  features: [
    {
      id: 'basilisk_petrifying_gaze', name: 'Petrifying Gaze',
      description: 'If a creature starts its turn within 30 ft. of the basilisk and both can see each other (and the basilisk isn\'t incapacitated), the basilisk can force a DC 12 Constitution save. Failure: the creature begins turning to stone and is restrained; it repeats the save at the end of its next turn, becoming petrified on a second failure (until freed by greater restoration or similar magic) or ending the effect on a success. A creature that isn\'t surprised can avert its eyes to skip the save at the cost of not seeing the basilisk until its own next turn.',
      source: { kind: 'race', refId: 'basilisk' }, level: null,
      effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'action', resourceCost: null, range: '30 feet', target: 'single', requiresSave: { ability: 'con', dc: 12 } },
      abilityEffects: [{ type: 'apply_condition', conditionId: 'petrified', duration: { unit: 'permanent', remaining: 0 } }],
    },
    {
      id: 'basilisk_bite', name: 'Bite',
      description: 'Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 10 (2d6+3) piercing damage plus 7 (2d6) poison damage.',
      source: { kind: 'race', refId: 'basilisk' }, level: null,
      effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'action', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
      abilityEffects: [
        { type: 'damage', dice: '2d6+3', damageType: 'piercing' },
        { type: 'damage', dice: '2d6', damageType: 'poison' },
      ],
    },
  ],
};

export const monsterManticore: MonsterTemplate = {
  id: 'manticore', name: 'Manticore', cr: 3, srd: true,
  size: 'large', type: 'monstrosity', alignment: 'lawful evil',
  stats: { str: 17, dex: 16, con: 17, int: 7, wis: 12, cha: 8 },
  hp: { dice: '8d10+24', average: 68 },
  ac: { value: 14, source: 'natural armor' },
  speed: 30,
  savingThrows: [],
  skills: {},
  senses: ['darkvision 60 ft', 'passive Perception 11'],
  languages: [],
  features: [
    {
      id: 'manticore_multiattack', name: 'Multiattack',
      description: 'The manticore makes three attacks: bite + two claws, or three tail spikes. Shown as separate action cards — no automated multiattack sequencing.',
      source: { kind: 'race', refId: 'manticore' }, level: null,
      effects: [], actions: [], choices: [], passive: true,
    },
    {
      id: 'manticore_tail_spike_regrowth', name: 'Tail Spike Regrowth',
      description: 'The manticore has 24 tail spikes; used spikes regrow after a long rest.',
      source: { kind: 'race', refId: 'manticore' }, level: null,
      effects: [], actions: [], choices: [], passive: true,
    },
    {
      id: 'manticore_bite', name: 'Bite',
      description: 'Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 7 (1d8+3) piercing damage.',
      source: { kind: 'race', refId: 'manticore' }, level: null,
      effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'action', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
      abilityEffects: [{ type: 'damage', dice: '1d8+3', damageType: 'piercing' }],
    },
    {
      id: 'manticore_claw', name: 'Claw',
      description: 'Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 6 (1d6+3) slashing damage.',
      source: { kind: 'race', refId: 'manticore' }, level: null,
      effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'action', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
      abilityEffects: [{ type: 'damage', dice: '1d6+3', damageType: 'slashing' }],
    },
    {
      id: 'manticore_tail_spike', name: 'Tail Spike',
      description: 'Ranged Weapon Attack: +5 to hit, range 100/200 ft., one target. Hit: 7 (1d8+3) piercing damage.',
      source: { kind: 'race', refId: 'manticore' }, level: null,
      effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'action', resourceCost: null, range: '100 feet', target: 'single', requiresSave: null },
      abilityEffects: [{ type: 'damage', dice: '1d8+3', damageType: 'piercing' }],
    },
  ],
};

export const monsterMinotaur: MonsterTemplate = {
  id: 'minotaur', name: 'Minotaur', cr: 3, srd: true,
  size: 'large', type: 'monstrosity', alignment: 'chaotic evil',
  stats: { str: 18, dex: 11, con: 16, int: 6, wis: 16, cha: 9 },
  hp: { dice: '9d10+27', average: 76 },
  ac: { value: 14, source: 'natural armor' },
  speed: 40,
  savingThrows: [],
  skills: { perception: 7 },
  senses: ['darkvision 60 ft', 'passive Perception 17'],
  languages: ['Abyssal'],
  features: [
    {
      id: 'minotaur_charge', name: 'Charge',
      description: 'If the minotaur moves at least 10 ft. straight toward a target and hits it with a gore attack on the same turn, the target takes an extra 9 (2d8) piercing damage and, if a creature, must succeed on a DC 14 Strength save or be pushed up to 10 ft. away and knocked prone.',
      source: { kind: 'race', refId: 'minotaur' }, level: null,
      effects: [], actions: [], choices: [], passive: true,
    },
    {
      id: 'minotaur_labyrinthine_recall', name: 'Labyrinthine Recall',
      description: 'The minotaur can perfectly recall any path it has traveled.',
      source: { kind: 'race', refId: 'minotaur' }, level: null,
      effects: [], actions: [], choices: [], passive: true,
    },
    {
      id: 'minotaur_reckless', name: 'Reckless',
      description: 'At the start of its turn, the minotaur can gain advantage on all melee weapon attacks it makes that turn, but attacks against it have advantage until the start of its next turn.',
      source: { kind: 'race', refId: 'minotaur' }, level: null,
      effects: [], actions: [], choices: [], passive: true,
    },
    {
      id: 'minotaur_greataxe', name: 'Greataxe',
      description: 'Melee Weapon Attack: +6 to hit, reach 5 ft., one target. Hit: 17 (2d12+4) slashing damage.',
      source: { kind: 'race', refId: 'minotaur' }, level: null,
      effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'action', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
      abilityEffects: [{ type: 'damage', dice: '2d12+4', damageType: 'slashing' }],
    },
    {
      id: 'minotaur_gore', name: 'Gore',
      description: 'Melee Weapon Attack: +6 to hit, reach 5 ft., one target. Hit: 13 (2d8+4) piercing damage.',
      source: { kind: 'race', refId: 'minotaur' }, level: null,
      effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'action', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
      abilityEffects: [{ type: 'damage', dice: '2d8+4', damageType: 'piercing' }],
    },
  ],
};

export const monsterWerewolf: MonsterTemplate = {
  id: 'werewolf', name: 'Werewolf', cr: 3, srd: true,
  size: 'medium', type: 'humanoid (human, shapechanger)', alignment: 'chaotic evil',
  stats: { str: 15, dex: 13, con: 14, int: 10, wis: 11, cha: 10 },
  hp: { dice: '9d8+18', average: 58 },
  ac: { value: 12, source: 'natural armor (hybrid form)' },
  speed: 30,
  savingThrows: [],
  skills: { perception: 4 },
  senses: ['passive Perception 14'],
  languages: ['Common (can\'t speak in wolf form)'],
  features: [
    {
      id: 'werewolf_shapechanger', name: 'Shapechanger',
      description: 'The werewolf can use its action to polymorph into a wolf-humanoid hybrid or a wolf, or back into its true humanoid form. Its stats, other than AC, are the same in each form. Equipment isn\'t transformed. It reverts to its true form if it dies. Modeled here as its hybrid combat form.',
      source: { kind: 'race', refId: 'werewolf' }, level: null,
      effects: [], actions: [], choices: [], passive: true,
    },
    {
      id: 'werewolf_traits', name: 'Keen Hearing and Smell; Damage Immunities',
      description: 'Advantage on Wisdom (Perception) checks that rely on hearing or smell. Immune to bludgeoning, piercing, and slashing damage from nonmagical attacks that aren\'t silvered.',
      source: { kind: 'race', refId: 'werewolf' }, level: null,
      effects: [], actions: [], choices: [], passive: true,
    },
    {
      id: 'werewolf_multiattack', name: 'Multiattack',
      description: 'The werewolf makes two attacks: two with its spear (humanoid form) or one bite and one claws (hybrid form). Shown as separate action cards — no automated multiattack sequencing.',
      source: { kind: 'race', refId: 'werewolf' }, level: null,
      effects: [], actions: [], choices: [], passive: true,
    },
    {
      id: 'werewolf_bite', name: 'Bite (Hybrid Form Only)',
      description: 'Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 6 (1d8+2) piercing damage. If the target is a humanoid, it must succeed on a DC 12 Constitution save or be cursed with werewolf lycanthropy.',
      source: { kind: 'race', refId: 'werewolf' }, level: null,
      effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'action', resourceCost: null, range: '5 feet', target: 'single', requiresSave: { ability: 'con', dc: 12 } },
      abilityEffects: [{ type: 'damage', dice: '1d8+2', damageType: 'piercing' }],
    },
    {
      id: 'werewolf_claws', name: 'Claws (Hybrid Form Only)',
      description: 'Melee Weapon Attack: +4 to hit, reach 5 ft., one creature. Hit: 7 (2d4+2) slashing damage.',
      source: { kind: 'race', refId: 'werewolf' }, level: null,
      effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'action', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
      abilityEffects: [{ type: 'damage', dice: '2d4+2', damageType: 'slashing' }],
    },
  ],
};

export const monsterEttin: MonsterTemplate = {
  id: 'ettin', name: 'Ettin', cr: 4, srd: true,
  size: 'large', type: 'giant', alignment: 'chaotic evil',
  stats: { str: 21, dex: 8, con: 17, int: 6, wis: 10, cha: 8 },
  hp: { dice: '10d10+30', average: 85 },
  ac: { value: 12, source: 'natural armor' },
  speed: 40,
  savingThrows: [],
  skills: { perception: 4 },
  senses: ['darkvision 60 ft', 'passive Perception 14'],
  languages: ['Giant', 'Orc'],
  features: [
    {
      id: 'ettin_two_heads', name: 'Two Heads',
      description: 'The ettin has advantage on Wisdom (Perception) checks and on saving throws against being blinded, charmed, deafened, frightened, stunned, or knocked unconscious.',
      source: { kind: 'race', refId: 'ettin' }, level: null,
      effects: [], actions: [], choices: [], passive: true,
    },
    {
      id: 'ettin_wakeful', name: 'Wakeful',
      description: 'When one of the ettin\'s heads is asleep, its other head is awake.',
      source: { kind: 'race', refId: 'ettin' }, level: null,
      effects: [], actions: [], choices: [], passive: true,
    },
    {
      id: 'ettin_multiattack', name: 'Multiattack',
      description: 'The ettin makes two attacks: one with its battleaxe and one with its morningstar. Shown as separate action cards — no automated multiattack sequencing.',
      source: { kind: 'race', refId: 'ettin' }, level: null,
      effects: [], actions: [], choices: [], passive: true,
    },
    {
      id: 'ettin_battleaxe', name: 'Battleaxe',
      description: 'Melee Weapon Attack: +7 to hit, reach 5 ft., one target. Hit: 14 (2d8+5) slashing damage.',
      source: { kind: 'race', refId: 'ettin' }, level: null,
      effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'action', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
      abilityEffects: [{ type: 'damage', dice: '2d8+5', damageType: 'slashing' }],
    },
    {
      id: 'ettin_morningstar', name: 'Morningstar',
      description: 'Melee Weapon Attack: +7 to hit, reach 5 ft., one target. Hit: 14 (2d8+5) piercing damage.',
      source: { kind: 'race', refId: 'ettin' }, level: null,
      effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'action', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
      abilityEffects: [{ type: 'damage', dice: '2d8+5', damageType: 'piercing' }],
    },
  ],
};

export const monsterVampireSpawn: MonsterTemplate = {
  id: 'vampire_spawn', name: 'Vampire Spawn', cr: 5, srd: true,
  size: 'medium', type: 'undead', alignment: 'neutral evil',
  stats: { str: 16, dex: 16, con: 16, int: 11, wis: 10, cha: 12 },
  hp: { dice: '11d8+33', average: 82 },
  ac: { value: 15, source: 'natural armor' },
  speed: 30,
  savingThrows: ['dex', 'wis'],
  skills: { perception: 3, stealth: 6 },
  senses: ['darkvision 60 ft', 'passive Perception 13'],
  languages: ['the languages it knew in life'],
  features: [
    {
      id: 'vampire_spawn_regeneration', name: 'Regeneration',
      description: 'The vampire spawn regains 10 HP at the start of its turn if it has at least 1 HP and isn\'t in sunlight or running water. Radiant damage or holy water suppresses this until the start of its next turn.',
      source: { kind: 'race', refId: 'vampire_spawn' }, level: null,
      effects: [], actions: [], choices: [], passive: true,
    },
    {
      id: 'vampire_spawn_weaknesses', name: 'Vampire Weaknesses',
      description: 'Can\'t enter a residence without invitation. Takes 20 acid damage ending its turn in running water. Destroyed by a wooden piercing weapon through the heart while incapacitated in its resting place. Takes 20 radiant damage starting its turn in sunlight, with disadvantage on attacks/checks while in it. Resistant to necrotic and to nonmagical bludgeoning/piercing/slashing damage. Can climb difficult surfaces (including ceilings) without a check.',
      source: { kind: 'race', refId: 'vampire_spawn' }, level: null,
      effects: [], actions: [], choices: [], passive: true,
    },
    {
      id: 'vampire_spawn_multiattack', name: 'Multiattack',
      description: 'The vampire spawn makes two attacks, only one of which can be a bite. Shown as separate action cards — no automated multiattack sequencing.',
      source: { kind: 'race', refId: 'vampire_spawn' }, level: null,
      effects: [], actions: [], choices: [], passive: true,
    },
    {
      id: 'vampire_spawn_bite', name: 'Bite',
      description: 'Melee Weapon Attack: +6 to hit, reach 5 ft., one willing/grappled/incapacitated/restrained creature. Hit: 6 (1d6+3) piercing plus 7 (2d6) necrotic damage. Target\'s HP maximum is reduced by the necrotic damage taken (until a long rest; dies if reduced to 0) and the vampire spawn regains that much HP.',
      source: { kind: 'race', refId: 'vampire_spawn' }, level: null,
      effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'action', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
      abilityEffects: [
        { type: 'damage', dice: '1d6+3', damageType: 'piercing' },
        { type: 'damage', dice: '2d6', damageType: 'necrotic' },
      ],
    },
    {
      id: 'vampire_spawn_claws', name: 'Claws',
      description: 'Melee Weapon Attack: +6 to hit, reach 5 ft., one creature. Hit: 8 (2d4+3) slashing damage. Can grapple (escape DC 13) instead of dealing damage.',
      source: { kind: 'race', refId: 'vampire_spawn' }, level: null,
      effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'action', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
      abilityEffects: [{ type: 'damage', dice: '2d4+3', damageType: 'slashing' }],
    },
  ],
};

export const monsterHillGiant: MonsterTemplate = {
  id: 'hill_giant', name: 'Hill Giant', cr: 5, srd: true,
  size: 'huge', type: 'giant', alignment: 'chaotic evil',
  stats: { str: 21, dex: 8, con: 19, int: 5, wis: 9, cha: 6 },
  hp: { dice: '10d12+40', average: 105 },
  ac: { value: 13, source: 'natural armor' },
  speed: 40,
  savingThrows: [],
  skills: { perception: 2 },
  senses: ['passive Perception 12'],
  languages: ['Giant'],
  features: [
    {
      id: 'hill_giant_multiattack', name: 'Multiattack',
      description: 'The giant makes two greatclub attacks. Shown as separate action cards — no automated multiattack sequencing.',
      source: { kind: 'race', refId: 'hill_giant' }, level: null,
      effects: [], actions: [], choices: [], passive: true,
    },
    {
      id: 'hill_giant_greatclub', name: 'Greatclub',
      description: 'Melee Weapon Attack: +8 to hit, reach 10 ft., one target. Hit: 18 (3d8+5) bludgeoning damage.',
      source: { kind: 'race', refId: 'hill_giant' }, level: null,
      effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'action', resourceCost: null, range: '10 feet', target: 'single', requiresSave: null },
      abilityEffects: [{ type: 'damage', dice: '3d8+5', damageType: 'bludgeoning' }],
    },
    {
      id: 'hill_giant_rock', name: 'Rock',
      description: 'Ranged Weapon Attack: +8 to hit, range 60/240 ft., one target. Hit: 21 (3d10+5) bludgeoning damage.',
      source: { kind: 'race', refId: 'hill_giant' }, level: null,
      effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'action', resourceCost: null, range: '60 feet', target: 'single', requiresSave: null },
      abilityEffects: [{ type: 'damage', dice: '3d10+5', damageType: 'bludgeoning' }],
    },
  ],
};

export const monsterWraith: MonsterTemplate = {
  id: 'wraith', name: 'Wraith', cr: 5, srd: true,
  size: 'medium', type: 'undead', alignment: 'neutral evil',
  stats: { str: 6, dex: 16, con: 16, int: 12, wis: 14, cha: 15 },
  hp: { dice: '9d8+27', average: 67 },
  ac: { value: 13, source: 'dex' },
  speed: 0,
  savingThrows: [],
  skills: {},
  senses: ['darkvision 60 ft', 'passive Perception 12'],
  languages: ['the languages it knew in life'],
  features: [
    {
      id: 'wraith_incorporeal_movement', name: 'Incorporeal Movement',
      description: 'The wraith can move through other creatures and objects as if difficult terrain, taking 5 (1d10) force damage if it ends its turn inside an object. It hovers and flies at speed 60 ft. (not reflected in the base speed field, which the engine has no incorporeal/hover flag for).',
      source: { kind: 'race', refId: 'wraith' }, level: null,
      effects: [], actions: [], choices: [], passive: true,
    },
    {
      id: 'wraith_sunlight_sensitivity', name: 'Sunlight Sensitivity',
      description: 'While in sunlight, the wraith has disadvantage on attack rolls, as well as on Wisdom (Perception) checks that rely on sight.',
      source: { kind: 'race', refId: 'wraith' }, level: null,
      effects: [], actions: [], choices: [], passive: true,
    },
    {
      id: 'wraith_traits', name: 'Undead Traits',
      description: 'Resistant to acid, cold, fire, lightning, thunder, and to nonmagical bludgeoning/piercing/slashing damage that isn\'t silvered. Immune to necrotic and poison damage, and to the charmed, exhaustion, grappled, paralyzed, petrified, poisoned, prone, and restrained conditions.',
      source: { kind: 'race', refId: 'wraith' }, level: null,
      effects: [], actions: [], choices: [], passive: true,
    },
    {
      id: 'wraith_life_drain', name: 'Life Drain',
      description: 'Melee Weapon Attack: +6 to hit, reach 5 ft., one creature. Hit: 21 (4d8+3) necrotic damage. Target must succeed a DC 14 CON save or its HP maximum is reduced by the damage taken until it finishes a long rest; dies if reduced to 0.',
      source: { kind: 'race', refId: 'wraith' }, level: null,
      effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'action', resourceCost: null, range: '5 feet', target: 'single', requiresSave: { ability: 'con', dc: 14 } },
      abilityEffects: [{ type: 'damage', dice: '4d8+3', damageType: 'necrotic' }],
    },
    {
      id: 'wraith_create_specter', name: 'Create Specter',
      description: 'The wraith targets a humanoid within 10 ft. that has been dead no longer than 1 minute and died violently. The corpse\'s spirit rises as a specter under the wraith\'s control (max 7 at once).',
      source: { kind: 'race', refId: 'wraith' }, level: null,
      effects: [], actions: [], choices: [], passive: true,
    },
  ],
};

/** Every SRD monster template, unfiltered. Prefer ALL_MONSTER_TEMPLATES below. */
export const FULL_MONSTER_LIBRARY: MonsterTemplate[] = [
  monsterGoblin,
  monsterOrc,
  monsterSkeleton,
  monsterZombie,
  monsterWolf,
  monsterGiantSpider,
  monsterBandit,
  monsterGuard,
  monsterOgre,
  monsterTroll,
  monsterYoungRedDragon,
  monsterLich,
  monsterKobold,
  monsterGiantRat,
  monsterStirge,
  monsterHobgoblin,
  monsterBugbear,
  monsterGhoul,
  monsterMimic,
  monsterGelatinousCube,
  monsterOwlbear,
  monsterWight,
  monsterGiantToad,
  monsterHarpy,
  monsterBasilisk,
  monsterManticore,
  monsterMinotaur,
  monsterWerewolf,
  monsterEttin,
  monsterVampireSpawn,
  monsterHillGiant,
  monsterWraith,
];

const SRD_ONLY = process.env.EXPO_PUBLIC_SRD_ONLY === 'true';

/**
 * The monster list the app should use. All 12 templates here are already
 * SRD-safe, so this filter is currently a no-op — wired for consistency and
 * to protect any non-SRD monster added here in the future, same pattern as
 * spells/subclasses/races/backgrounds/feats. See docs/ROADMAP_1.0.md Phase 1.
 */
export const ALL_MONSTER_TEMPLATES: MonsterTemplate[] = SRD_ONLY
  ? FULL_MONSTER_LIBRARY.filter(m => m.srd === true)
  : FULL_MONSTER_LIBRARY;
