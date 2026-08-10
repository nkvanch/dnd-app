// ============================================================================
// FILE: src/engine/combat.ts
// PROJECT: Initiative Tracker, Concentration Gate & Combat Clock
// ============================================================================
import { Entity, CampaignRules, Spell, FeatureInstance, AbilityEffect } from './types';
import { recomputeDerived } from './pipeline';
import { tickDurations } from './conditions';
import { rollD20 as rollD20Dice } from './dice';
import { DEFAULT_RULES } from '../store/characterStore';
import { deathSavesPersist } from './houseRules';
import { ALL_BEAST_FORMS } from '../content/beastforms';

// ── Initiative ────────────────────────────────────────────────────────────────

export type InitiativeEntry = {
  entityId:     string;
  name:         string;
  initiative:   number;
  tiebreak:     number;   // DEX modifier used to break equal initiative rolls
  isPlayer:     boolean;
  hasTakenTurn: boolean;
};

export type CombatState = {
  active:      boolean;
  round:       number;
  turnIndex:   number;
  order:       InitiativeEntry[];
  encounterId: string;
};

/** Builds a DEX modifier from a raw score. */
function dexMod(entity: Entity): number {
  return Math.floor((entity.stats.dex - 10) / 2);
}

/**
 * Starts a combat encounter. Rolls initiative for all entities,
 * sorts descending by roll then by DEX modifier as tiebreaker.
 */
export function startEncounter(
  entities:    Entity[],
  encounterId: string
): CombatState {
  const order: InitiativeEntry[] = entities
    .map(e => ({
      entityId:     e.id,
      name:         e.identity.name,
      initiative:   rollD20Dice(dexMod(e)).total,
      tiebreak:     dexMod(e),
      isPlayer:     e.kind === 'character',
      hasTakenTurn: false,
    }))
    .sort((a, b) =>
      b.initiative - a.initiative ||
      b.tiebreak   - a.tiebreak
    );

  return {
    active:      true,
    round:       1,
    turnIndex:   0,
    order,
    encounterId,
  };
}

/**
 * Ends the current creature's turn.
 * - Ticks round-based durations on the acting entity.
 * - Advances the turn pointer.
 * - Increments the round counter when the order wraps.
 */
export function endTurn(
  combat:   CombatState,
  entities: Entity[],
  rules:    CampaignRules = DEFAULT_RULES
): { combat: CombatState; entities: Entity[] } {
  const current = combat.order[combat.turnIndex];

  // Tick durations on the entity whose turn just ended
  const updatedEntities = entities.map(e =>
    e.id === current.entityId ? tickDurations(e, rules) : e
  );

  // Advance turn pointer; wrap around at the end of the order
  const nextIndex = (combat.turnIndex + 1) % combat.order.length;
  const newRound  = nextIndex === 0 ? combat.round + 1 : combat.round;

  const updatedOrder = combat.order.map((entry, i) =>
    i === combat.turnIndex ? { ...entry, hasTakenTurn: true } : entry
  );

  // Reset hasTakenTurn when a new round starts
  const finalOrder = newRound > combat.round
    ? updatedOrder.map(e => ({ ...e, hasTakenTurn: false }))
    : updatedOrder;

  return {
    combat: {
      ...combat,
      round:     newRound,
      turnIndex: nextIndex,
      order:     finalOrder,
    },
    entities: updatedEntities,
  };
}

/** Ends the encounter and resets combat state. */
export function endEncounter(combat: CombatState): CombatState {
  return { ...combat, active: false, round: 0, turnIndex: 0, order: [] };
}

// ── Concentration ─────────────────────────────────────────────────────────────

/**
 * Drops the currently concentrated spell.
 * Removes all features tagged source.kind = 'spell' and source.refId = spellId.
 * Sets concentrating to null.
 * No-op if not concentrating.
 */
export function dropConcentration(entity: Entity): Entity {
  if (!entity.spellcasting?.concentrating) return entity;

  const droppedId = entity.spellcasting.concentrating;

  const cleanedFeatures = entity.features.filter(f =>
    !(f.source.kind === 'spell' && f.source.refId === droppedId)
  );

  return {
    ...entity,
    features: cleanedFeatures,
    spellcasting: entity.spellcasting
      ? { ...entity.spellcasting, concentrating: null }
      : null,
    conditionMonitor: {
      ...entity.conditionMonitor,
      flags: { ...entity.conditionMonitor.flags, concentrating: false },
    },
  };
}

/**
 * Begins concentrating on a spell.
 * Applies any onConcentrationFeatures from the spell definition.
 * Tags them with source = { kind: 'spell', refId: spell.id }
 * so dropConcentration can cleanly remove them.
 */
function beginConcentration(
  entity: Entity,
  spell:  Spell,
  rules:  CampaignRules
): Entity {
  const spellFeatures: FeatureInstance[] = (spell.onConcentrationFeatures ?? []).map(f => ({
    ...f,
    source:   { kind: 'spell' as const, refId: spell.id },
    level:    entity.identity.level,
    isActive: true,
  }));

  const updated = {
    ...entity,
    features: [...entity.features, ...spellFeatures],
    spellcasting: entity.spellcasting
      ? { ...entity.spellcasting, concentrating: spell.id }
      : null,
    conditionMonitor: {
      ...entity.conditionMonitor,
      flags: { ...entity.conditionMonitor.flags, concentrating: true },
    },
  };

  return recomputeDerived(updated, rules);
}

/**
 * Cast a concentration spell.
 * Automatically drops the previous concentration before beginning the new one.
 * This is the Hex → Fly scenario: Hex drops silently, Fly takes over.
 */
export function castConcentrationSpell(
  entity: Entity,
  spell:  Spell,
  rules:  CampaignRules = DEFAULT_RULES
): Entity {
  let updated = dropConcentration(entity);
  updated     = beginConcentration(updated, spell, rules);
  return updated;
}

// ── Concentration check (on damage) ──────────────────────────────────────────

/**
 * Called when a concentrating entity takes damage.
 * DC = max(10, damage / 2). Rolls CON save.
 * Supports War Caster advantage via the entity's feature flags.
 * If the save fails, concentration is dropped.
 */
export function concentrationCheck(
  entity:      Entity,
  damageTaken: number,
  rules:       CampaignRules = DEFAULT_RULES
): Entity {
  if (!entity.spellcasting?.concentrating) return entity;

  const dc = Math.max(10, Math.floor(damageTaken / 2));

  // Use the pipeline-computed CON saving throw, which already accounts for the
  // effective CON modifier (race/feat bonuses) AND saving-throw proficiency
  // (e.g. Resilient adds CON to proficiencies.savingThrows, which flows into
  // derived.savingThrows.con). Reading entity.stats.con directly would miss both.
  const conSaveBonus = entity.derived.savingThrows.con;

  // War Caster grants advantage on concentration saves. Match the actual feat
  // feature id (feat_<id>); the old 'war_caster'/'resilient_con' ids never
  // matched anything created by the feats system.
  const hasWarCaster = entity.features.some(f =>
    f.isActive && f.id === 'feat_war_caster'
  );

  const baseRoll = (): number => rollD20Dice(conSaveBonus).total;

  const roll = hasWarCaster
    ? Math.max(baseRoll(), baseRoll())   // Advantage: roll twice, keep higher
    : baseRoll();

  if (roll < dc) {
    return dropConcentration(entity);
  }

  return entity;
}

// ── HP damage with temp HP absorption ────────────────────────────────────────

/**
 * Applies damage to an entity.
 * Temp HP absorbs damage first before it touches current HP.
 * Also fires a concentration check if the entity is concentrating.
 */
export function applyDamage(
  entity:      Entity,
  damage:      number,
  rules:       CampaignRules = DEFAULT_RULES
): Entity {
  if (damage <= 0) return entity;

  const { hp } = entity.resources;
  const wasAtZero    = hp.current === 0;
  const tempAbsorbed = Math.min(hp.temp, damage);
  const remainingDmg = damage - tempAbsorbed;
  const newCurrent   = Math.max(0, hp.current - remainingDmg);

  // Death saves: dropping to 0 for the first time starts a fresh count —
  // unless the deathSavesPersist house rule is on, in which case accumulated
  // failures from a prior dying episode carry over (cleared only by a long
  // rest, see rest.ts). Successes/stable always reset on a fresh drop either
  // way — only failures are ever persisted.
  // Taking damage while ALREADY at 0 HP counts as one automatic failure
  // (book rule) — this only applies to real damage getting through, not
  // damage fully absorbed by temp HP while already at 0.
  let deathSaves = entity.resources.deathSaves;
  if (newCurrent === 0 && !wasAtZero) {
    deathSaves = {
      successes: 0,
      failures:  deathSavesPersist(rules) ? deathSaves.failures : 0,
      stable:    false,
    };
  } else if (newCurrent === 0 && wasAtZero && remainingDmg > 0 && !deathSaves.stable) {
    deathSaves = {
      ...deathSaves,
      failures: Math.min(3, deathSaves.failures + 1),
    };
  }

  const updated = {
    ...entity,
    resources: {
      ...entity.resources,
      hp: {
        ...hp,
        current: newCurrent,
        temp:    hp.temp - tempAbsorbed,
      },
      deathSaves,
    },
  };

  // Concentration check is the player's responsibility via the UI modal.
  // Do NOT call concentrationCheck here — it would run twice alongside the UI roll.
  return recomputeDerived(updated, rules);
}

/** Heals an entity, capped at maximum HP. Any healing above 0 HP clears death saves. */
export function applyHealing(
  entity:  Entity,
  amount:  number,
  rules:   CampaignRules = DEFAULT_RULES
): Entity {
  if (amount <= 0) return entity;
  const newCurrent = Math.min(
    entity.resources.hp.maximum,
    entity.resources.hp.current + amount
  );
  const updated = {
    ...entity,
    resources: {
      ...entity.resources,
      hp: { ...entity.resources.hp, current: newCurrent },
      deathSaves: newCurrent > 0
        ? { successes: 0, failures: 0, stable: false }
        : entity.resources.deathSaves,
    },
  };
  return recomputeDerived(updated, rules);
}

/**
 * Records one death saving throw result while an entity is at 0 HP.
 * Success on 3 -> stable (stops rolling; still at 0 HP until healed).
 * Failure on 3 -> dead (UI is responsible for showing this state; the
 * engine doesn't have a separate "dead" flag beyond failures === 3).
 * A natural 20 (isNatural20) instead heals 1 HP immediately and clears
 * both counters, per the book rule — call applyHealing(entity, 1, rules)
 * from the UI in that case instead of this function.
 * No-op if already stable, already dead, or entity isn't at 0 HP.
 */
export function recordDeathSave(
  entity:  Entity,
  outcome: 'success' | 'failure',
  rules:   CampaignRules = DEFAULT_RULES
): Entity {
  const { hp, deathSaves } = entity.resources;
  if (hp.current !== 0) return entity;
  if (deathSaves.stable || deathSaves.failures >= 3) return entity;

  const next = outcome === 'success'
    ? { ...deathSaves, successes: Math.min(3, deathSaves.successes + 1) }
    : { ...deathSaves, failures:  Math.min(3, deathSaves.failures  + 1) };
  const stabilized = { ...next, stable: next.successes >= 3 };

  const updated = {
    ...entity,
    resources: { ...entity.resources, deathSaves: stabilized },
  };
  return recomputeDerived(updated, rules);
}

/**
 * Applies the non-dice AbilityEffects of a used Feature to the entity.
 *
 * BEFORE this existed, tapping "Use" on a card only spent its resource cost
 * (see app/components/sheet/TabActions.tsx) — the actual AbilityEffects were
 * never applied. This meant Rage's `set_flag: rage_active` never fired, so
 * Rage's damage-resistance effects (gated on that same flag in
 * collectAllEffects) silently never activated even though the resource was
 * spent and the card displayed correctly. Discovered while building Wild
 * Shape, which needed the same missing plumbing for its `transform` effect —
 * see docs/ROADMAP_1.0.md Phase 3.4 for the full writeup.
 *
 * Deliberately does NOT handle 'damage'/'heal' here — those stay a manual
 * player decision via the roll modal + HP modal, consistent with the app
 * having no attack-roll/hit resolution anywhere else. Everything else
 * (set_flag, transform) is a pure state change on the player's own entity
 * that has no combat-resolution ambiguity, so it applies immediately.
 *
 * Effect types not yet handled here (apply_condition, remove_condition,
 * grant_speed, restore_resource, spend_resource beyond the base cost) are
 * intentionally left for a future pass — not silently claimed as done.
 */
export function applyAbilityEffects(
  entity:  Entity,
  effects: AbilityEffect[],
  rules:   CampaignRules = DEFAULT_RULES,
): Entity {
  let updated = entity;

  for (const effect of effects) {
    if (effect.type === 'set_flag') {
      updated = {
        ...updated,
        conditionMonitor: {
          ...updated.conditionMonitor,
          flags: { ...updated.conditionMonitor.flags, [effect.flag]: effect.value },
        },
      };
    } else if (effect.type === 'transform') {
      updated = startWildShape(updated, effect.formId, rules);
    }
    // 'damage' / 'heal': intentionally left to the manual roll+HP-modal flow.
    // 'apply_condition' / 'remove_condition' / 'grant_speed' / 'restore_resource'
    // / 'spend_resource': not yet wired — see the doc comment above.
  }

  return recomputeDerived(updated, rules);
}

/**
 * Starts Wild Shape: sets wildShapeState, which recomputeDerived (pipeline.ts)
 * reads to swap AC/speed/senses/movement/physical stats to the beast form's
 * while keeping the player's own mental scores and class features — same
 * non-mutating "apply on top" philosophy as DmOverride. The beast's own HP
 * pool is tracked separately in wildShapeState.beastHp; the player's real HP
 * is untouched and resumes exactly where it was on revert.
 * No-op if already transformed or the formId doesn't exist.
 */
export function startWildShape(
  entity: Entity,
  formId: string,
  rules:  CampaignRules = DEFAULT_RULES,
): Entity {
  if (entity.wildShapeState?.active) return entity;
  const form = ALL_BEAST_FORMS.find(f => f.id === formId);
  if (!form) return entity;

  // Duration: half druid level in hours, minimum 1 (book rule). Falls back to
  // character level if this isn't (yet) tracked as a separate class level.
  const hours = Math.max(1, Math.floor(entity.identity.level / 2));

  const updated: Entity = {
    ...entity,
    wildShapeState: {
      active:     true,
      formId:     form.id,
      beastHp:    form.hp,
      beastHpMax: form.hp,
      expiresAt:  { unit: 'hours', remaining: hours },
    },
  };
  return recomputeDerived(updated, rules);
}

/**
 * Ends Wild Shape, reverting to the player's normal stats. Per the book rule,
 * excess damage the beast form took does NOT carry over to the player's real
 * HP — only the state that was tracked is discarded; the player's own HP was
 * never touched while transformed, so it's simply already correct on revert.
 * Safe to call even if not currently transformed (no-op).
 */
export function endWildShape(
  entity: Entity,
  rules:  CampaignRules = DEFAULT_RULES,
): Entity {
  if (!entity.wildShapeState?.active) return entity;
  const updated: Entity = { ...entity, wildShapeState: null };
  return recomputeDerived(updated, rules);
}

/**
 * Applies damage to a Wild-Shaped entity's BEAST hp pool, not the player's
 * real HP. Per the book rule, if the beast's hp pool hits 0, the player
 * reverts to their normal form immediately with 0 hp gained/lost beyond
 * what was already on their sheet — excess damage past the beast's pool does
 * NOT carry over. Call this INSTEAD of applyDamage while transformed; the
 * caller (UI) is responsible for checking wildShapeState.active first.
 */
export function applyWildShapeDamage(
  entity: Entity,
  damage: number,
  rules:  CampaignRules = DEFAULT_RULES,
): Entity {
  if (!entity.wildShapeState?.active || damage <= 0) return entity;
  const newBeastHp = Math.max(0, entity.wildShapeState.beastHp - damage);

  if (newBeastHp === 0) {
    // Beast form "dies" -> revert immediately, no carryover damage.
    return endWildShape(entity, rules);
  }
  const updated: Entity = {
    ...entity,
    wildShapeState: { ...entity.wildShapeState, beastHp: newBeastHp },
  };
  return recomputeDerived(updated, rules);
}

/**
 * Applies temporary HP.
 * Temp HP does not stack — keep whichever pool is larger.
 */
export function applyTempHP(
  entity:  Entity,
  amount:  number,
  rules:   CampaignRules = DEFAULT_RULES
): Entity {
  if (amount <= entity.resources.hp.temp) return entity; // Current pool is larger
  const updated = {
    ...entity,
    resources: {
      ...entity.resources,
      hp: { ...entity.resources.hp, temp: amount },
    },
  };
  return recomputeDerived(updated, rules);
}
