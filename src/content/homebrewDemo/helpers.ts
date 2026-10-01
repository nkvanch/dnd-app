// src/content/homebrewDemo/helpers.ts
// Small constructors shared by the Emperor Warlock demo pack. They only build
// plain Feature / ResourceGrant / Effect data — no engine behavior lives here.
//
// HONESTY CONVENTION used by every description in the pack: a line starting
// "Automated:" names what Grimoire actually enforces; a line starting
// "Table-resolved:" names what it deliberately leaves to the table (the
// engine has no battle map, summoned-creature, calendar or campaign-project
// model). Nothing is described as automated unless a test in
// src/content/homebrewDemo/__tests__ exercises it.
import type { Feature, ResourceGrant, Effect, AllyGrantSpec, AbilityEffect, FeatureActivation, Ability, ChoiceDefinition } from '../../engine/types';

export const CLASS_ID = 'emperor_warlock';
export const SRC = { kind: 'class' as const, refId: CLASS_ID };

export const AUTO = 'Automated: ';
export const TABLE = 'Table-resolved: ';

export function feat(id: string, name: string, description: string, extra: Partial<Feature> = {}): Feature {
  return { id, name, description, source: SRC, level: null, effects: [], actions: [], choices: [], passive: true, ...extra };
}

export function pool(resourceId: string, name: string, maximum: number, recharge: ResourceGrant['recharge'] = 'long_rest', extra: Partial<ResourceGrant> = {}): ResourceGrant {
  return { resourceId, name, maximum, recharge, ...extra };
}

/** A pool whose size is the proficiency bonus ("PB uses per Long Rest"). */
export const pbPool = (resourceId: string, name: string, recharge: ResourceGrant['recharge'] = 'long_rest') =>
  pool(resourceId, name, 2, recharge, { scalesWith: 'proficiency' });

/** Manually-recharged pool for "once per in-game month / 7 long rests / 10 years". Grimoire has no calendar. */
export const manualPool = (resourceId: string, name: string, cadence: string) =>
  pool(resourceId, name, 1, `${cadence} (manual)`);

export const skillProf = (skill: string): Effect =>
  ({ type: 'grant_proficiency', target: `skill:${skill}`, operation: 'add', value: null, condition: null });
/** "Gain proficiency — or expertise if you already have it." */
export const skillProfOrExpertise = (skill: string): Effect =>
  ({ ...skillProf(skill), expertiseIfProficient: true });
export const skillExpertise = (skill: string): Effect =>
  ({ type: 'grant_proficiency', target: `skill:${skill}`, operation: 'multiply', value: null, condition: null });
export const weaponProf = (weapon: string): Effect =>
  ({ type: 'grant_proficiency', target: `weapon:${weapon}`, operation: 'add', value: null, condition: null });

export const add = (target: string, value: number, condition: string | null = null): Effect =>
  ({ type: 'stat_modifier', target, operation: 'add', value, condition });
export const setStat = (target: string, value: number, condition: string | null = null): Effect =>
  ({ type: 'stat_modifier', target, operation: 'set', value, condition });
export const ALL_SAVES = (value: number): Effect[] =>
  (['str', 'dex', 'con', 'int', 'wis', 'cha'] as const).map(a => add(`savingThrows.${a}`, value));

export function activation(
  actionType: FeatureActivation['actionType'], resourceId: string | null, extra: Partial<FeatureActivation> = {},
): FeatureActivation {
  return {
    actionType, resourceCost: resourceId ? { resourceId, quantity: 1 } : null,
    range: 'self', target: 'self', requiresSave: null, ...extra,
  };
}

/** The Spirit Save DC: 8 + proficiency bonus + Charisma modifier. */
export const SPIRIT_DC: NonNullable<FeatureActivation['requiresSave']>['dc'] = { ability: 'cha' };
export const spiritSave = (ability: Ability) => ({ ability, dc: SPIRIT_DC });

/** An activated feature that spends from a pool, optionally flipping a flag its effects/aura are gated on. */
export function active(
  id: string, name: string, description: string,
  o: {
    actionType?: FeatureActivation['actionType']; poolId?: string | null; flag?: string;
    range?: string; target?: FeatureActivation['target']; save?: Ability; damage?: { dice: string; type: string; half?: boolean }[];
    effects?: Effect[]; allyGrants?: AllyGrantSpec[]; abilityEffects?: AbilityEffect[];
  } = {},
): Feature {
  const abilityEffects: AbilityEffect[] = [
    ...(o.abilityEffects ?? []),
    ...(o.flag ? [{ type: 'set_flag', flag: o.flag, value: true } as AbilityEffect] : []),
    ...(o.damage ?? []).map(d => ({ type: 'damage', dice: d.dice, damageType: d.type, saveOnSuccess: d.half ? 'half' : undefined }) as AbilityEffect),
  ];
  return feat(id, name, description, {
    passive: false,
    effects: o.effects ?? [],
    activation: activation(o.actionType ?? 'action', o.poolId === undefined ? null : o.poolId, {
      range: o.range ?? 'self', target: o.target ?? 'self', requiresSave: o.save ? spiritSave(o.save) : null,
    }),
    abilityEffects: abilityEffects.length ? abilityEffects : undefined,
    allyGrants: o.allyGrants,
  });
}

export const spellFeature = (id: string, name: string, cantripIds: string[], spellIds: string[]): Feature =>
  feat(id, name, `Bonus spells known while this Bound Spirit is active: ${[...cantripIds, ...spellIds].join(', ')}. They do not count against your normal spells known.`, {
    effects: [{ type: 'grant_spell', target: 'bound_spirit', operation: 'add', value: null, condition: null, cantripIds, spellIds, spellcastingAbility: 'cha' }],
  });

export const asiChoice = (id: string): ChoiceDefinition => ({
  id, prompt: 'Choose an Ability Score Increase (+2 to one or +1 to two) or a Feat.', kind: 'asi', count: 1, pool: 'all', grants: [], required: true, resolved: false,
});
export const spellChoice = (id: string, count: number, prompt: string): ChoiceDefinition => ({
  id, prompt, kind: 'spell', count, pool: 'all', grants: [], required: true, resolved: false,
});
