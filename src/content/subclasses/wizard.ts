// ============================================================================
// FILE: src/content/subclasses/wizard.ts
// Wizard subclasses: Evocation, Abjuration
// ============================================================================
import { ClassProgression } from '../../engine/types';

export type SubclassProgression = ClassProgression & { name: string };

// ── School of Evocation ───────────────────────────────────────────────────────

export const evocationProgression: SubclassProgression = {
  classId: 'wizard',
  name: 'School of Evocation',
  entries: [
    {
      level: 2, hpDie: 6, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'evocation_savant', name: 'Evocation Savant', description: 'The gold and time you must spend to copy an evocation spell into your spellbook is halved.', source: { kind: 'subclass', refId: 'evocation' }, level: 2, effects: [], actions: [], choices: [], passive: true } },
        { kind: 'feature', value: { id: 'sculpt_spells', name: 'Sculpt Spells', description: 'When you cast an evocation spell that affects other creatures you can see, you can choose a number of them equal to 1 + the spell\'s level. Those creatures automatically succeed on their saving throws, and take no damage if they succeed.', source: { kind: 'subclass', refId: 'evocation' }, level: 2, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    {
      level: 6, hpDie: 6, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'potent_cantrip', name: 'Potent Cantrip', description: 'Your damaging cantrips affect even creatures that avoid the brunt of the effect. On a successful save, a creature takes half the cantrip\'s damage.', source: { kind: 'subclass', refId: 'evocation' }, level: 6, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    {
      level: 10, hpDie: 6, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'empowered_evocation', name: 'Empowered Evocation', description: 'Add your INT modifier to one damage roll of any wizard evocation spell you cast.', source: { kind: 'subclass', refId: 'evocation' }, level: 10, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    {
      level: 14, hpDie: 6, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'overchannel', name: 'Overchannel', description: 'When you cast a wizard spell of 1st through 5th level that deals damage, maximize the damage. You can do so without ill effect once. A 2nd use before a long rest causes 2d12 necrotic per spell level, increasing by 1d12 for each subsequent use.', source: { kind: 'subclass', refId: 'evocation' }, level: 14, effects: [], actions: [], choices: [], passive: false } },
      ],
    },
  ],
};

// ── School of Abjuration ──────────────────────────────────────────────────────

export const abjurationProgression: SubclassProgression = {
  classId: 'wizard',
  name: 'School of Abjuration',
  entries: [
    {
      level: 2, hpDie: 6, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'abjuration_savant', name: 'Abjuration Savant', description: 'The gold and time you must spend to copy an abjuration spell into your spellbook is halved.', source: { kind: 'subclass', refId: 'abjuration' }, level: 2, effects: [], actions: [], choices: [], passive: true } },
        { kind: 'feature', value: { id: 'arcane_ward', name: 'Arcane Ward', description: 'When you cast an abjuration spell of 1st level or higher, you can simultaneously use a strand of the spell\'s magic to create a magical ward on yourself. The ward has HP equal to twice your wizard level + INT modifier. Regain HP when you cast an abjuration spell.', source: { kind: 'subclass', refId: 'abjuration' }, level: 2, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    {
      level: 6, hpDie: 6, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'projected_ward', name: 'Projected Ward', description: 'When a creature you can see within 30 feet takes damage, use your reaction to cause your Arcane Ward to absorb that damage.', source: { kind: 'subclass', refId: 'abjuration' }, level: 6, effects: [], actions: [], choices: [], passive: false } },
      ],
    },
    {
      level: 10, hpDie: 6, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'improved_abjuration', name: 'Improved Abjuration', description: 'When you cast an abjuration spell that requires you to make an ability check as a part of casting the spell, add your proficiency bonus to that ability check.', source: { kind: 'subclass', refId: 'abjuration' }, level: 10, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    {
      level: 14, hpDie: 6, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'spell_resistance', name: 'Spell Resistance', description: 'Advantage on saving throws against spells. Resistance to spell damage.', source: { kind: 'subclass', refId: 'abjuration' }, level: 14, effects: [{ type: 'grant_resistance', target: 'spell', operation: 'resistance', value: null, condition: null }], actions: [], choices: [], passive: true } },
      ],
    },
  ],
};

export const WIZARD_SUBCLASSES: SubclassProgression[] = [
  evocationProgression,
  abjurationProgression,
];
