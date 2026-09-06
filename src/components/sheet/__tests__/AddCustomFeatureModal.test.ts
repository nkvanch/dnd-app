// src/components/sheet/__tests__/AddCustomFeatureModal.test.ts
// Tests grantCustomFeature directly (pure logic) rather than through the RN
// component, matching this codebase's established preference. Phase 3 of
// the live feature/background editing track — a DM/player authoring a
// one-off feature on the spot.
import { grantCustomFeature } from '../AddCustomFeatureModal';
import { newDraftTrait } from '../../homebrew/TraitEditor';
import { removeFeature } from '../../../engine/leveling';
import { makeEmptyEntity, DEFAULT_RULES } from '../../../store/characterStore';
import { recomputeDerived } from '../../../engine/pipeline';
import { DraftTrait } from '../../../engine/types';

function baseEntity() {
  const e = makeEmptyEntity('add-custom-feature-test');
  return recomputeDerived({ ...e, identity: { ...e.identity, level: 1 } }, DEFAULT_RULES);
}

describe('grantCustomFeature', () => {
  it('grants a feature tagged source.kind:"manual", using the compiled (idPrefix-derived) id', () => {
    const draft: DraftTrait = { ...newDraftTrait('Iron Skin'), effectKind: 'ac_bonus', acBonusAmount: '1' };
    const entity = baseEntity();
    const updated = grantCustomFeature(entity, draft);
    const granted = updated.features.find(f => f.name === 'Iron Skin');
    expect(granted).toBeDefined();
    expect(granted!.source).toEqual({ kind: 'manual', refId: draft.localId });
    expect(granted!.id).toBe(`${draft.localId}_iron_skin`);
  });

  it('applies the mechanical effect (recomputed derived AC reflects the bonus)', () => {
    const draft: DraftTrait = { ...newDraftTrait('Iron Skin'), effectKind: 'ac_bonus', acBonusAmount: '1' };
    const entity = baseEntity();
    const updated = recomputeDerived(grantCustomFeature(entity, draft), DEFAULT_RULES);
    expect(updated.derived.ac).toBe(entity.derived.ac + 1);
  });

  it('grants a limited-use trait\'s resource tagged sourceKind:"manual" with sourceId equal to the feature\'s own id — what lets removeFeature clean both up together', () => {
    const draft: DraftTrait = {
      ...newDraftTrait('Channel Power'),
      effectKind: 'ac_bonus', acBonusAmount: '1',
      limitedUse: true, uses: '2', recharge: 'long_rest', actionType: 'bonus_action',
    };
    const entity = baseEntity();
    const updated = grantCustomFeature(entity, draft);
    const granted = updated.features.find(f => f.name === 'Channel Power')!;
    expect(granted.activation?.resourceCost?.resourceId).toBe(`${granted.id}_pool`);

    const resource = updated.resources.custom.find(r => r.id === granted.activation!.resourceCost!.resourceId);
    expect(resource).toBeDefined();
    expect(resource!.sourceKind).toBe('manual');
    expect(resource!.sourceId).toBe(granted.id); // NOT draft.localId — must match removeFeature's featureId check
    expect(resource!.maximum).toBe(2);
  });

  it('is additive — granting twice adds two distinct features (no dedup, each is its own one-off grant)', () => {
    const draft: DraftTrait = { ...newDraftTrait('Iron Skin'), effectKind: 'ac_bonus', acBonusAmount: '1' };
    const entity = baseEntity();
    const once = grantCustomFeature(entity, draft);
    // A fresh draft (new localId) for the second grant, same as re-opening
    // the modal would produce (useEffect resets the draft on each open).
    const secondDraft: DraftTrait = { ...newDraftTrait('Iron Skin'), effectKind: 'ac_bonus', acBonusAmount: '1' };
    const twice = grantCustomFeature(once, secondDraft);
    expect(twice.features.filter(f => f.name === 'Iron Skin')).toHaveLength(2);
  });

  it('integrates with Phase 1\'s removeFeature — removing the granted feature also removes its linked resource', () => {
    const draft: DraftTrait = {
      ...newDraftTrait('Channel Power'),
      effectKind: 'ac_bonus', acBonusAmount: '1',
      limitedUse: true, uses: '2', recharge: 'long_rest', actionType: 'bonus_action',
    };
    const entity = baseEntity();
    const granted = grantCustomFeature(entity, draft);
    const feature = granted.features.find(f => f.name === 'Channel Power')!;
    const resourceId = feature.activation!.resourceCost!.resourceId;
    expect(granted.resources.custom.some(r => r.id === resourceId)).toBe(true);

    const removed = removeFeature(granted, feature.id);
    expect(removed.features.some(f => f.id === feature.id)).toBe(false);
    expect(removed.resources.custom.some(r => r.id === resourceId)).toBe(false);
  });
});
