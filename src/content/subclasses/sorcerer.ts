// ============================================================================
// FILE: src/content/subclasses/sorcerer.ts
// Sorcerer subclasses: Draconic Bloodline, Wild Magic
// ============================================================================
import { ClassProgression } from '../../engine/types';

export type SubclassProgression = ClassProgression & { name: string };

export const draconicBloodlineProgression: SubclassProgression = {
  classId: 'sorcerer', name: 'Draconic Bloodline',
  entries: [
    { level: 1, hpDie: 6, choices: [], grants: [{ kind: 'feature', value: { id: 'dragon_ancestor', name: 'Dragon Ancestor', description: 'Choose a type of dragon. Speak, read, and write Draconic. Advantage on Charisma checks with dragons.', source: { kind: 'subclass', refId: 'draconic_bloodline' }, level: 1, effects: [], actions: [], choices: [], passive: true } }, { kind: 'feature', value: { id: 'draconic_resilience', name: 'Draconic Resilience', description: 'HP maximum increases by 1 per sorcerer level. When not wearing armor, AC = 13 + DEX modifier.', source: { kind: 'subclass', refId: 'draconic_bloodline' }, level: 1, effects: [{ type: 'base_ac_formula', target: 'ac', operation: 'set', value: 13, condition: null }], actions: [], choices: [], passive: true } }] },
    { level: 6, hpDie: 6, choices: [], grants: [{ kind: 'feature', value: { id: 'elemental_affinity', name: 'Elemental Affinity', description: 'When you cast a spell of the damage type associated with your draconic ancestry, add your CHA modifier to one damage roll. Spend 1 sorcery point to gain resistance to that damage type for 1 hour.', source: { kind: 'subclass', refId: 'draconic_bloodline' }, level: 6, effects: [], actions: [], choices: [], passive: true } }] },
    { level: 14, hpDie: 6, choices: [], grants: [{ kind: 'feature', value: { id: 'dragon_wings', name: 'Dragon Wings', description: 'Sprout wings as a bonus action. Gain a flying speed equal to your current speed. Disappear as a bonus action.', source: { kind: 'subclass', refId: 'draconic_bloodline' }, level: 14, effects: [], actions: [], choices: [], passive: false } }] },
    { level: 18, hpDie: 6, choices: [], grants: [{ kind: 'feature', value: { id: 'draconic_presence', name: 'Draconic Presence', description: 'Spend 5 sorcery points as an action to exude awe or fear in a 60-foot radius for 1 minute (WIS save). Frightened or charmed until the aura ends or a save is made.', source: { kind: 'subclass', refId: 'draconic_bloodline' }, level: 18, effects: [], actions: [], choices: [], passive: false } }] },
  ],
};

export const wildMagicProgression: SubclassProgression = {
  classId: 'sorcerer', name: 'Wild Magic',
  entries: [
    { level: 1, hpDie: 6, choices: [], grants: [{ kind: 'feature', value: { id: 'wild_magic_surge', name: 'Wild Magic Surge', description: 'When you cast a sorcerer spell of 1st level or higher, the DM can have you roll a d20. On a 1, roll on the Wild Magic Surge table.', source: { kind: 'subclass', refId: 'wild_magic' }, level: 1, effects: [], actions: [], choices: [], passive: true } }, { kind: 'feature', value: { id: 'tides_of_chaos', name: 'Tides of Chaos', description: 'Gain advantage on one attack roll, ability check, or saving throw. Once used, the DM can cause a Wild Magic Surge before restoring this feature.', source: { kind: 'subclass', refId: 'wild_magic' }, level: 1, effects: [], actions: [], choices: [], passive: false } }] },
    { level: 6, hpDie: 6, choices: [], grants: [{ kind: 'feature', value: { id: 'bend_luck', name: 'Bend Luck', description: 'Spend 2 sorcery points as a reaction to add or subtract 1d4 from an attack roll, ability check, or saving throw of a creature you can see.', source: { kind: 'subclass', refId: 'wild_magic' }, level: 6, effects: [], actions: [], choices: [], passive: false } }] },
    { level: 14, hpDie: 6, choices: [], grants: [{ kind: 'feature', value: { id: 'controlled_chaos', name: 'Controlled Chaos', description: 'When you roll on the Wild Magic Surge table, roll twice and choose which effect to use.', source: { kind: 'subclass', refId: 'wild_magic' }, level: 14, effects: [], actions: [], choices: [], passive: true } }] },
    { level: 18, hpDie: 6, choices: [], grants: [{ kind: 'feature', value: { id: 'spell_bombardment', name: 'Spell Bombardment', description: 'When you roll damage for a spell and roll the highest possible result on any die, roll that die again and add it to the damage. Do this once per turn.', source: { kind: 'subclass', refId: 'wild_magic' }, level: 18, effects: [], actions: [], choices: [], passive: true } }] },
  ],
};

export const SORCERER_SUBCLASSES: SubclassProgression[] = [draconicBloodlineProgression, wildMagicProgression];
