// src/components/sheet/__tests__/AddCustomFeatureModal.test.ts
// Tests grantCustomFeature directly (pure logic) rather than through the RN
// component, matching this codebase's established preference. Phase 3 of
// the live feature/background editing track — a DM/player authoring a
// one-off feature on the spot.
import { grantCustomFeature } from '../AddCustomFeatureModal';
import { newDraftTrait } from '../../homebrew/TraitEditor';
import { removeFeature } from '../../../engine/leveling';
import { tickDurations } from '../../../engine/conditions';
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
    const updated = grantCustomFeature(entity, draft, DEFAULT_RULES);
    const granted = updated.features.find(f => f.name === 'Iron Skin');
    expect(granted).toBeDefined();
    expect(granted!.source).toEqual({ kind: 'manual', refId: draft.localId });
    expect(granted!.id).toBe(`${draft.localId}_iron_skin`);
  });

  it('applies the mechanical effect (recomputed derived AC reflects the bonus)', () => {
    const draft: DraftTrait = { ...newDraftTrait('Iron Skin'), effectKind: 'ac_bonus', acBonusAmount: '1' };
    const entity = baseEntity();
    const updated = recomputeDerived(grantCustomFeature(entity, draft, DEFAULT_RULES), DEFAULT_RULES);
    expect(updated.derived.ac).toBe(entity.derived.ac + 1);
  });

  it('grants a limited-use trait\'s resource tagged sourceKind:"manual" with sourceId equal to the feature\'s own id — what lets removeFeature clean both up together', () => {
    const draft: DraftTrait = {
      ...newDraftTrait('Channel Power'),
      effectKind: 'ac_bonus', acBonusAmount: '1',
      limitedUse: true, uses: '2', recharge: 'long_rest', actionType: 'bonus_action',
    };
    const entity = baseEntity();
    const updated = grantCustomFeature(entity, draft, DEFAULT_RULES);
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
    const once = grantCustomFeature(entity, draft, DEFAULT_RULES);
    // A fresh draft (new localId) for the second grant, same as re-opening
    // the modal would produce (useEffect resets the draft on each open).
    const secondDraft: DraftTrait = { ...newDraftTrait('Iron Skin'), effectKind: 'ac_bonus', acBonusAmount: '1' };
    const twice = grantCustomFeature(once, secondDraft, DEFAULT_RULES);
    expect(twice.features.filter(f => f.name === 'Iron Skin')).toHaveLength(2);
  });

  it('integrates with Phase 1\'s removeFeature — removing the granted feature also removes its linked resource', () => {
    const draft: DraftTrait = {
      ...newDraftTrait('Channel Power'),
      effectKind: 'ac_bonus', acBonusAmount: '1',
      limitedUse: true, uses: '2', recharge: 'long_rest', actionType: 'bonus_action',
    };
    const entity = baseEntity();
    const granted = grantCustomFeature(entity, draft, DEFAULT_RULES);
    const feature = granted.features.find(f => f.name === 'Channel Power')!;
    const resourceId = feature.activation!.resourceCost!.resourceId;
    expect(granted.resources.custom.some(r => r.id === resourceId)).toBe(true);

    const removed = removeFeature(granted, feature.id);
    expect(removed.features.some(f => f.id === feature.id)).toBe(false);
    expect(removed.resources.custom.some(r => r.id === resourceId)).toBe(false);
  });

  // A-26: a timed grant routes through applyCondition instead of applyGrant,
  // so it ticks/expires via the exact same mechanism a named condition does.
  describe('timed grants (A-26 — generalized temporary effects)', () => {
    it('a permanent (null) duration behaves exactly as before — feature tagged "manual"', () => {
      const draft: DraftTrait = { ...newDraftTrait('Iron Skin'), effectKind: 'ac_bonus', acBonusAmount: '1' };
      const entity = baseEntity();
      const updated = grantCustomFeature(entity, draft, DEFAULT_RULES, null);
      const granted = updated.features.find(f => f.name === 'Iron Skin')!;
      expect(granted.source).toEqual({ kind: 'manual', refId: draft.localId });
    });

    it('a rounds duration tags the feature "condition" and applies the effect immediately', () => {
      const draft: DraftTrait = { ...newDraftTrait('Blessed Aim'), effectKind: 'ac_bonus', acBonusAmount: '2' };
      const entity = baseEntity();
      const updated = grantCustomFeature(entity, draft, DEFAULT_RULES, { unit: 'rounds', remaining: 2 });
      const granted = updated.features.find(f => f.name === 'Blessed Aim')!;
      expect(granted.source.kind).toBe('condition');
      expect(updated.derived.ac).toBe(entity.derived.ac + 2);
      expect(updated.conditionMonitor.active.some(c => c.id === granted.id)).toBe(true);
    });

    it('the timed feature and its effect are gone after the duration expires via tickDurations', () => {
      const draft: DraftTrait = { ...newDraftTrait('Blessed Aim'), effectKind: 'ac_bonus', acBonusAmount: '2' };
      const entity = baseEntity();
      let updated = grantCustomFeature(entity, draft, DEFAULT_RULES, { unit: 'rounds', remaining: 1 });
      expect(updated.derived.ac).toBe(entity.derived.ac + 2);

      updated = tickDurations(updated, DEFAULT_RULES);
      expect(updated.derived.ac).toBe(entity.derived.ac);
      expect(updated.features.some(f => f.name === 'Blessed Aim')).toBe(false);
      expect(updated.conditionMonitor.active).toHaveLength(0);
    });

    it('a limited-use resource on a timed grant still applies permanently — no timed-resource concept exists', () => {
      const draft: DraftTrait = {
        ...newDraftTrait('Channel Power'),
        effectKind: 'ac_bonus', acBonusAmount: '1',
        limitedUse: true, uses: '2', recharge: 'long_rest', actionType: 'bonus_action',
      };
      const entity = baseEntity();
      let updated = grantCustomFeature(entity, draft, DEFAULT_RULES, { unit: 'rounds', remaining: 1 });
      const granted = updated.features.find(f => f.name === 'Channel Power')!;
      const resourceId = granted.activation!.resourceCost!.resourceId;
      expect(updated.resources.custom.some(r => r.id === resourceId)).toBe(true);

      updated = tickDurations(updated, DEFAULT_RULES); // the FEATURE expires...
      expect(updated.features.some(f => f.id === granted.id)).toBe(false);
      expect(updated.resources.custom.some(r => r.id === resourceId)).toBe(true); // ...the resource does not
    });
  });

  // DM temporary rulings (multi-target generalization, DmRulingModal.tsx):
  // applying the SAME draft object to several independent entities must
  // produce the SAME compiled feature/condition id on each of them — that's
  // what would let a future "remove this ruling from everyone" action find
  // every target by one shared id, and it falls out for free since the id
  // is derived from draft.localId, which is fixed once per DraftTrait
  // regardless of how many entities the same draft is applied to.
  describe('applying one draft to multiple entities (DM ruling multi-target)', () => {
    it('produces the same feature id on every independently-targeted entity', () => {
      const draft: DraftTrait = { ...newDraftTrait('Blessed'), effectKind: 'ac_bonus', acBonusAmount: '1' };
      const a = grantCustomFeature(baseEntity(), draft, DEFAULT_RULES);
      const b = grantCustomFeature(baseEntity(), draft, DEFAULT_RULES);
      const idA = a.features.find(f => f.name === 'Blessed')!.id;
      const idB = b.features.find(f => f.name === 'Blessed')!.id;
      expect(idA).toBe(idB);
    });

    it('with a duration, tags the same condition id on every targeted entity, independently tickable per entity', () => {
      const draft: DraftTrait = { ...newDraftTrait('Blessed'), effectKind: 'ac_bonus', acBonusAmount: '1' };
      const duration = { unit: 'rounds' as const, remaining: 1 };
      let a = grantCustomFeature(baseEntity(), draft, DEFAULT_RULES, duration);
      const b = grantCustomFeature(baseEntity(), draft, DEFAULT_RULES, duration);
      const conditionId = a.features.find(f => f.name === 'Blessed')!.id;
      expect(b.features.find(f => f.name === 'Blessed')!.id).toBe(conditionId);
      expect(a.conditionMonitor.active.some(c => c.id === conditionId)).toBe(true);
      expect(b.conditionMonitor.active.some(c => c.id === conditionId)).toBe(true);

      // Each entity's own copy expires independently — applying to N
      // entities does not link their durations together.
      a = tickDurations(a, DEFAULT_RULES);
      expect(a.features.some(f => f.name === 'Blessed')).toBe(false);
      expect(b.features.some(f => f.name === 'Blessed')).toBe(true); // untouched
    });
  });
});
