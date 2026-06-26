// ============================================================================
// FILE: src/engine/combat.ts
// PROJECT: Initiative Tracker, Concentration Gate & Combat Clock
// ============================================================================
import { Entity, CampaignRules, Spell, FeatureInstance } from './types';
import { recomputeDerived } from './pipeline';
import { tickDurations } from './conditions';
import { rollD20 as rollD20Dice } from './dice';
import { DEFAULT_RULES } from '../store/characterStore';

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
  const tempAbsorbed  = Math.min(hp.temp, damage);
  const remainingDmg  = damage - tempAbsorbed;
  const newCurrent    = Math.max(0, hp.current - remainingDmg);

  const updated = {
    ...entity,
    resources: {
      ...entity.resources,
      hp: {
        ...hp,
        current: newCurrent,
        temp:    hp.temp - tempAbsorbed,
      },
    },
  };

  // Concentration check is the player's responsibility via the UI modal.
  // Do NOT call concentrationCheck here — it would run twice alongside the UI roll.
  return recomputeDerived(updated, rules);
}

/** Heals an entity, capped at maximum HP. */
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
    },
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
