// ============================================================================
// FILE: src/content/subclasses/rogue.ts
// Rogue subclasses: Thief, Assassin
// ============================================================================
import { ClassProgression } from '../../engine/types';

export type SubclassProgression = ClassProgression & { name: string };

// ── Thief ─────────────────────────────────────────────────────────────────────

export const thiefProgression: SubclassProgression = {
  classId: 'rogue',
  name: 'Thief',
  srd: true,
  entries: [
    {
      level: 3, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'fast_hands', name: 'Fast Hands', description: 'Use the bonus action granted by Cunning Action to make a Sleight of Hand check, use thieves\' tools, or take the Use an Object action.', source: { kind: 'subclass', refId: 'thief' }, level: 3, effects: [], actions: [], choices: [], passive: true } },
        { kind: 'feature', value: { id: 'second_story_work', name: 'Second-Story Work', description: 'Climbing costs no extra movement. When you make a running jump, add your DEX modifier to the distance covered.', source: { kind: 'subclass', refId: 'thief' }, level: 3, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    {
      level: 9, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'supreme_sneak', name: 'Supreme Sneak', description: 'Advantage on Stealth checks if you move no more than half your speed on the same turn.', source: { kind: 'subclass', refId: 'thief' }, level: 9, actions: [], choices: [], passive: true, effects: [{ type: 'stat_modifier', target: 'Stealth checks when you move no more than half your speed', operation: 'advantage', value: null, condition: null }] } },
      ],
    },
    {
      level: 13, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'use_magic_device', name: 'Use Magic Device', description: 'You can ignore all class, race, and level requirements on the use of magic items.', source: { kind: 'subclass', refId: 'thief' }, level: 13, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    {
      level: 17, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'thiefs_reflexes', name: 'Thief\'s Reflexes', description: 'Take two turns during the first round of combat. Take the first turn at normal initiative and the second at initiative minus 10.', source: { kind: 'subclass', refId: 'thief' }, level: 17, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
  ],
};

// ── Assassin ──────────────────────────────────────────────────────────────────

export const assassinProgression: SubclassProgression = {
  classId: 'rogue',
  name: 'Assassin',
  srd: false,
  entries: [
    {
      level: 3, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'assassinate', name: 'Assassinate', description: 'Advantage on attack rolls against creatures that haven\'t taken a turn yet. Any hit you score against a surprised creature is a critical hit (not automated — no crit mechanism in the engine, apply manually).', source: { kind: 'subclass', refId: 'assassin' }, level: 3, actions: [], choices: [], passive: true, effects: [{ type: 'stat_modifier', target: "attack rolls against creatures that haven't yet taken a turn in combat", operation: 'advantage', value: null, condition: null }] } },
        { kind: 'feature', value: { id: 'assassin_proficiencies', name: 'Bonus Proficiencies', description: 'Proficiency with disguise kit and poisoner\'s kit.', source: { kind: 'subclass', refId: 'assassin' }, level: 3, actions: [], choices: [], passive: true, effects: [
          { type: 'grant_proficiency', target: 'tool:disguise_kit', operation: 'add', value: null, condition: null },
          { type: 'grant_proficiency', target: 'tool:poisoners_kit', operation: 'add', value: null, condition: null },
        ] } },
      ],
    },
    {
      level: 9, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'infiltration_expertise', name: 'Infiltration Expertise', description: 'Spend 7 days and 25 gp to create a false identity with documentation, established acquaintances, and disguises.', source: { kind: 'subclass', refId: 'assassin' }, level: 9, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    {
      level: 13, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'impostor', name: 'Impostor', description: 'Unerringly mimic another person\'s speech, writing, and behavior after 3 hours of study.', source: { kind: 'subclass', refId: 'assassin' }, level: 13, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    {
      level: 17, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'death_strike', name: 'Death Strike', description: 'When you hit a surprised creature, it must succeed on a CON save (DC 8 + DEX mod + prof) or take double damage.', source: { kind: 'subclass', refId: 'assassin' }, level: 17, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
  ],
};

export const ROGUE_SUBCLASSES: SubclassProgression[] = [
  thiefProgression,
  assassinProgression,
];
