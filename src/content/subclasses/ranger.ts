// ============================================================================
// FILE: src/content/subclasses/ranger.ts
// Ranger subclasses: Hunter, Beast Master
// ============================================================================
import { ClassProgression } from '../../engine/types';

export type SubclassProgression = ClassProgression & { name: string };

export const hunterProgression: SubclassProgression = {
  classId: 'ranger', name: 'Hunter',
  entries: [
    { level: 3, hpDie: 10, choices: [], grants: [{ kind: 'feature', value: { id: 'hunters_prey', name: "Hunter's Prey", description: 'Choose one: Colossus Slayer (extra 1d8 when target is below max HP), Giant Killer (reaction attack when Large+ misses you), or Horde Breaker (attack a second adjacent creature).', source: { kind: 'subclass', refId: 'hunter' }, level: 3, effects: [], actions: [], choices: [], passive: true } }] },
    { level: 7, hpDie: 10, choices: [], grants: [{ kind: 'feature', value: { id: 'defensive_tactics', name: 'Defensive Tactics', description: 'Choose one: Escape the Horde (no opportunity attacks when Disengaging), Multiattack Defense (+4 AC after first hit), or Steel Will (advantage on frightened saves).', source: { kind: 'subclass', refId: 'hunter' }, level: 7, effects: [], actions: [], choices: [], passive: true } }] },
    { level: 11, hpDie: 10, choices: [], grants: [{ kind: 'feature', value: { id: 'multiattack_hunter', name: 'Multiattack', description: 'Choose one: Volley (ranged attack every creature in a 10-foot radius you can see) or Whirlwind Attack (melee attack every creature within 5 feet).', source: { kind: 'subclass', refId: 'hunter' }, level: 11, effects: [], actions: [], choices: [], passive: false } }] },
    { level: 15, hpDie: 10, choices: [], grants: [{ kind: 'feature', value: { id: 'superior_hunters_defense', name: "Superior Hunter's Defense", description: 'Choose one: Evasion (Dex save: no damage on success, half on fail), Stand Against the Tide (redirect missed attack to another creature), or Uncanny Dodge (halve damage from one attack as a reaction).', source: { kind: 'subclass', refId: 'hunter' }, level: 15, effects: [], actions: [], choices: [], passive: true } }] },
  ],
};

export const beastMasterProgression: SubclassProgression = {
  classId: 'ranger', name: 'Beast Master',
  entries: [
    { level: 3, hpDie: 10, choices: [], grants: [{ kind: 'feature', value: { id: 'rangers_companion', name: "Ranger's Companion", description: 'Choose a beast of CR 1/4 or lower. It obeys your commands and uses your proficiency bonus for attack/damage. It acts on your initiative.', source: { kind: 'subclass', refId: 'beast_master' }, level: 3, effects: [], actions: [], choices: [], passive: true } }] },
    { level: 7, hpDie: 10, choices: [], grants: [{ kind: 'feature', value: { id: 'exceptional_training', name: 'Exceptional Training', description: 'Your companion can use Dash, Disengage, Dodge, or Help on its turn as a bonus action. Its attacks count as magical.', source: { kind: 'subclass', refId: 'beast_master' }, level: 7, effects: [], actions: [], choices: [], passive: true } }] },
    { level: 11, hpDie: 10, choices: [], grants: [{ kind: 'feature', value: { id: 'bestial_fury', name: 'Bestial Fury', description: 'Your companion can make two attacks when you command it to attack.', source: { kind: 'subclass', refId: 'beast_master' }, level: 11, effects: [], actions: [], choices: [], passive: true } }] },
    { level: 15, hpDie: 10, choices: [], grants: [{ kind: 'feature', value: { id: 'share_spells', name: 'Share Spells', description: 'When you cast a spell targeting yourself, you can also affect your companion if within 30 feet.', source: { kind: 'subclass', refId: 'beast_master' }, level: 15, effects: [], actions: [], choices: [], passive: true } }] },
  ],
};

export const RANGER_SUBCLASSES: SubclassProgression[] = [hunterProgression, beastMasterProgression];
