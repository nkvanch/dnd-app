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
  Ability, SkillName, DERIVED_NUMERIC_KEYS, Sense, AttackBonus, AuditSourceKind,
} from './types';
import { resolveEffectsForTarget, resolveBinary, resolveCombine } from './resolver';
import { ALL_BEAST_FORMS } from '../content/beastforms';
import { generateAllActionCards } from './actionCards';
import { itemRepo } from '../content/itemRepo';
import { isMartialWeapon } from '../content/items/itemBrowse';
import { useHomebrewStore } from '../store/homebrewStore';
import { effectiveItemFeatures, effectiveWeaponAttackFeatures, isItemMechanicallyActive, itemWearsArmorOrShield, resolveItemDefinition } from './itemMechanics';
import { getClassEntry } from './multiclass';
import { deriveProficienciesFromEntitlements, initializeEntitlementInputs, recomputeResourceMaximums } from './entitlements';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Standard 5e ability score → modifier formula. */
export const modifier = (score: number): number => Math.floor((score - 10) / 2);

/** Standard 5e proficiency bonus formula. Shared with audit.ts so the two can't drift. */
export const proficiencyBonus = (level: number): number => Math.ceil(1 + level / 4);

/** The "8" every 5e save DC starts from (spell save, ki save, ability-based DC). */
export const AC_DC_BASE = 8;

/** Standard 5e DC formula: 8 + proficiency + ability modifier. */
export const abilityDC = (prof: number, mod: number): number => AC_DC_BASE + prof + mod;

/** One base_ac_formula effect's resolved value, with enough source identity
 * for audit.ts to label it (recomputeDerived only needs .total). */
export type AcFormulaCandidate = {
  label: string; kind: AuditSourceKind; id: string;
  base: number; abilities: Ability[]; total: number;
};

/**
 * Picks the winning base_ac_formula effect (Unarmored Defense, Mage Armor,
 * etc.) — 5e rule: you use whichever formula gives the higher AC, formulas
 * never stack with each other. Shared by recomputeDerived (armor fallback
 * chain) and audit.ts's AC breakdown so they can never compute a different
 * winner. Returns null when no base_ac_formula effect is active.
 */
export function selectBestAcFormula(
  allEffects:     ActiveEffect[],
  effectiveStats: Entity['stats'],
): AcFormulaCandidate | null {
  const formulaEffects = allEffects.filter(ae => ae.effect.type === 'base_ac_formula');
  if (formulaEffects.length === 0) return null;
  const candidates = formulaEffects.map((ae): AcFormulaCandidate => {
    const baseValue = ae.effect.value as number;
    const abilities = (ae.effect.formulaAbilities ?? []) as Ability[];
    const abilityBonus = abilities.reduce((sum, ab) => {
      const rawMod = modifier(effectiveStats[ab]);
      // formulaAbilityCap: e.g. { dex: 2 } for medium armor (PHB p.144)
      const cap = ae.effect.formulaAbilityCap?.[ab];
      return sum + (cap !== undefined ? Math.min(rawMod, cap) : rawMod);
    }, 0);
    return {
      label: ae.sourceName, kind: ae.sourceKind ?? 'base', id: ae.sourceId,
      base: baseValue, abilities, total: baseValue + abilityBonus,
    };
  });
  return candidates.reduce((a, b) => (b.total > a.total ? b : a));
}

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
    const relevant = effects.filter(
      ae => ae.effect.type === 'stat_modifier' && ae.effect.target === ab
    );
    if (relevant.length === 0) continue;
    // Bug fix: this used to pick the 'set' effect by array order ("last
    // one wins"), which is order-dependent — shuffling collectAllEffects's
    // iteration order could change which 'set' effect won, and therefore
    // the character's effective ability score. resolveCombine (resolver.ts)
    // already resolves competing 'set' effects order-independently
    // (highest value wins) for ac/speed/every other stat_modifier target;
    // this now uses the exact same function, and the exact same "does a
    // 'set' exist? then that resolved value IS the score; otherwise add
    // the resolved (additive-only) delta to base" pattern speed already
    // uses just below (see the "Speed: respect 'set' operations" block).
    const hasSet   = relevant.some(ae => ae.effect.operation === 'set');
    const resolved = resolveCombine(relevant);
    result[ab] = hasSet ? resolved : base[ab] + resolved;
  }
  return result;
}

export function effectiveAbilityScores(entity: Entity): Entity['stats'] {
  const scores = applyStatModifiers(entity.stats, collectAllEffects(entity));
  for (const override of [...(entity.characterOverrides ?? []).filter(o=>o.active).sort((a,b)=>a.appliedAt-b.appliedAt), ...(entity.dmOverrides ?? []).filter(o=>o.active).sort((a,b)=>a.appliedAt-b.appliedAt)].filter(o => (['str','dex','con','int','wis','cha'] as string[]).includes(o.stat))) {
    const ability = override.stat as Ability; scores[ability] = override.operation === 'set' ? override.value : scores[ability] + override.value;
  }
  return scores;
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
  let entity = recomputeResourceMaximums(initializeEntitlementInputs(entityParam));

  const allEffects    = collectAllEffects(entity);
  let effectiveStats = applyStatModifiers(entity.stats, allEffects);
  const profBonus     = proficiencyBonus(entity.identity.level);

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

  // Ability-score DM replacements/additions feed every dependent derived value.
  for (const override of [...(entity.characterOverrides ?? []), ...(entity.dmOverrides ?? [])].filter(o => o.active && (['str','dex','con','int','wis','cha'] as string[]).includes(o.stat))) {
    const ability = override.stat as Ability;
    effectiveStats[ability] = override.operation === 'set' ? override.value : effectiveStats[ability] + override.value;
  }

  // Authoritative inputs: persisted entitlements and currently active effects.
  // Every flat grant field below is compatibility output, never an ownership oracle.
  const profEffects = allEffects.filter(ae => ae.effect.type === 'grant_proficiency');
  const newGrantedSkills = new Set<SkillName>();
  const newExpertiseSkills = new Set<SkillName>();
  const newGrantedTools: string[] = [];
  const newGrantedWeapons: string[] = [];
  const newGrantedArmor: string[] = [];
  const newGrantedLanguages: string[] = [];

  // Entitlement-derived contribution — folded into the SAME newGranted*
  // sets the active-effect loop below also populates. Neither reads prior output.
  const entDerived = deriveProficienciesFromEntitlements(entity);
  for (const s of entDerived.skills.trained)   newGrantedSkills.add(s);
  for (const s of entDerived.skills.expertise) newExpertiseSkills.add(s);
  for (const t of entDerived.tools)     if (!newGrantedTools.some(x => x.toLowerCase() === t.toLowerCase()))     newGrantedTools.push(t);
  for (const w of entDerived.weapons)   if (!newGrantedWeapons.some(x => x.toLowerCase() === w.toLowerCase())) newGrantedWeapons.push(w);
  for (const a of entDerived.armor)     if (!newGrantedArmor.some(x => x.toLowerCase() === a.toLowerCase()))   newGrantedArmor.push(a);
  for (const l of entDerived.languages) if (!newGrantedLanguages.some(x => x.toLowerCase() === l.toLowerCase())) newGrantedLanguages.push(l);

  for (const ae of profEffects) {
    // target format: 'skill:perception', 'skill:athletics', etc.
    if (ae.effect.target.startsWith('skill:')) {
      const skillName = ae.effect.target.slice(6) as SkillName;
      if (ae.effect.operation === 'add') newGrantedSkills.add(skillName);
      else if (ae.effect.operation === 'multiply') { newGrantedSkills.add(skillName); newExpertiseSkills.add(skillName); }
    }
    // target format: 'tool:thieves_tools', 'tool:herbalism_kit', etc.
    if (ae.effect.target.startsWith('tool:') && ae.effect.operation === 'add') {
      const toolName = ae.effect.target.slice(5).replace(/_/g, ' ');
      if (!newGrantedTools.some(t => t.toLowerCase() === toolName.toLowerCase())) newGrantedTools.push(toolName);
    }
    // target format: 'weapon:rapier', 'weapon:battleaxe', etc.
    if (ae.effect.target.startsWith('weapon:') && ae.effect.operation === 'add') {
      const weaponName = ae.effect.target.slice(7).replace(/_/g, ' ');
      if (!newGrantedWeapons.some(w => w.toLowerCase() === weaponName.toLowerCase())) newGrantedWeapons.push(weaponName);
    }
    // target format: 'armor:light', 'armor:medium', 'armor:heavy', 'armor:shields'
    if (ae.effect.target.startsWith('armor:') && ae.effect.operation === 'add') {
      const armorName = ae.effect.target.slice(6).replace(/_/g, ' ');
      if (!newGrantedArmor.some(a => a.toLowerCase() === armorName.toLowerCase())) newGrantedArmor.push(armorName);
    }
  }

  // Skills: project current authoritative grants.
  let updatedSkills = entity.skills.skills;
  let skillsChanged = false;
  for (const skillName of Object.keys(updatedSkills) as SkillName[]) {
    const existing = updatedSkills[skillName];
    if (!existing) continue;
    const finalTrained = newGrantedSkills.has(skillName) || newExpertiseSkills.has(skillName);
    const finalExpertise = newExpertiseSkills.has(skillName);
    if (finalTrained !== existing.trained || finalExpertise !== existing.expertise) {
      if (!skillsChanged) updatedSkills = { ...updatedSkills };
      updatedSkills[skillName] = { ...existing, trained: finalTrained, expertise: finalExpertise };
      skillsChanged = true;
    }
  }
  if (skillsChanged) {
    entity = { ...entity, skills: { skills: updatedSkills } };
  }

  entity = {
    ...entity,
    proficiencies: { ...entity.proficiencies, tools: newGrantedTools,
      weapons: newGrantedWeapons, armor: newGrantedArmor, languages: newGrantedLanguages },
    spellcasting: entity.spellcasting ? { ...entity.spellcasting,
      known: entDerived.spells, cantrips: entDerived.cantrips } : null,
  };

  // ── Base AC resolution (priority order) ──────────────────────────────────
  // 1. base_ac_formula effects (Unarmored Defense, Mage Armor, etc.)
  //    formulaAbilities adds modifier(stat) for each listed ability.
  // 2. entity.resources.ac  (set when armor is equipped — 0 = no armor)
  // 3. Fallback: 10 + DEX modifier
  const acFormula        = beastForm ? null : selectBestAcFormula(allEffects, effectiveStats);
  const calculatedBaseAc = beastForm
    ? beastForm.ac
    : acFormula
      ? acFormula.total
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
    // Bug fix (architecture review U7): a passive-score-targeted
    // stat_modifier effect (e.g. Observant's +5 to passive Perception and
    // passive Investigation) used to be silently ignored here — unlike
    // every other derived stat below, which folds in its own
    // resolveEffectsForTarget term on top of the base formula.
    passivePerception:    10 + resolveSkill(entity, effectiveStats, 'perception', allEffects, profBonus)
                            + (resolveEffectsForTarget('passivePerception', allEffects, rules) as number),
    passiveInvestigation: 10 + resolveSkill(entity, effectiveStats, 'investigation', allEffects, profBonus)
                            + (resolveEffectsForTarget('passiveInvestigation', allEffects, rules) as number),
    passiveInsight:       10 + resolveSkill(entity, effectiveStats, 'insight', allEffects, profBonus)
                            + (resolveEffectsForTarget('passiveInsight', allEffects, rules) as number),
    senses,
    movement,
    savingThrows:     resolveSavingThrows(effectiveStats, entity.proficiencies.savingThrows, profBonus, allEffects, rules),
    attackBonuses:    computeWeaponAttackBonuses(entity, effectiveStats, profBonus),
    advantageStates,
    spellSaveDC:  entity.spellcasting
      ? abilityDC(profBonus, modifier(effectiveStats[entity.spellcasting.ability]))
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
    // Monk's ki-ability save DC (Stunning Strike, etc.) — always WIS-based,
    // separate from spellSaveDC since Monk has no entity.spellcasting block.
    kiSaveDC: entity.features.some(f => f.id === 'martial_arts')
      ? abilityDC(profBonus, modifier(effectiveStats.wis))
          + (resolveEffectsForTarget('ki_save_dc', allEffects, rules) as number)
      : null,
    // Generic 8 + prof + ability mod, precomputed for every ability — any
    // non-caster class feature with its own save DC (Barbarian's
    // Intimidating Presence is STR-based, etc.) references the one it
    // needs via requiresSave.dc = { ability: 'str' } etc. Always populated,
    // unlike kiSaveDC/spellSaveDC — no per-class gating check needed since
    // a feature only ever points at this if it actually has one.
    abilityBasedDC: {
      str: abilityDC(profBonus, modifier(effectiveStats.str)),
      dex: abilityDC(profBonus, modifier(effectiveStats.dex)),
      con: abilityDC(profBonus, modifier(effectiveStats.con)),
      int: abilityDC(profBonus, modifier(effectiveStats.int)),
      wis: abilityDC(profBonus, modifier(effectiveStats.wis)),
      cha: abilityDC(profBonus, modifier(effectiveStats.cha)),
    },
  };

  // ── Apply DM overrides LAST ───────────────────────────────────────────────
  // Scalar numeric fields (DERIVED_NUMERIC_KEYS):
  const mutableDerived = derived as unknown as Record<string, number | null>;
  for (const override of [...(entity.characterOverrides ?? []), ...(entity.dmOverrides ?? [])].filter(o => o.active)) {
    if (!DERIVED_NUMERIC_KEYS.has(override.stat)) continue;
    const current = (mutableDerived[override.stat] as number) ?? 0;
    mutableDerived[override.stat] =
      override.operation === 'set' ? override.value : current + override.value;
  }

  // SIG-1: Saving throw DM overrides (e.g. "savingThrows.str")
  for (const override of [...(entity.characterOverrides ?? []), ...(entity.dmOverrides ?? [])].filter(o => o.active)) {
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

      // Gate: skip a situational effect (item 9 — a real-world fact the
      // engine can't observe, e.g. "an ally within 5 feet") unless the
      // player/DM has explicitly answered Yes. Unanswered and explicit No
      // are treated identically — conservative, never silently overstates
      // a bonus. See Effect.situational's own doc comment.
      if (effect.situational && entity.situationalAnswers?.[effect.situational.id] !== true) continue;

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
        sourceKind: fi.source.kind,
      });
    }
  }

  // 2. Equipped items — features fire while the item is worn/wielded.
  //    Re-audit A17: an item that REQUIRES attunement must not contribute
  //    anything until actually attuned — merely equipping it used to be
  //    enough (an unattuned Ring of Protection still gave +1 AC). Items
  //    with no attunement requirement (requiresAttunement falsy) are
  //    unaffected — their effects always fired on equip and still do.
  // Re-audit A19: whether ANY equipped item is armor/a shield — computed
  // once, outside the per-item loop, so an effect declaring
  // requiresNoArmorOrShield can check "is something ELSE equipped that
  // counts" without an O(n^2) rescan. Deliberately counts every equipped
  // item, including the one this effect's own feature lives on (Bracers of
  // Defense itself is neither armor nor a shield, so this is correct for
  // it; a hypothetical future item that WAS both armor and had its own
  // requiresNoArmorOrShield effect would be a contradiction in the content
  // itself, not something this predicate needs to resolve).
  const anyArmorOrShieldEquipped = entity.inventory.equipped.some(i => {
    const definition = resolveItemDefinition(i.itemId);
    return definition ? itemWearsArmorOrShield(definition) : i.wearsArmorOrShield === true;
  });

  for (const item of entity.inventory.equipped) {
    const definition = resolveItemDefinition(item.itemId);
    if (!isItemMechanicallyActive(item, definition)) continue;
    const itemFeatures = effectiveItemFeatures(item, definition);
    for (const fi of itemFeatures) {
      for (const effect of fi.effects) {
        if (effect.condition !== null) {
          const flagActive      = activeFlags[effect.condition] === true;
          const conditionActive = activeConditionIds.has(effect.condition);
          if (!flagActive && !conditionActive) continue;
        }
        if (effect.requiresNoArmorOrShield && anyArmorOrShieldEquipped) continue;
        if (effect.situational && entity.situationalAnswers?.[effect.situational.id] !== true) continue;
        effects.push({
          effect,
          sourceName: fi.name,
          sourceId:   item.itemId,
          appliedAt:  0,
          sourceKind: 'item',
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

/**
 * Re-audit A18: whether the entity is actually proficient with this specific
 * weapon — either by name (a racial/feat grant naming an exact weapon, e.g.
 * Elf Weapon Training's "longsword") or by category ('simple'/'martial',
 * granted by class/background/race — the same entity.proficiencies.weapons
 * array applyGrant('proficiency', ...) and the grant_proficiency Effect
 * reconciler both write into). Reuses itemBrowse.ts's already-built
 * isMartialWeapon() classifier (name-table lookup, falling back to
 * property-text parsing) rather than a second one — weapon items carry no
 * "simple weapon"/"martial weapon" property tag of their own to check
 * directly.
 */
function isProficientWithWeapon(entity: Entity, def: { name: string; properties: string[] }): boolean {
  const weaponProfs = entity.proficiencies.weapons.map(w => w.toLowerCase());
  if (weaponProfs.includes(def.name.toLowerCase())) return true;
  const martial = isMartialWeapon({
    id: '', name: def.name, weight: 0, cost: '', properties: def.properties,
    hasDamageEffect: true, weaponRange: null,
  });
  return weaponProfs.includes(martial ? 'martial' : 'simple');
}

/**
 * Computes to-hit and damage info for every equipped weapon. Single source
 * of truth — TabCharacter's ATTACKS section and each weapon's action card
 * both read this instead of recomputing (they used to, independently, and
 * had drifted: one used max(str,dex) for ranged weapons, which is wrong
 * per RAW, and one read raw base stats instead of effect-modified ones).
 */
function computeWeaponAttackBonuses(
  entity:         Entity,
  effectiveStats: Entity['stats'],
  profBonus:      number,
): AttackBonus[] {
  const strMod = modifier(effectiveStats.str);
  const dexMod = modifier(effectiveStats.dex);
  const result: AttackBonus[] = [];

  for (const inst of entity.inventory.equipped) {
    // Re-audit A17: an attunement-required weapon contributes no attack
    // bonus until actually attuned — same gate collectAllEffects applies to
    // passive effects and actionCards.ts applies to action cards, reusing
    // the same hydrated flag (see ItemInstance's own doc comment).
    const activeDefinition = resolveItemDefinition(inst.itemId);
    if (!isItemMechanicallyActive(inst, activeDefinition)) continue;
    // itemRepo only ever holds the OFFICIAL catalog — a homebrew weapon's
    // definition lives in homebrewStore instead, so it needs the same
    // fallback lookup as characterStore.ts's hydrateItemFeatures, or every
    // homebrew weapon silently gets no to-hit bonus computed for it here.
    const def = itemRepo.getItemSync(inst.itemId)
      ?? useHomebrewStore.getState().items.find(i => i.id === inst.itemId);
    if (!def) continue;

    // Prefer the instance's own (possibly infusion-augmented) features,
    // same fallback actionCards.ts's card generator already uses — older
    // saves may have only an itemId with no hydrated features.
    const feats = effectiveWeaponAttackFeatures(inst, def);
    let dice: string | null = null;
    let dmgType = '';
    let featureName = def.name;
    for (const f of feats) {
      const dmgFx = (f.abilityEffects ?? []).find(ae => ae.type === 'damage');
      if (dmgFx) { dice = dmgFx.dice; dmgType = dmgFx.damageType; featureName = f.name; break; }
    }
    if (!dice) continue;

    const props = def.properties.map(p => p.toLowerCase());
    const isFinesse = props.some(p => p.includes('finesse'));
    // Re-audit A18: ranged means "ammunition" ONLY — a thrown weapon's own
    // property text always reads like "thrown (range 20/60)", which
    // contains the substring "range" too, so the OLD second clause
    // (`thrown && range`) was true for EVERY thrown weapon, not just true
    // ranged ones. Per RAW, a thrown weapon uses the SAME ability modifier
    // whether thrown or swung in melee (finesse already lets it pick DEX
    // above; a non-finesse thrown weapon like a Handaxe is STR either way)
    // — there is no "thrown weapon used at range" ability distinction to
    // make here, since this app has no melee/ranged choice for thrown
    // attacks. `type` below still reflects true ranged weapons only.
    const isRanged = props.some(p => p.includes('ammunition'));

    let mod: number;
    let ability: 'str' | 'dex';
    if (isFinesse) {
      ability = dexMod >= strMod ? 'dex' : 'str';
      mod = Math.max(strMod, dexMod);
    } else if (isRanged) {
      ability = 'dex'; mod = dexMod;
    } else {
      ability = 'str'; mod = strMod;
    }

    // Magic bonus (+1/+2/+3), parsed from name/feature-name/properties text.
    const magicHay = [def.name, featureName, ...def.properties].join(' ');
    const magicBonus = parseInt(magicHay.match(/\+(\d)\b/)?.[1] ?? '0', 10);

    // Re-audit A18: proficiency bonus only applies when the character is
    // actually proficient with this weapon — it used to be added
    // unconditionally. Checks the same weapon-category/named-weapon
    // proficiency list entitlements already flow into
    // entity.proficiencies.weapons (category tags 'simple'/'martial' plus
    // any specific named weapons a feature/race/background grants).
    const isProficient = isProficientWithWeapon(entity, def);

    result.push({
      id:          inst.itemId,
      name:        def.name,
      bonus:       (isProficient ? profBonus : 0) + mod + magicBonus,
      type:        isRanged ? 'ranged' : 'melee',
      ability,
      damageBonus: mod + magicBonus,
      damageDice:  dice,
      damageType:  dmgType,
    });
  }

  // Unarmed Strike — always available (PHB pg 195: 1 + STR mod bludgeoning),
  // regardless of what's equipped. Martial Arts (Monk) upgrades the die
  // (scaling with MONK level specifically, not total character level, so a
  // multiclassed monk/fighter still gets the right die) and unlocks DEX as
  // an option for the attack/damage roll, same finesse-style
  // max(str,dex) rule as a finesse weapon above.
  const hasMartialArts = entity.features.some(f => f.id === 'martial_arts');
  let unarmedDice = '1';
  let unarmedAbility: 'str' | 'dex' = 'str';
  let unarmedMod = strMod;
  if (hasMartialArts) {
    const monkLevel = getClassEntry(entity, 'monk')?.level ?? entity.identity.level;
    unarmedDice = monkLevel >= 17 ? '1d10' : monkLevel >= 11 ? '1d8' : monkLevel >= 5 ? '1d6' : '1d4';
    unarmedAbility = dexMod >= strMod ? 'dex' : 'str';
    unarmedMod = Math.max(strMod, dexMod);
  }
  result.push({
    id: 'unarmed_strike', name: 'Unarmed Strike',
    bonus: profBonus + unarmedMod, type: 'melee', ability: unarmedAbility,
    damageBonus: unarmedMod, damageDice: unarmedDice, damageType: 'bludgeoning',
  });

  return result;
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
  effects:      ActiveEffect[],
  rules:        CampaignRules,
): Record<Ability, number> {
  const abilities: Ability[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
  const output = {} as Record<Ability, number>;
  for (const ab of abilities) {
    const base  = modifier(stats[ab]) + (proficientIn.includes(ab) ? prof : 0);
    // Reuses the savingThrows.<ability> target convention DM overrides
    // already use (see the "SIG-1" override loop above) so item/feat
    // effects and DM overrides share one naming scheme.
    const bonus = resolveEffectsForTarget(`savingThrows.${ab}`, effects, rules) as number;
    output[ab] = base + bonus;
  }
  return output;
}
