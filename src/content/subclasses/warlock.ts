// ============================================================================
// FILE: src/content/subclasses/warlock.ts
// Warlock subclasses: The Fiend, The Great Old One, The Archfey, The
// Celestial, The Fathomless, The Genie, The Hexblade, The Undead, The
// Undying
//
// Expanded spell lists: every patron below widens which spells you may pick
// when you learn a warlock spell (not an auto-granted bonus spell like
// Cleric domains or Paladin oaths) — there's no choice-filtering mechanism
// in the engine for "expand the selectable pool," so these stay descriptive
// for all patrons, old and new alike, regardless of spell-library coverage.
//
// Product Identity: "Evard's Black Tentacles" and "Bigby's Hand" are WotC
// Product Identity names (per this codebase's existing renaming of the
// former to plain "Black Tentacles" in spellBlackTentacles, see
// spells/level4.ts) — kept out of this file's original-wording descriptions
// for the same reason, even where source material used them.
// ============================================================================
import { ClassProgression } from '../../engine/types';

export type SubclassProgression = ClassProgression & { name: string };

export const fiendProgression: SubclassProgression = {
  classId: 'warlock', name: 'The Fiend', srd: true,
  entries: [
    { level: 1, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'dark_ones_blessing', name: "Dark One's Blessing", description: 'When you reduce a hostile creature to 0 HP, gain temporary HP equal to your CHA modifier + warlock level (min 1).', source: { kind: 'subclass', refId: 'fiend' }, level: 1, effects: [], actions: [], choices: [], passive: true } }] },
    { level: 6, hpDie: 8, choices: [], grants: [
      { kind: 'feature', value: { id: 'dark_ones_own_luck', name: "Dark One's Own Luck", description: 'Spend 1 use to add 1d10 to an ability check or saving throw.', source: { kind: 'subclass', refId: 'fiend' }, level: 6, effects: [], actions: [], choices: [], passive: false,
        activation: { actionType: 'free', resourceCost: { resourceId: 'dark_ones_own_luck_pool', quantity: 1 }, range: 'self', target: 'self', requiresSave: null },
        abilityEffects: [],
      } },
      { kind: 'resource', value: { resourceId: 'dark_ones_own_luck_pool', name: "Dark One's Own Luck", maximum: 1, recharge: 'short_rest' } },
    ] },
    { level: 10, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'fiendish_resilience', name: 'Fiendish Resilience', description: 'After a short or long rest, choose one damage type. Gain resistance to that type until you choose another. Which type is chosen isn\'t fixed ahead of time, so no resistance Effect is pre-applied here — track the current choice manually.', source: { kind: 'subclass', refId: 'fiend' }, level: 10, effects: [], actions: [], choices: [], passive: true } }] },
    { level: 14, hpDie: 8, choices: [], grants: [
      { kind: 'feature', value: { id: 'hurl_through_hell', name: 'Hurl Through Hell', description: 'When you hit a creature with an attack, banish it through lower planes until end of your next turn; it takes 10d10 psychic damage on return (no save). Modeled here as an immediate damage rider rather than an end-of-next-turn delayed effect — the engine has no delayed-trigger system — a disclosed simplification.', source: { kind: 'subclass', refId: 'fiend' }, level: 14, effects: [], actions: [], choices: [], passive: false,
        activation: { actionType: 'free', resourceCost: { resourceId: 'hurl_through_hell_pool', quantity: 1 }, range: '5 feet', target: 'single', requiresSave: null },
        abilityEffects: [{ type: 'damage', dice: '10d10', damageType: 'psychic' }],
      } },
      { kind: 'resource', value: { resourceId: 'hurl_through_hell_pool', name: 'Hurl Through Hell', maximum: 1, recharge: 'long_rest' } },
    ] },
  ],
};

export const greatOldOneProgression: SubclassProgression = {
  classId: 'warlock', name: 'The Great Old One',
  // CONFIRMED correct via direct verification against the actual SRD 5.1
  // text (5thsrd.org) on 2026-08-04: the Warlock page fully details only
  // "The Fiend" — Great Old One appears solely as flavor text within the
  // Fiend's own Pact Boon description ("If your patron is the Great Old
  // One, your weapon might be..."), not as its own detailed subclass
  // section. Confirmed non-SRD.
  srd: false,
  entries: [
    { level: 1, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'awakened_mind', name: 'Awakened Mind', description: 'Telepathically communicate with any creature within 30 feet that you can see. No shared language needed. Creature can\'t respond unless it has telepathy.', source: { kind: 'subclass', refId: 'great_old_one' }, level: 1, effects: [], actions: [], choices: [], passive: true } }] },
    { level: 6, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'entropic_ward', name: 'Entropic Ward', description: 'React to impose disadvantage on an attack roll against you. If it misses, gain advantage on your next attack against that creature this turn. Once per short or long rest.', source: { kind: 'subclass', refId: 'great_old_one' }, level: 6, effects: [], actions: [], choices: [], passive: false, activation: { actionType: 'reaction', resourceCost: { resourceId: 'entropic_ward_pool', quantity: 1 }, range: 'self', target: 'self', requiresSave: null } } }, { kind: 'resource', value: { resourceId: 'entropic_ward_pool', name: 'Entropic Ward', maximum: 1, recharge: 'short_rest' } }] },
    { level: 10, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'thought_shield', name: 'Thought Shield', description: 'Your thoughts can\'t be read by telepathy or other means. Resistance to psychic damage. When a creature deals psychic damage to you, it takes the same amount.', source: { kind: 'subclass', refId: 'great_old_one' }, level: 10, effects: [{ type: 'grant_resistance', target: 'psychic', operation: 'resistance', value: null, condition: null }], actions: [], choices: [], passive: true } }] },
    { level: 14, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'create_thrall', name: 'Create Thrall', description: 'Touch an incapacitated humanoid to charm it until a remove curse spell is cast on it. The charmed target obeys your commands and you can communicate telepathically at any distance.', source: { kind: 'subclass', refId: 'great_old_one' }, level: 14, effects: [], actions: [], choices: [], passive: false, activation: { actionType: 'action', resourceCost: null, range: 'touch', target: 'single', requiresSave: null } } }] },
  ],
};

// ── The Archfey ──────────────────────────────────────────────────────────────
export const archfeyProgression: SubclassProgression = {
  classId: 'warlock', name: 'The Archfey', srd: false,
  entries: [
    { level: 1, hpDie: 8, choices: [],
      grants: [
        { kind: 'resource', value: { resourceId: 'fey_presence_pool', name: 'Fey Presence', maximum: 1, recharge: 'short_rest' } },
        { kind: 'feature', value: { id: 'fey_presence', name: 'Fey Presence', description: 'As an action, each creature in a 10-foot cube from you makes a Wisdom save against your spell save DC or is charmed or frightened by you (your choice) until the end of your next turn. Usable once per short or long rest.', source: { kind: 'subclass', refId: 'archfey' }, level: 1, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'action', resourceCost: { resourceId: 'fey_presence_pool', quantity: 1 }, range: '10 feet', target: 'area', requiresSave: { ability: 'wis', dc: 'spell_save_dc' } },
          abilityEffects: [{ type: 'apply_condition', conditionId: 'frightened', duration: { unit: 'rounds', remaining: 1 } }] } },
      ] },
    { level: 6, hpDie: 8, choices: [],
      grants: [
        { kind: 'resource', value: { resourceId: 'misty_escape_pool', name: 'Misty Escape', maximum: 1, recharge: 'short_rest' } },
        { kind: 'feature', value: { id: 'misty_escape', name: 'Misty Escape', description: 'When you take damage, use your reaction to turn invisible and teleport up to 60 feet to an unoccupied space you can see, remaining invisible until the start of your next turn or until you attack or cast a spell. Usable once per short or long rest.', source: { kind: 'subclass', refId: 'archfey' }, level: 6, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'reaction', resourceCost: { resourceId: 'misty_escape_pool', quantity: 1 }, range: 'self', target: 'self', requiresSave: null },
          abilityEffects: [{ type: 'apply_condition', conditionId: 'invisible', duration: { unit: 'rounds', remaining: 1 } }] } },
      ] },
    { level: 10, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'beguiling_defenses', name: 'Beguiling Defenses', description: 'You\'re immune to being charmed. When a creature tries to charm you, use your reaction to force a Wisdom save against your spell save DC; on a failure it\'s charmed by you for 1 minute or until it takes damage.', source: { kind: 'subclass', refId: 'archfey' }, level: 10, effects: [
      { type: 'condition_immunity', target: 'charmed', operation: 'immunity', value: null, condition: null },
    ], actions: [], choices: [], passive: true } }] },
    { level: 14, hpDie: 8, choices: [],
      grants: [
        { kind: 'resource', value: { resourceId: 'dark_delirium_pool', name: 'Dark Delirium', maximum: 1, recharge: 'short_rest' } },
        { kind: 'feature', value: { id: 'dark_delirium', name: 'Dark Delirium', description: 'As an action, target a creature within 60 feet with a Wisdom save against your spell save DC; on a failure it\'s charmed or frightened by you (your choice) for 1 minute or until your concentration breaks, believing itself lost in an illusory misty realm that only it, you, and the illusion inhabit. Ends early if it takes damage. Usable once per short or long rest.', source: { kind: 'subclass', refId: 'archfey' }, level: 14, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'action', resourceCost: { resourceId: 'dark_delirium_pool', quantity: 1 }, range: '60 feet', target: 'single', requiresSave: { ability: 'wis', dc: 'spell_save_dc' } },
          abilityEffects: [{ type: 'apply_condition', conditionId: 'frightened', duration: { unit: 'minutes', remaining: 1 } }] } },
      ] },
  ],
};

// ── The Celestial ────────────────────────────────────────────────────────────
export const celestialProgression: SubclassProgression = {
  classId: 'warlock', name: 'The Celestial', srd: false,
  entries: [
    { level: 1, hpDie: 8, choices: [],
      grants: [
        { kind: 'resource', value: { resourceId: 'healing_light_pool', name: 'Healing Light (dice equal to 1 + warlock level)', maximum: 2, recharge: 'long_rest' } },
        { kind: 'feature', value: { id: 'bonus_cantrips_celestial', name: 'Bonus Cantrips', description: 'Learn the Light and Sacred Flame cantrips; they count as warlock cantrips but don\'t count against your cantrips known.', source: { kind: 'subclass', refId: 'celestial' }, level: 1, effects: [
          { type: 'grant_spell', target: 'cantrip', operation: 'add', value: null, condition: null, cantripIds: ['light', 'sacred_flame'] },
        ], actions: [], choices: [], passive: true } },
        { kind: 'feature', value: { id: 'healing_light', name: 'Healing Light', description: 'As a bonus action, spend d6s from a pool (size 1 + your warlock level) to heal a creature within 60 feet, up to your Charisma modifier (minimum one) dice at once. Roll and restore that total. Pool refills on a long rest.', source: { kind: 'subclass', refId: 'celestial' }, level: 1, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'bonus_action', resourceCost: { resourceId: 'healing_light_pool', quantity: 1 }, range: '60 feet', target: 'single', requiresSave: null },
          abilityEffects: [{ type: 'heal', dice: '1d6' }] } },
      ] },
    { level: 6, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'radiant_soul', name: 'Radiant Soul', description: 'Gain resistance to radiant damage. When you cast a spell that deals radiant or fire damage, add your Charisma modifier to one damage roll of that spell against one target. No formula slot exists for that conditional CHA-to-damage bonus — apply manually.', source: { kind: 'subclass', refId: 'celestial' }, level: 6, effects: [
      { type: 'grant_resistance', target: 'radiant', operation: 'resistance', value: null, condition: null },
    ], actions: [], choices: [], passive: true } }] },
    { level: 10, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'celestial_resistance', name: 'Celestial Resistance', description: 'At the end of a short or long rest, gain temporary hit points equal to your warlock level plus your Charisma modifier, and grant up to five creatures you choose temporary hit points equal to half your warlock level plus your Charisma modifier. No end-of-rest trigger exists in the engine — apply manually.', source: { kind: 'subclass', refId: 'celestial' }, level: 10, effects: [], actions: [], choices: [], passive: true } }] },
    { level: 14, hpDie: 8, choices: [],
      grants: [
        { kind: 'resource', value: { resourceId: 'searing_vengeance_pool', name: 'Searing Vengeance', maximum: 1, recharge: 'long_rest' } },
        { kind: 'feature', value: { id: 'searing_vengeance', name: 'Searing Vengeance', description: 'Instead of making a death saving throw, spring back up with half your hit point maximum restored (the heal amount has no fixed die — apply it manually). Each creature you choose within 30 feet takes 2d8 plus your Charisma modifier radiant damage and is blinded until the end of the turn. Usable once per long rest.', source: { kind: 'subclass', refId: 'celestial' }, level: 14, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'free', resourceCost: { resourceId: 'searing_vengeance_pool', quantity: 1 }, range: '30 feet', target: 'multiple', requiresSave: null },
          abilityEffects: [{ type: 'damage', dice: '2d8', damageType: 'radiant' }, { type: 'apply_condition', conditionId: 'blinded', duration: { unit: 'rounds', remaining: 1 } }] } },
      ] },
  ],
};

// ── The Fathomless ───────────────────────────────────────────────────────────
export const fathomlessProgression: SubclassProgression = {
  classId: 'warlock', name: 'The Fathomless', srd: false,
  entries: [
    { level: 1, hpDie: 8, choices: [],
      grants: [
        { kind: 'resource', value: { resourceId: 'tentacle_of_deep_pool', name: 'Tentacle of the Deep (scales with proficiency bonus)', maximum: 1, recharge: 'long_rest' } },
        { kind: 'feature', value: { id: 'tentacle_of_the_deep', name: 'Tentacle of the Deep', description: 'As a bonus action, conjure a 10-foot spectral tentacle at a point within 60 feet, lasting 1 minute (replaced if you conjure another). On conjuring, make a melee spell attack against a creature within 10 feet of it, dealing 1d8 cold damage (2d8 at level 10) and reducing its speed by 10 feet until the start of your next turn. As a bonus action, move the tentacle 30 feet and attack again. Usable a number of times equal to your proficiency bonus per long rest — tracked here as a single-use pool; increase its maximum to match.', source: { kind: 'subclass', refId: 'fathomless' }, level: 1, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'bonus_action', resourceCost: { resourceId: 'tentacle_of_deep_pool', quantity: 1 }, range: '60 feet', target: 'single', requiresSave: null },
          abilityEffects: [{ type: 'damage', dice: '1d8', damageType: 'cold' }] } },
        { kind: 'feature', value: { id: 'gift_of_the_sea', name: 'Gift of the Sea', description: 'Gain a 40-foot swimming speed and the ability to breathe underwater.', source: { kind: 'subclass', refId: 'fathomless' }, level: 1, effects: [
          { type: 'grant_movement', target: 'movement', operation: 'add', value: null, condition: null, movementType: 'swim', movementRange: 40 },
        ], actions: [], choices: [], passive: true } },
      ] },
    { level: 6, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'oceanic_soul', name: 'Oceanic Soul', description: 'Gain resistance to cold damage. While fully submerged, any other fully submerged creature can understand your speech and you can understand theirs.', source: { kind: 'subclass', refId: 'fathomless' }, level: 6, effects: [
          { type: 'grant_resistance', target: 'cold', operation: 'resistance', value: null, condition: null },
        ], actions: [], choices: [], passive: true } },
        { kind: 'feature', value: { id: 'guardian_coil', name: 'Guardian Coil', description: 'When you or a creature you can see within 10 feet of your tentacle takes damage, use your reaction to reduce that damage by 1d8 (2d8 at level 10).', source: { kind: 'subclass', refId: 'fathomless' }, level: 6, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'reaction', resourceCost: null, range: '10 feet', target: 'single', requiresSave: null },
          abilityEffects: [] } },
      ] },
    { level: 10, hpDie: 8, choices: [],
      grants: [
        { kind: 'resource', value: { resourceId: 'grasping_tentacles_pool', name: 'Grasping Tentacles', maximum: 1, recharge: 'long_rest' } },
        { kind: 'feature', value: { id: 'grasping_tentacles', name: 'Grasping Tentacles', description: 'Learn the Black Tentacles spell (counts as a warlock spell, doesn\'t count against spells known); cast it once free per long rest. Whenever you cast it, gain temporary hit points equal to your warlock level, and damage can\'t break your concentration on it.', source: { kind: 'subclass', refId: 'fathomless' }, level: 10, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'action', resourceCost: { resourceId: 'grasping_tentacles_pool', quantity: 1 }, range: '90 feet', target: 'area', requiresSave: null },
          abilityEffects: [{ type: 'cast_spell', spellId: 'black_tentacles' }] } },
      ] },
    { level: 14, hpDie: 8, choices: [],
      grants: [
        { kind: 'resource', value: { resourceId: 'fathomless_plunge_pool', name: 'Fathomless Plunge', maximum: 1, recharge: 'short_rest' } },
        { kind: 'feature', value: { id: 'fathomless_plunge', name: 'Fathomless Plunge', description: 'As an action, teleport yourself and up to five willing creatures within 30 feet to a body of water you\'ve seen (pond-sized or larger) up to 1 mile away, or within 30 feet of it. Usable once per short or long rest.', source: { kind: 'subclass', refId: 'fathomless' }, level: 14, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'action', resourceCost: { resourceId: 'fathomless_plunge_pool', quantity: 1 }, range: '30 feet', target: 'multiple', requiresSave: null },
          abilityEffects: [] } },
      ] },
  ],
};

// ── The Genie ────────────────────────────────────────────────────────────────
// Genie's Wrath and Elemental Gift's resistance both depend on the chosen
// genie kind (dao/djinni/efreeti/marid), each with a different damage type —
// no fixed target string fits all four, so those stay description-only; the
// flying-speed half of Elemental Gift is kind-independent and gets a real
// hook.
export const genieProgression: SubclassProgression = {
  classId: 'warlock', name: 'The Genie', srd: false,
  entries: [
    { level: 1, hpDie: 8, choices: [],
      grants: [
        { kind: 'resource', value: { resourceId: 'bottled_respite_pool', name: 'Bottled Respite', maximum: 1, recharge: 'long_rest' } },
        { kind: 'feature', value: { id: 'bottled_respite', name: 'Bottled Respite', description: 'As an action, vanish into your Genie\'s Vessel (a Tiny object serving as your spellcasting focus), a comfortable 20-foot-radius extradimensional cylinder, for up to twice your proficiency bonus in hours. Exit early with a bonus action, on death, or if the vessel is destroyed. Usable once per long rest.', source: { kind: 'subclass', refId: 'genie' }, level: 1, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'action', resourceCost: { resourceId: 'bottled_respite_pool', quantity: 1 }, range: 'self', target: 'self', requiresSave: null },
          abilityEffects: [] } },
        { kind: 'feature', value: { id: 'genies_wrath', name: "Genie's Wrath", description: 'Once per turn on a hit, deal extra damage equal to your proficiency bonus, of a type set by your patron\'s kind (bludgeoning for dao, thunder for djinni, fire for efreeti, cold for marid). No fixed damage type to hook here — apply manually based on your chosen kind.', source: { kind: 'subclass', refId: 'genie' }, level: 1, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'free', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
          abilityEffects: [] } },
      ] },
    { level: 6, hpDie: 8, choices: [],
      grants: [
        { kind: 'resource', value: { resourceId: 'elemental_gift_pool', name: 'Elemental Gift: Wings (scales with proficiency bonus)', maximum: 1, recharge: 'long_rest' } },
        { kind: 'feature', value: { id: 'elemental_gift', name: 'Elemental Gift', description: 'Gain resistance to a damage type set by your patron\'s kind (bludgeoning/thunder/fire/cold). No fixed damage type to hook here — apply manually based on your chosen kind.', source: { kind: 'subclass', refId: 'genie' }, level: 6, effects: [], actions: [], choices: [], passive: true } },
        { kind: 'feature', value: { id: 'elemental_gift_wings', name: 'Elemental Gift: Wings', description: 'As a bonus action, gain a 30-foot flying speed with hover for 10 minutes. Usable a number of times equal to your proficiency bonus per long rest — tracked here as a single-use pool; increase its maximum to match.', source: { kind: 'subclass', refId: 'genie' }, level: 6, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'bonus_action', resourceCost: { resourceId: 'elemental_gift_pool', quantity: 1 }, range: 'self', target: 'self', requiresSave: null },
          abilityEffects: [{ type: 'grant_speed', speedType: 'fly', amount: 30, duration: { unit: 'minutes', remaining: 10 } }] } },
      ] },
    { level: 10, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'sanctuary_vessel', name: 'Sanctuary Vessel', description: 'When you use Bottled Respite, bring up to five willing creatures within 30 feet into the vessel with you; eject any as a bonus action. Occupants who stay 10+ minutes gain the benefit of a short rest, adding your proficiency bonus to Hit Dice spent there.', source: { kind: 'subclass', refId: 'genie' }, level: 10, effects: [], actions: [], choices: [], passive: true } }] },
    { level: 14, hpDie: 8, choices: [],
      grants: [
        { kind: 'resource', value: { resourceId: 'limited_wish_pool', name: 'Limited Wish', maximum: 1, recharge: '1d4 long rests' } },
        { kind: 'feature', value: { id: 'limited_wish', name: 'Limited Wish', description: 'As an action, speak your desire to your vessel to request the effect of any 1-action-casting-time spell of 6th level or lower from any class\'s spell list, ignoring its normal requirements including costly components. Usable once per 1d4 long rests.', source: { kind: 'subclass', refId: 'genie' }, level: 14, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'action', resourceCost: { resourceId: 'limited_wish_pool', quantity: 1 }, range: 'self', target: 'self', requiresSave: null },
          abilityEffects: [] } },
      ] },
  ],
};

// ── The Hexblade ─────────────────────────────────────────────────────────────
// Hex Warrior's armor/weapon proficiencies stay description-only, matching
// the existing precedent already in this codebase (College of Valor's and
// College of Swords' Bonus Proficiencies) rather than inventing an unread
// grant_proficiency target string for armor/weapon categories.
export const hexbladeProgression: SubclassProgression = {
  classId: 'warlock', name: 'The Hexblade', srd: false,
  entries: [
    { level: 1, hpDie: 8, choices: [],
      grants: [
        { kind: 'resource', value: { resourceId: 'hexblades_curse_pool', name: "Hexblade's Curse", maximum: 1, recharge: 'short_rest' } },
        { kind: 'feature', value: { id: 'hexblades_curse', name: "Hexblade's Curse", description: 'As a bonus action, curse a creature within 30 feet for 1 minute (ends early if it or you die or you\'re incapacitated): gain a bonus to damage rolls against it equal to your proficiency bonus, score a critical hit against it on a 19-20, and regain HP equal to your warlock level plus Charisma modifier (min 1) if it dies. Usable once per short or long rest.', source: { kind: 'subclass', refId: 'hexblade' }, level: 1, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'bonus_action', resourceCost: { resourceId: 'hexblades_curse_pool', quantity: 1 }, range: '30 feet', target: 'single', requiresSave: null },
          abilityEffects: [] } },
        { kind: 'feature', value: { id: 'hex_warrior', name: 'Hex Warrior', description: 'Gain proficiency with medium armor, shields, and martial weapons. After a long rest, touch a proficient one-handed weapon to use your Charisma modifier for its attack and damage rolls until your next long rest (extends to all Pact of the Blade weapons if you later gain that feature).', source: { kind: 'subclass', refId: 'hexblade' }, level: 1, effects: [], actions: [], choices: [], passive: true } },
      ] },
    { level: 6, hpDie: 8, choices: [],
      grants: [
        { kind: 'resource', value: { resourceId: 'accursed_specter_pool', name: 'Accursed Specter', maximum: 1, recharge: 'long_rest' } },
        { kind: 'feature', value: { id: 'accursed_specter', name: 'Accursed Specter', description: 'When you slay a humanoid, bind its spirit as a specter (Monster Manual statistics) with temporary hit points equal to half your warlock level and a bonus to its attack rolls equal to your Charisma modifier. It obeys your commands until your next long rest ends. Usable once per long rest.', source: { kind: 'subclass', refId: 'hexblade' }, level: 6, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'free', resourceCost: { resourceId: 'accursed_specter_pool', quantity: 1 }, range: '5 feet', target: 'single', requiresSave: null },
          abilityEffects: [] } },
      ] },
    { level: 10, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'armor_of_hexes', name: 'Armor of Hexes', description: 'If the target of your Hexblade\'s Curse hits you with an attack, use your reaction to roll a d6; on a 4 or higher, the attack instead misses regardless of its roll.', source: { kind: 'subclass', refId: 'hexblade' }, level: 10, effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'reaction', resourceCost: null, range: 'self', target: 'self', requiresSave: null },
      abilityEffects: [] } }] },
    { level: 14, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'master_of_hexes', name: 'Master of Hexes', description: 'When the creature cursed by your Hexblade\'s Curse dies, apply the curse to a different creature you can see within 30 feet, provided you\'re not incapacitated (no HP regained from this transfer).', source: { kind: 'subclass', refId: 'hexblade' }, level: 14, effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'free', resourceCost: null, range: '30 feet', target: 'single', requiresSave: null },
      abilityEffects: [] } }] },
  ],
};

// ── The Undead ───────────────────────────────────────────────────────────────
export const undeadProgression: SubclassProgression = {
  classId: 'warlock', name: 'The Undead', srd: false,
  entries: [
    { level: 1, hpDie: 8, choices: [],
      grants: [
        { kind: 'resource', value: { resourceId: 'form_of_dread_pool', name: 'Form of Dread (scales with proficiency bonus)', maximum: 1, recharge: 'long_rest' } },
        { kind: 'feature', value: { id: 'form_of_dread', name: 'Form of Dread', description: 'As a bonus action, transform for 1 minute: gain temporary hit points equal to 1d10 plus your warlock level, and become immune to the frightened condition. Usable a number of times equal to your proficiency bonus per long rest — tracked here as a single-use pool; increase its maximum to match.', source: { kind: 'subclass', refId: 'undead' }, level: 1, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'bonus_action', resourceCost: { resourceId: 'form_of_dread_pool', quantity: 1 }, range: 'self', target: 'self', requiresSave: null },
          abilityEffects: [] } },
        { kind: 'feature', value: { id: 'form_of_dread_dreadful_strike', name: 'Form of Dread: Dreadful Strike', description: 'Once per turn while transformed, when you hit with an attack, force a Wisdom save or frighten the target of you until the end of your next turn.', source: { kind: 'subclass', refId: 'undead' }, level: 1, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'free', resourceCost: null, range: '5 feet', target: 'single', requiresSave: { ability: 'wis', dc: 'spell_save_dc' } },
          abilityEffects: [{ type: 'apply_condition', conditionId: 'frightened', duration: { unit: 'rounds', remaining: 1 } }] } },
      ] },
    { level: 6, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'grave_touched', name: 'Grave Touched', description: 'You don\'t need to eat, drink, or breathe. Once per turn on a hit, replace the damage type with necrotic (rolling one extra damage die while transformed with Form of Dread).', source: { kind: 'subclass', refId: 'undead' }, level: 6, effects: [], actions: [], choices: [], passive: true } }] },
    { level: 10, hpDie: 8, choices: [],
      grants: [
        { kind: 'resource', value: { resourceId: 'necrotic_husk_pool', name: 'Necrotic Husk', maximum: 1, recharge: 'never' } },
        { kind: 'feature', value: { id: 'necrotic_husk', name: 'Necrotic Husk', description: 'Gain resistance to necrotic damage (immunity while transformed with Form of Dread). When reduced to 0 hit points, use your reaction to drop to 1 HP instead and erupt with necrotic energy: creatures you choose within 30 feet take 2d10 plus your warlock level necrotic damage, and you gain a level of exhaustion. Usable once per 1d4 long rests.', source: { kind: 'subclass', refId: 'undead' }, level: 10, effects: [
          { type: 'grant_resistance', target: 'necrotic', operation: 'resistance', value: null, condition: null },
        ], actions: [], choices: [], passive: false,
          activation: { actionType: 'reaction', resourceCost: { resourceId: 'necrotic_husk_pool', quantity: 1 }, range: '30 feet', target: 'multiple', requiresSave: null },
          abilityEffects: [{ type: 'damage', dice: '2d10', damageType: 'necrotic' }] } },
      ] },
    { level: 14, hpDie: 8, choices: [],
      grants: [
        { kind: 'resource', value: { resourceId: 'spirit_projection_pool', name: 'Spirit Projection', maximum: 1, recharge: 'long_rest' } },
        { kind: 'feature', value: { id: 'spirit_projection', name: 'Spirit Projection', description: 'As an action, project your spirit (replicating your statistics, not your gear) from your unconscious, suspended body for up to 1 hour or until your concentration breaks. While projecting, you and your body both gain resistance to bludgeoning/piercing/slashing damage, conjuration and necromancy spells need no verbal, somatic, or non-gold material components, you gain a flying speed equal to your walking speed with hover and can move through creatures/objects as difficult terrain (1d10 force damage if you end your turn inside one), and while transformed with Form of Dread you heal half of any necrotic damage you deal. Usable once per long rest.', source: { kind: 'subclass', refId: 'undead' }, level: 14, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'action', resourceCost: { resourceId: 'spirit_projection_pool', quantity: 1 }, range: 'self', target: 'self', requiresSave: null },
          abilityEffects: [{ type: 'grant_speed', speedType: 'fly', amount: 30, duration: { unit: 'hours', remaining: 1 } }] } },
      ] },
  ],
};

// ── The Undying ──────────────────────────────────────────────────────────────
export const undyingProgression: SubclassProgression = {
  classId: 'warlock', name: 'The Undying', srd: false,
  entries: [
    { level: 1, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'among_the_dead', name: 'Among the Dead', description: 'Learn the Spare the Dying cantrip (counts as a warlock cantrip). Gain advantage on saves against disease. When an undead directly targets you with an attack or harmful spell, it makes a Wisdom save against your spell save DC or must retarget/forfeit; success or targeting it yourself grants either of you 24 hours\' immunity to this effect.', source: { kind: 'subclass', refId: 'undying' }, level: 1, effects: [
          { type: 'grant_spell', target: 'cantrip', operation: 'add', value: null, condition: null, cantripIds: ['spare_the_dying'] },
          { type: 'stat_modifier', target: 'saving throws against disease', operation: 'advantage', value: null, condition: null },
        ], actions: [], choices: [], passive: true } },
      ] },
    { level: 6, hpDie: 8, choices: [],
      grants: [
        { kind: 'resource', value: { resourceId: 'defy_death_pool', name: 'Defy Death', maximum: 1, recharge: 'long_rest' } },
        { kind: 'feature', value: { id: 'defy_death', name: 'Defy Death', description: 'When you succeed on a death saving throw or stabilize a creature with Spare the Dying, regain 1d8 plus your Constitution modifier (minimum 1) hit points. Usable once per long rest.', source: { kind: 'subclass', refId: 'undying' }, level: 6, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'free', resourceCost: { resourceId: 'defy_death_pool', quantity: 1 }, range: 'self', target: 'self', requiresSave: null },
          abilityEffects: [{ type: 'heal', dice: '1d8', bonusMod: 'con' }] } },
      ] },
    { level: 10, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'undying_nature', name: 'Undying Nature', description: 'Hold your breath indefinitely and don\'t need food, water, or sleep (though you still need rest to reduce exhaustion and benefit from rests). Age at one-tenth the normal rate, and you\'re immune to magical aging.', source: { kind: 'subclass', refId: 'undying' }, level: 10, effects: [], actions: [], choices: [], passive: true } }] },
    { level: 14, hpDie: 8, choices: [],
      grants: [
        { kind: 'resource', value: { resourceId: 'indestructible_life_pool', name: 'Indestructible Life', maximum: 1, recharge: 'short_rest' } },
        { kind: 'feature', value: { id: 'indestructible_life', name: 'Indestructible Life', description: 'As a bonus action, regain 1d8 plus your warlock level hit points; reattach a severed body part you hold in place while doing so. Usable once per short or long rest.', source: { kind: 'subclass', refId: 'undying' }, level: 14, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'bonus_action', resourceCost: { resourceId: 'indestructible_life_pool', quantity: 1 }, range: 'self', target: 'self', requiresSave: null },
          abilityEffects: [{ type: 'heal', dice: '1d8' }] } },
      ] },
  ],
};

export const WARLOCK_SUBCLASSES: SubclassProgression[] = [
  fiendProgression, greatOldOneProgression, archfeyProgression, celestialProgression,
  fathomlessProgression, genieProgression, hexbladeProgression, undeadProgression,
  undyingProgression,
];
