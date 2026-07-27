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

export const ALL_BEAST_FORMS: BeastForm[] = [
  formWolf,
  formGiantSpider,
  formBrownBear,
];
