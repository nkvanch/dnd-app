// ============================================================================
// FILE: src/content/spells/level6.ts
// Level 6 spells not yet in index.ts
// ============================================================================
import { Spell } from '../../engine/types';

export const spellDisintegrate: Spell = {
  id: 'disintegrate', name: 'Disintegrate', level: 6, school: 'Transmutation',
  castingTime: '1 action', range: '60 feet', components: ['V', 'S', 'M'],
  duration: 'Instantaneous',
  description: 'A thin green ray springs from your pointing finger to a target you can see within range. The target can be a creature, an object, or a creation of magical force, such as a wall created by Wall of Force. A creature targeted by this spell must make a Dexterity saving throw. On a failed save, the target takes 10d6+40 force damage. The target is disintegrated if this damage leaves it with 0 hit points. A disintegrated creature and everything it is wearing and carrying, except magic items, are reduced to a pile of fine gray dust. A creature destroyed in this way can\'t be restored to life by any means short of a True Resurrection or a Wish spell.',
  upcast: 'When you cast this spell using a slot of 7th level or higher, the damage increases by 3d6 for each slot level above 6th.',
  ritual: false, concentration: false, srd: true, classes: ['sorcerer', 'wizard'],
};

export const spellGlobeOfInvulnerability: Spell = {
  id: 'globe_of_invulnerability', name: 'Globe of Invulnerability', level: 6, school: 'Abjuration',
  castingTime: '1 action', range: 'Self (10-foot radius)', components: ['V', 'S', 'M'],
  duration: 'Concentration, up to 1 minute',
  description: 'An immobile, faintly shimmering barrier springs into existence in a 10-foot radius around you and remains for the duration. Any spell of 5th level or lower cast from outside the barrier can\'t affect creatures or objects within it, even if the spell is cast using a higher level spell slot. Such a spell can target creatures and objects within the barrier, but the spell has no effect on them. Similarly, the area within the barrier is excluded from the areas affected by such spells.',
  upcast: 'When you cast this spell using a spell slot of 7th level or higher, the barrier blocks spells of one level higher for each slot level above 6th.',
  ritual: false, concentration: true, srd: true, classes: ['sorcerer', 'wizard'],
};

export const spellSunbeam: Spell = {
  id: 'sunbeam', name: 'Sunbeam', level: 6, school: 'Evocation',
  castingTime: '1 action', range: 'Self (60-foot line)', components: ['V', 'S', 'M'],
  duration: 'Concentration, up to 1 minute',
  description: 'A beam of brilliant light flashes out from your hand in a 5-foot-wide, 60-foot-long line. Each creature in the line must make a Constitution saving throw. On a failed save, a creature takes 6d8 radiant damage and is blinded until your next turn. On a successful save, it takes half as much damage and isn\'t blinded. Undead and oozes have disadvantage on this saving throw. You can create a new line of radiance as your action on any turn until the spell ends. For the duration, a mote of brilliant radiance shines in your hand. It sheds bright light in a 30-foot radius and dim light for an additional 30 feet.',
  upcast: null, ritual: false, concentration: true, srd: true, classes: ['druid', 'sorcerer', 'wizard'],
};

export const spellTrueSeeing: Spell = {
  id: 'true_seeing', name: 'True Seeing', level: 6, school: 'Divination',
  castingTime: '1 action', range: 'Touch', components: ['V', 'S', 'M'],
  duration: '1 hour',
  description: 'You give the willing creature you touch the ability to see things as they actually are. For the duration, the creature has truesight, notices secret doors hidden by magic, and can see into the Ethereal Plane, all out to a range of 120 feet.',
  upcast: null, ritual: false, concentration: false, srd: true, classes: ['bard', 'cleric', 'druid', 'sorcerer', 'warlock', 'wizard'],
};

export const spellHeroesFeast: Spell = {
  id: 'heroes_feast', name: "Heroes' Feast", level: 6, school: 'Conjuration',
  castingTime: '10 minutes', range: 'Self (30-foot radius)', components: ['V', 'S', 'M'],
  duration: 'Instantaneous',
  description: 'You bring forth a great feast, including magnificent food and drink. The feast takes 1 hour to consume and disappears at the end of that time, and the beneficial effects don\'t set in until this hour is over. Up to twelve creatures can partake of the feast. A creature that partakes of the feast gains several benefits for 24 hours: is cured of all diseases and poison, becomes immune to poison and the frightened condition, makes all Wisdom saving throws with advantage, maximum hit points increase by 2d10, and regains those hit points.',
  upcast: null, ritual: false, concentration: false, srd: true, classes: ['cleric', 'druid'],
};

export const spellHeal: Spell = {
  id: 'heal', name: 'Heal', level: 6, school: 'Evocation',
  castingTime: '1 action', range: '60 feet', components: ['V', 'S'],
  duration: 'Instantaneous',
  description: 'Choose a creature that you can see within range. A surge of positive energy washes through the creature, causing it to regain 70 hit points. This spell also ends blindness, deafness, and any diseases affecting the target. This spell has no effect on constructs or undead.',
  upcast: 'When you cast this spell using a spell slot of 7th level or higher, the amount of healing increases by 10 for each slot level above 6th.',
  ritual: false, concentration: false, srd: true, classes: ['cleric', 'druid'],
};

export const spellHarm: Spell = {
  id: 'harm', name: 'Harm', level: 6, school: 'Necromancy',
  castingTime: '1 action', range: '60 feet', components: ['V', 'S'],
  duration: 'Instantaneous',
  description: 'You unleash a virulent disease on a creature that you can see within range. The target must make a Constitution saving throw. On a failed save, it takes 14d6 necrotic damage, or half as much on a successful save. The damage can\'t reduce the target\'s hit points below 1. If the target fails the saving throw, its hit point maximum is reduced for 1 hour by an amount equal to the necrotic damage it took. Any effect that removes a disease allows a creature\'s hit point maximum to return to normal before that time passes.',
  upcast: null, ritual: false, concentration: false, srd: true, classes: ['cleric'],
};

export const spellBladeBarrier: Spell = {
  id: 'blade_barrier', name: 'Blade Barrier', level: 6, school: 'Evocation',
  castingTime: '1 action', range: '90 feet', components: ['V', 'S'],
  duration: 'Concentration, up to 10 minutes',
  description: 'You create a vertical wall of whirling, razor-sharp blades made of magical energy. The wall appears within range and lasts for the duration. You can make a straight wall up to 100 feet long, 20 feet high, and 5 feet thick, or a ringed wall up to 60 feet in diameter, 20 feet high, and 5 feet thick. The wall provides three-quarters cover to creatures behind it, and its space is difficult terrain. When a creature enters the wall\'s area for the first time on a turn or starts its turn there, the creature must make a Dexterity saving throw. On a failed save, the creature takes 6d10 slashing damage. On a successful save, the creature takes half as much damage.',
  upcast: null, ritual: false, concentration: true, srd: true, classes: ['cleric'],
};

export const NEW_LEVEL6: Spell[] = [
  spellDisintegrate,
  spellGlobeOfInvulnerability,
  spellSunbeam,
  spellTrueSeeing,
  spellHeroesFeast,
  spellHeal,
  spellHarm,
  spellBladeBarrier,
];
