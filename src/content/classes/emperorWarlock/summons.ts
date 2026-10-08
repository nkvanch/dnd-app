// ============================================================================
// FILE: src/content/classes/emperorWarlock/summons.ts
// The summoned units of the Bound Spirits as monster stat blocks, so a DM (or the player's table)
// can spawn them from the monster list. The spec gives each unit's AC, HP, speed and attack; it does
// NOT give ability scores, a Challenge Rating, or (for Prometheus and Heracles) an AC, so those are
// filled with plain playable values and every block says so. Summoned HP that depends on the
// Emperor's level ("30 + 2 x Emperor level", "5 x Emperor level") is set at the level the feature
// is first available; enter the real HP as a manual value when spawning.
//
// Engine gap, stated plainly: the app has no authoritative "linked creature owned by a character
// feature" (it acts right after you, your Bonus Action commands it, it vanishes when the binding
// ends). These are ordinary monsters a DM spawns by hand, not entities the player's sheet owns.
// ============================================================================
import type { MonsterTemplate } from '../../monsters/types';
import { feature, activation } from '../../homebrewPack/helpers';

const NOTE = ' (Ability scores and Challenge Rating are not specified by the class design; they are set here for playability.)';
const stats = (str: number, dex: number, con: number) => ({ str, dex, con, int: 8, wis: 10, cha: 10 });

function attack(id: string, name: string, description: string, dice: string, damageType: string, range = '5 feet'): ReturnType<typeof feature> {
  return feature({
    id, name, description,
    source: { kind: 'race', refId: id.split('__')[0] },
    activation: activation('action', { range, target: 'single' }),
    abilityEffects: [{ type: 'damage', dice, damageType }],
    tags: ['attack', 'damage'],
  });
}

function unit(
  id: string, name: string, o: Pick<MonsterTemplate, 'size' | 'ac' | 'hp' | 'speed' | 'stats'> & { cr?: number; features: MonsterTemplate['features']; type?: string },
): MonsterTemplate {
  return {
    id, name, cr: o.cr ?? 5, size: o.size, type: o.type ?? 'spirit (summoned)', alignment: 'unaligned',
    stats: o.stats, hp: o.hp, ac: o.ac, speed: o.speed,
    savingThrows: [], skills: {}, senses: ['passive Perception 10'], languages: [],
    features: o.features,
  };
}

const src = (id: string) => ({ kind: 'race' as const, refId: id });

export const monsterSpectralMob = unit('spectral_mob', 'Spectral Mob (Open the Vodka)', {
  size: 'gargantuan', ac: { value: 12, source: 'spectral' }, hp: { dice: '40', average: 40 }, speed: 30, stats: stats(14, 10, 12),
  features: [
    feature({ id: 'spectral_mob_traits', name: 'Spectral Mob', source: src('spectral_mob'),
      description: 'Summoned for 1 minute from a consumed bottle of alcohol; it occupies a 20-foot square and acts immediately after you. HP is 30 + 2 x the Emperor Warlock\'s level (40 at level 5).' + NOTE }),
    feature({ id: 'spectral_mob_crowd', name: 'Crowding Press', source: src('spectral_mob'),
      description: 'Enemies in the mob\'s space take a -2 penalty to ability checks.' }),
    attack('spectral_mob__slam', 'Slam', 'Melee attack using the summoner\'s Spirit Attack modifier (proficiency bonus + Charisma): 2d6 + Charisma modifier bludgeoning damage.', '2d6', 'bludgeoning', '20 feet'),
  ],
});

export const monsterSpectralWarhorse = unit('spectral_warhorse', 'Spectral Warhorse (Bucephalus)', {
  size: 'large', ac: { value: 14, source: 'spectral' }, hp: { dice: '25', average: 25 }, speed: 120, stats: stats(18, 14, 16), type: 'spirit (summoned beast)',
  features: [
    feature({ id: 'spectral_warhorse_traits', name: 'Bucephalus', source: src('spectral_warhorse'),
      description: 'A spectral warhorse summoned for 10 minutes; it vanishes at 0 hit points. HP is 5 x the Emperor Warlock\'s level (25 at level 5).' + NOTE }),
  ],
});

export const monsterSpectralWarElephant = unit('spectral_war_elephant', 'Spectral War Elephant', {
  size: 'huge', ac: { value: 15, source: 'spectral' }, hp: { dice: '60', average: 60 }, speed: 40, stats: stats(22, 8, 20), type: 'spirit (summoned beast)',
  features: [
    feature({ id: 'spectral_war_elephant_traits', name: 'War Elephant', source: src('spectral_war_elephant'),
      description: 'Summoned for 10 minutes; acts immediately after you, and your Bonus Action commands it to take any action except Dodge. It has three weapon positions.' + NOTE }),
    attack('spectral_war_elephant__bow', 'Howdah Bow (one per operator, up to three)', 'Ranged attack using the operating creature\'s attack modifier, range 150/600 ft: 1d8 piercing.', '1d8', 'piercing', '150 feet'),
  ],
});

export const monsterEagleJaguarHost = unit('eagle_jaguar_host', 'Eagle and Jaguar Host', {
  size: 'gargantuan', ac: { value: 14, source: 'spectral warband' }, hp: { dice: '70', average: 70 }, speed: 35, stats: stats(16, 14, 14),
  features: [
    feature({ id: 'eagle_jaguar_host_traits', name: 'Warband', source: src('eagle_jaguar_host'),
      description: 'A warband of roughly one hundred warriors represented as one creature occupying a 20-foot square; summoned for 1 minute.' + NOTE }),
    attack('eagle_jaguar_host__volley', 'Warband Assault', 'Attack using the summoner\'s Spirit Attack modifier: 4d8 piercing damage.', '4d8', 'piercing', '20 feet'),
  ],
});

export const monsterAchilles = unit('achilles', 'Achilles (Hero of the Odyssey)', {
  size: 'medium', ac: { value: 20, source: 'heroic armor' }, hp: { dice: '80', average: 80 }, speed: 30, stats: stats(20, 16, 18), type: 'spirit (summoned hero)',
  features: [
    feature({ id: 'achilles_multiattack', name: 'Multiattack', source: src('achilles'), description: 'Achilles makes two attacks.' }),
    attack('achilles__blade', 'Blade', 'Melee attack: 2d10 + 6 slashing damage.', '2d10+6', 'slashing'),
    feature({ id: 'achilles_heel', name: 'Heel', source: src('achilles'),
      description: 'Achilles vanishes if he takes a critical hit from poison.' + NOTE }),
  ],
});

export const monsterPrometheus = unit('prometheus', 'Prometheus (Hero of the Odyssey)', {
  size: 'medium', ac: { value: 14, source: 'summoned' }, hp: { dice: '60', average: 60 }, speed: 30, stats: stats(12, 14, 14), type: 'spirit (summoned hero)',
  features: [
    feature({ id: 'prometheus_arrival', name: 'Fire on Arrival', source: src('prometheus'),
      description: 'On arrival, a 20-foot-radius burst of flame: each creature makes a Dexterity saving throw against the summoner\'s Spirit Save DC, taking 10d6 fire damage on a failure, half on a success. (AC and HP are not specified by the class design and are set for playability.)',
      activation: activation('free', { range: '20 feet', target: 'area', requiresSave: { ability: 'dex', dc: 'spell_save_dc' } }),
      abilityEffects: [{ type: 'damage', dice: '10d6', damageType: 'fire', saveOnSuccess: 'half' }], tags: ['damage', 'aoe', 'save'] }),
    attack('prometheus__fire', 'Fire Bolt', 'Ranged attack: 3d10 fire damage.', '3d10', 'fire', '120 feet'),
  ],
});

export const monsterHeracles = unit('heracles', 'Heracles (Hero of the Odyssey)', {
  size: 'medium', ac: { value: 16, source: 'summoned' }, hp: { dice: '90', average: 90 }, speed: 30, stats: stats(26, 12, 20), type: 'spirit (summoned hero)',
  features: [
    feature({ id: 'heracles_multiattack', name: 'Multiattack', source: src('heracles'), description: 'Heracles makes two attacks.' }),
    attack('heracles__club', 'Club', 'Melee attack: 2d12 + 8 bludgeoning damage.', '2d12+8', 'bludgeoning'),
    feature({ id: 'heracles_labors', name: 'Labors of Heracles', source: src('heracles'),
      description: 'Advantage on Strength checks and saving throws. He counts as Huge for lifting, pushing, and breaking, and will attempt any physical labor he is ordered to do. (AC and HP are not specified by the class design and are set for playability.)',
      effects: [{ type: 'stat_modifier', target: 'Strength checks and saving throws', operation: 'advantage', value: null, condition: null }] }),
  ],
});

export const monsterKartvelebi = unit('kartvelebi', 'Kartvelebi (Spearmen of Georgia)', {
  size: 'large', ac: { value: 16, source: 'shield wall' }, hp: { dice: '80', average: 80 }, speed: 30, stats: stats(18, 10, 16),
  features: [
    attack('kartvelebi__strike', 'Heavy Strike', 'Melee attack: 4d10 slashing damage. Once per summoning, add 3d8 radiant damage to a hit.', '4d10', 'slashing'),
    attack('kartvelebi__radiant', 'Radiant Strike (once per summoning)', 'Add 3d8 radiant damage to a hit.', '3d8', 'radiant'),
    feature({ id: 'kartvelebi_command', name: 'One Command', source: src('kartvelebi'),
      description: 'Summoned for 1 minute together with the Khevsurebi; both units act under one command, immediately after you.' + NOTE }),
  ],
});

export const monsterKhevsurebi = unit('khevsurebi', 'Khevsurebi (Mountain Warriors of Georgia)', {
  size: 'large', ac: { value: 15, source: 'mail' }, hp: { dice: '60', average: 60 }, speed: 35, stats: stats(16, 14, 14),
  features: [
    attack('khevsurebi__bow', 'Bow', 'Ranged attack, range 300 ft: 3d8 piercing damage.', '3d8', 'piercing', '300 feet'),
    attack('khevsurebi__sword', 'Sword', 'Melee attack: 2d8 slashing damage.', '2d8', 'slashing'),
    feature({ id: 'khevsurebi_shield', name: 'Shield Up', source: src('khevsurebi'),
      description: 'Reaction: +2 AC against one attack.',
      activation: activation('reaction'), tags: ['buff'] }),
  ],
});

export const EMPEROR_SUMMONS: MonsterTemplate[] = [
  monsterSpectralMob, monsterSpectralWarhorse, monsterSpectralWarElephant, monsterEagleJaguarHost,
  monsterAchilles, monsterPrometheus, monsterHeracles, monsterKartvelebi, monsterKhevsurebi,
];
