import { CampaignRules, CustomRuleProfile, Entity, GameId, RulesetId } from './types';
import { RULESETS, gameIdForRuleset } from '../content/rulesets';
import { HOUSE_RULES } from './houseRules';
import { normalizePointBuyConfig } from './pointBuy';

/** Precedence: current base/campaign rules, then the selected compatible profile overlay. */
export function resolveEffectiveCampaignRules(base: CampaignRules, entity: Pick<Entity,'rulesetId'|'customRuleProfileId'>, profiles: readonly CustomRuleProfile[]): CampaignRules {
  const profile=profiles.find(p=>p.id===entity.customRuleProfileId);
  if(!profile || !isProfileCompatible(profile, entity.rulesetId)) return base;
  const rules=sanitizeProfileRules(profile.rules);
  return {...base,...rules,customRules:{...base.customRules,...(rules.customRules??{})}};
}
export function isProfileCompatible(profile: CustomRuleProfile, currentRulesetId: RulesetId|undefined):boolean{
  const currentGame=currentRulesetId ? gameIdForRuleset(currentRulesetId) : RULESETS['dnd5e-2014'].gameId;
  const profileGame=gameIdForRuleset(profile.baseRulesetId);
  return !!currentGame && !!profileGame && profileGame===currentGame;
}
/** Persisted profile metadata is repaired from the registered base identity on load/save. */
export function normalizeCustomRuleProfile(profile:CustomRuleProfile):CustomRuleProfile{
  const gameId=gameIdForRuleset(profile.baseRulesetId);
  return {...profile,...(gameId?{gameId}:{}),rules:sanitizeProfileRules(profile.rules)};
}
export function profilesForRuleset(profiles:readonly CustomRuleProfile[],rulesetId:RulesetId|undefined){return profiles.filter(p=>isProfileCompatible(p,rulesetId));}
const SUPPORTED_CUSTOM_RULE_KEYS=new Set([...HOUSE_RULES.map(rule=>rule.key),'featsEnabled']);
export function sanitizeProfileRules(raw: CustomRuleProfile['rules']): CustomRuleProfile['rules'] {
  const rules: CustomRuleProfile['rules']={};
  if(raw.maxAbilityScore===null||typeof raw.maxAbilityScore==='number')rules.maxAbilityScore=raw.maxAbilityScore;
  if(raw.maxLevel===null||typeof raw.maxLevel==='number')rules.maxLevel=raw.maxLevel;
  if(typeof raw.useXP==='boolean')rules.useXP=raw.useXP;
  if(raw.hpMode==='fixed'||raw.hpMode==='rolled'||raw.hpMode==='max')rules.hpMode=raw.hpMode;
  if(typeof raw.allowMulticlass==='boolean')rules.allowMulticlass=raw.allowMulticlass;
  if(['standard','pointbuy','manual','roll'].includes(raw.abilityGenerationMode as string))rules.abilityGenerationMode=raw.abilityGenerationMode;
  if(raw.pointBuy&&typeof raw.pointBuy==='object')rules.pointBuy=normalizePointBuyConfig(raw.pointBuy);
  if(raw.customRules&&typeof raw.customRules==='object')rules.customRules=Object.fromEntries(Object.entries(raw.customRules).filter(([key])=>SUPPORTED_CUSTOM_RULE_KEYS.has(key)));
  return rules;
}
export function makeCustomRuleProfile(input:{name:string;baseRulesetId:RulesetId;rules:CustomRuleProfile['rules'];id?:string;gameId?:GameId;source?:CustomRuleProfile['source']}):CustomRuleProfile{const now=Date.now();const gameId=input.gameId??gameIdForRuleset(input.baseRulesetId);if(!gameId)throw new Error('Base ruleset is not registered.');return{id:input.id??'custom-rules-'+now.toString(36)+Math.random().toString(36).slice(2,7),name:input.name.trim(),gameId,baseRulesetId:input.baseRulesetId,rules:sanitizeProfileRules(input.rules),source:input.source??{kind:'local'},createdAt:now,updatedAt:now};}
