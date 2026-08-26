// ============================================================================
// FILE: src/content/subclasses/artificer.ts
// Artificer Specialists (Tasha's Cauldron of Everything): Armorer, Alchemist,
// Artillerist, Battle Smith. Plus Archivist, which is EXPERIMENTAL,
// NON-OFFICIAL Unearthed Arcana content (Feb 2019 "Prototype Artificer" UA)
// that never made it into a published book — TCE replaced it with the four
// specialists above. Included at the user's request; clearly labeled below.
//
// "Always prepared" specialist spell lists below are approximated from
// spells already in this app's content pack (src/content/spells) — a few
// substitute for the exact official TCE list where that spell isn't in the
// pack yet. Each list's feature description says so explicitly. Battle
// Smith and Artillerist grant a companion via src/engine/companion.ts; the
// granting feature's id MUST match a key in
// src/content/companions/index.ts's COMPANION_TEMPLATES_BY_GRANT_FEATURE.
// ============================================================================
import { ClassProgression, Grant } from '../../engine/types';

export type SubclassProgression = ClassProgression & { name: string };

function knownSpellsGrant(spellIds: string[]): Grant {
  return { kind: 'known_spells', value: { spellIds } };
}

// ── Armorer ───────────────────────────────────────────────────────────────────

export const armorerProgression: SubclassProgression = {
  classId: 'artificer',
  name: 'Armorer',
  srd: false,
  entries: [
    {
      level: 3, hpDie: 8, choices: [],
      grants: [
        { kind: 'proficiency', value: { armor: ['heavy'] } },
        { kind: 'feature', value: { id: 'tools_of_the_trade_armorer', name: 'Tools of the Trade', description: 'You gain proficiency with heavy armor.', source: { kind: 'subclass', refId: 'armorer' }, level: 3, effects: [], actions: [], choices: [], passive: true } },
        { kind: 'feature', value: { id: 'arcane_armor', name: 'Arcane Armor', description: 'You learn to turn a suit of armor into a magical extension of yourself, replacing your worn armor and never becoming heavier than what you started with. Base AC 14 + Dexterity modifier (max 2), the armor can\'t be removed against your will, and you don\'t need to meet its Strength requirement (if any). You choose an Armor Model — Guardian or Infiltrator — each time you don it.', source: { kind: 'subclass', refId: 'armorer' }, level: 3, effects: [{ type: 'base_ac_formula', target: 'ac', operation: 'set', value: 14, condition: null, formulaAbilities: ['dex'], formulaAbilityCap: { dex: 2 } }], actions: [], choices: [], passive: true } },
        { kind: 'feature', value: { id: 'armor_model_guardian_gauntlets', name: 'Armor Model: Guardian — Thunder Gauntlets', description: 'Guardian model melee weapon: reach 5 ft, one target. On a hit: 1d8 thunder damage, and you can push the target 5 feet if it\'s Medium or smaller. Add your proficiency bonus and Intelligence modifier to the attack roll, and your proficiency bonus to the damage roll — not auto-calculated (no attack/damage-roll bonus mechanism exists in the engine).', source: { kind: 'subclass', refId: 'armorer' }, level: 3, effects: [], choices: [], passive: false, activation: { actionType: 'action', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null }, abilityEffects: [{ type: 'damage', dice: '1d8', damageType: 'thunder' }], actions: [] } },
        { kind: 'feature', value: { id: 'armor_model_infiltrator_launcher', name: 'Armor Model: Infiltrator — Lightning Launcher', description: 'Infiltrator model ranged weapon: range 90 ft, one target. On a hit: 1d6 force damage. Add your proficiency bonus and Intelligence modifier to the attack roll, and your proficiency bonus to the damage roll — not auto-calculated (same gap as Guardian\'s Thunder Gauntlets). Only one Armor Model is active at a time; both attacks are provided so either playstyle has a real card.', source: { kind: 'subclass', refId: 'armorer' }, level: 3, effects: [], choices: [], passive: false, activation: { actionType: 'action', resourceCost: null, range: '90 feet', target: 'single', requiresSave: null }, abilityEffects: [{ type: 'damage', dice: '1d6', damageType: 'force' }], actions: [] } },
      ],
    },
    { level: 5, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'extra_attack_armorer', name: 'Extra Attack', description: 'You can attack twice when you take the Attack action.', source: { kind: 'subclass', refId: 'armorer' }, level: 5, effects: [{ type: 'stat_modifier', target: 'extra_attack', operation: 'set', value: 1, condition: null }], actions: [], choices: [], passive: true } }] },
    { level: 9, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'armor_modifications', name: 'Armor Modifications', description: 'You can affix up to three of your infusions to your Arcane Armor at once, and it doesn\'t require attunement to benefit from those infusions while worn. Flavor-only — this app\'s infusion cap (see Items tab) isn\'t specially relaxed for armor-affixed infusions yet; track that manually.', source: { kind: 'subclass', refId: 'armorer' }, level: 9, effects: [], actions: [], choices: [], passive: true } }] },
    { level: 15, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'perfected_armor', name: 'Perfected Armor', description: 'Guardian: your Thunder Gauntlets can also force a creature you hit to make a Strength save or be pushed 5 ft and knocked prone. Infiltrator: your Lightning Launcher deals an extra 2d6 force damage against a creature that already has a hit from it this turn. Flavor-only — conditional bonus damage/on-hit riders aren\'t auto-applied.', source: { kind: 'subclass', refId: 'armorer' }, level: 15, effects: [], actions: [], choices: [], passive: true } }] },
  ],
};

// ── Alchemist ─────────────────────────────────────────────────────────────────

export const alchemistProgression: SubclassProgression = {
  classId: 'artificer',
  name: 'Alchemist',
  srd: false,
  entries: [
    {
      level: 3, hpDie: 8, choices: [],
      grants: [
        { kind: 'proficiency', value: { tools: ['alchemists_supplies'] } },
        { kind: 'feature', value: { id: 'tools_of_the_trade_alchemist', name: 'Tools of the Trade', description: "You gain proficiency with alchemist's supplies. If you already had it, you gain proficiency with one other type of artisan's tools of your choice — not auto-tracked, choose with your DM.", source: { kind: 'subclass', refId: 'alchemist' }, level: 3, effects: [], actions: [], choices: [], passive: true } },
        { kind: 'feature', value: { id: 'alchemist_spells', name: 'Alchemist Spells', description: "You always have certain spells prepared, and they don't count against the number of spells you can prepare. Approximated using spells already in this app's pack (exact official TCE list may differ slightly): Cure Wounds, Healing Word.", source: { kind: 'subclass', refId: 'alchemist' }, level: 3, effects: [], actions: [], choices: [], passive: true } },
        knownSpellsGrant(['cure_wounds', 'healing_word']),
        { kind: 'resource', value: { resourceId: 'experimental_elixir_pool', name: 'Experimental Elixirs', maximum: 2, recharge: 'long_rest' } },
        { kind: 'feature', value: { id: 'experimental_elixir', name: 'Experimental Elixir', description: 'As part of a short rest, you can magically produce up to a number of experimental elixirs equal to half your Artificer level (rounded up), choosing from Healing, Swiftness, Resilience, Boldness, Flight, Transformation, or Growth for each. A creature that drinks one gains that elixir\'s effect. Which effect you pick and the mechanical result of drinking it aren\'t auto-applied — the app tracks only the resource pool of elixirs available; apply the chosen effect manually.', source: { kind: 'subclass', refId: 'alchemist' }, level: 3, effects: [], actions: [], choices: [], passive: false, activation: { actionType: 'action', resourceCost: { resourceId: 'experimental_elixir_pool', quantity: 1 }, range: 'touch', target: 'single', requiresSave: null } } },
      ],
    },
    { level: 5, hpDie: 8, choices: [], grants: [knownSpellsGrant(['melfs_acid_arrow', 'lesser_restoration']), { kind: 'resource_upgrade', value: { resourceId: 'experimental_elixir_pool', newMaximum: 3 } }] },
    { level: 9, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'alchemical_savant', name: 'Alchemical Savant', description: 'When you cast a spell using your alchemist\'s supplies as the spellcasting focus, add your Intelligence modifier to one damage or healing roll of that spell. Flavor-only — no per-spell bonus-roll mechanism exists in the engine.', source: { kind: 'subclass', refId: 'alchemist' }, level: 9, effects: [], actions: [], choices: [], passive: true } }, knownSpellsGrant(['protection_from_energy', 'revivify']), { kind: 'resource_upgrade', value: { resourceId: 'experimental_elixir_pool', newMaximum: 5 } }] },
    { level: 13, hpDie: 8, choices: [], grants: [knownSpellsGrant(['death_ward', 'black_tentacles']), { kind: 'resource_upgrade', value: { resourceId: 'experimental_elixir_pool', newMaximum: 7 } }] },
    { level: 15, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'restorative_reagents', name: 'Restorative Reagents', description: 'Immediately before you drink or give away an elixir with the Healing effect, you or another creature within 5 feet can regain HP equal to your Intelligence modifier (minimum 1), and either gain the effect for a full minute or lose one exhaustion level. Flavor-only — the elixir effects themselves aren\'t auto-applied.', source: { kind: 'subclass', refId: 'alchemist' }, level: 15, effects: [], actions: [], choices: [], passive: true } }] },
    { level: 17, hpDie: 8, choices: [], grants: [knownSpellsGrant(['raise_dead', 'wall_of_force']), { kind: 'resource_upgrade', value: { resourceId: 'experimental_elixir_pool', newMaximum: 9 } }] },
  ],
};

// ── Artillerist ───────────────────────────────────────────────────────────────

export const artilleristProgression: SubclassProgression = {
  classId: 'artificer',
  name: 'Artillerist',
  srd: false,
  entries: [
    {
      level: 3, hpDie: 8, choices: [],
      grants: [
        { kind: 'proficiency', value: { tools: ['woodcarvers_tools'] } },
        { kind: 'feature', value: { id: 'tools_of_the_trade_artillerist', name: 'Tools of the Trade', description: "You gain proficiency with woodcarver's tools if you don't already have it.", source: { kind: 'subclass', refId: 'artillerist' }, level: 3, effects: [], actions: [], choices: [], passive: true } },
        { kind: 'feature', value: { id: 'artillerist_spells', name: 'Artillerist Spells', description: "You always have certain spells prepared, and they don't count against the number of spells you can prepare. Approximated using spells already in this app's pack: Shield, Faerie Fire.", source: { kind: 'subclass', refId: 'artillerist' }, level: 3, effects: [], actions: [], choices: [], passive: true } },
        knownSpellsGrant(['shield', 'faerie_fire']),
        { kind: 'feature', value: { id: 'arcane_firearm', name: 'Arcane Firearm', description: 'You can use a wand, rod, or staff you\'re holding as a spellcasting focus for your artificer spells, and once per turn when you cast one of those spells through it, roll 1d8 and add the result to one damage roll of that spell. Flavor-only — no per-spell bonus-roll mechanism exists in the engine.', source: { kind: 'subclass', refId: 'artillerist' }, level: 3, effects: [], actions: [], choices: [], passive: true } },
        { kind: 'feature', value: { id: 'artillerist_eldritch_cannon', name: 'Eldritch Cannon', description: 'As an action, you can magically create a Small or Tiny eldritch cannon in an unoccupied space within 5 feet, choosing its type when it\'s created: Flamethrower, Force Ballister, or Protector. It lasts 1 hour (or until reduced to 0 HP, dismissed, or you create another). See the Companion section of your Combat tab to summon it — modeled here as the Force Ballister (a real attack card); the other two modes are described in the companion\'s own card but not separately mechanized.', source: { kind: 'subclass', refId: 'artillerist' }, level: 3, effects: [], actions: [], choices: [], passive: false, activation: { actionType: 'action', resourceCost: null, range: '5 feet', target: 'self', requiresSave: null } } },
      ],
    },
    { level: 5, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'explosive_cannon', name: 'Explosive Cannon', description: "Your eldritch cannon's damage rolls all gain a +1d8 bonus, and as a bonus action you can command it to explode, dealing 3d8 force damage in a 20-foot radius (DEX save for half) and destroying the cannon. Flavor-only — not auto-applied to the companion's dice.", source: { kind: 'subclass', refId: 'artillerist' }, level: 5, effects: [], actions: [], choices: [], passive: true } }] },
    { level: 9, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'fortified_position', name: 'Fortified Position', description: 'You and your allies have half cover while within 10 feet of your eldritch cannon(s), and you can now have two cannons active at once. Flavor-only — cover bonuses aren\'t auto-applied to AC/saves in this app.', source: { kind: 'subclass', refId: 'artillerist' }, level: 9, effects: [], actions: [], choices: [], passive: true } }] },
    { level: 15, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'empowered_cannons', name: 'Empowered Cannons', description: 'Whenever a creature you can see fails a saving throw against your eldritch cannon\'s damage, or you roll damage for it, add your Intelligence modifier to the damage dealt. Flavor-only — not auto-applied.', source: { kind: 'subclass', refId: 'artillerist' }, level: 15, effects: [], actions: [], choices: [], passive: true } }] },
  ],
};

// ── Battle Smith ──────────────────────────────────────────────────────────────

export const battleSmithProgression: SubclassProgression = {
  classId: 'artificer',
  name: 'Battle Smith',
  srd: false,
  entries: [
    {
      level: 3, hpDie: 8, choices: [],
      grants: [
        { kind: 'proficiency', value: { tools: ['smiths_tools'], weapons: ['martial'] } },
        { kind: 'feature', value: { id: 'tools_of_the_trade_battle_smith', name: 'Tools of the Trade', description: "You gain proficiency with smith's tools if you don't already have it.", source: { kind: 'subclass', refId: 'battle_smith' }, level: 3, effects: [], actions: [], choices: [], passive: true } },
        { kind: 'feature', value: { id: 'battle_smith_spells', name: 'Battle Smith Spells', description: "You always have certain spells prepared, and they don't count against the number of spells you can prepare. Approximated using spells already in this app's pack: Magic Missile, Shield.", source: { kind: 'subclass', refId: 'battle_smith' }, level: 3, effects: [], actions: [], choices: [], passive: true } },
        knownSpellsGrant(['magic_missile', 'shield']),
        { kind: 'feature', value: { id: 'battle_ready', name: 'Battle Ready', description: 'You gain proficiency with martial weapons (already applied). When you attack with a magic weapon, you can use your Intelligence modifier instead of Strength or Dexterity for the attack and damage rolls — not auto-applied; the engine has no attack/damage-roll bonus mechanism yet, so substitute the modifier manually.', source: { kind: 'subclass', refId: 'battle_smith' }, level: 3, effects: [], actions: [], choices: [], passive: true } },
        { kind: 'feature', value: { id: 'battle_smith_steel_defender', name: 'Steel Defender', description: 'You magically create a companion, the Steel Defender. See the Companion section of your Combat tab to summon it. Its HP and level track yours automatically; its attack and AC formulas need your proficiency bonus/Intelligence modifier added manually (see the companion\'s own card for the exact gap).', source: { kind: 'subclass', refId: 'battle_smith' }, level: 3, effects: [], actions: [], choices: [], passive: false, activation: { actionType: 'action', resourceCost: null, range: '5 feet', target: 'self', requiresSave: null } } },
      ],
    },
    { level: 5, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'extra_attack_battle_smith', name: 'Extra Attack', description: 'You can attack twice when you take the Attack action.', source: { kind: 'subclass', refId: 'battle_smith' }, level: 5, effects: [{ type: 'stat_modifier', target: 'extra_attack', operation: 'set', value: 1, condition: null }], actions: [], choices: [], passive: true } }] },
    {
      level: 9, hpDie: 8, choices: [],
      grants: [
        { kind: 'resource', value: { resourceId: 'arcane_jolt_pool', name: 'Arcane Jolt', maximum: 2, recharge: 'long_rest' } },
        { kind: 'feature', value: { id: 'arcane_jolt', name: 'Arcane Jolt', description: 'When you hit a creature with a magic weapon attack, or your Steel Defender hits a creature with its Force-Empowered Rend, you can spend one use to deal an extra 2d6 force damage, or restore 2d6 HP to a different creature within 30 feet. 2 uses per long rest. Damage/healing application isn\'t auto-applied — the app tracks only the resource pool.', source: { kind: 'subclass', refId: 'battle_smith' }, level: 9, effects: [], actions: [], choices: [], passive: false, activation: { actionType: 'free', resourceCost: { resourceId: 'arcane_jolt_pool', quantity: 1 }, range: '30 feet', target: 'single', requiresSave: null } } },
      ],
    },
    { level: 15, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'improved_defender', name: 'Improved Defender', description: "Your Steel Defender's Force-Empowered Rend deals an extra 1d8 damage, and when it would drop to 0 HP, it can instead drop to 1 HP once. Your Arcane Jolt dice increase to 4d6. Flavor-only — none of these numeric bumps are auto-applied to the companion's own card yet.", source: { kind: 'subclass', refId: 'battle_smith' }, level: 15, effects: [], actions: [], choices: [], passive: true } }] },
  ],
};

// ── Archivist (Unearthed Arcana — NON-OFFICIAL, experimental) ─────────────────

const archivistSkillChoice = {
  id: 'archivist_bonus_skills', prompt: 'Choose 2 bonus skills from the Artificer skill list.',
  kind: 'skill' as const, count: 2,
  pool: [
    { id: 'arcana',        label: 'Arcana',        value: 'arcana' },
    { id: 'history',       label: 'History',       value: 'history' },
    { id: 'investigation', label: 'Investigation', value: 'investigation' },
    { id: 'medicine',      label: 'Medicine',      value: 'medicine' },
    { id: 'nature',        label: 'Nature',        value: 'nature' },
    { id: 'perception',    label: 'Perception',    value: 'perception' },
  ],
  grants: [], required: true, resolved: false,
};

export const archivistProgression: SubclassProgression = {
  classId: 'artificer',
  name: 'Archivist (Unearthed Arcana — non-official)',
  srd: false,
  entries: [
    {
      level: 3, hpDie: 8, choices: [archivistSkillChoice],
      grants: [
        { kind: 'feature', value: { id: 'archivist_ua_notice', name: 'Non-Official Content Notice', description: 'The Archivist is from a February 2019 Unearthed Arcana playtest ("Prototype Artificer") and was cut from the final Tasha\'s Cauldron of Everything release, replaced by the four official specialists. It never received official balance passes — treat it as experimental homebrew-adjacent content.', source: { kind: 'subclass', refId: 'archivist' }, level: 3, effects: [], actions: [], choices: [], passive: true } },
        { kind: 'feature', value: { id: 'archivist_spells', name: 'Archivist Spells', description: "You always have certain spells prepared, and they don't count against the number of spells you can prepare. Approximated using spells already in this app's pack: Guidance, Mending.", source: { kind: 'subclass', refId: 'archivist' }, level: 3, effects: [], actions: [], choices: [], passive: true } },
        knownSpellsGrant(['guidance', 'mending']),
        { kind: 'feature', value: { id: 'rapid_review', name: 'Rapid Review', description: 'As a bonus action, expend a spell slot to instantly determine whether an object is magical and, if so, learn its properties — or to read and understand a language you don\'t know for 1 minute per slot level. Flavor-only — no item-identification or language mechanic exists in the engine to hook this into.', source: { kind: 'subclass', refId: 'archivist' }, level: 3, effects: [], actions: [], choices: [], passive: false } },
      ],
    },
    { level: 5, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'travelers_insight', name: "Traveler's Insight", description: 'A number of times equal to your Intelligence modifier per long rest, you can grant yourself or an ally within 30 feet advantage on an Intelligence, Wisdom, or Charisma check. Flavor-only — no reusable "grant advantage remotely" mechanism exists yet.', source: { kind: 'subclass', refId: 'archivist' }, level: 5, effects: [], actions: [], choices: [], passive: false } }] },
    { level: 9, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'vermin_sight', name: 'Vermin Sight', description: 'As an action, you can see through the senses of a Tiny beast or construct you can see, for up to 10 minutes. Flavor-only — no alternate-senses/possession mechanic exists in the engine.', source: { kind: 'subclass', refId: 'archivist' }, level: 9, effects: [], actions: [], choices: [], passive: false } }] },
    { level: 15, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'panacea', name: 'Panacea', description: 'As an action, touch a creature to cure it of one disease or poison, or end one condition affecting it (blinded, deafened, paralyzed, or stunned), a number of times per long rest equal to your Intelligence modifier. Flavor-only — apply the cure by manually removing the condition/effect in this app.', source: { kind: 'subclass', refId: 'archivist' }, level: 15, effects: [], actions: [], choices: [], passive: false } }] },
  ],
};

export const ARTIFICER_SUBCLASSES: SubclassProgression[] = [
  armorerProgression,
  alchemistProgression,
  artilleristProgression,
  battleSmithProgression,
  archivistProgression,
];
