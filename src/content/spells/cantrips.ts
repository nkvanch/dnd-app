// ============================================================================
// FILE: src/content/spells/cantrips.ts
// New cantrips not yet in index.ts
// ============================================================================
import { Spell } from '../../engine/types';

export const spellRayOfFrost: Spell = {
  id: 'ray_of_frost', name: 'Ray of Frost', level: 0, school: 'Evocation',
  castingTime: '1 action', range: '60 feet', components: ['V', 'S'],
  duration: 'Instantaneous',
  description: 'A frigid beam of blue-white light streaks toward a creature within range. Make a ranged spell attack. On a hit, the target takes 1d8 cold damage and its speed is reduced by 10 feet until the start of your next turn. The spell\'s damage increases by 1d8 when you reach 5th level (2d8), 11th level (3d8), and 17th level (4d8).',
  upcast: null, ritual: false, concentration: false,
};

export const spellShockingGrasp: Spell = {
  id: 'shocking_grasp', name: 'Shocking Grasp', level: 0, school: 'Evocation',
  castingTime: '1 action', range: 'Touch', components: ['V', 'S'],
  duration: 'Instantaneous',
  description: 'Lightning springs from your hand to deliver a shock to a creature you try to touch. Make a melee spell attack. You have advantage on the attack roll if the target is wearing armor made of metal. On a hit, the target takes 1d8 lightning damage and can\'t take reactions until the start of its next turn. The damage increases by 1d8 at 5th level (2d8), 11th level (3d8), and 17th level (4d8).',
  upcast: null, ritual: false, concentration: false,
};

export const spellPoisonSpray: Spell = {
  id: 'poison_spray', name: 'Poison Spray', level: 0, school: 'Conjuration',
  castingTime: '1 action', range: '10 feet', components: ['V', 'S'],
  duration: 'Instantaneous',
  description: 'You extend your hand toward a creature you can see within range and project a puff of noxious gas. The creature must succeed on a Constitution saving throw or take 1d12 poison damage. The damage increases by 1d12 at 5th level (2d12), 11th level (3d12), and 17th level (4d12).',
  upcast: null, ritual: false, concentration: false,
};

export const spellAcidSplash: Spell = {
  id: 'acid_splash', name: 'Acid Splash', level: 0, school: 'Conjuration',
  castingTime: '1 action', range: '60 feet', components: ['V', 'S'],
  duration: 'Instantaneous',
  description: 'You hurl a bubble of acid. Choose one or two creatures you can see within range. If you choose two, they must be within 5 feet of each other. A target must succeed on a Dexterity saving throw or take 1d6 acid damage. The damage increases by 1d6 at 5th level (2d6), 11th level (3d6), and 17th level (4d6).',
  upcast: null, ritual: false, concentration: false,
};

export const spellChillTouch: Spell = {
  id: 'chill_touch', name: 'Chill Touch', level: 0, school: 'Necromancy',
  castingTime: '1 action', range: '120 feet', components: ['V', 'S'],
  duration: '1 round',
  description: 'You create a ghostly, skeletal hand in the space of a creature within range. Make a ranged spell attack. On a hit, the target takes 1d8 necrotic damage and can\'t regain hit points until the start of your next turn. If you hit an undead target, it also has disadvantage on attack rolls against you until the end of your next turn. The damage increases by 1d8 at 5th level (2d8), 11th level (3d8), and 17th level (4d8).',
  upcast: null, ritual: false, concentration: false,
};

export const spellTollTheDead: Spell = {
  id: 'toll_the_dead', name: 'Toll the Dead', level: 0, school: 'Necromancy',
  castingTime: '1 action', range: '60 feet', components: ['V', 'S'],
  duration: 'Instantaneous',
  description: 'You point at one creature you can see within range and the sound of a dolorous bell fills the air around it for a moment. The target must succeed on a Wisdom saving throw or take 1d8 necrotic damage. If the target is missing any of its hit points, it instead takes 1d12 necrotic damage. The damage increases by one die at 5th level, 11th level, and 17th level.',
  upcast: null, ritual: false, concentration: false,
};

export const spellSpareTheDying: Spell = {
  id: 'spare_the_dying', name: 'Spare the Dying', level: 0, school: 'Necromancy',
  castingTime: '1 action', range: 'Touch', components: ['V', 'S'],
  duration: 'Instantaneous',
  description: 'You touch a living creature that has 0 hit points. The creature becomes stable. This spell has no effect on undead or constructs.',
  upcast: null, ritual: false, concentration: false,
};

export const spellTrueStrike: Spell = {
  id: 'true_strike', name: 'True Strike', level: 0, school: 'Divination',
  castingTime: '1 action', range: '30 feet', components: ['S'],
  duration: 'Concentration, up to 1 round',
  description: 'You extend your hand and point a finger at a target in range. Your magic grants you a brief insight into the target\'s defenses. On your next turn, you gain advantage on your first attack roll against the target, provided that this spell hasn\'t ended.',
  upcast: null, ritual: false, concentration: true,
};

export const spellResistance: Spell = {
  id: 'resistance', name: 'Resistance', level: 0, school: 'Abjuration',
  castingTime: '1 action', range: 'Touch', components: ['V', 'S', 'M'],
  duration: 'Concentration, up to 1 minute',
  description: 'You touch one willing creature. Once before the spell ends, the target can roll a d4 and add the number rolled to one saving throw of its choice. It can roll the die before or after making the saving throw. The spell then ends.',
  upcast: null, ritual: false, concentration: true,
};

export const spellMending: Spell = {
  id: 'mending', name: 'Mending', level: 0, school: 'Transmutation',
  castingTime: '1 minute', range: 'Touch', components: ['V', 'S', 'M'],
  duration: 'Instantaneous',
  description: 'This spell repairs a single break or tear in an object you touch, such as a broken chain link, two halves of a broken key, a torn cloak, or a leaking wineskin. As long as the break or tear is no larger than 1 foot in any dimension, you mend it, leaving no trace of the former damage.',
  upcast: null, ritual: false, concentration: false,
};

export const spellMessage: Spell = {
  id: 'message', name: 'Message', level: 0, school: 'Transmutation',
  castingTime: '1 action', range: '120 feet', components: ['V', 'S', 'M'],
  duration: '1 round',
  description: 'You point your finger toward a creature within range and whisper a message. The target (and only the target) hears the message and can reply in a whisper that only you can hear. You can cast this spell through solid objects if you are familiar with the target and know it is beyond the barrier. This spell is blocked by 1 foot of stone, 1 inch of common metal, a thin sheet of lead, or 3 feet of wood.',
  upcast: null, ritual: false, concentration: false,
};

export const spellLight: Spell = {
  id: 'light', name: 'Light', level: 0, school: 'Evocation',
  castingTime: '1 action', range: 'Touch', components: ['V', 'M'],
  duration: '1 hour',
  description: 'You touch one object that is no larger than 10 feet in any dimension. Until the spell ends, the object sheds bright light in a 20-foot radius and dim light for an additional 20 feet. The light can be colored as you like. Completely covering the object with something opaque blocks the light. The spell ends if you cast it again or dismiss it as an action. If you target an object held or worn by a hostile creature, that creature must succeed on a Dexterity saving throw to avoid the spell.',
  upcast: null, ritual: false, concentration: false,
};

export const spellDancingLights: Spell = {
  id: 'dancing_lights', name: 'Dancing Lights', level: 0, school: 'Evocation',
  castingTime: '1 action', range: '120 feet', components: ['V', 'S', 'M'],
  duration: 'Concentration, up to 1 minute',
  description: 'You create up to four torch-sized lights within range, making them appear as torches, lanterns, or glowing orbs that hover in the air for the duration. You can also combine the four lights into one glowing Medium humanoid form. Whichever form you choose, each light sheds dim light in a 10-foot radius. As a bonus action, you can move the lights up to 60 feet to new spots within range.',
  upcast: null, ritual: false, concentration: true,
};

export const NEW_CANTRIPS: Spell[] = [
  spellRayOfFrost,
  spellShockingGrasp,
  spellPoisonSpray,
  spellAcidSplash,
  spellChillTouch,
  spellTollTheDead,
  spellSpareTheDying,
  spellTrueStrike,
  spellResistance,
  spellMending,
  spellMessage,
  spellLight,
  spellDancingLights,
];
