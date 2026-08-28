// ============================================================================
// FILE: src/content/spells/level2.ts
// Level 2 spells not yet in index.ts
// ============================================================================
import { Spell } from '../../engine/types';

export const spellScorchingRay: Spell = {
  id: 'scorching_ray', name: 'Scorching Ray', level: 2, school: 'Evocation',
  castingTime: '1 action', range: '120 feet', components: ['V', 'S'],
  duration: 'Instantaneous',
  description: 'You create three rays of fire and hurl them at targets within range. You can hurl them at one target or several. Make a ranged spell attack for each ray. On a hit, the target takes 2d6 fire damage.',
  upcast: 'When you cast this spell using a spell slot of 3rd level or higher, you create one additional ray for each slot level above 2nd.',
  ritual: false, concentration: false, srd: true, classes: ['sorcerer', 'wizard'],
};

export const spellShatter: Spell = {
  id: 'shatter', name: 'Shatter', level: 2, school: 'Evocation',
  castingTime: '1 action', range: '60 feet', components: ['V', 'S', 'M'],
  duration: 'Instantaneous',
  description: 'A sudden loud ringing noise, painfully intense, erupts from a point of your choice within range. Each creature in a 10-foot-radius sphere centered on that point must make a Constitution saving throw. A creature takes 3d8 thunder damage on a failed save, or half as much on a successful one. A creature made of inorganic material such as stone, crystal, or metal has disadvantage on this saving throw. A nonmagical object that isn\'t being worn or carried also takes the damage if it\'s in the spell\'s area.',
  upcast: 'When you cast this spell using a slot of 3rd level or higher, the damage increases by 1d8 for each slot level above 2nd.',
  ritual: false, concentration: false, srd: true, classes: ['bard', 'sorcerer', 'warlock', 'wizard'],
};

export const spellFlamingSphere: Spell = {
  id: 'flaming_sphere', name: 'Flaming Sphere', level: 2, school: 'Conjuration',
  castingTime: '1 action', range: '60 feet', components: ['V', 'S', 'M'],
  duration: 'Concentration, up to 1 minute',
  description: 'A 5-foot-diameter sphere of fire appears in an unoccupied space of your choice within range and lasts for the duration. Any creature that ends its turn within 5 feet of the sphere must make a Dexterity saving throw. The creature takes 2d6 fire damage on a failed save, or half as much on a successful one. As a bonus action, you can move the sphere up to 30 feet.',
  upcast: 'When you cast this spell using a slot of 3rd level or higher, the damage increases by 1d6 for each slot level above 2nd.',
  ritual: false, concentration: true, srd: true, classes: ['druid', 'wizard'],
};

// RENAMED per ROADMAP_1.0.md Step 1.2 — "Melf's" is Product Identity naming.
// The mechanic is core PHB; SRD 5.1 lists this as plain "Acid Arrow". The id
// is intentionally left as 'melfs_acid_arrow' in this pass to avoid breaking
// any existing references to it elsewhere (class spell lists, known-spell
// grants) — only the display name needed to change for the SRD filter to be
// meaningful. A follow-up pass can migrate the id + update references together.
export const spellMelfsAcidArrow: Spell = {
  id: 'melfs_acid_arrow', name: 'Acid Arrow', level: 2, school: 'Evocation',
  castingTime: '1 action', range: '90 feet', components: ['V', 'S', 'M'],
  duration: 'Instantaneous',
  description: 'A shimmering green arrow streaks toward a target within range and bursts in a spray of acid. Make a ranged spell attack. On a hit, the target takes 4d4 acid damage immediately and 2d4 acid damage at the end of its next turn. On a miss, the arrow splashes the target with acid for half the initial damage and no damage at the end of its next turn.',
  upcast: 'When you cast this spell using a slot of 3rd level or higher, the damage (both initial and later) increases by 1d4 for each slot level above 2nd.',
  ritual: false, concentration: false, srd: true, classes: ['wizard'],
};

export const spellMirrorImage: Spell = {
  id: 'mirror_image', name: 'Mirror Image', level: 2, school: 'Illusion',
  castingTime: '1 action', range: 'Self', components: ['V', 'S'],
  duration: '1 minute',
  description: 'Three illusory duplicates of yourself appear in your space. Until the spell ends, the duplicates move with you and mimic your actions, shifting position so it\'s impossible to track which image is real. You can use your action to dismiss the illusory duplicates. Each time a creature targets you with an attack, roll a d20 to determine whether the attack instead targets one of your duplicates. If you have three duplicates, you must roll a 6 or higher to change the attack\'s target to a duplicate. With two duplicates, you must roll an 8 or higher. With one duplicate, you must roll an 11 or higher. A duplicate\'s AC equals 10 + your Dexterity modifier. If an attack hits a duplicate, the duplicate is destroyed.',
  upcast: null, ritual: false, concentration: false, srd: true, classes: ['sorcerer', 'warlock', 'wizard'],
};

export const spellBlur: Spell = {
  id: 'blur', name: 'Blur', level: 2, school: 'Illusion',
  castingTime: '1 action', range: 'Self', components: ['V'],
  duration: 'Concentration, up to 1 minute',
  description: 'Your body becomes blurred, shifting and wavering to all who can see you. For the duration, any creature has disadvantage on attack rolls against you. An attacker is immune to this effect if it doesn\'t rely on sight, as with blindsight, or can see through illusions, as with truesight.',
  upcast: null, ritual: false, concentration: true, srd: true, classes: ['sorcerer', 'wizard'],
};

export const spellBlindnessDeafness: Spell = {
  id: 'blindness_deafness', name: 'Blindness/Deafness', level: 2, school: 'Necromancy',
  castingTime: '1 action', range: '30 feet', components: ['V'],
  duration: '1 minute',
  description: 'You can blind or deafen a foe. Choose one creature that you can see within range to make a Constitution saving throw. If it fails, the target is either blinded or deafened (your choice) for the duration. At the end of each of its turns, the target can make a Constitution saving throw. On a success, the spell ends.',
  upcast: 'When you cast this spell using a slot of 3rd level or higher, you can target one additional creature for each slot level above 2nd.',
  ritual: false, concentration: false, srd: true, classes: ['bard', 'cleric', 'sorcerer', 'wizard'],
};

export const spellPrayerOfHealing: Spell = {
  id: 'prayer_of_healing', name: 'Prayer of Healing', level: 2, school: 'Evocation',
  castingTime: '10 minutes', range: '30 feet', components: ['V'],
  duration: 'Instantaneous',
  description: 'Up to six creatures of your choice that you can see within range each regain hit points equal to 2d8 + your spellcasting ability modifier. This spell has no effect on undead or constructs.',
  upcast: 'When you cast this spell using a slot of 3rd level or higher, the healing increases by 1d8 for each slot level above 2nd.',
  ritual: false, concentration: false, srd: true, classes: ['cleric'],
};

export const spellLesserRestoration: Spell = {
  id: 'lesser_restoration', name: 'Lesser Restoration', level: 2, school: 'Abjuration',
  castingTime: '1 action', range: 'Touch', components: ['V', 'S'],
  duration: 'Instantaneous',
  description: 'You touch a creature and can end either one disease or one condition afflicting it. The condition can be blinded, deafened, paralyzed, or poisoned.',
  upcast: null, ritual: false, concentration: false, srd: true, classes: ['bard', 'cleric', 'druid', 'paladin', 'ranger'],
};

export const spellCalmEmotions: Spell = {
  id: 'calm_emotions', name: 'Calm Emotions', level: 2, school: 'Enchantment',
  castingTime: '1 action', range: '60 feet', components: ['V', 'S'],
  duration: 'Concentration, up to 1 minute',
  description: 'You attempt to suppress strong emotions in a group of people. Each humanoid in a 20-foot-radius sphere centered on a point you choose within range must make a Charisma saving throw. On a failed save, you can suppress any effect causing a target to be charmed or frightened. When this spell ends, any suppressed effect resumes. Alternatively, you can make a target indifferent about creatures of your choice that it is hostile toward. This indifference ends if the target is attacked or harmed by a spell or if it witnesses any of its friends being harmed.',
  upcast: null, ritual: false, concentration: true, srd: true, classes: ['bard', 'cleric'],
};

export const spellEnhanceAbility: Spell = {
  id: 'enhance_ability', name: 'Enhance Ability', level: 2, school: 'Transmutation',
  castingTime: '1 action', range: 'Touch', components: ['V', 'S', 'M'],
  duration: 'Concentration, up to 1 hour',
  description: 'You touch a creature and bestow upon it a magical enhancement. Choose one of the following effects: Bear\'s Endurance (advantage on Constitution checks, +2d6 temporary HP), Bull\'s Strength (advantage on Strength checks, double carry capacity), Cat\'s Grace (advantage on Dexterity checks, no falling damage ≤20 ft), Eagle\'s Splendor (advantage on Charisma checks), Fox\'s Cunning (advantage on Intelligence checks), or Owl\'s Wisdom (advantage on Wisdom checks).',
  upcast: 'When you cast this spell using a slot of 3rd level or higher, you can target one additional creature for each slot level above 2nd.',
  ritual: false, concentration: true, srd: true, classes: ['bard', 'cleric', 'druid', 'sorcerer'],
};

export const spellEnlargeReduce: Spell = {
  id: 'enlarge_reduce', name: 'Enlarge/Reduce', level: 2, school: 'Transmutation',
  castingTime: '1 action', range: '30 feet', components: ['V', 'S', 'M'],
  duration: 'Concentration, up to 1 minute',
  description: 'You cause a creature or object you can see within range to grow larger or smaller for the duration. Choose either a creature or an object that is neither worn nor carried. If the target is unwilling, it can make a Constitution saving throw. On a success, the spell has no effect. Enlarge: the target\'s size doubles in all dimensions and its weight is multiplied by eight. Weapon attacks deal an extra 1d4 damage. Reduce: the target\'s size is halved, and weapon attacks deal 1d4 less damage (min 1).',
  upcast: null, ritual: false, concentration: true, srd: true, classes: ['sorcerer', 'wizard'],
};

export const spellSpiderClimb: Spell = {
  id: 'spider_climb', name: 'Spider Climb', level: 2, school: 'Transmutation',
  castingTime: '1 action', range: 'Touch', components: ['V', 'S', 'M'],
  duration: 'Concentration, up to 1 hour',
  description: 'Until the spell ends, one willing creature you touch gains the ability to move up, down, and across vertical surfaces and upside down along ceilings, while leaving its hands free. The target also gains a climbing speed equal to its walking speed.',
  upcast: null, ritual: false, concentration: true, srd: true, classes: ['sorcerer', 'warlock', 'wizard'],
};

export const spellLevitate: Spell = {
  id: 'levitate', name: 'Levitate', level: 2, school: 'Transmutation',
  castingTime: '1 action', range: '60 feet', components: ['V', 'S', 'M'],
  duration: 'Concentration, up to 10 minutes',
  description: 'One creature or object of your choice that you can see within range rises vertically up to 20 feet and remains suspended there for the duration. The spell can levitate a target that weighs up to 500 pounds. An unwilling creature that succeeds on a Constitution saving throw is unaffected. The target can move only by pushing or pulling against a fixed object or surface within reach, allowing it to move as if climbing.',
  upcast: null, ritual: false, concentration: true, srd: true, classes: ['sorcerer', 'wizard'],
};

export const spellDarkness: Spell = {
  id: 'darkness', name: 'Darkness', level: 2, school: 'Evocation',
  castingTime: '1 action', range: '60 feet', components: ['V', 'M'],
  duration: 'Concentration, up to 10 minutes',
  description: 'Magical darkness spreads from a point you choose within range to fill a 15-foot-radius sphere for the duration. The darkness spreads around corners. A creature with darkvision can\'t see through this magical darkness, and nonmagical light can\'t illuminate it. If the point you choose is on an object you are holding or one that isn\'t being worn or carried, the darkness emanates from the object and moves with it. Completely covering the source of the darkness with an opaque object blocks the darkness.',
  upcast: null, ritual: false, concentration: true, srd: true, classes: ['sorcerer', 'warlock', 'wizard'],
};

export const spellSilence: Spell = {
  id: 'silence', name: 'Silence', level: 2, school: 'Illusion',
  castingTime: '1 action', range: '120 feet', components: ['V', 'S'],
  duration: 'Concentration, up to 10 minutes',
  description: 'For the duration, no sound can be created within or pass through a 20-foot-radius sphere centered on a point you choose within range. Any creature or object entirely inside the sphere is immune to thunder damage, and creatures are deafened while entirely inside it. Casting a spell that includes a verbal component is impossible there.',
  upcast: null, ritual: true, concentration: true, srd: true, classes: ['bard', 'cleric'],
};

export const spellPassWithoutTrace: Spell = {
  id: 'pass_without_trace', name: 'Pass Without Trace', level: 2, school: 'Abjuration',
  castingTime: '1 action', range: 'Self', components: ['V', 'S', 'M'],
  duration: 'Concentration, up to 1 hour',
  description: 'A veil of shadows and silence radiates from you, masking you and your companions from detection. For the duration, each creature you choose within 30 feet of you (including you) has a +10 bonus to Dexterity (Stealth) checks and can\'t be tracked except by magical means. A creature that receives this bonus leaves behind no tracks or other traces of its passage.',
  upcast: null, ritual: false, concentration: true, srd: true, classes: ['druid', 'ranger'],
};

export const spellSpikeGrowth: Spell = {
  id: 'spike_growth', name: 'Spike Growth', level: 2, school: 'Transmutation',
  castingTime: '1 action', range: '150 feet', components: ['V', 'S', 'M'],
  duration: 'Concentration, up to 10 minutes',
  description: 'The ground in a 20-foot radius centered on a point within range twists and sprouts hard spikes and thorns. The area becomes difficult terrain for the duration. When a creature moves into or within the area, it takes 2d4 piercing damage for every 5 feet it travels. The transformation of the ground is camouflaged to look natural. Any creature that can\'t see the area at the time the spell is cast must make a Wisdom (Perception) check against your spell save DC to recognize the terrain as hazardous.',
  upcast: null, ritual: false, concentration: true, srd: true, classes: ['druid', 'ranger'],
};

export const spellMoonbeam: Spell = {
  id: 'moonbeam', name: 'Moonbeam', level: 2, school: 'Evocation',
  castingTime: '1 action', range: '120 feet', components: ['V', 'S', 'M'],
  duration: 'Concentration, up to 1 minute',
  description: 'A silvery beam of pale light shines down in a 5-foot-radius, 40-foot-high cylinder centered on a point within range. Until the spell ends, dim light fills the cylinder. When a creature enters the spell\'s area for the first time on a turn or starts its turn there, it is engulfed in ghostly flames that cause searing pain, and it must make a Constitution saving throw. It takes 2d10 radiant damage on a failed save, or half as much on a successful one. A shapechanger makes its saving throw with disadvantage.',
  upcast: 'When you cast this spell using a slot of 3rd level or higher, the damage increases by 1d10 for each slot level above 2nd.',
  ritual: false, concentration: true, srd: true, classes: ['druid'],
};

export const spellHeatMetal: Spell = {
  id: 'heat_metal', name: 'Heat Metal', level: 2, school: 'Transmutation',
  castingTime: '1 action', range: '60 feet', components: ['V', 'S', 'M'],
  duration: 'Concentration, up to 1 minute',
  description: 'Choose a manufactured metal object, such as a metal weapon or a suit of heavy or medium metal armor, that you can see within range. You cause the object to glow red-hot. Any creature in physical contact with the object takes 2d8 fire damage when you cast the spell. Until the spell ends, you can use a bonus action on each of your subsequent turns to deal this damage again. If a creature is holding or wearing the object and takes the damage from it, the creature must succeed on a Constitution saving throw or drop the object if it can. If it doesn\'t drop the object, it has disadvantage on attack rolls and ability checks until the start of your next turn.',
  upcast: 'When you cast this spell using a slot of 3rd level or higher, the damage increases by 1d8 for each slot level above 2nd.',
  ritual: false, concentration: true, srd: true, classes: ['bard', 'druid'],
};

export const spellAid: Spell = {
  id: 'aid', name: 'Aid', level: 2, school: 'Abjuration',
  castingTime: '1 action', range: '30 feet', components: ['V', 'S', 'M'],
  duration: '8 hours',
  description: 'Your spell bolsters your allies with toughness and resolve. Choose up to three creatures within range. Each target\'s hit point maximum and current hit points increase by 5 for the duration.',
  upcast: 'When you cast this spell using a slot of 3rd level or higher, a target\'s hit points increase by an additional 5 for each slot level above 2nd.',
  ritual: false, concentration: false, srd: true, classes: ['cleric', 'paladin'],
};

export const spellProtectionFromPoison: Spell = {
  id: 'protection_from_poison', name: 'Protection from Poison', level: 2, school: 'Abjuration',
  castingTime: '1 action', range: 'Touch', components: ['V', 'S'],
  duration: '1 hour',
  description: 'You touch a creature. If it is poisoned, you neutralize the poison. If more than one poison afflicts the target, you neutralize one poison that you know is present, or you neutralize one at random. For the duration, the target has advantage on saving throws against being poisoned, and it has resistance to poison damage.',
  upcast: null, ritual: false, concentration: false, srd: true, classes: ['cleric', 'druid', 'paladin', 'ranger'],
};

// SRD confirmed — unlike the level-1 "smite" family (Wrathful/Thunderous, both
// XGE), Branding Smite is a core 2014 PHB Paladin spell.
export const spellBrandingSmite: Spell = {
  id: 'branding_smite', name: 'Branding Smite', level: 2, school: 'Evocation',
  castingTime: '1 bonus action', range: 'Self', components: ['V'],
  duration: 'Concentration, up to 1 minute',
  description: 'The next time you hit a creature with a weapon attack before this spell ends, the weapon gleams with astral radiance as you strike. The attack deals an extra 2d6 radiant damage to the target, which becomes visible if it\'s invisible, and the target sheds dim light in a 5-foot radius and can\'t become invisible until the spell ends.',
  upcast: 'When you cast this spell using a slot of 3rd level or higher, the extra damage increases by 1d6 for each slot level above 2nd.',
  ritual: false, concentration: true, srd: true, classes: ['paladin'],
};

export const spellMagicWeapon: Spell = {
  id: 'magic_weapon', name: 'Magic Weapon', level: 2, school: 'Transmutation',
  castingTime: '1 bonus action', range: 'Touch', components: ['V', 'S'],
  duration: 'Concentration, up to 1 hour',
  description: 'You touch a nonmagical weapon. Until the spell ends, that weapon becomes a magic weapon with a +1 bonus to attack rolls and damage rolls.',
  upcast: 'When you cast this spell using a slot of 4th level or higher, the bonus increases to +2. When you use a slot of 6th level or higher, the bonus increases to +3.',
  ritual: false, concentration: true, srd: true, classes: ['paladin', 'wizard'],
};

export const spellSeeInvisibility: Spell = {
  id: 'see_invisibility', name: 'See Invisibility', level: 2, school: 'Divination',
  castingTime: '1 action', range: 'Self', components: ['V', 'S', 'M'],
  duration: '1 hour',
  description: 'For the duration, you see invisible creatures and objects as if they were visible, and you can see into the Ethereal Plane. Ethereal creatures and objects appear ghostly and translucent.',
  upcast: null, ritual: false, concentration: false, srd: true, classes: ['bard', 'sorcerer', 'wizard'],
};

export const spellPhantasmalForce: Spell = {
  id: 'phantasmal_force', name: 'Phantasmal Force', level: 2, school: 'Illusion',
  castingTime: '1 action', range: '60 feet', components: ['V', 'S', 'M'],
  duration: 'Concentration, up to 1 minute',
  description: 'You craft an illusion that takes root in the mind of a creature you can see within range. The target must make an Intelligence saving throw. On a failed save, you create a phantasmal object, creature, or phenomenon of your choice that is no larger than a 10-foot cube and that is perceivable only to the target. The target takes 1d6 psychic damage at the start of each of your turns.',
  upcast: null, ritual: false, concentration: true, srd: true, classes: ['bard', 'sorcerer', 'wizard'],
};

export const NEW_LEVEL2: Spell[] = [
  spellScorchingRay,
  spellShatter,
  spellFlamingSphere,
  spellMelfsAcidArrow,
  spellMirrorImage,
  spellBlur,
  spellBlindnessDeafness,
  spellPrayerOfHealing,
  spellLesserRestoration,
  spellCalmEmotions,
  spellEnhanceAbility,
  spellEnlargeReduce,
  spellSpiderClimb,
  spellLevitate,
  spellDarkness,
  spellSilence,
  spellPassWithoutTrace,
  spellSpikeGrowth,
  spellMoonbeam,
  spellHeatMetal,
  spellAid,
  spellProtectionFromPoison,
  spellBrandingSmite,
  spellMagicWeapon,
  spellSeeInvisibility,
  spellPhantasmalForce,
];
