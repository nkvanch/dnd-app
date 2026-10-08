import type { Background, ChoiceDefinition, Feature, Item } from '../types';
import { newDraftTrait } from '../../content/traitCompiler';
import { hydrateItemBuilder, hydrateLosslessChoices, serializeBackgroundFeatures, serializeDraftTraits, serializeItemBuilder, serializeLosslessChoices } from '../homebrewNestedSerializers';

const hiddenFeature = (id: string, sourceKind: Feature['source']['kind'] = 'race'): Feature => ({
  id, name: 'Old name', description: 'Old text', source: { kind: sourceKind, refId: 'owner' }, level: null, passive: false,
  effects: [{ type: 'stat_modifier', target: 'ac', operation: 'add', value: 1, condition: null }, { type: 'future_effect', extension: true } as any],
  actions: [{ id: 'hidden-action' } as any], choices: [{ id: 'hidden-choice' } as any], activation: { actionType: 'bonus_action', resourceCost: null, range: 'self', target: 'self', requiresSave: null },
  extension: { keep: true }, provenance: { keep: true },
} as any);
const choice = (id: string, kind: ChoiceDefinition['kind'] = 'tool'): ChoiceDefinition => ({ id, prompt: 'Old', kind, count: 1,
  pool: [{ id: 'a', label: 'A', value: 'a', extension: true } as any], grants: [{ kind: 'language', value: 'Elvish', provenance: true } as any], extension: { keep: true } } as any);

describe('production nested builder serializers', () => {
  it('Race trait represented edit preserves hidden compiled mechanics and supports deletion', () => {
    const oldDraft = { ...newDraftTrait('Old name'), localId: 'trait-1', description: 'Old text', effectKind: 'ac_bonus' as const, acBonusAmount: '1' };
    const original = hiddenFeature('race_old_name');
    const edited = { ...oldDraft, name: 'New name', description: 'New text' };
    const result = serializeDraftTraits({ originalFeatures: [original, hiddenFeature('sibling')], originalDrafts: [oldDraft], editedDrafts: [edited], idPrefix: 'race', sourceKind: 'race', sourceRefId: 'race' });
    const changed = result.features.find(f => f.name === 'New name')!;
    expect(changed).toMatchObject({ description: 'New text', actions: original.actions, activation: original.activation, choices: original.choices, extension: { keep: true }, provenance: { keep: true } });
    expect(changed.effects).toContainEqual({ type: 'future_effect', extension: true });
    expect(result.features.find(f => f.id === 'sibling')).toBeDefined();
    const deleted = serializeDraftTraits({ originalFeatures: [original], originalDrafts: [oldDraft], editedDrafts: [], idPrefix: 'race', sourceKind: 'race', sourceRefId: 'race' });
    expect(deleted.features).toEqual([]);
  });

  it('Subrace trait and supported choice edits preserve hidden data and unsupported siblings', () => {
    const oldDraft = { ...newDraftTrait('Old name'), localId: 'trait-1', description: 'Old text' };
    const original = hiddenFeature('sub_old_name');
    const traits = serializeDraftTraits({ originalFeatures: [original], originalDrafts: [oldDraft], editedDrafts: [{ ...oldDraft, description: 'Edited' }], idPrefix: 'sub', sourceKind: 'race', sourceRefId: 'sub' });
    expect(traits.features[0]).toMatchObject({ description: 'Edited', actions: original.actions, extension: { keep: true } });
    const supported = choice('sub_choice'); const unsupported = choice('custom', 'custom');
    const drafts = hydrateLosslessChoices([supported, unsupported], 'sub_').map(d => ({ ...d, prompt: 'Edited prompt' }));
    expect(serializeLosslessChoices([supported, unsupported], drafts, 'sub_')).toEqual([{ ...supported, prompt: 'Edited prompt' }, unsupported]);
  });

  it('Background feature text edit preserves hidden mechanics and choices remain lossless', () => {
    const draft = { localId: 'f1', name: 'Old name', description: 'Old text' };
    const originalFeature = { ...hiddenFeature('bg_old_name', 'background'), source: { kind: 'background' as const, refId: 'bg' } };
    const bg = { id: 'bg', name: 'BG', features: [originalFeature], homebrewDraft: { features: [draft] } } as Background;
    const result = serializeBackgroundFeatures(bg, [draft], [{ ...draft, name: 'New name' }], 'bg', [], []);
    expect(result.features[0]).toMatchObject({ name: 'New name', effects: originalFeature.effects, actions: originalFeature.actions, activation: originalFeature.activation, extension: { keep: true } });
    const c = choice('bg_choice'); const drafts = hydrateLosslessChoices([c], 'bg_').map(d => ({ ...d, prompt: 'New' }));
    expect(serializeLosslessChoices([c], drafts, 'bg_')![0]).toEqual({ ...c, prompt: 'New' });
  });

  it('Item complete hydrate/serialize lifecycle creates and reuses a safe owned feature', () => {
    const imported = { id: 'item', name: 'Imported', weight: 0, cost: '-', properties: [], features: [hiddenFeature('A', 'item'), hiddenFeature('B', 'item'), hiddenFeature('C', 'item')] } as Item;
    const trait = newDraftTrait('Effect'); const draft: any = { description: 'new', category: 'gear', rarity: null, armorCategory: '', weaponProps: [], extraProps: '', weaponDamage: [], weaponClass: null, weaponRangeSel: null, acValue: '', acAddsDex: false, trait };
    const candidate = { ...imported, features: [hiddenFeature('item_feat', 'item')], homebrewDraft: draft };
    const first = serializeItemBuilder(imported, candidate, draft, true);
    expect(first.features.slice(0, 3)).toEqual(imported.features);
    expect(hydrateItemBuilder(first).editorFeature?.id).toBe('item_feat');
    const secondCandidate = { ...first, features: [{ ...hiddenFeature('item_feat', 'item'), description: 'second' }] };
    const second = serializeItemBuilder(first, secondCandidate, { ...draft, description: 'second' }, true);
    expect(second.features).toHaveLength(4); expect(hydrateItemBuilder(JSON.parse(JSON.stringify(second))).editorFeature?.description).toBe('second');
    const rename = serializeItemBuilder(imported, { ...candidate, name: 'Renamed' }, draft, false);
    expect(rename.features).toEqual(imported.features); expect((rename.homebrewDraft as any).editorFeatureId).toBeUndefined();
  });

  it('legacy builder item reuses its deterministic feature and preserves siblings', () => {
    const owned = hiddenFeature('legacy_feat', 'item'); const sibling = hiddenFeature('other', 'item');
    const item = { id: 'legacy', name: 'Legacy', weight: 0, cost: '-', properties: [], features: [owned, sibling] } as Item;
    const trait = newDraftTrait('Effect'); const draft: any = { description: 'edit', category: 'gear', rarity: null, armorCategory: '', weaponProps: [], extraProps: '', weaponDamage: [], weaponClass: null, weaponRangeSel: null, acValue: '', acAddsDex: false, trait };
    const result = serializeItemBuilder(item, { ...item, features: [{ ...owned, description: 'edit' }], homebrewDraft: draft }, draft, true);
    expect(result.features).toHaveLength(2); expect(result.features.find(f => f.id === 'legacy_feat')?.description).toBe('edit'); expect(result.features).toContainEqual(sibling);
  });
});
