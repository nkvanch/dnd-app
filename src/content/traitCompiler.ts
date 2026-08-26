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
];
export const RECHARGE_TYPES = [
  { key: 'short_rest' as const, label: 'Short Rest' },
  { key: 'long_rest' as const, label: 'Long Rest' },
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
    skillTarget: 'history', skillExpertise: false,
    toolName: '',
    advDirection: 'advantage', advTarget: '',
    senseType: 'darkvision', senseRange: '60',
    moveType: 'fly', moveRange: '30',
    actionType: 'bonus_action', recharge: 'short_rest', uses: '1', healDice: '1d8',
  };
}

/**
 * Compiles one DraftTrait into a Feature (+ a ResourceGrant if it's a
 * resource_ability). `idPrefix` keeps each caller's existing id-uniqueness
 * scheme (race-builder uses the owning race/subrace id; class/subclass
 * builders use `${classOrSubclassId}_l${level}`). `sourceKind`/`sourceRefId`
 * populate Feature.source so Features-tab grouping-by-source stays correct
 * regardless of which builder produced the feature.
 */
export function buildTraitFeature(
  t: DraftTrait,
  opts: { idPrefix: string; sourceKind: FeatureSource['kind']; sourceRefId: string; level: number | null },
): { feature: Feature; resource: ResourceGrant | null } {
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
  if (t.effectKind === 'resource_ability') {
    const resourceId = `${fid}_pool`;
    const maxUses = Math.max(1, parseInt(t.uses, 10) || 1);
    const resource: ResourceGrant = {
      resourceId, name: t.name, maximum: maxUses, recharge: t.recharge,
    };
    return {
      feature: {
        ...base,
        effects: [],
        passive: false,
        activation: {
          actionType: t.actionType,
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
    const { feature, resource } = buildTraitFeature(t, { idPrefix: srId, sourceKind: 'race', sourceRefId: srId, level: null });
    features.push(feature);
    if (resource) resources.push(resource);
  }
  return {
    id: srId, name: draft.name, parentId: parentRaceId,
    features,
    resources: resources.length > 0 ? resources : undefined,
    homebrewDraft: { abiBonuses: draft.abiBonuses, traits: draft.traits },
  };
}
