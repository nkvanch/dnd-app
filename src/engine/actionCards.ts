// ============================================================================
// FILE: src/engine/actionCards.ts
// Action Card generator engine.
//
// Two kinds of features produce cards:
//   1. Features with activation (class abilities, racial abilities, etc.)
//   2. Spells in entity.spellcasting.known / prepared / cantrips
//
// Passive features (no activation field) are never given cards.
// ============================================================================

import { resourceInRange } from './resourceGates';
import {
  Feature, Entity, ActionCard, ActionCardType, ActionCardColor,
  AbilityEffect, FeatureActivation, Spell, OutcomeKey,
  FeatureInstance, Ability, CharClass, EntitlementSourceKind, SpellPreparationPolicy,
  SpellCastingContext, Race, Item,
} from './types';
import { spellRepo } from '../content/spellRepo';
import { effectiveItemFeatures, isItemMechanicallyActive, resolveItemDefinition } from './itemMechanics';
import { isWeapon } from '../content/items/itemBrowse';
import { toItemIndexEntry } from '../content/itemRepo.types';
import { usesLargeCreatureWeaponDice } from './houseRules';
import { hasLegalSpellPayment } from './spellPayment';
import { isIncapacitated, isDead, incapacitationReason } from './combat';
import { CampaignRules } from './types';
import { ALL_CHAR_CLASSES } from '../content/classes';
import { ALL_RACES } from '../content/races';
import { getClassLevels } from './multiclass';

// ── Large-creature weapon dice (house rule) ──────────────────────────

// Bug fix (architecture review E6): this used to be a hardcoded 1-entry id
// allowlist that a race/subrace dev had to remember to hand-edit for every
// new Large race — Race.size/Subrace.size already exist as content fields
// for exactly this, but were never read for mechanics anywhere. Now reads
// the entity's actual race/subrace content record (subrace's own `size`
// wins when set, since it can override the parent race's — e.g. a Large
// "Giant" subrace of an otherwise-Medium race) instead of an id lookup
// table. The feature-id fallback stays as a last-resort safety net for a
// homebrew race authored before this field existed.
/**
 * Rules-engine blocker RE-AUDIT closure (dependency inversion, 1A): `races`
 * used to be resolved by reaching into useHomebrewStore.getState() directly
 * from inside this pure engine function — a rules-core file must never read
 * application/store state implicitly. The APPLICATION layer now resolves
 * the correct merged/ruleset-filtered race list (getMergedContentDB) and
 * passes it in; omitting it falls back to the deterministic, static
 * official race catalog (ALL_RACES) — correct for every test and any
 * caller that hasn't been updated to pass homebrew-aware content, though it
 * won't reflect a homebrew race's own size.
 */
export function isLargeCreature(entity: Entity, races: readonly Race[] = ALL_RACES): boolean {
  const raceId = entity.identity.raceId;
  if (raceId) {
    const race = races.find(r => r.id === raceId);
    if (race) {
      const subrace = entity.identity.subRaceId
        ? race.subraces?.find(sr => sr.id === entity.identity.subRaceId)
        : undefined;
      const size = subrace?.size ?? race.size;
      if (size) return size === 'Large';
    }
  }
  return entity.features.some(f => f.id === 'skeleton_giant_remains');
}

/**
 * Doubles the dice COUNT in a dice expression, per the DMG large-creature rule
 * ("twice the weapon's damage dice"). "1d8" -> "2d8", "2d6" -> "4d6",
 * "1d10+2" -> "2d10+2". Flat bonuses and non-dice text are left untouched.
 */
function doubleDice(dice: string): string {
  return dice.replace(/(\d+)d(\d+)/g, (_, count, sides) => `${parseInt(count, 10) * 2}d${sides}`);
}

/**
 * Options that tune card generation from active campaign rules AND
 * (rules-engine blocker RE-AUDIT closure — dependency inversion, 1B) carry
 * the explicit, pre-resolved content this call should use for spellcasting-
 * context/large-creature/item resolution. The APPLICATION layer computes
 * this ONCE per mutation (getMergedContentDB(entity.rulesetId) — classes/
 * races/spells/items all come from that SAME merged snapshot, never a
 * second ad-hoc merge path) and passes it down — this file never reaches
 * into a store for any of it. Omitting a field falls back to the matching
 * deterministic, static official-only catalog on each function that
 * consumes it (ALL_CHAR_CLASSES / ALL_RACES / itemRepo-only / no homebrew
 * spells) — correct for every test and any caller not yet updated to pass
 * homebrew-aware content, though it won't reflect homebrew content in that
 * case.
 */
export type CardGenOptions = {
  doubleWeaponDice?: boolean;
  classDefs?:        readonly CharClass[];
  homebrewSpells?:   readonly Spell[];
  races?:            readonly Race[];
  /** Rules-engine blocker RE-AUDIT closure (dependency inversion, 1D):
   *  homebrew items — passed straight through to resolveItemDefinition/
   *  effectiveWeaponAttackFeatures (itemMechanics.ts). */
  items?:            readonly Item[];
};

// ── Spell casting context (rules-engine blockers A & B, re-audit closure) ───
//
// Preparation legality and spellcasting ability used to be resolved
// independently (a raw sourceKind check for legality; a separate priority
// walk for ability) — the Codex re-audit found this let a cast "legalize
// through one source, then calculate through a different one" (e.g. a
// Wizard/Sorcerer character casting a spell both classes have: legal via
// Sorcerer's known-spell access, but silently computed with Wizard's INT).
// SpellCastingContext is the one shared unit both now resolve from, so a
// cast's legality and its ability always come from the SAME candidate
// source — see selectSpellCastingContext.

/**
 * Resolves which of the character's OWN classes a subclass belongs to,
 * using the character's own ClassLevelEntry records (multiclass.ts) rather
 * than a global subclass→class content registry (none exists — see the
 * closure's own disclosed note: ClassProgression/SubclassProgression carry
 * no stable subclass `id` to reverse-lookup by). This is actually more
 * correct than a global registry would be: it only ever resolves to a class
 * the CHARACTER actually has this exact subclass on, homebrew or official,
 * and needs no subclass content registry lookup at all (satisfies closure
 * 2D — official, homebrew, and non-primary-multiclass subclasses all
 * resolve identically, since none of them go through subclass content).
 */
function resolveClassIdForSubclass(entity: Entity, subclassId: string): string | undefined {
  return getClassLevels(entity).find(c => c.subclassId === subclassId)?.classId;
}

function resolvePreparationPolicy(classId: string | undefined, classDefs: readonly CharClass[]): SpellPreparationPolicy {
  if (!classId) return 'always_available';
  return classDefs.find(c => c.id === classId)?.spellPreparationPolicy ?? 'known';
}

function resolveClassAbility(classId: string | undefined, classDefs: readonly CharClass[]): Ability | undefined {
  if (!classId) return undefined;
  return classDefs.find(c => c.id === classId)?.spellcastingAbility;
}

/**
 * Rules-completeness batch (ritual casting), HIGH-fix closure: this
 * class's own ritual-access requirement (see CharClass.ritualCastingPolicy's
 * own doc comment) — undefined classId (no class-rooted source) or an
 * unauthored/homebrew-omitted policy both fail closed to `'none'`.
 */
function resolveClassRitualCastingPolicy(classId: string | undefined, classDefs: readonly CharClass[]): 'none' | 'known' | 'prepared' | 'spellbook' {
  if (!classId) return 'none';
  return classDefs.find(c => c.id === classId)?.ritualCastingPolicy ?? 'none';
}

/**
 * Rules-completeness batch (ritual casting), HIGH-fix closure: whether a
 * ritual attempt is legal RIGHT NOW under one class's own ritual-access
 * policy — see SpellCastingContext.ritualLegal's own doc comment (types.ts)
 * for exactly why this deliberately disagrees with normal preparation
 * legality for a `'spellbook'`-policy class.
 */
function ritualLegalForPolicy(policy: 'none' | 'known' | 'prepared' | 'spellbook', isPrepared: boolean): boolean {
  switch (policy) {
    case 'spellbook': return true;   // legal straight from the spellbook, prepared or not
    case 'known':     return true;   // no separate prepared/unprepared state to bypass
    case 'prepared':  return isPrepared; // identical requirement to a normal cast
    case 'none':      return false;
  }
}

/**
 * Rules-completeness batch (ritual casting), one-issue closure: the ONE
 * shared UI decision for "is the SELECTED context legal to cast through,
 * given this cast mode" — normal casting checks `legal` (ordinary
 * preparation), ritual casting checks `ritualLegal` (a separate, source-
 * specific policy that can legally DISAGREE with `legal` — a Wizard ritual
 * straight from the spellbook is `ritualLegal: true` while `legal: false`
 * when unprepared). Deliberately takes the CONTEXT, never the coarse
 * card-level `ritualEligible`/`preparationOverridable` — those reflect a
 * best-effort DEFAULT context computed at generation time, which can be a
 * different context than the one actually selected (e.g. a multiclass
 * Wizard/Sorcerer spell where the player picks Sorcerer specifically).
 * TabActions.tsx and TabSpells.tsx both call this at every point where they
 * used to check `context.legal` unconditionally.
 */
export function isContextLegalForCastMode(context: SpellCastingContext, castMode?: 'ritual'): boolean {
  return castMode === 'ritual' ? context.ritualLegal === true : context.legal;
}

/**
 * Rules-completeness batch (ritual casting), one-issue closure: whether an
 * illegal cast attempt through `context` should offer the EXISTING "Cast
 * Anyway" preparation-bypass override at all. True only when the block is
 * genuinely about PREPARATION on a source that has SOME capability to cast
 * this way — normal casting, always (unchanged, matches every existing
 * "not prepared" prompt); ritual casting, only when `context.ritualEligible`
 * is true (e.g. an unprepared Cleric ritual — Cast Anyway legitimately
 * bypasses that class's own prep requirement, exactly like a normal cast).
 * False whenever the context has NO ritual-casting policy at all
 * (`ritualEligible` false, e.g. Sorcerer) — Cast Anyway bypasses
 * PREPARATION, not "grants a mechanical capability the source never had,"
 * and applyActionCardUse refuses that case unconditionally regardless of
 * bypassSpellPreparation (see its own doc comment) — offering the override
 * there would promise the player something it can never deliver. Already
 * implies `!isContextLegalForCastMode(context, castMode)` is true; callers
 * check that separately to decide the silent-decline path.
 */
export function needsPreparationOverride(context: SpellCastingContext, castMode?: 'ritual'): boolean {
  if (isContextLegalForCastMode(context, castMode)) return false;
  return castMode === 'ritual' ? context.ritualEligible === true : true;
}

/**
 * Deterministic, stable identity for a context — see SpellCastingContext.
 * contextKey's own doc comment (types.ts). Rules-engine blocker RE-AUDIT
 * closure (2A/2C): EntitlementRecord has no separate `id` field of its own
 * — its real stable identity IS its full structural shape (kind/sourceKind/
 * sourceId/choiceId, the same fields sameEntitlement() in entitlements.ts
 * already compares) — so this key includes ALL of them, not just
 * sourceKind+sourceId, to avoid colliding two entitlements that share a
 * source but differ by `kind` (spell_access vs cantrip_access) or
 * `choiceId` (two separate resolved choices granting the same class's
 * access). classId is layered on top since it's the resolved-ability-
 * relevant variant (e.g. a subclass source resolved to different parent
 * classes would otherwise share an identical entitlement identity).
 */
function makeContextKey(
  sourceKind: EntitlementSourceKind, sourceId: string | undefined, classId: string | undefined,
  entitlementKind?: string, choiceId?: string,
): string {
  return `${sourceKind}:${sourceId ?? ''}:${classId ?? ''}:${entitlementKind ?? ''}:${choiceId ?? ''}`;
}

/** Builds one real casting context for a specific classId, using that
 *  class's own authored policy/ability — shared by the direct 'class'-
 *  sourced branch and the ambiguous-legacy-candidate branch below, so
 *  "what does casting as class X actually mean" is computed exactly once. */
function contextForClass(
  classId: string, isPrepared: boolean, isCantrip: boolean, entity: Entity, classDefs: readonly CharClass[],
): { policy: SpellPreparationPolicy; ability: Ability; legal: boolean; ritualEligible: boolean; ritualLegal: boolean } {
  const policy  = isCantrip ? 'always_available' : resolvePreparationPolicy(classId, classDefs);
  const ability = resolveClassAbility(classId, classDefs) ?? entity.spellcasting?.ability ?? 'int';
  const legal   = policy === 'known' || policy === 'always_available' || isPrepared;
  const ritualPolicy   = resolveClassRitualCastingPolicy(classId, classDefs);
  const ritualEligible = ritualPolicy !== 'none';
  const ritualLegal     = ritualLegalForPolicy(ritualPolicy, isPrepared);
  return { policy, ability, legal, ritualEligible, ritualLegal };
}

/**
 * Builds every currently-valid casting context for one spell/cantrip —
 * every source (class/subclass/race/feat/item/manual/...) the entity
 * currently has real access through, each with its OWN preparation policy,
 * ability, and legality resolved together (never independently — see this
 * section's own header comment). `classDefs` defaults to the full official
 * catalog for callers/tests that want a fixed, isolated set; production
 * call sites pass the application-resolved merged content explicitly
 * (CardGenOptions.classDefs — see generateSpellCard/generateAllActionCards,
 * closures 2B and dependency-inversion 1B).
 */
export function resolveSpellCastingContexts(
  entity: Entity,
  spellId: string,
  classDefs: readonly CharClass[] = ALL_CHAR_CLASSES,
): SpellCastingContext[] {
  const isPrepared = entity.spellcasting?.prepared.includes(spellId) ?? false;
  const contexts: SpellCastingContext[] = [];

  // 1. A racial/feat/item grant_spell EFFECT can specify its own ability
  //    directly (e.g. a homebrew race's cantrip using CON) — the most
  //    specific possible signal, authored straight on the effect. Never
  //    gated by preparation (no class-style prep framework applies to a
  //    feature-granted spell). Marked explicitAbility so
  //    selectSpellCastingContext always prefers it (see that field's own
  //    doc comment).
  for (const f of entity.features) {
    if (!f.isActive) continue;
    const effects = f.effects ?? [];
    for (let effectIndex = 0; effectIndex < effects.length; effectIndex++) {
      const eff = effects[effectIndex];
      if (eff.type !== 'grant_spell') continue;
      const matches = (eff.cantripIds ?? []).includes(spellId) || (eff.spellIds ?? []).includes(spellId);
      if (!matches) continue;
      const ability = eff.spellcastingAbility ?? entity.spellcasting?.ability ?? 'int';
      // Rules-engine blocker RE-AUDIT closure (2A/2B — exact source
      // identity): a coarse `feature:${f.id}` key would collide when the
      // SAME feature carries two grant_spell effects for the same spell
      // with two DIFFERENT explicit abilities — a real, distinct mechanical
      // choice. `f.effects` is stable persisted content (an authored list,
      // never runtime-reordered), so its own index is a safe disambiguator
      // per this closure's own "stable persisted content" exception; the
      // spellId + resolved ability are layered on top so the key is
      // meaningful (not just an opaque index) and still differs whenever
      // the MECHANICS differ, even if content authoring ever reorders effects.
      contexts.push({
        contextKey: `feature:${f.id}:${effectIndex}:${spellId}:${ability}`,
        sourceKind: 'feature', sourceId: f.id,
        preparationPolicy: 'always_available',
        castingAbility: ability,
        legal: true,
        explicitAbility: eff.spellcastingAbility != null,
      });
    }
  }

  // 2. Entitlement-tracked sources — the existing provenance model (see
  //    EntitlementRecord's own doc comment). Every sourceKind is examined on
  //    its own coherent semantics, not a blanket "non-class => legal":
  //      - 'class': the owning class's OWN authored preparation policy
  //        (CharClass.spellPreparationPolicy — content-driven, ruleset-
  //        capable; see its own doc comment) decides. Cantrips are never
  //        gated regardless of policy (cantrip_access is tracked separately
  //        from prep bookkeeping — known directly from the entitlement
  //        KIND, no spell-content lookup needed, so an unloaded spell can't
  //        silently fail closed here).
  //      - a sourceKind:'manual' entitlement carrying ambiguousClassIds
  //        (closure 1F — unresolved legacy provenance): NOT a single
  //        always-legal manual context. Generates one REAL context PER
  //        candidate class, each with that class's own actual policy/
  //        ability, so an unresolved Wizard/Sorcerer Fireball offers a
  //        genuine Wizard-INT-prepared-required context AND a genuine
  //        Sorcerer-CHA-known context — never a single unrestricted one.
  //      - 'subclass': resolved to its parent class ONLY to get a correct
  //        casting ability; the grant itself (e.g. Cleric domain spells via
  //        `known_spells` in the subclass's own progression) is always
  //        available, matching the book rule that these don't need separate
  //        preparation.
  //      - everything else (race/subrace/background/feat/feature/item/
  //        spell/condition/campaign/plain manual): no class-style
  //        preparation framework applies at all — an item's own charges/
  //        uses (if any) are a completely separate resource-cost gate,
  //        already enforced by isFeatureAvailable, not by this function.
  const sources = (entity.entitlements ?? []).filter(
    e => (e.kind === 'spell_access' || e.kind === 'cantrip_access') && e.key === spellId,
  );
  for (const s of sources) {
    const entitlementIsCantrip = s.kind === 'cantrip_access';

    if (s.sourceKind === 'manual' && s.ambiguousClassIds && s.ambiguousClassIds.length > 0) {
      for (const candidateClassId of s.ambiguousClassIds) {
        const { policy, ability, legal, ritualEligible, ritualLegal } = contextForClass(candidateClassId, isPrepared, entitlementIsCantrip, entity, classDefs);
        contexts.push({
          contextKey: makeContextKey('manual', s.sourceId, candidateClassId, s.kind, s.choiceId),
          sourceKind: 'manual', sourceId: s.sourceId, classId: candidateClassId,
          preparationPolicy: policy, castingAbility: ability, legal, ritualEligible, ritualLegal,
          unresolvedLegacy: true,
        });
      }
      continue; // never ALSO emit a blanket "manual = always legal" context for this record
    }

    let classId: string | undefined;
    let policy:  SpellPreparationPolicy;
    let ability: Ability;
    let ritualEligible: boolean;
    let ritualLegal: boolean;

    if (s.sourceKind === 'class') {
      classId = s.sourceId;
      ({ policy, ability, ritualEligible, ritualLegal } = contextForClass(classId ?? '', isPrepared, entitlementIsCantrip, entity, classDefs));
    } else if (s.sourceKind === 'subclass') {
      classId = s.sourceId ? resolveClassIdForSubclass(entity, s.sourceId) : undefined;
      policy  = 'always_available';
      ability = resolveClassAbility(classId, classDefs) ?? entity.spellcasting?.ability ?? 'int';
      // Domain/circle spells are cast through the parent class's own casting
      // rules (RAW: they don't need separate preparation — resolved via the
      // SAME parent classId just derived above, never a second, independent
      // policy). Ritual legality follows suit: a domain spell is never
      // "unprepared" in the first place, so ritualLegal matches ritualEligible
      // exactly (both true only when the parent class has a ritual policy).
      const ritualPolicy = resolveClassRitualCastingPolicy(classId, classDefs);
      ritualEligible = ritualPolicy !== 'none';
      ritualLegal = ritualEligible;
    } else {
      classId = undefined;
      policy  = 'always_available';
      ability = entity.spellcasting?.ability ?? 'int';
      ritualEligible = false; // no class-rooted ritual-casting policy applies to a race/feat/item/manual grant
      ritualLegal = false;
    }

    const legal = policy === 'known' || policy === 'always_available' || isPrepared;
    contexts.push({
      contextKey: makeContextKey(s.sourceKind, s.sourceId, classId, s.kind, s.choiceId),
      sourceKind: s.sourceKind, sourceId: s.sourceId, classId,
      preparationPolicy: policy, castingAbility: ability, legal, ritualEligible, ritualLegal,
    });
  }

  // A spell with no tracked entitlement AT ALL (a legacy save predating the
  // entitlement system, before its one-time migration/reclassification —
  // see initializeEntitlementInputs/reclassifyManualSpellSources,
  // entitlements.ts) fails OPEN: legal, same conservatism as before rather
  // than inventing a heuristic that could wrongly block an unrecognized
  // source.
  if (contexts.length === 0) {
    contexts.push({
      contextKey: makeContextKey('manual', undefined, undefined),
      sourceKind: 'manual', preparationPolicy: 'always_available',
      castingAbility: entity.spellcasting?.ability ?? 'int', legal: true,
    });
  }

  return contexts;
}

/**
 * Collapses MECHANICALLY EQUIVALENT contexts down to one representative
 * each — same castingAbility + preparationPolicy + legal means the player
 * has no real decision to make between them (closure 1C: "you may collapse
 * contexts when all relevant cast mechanics are identical"). Two
 * mechanically DIFFERENT contexts (different ability, or one legal/one
 * not) always both survive, so `length > 1` is exactly "a real choice
 * exists" — the signal ActionCard.spellCastingContexts/the UI chooser key
 * off of.
 */
export function collapseDistinctSpellCastingContexts(contexts: SpellCastingContext[]): SpellCastingContext[] {
  const seen = new Map<string, SpellCastingContext>();
  for (const c of contexts) {
    const key = `${c.castingAbility}|${c.preparationPolicy}|${c.legal}`;
    if (!seen.has(key)) seen.set(key, c);
  }
  return Array.from(seen.values());
}

/** Fixed, principled tie-break order for selectSpellCastingContext — never
 *  raw entitlement array order (see its own doc comment). */
const SOURCE_KIND_PRIORITY: EntitlementSourceKind[] =
  ['class', 'subclass', 'race', 'subrace', 'feat', 'feature', 'item', 'background', 'spell', 'manual', 'condition', 'campaign'];

/**
 * Picks ONE casting context to actually use for a spell — the single
 * source both isSpellPreparationLegal and resolveSpellAbility now derive
 * from, so a cast can never "legalize through source A, then calculate
 * through source B" (the bug the Codex re-audit found). Prefers a LEGAL
 * context when any exist (an unprepared Wizard copy never wins over a
 * known Sorcerer copy of the same spell). When multiple contexts remain
 * (several legal at once, or none legal — falls back to picking among the
 * illegal ones so a reason/ability is still reportable), ties break
 * deterministically: the character's OWN earliest-taken class wins first
 * (getClassLevels' index — the existing "primary class" concept, see
 * ClassLevelEntry's own doc comment), then a fixed source-kind priority.
 * Never "whichever entitlement happens to be first in the array" — that's
 * exactly the un-principled rule the task explicitly forbids.
 */
export function selectSpellCastingContext(
  entity: Entity,
  spellId: string,
  classDefs: readonly CharClass[] = ALL_CHAR_CLASSES,
): SpellCastingContext {
  const contexts = resolveSpellCastingContexts(entity, spellId, classDefs);
  const legal = contexts.filter(c => c.legal);
  const pool = legal.length > 0 ? legal : contexts;

  const classOrder = getClassLevels(entity).map(c => c.classId as string);
  const rank = (c: SpellCastingContext): number => {
    if (c.explicitAbility) return -1; // always wins — see the field's own doc comment
    if (c.classId) {
      const idx = classOrder.indexOf(c.classId);
      if (idx >= 0) return idx;
    }
    return 1000 + SOURCE_KIND_PRIORITY.indexOf(c.sourceKind);
  };
  return pool.slice().sort((a, b) => rank(a) - rank(b))[0];
}

// ── Prepared-spell eligibility (rules-engine blocker A) ─────────────────────

/**
 * Classes that use SOME preparation model for their leveled spells
 * (spellbook-prepared or full-list-prepared — see CharClass.
 * spellPreparationPolicy's own doc comment). Derived live from the actual
 * class catalog rather than a hardcoded classId Set (Codex re-audit finding:
 * the previous version of this constant was exactly such a hardcoded Set,
 * omitted Artificer, and couldn't represent a ruleset where e.g. Ranger
 * prepares differently) — a homebrew or alternate-ruleset class is picked up
 * automatically the moment its own spellPreparationPolicy is authored, no
 * code change required. Kept under this name/shape for TabSpells.tsx's
 * existing "Prepared" badge/toggle display, which only needs a yes/no
 * classification, not the full per-spell context this file now derives it
 * from for actual legality.
 */
export const PREPARED_CASTER_CLASS_IDS = new Set(
  ALL_CHAR_CLASSES
    .filter(c => c.spellPreparationPolicy === 'spellbook_prepared' || c.spellPreparationPolicy === 'full_list_prepared')
    .map(c => c.id),
);

/**
 * The ONE authoritative check for whether a leveled spell is currently
 * legal to cast on preparation grounds alone — used by BOTH generateSpellCard
 * (to compute `available`/`preparationOverridable`) and applyActionCardUse
 * (actionUse.ts, to enforce it at cast time) so there is exactly one
 * definition of "prepared enough to cast," never two. Legal if ANY of the
 * spell's SpellCastingContexts (see resolveSpellCastingContexts, above) is
 * legal — removing one source can never silently revoke a different,
 * still-valid source's access.
 */
export function isSpellPreparationLegal(
  entity: Entity, spellId: string, classDefs: readonly CharClass[] = ALL_CHAR_CLASSES,
): boolean {
  return resolveSpellCastingContexts(entity, spellId, classDefs).some(c => c.legal);
}

// ── Multiclass spellcasting ability (rules-engine blocker B) ────────────────

/**
 * Resolves the correct casting ability for ONE specific spell/cantrip, from
 * the SAME selected context isSpellPreparationLegal effectively legalizes
 * through (selectSpellCastingContext) — never entity.spellcasting.ability's
 * single global scalar, which can only ever hold ONE value at a time and is
 * therefore structurally wrong for a multiclass character whose classes use
 * different abilities (a Wizard/Cleric multiclass has exactly one
 * spellcasting.ability field, but Wizard spells need INT and Cleric spells
 * need WIS — the field can only ever agree with one of them).
 *
 * Payment (which slot/resource pays for the cast) is intentionally NOT an
 * input here — spellPayment.ts's slot/resource selection is a completely
 * separate concern from which class's ability governs the spell (see the
 * task's own "payment is independent" constraint); a Wizard spell paid via
 * a shared multiclass slot or a Warlock spell paid via Pact Magic still
 * resolves its ability purely from its OWN casting context.
 */
export function resolveSpellAbility(
  entity: Entity,
  spellId: string,
  classDefs: readonly CharClass[] = ALL_CHAR_CLASSES,
): Ability {
  return selectSpellCastingContext(entity, spellId, classDefs).castingAbility;
}

// ── Per-spell spell save DC / attack bonus (rules-engine blocker B, 2E) ─────

function hasActiveOverride(entity: Entity, stat: string): boolean {
  return [...(entity.characterOverrides ?? []), ...(entity.dmOverrides ?? [])].some(o => o.active && o.stat === stat);
}

/**
 * Per-spell spell save DC, wired into the SAME production derived-stats
 * pipeline the character's headline `derived.spellSaveDC` already uses
 * (pipeline.ts) rather than a second formula engine: `derived.spellSaveDC`
 * is `8 + prof + mod(entity.spellcasting.ability)` plus any active feature-
 * effect/override bonus already baked in by recomputeDerived. The bonus
 * portion (everything beyond the pure ability-based baseline) is ability-
 * INDEPENDENT — a flat "+1 spell save DC" feature or override applies the
 * same regardless of which class cast the spell — so it's isolated once
 * (`derived.spellSaveDC - derived.abilityBasedDC[globalAbility]`) and
 * re-added on top of this spell's OWN resolved-ability baseline
 * (`derived.abilityBasedDC[ability]`, already computed for every ability by
 * recomputeDerived). An ACTIVE character/DM override on 'spellSaveDC' is a
 * human-stated flat final number ("your spell DC is 17") — existing
 * override precedence (2F) makes it authoritative over every spell
 * regardless of source, so it's returned as-is rather than decomposed.
 */
export function resolveSpellSaveDC(
  entity: Entity, spellId: string, classDefs: readonly CharClass[] = ALL_CHAR_CLASSES,
): number | null {
  return computeSpellSaveDCForAbility(entity, resolveSpellAbility(entity, spellId, classDefs));
}

/** Ability-parameterized core of resolveSpellSaveDC — shared with the
 *  "Cast as..." source-chooser label formatter (formatCastingContextLabel),
 *  which already has a specific SpellCastingContext's ability in hand and
 *  doesn't need to re-resolve it via a spellId. */
export function computeSpellSaveDCForAbility(entity: Entity, ability: Ability): number | null {
  if (!entity.spellcasting || entity.derived.spellSaveDC == null) return null;
  if (hasActiveOverride(entity, 'spellSaveDC')) return entity.derived.spellSaveDC;
  if (ability === entity.spellcasting.ability) return entity.derived.spellSaveDC;
  const flatBonus = entity.derived.spellSaveDC - entity.derived.abilityBasedDC[entity.spellcasting.ability];
  return entity.derived.abilityBasedDC[ability] + flatBonus;
}

/** Per-spell spell attack bonus — same reuse strategy as resolveSpellSaveDC
 *  above. `derived.abilityBasedDC[ability] - 8` recovers the pure
 *  "prof + mod(ability)" attack-bonus baseline for any ability from the
 *  already-computed DC array (DC is always exactly 8 higher than the
 *  matching attack bonus per the 5e formula), so no second per-ability
 *  attack-bonus table needs to exist alongside abilityBasedDC. */
export function resolveSpellAttackBonus(
  entity: Entity, spellId: string, classDefs: readonly CharClass[] = ALL_CHAR_CLASSES,
): number | null {
  return computeSpellAttackBonusForAbility(entity, resolveSpellAbility(entity, spellId, classDefs));
}

/** Ability-parameterized core of resolveSpellAttackBonus — see
 *  computeSpellSaveDCForAbility's own doc comment for why this shape exists. */
export function computeSpellAttackBonusForAbility(entity: Entity, ability: Ability): number | null {
  if (!entity.spellcasting || entity.derived.spellAttackBonus == null) return null;
  if (hasActiveOverride(entity, 'spellAttackBonus')) return entity.derived.spellAttackBonus;
  if (ability === entity.spellcasting.ability) return entity.derived.spellAttackBonus;
  const globalBaseline = entity.derived.abilityBasedDC[entity.spellcasting.ability] - 8;
  const flatBonus = entity.derived.spellAttackBonus - globalBaseline;
  const spellBaseline = entity.derived.abilityBasedDC[ability] - 8;
  return spellBaseline + flatBonus;
}

function entitlementSourceKindLabel(kind: EntitlementSourceKind): string {
  switch (kind) {
    case 'race':       return 'Racial';
    case 'subrace':    return 'Racial';
    case 'class':      return 'Class';
    case 'subclass':   return 'Subclass';
    case 'background': return 'Background';
    case 'feat':       return 'Feat';
    case 'feature':    return 'Feature';
    case 'item':       return 'Item';
    case 'spell':      return 'Spell';
    case 'condition':  return 'Condition';
    case 'campaign':   return 'Campaign';
    case 'manual':     return 'Manual';
    case 'mode':       return 'Mode';
  }
}

/**
 * Compact human label for one casting context — the "Cast as..." chooser
 * (closure 1C) uses this per option, e.g. "Wizard — INT — DC 15" or
 * "Sorcerer — CHA — Not Prepared". `classDefs` should be the SAME merged/
 * ruleset-resolved list the context was built from (the application layer's
 * explicit CardGenOptions.classDefs) so a homebrew class's own display name
 * is honored.
 */
export function formatCastingContextLabel(
  entity: Entity, context: SpellCastingContext, classDefs: readonly CharClass[] = ALL_CHAR_CLASSES,
): string {
  const className = context.classId
    ? (classDefs.find(c => c.id === context.classId)?.name ?? capitalize(context.classId))
    : entitlementSourceKindLabel(context.sourceKind);
  const abilityLabel = context.castingAbility.toUpperCase();
  const dc = computeSpellSaveDCForAbility(entity, context.castingAbility);
  const dcPart = !context.legal ? ' — Not Prepared' : dc != null ? ` — DC ${dc}` : '';
  return `${className} — ${abilityLabel}${dcPart}`;
}

// ── Weapon attack / damage computation ────────────────────────────────────────
// Attack/damage bonuses are computed once in pipeline.ts's recomputeDerived
// (entity.derived.attackBonuses) — see computeWeaponAttackBonuses there. This
// file only looks the result up by item id, it doesn't recompute it (used to,
// independently of TabCharacter.tsx's own copy, and the two had drifted).

function fmtBonus(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}

// ── Classification ────────────────────────────────────────────────────────────

/**
 * A spell_grant leveled-spell Feature (see traitCompiler.ts) carries a
 * `cast_spell` abilityEffect referencing a real Spell by id, rather than
 * being merged into entity.spellcasting.known — this looks up that Spell so
 * the card can render identically to a normally-known spell's card, just
 * sourced from a different Feature. Returns null for every ordinary feature.
 */
function findGrantedSpell(feature: Feature): Spell | null {
  const castEffect = (feature.abilityEffects ?? []).find(
    (e): e is Extract<AbilityEffect, { type: 'cast_spell' }> => e.type === 'cast_spell'
  );
  if (!castEffect) return null;
  return spellRepo.getSpellSync(castEffect.spellId) ?? null;
}

/**
 * Determines the card type from a feature's abilityEffects and tags.
 * Priority: granted-spell delegation → explicit tags → effect-type inference → default 'utility'.
 */
export function classifyFeature(feature: Feature): ActionCardType {
  const grantedSpell = findGrantedSpell(feature);
  if (grantedSpell) return classifySpell(grantedSpell);

  // Explicit tags win first
  if (feature.tags) {
    if (feature.tags.includes('transformation')) return 'transformation';
    if (feature.tags.includes('damage'))         return 'damage';
    if (feature.tags.includes('healing'))        return 'healing';
    if (feature.tags.includes('control'))        return 'control';
    if (feature.tags.includes('buff'))           return 'buff';
    if (feature.tags.includes('utility'))        return 'utility';
  }

  // Infer from abilityEffects
  const fx = feature.abilityEffects ?? [];
  if (fx.some(e => e.type === 'transform'))        return 'transformation';
  if (fx.some(e => e.type === 'damage'))           return 'damage';
  if (fx.some(e => e.type === 'heal'))             return 'healing';
  if (fx.some(e => e.type === 'apply_condition'))  return 'control';

  // Infer from active effects and passive effects
  if (fx.some(e => e.type === 'set_flag')) return 'buff';
  if (feature.effects.some(e =>
    e.type === 'stat_modifier' && (
      e.target === 'ac' || e.target === 'initiative' || e.target === 'speed'
    )
  )) return 'buff';

  if (feature.activation?.actionType === 'passive') return 'buff';

  return 'utility';
}

function classifySpell(spell: Spell): ActionCardType {
  const name = spell.name.toLowerCase();
  const desc = spell.description.toLowerCase();

  if (name.includes('heal') || name.includes('cure') || name.includes('restoration')) return 'healing';

  // Control keywords
  if (
    desc.includes('paralyz') || desc.includes('charm') || desc.includes('frighten') ||
    desc.includes('banish') || desc.includes('sleep') || desc.includes('incapacitat') ||
    desc.includes('restrain') || desc.includes('stun')
  ) return 'control';

  // Damage keywords in name or having damage dice
  if (
    desc.includes('damage') ||
    name.includes('bolt') || name.includes('blast') || name.includes('fire') ||
    name.includes('lightning') || name.includes('frost') || name.includes('thunder')
  ) return 'damage';

  // Buffs
  if (
    name.includes('bless') || name.includes('haste') || name.includes('shield') ||
    name.includes('stoneskin') || name.includes('mage armor') || name.includes('invisib') ||
    desc.includes('bonus') || desc.includes('advantage')
  ) return 'buff';

  return 'utility';
}

function cardColor(type: ActionCardType): ActionCardColor {
  switch (type) {
    case 'damage':         return 'red';
    case 'healing':        return 'green';
    case 'control':        return 'purple';
    case 'buff':           return 'blue';
    case 'transformation': return 'purple';
    case 'utility':        return 'gray';
  }
}

// ── Layer builders ────────────────────────────────────────────────────────────

/**
 * Layer 1: source type and card type.
 * Examples: "Lv 3 Spell • Damage", "Class Feature • Buff", "Bonus Action • Healing"
 */
export function buildLayer1(feature: Feature, cardType: ActionCardType): string {
  const grantedSpell = findGrantedSpell(feature);
  if (grantedSpell) return buildLayer1ForSpell(grantedSpell, cardType);

  const typeLabel = capitalize(cardType);
  const action    = feature.activation;

  if (!action) return `Feature • ${typeLabel}`;

  const actionLabel = actionTypeLabel(action.actionType);

  if (feature.source.kind === 'spell') {
    const spell = spellRepo.getSpellSync(feature.source.refId);
    if (spell) {
      const lvl = spell.level === 0 ? 'Cantrip' : `Lv ${spell.level} Spell`;
      return `${lvl} • ${typeLabel}`;
    }
    return `Spell • ${typeLabel}`;
  }

  const sourceLabel = sourceKindLabel(feature.source.kind, feature.sourceLabel);
  return `${sourceLabel} • ${actionLabel} • ${typeLabel}`;
}

export function buildLayer1ForSpell(spell: Spell, cardType: ActionCardType): string {
  const typeLabel = capitalize(cardType);
  const lvl       = spell.level === 0 ? 'Cantrip' : `Lv ${spell.level} Spell`;
  return `${lvl} • ${spell.school} • ${typeLabel}`;
}

/**
 * Layer 2: key mechanical summary.
 * Examples: "8d6 Fire • 20 ft radius", "+2 damage, B/P/S resistance"
 */
export function buildLayer2(feature: Feature, entity?: Entity, opts: CardGenOptions = {}): string {
  const grantedSpell = findGrantedSpell(feature);
  if (grantedSpell) return buildLayer2ForSpell(grantedSpell);

  const fx = feature.abilityEffects ?? [];

  const parts: string[] = [];

  // Weapon attack: prepend to-hit and fold the flat damage bonus into the dice.
  // Only item-sourced features with a damage ability effect are weapons.
  const isWeapon = entity && feature.source?.kind === 'item'
    && (feature.abilityEffects ?? []).some(e => e.type === 'damage');
  const atk = isWeapon
    ? entity!.derived.attackBonuses.find(ab => ab.id === feature.source.refId) ?? null
    : null;
  if (atk) {
    parts.push(`${fmtBonus(atk.bonus)} to hit`);
  }

  // The large-creature rule doubles WEAPON dice only (item-sourced attacks),
  // never spell or feature dice. atk is non-null exactly for weapon attacks.
  const doubleThisFeature = !!opts.doubleWeaponDice && atk !== null;

  for (const e of fx) {
    if (e.type === 'damage') {
      const dice = doubleThisFeature ? doubleDice(e.dice) : e.dice;
      // For weapon attacks, show "2d8+8" (dice + ability/magic bonus).
      // Only the FIRST damage effect gets the ability mod (the weapon swing);
      // rider damage (e.g. 3d6 necrotic) is shown without the mod.
      const isFirstDamage = fx.findIndex(x => x.type === 'damage') === fx.indexOf(e);
      if (atk && isFirstDamage && atk.damageBonus !== 0) {
        parts.push(`${dice}${fmtBonus(atk.damageBonus)} ${capitalize(e.damageType)}`);
      } else {
        parts.push(`${dice} ${capitalize(e.damageType)}`);
      }
    } else if (e.type === 'heal') {
      parts.push(`Heal ${e.dice}`);
    } else if (e.type === 'apply_condition') {
      parts.push(capitalize(e.conditionId.replace(/_/g, ' ')));
    } else if (e.type === 'grant_speed') {
      parts.push(`${capitalize(e.speedType)} speed ${e.amount} ft`);
    } else if (e.type === 'set_flag') {
      parts.push(capitalize(e.flag.replace(/_/g, ' ')));
    } else if (e.type === 'restore_resource') {
      const amt = e.amount === 'full' ? 'Full' : `+${e.amount}`;
      parts.push(`${amt} ${e.resourceId.replace(/_/g, ' ')}`);
    } else if (e.type === 'spend_resource') {
      parts.push(`−${e.amount} ${e.resourceId.replace(/_/g, ' ')}`);
    }
  }

  // Passive resistance effects (e.g. Rage)
  const resistances = feature.effects
    .filter(e => e.type === 'grant_resistance')
    .map(e => capitalize(e.target));
  if (resistances.length > 0) {
    parts.push(`Resist ${resistances.join('/')}`);
  }

  if (feature.activation?.range && feature.activation.range !== 'self') {
    parts.push(`Range ${feature.activation.range}`);
  }

  return parts.join(' • ') || feature.description.slice(0, 60);
}

/**
 * `entity`, when passed, wires the real per-spell attack bonus (closure 2E:
 * production card UI, not just a helper-level number) into a detected
 * "melee/ranged spell attack" spell — resolveSpellAttackBonus (above)
 * already reuses the existing derived-stats/override pipeline, this just
 * threads the spell's own id through to it. Same lightweight description-
 * regex detection style buildLayer2ForSpell already uses for damage/heal
 * dice — not a new formula engine, just a new textual signal feeding the
 * one that already exists.
 */
export function buildLayer2ForSpell(spell: Spell, entity?: Entity, classDefs: readonly CharClass[] = ALL_CHAR_CLASSES): string {
  const parts: string[] = [];

  if (entity && /(melee|ranged) spell attack/i.test(spell.description)) {
    const atk = resolveSpellAttackBonus(entity, spell.id, classDefs);
    if (atk != null) parts.push(`${fmtBonus(atk)} to hit`);
  }

  // Extract damage dice pattern from description
  const diceMatch = spell.description.match(/(\d+d\d+)\s+(\w+)\s+damage/i);
  if (diceMatch) {
    parts.push(`${diceMatch[1]} ${capitalize(diceMatch[2])}`);
  } else if (spell.description.toLowerCase().includes('heal') || spell.description.toLowerCase().includes('hit points')) {
    const healMatch = spell.description.match(/(\d+d\d+(?:\s*\+\s*\d+)?)/);
    if (healMatch) parts.push(`Heal ${healMatch[1]}`);
  }

  // Range info
  if (spell.range && spell.range !== 'Self') {
    parts.push(spell.range);
  }

  return parts.join(' • ') || spell.description.slice(0, 60);
}

/**
 * Layer 3: save / concentration / duration notes.
 * Examples: "Dex Save (half)", "Concentration • 1 min", null
 */
export function buildLayer3(feature: Feature, entity?: Entity, classDefs: readonly CharClass[] = ALL_CHAR_CLASSES): string | null {
  const grantedSpell = findGrantedSpell(feature);
  if (grantedSpell) return buildLayer3ForSpell(grantedSpell, entity, classDefs);

  const action = feature.activation;
  const parts: string[] = [];

  if (action?.requiresSave) {
    const ab  = action.requiresSave.ability.toUpperCase();
    const dcSpec = action.requiresSave.dc;
    // This 'spell_save_dc' sentinel is only reached for a non-spell feature
    // (grantedSpell is null here) — no spellId to resolve a per-source
    // ability from, so the character's headline spellcasting ability is the
    // objectively correct answer (this is what the sentinel has always
    // meant: "use your primary spellcasting stat"), same as spellAttackBonus.
    const dc  = dcSpec === 'spell_save_dc' ? (entity?.derived.spellSaveDC != null ? `DC ${entity.derived.spellSaveDC}` : 'Spell DC')
      : dcSpec === 'ki_save_dc' ? (entity?.derived.kiSaveDC != null ? `DC ${entity.derived.kiSaveDC}` : 'Ki DC')
      : typeof dcSpec === 'object' ? (entity ? `DC ${entity.derived.abilityBasedDC[dcSpec.ability]}` : `${dcSpec.ability.toUpperCase()} DC`)
      : `DC ${dcSpec}`;
    const saveOnSuccess = (feature.abilityEffects ?? []).find(
      (e): e is Extract<AbilityEffect, { type: 'damage' }> => e.type === 'damage'
    )?.saveOnSuccess;
    const half = saveOnSuccess === 'half' ? ' (half)' : '';
    parts.push(`${ab} Save vs ${dc}${half}`);
  }

  if (action?.resourceCost?.resourceId === 'spell_slots') {
    const tier = action.resourceCost.spellSlotTier;
    if (tier) parts.push(`Slot Lv ${tier}+`);
  }

  return parts.length > 0 ? parts.join(' • ') : null;
}

/**
 * `entity`, when passed, wires the spell's OWN resolved-source spell save
 * DC (resolveSpellSaveDC, above) into a detected save — closure 2E:
 * production card UI must show a real per-spell number for a multiclass
 * character, not the same global DC on every spell. Save DETECTION itself
 * is unchanged (the existing description-regex heuristic); this only adds
 * the number once a save is already found.
 */
export function buildLayer3ForSpell(spell: Spell, entity?: Entity, classDefs: readonly CharClass[] = ALL_CHAR_CLASSES): string | null {
  const parts: string[] = [];

  if (spell.concentration) {
    const durShort = spell.duration
      .replace('Concentration, up to ', '')
      .replace('Concentration, ', '');
    parts.push(`Concentration • ${durShort}`);
  }

  // Detect save in description
  const saveMatch = spell.description.match(/(\w+)\s+saving throw/i);
  if (saveMatch) {
    const ab   = saveMatch[1].slice(0, 3).toUpperCase();
    const half = spell.description.toLowerCase().includes('half') ? ' (half)' : '';
    const dc   = entity ? resolveSpellSaveDC(entity, spell.id, classDefs) : null;
    parts.push(dc != null ? `${ab} Save vs DC ${dc}${half}` : `${ab} Save${half}`);
  }

  if (spell.ritual) parts.push('Ritual');

  return parts.length > 0 ? parts.join(' • ') : null;
}

// ── Descriptive outcome lines ────────────────────────────────────────────────

const OUTCOME_KEY_LABELS: Record<OutcomeKey, string> = {
  hit:     'On hit',
  miss:    'On miss',
  success: 'On success',
  failure: 'On failure',
};

const OUTCOME_KEY_ORDER: OutcomeKey[] = ['hit', 'miss', 'success', 'failure'];

/**
 * Formats one ActivationOutcome's `effects` using the same wording buildLayer2
 * uses for the overlapping AbilityEffect variants (set_flag, restore_resource),
 * plus a line for `transform` (which buildLayer2 has no line-formatting for —
 * it only uses `transform` to pick the card's cardType). Effects this app
 * doesn't have a short summary for are silently skipped here — content
 * authors should put anything not covered by these in `description` instead,
 * per OutcomeMap's own doc comment.
 */
function formatOutcomeEffects(effects: AbilityEffect[]): string[] {
  const parts: string[] = [];
  for (const e of effects) {
    if (e.type === 'set_flag') {
      parts.push(capitalize(e.flag.replace(/_/g, ' ')));
    } else if (e.type === 'restore_resource') {
      const amt = e.amount === 'full' ? 'Full' : `+${e.amount}`;
      parts.push(`${amt} ${e.resourceId.replace(/_/g, ' ')}`);
    } else if (e.type === 'transform') {
      parts.push(`Transform into ${e.formId.replace(/_/g, ' ')}`);
    }
  }
  return parts;
}

/**
 * Builds one rendered line per populated OutcomeMap entry — e.g.
 * "On hit: Target is knocked prone". Purely descriptive, never auto-applied
 * (see OutcomeMap's doc comment) — this is display text only, the player
 * still resolves everything themselves. Returns [] when the feature has no
 * `outcomes`.
 */
export function buildOutcomeLines(feature: Feature): string[] {
  const outcomes = feature.outcomes;
  if (!outcomes) return [];

  const lines: string[] = [];
  for (const key of OUTCOME_KEY_ORDER) {
    const outcome = outcomes[key];
    if (!outcome) continue;

    const effectsText = formatOutcomeEffects(outcome.effects ?? []).join(' • ');
    const text = outcome.description
      ? (effectsText ? `${outcome.description} (${effectsText})` : outcome.description)
      : effectsText;
    if (!text) continue;

    lines.push(`${OUTCOME_KEY_LABELS[key]}: ${text}`);
  }
  return lines;
}

/**
 * Active features with a `trigger` but no `activation` — Sneak Attack is
 * the headline example (passive:true, no activation at all, so
 * generateActionCard's own gate never produces a card for it). These are
 * surfaced instead by TabActions.tsx's TriggeredFeaturesSection, a plain
 * reference list alongside the existing UniversalActionsSection — never a
 * synthesized fake activation, which would misrepresent something the app
 * doesn't actually dispatch.
 */
export function getTriggeredFeatures(entity: Entity): FeatureInstance[] {
  return entity.features.filter(f =>
    f.isActive && f.trigger && (f.level === null || f.level <= entity.identity.level)
  );
}

// ── Availability ──────────────────────────────────────────────────────────────

const ACTION_ECONOMY_LABEL: Record<string, string> = {
  action: 'action', bonus_action: 'bonus action', reaction: 'reaction',
};

/**
 * Returns whether a feature can currently be used.
 * Checks turn/action-economy usage (A-25), then resource pools and spell
 * slot availability. The turn-economy check only applies when
 * entity.turnState is non-null — see that type's own doc comment for why
 * null means "not actively tracked, don't gate anything."
 */
/**
 * Turn-economy + resource/payment legality only — deliberately has NO
 * status/incapacitation check, so isFeatureAvailable below can apply the
 * 0HP/Unconscious/Dead status gate exactly once, on top of an unambiguous
 * resource verdict, rather than the two concerns tangled together. This is
 * also what a `bypassIncapacitated` Quick Override consults on its own
 * (C6/C10) — status is never itself a "resource," so bypassing it can never
 * accidentally also bypass a missing slot/resource/action-economy failure.
 */
function resourceAndEconomyLegal(
  feature: Pick<Feature, 'activation'>,
  entity: Entity,
  /**
   * Extra Attack sequence closure (Part D — action type safety): narrowly
   * skips ONLY the "already used this turn" action-economy gate below,
   * without touching anything else this function checks (resource pools,
   * spell slots, activation options). Used for a ritual cast and a
   * validated chained attack — both have a real 'action'/'bonus_action'/
   * 'reaction' actionType that must stay intact for every OTHER purpose
   * (display, classification), so the old approach of rewriting
   * activation.actionType to 'passive' to sneak past this same gate is
   * replaced by this explicit, narrow parameter instead (see
   * applyActionCardUse, actionUse.ts, for the two callers). Defaults to
   * false so every existing caller/behavior is unaffected.
   */
  bypassActionEconomySlot: boolean = false,
): { legal: boolean; reason: string | null } {
  const actionType = feature.activation?.actionType;
  if (!bypassActionEconomySlot && entity.turnState && actionType && actionType in ACTION_ECONOMY_LABEL) {
    const used = actionType === 'action' ? entity.turnState.actionUsed
      : actionType === 'bonus_action' ? entity.turnState.bonusActionUsed
      : entity.turnState.reactionUsed;
    if (used) {
      return { legal: false, reason: `Already used your ${ACTION_ECONOMY_LABEL[actionType]} this turn.` };
    }
  }

  // Resource-threshold gate (Abrasive Jet: "cannot be used at 0 Pressure").
  const gate = feature.activation?.requiresResource;
  if (gate && !resourceInRange(entity, gate)) {
    const gr = entity.resources.custom.find(r => r.id === gate.resourceId);
    return { legal: false, reason: gate.reason ?? `${gr?.name ?? gate.resourceId} is not in the required range (${gr ? `${gr.current}/${gr.maximum}` : 'missing'}).` };
  }

  const options = feature.activation?.options;
  if (options?.length) {
    const legal = options.some(option => resourceAndEconomyLegal({
      ...feature, activation: { ...feature.activation!, options: undefined,
        resourceCost: option.resourceCost ?? feature.activation!.resourceCost },
    }, entity, bypassActionEconomySlot).legal);
    return { legal, reason: legal ? null : 'No legal activation payment remaining.' };
  }
  const cost = feature.activation?.resourceCost;
  if (!cost) return { legal: true, reason: null };

  if (cost.resourceId === 'spell_slots') {
    if (!entity.spellcasting) {
      return { legal: false, reason: 'No spellcasting.' };
    }
    const tier = cost.spellSlotTier ?? 1;
    // Re-audit items 1/2 (A12): the ONE shared resolver — legal-payment
    // logic used to be hand-duplicated here and in applyActionCardUse's
    // actual debit, and they disagreed (this function accepted a higher or
    // pact slot; the debit only ever touched the exact tier). Both now call
    // the same spellPayment.ts functions, so "available" and "what gets
    // spent" can never diverge again.
    if (hasLegalSpellPayment(entity.spellcasting, tier)) {
      return { legal: true, reason: null };
    }
    return { legal: false, reason: `No spell slots of level ${tier}+ remaining.` };
  }

  const resource = entity.resources.custom.find(r => r.id === cost.resourceId);
  if (!resource || resource.inactive) {
    return { legal: false, reason: `Resource "${cost.resourceId}" not found.` };
  }
  if (resource.current < cost.quantity) {
    return { legal: false, reason: `${resource.name}: ${resource.current}/${resource.maximum} remaining.` };
  }

  return { legal: true, reason: null };
}

export function isFeatureAvailable(
  feature: Pick<Feature, 'activation'>,
  entity: Entity,
  /**
   * Rules-engine HIGH-batch closure (C4/C6/C10) — table-first, one-off
   * Quick Override for the 0HP/Unconscious status restriction ONLY ("Use
   * Anyway"). Bypasses NOTHING else: a missing spell slot/Pact slot,
   * insufficient resource, or an already-spent action/bonus/reaction still
   * blocks normally (resourceAndEconomyLegal is computed independently,
   * before this flag is even consulted). Never bypasses the hard `isDead`
   * blocker. Defaults to false so every existing caller — including card
   * GENERATION, which must always reflect the TRUE default legality so the
   * UI can offer the override in the first place — is unaffected.
   */
  bypassIncapacitated: boolean = false,
  /**
   * Extra Attack sequence closure (Part D — action type safety): forwarded
   * straight to resourceAndEconomyLegal's own identically-named parameter —
   * see that function's doc comment. Replaces the previous mechanism (both
   * a ritual cast and a validated chained attack rewrote the feature's own
   * activation.actionType to 'passive' before calling this function) with an
   * explicit flag, so a chained attack's real actionType is preserved for
   * every other purpose. Defaults to false — unaffected for every existing
   * caller.
   */
  bypassActionEconomySlot: boolean = false,
): { available: boolean; reason: string | null; incapacitatedOverridable?: boolean } {
  // Dead: hard blocker, checked first, never overridable (C12).
  if (isDead(entity)) {
    return { available: false, reason: 'Dead' };
  }

  const { legal: resourceLegal, reason: resourceReason } = resourceAndEconomyLegal(feature, entity, bypassActionEconomySlot);
  if (!resourceLegal) {
    return { available: false, reason: resourceReason };
  }

  if (isIncapacitated(entity) && !bypassIncapacitated) {
    return {
      available: false,
      reason: incapacitationReason(entity),
      incapacitatedOverridable: true,
    };
  }

  return { available: true, reason: null };
}

// ── Card generators ───────────────────────────────────────────────────────────

/**
 * Generates an ActionCard for a single feature.
 * Returns null for passive features (no activation).
 *
 * `itemInstanceId` (item-identity closure, pass 2 finding D) — pass the
 * owning ItemInstance's `id` when `feature` lives on an equipped item's own
 * features array (never for an entity.features-sourced class/race/feat
 * feature). Stamps `sourceKind:'item'`/`sourceId` on the returned card so
 * two identical equipped items' authored-feature cards don't collide in
 * identity, and so applyActionCardUse (actionUse.ts) can revalidate the
 * EXACT instance at execution time instead of a flat cross-instance search.
 */
export function generateActionCard(
  feature: Feature,
  entity: Entity,
  opts: CardGenOptions = {},
  itemInstanceId?: string,
): ActionCard | null {
  if (!feature.activation) return null;

  const cardType = classifyFeature(feature);
  const { available, reason, incapacitatedOverridable } = isFeatureAvailable(feature, entity);

  const tabs: ActionCard['tabs'] = ['features'];
  const actionType = feature.activation.actionType;
  // 'free' (usable alongside another action, e.g. a maneuver riding a normal
  // attack) still spends a resource and needs a discoverable [Use] button —
  // the Actions tab is the only place that exists in the app. Only bare
  // 'passive' features (no player-triggered use at all) are excluded.
  if (actionType === 'action' || actionType === 'bonus_action' || actionType === 'reaction' || actionType === 'free') {
    tabs.push('actions');
  }
  if (feature.source.kind === 'spell')     tabs.push('spellcasting');
  if (feature.source.kind === 'item')      tabs.push('inventory');

  return {
    featureId:         feature.id,
    name:              feature.name,
    cardType,
    color:             cardColor(cardType),
    layer1:            buildLayer1(feature, cardType),
    layer2:            buildLayer2(feature, entity, opts),
    layer3:            buildLayer3(feature, entity),
    outcomes:          buildOutcomeLines(feature),
    triggerNote:       feature.trigger ?? null,
    activation:        feature.activation,
    resourceCost:      feature.activation.resourceCost,
    tabs,
    available,
    unavailableReason: reason,
    incapacitatedOverridable,
    ...(itemInstanceId ? { sourceKind: 'item' as const, sourceId: itemInstanceId } : {}),
  };
}

/**
 * Generates an ActionCard for a known/prepared spell.
 * The spell is looked up from spellRepo's Tier-2 cache by ID, falling back
 * to `opts.homebrewSpells` for anything spellRepo doesn't have (a homebrew
 * spell — e.g. one added via "+ Add Additional Spell" or a homebrew spell
 * tagged for the character's own class — would otherwise silently never get
 * a card, mirroring the same official-then-homebrew fallback already used
 * for equipped-item features above). Rules-engine blocker RE-AUDIT closure
 * (dependency inversion, 1A/1B): `opts.homebrewSpells`/`opts.classDefs` are
 * explicit, application-resolved inputs — this function never reaches into
 * a store itself; omitting them means "no homebrew spell fallback, official
 * class catalog only" (a deterministic, static default), not "ask a store."
 */
export function generateSpellCard(
  spellId: string,
  entity: Entity,
  opts: CardGenOptions = {},
): ActionCard | null {
  const homebrewSpells = opts.homebrewSpells ?? [];
  const spell = spellRepo.getSpellSync(spellId) ?? homebrewSpells.find(s => s.id === spellId);
  if (!spell) return null;

  const cardType = classifySpell(spell);

  // Determine slot tier for cost
  const tier  = spell.level as 1|2|3|4|5|6|7|8|9 | undefined;
  const cost  = spell.level > 0
    ? { resourceId: 'spell_slots', quantity: 1, spellSlotTier: tier as 1|2|3|4|5|6|7|8|9 }
    : null;

  const actionType = spell.castingTime.includes('bonus action') ? 'bonus_action'
    : spell.castingTime.includes('reaction')                    ? 'reaction'
    : 'action';

  const activation: FeatureActivation = {
    actionType,
    resourceCost: cost,
    range:        spell.range,
    target:       spell.range.includes('cone') || spell.range.includes('radius') || spell.range.includes('cube') ? 'area' : 'single',
    requiresSave: null,
  };

  // Always check resource/economy legality, even for a cantrip (cost ===
  // null) — bug fix: it used to be skipped whenever cost was falsy, which
  // also skipped the turn-economy check (that check runs before the
  // resource-cost check, so it applies regardless of whether there's a
  // cost). A cantrip card was therefore always shown available:true even
  // after the character had already used their action/bonus action/
  // reaction this turn. resourceAndEconomyLegal already handles cost===null
  // correctly on its own (falls through to legal:true once the economy
  // check passes), so no ternary is needed. Deliberately calls
  // resourceAndEconomyLegal directly (not isFeatureAvailable) so this
  // function can independently combine THREE separate legality gates —
  // resource/economy, preparation, and incapacitation (HIGH batch, C7) —
  // each with its own override flag, rather than isFeatureAvailable's
  // single combined status gate.
  const { legal: costAndEconomyLegal, reason: costReason } = resourceAndEconomyLegal(
    { activation, effects: [], abilityEffects: [] } as unknown as Feature, entity,
  );

  // Rules-engine blocker fix (prepared-spell eligibility): this used to
  // stop here — a spell card was available whenever the slot/action-economy
  // check passed, with NO check at all for whether a prepared caster had
  // actually prepared this leveled spell. isSpellPreparationLegal is the
  // one authoritative, source-aware check (see its own doc comment); never
  // gates cantrips (spell.level === 0 never carries a spell_access
  // entitlement, only cantrip_access, so it always returns true for them).
  //
  // Closure 2B: classDefs comes from the caller's explicit opts.classDefs
  // (the application layer's merged official + homebrew + active-ruleset
  // content set), not the bare official catalog default — a homebrew
  // class's own preparation policy/ability is honored whenever the caller
  // supplies it.
  const classDefs = opts.classDefs ?? ALL_CHAR_CLASSES;
  const allContexts = resolveSpellCastingContexts(entity, spellId, classDefs);
  const distinctContexts = collapseDistinctSpellCastingContexts(allContexts);
  const selectedContext = selectSpellCastingContext(entity, spellId, classDefs);
  const preparationLegal = distinctContexts.some(c => c.legal);
  // Rules-completeness batch (ritual casting): offered whenever the spell
  // is ritual-tagged content AND at least one candidate source can ritual-
  // cast at all — a coarse "should the UI even ask" signal. The SPECIFIC
  // context the player ultimately selects (default or chosen via "Cast
  // as...") is re-checked for its OWN ritualEligible flag at execution time
  // (applyActionCardUse) — this flag never gates the actual mutation.
  const ritualEligible = spell.ritual && distinctContexts.some(c => c.ritualEligible);

  // Rules-engine HIGH-batch closure (C7): preparation and incapacitation
  // (0HP/Unconscious) are two INDEPENDENT one-off overridable restrictions —
  // a spell can be blocked by either, both, or neither, and each gets its
  // own override flag so the UI can offer "Cast Anyway"/"Use Anyway"
  // separately (or together) without one masking the other. Dead is a hard
  // blocker checked first, same as isFeatureAvailable.
  const dead = isDead(entity);
  const incapacitated = !dead && isIncapacitated(entity);
  const available = costAndEconomyLegal && preparationLegal && !incapacitated && !dead;
  // Only offer an override when the resource/economy check ITSELF still
  // passes — if a slot is also missing or the action economy is already
  // spent, those still block normally (no "cast with no slot anyway"
  // support here, for either override).
  const preparationOverridable = costAndEconomyLegal && !preparationLegal && !dead;
  const incapacitatedOverridable = costAndEconomyLegal && incapacitated && !dead;
  const statusReason = incapacitated ? incapacitationReason(entity) : null;
  const reason = dead ? 'Dead'
    : !costAndEconomyLegal ? costReason
    : [!preparationLegal ? 'Not prepared' : null, statusReason].filter(Boolean).join(' • ') || null;

  const tabs: ActionCard['tabs'] = ['spellcasting', 'features'];
  if (actionType === 'action' || actionType === 'bonus_action' || actionType === 'reaction') {
    tabs.push('actions');
  }

  return {
    featureId:         spellId,
    name:              spell.name,
    cardType,
    color:             cardColor(cardType),
    layer1:            buildLayer1ForSpell(spell, cardType),
    layer2:            buildLayer2ForSpell(spell, entity, classDefs),
    layer3:            buildLayer3ForSpell(spell, entity, classDefs),
    outcomes:          [],
    triggerNote:       null,
    activation,
    resourceCost:      cost,
    tabs,
    available,
    unavailableReason: reason,
    preparationOverridable,
    incapacitatedOverridable,
    // Closure 1B: the card PRESERVES the exact context it was generated
    // against — applyActionCardUse revalidates this same context (by
    // contextKey) at execution time rather than silently re-resolving a
    // possibly-different source. Only exposes the alternatives list when a
    // real choice exists (closure 1C) — a single distinct context means
    // there's nothing to choose between.
    spellCastingContext:  selectedContext,
    spellCastingContexts: distinctContexts.length > 1 ? distinctContexts : undefined,
    ...(ritualEligible ? { ritualEligible: true as const } : {}),
  };
}

/**
 * Generates all Action Cards for an entity.
 * Runs over every active feature and all known/prepared spells.
 * Filters nulls. Each card knows which tabs it belongs to.
 *
 * `contentOpts` (rules-engine blocker RE-AUDIT closure — dependency
 * inversion, 1B): explicit, application-resolved classes/races/homebrew
 * spells — see CardGenOptions' own doc comment. Threaded straight through
 * to isLargeCreature and every generateSpellCard call below, so the whole
 * card set for one entity is generated against ONE consistent content
 * snapshot. Omitting it (every pre-existing call site) preserves today's
 * exact official-only behavior.
 */
export function generateAllActionCards(
  entity: Entity, rules?: CampaignRules,
  contentOpts: Pick<CardGenOptions, 'classDefs' | 'homebrewSpells' | 'races' | 'items'> = {},
): ActionCard[] {
  const cards: ActionCard[] = [];

  // Large-creature weapon-dice house rule: active only when the rule is on AND
  // this creature is Large+. Weapon (item) damage dice double on their cards.
  const doubleWeaponDice =
    !!rules && usesLargeCreatureWeaponDice(rules) && isLargeCreature(entity, contentOpts.races);
  const opts: CardGenOptions = { doubleWeaponDice, ...contentOpts };

  // 1. Feature-based cards (class abilities, race abilities, background features)
  for (const fi of entity.features) {
    if (!fi.isActive) continue;
    // Level-gate: a Feature can be present on the entity (already granted,
    // already applied) but not yet "switch on" until the character reaches
    // its authored level — needed for spell_grant traits, where one trait
    // can contain several leveled sub-grants at different levels (so it
    // can't be gated at grant-time the way class leveling already is).
    // Self-healing on manual level edits; class/subclass features are
    // unaffected since their level is always <= the character's by
    // construction of levelUp()'s crossing loop.
    if (fi.level !== null && fi.level > entity.identity.level) continue;
    const card = generateActionCard(fi, entity, opts);
    if (card) cards.push(card);
  }

  // 1b. Equipped item features (weapon attacks, magic-item actions).
  //     These live on inventory.equipped[].features, NOT entity.features, so
  //     they must be iterated separately or weapon attack cards never appear.
  //     If an equipped instance has no hydrated features (older saves stored
  //     only the itemId), fall back to the item definition — itemRepo for
  //     the official catalog, homebrewStore for anything itemRepo doesn't
  //     have (a homebrew weapon/item otherwise silently never gets a card).
  for (const inst of entity.inventory.equipped) {
    // Re-audit A17: an item requiring attunement produces no action cards
    // until actually attuned — same gate collectAllEffects applies to its
    // passive effects, reusing the SAME hydrated flag rather than a second
    // eligibility check (item.requiresAttunement is set once at equip time
    // from the content definition — see ItemInstance's own doc comment).
    const definition = resolveItemDefinition(inst.itemId, opts.items);
    if (!isItemMechanicallyActive(inst, definition)) continue;
    const feats = effectiveItemFeatures(inst, definition);
    let hasAuthoredAttack = false;
    for (const fi of feats) {
      if (!fi.activation) continue;
      // Item-identity closure: stamps sourceKind:'item'/sourceId = THIS
      // instance's own id, so two identical equipped items' authored-
      // feature cards carry distinct, revalidatable identity (see
      // generateActionCard's own doc comment).
      const card = generateActionCard(fi, entity, opts, inst.id);
      if (card) {
        const isDamageFeature = fi.abilityEffects?.some(effect => effect.type === 'damage') ?? false;
        if (isDamageFeature) hasAuthoredAttack = true;
        // Extra Attack / action-structure batch: gated on isWeapon(), not
        // isDamageFeature alone — in principle these could diverge for
        // content this catalog doesn't currently author (a non-weapon
        // item's own damage-dealing feature), but isWeapon() ITSELF already
        // treats any declared damage effect as sufficient evidence of being
        // a weapon (hasDamageEffect, itemBrowse.ts) for every item shape
        // actually authored here, so this stays the semantically correct
        // (never narrower) gate rather than assuming isDamageFeature alone
        // is enough — see ActionCard.isWeaponAttack's own doc comment.
        //
        // Extra Attack sequence closure (two-issue final closure, Part A2):
        // ALSO requires actionType === 'action' — a weapon's own authored
        // attack feature that activates as a Bonus Action or Reaction (e.g.
        // a magic weapon's "as a bonus action, make a melee attack" rider)
        // deals damage and belongs to a weapon, but is NOT a genuine Attack-
        // action attack and must never be sequence-eligible merely because
        // it satisfies the other two conditions. Standalone use of such a
        // card (its own normal Bonus Action/Reaction economy) is completely
        // unaffected — this only controls the isWeaponAttack flag.
        const isWeaponAttack = isDamageFeature && !!definition && isWeapon(toItemIndexEntry(definition)) && fi.activation.actionType === 'action';
        cards.push(isWeaponAttack ? { ...card, isWeaponAttack: true } : card);
      }
    }
    if (definition && isWeapon(toItemIndexEntry(definition)) && !hasAuthoredAttack) {
      // Item-identity closure: prefer the EXACT matching AttackBonus by
      // instance id when this instance has one — `.find(a => a.id ===
      // itemId)` alone always returns the FIRST equipped weapon sharing
      // that itemId, silently generating an identical (wrong) attack card
      // for every OTHER identical copy. Falls back to the old itemId-only
      // match for an instance with no id yet (pre-migration/test fixture).
      const attack = inst.id
        ? entity.derived.attackBonuses.find(candidate => candidate.instanceId === inst.id)
        : entity.derived.attackBonuses.find(candidate => candidate.id === inst.itemId);
      if (attack) {
        const activation: FeatureActivation = { actionType: 'action', resourceCost: null, range: attack.type === 'ranged' ? 'weapon range' : '5 feet', target: 'single', requiresSave: null };
        const availability = isFeatureAvailable({ activation, effects: [], abilityEffects: [] } as unknown as Feature, entity);
        const dice = doubleWeaponDice ? doubleDice(attack.damageDice) : attack.damageDice;
        cards.push({
          // Item-identity closure: keyed by instance id when present, so
          // two identical equipped weapons produce two DISTINCT cards
          // instead of colliding on one shared featureId (falls back to
          // the original itemId-based scheme for an un-migrated instance,
          // preserving every existing single-copy featureId exactly).
          featureId: `${inst.id ?? inst.itemId}_basic_weapon_attack`, name: definition.name,
          cardType: 'damage', color: 'red', layer1: `Action • ${capitalize(attack.type)} Weapon Attack`,
          layer2: `${fmtBonus(attack.bonus)} to hit • ${dice}${attack.damageBonus !== 0 ? fmtBonus(attack.damageBonus) : ''} ${capitalize(attack.damageType)}`,
          layer3: null, outcomes: [], triggerNote: null, activation, resourceCost: null,
          tabs: ['actions', 'features'], available: availability.available, unavailableReason: availability.reason,
          incapacitatedOverridable: availability.incapacitatedOverridable,
          isWeaponAttack: true, // Extra Attack / action-structure batch — a real weapon attack, eligible for the Attack action's extra attack opportunities.
          // Item-identity closure: same stale-instance revalidation at
          // execution time as an authored item-feature card, even though
          // this synthetic card has no abilityEffects of its own to apply —
          // still worth rejecting cleanly rather than silently no-op'ing
          // against a stale removed/unequipped weapon.
          ...(inst.id ? { sourceKind: 'item' as const, sourceId: inst.id } : {}),
        });
      }
    }
  }

  // 1c. Unarmed Strike — synthetic, always available (see the
  //     computeWeaponAttackBonuses 'unarmed_strike' entry in pipeline.ts),
  //     not tied to any equipped item or granted Feature, so it's built
  //     directly here rather than through generateActionCard.
  const unarmed = entity.derived.attackBonuses.find(ab => ab.id === 'unarmed_strike');
  if (unarmed) {
    const dmgStr = `${unarmed.damageDice}${unarmed.damageBonus !== 0 ? fmtBonus(unarmed.damageBonus) : ''} ${capitalize(unarmed.damageType)}`;
    const unarmedActivation: FeatureActivation = { actionType: 'action', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null };
    // Was hardcoded available:true, unconditionally — bypassed
    // isFeatureAvailable() entirely, which is otherwise the only card ever
    // exempt from A-25's action-economy gate (a real attack, not a passive).
    const { available, reason, incapacitatedOverridable } = isFeatureAvailable(
      { activation: unarmedActivation, effects: [], abilityEffects: [] } as unknown as Feature, entity,
    );
    cards.push({
      featureId: 'unarmed_strike',
      name:      'Unarmed Strike',
      cardType:  'damage',
      color:     'red',
      layer1:    'Action • Damage',
      layer2:    `${fmtBonus(unarmed.bonus)} to hit • ${dmgStr}`,
      layer3:    null,
      outcomes:  [],
      triggerNote: null,
      activation: unarmedActivation,
      resourceCost: null,
      tabs: ['actions', 'features'],
      available,
      unavailableReason: reason,
      incapacitatedOverridable,
      isWeaponAttack: true, // Extra Attack / action-structure batch — usable with the Attack action's extra attack opportunities.
    });
  }

  // 2. Spell-based cards (cantrips + known/prepared)
  if (entity.spellcasting) {
    const spellIds = new Set([
      ...entity.spellcasting.cantrips,
      ...entity.spellcasting.known,
      ...entity.spellcasting.prepared,
    ]);
    for (const id of spellIds) {
      const card = generateSpellCard(id, entity, opts);
      if (card) cards.push(card);
    }
  }

  return cards;
}

// ── Private helpers ───────────────────────────────────────────────────────────

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function actionTypeLabel(actionType: FeatureActivation['actionType']): string {
  switch (actionType) {
    case 'action':       return 'Action';
    case 'bonus_action': return 'Bonus Action';
    case 'reaction':     return 'Reaction';
    case 'free':         return 'Free Action';
    case 'passive':      return 'Passive';
  }
}

function sourceKindLabel(kind: Feature['source']['kind'], override?: string): string {
  if (override) return override;
  switch (kind) {
    case 'race':       return 'Racial';
    case 'class':      return 'Class';
    case 'subclass':   return 'Subclass';
    case 'background': return 'Background';
    case 'feat':       return 'Feat';
    case 'item':       return 'Item';
    case 'spell':      return 'Spell';
    case 'condition':  return 'Condition';
    case 'campaign':   return 'Campaign';
    case 'manual':     return 'Manual';
    case 'mode':       return 'Mode';
  }
}
