// ============================================================================
// FILE: src/content/classes/fighter.ts
// ============================================================================
import { ClassProgression, ChoiceDefinition } from '../../engine/types';

const fighterSkillChoice: ChoiceDefinition = {
  id: "fighter_skills_lvl_1",
  prompt: "Choose 2 skills from: Acrobatics, Animal Handling, Athletics, History, Insight, Intimidation, Perception, Survival",
  kind: "skill",
  count: 2,
  pool: [
    { id: "acrobatics",      label: "Acrobatics",      value: "acrobatics" },
    { id: "animal_handling", label: "Animal Handling",  value: "animal_handling" },
    { id: "athletics",       label: "Athletics",        value: "athletics" },
    { id: "history",         label: "History",          value: "history" },
    { id: "insight",         label: "Insight",          value: "insight" },
    { id: "intimidation",    label: "Intimidation",     value: "intimidation" },
    { id: "perception",      label: "Perception",       value: "perception" },
    { id: "survival",        label: "Survival",         value: "survival" }
  ],
  grants: [],
  required: true,
  resolved: false
};

function asiChoice(id: string): import('../../engine/types').ChoiceDefinition {
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

const fighterEquipChoices: ChoiceDefinition[] = [
  {
    ...equipmentChoice('fighter_equip_a', 'Choose armor: (a) chain mail or (b) leather armor, longbow, and 20 arrows', [
      { id: 'chain',   label: 'Chain Mail',                       items: ['chain_mail'] },
      { id: 'leather', label: 'Leather Armor + Longbow + 20 arrows', items: ['leather_armor', 'longbow', 'arrows_20'] },
    ]),
    equipmentGroup: 'Armor',
  },
  // STARTING-EQUIPMENT-1: previously hardcoded ONE example weapon per
  // option ("Longsword + Shield" / "Longsword + Battleaxe") as if it were
  // the only legal pick, when the actual PHB rule is "any martial weapon."
  // Rebuilt as exact_options with a nested itemFilter per option so the
  // player picks from every real qualifying weapon via the shared Item
  // browser, instead of being handed one hardcoded example.
  {
    id: 'fighter_equip_b', prompt: 'Choose: (a) a martial weapon and a shield or (b) two martial weapons',
    kind: 'equipment', count: 1, grants: [], required: true, resolved: false,
    equipmentStyle: 'exact_options', equipmentGroup: 'Weapons',
    pool: [
      { id: 'weapon_shield', label: 'A martial weapon and a shield', value: ['shield'], itemFilter: { constraint: { category: 'weapon', weaponClass: 'martial' }, quantity: 1 } },
      { id: 'two_martial',   label: 'Two martial weapons',           value: [],          itemFilter: { constraint: { category: 'weapon', weaponClass: 'martial' }, quantity: 2 } },
    ],
  },
  {
    ...equipmentChoice('fighter_equip_c', 'Choose: (a) a light crossbow and 20 bolts or (b) two handaxes', [
      { id: 'crossbow', label: 'Light Crossbow & 20 bolts', items: ['light_crossbow', 'bolts_20'] },
      { id: 'handaxes', label: 'Two Handaxes',              items: ['handaxe', 'handaxe'] },
    ]),
    equipmentGroup: 'Ranged / Secondary Weapon',
  },
  {
    ...equipmentChoice('fighter_equip_d', "Choose a pack: (a) dungeoneer's or (b) explorer's", [
      { id: 'dungeoneer', label: "Dungeoneer's Pack", items: ['dungeoneers_pack'] },
      { id: 'explorer',   label: "Explorer's Pack",   items: ['explorers_pack'] },
    ]),
    equipmentStyle: 'bundle_options', equipmentGroup: 'Pack',
  },
];

export const fighterProgression: ClassProgression = {
  classId: "fighter",
  srd: true,
  entries: [
    {
      level: 1, hpDie: 10, choices: [fighterSkillChoice, ...fighterEquipChoices],
      grants: [
        { kind: "feature", value: { id: "fighting_style", name: "Fighting Style", description: "You adopt a particular style of fighting as your specialty.", source: { kind: "class", refId: "fighter" }, level: 1, effects: [], actions: [], choices: [], passive: true } },
        { kind: "feature", value: { id: "second_wind", name: "Second Wind", description: "Regain HP equal to 1d10 + Fighter Level as a bonus action (1 use per short rest).", source: { kind: "class", refId: "fighter" }, level: 1, effects: [], actions: [{ id: "use_second_wind", name: "Second Wind", description: "Heal 1d10 + lvl" }], choices: [], passive: false, activation: { actionType: 'bonus_action', resourceCost: { resourceId: 'second_wind_pool', quantity: 1 }, range: 'self', target: 'self', requiresSave: null } } },
        { kind: "resource", value: { resourceId: "second_wind_pool", name: "Second Wind", maximum: 1, recharge: "short_rest" } },
      ]
    },
    {
      level: 2, hpDie: 10, choices: [],
      grants: [
        { kind: "feature", value: { id: "action_surge", name: "Action Surge", description: "Once per short rest, take one additional action on your turn.", source: { kind: "class", refId: "fighter" }, level: 2, effects: [], actions: [], choices: [], passive: false, activation: { actionType: 'free', resourceCost: { resourceId: 'action_surge_pool', quantity: 1 }, range: 'self', target: 'self', requiresSave: null } } },
        { kind: "resource", value: { resourceId: "action_surge_pool", name: "Action Surge", maximum: 1, recharge: "short_rest" } },
      ]
    },
    {
      level: 3, hpDie: 10, choices: [{ id: 'martial_archetype_choice', prompt: 'Choose a Martial Archetype.', kind: 'subclass', count: 1, pool: 'all', grants: [], required: true, resolved: false }],
      grants: [
        { kind: "feature", value: { id: "martial_archetype", name: "Martial Archetype", description: "You choose an archetype that you strive to emulate in your combat styles and techniques.", source: { kind: "class", refId: "fighter" }, level: 3, effects: [], actions: [], choices: [], passive: true } },
      ]
    },
    { level: 4,  hpDie: 10, choices: [asiChoice("fighter_asi_4")],  grants: [] },
    {
      level: 5, hpDie: 10, choices: [],
      grants: [
        { kind: "feature", value: { id: "extra_attack_fighter", name: "Extra Attack", description: "You can attack twice whenever you take the Attack action on your turn.", source: { kind: "class", refId: "fighter" }, level: 5, effects: [{ type: "stat_modifier", target: "extra_attack", operation: "set", value: 1, condition: null }], actions: [], choices: [], passive: true } },
      ]
    },
    { level: 6,  hpDie: 10, choices: [asiChoice("fighter_asi_6")],  grants: [] },
    { level: 7,  hpDie: 10, choices: [], grants: [] },
    { level: 8,  hpDie: 10, choices: [asiChoice("fighter_asi_8")],  grants: [] },
    {
      level: 9, hpDie: 10, choices: [],
      grants: [
        { kind: "feature", value: { id: "indomitable_1", name: "Indomitable", description: "You can reroll a saving throw that you fail (1 use per long rest).", source: { kind: "class", refId: "fighter" }, level: 9, effects: [], actions: [], choices: [], passive: false, activation: { actionType: 'free', resourceCost: { resourceId: 'indomitable_pool', quantity: 1 }, range: 'self', target: 'self', requiresSave: null } } },
        { kind: "resource", value: { resourceId: "indomitable_pool", name: "Indomitable", maximum: 1, recharge: "long_rest" } },
      ]
    },
    { level: 10, hpDie: 10, choices: [], grants: [] },
    {
      level: 11, hpDie: 10, choices: [],
      grants: [
        { kind: "feature", value: { id: "extra_attack_2_fighter", name: "Extra Attack (2)", description: "You can attack three times whenever you take the Attack action on your turn.", source: { kind: "class", refId: "fighter" }, level: 11, effects: [{ type: "stat_modifier", target: "extra_attack", operation: "set", value: 2, condition: null }], actions: [], choices: [], passive: true } },
      ]
    },
    { level: 12, hpDie: 10, choices: [asiChoice("fighter_asi_12")], grants: [] },
    {
      level: 13, hpDie: 10, choices: [],
      grants: [
        { kind: "resource_upgrade", value: { resourceId: "indomitable_pool", newMaximum: 2 } },
      ]
    },
    { level: 14, hpDie: 10, choices: [asiChoice("fighter_asi_14")], grants: [] },
    { level: 15, hpDie: 10, choices: [], grants: [] },
    { level: 16, hpDie: 10, choices: [asiChoice("fighter_asi_16")], grants: [] },
    {
      level: 17, hpDie: 10, choices: [],
      grants: [
        { kind: "resource_upgrade", value: { resourceId: "action_surge_pool", newMaximum: 2 } },
        { kind: "resource_upgrade", value: { resourceId: "indomitable_pool", newMaximum: 3 } },
      ]
    },
    { level: 18, hpDie: 10, choices: [], grants: [] },
    { level: 19, hpDie: 10, choices: [asiChoice("fighter_asi_19")], grants: [] },
    {
      level: 20, hpDie: 10, choices: [],
      grants: [
        { kind: "feature", value: { id: "extra_attack_3_fighter", name: "Extra Attack (3)", description: "You can attack four times whenever you take the Attack action on your turn.", source: { kind: "class", refId: "fighter" }, level: 20, effects: [{ type: "stat_modifier", target: "extra_attack", operation: "set", value: 3, condition: null }], actions: [], choices: [], passive: true } },
      ]
    },
  ]
};
