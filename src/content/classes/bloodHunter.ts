// ============================================================================
// FILE: src/content/classes/bloodHunter.ts
// Blood Hunter — a third-party base class (Matthew Mercer / Critical Role,
// widely distributed via D&D Beyond) never published by Wizards of the
// Coast. Registered as built-in homebrew (see builtinHomebrew.ts), the same
// pattern already used for Abyss Knight — NOT part of ALL_CLASS_PROGRESSIONS,
// so it never appears as an "official" class and is excluded from any
// SRD-only filtering the same way user homebrew is.
//
// This file is the BASE CLASS ONLY. The four Blood Hunter Orders
// (Ghostslayer, Lycan, Mutant, Profane Soul) are a separate, later batch —
// Blood Hunter Order is wired here as a `kind: 'subclass'` choice at level 3
// exactly like every official class's subclass choice, so the orders will
// slot in the same way once authored.
//
// Blood Curses: Blood Maledict's known-curse pool below has the 8 curses
// with no order/level prerequisite. The 4 order-locked curses (Corrosion —
// Mutant, Exorcist — Ghostslayer, Howl — Lycan, Soul Eater — Profane Soul)
// will be added to BLOOD_CURSE_POOL when each order is authored, since they
// can't be selected before the character actually has that order anyway.
//
// Hemocraft die: the class's core scaling die (1d4 at levels 1-4, 1d6 at
// 5-9, 1d8 at 10-13, 1d10 at 14+) has no level-scaling dice-string generator
// in this engine (same disclosed gap as Martial Arts/Sneak Attack elsewhere)
// — abilityEffects below use the base 1d4, with each feature's description
// noting how it scales.
// ============================================================================
import { ChoiceDefinition, ChoiceOption, ClassProgression, Feature } from '../../engine/types';

function asiChoice(id: string): ChoiceDefinition {
  return {
    id, prompt: 'Choose an Ability Score Increase (+2 to one or +1 to two) or a Feat.',
    kind: 'asi', count: 1, pool: 'all', grants: [], required: true, resolved: false,
  };
}

function equipmentChoice(
  id: string, prompt: string,
  options: { id: string; label: string; items: string[] }[],
): ChoiceDefinition {
  return {
    id, prompt, kind: 'equipment', count: 1,
    pool: options.map(o => ({ id: o.id, label: o.label, value: o.items })),
    grants: [], required: true, resolved: false,
  };
}

const bloodHunterSkillChoice: ChoiceDefinition = {
  id: 'blood_hunter_skills_lvl_1',
  prompt: 'Choose 3 skills from: Acrobatics, Arcana, Athletics, History, Insight, Investigation, Religion, Survival.',
  kind: 'skill', count: 3,
  pool: [
    { id: 'acrobatics',     label: 'Acrobatics',     value: 'acrobatics' },
    { id: 'arcana',         label: 'Arcana',         value: 'arcana' },
    { id: 'athletics',      label: 'Athletics',      value: 'athletics' },
    { id: 'history',        label: 'History',        value: 'history' },
    { id: 'insight',        label: 'Insight',        value: 'insight' },
    { id: 'investigation',  label: 'Investigation',  value: 'investigation' },
    { id: 'religion',       label: 'Religion',       value: 'religion' },
    { id: 'survival',       label: 'Survival',       value: 'survival' },
  ],
  grants: [], required: true, resolved: false,
};

const bloodHunterEquipChoices: ChoiceDefinition[] = [
  // STARTING-EQUIPMENT-1: previously hardcoded ONE example weapon per
  // option ("Longsword" / "2 Daggers") as if it were the only legal pick,
  // when the actual rule is "any martial weapon" / "any two simple
  // weapons." Rebuilt as exact_options with a nested itemFilter per
  // option, same pattern used for Fighter's equivalent choice.
  {
    id: 'blood_hunter_equip_a', prompt: 'Choose a weapon: (a) a martial weapon or (b) two simple weapons',
    kind: 'equipment', count: 1, grants: [], required: true, resolved: false,
    equipmentStyle: 'exact_options', equipmentGroup: 'Weapons',
    pool: [
      { id: 'martial', label: 'A martial weapon', value: [], itemFilter: { constraint: { category: 'weapon', weaponClass: 'martial' }, quantity: 1 } },
      { id: 'simple',  label: 'Two simple weapons', value: [], itemFilter: { constraint: { category: 'weapon', weaponClass: 'simple' }, quantity: 2 } },
    ],
  },
  {
    ...equipmentChoice('blood_hunter_equip_b', 'Choose: (a) a light crossbow and 20 bolts or (b) a hand crossbow and 20 bolts', [
      { id: 'light_crossbow', label: 'Light Crossbow & 20 bolts', items: ['light_crossbow', 'bolts_20'] },
      { id: 'hand_crossbow',  label: 'Hand Crossbow & 20 bolts',  items: ['hand_crossbow', 'bolts_20'] },
    ]),
    equipmentGroup: 'Ranged Weapon',
  },
  {
    ...equipmentChoice('blood_hunter_equip_c', 'Choose armor: (a) studded leather or (b) scale mail', [
      { id: 'studded_leather', label: 'Studded Leather', items: ['studded_leather'] },
      { id: 'scale_mail',      label: 'Scale Mail',      items: ['scale_mail'] },
    ]),
    equipmentGroup: 'Armor',
  },
  {
    ...equipmentChoice('blood_hunter_equip_d', "You start with an explorer's pack and alchemist's supplies", [
      { id: 'pack', label: "Explorer's Pack + Alchemist's Supplies", items: ['explorers_pack', 'alchemist_s_supplies'] },
    ]),
    equipmentStyle: 'bundle_options', equipmentGroup: 'Pack',
  },
];

// ── Blood Maledict: Amplify (universal, applies to any curse below) ─────────
function amplifyFeature(): Feature {
  return {
    id: 'blood_maledict_amplify', name: 'Blood Maledict: Amplify',
    description: 'While invoking a Blood Curse, before it affects the target, you can amplify it by taking necrotic damage equal to a roll of your hemocraft die (this damage can\'t be reduced in any way). An amplified curse gains the additional effect noted in its own description. Creatures without blood are immune to a curse unless it\'s amplified.',
    source: { kind: 'class', refId: 'blood_hunter' },
    level: null, effects: [], actions: [], choices: [], passive: false,
    activation: { actionType: 'free', resourceCost: null, range: 'self', target: 'self', requiresSave: null },
    abilityEffects: [{ type: 'damage', dice: '1d4', damageType: 'necrotic' }],
  };
}

// ── Blood Curses (Blood Maledict known-curse pool) ──────────────────────────
function bloodCurse(
  id: string, name: string, description: string,
  actionType: 'bonus_action' | 'reaction',
  requiresSave: { ability: import('../../engine/types').Ability; dc: 'spell_save_dc' | number } | null = null,
  abilityEffects: Feature['abilityEffects'] = [],
): Feature {
  return {
    id, name, description,
    source: { kind: 'class', refId: 'blood_hunter' },
    level: null, effects: [], actions: [], choices: [], passive: false,
    activation: { actionType, resourceCost: { resourceId: 'blood_maledict_pool', quantity: 1 }, range: '30 feet', target: 'single', requiresSave },
    abilityEffects,
  };
}

export const BLOOD_CURSE_POOL: ChoiceOption[] = [
  { id: 'anxious', label: 'Blood Curse of the Anxious', value: bloodCurse(
    'curse_anxious', 'Blood Curse of the Anxious',
    'As a bonus action, target a creature within 30 feet: until the end of your next turn, Charisma (Intimidation) checks made against it have advantage. Amplify: the next Wisdom save it makes before this curse ends has disadvantage.',
    'bonus_action',
  ) },
  { id: 'binding', label: 'Blood Curse of Binding', value: bloodCurse(
    'curse_binding', 'Blood Curse of Binding',
    'As a bonus action, target a Large or smaller creature within 30 feet with a Strength save against your hemocraft save DC (8 + proficiency bonus + Hemocraft modifier — no formula slot exists for a non-spellcaster save DC, so requiresSave is omitted here); on a failure its speed is reduced to 0 and it can\'t take reactions until the end of your next turn. Amplify: lasts 1 minute, affects any size, and the target repeats the save each turn to end it early.',
    'bonus_action', null,
  ) },
  { id: 'bloated_agony', label: 'Blood Curse of Bloated Agony', value: bloodCurse(
    'curse_bloated_agony', 'Blood Curse of Bloated Agony',
    'As a bonus action, curse a creature within 30 feet until the end of your next turn: it has disadvantage on Strength and Dexterity checks, and takes 1d8 necrotic damage if it makes more than one attack on its turn (apply that conditional damage manually). Amplify: lasts 1 minute, with a Constitution save each turn to end it early.',
    'bonus_action', null, [{ type: 'damage', dice: '1d8', damageType: 'necrotic' }],
  ) },
  { id: 'exposure', label: 'Blood Curse of Exposure', value: bloodCurse(
    'curse_exposure', 'Blood Curse of Exposure',
    'When a creature within 30 feet takes damage from an attack or spell, use your reaction to strip its resistance to all damage types dealt by that attack or spell until the end of its next turn (including the triggering damage). Amplify: strips invulnerability instead, replacing it with resistance until the end of its next turn.',
    'reaction',
  ) },
  { id: 'eyeless', label: 'Blood Curse of the Eyeless', value: bloodCurse(
    'curse_eyeless', 'Blood Curse of the Eyeless',
    'When a creature within 30 feet makes an attack, use your reaction (after the roll, before the result is known) to roll your hemocraft die and subtract it from that attack roll. Immune to creatures immune to blinded. Amplify: applies to every attack the creature makes until the end of its turn, rolled separately.',
    'reaction',
  ) },
  { id: 'fallen_puppet', label: 'Blood Curse of the Fallen Puppet', value: bloodCurse(
    'curse_fallen_puppet', 'Blood Curse of the Fallen Puppet',
    'When a creature within 30 feet drops to 0 hit points, use your reaction to make it immediately take one weapon attack against a target of your choice in its range. Amplify: it can first move up to half its speed, and gains a bonus to the attack roll equal to your Hemocraft modifier (minimum +1).',
    'reaction',
  ) },
  { id: 'marked', label: 'Blood Curse of the Marked', value: bloodCurse(
    'curse_marked', 'Blood Curse of the Marked',
    'As a bonus action, mark a creature within 30 feet: until the end of your turn, whenever you hit it with a weapon carrying an active Crimson Rite, roll an additional hemocraft die for the rite\'s extra damage. Amplify: your next attack roll against it before the end of your turn has advantage.',
    'bonus_action',
  ) },
  { id: 'muddled_mind', label: 'Blood Curse of the Muddled Mind', value: bloodCurse(
    'curse_muddled_mind', 'Blood Curse of the Muddled Mind',
    'As a bonus action, curse a concentrating creature within 30 feet: its next Constitution save to maintain concentration before the end of your next turn has disadvantage. Amplify: every concentration save it makes has disadvantage until the end of your next turn.',
    'bonus_action',
  ) },
];

// ── Fighting Style ────────────────────────────────────────────────────────
const FIGHTING_STYLE_POOL: ChoiceOption[] = [
  { id: 'archery', label: 'Archery', value: { id: 'fighting_style_archery', name: 'Fighting Style: Archery', description: 'Gain a +2 bonus to attack rolls you make with ranged weapons. No attack-roll-bonus hook exists in the engine — apply manually.', source: { kind: 'class', refId: 'blood_hunter' }, level: null, effects: [], actions: [], choices: [], passive: true } as Feature },
  { id: 'dueling', label: 'Dueling', value: { id: 'fighting_style_dueling_bh', name: 'Fighting Style: Dueling', description: 'While wielding a melee weapon in one hand and no other weapon, gain a +2 bonus to damage rolls with that weapon. No stat_modifier hook exists for this yet — apply manually.', source: { kind: 'class', refId: 'blood_hunter' }, level: null, effects: [], actions: [], choices: [], passive: true } as Feature },
  { id: 'great_weapon_fighting', label: 'Great Weapon Fighting', value: { id: 'fighting_style_great_weapon', name: 'Fighting Style: Great Weapon Fighting', description: 'When you roll a 1 or 2 on a non-rite damage die for a two-handed or versatile melee weapon you\'re wielding with both hands, reroll it and use the new result.', source: { kind: 'class', refId: 'blood_hunter' }, level: null, effects: [], actions: [], choices: [], passive: true } as Feature },
  { id: 'two_weapon_fighting', label: 'Two-Weapon Fighting', value: { id: 'fighting_style_two_weapon_bh', name: 'Fighting Style: Two-Weapon Fighting', description: 'When you engage in two-weapon fighting, add your ability modifier to the damage of the second attack. No stat_modifier hook exists for this yet — apply manually.', source: { kind: 'class', refId: 'blood_hunter' }, level: null, effects: [], actions: [], choices: [], passive: true } as Feature },
];

// ── Crimson Rites ────────────────────────────────────────────────────────
function crimsonRite(id: string, name: string, damageType: string, description: string): Feature {
  return {
    id, name, description,
    source: { kind: 'class', refId: 'blood_hunter' },
    level: null, effects: [], actions: [], choices: [], passive: false,
    activation: { actionType: 'bonus_action', resourceCost: null, range: 'self', target: 'self', requiresSave: null },
    abilityEffects: [{ type: 'damage', dice: '1d4', damageType: 'necrotic' }],
  };
}
export const CRIMSON_RITE_POOL: ChoiceOption[] = [
  { id: 'flame', label: 'Rite of the Flame', value: crimsonRite('rite_flame', 'Rite of the Flame', 'fire', 'As a bonus action on a weapon you\'re holding, take necrotic damage equal to your hemocraft die (activation cost, can\'t be reduced) to imbue it with fire: while active (until you finish a short or long rest), your attacks with that weapon are magical and deal extra fire damage equal to your hemocraft die. Only one rite active per weapon; the extra rite damage on a hit isn\'t auto-applied — add it manually.') },
  { id: 'frozen', label: 'Rite of the Frozen', value: crimsonRite('rite_frozen', 'Rite of the Frozen', 'cold', 'As Rite of the Flame, but the imbued weapon deals extra cold damage instead of fire.') },
  { id: 'storm', label: 'Rite of the Storm', value: crimsonRite('rite_storm', 'Rite of the Storm', 'lightning', 'As Rite of the Flame, but the imbued weapon deals extra lightning damage instead of fire.') },
  { id: 'dead', label: 'Rite of the Dead (level 14+)', value: crimsonRite('rite_dead', 'Rite of the Dead', 'necrotic', 'Requires level 14. As Rite of the Flame, but the imbued weapon deals extra necrotic damage instead of fire.') },
  { id: 'oracle', label: 'Rite of the Oracle (level 14+)', value: crimsonRite('rite_oracle', 'Rite of the Oracle', 'psychic', 'Requires level 14. As Rite of the Flame, but the imbued weapon deals extra psychic damage instead of fire.') },
  { id: 'roar', label: 'Rite of the Roar (level 14+)', value: crimsonRite('rite_roar', 'Rite of the Roar', 'thunder', 'Requires level 14. As Rite of the Flame, but the imbued weapon deals extra thunder damage instead of fire.') },
];

function curseChoice(id: string, prompt: string): ChoiceDefinition {
  return { id, prompt, kind: 'feature_pool', count: 1, pool: BLOOD_CURSE_POOL, grants: [], required: true, resolved: false };
}
function riteChoice(id: string, prompt: string): ChoiceDefinition {
  return { id, prompt, kind: 'feature_pool', count: 1, pool: CRIMSON_RITE_POOL, grants: [], required: true, resolved: false };
}

export const bloodHunterProgression: ClassProgression = {
  classId: 'blood_hunter',
  srd: false,
  entries: [
    {
      level: 1, hpDie: 10,
      choices: [bloodHunterSkillChoice, ...bloodHunterEquipChoices, curseChoice('blood_hunter_curse_1', 'Choose your first known Blood Curse.')],
      grants: [
        { kind: 'proficiency', value: { armor: ['light', 'medium', 'shield'], weapons: ['simple', 'martial'], tools: ['alchemists_supplies'] } },
        { kind: 'feature', value: { id: 'hunters_bane', name: "Hunter's Bane", description: 'You have advantage on Wisdom (Survival) checks to track fey, fiends, or undead, and on Intelligence checks to recall information about them. Your hemocraft save DC = 8 + your proficiency bonus + your Hemocraft modifier (Intelligence, or Wisdom with your DM\'s permission).', source: { kind: 'class', refId: 'blood_hunter' }, level: 1, effects: [
          { type: 'stat_modifier', target: 'Wisdom (Survival) checks to track fey, fiends, or undead', operation: 'advantage', value: null, condition: null },
          { type: 'stat_modifier', target: 'Intelligence checks to recall information about fey, fiends, or undead', operation: 'advantage', value: null, condition: null },
        ], actions: [], choices: [], passive: true } },
        { kind: 'resource', value: { resourceId: 'blood_maledict_pool', name: 'Blood Maledict', maximum: 1, recharge: 'short_rest' } },
        { kind: 'feature', value: { id: 'blood_maledict', name: 'Blood Maledict', description: 'You know one Blood Curse of your choice, and learn one additional curse at 6th, 10th, 14th, and 18th level (replacing a known curse is also allowed at those levels). Usable once per short or long rest (more at higher levels).', source: { kind: 'class', refId: 'blood_hunter' }, level: 1, effects: [], actions: [], choices: [], passive: true } },
        { kind: 'feature', value: amplifyFeature() },
      ],
    },
    {
      level: 2, hpDie: 10,
      choices: [{ id: 'blood_hunter_fighting_style', prompt: 'Choose a Fighting Style.', kind: 'feature_pool', count: 1, pool: FIGHTING_STYLE_POOL, grants: [], required: true, resolved: false }, riteChoice('blood_hunter_rite_2', 'Choose your first Crimson Rite.')],
      grants: [
        { kind: 'feature', value: { id: 'crimson_rite', name: 'Crimson Rite', description: 'As a bonus action, activate a known Crimson Rite on a weapon you\'re holding; the rite lasts until you finish a short or long rest. Activating it costs necrotic damage equal to your hemocraft die (can\'t be reduced). While active, attacks with that weapon are magical and deal extra damage of the rite\'s type equal to your hemocraft die (not auto-applied to the attack — add it manually). Only one rite per weapon; you learn another rite at 7th and 14th level.', source: { kind: 'class', refId: 'blood_hunter' }, level: 2, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    {
      level: 3, hpDie: 10,
      choices: [{ id: 'blood_hunter_order_choice', prompt: 'Choose a Blood Hunter Order.', kind: 'subclass', count: 1, pool: 'all', grants: [], required: true, resolved: false }],
      grants: [{ kind: 'feature', value: { id: 'blood_hunter_order', name: 'Blood Hunter Order', description: 'You commit to an order of blood hunters, gaining features at 3rd level and again at 7th, 11th, 15th, and 18th.', source: { kind: 'class', refId: 'blood_hunter' }, level: 3, effects: [], actions: [], choices: [], passive: true } }],
    },
    { level: 4, hpDie: 10, choices: [asiChoice('blood_hunter_asi_4')], grants: [] },
    { level: 5, hpDie: 10, choices: [], grants: [{ kind: 'feature', value: { id: 'extra_attack_blood_hunter', name: 'Extra Attack', description: 'You can attack twice when you take the Attack action.', source: { kind: 'class', refId: 'blood_hunter' }, level: 5, effects: [{ type: 'stat_modifier', target: 'extra_attack', operation: 'set', value: 1, condition: null }], actions: [], choices: [], passive: true } }] },
    {
      level: 6, hpDie: 10,
      choices: [curseChoice('blood_hunter_curse_6', 'Learn 1 more Blood Curse (or replace a known one).')],
      grants: [
        { kind: 'resource_upgrade', value: { resourceId: 'blood_maledict_pool', newMaximum: 2 } },
        { kind: 'resource', value: { resourceId: 'brand_of_castigation_pool', name: 'Brand of Castigation', maximum: 1, recharge: 'short_rest' } },
        { kind: 'feature', value: { id: 'brand_of_castigation', name: 'Brand of Castigation', description: 'When you damage a creature with a weapon carrying an active Crimson Rite, sear an arcane brand into it (no action required) — you always know its direction on your plane. Each time the branded creature damages you or a creature within 5 feet of you, it takes psychic damage equal to your Hemocraft modifier (minimum 1). The brand lasts until dismissed or replaced, and can be dispelled (treated as a spell of level = half your blood hunter level, max 9th). Usable once per short or long rest. Flat ability-mod damage has no die to attach — apply manually.', source: { kind: 'class', refId: 'blood_hunter' }, level: 6, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'free', resourceCost: { resourceId: 'brand_of_castigation_pool', quantity: 1 }, range: '5 feet', target: 'single', requiresSave: null },
          abilityEffects: [] } },
      ],
    },
    { level: 7, hpDie: 10, choices: [riteChoice('blood_hunter_rite_7', 'Learn 1 more Crimson Rite.')], grants: [] },
    { level: 8, hpDie: 10, choices: [asiChoice('blood_hunter_asi_8')], grants: [] },
    { level: 9, hpDie: 10, choices: [], grants: [{ kind: 'feature', value: { id: 'grim_psychometry', name: 'Grim Psychometry', description: 'Advantage on Intelligence (History) checks to recall the sinister or tragic history of an object you\'re touching or your current location.', source: { kind: 'class', refId: 'blood_hunter' }, level: 9, effects: [
      { type: 'stat_modifier', target: 'Intelligence (History) checks to recall the sinister or tragic history of an object you\'re touching or your current location', operation: 'advantage', value: null, condition: null },
    ], actions: [], choices: [], passive: true } }] },
    {
      level: 10, hpDie: 10,
      choices: [curseChoice('blood_hunter_curse_10', 'Learn 1 more Blood Curse (or replace a known one).')],
      grants: [{ kind: 'feature', value: { id: 'dark_augmentation', name: 'Dark Augmentation', description: 'Your speed permanently increases by 5 feet, and you gain a bonus to Strength, Dexterity, and Constitution saving throws equal to your Hemocraft modifier (minimum +1). Only the flat +5 speed is wired — the ability-mod save bonus has no formula slot, apply it manually.', source: { kind: 'class', refId: 'blood_hunter' }, level: 10, effects: [
        { type: 'stat_modifier', target: 'speed', operation: 'add', value: 5, condition: null },
      ], actions: [], choices: [], passive: true } }],
    },
    { level: 11, hpDie: 10, choices: [], grants: [] },
    { level: 12, hpDie: 10, choices: [asiChoice('blood_hunter_asi_12')], grants: [] },
    {
      level: 13, hpDie: 10, choices: [],
      grants: [
        { kind: 'resource_upgrade', value: { resourceId: 'blood_maledict_pool', newMaximum: 3 } },
        { kind: 'feature', value: { id: 'brand_of_tethering', name: 'Brand of Tethering', description: 'Brand of Castigation\'s psychic damage doubles to twice your Hemocraft modifier (minimum 2). A branded creature also can\'t Dash, and if it tries to teleport or leave the plane, it takes 4d6 psychic damage and must succeed on a Wisdom save against your hemocraft save DC (8 + proficiency bonus + Hemocraft modifier — no formula slot exists for a non-spellcaster save DC, so requiresSave is omitted here) or have the attempt fail.', source: { kind: 'class', refId: 'blood_hunter' }, level: 13, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'free', resourceCost: null, range: 'self', target: 'single', requiresSave: null },
          abilityEffects: [{ type: 'damage', dice: '4d6', damageType: 'psychic' }] } },
      ],
    },
    {
      level: 14, hpDie: 10,
      choices: [riteChoice('blood_hunter_rite_14', 'Learn 1 more Crimson Rite.'), curseChoice('blood_hunter_curse_14', 'Learn 1 more Blood Curse (or replace a known one).')],
      grants: [{ kind: 'feature', value: { id: 'hardened_soul', name: 'Hardened Soul', description: 'You have advantage on saving throws against being charmed and frightened.', source: { kind: 'class', refId: 'blood_hunter' }, level: 14, effects: [
        { type: 'stat_modifier', target: 'saving throws against being charmed or frightened', operation: 'advantage', value: null, condition: null },
      ], actions: [], choices: [], passive: true } }],
    },
    { level: 15, hpDie: 10, choices: [], grants: [] },
    { level: 16, hpDie: 10, choices: [asiChoice('blood_hunter_asi_16')], grants: [] },
    { level: 17, hpDie: 10, choices: [], grants: [{ kind: 'resource_upgrade', value: { resourceId: 'blood_maledict_pool', newMaximum: 4 } }] },
    { level: 18, hpDie: 10, choices: [curseChoice('blood_hunter_curse_18', 'Learn 1 more Blood Curse (or replace a known one).')], grants: [] },
    { level: 19, hpDie: 10, choices: [asiChoice('blood_hunter_asi_19')], grants: [] },
    { level: 20, hpDie: 10, choices: [], grants: [{ kind: 'feature', value: { id: 'sanguine_mastery', name: 'Sanguine Mastery', description: 'Once per turn, when a blood hunter feature has you roll your hemocraft die, roll it twice and use either result. Whenever you score a critical hit with a weapon carrying an active Crimson Rite, regain one expended use of Blood Maledict.', source: { kind: 'class', refId: 'blood_hunter' }, level: 20, effects: [], actions: [], choices: [], passive: true } }] },
  ],
};
