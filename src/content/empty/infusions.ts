export type Infusion = import('../infusions/index').Infusion;
export const ALL_INFUSIONS: Infusion[] = [];
export function getInfusion(_id: string): Infusion | null { return null; }
export { maxInfusedItems } from '../../engine/infusionRules';
