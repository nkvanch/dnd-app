// ============================================================================
// FILE: src/content/subclasses/paladin.ts
// Paladin subclasses: Oath of Devotion, Oath of the Ancients
// ============================================================================
import { ClassProgression } from '../../engine/types';

export type SubclassProgression = ClassProgression & { name: string };

export const devotionProgression: SubclassProgression = {
  classId: 'paladin', name: 'Oath of Devotion',
  entries: [
    { level: 3, hpDie: 10, choices: [], grants: [{ kind: 'feature', value: { id: 'sacred_weapon', name: 'Channel Divinity: Sacred Weapon', description: 'As an action, imbue one weapon with positive energy. For 1 minute, add your CHA modifier to attack rolls. The weapon emits bright light in a 20-foot radius.', source: { kind: 'subclass', refId: 'devotion' }, level: 3, effects: [], actions: [], choices: [], passive: false } }, { kind: 'feature', value: { id: 'turn_the_unholy', name: 'Channel Divinity: Turn the Unholy', description: 'As an action, present your holy symbol. Fiends and undead within 30 feet must make a WIS save or be turned for 1 minute.', source: { kind: 'subclass', refId: 'devotion' }, level: 3, effects: [], actions: [], choices: [], passive: false } }] },
    { level: 7, hpDie: 10, choices: [], grants: [{ kind: 'feature', value: { id: 'aura_of_devotion', name: 'Aura of Devotion', description: 'You and friendly creatures within 10 feet (30 feet at L18) can\'t be charmed while you are conscious.', source: { kind: 'subclass', refId: 'devotion' }, level: 7, effects: [], actions: [], choices: [], passive: true } }] },
    { level: 15, hpDie: 10, choices: [], grants: [{ kind: 'feature', value: { id: 'purity_of_spirit', name: 'Purity of Spirit', description: 'You are always under the effects of a Protection from Evil and Good spell.', source: { kind: 'subclass', refId: 'devotion' }, level: 15, effects: [], actions: [], choices: [], passive: true } }] },
    { level: 20, hpDie: 10, choices: [], grants: [{ kind: 'feature', value: { id: 'holy_nimbus', name: 'Holy Nimbus', description: 'As an action, emanate an aura of sunlight for 1 minute. Bright light in a 30-foot radius. Enemies in the light take 10 radiant per turn. CHA bonus to saves against fiend/undead spells. Once per long rest.', source: { kind: 'subclass', refId: 'devotion' }, level: 20, effects: [], actions: [], choices: [], passive: false } }] },
  ],
};

export const ancientsProgression: SubclassProgression = {
  classId: 'paladin', name: 'Oath of the Ancients',
  entries: [
    { level: 3, hpDie: 10, choices: [], grants: [{ kind: 'feature', value: { id: 'natures_wrath', name: "Channel Divinity: Nature's Wrath", description: 'Use your action to conjure vines. A creature within 10 feet must succeed on a STR or DEX save or be restrained until the vines are destroyed (AC 10, 10 HP).', source: { kind: 'subclass', refId: 'ancients' }, level: 3, effects: [], actions: [], choices: [], passive: false } }, { kind: 'feature', value: { id: 'turn_the_faithless', name: 'Channel Divinity: Turn the Faithless', description: 'Fey and fiends within 30 feet must succeed on a WIS save or be turned for 1 minute.', source: { kind: 'subclass', refId: 'ancients' }, level: 3, effects: [], actions: [], choices: [], passive: false } }] },
    { level: 7, hpDie: 10, choices: [], grants: [{ kind: 'feature', value: { id: 'aura_of_warding', name: 'Aura of Warding', description: 'Resistance to spell damage for you and friendly creatures within 10 feet while conscious.', source: { kind: 'subclass', refId: 'ancients' }, level: 7, effects: [], actions: [], choices: [], passive: true } }] },
    { level: 15, hpDie: 10, choices: [], grants: [{ kind: 'feature', value: { id: 'undying_sentinel', name: 'Undying Sentinel', description: 'When you are reduced to 0 HP and are not killed outright, drop to 1 HP instead (once per long rest). Additionally, you suffer no ill effects from old age.', source: { kind: 'subclass', refId: 'ancients' }, level: 15, effects: [], actions: [], choices: [], passive: false } }] },
    { level: 20, hpDie: 10, choices: [], grants: [{ kind: 'feature', value: { id: 'elder_champion', name: 'Elder Champion', description: 'Transform into an avatar of nature for 1 minute. Regain 10 HP each turn. Spells cast against you by fiends/fey require double the spell slots. Bonus action to cause a creature within 10 feet to make a CON save or be magically aged.', source: { kind: 'subclass', refId: 'ancients' }, level: 20, effects: [], actions: [], choices: [], passive: false } }] },
  ],
};

export const PALADIN_SUBCLASSES: SubclassProgression[] = [devotionProgression, ancientsProgression];
