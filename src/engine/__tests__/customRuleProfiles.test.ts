import { DEFAULT_RULES, makeEmptyEntity } from '../../store/characterStore';
import { makeCustomRuleProfile, profilesForRuleset, resolveEffectiveCampaignRules, sanitizeProfileRules } from '../customRuleProfiles';
import { asGameId, asRulesetId } from '../types';
import { playerFreeEditLocked } from '../houseRules';
import { serializePortableCharacter, parsePortableCharacter } from '../../io/characterPortable';
import { useCustomRuleProfileStore } from '../../store/customRuleProfileStore';

describe('minimal custom rule profiles',()=>{
 const free=makeCustomRuleProfile({id:'free',name:'Free Editing',baseRulesetId:asRulesetId('dnd5e-2014'),rules:{customRules:{lockPlayerFreeEdit:false}}});
 const locked={...free,id:'locked',name:'Locked',rules:{customRules:{lockPlayerFreeEdit:true}},updatedAt:free.updatedAt+1};
 it('drops unsupported profile keys rather than creating executable rule surface',()=>{expect(sanitizeProfileRules({customRules:{lockPlayerFreeEdit:true,unknownScript:'x'}}).customRules).toEqual({lockPlayerFreeEdit:true})});
 it('filters compatible profiles by game and keeps official base identity',()=>{const other={...free,id:'pf',gameId:asGameId('pathfinder'),baseRulesetId:asRulesetId('pf2e')};expect(profilesForRuleset([free,other],asRulesetId('dnd5e-2014'))).toEqual([free]);expect(free.baseRulesetId).toBe('dnd5e-2014')});
 it('switches effective rules immediately and profile edits refresh without copying into entity',()=>{const e={...makeEmptyEntity('e'),rulesetId:asRulesetId('dnd5e-2014'),customRuleProfileId:'free'};expect(playerFreeEditLocked(resolveEffectiveCampaignRules(DEFAULT_RULES,e,[free]))).toBe(false);expect(playerFreeEditLocked(resolveEffectiveCampaignRules(DEFAULT_RULES,e,[locked,{...locked,id:'free'}]))).toBe(true);expect(e.customRuleProfileId).toBe('free')});
 it('falls back to official rules when profile reference is absent or incompatible',()=>{const e={...makeEmptyEntity('e'),rulesetId:asRulesetId('dnd5e-2014'),customRuleProfileId:'missing'};expect(resolveEffectiveCampaignRules(DEFAULT_RULES,e,[free])).toBe(DEFAULT_RULES)});
 it('blocks deleting a referenced profile',async()=>{useCustomRuleProfileStore.setState({profiles:[free],loaded:true});const result=await useCustomRuleProfileStore.getState().remove('free',new Set(['free']));expect(result).toEqual({ok:false,reason:expect.stringContaining('used by a character')});expect(useCustomRuleProfileStore.getState().profiles).toHaveLength(1)});
 it('portable JSON embeds and restores profile semantics',()=>{const entity={...makeEmptyEntity('portable-profile'),rulesetId:free.baseRulesetId,customRuleProfileId:free.id};const parsed=parsePortableCharacter(serializePortableCharacter(entity,free),new Set(),[]);expect(parsed.profileToImport).toEqual(free);expect(parsed.entity.customRuleProfileId).toBe('free');expect(()=>parsePortableCharacter(serializePortableCharacter(entity),new Set(),[])).toThrow('not embedded');const conflicting={...free,rules:{customRules:{lockPlayerFreeEdit:true}}};expect(parsePortableCharacter(serializePortableCharacter(entity,free),new Set(),[conflicting]).profileToImport).toEqual(free)});
 it('entity/profile JSON reload still resolves the selected profile',()=>{const entity=JSON.parse(JSON.stringify({...makeEmptyEntity('restart'),rulesetId:free.baseRulesetId,customRuleProfileId:free.id}));const profiles=JSON.parse(JSON.stringify([free]));expect(playerFreeEditLocked(resolveEffectiveCampaignRules(DEFAULT_RULES,entity,profiles))).toBe(false)});
});
