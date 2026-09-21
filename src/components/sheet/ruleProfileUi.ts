import { CampaignRules, CustomRuleProfile, Entity } from '../../engine/types';
import { RULESETS, gameIdForRuleset } from '../../content/rulesets';
import { canPlayerFreeEdit } from '../../engine/houseRules';
import { profilesForRuleset, resolveEffectiveCampaignRules } from '../../engine/customRuleProfiles';

export type RulesetPickerViewModel = {
  official: typeof RULESETS[string][];
  custom: CustomRuleProfile[];
  activeProfileId?: string;
};

/** UI-facing selector shared by the rendered picker and integration tests. */
export function rulesetPickerViewModel(entity: Pick<Entity, 'rulesetId' | 'customRuleProfileId'>, profiles: readonly CustomRuleProfile[]): RulesetPickerViewModel {
  const currentGame = entity.rulesetId ? gameIdForRuleset(entity.rulesetId) : RULESETS['dnd5e-2014'].gameId;
  return {
    official: currentGame ? Object.values(RULESETS).filter(rule => rule.gameId === currentGame) : Object.values(RULESETS),
    custom: profilesForRuleset(profiles, entity.rulesetId),
    activeProfileId: profiles.some(profile => profile.id === entity.customRuleProfileId) ? entity.customRuleProfileId : undefined,
  };
}

/** One authoritative UI rule path; profile edits update this as the store array changes. */
export function sheetRuleAccess(base: CampaignRules, entity: Pick<Entity, 'rulesetId' | 'customRuleProfileId'>, profiles: readonly CustomRuleProfile[]) {
  const effectiveRules = resolveEffectiveCampaignRules(base, entity, profiles);
  return { effectiveRules, canFreeEdit: canPlayerFreeEdit(effectiveRules) };
}
