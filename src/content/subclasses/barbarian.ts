// ============================================================================
// FILE: src/content/subclasses/barbarian.ts
// Barbarian subclasses: Berserker, Totem Warrior
// ============================================================================
import { ClassProgression } from '../../engine/types';

export type SubclassProgression = ClassProgression & { name: string };

// ── Berserker ─────────────────────────────────────────────────────────────────

export const berserkerProgression: SubclassProgression = {
  classId: 'barbarian',
  name: 'Path of the Berserker',
  srd: true,
  entries: [
    {
      level: 3, hpDie: 12, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'frenzy', name: 'Frenzy', description: 'When you rage, you can go into a frenzy. For the duration, take one additional melee weapon attack as a bonus action each turn. When the rage ends, suffer one level of exhaustion.', source: { kind: 'subclass', refId: 'berserker' }, level: 3, effects: [], actions: [], choices: [], passive: false } },
      ],
    },
    {
      level: 6, hpDie: 12, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'mindless_rage', name: 'Mindless Rage', description: 'You can\'t be charmed or frightened while raging. If you are charmed or frightened when you enter your rage, the effect is suspended for the duration of the rage.', source: { kind: 'subclass', refId: 'berserker' }, level: 6, effects: [{ type: 'condition_immunity', target: 'charmed', operation: 'immunity', value: null, condition: 'rage_active' }, { type: 'condition_immunity', target: 'frightened', operation: 'immunity', value: null, condition: 'rage_active' }], actions: [], choices: [], passive: true } },
      ],
    },
    {
      level: 10, hpDie: 12, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'intimidating_presence', name: 'Intimidating Presence', description: 'Use an action to frighten a creature within 30 feet (WIS save, DC 8 + STR mod + prof). If the creature fails, it is frightened until the end of your next turn.', source: { kind: 'subclass', refId: 'berserker' }, level: 10, effects: [], actions: [], choices: [], passive: false } },
      ],
    },
    {
      level: 14, hpDie: 12, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'retaliation', name: 'Retaliation', description: 'When you take damage from a creature within 5 feet, use your reaction to make one melee weapon attack against it.', source: { kind: 'subclass', refId: 'berserker' }, level: 14, effects: [], actions: [], choices: [], passive: false } },
      ],
    },
  ],
};

// ── Totem Warrior ─────────────────────────────────────────────────────────────

export const totemWarriorProgression: SubclassProgression = {
  classId: 'barbarian',
  name: 'Path of the Totem Warrior',
  // CONFIRMED correct via direct verification against the actual SRD 5.1
  // text (5thsrd.org) on 2026-08-04: the Barbarian page's table of contents
  // and full content show only "Path of the Berserker" actually detailed —
  // Totem Warrior is named in the class's intro sentence ("choose X or Y,
  // both detailed at the end") but that phrasing is boilerplate copied
  // verbatim from the full PHB and does NOT reliably indicate what the SRD
  // excerpt actually includes. Confirmed non-SRD.
  srd: false,
  entries: [
    {
      level: 3, hpDie: 12, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'spirit_seeker', name: 'Spirit Seeker', description: 'Gain the ability to cast Beast Sense and Speak with Animals as rituals.', source: { kind: 'subclass', refId: 'totem_warrior' }, level: 3, effects: [], actions: [], choices: [], passive: true } },
        { kind: 'feature', value: { id: 'totem_spirit', name: 'Totem Spirit', description: 'Choose a totem spirit (Bear, Eagle, or Wolf). Bear: resistance to all damage except psychic while raging. Eagle: not subject to opportunity attacks while raging (dash as bonus action). Wolf: allies have advantage on melee attacks against enemies adjacent to you while raging.', source: { kind: 'subclass', refId: 'totem_warrior' }, level: 3, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    {
      level: 6, hpDie: 12, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'aspect_of_the_beast', name: 'Aspect of the Beast', description: 'Choose an aspect of your totem animal. Bear: double your carrying capacity and advantage on STR checks for pushing/pulling/lifting/breaking. Eagle: see up to 1 mile with no difficulty, dim light counts as bright light. Wolf: track creatures at a fast pace, stealth at normal pace.', source: { kind: 'subclass', refId: 'totem_warrior' }, level: 6, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    {
      level: 10, hpDie: 12, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'spirit_walker', name: 'Spirit Walker', description: 'Cast Commune with Nature as a ritual, calling on your totem spirit for guidance.', source: { kind: 'subclass', refId: 'totem_warrior' }, level: 10, effects: [], actions: [], choices: [], passive: false } },
      ],
    },
    {
      level: 14, hpDie: 12, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'totemic_attunement', name: 'Totemic Attunement', description: 'Choose a totem animal. Bear: enemies within 5 feet have disadvantage on attacks against your allies while you rage. Eagle: bonus action to fly up to your speed if airborne. Wolf: knock a Large or smaller creature prone when you hit it with a melee attack while raging.', source: { kind: 'subclass', refId: 'totem_warrior' }, level: 14, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
  ],
};

export const BARBARIAN_SUBCLASSES: SubclassProgression[] = [
  berserkerProgression,
  totemWarriorProgression,
];
