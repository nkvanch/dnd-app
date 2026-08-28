// ============================================================================
// FILE: src/content/spells/level8.ts
// Level 8 spells not yet in index.ts
// ============================================================================
import { Spell } from '../../engine/types';

export const spellDominateMonster: Spell = {
  id: 'dominate_monster', name: 'Dominate Monster', level: 8, school: 'Enchantment',
  castingTime: '1 action', range: '60 feet', components: ['V', 'S'],
  duration: 'Concentration, up to 1 hour',
  description: 'You attempt to beguile a creature that you can see within range. It must succeed on a Wisdom saving throw or be charmed by you for the duration. While the creature is charmed, you have a telepathic link with it as long as the two of you are on the same plane of existence. You can use this telepathic link to issue commands to the creature while you are conscious (no action required), which it does its best to obey. You can specify a simple and general course of action. Each time the target takes damage, it makes a new Wisdom saving throw against the spell. On a success, the spell ends.',
  upcast: null, ritual: false, concentration: true, srd: true, classes: ['bard', 'sorcerer', 'warlock', 'wizard'],
};

export const spellPowerWordStun: Spell = {
  id: 'power_word_stun', name: 'Power Word Stun', level: 8, school: 'Enchantment',
  castingTime: '1 action', range: '60 feet', components: ['V'],
  duration: 'Instantaneous',
  description: 'You overwhelm the mind of a creature you can see within range, leaving it dumbfounded. If the target has 150 hit points or fewer, it is stunned. Otherwise, the spell has no effect. The stunned target must make a Constitution saving throw at the end of each of its turns. On a successful save, the stunning effect ends.',
  upcast: null, ritual: false, concentration: false, srd: true, classes: ['bard', 'sorcerer', 'warlock', 'wizard'],
};

export const spellEarthquake: Spell = {
  id: 'earthquake', name: 'Earthquake', level: 8, school: 'Evocation',
  castingTime: '1 action', range: '500 feet', components: ['V', 'S', 'M'],
  duration: 'Concentration, up to 1 minute',
  description: 'You create a seismic disturbance at a point on the ground you can see within range. For the duration, an intense tremor rips through the ground in a 100-foot-radius circle centered on that point. Each creature on the ground in that area must make a Dexterity saving throw. On a failed save, the creature is knocked prone. The spell also creates fissures, collapses structures, and concentrates creatures. Spellcasting in the area requires a successful Constitution saving throw (DC 15) to maintain concentration.',
  upcast: null, ritual: false, concentration: true, srd: true, classes: ['cleric', 'druid', 'sorcerer'],
};

export const spellHolyAura: Spell = {
  id: 'holy_aura', name: 'Holy Aura', level: 8, school: 'Abjuration',
  castingTime: '1 action', range: 'Self', components: ['V', 'S', 'M'],
  duration: 'Concentration, up to 1 minute',
  description: 'Divine light washes out from you and coalesces in a soft radiance in a 30-foot radius around you. Creatures of your choice in that radius when you cast this spell and those that enter it thereafter have advantage on all saving throws, and other creatures have disadvantage on attack rolls against them until the spell ends. In addition, when a fiend or an undead hits an affected creature with a melee attack, the aura flashes with brilliant light. The attacker must succeed on a Constitution saving throw or be blinded until the spell ends.',
  upcast: null, ritual: false, concentration: true, srd: true, classes: ['cleric'],
};

export const spellAntimagicField: Spell = {
  id: 'antimagic_field', name: 'Antimagic Field', level: 8, school: 'Abjuration',
  castingTime: '1 action', range: 'Self (10-foot-radius sphere)', components: ['V', 'S', 'M'],
  duration: 'Concentration, up to 1 hour',
  description: 'A 10-foot-radius invisible sphere of antimagic surrounds you. This area is divorced from the magical energy that suffuses the multiverse. Within the sphere, spells can\'t be cast, summoned creatures disappear, and even magic items become mundane. Spells and other magical effects (except those created by an artifact or a deity) are suppressed in the sphere and can\'t protrude into it.',
  upcast: null, ritual: false, concentration: true, srd: true, classes: ['cleric', 'druid', 'wizard'],
};

export const spellFeeblemind: Spell = {
  id: 'feeblemind', name: 'Feeblemind', level: 8, school: 'Enchantment',
  castingTime: '1 action', range: '150 feet', components: ['V', 'S', 'M'],
  duration: 'Instantaneous',
  description: 'You blast the mind of a creature you can see within range, attempting to shatter its intellect and personality. The target takes 4d6 psychic damage and must make an Intelligence saving throw. On a failed save, the creature\'s Intelligence and Charisma scores become 1. The creature can\'t cast spells, activate magic items, understand language, or communicate in any intelligible way. The creature can, however, identify its friends, follow them, and even protect them. At the end of every 30 days, the creature can repeat its saving throw. On a success, the spell ends.',
  upcast: null, ritual: false, concentration: false, srd: true, classes: ['bard', 'druid', 'warlock', 'wizard'],
};

export const spellMindBlank: Spell = {
  id: 'mind_blank', name: 'Mind Blank', level: 8, school: 'Abjuration',
  castingTime: '1 action', range: 'Touch', components: ['V', 'S'],
  duration: '24 hours',
  description: 'Until the spell ends, one willing creature you touch is immune to psychic damage, any effect that would sense its emotions or read its thoughts, divination spells, and the charmed condition. The spell even foils Wish spells and spells or effects of similar power used to affect the target\'s mind or to gain information about the target.',
  upcast: null, ritual: false, concentration: false, srd: true, classes: ['bard', 'wizard'],
};

export const NEW_LEVEL8: Spell[] = [
  spellDominateMonster,
  spellPowerWordStun,
  spellEarthquake,
  spellHolyAura,
  spellAntimagicField,
  spellFeeblemind,
  spellMindBlank,
];
