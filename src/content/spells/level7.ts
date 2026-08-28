// ============================================================================
// FILE: src/content/spells/level7.ts
// Level 7 spells not yet in index.ts
// ============================================================================
import { Spell } from '../../engine/types';

export const spellFingerOfDeath: Spell = {
  id: 'finger_of_death', name: 'Finger of Death', level: 7, school: 'Necromancy',
  castingTime: '1 action', range: '60 feet', components: ['V', 'S'],
  duration: 'Instantaneous',
  description: 'You send negative energy coursing through a creature that you can see within range, causing it searing pain. The target must make a Constitution saving throw. It takes 7d8+30 necrotic damage on a failed save, or half as much on a successful one. A humanoid killed by this spell rises at the start of your next turn as a zombie that is permanently under your command, following your verbal orders to the best of its ability.',
  upcast: null, ritual: false, concentration: false, srd: true, classes: ['sorcerer', 'warlock', 'wizard'],
};

export const spellPlaneShift: Spell = {
  id: 'plane_shift', name: 'Plane Shift', level: 7, school: 'Conjuration',
  castingTime: '1 action', range: 'Touch', components: ['V', 'S', 'M'],
  duration: 'Instantaneous',
  description: 'You and up to eight willing creatures who link hands in a circle are transported to a different plane of existence. You can specify a target destination in general terms, such as the City of Brass on the Elemental Plane of Fire or the palace of Dispater on the second level of the Nine Hells, and you appear in or near that destination. Alternatively, if you know the sigil sequence of a teleportation circle on another plane of existence, you can use that circle as your destination. As an action, you can also use this spell to banish an unwilling creature to another plane (Charisma save).',
  upcast: null, ritual: false, concentration: false, srd: true, classes: [],
};

export const spellTeleport: Spell = {
  id: 'teleport', name: 'Teleport', level: 7, school: 'Conjuration',
  castingTime: '1 action', range: '10 feet', components: ['V'],
  duration: 'Instantaneous',
  description: 'This spell instantly transports you and up to eight willing creatures of your choice that you can see within range, or a single object that you can see within range, to a destination you select. If you target an object, it must be able to fit entirely inside a 10-foot cube, and it can\'t be held or carried by an unwilling creature. The destination you choose must be known to you, and it must be on the same plane of existence as you. Your familiarity with the destination determines whether you arrive there successfully. Roll d100: for a permanent teleportation circle, you always arrive on target. For a very familiar place, roll 01-05 for off target, 06 for similar area. For seen casually, roll higher ranges for mishaps.',
  upcast: null, ritual: false, concentration: false, srd: true, classes: [],
};

export const spellForcecage: Spell = {
  id: 'forcecage', name: 'Forcecage', level: 7, school: 'Evocation',
  castingTime: '1 action', range: '100 feet', components: ['V', 'S', 'M'],
  duration: '1 hour',
  description: 'An immobile, invisible, cube-shaped prison composed of magical force springs into existence around an area you choose within range. The prison can be a cage (20-foot cube of 1/2-inch diameter bars spaced 1/2 inch apart) or a box (10-foot cube of solid walls). A creature inside the cage is trapped. Spells and other magical effects can\'t extend through the cage or be cast through it. The cage also prevents the passage of breath and small objects. The bars are immune to all damage. A creature in the cage at the end of each minute can attempt a Charisma saving throw. On a successful save, the creature magically teleports to an unoccupied space it can see outside the cage.',
  upcast: null, ritual: false, concentration: false, srd: true, classes: [],
};

export const spellDivineWord: Spell = {
  id: 'divine_word', name: 'Divine Word', level: 7, school: 'Evocation',
  castingTime: '1 bonus action', range: '30 feet', components: ['V'],
  duration: 'Instantaneous',
  description: 'You utter a divine word, imbued with the power that shaped the world at the dawn of creation. Choose any number of creatures you can see within range. Each creature that can hear you must make a Charisma saving throw. On a failed save, a creature suffers an effect based on its current hit points: 50 or fewer HP — deafened for 1 minute; 40 or fewer HP — blinded and deafened for 10 minutes; 30 or fewer HP — blinded, deafened, and stunned for 1 hour; 20 or fewer HP — killed instantly. Regardless of its current hit points, a celestial, an elemental, a fey, or a fiend that fails its save is forced back to its plane of origin (if not already there) and can\'t return for 24 hours.',
  upcast: null, ritual: false, concentration: false, srd: true, classes: [],
};

export const spellRegenerate: Spell = {
  id: 'regenerate', name: 'Regenerate', level: 7, school: 'Transmutation',
  castingTime: '1 minute', range: 'Touch', components: ['V', 'S', 'M'],
  duration: '1 hour',
  description: 'You touch a creature and stimulate its natural healing ability. The target regains 4d8+15 hit points. For the duration of the spell, the target regains 1 hit point at the start of each of its turns (10 hit points each minute). The target\'s severed body members (fingers, legs, tails, and so on), if any, are restored after 2 minutes. If you have the severed part and hold it to the stump, the spell instantaneously causes the limb to knit to the stump.',
  upcast: null, ritual: false, concentration: false, srd: true, classes: [],
};

export const spellResurrection: Spell = {
  id: 'resurrection', name: 'Resurrection', level: 7, school: 'Necromancy',
  castingTime: '1 hour', range: 'Touch', components: ['V', 'S', 'M'],
  duration: 'Instantaneous',
  description: 'You touch a dead creature that has been dead for no more than a century, that didn\'t die of old age, and that isn\'t undead. If its soul is free and willing, the target returns to life with all its hit points. This spell neutralizes any poisons and cures normal diseases afflicting the creature when it died. It doesn\'t, however, remove magical diseases, curses, and the like. The spell closes all mortal wounds and restores any missing body parts. Coming back from the dead is an ordeal. The target takes a −4 penalty to all attack rolls, saving throws, and ability checks. Every time the target finishes a long rest, the penalty is reduced by 1, until it disappears after four long rests.',
  upcast: null, ritual: false, concentration: false, srd: true, classes: [],
};

export const NEW_LEVEL7: Spell[] = [
  spellFingerOfDeath,
  spellPlaneShift,
  spellTeleport,
  spellForcecage,
  spellDivineWord,
  spellRegenerate,
  spellResurrection,
];
