// src/content/itemCharges.ts
// Pure compiler for the homebrew item builder's "Charges" section: turns the
// author's charge-pool draft into the ResourceGrant an Item carries
// (Item.resources) and the FeatureActivation that spends it. Kept out of the
// screen so it is unit-testable and shared by any future item-authoring UI.
import type { ResourceGrant, FeatureActivation } from '../engine/types';

export type ItemChargeRecharge = 'short_rest' | 'long_rest' | 'dawn' | 'never' | 'other';

export type ItemChargesDraft = {
  enabled:       boolean;
  /** Parsed leniently — builder state is text. */
  max:           string;
  /** Charges the item starts with; blank = full. */
  starting:      string;
  recharge:      ItemChargeRecharge;
  /** Free-text recharge description when recharge === 'other'. */
  rechargeOther: string;
  /** Charges one use spends. */
  cost:          string;
  /** How the charge-spending use is taken (non-weapon items). */
  actionType:    'action' | 'bonus_action' | 'reaction' | 'free';
};

export function newItemChargesDraft(): ItemChargesDraft {
  return { enabled: false, max: '3', starting: '', recharge: 'dawn', rechargeOther: '', cost: '1', actionType: 'action' };
}

const toPosInt = (s: string, fallback: number) => {
  const n = parseInt(s, 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};

export function itemChargeResourceId(itemId: string): string {
  return `${itemId}_charges`;
}

export function buildItemCharges(
  itemId: string, itemName: string, draft: ItemChargesDraft,
): { resource: ResourceGrant; resourceId: string; cost: number; actionType: ItemChargesDraft['actionType'] } | null {
  if (!draft.enabled) return null;
  const maximum = Math.max(1, toPosInt(draft.max, 1));
  const startingRaw = draft.starting.trim() === '' ? maximum : toPosInt(draft.starting, maximum);
  const resourceId = itemChargeResourceId(itemId);
  const recharge = draft.recharge === 'other' ? (draft.rechargeOther.trim() || 'other') : draft.recharge;
  const resource: ResourceGrant = {
    resourceId, name: `${itemName || 'Item'} (Charges)`, maximum, recharge,
    ...(startingRaw < maximum ? { starting: startingRaw } : {}),
  };
  return { resource, resourceId, cost: Math.max(1, toPosInt(draft.cost, 1)), actionType: draft.actionType };
}

export function chargeActivation(
  base: Pick<FeatureActivation, 'actionType' | 'range' | 'target' | 'requiresSave'>,
  resourceId: string, cost: number,
): FeatureActivation {
  return { ...base, resourceCost: { resourceId, quantity: cost } };
}
