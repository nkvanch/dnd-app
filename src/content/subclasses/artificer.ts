// ============================================================================
// FILE: src/content/subclasses/artificer.ts
// Artificer Specialists (Tasha's Cauldron of Everything, official): Armorer,
// Alchemist, Artillerist, Battle Smith. Plus two EXPERIMENTAL, NON-OFFICIAL
// Unearthed Arcana subclasses that never made it into a published book,
// clearly labeled below: Archivist (Feb 2019 "Prototype Artificer" UA,
// replaced by the four official specialists) and an earlier UA draft of
// Armorer that's mechanically distinct from the official one. Included at
// the user's request.
//
// The official specialists' "always prepared" spell lists are approximated
// from spells already in this app's content pack — a few substitute for the
// exact official TCE list where that spell isn't in the pack yet, each
// noted explicitly. The two UA subclasses' bonus-spell tables are left
// fully unwired and descriptive instead (most referenced spells aren't in
// the library), matching the precedent set for every other class's
// oath/conclave/expanded spell lists. Battle Smith and Artillerist grant a
// companion via src/engine/companion.ts; the granting feature's id MUST
// match a key in
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
// CORRECTED this session: the previous version of this progression (Rapid
// Review, Traveler's Insight, Vermin Sight, Panacea) was an approximation
// authored before the real UA source text was available, and didn't
// actually match the real February 2019 "Prototype Artificer" playtest
// document (Artificial Mind, Mind Network, Pure Information) at all. This
// rewrite uses the real source, cross-checked against the reference zip.
// Bonus spell table: 8 of the 10 Archivist Spells (Dissonant Whispers,
// Detect Thoughts, Locate Object, Tongues, Locate Creature, Phantasmal
// Killer, Legend Lore, Modify Memory) aren't in this codebase's spell
// library yet, so — matching the Paladin/Ranger/Sorcerer/Warlock precedent —
// the table stays fully unwired and descriptive rather than a 2-of-10
// patchwork.

const archivistSkillChoice = {
  id: 'archivist_bonus_skills', prompt: "Choose 2 skills based on your artificial mind's material (Animal: Animal Handling/Insight/Medicine/Perception/Survival; Mineral: Deception/Intimidation/Performance/Persuasion; Plant: Arcana/History/Investigation/Nature/Religion).",
  kind: 'skill' as const, count: 2, pool: 'all' as const,
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
        { kind: 'feature', value: { id: 'archivist_tools_of_the_trade', name: 'Tools of the Trade', description: "Gain proficiency with (and a free set of) calligrapher's supplies and a forgery kit. Scroll-category magic items take a quarter of the normal time and half the usual gold to craft.", source: { kind: 'subclass', refId: 'archivist' }, level: 3, effects: [
          { type: 'grant_proficiency', target: 'tool:calligraphers_supplies', operation: 'add', value: null, condition: null },
          { type: 'grant_proficiency', target: 'tool:forgery_kit', operation: 'add', value: null, condition: null },
        ], actions: [], choices: [], passive: true } },
        { kind: 'feature', value: { id: 'archivist_spells', name: 'Archivist Spells', description: "You always have certain spells prepared at levels 3/5/9/13/17 (Comprehend Languages, Dissonant Whispers, Detect Thoughts, Locate Object, Hypnotic Pattern, Tongues, Locate Creature, Phantasmal Killer, Legend Lore, Modify Memory) that don't count against your spells prepared. Not wired via known_spells — 8 of the 10 referenced spells aren't in this codebase's spell library yet.", source: { kind: 'subclass', refId: 'archivist' }, level: 3, effects: [], actions: [], choices: [], passive: true } },
        { kind: 'resource', value: { resourceId: 'artificial_mind_pool', name: 'Artificial Mind', maximum: 1, recharge: 'long_rest' } },
        { kind: 'feature', value: { id: 'artificial_mind', name: 'Artificial Mind', description: 'After a long rest with your calligrapher\'s supplies on hand, awaken a mind inside a Tiny object (an existing one dissipates). While on your person, gain proficiency in two skills tied to the object\'s material (see the skill choice above). Usable once per long rest — creating a new one replaces the last.', source: { kind: 'subclass', refId: 'archivist' }, level: 3, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'free', resourceCost: { resourceId: 'artificial_mind_pool', quantity: 1 }, range: 'self', target: 'self', requiresSave: null },
          abilityEffects: [] } },
        { kind: 'resource', value: { resourceId: 'manifest_mind_archivist_pool', name: 'Manifest Mind (scales with Intelligence modifier)', maximum: 1, recharge: 'long_rest' } },
        { kind: 'feature', value: { id: 'manifest_mind_archivist', name: 'Manifest Mind', description: 'As a bonus action while your Artificial Mind item is on your person, manifest it as an intangible Tiny spectral presence within 60 feet, shedding dim light in a 10-foot radius, with darkvision 60 feet and telepathic sight/hearing shared with you. As an action, see and hear through it (as if concentrating on a spell) or cast an artificer spell from its space. Moves 30 feet as a bonus action; stops manifesting past 300 feet or on dismissal. Usable a number of times equal to your Intelligence modifier (minimum once) per long rest — tracked here as a single-use pool; increase its maximum to match.', source: { kind: 'subclass', refId: 'archivist' }, level: 3, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'bonus_action', resourceCost: { resourceId: 'manifest_mind_archivist_pool', quantity: 1 }, range: '60 feet', target: 'self', requiresSave: null },
          abilityEffects: [] } },
        { kind: 'feature', value: { id: 'information_overload', name: 'Information Overload', description: 'As an action while your Artificial Mind item is on your person, target a creature within 5 feet of the manifested mind with an Intelligence save against your spell save DC; on a failure it takes 1d8 psychic damage (2d8 at level 5, 3d8 at level 11, 4d8 at level 17) and the next attack roll against it before the end of your next turn has advantage. Expend a spell slot for extra damage: 2d8 for a 1st-level slot, plus 1d8 per level higher.', source: { kind: 'subclass', refId: 'archivist' }, level: 3, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'action', resourceCost: null, range: '5 feet', target: 'single', requiresSave: { ability: 'int', dc: 'spell_save_dc' } },
          abilityEffects: [{ type: 'damage', dice: '1d8', damageType: 'psychic' }] } },
      ],
    },
    { level: 5, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'mind_network', name: 'Mind Network', description: 'While your Artificial Mind item is on your person, communicate telepathically (even across planes) with anyone carrying an item bearing one of your artificer infusions. Add your Intelligence modifier (minimum +1) to any psychic damage roll for an artificer spell or Information Overload. No formula slot exists for this flat conditional bonus — apply manually.', source: { kind: 'subclass', refId: 'archivist' }, level: 5, effects: [], actions: [], choices: [], passive: true } }] },
    { level: 14, hpDie: 8, choices: [],
      grants: [
        { kind: 'resource', value: { resourceId: 'infoportation_pool', name: 'Infoportation', maximum: 1, recharge: 'long_rest' } },
        { kind: 'feature', value: { id: 'infoportation', name: 'Infoportation', description: 'As an action while your Artificial Mind item is on your person, teleport to the unoccupied space nearest to your manifested mind or to an item bearing one of your infusions. Usable once free per long rest, or again by spending a 2nd-level-or-higher spell slot.', source: { kind: 'subclass', refId: 'archivist' }, level: 14, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'action', resourceCost: { resourceId: 'infoportation_pool', quantity: 1 }, range: 'self', target: 'self', requiresSave: null },
          abilityEffects: [] } },
        { kind: 'feature', value: { id: 'mind_overload', name: 'Information Overload: Mind Overload', description: 'When you expend a spell slot to boost Information Overload\'s damage, the target also makes an Intelligence save against your spell save DC or is stunned until the end of your next turn.', source: { kind: 'subclass', refId: 'archivist' }, level: 14, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'free', resourceCost: null, range: '5 feet', target: 'single', requiresSave: { ability: 'int', dc: 'spell_save_dc' } },
          abilityEffects: [{ type: 'apply_condition', conditionId: 'stunned', duration: { unit: 'rounds', remaining: 1 } }] } },
      ] },
  ],
};

// ── Armorer (Unearthed Arcana draft) ─────────────────────────────────────────
// An earlier UA draft of the Armorer that's mechanically distinct from the
// official Tasha's Cauldron of Everything version already authored above
// (different spell list, a Defensive Field bonus action, a
// disadvantage-on-attacks-elsewhere rider on Thunder Gauntlets, Powered
// Steps/Second Skin passives, and a different capstone) — kept as a
// separate subclass rather than merged into the official one.
export const armorerUaProgression: SubclassProgression = {
  classId: 'artificer',
  name: 'Armorer (Unearthed Arcana draft)',
  srd: false,
  entries: [
    {
      level: 3, hpDie: 8, choices: [],
      grants: [
        { kind: 'proficiency', value: { armor: ['heavy'] } },
        { kind: 'feature', value: { id: 'armorer_ua_notice', name: 'Non-Official Content Notice', description: 'This is an earlier Unearthed Arcana draft of the Armorer, distinct from the official Tasha\'s Cauldron of Everything version (already available as "Armorer" in this app). It never received official balance passes.', source: { kind: 'subclass', refId: 'armorer_ua' }, level: 3, effects: [], actions: [], choices: [], passive: true } },
        { kind: 'feature', value: { id: 'armorer_ua_tools_of_the_trade', name: 'Tools of the Trade', description: "Gain proficiency with heavy armor and smith's tools; if you already have the latter, gain proficiency with one other artisan's tool type of your choice instead.", source: { kind: 'subclass', refId: 'armorer_ua' }, level: 3, effects: [
          { type: 'grant_proficiency', target: 'tool:smiths_tools', operation: 'add', value: null, condition: null },
        ], actions: [], choices: [], passive: true } },
        { kind: 'feature', value: { id: 'armorer_ua_spells', name: 'Armorer Spells', description: "You always have certain spells prepared at levels 3/5/9/13/17 (Magic Missile, Shield, Mirror Image, Shatter, Hypnotic Pattern, Lightning Bolt, Fire Shield, Greater Invisibility, Passwall, Wall of Force) that don't count against your spells prepared. Not wired via known_spells — Fire Shield and Passwall aren't in this codebase's spell library yet, and this table is kept fully descriptive to match the same treatment given every other subclass's bonus-spell table.", source: { kind: 'subclass', refId: 'armorer_ua' }, level: 3, effects: [], actions: [], choices: [], passive: true } },
        { kind: 'feature', value: { id: 'power_armor', name: 'Power Armor', description: 'As an action with smith\'s tools in hand, turn worn heavy armor into power armor: no Strength requirement, usable as a spellcasting focus, and it attaches to you (can\'t be removed against your will, replaces missing limbs) until you doff it, don other armor, or die.', source: { kind: 'subclass', refId: 'armorer_ua' }, level: 3, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'action', resourceCost: null, range: 'self', target: 'self', requiresSave: null },
          abilityEffects: [] } },
        { kind: 'feature', value: { id: 'armorer_ua_guardian_gauntlets', name: 'Armor Model: Guardian — Thunder Gauntlets', description: 'Guardian model melee weapon: 1d8 thunder damage on a hit, using INT for attack/damage rolls; a creature hit has disadvantage on attack rolls against targets other than you until the start of your next turn. The disadvantage rider isn\'t auto-applied — track it manually.', source: { kind: 'subclass', refId: 'armorer_ua' }, level: 3, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'action', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
          abilityEffects: [{ type: 'damage', dice: '1d8', damageType: 'thunder' }] } },
        { kind: 'feature', value: { id: 'defensive_field', name: 'Armor Model: Guardian — Defensive Field', description: 'As a bonus action on each of your turns, gain temporary hit points equal to your artificer level, replacing any you already have; lost if you doff the armor. No temporary-hit-point AbilityEffect exists in the engine — apply manually.', source: { kind: 'subclass', refId: 'armorer_ua' }, level: 3, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'bonus_action', resourceCost: null, range: 'self', target: 'self', requiresSave: null },
          abilityEffects: [] } },
        { kind: 'feature', value: { id: 'armorer_ua_infiltrator_launcher', name: 'Armor Model: Infiltrator — Lightning Launcher', description: 'Infiltrator model ranged weapon (90 ft normal/300 ft long range): 1d6 lightning damage on a hit, using INT for attack/damage rolls; once per turn on a hit, deal an extra 1d6 lightning damage.', source: { kind: 'subclass', refId: 'armorer_ua' }, level: 3, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'action', resourceCost: null, range: '90 feet', target: 'single', requiresSave: null },
          abilityEffects: [{ type: 'damage', dice: '1d6', damageType: 'lightning' }] } },
        { kind: 'feature', value: { id: 'powered_steps', name: 'Armor Model: Infiltrator — Powered Steps and Second Skin', description: 'While the Infiltrator model is active, your walking speed increases by 5 feet, the armor becomes negligible in weight and wearable under clothing, and it doesn\'t impose Dexterity (Stealth) disadvantage. Model-conditional — the engine has no state tracking for which armor model is currently active, so this stays manual rather than a permanent always-on bonus.', source: { kind: 'subclass', refId: 'armorer_ua' }, level: 3, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    { level: 5, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'armorer_ua_extra_attack', name: 'Extra Attack', description: 'You can attack twice when you take the Attack action.', source: { kind: 'subclass', refId: 'armorer_ua' }, level: 5, effects: [{ type: 'stat_modifier', target: 'extra_attack', operation: 'set', value: 1, condition: null }], actions: [], choices: [], passive: true } }] },
    { level: 9, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'armorer_ua_modifications', name: 'Armor Modifications', description: 'Your power armor counts as four separate items (chest, boots, bracers, weapon) for Infuse Item purposes, and your infusion cap increases by 2 (those extra slots must be part of the power armor). Flavor-only, matching the official Armorer\'s own version of this feature.', source: { kind: 'subclass', refId: 'armorer_ua' }, level: 9, effects: [], actions: [], choices: [], passive: true } }] },
    { level: 15, hpDie: 8, choices: [],
      grants: [
        { kind: 'resource', value: { resourceId: 'perfected_armor_ua_pool', name: 'Perfected Armor: Guardian Pull (scales with Intelligence modifier)', maximum: 1, recharge: 'long_rest' } },
        { kind: 'feature', value: { id: 'perfected_armor_ua', name: 'Perfected Armor', description: 'Guardian: when a creature you can see ends its turn within 30 feet, use your reaction to force a Strength save against your spell save DC or pull it up to 30 feet toward you; if pulled within 5 feet, make a melee weapon attack against it as part of the reaction. Usable a number of times equal to your Intelligence modifier (minimum once) per long rest — tracked here as a single-use pool; increase its maximum to match. Infiltrator: a creature damaged by your Lightning Launcher glimmers with light until the start of your next turn, shedding dim light in 5 feet; the next attack against it by someone else has advantage and deals an extra 1d6 lightning damage on a hit — model-conditional, apply manually.', source: { kind: 'subclass', refId: 'armorer_ua' }, level: 15, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'reaction', resourceCost: { resourceId: 'perfected_armor_ua_pool', quantity: 1 }, range: '30 feet', target: 'single', requiresSave: { ability: 'str', dc: 'spell_save_dc' } },
          abilityEffects: [] } },
      ] },
  ],
};

export const ARTIFICER_SUBCLASSES: SubclassProgression[] = [
  armorerProgression,
  alchemistProgression,
  artilleristProgression,
  battleSmithProgression,
  archivistProgression,
  armorerUaProgression,
];
