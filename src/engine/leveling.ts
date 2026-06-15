import { Entity, Grant, ChoiceDefinition, CampaignRules, ResourceGrant, ProficiencyGrant,
         ResourceUpgrade, FeatureInstance, Feature, ClassProgression, Ability, SpellSlots,
         KnownSpellsGrant } from './types';
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
      // Merge the granted proficiencies into the entity's proficiency block.
      // The grant value is a ProficiencyGrant: { armor?, weapons?, tools?, languages? }.
      // We deduplicate each list so re-applying on class change is safe.
      const g = grant.value as ProficiencyGrant;
      const merge = (existing: string[], additions?: string[]) =>
        additions ? [...new Set([...existing, ...additions])] : existing;
      return {
        ...entity,
        proficiencies: {
          ...entity.proficiencies,
          armor:     merge(entity.proficiencies.armor,     g.armor),
          weapons:   merge(entity.proficiencies.weapons,   g.weapons),
          tools:     merge(entity.proficiencies.tools,     g.tools),
          languages: merge(entity.proficiencies.languages, g.languages),
        },
      };
    }

    case "subclass_unlock": {
      // Queue a pending subclass choice so it surfaces in the Features tab's
      // Pending Choices section. Without authored subclass content, the player
      // resolves this with their DM. When subclass content is authored, this
      // choice will be replaced with a proper pool of subclass options.
      const choiceId = `subclass_unlock_${atLevel}`;
      const alreadyQueued = entity.choices.some(c => c.id === choiceId);
      if (alreadyQueued) return entity;
      const subclassChoice: ChoiceDefinition = {
        id:       choiceId,
        prompt:   `Choose your ${entity.identity.classId} subclass`,
        kind:     'custom',
        count:    1,
        pool:     [],
        grants:   [],
        required: true,
        resolved: false,
      };
      return {
        ...entity,
        choices: [...entity.choices, {
          id:          choiceId,
          definition:  subclassChoice,
          grantedAt:   atLevel,
          resolved:    false,
          selections:  [],
        }],
      };
    }

    case "speed": {
      // Adds a permanent bonus to the entity's base speed (stored in resources.speed).
      // Used for class-granted speed increases like Barbarian Fast Movement (+10 ft).
      // The pipeline reads entity.resources.speed as the base and adds/sets on top
      // via stat_modifier effects, so modifying resources.speed here is the right
      // home for permanent class bonuses.
      const speedBonus = grant.value as number;
      return {
        ...entity,
        resources: {
          ...entity.resources,
          speed: entity.resources.speed + speedBonus,
        },
      };
    }

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

    case "known_spells": {
      // Adds fixed known spells/cantrips to an already-initialized spellcasting
      // block. No-op if spellcasting hasn't been initialized yet — order the
      // 'init_spellcasting' grant earlier in the same level entry's grants array.
      const ks = grant.value as KnownSpellsGrant;
      if (!entity.spellcasting) return entity;
      return {
        ...entity,
        spellcasting: {
          ...entity.spellcasting,
          known:    [...new Set([...entity.spellcasting.known,    ...(ks.spellIds   ?? [])])],
          cantrips: [...new Set([...entity.spellcasting.cantrips, ...(ks.cantripIds ?? [])])],
        },
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

// ── reconcileConHp ─────────────────────────────────────────────────────────────

/**
 * PHB "Beyond 1st Level": when your Constitution modifier increases, your hit
 * point maximum increases by 1 for each level you have attained (and the reverse
 * if it drops). Call this after a PERMANENT Constitution change (an ASI or a
 * feat) to adjust max HP by (Δ CON modifier × level) WITHOUT recomputing rolled
 * HP from scratch — so a character who rolled HP keeps those rolls.
 *
 * `prev` = entity before the change, `next` = entity after. Current HP moves
 * with maximum so the increase isn't "lost" as if the character were damaged.
 */
export function reconcileConHp(prev: Entity, next: Entity): Entity {
  const level = next.identity.level;
  if (level <= 0) return next;

  const prevCon = applyStatModifiers(prev.stats, collectAllEffects(prev)).con;
  const nextCon = applyStatModifiers(next.stats, collectAllEffects(next)).con;
  const delta   = modifier(nextCon) - modifier(prevCon);
  if (delta === 0) return next;

  const hpDelta = delta * level;
  return {
    ...next,
    resources: {
      ...next.resources,
      hp: {
        ...next.resources.hp,
        maximum: Math.max(1, next.resources.hp.maximum + hpDelta),
        current: Math.max(0, next.resources.hp.current + hpDelta),
      },
    },
  };
}

// ── reapplyResolvedAsi ─────────────────────────────────────────────────────────

/**
 * Re-applies every RESOLVED ASI selection on top of the entity's CURRENT base
 * stats. Needed because ASI increases live in base stats, and the scores screen
 * overwrites base stats wholesale — without this, re-confirming scores after
 * resolving an ASI silently erased the improvement (and since the choice stayed
 * resolved, it could never be taken again). Feat-based resolutions live in
 * features and are unaffected by a stat overwrite, so they're skipped here.
 *
 * Selections are parsed from the labels applyAsiToEntity stores, e.g.
 * 'con+2' or 'str+1,dex+1'. Each re-applied increase is capped by effective-
 * score headroom, mirroring applyAsiToEntity.
 */
export function reapplyResolvedAsi(entity: Entity, rules: CampaignRules): Entity {
  const asiChoices = entity.choices.filter(
    c => c.definition.kind === 'asi' && c.resolved
  );
  if (asiChoices.length === 0) return entity;

  const maxScore = rules.maxAbilityScore ?? 20;
  const effects  = collectAllEffects(entity);
  const newStats = { ...entity.stats };

  let changed = false;
  for (const choice of asiChoices) {
    for (const sel of choice.selections) {
      for (const part of sel.split(',')) {
        const m = part.trim().match(/^(str|dex|con|int|wis|cha)\+(\d+)$/);
        if (!m) continue;                       // 'feat:…', 'no_change', etc.
        const ab  = m[1] as Ability;
        const inc = parseInt(m[2], 10);
        const effective = applyStatModifiers(newStats, effects)[ab];
        const headroom  = Math.max(0, maxScore - effective);
        const applied   = Math.min(inc, headroom);
        if (applied > 0) {
          newStats[ab] += applied;
          changed = true;
        }
      }
    }
  }
  return changed ? { ...entity, stats: newStats } : entity;
}

/**
 * Subtracts every resolved ASI's recorded increases from base stats.
 * Used when class data is cleared (class re-selection): the ASI choices are
 * about to be dropped and re-queued by the new class, so their stat bumps must
 * not survive as ghosts — otherwise resolving the new class's ASI stacks on top
 * (+2 STR becomes +4). Selections are the same parseable labels
 * applyAsiToEntity records ('con+2', 'str+1,dex+1'); feat selections are
 * skipped (feat features are removed separately).
 */
export function stripResolvedAsiStats(entity: Entity): Entity {
  const asiChoices = entity.choices.filter(
    c => c.definition.kind === 'asi' && c.resolved
  );
  if (asiChoices.length === 0) return entity;

  const newStats = { ...entity.stats };
  let changed = false;
  for (const choice of asiChoices) {
    for (const sel of choice.selections) {
      for (const part of sel.split(',')) {
        const m = part.trim().match(/^(str|dex|con|int|wis|cha)\+(\d+)$/);
        if (!m) continue;
        const ab  = m[1] as Ability;
        const dec = parseInt(m[2], 10);
        newStats[ab] = Math.max(1, newStats[ab] - dec);
        changed = true;
      }
    }
  }
  return changed ? { ...entity, stats: newStats } : entity;
}

// ── ASI / Feat resolution ───────────────────────────────────────────────────────

/**
 * Resolves an ASI choice by raising base ability scores (capped at the rules
 * maximum), marking the choice resolved, applying the retroactive CON→HP rule,
 * and recomputing derived stats. Used by both creation and in-play level-up.
 */
export function applyAsiToEntity(
  entity:    Entity,
  choiceId:  string,
  increases: Partial<Record<Ability, number>>,
  rules:     CampaignRules,
): Entity {
  const maxScore = rules.maxAbilityScore ?? 20;
  // Cap against EFFECTIVE scores (base + racial/feat effects), not base stats.
  // A Mountain Dwarf with base STR 18 is effectively 20 — no headroom left.
  const effective = applyStatModifiers(entity.stats, collectAllEffects(entity));
  const newStats  = { ...entity.stats };
  const applied: Partial<Record<Ability, number>> = {};
  for (const ab of Object.keys(increases) as Ability[]) {
    const headroom = Math.max(0, maxScore - effective[ab]);
    const inc      = Math.min(increases[ab] ?? 0, headroom);
    if (inc > 0) {
      newStats[ab] = newStats[ab] + inc;
      applied[ab]  = inc;
    }
  }
  const label = (Object.entries(applied) as [Ability, number][])
    .map(([ab, n]) => `${ab}+${n}`)
    .join(',') || 'no_change';

  let updated: Entity = {
    ...entity,
    stats: newStats,
    choices: entity.choices.map(c =>
      c.id === choiceId ? { ...c, resolved: true, selections: [label] } : c
    ),
  };
  updated = reconcileConHp(entity, updated);
  return recomputeDerived(updated, rules);
}

/**
 * Resolves an ASI choice by taking a feat instead. Adds the feat's Feature
 * through the standard grant path (so its automated Effects fire normally),
 * marks the choice resolved, applies the retroactive CON→HP rule (feats that
 * raise CON count too), and recomputes. Takes a Feature, not a Feat, so the
 * engine stays free of content imports.
 */
export function applyFeatToEntity(
  entity:      Entity,
  choiceId:    string,
  grantedAt:   number,
  featFeature: Feature,
  featId:      string,
  rules:       CampaignRules,
): Entity {
  let updated = applyGrant(entity, { kind: 'feature', value: featFeature }, grantedAt);
  updated = {
    ...updated,
    choices: updated.choices.map(c =>
      c.id === choiceId ? { ...c, resolved: true, selections: [`feat:${featId}`] } : c
    ),
  };
  updated = reconcileConHp(entity, updated);
  return recomputeDerived(updated, rules);
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

    // Spell slots: refresh from the PHB table for this level so a caster's slots
    // grow automatically every level. Without this, progressions would each need
    // an explicit spell_slots grant per level (only level 1 has one), so leveling
    // a Wizard 1->5 would leave them stuck on level-1 slots. Preserves `used`.
    if (updated.spellcasting) {
      const slotArr = getSpellSlotsForClassLevel(updated.identity.classId, lvl);
      if (slotArr) {
        const tiers = ['1','2','3','4','5','6','7','8','9'] as const;
        const newSlots = { ...updated.spellcasting.slots };
        tiers.forEach((t, i) => {
          const total = slotArr[i];
          const used  = Math.min(newSlots[t]?.used ?? 0, total);
          newSlots[t] = { total, used };
        });
        updated = { ...updated, spellcasting: { ...updated.spellcasting, slots: newSlots } };
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