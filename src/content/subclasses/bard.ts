// ============================================================================
// FILE: src/content/subclasses/bard.ts
// Bard subclasses: College of Lore, College of Valor, College of Creation,
// College of Eloquence, College of Glamour, College of Spirits,
// College of Swords, College of Whispers, plus five deferred Unearthed
// Arcana entries: College of Creation (UA) and College of Spirits (UA) are
// earlier drafts mechanically distinct from the official versions above
// (different sub-feature names and, for Spirits, a different Spirit Tales
// table); College of Satire never became an official subclass; Mage of
// Lorehold and Mage of Silverquill are Strixhaven "universal" subclasses
// usable by Bard, Warlock, or Wizard in the real rules — modeled here as
// Bard-only, since porting the same content across three classes wasn't
// judged worth the added complexity for two UA subclasses.
// ============================================================================
import { ChoiceDefinition, ClassProgression, ChoiceOption, Feature } from '../../engine/types';

export type SubclassProgression = ClassProgression & { name: string };

export const loreCollegeProgression: SubclassProgression = {
  classId: 'bard', name: 'College of Lore', srd: true,
  entries: [
    { level: 3, hpDie: 8,
      choices: [{ id: 'lore_bonus_proficiencies_3', prompt: 'Choose any 3 skills.', kind: 'skill', count: 3, pool: 'all', grants: [], required: true, resolved: false }],
      grants: [
        { kind: 'feature', value: { id: 'cutting_words', name: 'Cutting Words', description: 'Use your reaction and a Bardic Inspiration die to subtract from an attack roll, ability check, or damage roll of a creature within 60 feet that you can hear.', source: { kind: 'subclass', refId: 'lore' }, level: 3, effects: [], actions: [], choices: [], passive: false } },
        { kind: 'feature', value: { id: 'bonus_proficiencies_lore', name: 'Bonus Proficiencies', description: 'Gain proficiency in three skills of your choice.', source: { kind: 'subclass', refId: 'lore' }, level: 3, effects: [], actions: [], choices: [], passive: true } },
      ] },
    { level: 6, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'additional_magical_secrets', name: 'Additional Magical Secrets', description: 'Learn two spells of your choice from any class. They count as bard spells but don\'t count against known spells.', source: { kind: 'subclass', refId: 'lore' }, level: 6, effects: [], actions: [], choices: [], passive: true } }] },
    { level: 14, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'peerless_skill', name: 'Peerless Skill', description: 'When you make an ability check, spend one use of Bardic Inspiration to roll the die and add the result.', source: { kind: 'subclass', refId: 'lore' }, level: 14, effects: [], actions: [], choices: [], passive: false } }] },
  ],
};

export const valorCollegeProgression: SubclassProgression = {
  classId: 'bard', name: 'College of Valor', srd: false,
  entries: [
    { level: 3, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'combat_inspiration', name: 'Combat Inspiration', description: 'Bardic Inspiration can also be used: when the recipient makes a weapon damage roll (add the die to damage), or as a reaction when targeted by an attack (add the die to AC for that attack).', source: { kind: 'subclass', refId: 'valor' }, level: 3, effects: [], actions: [], choices: [], passive: true } }, { kind: 'feature', value: { id: 'bonus_proficiencies_valor', name: 'Bonus Proficiencies', description: 'Gain proficiency with medium armor, shields, and martial weapons.', source: { kind: 'subclass', refId: 'valor' }, level: 3, effects: [], actions: [], choices: [], passive: true } }] },
    { level: 6, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'extra_attack_bard', name: 'Extra Attack', description: 'You can attack twice when you take the Attack action on your turn.', source: { kind: 'subclass', refId: 'valor' }, level: 6, effects: [{ type: 'stat_modifier', target: 'extra_attack', operation: 'set', value: 1, condition: null }], actions: [], choices: [], passive: true } }] },
    { level: 14, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'battle_magic', name: 'Battle Magic', description: 'When you use your action to cast a bard spell, make one weapon attack as a bonus action.', source: { kind: 'subclass', refId: 'valor' }, level: 14, effects: [], actions: [], choices: [], passive: true } }] },
  ],
};

// ── College of Creation ──────────────────────────────────────────────────────
// Note of Potential's three branching riders (extra roll on checks, thunder
// burst on attacks, temp HP on saves) and the Dancing Item companion have no
// matching engine hook (multi-branch trigger, temp HP grant, summoned-ally
// stat block) — description-only, matching the Circle of the Shepherd
// companion precedent (see druid.ts).
export const creationCollegeProgression: SubclassProgression = {
  classId: 'bard', name: 'College of Creation', srd: false,
  entries: [
    { level: 3, hpDie: 8,
      choices: [],
      grants: [
        { kind: 'resource', value: { resourceId: 'performance_of_creation_pool', name: 'Performance of Creation', maximum: 1, recharge: 'long_rest' } },
        { kind: 'feature', value: { id: 'note_of_potential', name: 'Note of Potential', description: 'Whenever you give a creature a Bardic Inspiration die, a harmless mote of light orbits it until the die is spent. When the die is used on an ability check, the creature can reroll and pick the better result. When used on an attack roll, the mote bursts and everything within 5 feet of the target takes thunder damage equal to the die roll (CON save against your spell save DC negates). When used on a saving throw, the creature instead gains temporary hit points equal to the die roll plus your Charisma modifier.', source: { kind: 'subclass', refId: 'creation' }, level: 3, effects: [], actions: [], choices: [], passive: true } },
        { kind: 'feature', value: { id: 'performance_of_creation', name: 'Performance of Creation', description: 'As an action, sing a nonmagical item of your choice into being in an unoccupied space within 10 feet of you. Its value can\'t exceed 20 gp times your bard level, it must be Medium or smaller (Large at level 6, Huge at level 14), and it fades away after a number of hours equal to your proficiency bonus. Only one such item can exist at a time. Usable once per long rest, or again by spending a spell slot of 2nd level or higher.', source: { kind: 'subclass', refId: 'creation' }, level: 3, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'action', resourceCost: { resourceId: 'performance_of_creation_pool', quantity: 1 }, range: '10 feet', target: 'single', requiresSave: null },
          abilityEffects: [] } },
      ] },
    { level: 6, hpDie: 8,
      choices: [],
      grants: [
        { kind: 'resource', value: { resourceId: 'animating_performance_pool', name: 'Animating Performance', maximum: 1, recharge: 'long_rest' } },
        { kind: 'feature', value: { id: 'animating_performance', name: 'Animating Performance', description: 'As an action, breathe life into a Large or smaller nonmagical, unattended item within 30 feet of you, turning it into an obedient construct ally (AC 16, HP 10 + 5 per bard level, speed 30 ft./fly 30 ft. hover, a force-empowered slam attack) for 1 hour, until it drops to 0 HP, or until you die. It acts on your initiative, defaulting to Dodge unless you spend a bonus action to command it. Only one animated item can exist at a time. Usable once per long rest, or again by spending a spell slot of 3rd level or higher.', source: { kind: 'subclass', refId: 'creation' }, level: 6, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'action', resourceCost: { resourceId: 'animating_performance_pool', quantity: 1 }, range: '30 feet', target: 'single', requiresSave: null },
          abilityEffects: [] } },
      ] },
    { level: 14, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'creative_crescendo', name: 'Creative Crescendo', description: 'Performance of Creation can now conjure a number of items at once equal to your Charisma modifier (minimum two), only one of which may be your maximum allowed size, and its gold-value cap no longer applies.', source: { kind: 'subclass', refId: 'creation' }, level: 14, effects: [], actions: [], choices: [], passive: true } }] },
  ],
};

// ── College of Eloquence ─────────────────────────────────────────────────────
export const eloquenceCollegeProgression: SubclassProgression = {
  classId: 'bard', name: 'College of Eloquence', srd: false,
  entries: [
    { level: 3, hpDie: 8,
      choices: [],
      grants: [
        { kind: 'feature', value: { id: 'silver_tongue', name: 'Silver Tongue', description: 'On a Charisma (Persuasion) or Charisma (Deception) check, treat any d20 roll of 9 or lower as a 10.', source: { kind: 'subclass', refId: 'eloquence' }, level: 3, effects: [], actions: [], choices: [], passive: true } },
        { kind: 'feature', value: { id: 'unsettling_words', name: 'Unsettling Words', description: 'As a bonus action, expend a use of Bardic Inspiration and choose a creature within 60 feet that you can see; roll the die and subtract the result from the next saving throw that creature makes before the start of your next turn.', source: { kind: 'subclass', refId: 'eloquence' }, level: 3, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'bonus_action', resourceCost: { resourceId: 'bardic_inspiration_pool', quantity: 1 }, range: '60 feet', target: 'single', requiresSave: null },
          abilityEffects: [] } },
      ] },
    { level: 6, hpDie: 8,
      choices: [],
      grants: [
        { kind: 'resource', value: { resourceId: 'universal_speech_pool', name: 'Universal Speech', maximum: 1, recharge: 'long_rest' } },
        { kind: 'feature', value: { id: 'unfailing_inspiration', name: 'Unfailing Inspiration', description: 'A creature keeps a Bardic Inspiration die you gave it even after adding it to a failed ability check, attack roll, or saving throw.', source: { kind: 'subclass', refId: 'eloquence' }, level: 6, effects: [], actions: [], choices: [], passive: true } },
        { kind: 'feature', value: { id: 'universal_speech', name: 'Universal Speech', description: 'As an action, choose creatures you can see within 60 feet, up to your Charisma modifier (minimum one); each understands your spoken words regardless of language for 1 hour. Usable once per long rest, or again by spending a spell slot.', source: { kind: 'subclass', refId: 'eloquence' }, level: 6, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'action', resourceCost: { resourceId: 'universal_speech_pool', quantity: 1 }, range: '60 feet', target: 'multiple', requiresSave: null },
          abilityEffects: [] } },
      ] },
    { level: 14, hpDie: 8,
      choices: [],
      grants: [
        { kind: 'resource', value: { resourceId: 'infectious_inspiration_pool', name: 'Infectious Inspiration', maximum: 1, recharge: 'long_rest' } },
        { kind: 'feature', value: { id: 'infectious_inspiration', name: 'Infectious Inspiration', description: 'When a creature within 60 feet of you succeeds on a roll using a Bardic Inspiration die you gave it, you can use your reaction to give a Bardic Inspiration die to a different creature within 60 feet, at no cost to your own supply. Usable a number of times equal to your Charisma modifier (minimum once) per long rest — tracked here as a single-use pool; increase its maximum manually to match your Charisma modifier.', source: { kind: 'subclass', refId: 'eloquence' }, level: 14, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'reaction', resourceCost: { resourceId: 'infectious_inspiration_pool', quantity: 1 }, range: '60 feet', target: 'single', requiresSave: null },
          abilityEffects: [] } },
      ] },
  ],
};

// ── College of Glamour ───────────────────────────────────────────────────────
export const glamourCollegeProgression: SubclassProgression = {
  classId: 'bard', name: 'College of Glamour', srd: false,
  entries: [
    { level: 3, hpDie: 8,
      choices: [],
      grants: [
        { kind: 'resource', value: { resourceId: 'enthralling_performance_pool', name: 'Enthralling Performance', maximum: 1, recharge: 'short_rest' } },
        { kind: 'feature', value: { id: 'mantle_of_inspiration', name: 'Mantle of Inspiration', description: 'As a bonus action, expend a use of Bardic Inspiration to grant fey vigor to creatures you can see within 60 feet, up to your Charisma modifier (minimum one). Each gains 5 temporary hit points (8 at level 5, 11 at level 10, 14 at level 15), and a creature that gains them can immediately use its reaction to move up to its speed without provoking opportunity attacks. No engine hook grants the temporary hit points automatically — apply them manually.', source: { kind: 'subclass', refId: 'glamour' }, level: 3, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'bonus_action', resourceCost: { resourceId: 'bardic_inspiration_pool', quantity: 1 }, range: '60 feet', target: 'multiple', requiresSave: null },
          abilityEffects: [] } },
        { kind: 'feature', value: { id: 'enthralling_performance', name: 'Enthralling Performance', description: 'After performing for at least 1 minute, choose humanoids who watched, up to your Charisma modifier (minimum one). Each must succeed on a Wisdom save or be charmed by you for 1 hour, idolizing and defending you until it takes damage, you attack it, or it sees you harm one of its allies. A creature that succeeds has no idea you tried. Usable once per short or long rest.', source: { kind: 'subclass', refId: 'glamour' }, level: 3, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'action', resourceCost: { resourceId: 'enthralling_performance_pool', quantity: 1 }, range: '60 feet', target: 'multiple', requiresSave: { ability: 'wis', dc: 'spell_save_dc' } },
          abilityEffects: [{ type: 'apply_condition', conditionId: 'charmed', duration: { unit: 'hours', remaining: 1 } }] } },
      ] },
    { level: 6, hpDie: 8,
      choices: [],
      grants: [
        { kind: 'resource', value: { resourceId: 'mantle_of_majesty_pool', name: 'Mantle of Majesty', maximum: 1, recharge: 'long_rest' } },
        { kind: 'feature', value: { id: 'mantle_of_majesty', name: 'Mantle of Majesty', description: 'As a bonus action, take on an appearance of unearthly beauty for 1 minute (ending early if your concentration breaks as though on a spell) and cast Command without a spell slot; you can cast Command again as a bonus action on each of your remaining turns for free. Creatures already charmed by you automatically fail their save against it. Usable once per long rest.', source: { kind: 'subclass', refId: 'glamour' }, level: 6, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'bonus_action', resourceCost: { resourceId: 'mantle_of_majesty_pool', quantity: 1 }, range: 'self', target: 'self', requiresSave: null },
          abilityEffects: [{ type: 'cast_spell', spellId: 'command' }] } },
      ] },
    { level: 14, hpDie: 8,
      choices: [],
      grants: [
        { kind: 'resource', value: { resourceId: 'unbreakable_majesty_pool', name: 'Unbreakable Majesty', maximum: 1, recharge: 'short_rest' } },
        { kind: 'feature', value: { id: 'unbreakable_majesty', name: 'Unbreakable Majesty', description: 'Your fey beauty becomes permanent and unnerving. As a bonus action, assume a majestic presence for 1 minute or until incapacitated; the first time each turn a creature tries to attack you, it must succeed on a Charisma save against your spell save DC or redirect the attack elsewhere (wasting it if there is no other target), and on a success it has disadvantage on saves against your spells until your next turn. No per-attacker save-and-redirect hook exists in the engine — resolve manually. Usable once per short or long rest.', source: { kind: 'subclass', refId: 'glamour' }, level: 14, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'bonus_action', resourceCost: { resourceId: 'unbreakable_majesty_pool', quantity: 1 }, range: 'self', target: 'self', requiresSave: null },
          abilityEffects: [] } },
      ] },
  ],
};

// ── College of Spirits ───────────────────────────────────────────────────────
// Tales from Beyond's 12-entry random table is a two-step roll-then-bestow
// mechanic with a distinct rider per result — no single AbilityEffect can
// represent all twelve, so it stays description-only with a real resource
// cost tracked, same treatment as Battle Master's flavor-only maneuvers.
export const spiritsCollegeProgression: SubclassProgression = {
  classId: 'bard', name: 'College of Spirits', srd: false,
  entries: [
    { level: 3, hpDie: 8,
      choices: [],
      grants: [
        { kind: 'feature', value: { id: 'guiding_whispers', name: 'Guiding Whispers', description: 'You learn the Guidance cantrip; it doesn\'t count against your number of bard cantrips known, and it has a range of 60 feet for you.', source: { kind: 'subclass', refId: 'spirits' }, level: 3, effects: [{ type: 'grant_spell', target: 'cantrip', operation: 'add', value: null, condition: null, cantripIds: ['guidance'] }], actions: [], choices: [], passive: true } },
        { kind: 'feature', value: { id: 'spiritual_focus', name: 'Spiritual Focus', description: 'You can use a candle, crystal ball, skull, spirit board, or tarokka deck as a spellcasting focus for your bard spells.', source: { kind: 'subclass', refId: 'spirits' }, level: 3, effects: [], actions: [], choices: [], passive: true } },
        { kind: 'feature', value: { id: 'tales_from_beyond', name: 'Tales from Beyond', description: 'While holding your Spiritual Focus, use a bonus action and expend a use of Bardic Inspiration to roll the die on the Spirit Tales table (12 entries, each a distinct short-range attack, buff, or utility effect keyed to the die result) and retain the tale until you spend it or finish a rest. As an action, choose a creature within 30 feet (yourself included) to bestow the tale\'s effect; any save DC equals your spell save DC. Rolling again immediately replaces any retained tale.', source: { kind: 'subclass', refId: 'spirits' }, level: 3, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'bonus_action', resourceCost: { resourceId: 'bardic_inspiration_pool', quantity: 1 }, range: '30 feet', target: 'single', requiresSave: null },
          abilityEffects: [] } },
      ] },
    { level: 6, hpDie: 8,
      choices: [],
      grants: [
        { kind: 'resource', value: { resourceId: 'spirit_session_pool', name: 'Spirit Session', maximum: 1, recharge: 'long_rest' } },
        { kind: 'feature', value: { id: 'empowered_focus', name: 'Empowered Focus', description: 'When you cast a bard spell that deals damage or restores hit points while holding your Spiritual Focus, roll a d6 and add it to one damage or healing roll of the spell.', source: { kind: 'subclass', refId: 'spirits' }, level: 6, effects: [], actions: [], choices: [], passive: true } },
        { kind: 'feature', value: { id: 'spirit_session', name: 'Spirit Session', description: 'During a short or long rest, spend an hour in ritual with your Spiritual Focus and up to your proficiency bonus in willing participants (including yourself). Afterward, temporarily learn one Divination or Necromancy spell of any class, of a level no higher than the number of participants and no higher than you can cast; it counts as a bard spell and doesn\'t count against your spells known until your next long rest. Usable once per long rest.', source: { kind: 'subclass', refId: 'spirits' }, level: 6, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'free', resourceCost: { resourceId: 'spirit_session_pool', quantity: 1 }, range: 'self', target: 'self', requiresSave: null },
          abilityEffects: [] } },
      ] },
    { level: 14, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'mystical_connection', name: 'Mystical Connection', description: 'Whenever you roll on the Spirit Tales table, roll twice and choose which result to keep (or, on matching rolls, choose any entry on the table).', source: { kind: 'subclass', refId: 'spirits' }, level: 14, effects: [], actions: [], choices: [], passive: true } }] },
  ],
};

// ── College of Swords ────────────────────────────────────────────────────────
// Fighting Style has no wiring anywhere yet in the engine (no base-Fighter
// precedent either) — description-only rather than inventing an unread
// stat_modifier target. Blade Flourish's bonus damage matches the wielded
// weapon's type, which AbilityEffect can't express dynamically, so all three
// keep a real resource cost/activation but no damage hook (same treatment as
// Sneak Attack and Psychic Blades below).
const FIGHTING_STYLE_POOL: ChoiceOption[] = [
  { id: 'dueling', label: 'Dueling', value: { id: 'fighting_style_dueling', name: 'Dueling', description: 'While wielding a melee weapon in one hand and no other weapon, gain a +2 bonus to damage rolls with that weapon. No stat_modifier hook exists for this yet — apply the +2 manually.', source: { kind: 'subclass', refId: 'swords' }, level: null, effects: [], actions: [], choices: [], passive: true } as Feature },
  { id: 'two_weapon_fighting', label: 'Two-Weapon Fighting', value: { id: 'fighting_style_two_weapon', name: 'Two-Weapon Fighting', description: 'When you engage in two-weapon fighting, add your ability modifier to the damage of the second attack. No stat_modifier hook exists for this yet — apply it manually.', source: { kind: 'subclass', refId: 'swords' }, level: null, effects: [], actions: [], choices: [], passive: true } as Feature },
];
function bladeFlourish(id: string, name: string, description: string): Feature {
  return {
    id, name, description,
    source: { kind: 'subclass', refId: 'swords' },
    level: null, effects: [], actions: [], choices: [], passive: false,
    activation: { actionType: 'free', resourceCost: { resourceId: 'bardic_inspiration_pool', quantity: 1 }, range: '5 feet', target: 'single', requiresSave: null },
    abilityEffects: [],
  };
}
export const swordsCollegeProgression: SubclassProgression = {
  classId: 'bard', name: 'College of Swords', srd: false,
  entries: [
    { level: 3, hpDie: 8,
      choices: [{ id: 'swords_fighting_style', prompt: 'Choose a Fighting Style.', kind: 'feature_pool', count: 1, pool: FIGHTING_STYLE_POOL, grants: [], required: true, resolved: false }],
      grants: [
        { kind: 'feature', value: { id: 'bonus_proficiencies_swords', name: 'Bonus Proficiencies', description: 'Gain proficiency with medium armor and the scimitar. Any simple or martial melee weapon you\'re proficient with can serve as a spellcasting focus for your bard spells.', source: { kind: 'subclass', refId: 'swords' }, level: 3, effects: [], actions: [], choices: [], passive: true } },
        { kind: 'feature', value: { id: 'blade_flourish', name: 'Blade Flourish', description: 'Whenever you take the Attack action, your walking speed increases by 10 feet until the end of the turn, and if a weapon attack made as part of that action hits, you may apply one of the three Blade Flourish options below (only one per turn).', source: { kind: 'subclass', refId: 'swords' }, level: 3, effects: [], actions: [], choices: [], passive: true } },
        { kind: 'feature', value: bladeFlourish('defensive_flourish', 'Defensive Flourish', 'Expend a use of Bardic Inspiration: the hit deals extra damage equal to the die roll, and you add that same roll to your AC until the start of your next turn.') },
        { kind: 'feature', value: bladeFlourish('slashing_flourish', 'Slashing Flourish', 'Expend a use of Bardic Inspiration: the hit deals extra damage equal to the die roll to the target and to one other creature you choose within 5 feet of you.') },
        { kind: 'feature', value: bladeFlourish('mobile_flourish', 'Mobile Flourish', 'Expend a use of Bardic Inspiration: the hit deals extra damage equal to the die roll, and you push the target 5 feet plus the die roll away from you, then may immediately use your reaction to move up to your speed to a space within 5 feet of it.') },
      ] },
    { level: 6, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'extra_attack_swords', name: 'Extra Attack', description: 'You can attack twice when you take the Attack action on your turn.', source: { kind: 'subclass', refId: 'swords' }, level: 6, effects: [{ type: 'stat_modifier', target: 'extra_attack', operation: 'set', value: 1, condition: null }], actions: [], choices: [], passive: true } }] },
    { level: 14, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'masters_flourish', name: "Master's Flourish", description: 'Whenever you use a Blade Flourish option, you may roll a d6 instead of expending a use of Bardic Inspiration.', source: { kind: 'subclass', refId: 'swords' }, level: 14, effects: [], actions: [], choices: [], passive: true } }] },
  ],
};

// ── College of Whispers ──────────────────────────────────────────────────────
export const whispersCollegeProgression: SubclassProgression = {
  classId: 'bard', name: 'College of Whispers', srd: false,
  entries: [
    { level: 3, hpDie: 8,
      choices: [],
      grants: [
        { kind: 'resource', value: { resourceId: 'words_of_terror_pool', name: 'Words of Terror', maximum: 1, recharge: 'short_rest' } },
        { kind: 'feature', value: { id: 'psychic_blades', name: 'Psychic Blades', description: 'Once per round, when you hit a creature with a weapon attack, you can expend a use of Bardic Inspiration to deal an extra 2d6 psychic damage (3d6 at level 5, 5d6 at level 10, 8d6 at level 15).', source: { kind: 'subclass', refId: 'whispers' }, level: 3, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'free', resourceCost: { resourceId: 'bardic_inspiration_pool', quantity: 1 }, range: '5 feet', target: 'single', requiresSave: null },
          abilityEffects: [{ type: 'damage', dice: '2d6', damageType: 'psychic' }] } },
        { kind: 'feature', value: { id: 'words_of_terror', name: 'Words of Terror', description: 'After speaking with a humanoid alone for at least 1 minute, you can attempt to plant paranoia in its mind. It must succeed on a Wisdom save or be frightened of you (or another creature of your choice) for 1 hour, until attacked or damaged, or until it sees an ally harmed. On a success it has no idea you tried. Usable once per short or long rest.', source: { kind: 'subclass', refId: 'whispers' }, level: 3, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'action', resourceCost: { resourceId: 'words_of_terror_pool', quantity: 1 }, range: '30 feet', target: 'single', requiresSave: { ability: 'wis', dc: 'spell_save_dc' } },
          abilityEffects: [{ type: 'apply_condition', conditionId: 'frightened', duration: { unit: 'hours', remaining: 1 } }] } },
      ] },
    { level: 6, hpDie: 8,
      choices: [],
      grants: [
        { kind: 'resource', value: { resourceId: 'mantle_of_whispers_pool', name: 'Mantle of Whispers', maximum: 1, recharge: 'long_rest' } },
        { kind: 'feature', value: { id: 'mantle_of_whispers', name: 'Mantle of Whispers', description: 'When a humanoid dies within 30 feet of you, use your reaction to capture its shadow. As an action, spend the shadow to disguise yourself as that person (alive and well) for 1 hour, gaining the surface knowledge it would share with a casual acquaintance; a Wisdom (Insight) check contested by your Charisma (Deception) check (+5 bonus) sees through it. Usable once per short or long rest.', source: { kind: 'subclass', refId: 'whispers' }, level: 6, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'reaction', resourceCost: { resourceId: 'mantle_of_whispers_pool', quantity: 1 }, range: '30 feet', target: 'single', requiresSave: null },
          abilityEffects: [] } },
      ] },
    { level: 14, hpDie: 8,
      choices: [],
      grants: [
        { kind: 'resource', value: { resourceId: 'shadow_lore_pool', name: 'Shadow Lore', maximum: 1, recharge: 'long_rest' } },
        { kind: 'feature', value: { id: 'shadow_lore', name: 'Shadow Lore', description: 'As an action, whisper a phrase only one creature within 30 feet can hear (automatic success if it doesn\'t share a language with you or can\'t hear you). On a failed Wisdom save, it believes you know its most mortifying secret and is charmed by you for 8 hours or until you or an ally attacks or damages it, obeying you out of fear of exposure and offering favors it would give a close friend. When the effect ends it has no memory of why it feared you. Usable once per long rest.', source: { kind: 'subclass', refId: 'whispers' }, level: 14, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'action', resourceCost: { resourceId: 'shadow_lore_pool', quantity: 1 }, range: '30 feet', target: 'single', requiresSave: { ability: 'wis', dc: 'spell_save_dc' } },
          abilityEffects: [{ type: 'apply_condition', conditionId: 'charmed', duration: { unit: 'hours', remaining: 8 } }] } },
      ] },
  ],
};

// ── College of Creation (UA) ─────────────────────────────────────────────────
export const creationCollegeUaProgression: SubclassProgression = {
  classId: 'bard', name: 'College of Creation (UA)', srd: false,
  entries: [
    { level: 3, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'note_of_potential_ua', name: 'Note of Potential', description: 'Whenever you give a creature a Bardic Inspiration die, create a Note of Potential that orbits it until the die is spent. On an attack roll, expend the note for a burst of thunder damage equal to the die roll to everything within 5 feet of the target (CON save against your spell save DC negates). On a saving throw, expend it for temporary hit points equal to the die roll plus your Charisma modifier. On an ability check, expend it to reroll the die and choose the better result.', source: { kind: 'subclass', refId: 'creation_ua' }, level: 3, effects: [], actions: [], choices: [], passive: true } }] },
    { level: 6, hpDie: 8, choices: [],
      grants: [
        { kind: 'resource', value: { resourceId: 'animating_performance_ua_pool', name: 'Animating Performance', maximum: 1, recharge: 'long_rest' } },
        { kind: 'feature', value: { id: 'animating_performance_ua', name: 'Animating Performance', description: 'As an action, animate a Large or smaller nonmagical item within 30 feet into a Dancing Item construct ally under your control for 1 hour or until reduced to 0 HP. Usable once per long rest, or again by spending a 3rd-level spell slot.', source: { kind: 'subclass', refId: 'creation_ua' }, level: 6, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'action', resourceCost: { resourceId: 'animating_performance_ua_pool', quantity: 1 }, range: '30 feet', target: 'single', requiresSave: null },
          abilityEffects: [] } },
      ] },
    { level: 14, hpDie: 8, choices: [],
      grants: [
        { kind: 'resource', value: { resourceId: 'performance_of_creation_ua_pool', name: 'Performance of Creation', maximum: 1, recharge: 'long_rest' } },
        { kind: 'feature', value: { id: 'performance_of_creation_ua', name: 'Performance of Creation', description: 'As an action, create a nonmagical item of your choice (up to 20 gp times your bard level, Large or smaller) in an unoccupied space within 10 feet. It fades at the end of your next turn unless you spend your action to maintain it (up to 1 minute total), after which it lasts hours equal to your bard level. Usable once per long rest, or again by spending a 5th-level spell slot.', source: { kind: 'subclass', refId: 'creation_ua' }, level: 14, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'action', resourceCost: { resourceId: 'performance_of_creation_ua_pool', quantity: 1 }, range: '10 feet', target: 'single', requiresSave: null },
          abilityEffects: [] } },
      ] },
  ],
};

// ── College of Satire ────────────────────────────────────────────────────────
export const satireCollegeProgression: SubclassProgression = {
  classId: 'bard', name: 'College of Satire', srd: false,
  entries: [
    { level: 3, hpDie: 8,
      choices: [{ id: 'satire_bonus_skill', prompt: 'Choose one additional skill.', kind: 'skill', count: 1, pool: 'all', grants: [], required: true, resolved: false } as ChoiceDefinition],
      grants: [
        { kind: 'feature', value: { id: 'satire_bonus_proficiencies', name: 'Bonus Proficiencies', description: 'Gain proficiency with thieves\' tools, in Sleight of Hand, and in one additional skill of your choice (substitute another skill for any you already have).', source: { kind: 'subclass', refId: 'satire' }, level: 3, effects: [
          { type: 'grant_proficiency', target: 'tool:thieves_tools', operation: 'add', value: null, condition: null },
          { type: 'grant_proficiency', target: 'skill:sleight_of_hand', operation: 'add', value: null, condition: null },
        ], actions: [], choices: [], passive: true } },
        { kind: 'feature', value: { id: 'tumbling_fool', name: 'Tumbling Fool', description: 'As a bonus action, tumble: for the rest of the turn, gain the benefits of Dash and Disengage, a climbing speed equal to your current speed, and half damage from falling.', source: { kind: 'subclass', refId: 'satire' }, level: 3, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'bonus_action', resourceCost: null, range: 'self', target: 'self', requiresSave: null },
          abilityEffects: [] } },
      ] },
    { level: 6, hpDie: 8, choices: [],
      grants: [
        { kind: 'resource', value: { resourceId: 'fools_insight_pool', name: 'Fool\'s Insight (scales with Charisma modifier)', maximum: 1, recharge: 'long_rest' } },
        { kind: 'feature', value: { id: 'fools_insight', name: "Fool's Insight", description: 'Cast Detect Thoughts a number of times equal to your Charisma modifier per long rest — tracked here as a single-use pool; increase its maximum to match. A creature that resists it suffers an embarrassing gaffe (loud gas, a burp, tripping, or an unwanted joke). Detect Thoughts isn\'t in this codebase\'s spell library yet — no cast_spell hook until it\'s added.', source: { kind: 'subclass', refId: 'satire' }, level: 6, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'action', resourceCost: { resourceId: 'fools_insight_pool', quantity: 1 }, range: '30 feet', target: 'single', requiresSave: null },
          abilityEffects: [] } },
      ] },
    { level: 14, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'fools_luck', name: "Fool's Luck", description: 'After failing an ability check, saving throw, or attack roll, expend a use of Bardic Inspiration to roll the die and add it to the failed roll, using the new total. If this turns it into a success, note the number rolled — the DM can later apply it as a penalty to one of your rolls (an embarrassing gaffe), and you can\'t use this feature again until that happens.', source: { kind: 'subclass', refId: 'satire' }, level: 14, effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'free', resourceCost: { resourceId: 'bardic_inspiration_pool', quantity: 1 }, range: 'self', target: 'self', requiresSave: null },
      abilityEffects: [] } }] },
  ],
};

// ── College of Spirits (UA) ──────────────────────────────────────────────────
export const spiritsCollegeUaProgression: SubclassProgression = {
  classId: 'bard', name: 'College of Spirits (UA)', srd: false,
  entries: [
    { level: 3, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'guiding_whispers_ua', name: 'Guiding Whispers', description: 'Learn the Guidance cantrip (doesn\'t count against your cantrips known); for you it has a range of 60 feet.', source: { kind: 'subclass', refId: 'spirits_ua' }, level: 3, effects: [
          { type: 'grant_spell', target: 'cantrip', operation: 'add', value: null, condition: null, cantripIds: ['guidance'] },
        ], actions: [], choices: [], passive: true } },
        { kind: 'feature', value: { id: 'spiritual_focus_ua', name: 'Spiritual Focus', description: 'Use a candle, crystal ball, talking board, tarokka deck, or skull as a spellcasting focus for your bard spells.', source: { kind: 'subclass', refId: 'spirits_ua' }, level: 3, effects: [], actions: [], choices: [], passive: true } },
        { kind: 'feature', value: { id: 'tales_from_beyond_ua', name: 'Tales from Beyond', description: 'While holding your Spiritual Focus, use a bonus action and expend a use of Bardic Inspiration to roll on a 12-entry Spirits\' Tales table (each entry a distinct short-range attack, buff, or utility effect keyed to the die result — Beast, Warrior, Friends, Runaway, Avenger, Hero, Fey, Dark Spirit, Giant, Dragon, Celestial, or Unknown) and retain the tale until you spend it or finish a rest. As an action, bestow it on a creature within 30 feet (yourself included); any save DC equals your spell save DC.', source: { kind: 'subclass', refId: 'spirits_ua' }, level: 3, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'bonus_action', resourceCost: { resourceId: 'bardic_inspiration_pool', quantity: 1 }, range: '30 feet', target: 'single', requiresSave: null },
          abilityEffects: [] } },
      ] },
    { level: 6, hpDie: 8, choices: [],
      grants: [
        { kind: 'resource', value: { resourceId: 'spirit_session_ua_pool', name: 'Spirit Session', maximum: 1, recharge: 'long_rest' } },
        { kind: 'feature', value: { id: 'empowered_focus_ua', name: 'Empowered Focus', description: 'When you cast a bard spell that deals damage or restores hit points while holding your Spiritual Focus, roll a d6 and add it to one damage or healing roll.', source: { kind: 'subclass', refId: 'spirits_ua' }, level: 6, effects: [], actions: [], choices: [], passive: true } },
        { kind: 'feature', value: { id: 'spirit_session_ua', name: 'Spirit Session', description: 'During a short or long rest, spend an hour in ritual with your Spiritual Focus and up to your proficiency bonus in willing participants. Afterward, temporarily learn one spell of any class of a level no higher than the number of participants and no higher than you can cast, until your next long rest; it counts as a bard spell but doesn\'t count against spells known. Usable once per long rest.', source: { kind: 'subclass', refId: 'spirits_ua' }, level: 6, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'free', resourceCost: { resourceId: 'spirit_session_ua_pool', quantity: 1 }, range: 'self', target: 'self', requiresSave: null },
          abilityEffects: [] } },
      ] },
    { level: 14, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'mystical_connection_ua', name: 'Mystical Connection', description: 'Whenever you use Tales from Beyond, you can roll a d6 in place of expending a Bardic Inspiration die for the table roll — you still expend the Bardic Inspiration die for the tale\'s own effect, without losing it.', source: { kind: 'subclass', refId: 'spirits_ua' }, level: 14, effects: [], actions: [], choices: [], passive: true } }] },
  ],
};

// ── Mage of Lorehold ─────────────────────────────────────────────────────────
// Strixhaven "universal" subclass (real rules let Bard, Warlock, or Wizard
// take it) — modeled as Bard-only here; see file header.
const LOREHOLD_COMPANION_POOL: ChoiceOption[] = [
  { id: 'healer', label: 'Healer', value: { id: 'ancient_companion_healer', name: 'Ancient Companion: Healer', description: 'Your ancient companion is a Healer spirit — Healer\'s Light lets it grant temporary hit points, and at level 6 your own hit point maximum grows and healing spells restore extra HP.', source: { kind: 'subclass', refId: 'mage_of_lorehold' }, level: null, effects: [], actions: [], choices: [], passive: true } as Feature },
  { id: 'sage', label: 'Sage', value: { id: 'ancient_companion_sage', name: 'Ancient Companion: Sage', description: 'Your ancient companion is a Sage spirit — Sage\'s Counsel grants you and nearby allies a bonus to Intelligence and Wisdom checks, and at level 6 you gain skill advantage plus a spell-damage rider.', source: { kind: 'subclass', refId: 'mage_of_lorehold' }, level: null, effects: [], actions: [], choices: [], passive: true } as Feature },
  { id: 'warrior', label: 'Warrior', value: { id: 'ancient_companion_warrior', name: 'Ancient Companion: Warrior', description: 'Your ancient companion is a Warrior spirit — Warrior\'s Protection helps nearby allies on Strength/Dexterity saves, and at level 6 casting a cantrip lets you also make a weapon attack with a radiant damage rider.', source: { kind: 'subclass', refId: 'mage_of_lorehold' }, level: null, effects: [], actions: [], choices: [], passive: true } as Feature },
];
export const mageOfLoreholdProgression: SubclassProgression = {
  classId: 'bard', name: 'Mage of Lorehold', srd: false,
  entries: [
    { level: 3, hpDie: 8,
      choices: [{ id: 'lorehold_companion_type', prompt: 'Choose your Ancient Companion\'s type.', kind: 'feature_pool', count: 1, pool: LOREHOLD_COMPANION_POOL, grants: [], required: true, resolved: false }],
      grants: [
        { kind: 'feature', value: { id: 'lorehold_spells', name: 'Lorehold Spells', description: 'Learn the Sacred Flame cantrip and the Comprehend Languages spell (neither counts against your spells known). Learn further spells at levels 5/7/9 (Speak with Dead, Spirit Guardians, Arcane Eye, Stone Shape, Destructive Wave, Legend Lore) — not wired via known_spells, several referenced spells aren\'t in the library yet.', source: { kind: 'subclass', refId: 'mage_of_lorehold' }, level: 3, effects: [
          { type: 'grant_spell', target: 'cantrip', operation: 'add', value: null, condition: null, cantripIds: ['sacred_flame'] },
        ], actions: [], choices: [], passive: true } },
        { kind: 'resource', value: { resourceId: 'ancient_companion_pool', name: 'Ancient Companion', maximum: 1, recharge: 'short_rest' } },
        { kind: 'feature', value: { id: 'ancient_companion', name: 'Ancient Companion', description: 'At the end of a short or long rest, bond with a spirit of the ancient dead that inhabits a Medium freestanding statue within 10 feet, serving as your companion (AC 14 + prof bonus, HP 5 + 5 per class level, obeys your commands) until it drops to 0 HP, you bond with a new one, or you die. As an action, touch it and expend a spell slot to heal it 10 HP per slot level.', source: { kind: 'subclass', refId: 'mage_of_lorehold' }, level: 3, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'free', resourceCost: { resourceId: 'ancient_companion_pool', quantity: 1 }, range: '10 feet', target: 'self', requiresSave: null },
          abilityEffects: [] } },
      ] },
    { level: 6, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'lessons_of_the_past', name: 'Lessons of the Past', description: 'When you bond with your companion, also gain a benefit based on its type: Healer — your HP maximum and current HP increase by your class level, and healing spells restore an extra 1d8; Sage — advantage on Arcana/History/Nature/Religion checks, and once per turn a spell hit adds 1d8 force damage; Warrior — casting a cantrip lets you also make a weapon attack, dealing an extra 1d8 radiant damage on a hit. Switching companion type replaces the previous benefit.', source: { kind: 'subclass', refId: 'mage_of_lorehold' }, level: 6, effects: [], actions: [], choices: [], passive: true } }] },
    { level: 10, hpDie: 8, choices: [],
      grants: [
        { kind: 'resource', value: { resourceId: 'war_echoes_pool', name: 'War Echoes (scales with proficiency bonus)', maximum: 1, recharge: 'long_rest' } },
        { kind: 'feature', value: { id: 'war_echoes', name: 'War Echoes', description: 'Once per turn when a creature you can see hits a target with an attack, use your reaction to force a Wisdom save against your spell save DC; on a failure, the target becomes vulnerable to one damage type from that attack until the end of its next turn (including the triggering damage). Usable a number of times equal to your proficiency bonus per long rest — tracked here as a single-use pool; increase its maximum to match.', source: { kind: 'subclass', refId: 'mage_of_lorehold' }, level: 10, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'reaction', resourceCost: { resourceId: 'war_echoes_pool', quantity: 1 }, range: '60 feet', target: 'single', requiresSave: { ability: 'wis', dc: 'spell_save_dc' } },
          abilityEffects: [] } },
      ] },
    { level: 14, hpDie: 8, choices: [],
      grants: [
        { kind: 'resource', value: { resourceId: 'historys_whims_pool', name: "History's Whims", maximum: 1, recharge: 'long_rest' } },
        { kind: 'feature', value: { id: 'historys_whims', name: "History's Whims", description: 'As a bonus action, enter chronal chaos for 1 minute (ends early if incapacitated); at the start of the state and each subsequent turn, choose Luck (add a rolled d6 to a damaging saving throw), Resistance (resistance to bludgeoning/piercing/slashing), or Swiftness (+15 feet speed, no opportunity attacks) — never the same benefit twice in a row, each lasting until your next turn. Usable once per long rest, or again by spending a 4th-level spell slot.', source: { kind: 'subclass', refId: 'mage_of_lorehold' }, level: 14, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'bonus_action', resourceCost: { resourceId: 'historys_whims_pool', quantity: 1 }, range: 'self', target: 'self', requiresSave: null },
          abilityEffects: [] } },
      ] },
  ],
};

// ── Mage of Silverquill ──────────────────────────────────────────────────────
const SILVERQUILL_CANTRIP_POOL: ChoiceOption[] = [
  { id: 'sacred_flame', label: 'Sacred Flame', value: { id: 'eloquent_apprentice_sacred_flame', name: 'Eloquent Apprentice: Sacred Flame', description: 'Learn the Sacred Flame cantrip.', source: { kind: 'subclass', refId: 'mage_of_silverquill' }, level: null, effects: [{ type: 'grant_spell', target: 'cantrip', operation: 'add', value: null, condition: null, cantripIds: ['sacred_flame'] }], actions: [], choices: [], passive: true } as Feature },
  { id: 'vicious_mockery', label: 'Vicious Mockery', value: { id: 'eloquent_apprentice_vicious_mockery', name: 'Eloquent Apprentice: Vicious Mockery', description: 'Learn the Vicious Mockery cantrip.', source: { kind: 'subclass', refId: 'mage_of_silverquill' }, level: null, effects: [{ type: 'grant_spell', target: 'cantrip', operation: 'add', value: null, condition: null, cantripIds: ['vicious_mockery'] }], actions: [], choices: [], passive: true } as Feature },
];
export const mageOfSilverquillProgression: SubclassProgression = {
  classId: 'bard', name: 'Mage of Silverquill', srd: false,
  entries: [
    { level: 3, hpDie: 8,
      choices: [
        { id: 'silverquill_cantrip', prompt: 'Choose Sacred Flame or Vicious Mockery.', kind: 'feature_pool', count: 1, pool: SILVERQUILL_CANTRIP_POOL, grants: [], required: true, resolved: false },
        { id: 'silverquill_skills', prompt: 'Choose 2 skills: Deception, Intimidation, Performance, Persuasion, or Insight.', kind: 'skill', count: 2, pool: [
          { id: 'deception', label: 'Deception', value: 'deception' },
          { id: 'intimidation', label: 'Intimidation', value: 'intimidation' },
          { id: 'performance', label: 'Performance', value: 'performance' },
          { id: 'persuasion', label: 'Persuasion', value: 'persuasion' },
          { id: 'insight', label: 'Insight', value: 'insight' },
        ], grants: [], required: true, resolved: false },
      ],
      grants: [
        { kind: 'resource', value: { resourceId: 'silvery_barbs_pool', name: 'Silvery Barbs', maximum: 1, recharge: 'long_rest' } },
        { kind: 'feature', value: { id: 'silvery_barbs', name: 'Silvery Barbs', description: 'Immediately after a creature within 60 feet succeeds on an attack roll, ability check, or saving throw, use your reaction to force it (unless immune to charmed) to reroll and use the lower result. If that causes a failure, empower a different creature within 60 feet (yourself included) to reroll one attack/check/save within 1 minute and take the higher result; only one empowerment active per creature. Usable once per long rest, or again by spending a spell slot.', source: { kind: 'subclass', refId: 'mage_of_silverquill' }, level: 3, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'reaction', resourceCost: { resourceId: 'silvery_barbs_pool', quantity: 1 }, range: '60 feet', target: 'single', requiresSave: null },
          abilityEffects: [] } },
      ] },
    { level: 6, hpDie: 8, choices: [],
      grants: [
        { kind: 'resource', value: { resourceId: 'inky_shroud_pool', name: 'Inky Shroud', maximum: 1, recharge: 'long_rest' } },
        { kind: 'feature', value: { id: 'inky_shroud', name: 'Inky Shroud', description: 'Learn the Darkness spell (added to your spell list). Cast it without a slot once per long rest (or normally with a 2nd-level-or-higher slot); when cast for free, you see normally through it, and a creature that starts its turn in it that you can see takes 2d10 psychic damage.', source: { kind: 'subclass', refId: 'mage_of_silverquill' }, level: 6, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'action', resourceCost: { resourceId: 'inky_shroud_pool', quantity: 1 }, range: '60 feet', target: 'area', requiresSave: null },
          abilityEffects: [{ type: 'cast_spell', spellId: 'darkness' }] } },
      ] },
    { level: 10, hpDie: 8, choices: [],
      grants: [
        { kind: 'resource', value: { resourceId: 'infusion_eloquence_pool', name: 'Infusion of Eloquence (scales with proficiency bonus)', maximum: 1, recharge: 'long_rest' } },
        { kind: 'feature', value: { id: 'infusion_of_eloquence', name: 'Infusion of Eloquence', description: 'When you cast a damaging spell, change its damage type to psychic or radiant; a creature damaged takes extra damage equal to your proficiency bonus and is frightened of you (psychic) or charmed by you (radiant) until the start of your next turn. Usable a number of times equal to your proficiency bonus per long rest — tracked here as a single-use pool; increase its maximum to match.', source: { kind: 'subclass', refId: 'mage_of_silverquill' }, level: 10, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'free', resourceCost: { resourceId: 'infusion_eloquence_pool', quantity: 1 }, range: '60 feet', target: 'single', requiresSave: null },
          abilityEffects: [{ type: 'apply_condition', conditionId: 'frightened', duration: { unit: 'rounds', remaining: 1 } }] } },
      ] },
    { level: 14, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'deadly_despair', name: 'Word of Power: Deadly Despair', description: 'When the target of your Silvery Barbs fails its roll from the reroll, give it vulnerability to one damage type of your choice until the start of your next turn.', source: { kind: 'subclass', refId: 'mage_of_silverquill' }, level: 14, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'free', resourceCost: null, range: '60 feet', target: 'single', requiresSave: null },
          abilityEffects: [] } },
        { kind: 'feature', value: { id: 'selfless_invocation', name: 'Word of Power: Selfless Invocation', description: 'When a creature within 60 feet takes damage, use your reaction to grant it resistance to that damage; you take psychic damage equal to the amount it resisted.', source: { kind: 'subclass', refId: 'mage_of_silverquill' }, level: 14, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'reaction', resourceCost: null, range: '60 feet', target: 'single', requiresSave: null },
          abilityEffects: [] } },
      ] },
  ],
};

export const BARD_SUBCLASSES: SubclassProgression[] = [
  loreCollegeProgression, valorCollegeProgression, creationCollegeProgression,
  eloquenceCollegeProgression, glamourCollegeProgression, spiritsCollegeProgression,
  swordsCollegeProgression, whispersCollegeProgression, creationCollegeUaProgression,
  satireCollegeProgression, spiritsCollegeUaProgression, mageOfLoreholdProgression,
  mageOfSilverquillProgression,
];
