// ============================================================================
// FILE: src/content/subclasses/rogue.ts
// Rogue subclasses: Thief, Assassin, Arcane Trickster, Inquisitive,
// Mastermind, Phantom, Scout, Soulknife, Swashbuckler
// ============================================================================
import { ClassProgression, ChoiceOption, Grant } from '../../engine/types';
import { THIRD_CASTER_SLOTS } from '../classes/spellSlotTables';
import { ALL_TOOLS } from '../tools';

export type SubclassProgression = ClassProgression & { name: string };

/** CHOICE-EXPANSION-2: same helper other content files use — restricts a
 * tool choice's pool to one or more canonical categories. */
function toolCategoryPool(...categories: string[]): ChoiceOption[] {
  return ALL_TOOLS.filter(t => categories.includes(t.category)).map(t => ({ id: t.id, label: t.name, value: t.id }));
}

// ── Thief ─────────────────────────────────────────────────────────────────────

export const thiefProgression: SubclassProgression = {
  classId: 'rogue',
  name: 'Thief',
  srd: true,
  entries: [
    {
      level: 3, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'fast_hands', name: 'Fast Hands', description: 'Use the bonus action granted by Cunning Action to make a Sleight of Hand check, use thieves\' tools, or take the Use an Object action.', source: { kind: 'subclass', refId: 'thief' }, level: 3, effects: [], actions: [], choices: [], passive: true } },
        { kind: 'feature', value: { id: 'second_story_work', name: 'Second-Story Work', description: 'Climbing costs no extra movement. When you make a running jump, add your DEX modifier to the distance covered.', source: { kind: 'subclass', refId: 'thief' }, level: 3, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    {
      level: 9, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'supreme_sneak', name: 'Supreme Sneak', description: 'Advantage on Stealth checks if you move no more than half your speed on the same turn.', source: { kind: 'subclass', refId: 'thief' }, level: 9, actions: [], choices: [], passive: true, effects: [{ type: 'stat_modifier', target: 'Stealth checks when you move no more than half your speed', operation: 'advantage', value: null, condition: null }] } },
      ],
    },
    {
      level: 13, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'use_magic_device', name: 'Use Magic Device', description: 'You can ignore all class, race, and level requirements on the use of magic items.', source: { kind: 'subclass', refId: 'thief' }, level: 13, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    {
      level: 17, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'thiefs_reflexes', name: 'Thief\'s Reflexes', description: 'Take two turns during the first round of combat. Take the first turn at normal initiative and the second at initiative minus 10.', source: { kind: 'subclass', refId: 'thief' }, level: 17, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
  ],
};

// ── Assassin ──────────────────────────────────────────────────────────────────

export const assassinProgression: SubclassProgression = {
  classId: 'rogue',
  name: 'Assassin',
  srd: false,
  entries: [
    {
      level: 3, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'assassinate', name: 'Assassinate', description: 'Advantage on attack rolls against creatures that haven\'t taken a turn yet. Any hit you score against a surprised creature is a critical hit (not automated — no crit mechanism in the engine, apply manually).', source: { kind: 'subclass', refId: 'assassin' }, level: 3, actions: [], choices: [], passive: true, effects: [{ type: 'stat_modifier', target: "attack rolls against creatures that haven't yet taken a turn in combat", operation: 'advantage', value: null, condition: null }] } },
        { kind: 'feature', value: { id: 'assassin_proficiencies', name: 'Bonus Proficiencies', description: 'Proficiency with disguise kit and poisoner\'s kit.', source: { kind: 'subclass', refId: 'assassin' }, level: 3, actions: [], choices: [], passive: true, effects: [
          { type: 'grant_proficiency', target: 'tool:disguise_kit', operation: 'add', value: null, condition: null },
          { type: 'grant_proficiency', target: 'tool:poisoners_kit', operation: 'add', value: null, condition: null },
        ] } },
      ],
    },
    {
      level: 9, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'infiltration_expertise', name: 'Infiltration Expertise', description: 'Spend 7 days and 25 gp to create a false identity with documentation, established acquaintances, and disguises.', source: { kind: 'subclass', refId: 'assassin' }, level: 9, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    {
      level: 13, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'impostor', name: 'Impostor', description: 'Unerringly mimic another person\'s speech, writing, and behavior after 3 hours of study.', source: { kind: 'subclass', refId: 'assassin' }, level: 13, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    {
      level: 17, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'death_strike', name: 'Death Strike', description: 'When you hit a surprised creature, it must succeed on a CON save (DC 8 + DEX mod + prof) or take double damage.', source: { kind: 'subclass', refId: 'assassin' }, level: 17, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
  ],
};

// ── Arcane Trickster ─────────────────────────────────────────────────────────
export const arcaneTricksterProgression: SubclassProgression = {
  classId: 'rogue', name: 'Arcane Trickster', srd: false,
  entries: [
    { level: 3, hpDie: 8, choices: [], grants: [
      { kind: 'init_spellcasting', value: { ability: 'int' } } as Grant,
      { kind: 'spell_slots', value: { level: 3, slotsTable: THIRD_CASTER_SLOTS } } as Grant,
      { kind: 'feature', value: { id: 'at_spellcasting', name: 'Spellcasting', description: 'You learn Mage Hand plus two other wizard cantrips (a third at level 10), and a small number of wizard spells (mostly enchantment and illusion), using INT as your spellcasting ability.', source: { kind: 'subclass', refId: 'arcane_trickster' }, level: 3, effects: [
        { type: 'grant_spell', target: 'cantrip', operation: 'add', value: null, condition: null, cantripIds: ['mage_hand'] },
      ], actions: [], choices: [], passive: true } },
      { kind: 'feature', value: { id: 'mage_hand_legerdemain', name: 'Mage Hand Legerdemain', description: 'When you cast Mage Hand, the spectral hand can be invisible, stow or retrieve an object in a container another creature wears or carries, and use thieves\' tools to pick locks or disarm traps at range — undetected on a Sleight of Hand check contested by the target\'s Perception. Control the hand with your Cunning Action bonus action.', source: { kind: 'subclass', refId: 'arcane_trickster' }, level: 3, effects: [], actions: [], choices: [], passive: true } },
    ] },
    { level: 7, hpDie: 8, choices: [], grants: [{ kind: 'spell_slots', value: { level: 7, slotsTable: THIRD_CASTER_SLOTS } } as Grant] },
    { level: 9, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'magical_ambush', name: 'Magical Ambush', description: 'If you\'re hidden from a creature when you cast a spell on it, it has disadvantage on any saving throw against the spell this turn.', source: { kind: 'subclass', refId: 'arcane_trickster' }, level: 9, effects: [], actions: [], choices: [], passive: true } }] },
    { level: 10, hpDie: 8, choices: [], grants: [{ kind: 'spell_slots', value: { level: 10, slotsTable: THIRD_CASTER_SLOTS } } as Grant] },
    { level: 13, hpDie: 8, choices: [], grants: [
      { kind: 'spell_slots', value: { level: 13, slotsTable: THIRD_CASTER_SLOTS } } as Grant,
      { kind: 'feature', value: { id: 'versatile_trickster', name: 'Versatile Trickster', description: 'As a bonus action, designate a creature within 5 feet of your Mage Hand: gain advantage on attack rolls against it until the end of the turn.', source: { kind: 'subclass', refId: 'arcane_trickster' }, level: 13, effects: [], actions: [], choices: [], passive: false,
        activation: { actionType: 'bonus_action', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
        abilityEffects: [] } },
    ] },
    { level: 15, hpDie: 8, choices: [], grants: [{ kind: 'spell_slots', value: { level: 15, slotsTable: THIRD_CASTER_SLOTS } } as Grant] },
    { level: 16, hpDie: 8, choices: [], grants: [{ kind: 'spell_slots', value: { level: 16, slotsTable: THIRD_CASTER_SLOTS } } as Grant] },
    { level: 17, hpDie: 8, choices: [],
      grants: [
        { kind: 'resource', value: { resourceId: 'spell_thief_pool', name: 'Spell Thief', maximum: 1, recharge: 'long_rest' } },
        { kind: 'feature', value: { id: 'spell_thief', name: 'Spell Thief', description: 'Immediately after a creature targets you with a spell, use your reaction to force a save with its own spellcasting ability modifier (represented here as an INT save against your spell save DC — the target\'s actual casting stat varies and can\'t be looked up at content-authoring time) against your spell save DC. On a failure, you negate the spell against you and, if it\'s 1st level or higher and one you can cast, learn and can cast it for 8 hours (the creature can\'t cast it during that time). Usable once per long rest.', source: { kind: 'subclass', refId: 'arcane_trickster' }, level: 17, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'reaction', resourceCost: { resourceId: 'spell_thief_pool', quantity: 1 }, range: 'self', target: 'self', requiresSave: { ability: 'int', dc: 'spell_save_dc' } },
          abilityEffects: [] } },
      ] },
    { level: 18, hpDie: 8, choices: [], grants: [{ kind: 'spell_slots', value: { level: 18, slotsTable: THIRD_CASTER_SLOTS } } as Grant] },
    { level: 19, hpDie: 8, choices: [], grants: [{ kind: 'spell_slots', value: { level: 19, slotsTable: THIRD_CASTER_SLOTS } } as Grant] },
    { level: 20, hpDie: 8, choices: [], grants: [{ kind: 'spell_slots', value: { level: 20, slotsTable: THIRD_CASTER_SLOTS } } as Grant] },
  ],
};

// ── Inquisitive ──────────────────────────────────────────────────────────────
export const inquisitiveProgression: SubclassProgression = {
  classId: 'rogue', name: 'Inquisitive', srd: false,
  entries: [
    { level: 3, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'ear_for_deceit', name: 'Ear for Deceit', description: 'On a Wisdom (Insight) check to tell whether someone is lying, treat a d20 roll of 7 or lower as an 8.', source: { kind: 'subclass', refId: 'inquisitive' }, level: 3, effects: [], actions: [], choices: [], passive: true } },
        { kind: 'feature', value: { id: 'eye_for_detail', name: 'Eye for Detail', description: 'Use a bonus action to make a Wisdom (Perception) check to spot a hidden creature or object, or an Intelligence (Investigation) check to uncover or decipher clues.', source: { kind: 'subclass', refId: 'inquisitive' }, level: 3, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'bonus_action', resourceCost: null, range: 'self', target: 'self', requiresSave: null },
          abilityEffects: [] } },
        { kind: 'feature', value: { id: 'insightful_fighting', name: 'Insightful Fighting', description: 'As a bonus action, make a Wisdom (Insight) check contested by a visible, non-incapacitated creature\'s Charisma (Deception) check. On a success, you can use Sneak Attack against that target even without advantage (but not with disadvantage), for 1 minute or until you use this again against a different target.', source: { kind: 'subclass', refId: 'inquisitive' }, level: 3, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'bonus_action', resourceCost: null, range: '30 feet', target: 'single', requiresSave: null },
          abilityEffects: [] } },
      ] },
    { level: 9, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'steady_eye', name: 'Steady Eye', description: 'You have advantage on Wisdom (Perception) or Intelligence (Investigation) checks if you move no more than half your speed on the same turn.', source: { kind: 'subclass', refId: 'inquisitive' }, level: 9, effects: [
      { type: 'stat_modifier', target: 'Wisdom (Perception) and Intelligence (Investigation) checks when you move no more than half your speed', operation: 'advantage', value: null, condition: null },
    ], actions: [], choices: [], passive: true } }] },
    { level: 13, hpDie: 8, choices: [],
      grants: [
        { kind: 'resource', value: { resourceId: 'unerring_eye_pool', name: 'Unerring Eye (scales with Wisdom modifier)', maximum: 1, recharge: 'long_rest' } },
        { kind: 'feature', value: { id: 'unerring_eye', name: 'Unerring Eye', description: 'As an action, sense the presence of illusions, out-of-form shapechangers, and other sense-deceiving magic within 30 feet (you sense that something is off, not what it is), provided you aren\'t blinded or deafened. Usable a number of times equal to your Wisdom modifier (minimum once) per long rest — tracked here as a single-use pool; increase its maximum to match.', source: { kind: 'subclass', refId: 'inquisitive' }, level: 13, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'action', resourceCost: { resourceId: 'unerring_eye_pool', quantity: 1 }, range: '30 feet', target: 'self', requiresSave: null },
          abilityEffects: [] } },
      ] },
    { level: 17, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'eye_for_weakness', name: 'Eye for Weakness', description: 'While Insightful Fighting applies to a creature, your Sneak Attack damage against it increases by 3d6.', source: { kind: 'subclass', refId: 'inquisitive' }, level: 17, effects: [], actions: [], choices: [], passive: true } }] },
  ],
};

// ── Mastermind ───────────────────────────────────────────────────────────────
export const mastermindProgression: SubclassProgression = {
  classId: 'rogue', name: 'Mastermind', srd: false,
  entries: [
    { level: 3, hpDie: 8,
      // CHOICE-EXPANSION-2: "one gaming set of your choice" and "learn two
      // languages of your choice" were previously entirely unmodeled — the
      // fixed disguise kit/forgery kit grants below are untouched.
      choices: [
        { id: 'mastermind_gaming_set_3', prompt: 'Choose one gaming set.', kind: 'tool', count: 1, pool: toolCategoryPool('gaming_set'), grants: [], required: true, resolved: false },
        { id: 'mastermind_languages_3', prompt: 'Choose two languages.', kind: 'language', count: 2, pool: 'all', grants: [], required: true, resolved: false },
      ],
      grants: [
        { kind: 'feature', value: { id: 'master_of_intrigue', name: 'Master of Intrigue', description: 'Gain proficiency with the disguise kit, the forgery kit, and one gaming set of your choice, and learn two languages of your choice. After hearing a creature speak for at least 1 minute, unerringly mimic its speech patterns and accent (if you know the language).', source: { kind: 'subclass', refId: 'mastermind' }, level: 3, effects: [
          { type: 'grant_proficiency', target: 'tool:disguise_kit', operation: 'add', value: null, condition: null },
          { type: 'grant_proficiency', target: 'tool:forgery_kit', operation: 'add', value: null, condition: null },
        ], actions: [], choices: [], passive: true } },
        { kind: 'feature', value: { id: 'master_of_tactics', name: 'Master of Tactics', description: 'Use the Help action as a bonus action. When you Help an ally attack a creature, the target of that attack can be within 30 feet of you (instead of 5 feet) if it can see or hear you.', source: { kind: 'subclass', refId: 'mastermind' }, level: 3, effects: [], actions: [], choices: [], passive: true } },
      ] },
    { level: 9, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'insightful_manipulator', name: 'Insightful Manipulator', description: 'After spending at least 1 minute observing or interacting with a creature outside combat, learn whether it\'s your equal, superior, or inferior in two of: Intelligence, Wisdom, Charisma, or class levels.', source: { kind: 'subclass', refId: 'mastermind' }, level: 9, effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'action', resourceCost: null, range: '30 feet', target: 'single', requiresSave: null },
      abilityEffects: [] } }] },
    { level: 13, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'misdirection', name: 'Misdirection', description: 'When you\'re targeted by an attack while a creature within 5 feet grants you cover against it, use your reaction to redirect the attack to that creature instead.', source: { kind: 'subclass', refId: 'mastermind' }, level: 13, effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'reaction', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
      abilityEffects: [] } }] },
    { level: 17, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'soul_of_deceit', name: 'Soul of Deceit', description: 'Your thoughts can\'t be read by telepathy or other means unless you allow it, and you can present false thoughts (contested Deception vs. Insight). Truth-detecting magic reports whatever you choose, and you can\'t be magically compelled to tell the truth.', source: { kind: 'subclass', refId: 'mastermind' }, level: 17, effects: [], actions: [], choices: [], passive: true } }] },
  ],
};

// ── Phantom ──────────────────────────────────────────────────────────────────
export const phantomProgression: SubclassProgression = {
  classId: 'rogue', name: 'Phantom', srd: false,
  entries: [
    { level: 3, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'whispers_of_the_dead', name: 'Whispers of the Dead', description: 'At the end of a short or long rest, gain one skill or tool proficiency of your choice, granted by a ghostly presence; you lose it if you use this feature again to pick something else.', source: { kind: 'subclass', refId: 'phantom' }, level: 3, effects: [], actions: [], choices: [], passive: true } },
        { kind: 'resource', value: { resourceId: 'wails_grave_pool', name: 'Wails from the Grave (scales with proficiency bonus)', maximum: 1, recharge: 'long_rest' } },
        { kind: 'feature', value: { id: 'wails_from_the_grave', name: 'Wails from the Grave', description: 'Immediately after you deal Sneak Attack damage, target a second creature within 30 feet of the first; it takes necrotic damage equal to half your Sneak Attack dice (rounded up). Usable a number of times equal to your proficiency bonus per long rest — tracked here as a single-use pool; increase its maximum to match.', source: { kind: 'subclass', refId: 'phantom' }, level: 3, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'free', resourceCost: { resourceId: 'wails_grave_pool', quantity: 1 }, range: '30 feet', target: 'single', requiresSave: null },
          abilityEffects: [{ type: 'damage', dice: '1d6', damageType: 'necrotic' }] } },
      ] },
    { level: 9, hpDie: 8, choices: [],
      grants: [
        { kind: 'resource', value: { resourceId: 'soul_trinket_pool', name: 'Soul Trinkets (max scales with proficiency bonus)', maximum: 1, recharge: 'never' } },
        { kind: 'feature', value: { id: 'tokens_of_the_departed', name: 'Tokens of the Departed', description: 'When a creature you can see dies within 30 feet, use your reaction to snatch a soul trinket from it. You can hold a number equal to your proficiency bonus. While carrying one, you have advantage on death saves and Constitution saves; you can destroy one to fuel a free use of Wails from the Grave on a Sneak Attack hit, or as an action to ask its spirit one question.', source: { kind: 'subclass', refId: 'phantom' }, level: 9, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'reaction', resourceCost: null, range: '30 feet', target: 'self', requiresSave: null },
          abilityEffects: [{ type: 'restore_resource', resourceId: 'soul_trinket_pool', amount: 1 }] } },
      ] },
    { level: 13, hpDie: 8, choices: [],
      grants: [
        { kind: 'resource', value: { resourceId: 'ghost_walk_pool', name: 'Ghost Walk', maximum: 1, recharge: 'long_rest' } },
        { kind: 'feature', value: { id: 'ghost_walk', name: 'Ghost Walk', description: 'As a bonus action, assume a spectral form for 10 minutes: gain a 10-foot flying speed with hover, attacks against you have disadvantage, and you can move through creatures and objects as difficult terrain (taking 1d10 force damage if you end your turn inside one). Usable once per long rest, or again by destroying a soul trinket.', source: { kind: 'subclass', refId: 'phantom' }, level: 13, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'bonus_action', resourceCost: { resourceId: 'ghost_walk_pool', quantity: 1 }, range: 'self', target: 'self', requiresSave: null },
          abilityEffects: [{ type: 'grant_speed', speedType: 'fly', amount: 10, duration: { unit: 'minutes', remaining: 10 } }] } },
      ] },
    { level: 17, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'deaths_friend', name: "Death's Friend", description: 'Wails from the Grave now damages both the first and second creature, and a soul trinket appears in your hand at the end of a long rest if you have none.', source: { kind: 'subclass', refId: 'phantom' }, level: 17, effects: [], actions: [], choices: [], passive: true } }] },
  ],
};

// ── Scout ────────────────────────────────────────────────────────────────────
export const scoutProgression: SubclassProgression = {
  classId: 'rogue', name: 'Scout', srd: false,
  entries: [
    { level: 3, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'skirmisher', name: 'Skirmisher', description: 'When an enemy ends its turn within 5 feet of you, use your reaction to move up to half your speed without provoking opportunity attacks.', source: { kind: 'subclass', refId: 'scout' }, level: 3, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'reaction', resourceCost: null, range: '5 feet', target: 'self', requiresSave: null },
          abilityEffects: [] } },
        { kind: 'feature', value: { id: 'survivalist', name: 'Survivalist', description: 'Gain proficiency in Nature and Survival if you don\'t already have them, and double your proficiency bonus on checks using either. No expertise-style doubling operation exists on stat_modifier — apply the doubled bonus manually.', source: { kind: 'subclass', refId: 'scout' }, level: 3, effects: [
          { type: 'grant_proficiency', target: 'skill:nature', operation: 'add', value: null, condition: null },
          { type: 'grant_proficiency', target: 'skill:survival', operation: 'add', value: null, condition: null },
        ], actions: [], choices: [], passive: true } },
      ] },
    { level: 9, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'superior_mobility', name: 'Superior Mobility', description: 'Your walking speed increases by 10 feet; if you have a climbing or swimming speed, it increases too. Only the base walking-speed hook is wired — apply the climb/swim bonus manually.', source: { kind: 'subclass', refId: 'scout' }, level: 9, effects: [
      { type: 'stat_modifier', target: 'speed', operation: 'add', value: 10, condition: null },
    ], actions: [], choices: [], passive: true } }] },
    { level: 13, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'ambush_master', name: 'Ambush Master', description: 'You have advantage on initiative rolls. Additionally, the first creature you hit in the first round of combat has attack rolls made against it (by anyone) with advantage until the start of your next turn.', source: { kind: 'subclass', refId: 'scout' }, level: 13, effects: [
      { type: 'stat_modifier', target: 'initiative', operation: 'advantage', value: null, condition: null },
    ], actions: [], choices: [], passive: true } }] },
    { level: 17, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'sudden_strike', name: 'Sudden Strike', description: 'If you take the Attack action, make one additional attack as a bonus action. It can benefit from Sneak Attack even if already used this turn, but you can\'t apply Sneak Attack to the same target twice in a turn.', source: { kind: 'subclass', refId: 'scout' }, level: 17, effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'bonus_action', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
      abilityEffects: [] } }] },
  ],
};

// ── Soulknife ────────────────────────────────────────────────────────────────
export const soulknifeProgression: SubclassProgression = {
  classId: 'rogue', name: 'Soulknife', srd: false,
  entries: [
    { level: 3, hpDie: 8, choices: [],
      grants: [
        { kind: 'resource', value: { resourceId: 'psionic_energy_dice_soulknife_pool', name: 'Psionic Energy Dice (d6, upgrading to d8 at 5, d10 at 11, d12 at 17; count equals twice your proficiency bonus)', maximum: 4, recharge: 'long_rest' } },
        { kind: 'feature', value: { id: 'psi_bolstered_knack', name: 'Psi-Bolstered Knack', description: 'If you fail an ability check using a skill or tool you\'re proficient with, roll a Psionic Energy die and add it to the check (expending the die only if it turns the check into a success).', source: { kind: 'subclass', refId: 'soulknife' }, level: 3, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'free', resourceCost: { resourceId: 'psionic_energy_dice_soulknife_pool', quantity: 1 }, range: 'self', target: 'self', requiresSave: null },
          abilityEffects: [] } },
        { kind: 'feature', value: { id: 'psychic_whispers', name: 'Psychic Whispers', description: 'As an action, choose creatures you can see up to your proficiency bonus and roll a Psionic Energy die; for that many hours, you and they can speak telepathically within 1 mile. The first use after a long rest doesn\'t expend the die.', source: { kind: 'subclass', refId: 'soulknife' }, level: 3, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'action', resourceCost: { resourceId: 'psionic_energy_dice_soulknife_pool', quantity: 1 }, range: '1 mile', target: 'multiple', requiresSave: null },
          abilityEffects: [] } },
        { kind: 'feature', value: { id: 'psychic_blades', name: 'Psychic Blades', description: 'When you take the Attack action, manifest a psychic blade (finesse, thrown, 60-foot range, no long range) and attack with it, dealing 1d6 plus your ability modifier psychic damage on a hit. It vanishes after the attack, leaving no mark.', source: { kind: 'subclass', refId: 'soulknife' }, level: 3, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'free', resourceCost: null, range: '60 feet', target: 'single', requiresSave: null },
          abilityEffects: [{ type: 'damage', dice: '1d6', damageType: 'psychic' }] } },
        { kind: 'feature', value: { id: 'psychic_blades_bonus', name: 'Psychic Blades: Bonus Blade', description: 'After attacking with a psychic blade, make a second melee or ranged attack with another as a bonus action (if your other hand is free), dealing 1d4 plus your ability modifier psychic damage.', source: { kind: 'subclass', refId: 'soulknife' }, level: 3, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'bonus_action', resourceCost: null, range: '60 feet', target: 'single', requiresSave: null },
          abilityEffects: [{ type: 'damage', dice: '1d4', damageType: 'psychic' }] } },
      ] },
    { level: 9, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'homing_strikes', name: 'Homing Strikes', description: 'If you miss with a Psychic Blades attack, roll a Psionic Energy die and add it to the attack roll (expending the die only if it turns the attack into a hit).', source: { kind: 'subclass', refId: 'soulknife' }, level: 9, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'free', resourceCost: { resourceId: 'psionic_energy_dice_soulknife_pool', quantity: 1 }, range: '60 feet', target: 'self', requiresSave: null },
          abilityEffects: [] } },
        { kind: 'feature', value: { id: 'psychic_teleportation', name: 'Psychic Teleportation', description: 'As a bonus action, manifest and throw a psychic blade to an unoccupied space you can see up to 10 feet times a rolled Psionic Energy die away, then teleport there yourself.', source: { kind: 'subclass', refId: 'soulknife' }, level: 9, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'bonus_action', resourceCost: { resourceId: 'psionic_energy_dice_soulknife_pool', quantity: 1 }, range: '120 feet', target: 'self', requiresSave: null },
          abilityEffects: [] } },
      ] },
    { level: 13, hpDie: 8, choices: [],
      grants: [
        { kind: 'resource', value: { resourceId: 'psychic_veil_pool', name: 'Psychic Veil', maximum: 1, recharge: 'long_rest' } },
        { kind: 'feature', value: { id: 'psychic_veil', name: 'Psychic Veil', description: 'As an action, become invisible (with your gear) for 1 hour or until you dismiss it, ending early the instant you damage a creature or force a save. Usable once per long rest, or again by spending a Psionic Energy die.', source: { kind: 'subclass', refId: 'soulknife' }, level: 13, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'action', resourceCost: { resourceId: 'psychic_veil_pool', quantity: 1 }, range: 'self', target: 'self', requiresSave: null },
          abilityEffects: [{ type: 'apply_condition', conditionId: 'invisible', duration: { unit: 'hours', remaining: 1 } }] } },
      ] },
    { level: 17, hpDie: 8, choices: [],
      grants: [
        { kind: 'resource', value: { resourceId: 'rend_mind_pool', name: 'Rend Mind', maximum: 1, recharge: 'long_rest' } },
        { kind: 'feature', value: { id: 'rend_mind', name: 'Rend Mind', description: 'When you deal Sneak Attack damage with your Psychic Blades, force a Wisdom save (DC 8 + proficiency bonus + DEX modifier — no formula slot for a non-spellcasting DC, stated here instead) or stun the target for 1 minute, repeatable at the end of its turns. Usable once per long rest, or again by spending 3 Psionic Energy dice.', source: { kind: 'subclass', refId: 'soulknife' }, level: 17, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'free', resourceCost: { resourceId: 'rend_mind_pool', quantity: 1 }, range: '60 feet', target: 'single', requiresSave: null },
          abilityEffects: [{ type: 'apply_condition', conditionId: 'stunned', duration: { unit: 'minutes', remaining: 1 } }] } },
      ] },
  ],
};

// ── Swashbuckler ─────────────────────────────────────────────────────────────
export const swashbucklerProgression: SubclassProgression = {
  classId: 'rogue', name: 'Swashbuckler', srd: false,
  entries: [
    { level: 3, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'fancy_footwork', name: 'Fancy Footwork', description: 'If you make a melee attack against a creature on your turn, it can\'t make opportunity attacks against you for the rest of the turn.', source: { kind: 'subclass', refId: 'swashbuckler' }, level: 3, effects: [], actions: [], choices: [], passive: true } },
        { kind: 'feature', value: { id: 'rakish_audacity', name: 'Rakish Audacity', description: 'Add your Charisma modifier to initiative rolls. You can also use Sneak Attack without advantage against a creature within 5 feet, provided no other creature is within 5 feet of you and you don\'t have disadvantage. No formula slot exists for a CHA-based initiative bonus — apply manually.', source: { kind: 'subclass', refId: 'swashbuckler' }, level: 3, effects: [], actions: [], choices: [], passive: true } },
      ] },
    { level: 9, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'panache', name: 'Panache', description: 'As an action, make a Charisma (Persuasion) check contested by a creature\'s Wisdom (Insight) check (it must hear and share a language with you). On a success against a hostile creature, it has disadvantage attacking others and can\'t make opportunity attacks against others for 1 minute (broken by your allies harming it, or 60+ feet of separation); on a success against a non-hostile creature, it\'s charmed by you for 1 minute instead.', source: { kind: 'subclass', refId: 'swashbuckler' }, level: 9, effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'action', resourceCost: null, range: '30 feet', target: 'single', requiresSave: null },
      abilityEffects: [] } }] },
    { level: 13, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'elegant_maneuver', name: 'Elegant Maneuver', description: 'As a bonus action, gain advantage on the next Dexterity (Acrobatics) or Strength (Athletics) check you make this turn.', source: { kind: 'subclass', refId: 'swashbuckler' }, level: 13, effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'bonus_action', resourceCost: null, range: 'self', target: 'self', requiresSave: null },
      abilityEffects: [] } }] },
    { level: 17, hpDie: 8, choices: [],
      grants: [
        { kind: 'resource', value: { resourceId: 'master_duelist_pool', name: 'Master Duelist', maximum: 1, recharge: 'short_rest' } },
        { kind: 'feature', value: { id: 'master_duelist', name: 'Master Duelist', description: 'If you miss with an attack roll, reroll it with advantage. Usable once per short or long rest.', source: { kind: 'subclass', refId: 'swashbuckler' }, level: 17, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'free', resourceCost: { resourceId: 'master_duelist_pool', quantity: 1 }, range: 'self', target: 'self', requiresSave: null },
          abilityEffects: [] } },
      ] },
  ],
};

export const ROGUE_SUBCLASSES: SubclassProgression[] = [
  thiefProgression, assassinProgression, arcaneTricksterProgression, inquisitiveProgression,
  mastermindProgression, phantomProgression, scoutProgression, soulknifeProgression,
  swashbucklerProgression,
];
