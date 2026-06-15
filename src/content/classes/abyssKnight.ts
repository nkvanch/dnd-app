// ============================================================================
// FILE: src/content/classes/abyssKnight.ts
// Abyss Knight — homebrew class (dandwiki), authored as official-pattern
// content so it's playable immediately through the normal creation wizard.
//
// The "Oozing Knight" Demonic Patron is baked directly into this class's
// progression (source.kind: 'subclass', refId: 'oozing_knight') rather than
// offered through a subclass_unlock choice — there is currently no in-app
// picker for homebrew subclasses (see ROADMAP #4b), so a generic
// subclass_unlock would leave an unresolvable "ask your DM" stub. If a
// second Abyss Knight Demonic Patron is ever authored, this should be split
// out into a real subclass-choice flow.
// ============================================================================
import { ClassProgression, ChoiceDefinition } from '../../engine/types';

function asiChoice(id: string): ChoiceDefinition {
  return {
    id,
    prompt: 'Choose an Ability Score Increase (+2 to one or +1 to two) or a Feat.',
    kind: 'asi', count: 1, pool: 'all', grants: [], required: true, resolved: false,
  };
}

const abyssKnightSkillChoice: ChoiceDefinition = {
  id: 'abyss_knight_skills_lvl_1',
  prompt: 'Choose 4 skills from: Athletics, Insight, Perception, Deception, Intimidation.',
  kind: 'skill', count: 4,
  pool: [
    { id: 'athletics',    label: 'Athletics',    value: 'athletics' },
    { id: 'insight',      label: 'Insight',      value: 'insight' },
    { id: 'perception',   label: 'Perception',   value: 'perception' },
    { id: 'deception',    label: 'Deception',    value: 'deception' },
    { id: 'intimidation', label: 'Intimidation', value: 'intimidation' },
  ],
  grants: [], required: true, resolved: false,
};

export const abyssKnightProgression: ClassProgression = {
  classId: 'abyss_knight',
  entries: [
    {
      level: 1, hpDie: 10,
      choices: [abyssKnightSkillChoice],
      grants: [
        { kind: 'proficiency', value: { armor: ['light', 'medium', 'heavy', 'shield'], weapons: ['simple', 'martial'] } },
        {
          kind: 'feature', value: {
            id: 'abyssal_energy', name: 'Abyssal Energy',
            description: 'You learn to invoke demonic power from the depths of the Abyss to infuse your attacks, using your hit dice. When you take a short rest, you must choose between recovering spent hit dice or using hit dice to recover hit points, but not both. You regain a number of hit dice on a short rest equal to your Constitution modifier. As part of an attack, you can expend one hit die and add the result to the damage roll of a melee weapon attack. Choose fire, poison, or necrotic for the extra damage\u2019s type \u2014 this damage counts as magical for the purpose of overcoming resistance to nonmagical attacks and damage.',
            source: { kind: 'class', refId: 'abyss_knight' }, level: 1, effects: [], actions: [], choices: [], passive: false,
          },
        },
        {
          kind: 'feature', value: {
            id: 'oozing_knight_form', name: 'Oozing Knight',
            description: 'You can move through a space as narrow as 1 inch wide without squeezing, dissolving and absorbing organic matter as you pass through it \u2014 you no longer need to eat. In addition, when you use your Abyssal Energy feature, you may choose acid as the extra damage type, alongside fire, poison, or necrotic.',
            source: { kind: 'subclass', refId: 'oozing_knight' }, level: 1, effects: [], actions: [], choices: [], passive: true,
          },
        },
        {
          kind: 'feature', value: {
            id: 'indiscernible_anatomy', name: 'Indiscernible Anatomy',
            description: 'Your innards are an amorphous, shifting mass with no vital organs for an enemy to target. You take no extra damage from critical hits.',
            source: { kind: 'subclass', refId: 'oozing_knight' }, level: 1, effects: [], actions: [], choices: [], passive: true,
          },
        },
      ],
    },
    {
      level: 2, hpDie: 10,
      choices: [],
      grants: [
        { kind: 'init_spellcasting', value: { ability: 'cha' } },
        { kind: 'spell_slots', value: { level: 2 } },
        { kind: 'known_spells', value: { spellIds: ['arms_of_hadar', 'hellish_rebuke'] } },
        {
          kind: 'feature', value: {
            id: 'demons_sight', name: "Demon's Sight",
            description: 'You can see through normal and magical darkness up to a range of 60 feet.',
            source: { kind: 'class', refId: 'abyss_knight' }, level: 2, effects: [], actions: [], choices: [], passive: true,
          },
        },
        {
          kind: 'feature', value: {
            id: 'frightening_gaze', name: 'Frightening Gaze',
            description: 'Your gaze can oppress or charm a creature. As part of a Charisma (Intimidation) or (Deception) check, you can spend one hit die and add the number rolled to the check.',
            source: { kind: 'class', refId: 'abyss_knight' }, level: 2, effects: [], actions: [], choices: [], passive: false,
          },
        },
        {
          kind: 'feature', value: {
            id: 'dark_magic', name: 'Dark Magic',
            description: 'Your patron grants you the ability to channel dark magic from the Abyss. You know two 1st-level spells from the warlock spell list (Arms of Hadar and Hellish Rebuke). All of your spell slots are the same level, shown on your character sheet, and you regain all expended spell slots when you finish a short or long rest. Charisma is your spellcasting ability for these spells \u2014 it sets your spell save DC and spell attack bonus, and you use it when a spell calls for your spellcasting ability.',
            source: { kind: 'class', refId: 'abyss_knight' }, level: 2, effects: [], actions: [], choices: [], passive: true,
          },
        },
      ],
    },
    { level: 3, hpDie: 10, choices: [], grants: [] },
    { level: 4, hpDie: 10, choices: [asiChoice('abyss_knight_asi_4')], grants: [] },
    { level: 5, hpDie: 10, choices: [], grants: [] },
    {
      level: 6, hpDie: 10, choices: [],
      grants: [
        {
          kind: 'feature', value: {
            id: 'pseudopods', name: 'Pseudopods',
            description: 'You can make melee attacks with a reach of up to 10 feet. In addition, whenever a creature hits you with a melee attack, it must make a Dexterity saving throw against your spell save DC or be grappled, taking acid damage equal to your Charisma modifier.',
            source: { kind: 'subclass', refId: 'oozing_knight' }, level: 6, effects: [], actions: [], choices: [], passive: true,
          },
        },
      ],
    },
    { level: 7, hpDie: 10, choices: [], grants: [] },
    { level: 8, hpDie: 10, choices: [asiChoice('abyss_knight_asi_8')], grants: [] },
    { level: 9, hpDie: 10, choices: [], grants: [] },
    {
      level: 10, hpDie: 10, choices: [],
      grants: [
        {
          kind: 'feature', value: {
            id: 'amorphous', name: 'Amorphous',
            description: 'You are resistant to acid damage, and you have advantage on saving throws to avoid being paralyzed or stunned. In addition, whenever you take bludgeoning, piercing, or slashing damage, you can spend one hit die to reduce that damage by the number rolled plus your Charisma modifier.',
            source: { kind: 'subclass', refId: 'oozing_knight' }, level: 10, effects: [
              { type: 'grant_resistance', target: 'acid', operation: 'resistance', value: null, condition: null },
            ], actions: [], choices: [], passive: true,
          },
        },
      ],
    },
    { level: 11, hpDie: 10, choices: [], grants: [] },
    { level: 12, hpDie: 10, choices: [asiChoice('abyss_knight_asi_12')], grants: [] },
    { level: 13, hpDie: 10, choices: [], grants: [] },
    {
      level: 14, hpDie: 10, choices: [],
      grants: [
        {
          kind: 'feature', value: {
            id: 'consume', name: 'Consume',
            description: 'As an action, you can try to grapple a creature, engulfing it within your amorphous body; you don\u2019t need free hands to do so. When you grapple a creature this way, you can spend one hit die to absorb part of it, dealing damage equal to the number rolled plus your Charisma modifier and regaining the same number of hit points. If this kills the creature, you can assume its form for 1 hour (as alter self) without concentration \u2014 the natural-weapons option if it was a beast, otherwise the change-appearance option.',
            source: { kind: 'subclass', refId: 'oozing_knight' }, level: 14, effects: [], actions: [], choices: [], passive: false,
          },
        },
      ],
    },
    { level: 15, hpDie: 10, choices: [], grants: [] },
    { level: 16, hpDie: 10, choices: [asiChoice('abyss_knight_asi_16')], grants: [] },
    { level: 17, hpDie: 10, choices: [], grants: [] },
    { level: 18, hpDie: 10, choices: [], grants: [] },
    { level: 19, hpDie: 10, choices: [asiChoice('abyss_knight_asi_19')], grants: [] },
    { level: 20, hpDie: 10, choices: [], grants: [] },
  ],
};
