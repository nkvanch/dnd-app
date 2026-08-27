// ============================================================================
// FILE: src/content/subclasses/monk.ts
// Monk subclasses: Way of the Open Hand, Way of Shadow
// ============================================================================
import { ClassProgression } from '../../engine/types';

export type SubclassProgression = ClassProgression & { name: string };

export const openHandProgression: SubclassProgression = {
  classId: 'monk', name: 'Way of the Open Hand', srd: true,
  entries: [
    { level: 3, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'open_hand_technique', name: 'Open Hand Technique', description: 'When you hit a creature with a Flurry of Blows, impose one effect: prone on DEX save, pushed up to 15 feet on STR save, or unable to take reactions until end of your next turn. Which effect and its save are chosen per-use — no rider is auto-applied, resolve manually.', source: { kind: 'subclass', refId: 'open_hand' }, level: 3, effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'free', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
      abilityEffects: [],
    } }] },
    { level: 6, hpDie: 8, choices: [], grants: [
      { kind: 'feature', value: { id: 'wholeness_of_body', name: 'Wholeness of Body', description: 'Regain HP equal to three times your monk level as an action. No level-scaling dice-string generator exists in the engine, so the amount is stated here rather than rolled — track it at the table.', source: { kind: 'subclass', refId: 'open_hand' }, level: 6, effects: [], actions: [], choices: [], passive: false,
        activation: { actionType: 'action', resourceCost: { resourceId: 'open_hand_recovery_pool', quantity: 1 }, range: 'self', target: 'self', requiresSave: null },
        abilityEffects: [],
      } },
      { kind: 'resource', value: { resourceId: 'open_hand_recovery_pool', name: 'Wholeness of Body', maximum: 1, recharge: 'long_rest' } },
    ] },
    { level: 11, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'tranquility', name: 'Tranquility', description: 'Gain the effect of a Sanctuary spell at the end of each long rest (until you attack or cast a spell). Persistent buff-until-attacked with no tracking system in the engine — resolve manually.', source: { kind: 'subclass', refId: 'open_hand' }, level: 11, effects: [], actions: [], choices: [], passive: true } }] },
    { level: 17, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'quivering_palm', name: 'Quivering Palm', description: 'When you hit with an unarmed strike, spend 3 ki to set up lethal vibrations. Within 30 days, use your action to reduce the creature to 0 HP or deal 10d10 necrotic (CON save for half). The delayed activate-later step has no trigger system — this card only tracks the ki cost of setting it up.', source: { kind: 'subclass', refId: 'open_hand' }, level: 17, effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'action', resourceCost: { resourceId: 'ki_pool', quantity: 3 }, range: '5 feet', target: 'single', requiresSave: null },
      abilityEffects: [],
    } }] },
  ],
};

export const shadowProgression: SubclassProgression = {
  classId: 'monk', name: 'Way of Shadow', srd: false,
  entries: [
    { level: 3, hpDie: 8, choices: [], grants: [
      { kind: 'feature', value: { id: 'shadow_arts_darkness', name: 'Shadow Arts: Darkness', description: 'Spend 2 ki to cast Darkness without providing material components.', source: { kind: 'subclass', refId: 'shadow' }, level: 3, effects: [], actions: [], choices: [], passive: false,
        activation: { actionType: 'action', resourceCost: { resourceId: 'ki_pool', quantity: 2 }, range: 'self', target: 'self', requiresSave: null },
        abilityEffects: [{ type: 'cast_spell', spellId: 'darkness' }],
      } },
      { kind: 'feature', value: { id: 'shadow_arts_pass_without_trace', name: 'Shadow Arts: Pass Without Trace', description: 'Spend 2 ki to cast Pass without Trace without providing material components.', source: { kind: 'subclass', refId: 'shadow' }, level: 3, effects: [], actions: [], choices: [], passive: false,
        activation: { actionType: 'action', resourceCost: { resourceId: 'ki_pool', quantity: 2 }, range: 'self', target: 'self', requiresSave: null },
        abilityEffects: [{ type: 'cast_spell', spellId: 'pass_without_trace' }],
      } },
      { kind: 'feature', value: { id: 'shadow_arts_silence', name: 'Shadow Arts: Silence', description: 'Spend 2 ki to cast Silence without providing material components.', source: { kind: 'subclass', refId: 'shadow' }, level: 3, effects: [], actions: [], choices: [], passive: false,
        activation: { actionType: 'action', resourceCost: { resourceId: 'ki_pool', quantity: 2 }, range: 'self', target: 'self', requiresSave: null },
        abilityEffects: [{ type: 'cast_spell', spellId: 'silence' }],
      } },
      { kind: 'feature', value: { id: 'shadow_arts_darkvision', name: 'Shadow Arts: Darkvision', description: 'Spend 2 ki to cast Darkvision on yourself without providing material components. Darkvision isn\'t in the spell content pack — stays description-only, track the ki spend manually.', source: { kind: 'subclass', refId: 'shadow' }, level: 3, effects: [], actions: [], choices: [], passive: false } },
    ] },
    { level: 6, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'shadow_step', name: 'Shadow Step', description: 'While in dim light or darkness, teleport to an unoccupied space within 60 feet that is also dim light or darkness as a bonus action. Advantage on first melee attack after teleport — the advantage isn\'t auto-applied, note it for your next attack roll.', source: { kind: 'subclass', refId: 'shadow' }, level: 6, effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'bonus_action', resourceCost: null, range: '60 feet', target: 'self', requiresSave: null },
      abilityEffects: [],
    } }] },
    { level: 11, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'cloak_of_shadows', name: 'Cloak of Shadows', description: 'When in dim light or darkness, spend an action to become invisible until you attack, cast a spell, or enter bright light.', source: { kind: 'subclass', refId: 'shadow' }, level: 11, effects: [], actions: [], choices: [], passive: false,
      activation: { actionType: 'action', resourceCost: null, range: 'self', target: 'self', requiresSave: null },
      abilityEffects: [{ type: 'apply_condition', conditionId: 'invisible', duration: { unit: 'until_rest', remaining: 1 } }],
    } }] },
    { level: 17, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'opportunist', name: 'Opportunist', description: 'When a creature within 5 feet is hit by an attack made by someone other than you, use your reaction to make a melee attack against that creature.', source: { kind: 'subclass', refId: 'shadow' }, level: 17, effects: [], actions: [], choices: [], passive: false } }] },
  ],
};

export const MONK_SUBCLASSES: SubclassProgression[] = [openHandProgression, shadowProgression];
