// ============================================================================
// FILE: src/content/subclasses/sorcerer.ts
// Sorcerer subclasses: Draconic Bloodline, Wild Magic, Aberrant Mind,
// Clockwork Soul, Divine Soul, Lunar Sorcery, Pyromancy, Shadow Magic,
// Storm Sorcery
//
// Bonus spells known: like the Paladin/Ranger gap, the "learn an extra spell
// at levels 1/3/5/7/9" tables (Aberrant Mind's Psionic Spells, Clockwork
// Soul's Clockwork Spells, Lunar Sorcery's three-phase Lunar Spells) aren't
// wired via known_spells Grants — several referenced spells (Arms of Hadar,
// Summon Aberration, Alarm, Protection from Evil and Good, Summon Construct,
// Mislead, and others) aren't in this codebase's spell library yet, and
// partial per-level wiring would repeat the same inconsistent patchwork
// already avoided twice before. Left disclosed and unwired.
//
// Pyromancy is flagged in its own source text as homebrew created for a
// Magic: The Gathering-flavored setting, not an official WotC subclass like
// the other 8 here — included per the standing "author everything in the
// folder" scope decision, but its non-official origin is called out
// explicitly (matching how Blood Hunter is tracked as third-party).
// ============================================================================
import { ChoiceOption, ClassProgression, Feature } from '../../engine/types';

export type SubclassProgression = ClassProgression & { name: string };

export const draconicBloodlineProgression: SubclassProgression = {
  classId: 'sorcerer', name: 'Draconic Bloodline', srd: true,
  entries: [
    { level: 1, hpDie: 6, choices: [], grants: [{ kind: 'feature', value: { id: 'dragon_ancestor', name: 'Dragon Ancestor', description: 'Choose a type of dragon. Speak, read, and write Draconic. Advantage on Charisma checks with dragons.', source: { kind: 'subclass', refId: 'draconic_bloodline' }, level: 1, effects: [], actions: [], choices: [], passive: true } }, { kind: 'feature', value: { id: 'draconic_resilience', name: 'Draconic Resilience', description: 'HP maximum increases by 1 per sorcerer level. When not wearing armor, AC = 13 + DEX modifier.', source: { kind: 'subclass', refId: 'draconic_bloodline' }, level: 1, effects: [{ type: 'base_ac_formula', target: 'ac', operation: 'set', value: 13, condition: null }], actions: [], choices: [], passive: true } }] },
    { level: 6, hpDie: 6, choices: [], grants: [{ kind: 'feature', value: { id: 'elemental_affinity', name: 'Elemental Affinity', description: 'When you cast a spell of the damage type associated with your draconic ancestry, add your CHA modifier to one damage roll. Spend 1 sorcery point to gain resistance to that damage type for 1 hour.', source: { kind: 'subclass', refId: 'draconic_bloodline' }, level: 6, effects: [], actions: [], choices: [], passive: true } }] },
    { level: 14, hpDie: 6, choices: [], grants: [{ kind: 'feature', value: { id: 'dragon_wings', name: 'Dragon Wings', description: 'Sprout wings as a bonus action. Gain a flying speed equal to your current speed. Disappear as a bonus action.', source: { kind: 'subclass', refId: 'draconic_bloodline' }, level: 14, effects: [], actions: [], choices: [], passive: false, activation: { actionType: 'bonus_action', resourceCost: null, range: 'self', target: 'self', requiresSave: null } } }] },
    { level: 18, hpDie: 6, choices: [], grants: [{ kind: 'feature', value: { id: 'draconic_presence', name: 'Draconic Presence', description: 'Spend 5 sorcery points as an action to exude awe or fear in a 60-foot radius for 1 minute (WIS save). Frightened or charmed until the aura ends or a save is made.', source: { kind: 'subclass', refId: 'draconic_bloodline' }, level: 18, effects: [], actions: [], choices: [], passive: false, activation: { actionType: 'action', resourceCost: { resourceId: 'sorcery_points', quantity: 5 }, range: '60 feet', target: 'area', requiresSave: { ability: 'wis', dc: 'spell_save_dc' } } } }] },
  ],
};

export const wildMagicProgression: SubclassProgression = {
  classId: 'sorcerer', name: 'Wild Magic', srd: false,
  entries: [
    { level: 1, hpDie: 6, choices: [], grants: [{ kind: 'feature', value: { id: 'wild_magic_surge', name: 'Wild Magic Surge', description: 'When you cast a sorcerer spell of 1st level or higher, the DM can have you roll a d20. On a 1, roll on the Wild Magic Surge table.', source: { kind: 'subclass', refId: 'wild_magic' }, level: 1, effects: [], actions: [], choices: [], passive: true } }, { kind: 'feature', value: { id: 'tides_of_chaos', name: 'Tides of Chaos', description: "Gain advantage on one attack roll, ability check, or saving throw. Once used, the DM can cause a Wild Magic Surge to restore it early — otherwise it recharges on a long rest (simplified here to a flat long-rest recharge; the DM-surge early-restore path is a manual call).", source: { kind: 'subclass', refId: 'wild_magic' }, level: 1, effects: [], actions: [], choices: [], passive: false, activation: { actionType: 'free', resourceCost: { resourceId: 'tides_of_chaos_pool', quantity: 1 }, range: 'self', target: 'self', requiresSave: null } } }, { kind: 'resource', value: { resourceId: 'tides_of_chaos_pool', name: 'Tides of Chaos', maximum: 1, recharge: 'long_rest' } }] },
    { level: 6, hpDie: 6, choices: [], grants: [{ kind: 'feature', value: { id: 'bend_luck', name: 'Bend Luck', description: 'Spend 2 sorcery points as a reaction to add or subtract 1d4 from an attack roll, ability check, or saving throw of a creature you can see.', source: { kind: 'subclass', refId: 'wild_magic' }, level: 6, effects: [], actions: [], choices: [], passive: false, activation: { actionType: 'reaction', resourceCost: { resourceId: 'sorcery_points', quantity: 2 }, range: '60 feet', target: 'single', requiresSave: null } } }] },
    { level: 14, hpDie: 6, choices: [], grants: [{ kind: 'feature', value: { id: 'controlled_chaos', name: 'Controlled Chaos', description: 'When you roll on the Wild Magic Surge table, roll twice and choose which effect to use.', source: { kind: 'subclass', refId: 'wild_magic' }, level: 14, effects: [], actions: [], choices: [], passive: true } }] },
    { level: 18, hpDie: 6, choices: [], grants: [{ kind: 'feature', value: { id: 'spell_bombardment', name: 'Spell Bombardment', description: 'When you roll damage for a spell and roll the highest possible result on any die, roll that die again and add it to the damage. Do this once per turn.', source: { kind: 'subclass', refId: 'wild_magic' }, level: 18, effects: [], actions: [], choices: [], passive: true } }] },
  ],
};

// ── Aberrant Mind ────────────────────────────────────────────────────────────
export const aberrantMindProgression: SubclassProgression = {
  classId: 'sorcerer', name: 'Aberrant Mind', srd: false,
  entries: [
    { level: 1, hpDie: 6, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'psionic_spells', name: 'Psionic Spells', description: 'Learn extra spells at levels 1/3/5/7/9 (Arms of Hadar, Dissonant Whispers, Mind Sliver, Calm Emotions, Detect Thoughts, Hunger of Hadar, Sending, Evard\'s Black Tentacles, Summon Aberration, Rary\'s Telepathic Bond, Telekinesis) that count as sorcerer spells but not against your spells known; replaceable with a divination or enchantment spell from the sorcerer/warlock/wizard list on level-up. Not wired via known_spells — several referenced spells aren\'t in the library yet.', source: { kind: 'subclass', refId: 'aberrant_mind' }, level: 1, effects: [], actions: [], choices: [], passive: true } },
        { kind: 'feature', value: { id: 'telepathic_speech', name: 'Telepathic Speech', description: 'As a bonus action, form a telepathic link with a creature within 30 feet, lasting a number of minutes equal to your sorcerer level (within a number of miles equal to your Charisma modifier, minimum 1). Ends early if you\'re incapacitated, die, or link with someone else.', source: { kind: 'subclass', refId: 'aberrant_mind' }, level: 1, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'bonus_action', resourceCost: null, range: '30 feet', target: 'single', requiresSave: null },
          abilityEffects: [] } },
      ] },
    { level: 6, hpDie: 6, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'psionic_sorcery', name: 'Psionic Sorcery', description: 'Cast any 1st-level-or-higher Psionic Spell by spending sorcery points equal to its level instead of a spell slot, with no verbal, somatic, or (non-consumed) material components.', source: { kind: 'subclass', refId: 'aberrant_mind' }, level: 6, effects: [], actions: [], choices: [], passive: true } },
        { kind: 'feature', value: { id: 'psychic_defenses', name: 'Psychic Defenses', description: 'Gain resistance to psychic damage and advantage on saving throws against being charmed or frightened.', source: { kind: 'subclass', refId: 'aberrant_mind' }, level: 6, effects: [
          { type: 'grant_resistance', target: 'psychic', operation: 'resistance', value: null, condition: null },
          { type: 'stat_modifier', target: 'saving throws against being charmed or frightened', operation: 'advantage', value: null, condition: null },
        ], actions: [], choices: [], passive: true } },
      ] },
    { level: 14, hpDie: 6, choices: [], grants: [{ kind: 'feature', value: { id: 'revelation_in_flesh', name: 'Revelation in Flesh', description: 'As a bonus action, spend 1 or more sorcery points to transform for 10 minutes; for each point spent, choose one: see invisible creatures within 60 feet; gain a flying speed equal to your walking speed and hover; gain a swimming speed equal to twice your walking speed and breathe underwater; or become slimy and pliable enough to squeeze through 1-inch gaps and escape nonmagical restraints/grapples for 5 feet of movement.', source: { kind: 'subclass', refId: 'aberrant_mind' }, level: 14, effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'bonus_action', resourceCost: { resourceId: 'sorcery_points', quantity: 1 }, range: 'self', target: 'self', requiresSave: null },
      abilityEffects: [] } }] },
    { level: 18, hpDie: 6, choices: [],
      grants: [
        { kind: 'resource', value: { resourceId: 'warping_implosion_pool', name: 'Warping Implosion', maximum: 1, recharge: 'long_rest' } },
        { kind: 'feature', value: { id: 'warping_implosion', name: 'Warping Implosion', description: 'As an action, teleport up to 120 feet to an unoccupied space you can see. Each creature within 30 feet of the space you left makes a Strength save against your spell save DC, taking 3d10 force damage and getting pulled to your former space on a failure, half damage and no pull on a success. Usable once per long rest, or again by spending 5 sorcery points.', source: { kind: 'subclass', refId: 'aberrant_mind' }, level: 18, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'action', resourceCost: { resourceId: 'warping_implosion_pool', quantity: 1 }, range: '120 feet', target: 'self', requiresSave: null },
          abilityEffects: [{ type: 'damage', dice: '3d10', damageType: 'force', saveOnSuccess: 'half' }] } },
      ] },
  ],
};

// ── Clockwork Soul ───────────────────────────────────────────────────────────
export const clockworkSoulProgression: SubclassProgression = {
  classId: 'sorcerer', name: 'Clockwork Soul', srd: false,
  entries: [
    { level: 1, hpDie: 6, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'clockwork_magic', name: 'Clockwork Magic', description: 'Learn extra spells at levels 1/3/5/7/9 (Alarm, Protection from Evil and Good, Aid, Lesser Restoration, Dispel Magic, Protection from Energy, Freedom of Movement, Summon Construct, Greater Restoration, Wall of Force) that count as sorcerer spells but not against your spells known; replaceable with an abjuration or transmutation spell from the sorcerer/warlock/wizard list on level-up. Not wired via known_spells — several referenced spells aren\'t in the library yet.', source: { kind: 'subclass', refId: 'clockwork_soul' }, level: 1, effects: [], actions: [], choices: [], passive: true } },
        { kind: 'resource', value: { resourceId: 'restore_balance_pool', name: 'Restore Balance (scales with proficiency bonus)', maximum: 1, recharge: 'long_rest' } },
        { kind: 'feature', value: { id: 'restore_balance', name: 'Restore Balance', description: 'When a creature you can see within 60 feet is about to roll a d20 with advantage or disadvantage, use your reaction to negate both before the roll. Usable a number of times equal to your proficiency bonus per long rest — tracked here as a single-use pool; increase its maximum to match.', source: { kind: 'subclass', refId: 'clockwork_soul' }, level: 1, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'reaction', resourceCost: { resourceId: 'restore_balance_pool', quantity: 1 }, range: '60 feet', target: 'single', requiresSave: null },
          abilityEffects: [] } },
      ] },
    { level: 6, hpDie: 6, choices: [], grants: [{ kind: 'feature', value: { id: 'bastion_of_law', name: 'Bastion of Law', description: 'As an action, spend 1 to 5 sorcery points to ward yourself or a creature within 30 feet with a shield of dice (a d8 per point spent) that lasts until you use this again or finish a long rest. The warded creature can expend and roll wards dice to reduce incoming damage.', source: { kind: 'subclass', refId: 'clockwork_soul' }, level: 6, effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'action', resourceCost: { resourceId: 'sorcery_points', quantity: 1 }, range: '30 feet', target: 'single', requiresSave: null },
      abilityEffects: [] } }] },
    { level: 14, hpDie: 6, choices: [], grants: [{ kind: 'feature', value: { id: 'trance_of_order', name: 'Trance of Order', description: 'As a bonus action, enter a calculating trance for 1 minute: attack rolls against you can\'t have advantage, and you can treat a 9 or lower on any d20 roll you make as a 10. Usable once per long rest, or again by spending 5 sorcery points.', source: { kind: 'subclass', refId: 'clockwork_soul' }, level: 14, effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'bonus_action', resourceCost: { resourceId: 'sorcery_points', quantity: 5 }, range: 'self', target: 'self', requiresSave: null },
      abilityEffects: [] } }] },
    { level: 18, hpDie: 6, choices: [], grants: [{ kind: 'feature', value: { id: 'clockwork_cavalcade', name: 'Clockwork Cavalcade', description: 'As an action, summon modron-like spirits in a 30-foot cube: restore up to 100 hit points divided among creatures you choose there, instantly repair damaged objects in the cube, and end every spell of 6th level or lower on creatures/objects you choose there. Usable once per long rest, or again by spending 7 sorcery points.', source: { kind: 'subclass', refId: 'clockwork_soul' }, level: 18, effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'action', resourceCost: { resourceId: 'sorcery_points', quantity: 7 }, range: '30 feet', target: 'area', requiresSave: null },
      abilityEffects: [] } }] },
  ],
};

// ── Divine Soul ──────────────────────────────────────────────────────────────
const DIVINE_AFFINITY_POOL: ChoiceOption[] = [
  { id: 'good', label: 'Good (Cure Wounds)', value: { id: 'divine_affinity_good', name: 'Divine Affinity: Good', description: 'Learn Cure Wounds as a sorcerer spell (doesn\'t count against spells known).', source: { kind: 'subclass', refId: 'divine_soul' }, level: null, effects: [{ type: 'grant_spell', target: 'known_spell', operation: 'add', value: null, condition: null, spellIds: ['cure_wounds'] }], actions: [], choices: [], passive: true } as Feature },
  { id: 'evil', label: 'Evil (Inflict Wounds)', value: { id: 'divine_affinity_evil', name: 'Divine Affinity: Evil', description: 'Learn Inflict Wounds as a sorcerer spell (doesn\'t count against spells known).', source: { kind: 'subclass', refId: 'divine_soul' }, level: null, effects: [{ type: 'grant_spell', target: 'known_spell', operation: 'add', value: null, condition: null, spellIds: ['inflict_wounds'] }], actions: [], choices: [], passive: true } as Feature },
  { id: 'law', label: 'Law (Bless)', value: { id: 'divine_affinity_law', name: 'Divine Affinity: Law', description: 'Learn Bless as a sorcerer spell (doesn\'t count against spells known).', source: { kind: 'subclass', refId: 'divine_soul' }, level: null, effects: [{ type: 'grant_spell', target: 'known_spell', operation: 'add', value: null, condition: null, spellIds: ['bless'] }], actions: [], choices: [], passive: true } as Feature },
  { id: 'chaos', label: 'Chaos (Bane)', value: { id: 'divine_affinity_chaos', name: 'Divine Affinity: Chaos', description: 'Learn Bane as a sorcerer spell (doesn\'t count against spells known).', source: { kind: 'subclass', refId: 'divine_soul' }, level: null, effects: [{ type: 'grant_spell', target: 'known_spell', operation: 'add', value: null, condition: null, spellIds: ['bane'] }], actions: [], choices: [], passive: true } as Feature },
  { id: 'neutrality', label: 'Neutrality (Protection from Evil and Good)', value: { id: 'divine_affinity_neutrality', name: 'Divine Affinity: Neutrality', description: 'Learn Protection from Evil and Good as a sorcerer spell (doesn\'t count against spells known). Not in this codebase\'s spell library yet — no grant_spell hook until it\'s added.', source: { kind: 'subclass', refId: 'divine_soul' }, level: null, effects: [], actions: [], choices: [], passive: true } as Feature },
];
export const divineSoulProgression: SubclassProgression = {
  classId: 'sorcerer', name: 'Divine Soul', srd: false,
  entries: [
    { level: 1, hpDie: 6,
      choices: [{ id: 'divine_affinity_1', prompt: 'Choose your divine affinity.', kind: 'feature_pool', count: 1, pool: DIVINE_AFFINITY_POOL, grants: [], required: true, resolved: false }],
      grants: [
        { kind: 'feature', value: { id: 'divine_magic', name: 'Divine Magic', description: 'You can choose sorcerer cantrips and spells from the cleric spell list as well as the sorcerer list (each still becomes a sorcerer spell for you). No spell-list-expansion hook exists in the engine — resolve manually when learning new spells.', source: { kind: 'subclass', refId: 'divine_soul' }, level: 1, effects: [], actions: [], choices: [], passive: true } },
        { kind: 'resource', value: { resourceId: 'favored_by_gods_pool', name: 'Favored by the Gods', maximum: 1, recharge: 'short_rest' } },
        { kind: 'feature', value: { id: 'favored_by_the_gods', name: 'Favored by the Gods', description: 'If you fail a saving throw or miss with an attack roll, roll 2d4 and add it to the total. Usable once per short or long rest.', source: { kind: 'subclass', refId: 'divine_soul' }, level: 1, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'free', resourceCost: { resourceId: 'favored_by_gods_pool', quantity: 1 }, range: 'self', target: 'self', requiresSave: null },
          abilityEffects: [] } },
      ] },
    { level: 6, hpDie: 6, choices: [], grants: [{ kind: 'feature', value: { id: 'empowered_healing', name: 'Empowered Healing', description: 'Once per turn, when you or an ally within 5 feet rolls dice for a healing spell (while you\'re not incapacitated), spend 1 sorcery point to reroll any number of those dice once.', source: { kind: 'subclass', refId: 'divine_soul' }, level: 6, effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'free', resourceCost: { resourceId: 'sorcery_points', quantity: 1 }, range: '5 feet', target: 'single', requiresSave: null },
      abilityEffects: [] } }] },
    { level: 14, hpDie: 6, choices: [], grants: [{ kind: 'feature', value: { id: 'angelic_form', name: 'Angelic Form', description: 'As a bonus action, manifest spectral wings (eagle for good/law, bat for evil/chaos, dragonfly for neutrality), granting a 30-foot flying speed until you\'re incapacitated, die, or dismiss them as a bonus action.', source: { kind: 'subclass', refId: 'divine_soul' }, level: 14, effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'bonus_action', resourceCost: null, range: 'self', target: 'self', requiresSave: null },
      abilityEffects: [{ type: 'grant_speed', speedType: 'fly', amount: 30, duration: { unit: 'until_rest', remaining: 1 } }] } }] },
    { level: 18, hpDie: 6, choices: [],
      grants: [
        { kind: 'resource', value: { resourceId: 'unearthly_recovery_pool', name: 'Unearthly Recovery', maximum: 1, recharge: 'long_rest' } },
        { kind: 'feature', value: { id: 'unearthly_recovery', name: 'Unearthly Recovery', description: 'As a bonus action while below half your hit points, regain hit points equal to half your hit point maximum. Usable once per long rest. The healed amount is derived from your max HP, not a fixed die — apply manually.', source: { kind: 'subclass', refId: 'divine_soul' }, level: 18, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'bonus_action', resourceCost: { resourceId: 'unearthly_recovery_pool', quantity: 1 }, range: 'self', target: 'self', requiresSave: null },
          abilityEffects: [] } },
      ] },
  ],
};

// ── Lunar Sorcery ────────────────────────────────────────────────────────────
// The three-phase (Full/New/Crescent Moon) stance system has no state
// tracking anywhere in the engine, so every phase-conditional feature below
// stays description-only; only the single fixed Moon Fire cantrip gets a
// real hook.
export const lunarSorceryProgression: SubclassProgression = {
  classId: 'sorcerer', name: 'Lunar Sorcery', srd: false,
  entries: [
    { level: 1, hpDie: 6, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'lunar_embodiment', name: 'Lunar Embodiment', description: 'Learn extra spells at levels 1/3/5/7/9, three per level (one per lunar phase: Full/New/Crescent Moon) that count as sorcerer spells but not against your spells known. At the end of a long rest, choose your active phase; while in it, cast one 1st-level spell of that phase once for free. Not wired via known_spells — several referenced spells aren\'t in the library yet, and phase state isn\'t tracked by the engine.', source: { kind: 'subclass', refId: 'lunar_sorcery' }, level: 1, effects: [], actions: [], choices: [], passive: true } },
        { kind: 'feature', value: { id: 'moon_fire', name: 'Moon Fire', description: 'Learn the Sacred Flame cantrip (doesn\'t count against your sorcerer cantrips known); when you cast it, you can target two creatures within 5 feet of each other instead of one.', source: { kind: 'subclass', refId: 'lunar_sorcery' }, level: 1, effects: [
          { type: 'grant_spell', target: 'cantrip', operation: 'add', value: null, condition: null, cantripIds: ['sacred_flame'] },
        ], actions: [], choices: [], passive: true } },
      ] },
    { level: 6, hpDie: 6, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'lunar_boons', name: 'Lunar Boons', description: 'When you use Metamagic on a spell from the school(s) matching your current lunar phase (Full: Abjuration/Divination; New: Enchantment/Necromancy; Crescent: Illusion/Transmutation), reduce its sorcery point cost by 1 (minimum 0), a number of times equal to your proficiency bonus per long rest. No Metamagic system exists in the engine to hook a cost reduction into.', source: { kind: 'subclass', refId: 'lunar_sorcery' }, level: 6, effects: [], actions: [], choices: [], passive: true } },
        { kind: 'feature', value: { id: 'waxing_and_waning', name: 'Waxing and Waning', description: 'As a bonus action, spend 1 sorcery point to change your current lunar phase. You can now cast one 1st-level spell from each phase for free (once per phase per long rest), matching your phase when you cast it.', source: { kind: 'subclass', refId: 'lunar_sorcery' }, level: 6, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'bonus_action', resourceCost: { resourceId: 'sorcery_points', quantity: 1 }, range: 'self', target: 'self', requiresSave: null },
          abilityEffects: [] } },
      ] },
    { level: 14, hpDie: 6, choices: [], grants: [{ kind: 'feature', value: { id: 'lunar_empowerment', name: 'Lunar Empowerment', description: 'While in a lunar phase, gain its passive benefit: Full Moon grants a togglable 10-foot bright/10-foot dim light aura with Investigation/Perception advantage in it; New Moon grants Stealth advantage and imposes disadvantage on attacks against you in total darkness; Crescent Moon grants resistance to necrotic and radiant damage.', source: { kind: 'subclass', refId: 'lunar_sorcery' }, level: 14, effects: [], actions: [], choices: [], passive: true } }] },
    { level: 18, hpDie: 6, choices: [], grants: [{ kind: 'feature', value: { id: 'lunar_phenomenon', name: 'Lunar Phenomenon', description: 'As a bonus action (or as part of changing phase via Waxing and Waning), unleash your current phase\'s power: Full Moon blinds chosen creatures within 30 feet on a failed CON save and heals one creature there for 3d8; New Moon deals 3d10 necrotic and speed-0 to chosen creatures within 30 feet on a failed DEX save, and turns you invisible until your next attack/spell; Crescent Moon teleports you (and a willing ally) up to 60 feet with resistance to all damage until your next turn. Usable once per long rest, or again by spending 5 sorcery points.', source: { kind: 'subclass', refId: 'lunar_sorcery' }, level: 18, effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'bonus_action', resourceCost: { resourceId: 'sorcery_points', quantity: 5 }, range: '60 feet', target: 'area', requiresSave: null },
      abilityEffects: [] } }] },
  ],
};

// ── Pyromancy (homebrew — see file header note) ─────────────────────────────
export const pyromancyProgression: SubclassProgression = {
  classId: 'sorcerer', name: 'Pyromancy', srd: false,
  entries: [
    { level: 1, hpDie: 6, choices: [], grants: [{ kind: 'feature', value: { id: 'heart_of_fire', name: 'Heart of Fire', description: 'When you start casting a 1st-level-or-higher spell that deals fire damage, creatures you choose within 10 feet take fire damage equal to half your sorcerer level (minimum 1). Flat level-based damage with no die to attach — apply manually.', source: { kind: 'subclass', refId: 'pyromancy' }, level: 1, effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'free', resourceCost: null, range: '10 feet', target: 'multiple', requiresSave: null },
      abilityEffects: [] } }] },
    { level: 6, hpDie: 6, choices: [], grants: [{ kind: 'feature', value: { id: 'fire_in_the_veins', name: 'Fire in the Veins', description: 'Gain resistance to fire damage, and spells you cast ignore resistance to fire damage.', source: { kind: 'subclass', refId: 'pyromancy' }, level: 6, effects: [
      { type: 'grant_resistance', target: 'fire', operation: 'resistance', value: null, condition: null },
    ], actions: [], choices: [], passive: true } }] },
    { level: 14, hpDie: 6, choices: [], grants: [{ kind: 'feature', value: { id: 'pyromancers_fury', name: "Pyromancer's Fury", description: 'When hit by a melee attack, use your reaction to deal fire damage equal to your sorcerer level to the attacker, ignoring fire resistance. Flat level-based damage with no die to attach — apply manually.', source: { kind: 'subclass', refId: 'pyromancy' }, level: 14, effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'reaction', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
      abilityEffects: [] } }] },
    { level: 18, hpDie: 6, choices: [], grants: [{ kind: 'feature', value: { id: 'fiery_soul', name: 'Fiery Soul', description: 'Gain immunity to fire damage. Any spell or effect you create ignores fire resistance and treats fire immunity as fire resistance.', source: { kind: 'subclass', refId: 'pyromancy' }, level: 18, effects: [
      { type: 'grant_immunity', target: 'fire', operation: 'immunity', value: null, condition: null },
    ], actions: [], choices: [], passive: true } }] },
  ],
};

// ── Shadow Magic ─────────────────────────────────────────────────────────────
export const shadowMagicProgression: SubclassProgression = {
  classId: 'sorcerer', name: 'Shadow Magic', srd: false,
  entries: [
    { level: 1, hpDie: 6, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'eyes_of_the_dark', name: 'Eyes of the Dark', description: 'Gain darkvision to 120 feet. At level 3, learn the Darkness spell (see the level 3 entry).', source: { kind: 'subclass', refId: 'shadow_magic' }, level: 1, effects: [
          { type: 'grant_sense', target: 'senses', operation: 'add', value: null, condition: null, senseType: 'darkvision', senseRange: 120 },
        ], actions: [], choices: [], passive: true } },
        { kind: 'feature', value: { id: 'strength_of_the_grave', name: 'Strength of the Grave', description: 'When damage reduces you to 0 HP (unless from radiant damage or a critical hit), make a Charisma save (DC 5 + damage taken); on a success, drop to 1 HP instead. Usable once per long rest after a success. No 0-HP trigger exists in the engine — resolve manually.', source: { kind: 'subclass', refId: 'shadow_magic' }, level: 1, effects: [], actions: [], choices: [], passive: true } },
      ] },
    { level: 3, hpDie: 6, choices: [], grants: [{ kind: 'feature', value: { id: 'eyes_of_the_dark_darkness', name: 'Eyes of the Dark: Darkness', description: 'Cast Darkness by expending a spell slot or by spending 2 sorcery points; if cast with sorcery points, you can see through the darkness it creates. Doesn\'t count against your sorcerer spells known.', source: { kind: 'subclass', refId: 'shadow_magic' }, level: 3, effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'action', resourceCost: { resourceId: 'sorcery_points', quantity: 2 }, range: '60 feet', target: 'single', requiresSave: null },
      abilityEffects: [{ type: 'cast_spell', spellId: 'darkness' }] } }] },
    { level: 6, hpDie: 6, choices: [], grants: [{ kind: 'feature', value: { id: 'hound_of_ill_omen', name: 'Hound of Ill Omen', description: 'As a bonus action, spend 3 sorcery points to summon a spectral hound (dire wolf statistics, Medium, monstrosity, temp HP equal to half your sorcerer level) that hunts one creature within 120 feet, always knows its location, and imposes disadvantage on the target\'s saves against your spells while within 5 feet of it. Lasts until reduced to 0 HP, its target drops, or 5 minutes pass.', source: { kind: 'subclass', refId: 'shadow_magic' }, level: 6, effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'bonus_action', resourceCost: { resourceId: 'sorcery_points', quantity: 3 }, range: '120 feet', target: 'single', requiresSave: null },
      abilityEffects: [] } }] },
    { level: 14, hpDie: 6, choices: [], grants: [{ kind: 'feature', value: { id: 'shadow_walk', name: 'Shadow Walk', description: 'While in dim light or darkness, use a bonus action to teleport up to 120 feet to an unoccupied space you can see that\'s also in dim light or darkness.', source: { kind: 'subclass', refId: 'shadow_magic' }, level: 14, effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'bonus_action', resourceCost: null, range: '120 feet', target: 'self', requiresSave: null },
      abilityEffects: [] } }] },
    { level: 18, hpDie: 6, choices: [], grants: [{ kind: 'feature', value: { id: 'umbral_form', name: 'Umbral Form', description: 'As a bonus action, spend 6 sorcery points to become a shadowy form for 1 minute: resistance to all damage except force and radiant, and you can move through creatures/objects as difficult terrain (1d10 force damage if you end your turn inside one). Ends early if incapacitated, dead, or dismissed as a bonus action.', source: { kind: 'subclass', refId: 'shadow_magic' }, level: 18, effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'bonus_action', resourceCost: { resourceId: 'sorcery_points', quantity: 6 }, range: 'self', target: 'self', requiresSave: null },
      abilityEffects: [] } }] },
  ],
};

// ── Storm Sorcery ────────────────────────────────────────────────────────────
export const stormSorceryProgression: SubclassProgression = {
  classId: 'sorcerer', name: 'Storm Sorcery', srd: false,
  entries: [
    { level: 1, hpDie: 6,
      choices: [],
      grants: [
        { kind: 'proficiency', value: { languages: ['primordial'] } },
        { kind: 'feature', value: { id: 'wind_speaker', name: 'Wind Speaker', description: 'Speak, read, and write Primordial, letting you understand and be understood by speakers of Aquan, Auran, Ignan, and Terran.', source: { kind: 'subclass', refId: 'storm_sorcery' }, level: 1, effects: [], actions: [], choices: [], passive: true } },
        { kind: 'feature', value: { id: 'tempestuous_magic', name: 'Tempestuous Magic', description: 'Immediately before or after casting a 1st-level-or-higher spell, use a bonus action to fly up to 10 feet without provoking opportunity attacks.', source: { kind: 'subclass', refId: 'storm_sorcery' }, level: 1, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'bonus_action', resourceCost: null, range: 'self', target: 'self', requiresSave: null },
          abilityEffects: [{ type: 'grant_speed', speedType: 'fly', amount: 10, duration: { unit: 'rounds', remaining: 1 } }] } },
      ] },
    { level: 6, hpDie: 6, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'heart_of_the_storm', name: 'Heart of the Storm', description: 'Gain resistance to lightning and thunder damage. When you start casting a 1st-level-or-higher spell that deals lightning or thunder damage, creatures you choose within 10 feet take lightning or thunder damage (your choice each time) equal to half your sorcerer level. The eruption\'s flat level-based damage has no die to attach — apply manually.', source: { kind: 'subclass', refId: 'storm_sorcery' }, level: 6, effects: [
          { type: 'grant_resistance', target: 'lightning', operation: 'resistance', value: null, condition: null },
          { type: 'grant_resistance', target: 'thunder', operation: 'resistance', value: null, condition: null },
        ], actions: [], choices: [], passive: true } },
        { kind: 'feature', value: { id: 'storm_guide', name: 'Storm Guide', description: 'Use an action to stop rain in a 20-foot radius centered on you (dismissible as a bonus action), or a bonus action each round to choose the wind\'s direction in a 100-foot radius (doesn\'t change its speed).', source: { kind: 'subclass', refId: 'storm_sorcery' }, level: 6, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'action', resourceCost: null, range: '100 feet', target: 'self', requiresSave: null },
          abilityEffects: [] } },
      ] },
    { level: 14, hpDie: 6, choices: [], grants: [{ kind: 'feature', value: { id: 'storms_fury', name: "Storm's Fury", description: 'When hit by a melee attack, use your reaction to deal lightning damage equal to your sorcerer level to the attacker; it also makes a Strength save against your spell save DC or is pushed 20 feet away in a straight line. Flat level-based damage has no die to attach — apply manually.', source: { kind: 'subclass', refId: 'storm_sorcery' }, level: 14, effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'reaction', resourceCost: null, range: '5 feet', target: 'single', requiresSave: { ability: 'str', dc: 'spell_save_dc' } },
      abilityEffects: [] } }] },
    { level: 18, hpDie: 6, choices: [],
      grants: [
        { kind: 'resource', value: { resourceId: 'wind_soul_share_pool', name: 'Wind Soul: Share Flight', maximum: 1, recharge: 'short_rest' } },
        { kind: 'feature', value: { id: 'wind_soul', name: 'Wind Soul', description: 'Gain immunity to lightning and thunder damage, and a permanent 60-foot flying speed.', source: { kind: 'subclass', refId: 'storm_sorcery' }, level: 18, effects: [
          { type: 'grant_immunity', target: 'lightning', operation: 'immunity', value: null, condition: null },
          { type: 'grant_immunity', target: 'thunder', operation: 'immunity', value: null, condition: null },
          { type: 'grant_movement', target: 'movement', operation: 'add', value: null, condition: null, movementType: 'fly', movementRange: 60 },
        ], actions: [], choices: [], passive: true } },
        { kind: 'feature', value: { id: 'wind_soul_share', name: 'Wind Soul: Share Flight', description: 'As an action, reduce your flying speed to 30 feet for 1 hour and grant a 30-foot flying speed for 1 hour to creatures within 30 feet, up to 3 plus your Charisma modifier. Usable once per short or long rest.', source: { kind: 'subclass', refId: 'storm_sorcery' }, level: 18, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'action', resourceCost: { resourceId: 'wind_soul_share_pool', quantity: 1 }, range: '30 feet', target: 'multiple', requiresSave: null },
          abilityEffects: [] } },
      ] },
  ],
};

export const SORCERER_SUBCLASSES: SubclassProgression[] = [
  draconicBloodlineProgression, wildMagicProgression, aberrantMindProgression, clockworkSoulProgression,
  divineSoulProgression, lunarSorceryProgression, pyromancyProgression, shadowMagicProgression,
  stormSorceryProgression,
];
