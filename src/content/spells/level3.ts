// ============================================================================
// FILE: src/content/spells/level3.ts
// Level 3 spells not yet in index.ts
// ============================================================================
import { Spell } from '../../engine/types';

export const spellDispelMagic: Spell = {
  id: 'dispel_magic', name: 'Dispel Magic', level: 3, school: 'Abjuration',
  castingTime: '1 action', range: '120 feet', components: ['V', 'S'],
  duration: 'Instantaneous',
  description: 'Choose one creature, object, or magical effect within range. Any spell of 3rd level or lower on the target ends. For each spell of 4th level or higher on the target, make an ability check using your spellcasting ability against a DC of 10 + the spell\'s level. On a successful check, the spell ends.',
  upcast: 'When you cast this spell using a spell slot of 4th level or higher, you automatically end the effects of a spell on the target if the spell\'s level is equal to or less than the level of the spell slot you used.',
  ritual: false, concentration: false,
};

export const spellHaste: Spell = {
  id: 'haste', name: 'Haste', level: 3, school: 'Transmutation',
  castingTime: '1 action', range: '30 feet', components: ['V', 'S', 'M'],
  duration: 'Concentration, up to 1 minute',
  description: 'Choose a willing creature that you can see within range. Until the spell ends, the target\'s speed is doubled, it gains a +2 bonus to AC, it has advantage on Dexterity saving throws, and it gains an additional action on each of its turns (for attacking, using an object, Dash, Disengage, Hide, or Use Object only). When the spell ends, the target can\'t move or take actions until after its next turn.',
  upcast: null, ritual: false, concentration: true,
};

export const spellSlow: Spell = {
  id: 'slow', name: 'Slow', level: 3, school: 'Transmutation',
  castingTime: '1 action', range: '120 feet', components: ['V', 'S', 'M'],
  duration: 'Concentration, up to 1 minute',
  description: 'You alter time around up to six creatures of your choice in a 40-foot cube within range. Each target must succeed on a Wisdom saving throw or be affected. An affected target\'s speed is halved, it takes a −2 penalty to AC and Dexterity saving throws, and it can\'t use reactions. On its turn, it can use either an action or a bonus action, not both. Regardless of the creature\'s abilities or magic items, it can\'t make more than one melee or ranged attack during its turn.',
  upcast: null, ritual: false, concentration: true,
};

export const spellFear: Spell = {
  id: 'fear', name: 'Fear', level: 3, school: 'Illusion',
  castingTime: '1 action', range: 'Self (30-foot cone)', components: ['V', 'S', 'M'],
  duration: 'Concentration, up to 1 minute',
  description: 'You project a phantasmal image of a creature\'s worst fears. Each creature in a 30-foot cone must succeed on a Wisdom saving throw or drop whatever it is holding and become frightened for the duration. While frightened by this spell, a creature must take the Dash action and move away from you by the safest available route on each of its turns, unless there is nowhere to move. If the creature ends its turn in a location where it doesn\'t have line of sight to you, the creature can make a Wisdom saving throw. On a successful save, the spell ends for that creature.',
  upcast: null, ritual: false, concentration: true,
};

export const spellAnimateDead: Spell = {
  id: 'animate_dead', name: 'Animate Dead', level: 3, school: 'Necromancy',
  castingTime: '1 minute', range: '10 feet', components: ['V', 'S', 'M'],
  duration: 'Instantaneous',
  description: 'This spell creates an undead servant. Choose a pile of bones or a corpse of a Medium or Small humanoid within range. Your spell imbues the target with a foul mimicry of life, raising it as an undead creature. The target becomes a skeleton if you chose bones or a zombie if you chose a corpse. On each of your turns, you can use a bonus action to mentally command any creature you made with this spell if the creature is within 60 feet of you.',
  upcast: 'When you cast this spell using a slot of 4th level or higher, you animate or reassert control over two additional undead creatures for each slot level above 3rd.',
  ritual: false, concentration: false,
};

export const spellSpeakWithDead: Spell = {
  id: 'speak_with_dead', name: 'Speak with Dead', level: 3, school: 'Necromancy',
  castingTime: '1 action', range: '10 feet', components: ['V', 'S', 'M'],
  duration: '10 minutes',
  description: 'You grant the semblance of life and intelligence to a corpse of your choice within range, allowing it to answer the questions you pose. The corpse must still have a mouth and can\'t be undead. The spell fails if the corpse was the target of this spell within the last 10 days. Until the spell ends, you can ask the corpse up to five questions. The corpse knows only what it knew in life, including the languages it knew. Answers are usually brief, cryptic, or repetitive, and the corpse is under no compulsion to offer a truthful answer.',
  upcast: null, ritual: false, concentration: false,
};

export const spellRevivify: Spell = {
  id: 'revivify', name: 'Revivify', level: 3, school: 'Necromancy',
  castingTime: '1 action', range: 'Touch', components: ['V', 'S', 'M'],
  duration: 'Instantaneous',
  description: 'You touch a creature that has died within the last minute. That creature returns to life with 1 hit point. This spell can\'t return to life a creature that has died of old age, nor can it restore any missing body parts.',
  upcast: null, ritual: false, concentration: false,
};

export const spellMassHealingWord: Spell = {
  id: 'mass_healing_word', name: 'Mass Healing Word', level: 3, school: 'Evocation',
  castingTime: '1 bonus action', range: '60 feet', components: ['V'],
  duration: 'Instantaneous',
  description: 'As you call out words of restoration, up to six creatures of your choice that you can see within range regain hit points equal to 1d4 + your spellcasting ability modifier. This spell has no effect on undead or constructs.',
  upcast: 'When you cast this spell using a slot of 4th level or higher, the healing increases by 1d4 for each slot level above 3rd.',
  ritual: false, concentration: false,
};

export const spellSpiritGuardians: Spell = {
  id: 'spirit_guardians', name: 'Spirit Guardians', level: 3, school: 'Conjuration',
  castingTime: '1 action', range: 'Self (15-foot radius)', components: ['V', 'S', 'M'],
  duration: 'Concentration, up to 10 minutes',
  description: 'You call forth spirits to protect you. They flit around you to a distance of 15 feet for the duration. If you are good or neutral, their spectral form appears angelic or fey (your choice). If you are evil, they appear fiendish. When you cast this spell, you can designate any number of creatures you can see to be unaffected by it. An affected creature\'s speed is halved in the area, and when the creature enters the area for the first time on a turn or starts its turn there, it must make a Wisdom saving throw. On a failed save, the creature takes 3d8 radiant (or necrotic if you\'re evil) damage. On a successful save, it takes half.',
  upcast: 'When you cast this spell using a slot of 4th level or higher, the damage increases by 1d8 for each slot level above 3rd.',
  ritual: false, concentration: true,
};

export const spellBeaconOfHope: Spell = {
  id: 'beacon_of_hope', name: 'Beacon of Hope', level: 3, school: 'Abjuration',
  castingTime: '1 action', range: '30 feet', components: ['V', 'S'],
  duration: 'Concentration, up to 1 minute',
  description: 'This spell bestows hope and vitality. Choose any number of creatures within range. For the duration, each target has advantage on Wisdom saving throws and death saving throws, and regains the maximum number of hit points possible from any healing.',
  upcast: null, ritual: false, concentration: true,
};

export const spellVampiricTouch: Spell = {
  id: 'vampiric_touch', name: 'Vampiric Touch', level: 3, school: 'Necromancy',
  castingTime: '1 action', range: 'Self', components: ['V', 'S'],
  duration: 'Concentration, up to 1 minute',
  description: 'The touch of your shadow-wreathed hand can siphon life force from others to heal your wounds. Make a melee spell attack against a creature within your reach. On a hit, the target takes 3d6 necrotic damage, and you regain hit points equal to half the amount of necrotic damage dealt. Until the spell ends, you can make the attack again on each of your turns as an action.',
  upcast: 'When you cast this spell using a slot of 4th level or higher, the damage increases by 1d6 for each slot level above 3rd.',
  ritual: false, concentration: true,
};

export const spellBestowCurse: Spell = {
  id: 'bestow_curse', name: 'Bestow Curse', level: 3, school: 'Necromancy',
  castingTime: '1 action', range: 'Touch', components: ['V', 'S'],
  duration: 'Concentration, up to 1 minute',
  description: 'You touch a creature, and that creature must succeed on a Wisdom saving throw or become cursed for the duration of the spell. When you cast this spell, choose the nature of the curse from the following options: disadvantage on ability checks and saving throws using a chosen ability score; disadvantage on attack rolls against you; must make a Wisdom saving throw at the start of each turn or waste the action doing nothing; or your attacks deal 1d8 extra necrotic damage against the target.',
  upcast: 'If you cast this spell using a slot of 4th level or higher, the duration is 10 minutes (no concentration). At 5th level: 8 hours; 7th level: 24 hours; 9th level: until dispelled.',
  ritual: false, concentration: true,
};

export const spellCallLightning: Spell = {
  id: 'call_lightning', name: 'Call Lightning', level: 3, school: 'Conjuration',
  castingTime: '1 action', range: '120 feet', components: ['V', 'S'],
  duration: 'Concentration, up to 10 minutes',
  description: 'A storm cloud appears in the shape of a cylinder that is 10 feet tall with a 60-foot radius, centered on a point you can see within range directly above you. When you cast the spell, choose a point you can see within range. A bolt of lightning flashes down from the cloud to that point. Each creature within 5 feet of that point must make a Dexterity saving throw. A creature takes 3d10 lightning damage on a failed save, or half as much on a successful one. On each of your turns until the spell ends, you can use your action to call down lightning again.',
  upcast: 'When you cast this spell using a slot of 4th level or higher, the damage increases by 1d10 for each slot level above 3rd.',
  ritual: false, concentration: true,
};

export const spellWaterBreathing: Spell = {
  id: 'water_breathing', name: 'Water Breathing', level: 3, school: 'Transmutation',
  castingTime: '1 action', range: '30 feet', components: ['V', 'S', 'M'],
  duration: '24 hours',
  description: 'This spell grants up to ten willing creatures you can see within range the ability to breathe underwater until the spell ends. Affected creatures also retain their normal mode of respiration.',
  upcast: null, ritual: true, concentration: false,
};

export const spellProtectionFromEnergy: Spell = {
  id: 'protection_from_energy', name: 'Protection from Energy', level: 3, school: 'Abjuration',
  castingTime: '1 action', range: 'Touch', components: ['V', 'S'],
  duration: 'Concentration, up to 1 hour',
  description: 'For the duration, the willing creature you touch has resistance to one damage type of your choice: acid, cold, fire, lightning, or thunder.',
  upcast: null, ritual: false, concentration: true,
};

export const spellBlink: Spell = {
  id: 'blink', name: 'Blink', level: 3, school: 'Transmutation',
  castingTime: '1 action', range: 'Self', components: ['V', 'S'],
  duration: '1 minute',
  description: 'Roll a d20 at the end of each of your turns for the duration of the spell. On a roll of 11 or higher, you vanish from your current plane of existence and appear in the Ethereal Plane (the spell fails and the casting is wasted if you were already on that plane). At the start of your next turn, and when the spell ends if you are on the Ethereal Plane, you return to an unoccupied space of your choice within 10 feet of the space you vanished from.',
  upcast: null, ritual: false, concentration: false,
};

export const spellGaseousForm: Spell = {
  id: 'gaseous_form', name: 'Gaseous Form', level: 3, school: 'Transmutation',
  castingTime: '1 action', range: 'Touch', components: ['V', 'S', 'M'],
  duration: 'Concentration, up to 1 hour',
  description: 'You transform a willing creature you touch, along with everything it\'s wearing and carrying, into a misty cloud for the duration. The spell ends if the creature drops to 0 hit points. An incorporeal creature isn\'t affected. While in this form, the target\'s only method of movement is flying with a speed of 10 feet. The target can enter and occupy the space of another creature. The target has resistance to nonmagical damage, and it has advantage on Strength, Dexterity, and Constitution saving throws. The target can pass through small holes, narrow openings, and even mere cracks.',
  upcast: null, ritual: false, concentration: true,
};

export const spellThunderStep: Spell = {
  id: 'thunder_step', name: 'Thunder Step', level: 3, school: 'Conjuration',
  castingTime: '1 action', range: '90 feet', components: ['V'],
  duration: 'Instantaneous',
  description: 'You teleport yourself to an unoccupied space you can see within range. Immediately after you disappear, a thunderous boom sounds, and each creature within 10 feet of the space you left must make a Constitution saving throw, taking 3d10 thunder damage on a failed save, or half as much on a successful one. The thunder can be heard from up to 300 feet away.',
  upcast: 'When you cast this spell using a spell slot of 4th level or higher, the damage increases by 1d10 for each slot level above 3rd.',
  ritual: false, concentration: false,
};

export const spellHungerOfHadar: Spell = {
  id: 'hunger_of_hadar', name: 'Hunger of Hadar', level: 3, school: 'Conjuration',
  castingTime: '1 action', range: '150 feet', components: ['V', 'S', 'M'],
  duration: 'Concentration, up to 1 minute',
  description: 'You open a gateway to the dark between the stars, a region infested with unknown horrors. A 20-foot-radius sphere of blackness and bitter cold appears, centered on a point with range and lasting for the duration. The void is filled with a cacophony of soft whispers and slurping noises that can be heard up to 30 feet away. No light, magical or otherwise, can illuminate the area, and creatures fully within the area are blinded. Any creature that starts its turn in the area takes 2d6 cold damage. Any creature that ends its turn in the area must succeed on a Dexterity saving throw or take 2d6 acid damage as milky, otherworldly tentacles rub against it.',
  upcast: null, ritual: false, concentration: true,
};

export const spellNondetection: Spell = {
  id: 'nondetection', name: 'Nondetection', level: 3, school: 'Abjuration',
  castingTime: '1 action', range: 'Touch', components: ['V', 'S', 'M'],
  duration: '8 hours',
  description: 'For the duration, you hide a target that you touch from divination magic. The target can be a willing creature or a place or an object no larger than 10 feet in any dimension. The target can\'t be targeted by any divination magic or perceived through magical scrying sensors.',
  upcast: null, ritual: false, concentration: false,
};

export const NEW_LEVEL3: Spell[] = [
  spellDispelMagic,
  spellHaste,
  spellSlow,
  spellFear,
  spellAnimateDead,
  spellSpeakWithDead,
  spellRevivify,
  spellMassHealingWord,
  spellSpiritGuardians,
  spellBeaconOfHope,
  spellVampiricTouch,
  spellBestowCurse,
  spellCallLightning,
  spellWaterBreathing,
  spellProtectionFromEnergy,
  spellBlink,
  spellGaseousForm,
  spellThunderStep,
  spellHungerOfHadar,
  spellNondetection,
];
