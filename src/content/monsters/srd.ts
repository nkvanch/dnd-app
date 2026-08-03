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
