import type { Background, ChoiceDefinition, DraftTrait, Feature, Grant, Item, LevelEntry, ResourceGrant } from './types';
import { buildTraitFeature } from '../content/traitCompiler';
import type { DraftChoice } from '../content/choiceDefinitionCompiler';
import { definitionToDraftChoice, draftChoiceToDefinition } from '../content/choiceDefinitionCompiler';

export type LosslessDraftChoice = DraftChoice & { originalChoice?: ChoiceDefinition };
export type LeveledLosslessDraftChoice = LosslessDraftChoice & { level: number };

export function hydrateLosslessChoices(original: ChoiceDefinition[] | undefined, prefix: string): LosslessDraftChoice[] {
  return (original ?? []).flatMap(choice => {
    const draft = definitionToDraftChoice(choice, prefix);
    return draft ? [{ ...draft, originalChoice: choice }] : [];
  });
}

function mergePool(original: ChoiceDefinition['pool'], edited: ChoiceDefinition['pool']): ChoiceDefinition['pool'] {
  if (!Array.isArray(original) || !Array.isArray(edited)) return edited;
  const originals = new Map(original.map(option => [String(option.value ?? option.id), option]));
  return edited.map(option => ({ ...originals.get(String(option.value ?? option.id)), ...option }));
}

function serializeDraft(draft: LosslessDraftChoice, prefix: string): ChoiceDefinition {
  const compiled = draftChoiceToDefinition(draft, prefix);
  const original = draft.originalChoice;
  if (!original) return compiled;
  const baselineDraft = definitionToDraftChoice(original, prefix);
  if (!baselineDraft) return original;
  const result: ChoiceDefinition = { ...original };
  if (draft.kind !== baselineDraft.kind) result.kind = compiled.kind;
  if (draft.count !== baselineDraft.count) result.count = compiled.count;
  if (draft.prompt !== baselineDraft.prompt) result.prompt = compiled.prompt;
  if (draft.poolMode !== baselineDraft.poolMode
    || JSON.stringify(draft.categories) !== JSON.stringify(baselineDraft.categories)
    || JSON.stringify(draft.restrictedIds) !== JSON.stringify(baselineDraft.restrictedIds)) {
    result.pool = mergePool(original.pool, compiled.pool);
  }
  return result;
}

export function serializeLosslessChoices(
  original: ChoiceDefinition[] | undefined, drafts: LosslessDraftChoice[], prefix: string,
): ChoiceDefinition[] | undefined {
  const draftByOriginal = new Map(drafts.filter(d => d.originalChoice).map(d => [d.originalChoice!.id, d]));
  const kept = (original ?? []).flatMap(choice => {
    const representable = definitionToDraftChoice(choice, prefix) !== null;
    if (!representable) return [choice];
    const draft = draftByOriginal.get(choice.id);
    return draft ? [serializeDraft(draft, prefix)] : [];
  });
  const added = drafts.filter(d => !d.originalChoice).map(d => serializeDraft(d, prefix));
  const result = [...kept, ...added];
  return result.length > 0 ? result : undefined;
}

export function hydrateLeveledChoices(
  groups: { level: number; choices: ChoiceDefinition[] }[] | undefined, id: string,
): LeveledLosslessDraftChoice[] {
  return (groups ?? []).flatMap(group => hydrateLosslessChoices(group.choices, id + '_l' + group.level + '_')
    .map(choice => ({ ...choice, level: group.level })));
}

export function serializeLeveledChoices(
  original: { level: number; choices: ChoiceDefinition[] }[] | undefined,
  drafts: LeveledLosslessDraftChoice[], id: string,
): { level: number; choices: ChoiceDefinition[] }[] | undefined {
  const levels = new Set([...(original ?? []).map(x => x.level), ...drafts.map(x => x.level)]);
  const groups = [...levels].sort((a, b) => a - b).flatMap(level => {
    const old = original?.find(x => x.level === level)?.choices;
    const choices = serializeLosslessChoices(old, drafts.filter(x => x.level === level), id + '_l' + level + '_');
    return choices ? [{ level, choices }] : [];
  });
  return groups.length > 0 ? groups : undefined;
}

export type SubclassFeatureDraft = DraftTrait & { level: number; originalFeature?: Feature };
export type SubclassFeatureEdit = { level: number; originalFeatureId?: string; grants: Grant[] };

export function mergeSubclassEntries(
  original: LevelEntry[] | undefined,
  featureEdits: SubclassFeatureEdit[],
  choices: LeveledLosslessDraftChoice[],
  hpDie: LevelEntry['hpDie'],
  subclassId: string,
): LevelEntry[] {
  const levels = new Set([...(original ?? []).map(e => e.level), ...featureEdits.map(e => e.level), ...choices.map(c => c.level)]);
  return [...levels].sort((a, b) => a - b).map(level => {
    const old = original?.find(e => e.level === level);
    const edits = featureEdits.filter(e => e.level === level);
    const editByOriginal = new Map(edits.filter(e => e.originalFeatureId).map(e => [e.originalFeatureId!, e]));
    const retained: Grant[] = [];
    for (const grant of old?.grants ?? []) {
      if (grant.kind !== 'feature') { retained.push(grant); continue; }
      const id = (grant.value as Feature).id;
      const edit = editByOriginal.get(id);
      if (edit) retained.push(...edit.grants);
      // Missing edit means intentional removal; untouched originals are supplied as identity edits by the builder hydrator.
    }
    for (const edit of edits.filter(e => !e.originalFeatureId)) retained.push(...edit.grants);
    const serializedChoices = serializeLosslessChoices(old?.choices, choices.filter(c => c.level === level), subclassId + '_l' + level + '_') ?? [];
    return { ...(old ?? { level, choices: [], grants: [] }), level, hpDie, grants: retained, choices: serializedChoices };
  });
}



type TraitOwner = { localId: string; featureIds: string[]; resourceIds: string[] };
export type NestedBuilderDraft = { traitOwners?: TraitOwner[] };

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
function mergeArray(original: unknown[], baseline: unknown[], edited: unknown[]): unknown[] {
  if (same(baseline, edited)) return original;
  const result = [...original];
  for (let i = 0; i < baseline.length; i++) {
    const base = baseline[i] as Record<string, unknown>;
    const index = result.findIndex(value => {
      const candidate = value as Record<string, unknown>;
      return (base?.id !== undefined && candidate?.id === base.id) || same(value, baseline[i]);
    });
    if (index < 0) continue;
    if (i < edited.length) result[index] = mergeRepresented(result[index], baseline[i], edited[i]);
    else result.splice(index, 1);
  }
  for (let i = baseline.length; i < edited.length; i++) result.push(edited[i]);
  return result;
}
function mergeRepresented(original: any, baseline: any, edited: any): any {
  if (same(baseline, edited)) return original;
  if (Array.isArray(baseline) && Array.isArray(edited) && Array.isArray(original)) return mergeArray(original, baseline, edited);
  if (baseline && edited && original && typeof baseline === 'object' && typeof edited === 'object' && typeof original === 'object') {
    const result = { ...original };
    for (const key of new Set([...Object.keys(baseline), ...Object.keys(edited)])) {
      if (!(key in edited)) delete result[key];
      else result[key] = mergeRepresented(original[key], baseline[key], edited[key]);
    }
    return result;
  }
  return edited;
}

function compileTrait(trait: DraftTrait, idPrefix: string, sourceKind: Feature['source']['kind'], sourceRefId: string) {
  const built = buildTraitFeature(trait, { idPrefix, sourceKind, sourceRefId, level: null });
  return { features: [built.feature, ...(built.extraFeatures ?? [])], resources: [built.resource, ...(built.extraResources ?? [])].filter(Boolean) as ResourceGrant[] };
}

export function serializeDraftTraits(args: {
  originalFeatures: Feature[]; originalResources?: ResourceGrant[]; originalDrafts: DraftTrait[];
  editedDrafts: DraftTrait[]; idPrefix: string; sourceKind: Feature['source']['kind']; sourceRefId: string;
  generatedFeatures?: Feature[]; generatedResources?: ResourceGrant[]; generatedIds?: string[]; owners?: TraitOwner[];
}): { features: Feature[]; resources: ResourceGrant[]; owners: TraitOwner[] } {
  const originalByLocal = new Map(args.originalDrafts.map(d => [d.localId, d]));
  const ownerByLocal = new Map((args.owners ?? []).map(o => [o.localId, o]));
  const inferred = args.originalDrafts.map(draft => {
    const compiled = compileTrait(draft, args.idPrefix, args.sourceKind, args.sourceRefId);
    return ownerByLocal.get(draft.localId) ?? { localId: draft.localId, featureIds: compiled.features.map(f => f.id), resourceIds: compiled.resources.map(r => r.resourceId) };
  });
  const ownedFeatureIds = new Set(inferred.flatMap(o => o.featureIds));
  const ownedResourceIds = new Set(inferred.flatMap(o => o.resourceIds));
  const generatedIds = new Set(args.generatedIds ?? []);
  const features = [...(args.generatedFeatures ?? []), ...args.originalFeatures.filter(f => !ownedFeatureIds.has(f.id) && !generatedIds.has(f.id))];
  const resources = [...(args.generatedResources ?? []), ...(args.originalResources ?? []).filter(r => !ownedResourceIds.has(r.resourceId))];
  const owners: TraitOwner[] = [];
  for (const edited of args.editedDrafts) {
    const previous = originalByLocal.get(edited.localId);
    const oldCompiled = previous ? compileTrait(previous, args.idPrefix, args.sourceKind, args.sourceRefId) : null;
    const newCompiled = compileTrait(edited, args.idPrefix, args.sourceKind, args.sourceRefId);
    const owner = inferred.find(o => o.localId === edited.localId);
    const mergedFeatures = newCompiled.features.map((next, i) => {
      const oldId = owner?.featureIds[i];
      const actual = oldId ? args.originalFeatures.find(f => f.id === oldId) : undefined;
      return actual && oldCompiled?.features[i] ? mergeRepresented(actual, oldCompiled.features[i], next) : next;
    });
    const mergedResources = newCompiled.resources.map((next, i) => {
      const oldId = owner?.resourceIds[i];
      const actual = oldId ? args.originalResources?.find(r => r.resourceId === oldId) : undefined;
      return actual && oldCompiled?.resources[i] ? mergeRepresented(actual, oldCompiled.resources[i], next) : next;
    });
    features.push(...mergedFeatures); resources.push(...mergedResources);
    owners.push({ localId: edited.localId, featureIds: mergedFeatures.map(f => f.id), resourceIds: mergedResources.map(r => r.resourceId) });
  }
  return { features, resources, owners };
}

export type BackgroundFeatureDraft = { localId: string; name: string; description: string };
function compileBackgroundFeature(draft: BackgroundFeatureDraft, id: string): Feature {
  const slug = draft.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  return { id: id + '_' + slug, name: draft.name, description: draft.description.trim() || draft.name,
    source: { kind: 'background', refId: id }, level: null, actions: [], choices: [], passive: true, effects: [] };
}
export function serializeBackgroundFeatures(original: Background | null | undefined, originalDrafts: BackgroundFeatureDraft[], editedDrafts: BackgroundFeatureDraft[], id: string, generated: Feature[], generatedIds: string[]): { features: Feature[]; owners: TraitOwner[] } {
  const originalByLocal = new Map(originalDrafts.map(d => [d.localId, d]));
  const storedOwners = ((original?.homebrewDraft as NestedBuilderDraft | undefined)?.traitOwners ?? []);
  const ownerByLocal = new Map(storedOwners.map(o => [o.localId, o]));
  const inferred = originalDrafts.map(d => ownerByLocal.get(d.localId) ?? { localId: d.localId, featureIds: [compileBackgroundFeature(d, id).id], resourceIds: [] });
  const owned = new Set(inferred.flatMap(o => o.featureIds)); const structural = new Set(generatedIds);
  const features = [...generated, ...(original?.features ?? []).filter(f => !owned.has(f.id) && !structural.has(f.id))];
  const owners: TraitOwner[] = [];
  for (const draft of editedDrafts) {
    const next = compileBackgroundFeature(draft, id); const previous = originalByLocal.get(draft.localId);
    const oldId = inferred.find(o => o.localId === draft.localId)?.featureIds[0];
    const actual = oldId ? original?.features.find(f => f.id === oldId) : undefined;
    const merged = actual && previous ? mergeRepresented(actual, compileBackgroundFeature(previous, id), next) : next;
    features.push(merged); owners.push({ localId: draft.localId, featureIds: [merged.id], resourceIds: [] });
  }
  return { features, owners };
}

export type ItemBuilderDraft = { description: string; category: string; rarity: string | null; armorCategory: string; weaponProps: string[]; extraProps: string; weaponDamage: unknown[]; weaponClass: string | null; weaponRangeSel: string | null; acValue: string; acAddsDex: boolean; trait: DraftTrait; editorFeatureId?: string };
export function hydrateItemBuilder(item: Item): { draft: ItemBuilderDraft | null; editorFeature: Feature | null } {
  const draft = item.homebrewDraft as ItemBuilderDraft | undefined;
  const marker = draft?.editorFeatureId;
  return { draft: draft ?? null, editorFeature: marker ? item.features.find(f => f.id === marker) ?? null : null };
}
export function serializeItemBuilder(original: Item | null | undefined, built: Item, draft: ItemBuilderDraft, mechanicsChanged: boolean): Item {
  const hydrated = original ? hydrateItemBuilder(original) : { draft: null, editorFeature: null };
  const legacyId = original?.features.some(f => f.id === original.id + '_feat') ? original.id + '_feat' : undefined;
  const ownedId = hydrated.editorFeature?.id ?? legacyId;
  if (!mechanicsChanged && original) return { ...built, features: original.features, homebrewDraft: { ...draft, editorFeatureId: hydrated.editorFeature?.id ?? legacyId } };
  const candidate = built.features[0];
  const editorFeatureId = ownedId ?? candidate.id;
  const prior = ownedId ? original?.features.find(f => f.id === ownedId) : undefined;
  const owned = prior ? mergeRepresented(prior, prior, { ...candidate, id: editorFeatureId }) : { ...candidate, id: editorFeatureId };
  return { ...built, features: [...(original?.features ?? []).filter(f => f.id !== ownedId), owned], homebrewDraft: { ...draft, editorFeatureId } };
}
