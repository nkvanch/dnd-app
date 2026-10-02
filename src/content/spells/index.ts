// ============================================================================
// FILE: src/content/spells/index.ts
// Spells — master aggregator.
// Original spells are defined inline below; new additions are in level files;
// the bulk vault-sourced library is in generated.ts (auto-generated, don't
// hand-edit — see scripts/convert-spells.mjs).
//
// LEGAL FILTERING (see docs/ROADMAP_1.0.md Phase 1):
// Every spell has an optional `srd` flag — true (SRD 5.1 / CC-BY, safe to
// publish), false (WotC Product Identity or non-SRD expansion content,
// personal-use only), or undefined (not yet audited, treated as unsafe).
//
// This app is used personally at Nick's own table with the full spell list,
// non-SRD content included — that's completely fine, it never leaves the
// device. The filter only matters for the eventual public Play Store build,
// which must not distribute WotC's unlicensed content. Controlled by the
// EXPO_PUBLIC_SRD_ONLY env var, set to "true" ONLY on the EAS `production`
// build profile (see eas.json) — personal/dev/preview builds are unaffected
// and continue to see every spell, exactly as before this filter existed.
// ============================================================================
import { Spell } from '../../engine/types';
import { ContentRegistry } from '../ContentRegistry';

// ── New spells from level files ───────────────────────────────────────────────
export * from './cantrips';
export * from './level1';
export * from './level2';
export * from './level3';
export * from './level4';
export * from './level5';
export * from './level6';
export * from './level7';
export * from './level8';
export * from './level9';

import { NEW_CANTRIPS }  from './cantrips';
import { NEW_LEVEL1 }    from './level1';
import { NEW_LEVEL2 }    from './level2';
import { NEW_LEVEL3 }    from './level3';
import { NEW_LEVEL4 }    from './level4';
import { NEW_LEVEL5 }    from './level5';
import { NEW_LEVEL6 }    from './level6';
import { NEW_LEVEL7 }    from './level7';
import { NEW_LEVEL8 }    from './level8';
import { NEW_LEVEL9 }    from './level9';
import { ALL_VAULT_SPELLS } from './generated';
import srdClassification from './srdClassification.json';
import { EMPEROR_CLASS_SPELLS } from '../classes/emperorWarlock/spellData';

// Vault spells carry no srd field in generated.ts itself (see that file's
// header) — classification is merged in here, at load time, from the small
// separate srdClassification.json. This is why re-running
// convert-spells.mjs after a classification-only change leaves
// generated.ts completely untouched: only this tiny JSON updates, so a
// classification pass no longer rewrites the entire 500+KB spell file.
const CLASSIFIED_VAULT_SPELLS: Spell[] = ALL_VAULT_SPELLS.map(s => ({
  ...s,
  srd: (srdClassification as Record<string, boolean>)[s.id],
}));

// ── Original cantrips (level 0) ───────────────────────────────────────────────

export const spellFirebolt: Spell = {
  id: 'firebolt', name: 'Fire Bolt', level: 0, school: 'Evocation',
  castingTime: '1 action', range: '120 feet', components: ['V', 'S'],
  duration: 'Instantaneous', description: 'Hurl a mote of fire at a creature or object. Make a ranged spell attack. On a hit, the target takes 1d10 fire damage. A flammable object hit by this spell ignites if it isn\'t being worn or carried. The damage increases by 1d10 at 5th level (2d10), 11th level (3d10), and 17th level (4d10).',
  upcast: null, ritual: false, concentration: false, srd: true, classes: ['sorcerer', 'wizard'],
};

export const spellSacredFlame: Spell = {
  id: 'sacred_flame', name: 'Sacred Flame', level: 0, school: 'Evocation',
  castingTime: '1 action', range: '60 feet', components: ['V', 'S'],
  duration: 'Instantaneous', description: 'Flame-like radiance descends on a creature you can see within range. The target must succeed on a Dexterity saving throw or take 1d8 radiant damage. The target gains no benefit from cover for this saving throw. The damage increases by 1d8 at 5th level (2d8), 11th level (3d8), and 17th level (4d8).',
  upcast: null, ritual: false, concentration: false, srd: true, classes: ['cleric'],
};

export const spellViciousMockery: Spell = {
  id: 'vicious_mockery', name: 'Vicious Mockery', level: 0, school: 'Enchantment',
  castingTime: '1 action', range: '60 feet', components: ['V'],
  duration: 'Instantaneous', description: 'You unleash a string of insults laced with subtle enchantments at a creature you can see within range. On a failed Wisdom save, the target takes 1d4 psychic damage and has disadvantage on its next attack roll before the end of its next turn. The damage increases by 1d4 at 5th level (2d4), 11th level (3d4), and 17th level (4d4).',
  upcast: null, ritual: false, concentration: false, srd: true, classes: ['bard'],
};

export const spellEldritchBlast: Spell = {
  id: 'eldritch_blast', name: 'Eldritch Blast', level: 0, school: 'Evocation',
  castingTime: '1 action', range: '120 feet', components: ['V', 'S'],
  duration: 'Instantaneous', description: 'A beam of crackling energy streaks toward a creature within range. Make a ranged spell attack. On a hit, the target takes 1d10 force damage. The spell creates more than one beam at higher levels: two beams at 5th level, three beams at 11th level, and four beams at 17th level. You can direct the beams at the same target or at different ones.',
  upcast: null, ritual: false, concentration: false, srd: true, classes: ['warlock'],
};

export const spellMageHand: Spell = {
  id: 'mage_hand', name: 'Mage Hand', level: 0, school: 'Conjuration',
  castingTime: '1 action', range: '30 feet', components: ['V', 'S'],
  duration: '1 minute', description: 'A spectral, floating hand appears at a point you choose within range. The hand lasts for the duration or until you dismiss it. The hand vanishes if it is ever more than 30 feet away from you or if you cast this spell again. You can use the hand to manipulate an object, open an unlocked door or container, stow or retrieve an item, or pour the contents of a vial. It can\'t attack or activate magic items.',
  upcast: null, ritual: false, concentration: false, srd: true, classes: ['bard', 'sorcerer', 'warlock', 'wizard'],
};

export const spellPrestidigitation: Spell = {
  id: 'prestidigitation', name: 'Prestidigitation', level: 0, school: 'Transmutation',
  castingTime: '1 action', range: '10 feet', components: ['V', 'S'],
  duration: 'Up to 1 hour', description: 'This spell is a minor magical trick that novice spellcasters use for practice. You create one of the following magical effects: an instantaneous, harmless sensory effect; light or snuff a small flame; clean or soil an object up to 1 cubic foot; chill, warm, or flavor up to 1 cubic foot of nonliving material; make a color, a small mark, or a symbol appear on an object or surface; create a small, handheld nonmagical trinket or an illusory image.',
  upcast: null, ritual: false, concentration: false, srd: true, classes: ['bard', 'sorcerer', 'warlock', 'wizard'],
};

export const spellMinorIllusion: Spell = {
  id: 'minor_illusion', name: 'Minor Illusion', level: 0, school: 'Illusion',
  castingTime: '1 action', range: '30 feet', components: ['S', 'M'],
  duration: '1 minute', description: 'You create a sound or an image of an object within range that lasts for the duration. The illusion also ends if you dismiss it as an action or cast this spell again. If you create a sound, its volume can range from a whisper to a scream. It can be your voice, someone else\'s voice, a lion\'s roar, music, or any other sound you choose. If you create an image of an object — such as a chair, muddy footprints, or a small chest — it must be no larger than a 5-foot cube. The image can\'t create sound, light, smell, or any other sensory effect.',
  upcast: null, ritual: false, concentration: false, srd: true, classes: ['bard', 'sorcerer', 'warlock', 'wizard'],
};

export const spellShillelagh: Spell = {
  id: 'shillelagh', name: 'Shillelagh', level: 0, school: 'Transmutation',
  castingTime: '1 bonus action', range: 'Self', components: ['V', 'S', 'M'],
  duration: '1 minute', description: 'The wood of a club or quarterstaff you are holding is imbued with nature\'s power. For the duration, you can use your spellcasting ability instead of Strength for the attack and damage rolls of melee attacks using that weapon, and the weapon\'s damage die becomes a d8. The weapon also becomes magical, if it isn\'t already. The spell ends if you cast it again or if you let go of the weapon.',
  upcast: null, ritual: false, concentration: false, srd: true, classes: ['druid'],
};

export const spellGuidance: Spell = {
  id: 'guidance', name: 'Guidance', level: 0, school: 'Divination',
  castingTime: '1 action', range: 'Touch', components: ['V', 'S'],
  duration: 'Concentration, up to 1 minute', description: 'You touch one willing creature. Once before the spell ends, the target can roll a d4 and add the number rolled to one ability check of its choice. It can roll the die before or after making the ability check. The spell then ends.',
  upcast: null, ritual: false, concentration: true, srd: true, classes: ['cleric', 'druid'],
};

export const spellThaumaturgy: Spell = {
  id: 'thaumaturgy', name: 'Thaumaturgy', level: 0, school: 'Transmutation',
  castingTime: '1 action', range: '30 feet', components: ['V'],
  duration: 'Up to 1 minute', description: 'You manifest a minor wonder, a sign of supernatural power, within range. You create one of the following magical effects within range: your voice booms up to 3 times as loud; you cause flames to flicker, brighten, dim, or change color; you cause harmless tremors in the ground; you create an instantaneous sound; you instantaneously cause an unlocked door or window to fly open or slam shut; or you alter the appearance of your eyes. You can have up to three of these effects active at a time, and you can dismiss one as an action.',
  upcast: null, ritual: false, concentration: false, srd: true, classes: ['cleric'],
};

// ── Original level 1 spells ───────────────────────────────────────────────────

export const spellMagicMissile: Spell = {
  id: 'magic_missile', name: 'Magic Missile', level: 1, school: 'Evocation',
  castingTime: '1 action', range: '120 feet', components: ['V', 'S'],
  duration: 'Instantaneous',
  description: 'You create three glowing darts of magical force. Each dart hits a creature of your choice that you can see within range. A dart deals 1d4+1 force damage to its target. The darts all strike simultaneously, and you can direct them to hit one creature or several.',
  upcast: 'When you cast this spell using a slot of 2nd level or higher, the spell creates one more dart for each slot level above 1st.',
  ritual: false, concentration: false, srd: true, classes: ['sorcerer', 'wizard'],
};

export const spellBurningHands: Spell = {
  id: 'burning_hands', name: 'Burning Hands', level: 1, school: 'Evocation',
  castingTime: '1 action', range: 'Self (15-foot cone)', components: ['V', 'S'],
  duration: 'Instantaneous',
  description: 'A thin sheet of flames shoots forth from your outstretched fingertips. Each creature in a 15-foot cone must make a Dexterity saving throw. A creature takes 3d6 fire damage on a failed save, or half as much on a successful one. The fire ignites any flammable objects in the area that aren\'t being worn or carried.',
  upcast: 'When you cast this spell using a slot of 2nd level or higher, the damage increases by 1d6 for each slot level above 1st.',
  ritual: false, concentration: false, srd: true, classes: ['sorcerer', 'wizard'],
};

export const spellCureWounds: Spell = {
  id: 'cure_wounds', name: 'Cure Wounds', level: 1, school: 'Evocation',
  castingTime: '1 action', range: 'Touch', components: ['V', 'S'],
  duration: 'Instantaneous',
  description: 'A creature you touch regains a number of hit points equal to 1d8 + your spellcasting ability modifier. This spell has no effect on undead or constructs.',
  upcast: 'When you cast this spell using a slot of 2nd level or higher, the healing increases by 1d8 for each slot level above 1st.',
  ritual: false, concentration: false, srd: true, classes: ['artificer', 'bard', 'cleric', 'druid', 'paladin', 'ranger'],
};

export const spellHealingWord: Spell = {
  id: 'healing_word', name: 'Healing Word', level: 1, school: 'Evocation',
  castingTime: '1 bonus action', range: '60 feet', components: ['V'],
  duration: 'Instantaneous',
  description: 'A creature of your choice within range regains hit points equal to 1d4 + your spellcasting ability modifier. This spell has no effect on undead or constructs.',
  upcast: 'When you cast this spell using a slot of 2nd level or higher, the healing increases by 1d4 for each slot level above 1st.',
  ritual: false, concentration: false, srd: true, classes: ['bard', 'cleric', 'druid'],
};

export const spellShield: Spell = {
  id: 'shield', name: 'Shield', level: 1, school: 'Abjuration',
  castingTime: '1 reaction', range: 'Self', components: ['V', 'S'],
  duration: '1 round',
  description: 'An invisible barrier of magical force appears and protects you. Until the start of your next turn, you have a +5 bonus to AC, including against the triggering attack, and you take no damage from Magic Missile.',
  upcast: null, ritual: false, concentration: false, srd: true, classes: ['sorcerer', 'wizard'],
};

export const spellThunderwave: Spell = {
  id: 'thunderwave', name: 'Thunderwave', level: 1, school: 'Evocation',
  castingTime: '1 action', range: 'Self (15-foot cube)', components: ['V', 'S'],
  duration: 'Instantaneous',
  description: 'A wave of thunderous force sweeps out from you. Each creature in a 15-foot cube originating from you must make a Constitution saving throw. On a failed save, a creature takes 2d8 thunder damage and is pushed 10 feet away from you. On a successful save, the creature takes half as much damage and isn\'t pushed. In addition, unsecured objects that are completely within the area of effect are automatically pushed 10 feet away from you. The spell emits a thunderous boom audible out to 300 feet.',
  upcast: 'When you cast this spell using a slot of 2nd level or higher, the damage increases by 1d8 for each slot level above 1st.',
  ritual: false, concentration: false, srd: true, classes: ['bard', 'druid', 'sorcerer', 'wizard'],
};

export const spellBless: Spell = {
  id: 'bless', name: 'Bless', level: 1, school: 'Enchantment',
  castingTime: '1 action', range: '30 feet', components: ['V', 'S', 'M'],
  duration: 'Concentration, up to 1 minute',
  description: 'You bless up to three creatures of your choice within range. Whenever a target makes an attack roll or a saving throw before the spell ends, the target can roll a d4 and add the number rolled to the attack roll or saving throw.',
  upcast: 'When you cast this spell using a slot of 2nd level or higher, you can target one additional creature for each slot level above 1st.',
  ritual: false, concentration: true, srd: true, classes: ['cleric', 'paladin'],
};

export const spellCommand: Spell = {
  id: 'command', name: 'Command', level: 1, school: 'Enchantment',
  castingTime: '1 action', range: '60 feet', components: ['V'],
  duration: '1 round',
  description: 'You speak a one-word command to a creature you can see within range. The target must succeed on a Wisdom saving throw or follow the command on its next turn. The spell has no effect if the target is undead, if it doesn\'t understand your language, or if your command is directly harmful to it. Some typical commands: Approach, Drop, Flee, Grovel, Halt.',
  upcast: 'When you cast this spell using a slot of 2nd level or higher, you can affect one additional creature for each slot level above 1st. The creatures must be within 30 feet of each other.',
  ritual: false, concentration: false, srd: true, classes: ['cleric', 'paladin'],
};

export const spellHex: Spell = {
  id: 'hex', name: 'Hex', level: 1, school: 'Enchantment',
  castingTime: '1 bonus action', range: '90 feet', components: ['V', 'S', 'M'],
  duration: 'Concentration, up to 1 hour',
  description: 'You place a curse on a creature that you can see within range. The target takes an extra 1d6 necrotic damage whenever you hit it with an attack. Also, choose one ability when you cast the spell. The target has disadvantage on ability checks made with the chosen ability. If the target drops to 0 hit points before this spell ends, you can use a bonus action on a subsequent turn of yours to curse a new creature.',
  upcast: 'When you cast this spell using a slot of 3rd or 4th level, you can maintain your concentration on the spell for up to 8 hours. When you use a slot of 5th level or higher, you can maintain concentration for up to 24 hours.',
  ritual: false, concentration: true, srd: false, classes: ['warlock'],
};

export const spellHuntersMark: Spell = {
  id: 'hunters_mark', name: "Hunter's Mark", level: 1, school: 'Divination',
  castingTime: '1 bonus action', range: '90 feet', components: ['V'],
  duration: 'Concentration, up to 1 hour',
  description: 'You choose a creature you can see within range and mystically mark it as your quarry. Until the spell ends, you deal an extra 1d6 damage to the target whenever you hit it with a weapon attack, and you have advantage on any Wisdom (Perception) or Wisdom (Survival) check you make to find it. If the target drops to 0 hit points before this spell ends, you can use a bonus action to mark a new creature.',
  upcast: 'When you cast this spell using a slot of 3rd or 4th level, you can maintain concentration for up to 8 hours. A 5th-level slot allows up to 24 hours.',
  ritual: false, concentration: true, srd: true, classes: ['ranger'],
};

export const spellSleepSpell: Spell = {
  id: 'sleep_spell', name: 'Sleep', level: 1, school: 'Enchantment',
  castingTime: '1 action', range: '90 feet', components: ['V', 'S', 'M'],
  duration: '1 minute',
  description: 'This spell sends creatures into a magical slumber. Roll 5d8; the total is how many hit points of creatures this spell can affect, in ascending order of their current hit points (ignoring unconscious creatures and creatures that can\'t be put to sleep). Starting with the creature that has the lowest current hit points, each creature affected by this spell falls unconscious until the spell ends, the sleeper takes damage, or someone uses an action to shake or slap the sleeper awake.',
  upcast: 'When you cast this spell using a slot of 2nd level or higher, roll an additional 2d8 for each slot level above 1st.',
  ritual: false, concentration: false, srd: true, classes: ['bard', 'sorcerer', 'wizard'],
};

export const spellDisguiseSelf: Spell = {
  id: 'disguise_self', name: 'Disguise Self', level: 1, school: 'Illusion',
  castingTime: '1 action', range: 'Self', components: ['V', 'S'],
  duration: '1 hour',
  description: 'You make yourself — including your clothing, armor, weapons, and other belongings on your person — look different until the spell ends or until you use your action to dismiss it. You can seem 1 foot shorter or taller and can appear thin, fat, or in between. You can\'t change your body type, so you must adopt a form that has the same basic arrangement of limbs. Otherwise, the extent of the illusion is up to you. Physical interaction with the disguise reveals it to be an illusion.',
  upcast: null, ritual: false, concentration: false, srd: true, classes: ['bard', 'sorcerer', 'warlock', 'wizard'],
};

export const spellDetectMagic: Spell = {
  id: 'detect_magic', name: 'Detect Magic', level: 1, school: 'Divination',
  castingTime: '1 action', range: 'Self', components: ['V', 'S'],
  duration: 'Concentration, up to 10 minutes',
  description: 'For the duration, you sense the presence of magic within 30 feet of you. If you sense magic in this way, you can use your action to see a faint aura around any visible creature or object in the area that bears magic, and you learn its school of magic, if any. The spell can penetrate most barriers, but it is blocked by 1 foot of stone, 1 inch of common metal, a thin sheet of lead, or 3 feet of wood or dirt.',
  upcast: null, ritual: true, concentration: true, srd: true, classes: ['artificer', 'bard', 'cleric', 'druid', 'paladin', 'ranger', 'sorcerer', 'warlock', 'wizard'],
};

// ── Original level 2 spells ───────────────────────────────────────────────────

export const spellHoldPerson: Spell = {
  id: 'hold_person', name: 'Hold Person', level: 2, school: 'Enchantment',
  castingTime: '1 action', range: '60 feet', components: ['V', 'S', 'M'],
  duration: 'Concentration, up to 1 minute',
  description: 'Choose a humanoid that you can see within range. The target must succeed on a Wisdom saving throw or be paralyzed for the duration. At the end of each of its turns, the target can make another Wisdom saving throw. On a success, the spell ends on the target.',
  upcast: 'When you cast this spell using a slot of 3rd level or higher, you can target one additional humanoid for each slot level above 2nd.',
  ritual: false, concentration: true, srd: true, classes: ['bard', 'cleric', 'sorcerer', 'warlock', 'wizard'],
};

export const spellMistyStep: Spell = {
  id: 'misty_step', name: 'Misty Step', level: 2, school: 'Conjuration',
  castingTime: '1 bonus action', range: 'Self', components: ['V'],
  duration: 'Instantaneous',
  description: 'Briefly surrounded by silvery mist, you teleport up to 30 feet to an unoccupied space that you can see.',
  upcast: null, ritual: false, concentration: false, srd: true, classes: ['sorcerer', 'warlock', 'wizard'],
};

export const spellSpiritualWeapon: Spell = {
  id: 'spiritual_weapon', name: 'Spiritual Weapon', level: 2, school: 'Evocation',
  castingTime: '1 bonus action', range: '60 feet', components: ['V', 'S'],
  duration: '1 minute',
  description: 'You create a floating, spectral weapon within range that lasts for the duration or until you cast this spell again. When you cast the spell, you can make a melee spell attack against a creature within 5 feet of the weapon. On a hit, the target takes 1d8 + your spellcasting ability modifier force damage. As a bonus action on your turn, you can move the weapon up to 20 feet and repeat the attack against a creature within 5 feet of it.',
  upcast: 'When you cast this spell using a slot of 3rd level or higher, the damage increases by 1d8 for every two slot levels above 2nd.',
  ritual: false, concentration: false, srd: true, classes: ['cleric'],
};

export const spellSuggestion: Spell = {
  id: 'suggestion', name: 'Suggestion', level: 2, school: 'Enchantment',
  castingTime: '1 action', range: '30 feet', components: ['V', 'M'],
  duration: 'Concentration, up to 8 hours',
  description: 'You suggest a course of activity (limited to a sentence or two) and magically influence a creature you can see within range that can hear and understand you. Creatures that can\'t be charmed are immune to this effect. The suggestion must be worded in such a manner as to make the course of action sound reasonable. The magically influenced creature pursues the course of action to the best of its ability for the duration. If the course of action leads to harm for the creature, or if the spell ends early due to the creature being ordered to harm itself, the spell ends.',
  upcast: null, ritual: false, concentration: true, srd: true, classes: ['bard', 'sorcerer', 'warlock', 'wizard'],
};

export const spellInvisibility: Spell = {
  id: 'invisibility', name: 'Invisibility', level: 2, school: 'Illusion',
  castingTime: '1 action', range: 'Touch', components: ['V', 'S', 'M'],
  duration: 'Concentration, up to 1 hour',
  description: 'A creature you touch becomes invisible until the spell ends. Anything the target is wearing or carrying is invisible as long as it is on the target\'s person. The spell ends for a target that attacks or casts a spell.',
  upcast: 'When you cast this spell using a slot of 3rd level or higher, you can target one additional creature for each slot level above 2nd.',
  ritual: false, concentration: true, srd: true, classes: ['bard', 'sorcerer', 'warlock', 'wizard'],
};

// ── Original level 3 spells ───────────────────────────────────────────────────

export const spellFireball: Spell = {
  id: 'fireball', name: 'Fireball', level: 3, school: 'Evocation',
  castingTime: '1 action', range: '150 feet', components: ['V', 'S', 'M'],
  duration: 'Instantaneous',
  description: 'A bright streak flashes from your pointing finger to a point you choose within range and then blossoms with a low roar into an explosion of flame. Each creature in a 20-foot-radius sphere centered on that point must make a Dexterity saving throw. A target takes 8d6 fire damage on a failed save, or half as much on a successful one. The fire spreads around corners. It ignites flammable objects in the area that aren\'t being worn or carried.',
  upcast: 'When you cast this spell using a slot of 4th level or higher, the damage increases by 1d6 for each slot level above 3rd.',
  ritual: false, concentration: false, srd: true, classes: ['sorcerer', 'wizard'],
};

export const spellFly: Spell = {
  id: 'fly', name: 'Fly', level: 3, school: 'Transmutation',
  castingTime: '1 action', range: 'Touch', components: ['V', 'S', 'M'],
  duration: 'Concentration, up to 10 minutes',
  description: 'You touch a willing creature. The target gains a flying speed of 60 feet for the duration. When the spell ends, the target falls if it is still aloft, unless it can stop the fall.',
  upcast: 'When you cast this spell using a slot of 4th level or higher, you can target one additional creature for each slot level above 3rd.',
  ritual: false, concentration: true, srd: true, classes: ['artificer', 'sorcerer', 'warlock', 'wizard'],
};

export const spellCounterspell: Spell = {
  id: 'counterspell', name: 'Counterspell', level: 3, school: 'Abjuration',
  castingTime: '1 reaction', range: '60 feet', components: ['S'],
  duration: 'Instantaneous',
  description: 'You attempt to interrupt a creature in the process of casting a spell. If the creature is casting a spell of 3rd level or lower, its spell fails and has no effect. If it is casting a spell of 4th level or higher, make an ability check using your spellcasting ability. The DC equals 10 + the spell\'s level. On a success, the creature\'s spell fails and has no effect.',
  upcast: 'When you cast this spell using a slot of 4th level or higher, the interrupted spell has no effect if its level is less than or equal to the level of the spell slot you used.',
  ritual: false, concentration: false, srd: true, classes: ['sorcerer', 'warlock', 'wizard'],
};

export const spellHypnoticPattern: Spell = {
  id: 'hypnotic_pattern', name: 'Hypnotic Pattern', level: 3, school: 'Illusion',
  castingTime: '1 action', range: '120 feet', components: ['S', 'M'],
  duration: 'Concentration, up to 1 minute',
  description: 'You create a twisting pattern of colors that weaves through the air in a 30-foot cube within range. The pattern appears for a moment and vanishes. Each creature in the area who sees the pattern must make a Wisdom saving throw. On a failed save, the creature becomes charmed for the duration. While charmed by this spell, the creature is incapacitated and has a speed of 0. The effect ends for an affected creature if it takes any damage or if someone else uses an action to shake the creature out of its stupor.',
  upcast: null, ritual: false, concentration: true, srd: true, classes: ['bard', 'sorcerer', 'warlock', 'wizard'],
};

export const spellLightningBolt: Spell = {
  id: 'lightning_bolt', name: 'Lightning Bolt', level: 3, school: 'Evocation',
  castingTime: '1 action', range: 'Self (100-foot line)', components: ['V', 'S', 'M'],
  duration: 'Instantaneous',
  description: 'A stroke of lightning forming a line 100 feet long and 5 feet wide blasts out from you in a direction you choose. Each creature in the line must make a Dexterity saving throw. A creature takes 8d6 lightning damage on a failed save, or half as much on a successful one. The lightning ignites flammable objects in the area that aren\'t being worn or carried. The lightning can bounce off walls up to a maximum length of 100 feet.',
  upcast: 'When you cast this spell using a slot of 4th level or higher, the damage increases by 1d6 for each slot level above 3rd.',
  ritual: false, concentration: false, srd: true, classes: ['sorcerer', 'wizard'],
};

// ── Original level 4 spells ───────────────────────────────────────────────────

export const spellBanishment: Spell = {
  id: 'banishment', name: 'Banishment', level: 4, school: 'Abjuration',
  castingTime: '1 action', range: '60 feet', components: ['V', 'S', 'M'],
  duration: 'Concentration, up to 1 minute',
  description: 'You attempt to send one creature that you can see within range to another place of existence. The target must succeed on a Charisma saving throw or be banished. If the target is native to the plane of existence you\'re on, you banish the target to a harmless demiplane. While there, the target is incapacitated. The target remains there until the spell ends. If the spell ends before 1 minute has passed, the target reappears in the space it left or in the nearest unoccupied space if that space is occupied.',
  upcast: 'When you cast this spell using a slot of 5th level or higher, you can target one additional creature for each slot level above 4th.',
  ritual: false, concentration: true, srd: true, classes: ['cleric', 'paladin', 'sorcerer', 'warlock', 'wizard'],
};

export const spellPolymorph: Spell = {
  id: 'polymorph', name: 'Polymorph', level: 4, school: 'Transmutation',
  castingTime: '1 action', range: '60 feet', components: ['V', 'S', 'M'],
  duration: 'Concentration, up to 1 hour',
  description: 'This spell transforms a creature that you can see within range into a new form. An unwilling creature must make a Wisdom saving throw to avoid the effect. The spell has no effect on a shapechanger or a creature with 0 hit points. The transformation lasts for the duration, or until the target drops to 0 hit points or dies. The new form can be any beast whose challenge rating is equal to or less than the target\'s (or the target\'s level, if it doesn\'t have a challenge rating).',
  upcast: null, ritual: false, concentration: true, srd: true, classes: ['bard', 'druid', 'sorcerer', 'wizard'],
};

export const spellStoneSkin: Spell = {
  id: 'stoneskin', name: 'Stoneskin', level: 4, school: 'Abjuration',
  castingTime: '1 action', range: 'Touch', components: ['V', 'S', 'M'],
  duration: 'Concentration, up to 1 hour',
  description: 'This spell turns the flesh of a willing creature you touch as hard as stone. Until the spell ends, the target has resistance to nonmagical bludgeoning, piercing, and slashing damage.',
  upcast: null, ritual: false, concentration: true, srd: true, classes: ['druid', 'ranger', 'sorcerer', 'wizard'],
};

// ── Original level 5 spells ───────────────────────────────────────────────────

export const spellConeOfCold: Spell = {
  id: 'cone_of_cold', name: 'Cone of Cold', level: 5, school: 'Evocation',
  castingTime: '1 action', range: 'Self (60-foot cone)', components: ['V', 'S', 'M'],
  duration: 'Instantaneous',
  description: 'A blast of cold air erupts from your hands. Each creature in a 60-foot cone must make a Constitution saving throw. A creature takes 8d8 cold damage on a failed save, or half as much on a successful one. A creature killed by this spell becomes a frozen statue until it thaws.',
  upcast: 'When you cast this spell using a slot of 6th level or higher, the damage increases by 1d8 for each slot level above 5th.',
  ritual: false, concentration: false, srd: true, classes: ['sorcerer', 'wizard'],
};

export const spellHoldMonster: Spell = {
  id: 'hold_monster', name: 'Hold Monster', level: 5, school: 'Enchantment',
  castingTime: '1 action', range: '90 feet', components: ['V', 'S', 'M'],
  duration: 'Concentration, up to 1 minute',
  description: 'Choose a creature that you can see within range. The target must succeed on a Wisdom saving throw or be paralyzed for the duration. At the end of each of its turns, the target can make another Wisdom saving throw. On a success, the spell ends on the target.',
  upcast: 'When you cast this spell using a slot of 6th level or higher, you can target one additional creature for each slot level above 5th.',
  ritual: false, concentration: true, srd: true, classes: ['bard', 'sorcerer', 'warlock', 'wizard'],
};

export const spellGreaterRestoration: Spell = {
  id: 'greater_restoration', name: 'Greater Restoration', level: 5, school: 'Abjuration',
  castingTime: '1 action', range: 'Touch', components: ['V', 'S', 'M'],
  duration: 'Instantaneous',
  description: 'You imbue a creature you touch with positive energy to undo a debilitating effect. You can reduce the target\'s exhaustion level by one, or end one of the following effects on the target: one effect that charmed or petrified the target, one curse including attunement to a cursed magic item, any reduction to one of the target\'s ability scores, or one effect reducing the target\'s hit point maximum.',
  upcast: null, ritual: false, concentration: false, srd: true, classes: ['artificer', 'bard', 'cleric', 'druid', 'ranger'],
};

// ── Original level 6 spell ────────────────────────────────────────────────────

export const spellChainLightning: Spell = {
  id: 'chain_lightning', name: 'Chain Lightning', level: 6, school: 'Evocation',
  castingTime: '1 action', range: '150 feet', components: ['V', 'S', 'M'],
  duration: 'Instantaneous',
  description: 'You create a bolt of lightning that arcs toward a target of your choice that you can see within range. Three bolts then leap from that target to as many as three other targets, each of which must be within 30 feet of the first target. A target can be a creature or an object and can be targeted by only one of the bolts. A target must make a Dexterity saving throw. The target takes 10d8 lightning damage on a failed save, or half as much on a successful one.',
  upcast: 'When you cast this spell using a slot of 7th level or higher, one additional bolt leaps from the first target to another target for each slot level above 6th.',
  ritual: false, concentration: false, srd: true, classes: ['sorcerer', 'wizard'],
};

// ── Original level 7 spell ────────────────────────────────────────────────────

export const spellFirestorm: Spell = {
  id: 'fire_storm', name: 'Fire Storm', level: 7, school: 'Evocation',
  castingTime: '1 action', range: '150 feet', components: ['V', 'S'],
  duration: 'Instantaneous',
  description: 'A storm made up of sheets of roaring flame appears in a location you choose within range. The area of the storm consists of up to ten 10-foot cubes, which you can arrange as you wish. Each cube must have at least one face adjacent to the face of another cube. Each creature in the area must make a Dexterity saving throw. It takes 7d10 fire damage on a failed save, or half as much on a successful one. The fire damages objects in the area and ignites flammable objects that aren\'t being worn or carried. If you choose, plant life in the area is unaffected by this spell.',
  upcast: null, ritual: false, concentration: false, srd: true, classes: ['cleric', 'druid', 'sorcerer'],
};

// ── Original level 8 spell ────────────────────────────────────────────────────

export const spellSunburst: Spell = {
  id: 'sunburst', name: 'Sunburst', level: 8, school: 'Evocation',
  castingTime: '1 action', range: '150 feet', components: ['V', 'S', 'M'],
  duration: 'Instantaneous',
  description: 'Brilliant sunlight flashes in a 60-foot radius centered on a point you choose within range. Each creature in that radius must make a Constitution saving throw. On a failed save, a creature takes 12d6 radiant damage and is blinded for 1 minute. On a successful save, it takes half as much damage and isn\'t blinded. Undead and oozes have disadvantage on this saving throw. A creature blinded by this spell makes another Constitution saving throw at the end of each of its turns. On a successful save, it is no longer blinded.',
  upcast: null, ritual: false, concentration: false, srd: true, classes: ['cleric', 'druid', 'sorcerer', 'wizard'],
};

// ── Original level 9 spells ───────────────────────────────────────────────────

export const spellWish: Spell = {
  id: 'wish', name: 'Wish', level: 9, school: 'Conjuration',
  castingTime: '1 action', range: 'Self', components: ['V'],
  duration: 'Instantaneous',
  description: 'Wish is the mightiest spell a mortal creature can cast. By simply speaking aloud, you can alter the very foundations of reality in accord with your desires. The basic use of this spell is to duplicate any other spell of 8th level or lower. Alternatively, you can create one of the following effects: create an item worth up to 25,000 gp; grant up to 20 creatures immunity to a spell or spell effect; create a nonmagical item of up to 25,000 gp value; or grant one creature resistance to a damage type permanently.',
  upcast: null, ritual: false, concentration: false, srd: true, classes: ['sorcerer', 'wizard'],
};

export const spellMeteorSwarm: Spell = {
  id: 'meteor_swarm', name: 'Meteor Swarm', level: 9, school: 'Evocation',
  castingTime: '1 action', range: '1 mile', components: ['V', 'S'],
  duration: 'Instantaneous',
  description: 'Blazing orbs of fire plummet to the ground at four different points you can see within range. Each creature in a 40-foot-radius sphere centered on each point you choose must make a Dexterity saving throw. The sphere spreads around corners. A creature takes 20d6 fire damage and 20d6 bludgeoning damage on a failed save, or half as much on a successful one. A creature in the area of more than one fiery burst is affected only once. The spell damages objects in the area and ignites flammable objects that aren\'t being worn or carried.',
  upcast: null, ritual: false, concentration: false, srd: true, classes: ['sorcerer', 'wizard'],
};

// ── Master export ─────────────────────────────────────────────────────────────

/**
 * Every spell the app knows about, regardless of SRD status. Use this for
 * personal/dev/preview builds and anywhere the full library is genuinely
 * needed (e.g. a future "show me everything, including homebrew-adjacent
 * content" toggle). Most of the app should import ALL_SPELLS instead — see
 * below — which is the one that actually respects the public-build filter.
 */
const _rawSpellLibrary: Spell[] = [
  // ── Cantrips (original) ──────────────────────────────────────────────────
  spellFirebolt, spellSacredFlame, spellViciousMockery, spellEldritchBlast,
  spellMageHand, spellPrestidigitation, spellMinorIllusion,
  spellShillelagh, spellGuidance, spellThaumaturgy,
  // ── Cantrips (new) ───────────────────────────────────────────────────────
  ...NEW_CANTRIPS,
  // ── Level 1 (original) ───────────────────────────────────────────────────
  spellMagicMissile, spellBurningHands, spellCureWounds, spellHealingWord,
  spellShield, spellThunderwave, spellBless, spellCommand,
  spellHex, spellHuntersMark, spellSleepSpell, spellDisguiseSelf, spellDetectMagic,
  // ── Level 1 (new) ────────────────────────────────────────────────────────
  ...NEW_LEVEL1,
  // ── Level 2 (original) ───────────────────────────────────────────────────
  spellHoldPerson, spellMistyStep, spellSpiritualWeapon, spellSuggestion, spellInvisibility,
  // ── Level 2 (new) ────────────────────────────────────────────────────────
  ...NEW_LEVEL2,
  // ── Level 3 (original) ───────────────────────────────────────────────────
  spellFireball, spellFly, spellCounterspell, spellHypnoticPattern, spellLightningBolt,
  // ── Level 3 (new) ────────────────────────────────────────────────────────
  ...NEW_LEVEL3,
  // ── Level 4 (original) ───────────────────────────────────────────────────
  spellBanishment, spellPolymorph, spellStoneSkin,
  // ── Level 4 (new) ────────────────────────────────────────────────────────
  ...NEW_LEVEL4,
  // ── Level 5 (original) ───────────────────────────────────────────────────
  spellConeOfCold, spellHoldMonster, spellGreaterRestoration,
  // ── Level 5 (new) ────────────────────────────────────────────────────────
  ...NEW_LEVEL5,
  // ── Level 6 ──────────────────────────────────────────────────────────────
  spellChainLightning,
  ...NEW_LEVEL6,
  // ── Level 7 ──────────────────────────────────────────────────────────────
  spellFirestorm,
  ...NEW_LEVEL7,
  // ── Level 8 ──────────────────────────────────────────────────────────────
  spellSunburst,
  ...NEW_LEVEL8,
  // ── Level 9 ──────────────────────────────────────────────────────────────
  spellWish, spellMeteorSwarm,
  ...NEW_LEVEL9,
  // ── Vault-sourced library (auto-generated content, SRD status merged in) ──
  ...CLASSIFIED_VAULT_SPELLS,
];

// The vault import (generated.ts) re-sourced a number of core SRD spells that
// were already hand-authored above (e.g. guidance, light, mending,
// sacred_flame — the common Cleric/Wizard cantrips), producing two entries
// with the same id. That's what caused React "two children with the same
// key" errors in the creation spell picker, which renders one row per id.
// Dedup by id, first occurrence wins, so the hand-authored entry (which may
// carry homebrew edits like Green-Flame Blade's Abyss Knight text) takes
// precedence over the later vault-sourced duplicate.
const _seenSpellIds = new Set<string>();
// The Emperor Warlock (built-in homebrew, both versions) draws on an existing spell list it does not own,
// so the spells on that list gain its class ids here. A spell with no `classes` tag is already offered to
// every class and is left alone — tagging it would have narrowed it.
const _emperorSpellIds = new Set(EMPEROR_CLASS_SPELLS);
export const FULL_SPELL_LIBRARY: Spell[] = _rawSpellLibrary.filter(s => {
  if (_seenSpellIds.has(s.id)) return false;
  _seenSpellIds.add(s.id);
  return true;
}).map(s => _emperorSpellIds.has(s.id) && s.classes && s.classes.length > 0
  ? { ...s, classes: [...s.classes, 'emperor_warlock', 'emperor_warlock_demo'] }
  : s);

/**
 * True only on the EAS `production` build profile (see eas.json). Personal,
 * development, and preview builds leave this unset, so Nick's own table use
 * — including non-SRD content — is completely unaffected by this filter.
 */
const SRD_ONLY = process.env.EXPO_PUBLIC_SRD_ONLY === 'true';

/**
 * The spell list the rest of the app should import. On personal/dev builds
 * this is identical to FULL_SPELL_LIBRARY (every spell). On the public Play
 * Store build, it's filtered to srd === true only — WotC Product Identity
 * and non-SRD expansion content never ships in a distributed build.
 * See docs/ROADMAP_1.0.md Phase 1 for the full legal-audit context.
 */
export const ALL_SPELLS: Spell[] = SRD_ONLY
  ? FULL_SPELL_LIBRARY.filter(s => s.srd === true)
  : FULL_SPELL_LIBRARY;

// ── Lazy id-lookup registry ─────────────────────────────────────────────────
// ALL_SPELLS/FULL_SPELL_LIBRARY stay eager arrays above — changing that would
// mean touching every one of the 50+ files that import them as plain Spell[],
// far too large a refactor to risk here. What genuinely helps without that:
// an O(1) id lookup instead of a linear .find() scan, built lazily (only on
// first actual lookup) and memoized. See ContentRegistry.ts for the full
// rationale. Use this anywhere doing repeated by-id lookups (e.g. resolving
// spell names for the character sheet PDF export, or homebrew edit-mode
// loading an existing spell's data back into the builder).
export const spellRegistry = new ContentRegistry<Spell>(() => ALL_SPELLS);
