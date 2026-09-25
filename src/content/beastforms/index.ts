// ============================================================================
// FILE: src/content/beastforms/index.ts
// A small curated set of SRD-legal low/mid-CR beasts for Wild Shape.
// v1 scope per docs/ROADMAP_1.0.md: no builder, no homebrew forms — a
// hand-picked list covering low-level Circle of the Land/Moon play. All of
// these are in the SRD 5.1 monster list, so there's no legal issue with the
// stat blocks themselves (unlike spell names, monster stat blocks in the SRD
// are fair game to reproduce under CC-BY-4.0, with attribution on the About
// screen — see ROADMAP_1.0.md Step 1.5).
//
// IMPORTANT: the exact numbers below (hp/ac/attack dice) were written from
// memory during drafting, not cross-checked against a live copy of the SRD
// 5.1 monster appendix. Verify every stat block against the actual SRD text
// before shipping — treat this file as a structural draft, not a final
// source of truth, same as the "NEEDS VERIFICATION" spell tags.
// ============================================================================
import { BeastForm } from '../../engine/types';

export const formWolf: BeastForm = {
  id: 'wolf', name: 'Wolf', challengeRating: 0.25, size: 'Medium',
  stats: { str: 12, dex: 15, con: 12, int: 3, wis: 12, cha: 6 },
  ac: 13, hp: 11, speed: 40,
  // No special senses in the SRD stat block — normal vision only.
  attacks: [
    { name: 'Bite', effect: { type: 'damage', dice: '2d4+2', damageType: 'piercing' } },
  ],
  traits: [
    'Keen Hearing and Smell',
    'Pack Tactics — advantage on attack rolls against a creature if at least one of the wolf\u2019s allies is within 5 feet of the creature and the ally isn\u2019t incapacitated',
  ],
};

export const formGiantSpider: BeastForm = {
  id: 'giant_spider', name: 'Giant Spider', challengeRating: 1, size: 'Large',
  stats: { str: 14, dex: 16, con: 12, int: 2, wis: 11, cha: 4 },
  ac: 14, hp: 26, speed: 30, climbSpeed: 30,
  senses: [{ type: 'blindsight', range: 10 }, { type: 'darkvision', range: 60 }],
  attacks: [
    { name: 'Bite', effect: { type: 'damage', dice: '1d8+3', damageType: 'piercing' } },
  ],
  traits: [
    'Spider Climb — can climb difficult surfaces, including upside down on ceilings, without needing to make an ability check',
    'Web Sense — while in contact with a web, knows the exact location of any other creature in contact with the same web',
    'Web Walker — ignores movement restrictions caused by webbing',
  ],
};

export const formBrownBear: BeastForm = {
  id: 'brown_bear', name: 'Brown Bear', challengeRating: 1, size: 'Large',
  stats: { str: 19, dex: 10, con: 16, int: 2, wis: 13, cha: 7 },
  ac: 11, hp: 34, speed: 40, swimSpeed: 30,
  attacks: [
    { name: 'Bite', effect: { type: 'damage', dice: '1d8+4', damageType: 'piercing' } },
    { name: 'Claws', effect: { type: 'damage', dice: '2d6+4', damageType: 'slashing' } },
  ],
  traits: [
    'Keen Smell',
    'Multiattack — bite + claws. Shown as two separate action cards in v1; ' +
      'no automated multiattack sequencing, consistent with the app having no ' +
      'attack-roll automation anywhere else yet.',
  ],
};

// Elemental forms for Circle of the Moon's Elemental Wild Shape (L10).
// Same "written from memory, verify before shipping" caveat as the rest of
// this file — CR 5 SRD elementals, not cross-checked against the live text.
export const formAirElemental: BeastForm = {
  id: 'air_elemental', name: 'Air Elemental', challengeRating: 5, size: 'Large',
  stats: { str: 14, dex: 20, con: 14, int: 6, wis: 10, cha: 6 },
  ac: 15, hp: 90, speed: 0, flySpeed: 90,
  traits: [
    'Air Form — can move through a space as narrow as 1 inch without squeezing',
    'Whirlwind (action, 1/turn) — creatures in its space take bludgeoning damage and may be flung 20 feet away; not automated, resolve manually',
  ],
  attacks: [
    { name: 'Slam', effect: { type: 'damage', dice: '2d8+5', damageType: 'bludgeoning' } },
  ],
  // Rules-engine blocker RE-AUDIT closure (2A/2B, corrected): the real SRD/MM
  // Air Elemental stat block lists BOTH "Damage Immunities: poison" AND
  // (separately) "Condition Immunities: ... poisoned ...". This engine's
  // Round 3 comment claimed only the CONDITION was real and that the
  // DAMAGE immunity didn't exist — that was a genuine mistake, not a
  // deliberate correct call; every SRD 5.1 elemental (Air/Earth/Fire/Water)
  // carries the same "Damage Immunities: poison" line (Fire's block adds
  // fire on top of it), independent of the shared "poisoned" condition
  // immunity every elemental also has. damageImmunities only models damage
  // TYPES; condition immunity has no representation in this engine and
  // remains out of scope. The shared elemental resistance to bludgeoning/
  // piercing/slashing from NONMAGICAL attacks is real and RAW-significant
  // but qualified — see nonmagicalPhysicalResistance's own doc comment
  // (types.ts) for why it's a separate flag, resolved per-hit, not folded
  // into damageResistances (which means "always, unconditionally").
  damageResistances: ['lightning', 'thunder'],
  damageImmunities: ['poison'],
  nonmagicalPhysicalResistance: true,
};

export const formEarthElemental: BeastForm = {
  id: 'earth_elemental', name: 'Earth Elemental', challengeRating: 5, size: 'Large',
  stats: { str: 20, dex: 8, con: 20, int: 5, wis: 10, cha: 5 },
  ac: 17, hp: 126, speed: 30,
  traits: [
    'Burrow speed 30 ft — no dedicated burrowSpeed field in the engine, tracked as a trait note',
    'Earth Glide — can burrow through nonmagical, unworked earth and stone without disturbing it',
    'Siege Monster — deals double damage to objects and structures',
  ],
  attacks: [
    { name: 'Slam', effect: { type: 'damage', dice: '2d8+5', damageType: 'bludgeoning' } },
  ],
  // Poison damage immunity: same correction as Air Elemental above — the
  // real SRD/MM stat block gives Earth Elemental its own "Damage
  // Immunities: poison" line, distinct from the shared "poisoned" condition
  // immunity. Nonmagical B/P/S: see nonmagicalPhysicalResistance's own doc
  // comment.
  damageVulnerabilities: ['thunder'],
  damageImmunities: ['poison'],
  nonmagicalPhysicalResistance: true,
};

export const formFireElemental: BeastForm = {
  id: 'fire_elemental', name: 'Fire Elemental', challengeRating: 5, size: 'Large',
  stats: { str: 10, dex: 17, con: 16, int: 6, wis: 10, cha: 7 },
  ac: 13, hp: 102, speed: 50,
  traits: [
    'Fire Form — a creature that touches it or hits it with a melee attack while within 5 feet takes fire damage; not automated, resolve manually',
    'Illumination — sheds bright light in a 30-foot radius and dim light for an additional 30 feet',
    'Water Susceptibility — takes damage and disadvantage on attacks when submerged or splashed with water',
  ],
  attacks: [
    { name: 'Touch', effect: { type: 'damage', dice: '2d6+3', damageType: 'fire' } },
  ],
  // Fire Elemental's Damage Immunities entry is fire + poison — every SRD
  // elemental (Air/Earth/Fire/Water) has poison damage immunity; Fire's is
  // the only one that ALSO adds fire on top of it, unchanged by this
  // closure; re-verified, not duplicated.
  // Water Susceptibility above is a conditional (submerged/splashed) rider,
  // not an unconditional vulnerability — deliberately NOT represented as
  // damageVulnerabilities, which would incorrectly apply it to every hit.
  damageImmunities: ['fire', 'poison'],
  nonmagicalPhysicalResistance: true,
};

export const formWaterElemental: BeastForm = {
  id: 'water_elemental', name: 'Water Elemental', challengeRating: 5, size: 'Large',
  stats: { str: 18, dex: 14, con: 18, int: 5, wis: 10, cha: 8 },
  ac: 14, hp: 114, speed: 30, swimSpeed: 90,
  traits: [
    'Water Form — can enter a hostile creature\'s space and stop there',
    'Freeze — if it takes cold damage, it partially freezes and its speed is reduced by 20 feet until the end of its next turn',
  ],
  attacks: [
    { name: 'Slam', effect: { type: 'damage', dice: '2d8+4', damageType: 'bludgeoning' } },
  ],
  // Poison damage immunity: same correction as Air Elemental above — the
  // real SRD/MM stat block gives Water Elemental its own "Damage
  // Immunities: poison" line, distinct from the shared "poisoned" condition
  // immunity. Nonmagical B/P/S: see nonmagicalPhysicalResistance's own doc
  // comment.
  damageResistances: ['acid', 'fire'],
  damageImmunities: ['poison'],
  nonmagicalPhysicalResistance: true,
};

export const ALL_BEAST_FORMS: BeastForm[] = [
  formWolf,
  formGiantSpider,
  formBrownBear,
  formAirElemental,
  formEarthElemental,
  formFireElemental,
  formWaterElemental,
];
