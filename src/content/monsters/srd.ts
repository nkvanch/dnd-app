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
