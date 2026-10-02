// ============================================================================
// FILE: src/content/rulePresets.ts
// Pre-written rule sets, one per official ruleset the app can build characters for. They are real
// CustomRuleProfile records (source.kind 'preset') merged into the rule-profile store on load, so
// every place that already offers a rule profile — Character Basics, the create-campaign wizard,
// the sheet's ruleset picker — offers them with no extra wiring, and the existing overlay logic
// (resolveEffectiveCampaignRules) applies them.
//
// A preset only sets the rules the app really supports (see HOUSE_RULES); it never pretends the
// engine does something it does not. The 2014 and 2024 presets differ where the books genuinely
// differ AND the app has a switch for it:
//   - 2024 starts every character with an Origin feat from the background  -> Feat at 1st level
//   - 2024 long rest restores ALL spent Hit Dice (2014: half your level)    -> all Hit Dice
//   - 2024 drinking a potion is a Bonus Action (2014: an action)            -> table reminder
// Everything else (HP on level-up, XP, feats, multiclassing, ability cap) is the shared 5e baseline.
// Only rulesets that have a preset here are offered; the registry's other entries (4e, 3.5, PF, OSE)
// exist for filtering but the engine cannot build their characters yet, so they get none.
// ============================================================================
import { CustomRuleProfile, RulesetId } from '../engine/types';
import { RULESETS } from './rulesets';

export const PRESET_PROFILE_PREFIX = 'preset-';

export type RulePreset = {
  rulesetId: RulesetId;
  name:      string;
  summary:   string;
  rules:     CustomRuleProfile['rules'];
  /** Human-readable lines for what this preset sets, shown under the chip. */
  highlights: string[];
};

const BASE_5E: CustomRuleProfile['rules'] = {
  maxAbilityScore: 20, maxLevel: 20, useXP: true, hpMode: 'fixed', allowMulticlass: true,
  abilityGenerationMode: 'standard',
};

export const RULE_PRESETS: RulePreset[] = [
  {
    rulesetId: 'dnd5e-2014' as RulesetId,
    name: 'D&D 5e (2014) — as written',
    summary: 'The 2014 Player\'s Handbook defaults.',
    highlights: ['Fixed HP on level-up', 'XP advancement', 'Multiclassing and feats allowed', 'Ability scores cap at 20', 'No feat at 1st level', 'Long rest restores half your Hit Dice'],
    rules: {
      ...BASE_5E,
      customRules: { featsEnabled: true, featAtCreation: false, fullHitDiceOnLongRest: false, reminderPotionsBonusAction: false },
    },
  },
  {
    rulesetId: 'dnd5e-2024' as RulesetId,
    name: 'D&D 5.5e (2024) — as written',
    summary: 'The 2024 Player\'s Handbook defaults.',
    highlights: ['Origin feat at 1st level', 'Long rest restores ALL spent Hit Dice', 'Potions are a Bonus Action (reminder)', 'Fixed HP on level-up, XP, multiclassing, ability cap 20'],
    rules: {
      ...BASE_5E,
      customRules: { featsEnabled: true, featAtCreation: true, fullHitDiceOnLongRest: true, reminderPotionsBonusAction: true },
    },
  },
];

export const presetProfileId = (rulesetId: RulesetId) => `${PRESET_PROFILE_PREFIX}${rulesetId}`;
export const isPresetProfileId = (id: string | undefined): boolean => !!id && id.startsWith(PRESET_PROFILE_PREFIX);

/** The presets as profiles, with stable ids (so a character that uses one keeps resolving it). */
export function presetProfiles(): CustomRuleProfile[] {
  return RULE_PRESETS.filter(p => RULESETS[p.rulesetId]).map(p => ({
    id: presetProfileId(p.rulesetId),
    name: p.name,
    gameId: RULESETS[p.rulesetId].gameId,
    baseRulesetId: p.rulesetId,
    rules: p.rules,
    source: { kind: 'preset' as const, label: p.summary },
    createdAt: 0,
    updatedAt: 0,
  }));
}
