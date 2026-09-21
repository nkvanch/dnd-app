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

import {
  Feature, Entity, ActionCard, ActionCardType, ActionCardColor,
  AbilityEffect, FeatureActivation, Spell, OutcomeKey,
  FeatureInstance,
} from './types';
import { spellRepo } from '../content/spellRepo';
import { useHomebrewStore } from '../store/homebrewStore';
import { effectiveItemFeatures, isItemMechanicallyActive, resolveItemDefinition } from './itemMechanics';
import { isWeapon } from '../content/items/itemBrowse';
import { toItemIndexEntry } from '../content/itemRepo.types';
import { usesLargeCreatureWeaponDice } from './houseRules';
import { hasLegalSpellPayment } from './spellPayment';
import { CampaignRules } from './types';

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
export function isLargeCreature(entity: Entity): boolean {
  const raceId = entity.identity.raceId;
  if (raceId) {
    const race = useHomebrewStore.getState().getMergedContentDB().races.find(r => r.id === raceId);
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

/** Options that tune card generation from active campaign rules. */
export type CardGenOptions = { doubleWeaponDice?: boolean };

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

  const sourceLabel = sourceKindLabel(feature.source.kind);
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

export function buildLayer2ForSpell(spell: Spell): string {
  const parts: string[] = [];

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
export function buildLayer3(feature: Feature, entity?: Entity): string | null {
  const grantedSpell = findGrantedSpell(feature);
  if (grantedSpell) return buildLayer3ForSpell(grantedSpell);

  const action = feature.activation;
  const parts: string[] = [];

  if (action?.requiresSave) {
    const ab  = action.requiresSave.ability.toUpperCase();
    const dcSpec = action.requiresSave.dc;
    const dc  = dcSpec === 'spell_save_dc' ? 'Spell DC'
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

export function buildLayer3ForSpell(spell: Spell): string | null {
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
    parts.push(`${ab} Save${half}`);
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
export function isFeatureAvailable(
  feature: Pick<Feature, 'activation'>,
  entity: Entity,
): { available: boolean; reason: string | null } {
  const actionType = feature.activation?.actionType;
  if (entity.turnState && actionType && actionType in ACTION_ECONOMY_LABEL) {
    const used = actionType === 'action' ? entity.turnState.actionUsed
      : actionType === 'bonus_action' ? entity.turnState.bonusActionUsed
      : entity.turnState.reactionUsed;
    if (used) {
      return { available: false, reason: `Already used your ${ACTION_ECONOMY_LABEL[actionType]} this turn.` };
    }
  }

  const options = feature.activation?.options;
  if (options?.length) {
    const available = options.some(option => isFeatureAvailable({
      ...feature, activation: { ...feature.activation!, options: undefined,
        resourceCost: option.resourceCost ?? feature.activation!.resourceCost },
    }, entity).available);
    return { available, reason: available ? null : 'No legal activation payment remaining.' };
  }
  const cost = feature.activation?.resourceCost;
  if (!cost) return { available: true, reason: null };

  if (cost.resourceId === 'spell_slots') {
    if (!entity.spellcasting) {
      return { available: false, reason: 'No spellcasting.' };
    }
    const tier = cost.spellSlotTier ?? 1;
    // Re-audit items 1/2 (A12): the ONE shared resolver — legal-payment
    // logic used to be hand-duplicated here and in applyActionCardUse's
    // actual debit, and they disagreed (this function accepted a higher or
    // pact slot; the debit only ever touched the exact tier). Both now call
    // the same spellPayment.ts functions, so "available" and "what gets
    // spent" can never diverge again.
    if (hasLegalSpellPayment(entity.spellcasting, tier)) {
      return { available: true, reason: null };
    }
    return { available: false, reason: `No spell slots of level ${tier}+ remaining.` };
  }

  const resource = entity.resources.custom.find(r => r.id === cost.resourceId);
  if (!resource) {
    return { available: false, reason: `Resource "${cost.resourceId}" not found.` };
  }
  if (resource.current < cost.quantity) {
    return { available: false, reason: `${resource.name}: ${resource.current}/${resource.maximum} remaining.` };
  }

  return { available: true, reason: null };
}

// ── Card generators ───────────────────────────────────────────────────────────

/**
 * Generates an ActionCard for a single feature.
 * Returns null for passive features (no activation).
 */
export function generateActionCard(
  feature: Feature,
  entity: Entity,
  opts: CardGenOptions = {},
): ActionCard | null {
  if (!feature.activation) return null;

  const cardType = classifyFeature(feature);
  const { available, reason } = isFeatureAvailable(feature, entity);

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
  };
}

/**
 * Generates an ActionCard for a known/prepared spell.
 * The spell is looked up from spellRepo's Tier-2 cache by ID, falling back
 * to homebrewStore for anything spellRepo doesn't have (a homebrew spell —
 * e.g. one added via "+ Add Additional Spell" or a homebrew spell tagged
 * for the character's own class — would otherwise silently never get a
 * card, mirroring the same official-then-homebrew fallback already used
 * for equipped-item features above).
 */
export function generateSpellCard(
  spellId: string,
  entity: Entity,
): ActionCard | null {
  const spell = spellRepo.getSpellSync(spellId) ?? useHomebrewStore.getState().spells.find(s => s.id === spellId);
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

  // Always call isFeatureAvailable, even for a cantrip (cost === null) —
  // bug fix: it used to be skipped whenever cost was falsy, which also
  // skipped the turn-economy check at the TOP of isFeatureAvailable (that
  // check runs before the resource-cost check, so it applies regardless of
  // whether there's a cost). A cantrip card was therefore always shown
  // available:true even after the character had already used their
  // action/bonus action/reaction this turn. isFeatureAvailable already
  // handles cost===null correctly on its own (falls through to
  // available:true once the economy check passes), so no ternary is needed.
  const { available, reason } = isFeatureAvailable(
    { activation, effects: [], abilityEffects: [] } as unknown as Feature, entity,
  );

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
    layer2:            buildLayer2ForSpell(spell),
    layer3:            buildLayer3ForSpell(spell),
    outcomes:          [],
    triggerNote:       null,
    activation,
    resourceCost:      cost,
    tabs,
    available,
    unavailableReason: reason,
  };
}

/**
 * Generates all Action Cards for an entity.
 * Runs over every active feature and all known/prepared spells.
 * Filters nulls. Each card knows which tabs it belongs to.
 */
export function generateAllActionCards(entity: Entity, rules?: CampaignRules): ActionCard[] {
  const cards: ActionCard[] = [];

  // Large-creature weapon-dice house rule: active only when the rule is on AND
  // this creature is Large+. Weapon (item) damage dice double on their cards.
  const doubleWeaponDice =
    !!rules && usesLargeCreatureWeaponDice(rules) && isLargeCreature(entity);
  const opts: CardGenOptions = { doubleWeaponDice };

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
    const definition = resolveItemDefinition(inst.itemId);
    if (!isItemMechanicallyActive(inst, definition)) continue;
    const feats = effectiveItemFeatures(inst, definition);
    let hasAuthoredAttack = false;
    for (const fi of feats) {
      if (!fi.activation) continue;
      const card = generateActionCard(fi, entity, opts);
      if (card) {
        cards.push(card);
        if (fi.abilityEffects?.some(effect => effect.type === 'damage')) hasAuthoredAttack = true;
      }
    }
    if (definition && isWeapon(toItemIndexEntry(definition)) && !hasAuthoredAttack) {
      const attack = entity.derived.attackBonuses.find(candidate => candidate.id === inst.itemId);
      if (attack) {
        const activation: FeatureActivation = { actionType: 'action', resourceCost: null, range: attack.type === 'ranged' ? 'weapon range' : '5 feet', target: 'single', requiresSave: null };
        const availability = isFeatureAvailable({ activation, effects: [], abilityEffects: [] } as unknown as Feature, entity);
        const dice = doubleWeaponDice ? doubleDice(attack.damageDice) : attack.damageDice;
        cards.push({
          featureId: `${inst.itemId}_basic_weapon_attack`, name: definition.name,
          cardType: 'damage', color: 'red', layer1: `Action • ${capitalize(attack.type)} Weapon Attack`,
          layer2: `${fmtBonus(attack.bonus)} to hit • ${dice}${attack.damageBonus !== 0 ? fmtBonus(attack.damageBonus) : ''} ${capitalize(attack.damageType)}`,
          layer3: null, outcomes: [], triggerNote: null, activation, resourceCost: null,
          tabs: ['actions', 'features'], available: availability.available, unavailableReason: availability.reason,
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
    const { available, reason } = isFeatureAvailable(
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
      const card = generateSpellCard(id, entity);
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

function sourceKindLabel(kind: Feature['source']['kind']): string {
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
  }
}
