// ============================================================================
// FILE: src/content/spells/level9.ts
// Level 9 spells not yet in index.ts
// ============================================================================
import { Spell } from '../../engine/types';

export const spellPowerWordKill: Spell = {
  id: 'power_word_kill', name: 'Power Word Kill', level: 9, school: 'Enchantment',
  castingTime: '1 action', range: '60 feet', components: ['V'],
  duration: 'Instantaneous',
  description: 'You utter a word of power that can compel one creature you can see within range to die instantly. If the creature you choose has 100 hit points or fewer, it dies. Otherwise, the spell has no effect.',
  upcast: null, ritual: false, concentration: false, srd: true, classes: ['bard', 'sorcerer', 'warlock', 'wizard'],
};

export const spellTimeStop: Spell = {
  id: 'time_stop', name: 'Time Stop', level: 9, school: 'Transmutation',
  castingTime: '1 action', range: 'Self', components: ['V'],
  duration: 'Instantaneous',
  description: 'You briefly stop the flow of time for everyone but yourself. No time passes for other creatures, while you take 1d4+1 turns in a row, during which you can use actions and move as normal. This effect ends if one of the actions you use during this period, or any effects that you create during this period, affects a creature other than you or an object being worn or carried by someone other than you.',
  upcast: null, ritual: false, concentration: false, srd: true, classes: ['sorcerer', 'wizard'],
};

export const spellTrueResurrection: Spell = {
  id: 'true_resurrection', name: 'True Resurrection', level: 9, school: 'Necromancy',
  castingTime: '1 hour', range: 'Touch', components: ['V', 'S', 'M'],
  duration: 'Instantaneous',
  description: 'You touch a creature that has been dead for no longer than 200 years and that died for any reason except old age. If the creature\'s soul is free and willing, the creature is restored to life with all its hit points. This spell closes all wounds, neutralizes any poison, cures all diseases, and lifts any curses affecting the creature when it died. The spell replaces damaged or missing organs and limbs. The spell can even provide a new body if the original no longer exists, in which case you must speak the creature\'s name. The creature then appears in an unoccupied space you choose within 10 feet of you.',
  upcast: null, ritual: false, concentration: false, srd: true, classes: ['cleric', 'druid'],
};

export const spellMassHeal: Spell = {
  id: 'mass_heal', name: 'Mass Heal', level: 9, school: 'Evocation',
  castingTime: '1 action', range: '60 feet', components: ['V', 'S'],
  duration: 'Instantaneous',
  description: 'A flood of healing energy flows from you into injured creatures around you. You restore up to 700 hit points, divided as you choose among any number of creatures that you can see within range. Creatures healed by this spell are also cured of all diseases and any effect making them blinded or deafened. This spell has no effect on undead or constructs.',
  upcast: null, ritual: false, concentration: false, srd: true, classes: ['cleric'],
};

export const spellForesight: Spell = {
  id: 'foresight', name: 'Foresight', level: 9, school: 'Divination',
  castingTime: '1 minute', range: 'Touch', components: ['V', 'S', 'M'],
  duration: '8 hours',
  description: 'You touch a willing creature and bestow a limited ability to see into the immediate future. For the duration, the target can\'t be surprised and has advantage on attack rolls, ability checks, and saving throws. Additionally, other creatures have disadvantage on attack rolls against the target for the duration. This spell immediately ends if you cast it again before its duration ends.',
  upcast: null, ritual: false, concentration: false, srd: true, classes: ['bard', 'druid', 'warlock', 'wizard'],
};

export const spellPrismaticWall: Spell = {
  id: 'prismatic_wall', name: 'Prismatic Wall', level: 9, school: 'Abjuration',
  castingTime: '1 action', range: '60 feet', components: ['V', 'S'],
  duration: '10 minutes',
  description: 'A shimmering, multicolored plane of light forms a vertical opaque wall up to 90 feet long, 30 feet high, and 1 inch thick, or a sphere up to 30 feet in diameter, centered on a point you choose within range. The wall remains in place for the duration. Creatures within 20 feet of the wall when it appears must succeed on a Constitution saving throw or become blinded for 1 minute. The wall consists of 7 layers of color, each with its own effects and DC to pass through.',
  upcast: null, ritual: false, concentration: false, srd: true, classes: ['wizard'],
};

export const spellShapechange: Spell = {
  id: 'shapechange', name: 'Shapechange', level: 9, school: 'Transmutation',
  castingTime: '1 action', range: 'Self', components: ['V', 'S', 'M'],
  duration: 'Concentration, up to 1 hour',
  description: 'You assume the form of a different creature for the duration. The new form can be any creature with a challenge rating equal to your level or lower. You transform into the average statistics of that creature, though you retain your alignment, personality, Intelligence, Wisdom, and Charisma scores, and your Hit Points and Hit Dice. You also retain your ability to speak, your proficiencies, and your class features (though the creature might be physically incapable of some actions). If you drop to 0 hit points, you revert to your original form and any excess damage carries over.',
  upcast: null, ritual: false, concentration: true, srd: true, classes: ['druid', 'wizard'],
};

export const NEW_LEVEL9: Spell[] = [
  spellPowerWordKill,
  spellTimeStop,
  spellTrueResurrection,
  spellMassHeal,
  spellForesight,
  spellPrismaticWall,
  spellShapechange,
];
