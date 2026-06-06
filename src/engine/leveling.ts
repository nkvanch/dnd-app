import { Entity, Grant, ChoiceDefinition, CampaignRules, ResourceGrant,
         ResourceUpgrade, FeatureInstance, ClassProgression, Ability, SpellSlots } from './types';
import { recomputeDerived, modifier, collectAllEffects, applyStatModifiers } from './pipeline';
import { getSpellSlotsForClassLevel } from '../content/classes/spellSlotTables';

// ── helpers ──────────────────────────────────────────────────────────────────

export function rollDie(sides: number): number {
  return Math.floor(Math.random() * sides) + 1;
}

// ── applyGrant ────────────────────────────────────────────────────────────────

export function applyGrant(entity: Entity, grant: Grant, atLevel: number): Entity {
  switch (grant.kind) {

    case "feature": {
      const f = grant.value as FeatureInstance;
      return {
        ...entity,
        features: [...entity.features, {
          ...f,
          source: f.source ?? { kind: "class", refId: entity.identity.classId },
          level:  atLevel,
          isActive: true,
        }]
      };
    }

    case "resource": {
      const r = grant.value as ResourceGrant;
      // Don't add duplicates
      if (entity.resources.custom.some(c => c.id === r.resourceId)) return entity;
      return {
        ...entity,
        resources: {
          ...entity.resources,
          custom: [...entity.resources.custom, {
            id: r.resourceId, name: r.name,
            current: r.maximum, maximum: r.maximum,
            recharge: r.recharge
          }]
        }
      };
    }

    case "resource_upgrade": {
      const u = grant.value as ResourceUpgrade;
      return {
        ...entity,
        resources: {
          ...entity.resources,
          custom: entity.resources.custom.map(r =>
            r.id === u.resourceId ? { ...r, maximum: u.newMaximum, current: u.newMaximum } : r
          )
        }
      };
    }

    case "proficiency": {
      // TODO: categorise by armor/weapon/tool and append to correct proficiency list
      return entity;
    }

    case "subclass_unlock":
    case "speed":
      return entity; // TODO in later steps

    case "init_spellcasting": {
      // Initialise the spellcasting block for a spellcasting class (called once).
      const sc = grant.value as { ability: Ability };
      if (entity.spellcasting) return entity; // already initialised — no-op
      const emptySlots = Object.fromEntries(
        ['1','2','3','4','5','6','7','8','9'].map(t => [t, { total: 0, used: 0 }])
      ) as SpellSlots;
      return {
        ...entity,
        spellcasting: {
          ability:       sc.ability,
          slots:         emptySlots,
          cantrips:      [],
          known:         [],
          prepared:      [],
          concentrating: null,
        },
      };
    }

    case "spell_slots": {
      // Set spell slot totals from the PHB table for this class at this level.
      const slotGrant = grant.value as { level: number };
      const slots = getSpellSlotsForClassLevel(entity.identity.classId, slotGrant.level);
      if (!slots || !entity.spellcasting) return entity;
      const tiers = ['1','2','3','4','5','6','7','8','9'] as const;
      const newSlots = { ...entity.spellcasting.slots };
      tiers.forEach((t, i) => {
        const total = slots[i];
        if (total > 0) {
          const existingUsed = newSlots[t]?.used ?? 0;
          newSlots[t] = { total, used: Math.min(existingUsed, total) };
        }
      });
      return {
        ...entity,
        spellcasting: { ...entity.spellcasting, slots: newSlots },
      };
    }

    default:
      return entity;
  }
}

// ── HP per level ──────────────────────────────────────────────────────────────

export function applyHP(
  entity: Entity,
  die: number,
  mode: CampaignRules["hpMode"],
  atLevel: number
): Entity {
  // Use effectiveStats.con so race bonuses (e.g. Dwarf +2 CON) feed into HP.
  // This matters even mid-wizard if the player set scores before choosing class.
  const allEffects    = collectAllEffects(entity);
  const effectiveStats = applyStatModifiers(entity.stats, allEffects);
  const conMod        = modifier(effectiveStats.con);

  const rolled = atLevel === 1
    ? die                                           // Level 1: always max die
    : mode === "max"    ? die
    : mode === "fixed"  ? Math.floor(die / 2) + 1
    : rollDie(die);

  const gain = Math.max(1, rolled + conMod);

  return {
    ...entity,
    resources: {
      ...entity.resources,
      hp: {
        current: entity.resources.hp.current + gain,
        maximum: entity.resources.hp.maximum + gain,
        temp:    entity.resources.hp.temp
      },
      hitDice: {
        die,
        total:     entity.resources.hitDice.total + 1,
        remaining: entity.resources.hitDice.remaining + 1
      }
    }
  };
}

// ── recalculateAllHP ─────────────────────────────────────────────────────────

/**
 * Recalculates the character's total HP from scratch using their FINAL ability
 * scores (after race bonuses) and their class hit die.
 *
 * Call this in the review step, AFTER recomputeDerived(), so that race bonuses
 * from features have been applied to effectiveStats before HP is computed.
 *
 * Creation order mismatch fix: if the player chose class before setting scores,
 * HP was computed with CON mod 0. This corrects it.
 *
 * Level 1:   always max die + CON mod (minimum 1).
 * Level 2+:  fixed = floor(die/2)+1+CON mod, max = die+CON mod (min 1 each).
 */
export function recalculateAllHP(entity: Entity, rules: CampaignRules): Entity {
  const level = entity.identity.level;
  if (level <= 0) return entity;

  const die  = entity.resources.hitDice.die;

  // Use effectiveStats so race bonuses count
  const allEffects     = collectAllEffects(entity);
  const effectiveStats = applyStatModifiers(entity.stats, allEffects);
  const conMod         = modifier(effectiveStats.con);

  // Level 1: always max die
  let totalHP = Math.max(1, die + conMod);

  // Levels 2+
  for (let lvl = 2; lvl <= level; lvl++) {
    const gained = rules.hpMode === 'max'
      ? die + conMod
      : Math.floor(die / 2) + 1 + conMod;
    totalHP += Math.max(1, gained);
  }

  return {
    ...entity,
    resources: {
      ...entity.resources,
      hp: { current: totalHP, maximum: totalHP, temp: 0 },
      hitDice: { ...entity.resources.hitDice, total: level, remaining: level },
    },
  };
}

// ── canAutoResolve ────────────────────────────────────────────────────────────

function canAutoResolve(choice: ChoiceDefinition): boolean {
  if (choice.kind === "asi")  return false;
  if (choice.kind === "feat") return false;
  if (choice.kind === "spell") return false;
  if (Array.isArray(choice.pool)) {
    return choice.pool.length === choice.count;
  }
  return false;
}

// ── queueChoice ───────────────────────────────────────────────────────────────

function queueChoice(entity: Entity, choice: ChoiceDefinition, atLevel: number): Entity {
  return {
    ...entity,
    choices: [...entity.choices, {
      id:          `${choice.id}_${atLevel}`,
      definition:  choice,
      grantedAt:   atLevel,
      resolved:    false,
      selections:  []
    }]
  };
}

// ── levelUp ───────────────────────────────────────────────────────────────────

export function levelUp(
  entity: Entity,
  targetLevel: number,
  progression: ClassProgression,
  rules: CampaignRules
): Entity {
  let updated = entity;
  const startLevel = updated.identity.level;

  for (let lvl = startLevel + 1; lvl <= targetLevel; lvl++) {
    const entry = progression.entries.find(e => e.level === lvl);
    if (!entry) continue;

    // HP
    updated = applyHP(updated, entry.hpDie, rules.hpMode, lvl);

    // Grants
    for (const grant of entry.grants) {
      updated = applyGrant(updated, grant, lvl);
    }

    // Choices
    for (const choice of entry.choices) {
      if (canAutoResolve(choice)) {
        if (Array.isArray(choice.pool) && choice.pool.length > 0) {
          for (const grant of choice.grants) {
            updated = applyGrant(updated, grant, lvl);
          }
        }
      } else {
        updated = queueChoice(updated, choice, lvl);
      }
    }

    updated = { ...updated, identity: { ...updated.identity, level: lvl } };
  }

  return recomputeDerived(updated, rules);
}

// ── resolveChoice ─────────────────────────────────────────────────────────────

export function resolveChoice(
  entity: Entity,
  choiceId: string,
  selections: string[],
  rules: CampaignRules
): Entity {
  const pending = entity.choices.find(c => c.id === choiceId);
  if (!pending) throw new Error(`Choice not found: ${choiceId}`);
  if (selections.length !== pending.definition.count) {
    throw new Error(`Expected ${pending.definition.count} selections, got ${selections.length}`);
  }

  let updated = entity;

  for (const selId of selections) {
    if (!Array.isArray(pending.definition.pool)) continue;
    const option = pending.definition.pool.find(o => o.id === selId);
    if (!option) throw new Error(`Invalid selection: ${selId}`);

    for (const grant of pending.definition.grants) {
      updated = applyGrant(updated, grant, pending.grantedAt);
    }

    // Equipment choices: the option's value is an array of item IDs.
    // Add each as a fresh ItemInstance to the carried inventory.
    if (pending.definition.kind === "equipment") {
      const itemIds = Array.isArray(option.value) ? (option.value as string[]) : [];
      for (const itemId of itemIds) {
        updated = {
          ...updated,
          inventory: {
            ...updated.inventory,
            carried: [
              ...updated.inventory.carried,
              { itemId, quantity: 1, attuned: false, features: [] },
            ],
          },
        };
      }
    }

    // Skill choices: mark the skill as trained
    if (pending.definition.kind === "skill") {
      const skillName = option.value as string;
      if (updated.skills.skills[skillName as keyof typeof updated.skills.skills]) {
        updated = {
          ...updated,
          skills: {
            skills: {
              ...updated.skills.skills,
              [skillName]: {
                ...updated.skills.skills[skillName as keyof typeof updated.skills.skills],
                trained: true
              }
            }
          }
        };
      }
    }
  }

  updated = {
    ...updated,
    choices: updated.choices.map(c =>
      c.id === choiceId ? { ...c, resolved: true, selections } : c
    )
  };

  return recomputeDerived(updated, rules);
}