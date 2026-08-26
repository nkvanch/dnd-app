// src/content/traitCompiler.ts
// Pure-TS compilation logic for the "draft trait" authoring model shared by
// every homebrew builder (race traits, class/subclass features). Deliberately
// has zero React/React Native imports — per docs/IMPLEMENTATION.md, src/content/**
// must stay plain TypeScript so src/content/classes/progressions.ts (the class
// progression compiler) can use buildTraitFeature() without pulling UI code
// into a content-layer file. The React components that edit a DraftTrait
// (TraitEditorModal, TraitListEditor, AbilityScoreGrid) live in
// src/components/homebrew/TraitEditor.tsx, which imports and re-exports
// everything from this file.
import {
  Ability, SkillName, SenseType, Feature, FeatureSource, Effect, ResourceGrant,
  DraftTrait, Race, Subrace,
} from '../engine/types';

export const ABILITIES: Ability[] = ['str','dex','con','int','wis','cha'];
export const SENSE_TYPES: { key: SenseType; label: string }[] = [
  { key: 'darkvision', label: 'Darkvision' }, { key: 'blindsight', label: 'Blindsight' },
  { key: 'tremorsense', label: 'Tremorsense' }, { key: 'truesight', label: 'Truesight' },
];
export type MoveType = 'fly' | 'swim' | 'climb' | 'burrow';
export const MOVE_TYPES: { key: MoveType; label: string }[] = [
  { key: 'fly', label: 'Fly' }, { key: 'swim', label: 'Swim' },
  { key: 'climb', label: 'Climb' }, { key: 'burrow', label: 'Burrow' },
];
// The 18 standard 5e skills — same list/labels used in the character sheet PDF export.
export const SKILLS: { id: SkillName; label: string }[] = [
  { id: 'athletics', label: 'Athletics' }, { id: 'acrobatics', label: 'Acrobatics' },
  { id: 'sleight_of_hand', label: 'Sleight of Hand' }, { id: 'stealth', label: 'Stealth' },
  { id: 'arcana', label: 'Arcana' }, { id: 'history', label: 'History' },
  { id: 'investigation', label: 'Investigation' }, { id: 'nature', label: 'Nature' },
  { id: 'religion', label: 'Religion' }, { id: 'animal_handling', label: 'Animal Handling' },
  { id: 'insight', label: 'Insight' }, { id: 'medicine', label: 'Medicine' },
  { id: 'perception', label: 'Perception' }, { id: 'survival', label: 'Survival' },
  { id: 'deception', label: 'Deception' }, { id: 'intimidation', label: 'Intimidation' },
  { id: 'performance', label: 'Performance' }, { id: 'persuasion', label: 'Persuasion' },
];
export const ACTION_TYPES = [
  { key: 'action' as const, label: 'Action' },
  { key: 'bonus_action' as const, label: 'Bonus Action' },
  { key: 'reaction' as const, label: 'Reaction' },
  { key: 'other' as const, label: 'Other' },
];
export const RECHARGE_TYPES = [
  { key: 'short_rest' as const, label: 'Short Rest' },
  { key: 'long_rest' as const, label: 'Long Rest' },
  { key: 'other' as const, label: 'Other' },
];
// Common 5e tool/kit proficiencies — a starting point for the searchable
// tool_proficiency picker; the field stays free-text, this is just a
// tap-to-fill suggestion list, not a closed catalog.
export const COMMON_TOOLS: string[] = [
  "Thieves' Tools", 'Herbalism Kit', "Alchemist's Supplies", "Smith's Tools",
  "Carpenter's Tools", "Mason's Tools", "Weaver's Tools", "Woodcarver's Tools",
  "Cook's Utensils", "Brewer's Supplies", "Calligrapher's Supplies", "Painter's Supplies",
  "Potter's Tools", "Leatherworker's Tools", "Navigator's Tools", "Cartographer's Tools",
  'Disguise Kit', 'Forgery Kit', "Poisoner's Kit", 'Vehicles (land)', 'Vehicles (water)',
];
// Standard 5e damage types — same free-text-with-suggestions pattern as
// COMMON_TOOLS, used by the damage_resistance/immunity/vulnerability kinds.
export const COMMON_DAMAGE_TYPES: string[] = [
  'acid', 'bludgeoning', 'cold', 'fire', 'force', 'lightning', 'necrotic',
  'piercing', 'poison', 'psychic', 'radiant', 'slashing', 'thunder',
];
// The 6 conditions that zero speed (src/content/conditions/index.ts's
// speedZeroFeature) — the only movement-related conditions the engine can
// actually suppress today via suppress_condition_effects.
export const SPEED_ZEROING_CONDITIONS: { key: string; label: string }[] = [
  { key: 'grappled', label: 'Grappled' }, { key: 'restrained', label: 'Restrained' },
  { key: 'paralyzed', label: 'Paralyzed' }, { key: 'petrified', label: 'Petrified' },
  { key: 'stunned', label: 'Stunned' }, { key: 'unconscious', label: 'Unconscious' },
];

export function toId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

// ── Draft trait model ────────────────────────────────────────────────────────

export function newDraftTrait(name: string): DraftTrait {
  return {
    localId: `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    name, description: '', effectKind: 'none',
    abilityTarget: 'str', abilityAmount: '1',
    unarmoredBase: '10', unarmoredAbilities: ['dex'], unarmoredCaps: {},
    skillTarget: 'history', skillExpertise: false,
    toolName: '',
    advDirection: 'advantage', advTarget: '',
    senseType: 'darkvision', senseRange: '60',
    moveType: 'fly', moveRange: '30',
    moveCondTargets: [], moveCondFlavor: '',
    damageType: 'fire',
    spellGrantCantripId: '', spellGrantAbility: 'cha', spellGrants: [],
    actionType: 'bonus_action', actionTypeOther: '',
    recharge: 'short_rest', rechargeOther: '', uses: '1', healDice: '1d8',
  };
}

/**
 * Compiles one DraftTrait into a Feature (+ a ResourceGrant if it's a
 * resource_ability). `idPrefix` keeps each caller's existing id-uniqueness
 * scheme (race-builder uses the owning race/subrace id; class/subclass
 * builders use `${classOrSubclassId}_l${level}`). `sourceKind`/`sourceRefId`
 * populate Feature.source so Features-tab grouping-by-source stays correct
 * regardless of which builder produced the feature.
 *
 * `extraFeatures`/`extraResources` exist because spell_grant is the one
 * effect kind that doesn't fit "one Feature (+one optional Resource)" — a
 * single trait can grant an at-will cantrip AND any number of independently
 * level-gated leveled spells, each needing its own Feature/Resource. They're
 * optional so every existing caller that only destructures
 * `{feature, resource}` keeps working unchanged; callers that might receive
 * a spell_grant trait must also splice these in (see buildSubrace below,
 * progressions.ts, race-builder.tsx, subclass-builder.tsx).
 */
export function buildTraitFeature(
  t: DraftTrait,
  opts: { idPrefix: string; sourceKind: FeatureSource['kind']; sourceRefId: string; level: number | null },
): { feature: Feature; resource: ResourceGrant | null; extraFeatures?: Feature[]; extraResources?: ResourceGrant[] } {
  const fid = `${opts.idPrefix}_${toId(t.name)}`;
  const base: Omit<Feature, 'effects' | 'activation' | 'abilityEffects'> = {
    id: fid, name: t.name,
    description: t.description.trim() || t.name,
    source: { kind: opts.sourceKind, refId: opts.sourceRefId },
    level: opts.level, actions: [], choices: [], passive: true,
  };

  if (t.effectKind === 'ability_score') {
    const amount = parseInt(t.abilityAmount, 10) || 0;
    return {
      feature: { ...base, effects: amount !== 0 ? [{
        type: 'stat_modifier', target: t.abilityTarget, operation: 'add',
        value: amount, condition: null,
      }] : [] },
      resource: null,
    };
  }
  if (t.effectKind === 'unarmored_defense') {
    const base_ = parseInt(t.unarmoredBase, 10);
    if (t.unarmoredAbilities.length === 0 || isNaN(base_)) {
      return { feature: { ...base, effects: [] }, resource: null };
    }
    const caps: Partial<Record<Ability, number>> = {};
    for (const a of t.unarmoredAbilities) {
      const capStr = t.unarmoredCaps[a];
      const cap = capStr !== undefined ? parseInt(capStr, 10) : NaN;
      if (!isNaN(cap)) caps[a] = cap;
    }
    return {
      feature: { ...base, effects: [{
        type: 'base_ac_formula', target: 'ac', operation: 'set', value: base_, condition: null,
        formulaAbilities: t.unarmoredAbilities,
        formulaAbilityCap: Object.keys(caps).length > 0 ? caps : undefined,
      }] },
      resource: null,
    };
  }
  if (t.effectKind === 'skill_proficiency') {
    const effect: Effect = {
      type: 'grant_proficiency', target: `skill:${t.skillTarget}`,
      operation: t.skillExpertise ? 'multiply' : 'add', value: null, condition: null,
    };
    return { feature: { ...base, effects: [effect] }, resource: null };
  }
  if (t.effectKind === 'tool_proficiency') {
    const name = t.toolName.trim();
    if (!name) return { feature: { ...base, effects: [] }, resource: null };
    const effect: Effect = {
      type: 'grant_proficiency', target: `tool:${name.toLowerCase().replace(/\s+/g, '_')}`,
      operation: 'add', value: null, condition: null,
    };
    return { feature: { ...base, effects: [effect] }, resource: null };
  }
  if (t.effectKind === 'advantage_disadvantage') {
    const desc = t.advTarget.trim();
    if (!desc) return { feature: { ...base, effects: [] }, resource: null };
    const effect: Effect = {
      type: 'stat_modifier', target: desc, operation: t.advDirection,
      value: null, condition: null,
    };
    return { feature: { ...base, effects: [effect] }, resource: null };
  }
  if (t.effectKind === 'sense') {
    const range = parseInt(t.senseRange, 10) || 0;
    return {
      feature: { ...base, effects: range > 0 ? [{
        type: 'grant_sense', target: 'senses', operation: 'add', value: null, condition: null,
        senseType: t.senseType, senseRange: range,
      }] : [] },
      resource: null,
    };
  }
  if (t.effectKind === 'movement') {
    const range = parseInt(t.moveRange, 10) || 0;
    return {
      feature: { ...base, effects: range > 0 ? [{
        type: 'grant_movement', target: 'movement', operation: 'add', value: null, condition: null,
        movementType: t.moveType, movementRange: range,
      }] : [] },
      resource: null,
    };
  }
  if (t.effectKind === 'movement_condition') {
    const effects: Effect[] = t.moveCondTargets.map(conditionId => ({
      type: 'suppress_condition_effects', target: conditionId, operation: 'suppress',
      value: ['speed'], condition: null,
    }));
    const flavor = t.moveCondFlavor.trim();
    return {
      feature: {
        ...base,
        description: flavor ? `${base.description}${base.description.endsWith('.') ? '' : '.'} ${flavor}` : base.description,
        effects,
      },
      resource: null,
    };
  }
  if (t.effectKind === 'damage_resistance' || t.effectKind === 'damage_immunity' || t.effectKind === 'damage_vulnerability') {
    const damageType = t.damageType.trim().toLowerCase();
    if (!damageType) return { feature: { ...base, effects: [] }, resource: null };
    const effect: Effect = {
      type: t.effectKind === 'damage_immunity' ? 'grant_immunity' : 'grant_resistance',
      target: damageType,
      operation: t.effectKind === 'damage_resistance' ? 'resistance'
               : t.effectKind === 'damage_immunity' ? 'immunity' : 'vulnerability',
      value: null, condition: null,
    };
    return { feature: { ...base, effects: [effect] }, resource: null };
  }
  if (t.effectKind === 'spell_grant') {
    // At-will cantrip: unchanged mechanism, merges into
    // entity.spellcasting.cantrips via applyGrant() — same path Skeleton's
    // Doomed Touch already uses for an at-will racial cantrip.
    const effects: Effect[] = t.spellGrantCantripId ? [{
      type: 'grant_spell', target: '', operation: 'add', value: null, condition: null,
      cantripIds: [t.spellGrantCantripId], spellcastingAbility: t.spellGrantAbility,
    }] : [];

    // Leveled spells: each becomes its OWN Feature (never merged into
    // .known — that path hard-codes "always consumes a real slot at exactly
    // spell.level", incompatible with a dedicated resource pool or an
    // authored minimum slot tier), gated by its own authored unlock level.
    const extraFeatures: Feature[] = [];
    const extraResources: ResourceGrant[] = [];
    for (const g of t.spellGrants) {
      if (!g.spellId) continue;
      const grantFid = `${fid}_grant_${g.spellId}`;
      const level = parseInt(g.unlockLevel, 10) || 1;
      const resourceCost = g.mode === 'slot'
        ? {
            resourceId: 'spell_slots', quantity: 1,
            spellSlotTier: Math.min(9, Math.max(1, parseInt(g.minSlotLevel, 10) || 1)) as 1|2|3|4|5|6|7|8|9,
          }
        : (() => {
            const poolId = `${grantFid}_pool`;
            const maxUses = Math.max(1, parseInt(g.uses, 10) || 1);
            const recharge = g.recharge === 'other' ? (g.rechargeOther.trim() || 'other') : g.recharge;
            extraResources.push({ resourceId: poolId, name: `${t.name}: ${g.spellName || g.spellId}`, maximum: maxUses, recharge });
            return { resourceId: poolId, quantity: 1 };
          })();
      extraFeatures.push({
        id: grantFid, name: g.spellName || t.name,
        description: `Granted by ${t.name}.`,
        source: base.source, level, actions: [], choices: [], passive: false,
        effects: [],
        activation: { actionType: g.actionType, resourceCost, range: 'self', target: 'single', requiresSave: null },
        abilityEffects: [{ type: 'cast_spell', spellId: g.spellId }],
      });
    }

    return {
      feature: { ...base, effects },
      resource: null,
      extraFeatures: extraFeatures.length > 0 ? extraFeatures : undefined,
      extraResources: extraResources.length > 0 ? extraResources : undefined,
    };
  }
  if (t.effectKind === 'resource_ability') {
    const resourceId = `${fid}_pool`;
    const maxUses = Math.max(1, parseInt(t.uses, 10) || 1);
    const recharge = t.recharge === 'other' ? (t.rechargeOther.trim() || 'other') : t.recharge;
    const resource: ResourceGrant = {
      resourceId, name: t.name, maximum: maxUses, recharge,
    };
    const actionType = t.actionType === 'other' ? 'free' : t.actionType;
    const descPrefix = t.actionType === 'other' && t.actionTypeOther.trim()
      ? `${t.actionTypeOther.trim()} — ` : '';
    return {
      feature: {
        ...base,
        description: descPrefix + base.description,
        effects: [],
        passive: false,
        activation: {
          actionType,
          resourceCost: { resourceId, quantity: 1 },
          range: 'self', target: 'self', requiresSave: null,
        },
        abilityEffects: t.healDice.trim() ? [{ type: 'heal', dice: t.healDice.trim() }] : [],
      },
      resource,
    };
  }
  // 'none' — flavor-only trait, no mechanical effect. This is a real,
  // legitimate choice, not a fallback — plenty of racial traits (Steady
  // Gait, for instance) are correctly reminder-only because the engine has
  // nothing to mechanically enforce (e.g. "immune to speed-altering spells"
  // isn't something the app currently models as an enforceable rule).
  return { feature: { ...base, effects: [] }, resource: null };
}

// ── Draft subrace model ───────────────────────────────────────────────────────

export type DraftSubrace = {
  localId: string;
  name: string;
  abiBonuses: Record<Ability, string>;
  traits: DraftTrait[];
};

export function newDraftSubrace(name: string): DraftSubrace {
  return {
    localId: `sr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    name, abiBonuses: { str: '', dex: '', con: '', int: '', wis: '', cha: '' },
    traits: [],
  };
}

/** Compiles a DraftSubrace into a real Subrace attached to `parentRaceId`. */
export function buildSubrace(draft: DraftSubrace, parentRaceId: string): Subrace {
  const srId = `${parentRaceId}_${toId(draft.name)}`;
  const features: Feature[] = [];
  const resources: ResourceGrant[] = [];

  const asi = ABILITIES
    .filter(a => parseInt(draft.abiBonuses[a], 10) > 0)
    .map(a => ({
      type: 'stat_modifier' as const, target: a, operation: 'add' as const,
      value: parseInt(draft.abiBonuses[a], 10), condition: null,
    }));
  if (asi.length > 0) {
    features.push({
      id: `${srId}_asi`, name: 'Ability Score Increase',
      description: 'Your ability scores increase as shown.',
      source: { kind: 'race', refId: srId },
      level: null, actions: [], choices: [], passive: true, effects: asi,
    });
  }
  for (const t of draft.traits) {
    const { feature, resource, extraFeatures, extraResources } = buildTraitFeature(t, { idPrefix: srId, sourceKind: 'race', sourceRefId: srId, level: null });
    features.push(feature, ...(extraFeatures ?? []));
    if (resource) resources.push(resource);
    resources.push(...(extraResources ?? []));
  }
  return {
    id: srId, name: draft.name, parentId: parentRaceId,
    features,
    resources: resources.length > 0 ? resources : undefined,
    homebrewDraft: { abiBonuses: draft.abiBonuses, traits: draft.traits },
  };
}
