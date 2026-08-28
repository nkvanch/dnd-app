import { Entity, Grant, ChoiceDefinition, CampaignRules, ResourceGrant, ProficiencyGrant,
         ResourceUpgrade, FeatureInstance, Feature, ClassProgression, Ability, SpellSlots,
         KnownSpellsGrant } from './types';
import { recomputeDerived, modifier, collectAllEffects, applyStatModifiers } from './pipeline';
import { getSpellSlotsForClassLevel, multiclassCasterLevel, MULTICLASS_SPELLCASTER_SLOTS,
         pactSlotTableFor, slotsForLevel } from '../content/classes/spellSlotTables';
import { hpMinHalfDie, bonusFeatEveryLevel } from './houseRules';
import { getClassLevels, isMulticlassed, syncLegacyIdentity, multiclassProficienciesFor } from './multiclass';

// ── helpers ──────────────────────────────────────────────────────────────────

export function rollDie(sides: number): number {
  return Math.floor(Math.random() * sides) + 1;
}

// ── applyGrant ────────────────────────────────────────────────────────────────

export function applyGrant(entity: Entity, grant: Grant, atLevel: number, classId?: string): Entity {
  switch (grant.kind) {

    case "feature": {
      const f = grant.value as FeatureInstance;
      let next: Entity = {
        ...entity,
        features: [...entity.features, {
          ...f,
          source: f.source ?? { kind: "class", refId: classId ?? entity.identity.classId },
          level:  atLevel,
          isActive: true,
        }]
      };

      // Process any grant_spell effects on this feature. This is how racial
      // features like the Skeleton's Doomed Touch ("you know chill touch")
      // actually add the cantrip. It initialises a spellcasting block if the
      // entity has none yet (a non-caster gaining a racial cantrip), using the
      // effect's spellcastingAbility (default CON for racial grants).
      const spellEffects = (f.effects ?? []).filter(e => e.type === 'grant_spell');
      for (const eff of spellEffects) {
        const cantripIds = (eff as any).cantripIds as string[] | undefined;
        const spellIds   = (eff as any).spellIds   as string[] | undefined;
        const ability    = ((eff as any).spellcastingAbility as Ability) ?? 'con';

        if (!next.spellcasting) {
          const emptySlots = Object.fromEntries(
            ['1','2','3','4','5','6','7','8','9'].map(t => [t, { total: 0, used: 0 }])
          ) as SpellSlots;
          next = {
            ...next,
            spellcasting: {
              ability, slots: emptySlots,
              cantrips: [], known: [], prepared: [], concentrating: null,
            },
          };
        }
        next = {
          ...next,
          spellcasting: {
            ...next.spellcasting!,
            cantrips: [...new Set([...next.spellcasting!.cantrips, ...(cantripIds ?? [])])],
            known:    [...new Set([...next.spellcasting!.known,    ...(spellIds   ?? [])])],
          },
        };
      }

      return next;
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
      // Pending Choices section. Uses the same 'subclass' kind as every
      // authored class choice, so it opens the real SubclassPicker (which
      // already merges official + homebrew subclasses via
      // subclassEntriesForClassMerged, and shows a graceful empty state if
      // none exist yet) instead of falling through to the generic
      // "ask your DM" placeholder.
      // choiceId is namespaced by the OWNING class (not just atLevel) so a
      // multiclass character with two classes unlocking a subclass at the
      // same within-class level (e.g. two homebrew classes both unlocking at
      // their own level 3) don't collide and silently drop the second one.
      const grantClassId = classId ?? entity.identity.classId;
      const choiceId = `subclass_unlock_${grantClassId}_${atLevel}`;
      const alreadyQueued = entity.choices.some(c => c.id === choiceId);
      if (alreadyQueued) return entity;
      const subclassChoice: ChoiceDefinition = {
        id:       choiceId,
        prompt:   `Choose your ${grantClassId} subclass`,
        kind:     'subclass',
        count:    1,
        pool:     [],
        grants:   [],
        required: true,
        resolved: false,
        forClassId: grantClassId,
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
      // Initialise the spellcasting block for a spellcasting class.
      // If a racial feature (e.g. Skeleton Doomed Touch) already created the
      // block with a default ability (CON), this UPGRADES the ability to the
      // class's real casting ability (e.g. Abyss Knight CHA) while preserving
      // any cantrips/known spells the racial grant already added.
      const sc = grant.value as { ability: Ability };
      if (entity.spellcasting) {
        return {
          ...entity,
          spellcasting: { ...entity.spellcasting, ability: sc.ability },
        };
      }
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
      // Set spell slot totals from the table for this class at this level.
      // For homebrew classes the slotsTable may be embedded directly in the
      // grant value; otherwise we look up by classId.
      const slotGrant = grant.value as {
        level:      number;
        slotsTable?: { level: number; slots: number[] }[];
      };
      const slotRow: number[] | null = slotGrant.slotsTable
        ? (slotGrant.slotsTable.find(r => r.level === slotGrant.level)?.slots ?? null)
        : getSpellSlotsForClassLevel(classId ?? entity.identity.classId, slotGrant.level);
      if (!slotRow || !entity.spellcasting) return entity;
      const slots = slotRow;
      const tiers = ['1','2','3','4','5','6','7','8','9'] as const;
      // Always zero ALL tiers before applying the new row. The row represents
      // the COMPLETE slot state at this level — zeroing first is what makes
      // pact-magic tier upgrades work correctly (e.g. Abyss Knight level 4
      // replaces tier-1 slots with tier-2 slots; without zeroing, tier-1
      // would persist alongside the new tier-2 allocation).
      const newSlots = {} as typeof entity.spellcasting.slots;
      tiers.forEach((t, i) => {
        const total = slots[i] ?? 0;
        newSlots[t] = { total, used: Math.min(entity.spellcasting!.slots[t]?.used ?? 0, total) };
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

    case "starting_item": {
      // Fixed gear granted automatically at level 1 — no player choice, unlike
      // the existing 'equipment' CHOICE kind (which needs a pool of
      // alternatives). Adds a fresh ItemInstance to carried inventory, same
      // shape resolveChoice's equipment handling already produces.
      const itemId = grant.value as string;
      return {
        ...entity,
        inventory: {
          ...entity.inventory,
          carried: [...entity.inventory.carried, { itemId, quantity: 1, attuned: false, features: [] }],
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
  atLevel: number,
  rules?: CampaignRules,
  hpAbility: Ability = 'con',
  /**
   * Whether this is the character's very first level EVER (max die,
   * standard 5e RAW) — defaults to `atLevel === 1`, which is exactly right
   * for single-class characters (levelUp() only ever passes atLevel=1 once,
   * at creation). Multiclass callers (levelUpClass()) pass this explicitly:
   * a SECOND class's own level 1 must NOT re-max HP, only the character's
   * true first level does.
   */
  isVeryFirstLevel: boolean = atLevel === 1,
): Entity {
  // Use effectiveStats[hpAbility] so race bonuses (e.g. Dwarf +2 CON) feed
  // into HP. Defaults to CON (standard 5e RAW) — every existing class passes
  // no explicit ability and is completely unaffected. hpAbility lets a
  // homebrew class reflavor HP around a different score (e.g. CHA).
  const allEffects    = collectAllEffects(entity);
  const effectiveStats = applyStatModifiers(entity.stats, allEffects);
  const abilityMod    = modifier(effectiveStats[hpAbility]);

  let rolled = isVeryFirstLevel
    ? die                                           // Very first level: always max die
    : mode === "max"    ? die
    : mode === "fixed"  ? Math.floor(die / 2) + 1
    : rollDie(die);

  // House rule: HP minimum half-die. A rolled value below half the die is bumped
  // up to half (rounded up), e.g. d10 → minimum 5. Only affects rolled mode
  // beyond level 1 (fixed/max already meet or exceed this).
  if (rules && mode === 'rolled' && !isVeryFirstLevel && hpMinHalfDie(rules)) {
    const halfDie = Math.ceil(die / 2);
    if (rolled < halfDie) rolled = halfDie;
  }

  const gain = Math.max(1, rolled + abilityMod);

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
export function recalculateAllHP(entity: Entity, rules: CampaignRules, hpAbility: Ability = 'con'): Entity {
  const level = entity.identity.level;
  if (level <= 0) return entity;

  const die  = entity.resources.hitDice.die;

  // Use effectiveStats so race bonuses count
  const allEffects     = collectAllEffects(entity);
  const effectiveStats = applyStatModifiers(entity.stats, allEffects);
  const abilityMod     = modifier(effectiveStats[hpAbility]);

  // Level 1: always max die
  let totalHP = Math.max(1, die + abilityMod);

  // Levels 2+
  for (let lvl = 2; lvl <= level; lvl++) {
    const gained = rules.hpMode === 'max'
      ? die + abilityMod
      : Math.floor(die / 2) + 1 + abilityMod;
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

  const maxScore = rules.maxAbilityScore ?? Infinity;
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
  const maxScore = rules.maxAbilityScore ?? Infinity;
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

/**
 * Resolves a 'feature_pool' choice — "pick N options, each granting a
 * DIFFERENT Feature" (Battle Master's maneuvers, Ranger Hunter's four
 * sub-choices). resolveChoice() can't handle this: it applies the choice's
 * single `grants` array identically to every selection, so it only works
 * when every option in a pool shares the same outcome (skills, equipment).
 * Bypasses resolveChoice entirely, same shape as applySubclassToEntity/
 * applyInfusionChoiceToEntity/applyFeatToEntity above — each selected
 * option's `value` is a full Feature literal, applied through the existing
 * `applyGrant(..., {kind:'feature', ...})` path so its Effects fire exactly
 * like any other granted feature.
 */
export function applyPoolChoiceToEntity(
  entity:            Entity,
  choiceId:           string,
  selectedOptionIds:  string[],
  rules:              CampaignRules,
): Entity {
  const pending = entity.choices.find(c => c.id === choiceId);
  if (!pending || !Array.isArray(pending.definition.pool)) return entity;

  let updated = entity;
  for (const optId of selectedOptionIds) {
    const option = pending.definition.pool.find(o => o.id === optId);
    if (option?.value) {
      updated = applyGrant(updated, { kind: 'feature', value: option.value as Feature }, pending.grantedAt);
    }
  }
  updated = {
    ...updated,
    choices: updated.choices.map(c =>
      c.id === choiceId ? { ...c, resolved: true, selections: selectedOptionIds } : c
    ),
  };
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

// ── Subclass selection ───────────────────────────────────────────────────────

/**
 * Resolves a 'subclass' pending choice by actually taking the subclass: sets
 * identity.subclassId, then applies every one of the subclass's OWN
 * ClassProgression entries already reached (its unlock level, and any
 * earlier level for domain-style subclasses that grant something at level
 * 1). Bypasses resolveChoice entirely — same reason applyAsiToEntity/
 * applyFeatToEntity do: the pool is the 'all' sentinel (the picker supplies
 * the real subclass list, not the engine), so resolveChoice's array-walk
 * would just skip it. Future level-ups pick up the subclass's remaining
 * entries via progressions.ts's mergeSubclassIntoProgression, not this
 * function — this only back-fills what's already due right now.
 */
export function applySubclassToEntity(
  entity:              Entity,
  choiceId:            string,
  subclassId:          string,
  subclassProgression: ClassProgression,
  rules:               CampaignRules,
  /**
   * Which class this subclass belongs to. Omit for single-class characters
   * (writes identity.subclassId directly, exactly as before — every
   * existing call site keeps working unedited). Pass it for a multiclassed
   * character so the right identity.classes[] entry is updated, and the
   * subclass's own progression entries are gated against THAT class's own
   * level (not total character level).
   */
  classId?: string,
): Entity {
  const classes = entity.identity.classes;
  const ownClassLevel = classId && classes
    ? (classes.find(c => c.classId === classId)?.level ?? entity.identity.level)
    : entity.identity.level;

  let updated: Entity = classId && classes
    ? {
        ...entity,
        identity: {
          ...entity.identity,
          classes: classes.map(c => c.classId === classId ? { ...c, subclassId } : c),
        },
      }
    : {
        ...entity,
        identity: { ...entity.identity, subclassId },
      };
  if (classId && classes) updated = syncLegacyIdentity(updated);

  for (const entry of subclassProgression.entries) {
    if (entry.level > ownClassLevel) continue;
    for (const grant of entry.grants) {
      updated = applyGrant(updated, grant, entry.level, classId);
    }
    for (const choice of entry.choices) {
      if (canAutoResolve(choice)) {
        if (Array.isArray(choice.pool) && choice.pool.length > 0) {
          for (const grant of choice.grants) {
            updated = applyGrant(updated, grant, entry.level, classId);
          }
        }
      } else {
        updated = queueChoice(updated, choice, entry.level);
      }
    }
  }
  updated = {
    ...updated,
    choices: updated.choices.map(c =>
      c.id === choiceId ? { ...c, resolved: true, selections: [subclassId] } : c
    ),
  };
  return recomputeDerived(updated, rules);
}

// ── Infusion selection ───────────────────────────────────────────────────────

/**
 * Resolves an 'infusion' pending choice (learning new infusions, e.g.
 * Artificer at levels 2/6/10/14/18) — appends the picked infusion ids to
 * knownInfusionIds. Bypasses resolveChoice for the same reason
 * applySubclassToEntity does: the pool is the 'all' sentinel (the picker
 * supplies the real catalog, not the engine), so resolveChoice's array-walk
 * would just skip it. This only grants KNOWLEDGE of the infusion — actually
 * applying one to an owned item is a separate step (see app/sheet/[id].tsx's
 * handleApplyInfusion).
 */
export function applyInfusionChoiceToEntity(
  entity:      Entity,
  choiceId:    string,
  infusionIds: string[],
  rules:       CampaignRules,
): Entity {
  const updated: Entity = {
    ...entity,
    knownInfusionIds: [...(entity.knownInfusionIds ?? []), ...infusionIds],
    choices: entity.choices.map(c =>
      c.id === choiceId ? { ...c, resolved: true, selections: infusionIds } : c
    ),
  };
  return recomputeDerived(updated, rules);
}

// ── Spell selection on level-up ──────────────────────────────────────────────

/**
 * Resolves a 'spell' pending choice (a known-spell caster gaining new
 * spells/cantrips known at level-up, or a Wizard adding to their
 * spellbook) — bypasses resolveChoice for the same reason ASI/subclass/
 * infusion do: the pool is the 'all' sentinel (the picker supplies the
 * real, class-filtered spell list, not the engine). Routes each selected
 * id into `cantrips` or `known` by looking up its own `level` (0 = cantrip)
 * via the caller-supplied lookup, so one picker component serves both a
 * pure cantrip-count choice and a pure leveled-spell-count choice without
 * the engine needing to know which in advance.
 */
export function applySpellChoiceToEntity(
  entity:       Entity,
  choiceId:     string,
  spellIds:     string[],
  getSpellLevel: (id: string) => number | undefined,
  rules:        CampaignRules,
): Entity {
  if (!entity.spellcasting) return entity;
  const newCantrips: string[] = [];
  const newKnown:     string[] = [];
  for (const id of spellIds) {
    if (getSpellLevel(id) === 0) newCantrips.push(id);
    else newKnown.push(id);
  }
  const updated: Entity = {
    ...entity,
    spellcasting: {
      ...entity.spellcasting,
      cantrips: [...new Set([...entity.spellcasting.cantrips, ...newCantrips])],
      known:    [...new Set([...entity.spellcasting.known,    ...newKnown])],
    },
    choices: entity.choices.map(c =>
      c.id === choiceId ? { ...c, resolved: true, selections: spellIds } : c
    ),
  };
  return recomputeDerived(updated, rules);
}

// ── Multiclass level-up ──────────────────────────────────────────────────────

/** Copies `used` counts from `prev` into `next` per tier, so recomputing slot
 * totals never resets a caster's already-spent slots. Same convention the
 * `spell_slots` applyGrant case already uses. */
function preserveUsedSlots(prev: SpellSlots | undefined, next: SpellSlots): SpellSlots {
  const tiers = ['1','2','3','4','5','6','7','8','9'] as const;
  const result = {} as SpellSlots;
  tiers.forEach(t => {
    const total = next[t]?.total ?? 0;
    const used  = Math.min(prev?.[t]?.used ?? 0, total);
    result[t] = { total, used };
  });
  return result;
}

/**
 * Advances a (potentially multiclassed) character by exactly ONE level in
 * targetClassId — either bumping an existing class in their build, or, if
 * targetClassId isn't in identity.classes yet, taking a brand-new class.
 * This is how "level up your class" and "add a new class" share one code
 * path in play, matching how creation's levelUp(0 -> targetLevel) already
 * unifies "pick class" and "gain levels" for the single-class case.
 *
 * `targetClass` (the CharClass content object, not just its id) is only
 * needed when this call might be taking a BRAND NEW class after character
 * level 1 — its multiclassProficiencies field supplies the reduced PHB
 * multiclass proficiency table. Omit it for "level up an existing class."
 */
export function levelUpClass(
  entity: Entity,
  targetClassId: string,
  progression: ClassProgression,
  rules: CampaignRules,
  targetClass?: import('./types').CharClass,
): Entity {
  const classes = getClassLevels(entity);
  const existing = classes.find(c => c.classId === targetClassId);
  const isNewClass = !existing;
  const wasCharacterLevelZero = entity.identity.level === 0;
  const newClassLevel = (existing?.level ?? 0) + 1;
  const isVeryFirstLevel = wasCharacterLevelZero && newClassLevel === 1;
  const characterLevelAfter = entity.identity.level + 1;

  const entry = progression.entries.find(e => e.level === newClassLevel);
  if (!entry) return entity;

  // A second-or-later class taken after the character's very first level
  // gets the REDUCED multiclass proficiency table instead of the class's
  // own full level-1 grant (PHB "Multiclassing Proficiencies"), and gains
  // no new saving-throw proficiencies at all — both per RAW.
  const isReducedMulticlassEntry = isNewClass && !wasCharacterLevelZero;

  let updated = entity;

  // Capture the spellcasting ability before this level's grants apply, so a
  // later class's init_spellcasting can't silently steal the spell-save-DC
  // ability away from whichever caster class the character took first.
  const abilityBefore = updated.spellcasting?.ability;

  updated = applyHP(updated, entry.hpDie, rules.hpMode, newClassLevel, rules, progression.hpAbility ?? 'con', isVeryFirstLevel);

  if (isReducedMulticlassEntry) {
    const mcProf = multiclassProficienciesFor(targetClass);
    if (mcProf) updated = applyGrant(updated, { kind: 'proficiency', value: mcProf }, newClassLevel, targetClassId);
  }

  for (const grant of entry.grants) {
    if (isReducedMulticlassEntry && grant.kind === 'proficiency') continue; // superseded by the reduced table above
    updated = applyGrant(updated, grant, newClassLevel, targetClassId);
  }

  for (const choice of entry.choices) {
    if (canAutoResolve(choice)) {
      if (Array.isArray(choice.pool) && choice.pool.length > 0) {
        for (const grant of choice.grants) updated = applyGrant(updated, grant, newClassLevel, targetClassId);
      }
    } else {
      updated = queueChoice(updated, { ...choice, forClassId: targetClassId }, newClassLevel);
    }
  }

  // Bonus feat house rule — keyed by TOTAL character level (unique per
  // level-up event regardless of which class advanced), not the per-class
  // level, which two different classes could otherwise collide on.
  if (bonusFeatEveryLevel(rules)) {
    const bonusId = `bonus_feat_lvl_${characterLevelAfter}`;
    if (!updated.choices.some(c => c.id === bonusId)) {
      updated = queueChoice(updated, {
        id: bonusId, prompt: `Bonus feat at level ${characterLevelAfter} (house rule).`,
        kind: 'asi', count: 1, pool: 'all', grants: [], required: true, resolved: false,
      }, characterLevelAfter);
    }
  }

  if (abilityBefore && updated.spellcasting && updated.spellcasting.ability !== abilityBefore) {
    updated = { ...updated, spellcasting: { ...updated.spellcasting, ability: abilityBefore } };
  }

  const nextClasses = isNewClass
    ? [...classes, { classId: targetClassId, subclassId: null, level: 1 }]
    : classes.map(c => c.classId === targetClassId ? { ...c, level: newClassLevel } : c);
  updated = { ...updated, identity: { ...updated.identity, classes: nextClasses } };
  updated = syncLegacyIdentity(updated);

  // Once 2+ classes exist, per-class spell_slots grants above may have used
  // the wrong classId (each grant only knows its own class) — recompute the
  // combined multiclass slot pool from scratch as the authoritative result.
  // Solo characters (still 1 class after this level-up) keep whatever their
  // own class's grant already computed, which is already correct.
  if (updated.spellcasting && isMulticlassed(updated)) {
    const finalClasses = getClassLevels(updated);
    const casterLevel = multiclassCasterLevel(finalClasses);
    const nonPactSlots = casterLevel > 0
      ? preserveUsedSlots(updated.spellcasting.slots, slotsForLevel(MULTICLASS_SPELLCASTER_SLOTS, casterLevel))
      : preserveUsedSlots(undefined, slotsForLevel(MULTICLASS_SPELLCASTER_SLOTS, 1)); // all-zero row

    let pactSlots = updated.spellcasting.pactSlots;
    const pactClass = finalClasses.find(c => pactSlotTableFor(c.classId, c.subclassId));
    if (pactClass) {
      const table = pactSlotTableFor(pactClass.classId, pactClass.subclassId)!;
      pactSlots = preserveUsedSlots(pactSlots, slotsForLevel(table, pactClass.level));
    }

    updated = { ...updated, spellcasting: { ...updated.spellcasting, slots: nonPactSlots, pactSlots } };
  }

  return recomputeDerived(updated, rules);
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
    updated = applyHP(updated, entry.hpDie, rules.hpMode, lvl, rules, progression.hpAbility ?? 'con');

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

    // Bonus feat every level (house rule). Injects an extra feat-only ASI choice
    // at every level beyond the class's own ASI schedule.
    if (bonusFeatEveryLevel(rules)) {
      const bonusId = `bonus_feat_lvl_${lvl}`;
      // Only add if not already queued (idempotent re-leveling safety).
      const alreadyQueued = updated.choices.some(c => c.id === bonusId);
      if (!alreadyQueued) {
        const bonusDef: import('./types').ChoiceDefinition = {
          id:       bonusId,
          prompt:   `Bonus feat at level ${lvl} (house rule).`,
          kind:     'asi',
          count:    1,
          pool:     'all',
          grants:   [],
          required: true,
          resolved: false,
        };
        updated = queueChoice(updated, bonusDef, lvl);
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

    // Spellcasting ability choice: rare-case homebrew classes whose casting
    // ability isn't fixed (see CharClass.spellcastingAbilityOptions). The
    // option's value is the chosen Ability; initialise spellcasting with it
    // exactly like the init_spellcasting grant would for a fixed-ability class.
    if (pending.definition.kind === "spellcasting_ability") {
      updated = applyGrant(updated, { kind: 'init_spellcasting', value: { ability: option.value as Ability } }, pending.grantedAt);
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