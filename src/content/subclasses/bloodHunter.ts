// ============================================================================
// FILE: src/content/subclasses/bloodHunter.ts
// Blood Hunter Orders: Ghostslayer, Lycan, Mutant, Profane Soul.
//
// Third-party content (see src/content/classes/bloodHunter.ts's header) —
// srd: false throughout, same as every other non-SRD subclass in this app.
//
// Order-locked Blood Curses (Exorcist — Ghostslayer, Howl — Lycan,
// Corrosion — Mutant, Soul Eater — Profane Soul) are granted directly as
// Features at the level each order gains them, per the source text ("you
// gain this curse for your Blood Maledict feature; it doesn't count against
// your curses known") — NOT added to the base class's shared
// BLOOD_CURSE_POOL, since only that one order can ever know it.
//
// Save DCs: Blood Hunter's own features use a "hemocraft save DC" (8 + prof
// + Hemocraft modifier), not a real spellcasting DC — matches the base
// class's own fix (see bloodHunter.ts's commit history): requiresSave is
// omitted wherever only that DC would apply, with the formula stated in the
// description text instead. Profane Soul is the one order with REAL
// spellcasting (warlock-style pact magic), so its own spell-related
// features correctly use spell_save_dc.
//
// Profane Soul's Otherworldly Patron: the real subclass has 9 selectable
// patrons, each modifying THREE separate features (Rite Focus at 3rd,
// Revealed Arcana at 7th, Unsealed Arcana at 15th) — 27 branches total.
// Modeling all of it was judged not worth the complexity for a third-party
// subclass of a third-party class; the patron choice (feature_pool, level 3)
// bundles only each patron's Rite Focus benefit, since that's the one tied
// to the same level as the choice itself. Revealed Arcana and Unsealed
// Arcana stay flavor-only, listing all 9 patrons' spells in one description
// rather than 18 more separately-mechanized branches.
// ============================================================================
import { ChoiceOption, ClassProgression, Feature } from '../../engine/types';
import { CRIMSON_RITE_POOL, BLOOD_CURSE_POOL } from '../classes/bloodHunter';
import { PROFANE_SOUL_SLOTS } from '../classes/spellSlotTables';

export type SubclassProgression = ClassProgression & { name: string };

function orderCurse(
  id: string, name: string, description: string,
  actionType: 'action' | 'bonus_action' | 'reaction' | 'free',
  requiresSave: { ability: import('../../engine/types').Ability; dc: 'spell_save_dc' | number } | null,
  abilityEffects: Feature['abilityEffects'],
  refId: string,
): Feature {
  return {
    id, name, description,
    source: { kind: 'subclass', refId },
    level: null, effects: [], actions: [], choices: [], passive: false,
    activation: { actionType, resourceCost: { resourceId: 'blood_maledict_pool', quantity: 1 }, range: '30 feet', target: 'single', requiresSave },
    abilityEffects,
  };
}

// ── Order of the Ghostslayer ─────────────────────────────────────────────────
export const ghostslayerProgression: SubclassProgression = {
  classId: 'blood_hunter', name: 'Order of the Ghostslayer', srd: false,
  entries: [
    { level: 3, hpDie: 10, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'rite_of_the_dawn', name: 'Rite of the Dawn', description: 'You learn the Rite of the Dawn: your Crimson Rite extra damage becomes radiant. While active, your weapon sheds bright light in a 20-foot radius, you have resistance to necrotic damage, and hitting an undead creature with the rite active rolls an additional hemocraft die for the extra damage.', source: { kind: 'subclass', refId: 'ghostslayer' }, level: 3, effects: [
          { type: 'grant_resistance', target: 'necrotic', operation: 'resistance', value: null, condition: null },
        ], actions: [], choices: [], passive: true } },
        { kind: 'feature', value: { id: 'curse_specialist', name: 'Curse Specialist', description: 'Gain an additional use of Blood Maledict (this order-granted bonus use isn\'t reflected in the shared Blood Maledict pool\'s maximum — track it as +1 manually to avoid double-counting against the base class\'s own level-based upgrades). Your blood curses can now target any creature, blooded or not.', source: { kind: 'subclass', refId: 'ghostslayer' }, level: 3, effects: [], actions: [], choices: [], passive: true } },
      ] },
    { level: 7, hpDie: 10, choices: [],
      grants: [
        { kind: 'resource', value: { resourceId: 'aether_walk_pool', name: 'Aether Walk', maximum: 1, recharge: 'short_rest' } },
        { kind: 'feature', value: { id: 'aether_walk', name: 'Aether Walk', description: 'At the start of your turn while not incapacitated, step into the veil between planes: move through creatures and objects as difficult terrain, and see/affect creatures and objects on the Ethereal Plane (1d10 force damage if you end your turn inside an object). Lasts a number of rounds equal to your Hemocraft modifier (minimum 1). If ended inside an object, you\'re shunted to the nearest space and take force damage equal to twice the feet moved. Usable once per short or long rest (twice starting at level 15).', source: { kind: 'subclass', refId: 'ghostslayer' }, level: 7, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'free', resourceCost: { resourceId: 'aether_walk_pool', quantity: 1 }, range: 'self', target: 'self', requiresSave: null },
          abilityEffects: [] } },
      ] },
    { level: 11, hpDie: 10, choices: [], grants: [{ kind: 'feature', value: { id: 'brand_of_sundering', name: 'Brand of Sundering', description: 'Whenever you hit a creature with an active-Crimson-Rite weapon, roll an additional hemocraft die for the rite\'s extra damage. A creature branded by you with Incorporeal Movement (or similar) can\'t use it to move through creatures or objects while branded.', source: { kind: 'subclass', refId: 'ghostslayer' }, level: 11, effects: [], actions: [], choices: [], passive: true } }] },
    { level: 15, hpDie: 10, choices: [],
      grants: [
        { kind: 'resource_upgrade', value: { resourceId: 'aether_walk_pool', newMaximum: 2 } },
        { kind: 'feature', value: orderCurse(
          'curse_exorcist', 'Blood Curse of the Exorcist',
          'As a bonus action, choose a creature within 30 feet that\'s charmed, frightened, or possessed and end that condition on it. Doesn\'t count against your curses known. Amplify: whatever charmed, frightened, or possessed the target takes 3d6 psychic damage and must succeed on a Wisdom save (against your hemocraft save DC — no formula slot exists for this non-spellcaster DC) or be stunned until the end of your next turn.',
          'bonus_action', null, [{ type: 'remove_condition', conditionId: 'charmed' }, { type: 'remove_condition', conditionId: 'frightened' }],
          'ghostslayer',
        ) },
      ] },
    { level: 18, hpDie: 10, choices: [], grants: [{ kind: 'feature', value: { id: 'rite_revival', name: 'Rite Revival', description: 'If you have one or more Crimson Rites active and are reduced to 0 HP without dying outright, you can end all active rites to drop to 1 HP instead.', source: { kind: 'subclass', refId: 'ghostslayer' }, level: 18, effects: [], actions: [], choices: [], passive: true } }] },
  ],
};

// ── Order of the Lycan ───────────────────────────────────────────────────────
export const lycanProgression: SubclassProgression = {
  classId: 'blood_hunter', name: 'Order of the Lycan', srd: false,
  entries: [
    { level: 3, hpDie: 10, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'heightened_senses', name: 'Heightened Senses', description: 'You have advantage on Wisdom (Perception) checks that rely on hearing or smell.', source: { kind: 'subclass', refId: 'lycan' }, level: 3, effects: [
          { type: 'stat_modifier', target: 'Wisdom (Perception) checks that rely on hearing or smell', operation: 'advantage', value: null, condition: null },
        ], actions: [], choices: [], passive: true } },
        { kind: 'resource', value: { resourceId: 'hybrid_transformation_pool', name: 'Hybrid Transformation', maximum: 1, recharge: 'short_rest' } },
        { kind: 'feature', value: { id: 'hybrid_transformation', name: 'Hybrid Transformation', description: 'As a bonus action, transform into a hybrid form for up to 1 hour (dismissible as a bonus action; ends automatically if you fall unconscious or die). While transformed: Feral Might (advantage on STR checks/saves, +1 melee damage, rising to +2 at 11th and +3 at 18th); Resilient Hide (resistance to nonmagical, non-silvered B/P/S damage, +1 AC unless wearing heavy armor); Predatory Strikes (apply Crimson Rite to unarmed strikes, use DEX for their attack/damage rolls, 1d6 bludgeoning or slashing — 1d8 at 11th — plus a bonus-action extra unarmed strike); Bloodlust (below half HP, DC 8 Wisdom save at the start of your turn or charge and attack the nearest creature; auto-fail while concentrating or otherwise unable to concentrate). None of these temporary transformation benefits are wired as permanent effects — they apply only while transformed, track manually. Usable once per short or long rest.', source: { kind: 'subclass', refId: 'lycan' }, level: 3, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'bonus_action', resourceCost: { resourceId: 'hybrid_transformation_pool', quantity: 1 }, range: 'self', target: 'self', requiresSave: null },
          abilityEffects: [] } },
      ] },
    { level: 7, hpDie: 10, choices: [], grants: [{ kind: 'feature', value: { id: 'stalkers_prowess', name: "Stalker's Prowess", description: 'Your speed increases by 10 feet, your long jump distance by 10 feet, and your high jump distance by 3 feet. While in hybrid form, you also gain a +1 bonus (rising to +2 at 11th, +3 at 18th) to unarmed strike attack rolls, and those strikes count as magical while a Crimson Rite is active on them.', source: { kind: 'subclass', refId: 'lycan' }, level: 7, effects: [
      { type: 'stat_modifier', target: 'speed', operation: 'add', value: 10, condition: null },
    ], actions: [], choices: [], passive: true } }] },
    { level: 11, hpDie: 10, choices: [],
      grants: [
        { kind: 'resource_upgrade', value: { resourceId: 'hybrid_transformation_pool', newMaximum: 2 } },
        { kind: 'feature', value: { id: 'lycan_regeneration', name: 'Lycan Regeneration', description: 'At the start of each of your turns while you have at least 1 HP but fewer than half your HP maximum, regain 1 plus your Constitution modifier (minimum 1) hit points, resolved before any Bloodlust save.', source: { kind: 'subclass', refId: 'lycan' }, level: 11, effects: [], actions: [], choices: [], passive: true } },
      ] },
    { level: 15, hpDie: 10, choices: [], grants: [{ kind: 'feature', value: { id: 'brand_of_the_voracious', name: 'Brand of the Voracious', description: 'You have advantage on your Bloodlust saving throw while in hybrid form. While in hybrid form, you also have advantage on attack rolls against a creature you\'ve branded.', source: { kind: 'subclass', refId: 'lycan' }, level: 15, effects: [], actions: [], choices: [], passive: true } }] },
    { level: 18, hpDie: 10, choices: [],
      grants: [
        { kind: 'resource_upgrade', value: { resourceId: 'hybrid_transformation_pool', newMaximum: 99 } },
        { kind: 'feature', value: { id: 'hybrid_transformation_mastery', name: 'Hybrid Transformation Mastery', description: 'Use Hybrid Transformation an unlimited number of times (tracked here with a generously high pool maximum rather than true unlimited-use support), and your hybrid form now lasts until you revert, fall unconscious, or die.', source: { kind: 'subclass', refId: 'lycan' }, level: 18, effects: [], actions: [], choices: [], passive: true } },
        { kind: 'feature', value: orderCurse(
          'curse_howl', 'Blood Curse of the Howl',
          'As an action, unleash a bloodcurdling howl: each creature within 30 feet that can hear you (you can exclude any you choose) makes a Wisdom save (against your hemocraft save DC — no formula slot exists for this non-spellcaster DC) or is frightened of you until the end of your next turn (stunned while frightened if it fails by 5 or more); a creature that succeeds is immune to this curse for 24 hours. Doesn\'t count against your curses known. Amplify: range increases to 60 feet.',
          'action', null, [{ type: 'apply_condition', conditionId: 'frightened', duration: { unit: 'rounds', remaining: 1 } }],
          'lycan',
        ) },
      ] },
  ],
};

// ── Order of the Mutant ──────────────────────────────────────────────────────
function mutagen(id: string, name: string, description: string, abilityEffects: Feature['abilityEffects'] = []): Feature {
  return {
    id, name, description,
    source: { kind: 'subclass', refId: 'mutant' },
    level: null, effects: [], actions: [], choices: [], passive: false,
    activation: { actionType: 'bonus_action', resourceCost: { resourceId: 'mutagen_pool', quantity: 1 }, range: 'self', target: 'self', requiresSave: null },
    abilityEffects,
  };
}
const MUTAGEN_POOL: ChoiceOption[] = [
  { id: 'aether', label: 'Aether (level 11+)', value: mutagen('mutagen_aether', 'Mutagen: Aether', 'Requires level 11. Gain a 20-foot flying speed for 1 hour. Side effect: disadvantage on Strength and Dexterity checks during that time.') },
  { id: 'alluring', label: 'Alluring', value: mutagen('mutagen_alluring', 'Mutagen: Alluring', 'Advantage on Charisma checks. Side effect: disadvantage on initiative rolls.') },
  { id: 'celerity', label: 'Celerity', value: mutagen('mutagen_celerity', 'Mutagen: Celerity', 'Your Dexterity score and maximum increase by 3 (4 at level 11, 5 at level 18). Side effect: disadvantage on Wisdom saving throws.') },
  { id: 'conversant', label: 'Conversant', value: mutagen('mutagen_conversant', 'Mutagen: Conversant', 'Advantage on Intelligence checks. Side effect: disadvantage on Wisdom checks.') },
  { id: 'cruelty', label: 'Cruelty (level 11+)', value: mutagen('mutagen_cruelty', 'Mutagen: Cruelty', 'Requires level 11. When you use the Attack action, make one additional weapon attack as a bonus action. Side effect: disadvantage on Intelligence, Wisdom, and Charisma saving throws.') },
  { id: 'deftness', label: 'Deftness', value: mutagen('mutagen_deftness', 'Mutagen: Deftness', 'Advantage on Dexterity checks. Side effect: disadvantage on Wisdom checks.') },
  { id: 'embers', label: 'Embers', value: mutagen('mutagen_embers', 'Mutagen: Embers', 'Resistance to fire damage; vulnerability to cold damage.') },
  { id: 'gelid', label: 'Gelid', value: mutagen('mutagen_gelid', 'Mutagen: Gelid', 'Resistance to cold damage; vulnerability to fire damage.') },
  { id: 'impermeable', label: 'Impermeable', value: mutagen('mutagen_impermeable', 'Mutagen: Impermeable', 'Resistance to piercing damage; vulnerability to slashing damage.') },
  { id: 'mobility', label: 'Mobility', value: mutagen('mutagen_mobility', 'Mutagen: Mobility', 'Immunity to the grappled and restrained conditions (also paralyzed at level 11). Side effect: disadvantage on Strength checks.') },
  { id: 'nighteye', label: 'Nighteye', value: mutagen('mutagen_nighteye', 'Mutagen: Nighteye', 'Darkvision to 60 feet (+60 feet if you already have it). Side effect: disadvantage on attack rolls and sight-based Wisdom (Perception) checks when you, your target, or what you\'re perceiving is in direct sunlight.') },
  { id: 'percipient', label: 'Percipient', value: mutagen('mutagen_percipient', 'Mutagen: Percipient', 'Advantage on Wisdom checks. Side effect: disadvantage on Charisma checks.') },
  { id: 'potency', label: 'Potency', value: mutagen('mutagen_potency', 'Mutagen: Potency', 'Your Strength score and maximum increase by 3 (4 at level 11, 5 at level 18). Side effect: disadvantage on Dexterity saving throws.') },
  { id: 'precision', label: 'Precision (level 11+)', value: mutagen('mutagen_precision', 'Mutagen: Precision', 'Requires level 11. Your weapon attacks score a critical hit on a 19 or 20. Side effect: disadvantage on Strength saving throws.') },
  { id: 'rapidity', label: 'Rapidity', value: mutagen('mutagen_rapidity', 'Mutagen: Rapidity', 'Speed increases by 10 feet (+5 more at level 15). Side effect: disadvantage on Intelligence checks.') },
  { id: 'reconstruction', label: 'Reconstruction (level 7+)', value: mutagen('mutagen_reconstruction', 'Mutagen: Reconstruction', 'Requires level 7. For 1 hour, regain HP equal to your proficiency bonus at the start of each turn you have at least 1 HP but fewer than half your maximum. Side effect: speed reduced by 10 feet during that time.') },
  { id: 'sagacity', label: 'Sagacity', value: mutagen('mutagen_sagacity', 'Mutagen: Sagacity', 'Your Intelligence score and maximum increase by 3 (4 at level 11, 5 at level 18). Side effect: disadvantage on Charisma saving throws.') },
  { id: 'shielded', label: 'Shielded', value: mutagen('mutagen_shielded', 'Mutagen: Shielded', 'Resistance to slashing damage; vulnerability to bludgeoning damage.') },
  { id: 'unbreakable', label: 'Unbreakable', value: mutagen('mutagen_unbreakable', 'Mutagen: Unbreakable', 'Resistance to bludgeoning damage; vulnerability to piercing damage.') },
  { id: 'vermillion', label: 'Vermillion', value: mutagen('mutagen_vermillion', 'Mutagen: Vermillion', 'Gain an additional use of Blood Maledict. Side effect: disadvantage on death saving throws.', [{ type: 'restore_resource', resourceId: 'blood_maledict_pool', amount: 1 }]) },
];
function formulaChoice(id: string, prompt: string, count: number): import('../../engine/types').ChoiceDefinition {
  return { id, prompt, kind: 'feature_pool', count, pool: MUTAGEN_POOL, grants: [], required: true, resolved: false };
}

export const mutantProgression: SubclassProgression = {
  classId: 'blood_hunter', name: 'Order of the Mutant', srd: false,
  entries: [
    { level: 3, hpDie: 10,
      choices: [formulaChoice('mutant_formulas_3', 'Choose 4 mutagen formulas to learn.', 4)],
      grants: [
        { kind: 'resource', value: { resourceId: 'mutagen_pool', name: 'Mutagens Concocted', maximum: 1, recharge: 'long_rest' } },
        { kind: 'feature', value: { id: 'mutagencraft', name: 'Mutagencraft', description: 'As a bonus action, consume a known mutagen formula; its effect and side effect last until you finish a short or long rest (they become inert and unusable if not consumed before your next rest). While one or more mutagens affect you, use an action to flush them all at once. Mutagens are keyed to your own biology and have no effect on other creatures. Learning a new formula lets you replace a known one.', source: { kind: 'subclass', refId: 'mutant' }, level: 3, effects: [], actions: [], choices: [], passive: true } },
      ] },
    { level: 7, hpDie: 10,
      choices: [formulaChoice('mutant_formulas_7', 'Learn 1 more mutagen formula (or replace a known one).', 1)],
      grants: [
        { kind: 'resource_upgrade', value: { resourceId: 'mutagen_pool', newMaximum: 2 } },
        { kind: 'resource', value: { resourceId: 'strange_metabolism_pool', name: 'Strange Metabolism', maximum: 1, recharge: 'long_rest' } },
        { kind: 'feature', value: { id: 'strange_metabolism', name: 'Strange Metabolism', description: 'Gain immunity to poison damage and the poisoned condition. As a bonus action, ignore the side effect of one mutagen affecting you for 1 minute. Usable once per long rest.', source: { kind: 'subclass', refId: 'mutant' }, level: 7, effects: [
          { type: 'grant_immunity', target: 'poison', operation: 'immunity', value: null, condition: null },
          { type: 'condition_immunity', target: 'poisoned', operation: 'immunity', value: null, condition: null },
        ], actions: [], choices: [], passive: false,
          activation: { actionType: 'bonus_action', resourceCost: { resourceId: 'strange_metabolism_pool', quantity: 1 }, range: 'self', target: 'self', requiresSave: null },
          abilityEffects: [] } },
      ] },
    { level: 11, hpDie: 10,
      choices: [formulaChoice('mutant_formulas_11', 'Learn 1 more mutagen formula (or replace a known one).', 1)],
      grants: [{ kind: 'feature', value: { id: 'brand_of_axiom', name: 'Brand of Axiom', description: 'Branding a creature ends any illusion or invisibility on it, and it can\'t benefit from either while branded. A branded creature in an altered form (Polymorph, Change Shape, Wild Shape, or similar) must succeed on a Wisdom save or revert to its true form and be stunned until the end of your next turn; any later attempt to change form while branded requires the same save or fails (with the same stun on a failure).', source: { kind: 'subclass', refId: 'mutant' }, level: 11, effects: [], actions: [], choices: [], passive: true } }],
    },
    { level: 15, hpDie: 10,
      choices: [formulaChoice('mutant_formulas_15', 'Learn 1 more mutagen formula (or replace a known one).', 1)],
      grants: [
        { kind: 'resource_upgrade', value: { resourceId: 'mutagen_pool', newMaximum: 3 } },
        { kind: 'feature', value: orderCurse(
          'curse_corrosion', 'Blood Curse of Corrosion',
          'As a bonus action, poison a creature within 30 feet; it can repeat a Constitution save at the end of each of its turns to end the curse early. Doesn\'t count against your curses known. Amplify: it takes 4d6 necrotic damage immediately and again each time it fails that Constitution save.',
          'bonus_action', null, [{ type: 'apply_condition', conditionId: 'poisoned', duration: { unit: 'rounds', remaining: 1 } }],
          'mutant',
        ) },
      ] },
    { level: 18, hpDie: 10,
      choices: [formulaChoice('mutant_formulas_18', 'Learn 1 more mutagen formula (or replace a known one).', 1)],
      grants: [
        { kind: 'resource', value: { resourceId: 'exalted_mutation_pool', name: 'Exalted Mutation (scales with Hemocraft modifier)', maximum: 1, recharge: 'long_rest' } },
        { kind: 'feature', value: { id: 'exalted_mutation', name: 'Exalted Mutation', description: 'As a bonus action, end one mutagen currently affecting you and immediately have a different known formula take effect in its place. Usable a number of times equal to your Hemocraft modifier (minimum once) per long rest — tracked here as a single-use pool; increase its maximum to match.', source: { kind: 'subclass', refId: 'mutant' }, level: 18, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'bonus_action', resourceCost: { resourceId: 'exalted_mutation_pool', quantity: 1 }, range: 'self', target: 'self', requiresSave: null },
          abilityEffects: [] } },
      ] },
  ],
};

// ── Order of the Profane Soul ────────────────────────────────────────────────
const PATRON_POOL: ChoiceOption[] = [
  { id: 'archfey', label: 'The Archfey', value: { id: 'rite_focus_archfey', name: 'Rite Focus: The Archfey', description: 'While an active Crimson Rite weapon damages a creature, it glows with faint light until the end of your next turn, gaining no benefit from cover or invisibility.', source: { kind: 'subclass', refId: 'profane_soul' }, level: null, effects: [], actions: [], choices: [], passive: true } as Feature },
  { id: 'celestial', label: 'The Celestial', value: { id: 'rite_focus_celestial', name: 'Rite Focus: The Celestial', description: 'As a bonus action, expend a use of Blood Maledict to heal a creature within 60 feet for a roll of your hemocraft die plus your Hemocraft modifier (minimum +1).', source: { kind: 'subclass', refId: 'profane_soul' }, level: null, effects: [], actions: [], choices: [], passive: false,
    activation: { actionType: 'bonus_action', resourceCost: { resourceId: 'blood_maledict_pool', quantity: 1 }, range: '60 feet', target: 'single', requiresSave: null },
    abilityEffects: [{ type: 'heal', dice: '1d4' }] } as Feature },
  { id: 'fathomless', label: 'The Fathomless', value: { id: 'rite_focus_fathomless', name: 'Rite Focus: The Fathomless', description: 'You can breathe underwater. Once per turn when an active Crimson Rite weapon damages a creature, reduce its speed by 10 feet until the start of your next turn.', source: { kind: 'subclass', refId: 'profane_soul' }, level: null, effects: [], actions: [], choices: [], passive: true } as Feature },
  { id: 'fiend', label: 'The Fiend', value: { id: 'rite_focus_fiend', name: 'Rite Focus: The Fiend', description: 'While using Rite of the Flame, if you roll a 1 or 2 on the rite\'s extra damage die, reroll it and use either result.', source: { kind: 'subclass', refId: 'profane_soul' }, level: null, effects: [], actions: [], choices: [], passive: true } as Feature },
  { id: 'genie', label: 'The Genie', value: { id: 'rite_focus_genie', name: 'Rite Focus: The Genie', description: 'As a bonus action, expend a use of Blood Maledict to gain a 30-foot flying speed for a number of rounds equal to your Hemocraft modifier (minimum 1).', source: { kind: 'subclass', refId: 'profane_soul' }, level: null, effects: [], actions: [], choices: [], passive: false,
    activation: { actionType: 'bonus_action', resourceCost: { resourceId: 'blood_maledict_pool', quantity: 1 }, range: 'self', target: 'self', requiresSave: null },
    abilityEffects: [{ type: 'grant_speed', speedType: 'fly', amount: 30, duration: { unit: 'rounds', remaining: 1 } }] } as Feature },
  { id: 'great_old_one', label: 'The Great Old One', value: { id: 'rite_focus_goo', name: 'Rite Focus: The Great Old One', description: 'When you score a critical hit, that creature and any others you choose within 10 feet of it are frightened of you until the end of your next turn.', source: { kind: 'subclass', refId: 'profane_soul' }, level: null, effects: [], actions: [], choices: [], passive: true } as Feature },
  { id: 'hexblade', label: 'The Hexblade', value: { id: 'rite_focus_hexblade', name: 'Rite Focus: The Hexblade', description: 'When you successfully target a creature with a blood curse, your next hit against it while the curse is active deals extra damage equal to your proficiency bonus.', source: { kind: 'subclass', refId: 'profane_soul' }, level: null, effects: [], actions: [], choices: [], passive: true } as Feature },
  { id: 'undead', label: 'The Undead', value: { id: 'rite_focus_undead', name: 'Rite Focus: The Undead', description: 'When you take necrotic damage, use your reaction to halve it. Your appearance shifts to reflect your patron while any Crimson Rite is active.', source: { kind: 'subclass', refId: 'profane_soul' }, level: null, effects: [], actions: [], choices: [], passive: false,
    activation: { actionType: 'reaction', resourceCost: null, range: 'self', target: 'self', requiresSave: null },
    abilityEffects: [] } as Feature },
  { id: 'undying', label: 'The Undying', value: { id: 'rite_focus_undying', name: 'Rite Focus: The Undying', description: 'When you reduce a hostile creature of at least mild threat to 0 hit points, regain hit points equal to a roll of your hemocraft die.', source: { kind: 'subclass', refId: 'profane_soul' }, level: null, effects: [], actions: [], choices: [], passive: true } as Feature },
];

export const profaneSoulProgression: SubclassProgression = {
  classId: 'blood_hunter', name: 'Order of the Profane Soul', srd: false,
  entries: [
    { level: 3, hpDie: 10,
      choices: [{ id: 'profane_soul_patron', prompt: 'Choose your Otherworldly Patron (grants that patron\'s Rite Focus benefit).', kind: 'feature_pool', count: 1, pool: PATRON_POOL, grants: [], required: true, resolved: false }],
      grants: [
        { kind: 'init_spellcasting', value: { ability: 'int' } } as import('../../engine/types').Grant,
        { kind: 'spell_slots', value: { level: 3, slotsTable: PROFANE_SOUL_SLOTS } } as import('../../engine/types').Grant,
        { kind: 'feature', value: { id: 'profane_soul_spellcasting', name: 'Pact Magic', description: 'You strike a bargain with an otherworldly patron and cast spells from the warlock spell list. Learn 2 cantrips (a 3rd at level 10) and a small number of warlock spells, using your Hemocraft ability (INT here) for spellcasting; all your spell slots share one level (see the Profane Soul Spellcasting table) and return on a short or long rest. Rite Focus lets you use an active-Crimson-Rite weapon as your spellcasting focus.', source: { kind: 'subclass', refId: 'profane_soul' }, level: 3, effects: [], actions: [], choices: [], passive: true } },
      ] },
    { level: 4, hpDie: 10, choices: [], grants: [{ kind: 'spell_slots', value: { level: 4, slotsTable: PROFANE_SOUL_SLOTS } } as import('../../engine/types').Grant] },
    { level: 5, hpDie: 10, choices: [], grants: [{ kind: 'spell_slots', value: { level: 5, slotsTable: PROFANE_SOUL_SLOTS } } as import('../../engine/types').Grant] },
    { level: 6, hpDie: 10, choices: [], grants: [{ kind: 'spell_slots', value: { level: 6, slotsTable: PROFANE_SOUL_SLOTS } } as import('../../engine/types').Grant] },
    { level: 7, hpDie: 10, choices: [],
      grants: [
        { kind: 'spell_slots', value: { level: 7, slotsTable: PROFANE_SOUL_SLOTS } } as import('../../engine/types').Grant,
        { kind: 'feature', value: { id: 'mystic_frenzy', name: 'Mystic Frenzy', description: 'When you use your action to cast a cantrip, immediately make one weapon attack as a bonus action.', source: { kind: 'subclass', refId: 'profane_soul' }, level: 7, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'free', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
          abilityEffects: [] } },
        { kind: 'resource', value: { resourceId: 'revealed_arcana_pool', name: 'Revealed Arcana', maximum: 1, recharge: 'long_rest' } },
        { kind: 'feature', value: { id: 'revealed_arcana', name: 'Revealed Arcana', description: 'Cast a specific spell tied to your patron once using a pact magic slot, without it counting as one of your spells known: Archfey — Blur; Celestial — Lesser Restoration; Fathomless — Gust of Wind; Fiend — Scorching Ray; Genie — Phantasmal Force; Great Old One — Detect Thoughts; Hexblade — Branding Smite; Undead — Blindness/Deafness; Undying — Silence. Not wired to a fixed cast_spell hook since it depends on your chosen patron. Usable once per long rest.', source: { kind: 'subclass', refId: 'profane_soul' }, level: 7, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'action', resourceCost: { resourceId: 'revealed_arcana_pool', quantity: 1 }, range: 'self', target: 'self', requiresSave: null },
          abilityEffects: [] } },
      ] },
    { level: 8, hpDie: 10, choices: [], grants: [{ kind: 'spell_slots', value: { level: 8, slotsTable: PROFANE_SOUL_SLOTS } } as import('../../engine/types').Grant] },
    { level: 9, hpDie: 10, choices: [], grants: [{ kind: 'spell_slots', value: { level: 9, slotsTable: PROFANE_SOUL_SLOTS } } as import('../../engine/types').Grant] },
    { level: 10, hpDie: 10, choices: [], grants: [{ kind: 'spell_slots', value: { level: 10, slotsTable: PROFANE_SOUL_SLOTS } } as import('../../engine/types').Grant] },
    { level: 11, hpDie: 10, choices: [],
      grants: [
        { kind: 'spell_slots', value: { level: 11, slotsTable: PROFANE_SOUL_SLOTS } } as import('../../engine/types').Grant,
        { kind: 'feature', value: { id: 'brand_of_the_sapping_scar', name: 'Brand of the Sapping Scar', description: 'A creature branded by you has disadvantage on saving throws against your warlock spells.', source: { kind: 'subclass', refId: 'profane_soul' }, level: 11, effects: [], actions: [], choices: [], passive: true } },
      ] },
    { level: 12, hpDie: 10, choices: [], grants: [{ kind: 'spell_slots', value: { level: 12, slotsTable: PROFANE_SOUL_SLOTS } } as import('../../engine/types').Grant] },
    { level: 13, hpDie: 10, choices: [], grants: [{ kind: 'spell_slots', value: { level: 13, slotsTable: PROFANE_SOUL_SLOTS } } as import('../../engine/types').Grant] },
    { level: 14, hpDie: 10, choices: [], grants: [{ kind: 'spell_slots', value: { level: 14, slotsTable: PROFANE_SOUL_SLOTS } } as import('../../engine/types').Grant] },
    { level: 15, hpDie: 10, choices: [],
      grants: [
        { kind: 'spell_slots', value: { level: 15, slotsTable: PROFANE_SOUL_SLOTS } } as import('../../engine/types').Grant,
        { kind: 'resource', value: { resourceId: 'unsealed_arcana_pool', name: 'Unsealed Arcana', maximum: 1, recharge: 'long_rest' } },
        { kind: 'feature', value: { id: 'unsealed_arcana', name: 'Unsealed Arcana', description: 'Cast a second patron-specific spell once without expending a spell slot: Archfey — Slow; Celestial — Revivify; Fathomless — Lightning Bolt; Fiend — Fireball; Genie — Protection from Energy; Great Old One — Haste; Hexblade — Blink; Undead — Speak with Dead; Undying — Bestow Curse. Not wired to a fixed cast_spell hook since it depends on your chosen patron. Usable once per long rest.', source: { kind: 'subclass', refId: 'profane_soul' }, level: 15, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'action', resourceCost: { resourceId: 'unsealed_arcana_pool', quantity: 1 }, range: 'self', target: 'self', requiresSave: null },
          abilityEffects: [] } },
      ] },
    { level: 16, hpDie: 10, choices: [], grants: [{ kind: 'spell_slots', value: { level: 16, slotsTable: PROFANE_SOUL_SLOTS } } as import('../../engine/types').Grant] },
    { level: 17, hpDie: 10, choices: [], grants: [{ kind: 'spell_slots', value: { level: 17, slotsTable: PROFANE_SOUL_SLOTS } } as import('../../engine/types').Grant] },
    { level: 18, hpDie: 10, choices: [],
      grants: [
        { kind: 'spell_slots', value: { level: 18, slotsTable: PROFANE_SOUL_SLOTS } } as import('../../engine/types').Grant,
        { kind: 'feature', value: orderCurse(
          'curse_soul_eater', 'Blood Curse of the Soul Eater',
          'When a non-construct, non-undead creature is reduced to 0 HP within 30 feet, use your reaction to trade its life energy for power: until the end of your next turn, your attacks have advantage and you have resistance to all damage. Doesn\'t count against your curses known. Amplify: also regain an expended pact magic spell slot; once amplified this way, requires a long rest before amplifying again.',
          'reaction', null, [],
          'profane_soul',
        ) },
      ] },
    { level: 19, hpDie: 10, choices: [], grants: [{ kind: 'spell_slots', value: { level: 19, slotsTable: PROFANE_SOUL_SLOTS } } as import('../../engine/types').Grant] },
    { level: 20, hpDie: 10, choices: [], grants: [{ kind: 'spell_slots', value: { level: 20, slotsTable: PROFANE_SOUL_SLOTS } } as import('../../engine/types').Grant] },
  ],
};

export const BLOOD_HUNTER_SUBCLASSES: SubclassProgression[] = [
  ghostslayerProgression, lycanProgression, mutantProgression, profaneSoulProgression,
];

// Re-exported so Blood Curse/Crimson Rite pools stay a single source of
// truth even though this file imports them from the base class file.
export { CRIMSON_RITE_POOL, BLOOD_CURSE_POOL };
