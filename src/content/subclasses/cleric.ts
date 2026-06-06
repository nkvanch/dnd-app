// ============================================================================
// FILE: src/content/subclasses/cleric.ts
// Cleric subclasses: Life Domain, Light Domain
// ============================================================================
import { ClassProgression } from '../../engine/types';

export type SubclassProgression = ClassProgression & { name: string };

// ── Life Domain ───────────────────────────────────────────────────────────────

export const lifeDomainProgression: SubclassProgression = {
  classId: 'cleric',
  name: 'Life Domain',
  entries: [
    {
      level: 1, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'life_domain_proficiency', name: 'Bonus Proficiency', description: 'Proficiency with heavy armor.', source: { kind: 'subclass', refId: 'life_domain' }, level: 1, effects: [], actions: [], choices: [], passive: true } },
        { kind: 'feature', value: { id: 'disciple_of_life', name: 'Disciple of Life', description: 'Healing spells are more effective: whenever you use a spell of 1st level or higher to restore HP to a creature, regain additional HP equal to 2 + the spell\'s level.', source: { kind: 'subclass', refId: 'life_domain' }, level: 1, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    {
      level: 2, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'preserve_life', name: 'Channel Divinity: Preserve Life', description: 'Restore HP to any number of creatures within 30 feet, distributing up to 5× your cleric level in HP. Can\'t bring a creature above half its HP maximum.', source: { kind: 'subclass', refId: 'life_domain' }, level: 2, effects: [], actions: [], choices: [], passive: false } },
      ],
    },
    {
      level: 6, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'blessed_healer', name: 'Blessed Healer', description: 'When you cast a healing spell of 1st level or higher on another creature, you regain HP equal to 2 + the spell\'s level.', source: { kind: 'subclass', refId: 'life_domain' }, level: 6, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    {
      level: 8, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'divine_strike_life', name: 'Divine Strike', description: 'Once per turn, deal an extra 1d8 radiant damage to one creature with a weapon attack (2d8 at level 14).', source: { kind: 'subclass', refId: 'life_domain' }, level: 8, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    {
      level: 17, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'supreme_healing', name: 'Supreme Healing', description: 'Instead of rolling dice for healing spells, use the maximum result for each die.', source: { kind: 'subclass', refId: 'life_domain' }, level: 17, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
  ],
};

// ── Light Domain ──────────────────────────────────────────────────────────────

export const lightDomainProgression: SubclassProgression = {
  classId: 'cleric',
  name: 'Light Domain',
  entries: [
    {
      level: 1, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'warding_flare', name: 'Warding Flare', description: 'When a creature attacks you, use your reaction to impose disadvantage on the attack roll (WIS modifier times per long rest).', source: { kind: 'subclass', refId: 'light_domain' }, level: 1, effects: [], actions: [], choices: [], passive: false } },
      ],
    },
    {
      level: 2, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'radiance_of_dawn', name: 'Channel Divinity: Radiance of the Dawn', description: 'Magical darkness within 30 feet is dispelled. Hostile creatures within 30 feet take 2d10 + cleric level radiant damage (CHA save for half).', source: { kind: 'subclass', refId: 'light_domain' }, level: 2, effects: [], actions: [], choices: [], passive: false } },
      ],
    },
    {
      level: 6, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'improved_flare', name: 'Improved Flare', description: 'You can also use Warding Flare when a creature attacks a creature other than you within 30 feet.', source: { kind: 'subclass', refId: 'light_domain' }, level: 6, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    {
      level: 8, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'potent_spellcasting_cleric', name: 'Potent Spellcasting', description: 'Add your WIS modifier to the damage you deal with cleric cantrips.', source: { kind: 'subclass', refId: 'light_domain' }, level: 8, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    {
      level: 17, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'corona_of_light', name: 'Corona of Light', description: 'Activate as an action: shed bright light in a 60-foot radius and dim light for an additional 30 feet. Enemies in bright light have disadvantage on saves against fire or radiant spells. Lasts 1 minute (concentration).', source: { kind: 'subclass', refId: 'light_domain' }, level: 17, effects: [], actions: [], choices: [], passive: false } },
      ],
    },
  ],
};

export const CLERIC_SUBCLASSES: SubclassProgression[] = [
  lifeDomainProgression,
  lightDomainProgression,
];
