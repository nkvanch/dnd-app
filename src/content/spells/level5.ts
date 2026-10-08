// ============================================================================
// FILE: src/content/spells/level5.ts
// Level 5 spells not yet in index.ts
// ============================================================================
import { Spell } from '../../engine/types';

export const spellAnimateObjects: Spell = {
  id: 'animate_objects', name: 'Animate Objects', level: 5, school: 'Transmutation',
  castingTime: '1 action', range: '120 feet', components: ['V', 'S'],
  duration: 'Concentration, up to 1 minute',
  description: 'Objects come to life at your command. Choose up to ten nonmagical objects within range that are not being worn or carried. Medium targets count as two objects, Large targets count as four objects, Huge targets count as eight objects. You can\'t animate any object larger than Huge. Each target animates and becomes a creature under your control until the spell ends or until reduced to 0 hit points. As a bonus action, you can mentally command any creature you made with this spell if the creature is within 500 feet of you (if you control multiple creatures, you can command any or all of them at the same time, issuing the same command to each one).',
  upcast: 'When you cast this spell using a slot of 6th level or higher, you can animate two additional objects for each slot level above 5th.',
  ritual: false, concentration: true, srd: true, classes: ['artificer', 'bard', 'sorcerer', 'wizard'],
};

export const spellWallOfForce: Spell = {
  id: 'wall_of_force', name: 'Wall of Force', level: 5, school: 'Evocation',
  castingTime: '1 action', range: '120 feet', components: ['V', 'S', 'M'],
  duration: 'Concentration, up to 10 minutes',
  description: 'An invisible wall of force springs into existence at a point you choose within range. The wall appears in any orientation you choose, as a horizontal or vertical barrier or at an angle. It can be free floating or resting on a solid surface. You can form it into a hemispherical dome or a sphere with a radius of up to 10 feet, or you can shape a flat surface made up of ten 10-foot-by-10-foot panels. Each panel must be contiguous with another panel. In any form, the wall is 1/4 inch thick. It lasts for the duration. If the wall cuts through a creature\'s space when it appears, the creature is pushed to one side of the wall (your choice). Nothing can physically pass through the wall. It is immune to all damage and can\'t be dispelled by Dispel Magic. A Disintegrate spell destroys the wall instantly.',
  upcast: null, ritual: false, concentration: true, srd: true, classes: ['wizard'],
};

export const spellTelekinesis: Spell = {
  id: 'telekinesis', name: 'Telekinesis', level: 5, school: 'Transmutation',
  castingTime: '1 action', range: '60 feet', components: ['V', 'S'],
  duration: 'Concentration, up to 10 minutes',
  description: 'You gain the ability to move or manipulate creatures or objects by thought. When you cast the spell, and as your action each round for the duration, you can exert your will on one creature or object that you can see within range, causing the appropriate effect below. You can affect the same target round after round, or choose a new one at any time. On creatures: make a contested check (your spellcasting ability vs. Strength) to move the creature up to 30 feet. On objects (up to 1,000 pounds): you move it up to 30 feet and can exert fine motor control on it.',
  upcast: null, ritual: false, concentration: true, srd: true, classes: ['sorcerer', 'wizard'],
};

// NOT SRD (moderate-high confidence) — Synaptic Static is a later addition
// (Mordenkainen/Monsters-of-the-Multiverse era, Mind Flayer-themed), not core PHB.
export const spellSynapticStatic: Spell = {
  id: 'synaptic_static', name: 'Synaptic Static', level: 5, school: 'Enchantment',
  castingTime: '1 action', range: '120 feet', components: ['V', 'S'],
  duration: 'Instantaneous',
  description: 'You choose a point within range and cause psychic energy to explode there. Each creature in a 20-foot-radius sphere centered on that point must make an Intelligence saving throw. A creature with an Intelligence score of 2 or lower can\'t be affected by this spell. A target takes 8d6 psychic damage on a failed save, or half as much on a successful one. On a failed save, a target also has muddled thoughts for 1 minute. During that time, it rolls a d6 and subtracts the number rolled from all its attack rolls and ability checks, as well as its Constitution saving throws to maintain concentration. The target can make an Intelligence saving throw at the end of each of its turns, ending the effect on itself on a success.',
  upcast: null, ritual: false, concentration: false, srd: false, classes: ['bard', 'sorcerer', 'warlock', 'wizard'],
};

export const spellFlameStrike: Spell = {
  id: 'flame_strike', name: 'Flame Strike', level: 5, school: 'Evocation',
  castingTime: '1 action', range: '60 feet', components: ['V', 'S', 'M'],
  duration: 'Instantaneous',
  description: 'A vertical column of divine fire roars down from the heavens in a location you specify. Each creature in a 10-foot-radius, 40-foot-high cylinder centered on a point within range must make a Dexterity saving throw. A creature takes 4d6 fire damage and 4d6 radiant damage on a failed save, or half as much on a successful one.',
  upcast: 'When you cast this spell using a slot of 6th level or higher, the fire damage or the radiant damage (your choice) increases by 1d6 for each slot level above 5th.',
  ritual: false, concentration: false, srd: true, classes: ['cleric'],
};

export const spellMassCureWounds: Spell = {
  id: 'mass_cure_wounds', name: 'Mass Cure Wounds', level: 5, school: 'Evocation',
  castingTime: '1 action', range: '60 feet', components: ['V', 'S'],
  duration: 'Instantaneous',
  description: 'A wave of healing energy washes out from a point of your choice within range. Choose up to six creatures in a 30-foot-radius sphere centered on that point. Each target regains hit points equal to 3d8 + your spellcasting ability modifier. This spell has no effect on undead or constructs.',
  upcast: 'When you cast this spell using a slot of 6th level or higher, the healing increases by 1d8 for each slot level above 5th.',
  ritual: false, concentration: false, srd: true, classes: ['bard', 'cleric', 'druid'],
};

export const spellRaiseDead: Spell = {
  id: 'raise_dead', name: 'Raise Dead', level: 5, school: 'Necromancy',
  castingTime: '1 hour', range: 'Touch', components: ['V', 'S', 'M'],
  duration: 'Instantaneous',
  description: 'You return a dead creature you touch to life, provided that it has been dead no longer than 10 days. If the creature\'s soul is both willing and at liberty to rejoin the body, the creature returns to life with 1 hit point. This spell also neutralizes any poisons and cures nonmagical diseases that affected the creature at the time it died. The spell can\'t return an undead creature to life. This spell closes all mortal wounds, but it doesn\'t restore missing body parts. Coming back from the dead is an ordeal. The target takes a −4 penalty to all attack rolls, saving throws, and ability checks. Every time the target finishes a long rest, the penalty is reduced by 1, until it disappears after four long rests.',
  upcast: null, ritual: false, concentration: false, srd: true, classes: ['bard', 'cleric', 'paladin'],
};

export const spellInsectPlague: Spell = {
  id: 'insect_plague', name: 'Insect Plague', level: 5, school: 'Conjuration',
  castingTime: '1 action', range: '300 feet', components: ['V', 'S', 'M'],
  duration: 'Concentration, up to 10 minutes',
  description: 'Swarming, biting locusts fill a 20-foot-radius sphere centered on a point you choose within range. The sphere spreads around corners. The sphere remains for the duration and its area is lightly obscured. The sphere\'s area is difficult terrain. When the area appears, each creature in it must make a Constitution saving throw. A creature takes 4d10 piercing damage on a failed save, or half as much on a successful one. A creature must also make this saving throw when it enters the spell\'s area for the first time on a turn or ends its turn there.',
  upcast: 'When you cast this spell using a slot of 6th level or higher, the damage increases by 1d10 for each slot level above 5th.',
  ritual: false, concentration: true, srd: true, classes: ['cleric', 'druid', 'sorcerer'],
};

export const spellDominatePerson: Spell = {
  id: 'dominate_person', name: 'Dominate Person', level: 5, school: 'Enchantment',
  castingTime: '1 action', range: '60 feet', components: ['V', 'S'],
  duration: 'Concentration, up to 1 minute',
  description: 'You attempt to beguile a humanoid that you can see within range. It must succeed on a Wisdom saving throw or be charmed by you for the duration. While the target is charmed, you have a telepathic link with it as long as the two of you are on the same plane of existence. You can use this telepathic link to issue commands to the creature while you are conscious (no action required), which it does its best to obey. You can specify a simple and general course of action. Each time the target takes damage, it makes a new Wisdom saving throw against the spell. On a success, the spell ends.',
  upcast: 'When you cast this spell using a slot of 6th level or higher, the duration increases to 10 minutes (6th), 1 hour (7th), or 8 hours (8th or 9th).',
  ritual: false, concentration: true, srd: true, classes: ['bard', 'sorcerer', 'warlock', 'wizard'],
};

export const spellScrying: Spell = {
  id: 'scrying', name: 'Scrying', level: 5, school: 'Divination',
  castingTime: '10 minutes', range: 'Self', components: ['V', 'S', 'M'],
  duration: 'Concentration, up to 10 minutes',
  description: 'You can see and hear a particular creature you choose that is on the same plane of existence as you. The target must make a Wisdom saving throw, which is modified by how well you know the target and the sort of physical connection you have to it. If a target knows you\'re casting this spell, it can fail the saving throw voluntarily if it wants to be observed. On a failed save, the spell creates an invisible sensor within 10 feet of the target. You can see and hear through the sensor as if you were there.',
  upcast: null, ritual: false, concentration: true, srd: true, classes: ['bard', 'cleric', 'druid', 'warlock', 'wizard'],
};

export const spellDestructiveWave: Spell = {
  id: 'destructive_wave', name: 'Destructive Wave', level: 5, school: 'Evocation',
  castingTime: '1 action', range: 'Self (30-foot radius)', components: ['V'],
  duration: 'Instantaneous',
  description: 'You strike the ground, creating a burst of divine energy that ripples outward from you. Each creature you choose within 30 feet of you must succeed on a Constitution saving throw or take 5d6 thunder damage, as well as 5d6 radiant or necrotic damage (your choice), and be knocked prone. A creature that succeeds on its saving throw takes half as much damage and isn\'t knocked prone.',
  upcast: null, ritual: false, concentration: false, srd: false, classes: ['paladin'],
};

export const spellGeas: Spell = {
  id: 'geas', name: 'Geas', level: 5, school: 'Enchantment',
  castingTime: '1 minute', range: '60 feet', components: ['V'],
  duration: '30 days',
  description: 'You place a magical command on a creature that you can see within range, forcing it to carry out some service or refrain from some action or course of activity as you decide. If the creature can understand you, it must succeed on a Wisdom saving throw or become charmed by you for the duration. While the creature is charmed by you, it takes 5d10 psychic damage each time it acts in a manner directly counter to your instructions, but no more than once each day.',
  upcast: 'When you cast this spell using a slot of 7th or 8th level, the duration is 1 year. When you use a 9th-level slot, the spell lasts until it is ended by one of the spells that can end it.',
  ritual: false, concentration: false, srd: true, classes: ['bard', 'cleric', 'druid', 'paladin', 'wizard'],
};

export const NEW_LEVEL5: Spell[] = [
  spellAnimateObjects,
  spellWallOfForce,
  spellTelekinesis,
  spellSynapticStatic,
  spellFlameStrike,
  spellMassCureWounds,
  spellRaiseDead,
  spellInsectPlague,
  spellDominatePerson,
  spellScrying,
  spellDestructiveWave,
  spellGeas,
];
