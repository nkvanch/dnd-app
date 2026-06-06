// ============================================================================
// FILE: src/engine/rest.ts
// PROJECT: Short Rest & Long Rest Recovery Engine
// ============================================================================
import { Entity, SpellcastingBlock, SpellSlots, CampaignRules } from './types';
import { recomputeDerived } from './pipeline';
import { removeCondition, reduceExhaustion } from './conditions';
import { dropConcentration } from './combat';
import { DEFAULT_RULES } from '../store/characterStore';

// ── Entry point ───────────────────────────────────────────────────────────────

/** Top-level rest dispatcher. Call this from the UI rest buttons. */
export function takeRest(
  entity: Entity,
  kind:   'short' | 'long',
  rules:  CampaignRules = DEFAULT_RULES
): Entity {
  const restored = kind === 'short' ? shortRest(entity) : longRest(entity);
  return recomputeDerived(restored, rules);
}

// ── Short rest ────────────────────────────────────────────────────────────────

/**
 * Short rest:
 * - Recharges resources tagged 'short_rest' or 'long_rest'.
 * - HP recovery via hit dice is player-initiated (call spendHitDie separately).
 * - Only Warlocks (Pact Magic) recover spell slots on short rest.
 */
function shortRest(entity: Entity): Entity {
  const rechargedResources = entity.resources.custom.map(r => {
    if (r.recharge === 'short_rest' || r.recharge === 'long_rest') {
      return { ...r, current: r.maximum };
    }
    return r;
  });

  // Only Warlocks recover spell slots on a short rest.
  // All other spellcasting classes use long rest recovery.
  const isWarlock = entity.identity.classId === 'warlock';
  const rechargedSpellcasting = (entity.spellcasting && isWarlock)
    ? rechargeSlots(entity.spellcasting)
    : entity.spellcasting;

  return {
    ...entity,
    resources:    { ...entity.resources, custom: rechargedResources },
    spellcasting: rechargedSpellcasting,
  };
}

// ── Long rest ─────────────────────────────────────────────────────────────────

/**
 * Long rest:
 * 1. HP restored to maximum, temp HP cleared.
 * 2. ALL resource pools recharged.
 * 3. Hit dice partially restored (half level, minimum 1).
 * 4. All spell slots restored.
 * 5. Concentration dropped (can't concentrate while sleeping).
 * 6. 'until_rest' conditions removed.
 * 7. Exhaustion reduced by 1.
 */
function longRest(entity: Entity): Entity {
  let updated = entity;

  // 1. HP
  updated = {
    ...updated,
    resources: {
      ...updated.resources,
      hp: {
        current: updated.resources.hp.maximum,
        maximum: updated.resources.hp.maximum,
        temp:    0,
      },
    },
  };

  // 2. All custom resources
  updated = {
    ...updated,
    resources: {
      ...updated.resources,
      custom: updated.resources.custom.map(r => ({ ...r, current: r.maximum })),
    },
  };

  // 3. Hit dice (restore half level, minimum 1)
  const restoreCount = Math.max(1, Math.floor(updated.identity.level / 2));
  updated = {
    ...updated,
    resources: {
      ...updated.resources,
      hitDice: {
        ...updated.resources.hitDice,
        remaining: Math.min(
          updated.resources.hitDice.total,
          updated.resources.hitDice.remaining + restoreCount
        ),
      },
    },
  };

  // 4. Spell slots — long rest restores all slots for all spellcasting classes
  if (updated.spellcasting) {
    updated = {
      ...updated,
      spellcasting: rechargeSlots(updated.spellcasting),
    };
  }

  // 5. Drop concentration
  updated = dropConcentration(updated);

  // 6. Remove until_rest conditions
  const untilRestIds = updated.conditionMonitor.active
    .filter(c => c.duration?.unit === 'until_rest')
    .map(c => c.id);

  for (const id of untilRestIds) {
    updated = removeCondition(updated, id);
  }

  // 7. Reduce exhaustion by 1
  updated = reduceExhaustion(updated);

  return updated;
}

// ── Hit dice ──────────────────────────────────────────────────────────────────

/**
 * Player spends one hit die during a short rest.
 * Rolls the die, adds CON modifier, heals the entity.
 * Minimum heal: 1. Cannot exceed maximum HP.
 */
export function spendHitDie(
  entity: Entity,
  rules:  CampaignRules = DEFAULT_RULES
): Entity {
  if (entity.resources.hitDice.remaining <= 0) return entity;

  const { die } = entity.resources.hitDice;
  const roll     = Math.floor(Math.random() * die) + 1;
  const conMod   = Math.floor((entity.stats.con - 10) / 2);
  const heal     = Math.max(1, roll + conMod);

  const newCurrent = Math.min(
    entity.resources.hp.maximum,
    entity.resources.hp.current + heal
  );

  const updated = {
    ...entity,
    resources: {
      ...entity.resources,
      hp: { ...entity.resources.hp, current: newCurrent },
      hitDice: {
        ...entity.resources.hitDice,
        remaining: entity.resources.hitDice.remaining - 1,
      },
    },
  };

  return recomputeDerived(updated, rules);
}

// ── Spell slot helpers ────────────────────────────────────────────────────────

/** Restores all spell slot used counts to 0 (called on short rest for Warlocks, long rest for all). */
function rechargeSlots(block: SpellcastingBlock): SpellcastingBlock {
  const tiers = ['1','2','3','4','5','6','7','8','9'] as const;
  const slots = { ...block.slots } as SpellSlots;
  for (const tier of tiers) {
    slots[tier] = { ...slots[tier], used: 0 };
  }
  return { ...block, slots };
}
