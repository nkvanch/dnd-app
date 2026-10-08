// ============================================================================
// FILE: src/session/effectBridge.ts
// Makes live-session effects change the player's REAL derived numbers, reusing the
// engine's existing override layer (dmOverrides) rather than a parallel calculator.
// A player sees the correct AC/speed/etc. for a secret effect without ever learning
// what caused it: overrides carry a neutral label and only the projected components.
// ============================================================================
import { DmOverride, Entity } from '../engine/types';
import { recomputeDerived } from '../engine/pipeline';
import { EffectComponent } from './types';

export const SESSION_OVERRIDE_PREFIX = 'session:';
const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;

export type ActiveComponents = { applicationId: string; components: EffectComponent[] };

const STAT_TARGET: Record<Exclude<EffectComponent['stat'], 'save'>, string> = {
  ac: 'ac', speed: 'speed', initiative: 'initiative', spell_attack: 'spellAttackBonus', spell_dc: 'spellSaveDC',
};

/** Pure: the overrides an entity should carry for the given active applications. */
export function overridesFor(entityId: string, active: ActiveComponents[]): DmOverride[] {
  const out: DmOverride[] = [];
  for (const a of active) {
    a.components.forEach((c, i) => {
      const base = { entityId, campaignId: 'live-session', dmDeviceId: 'live-session', operation: 'add' as const, value: c.value,
        label: 'Session effect', active: true, appliedAt: 0, cancelledAt: null, expiry: 'manual' as const };
      if (c.stat === 'save') {
        for (const ab of ABILITIES) out.push({ ...base, id: `${SESSION_OVERRIDE_PREFIX}${a.applicationId}:${i}:${ab}`, stat: `savingThrows.${ab}` });
      } else {
        out.push({ ...base, id: `${SESSION_OVERRIDE_PREFIX}${a.applicationId}:${i}`, stat: STAT_TARGET[c.stat] });
      }
    });
  }
  return out;
}

/** Stable signature so unchanged effects cause no character write. */
export function signature(overrides: DmOverride[]): string {
  return overrides.map(o => `${o.id}|${o.stat}|${o.value}`).sort().join(';');
}

/** Pure: returns the entity carrying exactly `desired` session overrides (all other overrides untouched). */
export function withSessionOverrides(entity: Entity, desired: DmOverride[], rules: Parameters<typeof recomputeDerived>[1]): Entity {
  const others = entity.dmOverrides.filter(o => !o.id.startsWith(SESSION_OVERRIDE_PREFIX));
  const current = entity.dmOverrides.filter(o => o.id.startsWith(SESSION_OVERRIDE_PREFIX));
  if (signature(current) === signature(desired)) return entity;
  return recomputeDerived({ ...entity, dmOverrides: [...others, ...desired] }, rules);
}

/** Removes every live-session override (used at app start: effects never outlive their session). */
export function clearStaleSessionEffects(entity: Entity, rules: Parameters<typeof recomputeDerived>[1]): Entity {
  return withSessionOverrides(entity, [], rules);
}
