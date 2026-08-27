// ============================================================================
// FILE: src/content/subclasses/bard.ts
// Bard subclasses: College of Lore, College of Valor, College of Creation,
// College of Eloquence, College of Glamour, College of Spirits,
// College of Swords, College of Whispers
// ============================================================================
import { ClassProgression, ChoiceOption, Feature } from '../../engine/types';

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

export const BARD_SUBCLASSES: SubclassProgression[] = [
  loreCollegeProgression, valorCollegeProgression, creationCollegeProgression,
  eloquenceCollegeProgression, glamourCollegeProgression, spiritsCollegeProgression,
  swordsCollegeProgression, whispersCollegeProgression,
];
