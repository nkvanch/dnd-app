// ============================================================================
// FILE: src/content/subclasses/cleric.ts
// Cleric subclasses: Life Domain, Light Domain
// ============================================================================
import { ClassProgression, Grant } from '../../engine/types';

export type SubclassProgression = ClassProgression & { name: string };

// Domain spells are always prepared, granted automatically — same
// known_spells Grant Artificer's subclasses already use (3 of 5), not a new
// mechanism. Confirmed the base class's own init_spellcasting grant always
// fires before any subclass grant, so spellcasting is guaranteed
// initialized here.
function domainSpells(spellIds: string[]): Grant {
  return { kind: 'known_spells', value: { spellIds } };
}

// ── Life Domain ───────────────────────────────────────────────────────────────

export const lifeDomainProgression: SubclassProgression = {
  classId: 'cleric',
  name: 'Life Domain',
  srd: true,
  entries: [
    {
      level: 1, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'life_domain_proficiency', name: 'Bonus Proficiency', description: 'Proficiency with heavy armor.', source: { kind: 'subclass', refId: 'life_domain' }, level: 1, effects: [], actions: [], choices: [], passive: true } },
        { kind: 'feature', value: { id: 'disciple_of_life', name: 'Disciple of Life', description: 'Healing spells are more effective: whenever you use a spell of 1st level or higher to restore HP to a creature, regain additional HP equal to 2 + the spell\'s level.', source: { kind: 'subclass', refId: 'life_domain' }, level: 1, effects: [], actions: [], choices: [], passive: true } },
        domainSpells(['bless', 'cure_wounds']),
      ],
    },
    {
      level: 2, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'preserve_life', name: 'Channel Divinity: Preserve Life', description: 'Restore HP to any number of creatures within 30 feet, distributing up to 5× your cleric level in HP. Can\'t bring a creature above half its HP maximum.', source: { kind: 'subclass', refId: 'life_domain' }, level: 2, actions: [], choices: [], passive: false, effects: [],
          activation: { actionType: 'action', resourceCost: { resourceId: 'channel_divinity_pool', quantity: 1 }, range: '30 feet', target: 'area', requiresSave: null },
          abilityEffects: [],
        } },
      ],
    },
    {
      level: 3, hpDie: 8, choices: [], grants: [domainSpells(['lesser_restoration', 'spiritual_weapon'])],
    },
    {
      level: 5, hpDie: 8, choices: [], grants: [domainSpells(['beacon_of_hope', 'revivify'])],
    },
    {
      level: 6, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'blessed_healer', name: 'Blessed Healer', description: 'When you cast a healing spell of 1st level or higher on another creature, you regain HP equal to 2 + the spell\'s level.', source: { kind: 'subclass', refId: 'life_domain' }, level: 6, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    {
      level: 7, hpDie: 8, choices: [], grants: [domainSpells(['death_ward', 'guardian_of_faith'])],
    },
    {
      level: 8, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'divine_strike_life', name: 'Divine Strike', description: 'Once per turn, deal an extra 1d8 radiant damage to one creature with a weapon attack (2d8 at level 14 — same card, description only for the upgrade).', source: { kind: 'subclass', refId: 'life_domain' }, level: 8, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'free', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
          abilityEffects: [{ type: 'damage', dice: '1d8', damageType: 'radiant' }],
        } },
      ],
    },
    {
      level: 9, hpDie: 8, choices: [], grants: [domainSpells(['mass_cure_wounds', 'raise_dead'])],
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
  srd: false,
  entries: [
    {
      level: 1, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'warding_flare', name: 'Warding Flare', description: 'When a creature attacks you, use your reaction to impose disadvantage on the attack roll (WIS modifier times per long rest — no ability-mod-scaled resource pool exists in the engine; also no cross-entity roll-modification hook, so the disadvantage itself isn\'t applied — resolve manually).', source: { kind: 'subclass', refId: 'light_domain' }, level: 1, effects: [], actions: [], choices: [], passive: false } },
        domainSpells(['burning_hands', 'faerie_fire']),
      ],
    },
    {
      level: 2, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'radiance_of_dawn', name: 'Channel Divinity: Radiance of the Dawn', description: 'Magical darkness within 30 feet is dispelled. Hostile creatures within 30 feet take 2d10 + cleric level radiant damage (CHA save for half).', source: { kind: 'subclass', refId: 'light_domain' }, level: 2, effects: [], actions: [], choices: [], passive: false,
          activation: { actionType: 'action', resourceCost: { resourceId: 'channel_divinity_pool', quantity: 1 }, range: '30 feet', target: 'area', requiresSave: { ability: 'cha', dc: 'spell_save_dc' } },
          abilityEffects: [{ type: 'damage', dice: '2d10', damageType: 'radiant', saveOnSuccess: 'half' }],
        } },
      ],
    },
    {
      level: 3, hpDie: 8, choices: [], grants: [domainSpells(['flaming_sphere', 'scorching_ray'])],
    },
    {
      level: 5, hpDie: 8, choices: [], grants: [domainSpells(['daylight', 'fireball'])],
    },
    {
      level: 6, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'improved_flare', name: 'Improved Flare', description: 'You can also use Warding Flare when a creature attacks a creature other than you within 30 feet.', source: { kind: 'subclass', refId: 'light_domain' }, level: 6, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    {
      level: 7, hpDie: 8, choices: [], grants: [domainSpells(['guardian_of_faith', 'wall_of_fire'])],
    },
    {
      level: 8, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'potent_spellcasting_cleric', name: 'Potent Spellcasting', description: 'Add your WIS modifier to the damage you deal with cleric cantrips.', source: { kind: 'subclass', refId: 'light_domain' }, level: 8, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    {
      level: 9, hpDie: 8, choices: [], grants: [domainSpells(['flame_strike', 'scrying'])],
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
