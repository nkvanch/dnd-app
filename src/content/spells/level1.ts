// ============================================================================
// FILE: src/content/spells/level1.ts
// Level 1 spells not yet in index.ts
// ============================================================================
import { Spell } from '../../engine/types';

export const spellChromaticOrb: Spell = {
  id: 'chromatic_orb', name: 'Chromatic Orb', level: 1, school: 'Evocation',
  castingTime: '1 action', range: '90 feet', components: ['V', 'S', 'M'],
  duration: 'Instantaneous',
  description: 'You hurl a 4-inch-diameter sphere of energy at a creature you can see within range. You choose acid, cold, fire, lightning, poison, or thunder for the type of orb you create, and then make a ranged spell attack. On a hit, the creature takes 3d8 damage of the type you chose.',
  upcast: 'When you cast this spell using a slot of 2nd level or higher, the damage increases by 1d8 for each slot level above 1st.',
  ritual: false, concentration: false,
};

export const spellWitchBolt: Spell = {
  id: 'witch_bolt', name: 'Witch Bolt', level: 1, school: 'Evocation',
  castingTime: '1 action', range: '30 feet', components: ['V', 'S', 'M'],
  duration: 'Concentration, up to 1 minute',
  description: 'A beam of crackling blue energy lances out toward a creature within range, forming a sustained arc of lightning between you and the target. Make a ranged spell attack. On a hit, the target takes 1d12 lightning damage. On each of your turns for the duration, you can use your action to deal 1d12 lightning damage to the target automatically. The spell ends if you use your action to do anything else, if the target is ever outside the spell\'s range, or if the target has total cover from you.',
  upcast: 'When you cast this spell using a slot of 2nd level or higher, the initial damage increases by 1d12 for each slot level above 1st.',
  ritual: false, concentration: true,
};

export const spellIceKnife: Spell = {
  id: 'ice_knife', name: 'Ice Knife', level: 1, school: 'Conjuration',
  castingTime: '1 action', range: '60 feet', components: ['S', 'M'],
  duration: 'Instantaneous',
  description: 'You create a shard of ice and fling it at one creature within range. Make a ranged spell attack. On a hit, the target takes 1d10 piercing damage. Hit or miss, the shard then explodes. The target and each creature within 5 feet of the point where the ice exploded must succeed on a Dexterity saving throw or take 2d6 cold damage.',
  upcast: 'When you cast this spell using a slot of 2nd level or higher, the cold damage increases by 1d6 for each slot level above 1st.',
  ritual: false, concentration: false,
};

export const spellCauseFear: Spell = {
  id: 'cause_fear', name: 'Cause Fear', level: 1, school: 'Necromancy',
  castingTime: '1 action', range: '60 feet', components: ['V'],
  duration: 'Concentration, up to 1 minute',
  description: 'You awaken the sense of mortality in one creature you can see within range. A construct or undead is immune to this effect. The target must succeed on a Wisdom saving throw or become frightened of you until the spell ends. The frightened target can repeat its saving throw at the end of each of its turns, ending the effect on itself on a success.',
  upcast: 'When you cast this spell using a slot of 2nd level or higher, you can target one additional creature for each slot level above 1st. The creatures must be within 30 feet of each other when you target them.',
  ritual: false, concentration: true,
};

export const spellInflictWounds: Spell = {
  id: 'inflict_wounds', name: 'Inflict Wounds', level: 1, school: 'Necromancy',
  castingTime: '1 action', range: 'Touch', components: ['V', 'S'],
  duration: 'Instantaneous',
  description: 'Make a melee spell attack against a creature you can reach. On a hit, the target takes 3d10 necrotic damage.',
  upcast: 'When you cast this spell using a slot of 2nd level or higher, the damage increases by 1d10 for each slot level above 1st.',
  ritual: false, concentration: false,
};

export const spellBane: Spell = {
  id: 'bane', name: 'Bane', level: 1, school: 'Enchantment',
  castingTime: '1 action', range: '30 feet', components: ['V', 'S', 'M'],
  duration: 'Concentration, up to 1 minute',
  description: 'Up to three creatures of your choice that you can see within range must make Charisma saving throws. Whenever a target that fails this saving throw makes an attack roll or a saving throw before the spell ends, the target must roll a d4 and subtract the number rolled from the attack roll or saving throw.',
  upcast: 'When you cast this spell using a slot of 2nd level or higher, you can target one additional creature for each slot level above 1st.',
  ritual: false, concentration: true,
};

export const spellShieldOfFaith: Spell = {
  id: 'shield_of_faith', name: 'Shield of Faith', level: 1, school: 'Abjuration',
  castingTime: '1 bonus action', range: '60 feet', components: ['V', 'S', 'M'],
  duration: 'Concentration, up to 10 minutes',
  description: 'A shimmering field appears and surrounds a creature of your choice within range, granting it a +2 bonus to AC for the duration.',
  upcast: null, ritual: false, concentration: true,
};

export const spellIdentify: Spell = {
  id: 'identify', name: 'Identify', level: 1, school: 'Divination',
  castingTime: '1 minute', range: 'Touch', components: ['V', 'S', 'M'],
  duration: 'Instantaneous',
  description: 'You choose one object that you must touch throughout the casting of the spell. If it is a magic item or some other magic-imbued object, you learn its properties and how to use them, whether it requires attunement, and how many charges it has, if any. You learn whether any spells are affecting the item and what they are. If the item was created by a spell, you learn which spell created it. If you instead touch a creature throughout the casting, you learn what spells, if any, are currently affecting it.',
  upcast: null, ritual: true, concentration: false,
};

export const spellComprehendLanguages: Spell = {
  id: 'comprehend_languages', name: 'Comprehend Languages', level: 1, school: 'Divination',
  castingTime: '1 action', range: 'Self', components: ['V', 'S', 'M'],
  duration: '1 hour',
  description: 'For the duration, you understand the literal meaning of any spoken language that you hear. You also understand any written language that you see, but you must be touching the surface on which the words are written. It takes about 1 minute to read one page of text. This spell doesn\'t decode secret messages in a text or glyph that isn\'t part of a written language.',
  upcast: null, ritual: true, concentration: false,
};

export const spellFeatherFall: Spell = {
  id: 'feather_fall', name: 'Feather Fall', level: 1, school: 'Transmutation',
  castingTime: '1 reaction', range: '60 feet', components: ['V', 'M'],
  duration: '1 minute',
  description: 'Choose up to five falling creatures within range. A falling creature\'s rate of descent slows to 60 feet per round until the spell ends. If the creature lands before the spell ends, it takes no falling damage and can land on its feet, and the spell ends for that creature.',
  upcast: null, ritual: false, concentration: false,
};

export const spellJump: Spell = {
  id: 'jump', name: 'Jump', level: 1, school: 'Transmutation',
  castingTime: '1 action', range: 'Touch', components: ['V', 'S', 'M'],
  duration: '1 minute',
  description: 'You touch a creature. The creature\'s jump distance is tripled until the spell ends.',
  upcast: null, ritual: false, concentration: false,
};

export const spellLongstrider: Spell = {
  id: 'longstrider', name: 'Longstrider', level: 1, school: 'Transmutation',
  castingTime: '1 action', range: 'Touch', components: ['V', 'S', 'M'],
  duration: '1 hour',
  description: 'You touch a creature. The target\'s speed increases by 10 feet until the spell ends.',
  upcast: 'When you cast this spell using a spell slot of 2nd level or higher, you can target one additional creature for each slot level above 1st.',
  ritual: false, concentration: false,
};

export const spellExpeditiousRetreat: Spell = {
  id: 'expeditious_retreat', name: 'Expeditious Retreat', level: 1, school: 'Transmutation',
  castingTime: '1 bonus action', range: 'Self', components: ['V', 'S'],
  duration: 'Concentration, up to 10 minutes',
  description: 'This spell allows you to move at an incredible pace. When you cast this spell, and then as a bonus action on each of your turns until the spell ends, you can take the Dash action.',
  upcast: null, ritual: false, concentration: true,
};

export const spellFogCloud: Spell = {
  id: 'fog_cloud', name: 'Fog Cloud', level: 1, school: 'Conjuration',
  castingTime: '1 action', range: '120 feet', components: ['V', 'S'],
  duration: 'Concentration, up to 1 hour',
  description: 'You create a 20-foot-radius sphere of fog centered on a point within range. The sphere spreads around corners and its area is heavily obscured. It lasts for the duration or until a wind of moderate or greater speed (at least 10 miles per hour) disperses it.',
  upcast: 'When you cast this spell using a slot of 2nd level or higher, the radius of the fog increases by 20 feet for each slot level above 1st.',
  ritual: false, concentration: true,
};

export const spellCharmPerson: Spell = {
  id: 'charm_person', name: 'Charm Person', level: 1, school: 'Enchantment',
  castingTime: '1 action', range: '30 feet', components: ['V', 'S'],
  duration: '1 hour',
  description: 'You attempt to charm a humanoid you can see within range. It must make a Wisdom saving throw, and does so with advantage if you or your companions are fighting it. If it fails, it is charmed by you until the spell ends or until you or your companions do anything harmful to it. The charmed creature regards you as a friendly acquaintance. When the spell ends, the creature knows it was charmed by you.',
  upcast: 'When you cast this spell using a slot of 2nd level or higher, you can target one additional creature for each slot level above 1st. The creatures must be within 30 feet of each other.',
  ritual: false, concentration: false,
};

export const spellHideousLaughter: Spell = {
  id: 'hideous_laughter', name: "Tasha's Hideous Laughter", level: 1, school: 'Enchantment',
  castingTime: '1 action', range: '30 feet', components: ['V', 'S', 'M'],
  duration: 'Concentration, up to 1 minute',
  description: 'A creature of your choice that you can see within range perceives everything as hilariously funny and falls into fits of laughter if this spell affects it. The target must succeed on a Wisdom saving throw or fall prone, becoming incapacitated and unable to stand up for the duration. A creature with an Intelligence score of 4 or less isn\'t affected. At the end of each of its turns, and each time it takes damage, the target can make another Wisdom saving throw. On a success, the spell ends.',
  upcast: null, ritual: false, concentration: true,
};

export const spellSilentImage: Spell = {
  id: 'silent_image', name: 'Silent Image', level: 1, school: 'Illusion',
  castingTime: '1 action', range: '60 feet', components: ['V', 'S', 'M'],
  duration: 'Concentration, up to 10 minutes',
  description: 'You create the image of an object, a creature, or some other visible phenomenon that is no larger than a 15-foot cube. The image appears at a spot within range and lasts for the duration. The image is purely visual; it isn\'t accompanied by sound, smell, or other sensory effects. You can use your action to cause the image to move to any spot within range. As the image changes location, you can alter its appearance so that its movements appear natural for the image. Physical interaction with the image reveals it to be an illusion.',
  upcast: null, ritual: false, concentration: true,
};

export const spellColorSpray: Spell = {
  id: 'color_spray', name: 'Color Spray', level: 1, school: 'Illusion',
  castingTime: '1 action', range: 'Self (15-foot cone)', components: ['V', 'S', 'M'],
  duration: '1 round',
  description: 'A dazzling array of flashing, colored light springs from your hand. Roll 6d10; the total is how many hit points of creatures this spell can affect, proceeding in ascending order of their current hit points (ignoring unconscious creatures and creatures that can\'t be blinded). Starting with the creature that has the lowest current hit points, each creature affected by this spell is blinded until the end of your next turn. Subtract each creature\'s hit points from the total before moving on to the creature with the next lowest hit points.',
  upcast: 'When you cast this spell using a slot of 2nd level or higher, roll an additional 2d10 for each slot level above 1st.',
  ritual: false, concentration: false,
};

export const spellGrease: Spell = {
  id: 'grease', name: 'Grease', level: 1, school: 'Conjuration',
  castingTime: '1 action', range: '60 feet', components: ['V', 'S', 'M'],
  duration: '1 minute',
  description: 'Slick grease covers the ground in a 10-foot square centered on a point within range and turns it into difficult terrain for the duration. When the grease appears, each creature standing in its area must succeed on a Dexterity saving throw or fall prone. A creature that enters the area or ends its turn there must also succeed on a Dexterity saving throw or fall prone.',
  upcast: null, ritual: false, concentration: false,
};

export const spellEntangle: Spell = {
  id: 'entangle', name: 'Entangle', level: 1, school: 'Conjuration',
  castingTime: '1 action', range: '90 feet', components: ['V', 'S'],
  duration: 'Concentration, up to 1 minute',
  description: 'Grasping weeds and vines sprout from the ground in a 20-foot square starting from a point within range. For the duration, these plants turn the ground in the area into difficult terrain. A creature in the area when you cast the spell must succeed on a Strength saving throw or be restrained by the entangling plants until the spell ends. A creature restrained by the plants can use its action to make a Strength check against your spell save DC. On a success, it frees itself.',
  upcast: null, ritual: false, concentration: true,
};

export const spellFaerieFire: Spell = {
  id: 'faerie_fire', name: 'Faerie Fire', level: 1, school: 'Evocation',
  castingTime: '1 action', range: '60 feet', components: ['V'],
  duration: 'Concentration, up to 1 minute',
  description: 'Each object in a 20-foot cube within range is outlined in blue, green, or violet light (your choice). Any creature in the area when the spell is cast is also outlined in light if it fails a Dexterity saving throw. For the duration, objects and affected creatures shed dim light in a 10-foot radius. Any attack roll against an affected creature or object has advantage if the attacker can see it, and the affected creature or object can\'t benefit from being invisible.',
  upcast: null, ritual: false, concentration: true,
};

export const spellSpeakWithAnimals: Spell = {
  id: 'speak_with_animals', name: 'Speak with Animals', level: 1, school: 'Divination',
  castingTime: '1 action', range: 'Self', components: ['V', 'S'],
  duration: '10 minutes',
  description: 'You gain the ability to comprehend and verbally communicate with beasts for the duration. The knowledge and awareness of many beasts is limited by their intelligence, but at minimum, a beast can give you information about nearby locations and monsters, including whatever it can perceive or has perceived within the past day. You might be able to persuade a beast to perform a small favor for you, at the DM\'s discretion.',
  upcast: null, ritual: true, concentration: false,
};

export const spellWrathfulSmite: Spell = {
  id: 'wrathful_smite', name: 'Wrathful Smite', level: 1, school: 'Evocation',
  castingTime: '1 bonus action', range: 'Self', components: ['V'],
  duration: 'Concentration, up to 1 minute',
  description: 'The next time you hit with a melee weapon attack during this spell\'s duration, your attack deals an extra 1d6 psychic damage. Additionally, if the target is a creature, it must make a Wisdom saving throw or be frightened of you until the spell ends. As an action, the creature can make a Wisdom check against your spell save DC to steel its resolve and end this spell.',
  upcast: null, ritual: false, concentration: true,
};

export const spellThunderousSmite: Spell = {
  id: 'thunderous_smite', name: 'Thunderous Smite', level: 1, school: 'Evocation',
  castingTime: '1 bonus action', range: 'Self', components: ['V'],
  duration: 'Concentration, up to 1 minute',
  description: 'The first time you hit with a melee weapon attack during this spell\'s duration, your weapon rings with thunder that is audible within 300 feet of you, and the attack deals an extra 2d6 thunder damage to the target. Additionally, if the target is a creature, it must succeed on a Strength saving throw or be pushed 10 feet away from you and knocked prone.',
  upcast: null, ritual: false, concentration: true,
};

export const spellDivineFavor: Spell = {
  id: 'divine_favor', name: 'Divine Favor', level: 1, school: 'Evocation',
  castingTime: '1 bonus action', range: 'Self', components: ['V', 'S'],
  duration: 'Concentration, up to 1 minute',
  description: 'Your prayer empowers you with divine radiance. Until the spell ends, your weapon attacks deal an extra 1d4 radiant damage on a hit.',
  upcast: null, ritual: false, concentration: true,
};

export const spellMageArmor: Spell = {
  id: 'mage_armor', name: 'Mage Armor', level: 1, school: 'Abjuration',
  castingTime: '1 action', range: 'Touch', components: ['V', 'S', 'M'],
  duration: '8 hours',
  description: 'You touch a willing creature who isn\'t wearing armor, and a protective magical force surrounds it until the spell ends. The target\'s base AC becomes 13 + its Dexterity modifier. The spell ends if the target dons armor or if you dismiss the spell as an action.',
  upcast: null, ritual: false, concentration: false,
};

export const NEW_LEVEL1: Spell[] = [
  spellChromaticOrb,
  spellWitchBolt,
  spellIceKnife,
  spellCauseFear,
  spellInflictWounds,
  spellBane,
  spellShieldOfFaith,
  spellIdentify,
  spellComprehendLanguages,
  spellFeatherFall,
  spellJump,
  spellLongstrider,
  spellExpeditiousRetreat,
  spellFogCloud,
  spellCharmPerson,
  spellHideousLaughter,
  spellSilentImage,
  spellColorSpray,
  spellGrease,
  spellEntangle,
  spellFaerieFire,
  spellSpeakWithAnimals,
  spellWrathfulSmite,
  spellThunderousSmite,
  spellDivineFavor,
  spellMageArmor,
];
