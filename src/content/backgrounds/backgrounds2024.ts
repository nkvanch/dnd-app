// ============================================================================
// FILE: src/content/backgrounds/backgrounds2024.ts
// The four backgrounds of the System Reference Document 5.2.1 (2024 rules / 5.5e): Acolyte, Criminal,
// Sage, Soldier. SRD 5.2.1 is Creative Commons Attribution 4.0; "This work includes material from the
// System Reference Document 5.2.1 by Wizards of the Coast LLC". Tagged rulesetId 'dnd5e-2024'; `srd`
// stays false because that flag here means SRD 5.1 (what the public build is filtered by).
//
// Every 2024 background grants: an ability-score bonus over three named abilities (+2/+1 or +1/+1/+1,
// Background.flexibleAsi), an ORIGIN FEAT (Background.originFeat, granted for real by
// engine/originFeat.ts), two skill proficiencies, one tool proficiency, and an equipment choice.
// Equipment (the A package or 50 GP) is described in the text; the app does not add it automatically.
// ============================================================================
import { Background, Effect, Feature, RulesetId, ChoiceOption, BACKGROUND_CHOICE_PREFIX } from '../../engine/types';
import { ALL_TOOLS } from '../tools';

const RULESET = 'dnd5e-2024' as RulesetId;

const skill = (name: string): Effect => ({ type: 'grant_proficiency', target: `skill:${name}`, operation: 'add', value: null, condition: null });
const tool = (id: string): Effect => ({ type: 'grant_proficiency', target: `tool:${id}`, operation: 'add', value: null, condition: null });

function proficiencies(id: string, skills: [string, string], toolId: string | null, description: string): Feature {
  return {
    id: `${id}_proficiencies`, name: 'Proficiencies', description,
    source: { kind: 'background', refId: id }, level: null, actions: [], choices: [], passive: true,
    effects: [...skills.map(skill), ...(toolId ? [tool(toolId)] : [])],
  };
}

function feat(id: string, featName: string): Feature {
  return {
    id: `${id}_origin_feat_note`, name: `Origin Feat: ${featName}`,
    description: `This background grants the ${featName} Origin feat. It is added to your character when you choose the background (see Features).`,
    source: { kind: 'background', refId: id }, level: null, effects: [], actions: [], choices: [], passive: true,
  };
}

const gamingSets = (): ChoiceOption[] => ALL_TOOLS.filter(t => t.category === 'gaming_set').map(t => ({ id: t.id, label: t.name, value: t.id }));


export const bgAcolyte2024: Background = {
  id: 'acolyte_2024', name: 'Acolyte', rulesetId: RULESET, srd: false,
  originFeat: 'magic_initiate_cleric_2024',
  toolProficiencies: ["Calligrapher's Supplies"],
  flexibleAsi: { prompt: 'Choose Intelligence, Wisdom, or Charisma: increase one by 2 and a different one by 1, or increase all three by 1 each.', mode: { kind: 'two_one_or_three_one', restrictTo: ['int', 'wis', 'cha'] } },
  features: [
    proficiencies('acolyte_2024', ['insight', 'religion'], 'calligraphers_supplies',
      'Skill Proficiencies: Insight and Religion. Tool Proficiency: Calligrapher\'s Supplies. Equipment: choose A or B. (A) Calligrapher\'s Supplies, Book (prayers), Holy Symbol, Parchment (10 sheets), Robe, 8 GP; or (B) 50 GP.'),
    feat('acolyte_2024', 'Magic Initiate (Cleric)'),
  ],
};

export const bgCriminal2024: Background = {
  id: 'criminal_2024', name: 'Criminal', rulesetId: RULESET, srd: false,
  originFeat: 'alert_2024',
  toolProficiencies: ["Thieves' Tools"],
  flexibleAsi: { prompt: 'Choose Dexterity, Constitution, or Intelligence: increase one by 2 and a different one by 1, or increase all three by 1 each.', mode: { kind: 'two_one_or_three_one', restrictTo: ['dex', 'con', 'int'] } },
  features: [
    proficiencies('criminal_2024', ['sleight_of_hand', 'stealth'], 'thieves_tools',
      'Skill Proficiencies: Sleight of Hand and Stealth. Tool Proficiency: Thieves\' Tools. Equipment: choose A or B. (A) 2 Daggers, Thieves\' Tools, Crowbar, 2 Pouches, Traveler\'s Clothes, 16 GP; or (B) 50 GP.'),
    feat('criminal_2024', 'Alert'),
  ],
};

export const bgSage2024: Background = {
  id: 'sage_2024', name: 'Sage', rulesetId: RULESET, srd: false,
  originFeat: 'magic_initiate_wizard_2024',
  toolProficiencies: ["Calligrapher's Supplies"],
  flexibleAsi: { prompt: 'Choose Constitution, Intelligence, or Wisdom: increase one by 2 and a different one by 1, or increase all three by 1 each.', mode: { kind: 'two_one_or_three_one', restrictTo: ['con', 'int', 'wis'] } },
  features: [
    proficiencies('sage_2024', ['arcana', 'history'], 'calligraphers_supplies',
      'Skill Proficiencies: Arcana and History. Tool Proficiency: Calligrapher\'s Supplies. Equipment: choose A or B. (A) Quarterstaff, Calligrapher\'s Supplies, Book (history), Parchment (8 sheets), Robe, 8 GP; or (B) 50 GP.'),
    feat('sage_2024', 'Magic Initiate (Wizard)'),
  ],
};

export const bgSoldier2024: Background = {
  id: 'soldier_2024', name: 'Soldier', rulesetId: RULESET, srd: false,
  originFeat: 'savage_attacker_2024',
  toolProficiencies: ['One gaming set'],
  flexibleAsi: { prompt: 'Choose Strength, Dexterity, or Constitution: increase one by 2 and a different one by 1, or increase all three by 1 each.', mode: { kind: 'two_one_or_three_one', restrictTo: ['str', 'dex', 'con'] } },
  pendingChoices: [{
    id: `${BACKGROUND_CHOICE_PREFIX}soldier_2024_gaming_set`, prompt: 'Choose one kind of Gaming Set.',
    kind: 'tool', count: 1, pool: gamingSets(), grants: [], required: true, resolved: false,
  }],
  features: [
    proficiencies('soldier_2024', ['athletics', 'intimidation'], null,
      'Skill Proficiencies: Athletics and Intimidation. Tool Proficiency: one kind of Gaming Set (chosen below). Equipment: choose A or B. (A) Spear, Shortbow, 20 Arrows, Gaming Set (same as above), Healer\'s Kit, Quiver, Traveler\'s Clothes, 14 GP; or (B) 50 GP.'),
    feat('soldier_2024', 'Savage Attacker'),
  ],
};

export const BACKGROUNDS_2024: Background[] = [bgAcolyte2024, bgCriminal2024, bgSage2024, bgSoldier2024];
