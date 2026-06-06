// ============================================================================
// FILE: src/content/subclasses/bard.ts
// Bard subclasses: College of Lore, College of Valor
// ============================================================================
import { ClassProgression } from '../../engine/types';

export type SubclassProgression = ClassProgression & { name: string };

export const loreCollegeProgression: SubclassProgression = {
  classId: 'bard', name: 'College of Lore',
  entries: [
    { level: 3, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'cutting_words', name: 'Cutting Words', description: 'Use your reaction and a Bardic Inspiration die to subtract from an attack roll, ability check, or damage roll of a creature within 60 feet that you can hear.', source: { kind: 'subclass', refId: 'lore' }, level: 3, effects: [], actions: [], choices: [], passive: false } }, { kind: 'feature', value: { id: 'bonus_proficiencies_lore', name: 'Bonus Proficiencies', description: 'Gain proficiency in three skills of your choice.', source: { kind: 'subclass', refId: 'lore' }, level: 3, effects: [], actions: [], choices: [], passive: true } }] },
    { level: 6, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'additional_magical_secrets', name: 'Additional Magical Secrets', description: 'Learn two spells of your choice from any class. They count as bard spells but don\'t count against known spells.', source: { kind: 'subclass', refId: 'lore' }, level: 6, effects: [], actions: [], choices: [], passive: true } }] },
    { level: 14, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'peerless_skill', name: 'Peerless Skill', description: 'When you make an ability check, spend one use of Bardic Inspiration to roll the die and add the result.', source: { kind: 'subclass', refId: 'lore' }, level: 14, effects: [], actions: [], choices: [], passive: false } }] },
  ],
};

export const valorCollegeProgression: SubclassProgression = {
  classId: 'bard', name: 'College of Valor',
  entries: [
    { level: 3, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'combat_inspiration', name: 'Combat Inspiration', description: 'Bardic Inspiration can also be used: when the recipient makes a weapon damage roll (add the die to damage), or as a reaction when targeted by an attack (add the die to AC for that attack).', source: { kind: 'subclass', refId: 'valor' }, level: 3, effects: [], actions: [], choices: [], passive: true } }, { kind: 'feature', value: { id: 'bonus_proficiencies_valor', name: 'Bonus Proficiencies', description: 'Gain proficiency with medium armor, shields, and martial weapons.', source: { kind: 'subclass', refId: 'valor' }, level: 3, effects: [], actions: [], choices: [], passive: true } }] },
    { level: 6, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'extra_attack_bard', name: 'Extra Attack', description: 'You can attack twice when you take the Attack action on your turn.', source: { kind: 'subclass', refId: 'valor' }, level: 6, effects: [{ type: 'stat_modifier', target: 'extra_attack', operation: 'set', value: 1, condition: null }], actions: [], choices: [], passive: true } }] },
    { level: 14, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'battle_magic', name: 'Battle Magic', description: 'When you use your action to cast a bard spell, make one weapon attack as a bonus action.', source: { kind: 'subclass', refId: 'valor' }, level: 14, effects: [], actions: [], choices: [], passive: true } }] },
  ],
};

export const BARD_SUBCLASSES: SubclassProgression[] = [loreCollegeProgression, valorCollegeProgression];
