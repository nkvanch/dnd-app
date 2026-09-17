// ============================================================================
// FILE: src/content/backgrounds/index.ts
// All 13 PHB backgrounds.
// ============================================================================
import { Background, RulesetId, ChoiceOption, BACKGROUND_CHOICE_PREFIX } from '../../engine/types';
import { ALL_TOOLS } from '../tools';

/** CHOICE-EXPANSION-2: same helper other content files use — restricts a
 * tool choice's pool to one or more canonical categories. */
function toolCategoryPool(...categories: string[]): ChoiceOption[] {
  return ALL_TOOLS.filter(t => categories.includes(t.category)).map(t => ({ id: t.id, label: t.name, value: t.id }));
}

export const bgAcolyte: Background = {
  id: 'acolyte',
  name: 'Acolyte',
  srd: true,
  // FILTER-METADATA-2: known from the PHB (same authoritative text
  // app/creation/background.tsx's BG_DETAIL table already displayed) but
  // not mechanically granted anywhere in the engine — no grant_proficiency
  // 'tool:' effect exists for backgrounds today (confirmed: zero such
  // effects in this file), same class of gap as CharClass's armor/weapon
  // profs. Populated here as additive filter/display metadata only.
  toolProficiencies: [],
  features: [
    {
      id: 'acolyte_proficiencies',
      name: 'Skill Proficiencies',
      description: 'You are proficient in Insight and Religion.',
      source: { kind: 'background', refId: 'acolyte' },
      level: null, actions: [], choices: [], passive: true,
      effects: [
        { type: 'grant_proficiency', target: 'skill:insight',  operation: 'add', value: null, condition: null },
        { type: 'grant_proficiency', target: 'skill:religion', operation: 'add', value: null, condition: null },
      ],
    },
    {
      id: 'shelter_of_faithful',
      name: 'Shelter of the Faithful',
      description: 'As an acolyte, you command the respect of those who share your faith, and you can perform the religious ceremonies of your deity.',
      source: { kind: 'background', refId: 'acolyte' },
      level: null, effects: [], actions: [], choices: [], passive: true,
    },
  ],
};

/**
 * 2024 PHB ("5.5e") revised Acolyte — Phase 5 second proof-of-concept,
 * exercising Background.flexibleAsi (the other half of 2024's defining
 * change: species lost the flat ASI, backgrounds gained a directed one).
 * Distinct id from classic `acolyte`, same reasoning as raceHuman2024 in
 * src/content/races/index.ts — sidesteps same-id content-resolution rather
 * than inventing an answer for one proof background.
 *
 * Skill proficiencies stay the same as classic Acolyte (Insight/Religion —
 * 2024 didn't change this pairing). The tool proficiency and Origin feat
 * a real 2024 Acolyte also grants are disclosed-only here, same pattern
 * raceHuman2024's "Versatile" trait uses — no engine mechanism exists yet
 * for tool proficiencies or feat grants tied to background selection.
 */
export const bgAcolyte2024: Background = {
  id: 'acolyte_2024',
  name: 'Acolyte',
  rulesetId: 'dnd5e-2024' as RulesetId,
  srd: false,
  flexibleAsi: {
    prompt: 'Choose Wisdom, Intelligence, or Charisma: increase one by 2 and a different one by 1, or increase all three by 1 each.',
    mode: { kind: 'two_one_or_three_one', restrictTo: ['wis', 'int', 'cha'] },
  },
  features: [
    {
      id: 'acolyte_2024_proficiencies',
      name: 'Skill Proficiencies',
      description: 'You are proficient in Insight and Religion.',
      source: { kind: 'background', refId: 'acolyte_2024' },
      level: null, actions: [], choices: [], passive: true,
      effects: [
        { type: 'grant_proficiency', target: 'skill:insight',  operation: 'add', value: null, condition: null },
        { type: 'grant_proficiency', target: 'skill:religion', operation: 'add', value: null, condition: null },
      ],
    },
    {
      id: 'acolyte_2024_feat_note',
      name: 'Origin Feat',
      description: 'You gain one Origin feat of your choice. Take it on the Feats screen during creation (enable the "Feat at 1st level" campaign rule if it isn\'t already, so that screen is reachable) — same disclosed pattern used elsewhere for background/race-granted feats.',
      source: { kind: 'background', refId: 'acolyte_2024' },
      level: null, effects: [], actions: [], choices: [], passive: true,
    },
    {
      id: 'shelter_of_faithful_2024',
      name: 'Shelter of the Faithful',
      description: 'As an acolyte, you command the respect of those who share your faith, and you can perform the religious ceremonies of your deity.',
      source: { kind: 'background', refId: 'acolyte_2024' },
      level: null, effects: [], actions: [], choices: [], passive: true,
    },
  ],
};

export const bgCharlatan: Background = {
  id: 'charlatan',
  name: 'Charlatan',
  srd: false,
  toolProficiencies: ['Disguise kit', 'Forgery kit'],
  features: [
    {
      id: 'charlatan_proficiencies',
      name: 'Skill Proficiencies',
      description: 'You are proficient in Deception and Sleight of Hand.',
      source: { kind: 'background', refId: 'charlatan' },
      level: null, actions: [], choices: [], passive: true,
      effects: [
        { type: 'grant_proficiency', target: 'skill:deception',      operation: 'add', value: null, condition: null },
        { type: 'grant_proficiency', target: 'skill:sleight_of_hand', operation: 'add', value: null, condition: null },
      ],
    },
    {
      id: 'false_identity',
      name: 'False Identity',
      description: 'You have created a second identity that includes documentation, established acquaintances, and disguises.',
      source: { kind: 'background', refId: 'charlatan' },
      level: null, effects: [], actions: [], choices: [], passive: true,
    },
  ],
};

export const bgCriminal: Background = {
  id: 'criminal',
  name: 'Criminal',
  srd: false,
  toolProficiencies: ["Thieves' tools", 'One gaming set'],
  // CHOICE-EXPANSION-2: "one gaming set of your choice" is a genuine player
  // choice — Thieves' tools above remains a fixed, automatic grant (this
  // background never mechanically enforced either one before this).
  pendingChoices: [
    {
      id: `${BACKGROUND_CHOICE_PREFIX}criminal_gaming_set`,
      prompt: 'Choose one gaming set.',
      kind: 'tool', count: 1, pool: toolCategoryPool('gaming_set'),
      grants: [], required: true, resolved: false,
    },
  ],
  features: [
    {
      id: 'criminal_proficiencies',
      name: 'Skill Proficiencies',
      description: 'You are proficient in Deception and Stealth.',
      source: { kind: 'background', refId: 'criminal' },
      level: null, actions: [], choices: [], passive: true,
      effects: [
        { type: 'grant_proficiency', target: 'skill:deception', operation: 'add', value: null, condition: null },
        { type: 'grant_proficiency', target: 'skill:stealth',   operation: 'add', value: null, condition: null },
      ],
    },
    {
      id: 'criminal_contact',
      name: 'Criminal Contact',
      description: 'You have a reliable and trustworthy contact who acts as your liaison to a network of other criminals.',
      source: { kind: 'background', refId: 'criminal' },
      level: null, effects: [], actions: [], choices: [], passive: true,
    },
  ],
};

export const bgEntertainer: Background = {
  id: 'entertainer',
  name: 'Entertainer',
  srd: false,
  toolProficiencies: ['Disguise kit', 'One musical instrument'],
  features: [
    {
      id: 'entertainer_proficiencies',
      name: 'Skill Proficiencies',
      description: 'You are proficient in Acrobatics and Performance.',
      source: { kind: 'background', refId: 'entertainer' },
      level: null, actions: [], choices: [], passive: true,
      effects: [
        { type: 'grant_proficiency', target: 'skill:acrobatics',  operation: 'add', value: null, condition: null },
        { type: 'grant_proficiency', target: 'skill:performance', operation: 'add', value: null, condition: null },
      ],
    },
    {
      id: 'by_popular_demand',
      name: 'By Popular Demand',
      description: 'You can always find a place to perform, and in exchange receive free lodging and food.',
      source: { kind: 'background', refId: 'entertainer' },
      level: null, effects: [], actions: [], choices: [], passive: true,
    },
  ],
};

export const bgFolkHero: Background = {
  id: 'folk_hero',
  name: 'Folk Hero',
  srd: false,
  toolProficiencies: ["One artisan's tools", 'Vehicles (land)'],
  features: [
    {
      id: 'folk_hero_proficiencies',
      name: 'Skill Proficiencies',
      description: 'You are proficient in Animal Handling and Survival.',
      source: { kind: 'background', refId: 'folk_hero' },
      level: null, actions: [], choices: [], passive: true,
      effects: [
        { type: 'grant_proficiency', target: 'skill:animal_handling', operation: 'add', value: null, condition: null },
        { type: 'grant_proficiency', target: 'skill:survival',        operation: 'add', value: null, condition: null },
      ],
    },
    {
      id: 'rustic_hospitality',
      name: 'Rustic Hospitality',
      description: 'Since you come from the ranks of the common folk, you fit in among them with ease.',
      source: { kind: 'background', refId: 'folk_hero' },
      level: null, effects: [], actions: [], choices: [], passive: true,
    },
  ],
};

export const bgGuildArtisan: Background = {
  id: 'guild_artisan',
  name: 'Guild Artisan',
  srd: false,
  toolProficiencies: ["One artisan's tools"],
  features: [
    {
      id: 'guild_artisan_proficiencies',
      name: 'Skill Proficiencies',
      description: 'You are proficient in Insight and Persuasion.',
      source: { kind: 'background', refId: 'guild_artisan' },
      level: null, actions: [], choices: [], passive: true,
      effects: [
        { type: 'grant_proficiency', target: 'skill:insight',    operation: 'add', value: null, condition: null },
        { type: 'grant_proficiency', target: 'skill:persuasion', operation: 'add', value: null, condition: null },
      ],
    },
    {
      id: 'guild_membership',
      name: 'Guild Membership',
      description: 'As an established and respected member of a guild, you can rely on certain benefits from that membership.',
      source: { kind: 'background', refId: 'guild_artisan' },
      level: null, effects: [], actions: [], choices: [], passive: true,
    },
  ],
};

export const bgHermit: Background = {
  id: 'hermit',
  name: 'Hermit',
  srd: false,
  toolProficiencies: ['Herbalism kit'],
  features: [
    {
      id: 'hermit_proficiencies',
      name: 'Skill Proficiencies',
      description: 'You are proficient in Medicine and Religion.',
      source: { kind: 'background', refId: 'hermit' },
      level: null, actions: [], choices: [], passive: true,
      effects: [
        { type: 'grant_proficiency', target: 'skill:medicine', operation: 'add', value: null, condition: null },
        { type: 'grant_proficiency', target: 'skill:religion', operation: 'add', value: null, condition: null },
      ],
    },
    {
      id: 'discovery',
      name: 'Discovery',
      description: 'The quiet seclusion of your extended hermitage gave you access to a unique and powerful discovery.',
      source: { kind: 'background', refId: 'hermit' },
      level: null, effects: [], actions: [], choices: [], passive: true,
    },
  ],
};

export const bgNoble: Background = {
  id: 'noble',
  name: 'Noble',
  srd: false,
  toolProficiencies: ['One gaming set'],
  features: [
    {
      id: 'noble_proficiencies',
      name: 'Skill Proficiencies',
      description: 'You are proficient in History and Persuasion.',
      source: { kind: 'background', refId: 'noble' },
      level: null, actions: [], choices: [], passive: true,
      effects: [
        { type: 'grant_proficiency', target: 'skill:history',    operation: 'add', value: null, condition: null },
        { type: 'grant_proficiency', target: 'skill:persuasion', operation: 'add', value: null, condition: null },
      ],
    },
    {
      id: 'position_of_privilege',
      name: 'Position of Privilege',
      description: 'Thanks to your noble birth, people are inclined to think the best of you.',
      source: { kind: 'background', refId: 'noble' },
      level: null, effects: [], actions: [], choices: [], passive: true,
    },
  ],
};

export const bgOutlander: Background = {
  id: 'outlander',
  name: 'Outlander',
  srd: false,
  toolProficiencies: ['One musical instrument'],
  features: [
    {
      id: 'outlander_proficiencies',
      name: 'Skill Proficiencies',
      description: 'You are proficient in Athletics and Survival.',
      source: { kind: 'background', refId: 'outlander' },
      level: null, actions: [], choices: [], passive: true,
      effects: [
        { type: 'grant_proficiency', target: 'skill:athletics', operation: 'add', value: null, condition: null },
        { type: 'grant_proficiency', target: 'skill:survival',  operation: 'add', value: null, condition: null },
      ],
    },
    {
      id: 'wanderer',
      name: 'Wanderer',
      description: 'You have an excellent memory for maps and geography, and you can always recall the general layout of terrain, settlements, and other features around you.',
      source: { kind: 'background', refId: 'outlander' },
      level: null, effects: [], actions: [], choices: [], passive: true,
    },
  ],
};

export const bgSage: Background = {
  id: 'sage',
  name: 'Sage',
  srd: false,
  toolProficiencies: [],
  features: [
    {
      id: 'sage_proficiencies',
      name: 'Skill Proficiencies',
      description: 'You are proficient in Arcana and History.',
      source: { kind: 'background', refId: 'sage' },
      level: null, actions: [], choices: [], passive: true,
      effects: [
        { type: 'grant_proficiency', target: 'skill:arcana',  operation: 'add', value: null, condition: null },
        { type: 'grant_proficiency', target: 'skill:history', operation: 'add', value: null, condition: null },
      ],
    },
    {
      id: 'researcher',
      name: 'Researcher',
      description: 'When you attempt to learn or recall a piece of lore, if you do not know that information, you often know where and from whom you can obtain it.',
      source: { kind: 'background', refId: 'sage' },
      level: null, effects: [], actions: [], choices: [], passive: true,
    },
  ],
};

export const bgSailor: Background = {
  id: 'sailor',
  name: 'Sailor',
  srd: false,
  toolProficiencies: ["Navigator's tools", 'Vehicles (water)'],
  features: [
    {
      id: 'sailor_proficiencies',
      name: 'Skill Proficiencies',
      description: 'You are proficient in Athletics and Perception.',
      source: { kind: 'background', refId: 'sailor' },
      level: null, actions: [], choices: [], passive: true,
      effects: [
        { type: 'grant_proficiency', target: 'skill:athletics',  operation: 'add', value: null, condition: null },
        { type: 'grant_proficiency', target: 'skill:perception', operation: 'add', value: null, condition: null },
      ],
    },
    {
      id: 'ship_passage',
      name: "Ship's Passage",
      description: 'When you need to, you can secure free passage on a sailing ship for yourself and your adventuring companions.',
      source: { kind: 'background', refId: 'sailor' },
      level: null, effects: [], actions: [], choices: [], passive: true,
    },
  ],
};

export const bgSoldier: Background = {
  id: 'soldier',
  name: 'Soldier',
  srd: false,
  toolProficiencies: ['Gaming Set', 'Vehicles (Land)'],
  features: [
    {
      id: 'soldier_proficiencies',
      name: 'Skill Proficiencies',
      description: 'You are proficient in Athletics and Intimidation.',
      source: { kind: 'background', refId: 'soldier' },
      level: null, actions: [], choices: [], passive: true,
      effects: [
        { type: 'grant_proficiency', target: 'skill:athletics',   operation: 'add', value: null, condition: null },
        { type: 'grant_proficiency', target: 'skill:intimidation', operation: 'add', value: null, condition: null },
      ],
    },
    {
      id: 'military_rank',
      name: 'Military Rank',
      description: 'You have a military rank from your career as a soldier. Soldiers loyal to your former military organization still recognize your authority.',
      source: { kind: 'background', refId: 'soldier' },
      level: null, effects: [], actions: [], choices: [], passive: true,
    },
  ],
};

export const bgUrchin: Background = {
  id: 'urchin',
  name: 'Urchin',
  srd: false,
  toolProficiencies: ['Disguise kit', "Thieves' tools"],
  features: [
    {
      id: 'urchin_proficiencies',
      name: 'Skill Proficiencies',
      description: 'You are proficient in Sleight of Hand and Stealth.',
      source: { kind: 'background', refId: 'urchin' },
      level: null, actions: [], choices: [], passive: true,
      effects: [
        { type: 'grant_proficiency', target: 'skill:sleight_of_hand', operation: 'add', value: null, condition: null },
        { type: 'grant_proficiency', target: 'skill:stealth',         operation: 'add', value: null, condition: null },
      ],
    },
    {
      id: 'city_secrets',
      name: 'City Secrets',
      description: 'You know the secret patterns and flow to cities and can find passages through the urban sprawl that others would miss.',
      source: { kind: 'background', refId: 'urchin' },
      level: null, effects: [], actions: [], choices: [], passive: true,
    },
  ],
};

/** Every background, unfiltered. Prefer ALL_BACKGROUNDS below in app code. */
export const FULL_BACKGROUND_LIBRARY: Background[] = [
  bgAcolyte,
  bgAcolyte2024,
  bgCharlatan,
  bgCriminal,
  bgEntertainer,
  bgFolkHero,
  bgGuildArtisan,
  bgHermit,
  bgNoble,
  bgOutlander,
  bgSage,
  bgSailor,
  bgSoldier,
  bgUrchin,
];

const SRD_ONLY = process.env.EXPO_PUBLIC_SRD_ONLY === 'true';

/**
 * The background list the app should use — filtered to srd === true only
 * on the EAS `production` build profile (see eas.json). Same build-target-
 * aware pattern as spells/subclasses/races. See docs/ROADMAP_1.0.md Phase 1.
 */
export const ALL_BACKGROUNDS: Background[] = SRD_ONLY
  ? FULL_BACKGROUND_LIBRARY.filter(b => b.srd === true)
  : FULL_BACKGROUND_LIBRARY;
