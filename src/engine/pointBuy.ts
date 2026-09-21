import { AbilityScores, PointBuyConfig } from './types';
export const STANDARD_POINT_BUY:PointBuyConfig={budget:27,minimum:8,maximum:15,costs:{8:0,9:1,10:2,11:3,12:4,13:5,14:7,15:9}};
export function normalizePointBuyConfig(config?:PointBuyConfig):PointBuyConfig{
 const c=config??STANDARD_POINT_BUY; const costs=Object.fromEntries(Object.entries(c.costs??{}).map(([k,v])=>[Number(k),Number(v)]).filter(([k,v])=>Number.isFinite(k)&&Number.isFinite(v)&&v>=0));
 const keys=Object.keys(costs).map(Number).sort((a,b)=>a-b);if(!keys.length)return STANDARD_POINT_BUY;
 const requestedMin=Number.isFinite(c.minimum)?Math.floor(c.minimum):keys[0],requestedMax=Number.isFinite(c.maximum)?Math.floor(c.maximum):keys.at(-1)!;
 return {budget:Number.isFinite(c.budget)?Math.max(0,Math.floor(c.budget)):STANDARD_POINT_BUY.budget,minimum:Math.max(keys[0],requestedMin),maximum:Math.min(keys.at(-1)!,requestedMax),costs};
}
export function pointBuyCost(score:number,config:PointBuyConfig):number|undefined{return config.costs[score];}
export function pointBuySpent(scores:AbilityScores,config:PointBuyConfig):number{return Object.values(scores).reduce((sum,score)=>sum+(pointBuyCost(score,config)??Infinity),0);}
export function validatePointBuy(scores:AbilityScores,configInput:PointBuyConfig):{valid:boolean;spent:number;remaining:number;reason?:string}{
 const config=normalizePointBuyConfig(configInput); for(const score of Object.values(scores)){if(!Number.isInteger(score)||score<config.minimum||score>config.maximum||pointBuyCost(score,config)===undefined)return{valid:false,spent:Infinity,remaining:-Infinity,reason:'Every score must be an allowed cost-table value within range.'};}
 const spent=pointBuySpent(scores,config);return spent<=config.budget?{valid:true,spent,remaining:config.budget-spent}:{valid:false,spent,remaining:config.budget-spent,reason:'Point-buy budget exceeded.'};
}
export function adjustPointBuy(scores:AbilityScores,ability:keyof AbilityScores,delta:-1|1,configInput:PointBuyConfig):AbilityScores{
 const config=normalizePointBuyConfig(configInput),next=scores[ability]+delta;if(next<config.minimum||next>config.maximum||pointBuyCost(next,config)===undefined)return scores;
 const candidate={...scores,[ability]:next};return validatePointBuy(candidate,config).valid?candidate:scores;
}
export function minimumPointBuyScores(configInput:PointBuyConfig):AbilityScores{const n=normalizePointBuyConfig(configInput).minimum;return{str:n,dex:n,con:n,int:n,wis:n,cha:n};}
