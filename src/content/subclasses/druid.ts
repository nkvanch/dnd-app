// ============================================================================
// FILE: src/content/subclasses/druid.ts
// Druid subclasses: Circle of the Land, Circle of the Moon
// ============================================================================
import { ClassProgression } from '../../engine/types';

export type SubclassProgression = ClassProgression & { name: string };

export const circleOfTheLandProgression: SubclassProgression = {
  classId: 'druid', name: 'Circle of the Land', srd: true,
  entries: [
    { level: 2, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'bonus_cantrip', name: 'Bonus Cantrip', description: 'Learn one additional druid cantrip of your choice.', source: { kind: 'subclass', refId: 'circle_land' }, level: 2, effects: [], actions: [], choices: [], passive: true } }, { kind: 'feature', value: { id: 'natural_recovery', name: 'Natural Recovery', description: 'Once between long rests, regain expended spell slots during a short rest. Total levels ≤ half druid level (rounded up). No slots above 5th.', source: { kind: 'subclass', refId: 'circle_land' }, level: 2, effects: [], actions: [], choices: [], passive: false } }] },
    { level: 6, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'lands_stride', name: "Land's Stride", description: 'Moving through nonmagical difficult terrain costs no extra movement. Pass through nonmagical plants without being slowed or damaged. Advantage on saves against plants created by magic.', source: { kind: 'subclass', refId: 'circle_land' }, level: 6, effects: [], actions: [], choices: [], passive: true } }] },
    { level: 10, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'natures_ward', name: "Nature's Ward", description: 'Immune to poison and disease. Immune to charm and fear from elementals and fey.', source: { kind: 'subclass', refId: 'circle_land' }, level: 10, effects: [{ type: 'condition_immunity', target: 'poison', operation: 'immunity', value: null, condition: null }, { type: 'condition_immunity', target: 'disease', operation: 'immunity', value: null, condition: null }], actions: [], choices: [], passive: true } }] },
    { level: 14, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'natures_sanctuary', name: "Nature's Sanctuary", description: 'Beasts and plants must make a WIS save when attacking you or be compelled to choose a different target.', source: { kind: 'subclass', refId: 'circle_land' }, level: 14, effects: [], actions: [], choices: [], passive: true } }] },
  ],
};

export const circleOfTheMoonProgression: SubclassProgression = {
  classId: 'druid', name: 'Circle of the Moon', srd: false,
  entries: [
    { level: 2, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'combat_wild_shape', name: 'Combat Wild Shape', description: 'Wild Shape as a bonus action. While in beast form, use a bonus action to expend a spell slot (1 die per slot level) to regain HP.', source: { kind: 'subclass', refId: 'circle_moon' }, level: 2, effects: [], actions: [], choices: [], passive: true } }, { kind: 'feature', value: { id: 'circle_forms', name: 'Circle Forms', description: 'CR limit for Wild Shape increases to 1. At level 6, CR limit = druid level / 3 (rounded down).', source: { kind: 'subclass', refId: 'circle_moon' }, level: 2, effects: [], actions: [], choices: [], passive: true } }] },
    { level: 6, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'primal_strike', name: 'Primal Strike', description: 'Your beast attacks in Wild Shape count as magical for overcoming resistance.', source: { kind: 'subclass', refId: 'circle_moon' }, level: 6, effects: [], actions: [], choices: [], passive: true } }] },
    { level: 10, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'elemental_wild_shape', name: 'Elemental Wild Shape', description: 'Expend two uses of Wild Shape to transform into an air, earth, fire, or water elemental.', source: { kind: 'subclass', refId: 'circle_moon' }, level: 10, effects: [], actions: [], choices: [], passive: false } }] },
    { level: 14, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'thousand_forms', name: 'Thousand Forms', description: 'Cast Alter Self at will without expending a spell slot.', source: { kind: 'subclass', refId: 'circle_moon' }, level: 14, effects: [], actions: [], choices: [], passive: false } }] },
  ],
};

export const DRUID_SUBCLASSES: SubclassProgression[] = [circleOfTheLandProgression, circleOfTheMoonProgression];
