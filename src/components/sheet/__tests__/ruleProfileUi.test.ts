import { makeEmptyEntity, DEFAULT_RULES } from '../../../store/characterStore';
import { makeCustomRuleProfile } from '../../../engine/customRuleProfiles';
import { asGameId, asRulesetId } from '../../../engine/types';
import { rulesetPickerViewModel, sheetRuleAccess } from '../ruleProfileUi';

describe('rule profile sheet integration', () => {
  const entity={...makeEmptyEntity('sheet'),rulesetId:asRulesetId('dnd5e-2014')};
  const profile=makeCustomRuleProfile({id:'custom-free-edit',name:'Free Edit',baseRulesetId:asRulesetId('dnd5e-2014'),gameId:asGameId('dnd5e'),rules:{customRules:{lockPlayerFreeEdit:false}}});
  const sameGame=makeCustomRuleProfile({id:'same-game',name:'2024 Profile',baseRulesetId:asRulesetId('dnd5e-2024'),rules:{customRules:{lockPlayerFreeEdit:true}}});
  const otherGame=makeCustomRuleProfile({id:'other',name:'Pathfinder',baseRulesetId:asRulesetId('pf2e'),rules:{}});

  it('builds Official and Custom sections from persisted loaded profiles', () => {
    const vm=rulesetPickerViewModel(entity,[profile,sameGame,otherGame]);
    expect(vm.official.some(rule=>rule.id==='dnd5e-2014')).toBe(true);
    expect(vm.custom.map(item=>item.id)).toEqual(['custom-free-edit','same-game']);
  });
  it('reflects live additions and edits without restart', () => {
    expect(rulesetPickerViewModel(entity,[]).custom).toEqual([]);
    expect(rulesetPickerViewModel(entity,[profile]).custom[0].name).toBe('Free Edit');
    expect(rulesetPickerViewModel(entity,[{...profile,name:'Renamed'}]).custom[0].name).toBe('Renamed');
  });
  it('marks only an existing selected profile active', () => {
    expect(rulesetPickerViewModel({...entity,customRuleProfileId:profile.id},[profile]).activeProfileId).toBe(profile.id);
    expect(rulesetPickerViewModel({...entity,customRuleProfileId:'missing'},[profile]).activeProfileId).toBeUndefined();
  });
  it('reports Free Edit from effective profile rules and updates live', () => {
    const selected={...entity,customRuleProfileId:profile.id};
    expect(sheetRuleAccess(DEFAULT_RULES,selected,[profile]).canFreeEdit).toBe(true);
    expect(sheetRuleAccess(DEFAULT_RULES,selected,[{...profile,rules:{customRules:{lockPlayerFreeEdit:true}}}]).canFreeEdit).toBe(false);
    expect(sheetRuleAccess(DEFAULT_RULES,selected,[profile]).canFreeEdit).toBe(true);
  });
  it('falls back safely when the selected profile is missing', () => {
    const base={...DEFAULT_RULES,customRules:{lockPlayerFreeEdit:true}};
    expect(sheetRuleAccess(base,{...entity,customRuleProfileId:'missing'},[]).canFreeEdit).toBe(false);
  });
});
