// ============================================================================
// FILE: src/content/classes/index.ts
// All 12 PHB classes with full level 1-20 progressions.
// ============================================================================
import { ClassProgression, LevelEntry, ChoiceDefinition } from '../../engine/types';
import { fighterProgression } from './fighter';

// ── Shared helpers ────────────────────────────────────────────────────────────

function asiChoice(id: string): ChoiceDefinition {
  return {
    id,
    prompt: 'Choose an Ability Score Increase (+2 to one or +1 to two) or a Feat.',
    kind: 'asi',
    count: 1,
    pool: 'all',
    grants: [],
    required: true,
    resolved: false,
  };
}

/**
 * Builds a level-1 starting-equipment choice. Each option's `value` is an array
 * of item IDs that get added to inventory.carried when the choice is resolved
 * (see resolveChoice in leveling.ts).
 */
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

/** Stub entries for levels that have no special grants (just HP). */
function stubEntries(
  levels: number[],
  hpDie: LevelEntry['hpDie'],
): LevelEntry[] {
  return levels.map(level => ({ level, hpDie, choices: [], grants: [] }));
}

// ── Rogue ─────────────────────────────────────────────────────────────────────

const rogueSkillChoice: ChoiceDefinition = {
  id: 'rogue_skills_lvl_1',
  prompt: 'Choose 4 skills from: Acrobatics, Athletics, Deception, Insight, Intimidation, Investigation, Perception, Performance, Persuasion, Sleight of Hand, Stealth.',
  kind: 'skill', count: 4,
  pool: [
    { id: 'acrobatics',     label: 'Acrobatics',     value: 'acrobatics' },
    { id: 'athletics',      label: 'Athletics',       value: 'athletics' },
    { id: 'deception',      label: 'Deception',       value: 'deception' },
    { id: 'insight',        label: 'Insight',         value: 'insight' },
    { id: 'intimidation',   label: 'Intimidation',    value: 'intimidation' },
    { id: 'investigation',  label: 'Investigation',   value: 'investigation' },
    { id: 'perception',     label: 'Perception',      value: 'perception' },
    { id: 'performance',    label: 'Performance',     value: 'performance' },
    { id: 'persuasion',     label: 'Persuasion',      value: 'persuasion' },
    { id: 'sleight_of_hand', label: 'Sleight of Hand', value: 'sleight_of_hand' },
    { id: 'stealth',        label: 'Stealth',         value: 'stealth' },
  ],
  grants: [], required: true, resolved: false,
};

export const rogueProgression: ClassProgression = {
  classId: 'rogue',
  srd: true,
  entries: [
    {
      level: 1, hpDie: 8, choices: [
        rogueSkillChoice,
        equipmentChoice('rogue_equip_a', 'Choose a weapon: (a) a rapier or (b) a shortsword', [
          { id: 'rapier',     label: 'Rapier',     items: ['rapier'] },
          { id: 'shortsword', label: 'Shortsword', items: ['shortsword'] },
        ]),
        equipmentChoice('rogue_equip_b', 'Choose: (a) a shortbow and quiver of 20 arrows or (b) a shortsword', [
          { id: 'shortbow',   label: 'Shortbow & 20 arrows', items: ['shortbow', 'arrows_20'] },
          { id: 'shortsword', label: 'Shortsword',           items: ['shortsword'] },
        ]),
        equipmentChoice('rogue_equip_c', "Choose a pack: (a) burglar's, (b) dungeoneer's, or (c) explorer's", [
          { id: 'burglar',    label: "Burglar's Pack",    items: ['burglars_pack'] },
          { id: 'dungeoneer', label: "Dungeoneer's Pack", items: ['dungeoneers_pack'] },
          { id: 'explorer',   label: "Explorer's Pack",   items: ['explorers_pack'] },
        ]),
      ],
      grants: [
        { kind: 'feature', value: { id: 'sneak_attack', name: 'Sneak Attack', description: 'Once per turn, deal extra 1d6 damage when you have advantage or an ally is adjacent to the target.', source: { kind: 'class', refId: 'rogue' }, level: 1, effects: [], actions: [], choices: [], passive: true } },
        { kind: 'feature', value: { id: 'thieves_cant', name: "Thieves' Cant", description: "You have learned thieves' cant, a secret mix of dialect, jargon, and code.", source: { kind: 'class', refId: 'rogue' }, level: 1, effects: [], actions: [], choices: [], passive: true } },
        { kind: 'feature', value: { id: 'expertise_rogue_1', name: 'Expertise', description: 'Choose two of your skill proficiencies to double your proficiency bonus.', source: { kind: 'class', refId: 'rogue' }, level: 1, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    {
      level: 2, hpDie: 8, choices: [],
      grants: [
        { kind: 'feature', value: { id: 'cunning_action', name: 'Cunning Action', description: 'You can take a bonus action to Dash, Disengage, or Hide.', source: { kind: 'class', refId: 'rogue' }, level: 2, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    { level: 3, hpDie: 8, choices: [{ id: 'rogue_archetype', prompt: 'Choose a Roguish Archetype.', kind: 'custom', count: 1, pool: 'all', grants: [], required: true, resolved: false }], grants: [{ kind: 'feature', value: { id: 'rogue_archetype_feature', name: 'Roguish Archetype', description: 'You choose an archetype that you emulate in the exercise of your rogue abilities.', source: { kind: 'class', refId: 'rogue' }, level: 3, effects: [], actions: [], choices: [], passive: true } }] },
    { level: 4, hpDie: 8, choices: [asiChoice('rogue_asi_4')], grants: [] },
    { level: 5, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'uncanny_dodge', name: 'Uncanny Dodge', description: 'When an attacker you can see hits you, use your reaction to halve the damage.', source: { kind: 'class', refId: 'rogue' }, level: 5, effects: [], actions: [], choices: [], passive: false } }] },
    { level: 6, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'expertise_rogue_6', name: 'Expertise', description: 'Choose two more skill proficiencies to double your proficiency bonus.', source: { kind: 'class', refId: 'rogue' }, level: 6, effects: [], actions: [], choices: [], passive: true } }] },
    { level: 7, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'evasion_rogue', name: 'Evasion', description: 'When subjected to an effect requiring a Dex save, take no damage on success and half on failure.', source: { kind: 'class', refId: 'rogue' }, level: 7, effects: [], actions: [], choices: [], passive: true } }] },
    { level: 8, hpDie: 8, choices: [asiChoice('rogue_asi_8')], grants: [] },
    ...stubEntries([9], 8),
    { level: 10, hpDie: 8, choices: [asiChoice('rogue_asi_10')], grants: [] },
    ...stubEntries([11], 8),
    { level: 12, hpDie: 8, choices: [asiChoice('rogue_asi_12')], grants: [] },
    ...stubEntries([13,14,15], 8),
    { level: 16, hpDie: 8, choices: [asiChoice('rogue_asi_16')], grants: [] },
    ...stubEntries([17,18], 8),
    { level: 19, hpDie: 8, choices: [asiChoice('rogue_asi_19')], grants: [] },
    { level: 20, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'stroke_of_luck', name: 'Stroke of Luck', description: 'If your attack misses, turn it into a hit. If you fail a check, treat the d20 roll as a 20.', source: { kind: 'class', refId: 'rogue' }, level: 20, effects: [], actions: [], choices: [], passive: false } }] },
  ],
};

// ── Wizard ────────────────────────────────────────────────────────────────────

const wizardSkillChoice: ChoiceDefinition = {
  id: 'wizard_skills_lvl_1',
  prompt: 'Choose 2 skills from: Arcana, History, Insight, Investigation, Medicine, Religion.',
  kind: 'skill', count: 2,
  pool: [
    { id: 'arcana',        label: 'Arcana',        value: 'arcana' },
    { id: 'history',       label: 'History',       value: 'history' },
    { id: 'insight',       label: 'Insight',       value: 'insight' },
    { id: 'investigation', label: 'Investigation', value: 'investigation' },
    { id: 'medicine',      label: 'Medicine',      value: 'medicine' },
    { id: 'religion',      label: 'Religion',      value: 'religion' },
  ],
  grants: [], required: true, resolved: false,
};

export const wizardProgression: ClassProgression = {
  classId: 'wizard',
  srd: true,
  entries: [
    {
      level: 1, hpDie: 6, choices: [
        wizardSkillChoice,
        equipmentChoice('wizard_equip_a', 'Choose a weapon: (a) a quarterstaff or (b) a dagger', [
          { id: 'quarterstaff', label: 'Quarterstaff', items: ['quarterstaff'] },
          { id: 'dagger',       label: 'Dagger',       items: ['dagger'] },
        ]),
        equipmentChoice('wizard_equip_b', 'Choose a focus: (a) a component pouch or (b) an arcane focus', [
          { id: 'pouch', label: 'Component Pouch', items: ['component_pouch'] },
          { id: 'focus', label: 'Arcane Focus',    items: ['arcane_focus_orb'] },
        ]),
        equipmentChoice('wizard_equip_c', "Choose a pack: (a) scholar's or (b) explorer's", [
          { id: 'scholar',  label: "Scholar's Pack",  items: ['scholars_pack'] },
          { id: 'explorer', label: "Explorer's Pack", items: ['explorers_pack'] },
        ]),
      ],
      grants: [
        { kind: 'feature', value: { id: 'wizard_spellcasting', name: 'Spellcasting', description: 'As a student of arcane magic, you have a spellbook containing spells.', source: { kind: 'class', refId: 'wizard' }, level: 1, effects: [], actions: [], choices: [], passive: true } },
        { kind: 'feature', value: { id: 'arcane_recovery', name: 'Arcane Recovery', description: 'Once per day when you finish a short rest, you can choose expended spell slots to recover.', source: { kind: 'class', refId: 'wizard' }, level: 1, effects: [], actions: [], choices: [], passive: false } },
        { kind: 'init_spellcasting', value: { ability: 'int' } },
        { kind: 'spell_slots', value: { level: 1 } },
      ],
    },
    { level: 2, hpDie: 6, choices: [], grants: [{ kind: 'feature', value: { id: 'wizard_tradition', name: 'Arcane Tradition', description: 'You choose an arcane tradition, shaping your practice of magic.', source: { kind: 'class', refId: 'wizard' }, level: 2, effects: [], actions: [], choices: [], passive: true } }] },
    { level: 3, hpDie: 6, choices: [], grants: [] },
    { level: 4, hpDie: 6, choices: [asiChoice('wizard_asi_4')], grants: [] },
    ...stubEntries([5,6,7], 6),
    { level: 8, hpDie: 6, choices: [asiChoice('wizard_asi_8')], grants: [] },
    ...stubEntries([9,10,11], 6),
    { level: 12, hpDie: 6, choices: [asiChoice('wizard_asi_12')], grants: [] },
    ...stubEntries([13,14,15], 6),
    { level: 16, hpDie: 6, choices: [asiChoice('wizard_asi_16')], grants: [] },
    ...stubEntries([17,18], 6),
    { level: 19, hpDie: 6, choices: [asiChoice('wizard_asi_19')], grants: [] },
    { level: 20, hpDie: 6, choices: [], grants: [{ kind: 'feature', value: { id: 'signature_spells', name: 'Signature Spells', description: 'You gain mastery over two powerful spells and can cast them with little effort.', source: { kind: 'class', refId: 'wizard' }, level: 20, effects: [], actions: [], choices: [], passive: true } }] },
  ],
};

// ── Cleric ────────────────────────────────────────────────────────────────────

const clericSkillChoice: ChoiceDefinition = {
  id: 'cleric_skills_lvl_1',
  prompt: 'Choose 2 skills from: History, Insight, Medicine, Persuasion, Religion.',
  kind: 'skill', count: 2,
  pool: [
    { id: 'history',    label: 'History',    value: 'history' },
    { id: 'insight',    label: 'Insight',    value: 'insight' },
    { id: 'medicine',   label: 'Medicine',   value: 'medicine' },
    { id: 'persuasion', label: 'Persuasion', value: 'persuasion' },
    { id: 'religion',   label: 'Religion',   value: 'religion' },
  ],
  grants: [], required: true, resolved: false,
};

export const clericProgression: ClassProgression = {
  classId: 'cleric',
  srd: true,
  entries: [
    {
      level: 1, hpDie: 8, choices: [
        clericSkillChoice,
        equipmentChoice('cleric_equip_a', 'Choose a weapon: (a) a mace or (b) a warhammer', [
          { id: 'mace',      label: 'Mace',      items: ['mace'] },
          { id: 'warhammer', label: 'Warhammer (if proficient)', items: ['warhammer'] },
        ]),
        equipmentChoice('cleric_equip_b', 'Choose armor: (a) scale mail, (b) leather armor, or (c) chain mail', [
          { id: 'scale',   label: 'Scale Mail',                items: ['scale_mail'] },
          { id: 'leather', label: 'Leather Armor',             items: ['leather_armor'] },
          { id: 'chain',   label: 'Chain Mail (if proficient)', items: ['chain_mail'] },
        ]),
        equipmentChoice('cleric_equip_c', 'Choose: (a) a light crossbow and 20 bolts or (b) a simple weapon', [
          { id: 'crossbow', label: 'Light Crossbow & 20 bolts', items: ['light_crossbow', 'bolts_20'] },
          { id: 'simple',   label: 'Any simple weapon (Mace)',  items: ['mace'] },
        ]),
        equipmentChoice('cleric_equip_d', "Choose a pack: (a) priest's or (b) explorer's", [
          { id: 'priest',   label: "Priest's Pack",   items: ['priests_pack'] },
          { id: 'explorer', label: "Explorer's Pack", items: ['explorers_pack'] },
        ]),
      ],
      grants: [
        { kind: 'feature', value: { id: 'cleric_spellcasting', name: 'Spellcasting', description: 'As a conduit for divine power, you can cast cleric spells.', source: { kind: 'class', refId: 'cleric' }, level: 1, effects: [], actions: [], choices: [], passive: true } },
        { kind: 'feature', value: { id: 'divine_domain', name: 'Divine Domain', description: 'You choose a domain related to your deity.', source: { kind: 'class', refId: 'cleric' }, level: 1, effects: [], actions: [], choices: [], passive: true } },
        { kind: 'init_spellcasting', value: { ability: 'wis' } },
        { kind: 'spell_slots', value: { level: 1 } },
      ],
    },
    { level: 2, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'channel_divinity', name: 'Channel Divinity', description: 'You gain the ability to channel divine energy directly from your deity.', source: { kind: 'class', refId: 'cleric' }, level: 2, effects: [], actions: [], choices: [], passive: false } }, { kind: 'resource', value: { resourceId: 'channel_divinity_pool', name: 'Channel Divinity', maximum: 1, recharge: 'short_rest' } }] },
    { level: 3, hpDie: 8, choices: [], grants: [] },
    { level: 4, hpDie: 8, choices: [asiChoice('cleric_asi_4')], grants: [] },
    { level: 5, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'destroy_undead', name: 'Destroy Undead', description: 'When an undead fails its saving throw against your Turn Undead, the creature is instantly destroyed.', source: { kind: 'class', refId: 'cleric' }, level: 5, effects: [], actions: [], choices: [], passive: true } }] },
    { level: 6, hpDie: 8, choices: [], grants: [{ kind: 'resource_upgrade', value: { resourceId: 'channel_divinity_pool', newMaximum: 2 } }] },
    { level: 7, hpDie: 8, choices: [], grants: [] },
    { level: 8, hpDie: 8, choices: [asiChoice('cleric_asi_8')], grants: [] },
    ...stubEntries([9,10,11], 8),
    { level: 12, hpDie: 8, choices: [asiChoice('cleric_asi_12')], grants: [] },
    ...stubEntries([13,14,15], 8),
    { level: 16, hpDie: 8, choices: [asiChoice('cleric_asi_16')], grants: [] },
    ...stubEntries([17], 8),
    { level: 18, hpDie: 8, choices: [], grants: [{ kind: 'resource_upgrade', value: { resourceId: 'channel_divinity_pool', newMaximum: 3 } }] },
    { level: 19, hpDie: 8, choices: [asiChoice('cleric_asi_19')], grants: [] },
    { level: 20, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'divine_intervention', name: 'Divine Intervention Improvement', description: 'Your call for divine intervention succeeds automatically.', source: { kind: 'class', refId: 'cleric' }, level: 20, effects: [], actions: [], choices: [], passive: true } }] },
  ],
};

// ── Barbarian ─────────────────────────────────────────────────────────────────

const barbarianSkillChoice: ChoiceDefinition = {
  id: 'barbarian_skills_lvl_1',
  prompt: 'Choose 2 skills from: Animal Handling, Athletics, Intimidation, Nature, Perception, Survival.',
  kind: 'skill', count: 2,
  pool: [
    { id: 'animal_handling', label: 'Animal Handling', value: 'animal_handling' },
    { id: 'athletics',       label: 'Athletics',       value: 'athletics' },
    { id: 'intimidation',    label: 'Intimidation',    value: 'intimidation' },
    { id: 'nature',          label: 'Nature',          value: 'nature' },
    { id: 'perception',      label: 'Perception',      value: 'perception' },
    { id: 'survival',        label: 'Survival',        value: 'survival' },
  ],
  grants: [], required: true, resolved: false,
};

export const barbarianProgression: ClassProgression = {
  classId: 'barbarian',
  srd: true,
  entries: [
    {
      level: 1, hpDie: 12, choices: [
        barbarianSkillChoice,
        equipmentChoice('barbarian_equip_a', 'Choose: (a) a greataxe or (b) any martial melee weapon', [
          { id: 'greataxe', label: 'Greataxe',                  items: ['greataxe'] },
          { id: 'martial',  label: 'Any martial melee weapon (Longsword)', items: ['longsword'] },
        ]),
        equipmentChoice('barbarian_equip_b', 'Choose: (a) two handaxes or (b) any simple weapon', [
          { id: 'handaxes', label: 'Two Handaxes',          items: ['handaxe', 'handaxe'] },
          { id: 'simple',   label: 'Any simple weapon (Spear)', items: ['spear'] },
        ]),
      ],
      grants: [
        {
          kind: 'feature',
          value: {
            id: 'rage',
            name: 'Rage',
            description: 'In battle, you fight with primal ferocity. On your turn, you can enter a rage as a bonus action.',
            source: { kind: 'class', refId: 'barbarian' },
            level: 1, actions: [], choices: [], passive: false,
            effects: [
              { type: 'grant_resistance', target: 'bludgeoning', operation: 'resistance', value: null, condition: 'rage_active' },
              { type: 'grant_resistance', target: 'piercing', operation: 'resistance', value: null, condition: 'rage_active' },
              { type: 'grant_resistance', target: 'slashing', operation: 'resistance', value: null, condition: 'rage_active' },
            ],
            activation: { actionType: 'bonus_action', resourceCost: { resourceId: 'rage_pool', quantity: 1 }, range: 'self', target: 'self', requiresSave: null },
            abilityEffects: [{ type: 'set_flag', flag: 'rage_active', value: true }],
          },
        },
        { kind: 'resource', value: { resourceId: 'rage_pool', name: 'Rage', maximum: 2, recharge: 'long_rest' } },
        { kind: 'feature', value: { id: 'unarmored_defense_barbarian', name: 'Unarmored Defense', description: 'While not wearing armor, your AC equals 10 + your Dexterity modifier + your Constitution modifier.', source: { kind: 'class', refId: 'barbarian' }, level: 1, effects: [{ type: 'base_ac_formula', target: 'ac', operation: 'set', value: 10, condition: null, formulaAbilities: ['dex', 'con'] }], actions: [], choices: [], passive: true } },
      ],
    },
    { level: 2, hpDie: 12, choices: [], grants: [{ kind: 'feature', value: { id: 'reckless_attack', name: 'Reckless Attack', description: 'You can throw aside all concern for defense to attack with fierce desperation.', source: { kind: 'class', refId: 'barbarian' }, level: 2, effects: [], actions: [], choices: [], passive: false } }, { kind: 'feature', value: { id: 'danger_sense', name: 'Danger Sense', description: 'You gain an uncanny sense of when things nearby aren\'t as they should be.', source: { kind: 'class', refId: 'barbarian' }, level: 2, effects: [], actions: [], choices: [], passive: true } }] },
    { level: 3, hpDie: 12, choices: [], grants: [{ kind: 'feature', value: { id: 'primal_path', name: 'Primal Path', description: 'You choose a path that shapes the nature of your rage.', source: { kind: 'class', refId: 'barbarian' }, level: 3, effects: [], actions: [], choices: [], passive: true } }, { kind: 'resource_upgrade', value: { resourceId: 'rage_pool', newMaximum: 3 } }] },
    { level: 4, hpDie: 12, choices: [asiChoice('barbarian_asi_4')], grants: [] },
    { level: 5, hpDie: 12, choices: [], grants: [{ kind: 'feature', value: { id: 'extra_attack_barbarian', name: 'Extra Attack', description: 'You can attack twice when you take the Attack action.', source: { kind: 'class', refId: 'barbarian' }, level: 5, effects: [{ type: 'stat_modifier', target: 'extra_attack', operation: 'set', value: 1, condition: null }], actions: [], choices: [], passive: true } }, { kind: 'feature', value: { id: 'fast_movement', name: 'Fast Movement', description: 'Your speed increases by 10 feet while you aren\'t wearing heavy armor.', source: { kind: 'class', refId: 'barbarian' }, level: 5, effects: [{ type: 'stat_modifier', target: 'speed', operation: 'add', value: 10, condition: null }], actions: [], choices: [], passive: true } }] },
    { level: 6, hpDie: 12, choices: [], grants: [{ kind: 'resource_upgrade', value: { resourceId: 'rage_pool', newMaximum: 4 } }] },
    { level: 7, hpDie: 12, choices: [], grants: [{ kind: 'feature', value: { id: 'feral_instinct', name: 'Feral Instinct', description: 'You have advantage on initiative rolls.', source: { kind: 'class', refId: 'barbarian' }, level: 7, effects: [{ type: 'stat_modifier', target: 'initiative', operation: 'advantage', value: null, condition: null }], actions: [], choices: [], passive: true } }] },
    { level: 8, hpDie: 12, choices: [asiChoice('barbarian_asi_8')], grants: [] },
    { level: 9, hpDie: 12, choices: [], grants: [{ kind: 'feature', value: { id: 'brutal_critical', name: 'Brutal Critical', description: 'You can roll one additional weapon damage die when determining extra damage for a critical hit.', source: { kind: 'class', refId: 'barbarian' }, level: 9, effects: [], actions: [], choices: [], passive: true } }] },
    ...stubEntries([10], 12),
    { level: 11, hpDie: 12, choices: [], grants: [{ kind: 'feature', value: { id: 'relentless_rage', name: 'Relentless Rage', description: 'Your rage can keep you fighting despite grievous wounds.', source: { kind: 'class', refId: 'barbarian' }, level: 11, effects: [], actions: [], choices: [], passive: true } }] },
    { level: 12, hpDie: 12, choices: [asiChoice('barbarian_asi_12')], grants: [{ kind: 'resource_upgrade', value: { resourceId: 'rage_pool', newMaximum: 5 } }] },
    ...stubEntries([13,14], 12),
    { level: 15, hpDie: 12, choices: [], grants: [{ kind: 'feature', value: { id: 'persistent_rage', name: 'Persistent Rage', description: 'Your rage is so fierce that it ends early only if you fall unconscious.', source: { kind: 'class', refId: 'barbarian' }, level: 15, effects: [], actions: [], choices: [], passive: true } }] },
    { level: 16, hpDie: 12, choices: [asiChoice('barbarian_asi_16')], grants: [] },
    { level: 17, hpDie: 12, choices: [], grants: [{ kind: 'resource_upgrade', value: { resourceId: 'rage_pool', newMaximum: 6 } }] },
    { level: 18, hpDie: 12, choices: [], grants: [{ kind: 'feature', value: { id: 'indomitable_might', name: 'Indomitable Might', description: 'If your total for a Strength check is less than your Strength score, use your Strength score.', source: { kind: 'class', refId: 'barbarian' }, level: 18, effects: [], actions: [], choices: [], passive: true } }] },
    { level: 19, hpDie: 12, choices: [asiChoice('barbarian_asi_19')], grants: [] },
    { level: 20, hpDie: 12, choices: [], grants: [{ kind: 'feature', value: { id: 'primal_champion', name: 'Primal Champion', description: 'Your Strength and Constitution scores increase by 4. Your maximum for those scores is now 24.', source: { kind: 'class', refId: 'barbarian' }, level: 20, effects: [{ type: 'stat_modifier', target: 'str', operation: 'add', value: 4, condition: null }, { type: 'stat_modifier', target: 'con', operation: 'add', value: 4, condition: null }], actions: [], choices: [], passive: true } }, { kind: 'resource_upgrade', value: { resourceId: 'rage_pool', newMaximum: 999 } }] },
  ],
};

// ── Ranger ────────────────────────────────────────────────────────────────────

const rangerSkillChoice: ChoiceDefinition = {
  id: 'ranger_skills_lvl_1',
  prompt: 'Choose 3 skills from: Animal Handling, Athletics, Insight, Investigation, Nature, Perception, Stealth, Survival.',
  kind: 'skill', count: 3,
  pool: [
    { id: 'animal_handling', label: 'Animal Handling', value: 'animal_handling' },
    { id: 'athletics',       label: 'Athletics',       value: 'athletics' },
    { id: 'insight',         label: 'Insight',         value: 'insight' },
    { id: 'investigation',   label: 'Investigation',   value: 'investigation' },
    { id: 'nature',          label: 'Nature',          value: 'nature' },
    { id: 'perception',      label: 'Perception',      value: 'perception' },
    { id: 'stealth',         label: 'Stealth',         value: 'stealth' },
    { id: 'survival',        label: 'Survival',        value: 'survival' },
  ],
  grants: [], required: true, resolved: false,
};

export const rangerProgression: ClassProgression = {
  classId: 'ranger',
  srd: true,
  entries: [
    {
      level: 1, hpDie: 10, choices: [
        rangerSkillChoice,
        equipmentChoice('ranger_equip_a', 'Choose armor: (a) scale mail or (b) leather armor', [
          { id: 'scale',   label: 'Scale Mail',    items: ['scale_mail'] },
          { id: 'leather', label: 'Leather Armor', items: ['leather_armor'] },
        ]),
        equipmentChoice('ranger_equip_b', 'Choose: (a) two shortswords or (b) two simple melee weapons', [
          { id: 'shortswords', label: 'Two Shortswords',         items: ['shortsword', 'shortsword'] },
          { id: 'simple',      label: 'Two simple melee weapons (Spears)', items: ['spear', 'spear'] },
        ]),
        equipmentChoice('ranger_equip_c', "Choose a pack: (a) dungeoneer's or (b) explorer's", [
          { id: 'dungeoneer', label: "Dungeoneer's Pack", items: ['dungeoneers_pack'] },
          { id: 'explorer',   label: "Explorer's Pack",   items: ['explorers_pack'] },
        ]),
      ],
      grants: [
        { kind: 'feature', value: { id: 'favored_enemy', name: 'Favored Enemy', description: 'You have significant experience studying, tracking, hunting, and even talking to a certain type of enemy.', source: { kind: 'class', refId: 'ranger' }, level: 1, effects: [], actions: [], choices: [], passive: true } },
        { kind: 'feature', value: { id: 'natural_explorer', name: 'Natural Explorer', description: 'You are particularly familiar with one type of natural environment.', source: { kind: 'class', refId: 'ranger' }, level: 1, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    { level: 2, hpDie: 10, choices: [], grants: [{ kind: 'feature', value: { id: 'fighting_style_ranger', name: 'Fighting Style', description: 'You adopt a particular style of fighting as your specialty.', source: { kind: 'class', refId: 'ranger' }, level: 2, effects: [], actions: [], choices: [], passive: true } }, { kind: 'init_spellcasting', value: { ability: 'wis' } }, { kind: 'spell_slots', value: { level: 2 } }] },
    { level: 3, hpDie: 10, choices: [], grants: [{ kind: 'feature', value: { id: 'ranger_conclave', name: 'Ranger Conclave', description: 'You choose a type of ranger conclave.', source: { kind: 'class', refId: 'ranger' }, level: 3, effects: [], actions: [], choices: [], passive: true } }, { kind: 'feature', value: { id: 'primeval_awareness', name: 'Primeval Awareness', description: 'You can use your action and expend one ranger spell slot to focus your awareness.', source: { kind: 'class', refId: 'ranger' }, level: 3, effects: [], actions: [], choices: [], passive: false } }] },
    { level: 4, hpDie: 10, choices: [asiChoice('ranger_asi_4')], grants: [] },
    { level: 5, hpDie: 10, choices: [], grants: [{ kind: 'feature', value: { id: 'extra_attack_ranger', name: 'Extra Attack', description: 'You can attack twice when you take the Attack action.', source: { kind: 'class', refId: 'ranger' }, level: 5, effects: [{ type: 'stat_modifier', target: 'extra_attack', operation: 'set', value: 1, condition: null }], actions: [], choices: [], passive: true } }] },
    ...stubEntries([6,7], 10),
    { level: 8, hpDie: 10, choices: [asiChoice('ranger_asi_8')], grants: [] },
    ...stubEntries([9,10,11], 10),
    { level: 12, hpDie: 10, choices: [asiChoice('ranger_asi_12')], grants: [] },
    ...stubEntries([13,14,15], 10),
    { level: 16, hpDie: 10, choices: [asiChoice('ranger_asi_16')], grants: [] },
    ...stubEntries([17,18], 10),
    { level: 19, hpDie: 10, choices: [asiChoice('ranger_asi_19')], grants: [] },
    { level: 20, hpDie: 10, choices: [], grants: [{ kind: 'feature', value: { id: 'foe_slayer', name: 'Foe Slayer', description: 'You become an unparalleled hunter of your enemies. Once on each of your turns, you can add your Wisdom modifier to the attack roll or the damage roll of an attack you make against one of your favored enemies.', source: { kind: 'class', refId: 'ranger' }, level: 20, effects: [], actions: [], choices: [], passive: true } }] },
  ],
};

// ── Paladin ───────────────────────────────────────────────────────────────────

const paladinSkillChoice: ChoiceDefinition = {
  id: 'paladin_skills_lvl_1',
  prompt: 'Choose 2 skills from: Athletics, Insight, Intimidation, Medicine, Persuasion, Religion.',
  kind: 'skill', count: 2,
  pool: [
    { id: 'athletics',    label: 'Athletics',    value: 'athletics' },
    { id: 'insight',      label: 'Insight',      value: 'insight' },
    { id: 'intimidation', label: 'Intimidation', value: 'intimidation' },
    { id: 'medicine',     label: 'Medicine',     value: 'medicine' },
    { id: 'persuasion',   label: 'Persuasion',   value: 'persuasion' },
    { id: 'religion',     label: 'Religion',     value: 'religion' },
  ],
  grants: [], required: true, resolved: false,
};

export const paladinProgression: ClassProgression = {
  classId: 'paladin',
  srd: true,
  entries: [
    {
      level: 1, hpDie: 10, choices: [
        paladinSkillChoice,
        equipmentChoice('paladin_equip_a', 'Choose: (a) a martial weapon and a shield or (b) two martial weapons', [
          { id: 'weapon_shield', label: 'Martial weapon + Shield (Longsword + Shield)', items: ['longsword', 'shield'] },
          { id: 'two_martial',   label: 'Two martial weapons (Longsword + Battleaxe)',  items: ['longsword', 'battleaxe'] },
        ]),
        equipmentChoice('paladin_equip_b', 'Choose: (a) five javelins or (b) any simple melee weapon', [
          { id: 'javelins', label: 'Five Javelins',              items: ['javelin', 'javelin', 'javelin', 'javelin', 'javelin'] },
          { id: 'simple',   label: 'Any simple melee weapon (Mace)', items: ['mace'] },
        ]),
        equipmentChoice('paladin_equip_c', "Choose a pack: (a) priest's or (b) explorer's", [
          { id: 'priest',   label: "Priest's Pack",   items: ['priests_pack'] },
          { id: 'explorer', label: "Explorer's Pack", items: ['explorers_pack'] },
        ]),
      ],
      grants: [
        { kind: 'feature', value: { id: 'divine_sense', name: 'Divine Sense', description: 'The presence of strong evil registers on your senses like a noxious odor.', source: { kind: 'class', refId: 'paladin' }, level: 1, effects: [], actions: [], choices: [], passive: false } },
        { kind: 'feature', value: { id: 'lay_on_hands', name: 'Lay on Hands', description: 'Your blessed touch can heal wounds. You have a pool of healing power equal to 5× your paladin level.', source: { kind: 'class', refId: 'paladin' }, level: 1, effects: [], actions: [], choices: [], passive: false } },
        { kind: 'resource', value: { resourceId: 'lay_on_hands_pool', name: 'Lay on Hands HP', maximum: 5, recharge: 'long_rest' } },
      ],
    },
    { level: 2, hpDie: 10, choices: [], grants: [{ kind: 'feature', value: { id: 'fighting_style_paladin', name: 'Fighting Style', description: 'You adopt a particular style of fighting as your specialty.', source: { kind: 'class', refId: 'paladin' }, level: 2, effects: [], actions: [], choices: [], passive: true } }, { kind: 'feature', value: { id: 'divine_smite', name: 'Divine Smite', description: 'When you hit a creature with a melee weapon attack, you can expend one spell slot to deal extra radiant damage.', source: { kind: 'class', refId: 'paladin' }, level: 2, effects: [], actions: [], choices: [], passive: false } }, { kind: 'init_spellcasting', value: { ability: 'cha' } }, { kind: 'spell_slots', value: { level: 2 } }, { kind: 'resource_upgrade', value: { resourceId: 'lay_on_hands_pool', newMaximum: 10 } }] },
    { level: 3, hpDie: 10, choices: [], grants: [{ kind: 'feature', value: { id: 'divine_health', name: 'Divine Health', description: 'The divine magic flowing through you makes you immune to disease.', source: { kind: 'class', refId: 'paladin' }, level: 3, effects: [{ type: 'condition_immunity', target: 'disease', operation: 'immunity', value: null, condition: null }], actions: [], choices: [], passive: true } }, { kind: 'feature', value: { id: 'sacred_oath', name: 'Sacred Oath', description: 'You swear the oath that binds you as a paladin forever.', source: { kind: 'class', refId: 'paladin' }, level: 3, effects: [], actions: [], choices: [], passive: true } }, { kind: 'resource', value: { resourceId: 'channel_divinity_paladin', name: 'Channel Divinity', maximum: 1, recharge: 'short_rest' } }, { kind: 'resource_upgrade', value: { resourceId: 'lay_on_hands_pool', newMaximum: 15 } }] },
    { level: 4, hpDie: 10, choices: [asiChoice('paladin_asi_4')], grants: [{ kind: 'resource_upgrade', value: { resourceId: 'lay_on_hands_pool', newMaximum: 20 } }] },
    { level: 5, hpDie: 10, choices: [], grants: [{ kind: 'feature', value: { id: 'extra_attack_paladin', name: 'Extra Attack', description: 'You can attack twice when you take the Attack action.', source: { kind: 'class', refId: 'paladin' }, level: 5, effects: [{ type: 'stat_modifier', target: 'extra_attack', operation: 'set', value: 1, condition: null }], actions: [], choices: [], passive: true } }, { kind: 'resource_upgrade', value: { resourceId: 'lay_on_hands_pool', newMaximum: 25 } }] },
    { level: 6, hpDie: 10, choices: [], grants: [{ kind: 'feature', value: { id: 'aura_of_protection', name: 'Aura of Protection', description: 'You and friendly creatures within 10 feet of you add your Charisma modifier to saving throws.', source: { kind: 'class', refId: 'paladin' }, level: 6, effects: [], actions: [], choices: [], passive: true } }, { kind: 'resource_upgrade', value: { resourceId: 'lay_on_hands_pool', newMaximum: 30 } }] },
    { level: 7,  hpDie: 10, choices: [], grants: [{ kind: 'resource_upgrade', value: { resourceId: 'lay_on_hands_pool', newMaximum: 35 } }] },
    { level: 8,  hpDie: 10, choices: [asiChoice('paladin_asi_8')],  grants: [{ kind: 'resource_upgrade', value: { resourceId: 'lay_on_hands_pool', newMaximum: 40 } }] },
    { level: 9,  hpDie: 10, choices: [], grants: [{ kind: 'resource_upgrade', value: { resourceId: 'lay_on_hands_pool', newMaximum: 45 } }] },
    { level: 10, hpDie: 10, choices: [], grants: [{ kind: 'resource_upgrade', value: { resourceId: 'lay_on_hands_pool', newMaximum: 50 } }] },
    { level: 11, hpDie: 10, choices: [], grants: [{ kind: 'resource_upgrade', value: { resourceId: 'lay_on_hands_pool', newMaximum: 55 } }] },
    { level: 12, hpDie: 10, choices: [asiChoice('paladin_asi_12')], grants: [{ kind: 'resource_upgrade', value: { resourceId: 'lay_on_hands_pool', newMaximum: 60 } }] },
    { level: 13, hpDie: 10, choices: [], grants: [{ kind: 'resource_upgrade', value: { resourceId: 'lay_on_hands_pool', newMaximum: 65 } }] },
    { level: 14, hpDie: 10, choices: [], grants: [{ kind: 'resource_upgrade', value: { resourceId: 'lay_on_hands_pool', newMaximum: 70 } }] },
    { level: 15, hpDie: 10, choices: [], grants: [{ kind: 'resource_upgrade', value: { resourceId: 'lay_on_hands_pool', newMaximum: 75 } }] },
    { level: 16, hpDie: 10, choices: [asiChoice('paladin_asi_16')], grants: [{ kind: 'resource_upgrade', value: { resourceId: 'lay_on_hands_pool', newMaximum: 80 } }] },
    { level: 17, hpDie: 10, choices: [], grants: [{ kind: 'resource_upgrade', value: { resourceId: 'lay_on_hands_pool', newMaximum: 85 } }] },
    { level: 18, hpDie: 10, choices: [], grants: [{ kind: 'resource_upgrade', value: { resourceId: 'lay_on_hands_pool', newMaximum: 90 } }] },
    { level: 19, hpDie: 10, choices: [asiChoice('paladin_asi_19')], grants: [{ kind: 'resource_upgrade', value: { resourceId: 'lay_on_hands_pool', newMaximum: 95 } }] },
    { level: 20, hpDie: 10, choices: [], grants: [{ kind: 'feature', value: { id: 'sacred_oath_20', name: 'Sacred Oath Feature', description: 'You gain a feature from your Sacred Oath.', source: { kind: 'class', refId: 'paladin' }, level: 20, effects: [], actions: [], choices: [], passive: true } }] },
  ],
};

// ── Druid ─────────────────────────────────────────────────────────────────────

const druidSkillChoice: ChoiceDefinition = {
  id: 'druid_skills_lvl_1',
  prompt: 'Choose 2 skills from: Arcana, Animal Handling, Insight, Medicine, Nature, Perception, Religion, Survival.',
  kind: 'skill', count: 2,
  pool: [
    { id: 'arcana',          label: 'Arcana',          value: 'arcana' },
    { id: 'animal_handling', label: 'Animal Handling', value: 'animal_handling' },
    { id: 'insight',         label: 'Insight',         value: 'insight' },
    { id: 'medicine',        label: 'Medicine',        value: 'medicine' },
    { id: 'nature',          label: 'Nature',          value: 'nature' },
    { id: 'perception',      label: 'Perception',      value: 'perception' },
    { id: 'religion',        label: 'Religion',        value: 'religion' },
    { id: 'survival',        label: 'Survival',        value: 'survival' },
  ],
  grants: [], required: true, resolved: false,
};

export const druidProgression: ClassProgression = {
  classId: 'druid',
  srd: true,
  entries: [
    {
      level: 1, hpDie: 8, choices: [
        druidSkillChoice,
        equipmentChoice('druid_equip_a', 'Choose: (a) a wooden shield or (b) any simple weapon', [
          { id: 'shield', label: 'Wooden Shield',          items: ['shield'] },
          { id: 'simple', label: 'Any simple weapon (Club)', items: ['club'] },
        ]),
        equipmentChoice('druid_equip_b', 'Choose: (a) a scimitar or (b) any simple melee weapon', [
          { id: 'scimitar', label: 'Scimitar',                   items: ['scimitar'] },
          { id: 'simple',   label: 'Any simple melee weapon (Mace)', items: ['mace'] },
        ]),
      ],
      grants: [
        { kind: 'feature', value: { id: 'druid_spellcasting', name: 'Spellcasting', description: 'Drawing on the divine essence of nature itself, you can cast druid spells.', source: { kind: 'class', refId: 'druid' }, level: 1, effects: [], actions: [], choices: [], passive: true } },
        { kind: 'feature', value: { id: 'druidic', name: 'Druidic', description: 'You know Druidic, the secret language of druids.', source: { kind: 'class', refId: 'druid' }, level: 1, effects: [], actions: [], choices: [], passive: true } },
        { kind: 'init_spellcasting', value: { ability: 'wis' } },
        { kind: 'spell_slots', value: { level: 1 } },
      ],
    },
    { level: 2, hpDie: 8, choices: [], grants: [
      { kind: 'feature', value: { id: 'wild_shape_wolf', name: 'Wild Shape: Wolf', description: 'Magically assume the shape of a wolf. You retain your own Intelligence, Wisdom, and Charisma; everything else (AC, HP, speed, senses, attacks) becomes the wolf\'s while transformed.', source: { kind: 'class', refId: 'druid' }, level: 2, effects: [], actions: [], choices: [], passive: false, tags: ['transformation'], activation: { actionType: 'action', resourceCost: { resourceId: 'wild_shape_pool', quantity: 1 }, range: 'self', target: 'self', requiresSave: null }, abilityEffects: [{ type: 'transform', formId: 'wolf' }] } },
      { kind: 'feature', value: { id: 'wild_shape_giant_spider', name: 'Wild Shape: Giant Spider', description: 'Magically assume the shape of a giant spider. You retain your own Intelligence, Wisdom, and Charisma; everything else becomes the spider\'s while transformed.', source: { kind: 'class', refId: 'druid' }, level: 2, effects: [], actions: [], choices: [], passive: false, tags: ['transformation'], activation: { actionType: 'action', resourceCost: { resourceId: 'wild_shape_pool', quantity: 1 }, range: 'self', target: 'self', requiresSave: null }, abilityEffects: [{ type: 'transform', formId: 'giant_spider' }] } },
      { kind: 'feature', value: { id: 'wild_shape_brown_bear', name: 'Wild Shape: Brown Bear', description: 'Magically assume the shape of a brown bear. You retain your own Intelligence, Wisdom, and Charisma; everything else becomes the bear\'s while transformed.', source: { kind: 'class', refId: 'druid' }, level: 2, effects: [], actions: [], choices: [], passive: false, tags: ['transformation'], activation: { actionType: 'action', resourceCost: { resourceId: 'wild_shape_pool', quantity: 1 }, range: 'self', target: 'self', requiresSave: null }, abilityEffects: [{ type: 'transform', formId: 'brown_bear' }] } },
      { kind: 'feature', value: { id: 'druid_circle', name: 'Druid Circle', description: 'You choose to identify with a circle of druids.', source: { kind: 'class', refId: 'druid' }, level: 2, effects: [], actions: [], choices: [], passive: true } },
      { kind: 'resource', value: { resourceId: 'wild_shape_pool', name: 'Wild Shape', maximum: 2, recharge: 'short_rest' } },
    ] },
    { level: 3, hpDie: 8, choices: [], grants: [] },
    { level: 4, hpDie: 8, choices: [asiChoice('druid_asi_4')], grants: [] },
    ...stubEntries([5,6,7], 8),
    { level: 8, hpDie: 8, choices: [asiChoice('druid_asi_8')], grants: [] },
    ...stubEntries([9,10,11], 8),
    { level: 12, hpDie: 8, choices: [asiChoice('druid_asi_12')], grants: [] },
    ...stubEntries([13,14,15], 8),
    { level: 16, hpDie: 8, choices: [asiChoice('druid_asi_16')], grants: [] },
    ...stubEntries([17,18], 8),
    { level: 19, hpDie: 8, choices: [asiChoice('druid_asi_19')], grants: [] },
    { level: 20, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'beast_spells', name: 'Beast Spells', description: 'You can cast many of your druid spells in any shape you assume using Wild Shape.', source: { kind: 'class', refId: 'druid' }, level: 20, effects: [], actions: [], choices: [], passive: true } }, { kind: 'feature', value: { id: 'archdruid', name: 'Archdruid', description: 'You can use your Wild Shape an unlimited number of times.', source: { kind: 'class', refId: 'druid' }, level: 20, effects: [], actions: [], choices: [], passive: true } }] },
  ],
};

// ── Bard ──────────────────────────────────────────────────────────────────────

export const bardProgression: ClassProgression = {
  classId: 'bard',
  srd: true,
  entries: [
    {
      level: 1, hpDie: 8,
      choices: [
        {
          id: 'bard_skills_lvl_1',
          prompt: 'Choose any 3 skills.',
          kind: 'skill', count: 3, pool: 'all',
          grants: [], required: true, resolved: false,
        },
        equipmentChoice('bard_equip_a', 'Choose a weapon: (a) a rapier, (b) a longsword, or (c) any simple weapon', [
          { id: 'rapier',    label: 'Rapier',                  items: ['rapier'] },
          { id: 'longsword', label: 'Longsword',               items: ['longsword'] },
          { id: 'simple',    label: 'Any simple weapon (Dagger)', items: ['dagger'] },
        ]),
        equipmentChoice('bard_equip_b', "Choose a pack: (a) diplomat's or (b) entertainer's", [
          { id: 'diplomat',    label: "Diplomat's Pack",    items: ['diplomats_pack'] },
          { id: 'entertainer', label: "Entertainer's Pack", items: ['entertainers_pack'] },
        ]),
        equipmentChoice('bard_equip_c', 'Choose an instrument: (a) a lute or (b) any musical instrument', [
          { id: 'lute',  label: 'Lute',                      items: ['lute'] },
          { id: 'other', label: 'Any musical instrument (Lute)', items: ['lute'] },
        ]),
      ],
      grants: [
        { kind: 'feature', value: { id: 'bard_spellcasting', name: 'Spellcasting', description: 'You have learned to untangle and reshape the fabric of reality in harmony with your wishes and music.', source: { kind: 'class', refId: 'bard' }, level: 1, effects: [], actions: [], choices: [], passive: true } },
        { kind: 'feature', value: { id: 'bardic_inspiration', name: 'Bardic Inspiration', description: 'You can inspire others through stirring words or music. As a bonus action, grant a creature you can see within 60 feet a Bardic Inspiration die (d6).', source: { kind: 'class', refId: 'bard' }, level: 1, effects: [], actions: [], choices: [], passive: false, activation: { actionType: 'bonus_action', resourceCost: { resourceId: 'bardic_inspiration_pool', quantity: 1 }, range: '60 feet', target: 'single', requiresSave: null } } },
        { kind: 'resource', value: { resourceId: 'bardic_inspiration_pool', name: 'Bardic Inspiration', maximum: 3, recharge: 'long_rest' } },
        { kind: 'init_spellcasting', value: { ability: 'cha' } },
        { kind: 'spell_slots', value: { level: 1 } },
      ],
    },
    { level: 2, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'jack_of_all_trades', name: 'Jack of All Trades', description: 'You can add half your proficiency bonus to any ability check that doesn\'t use your proficiency bonus.', source: { kind: 'class', refId: 'bard' }, level: 2, effects: [], actions: [], choices: [], passive: true } }, { kind: 'feature', value: { id: 'song_of_rest', name: 'Song of Rest', description: 'You can use soothing music or oration to help revitalize your wounded allies during a short rest.', source: { kind: 'class', refId: 'bard' }, level: 2, effects: [], actions: [], choices: [], passive: true } }] },
    { level: 3, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'bard_college', name: 'Bard College', description: 'You delve into the advanced techniques of a bard college of your choice.', source: { kind: 'class', refId: 'bard' }, level: 3, effects: [], actions: [], choices: [], passive: true } }, { kind: 'feature', value: { id: 'expertise_bard', name: 'Expertise', description: 'Choose two of your skill proficiencies to double your proficiency bonus.', source: { kind: 'class', refId: 'bard' }, level: 3, effects: [], actions: [], choices: [], passive: true } }] },
    { level: 4, hpDie: 8, choices: [asiChoice('bard_asi_4')], grants: [] },
    { level: 5, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'font_of_inspiration', name: 'Font of Inspiration', description: 'You regain all of your expended uses of Bardic Inspiration when you finish a short or long rest.', source: { kind: 'class', refId: 'bard' }, level: 5, effects: [], actions: [], choices: [], passive: true } }] },
    { level: 6, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'countercharm', name: 'Countercharm', description: 'You gain the ability to use musical notes or words of power to disrupt mind-influencing effects.', source: { kind: 'class', refId: 'bard' }, level: 6, effects: [], actions: [], choices: [], passive: false } }] },
    ...stubEntries([7], 8),
    { level: 8, hpDie: 8, choices: [asiChoice('bard_asi_8')], grants: [] },
    ...stubEntries([9,10,11], 8),
    { level: 12, hpDie: 8, choices: [asiChoice('bard_asi_12')], grants: [] },
    ...stubEntries([13,14,15], 8),
    { level: 16, hpDie: 8, choices: [asiChoice('bard_asi_16')], grants: [] },
    ...stubEntries([17,18], 8),
    { level: 19, hpDie: 8, choices: [asiChoice('bard_asi_19')], grants: [] },
    { level: 20, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'superior_inspiration', name: 'Superior Inspiration', description: 'When you roll initiative and have no uses of Bardic Inspiration left, you regain one use.', source: { kind: 'class', refId: 'bard' }, level: 20, effects: [], actions: [], choices: [], passive: true } }] },
  ],
};

// ── Monk ──────────────────────────────────────────────────────────────────────

const monkSkillChoice: ChoiceDefinition = {
  id: 'monk_skills_lvl_1',
  prompt: 'Choose 2 skills from: Acrobatics, Athletics, History, Insight, Religion, Stealth.',
  kind: 'skill', count: 2,
  pool: [
    { id: 'acrobatics', label: 'Acrobatics', value: 'acrobatics' },
    { id: 'athletics',  label: 'Athletics',  value: 'athletics' },
    { id: 'history',    label: 'History',    value: 'history' },
    { id: 'insight',    label: 'Insight',    value: 'insight' },
    { id: 'religion',   label: 'Religion',   value: 'religion' },
    { id: 'stealth',    label: 'Stealth',    value: 'stealth' },
  ],
  grants: [], required: true, resolved: false,
};

export const monkProgression: ClassProgression = {
  classId: 'monk',
  srd: true,
  entries: [
    {
      level: 1, hpDie: 8, choices: [
        monkSkillChoice,
        equipmentChoice('monk_equip_a', 'Choose: (a) a shortsword or (b) any simple weapon', [
          { id: 'shortsword', label: 'Shortsword',                 items: ['shortsword'] },
          { id: 'simple',     label: 'Any simple weapon (Quarterstaff)', items: ['quarterstaff'] },
        ]),
        equipmentChoice('monk_equip_b', "Choose a pack: (a) dungeoneer's or (b) explorer's", [
          { id: 'dungeoneer', label: "Dungeoneer's Pack", items: ['dungeoneers_pack'] },
          { id: 'explorer',   label: "Explorer's Pack",   items: ['explorers_pack'] },
        ]),
      ],
      grants: [
        { kind: 'feature', value: { id: 'unarmored_defense_monk', name: 'Unarmored Defense', description: 'While you are wearing no armor and not wielding a shield, your AC equals 10 + your Dexterity modifier + your Wisdom modifier.', source: { kind: 'class', refId: 'monk' }, level: 1, effects: [{ type: 'base_ac_formula', target: 'ac', operation: 'set', value: 10, condition: null, formulaAbilities: ['dex', 'wis'] }], actions: [], choices: [], passive: true } },
        { kind: 'feature', value: { id: 'martial_arts', name: 'Martial Arts', description: 'Your practice of martial arts gives you mastery of combat styles using unarmed strikes and monk weapons.', source: { kind: 'class', refId: 'monk' }, level: 1, effects: [], actions: [], choices: [], passive: true } },
      ],
    },
    { level: 2, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'ki', name: 'Ki', description: 'Your training allows you to harness the mystic energy of ki.', source: { kind: 'class', refId: 'monk' }, level: 2, effects: [], actions: [], choices: [], passive: true } }, { kind: 'resource', value: { resourceId: 'ki_pool', name: 'Ki Points', maximum: 2, recharge: 'short_rest' } }, { kind: 'feature', value: { id: 'unarmored_movement', name: 'Unarmored Movement', description: 'Your speed increases by 10 feet while you are not wearing armor or wielding a shield.', source: { kind: 'class', refId: 'monk' }, level: 2, effects: [{ type: 'stat_modifier', target: 'speed', operation: 'add', value: 10, condition: null }], actions: [], choices: [], passive: true } }] },
    { level: 3, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'monastic_tradition', name: 'Monastic Tradition', description: 'You commit yourself to a monastic tradition.', source: { kind: 'class', refId: 'monk' }, level: 3, effects: [], actions: [], choices: [], passive: true } }, { kind: 'feature', value: { id: 'deflect_missiles', name: 'Deflect Missiles', description: 'You can use your reaction to deflect or catch the missile when you are hit by a ranged weapon attack.', source: { kind: 'class', refId: 'monk' }, level: 3, effects: [], actions: [], choices: [], passive: false } }, { kind: 'resource_upgrade', value: { resourceId: 'ki_pool', newMaximum: 3 } }] },
    { level: 4, hpDie: 8, choices: [asiChoice('monk_asi_4')], grants: [{ kind: 'feature', value: { id: 'slow_fall', name: 'Slow Fall', description: 'You can use your reaction when you fall to reduce any falling damage you take.', source: { kind: 'class', refId: 'monk' }, level: 4, effects: [], actions: [], choices: [], passive: false } }, { kind: 'resource_upgrade', value: { resourceId: 'ki_pool', newMaximum: 4 } }] },
    { level: 5, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'extra_attack_monk', name: 'Extra Attack', description: 'You can attack twice when you take the Attack action.', source: { kind: 'class', refId: 'monk' }, level: 5, effects: [{ type: 'stat_modifier', target: 'extra_attack', operation: 'set', value: 1, condition: null }], actions: [], choices: [], passive: true } }, { kind: 'feature', value: { id: 'stunning_strike', name: 'Stunning Strike', description: 'When you hit another creature with a melee weapon attack, you can spend 1 ki point to attempt a stunning strike.', source: { kind: 'class', refId: 'monk' }, level: 5, effects: [], actions: [], choices: [], passive: false } }, { kind: 'resource_upgrade', value: { resourceId: 'ki_pool', newMaximum: 5 } }] },
    ...Array.from({ length: 14 }, (_, i) => ({ level: 6 + i, hpDie: 8 as const, choices: (i === 2 || i === 6 || i === 10 || i === 13) ? [asiChoice(`monk_asi_${6 + i}`)] : [], grants: [{ kind: 'resource_upgrade' as const, value: { resourceId: 'ki_pool', newMaximum: 6 + i } }] })),
  ],
};

// ── Sorcerer ──────────────────────────────────────────────────────────────────

const sorcererSkillChoice: ChoiceDefinition = {
  id: 'sorcerer_skills_lvl_1',
  prompt: 'Choose 2 skills from: Arcana, Deception, Insight, Intimidation, Persuasion, Religion.',
  kind: 'skill', count: 2,
  pool: [
    { id: 'arcana',       label: 'Arcana',       value: 'arcana' },
    { id: 'deception',    label: 'Deception',    value: 'deception' },
    { id: 'insight',      label: 'Insight',      value: 'insight' },
    { id: 'intimidation', label: 'Intimidation', value: 'intimidation' },
    { id: 'persuasion',   label: 'Persuasion',   value: 'persuasion' },
    { id: 'religion',     label: 'Religion',     value: 'religion' },
  ],
  grants: [], required: true, resolved: false,
};

export const sorcererProgression: ClassProgression = {
  classId: 'sorcerer',
  srd: true,
  entries: [
    {
      level: 1, hpDie: 6, choices: [
        sorcererSkillChoice,
        equipmentChoice('sorcerer_equip_a', 'Choose: (a) a light crossbow and 20 bolts or (b) any simple weapon', [
          { id: 'crossbow', label: 'Light Crossbow & 20 bolts', items: ['light_crossbow', 'bolts_20'] },
          { id: 'simple',   label: 'Any simple weapon (Dagger)', items: ['dagger'] },
        ]),
        equipmentChoice('sorcerer_equip_b', 'Choose a focus: (a) a component pouch or (b) an arcane focus', [
          { id: 'pouch', label: 'Component Pouch', items: ['component_pouch'] },
          { id: 'focus', label: 'Arcane Focus',    items: ['arcane_focus_orb'] },
        ]),
        equipmentChoice('sorcerer_equip_c', "Choose a pack: (a) dungeoneer's or (b) explorer's", [
          { id: 'dungeoneer', label: "Dungeoneer's Pack", items: ['dungeoneers_pack'] },
          { id: 'explorer',   label: "Explorer's Pack",   items: ['explorers_pack'] },
        ]),
      ],
      grants: [
        { kind: 'feature', value: { id: 'sorcerer_spellcasting', name: 'Spellcasting', description: 'An event in your past, or in the life of a parent or ancestor, left an indelible mark on you.', source: { kind: 'class', refId: 'sorcerer' }, level: 1, effects: [], actions: [], choices: [], passive: true } },
        { kind: 'feature', value: { id: 'sorcerous_origin', name: 'Sorcerous Origin', description: 'Choose a sorcerous origin, which describes the source of your innate magical power.', source: { kind: 'class', refId: 'sorcerer' }, level: 1, effects: [], actions: [], choices: [], passive: true } },
        { kind: 'init_spellcasting', value: { ability: 'cha' } },
        { kind: 'spell_slots', value: { level: 1 } },
      ],
    },
    { level: 2, hpDie: 6, choices: [], grants: [{ kind: 'feature', value: { id: 'font_of_magic', name: 'Font of Magic', description: 'You tap into a deep wellspring of magic within yourself. You have sorcery points.', source: { kind: 'class', refId: 'sorcerer' }, level: 2, effects: [], actions: [], choices: [], passive: true } }, { kind: 'resource', value: { resourceId: 'sorcery_points', name: 'Sorcery Points', maximum: 2, recharge: 'long_rest' } }] },
    { level: 3, hpDie: 6, choices: [], grants: [{ kind: 'feature', value: { id: 'metamagic', name: 'Metamagic', description: 'You gain the ability to twist your spells to suit your needs.', source: { kind: 'class', refId: 'sorcerer' }, level: 3, effects: [], actions: [], choices: [], passive: true } }, { kind: 'resource_upgrade', value: { resourceId: 'sorcery_points', newMaximum: 3 } }] },
    { level: 4, hpDie: 6, choices: [asiChoice('sorcerer_asi_4')], grants: [{ kind: 'resource_upgrade', value: { resourceId: 'sorcery_points', newMaximum: 4 } }] },
    ...Array.from({ length: 15 }, (_, i) => ({ level: 5 + i, hpDie: 6 as const, choices: (i === 3 || i === 7 || i === 11 || i === 14) ? [asiChoice(`sorcerer_asi_${8 + i}`)] : [], grants: [{ kind: 'resource_upgrade' as const, value: { resourceId: 'sorcery_points', newMaximum: 5 + i } }] })),
  ],
};

// ── Warlock ───────────────────────────────────────────────────────────────────

const warlockSkillChoice: ChoiceDefinition = {
  id: 'warlock_skills_lvl_1',
  prompt: 'Choose 2 skills from: Arcana, Deception, History, Intimidation, Investigation, Nature, Religion.',
  kind: 'skill', count: 2,
  pool: [
    { id: 'arcana',        label: 'Arcana',        value: 'arcana' },
    { id: 'deception',     label: 'Deception',     value: 'deception' },
    { id: 'history',       label: 'History',       value: 'history' },
    { id: 'intimidation',  label: 'Intimidation',  value: 'intimidation' },
    { id: 'investigation', label: 'Investigation', value: 'investigation' },
    { id: 'nature',        label: 'Nature',        value: 'nature' },
    { id: 'religion',      label: 'Religion',      value: 'religion' },
  ],
  grants: [], required: true, resolved: false,
};

export const warlockProgression: ClassProgression = {
  classId: 'warlock',
  srd: true,
  entries: [
    {
      level: 1, hpDie: 8, choices: [
        warlockSkillChoice,
        equipmentChoice('warlock_equip_a', 'Choose: (a) a light crossbow and 20 bolts or (b) any simple weapon', [
          { id: 'crossbow', label: 'Light Crossbow & 20 bolts', items: ['light_crossbow', 'bolts_20'] },
          { id: 'simple',   label: 'Any simple weapon (Dagger)', items: ['dagger'] },
        ]),
        equipmentChoice('warlock_equip_b', 'Choose a focus: (a) a component pouch or (b) an arcane focus', [
          { id: 'pouch', label: 'Component Pouch', items: ['component_pouch'] },
          { id: 'focus', label: 'Arcane Focus',    items: ['arcane_focus_orb'] },
        ]),
        equipmentChoice('warlock_equip_c', "Choose a pack: (a) scholar's or (b) dungeoneer's", [
          { id: 'scholar',    label: "Scholar's Pack",    items: ['scholars_pack'] },
          { id: 'dungeoneer', label: "Dungeoneer's Pack", items: ['dungeoneers_pack'] },
        ]),
      ],
      grants: [
        { kind: 'feature', value: { id: 'otherworldly_patron', name: 'Otherworldly Patron', description: 'You have struck a bargain with an otherworldly being of your choice.', source: { kind: 'class', refId: 'warlock' }, level: 1, effects: [], actions: [], choices: [], passive: true } },
        { kind: 'feature', value: { id: 'warlock_spellcasting', name: 'Pact Magic', description: 'Your arcane research and the magic bestowed on you by your patron have given you facility with spells.', source: { kind: 'class', refId: 'warlock' }, level: 1, effects: [], actions: [], choices: [], passive: true } },
        { kind: 'init_spellcasting', value: { ability: 'cha' } },
        { kind: 'spell_slots', value: { level: 1 } },
      ],
    },
    { level: 2, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'eldritch_invocations', name: 'Eldritch Invocations', description: 'In your study of occult lore, you have unearthed eldritch invocations, fragments of forbidden knowledge.', source: { kind: 'class', refId: 'warlock' }, level: 2, effects: [], actions: [], choices: [], passive: true } }] },
    { level: 3, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'pact_boon', name: 'Pact Boon', description: 'Your otherworldly patron bestows a gift upon you for your loyal service.', source: { kind: 'class', refId: 'warlock' }, level: 3, effects: [], actions: [], choices: [], passive: true } }] },
    { level: 4, hpDie: 8, choices: [asiChoice('warlock_asi_4')], grants: [] },
    ...stubEntries([5,6,7], 8),
    { level: 8, hpDie: 8, choices: [asiChoice('warlock_asi_8')], grants: [] },
    ...stubEntries([9,10,11], 8),
    { level: 12, hpDie: 8, choices: [asiChoice('warlock_asi_12')], grants: [] },
    ...stubEntries([13,14,15], 8),
    { level: 16, hpDie: 8, choices: [asiChoice('warlock_asi_16')], grants: [] },
    ...stubEntries([17,18], 8),
    { level: 19, hpDie: 8, choices: [asiChoice('warlock_asi_19')], grants: [] },
    { level: 20, hpDie: 8, choices: [], grants: [{ kind: 'feature', value: { id: 'eldritch_master', name: 'Eldritch Master', description: 'You can entreat your patron to regain all your expended spell slots. You can do so again after you finish a long rest.', source: { kind: 'class', refId: 'warlock' }, level: 20, effects: [], actions: [], choices: [], passive: false } }] },
  ],
};

// ── Exports ───────────────────────────────────────────────────────────────────

export const ALL_CLASS_PROGRESSIONS: ClassProgression[] = [
  fighterProgression,
  rogueProgression,
  wizardProgression,
  clericProgression,
  barbarianProgression,
  rangerProgression,
  paladinProgression,
  druidProgression,
  bardProgression,
  monkProgression,
  sorcererProgression,
  warlockProgression,
];

/** Lookup map: classId → ClassProgression. Use this instead of hardcoding class names. */
export const ALL_PROGRESSIONS: Record<string, ClassProgression> = Object.fromEntries(
  ALL_CLASS_PROGRESSIONS.map(p => [p.classId, p])
);

export const ALL_CHAR_CLASSES = [
  { id: 'fighter',   name: 'Fighter',   hitDie: 10, features: [] },
  { id: 'rogue',     name: 'Rogue',     hitDie: 8,  features: [] },
  { id: 'wizard',    name: 'Wizard',    hitDie: 6,  features: [] },
  { id: 'cleric',    name: 'Cleric',    hitDie: 8,  features: [] },
  { id: 'barbarian', name: 'Barbarian', hitDie: 12, features: [] },
  { id: 'ranger',    name: 'Ranger',    hitDie: 10, features: [] },
  { id: 'paladin',   name: 'Paladin',   hitDie: 10, features: [] },
  { id: 'druid',     name: 'Druid',     hitDie: 8,  features: [] },
  { id: 'bard',      name: 'Bard',      hitDie: 8,  features: [] },
  { id: 'monk',      name: 'Monk',      hitDie: 8,  features: [] },
  { id: 'sorcerer',  name: 'Sorcerer',  hitDie: 6,  features: [] },
  { id: 'warlock',   name: 'Warlock',   hitDie: 8,  features: [] },
] as import('../../engine/types').CharClass[];
