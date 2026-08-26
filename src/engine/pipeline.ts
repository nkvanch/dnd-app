// ============================================================================
// FILE: src/engine/pipeline.ts
// PROJECT: Derived Stat Computation Engine
//
// PIPELINE ORDER (last applied = highest priority):
//   Base stats → Feature passive effects → Equipment effects →
//   Condition effects → Campaign rule clamps → DM Overrides (wins over all)
//
// recomputeDerived() is pure and cheap — call it after every mutation.
// The UI always reads from entity.derived and never computes stats itself.
// ============================================================================

import {
  Entity, CampaignRules, DerivedStats, ActiveEffect,
  Ability, SkillName, DERIVED_NUMERIC_KEYS, Sense,
} from './types';
import { resolveEffectsForTarget, resolveBinary } from './resolver';
import { ALL_BEAST_FORMS } from '../content/beastforms';
import { generateAllActionCards } from './actionCards';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Standard 5e ability score → modifier formula. */
export const modifier = (score: number): number => Math.floor((score - 10) / 2);

/**
 * Applies all stat_modifier passive effects that target an ability score
 * (str/dex/con/int/wis/cha) on top of the base scores.
 * This is what makes race bonuses (+1 STR etc.) feed into
 * modifier calculations for AC, initiative, saves, and skills.
 * Exported so leveling.ts can compute effectiveStats.con for HP calculations.
 */
// Explicitly exported so the Abilities tab and AsiFeatPicker can display
// effective scores (base + race/feat effects) rather than raw base stats.
export function applyStatModifiers(
  base:    Entity['stats'],
  effects: ActiveEffect[],
): Entity['stats'] {
  const abilities: Ability[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
  const result = { ...base };
  for (const ab of abilities) {
    for (const ae of effects) {
      if (
        ae.effect.type      === 'stat_modifier' &&
        ae.effect.target    === ab &&
        ae.effect.operation === 'add' &&
        typeof ae.effect.value === 'number'
      ) {
        result[ab] += ae.effect.value;
      }
    }
  }
  return result;
}

// ── Main pipeline ─────────────────────────────────────────────────────────────

/**
 * Recomputes all derived statistics for an entity from scratch.
 * Call this after every state mutation — it is intentionally cheap.
 *
 * DM overrides are applied LAST and win over everything else.
 * They never modify entity.stats or entity.features.
 */
export function recomputeDerived(entityParam: Entity, rules: CampaignRules): Entity {
  // Use a mutable local reference so we can apply grant_proficiency effects
  let entity = entityParam;

  const allEffects    = collectAllEffects(entity);
  let effectiveStats = applyStatModifiers(entity.stats, allEffects);
  const profBonus     = Math.ceil(1 + entity.identity.level / 4);

  // ── Wild Shape: physical stats (STR/DEX/CON) come from the beast form;
  //    mental scores (INT/WIS/CHA) stay the player's own, per the book rule
  //    ("you retain your own... Intelligence, Wisdom, and Charisma scores").
  //    Same non-mutating "apply on top" philosophy as DmOverride — nothing
  //    here touches entity.stats itself. See docs/ROADMAP_1.0.md "FEATURE
  //    DESIGN: Wild Shape".
  const beastForm = entity.wildShapeState?.active
    ? ALL_BEAST_FORMS.find(f => f.id === entity.wildShapeState!.formId) ?? null
    : null;
  if (beastForm) {
    effectiveStats = {
      ...effectiveStats,
      str: beastForm.stats.str,
      dex: beastForm.stats.dex,
      con: beastForm.stats.con,
    };
  }

  // ── Apply grant_proficiency effects to the skill block ────────────────────
  // These come from race/class features (Elf Keen Senses → Perception, etc.)
  const profEffects = allEffects.filter(ae => ae.effect.type === 'grant_proficiency');
  if (profEffects.length > 0) {
    let updatedSkills = { ...entity.skills.skills };
    let updatedTools   = [...entity.proficiencies.tools];
    let changed = false;
    let toolsChanged = false;
    for (const ae of profEffects) {
      // target format: 'skill:perception', 'skill:athletics', etc.
      if (ae.effect.target.startsWith('skill:')) {
        const skillName = ae.effect.target.slice(6) as SkillName;
        const existing  = updatedSkills[skillName];
        if (existing) {
          if (ae.effect.operation === 'add' && !existing.trained) {
            updatedSkills = { ...updatedSkills, [skillName]: { ...existing, trained: true } };
            changed = true;
          } else if (ae.effect.operation === 'multiply' && !existing.expertise) {
            // multiply = expertise (double proficiency)
            updatedSkills = {
              ...updatedSkills,
              [skillName]: { ...existing, trained: true, expertise: true },
            };
            changed = true;
          }
        }
      }
      // target format: 'tool:thieves_tools', 'tool:herbalism_kit', etc. — same
      // pattern as skills, previously declared in the type system (Effect.type
      // already included 'grant_proficiency') but this branch never existed,
      // so a trait authored with a tool: target was silently a no-op even
      // though a builder UI could have let someone create it.
      if (ae.effect.target.startsWith('tool:') && ae.effect.operation === 'add') {
        const toolName = ae.effect.target.slice(5).replace(/_/g, ' ');
        if (!updatedTools.some(t => t.toLowerCase() === toolName.toLowerCase())) {
          updatedTools = [...updatedTools, toolName];
          toolsChanged = true;
        }
      }
    }
    if (changed) {
      entity = { ...entity, skills: { skills: updatedSkills } };
    }
    if (toolsChanged) {
      entity = { ...entity, proficiencies: { ...entity.proficiencies, tools: updatedTools } };
    }
  }

  // ── Base AC resolution (priority order) ──────────────────────────────────
  // 1. base_ac_formula effects (Unarmored Defense, Mage Armor, etc.)
  //    formulaAbilities adds modifier(stat) for each listed ability.
  // 2. entity.resources.ac  (set when armor is equipped — 0 = no armor)
  // 3. Fallback: 10 + DEX modifier
  const formulaEffects   = allEffects.filter(ae => ae.effect.type === 'base_ac_formula');
  const calculatedBaseAc = beastForm
    ? beastForm.ac
    : formulaEffects.length > 0
      ? Math.max(...formulaEffects.map(ae => {
          const baseValue    = ae.effect.value as number;
          const abilityBonus = (ae.effect.formulaAbilities ?? [])
            .reduce((sum, ab) => {
              const rawMod = modifier(effectiveStats[ab]);
              // formulaAbilityCap: e.g. { dex: 2 } for medium armor (PHB p.144)
              const cap    = ae.effect.formulaAbilityCap?.[ab];
              return sum + (cap !== undefined ? Math.min(rawMod, cap) : rawMod);
            }, 0);
          return baseValue + abilityBonus;
        }))
      : entity.resources.ac > 0
        ? entity.resources.ac
        : 10 + modifier(effectiveStats.dex);

  // Beast form AC is a flat total (no magic armor while transformed) — skip
  // the shield/magic-bonus stacking that normally applies on top.
  const acBonus = beastForm ? 0 : (resolveEffectsForTarget(
    'ac',
    allEffects.filter(ae => ae.effect.type !== 'base_ac_formula'),
    rules,
  ) as number);

  // ── Speed: respect 'set' operations (Dwarf/Halfling/Gnome 25 ft) ─────────
  const speedEffects  = allEffects.filter(ae => ae.effect.target === 'speed');
  const hasSetSpeed   = speedEffects.some(ae => ae.effect.operation === 'set');
  const speedResolved = resolveEffectsForTarget('speed', allEffects, rules) as number;
  const finalSpeed    = beastForm
    ? beastForm.speed
    : hasSetSpeed
      ? speedResolved
      : entity.resources.speed + speedResolved;

  // ── Senses: aggregate grant_sense effects, dedup by type (largest range) ──
  const senseEffects = allEffects.filter(ae => ae.effect.type === 'grant_sense');
  const senseMap = new Map<string, Sense>();
  for (const ae of senseEffects) {
    const e = ae.effect;
    if (!e.senseType) continue;
    const range = e.senseRange ?? 0;
    const existing = senseMap.get(e.senseType);
    // Keep the longest-range instance of each sense type; carry its note.
    if (!existing || range > existing.range) {
      senseMap.set(e.senseType, { type: e.senseType, range, note: e.senseNote });
    }
  }
  // Beast form senses fully replace the player's own while transformed — you
  // perceive the world as the beast does, per the book rule.
  const senses = beastForm
    ? (beastForm.senses ?? [])
    : Array.from(senseMap.values()).sort((a, b) => b.range - a.range);

  // ── Movement: aggregate grant_movement effects, keep largest per type ──
  const moveEffects = allEffects.filter(ae => ae.effect.type === 'grant_movement');
  const movement: import('./types').MovementSpeeds = beastForm
    ? {
        ...(beastForm.flySpeed   ? { fly:   beastForm.flySpeed }   : {}),
        ...(beastForm.swimSpeed  ? { swim:  beastForm.swimSpeed }  : {}),
        ...(beastForm.climbSpeed ? { climb: beastForm.climbSpeed } : {}),
      }
    : {};
  if (!beastForm) {
    for (const ae of moveEffects) {
      const t = ae.effect.movementType;
      const r = ae.effect.movementRange ?? 0;
      if (!t) continue;
      if ((movement[t] ?? 0) < r) movement[t] = r;
    }
  }

  // ── Build derived stats object ────────────────────────────────────────────
  const advDisadvEffects = allEffects.filter(ae =>
    ae.effect.operation === 'advantage' || ae.effect.operation === 'disadvantage'
  );
  const advTargets = new Set(advDisadvEffects.map(ae => ae.effect.target));
  const advantageStates: DerivedStats['advantageStates'] = [];
  for (const target of advTargets) {
    const state = resolveBinary(advDisadvEffects.filter(ae => ae.effect.target === target));
    if (state !== 'straight') advantageStates.push({ target, state });
  }

  const derived: DerivedStats = {
    proficiencyBonus: profBonus,
    ac:               calculatedBaseAc + acBonus,
    initiative:       modifier(effectiveStats.dex)
                        + (resolveEffectsForTarget('initiative', allEffects, rules) as number),
    speed:            finalSpeed,
    passivePerception:    10 + resolveSkill(entity, effectiveStats, 'perception', allEffects, profBonus),
    passiveInvestigation: 10 + resolveSkill(entity, effectiveStats, 'investigation', allEffects, profBonus),
    passiveInsight:       10 + resolveSkill(entity, effectiveStats, 'insight', allEffects, profBonus),
    senses,
    movement,
    savingThrows:     resolveSavingThrows(effectiveStats, entity.proficiencies.savingThrows, profBonus),
    attackBonuses:    [],
    advantageStates,
    spellSaveDC:  entity.spellcasting
      ? 8 + profBonus + modifier(effectiveStats[entity.spellcasting.ability])
          // Accept either target spelling so feature authors aren't tripped by
          // the snake_case/camelCase split (DM overrides use 'spellSaveDC').
          + (resolveEffectsForTarget('spell_save_dc', allEffects, rules) as number)
          + (resolveEffectsForTarget('spellSaveDC', allEffects, rules) as number)
      : null,
    spellAttackBonus: entity.spellcasting
      ? profBonus + modifier(effectiveStats[entity.spellcasting.ability])
          + (resolveEffectsForTarget('spell_attack_bonus', allEffects, rules) as number)
          + (resolveEffectsForTarget('spellAttackBonus', allEffects, rules) as number)
      : null,
  };

  // ── Apply DM overrides LAST ───────────────────────────────────────────────
  // Scalar numeric fields (DERIVED_NUMERIC_KEYS):
  const mutableDerived = derived as unknown as Record<string, number | null>;
  for (const override of (entity.dmOverrides ?? []).filter(o => o.active)) {
    if (!DERIVED_NUMERIC_KEYS.has(override.stat)) continue;
    const current = (mutableDerived[override.stat] as number) ?? 0;
    mutableDerived[override.stat] =
      override.operation === 'set' ? override.value : current + override.value;
  }

  // SIG-1: Saving throw DM overrides (e.g. "savingThrows.str")
  for (const override of (entity.dmOverrides ?? []).filter(o => o.active)) {
    if (!override.stat.startsWith('savingThrows.')) continue;
    const ability = override.stat.slice('savingThrows.'.length) as Ability;
    if (!(['str','dex','con','int','wis','cha'] as string[]).includes(ability)) continue;
    const current = derived.savingThrows[ability] ?? 0;
    derived.savingThrows[ability] = override.operation === 'set'
      ? override.value
      : current + override.value;
  }

  const withDerived = { ...entity, derived };

  // Action cards depend on the just-computed `derived` (available-slot
  // checks, etc.) and on entity.features/inventory — compute them once,
  // here, at the single choke point every mutation passes through, instead
  // of leaving each consuming tab to regenerate them on every render (the
  // actual cause of the "elementary operations lag" this was built to fix
  // — see the SQLite/render-loop plan). Safe to call synchronously:
  // spellRepo/itemRepo's Tier-2 caches are guaranteed warm for every id
  // this entity references by the time any mutation reaches here.
  return { ...withDerived, actionCards: generateAllActionCards(withDerived, rules) };
}

// ── Effect collection ─────────────────────────────────────────────────────────

/**
 * Collects all active passive Effects from every source on the entity:
 * features, equipped items, and condition-sourced features.
 *
 * Skips effects whose `condition` flag is not set in conditionMonitor.flags
 * or in the active condition list (e.g. Rage effects skip when rage is not active).
 * Skips effects from conditions whose suppressedBy list includes a relevant suppressor
 * (e.g. Blindsight silences Blinded's attack penalties without removing the condition).
 */
export function collectAllEffects(entity: Entity): ActiveEffect[] {
  const effects: ActiveEffect[]       = [];
  const activeFlags                   = entity.conditionMonitor.flags;
  const activeConditionIds            = new Set(entity.conditions.map(c => c.id));

  // 1. Features from race, class, background, feats, spells, etc.
  for (const fi of entity.features) {
    if (!fi.isActive) continue;

    for (const effect of fi.effects) {
      // Gate: skip if effect requires a flag or condition that is not active
      if (effect.condition !== null) {
        const flagActive      = activeFlags[effect.condition] === true;
        const conditionActive = activeConditionIds.has(effect.condition);
        if (!flagActive && !conditionActive) continue;
      }

      // Gate: skip if this feature's source condition has its effects suppressed
      if (fi.source.kind === 'condition') {
        const sourceCond = entity.conditions.find(c => c.id === fi.source.refId);
        if (sourceCond && sourceCond.suppressedBy.length > 0) {
          const suppressed = sourceCond.suppressedBy.some(suppressorId =>
            doesSuppressTarget(entity, suppressorId, effect.target)
          );
          if (suppressed) continue;
        }
      }

      effects.push({
        effect,
        sourceName: fi.name,
        sourceId:   fi.id,
        appliedAt:  fi.level ?? 0,
      });
    }
  }

  // 2. Equipped items — features fire while the item is worn/wielded
  for (const item of entity.inventory.equipped) {
    for (const fi of item.features) {
      for (const effect of fi.effects) {
        if (effect.condition !== null) {
          const flagActive      = activeFlags[effect.condition] === true;
          const conditionActive = activeConditionIds.has(effect.condition);
          if (!flagActive && !conditionActive) continue;
        }
        effects.push({
          effect,
          sourceName: fi.name,
          sourceId:   item.itemId,
          appliedAt:  0,
        });
      }
    }
  }

  return effects;
}

// ── Private helpers ───────────────────────────────────────────────────────────

/**
 * Returns true if the suppressor feature silences the given effect target.
 */
function doesSuppressTarget(
  entity:      Entity,
  suppressorId: string,
  effectTarget: string,
): boolean {
  const suppressor = entity.features.find(f => f.id === suppressorId);
  if (!suppressor) return false;
  return suppressor.effects.some(
    e =>
      e.type === 'suppress_condition_effects' &&
      Array.isArray(e.value) &&
      (e.value as string[]).includes(effectTarget),
  );
}

/** Computes the final bonus for a single skill. */
function resolveSkill(
  entity:  Entity,
  stats:   Entity['stats'],
  skill:   SkillName,
  effects: ActiveEffect[],
  prof:    number,
): number {
  const entry = entity.skills.skills[skill];
  if (!entry) return 0;
  const baseMod        = modifier(stats[entry.ability]);
  const profMultiplier = entry.expertise ? 2 : entry.trained ? 1 : 0;
  const baseScore      = baseMod + prof * profMultiplier + (entry.bonus ?? 0);

  // Apply stat_modifier effects targeting this specific skill
  // target format: 'skill.perception', 'skill.athletics', etc.
  const skillBonus = effects
    .filter(ae =>
      ae.effect.type      === 'stat_modifier' &&
      ae.effect.target    === `skill.${skill}` &&
      ae.effect.operation === 'add' &&
      typeof ae.effect.value === 'number'
    )
    .reduce((sum, ae) => sum + (ae.effect.value as number), 0);

  return baseScore + skillBonus;
}

/** Computes saving throw bonus for all six abilities. */
function resolveSavingThrows(
  stats:        Entity['stats'],
  proficientIn: Ability[],
  prof:         number,
): Record<Ability, number> {
  const abilities: Ability[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
  const output = {} as Record<Ability, number>;
  for (const ab of abilities) {
    output[ab] = modifier(stats[ab]) + (proficientIn.includes(ab) ? prof : 0);
  }
  return output;
}
