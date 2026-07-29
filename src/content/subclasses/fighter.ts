// ============================================================================
// FILE: src/content/subclasses/fighter.ts
// Fighter subclasses: Battle Master, Champion
// ============================================================================
import { ClassProgression } from '../../engine/types';

export type SubclassProgression = ClassProgression & { name: string };

// ── Champion ──────────────────────────────────────────────────────────────────

export const championProgression: SubclassProgression = {
  classId: 'fighter',
  name: 'Champion',
  srd: true,
  entries: [
    {
      level: 3, hpDie: 10, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'improved_critical', name: 'Improved Critical', description: 'Your weapon attacks score a critical hit on a roll of 19 or 20.', source: { kind: 'subclass', refId: 'champion' }, level: 3, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    {
      level: 7, hpDie: 10, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'remarkable_athlete', name: 'Remarkable Athlete', description: 'Add half your proficiency bonus (rounded up) to any STR, DEX, or CON check that doesn\'t already use your proficiency bonus. Your running long jump distance increases by your STR modifier.', source: { kind: 'subclass', refId: 'champion' }, level: 7, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    {
      level: 10, hpDie: 10, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'additional_fighting_style', name: 'Additional Fighting Style', description: 'You can choose a second option from the Fighting Style class feature.', source: { kind: 'subclass', refId: 'champion' }, level: 10, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    {
      level: 15, hpDie: 10, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'superior_critical', name: 'Superior Critical', description: 'Your weapon attacks score a critical hit on a roll of 18–20.', source: { kind: 'subclass', refId: 'champion' }, level: 15, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    {
      level: 18, hpDie: 10, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'survivor', name: 'Survivor', description: 'At the start of each of your turns, you regain HP equal to 5 + your CON modifier if you have no more than half your HP remaining and you aren\'t at 0 HP.', source: { kind: 'subclass', refId: 'champion' }, level: 18, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
  ],
};

// ── Battle Master ─────────────────────────────────────────────────────────────

export const battleMasterProgression: SubclassProgression = {
  classId: 'fighter',
  name: 'Battle Master',
  srd: false,
  entries: [
    {
      level: 3, hpDie: 10, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'combat_superiority', name: 'Combat Superiority', description: 'You learn maneuvers that are fueled by special dice called superiority dice (d8, 4 dice). You regain all expended superiority dice after a short or long rest.', source: { kind: 'subclass', refId: 'battle_master' }, level: 3, effects: [], actions: [], choices: [], passive: true } },
        { kind: 'resource', value: { resourceId: 'superiority_dice', name: 'Superiority Dice', maximum: 4, recharge: 'short_rest' } },
        { kind: 'feature', value: { id: 'student_of_war', name: 'Student of War', description: 'You gain proficiency with one type of artisan\'s tools of your choice.', source: { kind: 'subclass', refId: 'battle_master' }, level: 3, effects: [], actions: [], choices: [], passive: true } },
        { kind: 'feature', value: { id: 'know_your_enemy', name: 'Know Your Enemy', description: 'If you spend at least 1 minute observing or interacting with another creature, the DM tells you if that creature is superior to you, inferior to you, or roughly equal in STR, DEX, CON, AC, current HP, total class levels, or fighter class levels.', source: { kind: 'subclass', refId: 'battle_master' }, level: 3, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    {
      level: 7, hpDie: 10, choices: [],
      grants: [
        { kind: 'resource_upgrade', value: { resourceId: 'superiority_dice', newMaximum: 5 } },
      ],
    },
    {
      level: 10, hpDie: 10, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'improved_combat_superiority_d10', name: 'Improved Combat Superiority', description: 'Your superiority dice become d10s.', source: { kind: 'subclass', refId: 'battle_master' }, level: 10, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    {
      level: 15, hpDie: 10, choices: [],
      grants: [
        { kind: 'resource_upgrade', value: { resourceId: 'superiority_dice', newMaximum: 6 } },
      ],
    },
    {
      level: 18, hpDie: 10, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'improved_combat_superiority_d12', name: 'Improved Combat Superiority', description: 'Your superiority dice become d12s.', source: { kind: 'subclass', refId: 'battle_master' }, level: 18, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
  ],
};

export const FIGHTER_SUBCLASSES: SubclassProgression[] = [
  championProgression,
  battleMasterProgression,
];
