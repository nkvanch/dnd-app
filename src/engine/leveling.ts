import { Entity, Grant, ChoiceDefinition, CampaignRules, ResourceGrant, ProficiencyGrant,
         ResourceUpgrade, FeatureInstance, Feature, ClassProgression, Ability, SpellSlots,
         KnownSpellsGrant, asSubclassId, asClassId, Background, SkillName,
         CharClass, ItemFilterConstraint, BACKGROUND_CHOICE_PREFIX,
         EntitlementRecord, EntitlementSourceKind } from './types';
import { recomputeDerived, modifier, collectAllEffects, applyStatModifiers, effectiveAbilityScores } from './pipeline';
import { getSpellSlotsForClassLevel, multiclassCasterLevel, MULTICLASS_SPELLCASTER_SLOTS,
         pactSlotTableFor, slotsForLevel, slotsFromCountArray } from '../content/classes/spellSlotTables';
import { ALL_CHAR_CLASSES } from '../content/classes';
import { getProgressionForClass } from '../content/classes/progressions';
import { WARLOCK_SLOTS } from '../content/classes/spellSlotTables';
import { itemMatchesConstraint } from '../content/items/itemBrowse';
import type { ItemIndexEntry } from '../content/itemRepo.types';
import { hpMinHalfDie, bonusFeatEveryLevel } from './houseRules';
import { getClassLevels, syncLegacyIdentity, multiclassProficienciesFor } from './multiclass';
import { initializeEntitlementInputs, grantEntitlement, grantEntitlements, revokeEntitlementsFromChoice, revokeResourceSource, recomputeResourceMaximums } from './entitlements';

// ── helpers ──────────────────────────────────────────────────────────────────

export function rollDie(sides: number): number {
  return Math.floor(Math.random() * sides) + 1;
}

// ── applyGrant ────────────────────────────────────────────────────────────────

export function applyGrant(
  entity: Entity, grant: Grant, atLevel: number, classId?: string,
  /** Explicit resource source — only needed by callers granting a resource
   * OUTSIDE class-progression leveling (race/subrace resource grants), where
   * entity.identity.classId can't be trusted to reflect the class actually
   * being applied. See the "resource" case below. Also used (closure pass
   * 2) to tag `proficiency`-kind grants with real entitlement provenance —
   * `choiceId`, when set, ties the resulting entitlement(s) to the specific
   * resolved ChoiceState that produced them (see applyToolChoiceToEntity/
   * applyLanguageChoiceToEntity), so removing just that choice's origin
   * doesn't touch a different grant from the same source. */
  source?: { kind: EntitlementSourceKind; id?: string; choiceId?: string },
): Entity {
  const original = entity;
  entity = initializeEntitlementInputs(entity);
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
      //
      // Closure pass 3 (item 1): also stamps a source-owned entitlement for
      // each granted spell/cantrip, tagged with THIS feature's own resolved
      // source (`next.features`'s last entry, set just above) — this is
      // what makes the grant removable when the feature is (via
      // removeFeature's existing revokeEntitlementsFromSource(..., 'feature'
      // | ..., ...) calls, which already work for ANY entitlement kind
      // tagged to that source, spells included, with no further wiring).
      // The flat spellcasting.known/cantrips arrays stay as the DERIVED
      // output (reconciled every recompute pass, same pattern as
      // proficiencies — see pipeline.ts).
      const spellEffects = (f.effects ?? []).filter(e => e.type === 'grant_spell');
      const grantedFeature = next.features[next.features.length - 1];
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
        next = grantEntitlements(next, [
          ...(cantripIds ?? []).map(key => ({ kind: 'cantrip_access' as const, key, sourceKind: grantedFeature.source.kind, sourceId: grantedFeature.source.refId })),
          ...(spellIds   ?? []).map(key => ({ kind: 'spell_access'   as const, key, sourceKind: grantedFeature.source.kind, sourceId: grantedFeature.source.refId })),
        ]);

      }

      return next;
    }

    case "resource": {
      const r = grant.value as ResourceGrant;
      // No explicit source: infer 'class' from classId/entity.identity.classId,
      // same fallback the "feature" case above already uses. Safe for every
      // in-file call site (all run within class-progression leveling), but
      // NOT safe for a caller granting a race/subrace resource — those must
      // pass an explicit `source` (see class-detail.tsx's race/subrace
      // re-grant calls), since entity.identity.classId can be stale there.
      const inferredClassId = classId ?? entity.identity.classId ?? undefined;
      const resolvedSource = source ?? (inferredClassId ? { kind: 'class' as const, id: inferredClassId } : undefined);
      // Closure pass 3 (item 3): a `resource_grant` entitlement is stamped
      // for EVERY grant of this resource id, including a repeat one from a
      // DIFFERENT source — that's what lets revokeResourceSource tell
      // "source A grants R, source B also grants R, remove A -> R survives
      // (B still wants it), remove B -> R disappears" apart from the old
      // behavior, where a second source's grant of an already-existing
      // resource id was a silent, untracked no-op, so removing the FIRST
      // (only tracked) source wiped the entry even though a second source
      // nominally also granted it. The physical resource instance
      // (current/maximum/recharge) is created ONLY on the first grant —
      // current/spent state is never reset by a later "also grants this"
      // registration.
      const withGrantEntitlement = resolvedSource
        ? grantEntitlement(entity, { kind: 'resource_grant', key: r.resourceId, sourceKind: resolvedSource.kind,
            sourceId: resolvedSource.id, choiceId: source?.choiceId })
        : entity;
      if (withGrantEntitlement.resources.custom.some(c => c.id === r.resourceId)) return withGrantEntitlement;
      return {
        ...withGrantEntitlement,
        resources: {
          ...withGrantEntitlement.resources,
          custom: [...withGrantEntitlement.resources.custom, {
            id: r.resourceId, name: r.name,
            current: r.maximum, maximum: r.maximum,
            recharge: r.recharge,
            sourceKind: resolvedSource?.kind,
            sourceId:   resolvedSource?.id,
          }]
        }
      };
    }

    case "resource_upgrade": {
      // Closure pass 3 (item 3): used to unconditionally full-refresh
      // `current` to the new maximum, silently discarding whatever had
      // already been spent — an upgrade (e.g. a subclass feature raising a
      // resource's pool size) is not a rest, and shouldn't act like one.
      // Preserves the SPENT amount instead: newCurrent = newMaximum -
      // spent, clamped to [0, newMaximum] so a shrinking maximum (or a
      // pool that was already fully spent) can never go negative or exceed
      // the new cap. sourceKind/sourceId are untouched by the `{...r, ...}`
      // spread, same as before.
      const u = grant.value as ResourceUpgrade;
      const resource = entity.resources.custom.find(r => r.id === u.resourceId);
      if (!resource) return entity;
      const upgradeSource = source
        ? { kind: source.kind, id: source.id, choiceId: source.choiceId }
        : classId
          ? { kind: 'class' as const, id: classId, choiceId: undefined }
          : { kind: 'manual' as const, id: undefined, choiceId: undefined };
      const withoutSameContribution = (entity.entitlements ?? []).filter(e => !(
        e.kind === 'resource_upgrade' && e.key === u.resourceId
        && e.sourceKind === upgradeSource.kind && e.sourceId === upgradeSource.id
        && e.choiceId === upgradeSource.choiceId
      ));
      const otherAmount = withoutSameContribution
        .filter(e => e.kind === 'resource_upgrade' && e.key === u.resourceId)
        .reduce((sum, e) => sum + (e.amount ?? 0), 0);
      const baseMaximum = resource.baseMaximum ?? Math.max(0, resource.maximum - otherAmount);
      const amount = u.newMaximum - (baseMaximum + otherAmount);
      const withBase = {
        ...entity,
        resources: { ...entity.resources, custom: entity.resources.custom.map(r =>
          r.id === u.resourceId ? { ...r, baseMaximum } : r) },
        entitlements: withoutSameContribution,
      };
      return recomputeResourceMaximums(grantEntitlement(withBase, {
        kind: 'resource_upgrade', key: u.resourceId, amount,
        sourceKind: upgradeSource.kind, sourceId: upgradeSource.id, choiceId: upgradeSource.choiceId,
      }));
    }

    case "proficiency": {
      // Merge the granted proficiencies into the entity's proficiency block.
      // The grant value is a ProficiencyGrant: { armor?, weapons?, tools?, languages? }.
      // We deduplicate each list so re-applying on class change is safe.
      const g = grant.value as ProficiencyGrant;
      // Closure pass 2: `proficiency`-kind Grants are only ever authored on
      // CLASS/SUBCLASS progressions (confirmed via a full content grep) —
      // no backing Feature/Effect exists for them, so without an explicit
      // entitlement record here they'd be untraceable the moment they're
      // granted (exactly the reported "class/subclass grants, remove
      // subclass, grant stays" gap). `source` (explicit, passed by
      // race/subrace resource-grant callers) takes priority; class-
      // progression callers pass `classId` instead, so that's the fallback;
      // a caller with neither (shouldn't happen for this grant kind, but
      // conservative) tags 'manual' rather than mis-attributing.
      const entSource: { kind: EntitlementSourceKind; id?: string } = source
        ? { kind: source.kind, id: source.id }
        : classId
          ? { kind: 'class', id: classId }
          : { kind: 'manual', id: undefined };
      const records: EntitlementRecord[] = [
        ...(g.armor     ?? []).map(key => ({ kind: 'armor_proficiency'  as const, key, sourceKind: entSource.kind, sourceId: entSource.id, choiceId: source?.choiceId })),
        ...(g.weapons   ?? []).map(key => ({ kind: 'weapon_proficiency' as const, key, sourceKind: entSource.kind, sourceId: entSource.id, choiceId: source?.choiceId })),
        ...(g.tools     ?? []).map(key => ({ kind: 'tool_proficiency'   as const, key, sourceKind: entSource.kind, sourceId: entSource.id, choiceId: source?.choiceId })),
        ...(g.languages ?? []).map(key => ({ kind: 'language'          as const, key, sourceKind: entSource.kind, sourceId: entSource.id, choiceId: source?.choiceId })),
      ];
      return grantEntitlements(entity, records);
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
        newSlots[t] = { total, used: Math.max(0, Math.min(entity.spellcasting!.slots[t]?.used ?? 0, total)) };
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
      //
      // Closure pass 3 (item 1): same "no backing Feature/Effect at all"
      // gap as the old `proficiency` grant kind (closure pass 2) — this is
      // authored directly on class/subclass progression entries. Stamps
      // source-owned entitlements the same way, with the same source
      // fallback chain (explicit `source` > `classId` > 'manual').
      const ks = grant.value as KnownSpellsGrant;
      if (!entity.spellcasting) return entity;

      const ksSource: { kind: EntitlementSourceKind; id?: string } = source
        ? { kind: source.kind, id: source.id }
        : classId
          ? { kind: 'class', id: classId }
          : { kind: 'manual', id: undefined };
      const withEntitlements = grantEntitlements(entity, [
        ...(ks.cantripIds ?? []).map(key => ({ kind: 'cantrip_access' as const, key, sourceKind: ksSource.kind, sourceId: ksSource.id, choiceId: source?.choiceId })),
        ...(ks.spellIds   ?? []).map(key => ({ kind: 'spell_access'   as const, key, sourceKind: ksSource.kind, sourceId: ksSource.id, choiceId: source?.choiceId })),
      ]);
      return withEntitlements;
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
      return original;
  }
}

// ── HP per level ──────────────────────────────────────────────────────────────

/**
 * Closure 4A: the pure HP-gain calculation, extracted out of applyHP so a
 * level-up PREVIEW (HpRollGate, TabCharacter.tsx) can show the EXACT number
 * that will actually be applied — one source of truth instead of a second,
 * separately maintained copy of this formula that could (and did: the
 * hpMinHalfDie house-rule floor was previously missing from the preview
 * entirely) silently drift out of sync with what applyHP itself computes.
 * Never rolls on its own behalf for 'rolled' mode: a caller previewing a
 * value always already has a concrete candidate (the manually-entered or
 * app-rolled die result) to pass as `manualRoll` — this function only ever
 * turns a KNOWN roll (or a deterministic mode) into a final HP gain.
 */
export function calculateLevelUpHpGain(
  entity: Entity,
  die: number,
  mode: CampaignRules["hpMode"],
  rules: CampaignRules | undefined,
  hpAbility: Ability,
  isVeryFirstLevel: boolean,
  manualRoll?: number,
): number {
  // Use effectiveStats[hpAbility] so race bonuses (e.g. Dwarf +2 CON) feed
  // into HP. Defaults to CON (standard 5e RAW) — every existing class passes
  // no explicit ability and is completely unaffected. hpAbility lets a
  // homebrew class reflavor HP around a different score (e.g. CHA).
  const abilityMod = modifier(effectiveAbilityScores(entity)[hpAbility]);

  let rolled = isVeryFirstLevel
    ? die                                           // Very first level: always max die
    : mode === "max"    ? die
    : mode === "fixed"  ? Math.floor(die / 2) + 1
    : manualRoll !== undefined ? manualRoll
    : rollDie(die);

  // House rule: HP minimum half-die. A rolled value below half the die is bumped
  // up to half (rounded up), e.g. d10 → minimum 5. Only affects rolled mode
  // beyond level 1 (fixed/max already meet or exceed this).
  if (rules && mode === 'rolled' && !isVeryFirstLevel && hpMinHalfDie(rules)) {
    const halfDie = Math.ceil(die / 2);
    if (rolled < halfDie) rolled = halfDie;
  }

  return Math.max(1, rolled + abilityMod);
}

/**
 * Closure 4C: strict validation for a manually-entered/rolled level-up HP
 * die result — a complete positive integer within [1, dieSize]. Same
 * "reject a partial parse" reasoning as monsterFactory.ts's
 * isValidManualHp: JS's own parseInt silently accepts "5abc" as 5 and
 * treats "5.5" as 5, dropping everything after the leading digits — this
 * requires the ENTIRE trimmed string to be exactly one valid integer.
 */
export function isValidHpRoll(draft: string, dieSize: number): boolean {
  const trimmed = draft.trim();
  if (!/^[1-9][0-9]*$/.test(trimmed)) return false;
  const n = parseInt(trimmed, 10);
  return n >= 1 && n <= dieSize;
}

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
  /**
   * Table-first resolution: when mode === 'rolled', a caller that already
   * has the physically-rolled die result passes it here instead of letting
   * this function call rollDie(die) itself. Ignored for every other mode
   * (isVeryFirstLevel/'max'/'fixed' are already deterministic and must stay
   * exactly as they were). undefined (every existing caller) reproduces the
   * previous rollDie(die) behavior exactly — this parameter is additive.
   */
  manualRoll?: number,
): Entity {
  const gain = calculateLevelUpHpGain(entity, die, mode, rules, hpAbility, isVeryFirstLevel, manualRoll);

  return {
    ...entity,
    resources: {
      ...entity.resources,
      hp: {
        current: entity.resources.hp.current + gain,
        maximum: entity.resources.hp.maximum + gain,
        temp:    entity.resources.hp.temp
      },
      hitDice: addHitDie(entity.resources.hitDice, die),
    }
  };
}

/**
 * Adds one hit die of the given size to a HitDiceBlock, correctly — see
 * HitDiceBlock's own doc comment (types.ts) for the bug this fixes.
 * Backfills `pools` from the existing scalar state the first time a
 * SECOND die size shows up; stays pools-free (and therefore identical to
 * the pre-fix behavior) for single-class characters and same-die-size
 * multiclass combinations.
 */
function addHitDie(hitDice: Entity['resources']['hitDice'], die: number): Entity['resources']['hitDice'] {
  const pools = hitDice.pools
    ?? (hitDice.total > 0 ? [{ die: hitDice.die, total: hitDice.total, remaining: hitDice.remaining }] : []);
  const idx = pools.findIndex(p => p.die === die);
  const nextPools = idx >= 0
    ? pools.map((p, i) => i === idx ? { ...p, total: p.total + 1, remaining: p.remaining + 1 } : p)
    : [...pools, { die, total: 1, remaining: 1 }];
  return {
    die,
    total:     nextPools.reduce((sum, p) => sum + p.total, 0),
    remaining: nextPools.reduce((sum, p) => sum + p.remaining, 0),
    pools:     nextPools.length > 1 ? nextPools : undefined,
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
  const abilityMod = modifier(effectiveAbilityScores(entity)[hpAbility]);

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

  const prevCon = effectiveAbilityScores(prev).con;
  const nextCon = effectiveAbilityScores(next).con;
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
  /** CHOICE-AUTHORING-1: Feat.pendingChoices — queued (not auto-resolved)
   * alongside the feat's own feature grant, namespaced by featFeature.id so
   * removeFeature() can sweep any still-unresolved ones if the feat is
   * later removed live. */
  pendingChoices?: ChoiceDefinition[],
): Entity {
  let updated = applyGrant(entity, { kind: 'feature', value: featFeature }, grantedAt);
  updated = {
    ...updated,
    choices: updated.choices.map(c =>
      c.id === choiceId ? { ...c, resolved: true, selections: [`feat:${featId}`] } : c
    ),
  };
  for (const choice of pendingChoices ?? []) {
    updated = queueChoice(updated, choice, grantedAt, featFeature.id, { kind: 'feature', id: featFeature.id });
  }
  updated = reconcileConHp(entity, updated);
  return recomputeDerived(updated, rules);
}

/**
 * Removes a single feature by id — the engine half of live feature
 * add/remove (both players and DMs, mid-session). Deliberately unopinionated
 * about WHICH features can be removed (no special-casing race/class/
 * subclass-sourced ones) — the UI layer decides whether to warn before
 * removing a structural feature, not this primitive.
 *
 * Best-effort only for the linked resource: strips a CustomResource whose
 * sourceId === featureId (the exact feature being removed owns it — true for
 * a manually-added limited-use feature, see traitCompiler.ts's
 * buildTraitFeature). Content-granted resources (race/class/feat/...) have
 * no clean 1:1 Feature→Resource mapping and are deliberately left untouched.
 *
 * No recomputeDerived call — matches applyGrant and every other pure
 * add/remove primitive here; the caller's simulate()/mutate() recomputes.
 */
export function removeFeature(entity: Entity, featureId: string): Entity {
  const removed = entity.features.find(f => f.id === featureId);
  if (!removed) return entity;
  // Closure pass 2 (item 4): also revoke any entitlement this feature
  // directly owns (sourceKind:'feature', e.g. a manually-authored trait's
  // own proficiency grant) and any entitlement produced by resolving ONE OF
  // ITS OWN queued choices (namespaced `${featureId}:...`, see queueChoice's
  // id composition). The resolved ChoiceState record itself is still kept
  // below (character history, per CHOICE-AUTHORING-1) but the grant it
  // produced must not outlive the feature that originated the choice.
  const ownedResolvedChoiceIds = entity.choices
    .filter(c => c.resolved && c.id.startsWith(`${featureId}:`))
    .map(c => c.id);
  let stripped = revokeResourceSource(entity, 'feature', featureId);
  stripped = revokeResourceSource(stripped, 'manual', featureId);
  for (const choiceId of ownedResolvedChoiceIds) stripped = revokeEntitlementsFromChoice(stripped, choiceId);
  return recomputeResourceMaximums({
    ...stripped,
    features: stripped.features.filter(f => f.id !== featureId),
    resources: {
      ...stripped.resources,
      custom: stripped.resources.custom.filter(r => r.sourceId !== featureId
        || (stripped.entitlements ?? []).some(e => e.kind === 'resource_grant' && e.key === r.id)),
    },
    // CHOICE-AUTHORING-1: also best-effort strip any STILL-UNRESOLVED choice
    // namespaced to this exact feature (applyFeatToEntity queues
    // Feat.pendingChoices with originId=featFeature.id — see queueChoice's
    // id composition, `${originId}:${choice.id}_${atLevel}`). An already-
    // RESOLVED choice is left alone — it's part of the character's history,
    // same "don't silently reassign a past pick" rule invalid_expertise_target
    // validation follows.
    choices: stripped.choices.filter(c => c.resolved || !c.id.startsWith(`${featureId}:`)),
  });
}

/** Computes one flexAsi pick's bonus amount — mirrors app/creation/
 *  background.tsx's own flexAmountFor exactly. 'two_distinct_plus_one' is
 *  always +1 each. 'two_one_or_three_one' depends only on how many picks
 *  were actually made (2 => +2/+1 split, first pick gets +2; 3 => +1/+1/+1)
 *  — background.tsx's own UI never lets flexPicks.length end up
 *  inconsistent with the chosen sub-mode, so the pick count alone is a
 *  reliable, sufficient signal; no separate sub-mode parameter needed. */
function flexAsiAmountFor(mode: NonNullable<Background['flexibleAsi']>['mode'], picks: Ability[], idx: number): number {
  if (mode.kind === 'two_distinct_plus_one') return 1;
  return picks.length === 3 ? 1 : (idx === 0 ? 2 : 1);
}

/**
 * Swaps a character's background live, mid-session — a straight-line port
 * of app/creation/background.tsx's own selectBackground(), so a change
 * made in play behaves identically to picking a background at creation.
 *
 * Skill retrain differs from BOTH existing implementations on purpose:
 * background.tsx's own BG_SKILL_MAP-based untrain has a real, confirmed bug
 * (untrains by a hardcoded 13-official-background table with no check for
 * whether some OTHER active feature also grants the same skill) — fixed
 * here by computing the untrain candidate set from the OLD background's own
 * feature effects, minus any skill still granted by a currently-active
 * NON-background feature's own grant_proficiency effect.
 *
 * That computed set has one structural blind spot no amount of feature-
 * scanning can close: a class-driven skill CHOICE sets
 * entity.skills.skills[X].trained = true directly via resolveChoice, with
 * NO backing Effect at all (see class-detail.tsx's own comment on this) —
 * so if a class choice happens to have trained the same skill the old
 * background's features also grant, this scan has no way to see that and
 * will (correctly by its own logic, wrongly in outcome) suggest untraining
 * it. Deliberately NOT applied silently: `skillRetrainOverrides` lets the
 * caller (a UI-level editable checklist) correct the one case this can't
 * see, defaulting to the computed suggestion for everything else.
 */
export function swapBackground(
  entity: Entity,
  newBackground: Background,
  rules: CampaignRules,
  flexAsiPicks?: Ability[],
  skillRetrainOverrides?: Partial<Record<SkillName, boolean>>,
): Entity {
  const oldBgFeatures = entity.features.filter(f => f.source.kind === 'background');
  const otherFeatures = entity.features.filter(f => f.source.kind !== 'background');

  const oldBgSkills = new Set<SkillName>();
  for (const f of oldBgFeatures) {
    for (const e of f.effects) {
      if (e.type === 'grant_proficiency' && e.operation === 'add' && e.target.startsWith('skill:')) {
        oldBgSkills.add(e.target.slice(6) as SkillName);
      }
    }
  }

  const candidateUntrain = new Set<SkillName>();
  for (const skill of oldBgSkills) {
    const grantedElsewhere = otherFeatures.some(f =>
      f.effects.some(e => e.type === 'grant_proficiency' && e.operation === 'add' && e.target === `skill:${skill}`)
    );
    if (!grantedElsewhere) candidateUntrain.add(skill);
  }

  let updatedSkills = { ...entity.skills.skills };
  const untrain = (skill: SkillName) => {
    if (updatedSkills[skill]) {
      updatedSkills = { ...updatedSkills, [skill]: { ...updatedSkills[skill], trained: false, expertise: false } };
    }
  };
  for (const skill of candidateUntrain) {
    if (skillRetrainOverrides?.[skill] === true) continue; // human overrode: keep trained
    untrain(skill);
  }
  // A checklist row can also force-untrain a skill the scan didn't flag
  // (skillRetrainOverrides[skill] === false for a skill outside
  // candidateUntrain) — the UI offers every old-background skill as a row
  // regardless of the computed default, so honor an explicit false too.
  for (const [skill, keep] of Object.entries(skillRetrainOverrides ?? {}) as [SkillName, boolean][]) {
    if (keep === false && !candidateUntrain.has(skill)) untrain(skill);
  }

  // CHOICE-AUTHORING-1: sweep any still-queued choice that originated from
  // the OLD background's own features or its pendingChoices — same
  // "resolved choices are history, unresolved ones get swept" pattern
  // clearRaceFeatures() uses for RACE_CHOICE_PREFIX. Background features
  // never carry their own Feature.choices (that's still vestigial/unused
  // engine-wide), so unlike clearRaceFeatures only the prefix check is
  // needed here — no feature-sourced choice ids to also collect.
  const sweptChoices = entity.choices.filter(c =>
    c.resolved || !c.definition.id.startsWith(BACKGROUND_CHOICE_PREFIX),
  );

  // Closure pass 2: revoke any entitlement tagged to the OLD background id
  // — a no-op today (no current background-originated choice stamps
  // sourceKind:'background' yet, since queueChoice below doesn't pass an
  // explicit source), but keeps this removal path consistent with
  // applySubclassToEntity's own pattern and correct the moment a background
  // choice IS stamped with real provenance.
  let updated: Entity = revokeResourceSource({
    ...entity,
    identity: { ...entity.identity, backgroundId: newBackground.id },
    features: otherFeatures,
    skills: { skills: updatedSkills },
    choices: sweptChoices,
  }, 'background', entity.identity.backgroundId);

  for (const choice of newBackground.pendingChoices ?? []) {
    updated = queueChoice(updated, choice, 0, undefined, { kind: 'background', id: newBackground.id });
  }

  for (const feature of newBackground.features) {
    updated = applyGrant(updated, { kind: 'feature', value: { ...feature, isActive: true } }, 0);
  }

  if (newBackground.flexibleAsi && flexAsiPicks && flexAsiPicks.length > 0) {
    // ABILITY-CAP-1: clamp each pick to remaining headroom under the
    // effective cap (rules.maxAbilityScore, default Infinity when
    // uncapped) — same rule applyAsiToEntity() enforces for the plain ASI
    // path. Effective stats read BEFORE this grant, matching how every
    // other ASI-mutation path measures headroom against the character's
    // current score, not a stale pre-session snapshot.
    const maxScore = rules.maxAbilityScore ?? Infinity;
    const effectiveBefore = applyStatModifiers(updated.stats, collectAllEffects(updated));
    const flexFeature: Feature = {
      id: `${newBackground.id}_flexible_asi`,
      name: 'Ability Score Increase',
      description: newBackground.flexibleAsi.prompt,
      source: { kind: 'background', refId: newBackground.id },
      level: null, actions: [], choices: [], passive: true,
      effects: flexAsiPicks.map((ab, idx) => {
        const rawAmount = flexAsiAmountFor(newBackground.flexibleAsi!.mode, flexAsiPicks, idx);
        const headroom  = Math.max(0, maxScore - effectiveBefore[ab]);
        return {
          type: 'stat_modifier' as const, target: ab, operation: 'add' as const,
          value: Math.min(rawAmount, headroom), condition: null,
        };
      }),
    };
    updated = applyGrant(updated, { kind: 'feature', value: { ...flexFeature, isActive: true } }, 0);
  }

  // Generalized skill-training pass, same as background.tsx's own creation-
  // time logic — walks the NEW background's own features for
  // grant_proficiency skill effects and marks them trained. Works for
  // homebrew backgrounds with no BG_DETAIL-equivalent table (this primitive
  // has no such table dependency at all, unlike background.tsx's creation
  // screen, which also has a hardcoded-table fast path this port omits as
  // redundant — the generalized pass alone already covers every background,
  // official or homebrew, per background.tsx's own comment on it).
  for (const feature of newBackground.features) {
    for (const effect of feature.effects) {
      if (effect.type === 'grant_proficiency' && effect.operation === 'add' && effect.target.startsWith('skill:')) {
        const key = effect.target.slice(6) as SkillName;
        if (updated.skills.skills[key]) {
          updated = {
            ...updated,
            skills: { skills: { ...updated.skills.skills, [key]: { ...updated.skills.skills[key], trained: true } } },
          };
        }
      }
    }
  }

  let recomputed = recomputeDerived(updated, rules);
  let finalSkills = recomputed.skills.skills;
  const forceUntrain = new Set<SkillName>([
    ...[...candidateUntrain].filter(skill => skillRetrainOverrides?.[skill] !== true),
    ...(Object.entries(skillRetrainOverrides ?? {}) as [SkillName, boolean][])
      .filter(([, keep]) => keep === false).map(([skill]) => skill),
  ]);
  for (const skill of forceUntrain) {
    if (finalSkills[skill]?.trained || finalSkills[skill]?.expertise) {
      finalSkills = { ...finalSkills, [skill]: { ...finalSkills[skill], trained: false, expertise: false } };
    }
  }
  if (finalSkills !== recomputed.skills.skills) recomputed = { ...recomputed, skills: { skills: finalSkills } };
  return recomputed;
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

/**
 * Queues a pending choice. `originId` (typically the granting class's id)
 * namespaces the stored id so two different sources that happen to author
 * the same ChoiceDefinition.id at the same level can never collide and
 * silently overwrite each other's selection in entity.choices — every
 * official class's own skill-choice id is already manually prefixed
 * (e.g. 'rogue_skills_lvl_1'), which is why this hasn't been hit in
 * practice yet, but nothing enforced it, and homebrew content has no such
 * discipline. Omitting originId keeps the exact pre-existing id format
 * ('${choice.id}_${atLevel}') — used deliberately by the bonus-feat house
 * rule (see its own call sites), which is keyed by total character level
 * specifically so it's already shared/global across classes, not
 * per-source.
 */
export function queueChoice(entity: Entity, choice: ChoiceDefinition, atLevel: number, originId?: string,
  source?: { kind: EntitlementSourceKind; id?: string }): Entity {
  const id = originId ? `${originId}:${choice.id}_${atLevel}` : `${choice.id}_${atLevel}`;
  return {
    ...entity,
    choices: [...entity.choices, {
      id,
      definition:  choice,
      grantedAt:   atLevel,
      resolved:    false,
      selections:  [],
      sourceKind: source?.kind,
      sourceId: source?.id,
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
  // Closure item 3: the class this subclass applies to — explicit `classId`
  // when passed (multiclass callers always pass one), otherwise the entity's
  // OWN primary class when classes[] exists (a single-class caller omits
  // classId, per SubclassPicker.tsx's own comment, but still means "my one
  // class"). Used consistently below so identity.classes[] and the legacy
  // identity.subclassId scalar are never updated inconsistently.
  const targetClassId = classId ?? classes?.[0]?.classId;
  const ownClassLevel = targetClassId && classes
    ? (classes.find(c => c.classId === targetClassId)?.level ?? entity.identity.level)
    : entity.identity.level;

  // SUBCLASS-CHANGE-1: this function used to be purely additive — safe the
  // first time a subclass is picked, but calling it again to CHANGE an
  // already-resolved subclass (see app/creation/subclass.tsx) stacked the
  // new subclass's features/resources on top of the old one's, which were
  // never removed. Strip whatever the PREVIOUS subclass for this specific
  // class granted (by source.refId/sourceId === the old subclass's own id
  // — precise even for a multiclass character with two different
  // subclasses) before applying the new one. A first-time pick has no
  // previous subclass id, so this is a no-op then — existing callers are
  // unaffected. Best-effort only, same disclosed scope as removeFeature:
  // an unresolved pending choice the OLD subclass itself queued (rare —
  // most subclass sub-choices auto-resolve via canAutoResolve below) is
  // not retroactively removed.
  const previousSubclassId = targetClassId && classes
    ? classes.find(c => c.classId === targetClassId)?.subclassId
    : entity.identity.subclassId;
  // Closure pass 3 (item 3/10): resource removal now routes through
  // revokeResourceSource — a resource this subclass grants that ANOTHER
  // still-active source also grants (same resourceId, both registered via
  // a resource_grant entitlement) survives with its current/spent state
  // untouched, instead of the old direct sourceKind/sourceId filter, which
  // always deleted the physical entry outright regardless of any other
  // contributor. revokeResourceSource calls revokeEntitlementsFromSource
  // internally (covering the proficiency/spell-style entitlements too), so
  // no separate call is needed here.
  const strippedEntity: Entity = previousSubclassId
    ? revokeResourceSource({
        ...entity,
        features: entity.features.filter(f => !(f.source.kind === 'subclass' && f.source.refId === previousSubclassId)),
      }, 'subclass', previousSubclassId)
    : entity;

  let updated: Entity = classes && classes.length > 0 && targetClassId
    ? {
        ...strippedEntity,
        identity: {
          ...strippedEntity.identity,
          classes: classes.map(c => c.classId === targetClassId ? { ...c, subclassId: asSubclassId(subclassId) } : c),
        },
      }
    : {
        ...strippedEntity,
        identity: { ...strippedEntity.identity, subclassId },
      };
  if (classes && classes.length > 0 && targetClassId) updated = syncLegacyIdentity(updated);

  for (const entry of subclassProgression.entries) {
    if (entry.level > ownClassLevel) continue;
    for (const grant of entry.grants) {
      // SUBCLASS-CHANGE-1: explicit source so a resource this subclass
      // grants (e.g. Battle Master's Superiority Dice) is correctly tagged
      // sourceKind:'subclass' instead of defaulting to 'class' (applyGrant's
      // own fallback when no source is passed) — required for the stripping
      // above to actually find and remove it on a later subclass change.
      // Features are unaffected by this — they already carry their own
      // explicit source on the content literal itself (required for
      // deriveSubclassId to work at all), so applyGrant's fallback never
      // applies to them here.
      updated = applyGrant(updated, grant, entry.level, classId, { kind: 'subclass', id: subclassId });
    }
    for (const choice of entry.choices) {
      if (canAutoResolve(choice)) {
        if (Array.isArray(choice.pool) && choice.pool.length > 0) {
          for (const grant of choice.grants) {
            updated = applyGrant(updated, grant, entry.level, classId);
          }
        }
      } else {
        updated = queueChoice(updated, choice, entry.level, classId, { kind: 'subclass', id: subclassId });
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
  // Closure pass 3 (item 1): the class/subclass/race grants the OPPORTUNITY
  // to learn a spell (this queued choice); the player picks which one. That
  // opportunity is source-owned the same way a resolved tool/language/skill
  // choice is (closure pass 2) — losing the class/subclass that granted the
  // choice should be able to remove the resulting known spell too, without
  // touching a DIFFERENT source's grant of the same spell. Falls back to
  // 'manual' when the choice carries no explicit provenance (e.g. an
  // in-play "+Learn Spell" ad-hoc pick with no queued ChoiceState source).
  const pending = entity.choices.find(c => c.id === choiceId);
  const spellSource: { kind: EntitlementSourceKind; id?: string } = pending?.sourceKind
    ? { kind: pending.sourceKind, id: pending.sourceId }
    : { kind: 'manual', id: undefined };
  let updated: Entity = grantEntitlements(entity, [
    ...newCantrips.map(key => ({ kind: 'cantrip_access' as const, key, sourceKind: spellSource.kind, sourceId: spellSource.id, choiceId })),
    ...newKnown.map(key    => ({ kind: 'spell_access'   as const, key, sourceKind: spellSource.kind, sourceId: spellSource.id, choiceId })),
  ]);
  updated = {
    ...updated,
    choices: updated.choices.map(c =>
      c.id === choiceId ? { ...c, resolved: true, selections: spellIds } : c
    ),
  };
  return recomputeDerived(updated, rules);
}

// ── Expertise / Tool / Language choices ──────────────────────────────────────

/**
 * CHOICE-AUTHORING-1: authoritative pool-restriction check for the three
 * apply*ChoiceToEntity functions below. Previously each of these trusted the
 * caller (in practice, always a picker UI reading choiceEligibility.ts's
 * already-filtered options) to only ever pass pool-legal ids — real for
 * every existing UI path, but not enforced by the one place that's supposed
 * to be authoritative for runtime legality, so a restricted pool ("choose
 * one of smith's tools, brewer's supplies, or mason's tools") was only ever
 * a UI-layer suggestion, not a real constraint. `'all'`/FilterExpression
 * pools impose no extra restriction (the eligibility helpers already narrow
 * those); a literal array pool is checked here.
 */
function checkPoolRestriction(pool: ChoiceDefinition['pool'], ids: string[], label: string): void {
  if (!Array.isArray(pool)) return;
  const legal = new Set(pool.map(o => String(o.value ?? o.id)));
  for (const id of ids) {
    if (!legal.has(id)) throw new Error(`"${id}" is not in this choice's ${label} pool.`);
  }
}

/**
 * Resolves an 'expertise' pending choice. Bypasses resolveChoice for the
 * same reason ASI/subclass/infusion/spell do — the legal pool is computed
 * live from the character's own current proficiencies (item 3: "eligible
 * expertise target = character currently proficient AND not already expert
 * AND allowed by source choice"), not a static content-authored array, so
 * only the picker (which reads live entity.skills.skills) can know it.
 *
 * Applies by synthesizing ONE Feature (id `${choiceId}_grant`) whose effects
 * are grant_proficiency/'multiply' per selected skill — the exact mechanism
 * pipeline.ts already uses for expertise (see applyStatModifiers's sibling
 * skill-effect handling, and AsiFeatPicker.tsx's Feat.skillChoice, the only
 * other place in this engine that already builds this effect shape from a
 * player pick). Granting it through applyGrant({kind:'feature',...}) — the
 * same choke point every other feature grant goes through — means the
 * synthetic feature is a normal entity.features entry: it shows up on the
 * Features tab like any other, and (since its `source.kind` is inherited
 * from the SAME class the expertise choice came from) it's swept up by the
 * existing class-change feature-stripping logic exactly like every other
 * class-sourced feature, satisfying item 6 without new removal machinery.
 */
export function applyExpertiseChoiceToEntity(
  entity:   Entity,
  choiceId: string,
  skillIds: string[],
  rules:    CampaignRules,
): Entity {
  const pending = entity.choices.find(c => c.id === choiceId);
  if (!pending || pending.resolved) return entity;
  if (skillIds.length !== pending.definition.count) {
    throw new Error(`Expected ${pending.definition.count} expertise selections, got ${skillIds.length}.`);
  }
  if (new Set(skillIds).size !== skillIds.length) {
    throw new Error('Duplicate expertise selections in the same choice.');
  }
  checkPoolRestriction(pending.definition.pool, skillIds, 'restricted skill');
  for (const id of skillIds) {
    const entry = entity.skills.skills[id as SkillName];
    if (!entry) throw new Error(`"${id}" isn't a real skill.`);
    if (!entry.trained) throw new Error(`Not proficient in "${id}" — expertise requires existing proficiency.`);
    if (entry.expertise) throw new Error(`Already has expertise in "${id}".`);
  }

  const grantFeature: Feature = {
    id: `${choiceId}_grant`,
    name: pending.definition.prompt || 'Expertise',
    description: `Expertise: ${skillIds.join(', ')}.`,
    source: { kind: 'class', refId: pending.definition.forClassId ?? entity.identity.classId },
    level: pending.grantedAt,
    effects: skillIds.map(skillId => ({
      type: 'grant_proficiency' as const, target: `skill:${skillId}`,
      operation: 'multiply' as const, value: null, condition: null,
    })),
    actions: [], choices: [], passive: true,
  };
  let updated = applyGrant(entity, { kind: 'feature', value: grantFeature }, pending.grantedAt, pending.definition.forClassId);
  updated = {
    ...updated,
    choices: updated.choices.map(c => c.id === choiceId ? { ...c, resolved: true, selections: skillIds } : c),
  };
  return recomputeDerived(updated, rules);
}

/**
 * Resolves a 'tool' pending choice — reuses the existing Grant.kind:
 * 'proficiency' mechanism (the same one static content already uses to
 * grant a FIXED tool list) rather than inventing a new mutation path;
 * `entity.proficiencies.tools` already dedupes on merge. Bypasses
 * resolveChoice for the same 'all'-sentinel-pool reason as every other
 * live-picker-driven choice above; a literal-array pool (a restricted
 * "choose one of: X, Y, Z") still routes through here too — checkPoolRestriction
 * enforces it as the authoritative check, not just the picker UI.
 */
export function applyToolChoiceToEntity(
  entity:   Entity,
  choiceId: string,
  toolIds:  string[],
  rules:    CampaignRules,
): Entity {
  const pending = entity.choices.find(c => c.id === choiceId);
  if (!pending || pending.resolved) return entity;
  if (toolIds.length !== pending.definition.count) {
    throw new Error(`Expected ${pending.definition.count} tool selections, got ${toolIds.length}.`);
  }
  if (new Set(toolIds).size !== toolIds.length) {
    throw new Error('Duplicate tool selections in the same choice.');
  }
  checkPoolRestriction(pending.definition.pool, toolIds, 'restricted tool');
  for (const id of toolIds) {
    if (entity.proficiencies.tools.includes(id)) throw new Error(`Already proficient with "${id}".`);
  }
  // Closure pass 2: tag the resulting entitlement(s) with the choice's own
  // explicit provenance (ChoiceState.sourceKind/sourceId, closure pass 2)
  // when set, falling back to classId-inference the same way applyGrant's
  // own default already does — plus choiceId, so removing just THIS
  // choice's origin (via revokeEntitlementsFromChoice) doesn't disturb a
  // different grant from the same source.
  let updated = applyGrant(
    entity, { kind: 'proficiency', value: { tools: toolIds } }, pending.grantedAt, pending.definition.forClassId,
    pending.sourceKind
      ? { kind: pending.sourceKind, id: pending.sourceId, choiceId }
      : pending.definition.forClassId
        ? { kind: 'class', id: pending.definition.forClassId, choiceId }
        : { kind: 'manual', choiceId },
  );
  updated = {
    ...updated,
    choices: updated.choices.map(c => c.id === choiceId ? { ...c, resolved: true, selections: toolIds } : c),
  };
  return recomputeDerived(updated, rules);
}

/** Resolves a 'language' pending choice — same shape as applyToolChoiceToEntity above, targeting entity.proficiencies.languages instead. */
export function applyLanguageChoiceToEntity(
  entity:      Entity,
  choiceId:    string,
  languageIds: string[],
  rules:       CampaignRules,
): Entity {
  const pending = entity.choices.find(c => c.id === choiceId);
  if (!pending || pending.resolved) return entity;
  if (languageIds.length !== pending.definition.count) {
    throw new Error(`Expected ${pending.definition.count} language selections, got ${languageIds.length}.`);
  }
  if (new Set(languageIds).size !== languageIds.length) {
    throw new Error('Duplicate language selections in the same choice.');
  }
  checkPoolRestriction(pending.definition.pool, languageIds, 'restricted language');
  for (const id of languageIds) {
    if (entity.proficiencies.languages.includes(id)) throw new Error(`Already knows "${id}".`);
  }
  let updated = applyGrant(
    entity, { kind: 'proficiency', value: { languages: languageIds } }, pending.grantedAt, pending.definition.forClassId,
    pending.sourceKind
      ? { kind: pending.sourceKind, id: pending.sourceId, choiceId }
      : pending.definition.forClassId
        ? { kind: 'class', id: pending.definition.forClassId, choiceId }
        : { kind: 'manual', choiceId },
  );
  updated = {
    ...updated,
    choices: updated.choices.map(c => c.id === choiceId ? { ...c, resolved: true, selections: languageIds } : c),
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
    const used  = Math.max(0, Math.min(prev?.[t]?.used ?? 0, total));
    result[t] = { total, used };
  });
  return result;
}

/** Pact magic is one pool whose tier can change; carry its spent count across tiers. */
function preservePactUsedSlots(previous: SpellSlots | undefined, next: SpellSlots): SpellSlots {
  const spent = Object.values(previous ?? {}).reduce((sum, slot) => sum + Math.max(0, slot.used), 0);
  const result = { ...next };
  let remaining = spent;
  for (const tier of Object.keys(next) as (keyof SpellSlots)[]) {
    const used = Math.min(remaining, next[tier].total);
    result[tier] = { ...next[tier], used };
    remaining -= used;
  }
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
  targetClass?: CharClass,
  classDefinitions: readonly CharClass[] = ALL_CHAR_CLASSES,
  /** Table-first resolution: the physically-rolled HP die result, when
   *  rules.hpMode === 'rolled' and the UI collected it (manually entered or
   *  via its own "Roll in App" convenience) before calling this — see
   *  applyHP's own doc comment. undefined (every existing caller) is
   *  unaffected. */
  manualHpRoll?: number,
): Entity {
  const classes = getClassLevels(entity).filter(c => c.level > 0);
  targetClass = targetClass ?? classDefinitions.find(c => c.id === targetClassId);
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

  // Capture the spellcasting ability before this level's grants apply.
  // entity.spellcasting.ability is a SINGLE scalar — it can only ever agree
  // with one class's casting ability at a time, so for a genuine multiclass
  // caster (Wizard/Cleric, etc.) it's kept pinned to whichever class first
  // initialized spellcasting, rather than being silently reset by a LATER
  // class's own init_spellcasting grant every time that class levels up.
  // This is correct for a single-class caster (the only class there is)
  // and a reasonable, STABLE "primary/headline" value for a multiclass one
  // (shown as the one "Spellcasting" summary stat — TabFeatures.tsx). It is
  // NOT what determines an individual spell's actual casting ability or
  // save DC any more — rules-engine blocker B fix: that's resolved fresh,
  // per spell, from the spell's own granting source (its class/subclass/
  // racial/item entitlement) via resolveSpellAbility (actionCards.ts),
  // which never reads this scalar for a class-sourced spell at all. A
  // Wizard/Cleric multiclass's Cleric spells correctly use WIS via that
  // path even while this headline scalar stays pinned to Wizard's INT.
  const abilityBefore = updated.spellcasting?.ability;

  updated = applyHP(updated, entry.hpDie, rules.hpMode, newClassLevel, rules, progression.hpAbility ?? 'con', isVeryFirstLevel, manualHpRoll);

  if (isVeryFirstLevel && targetClass) {
    updated = applyGrant(updated, { kind: "proficiency", value: { armor: targetClass.armorProfs, weapons: targetClass.weaponProfs, tools: targetClass.toolProfs } }, 1, targetClassId);
    updated = { ...updated, proficiencies: { ...updated.proficiencies, savingThrows: targetClass.savingThrows ?? [] } };
  }

  if (isReducedMulticlassEntry) {
    const mcProf = multiclassProficienciesFor(targetClass);
    if (mcProf) updated = applyGrant(updated, { kind: 'proficiency', value: mcProf }, newClassLevel, targetClassId);
  }

  for (const grant of entry.grants) {
    if (isReducedMulticlassEntry && (grant.kind === 'proficiency' || grant.kind === 'starting_item')) continue; // superseded by the reduced table above
    updated = applyGrant(updated, grant, newClassLevel, targetClassId);
  }

  for (const choice of entry.choices) {
    if (isReducedMulticlassEntry && ['skill', 'tool', 'equipment'].includes(choice.kind)) continue;
    if (canAutoResolve(choice)) {
      if (Array.isArray(choice.pool) && choice.pool.length > 0) {
        for (const grant of choice.grants) updated = applyGrant(updated, grant, newClassLevel, targetClassId);
      }
    } else {
      updated = queueChoice(updated, { ...choice, forClassId: targetClassId }, newClassLevel, targetClassId,
        { kind: 'class', id: targetClassId });
    }
  }

  // Bonus feat house rule — keyed by TOTAL character level (unique per
  // level-up event regardless of which class advanced), not the per-class
  // level, which two different classes could otherwise collide on.
  if (bonusFeatEveryLevel(rules)) {
    const bonusId = 'bonus_feat_lvl';
    if (!updated.choices.some(c => c.id === `${bonusId}_${characterLevelAfter}`)) {
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
    ? [...classes, { classId: asClassId(targetClassId), subclassId: null, level: 1 }]
    : classes.map(c => c.classId === targetClassId ? { ...c, level: newClassLevel } : c);
  updated = { ...updated, identity: { ...updated.identity, classes: nextClasses } };
  updated = syncLegacyIdentity(updated);

  if (updated.spellcasting) {
    const finalClasses = getClassLevels(updated);
    const definitions = finalClasses.map(c => {
      const definition = c.classId === targetClassId ? targetClass : classDefinitions.find(d => d.id === c.classId);
      if (!definition && finalClasses.length > 1) throw new Error('Missing class definition: ' + c.classId);
      return { ...c, spellcastingStyle: definition?.spellcastingStyle };
    });
    const oldClasses = getClassLevels(entity).filter(c => c.level > 0);
    // Compatibility with old single-pact saves whose pact pool occupied slots.
    const oldPactOnly = oldClasses.length === 1 && !entity.spellcasting?.pactSlots &&
      (pactSlotTableFor(oldClasses[0].classId, oldClasses[0].subclassId) ||
       classDefinitions.find(d => d.id === oldClasses[0].classId)?.spellcastingStyle === 'pact');
    const oldNormal = oldPactOnly ? undefined : entity.spellcasting?.slots;
    const oldPact = entity.spellcasting?.pactSlots ?? (oldPactOnly ? entity.spellcasting?.slots : undefined);
    const pactClass = definitions.find(c => c.spellcastingStyle === 'pact' || pactSlotTableFor(c.classId, c.subclassId));
    const pactTable = pactClass ? pactSlotTableFor(pactClass.classId, pactClass.subclassId) ?? WARLOCK_SLOTS : null;
    let normalMax: SpellSlots;
    if (finalClasses.length > 1) {
      const casterLevel = multiclassCasterLevel(definitions);
      normalMax = casterLevel > 0 ? slotsForLevel(MULTICLASS_SPELLCASTER_SLOTS, casterLevel) : slotsFromCountArray(null);
    } else if (pactClass) {
      normalMax = slotsFromCountArray(null);
    } else {
      const counts = getSpellSlotsForClassLevel(targetClassId, newClassLevel);
      normalMax = counts && !targetClass?.spellcastingStyle
        ? slotsFromCountArray(counts) : updated.spellcasting.slots;
    }
    updated = { ...updated, spellcasting: { ...updated.spellcasting,
      slots: preserveUsedSlots(oldNormal, normalMax),
      pactSlots: pactClass && pactTable ? preservePactUsedSlots(oldPact, slotsForLevel(pactTable, pactClass.level)) : undefined,
    } };
  }

  return recomputeDerived(updated, rules);
}

// ── levelUp ───────────────────────────────────────────────────────────────────

export function levelUp(
  entity: Entity,
  targetLevel: number,
  progression: ClassProgression,
  rules: CampaignRules,
  classDefinitions: readonly CharClass[] = ALL_CHAR_CLASSES,
  /** Table-first resolution — see levelUpClass's own doc comment. Only
   *  meaningful (and only ever passed) when going up exactly one level, the
   *  single "Level Up" button's own usage; a multi-level jump (the
   *  progression planner) has no single roll to attribute, so this is
   *  simply threaded to whichever levelUpClass call actually runs — at most
   *  one, in that case. */
  manualHpRoll?: number,
): Entity {
  let updated = entity;
  const cls = classDefinitions.find(c => c.id === progression.classId);
  for (let lvl = entity.identity.level + 1; lvl <= targetLevel; lvl++) {
    updated = levelUpClass(updated, progression.classId, progression, rules, cls, classDefinitions, manualHpRoll);
  }
  return updated;
}

// ── projectToLevel ────────────────────────────────────────────────────────────
// Read-only "what would my character look like at level N" projection for the
// Progression Planner. A thin wrapper over levelUp() — that function already
// loops from the entity's current level up to targetLevel and already leaves
// any choice queueChoice() can't auto-resolve (ASI/feat, subclass, ...) as a
// pending entry in entity.choices rather than resolving it, which is exactly
// the "disclosed, not resolved" behavior a projection needs. The only real
// addition here is forcing hpMode:'max' for this call specifically —
// overriding whatever the real campaign's rules say — because a projection
// showing one possible dice-rolled HP outcome would be actively misleading
// for "what will I typically have"; the deterministic max is the same
// never-show-a-roll-that-won't-reproduce principle the real level-up preview
// already relies on (see LevelUpPreviewModal.tsx's own doc comment), just
// applied to a multi-level jump instead of a single real level-up. Single-
// class only — levelUp() reads entity.identity.level as the class's own
// level, which only holds for a non-multiclassed character; multiclass
// projection is a distinct follow-up, not built here.
export function projectToLevel(
  entity: Entity,
  targetLevel: number,
  progression: ClassProgression,
  rules: CampaignRules,
  classDefinitions: readonly CharClass[] = ALL_CHAR_CLASSES,
): Entity {
  return levelUp(entity, targetLevel, progression, { ...rules, hpMode: 'max' }, classDefinitions);
}

/**
 * A-61: one planned "+1 level" step in a multiclass projection — which
 * class, its already-resolved ClassProgression (subclass merged in if the
 * class already has one; see MulticlassProgressionPlannerModal's
 * resolveProgression call at add-time), and targetClass metadata only
 * needed the first time a step introduces a brand-new class (drives
 * levelUpClass's reduced-multiclass-proficiency grant).
 */
export type MulticlassPlanStep = {
  classId:      string;
  progression:  ClassProgression;
  targetClass?: CharClass;
};

/**
 * Projects an ORDERED sequence of single-class level-ups across possibly
 * different classes — e.g. Fighter 5/Wizard 2 → +1 Wizard → +1 Fighter →
 * +1 Wizard, matching how a real multiclass character actually levels
 * (one class at a time, player's choice each time), unlike projectToLevel's
 * single-class "jump straight to level N." Each step reuses levelUpClass
 * exactly as real leveling does — always max HP, same as projectToLevel.
 */
export function projectMulticlassSequence(
  entity: Entity,
  steps:  MulticlassPlanStep[],
  rules:  CampaignRules,
  classDefinitions: readonly CharClass[] = ALL_CHAR_CLASSES,
): Entity {
  const forcedRules: CampaignRules = { ...rules, hpMode: 'max' };
  return steps.reduce(
    (updated, step) => levelUpClass(updated, step.classId, step.progression, forcedRules, step.targetClass, classDefinitions),
    entity,
  );
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
  const choiceSource = pending.sourceKind
    ? { kind: pending.sourceKind, id: pending.sourceId, choiceId: pending.id }
    : pending.definition.forClassId
      ? { kind: 'class' as const, id: pending.definition.forClassId, choiceId: pending.id }
      : { kind: 'manual' as const, choiceId: pending.id };

  for (const selId of selections) {
    if (!Array.isArray(pending.definition.pool)) continue;
    const option = pending.definition.pool.find(o => o.id === selId);
    if (!option) throw new Error(`Invalid selection: ${selId}`);

    for (const grant of pending.definition.grants) {
      updated = applyGrant(updated, grant, pending.grantedAt, pending.definition.forClassId, choiceSource);
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

    // Skill choices: mark the skill as trained. Closure pass 2: this has no
    // backing Feature/Effect at all (it never did — see swapBackground's own
    // doc comment on this exact gap), so it's routed through the new
    // entitlement system instead of a raw flat-field mutation — recompute
    // then derives skills[x].trained from entitlements, so removing this
    // choice's origin later correctly un-trains it (unless another source
    // still grants it, or it's flagged sourceKind:'manual' — untraceable
    // provenance stays permanent, same conservative rule everywhere else).
    if (pending.definition.kind === "skill") {
      const skillName = option.value as string;
      if (updated.skills.skills[skillName as keyof typeof updated.skills.skills]) {
        updated = grantEntitlement(updated, {
          kind: 'skill_proficiency', key: skillName,
          sourceKind: pending.sourceKind ?? 'manual', sourceId: pending.sourceId, choiceId: pending.id,
        });
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

// ── STARTING-EQUIPMENT-1 ─────────────────────────────────────────────────────
// A dedicated resolver for kind:'equipment' choices using the new
// exact_options/bundle_options/filtered_item styles (ChoiceDefinition's own
// doc comment explains the shapes). Deliberately separate from
// resolveChoice() above rather than folding into it: resolveChoice's
// `selections: string[]` contract (each entry a pool-option id) doesn't fit
// a filtered_item choice, whose "selections" are real item ids with no pool
// at all — extending that one shared function's contract to cover this would
// risk every OTHER choice kind it already serves (skill/spell/language/...).
// Every existing equipment choice literal in src/content (no `equipmentStyle`
// set) is untouched and keeps going through resolveChoice() exactly as
// before — this function is additive, not a replacement.

export type EquipmentChoiceResolution =
  | { style: 'filtered_item'; itemIds: string[] }
  | { style: 'exact_options' | 'bundle_options'; optionId: string; filteredItemIds?: string[] };

/** Caller supplies item lookup (Tier-1 index entries) — this function does
 *  no I/O and doesn't care whether the source is the official spellRepo-
 *  style index, homebrew, or a merge of both. */
export function resolveEquipmentChoice(
  entity: Entity,
  choiceId: string,
  resolution: EquipmentChoiceResolution,
  itemLookup: (id: string) => ItemIndexEntry | undefined,
  rules: CampaignRules,
): Entity {
  const pending = entity.choices.find(c => c.id === choiceId);
  if (!pending) throw new Error(`Choice not found: ${choiceId}`);
  if (pending.definition.kind !== 'equipment') throw new Error(`Not an equipment choice: ${choiceId}`);

  function requireMatches(ids: string[], constraint: ItemFilterConstraint) {
    for (const id of ids) {
      const item = itemLookup(id);
      if (!item || !itemMatchesConstraint(item, constraint)) {
        throw new Error(`Item "${id}" does not satisfy the required constraint for this choice.`);
      }
    }
  }

  let fixedItemIds: string[] = [];
  let filteredItemIds: string[] = [];
  let selections: string[] = [];

  if (resolution.style === 'filtered_item') {
    const constraint = pending.definition.itemFilter ?? {};
    if (resolution.itemIds.length !== pending.definition.count) {
      throw new Error(`Expected ${pending.definition.count} item(s), got ${resolution.itemIds.length}.`);
    }
    requireMatches(resolution.itemIds, constraint);
    filteredItemIds = resolution.itemIds;
    selections = filteredItemIds;
  } else {
    const pool = Array.isArray(pending.definition.pool) ? pending.definition.pool : [];
    const option = pool.find(o => o.id === resolution.optionId);
    if (!option) throw new Error(`Invalid selection: ${resolution.optionId}`);
    fixedItemIds = Array.isArray(option.value) ? option.value as string[] : [];
    if (option.itemFilter) {
      const got = resolution.filteredItemIds ?? [];
      if (got.length !== option.itemFilter.quantity) {
        throw new Error(`Expected ${option.itemFilter.quantity} item(s), got ${got.length}.`);
      }
      requireMatches(got, option.itemFilter.constraint);
      filteredItemIds = got;
    }
    selections = [resolution.optionId, ...filteredItemIds];
  }

  let updated = entity;
  for (const grant of pending.definition.grants) {
    updated = applyGrant(updated, grant, pending.grantedAt);
  }
  for (const itemId of [...fixedItemIds, ...filteredItemIds]) {
    updated = {
      ...updated,
      inventory: {
        ...updated.inventory,
        carried: [...updated.inventory.carried, { itemId, quantity: 1, attuned: false, features: [] }],
      },
    };
  }
  updated = {
    ...updated,
    choices: updated.choices.map(c => c.id === choiceId ? { ...c, resolved: true, selections } : c),
  };

  return recomputeDerived(updated, rules);
}
/** Shared creation/live acquisition. Existing classes are not granted twice. */
export function acquireClass(entity: Entity, cls: CharClass, rules: CampaignRules,
  classDefinitions: readonly CharClass[] = ALL_CHAR_CLASSES): Entity {
  if (getClassLevels(entity).some(c => c.classId === cls.id && c.level > 0)) return entity;
  return levelUpClass(entity, cls.id, getProgressionForClass(cls), rules, cls, classDefinitions);
}

/** Creation-only reset; historical/manual ownership survives reselection. */
export function resetCreationClass(entity: Entity, hitDie: number): Entity {
  // Revert resolved-ASI stat bumps BEFORE dropping the choices that record them.
  const stripped = stripResolvedAsiStats(initializeEntitlementInputs(entity));

  let clean = stripped;
  for (const classId of new Set((stripped.entitlements ?? []).filter(e => e.sourceKind === 'class').map(e => e.sourceId))) {
    clean = revokeResourceSource(clean, 'class', classId);
  }
  for (const subclassId of new Set((stripped.entitlements ?? []).filter(e => e.sourceKind === 'subclass').map(e => e.sourceId))) {
    clean = revokeResourceSource(clean, 'subclass', subclassId);
  }
  for (const choice of stripped.choices.filter(c => c.grantedAt > 0)) {
    clean = revokeEntitlementsFromChoice(clean, choice.id);
  }
  return {
    ...clean,
    identity: { ...clean.identity, classId: "", classes: [], level: 0, subclassId: null },
    features: stripped.features.filter(
      f => f.source.kind !== 'class' && f.source.kind !== 'subclass'
    ),
    choices:   stripped.choices.filter(c => c.grantedAt === 0),
    resources: {
      ...stripped.resources,
      // Only drop resources the PREVIOUS class granted — a racial resource
      // (Dragonborn's Breath Weapon, Half-Orc's Relentless Endurance, etc.)
      // has sourceKind !== 'class' (or undefined, for characters saved
      // before this field existed) and survives a class change untouched.
      custom: clean.resources.custom,
      hp:      { current: 0, maximum: 0, temp: 0 },
      hitDice: { die: hitDie, total: 0, remaining: 0 },
    },
    spellcasting: clean.spellcasting && clean.entitlements?.some(e => e.kind === 'spell_access' || e.kind === 'cantrip_access')
      ? { ...clean.spellcasting, slots: slotsFromCountArray(null), pactSlots: undefined,
          known: [], cantrips: [], prepared: [], concentrating: null }
      : null,
  };
}
