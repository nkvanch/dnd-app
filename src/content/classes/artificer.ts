// ============================================================================
// FILE: src/content/classes/artificer.ts
// Artificer (Tasha's Cauldron of Everything). INT-based half-caster that
// starts casting at level 1 (see ARTIFICER_SLOTS in spellSlotTables.ts) and
// unlocks Infuse Item at level 2 — see src/content/infusions/index.ts for the
// infusion catalog and src/engine/leveling.ts's applyInfusionChoiceToEntity
// for how the 'infusion' choice kind resolves.
//
// Many high-level Artificer features (Right Tool for the Job, Tool
// Expertise, Flash of Genius, Magic Item Adept/Savant/Master, Soul of
// Artifice) have no real engine hook to attach to — no crafting/downtime
// system, no generic "double proficiency bonus on a check type" mechanism,
// no reaction-trigger automation, no attunement-count enforcement, no
// generic per-attuned-item saving-throw bonus. Same honest-disclosure
// pattern used throughout this app: they ship as flavor-only features with
// a description explaining what they do at the table, rather than a fake
// mechanic. See src/content/infusions/index.ts's header comment for the
// same reasoning applied to individual infusions.
// ============================================================================
import { ClassProgression, ChoiceDefinition } from '../../engine/types';

function asiChoice(id: string): ChoiceDefinition {
  return {
    id,
    prompt: 'Choose an Ability Score Increase (+2 to one or +1 to two) or a Feat.',
    kind: 'asi', count: 1, pool: 'all', grants: [], required: true, resolved: false,
  };
}

/** Level-1 starting-equipment choice. Option values are arrays of item IDs. */
function equipmentChoice(
  id: string,
  prompt: string,
  options: { id: string; label: string; items: string[] }[],
): ChoiceDefinition {
  return {
    id, prompt, kind: 'equipment', count: 1,
    pool: options.map(o => ({ id: o.id, label: o.label, value: o.items })),
    grants: [], required: true, resolved: false,
  };
}

/** Queues a batch of new infusions to learn — count is the DELTA gained at this level. */
function infusionChoice(id: string, count: number): ChoiceDefinition {
  return {
    id,
    prompt: `Choose ${count} new infusion${count !== 1 ? 's' : ''} to learn.`,
    kind: 'infusion', count, pool: 'all', grants: [], required: true, resolved: false,
  };
}

const artificerSkillChoice: ChoiceDefinition = {
  id: 'artificer_skills_lvl_1',
  prompt: 'Choose 2 skills from: Arcana, History, Investigation, Medicine, Nature, Perception, Sleight of Hand.',
  kind: 'skill', count: 2,
  pool: [
    { id: 'arcana',         label: 'Arcana',           value: 'arcana' },
    { id: 'history',        label: 'History',          value: 'history' },
    { id: 'investigation',  label: 'Investigation',    value: 'investigation' },
    { id: 'medicine',       label: 'Medicine',         value: 'medicine' },
    { id: 'nature',         label: 'Nature',           value: 'nature' },
    { id: 'perception',     label: 'Perception',       value: 'perception' },
    { id: 'sleight_of_hand', label: 'Sleight of Hand', value: 'sleight_of_hand' },
  ],
  grants: [], required: true, resolved: false,
};

const artificerEquipChoices: ChoiceDefinition[] = [
  equipmentChoice('artificer_equip_a', 'Choose armor: (a) scale mail or (b) leather armor', [
    { id: 'scale',   label: 'Scale Mail',    items: ['scale_mail'] },
    { id: 'leather', label: 'Leather Armor', items: ['leather_armor'] },
  ]),
  equipmentChoice('artificer_equip_b', 'Choose a weapon: (a) two daggers or (b) a light hammer', [
    { id: 'daggers', label: 'Two Daggers', items: ['dagger', 'dagger'] },
    { id: 'hammer',  label: 'Light Hammer', items: ['light_hammer'] },
  ]),
  equipmentChoice('artificer_equip_c', "Choose a pack: (a) dungeoneer's or (b) explorer's", [
    { id: 'dungeoneer', label: "Dungeoneer's Pack", items: ['dungeoneers_pack'] },
    { id: 'explorer',   label: "Explorer's Pack",   items: ['explorers_pack'] },
  ]),
];

export const artificerProgression: ClassProgression = {
  classId: 'artificer',
  srd: false,
  entries: [
    {
      level: 1, hpDie: 8,
      choices: [artificerSkillChoice, ...artificerEquipChoices],
      grants: [
        { kind: 'proficiency', value: { armor: ['light', 'medium'], weapons: ['simple'], tools: ['thieves_tools', 'tinkers_tools'] } },
        { kind: 'feature', value: { id: 'magical_tinkering', name: 'Magical Tinkering', description: "You learn to invest a spark of magic into mundane objects. As an action, touch a Tiny nonmagical object and imbue it with a harmless sensory effect (light, sound, odor, or similar). Flavor-only — no engine hook for freeform touch effects.", source: { kind: 'class', refId: 'artificer' }, level: 1, effects: [], actions: [], choices: [], passive: false } },
        { kind: 'feature', value: { id: 'artificer_spellcasting', name: 'Spellcasting', description: 'You have learned to channel magic through your tools and inventions, using Intelligence as your spellcasting ability. Unusually for a half-caster, you can cast spells starting at 1st level.', source: { kind: 'class', refId: 'artificer' }, level: 1, effects: [], actions: [], choices: [], passive: true } },
        { kind: 'init_spellcasting', value: { ability: 'int' } },
        { kind: 'spell_slots', value: { level: 1 } },
      ],
    },
    {
      level: 2, hpDie: 8,
      choices: [infusionChoice('artificer_infusions_2', 4)],
      grants: [
        { kind: 'feature', value: { id: 'infuse_item', name: 'Infuse Item', description: 'You gain the ability to imbue mundane items with certain magical infusions, learning a number of infusions and being able to infuse a number of items simultaneously, both of which grow as you level (see the Infusions section of your Items tab).', source: { kind: 'class', refId: 'artificer' }, level: 2, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    {
      level: 3, hpDie: 8,
      choices: [{ id: 'artificer_specialist_choice', prompt: 'Choose an Artificer Specialist.', kind: 'subclass', count: 1, pool: 'all', grants: [], required: true, resolved: false }],
      grants: [
        { kind: 'feature', value: { id: 'artificer_specialist', name: 'Artificer Specialist', description: 'You choose the type of specialist you are, granting you features at 3rd level and again at 5th, 9th, and 15th level.', source: { kind: 'class', refId: 'artificer' }, level: 3, effects: [], actions: [], choices: [], passive: true } },
        { kind: 'feature', value: { id: 'right_tool_for_the_job', name: 'The Right Tool for the Job', description: 'Using a set of artisan\'s tools, you can magically create a different set of artisan\'s tools in your hand, spending 1 hour of work. The tools last until you use this feature again. Flavor-only — the app has no crafting/downtime system to model the hour of work or the temporary tool swap.', source: { kind: 'class', refId: 'artificer' }, level: 3, effects: [], actions: [], choices: [], passive: false } },
      ],
    },
    { level: 4, hpDie: 8, choices: [asiChoice('artificer_asi_4')], grants: [] },
    { level: 5, hpDie: 8, choices: [], grants: [] },
    {
      level: 6, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'tool_expertise', name: 'Tool Expertise', description: 'Your proficiency bonus is doubled for any ability check you make that uses your proficiency with a tool. Flavor-only — same "no generic expertise/double-prof mechanism" gap as Rogue/Bard Expertise elsewhere in this app.', source: { kind: 'class', refId: 'artificer' }, level: 6, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    {
      level: 7, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'flash_of_genius', name: 'Flash of Genius', description: 'When you or a creature within 30 feet makes an ability check or a saving throw, you can use your reaction to add your Intelligence modifier to the roll, a number of times equal to your Intelligence modifier per long rest. Flavor-only — no reaction-trigger automation and no ability-modifier-scaled resource pool exist in the engine yet.', source: { kind: 'class', refId: 'artificer' }, level: 7, effects: [], actions: [], choices: [], passive: false } },
      ],
    },
    { level: 8, hpDie: 8, choices: [asiChoice('artificer_asi_8')], grants: [] },
    { level: 9, hpDie: 8, choices: [], grants: [] },
    {
      level: 10, hpDie: 8,
      choices: [infusionChoice('artificer_infusions_10', 2)],
      grants: [
        { kind: 'feature', value: { id: 'magic_item_adept', name: 'Magic Item Adept', description: 'You can attune to up to 4 magic items at once, and crafting a magic item costs you half the usual gold and time. Flavor-only — the app has no attunement-count enforcement or crafting/downtime system.', source: { kind: 'class', refId: 'artificer' }, level: 10, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    {
      level: 11, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'spell_storing_item', name: 'Spell-Storing Item', description: 'You can store a spell in an object. Any creature can then use an action to read the item and cast the spell from it. Requires 1 hour of work and a spell slot of 1st-4th level for a spell you know or have access to; the stored spell can be cast a number of times equal to twice the spell\'s level, after which the enchantment fades. Flavor-only — no crafting/downtime system to model the hour of work, and no mechanism for a non-caster item to hold and later trigger a spell cast.', source: { kind: 'class', refId: 'artificer' }, level: 11, effects: [], actions: [], choices: [], passive: false } },
      ],
    },
    { level: 12, hpDie: 8, choices: [asiChoice('artificer_asi_12')], grants: [] },
    { level: 13, hpDie: 8, choices: [], grants: [] },
    {
      level: 14, hpDie: 8,
      choices: [infusionChoice('artificer_infusions_14', 2)],
      grants: [
        { kind: 'feature', value: { id: 'magic_item_savant', name: 'Magic Item Savant', description: 'You can attune to up to 5 magic items at once, and you ignore all class, race, spell, and level requirements on attuning to or using a magic item. Flavor-only — no attunement/requirement enforcement exists in the engine.', source: { kind: 'class', refId: 'artificer' }, level: 14, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    { level: 15, hpDie: 8, choices: [], grants: [] },
    { level: 16, hpDie: 8, choices: [asiChoice('artificer_asi_16')], grants: [] },
    { level: 17, hpDie: 8, choices: [], grants: [] },
    {
      level: 18, hpDie: 8,
      choices: [infusionChoice('artificer_infusions_18', 2)],
      grants: [
        { kind: 'feature', value: { id: 'magic_item_master', name: 'Magic Item Master', description: 'You can attune to up to 6 magic items at once. Flavor-only — no attunement-count enforcement exists in the engine.', source: { kind: 'class', refId: 'artificer' }, level: 18, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    { level: 19, hpDie: 8, choices: [asiChoice('artificer_asi_19')], grants: [] },
    {
      level: 20, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'soul_of_artifice', name: 'Soul of Artifice', description: 'You gain a +1 bonus to all saving throws per magic item you are attuned to (up to 5). If you would be reduced to 0 HP but not killed outright, you can sacrifice the magic in one attuned item to instead drop to 1 HP, once per long rest. Flavor-only — no generic per-attuned-item saving-throw bonus or death-save override exists in the engine.', source: { kind: 'class', refId: 'artificer' }, level: 20, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
  ],
};
