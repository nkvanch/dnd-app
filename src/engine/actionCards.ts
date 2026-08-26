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
  ActionCardTag, AbilityEffect, FeatureActivation, Spell,
} from './types';
import { globalContentDB } from '../content/classes/library';
import { modifier } from './pipeline';
import { usesLargeCreatureWeaponDice } from './houseRules';
import { CampaignRules } from './types';

// ── Large-creature weapon dice (house rule) ──────────────────────────

// Minimal Large-creature detection (mirrors TabInventory) so the engine doesn't
// import from a component. Extend these sets as more Large races are added.
const LARGE_SUBRACE_IDS = new Set(['skeleton_giant']);
const LARGE_RACE_IDS    = new Set<string>();
function isLargeCreature(entity: Entity): boolean {
  if (entity.identity.subRaceId && LARGE_SUBRACE_IDS.has(entity.identity.subRaceId)) return true;
  if (entity.identity.raceId    && LARGE_RACE_IDS.has(entity.identity.raceId))       return true;
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

/** Proficiency bonus from character level (PHB scaling). */
function profBonusFor(entity: Entity): number {
  return Math.ceil(1 + entity.identity.level / 4);
}

/**
 * Parses a magic bonus (+1/+2/+3) from an item's properties or feature name.
 * e.g. "+1 to attack and damage rolls" → 1; "+1 Life-Drinking Greatsword" → 1.
 */
function parseMagicBonus(feature: Feature): number {
  const hay = [feature.name, ...(feature.description ? [feature.description] : [])].join(' ');
  const m = hay.match(/\+(\d)\b/);
  return m ? parseInt(m[1], 10) : 0;
}

/**
 * Determines which ability modifier a weapon uses. Finesse weapons use the
 * higher of STR/DEX; ranged weapons use DEX; everything else uses STR.
 * Reads item properties via the feature's source item id.
 */
function weaponAbilityMod(feature: Feature, entity: Entity): { mod: number; ability: 'str' | 'dex' } {
  const itemId = feature.source?.kind === 'item' ? feature.source.refId : null;
  const item   = itemId ? globalContentDB.items.find(i => i.id === itemId) : null;
  const props  = (item?.properties ?? []).map(p => p.toLowerCase()).join(' ');

  const strMod = modifier(entity.stats.str);
  const dexMod = modifier(entity.stats.dex);

  const isFinesse = props.includes('finesse');
  const isRanged  = props.includes('ammunition') || props.includes('thrown') && props.includes('range');

  if (isFinesse) {
    return dexMod >= strMod ? { mod: dexMod, ability: 'dex' } : { mod: strMod, ability: 'str' };
  }
  if (isRanged) return { mod: dexMod, ability: 'dex' };
  return { mod: strMod, ability: 'str' };
}

/**
 * Computes a weapon's to-hit bonus and flat damage bonus.
 * to-hit = ability mod + proficiency (always proficient for now) + magic bonus
 * damage = ability mod + magic bonus
 */
function computeWeaponAttack(feature: Feature, entity: Entity): { toHit: number; dmgBonus: number; ability: string } | null {
  // Only item-sourced features with a damage ability effect are weapons
  if (feature.source?.kind !== 'item') return null;
  const hasDamage = (feature.abilityEffects ?? []).some(e => e.type === 'damage');
  if (!hasDamage) return null;

  const { mod, ability } = weaponAbilityMod(feature, entity);
  const magic = parseMagicBonus(feature);
  const prof  = profBonusFor(entity);

  return {
    toHit:    mod + prof + magic,
    dmgBonus: mod + magic,
    ability:  ability.toUpperCase(),
  };
}

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
  return globalContentDB.spells.find(s => s.id === castEffect.spellId) ?? null;
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
    const spell = globalContentDB.spells.find(s => s.id === feature.source.refId);
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

  // Weapon attack: prepend to-hit and fold the flat damage bonus into the dice
  const atk = entity ? computeWeaponAttack(feature, entity) : null;
  if (atk) {
    parts.push(`${fmtBonus(atk.toHit)} to hit`);
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
      if (atk && isFirstDamage && atk.dmgBonus !== 0) {
        parts.push(`${dice}${fmtBonus(atk.dmgBonus)} ${capitalize(e.damageType)}`);
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
export function buildLayer3(feature: Feature): string | null {
  const grantedSpell = findGrantedSpell(feature);
  if (grantedSpell) return buildLayer3ForSpell(grantedSpell);

  const action = feature.activation;
  const parts: string[] = [];

  if (action?.requiresSave) {
    const ab  = action.requiresSave.ability.toUpperCase();
    const dc  = action.requiresSave.dc === 'spell_save_dc' ? 'Spell DC' : `DC ${action.requiresSave.dc}`;
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

// ── Availability ──────────────────────────────────────────────────────────────

/**
 * Returns whether a feature can currently be used.
 * Checks resource pools and spell slot availability.
 */
export function isFeatureAvailable(
  feature: Feature,
  entity: Entity,
): { available: boolean; reason: string | null } {
  const cost = feature.activation?.resourceCost;
  if (!cost) return { available: true, reason: null };

  if (cost.resourceId === 'spell_slots') {
    if (!entity.spellcasting) {
      return { available: false, reason: 'No spellcasting.' };
    }
    const tier = cost.spellSlotTier ?? 1;
    // Check if any slot at or above the required tier has uses left
    for (let t = tier; t <= 9; t++) {
      const slot = entity.spellcasting.slots[t.toString() as keyof typeof entity.spellcasting.slots];
      if (slot && slot.total - slot.used > 0) {
        return { available: true, reason: null };
      }
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
  if (actionType === 'action' || actionType === 'bonus_action' || actionType === 'reaction') {
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
    layer3:            buildLayer3(feature),
    activation:        feature.activation,
    resourceCost:      feature.activation.resourceCost,
    tabs,
    available,
    unavailableReason: reason,
  };
}

/**
 * Generates an ActionCard for a known/prepared spell.
 * The spell is looked up from globalContentDB by ID.
 */
export function generateSpellCard(
  spellId: string,
  entity: Entity,
): ActionCard | null {
  const spell = globalContentDB.spells.find(s => s.id === spellId);
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

  const { available, reason } = cost
    ? isFeatureAvailable({ activation: { ...activation, resourceCost: cost }, effects: [], abilityEffects: [] } as unknown as Feature, entity)
    : { available: true, reason: null };

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
  //     only the itemId), fall back to the item definition in the content DB.
  for (const inst of entity.inventory.equipped) {
    const feats = (inst.features && inst.features.length > 0)
      ? inst.features
      : (globalContentDB.items.find(i => i.id === inst.itemId)?.features ?? []);
    for (const fi of feats) {
      // Only features with an activation produce cards (attacks, usable items);
      // passive AC features (armor) are handled by collectAllEffects, not here.
      if (!fi.activation) continue;
      const card = generateActionCard(fi, entity, opts);
      if (card) cards.push(card);
    }
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
  }
}
