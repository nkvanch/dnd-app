// ============================================================================
// FILE: src/content/backgrounds/index.ts
// All 13 PHB backgrounds.
// ============================================================================
import { Background } from '../../engine/types';

export const bgAcolyte: Background = {
  id: 'acolyte',
  name: 'Acolyte',
  srd: true,
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

export const bgCharlatan: Background = {
  id: 'charlatan',
  name: 'Charlatan',
  srd: true,
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
  srd: true,
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
  srd: true,
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
  srd: true,
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
  srd: true,
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
  srd: true,
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
  srd: true,
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
  srd: true,
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
  srd: true,
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
  srd: true,
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
  srd: true,
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
  srd: true,
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

export const ALL_BACKGROUNDS: Background[] = [
  bgAcolyte,
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
