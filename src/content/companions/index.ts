// src/content/companions/index.ts
// Registry of companion templates (Steel Defender, Eldritch Cannon, etc.),
// keyed by the id of the Feature that GRANTS access to summoning them.
// src/components/sheet/CompanionSection.tsx checks the owner's active
// features for a matching key to decide whether to show a "Summon X"
// button — this is a plain lookup table, not a new engine mechanism, so
// adding a companion later is just adding an entry here plus authoring the
// grant Feature with a matching id (see src/content/subclasses/artificer.ts).
import { CompanionTemplate } from '../../engine/companion';

// Neither companion's attack has a real attack-roll or spell-attack-bonus
// mechanism behind it (the same "no attack/damage-roll bonus mechanism"
// gap disclosed throughout this app — DerivedStats.attackBonuses is
// hardcoded empty). The dice are real; the to-hit/DC math must be added by
// hand at the table, same as a mundane weapon item's attack feature.

const STEEL_DEFENDER: CompanionTemplate = {
  id:   'steel_defender',
  name: 'Steel Defender',
  baseStats: { str: 14, dex: 12, con: 14, int: 4, wis: 10, cha: 6 },
  speed: 40,
  hpForOwnerLevel: (level) => 5 + 5 * level,
  features: [
    {
      id: 'steel_defender_ac', name: 'Defender Plating',
      description: 'Base AC 13. Per the book rule, add your (the Artificer\'s) proficiency bonus — the engine has no formula path yet for adding an owner\'s proficiency bonus onto a companion\'s AC, so it isn\'t auto-included.',
      source: { kind: 'class', refId: 'steel_defender' }, level: null, actions: [], choices: [], passive: true,
      effects: [{ type: 'base_ac_formula', target: 'ac', operation: 'set', value: 13, condition: null }],
    },
    {
      id: 'steel_defender_rend', name: 'Force-Empowered Rend',
      description: "Melee weapon attack, reach 5 ft. On a hit: 1d4 force damage. Add the Artificer's proficiency bonus to the attack roll and this damage roll, and their Intelligence modifier to the attack roll — not auto-calculated (see this file's header note).",
      source: { kind: 'class', refId: 'steel_defender' }, level: null, effects: [], choices: [], passive: false,
      activation: { actionType: 'action', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
      abilityEffects: [{ type: 'damage', dice: '1d4', damageType: 'force' }],
      actions: [],
    },
    {
      id: 'steel_defender_deflect', name: 'Deflect Attack',
      description: "Reaction: when a creature the Steel Defender can see hits a creature within 5 feet of it with an attack, the Steel Defender can impose disadvantage on that attack roll — if it still hits, the Defender takes the damage instead. Flavor-only — the app has no reaction-trigger automation.",
      source: { kind: 'class', refId: 'steel_defender' }, level: null, effects: [], actions: [], choices: [], passive: false,
    },
  ],
};

const ELDRITCH_CANNON: CompanionTemplate = {
  id:   'eldritch_cannon',
  name: 'Eldritch Cannon',
  baseStats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  speed: 0,
  hpForOwnerLevel: (level) => 5 + 2 * level,
  features: [
    {
      id: 'eldritch_cannon_ac', name: 'Cannon Housing',
      description: 'AC 18. Immune to poison and psychic damage, and to any effect that requires making a saving throw unless the effect can target objects. It can\'t move on its own, though you can take a bonus action to move it up to 15 feet.',
      source: { kind: 'class', refId: 'eldritch_cannon' }, level: null, actions: [], choices: [], passive: true,
      effects: [
        { type: 'base_ac_formula', target: 'ac', operation: 'set', value: 18, condition: null },
        { type: 'grant_immunity', target: 'poison', operation: 'immunity', value: null, condition: null },
        { type: 'grant_immunity', target: 'psychic', operation: 'immunity', value: null, condition: null },
      ],
    },
    {
      id: 'eldritch_cannon_attack', name: 'Force Ballista (default mode)',
      description: "One of three types chosen when the cannon is created — Flamethrower (15-ft cone, fire damage, DEX save), Protector (bonus action, grants temp HP to allies within 10 ft), or Force Ballista, modeled here. Force Ballister: ranged spell attack, range 120 ft. On a hit: 2d8 force damage, target pushed 5 ft away. Attack bonus / save DC not auto-calculated — see this file's header note. Which mode is active each day isn't tracked by the app; note it manually.",
      source: { kind: 'class', refId: 'eldritch_cannon' }, level: null, effects: [], choices: [], passive: false,
      activation: { actionType: 'action', resourceCost: null, range: '120 feet', target: 'single', requiresSave: null },
      abilityEffects: [{ type: 'damage', dice: '2d8', damageType: 'force' }],
      actions: [],
    },
  ],
};

const RANGERS_WOLF: CompanionTemplate = {
  id:   'rangers_wolf',
  name: "Ranger's Companion (Wolf)",
  baseStats: { str: 12, dex: 15, con: 12, int: 3, wis: 12, cha: 6 },
  speed: 40,
  hpForOwnerLevel: (level) => 4 * level,
  features: [
    {
      id: 'rangers_wolf_bite', name: 'Bite',
      description: "Melee weapon attack, reach 5 ft. On a hit: 2d4 piercing damage. Uses your (the Ranger's) proficiency bonus for the attack and damage rolls per Ranger's Companion — not auto-calculated, the engine has no formula path for an owner's proficiency bonus onto a companion's attack.",
      source: { kind: 'class', refId: 'rangers_wolf' }, level: null, effects: [], choices: [], passive: false,
      activation: { actionType: 'action', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
      abilityEffects: [{ type: 'damage', dice: '2d4', damageType: 'piercing' }],
      actions: [],
    },
    {
      id: 'rangers_wolf_pack_tactics', name: 'Pack Tactics',
      description: 'The wolf has advantage on an attack roll against a creature if at least one of the wolf\'s allies is within 5 feet of the creature and the ally isn\'t incapacitated.',
      source: { kind: 'class', refId: 'rangers_wolf' }, level: null, actions: [], choices: [], passive: true,
      // Bug fix (item 9, context-dependent/three-state mechanics): this
      // used to be an unconditional advantage effect — the app can't
      // observe battlefield positioning, so it was always silently
      // granting advantage regardless of whether an ally was actually
      // within 5 feet. Now gated behind an explicit situational question
      // (defaults to not-applying until answered Yes) via the new
      // Effect.situational mechanism, and targets the properly-declared
      // 'adv.attack_rolls' key (resolver.ts's TARGET_STRATEGY) instead of
      // a freeform descriptive string. Note: adv.attack_rolls itself has
      // no numeric consumer anywhere yet — this app has no attack-roll
      // auto-resolution (the player rolls their own dice) — so this fix
      // is about correct/honest tagging, not a new visible number; the
      // question now shows up in TabFeatures' Situational section either way.
      effects: [{ type: 'stat_modifier', target: 'adv.attack_rolls', operation: 'advantage', value: null, condition: null, situational: { id: 'ally_within_5ft_of_target', question: "Is an ally within 5 feet of the target (and not incapacitated)?" } }],
    },
  ],
};

export const COMPANION_TEMPLATES_BY_GRANT_FEATURE: Record<string, CompanionTemplate> = {
  battle_smith_steel_defender: STEEL_DEFENDER,
  artillerist_eldritch_cannon: ELDRITCH_CANNON,
  rangers_companion: RANGERS_WOLF,
};
