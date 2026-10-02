// ============================================================================
// FILE: src/content/homebrewPack/helpers.ts
// Small constructors shared by the built-in homebrew pack (Creator Stress-Test Pack + Emperor
// Warlock). They only assemble the same Feature/Effect shapes the rest of the content layer uses;
// nothing here is behavior.
// ============================================================================
import {
  Effect, Feature, FeatureActivation, FeatureSource, AbilityEffect, ResourceGrant, ActionCardTag,
} from '../../engine/types';

export const stat = (target: string, operation: Effect['operation'], value: number | null): Effect =>
  ({ type: 'stat_modifier', target, operation, value, condition: null });

/** Reminder-style advantage/disadvantage chip (DerivedStats.advantageStates), never auto-rolled. */
export const adv = (target: string, operation: 'advantage' | 'disadvantage' = 'advantage'): Effect =>
  ({ type: 'stat_modifier', target, operation, value: null, condition: null });

export const gated = (e: Effect, condition: string): Effect => ({ ...e, condition });
export const situational = (e: Effect, id: string, question: string): Effect => ({ ...e, situational: { id, question } });

export interface FeatureOpts {
  id: string;
  name: string;
  description: string;
  source: FeatureSource;
  level?: number | null;
  effects?: Effect[];
  activation?: FeatureActivation;
  abilityEffects?: AbilityEffect[];
  tags?: ActionCardTag[];
  trigger?: string;
  resources?: ResourceGrant[];
  rewardTrack?: Feature['rewardTrack'];
  choices?: Feature['choices'];
}

export function feature(o: FeatureOpts): Feature {
  return {
    id: o.id, name: o.name, description: o.description, source: o.source,
    level: o.level ?? null,
    effects: o.effects ?? [], actions: [], choices: o.choices ?? [],
    passive: !o.activation,
    ...(o.activation ? { activation: o.activation } : {}),
    ...(o.abilityEffects ? { abilityEffects: o.abilityEffects } : {}),
    ...(o.tags ? { tags: o.tags } : {}),
    ...(o.trigger ? { trigger: o.trigger } : {}),
    ...(o.resources ? { resources: o.resources } : {}),
    ...(o.rewardTrack ? { rewardTrack: o.rewardTrack } : {}),
  };
}

export function activation(
  actionType: FeatureActivation['actionType'],
  o: Partial<Omit<FeatureActivation, 'actionType'>> & { resource?: string; cost?: number } = {},
): FeatureActivation {
  const { resource, cost, ...rest } = o;
  return {
    actionType,
    resourceCost: resource ? { resourceId: resource, quantity: cost ?? 1 } : null,
    range: 'self', target: 'self', requiresSave: null,
    ...rest,
  };
}
