// ============================================================================
// FILE: src/content/classes/emperorWarlock/index.ts
// The Emperor Warlock in both versions the design defines, registered as built-in homebrew (see
// builtinHomebrew.ts):
//   emperor_warlock_demo  "Emperor Warlock (Demo)": the Bound Spirit is picked once at level 1.
//   emperor_warlock       "Emperor Warlock": Legacy Binding is real. A new Bound Spirit replaces the
//                          old one every in-game month through a Mode Group (engine/modes.ts).
// Both share the same twelve spirits (built per class), 17 Imperial Edicts, spells and summon stat blocks.
// ============================================================================
import { CharClass, HomebrewSubclass, Condition } from '../../../engine/types';
import type { MonsterTemplate } from '../../monsters/types';
import { buildEmperorProgression, legacyBindingGroup } from './progression';
import { buildSpirits, EMPEROR_CONDITIONS } from './spirits';
import { EMPEROR_SUMMONS } from './summons';

export const EMPEROR_WARLOCK_ID = 'emperor_warlock';
export const EMPEROR_WARLOCK_DEMO_ID = 'emperor_warlock_demo';

const DESCRIPTION =
  'A battlefield commander whose power comes from the memories, ambitions, tactics and legends of great historical or mythological ' +
  'figures. Charisma-based, with Command Dice that bolster allies, Eldritch Blast and warlock-style Pact Magic, Imperial Edicts as the ' +
  'permanent build, and a Bound Spirit that grants legendary features and spells.';

const base = {
  hitDie: 8, features: [] as CharClass['features'], description: DESCRIPTION,
  savingThrows: ['wis', 'cha'] as CharClass['savingThrows'],
  spellcastingAbility: 'cha' as const, spellcastingStyle: 'pact' as const,
};

export const emperorWarlockDemoClass: CharClass = {
  ...base,
  id: EMPEROR_WARLOCK_DEMO_ID,
  name: 'Emperor Warlock (Demo)',
  description: DESCRIPTION + ' Demo version: the Bound Spirit is chosen once, at level 1, instead of changing every month.',
  rawProgression: buildEmperorProgression(EMPEROR_WARLOCK_DEMO_ID, 'demo'),
};

export const emperorWarlockClass: CharClass = {
  ...base,
  id: EMPEROR_WARLOCK_ID,
  name: 'Emperor Warlock',
  description: DESCRIPTION + ' Legacy Binding: roll a d12 each in-game month and a new Bound Spirit replaces the old one.',
  rawProgression: buildEmperorProgression(EMPEROR_WARLOCK_ID, 'true'),
  modeGroups: [legacyBindingGroup(EMPEROR_WARLOCK_ID)],
};

export const emperorWarlockSpirits: HomebrewSubclass[] = [
  ...buildSpirits(EMPEROR_WARLOCK_ID),
  ...buildSpirits(EMPEROR_WARLOCK_DEMO_ID),
];

export const emperorWarlockConditions: Condition[] = EMPEROR_CONDITIONS;
export const emperorWarlockSummons: MonsterTemplate[] = EMPEROR_SUMMONS;
