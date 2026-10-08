// src/content/classes/__tests__/triggeredFeatures.test.ts
// A-58: TriggeredFeaturesSection (actionCards.ts's getTriggeredFeatures) was
// shipped, tested, and rendered — but had ZERO real content setting
// Feature.trigger, so it never showed anything to any user. This locks in
// the first real batch, and proves getTriggeredFeatures actually surfaces
// them once granted onto an entity (not just present in the raw content).
import { ALL_CLASS_PROGRESSIONS } from '../index';
import { getTriggeredFeatures } from '../../../engine/actionCards';
import { makeEmptyEntity } from '../../../store/characterStore';
import { Feature, Grant } from '../../../engine/types';

const EXPECTED_TRIGGERED_IDS = [
  'sneak_attack', 'evasion_rogue', 'relentless_rage',
  'brutal_critical', 'brutal_critical_2', 'brutal_critical_3',
  'indomitable_might', 'foe_slayer', 'improved_divine_smite',
];

function allFeatureGrants(): Feature[] {
  return ALL_CLASS_PROGRESSIONS.flatMap(p =>
    p.entries.flatMap(e => e.grants
      .filter((g): g is Grant & { kind: 'feature' } => g.kind === 'feature')
      .map(g => g.value as Feature)));
}

describe('Trigger-only features have Feature.trigger set (A-58)', () => {
  const features = allFeatureGrants();

  it.each(EXPECTED_TRIGGERED_IDS)('%s has a non-empty trigger and no activation', (id) => {
    const feature = features.find(f => f.id === id);
    expect(feature).toBeDefined();
    expect(feature!.trigger).toBeTruthy();
    expect(feature!.activation).toBeUndefined();
  });

  it('getTriggeredFeatures surfaces a granted trigger-only feature on a real entity', () => {
    const sneakAttack = features.find(f => f.id === 'sneak_attack')!;
    const entity = {
      ...makeEmptyEntity('test-rogue'),
      identity: { ...makeEmptyEntity('test-rogue').identity, level: 1 },
      features: [{ ...sneakAttack, isActive: true }],
    };
    const triggered = getTriggeredFeatures(entity);
    expect(triggered.map(f => f.id)).toContain('sneak_attack');
  });

  it('getTriggeredFeatures excludes a trigger-only feature above the entity\'s level', () => {
    const evasion = features.find(f => f.id === 'evasion_rogue')!; // granted at level 7
    const entity = {
      ...makeEmptyEntity('test-rogue-low-level'),
      identity: { ...makeEmptyEntity('test-rogue-low-level').identity, level: 1 },
      features: [{ ...evasion, isActive: true }],
    };
    const triggered = getTriggeredFeatures(entity);
    expect(triggered.map(f => f.id)).not.toContain('evasion_rogue');
  });
});
