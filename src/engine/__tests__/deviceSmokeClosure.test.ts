import { makeEmptyEntity, DEFAULT_RULES } from '../../store/characterStore';
import { isStartingEquipmentItem, reopenEquipmentChoice, skipEquipmentChoice, skipRemainingEquipment } from '../../content/items/equipmentDisplay';
import { applyDmOverride, cancelDmOverride } from '../dmOverride';
import { effectiveAbilityScores, recomputeDerived } from '../pipeline';
import { explainValue } from '../audit';
import { generateAllActionCards } from '../actionCards';
import { IMPORTED_ITEMS } from '../../content/items/importedItems';
import type { ChoiceState, DmOverride } from '../types';
import { useHomebrewStore } from '../../store/homebrewStore';
import { itemMace } from '../../content/items';

const equipmentChoice=(id:string,itemId:string):ChoiceState=>({id,grantedAt:1,resolved:true,selections:['option'],definition:{id,prompt:id,kind:'equipment',count:1,pool:[{id:'option',label:itemId,value:[itemId]}],grants:[],required:false,resolved:true}});
describe('device smoke closure',()=>{
 it('starting equipment excludes magic variants while additional catalog data remains intact',()=>{
  expect(isStartingEquipmentItem({properties:['simple','melee']})).toBe(true);
  expect(isStartingEquipmentItem({properties:['magic item','magic weapon']})).toBe(false);
  expect(IMPORTED_ITEMS.some(item=>item.name==='Mace +1')).toBe(true);
 });
 it('edits or skips one choice without resetting siblings and never creates placeholders',()=>{
  const e=makeEmptyEntity('equipment'); e.choices=[equipmentChoice('weapon','mace'),equipmentChoice('armor','shield'),equipmentChoice('pack','explorers_pack')];
  e.inventory.carried=[{itemId:'mace',quantity:1,attuned:false,features:[]},{itemId:'shield',quantity:1,attuned:false,features:[]},{itemId:'explorers_pack',quantity:1,attuned:false,features:[]}];
  const changed=reopenEquipmentChoice(e,'weapon'); expect(changed.choices.map(c=>c.resolved)).toEqual([false,true,true]); expect(changed.inventory.carried.map(i=>i.itemId)).toEqual(['shield','explorers_pack']);
  const partial=skipEquipmentChoice(changed,'weapon'); expect(partial.choices.every(c=>c.resolved)).toBe(true); expect(partial.inventory.carried).toHaveLength(2);
  const all=skipRemainingEquipment({...e,choices:e.choices.map(c=>({...c,resolved:false,selections:[]})),inventory:{...e.inventory,carried:[]}}); expect(all.choices.every(c=>c.resolved)).toBe(true); expect(all.inventory.carried).toEqual([]);
 });
 it('ability replacement drives score, modifier, saves, skills and removal',()=>{
  const base=makeEmptyEntity('override'); base.stats.str=14; base.skills.skills.athletics.trained=true;
  const overridden=applyDmOverride(base,{campaignId:'c',entityId:base.id,dmDeviceId:'d',stat:'str',operation:'set',value:18,label:'test',expiry:'manual'},DEFAULT_RULES);
  expect(effectiveAbilityScores(overridden).str).toBe(18); expect(overridden.derived.savingThrows.str).toBe(4); expect(overridden.derived.attackBonuses.find(a=>a.id==='unarmed_strike')?.bonus).toBe(5);
  const trail=explainValue(overridden,'str'); expect(trail).toMatchObject({calculated:14,override:18,effective:18,total:18}); expect(trail.entries.reduce((n,e)=>n+e.value,0)).toBe(14);
  const active=overridden.dmOverrides.find(o=>o.active)!; expect(effectiveAbilityScores(cancelDmOverride(overridden,active.id,DEFAULT_RULES)).str).toBe(14);
 });
 it('AC and speed replacement explanations show calculated then replacement, never additive totals',()=>{
  const e=makeEmptyEntity('audit'); e.resources.ac=16;
  const override=(stat:string,value:number,at:number):DmOverride=>({id:stat,campaignId:'c',entityId:e.id,dmDeviceId:'d',stat,operation:'set',value,label:'test',active:true,appliedAt:at,cancelledAt:null,expiry:'manual'});
  const result=recomputeDerived({...e,dmOverrides:[override('ac',20,1),override('speed',40,2)]},DEFAULT_RULES);
  expect(explainValue(result,'ac')).toMatchObject({calculated:16,override:20,effective:20,total:20});
  expect(explainValue(result,'speed')).toMatchObject({calculated:30,override:40,effective:40,total:40});
 });
 it('Mace of Disruption keeps its passive descriptive while receiving one basic weapon attack',()=>{
  const item=IMPORTED_ITEMS.find(i=>i.id==='mace_of_disruption')!; expect(item.features.every(f=>!f.activation)).toBe(true);
  useHomebrewStore.setState({ items: [item, itemMace] });
  const e=makeEmptyEntity('mace'); e.inventory.equipped=[{itemId:item.id,quantity:1,attuned:true,features:item.features,requiresAttunement:true}];
  const cards=generateAllActionCards(recomputeDerived(e,DEFAULT_RULES)).filter(card=>card.name==='Mace of Disruption');
  expect(cards).toHaveLength(1); expect(cards[0].featureId).toBe('mace_of_disruption_basic_weapon_attack');
 });
});
