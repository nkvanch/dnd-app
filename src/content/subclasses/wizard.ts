// ============================================================================
// FILE: src/content/subclasses/wizard.ts
// Wizard subclasses: School of Evocation, School of Abjuration, Bladesinging,
// Chronurgy Magic, Graviturgy Magic, Order of Scribes, School of
// Conjuration, School of Divination, School of Enchantment, School of
// Illusion, School of Necromancy, School of Transmutation, War Magic
// ============================================================================
import { ChoiceOption, ClassProgression, Feature } from '../../engine/types';

export type SubclassProgression = ClassProgression & { name: string };

// ── School of Evocation ───────────────────────────────────────────────────────

export const evocationProgression: SubclassProgression = {
  classId: 'wizard',
  name: 'School of Evocation',
  srd: true,
  entries: [
    {
      level: 2, hpDie: 6, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'evocation_savant', name: 'Evocation Savant', description: 'The gold and time you must spend to copy an evocation spell into your spellbook is halved.', source: { kind: 'subclass', refId: 'evocation' }, level: 2, effects: [], actions: [], choices: [], passive: true } },
        { kind: 'feature', value: { id: 'sculpt_spells', name: 'Sculpt Spells', description: 'When you cast an evocation spell that affects other creatures you can see, you can choose a number of them equal to 1 + the spell\'s level. Those creatures automatically succeed on their saving throws, and take no damage if they succeed.', source: { kind: 'subclass', refId: 'evocation' }, level: 2, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    {
      level: 6, hpDie: 6, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'potent_cantrip', name: 'Potent Cantrip', description: 'Your damaging cantrips affect even creatures that avoid the brunt of the effect. On a successful save, a creature takes half the cantrip\'s damage.', source: { kind: 'subclass', refId: 'evocation' }, level: 6, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    {
      level: 10, hpDie: 6, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'empowered_evocation', name: 'Empowered Evocation', description: 'Add your INT modifier to one damage roll of any wizard evocation spell you cast.', source: { kind: 'subclass', refId: 'evocation' }, level: 10, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    {
      level: 14, hpDie: 6, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'overchannel', name: 'Overchannel', description: 'When you cast a wizard spell of 1st through 5th level that deals damage, maximize the damage. You can do so without ill effect once. A 2nd use before a long rest causes 2d12 necrotic per spell level, increasing by 1d12 for each subsequent use.', source: { kind: 'subclass', refId: 'evocation' }, level: 14, effects: [], actions: [], choices: [], passive: false } },
      ],
    },
  ],
};

// ── School of Abjuration ──────────────────────────────────────────────────────

export const abjurationProgression: SubclassProgression = {
  classId: 'wizard',
  name: 'School of Abjuration',
  srd: false,
  entries: [
    {
      level: 2, hpDie: 6, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'abjuration_savant', name: 'Abjuration Savant', description: 'The gold and time you must spend to copy an abjuration spell into your spellbook is halved.', source: { kind: 'subclass', refId: 'abjuration' }, level: 2, effects: [], actions: [], choices: [], passive: true } },
        { kind: 'feature', value: { id: 'arcane_ward', name: 'Arcane Ward', description: 'When you cast an abjuration spell of 1st level or higher, you can simultaneously use a strand of the spell\'s magic to create a magical ward on yourself. The ward has HP equal to twice your wizard level + INT modifier. Regain HP when you cast an abjuration spell.', source: { kind: 'subclass', refId: 'abjuration' }, level: 2, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    {
      level: 6, hpDie: 6, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'projected_ward', name: 'Projected Ward', description: 'When a creature you can see within 30 feet takes damage, use your reaction to cause your Arcane Ward to absorb that damage.', source: { kind: 'subclass', refId: 'abjuration' }, level: 6, effects: [], actions: [], choices: [], passive: false } },
      ],
    },
    {
      level: 10, hpDie: 6, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'improved_abjuration', name: 'Improved Abjuration', description: 'When you cast an abjuration spell that requires you to make an ability check as a part of casting the spell, add your proficiency bonus to that ability check.', source: { kind: 'subclass', refId: 'abjuration' }, level: 10, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    {
      level: 14, hpDie: 6, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'spell_resistance', name: 'Spell Resistance', description: 'Advantage on saving throws against spells. Resistance to spell damage.', source: { kind: 'subclass', refId: 'abjuration' }, level: 14, effects: [{ type: 'grant_resistance', target: 'spell', operation: 'resistance', value: null, condition: null }], actions: [], choices: [], passive: true } },
      ],
    },
  ],
};

// ── Bladesinging ─────────────────────────────────────────────────────────────
export const bladesingingProgression: SubclassProgression = {
  classId: 'wizard', name: 'Bladesinging', srd: false,
  entries: [
    { level: 2, hpDie: 6, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'training_in_war_and_song', name: 'Training in War and Song', description: 'Gain proficiency with light armor, one one-handed melee weapon type of your choice, and the Performance skill.', source: { kind: 'subclass', refId: 'bladesinging' }, level: 2, effects: [
          { type: 'grant_proficiency', target: 'skill:performance', operation: 'add', value: null, condition: null },
        ], actions: [], choices: [], passive: true } },
        { kind: 'resource', value: { resourceId: 'bladesong_pool', name: 'Bladesong (scales with proficiency bonus)', maximum: 1, recharge: 'long_rest' } },
        { kind: 'feature', value: { id: 'bladesong', name: 'Bladesong', description: 'As a bonus action (while not wearing medium/heavy armor or a shield), start a Bladesong for 1 minute: gain a bonus to AC equal to your Intelligence modifier (min +1), your walking speed increases by 10 feet, you have advantage on Dexterity (Acrobatics) checks, and you gain a bonus to concentration saves equal to your Intelligence modifier (min +1). Ends early if incapacitated, you don medium/heavy armor or a shield, or attack two-handed; dismissible at will. Usable a number of times equal to your proficiency bonus per long rest — tracked here as a single-use pool; increase its maximum to match.', source: { kind: 'subclass', refId: 'bladesinging' }, level: 2, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'bonus_action', resourceCost: { resourceId: 'bladesong_pool', quantity: 1 }, range: 'self', target: 'self', requiresSave: null },
          abilityEffects: [{ type: 'grant_speed', speedType: 'walk', amount: 10, duration: { unit: 'minutes', remaining: 1 } }] } },
      ] },
    { level: 6, hpDie: 6, choices: [], grants: [{ kind: 'feature', value: { id: 'bladesinging_extra_attack', name: 'Extra Attack', description: 'Attack twice, instead of once, when you take the Attack action; you may cast a cantrip in place of one of those attacks.', source: { kind: 'subclass', refId: 'bladesinging' }, level: 6, effects: [
      { type: 'stat_modifier', target: 'extra_attack', operation: 'set', value: 1, condition: null },
    ], actions: [], choices: [], passive: true } }] },
    { level: 10, hpDie: 6, choices: [], grants: [{ kind: 'feature', value: { id: 'song_of_defense', name: 'Song of Defense', description: 'While your Bladesong is active, when you take damage, use your reaction and expend a spell slot to reduce that damage by five times the slot\'s level.', source: { kind: 'subclass', refId: 'bladesinging' }, level: 10, effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'reaction', resourceCost: null, range: 'self', target: 'self', requiresSave: null },
      abilityEffects: [] } }] },
    { level: 14, hpDie: 6, choices: [], grants: [{ kind: 'feature', value: { id: 'song_of_victory', name: 'Song of Victory', description: 'While your Bladesong is active, add your Intelligence modifier (min +1) to the damage of your melee weapon attacks. No formula slot exists for this flat INT-to-damage bonus — apply manually.', source: { kind: 'subclass', refId: 'bladesinging' }, level: 14, effects: [], actions: [], choices: [], passive: true } }] },
  ],
};

// ── Chronurgy Magic ──────────────────────────────────────────────────────────
export const chronurgyProgression: SubclassProgression = {
  classId: 'wizard', name: 'Chronurgy Magic', srd: false,
  entries: [
    { level: 2, hpDie: 6, choices: [],
      grants: [
        { kind: 'resource', value: { resourceId: 'chronal_shift_pool', name: 'Chronal Shift', maximum: 2, recharge: 'long_rest' } },
        { kind: 'feature', value: { id: 'chronal_shift', name: 'Chronal Shift', description: 'As a reaction after you or a creature within 30 feet makes an attack roll, ability check, or saving throw (after seeing the result), force a reroll; the second result must be used. Usable twice per long rest.', source: { kind: 'subclass', refId: 'chronurgy' }, level: 2, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'reaction', resourceCost: { resourceId: 'chronal_shift_pool', quantity: 1 }, range: '30 feet', target: 'single', requiresSave: null },
          abilityEffects: [] } },
        { kind: 'feature', value: { id: 'temporal_awareness', name: 'Temporal Awareness', description: 'Add your Intelligence modifier to initiative rolls. No formula slot exists for this — apply manually.', source: { kind: 'subclass', refId: 'chronurgy' }, level: 2, effects: [], actions: [], choices: [], passive: true } },
      ] },
    { level: 6, hpDie: 6, choices: [],
      grants: [
        { kind: 'resource', value: { resourceId: 'momentary_stasis_pool', name: 'Momentary Stasis (scales with Intelligence modifier)', maximum: 1, recharge: 'long_rest' } },
        { kind: 'feature', value: { id: 'momentary_stasis', name: 'Momentary Stasis', description: 'As an action, force a Large or smaller creature within 60 feet to make a Constitution save; on a failure it\'s encased in magical energy (incapacitated, speed 0) until the end of your next turn or until it takes damage. Usable a number of times equal to your Intelligence modifier (minimum once) per long rest — tracked here as a single-use pool; increase its maximum to match.', source: { kind: 'subclass', refId: 'chronurgy' }, level: 6, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'action', resourceCost: { resourceId: 'momentary_stasis_pool', quantity: 1 }, range: '60 feet', target: 'single', requiresSave: { ability: 'con', dc: 'spell_save_dc' } },
          abilityEffects: [{ type: 'apply_condition', conditionId: 'incapacitated', duration: { unit: 'rounds', remaining: 1 } }] } },
      ] },
    { level: 10, hpDie: 6, choices: [],
      grants: [
        { kind: 'resource', value: { resourceId: 'arcane_abeyance_pool', name: 'Arcane Abeyance', maximum: 1, recharge: 'short_rest' } },
        { kind: 'feature', value: { id: 'arcane_abeyance', name: 'Arcane Abeyance', description: 'When you cast a spell using a 4th-level-or-lower slot, condense it into a Tiny bead (AC 15, 1 HP, immune to poison/psychic) that holds the spell frozen for 1 hour. A creature holding it can use an action to release the spell (using your attack bonus and save DC, treating the releaser as caster). Usable once per short or long rest.', source: { kind: 'subclass', refId: 'chronurgy' }, level: 10, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'free', resourceCost: { resourceId: 'arcane_abeyance_pool', quantity: 1 }, range: 'self', target: 'self', requiresSave: null },
          abilityEffects: [] } },
      ] },
    { level: 14, hpDie: 6, choices: [], grants: [{ kind: 'feature', value: { id: 'convergent_future', name: 'Convergent Future', description: 'When you or a creature within 60 feet makes an attack roll, ability check, or saving throw, use your reaction to set the result to the minimum needed to succeed, or one less (your choice), ignoring the die. You gain a level of exhaustion, removable only by a long rest.', source: { kind: 'subclass', refId: 'chronurgy' }, level: 14, effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'reaction', resourceCost: null, range: '60 feet', target: 'single', requiresSave: null },
      abilityEffects: [] } }] },
  ],
};

// ── Graviturgy Magic ─────────────────────────────────────────────────────────
export const graviturgyProgression: SubclassProgression = {
  classId: 'wizard', name: 'Graviturgy Magic', srd: false,
  entries: [
    { level: 2, hpDie: 6, choices: [], grants: [{ kind: 'feature', value: { id: 'adjust_density', name: 'Adjust Density', description: 'As an action, halve or double the weight of a Large-or-smaller object or creature within 30 feet for up to 1 minute or until your concentration ends. Halved weight grants +10 feet speed, double-distance jumps, and Strength check/save disadvantage; doubled weight imposes -10 feet speed and Strength check/save advantage. Targets up to Huge at level 10.', source: { kind: 'subclass', refId: 'graviturgy' }, level: 2, effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'action', resourceCost: null, range: '30 feet', target: 'single', requiresSave: null },
      abilityEffects: [] } }] },
    { level: 6, hpDie: 6, choices: [], grants: [{ kind: 'feature', value: { id: 'gravity_well', name: 'Gravity Well', description: 'Whenever a spell you cast hits or fails to save a creature (or a willing target agrees), move that creature 5 feet to an unoccupied space of your choice.', source: { kind: 'subclass', refId: 'graviturgy' }, level: 6, effects: [], actions: [], choices: [], passive: true } }] },
    { level: 10, hpDie: 6, choices: [],
      grants: [
        { kind: 'resource', value: { resourceId: 'violent_attraction_pool', name: 'Violent Attraction (scales with Intelligence modifier)', maximum: 1, recharge: 'long_rest' } },
        { kind: 'feature', value: { id: 'violent_attraction', name: 'Violent Attraction', description: 'When a creature you can see within 60 feet hits with a weapon attack, use your reaction to add 1d10 damage of that weapon\'s type; or when a creature within 60 feet takes fall damage, add 2d10 to it instead. Usable a number of times equal to your Intelligence modifier (minimum once) per long rest — tracked here as a single-use pool; increase its maximum to match.', source: { kind: 'subclass', refId: 'graviturgy' }, level: 10, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'reaction', resourceCost: { resourceId: 'violent_attraction_pool', quantity: 1 }, range: '60 feet', target: 'single', requiresSave: null },
          abilityEffects: [{ type: 'damage', dice: '1d10', damageType: 'weapon' }] } },
      ] },
    { level: 14, hpDie: 6, choices: [],
      grants: [
        { kind: 'resource', value: { resourceId: 'event_horizon_pool', name: 'Event Horizon', maximum: 1, recharge: 'long_rest' } },
        { kind: 'feature', value: { id: 'event_horizon', name: 'Event Horizon', description: 'As an action, emit a gravitational field for up to 1 minute or until your concentration ends: whenever a hostile creature starts its turn within 30 feet, it makes a Strength save against your spell save DC, taking 2d10 force damage and speed 0 until the start of its next turn on a failure, half damage and doubled movement cost this turn on a success. Usable once per long rest, or again by spending a 3rd-level spell slot.', source: { kind: 'subclass', refId: 'graviturgy' }, level: 14, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'action', resourceCost: { resourceId: 'event_horizon_pool', quantity: 1 }, range: '30 feet', target: 'area', requiresSave: { ability: 'str', dc: 'spell_save_dc' } },
          abilityEffects: [{ type: 'damage', dice: '2d10', damageType: 'force', saveOnSuccess: 'half' }] } },
      ] },
  ],
};

// ── Order of Scribes ─────────────────────────────────────────────────────────
export const orderOfScribesProgression: SubclassProgression = {
  classId: 'wizard', name: 'Order of Scribes', srd: false,
  entries: [
    { level: 2, hpDie: 6, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'wizardly_quill', name: 'Wizardly Quill', description: 'As a bonus action, conjure a Tiny inkless quill in your free hand that writes in a color of your choice, halves your spellbook transcription time (2 minutes per spell level), and can erase its own writing as a bonus action within 5 feet. Vanishes if you make another or die.', source: { kind: 'subclass', refId: 'order_of_scribes' }, level: 2, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'bonus_action', resourceCost: null, range: 'self', target: 'self', requiresSave: null },
          abilityEffects: [] } },
        { kind: 'feature', value: { id: 'awakened_spellbook', name: 'Awakened Spellbook', description: 'While holding your spellbook, use it as a spellcasting focus; when casting a wizard spell with a slot, swap its damage type for one used by another spell of the same level in your book (that casting only); and cast a ritual spell at its normal casting time once per long rest instead of adding 10 minutes.', source: { kind: 'subclass', refId: 'order_of_scribes' }, level: 2, effects: [], actions: [], choices: [], passive: true } },
      ] },
    { level: 6, hpDie: 6, choices: [],
      grants: [
        { kind: 'resource', value: { resourceId: 'manifest_mind_pool', name: 'Manifest Mind (scales with proficiency bonus)', maximum: 1, recharge: 'long_rest' } },
        { kind: 'feature', value: { id: 'manifest_mind', name: 'Manifest Mind', description: 'As a bonus action, manifest your Awakened Spellbook\'s mind as an intangible Tiny sensor within 60 feet, with darkvision 60 feet and dim light in a 10-foot radius, sharing what it senses telepathically. You can cast wizard spells from its space instead of your own. It moves 30 feet as a bonus action and stops manifesting beyond 300 feet, on Dispel Magic, on the book\'s destruction, your death, or dismissal. Usable a number of times equal to your proficiency bonus per long rest — tracked here as a single-use pool; increase its maximum to match.', source: { kind: 'subclass', refId: 'order_of_scribes' }, level: 6, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'bonus_action', resourceCost: { resourceId: 'manifest_mind_pool', quantity: 1 }, range: '60 feet', target: 'self', requiresSave: null },
          abilityEffects: [] } },
      ] },
    { level: 10, hpDie: 6, choices: [], grants: [{ kind: 'feature', value: { id: 'master_scriviner', name: 'Master Scriviner', description: 'At the end of a long rest, copy a 1st- or 2nd-level, 1-action spell from your Awakened Spellbook onto a blank scroll with your quill; it counts as one level higher and vanishes after casting or your next long rest. Halve the gold and time to craft ordinary spell scrolls when using the quill.', source: { kind: 'subclass', refId: 'order_of_scribes' }, level: 10, effects: [], actions: [], choices: [], passive: true } }] },
    { level: 14, hpDie: 6, choices: [], grants: [{ kind: 'feature', value: { id: 'one_with_the_word', name: 'One with the Word', description: 'While your spellbook is on your person, gain advantage on Intelligence (Arcana) checks. If you take damage while its mind is manifested, use your reaction to dismiss the mind and prevent all of that damage, instead temporarily losing spells from the book worth a rolled 3d6 in combined levels (restored after 1d6 long rests). Usable once per long rest.', source: { kind: 'subclass', refId: 'order_of_scribes' }, level: 14, effects: [
      { type: 'stat_modifier', target: 'Intelligence (Arcana) checks', operation: 'advantage', value: null, condition: null },
    ], actions: [], choices: [], passive: true } }] },
  ],
};

// ── School of Conjuration ────────────────────────────────────────────────────
export const conjurationProgression: SubclassProgression = {
  classId: 'wizard', name: 'School of Conjuration', srd: false,
  entries: [
    { level: 2, hpDie: 6, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'conjuration_savant', name: 'Conjuration Savant', description: 'The gold and time to copy a conjuration spell into your spellbook is halved.', source: { kind: 'subclass', refId: 'conjuration' }, level: 2, effects: [], actions: [], choices: [], passive: true } },
        { kind: 'feature', value: { id: 'minor_conjuration', name: 'Minor Conjuration', description: 'As an action, conjure a visibly magical, dimly glowing nonmagical object you\'ve seen (no larger than 3 feet, no heavier than 10 pounds) into your hand or an unoccupied space within 10 feet. It disappears after 1 hour, on reuse, or if it deals or takes damage.', source: { kind: 'subclass', refId: 'conjuration' }, level: 2, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'action', resourceCost: null, range: '10 feet', target: 'self', requiresSave: null },
          abilityEffects: [] } },
      ] },
    { level: 6, hpDie: 6, choices: [],
      grants: [
        { kind: 'resource', value: { resourceId: 'benign_transportation_pool', name: 'Benign Transportation', maximum: 1, recharge: 'long_rest' } },
        { kind: 'feature', value: { id: 'benign_transportation', name: 'Benign Transportation', description: 'As an action, teleport up to 30 feet to an unoccupied space you can see, or swap places with a willing Small or Medium creature there. Usable once per long rest, or again by casting a 1st-level-or-higher conjuration spell.', source: { kind: 'subclass', refId: 'conjuration' }, level: 6, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'action', resourceCost: { resourceId: 'benign_transportation_pool', quantity: 1 }, range: '30 feet', target: 'self', requiresSave: null },
          abilityEffects: [] } },
      ] },
    { level: 10, hpDie: 6, choices: [], grants: [{ kind: 'feature', value: { id: 'focused_conjuration', name: 'Focused Conjuration', description: 'While concentrating on a conjuration spell, taking damage can\'t break your concentration on it.', source: { kind: 'subclass', refId: 'conjuration' }, level: 10, effects: [], actions: [], choices: [], passive: true } }] },
    { level: 14, hpDie: 6, choices: [], grants: [{ kind: 'feature', value: { id: 'durable_summons', name: 'Durable Summons', description: 'Any creature you summon or create with a conjuration spell has 30 temporary hit points.', source: { kind: 'subclass', refId: 'conjuration' }, level: 14, effects: [], actions: [], choices: [], passive: true } }] },
  ],
};

// ── School of Divination ─────────────────────────────────────────────────────
export const divinationProgression: SubclassProgression = {
  classId: 'wizard', name: 'School of Divination', srd: false,
  entries: [
    { level: 2, hpDie: 6, choices: [],
      grants: [
        { kind: 'resource', value: { resourceId: 'portent_pool', name: 'Portent', maximum: 2, recharge: 'long_rest' } },
        { kind: 'feature', value: { id: 'portent', name: 'Portent', description: 'When you finish a long rest, roll two d20s and record the results. Before any attack roll, saving throw, or ability check by you or a creature you can see, you can substitute one of these foretelling rolls (once per turn per roll). Unused rolls are lost at your next long rest.', source: { kind: 'subclass', refId: 'divination' }, level: 2, effects: [], actions: [], choices: [], passive: true } },
      ] },
    { level: 6, hpDie: 6, choices: [], grants: [{ kind: 'feature', value: { id: 'expert_divination', name: 'Expert Divination', description: 'When you cast a divination spell of 2nd level or higher using a slot, regain a spell slot of lower level than the one spent (no higher than 5th).', source: { kind: 'subclass', refId: 'divination' }, level: 6, effects: [], actions: [], choices: [], passive: true } }] },
    { level: 10, hpDie: 6, choices: [],
      grants: [
        { kind: 'resource', value: { resourceId: 'third_eye_pool', name: 'The Third Eye', maximum: 1, recharge: 'short_rest' } },
        { kind: 'feature', value: { id: 'the_third_eye', name: 'The Third Eye', description: 'As an action, choose one until incapacitated or a short/long rest: darkvision to 60 feet, sight onto the Ethereal Plane within 60 feet, the ability to read any language, or the ability to see invisible creatures/objects within 10 feet in your line of sight. Usable once per short or long rest.', source: { kind: 'subclass', refId: 'divination' }, level: 10, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'action', resourceCost: { resourceId: 'third_eye_pool', quantity: 1 }, range: 'self', target: 'self', requiresSave: null },
          abilityEffects: [] } },
      ] },
    { level: 14, hpDie: 6, choices: [], grants: [
      { kind: 'resource_upgrade', value: { resourceId: 'portent_pool', newMaximum: 3 } },
      { kind: 'feature', value: { id: 'greater_portent', name: 'Greater Portent', description: 'Roll three d20s for Portent instead of two.', source: { kind: 'subclass', refId: 'divination' }, level: 14, effects: [], actions: [], choices: [], passive: true } },
    ] },
  ],
};

// ── School of Enchantment ────────────────────────────────────────────────────
export const enchantmentProgression: SubclassProgression = {
  classId: 'wizard', name: 'School of Enchantment', srd: false,
  entries: [
    { level: 2, hpDie: 6, choices: [],
      grants: [
        { kind: 'resource', value: { resourceId: 'hypnotic_gaze_pool', name: 'Hypnotic Gaze', maximum: 1, recharge: 'long_rest' } },
        { kind: 'feature', value: { id: 'hypnotic_gaze', name: 'Hypnotic Gaze', description: 'As an action, target a creature within 5 feet that can see or hear you; on a failed Wisdom save it\'s charmed, incapacitated, and speed 0 until the end of your next turn. Maintain it on later turns with your action if you stay within 5 feet and it can still see/hear you and hasn\'t taken damage. Can\'t be used again on a creature that succeeded or broke free until a long rest.', source: { kind: 'subclass', refId: 'enchantment' }, level: 2, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'action', resourceCost: { resourceId: 'hypnotic_gaze_pool', quantity: 1 }, range: '5 feet', target: 'single', requiresSave: { ability: 'wis', dc: 'spell_save_dc' } },
          abilityEffects: [{ type: 'apply_condition', conditionId: 'charmed', duration: { unit: 'rounds', remaining: 1 } }] } },
      ] },
    { level: 6, hpDie: 6, choices: [], grants: [{ kind: 'feature', value: { id: 'instinctive_charm', name: 'Instinctive Charm', description: 'Before knowing whether an attack against you hits, use your reaction to force the attacker (if within 30 feet) to make a Wisdom save; on a failure it must retarget the closest other creature instead (its choice among ties). Creatures immune to being charmed are immune to this. On a success, can\'t be used on that attacker again until a long rest.', source: { kind: 'subclass', refId: 'enchantment' }, level: 6, effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'reaction', resourceCost: null, range: '30 feet', target: 'single', requiresSave: { ability: 'wis', dc: 'spell_save_dc' } },
      abilityEffects: [] } }] },
    { level: 10, hpDie: 6, choices: [], grants: [{ kind: 'feature', value: { id: 'split_enchantment', name: 'Split Enchantment', description: 'When you cast a single-target enchantment spell of 1st level or higher, have it target a second creature as well.', source: { kind: 'subclass', refId: 'enchantment' }, level: 10, effects: [], actions: [], choices: [], passive: true } }] },
    { level: 14, hpDie: 6, choices: [], grants: [{ kind: 'feature', value: { id: 'alter_memories', name: 'Alter Memories', description: 'When you charm a creature with an enchantment spell, it can remain unaware it was charmed. Once before the spell ends, use your action to force an Intelligence save against your spell save DC; on a failure it forgets a number of hours (up to the spell\'s duration) equal to 1 plus your Charisma modifier (minimum 1).', source: { kind: 'subclass', refId: 'enchantment' }, level: 14, effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'action', resourceCost: null, range: '30 feet', target: 'single', requiresSave: { ability: 'int', dc: 'spell_save_dc' } },
      abilityEffects: [] } }] },
  ],
};

// ── School of Illusion ───────────────────────────────────────────────────────
export const illusionProgression: SubclassProgression = {
  classId: 'wizard', name: 'School of Illusion', srd: false,
  entries: [
    { level: 2, hpDie: 6, choices: [], grants: [{ kind: 'feature', value: { id: 'improved_minor_illusion', name: 'Improved Minor Illusion', description: 'Learn the Minor Illusion cantrip (or a different wizard cantrip if you already know it); it doesn\'t count against your cantrips known. When you cast it, create both a sound and an image with the same casting.', source: { kind: 'subclass', refId: 'illusion' }, level: 2, effects: [
      { type: 'grant_spell', target: 'cantrip', operation: 'add', value: null, condition: null, cantripIds: ['minor_illusion'] },
    ], actions: [], choices: [], passive: true } }] },
    { level: 6, hpDie: 6, choices: [], grants: [{ kind: 'feature', value: { id: 'malleable_illusions', name: 'Malleable Illusions', description: 'While an illusion spell you cast with a duration of 1 minute or longer is ongoing, use your action to change its nature (within the spell\'s normal parameters), provided you can see it.', source: { kind: 'subclass', refId: 'illusion' }, level: 6, effects: [], actions: [], choices: [], passive: true } }] },
    { level: 10, hpDie: 6, choices: [],
      grants: [
        { kind: 'resource', value: { resourceId: 'illusory_self_pool', name: 'Illusory Self', maximum: 1, recharge: 'short_rest' } },
        { kind: 'feature', value: { id: 'illusory_self', name: 'Illusory Self', description: 'When a creature makes an attack roll against you, use your reaction to interpose an illusory duplicate; the attack automatically misses, then the illusion dissipates. Usable once per short or long rest.', source: { kind: 'subclass', refId: 'illusion' }, level: 10, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'reaction', resourceCost: { resourceId: 'illusory_self_pool', quantity: 1 }, range: 'self', target: 'self', requiresSave: null },
          abilityEffects: [] } },
      ] },
    { level: 14, hpDie: 6, choices: [], grants: [{ kind: 'feature', value: { id: 'illusory_reality', name: 'Illusory Reality', description: 'When you cast a 1st-level-or-higher illusion spell, use a bonus action to make one inanimate, nonmagical object within the illusion real for 1 minute; it can\'t deal damage or otherwise directly harm anyone.', source: { kind: 'subclass', refId: 'illusion' }, level: 14, effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'bonus_action', resourceCost: null, range: 'self', target: 'self', requiresSave: null },
      abilityEffects: [] } }] },
  ],
};

// ── School of Necromancy ─────────────────────────────────────────────────────
export const necromancyProgression: SubclassProgression = {
  classId: 'wizard', name: 'School of Necromancy', srd: false,
  entries: [
    { level: 2, hpDie: 6, choices: [], grants: [{ kind: 'feature', value: { id: 'grim_harvest', name: 'Grim Harvest', description: 'Once per turn when you kill a creature with a 1st-level-or-higher spell, regain hit points equal to twice the spell\'s level (three times if it\'s a necromancy spell). No benefit for killing constructs or undead. No on-kill trigger exists in the engine — apply manually.', source: { kind: 'subclass', refId: 'necromancy' }, level: 2, effects: [], actions: [], choices: [], passive: true } }] },
    { level: 6, hpDie: 6, choices: [], grants: [{ kind: 'feature', value: { id: 'undead_thralls', name: 'Undead Thralls', description: 'Add Animate Dead to your spellbook if it\'s not already there. When you cast it, target one additional corpse or bone pile. Undead you create with a necromancy spell gain extra HP equal to your wizard level and add your proficiency bonus to their weapon damage rolls.', source: { kind: 'subclass', refId: 'necromancy' }, level: 6, effects: [
      { type: 'grant_spell', target: 'known_spell', operation: 'add', value: null, condition: null, spellIds: ['animate_dead'] },
    ], actions: [], choices: [], passive: true } }] },
    { level: 10, hpDie: 6, choices: [], grants: [{ kind: 'feature', value: { id: 'inured_to_undeath', name: 'Inured to Undeath', description: 'Gain resistance to necrotic damage, and your hit point maximum can\'t be reduced.', source: { kind: 'subclass', refId: 'necromancy' }, level: 10, effects: [
      { type: 'grant_resistance', target: 'necrotic', operation: 'resistance', value: null, condition: null },
    ], actions: [], choices: [], passive: true } }] },
    { level: 14, hpDie: 6, choices: [], grants: [{ kind: 'feature', value: { id: 'command_undead', name: 'Command Undead', description: 'As an action, target one undead within 60 feet with a Charisma save against your spell save DC. On a failure, it becomes friendly and obeys your commands until you use this feature again; on a success it\'s immune to this feature from you thereafter. Undead with Intelligence 8+ have advantage on the save; those with Intelligence 12+ that fail can repeat the save hourly to break free.', source: { kind: 'subclass', refId: 'necromancy' }, level: 14, effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'action', resourceCost: null, range: '60 feet', target: 'single', requiresSave: { ability: 'cha', dc: 'spell_save_dc' } },
      abilityEffects: [] } }] },
  ],
};

// ── School of Transmutation ──────────────────────────────────────────────────
const TRANSMUTERS_STONE_POOL: ChoiceOption[] = [
  { id: 'darkvision', label: 'Darkvision', value: { id: 'transmuters_stone_darkvision', name: "Transmuter's Stone: Darkvision", description: 'While you possess the stone, gain darkvision to 60 feet.', source: { kind: 'subclass', refId: 'transmutation' }, level: null, effects: [{ type: 'grant_sense', target: 'senses', operation: 'add', value: null, condition: null, senseType: 'darkvision', senseRange: 60 }], actions: [], choices: [], passive: true } as Feature },
  { id: 'speed', label: 'Speed +10 ft (unencumbered)', value: { id: 'transmuters_stone_speed', name: "Transmuter's Stone: Speed", description: 'While you possess the stone and are unencumbered, gain +10 feet of speed.', source: { kind: 'subclass', refId: 'transmutation' }, level: null, effects: [{ type: 'stat_modifier', target: 'speed', operation: 'add', value: 10, condition: null }], actions: [], choices: [], passive: true } as Feature },
  { id: 'con_save', label: 'Constitution Save Proficiency', value: { id: 'transmuters_stone_con_save', name: "Transmuter's Stone: Constitution Saves", description: 'While you possess the stone, gain proficiency in Constitution saving throws. No saving-throw-proficiency grant hook exists in the engine yet — apply manually.', source: { kind: 'subclass', refId: 'transmutation' }, level: null, effects: [], actions: [], choices: [], passive: true } as Feature },
  { id: 'resistance', label: 'Resistance (acid/cold/fire/lightning/thunder, your choice)', value: { id: 'transmuters_stone_resistance', name: "Transmuter's Stone: Resistance", description: 'While you possess the stone, gain resistance to a damage type of your choice (acid, cold, fire, lightning, or thunder), reselectable whenever you cast a transmutation spell. No fixed damage type to hook here — apply manually.', source: { kind: 'subclass', refId: 'transmutation' }, level: null, effects: [], actions: [], choices: [], passive: true } as Feature },
];
export const transmutationProgression: SubclassProgression = {
  classId: 'wizard', name: 'School of Transmutation', srd: false,
  entries: [
    { level: 2, hpDie: 6, choices: [], grants: [{ kind: 'feature', value: { id: 'minor_alchemy', name: 'Minor Alchemy', description: 'Spend 10 minutes per cubic foot (up to 1 hour) to temporarily transform a nonmagical wood, stone, iron, copper, or silver object into a different one of those materials; it reverts after 1 hour or when your concentration ends.', source: { kind: 'subclass', refId: 'transmutation' }, level: 2, effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'action', resourceCost: null, range: 'self', target: 'self', requiresSave: null },
      abilityEffects: [] } }] },
    { level: 6, hpDie: 6,
      choices: [{ id: 'transmuters_stone_6', prompt: "Choose your Transmuter's Stone benefit.", kind: 'feature_pool', count: 1, pool: TRANSMUTERS_STONE_POOL, grants: [], required: true, resolved: false }],
      grants: [
        { kind: 'resource', value: { resourceId: 'transmuters_stone_pool', name: "Transmuter's Stone", maximum: 1, recharge: 'long_rest' } },
        { kind: 'feature', value: { id: 'transmuters_stone', name: "Transmuter's Stone", description: 'Spend 8 hours creating a transmuter\'s stone that grants a chosen benefit to whoever possesses it (see the chosen option below). You can change the benefit whenever you cast a transmutation spell of 1st level or higher while the stone is on your person. Creating a new stone destroys the previous one. Usable once per long rest.', source: { kind: 'subclass', refId: 'transmutation' }, level: 6, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'free', resourceCost: { resourceId: 'transmuters_stone_pool', quantity: 1 }, range: 'self', target: 'self', requiresSave: null },
          abilityEffects: [] } },
      ] },
    { level: 10, hpDie: 6, choices: [],
      grants: [
        { kind: 'resource', value: { resourceId: 'shapechanger_pool', name: 'Shapechanger', maximum: 1, recharge: 'short_rest' } },
        { kind: 'feature', value: { id: 'shapechanger', name: 'Shapechanger', description: 'Add Polymorph to your spellbook if it\'s not already there. Cast it on yourself without a spell slot, transforming into a beast of CR 1 or lower. Usable once per short or long rest (you can still cast it normally with a slot).', source: { kind: 'subclass', refId: 'transmutation' }, level: 10, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'action', resourceCost: { resourceId: 'shapechanger_pool', quantity: 1 }, range: 'self', target: 'self', requiresSave: null },
          abilityEffects: [{ type: 'cast_spell', spellId: 'polymorph' }] } },
      ] },
    { level: 14, hpDie: 6, choices: [],
      grants: [
        { kind: 'resource', value: { resourceId: 'master_transmuter_pool', name: 'Master Transmuter', maximum: 1, recharge: 'long_rest' } },
        { kind: 'feature', value: { id: 'master_transmuter', name: 'Master Transmuter', description: 'As an action, consume your transmuter\'s stone (destroying it until your next long rest) for one effect: transmute a nonmagical object (up to a 5-foot cube) into another of similar size/value (10 minutes handling); remove all curses, diseases, and poisons and restore all HP to a creature you touch with the stone; cast Raise Dead on a creature you touch with the stone, without a slot or needing the spell known; or reduce a willing creature\'s apparent age by 3d10 years (minimum 13) without extending its lifespan.', source: { kind: 'subclass', refId: 'transmutation' }, level: 14, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'action', resourceCost: { resourceId: 'master_transmuter_pool', quantity: 1 }, range: 'self', target: 'self', requiresSave: null },
          abilityEffects: [] } },
      ] },
  ],
};

// ── War Magic ─────────────────────────────────────────────────────────────────
export const warMagicProgression: SubclassProgression = {
  classId: 'wizard', name: 'War Magic', srd: false,
  entries: [
    { level: 2, hpDie: 6, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'arcane_deflection', name: 'Arcane Deflection', description: 'When hit by an attack or you fail a saving throw, use your reaction to gain a +2 bonus to AC against that attack or +4 to that save. Until the end of your next turn, you can cast only cantrips.', source: { kind: 'subclass', refId: 'war_magic' }, level: 2, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'reaction', resourceCost: null, range: 'self', target: 'self', requiresSave: null },
          abilityEffects: [] } },
        { kind: 'feature', value: { id: 'tactical_wit', name: 'Tactical Wit', description: 'Add your Intelligence modifier to initiative rolls. No formula slot exists for this — apply manually.', source: { kind: 'subclass', refId: 'war_magic' }, level: 2, effects: [], actions: [], choices: [], passive: true } },
      ] },
    { level: 6, hpDie: 6, choices: [],
      grants: [
        { kind: 'resource', value: { resourceId: 'power_surge_pool', name: 'Power Surges (scales with Intelligence modifier; resets to 1 on long rest)', maximum: 1, recharge: 'long_rest' } },
        { kind: 'feature', value: { id: 'power_surge', name: 'Power Surge', description: 'Store power surges (max equal to your Intelligence modifier, minimum one); resets to one on a long rest, gains one when you end a spell with Dispel Magic/Counterspell or finish a short rest with none. Once per turn on a hit with a wizard spell, spend a surge to add extra force damage equal to half your wizard level. Flat level-based damage has no die to attach — apply manually.', source: { kind: 'subclass', refId: 'war_magic' }, level: 6, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'free', resourceCost: { resourceId: 'power_surge_pool', quantity: 1 }, range: '5 feet', target: 'single', requiresSave: null },
          abilityEffects: [] } },
      ] },
    { level: 10, hpDie: 6, choices: [], grants: [{ kind: 'feature', value: { id: 'durable_magic', name: 'Durable Magic', description: 'While concentrating on a spell, gain a +2 bonus to AC and all saving throws.', source: { kind: 'subclass', refId: 'war_magic' }, level: 10, effects: [], actions: [], choices: [], passive: true } }] },
    { level: 14, hpDie: 6, choices: [], grants: [{ kind: 'feature', value: { id: 'deflecting_shroud', name: 'Deflecting Shroud', description: 'Whenever you use Arcane Deflection, up to three creatures you choose within 60 feet each take force damage equal to half your wizard level. Flat level-based damage has no die to attach — apply manually.', source: { kind: 'subclass', refId: 'war_magic' }, level: 14, effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'free', resourceCost: null, range: '60 feet', target: 'multiple', requiresSave: null },
      abilityEffects: [] } }] },
  ],
};

export const WIZARD_SUBCLASSES: SubclassProgression[] = [
  evocationProgression, abjurationProgression, bladesingingProgression, chronurgyProgression,
  graviturgyProgression, orderOfScribesProgression, conjurationProgression, divinationProgression,
  enchantmentProgression, illusionProgression, necromancyProgression, transmutationProgression,
  warMagicProgression,
];
