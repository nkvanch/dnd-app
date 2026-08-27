// ============================================================================
// FILE: src/content/subclasses/warlock.ts
// Warlock subclasses: The Fiend, The Great Old One
// ============================================================================
import { ClassProgression } from '../../engine/types';

export type SubclassProgression = ClassProgression & { name: string };

export const fiendProgression: SubclassProgression = {
  classId: 'warlock', name: 'The Fiend', srd: true,
  entries: [
    { level: 1, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'dark_ones_blessing', name: "Dark One's Blessing", description: 'When you reduce a hostile creature to 0 HP, gain temporary HP equal to your CHA modifier + warlock level (min 1).', source: { kind: 'subclass', refId: 'fiend' }, level: 1, effects: [], actions: [], choices: [], passive: true } }] },
    { level: 6, hpDie: 8, choices: [], grants: [
      { kind: 'feature', value: { id: 'dark_ones_own_luck', name: "Dark One's Own Luck", description: 'Spend 1 use to add 1d10 to an ability check or saving throw.', source: { kind: 'subclass', refId: 'fiend' }, level: 6, effects: [], actions: [], choices: [], passive: false,
        activation: { actionType: 'free', resourceCost: { resourceId: 'dark_ones_own_luck_pool', quantity: 1 }, range: 'self', target: 'self', requiresSave: null },
        abilityEffects: [],
      } },
      { kind: 'resource', value: { resourceId: 'dark_ones_own_luck_pool', name: "Dark One's Own Luck", maximum: 1, recharge: 'short_rest' } },
    ] },
    { level: 10, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'fiendish_resilience', name: 'Fiendish Resilience', description: 'After a short or long rest, choose one damage type. Gain resistance to that type until you choose another. Which type is chosen isn\'t fixed ahead of time, so no resistance Effect is pre-applied here — track the current choice manually.', source: { kind: 'subclass', refId: 'fiend' }, level: 10, effects: [], actions: [], choices: [], passive: true } }] },
    { level: 14, hpDie: 8, choices: [], grants: [
      { kind: 'feature', value: { id: 'hurl_through_hell', name: 'Hurl Through Hell', description: 'When you hit a creature with an attack, banish it through lower planes until end of your next turn; it takes 10d10 psychic damage on return (no save). Modeled here as an immediate damage rider rather than an end-of-next-turn delayed effect — the engine has no delayed-trigger system — a disclosed simplification.', source: { kind: 'subclass', refId: 'fiend' }, level: 14, effects: [], actions: [], choices: [], passive: false,
        activation: { actionType: 'free', resourceCost: { resourceId: 'hurl_through_hell_pool', quantity: 1 }, range: '5 feet', target: 'single', requiresSave: null },
        abilityEffects: [{ type: 'damage', dice: '10d10', damageType: 'psychic' }],
      } },
      { kind: 'resource', value: { resourceId: 'hurl_through_hell_pool', name: 'Hurl Through Hell', maximum: 1, recharge: 'long_rest' } },
    ] },
  ],
};

export const greatOldOneProgression: SubclassProgression = {
  classId: 'warlock', name: 'The Great Old One',
  // CONFIRMED correct via direct verification against the actual SRD 5.1
  // text (5thsrd.org) on 2026-08-04: the Warlock page fully details only
  // "The Fiend" — Great Old One appears solely as flavor text within the
  // Fiend's own Pact Boon description ("If your patron is the Great Old
  // One, your weapon might be..."), not as its own detailed subclass
  // section. Confirmed non-SRD.
  srd: false,
  entries: [
    { level: 1, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'awakened_mind', name: 'Awakened Mind', description: 'Telepathically communicate with any creature within 30 feet that you can see. No shared language needed. Creature can\'t respond unless it has telepathy.', source: { kind: 'subclass', refId: 'great_old_one' }, level: 1, effects: [], actions: [], choices: [], passive: true } }] },
    { level: 6, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'entropic_ward', name: 'Entropic Ward', description: 'React to impose disadvantage on an attack roll against you. If it misses, gain advantage on your next attack against that creature this turn. Once per short or long rest.', source: { kind: 'subclass', refId: 'great_old_one' }, level: 6, effects: [], actions: [], choices: [], passive: false } }] },
    { level: 10, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'thought_shield', name: 'Thought Shield', description: 'Your thoughts can\'t be read by telepathy or other means. Resistance to psychic damage. When a creature deals psychic damage to you, it takes the same amount.', source: { kind: 'subclass', refId: 'great_old_one' }, level: 10, effects: [{ type: 'grant_resistance', target: 'psychic', operation: 'resistance', value: null, condition: null }], actions: [], choices: [], passive: true } }] },
    { level: 14, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'create_thrall', name: 'Create Thrall', description: 'Touch an incapacitated humanoid to charm it until a remove curse spell is cast on it. The charmed target obeys your commands and you can communicate telepathically at any distance.', source: { kind: 'subclass', refId: 'great_old_one' }, level: 14, effects: [], actions: [], choices: [], passive: false } }] },
  ],
};

export const WARLOCK_SUBCLASSES: SubclassProgression[] = [fiendProgression, greatOldOneProgression];
