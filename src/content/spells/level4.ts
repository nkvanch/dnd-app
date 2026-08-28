// ============================================================================
// FILE: src/content/spells/level4.ts
// Level 4 spells not yet in index.ts
// ============================================================================
import { Spell } from '../../engine/types';

export const spellGreaterInvisibility: Spell = {
  id: 'greater_invisibility', name: 'Greater Invisibility', level: 4, school: 'Illusion',
  castingTime: '1 action', range: 'Touch', components: ['V', 'S'],
  duration: 'Concentration, up to 1 minute',
  description: 'You or a creature you touch becomes invisible until the spell ends. Anything the target is wearing or carrying is invisible as long as it is on the target\'s person. Unlike the Invisibility spell, this one doesn\'t end if the target attacks or casts a spell.',
  upcast: null, ritual: false, concentration: true, srd: true, classes: ['bard', 'sorcerer', 'wizard'],
};

export const spellIceStorm: Spell = {
  id: 'ice_storm', name: 'Ice Storm', level: 4, school: 'Evocation',
  castingTime: '1 action', range: '300 feet', components: ['V', 'S', 'M'],
  duration: 'Instantaneous',
  description: 'A hail of rock-hard ice pounds to the ground in a 20-foot-radius, 40-foot-high cylinder centered on a point within range. Each creature in the cylinder must make a Dexterity saving throw. A creature takes 2d8 bludgeoning damage and 4d6 cold damage on a failed save, or half as much on a successful one. Hailstones turn the storm\'s area of effect into difficult terrain until the end of your next turn.',
  upcast: 'When you cast this spell using a slot of 5th level or higher, the bludgeoning damage increases by 1d8 for each slot level above 4th.',
  ritual: false, concentration: false, srd: true, classes: ['druid', 'sorcerer', 'wizard'],
};

export const spellWallOfFire: Spell = {
  id: 'wall_of_fire', name: 'Wall of Fire', level: 4, school: 'Evocation',
  castingTime: '1 action', range: '120 feet', components: ['V', 'S', 'M'],
  duration: 'Concentration, up to 1 minute',
  description: 'You create a wall of fire on a solid surface within range. The wall can be up to 60 feet long, 20 feet high, and 1 foot thick, or a ringed wall up to 20 feet in diameter, 20 feet high, and 1 foot thick. The wall is opaque and lasts for the duration. When the wall appears, each creature within its area must make a Dexterity saving throw. On a failed save, a creature takes 5d8 fire damage, or half as much on a successful save. One side of the wall (your choice) deals 5d8 fire damage to each creature that ends its turn within 10 feet of that side or inside the wall.',
  upcast: 'When you cast this spell using a slot of 5th level or higher, the damage increases by 1d8 for each slot level above 4th.',
  ritual: false, concentration: true, srd: true, classes: ['druid', 'sorcerer', 'wizard'],
};

export const spellConfusion: Spell = {
  id: 'confusion', name: 'Confusion', level: 4, school: 'Enchantment',
  castingTime: '1 action', range: '90 feet', components: ['V', 'S', 'M'],
  duration: 'Concentration, up to 1 minute',
  description: 'This spell assaults and twists creatures\' minds, spawning delusions and provoking uncontrolled action. Each creature in a 10-foot-radius sphere centered on a point you choose within range must succeed on a Wisdom saving throw when you cast this spell or be affected by it. An affected target can\'t take reactions and must roll a d10 at the start of each of its turns to determine its behavior for that turn (moves in a random direction, does nothing, attacks nearest creature, or acts normally).',
  upcast: 'When you cast this spell using a slot of 5th level or higher, the radius of the sphere increases by 5 feet for each slot level above 4th.',
  ritual: false, concentration: true, srd: true, classes: ['bard', 'druid', 'sorcerer', 'wizard'],
};

export const spellBlight: Spell = {
  id: 'blight', name: 'Blight', level: 4, school: 'Necromancy',
  castingTime: '1 action', range: '30 feet', components: ['V', 'S'],
  duration: 'Instantaneous',
  description: 'Necromantic energy washes over a creature of your choice that you can see within range, draining moisture and vitality from it. The target must make a Constitution saving throw. The target takes 8d8 necrotic damage on a failed save, or half as much on a successful one. This spell has no effect on undead or constructs. If you target a plant creature or a magical plant, it makes the saving throw with disadvantage, and the spell deals maximum damage to it.',
  upcast: 'When you cast this spell using a slot of 5th level or higher, the damage increases by 1d8 for each slot level above 4th.',
  ritual: false, concentration: false, srd: true, classes: ['druid', 'sorcerer', 'warlock', 'wizard'],
};

export const spellDimensionDoor: Spell = {
  id: 'dimension_door', name: 'Dimension Door', level: 4, school: 'Conjuration',
  castingTime: '1 action', range: '500 feet', components: ['V'],
  duration: 'Instantaneous',
  description: 'You teleport yourself from your current location to any other spot within range. You arrive at exactly the spot desired. It can be a place you can see, one you can visualize, or one you can describe by stating distance and direction. You can bring along objects as long as their weight doesn\'t exceed what you can carry. You can also bring one willing creature of your size or smaller who is carrying gear up to its carrying capacity. If you would arrive in a place already occupied by an object or a creature, you and any creature traveling with you each take 4d6 force damage, and the spell fails to teleport you.',
  upcast: null, ritual: false, concentration: false, srd: true, classes: ['bard', 'sorcerer', 'warlock', 'wizard'],
};

export const spellDeathWard: Spell = {
  id: 'death_ward', name: 'Death Ward', level: 4, school: 'Abjuration',
  castingTime: '1 action', range: 'Touch', components: ['V', 'S'],
  duration: '8 hours',
  description: 'You touch a creature and grant it a measure of protection from death. The first time the target would drop to 0 hit points as a result of taking damage, the target instead drops to 1 hit point, and the spell ends. If the spell is still in effect when the target is subjected to an effect that would kill it instantaneously without dealing damage, that effect is instead negated against the target, and the spell ends.',
  upcast: null, ritual: false, concentration: false, srd: true, classes: ['cleric', 'paladin'],
};

export const spellFreedomOfMovement: Spell = {
  id: 'freedom_of_movement', name: 'Freedom of Movement', level: 4, school: 'Abjuration',
  castingTime: '1 action', range: 'Touch', components: ['V', 'S', 'M'],
  duration: '1 hour',
  description: 'You touch a willing creature. For the duration, the target\'s movement is unaffected by difficult terrain, and spells and other magical effects can neither reduce the target\'s speed nor cause the target to be paralyzed or restrained. The target can also spend 5 feet of movement to automatically escape from nonmagical restraints such as manacles or a creature that has it grappled. Finally, being underwater imposes no penalties on the target\'s movement or attacks.',
  upcast: null, ritual: false, concentration: false, srd: true, classes: ['bard', 'cleric', 'druid', 'ranger'],
};

export const spellGuardianOfFaith: Spell = {
  id: 'guardian_of_faith', name: 'Guardian of Faith', level: 4, school: 'Conjuration',
  castingTime: '1 action', range: '30 feet', components: ['V'],
  duration: '8 hours',
  description: 'A Large spectral guardian appears and hovers for the duration in an unoccupied space of your choice that you can see within range. The guardian occupies that space and is indistinct except for a gleaming sword and shield emblazoned with the symbol of your deity. Any creature hostile to you that moves to a space within 10 feet of the guardian for the first time on a turn must succeed on a Dexterity saving throw. The creature takes 20 radiant damage on a failed save, or half as much on a successful one. The guardian vanishes when it has dealt a total of 60 damage.',
  upcast: null, ritual: false, concentration: false, srd: true, classes: ['cleric', 'paladin'],
};

// RENAMED per ROADMAP_1.0.md Step 1.2 — "Evard's" is Product Identity naming.
// The mechanic is core PHB; SRD 5.1 lists this as plain "Black Tentacles". The
// id is left as 'black_tentacles' (already matched the SRD name), only the
// display name needed stripping.
export const spellBlackTentacles: Spell = {
  id: 'black_tentacles', name: 'Black Tentacles', level: 4, school: 'Conjuration',
  castingTime: '1 action', range: '90 feet', components: ['V', 'S', 'M'],
  duration: 'Concentration, up to 1 minute',
  description: 'Squirming, ebony tentacles fill a 20-foot square on ground that you can see within range. For the duration, these tentacles turn the ground in the area into difficult terrain. When a creature enters the affected area for the first time on a turn or starts its turn there, the creature must succeed on a Dexterity saving throw or take 3d6 bludgeoning damage and be restrained by the tentacles until the spell ends. A creature that starts its turn in the area and is already restrained by the tentacles takes 3d6 bludgeoning damage. A creature restrained by the tentacles can use its action to make a Strength or Dexterity check (its choice) against your spell save DC. On a success, it frees itself.',
  upcast: null, ritual: false, concentration: true, srd: true, classes: ['wizard'],
};

export const spellCompulsion: Spell = {
  id: 'compulsion', name: 'Compulsion', level: 4, school: 'Enchantment',
  castingTime: '1 action', range: '30 feet', components: ['V', 'S'],
  duration: 'Concentration, up to 1 minute',
  description: 'Creatures of your choice that you can see within range and that can hear you must make a Wisdom saving throw. A target automatically succeeds on this saving throw if it can\'t be charmed. On a failed save, a target is affected by this spell. Until the spell ends, you can use a bonus action on each of your turns to designate a direction. Each affected target must use as much of its movement as possible to move in that direction on its next turn. It can take its action before it moves. After moving in this way, it can make another Wisdom saving throw to end the effect.',
  upcast: null, ritual: false, concentration: true, srd: true, classes: ['bard'],
};

export const NEW_LEVEL4: Spell[] = [
  spellGreaterInvisibility,
  spellIceStorm,
  spellWallOfFire,
  spellConfusion,
  spellBlight,
  spellDimensionDoor,
  spellDeathWard,
  spellFreedomOfMovement,
  spellGuardianOfFaith,
  spellBlackTentacles,
  spellCompulsion,
];
