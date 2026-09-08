// src/content/classes/__tests__/divineSmite.test.ts
// A-57: Divine Smite is the first real content to use FeatureActivation
// .options — previously hardcoded to always spend a 1st-level slot
// regardless of what the player wanted. Locks the content shape so a
// future edit to the class file can't silently drop the tier choice.
import { ALL_CLASS_PROGRESSIONS } from '../index';
import { Grant } from '../../../engine/types';

function findDivineSmiteGrant(): Grant {
  const paladin = ALL_CLASS_PROGRESSIONS.find(p => p.classId === 'paladin');
  if (!paladin) throw new Error('paladin progression not found');
  for (const entry of paladin.entries) {
    const grant = entry.grants.find(g => g.kind === 'feature' && (g.value as { id: string }).id === 'divine_smite');
    if (grant) return grant;
  }
  throw new Error('divine_smite grant not found');
}

describe('Divine Smite activation options (A-57)', () => {
  const grant = findDivineSmiteGrant();
  const feature = grant.value as { activation: { options?: { id: string; label: string; resourceCost?: { spellSlotTier?: number } }[] } };
  const options = feature.activation.options ?? [];

  it('offers exactly 5 slot-tier options', () => {
    expect(options).toHaveLength(5);
  });

  it('each option spends exactly one spell slot at an ascending tier', () => {
    options.forEach((opt, i) => {
      expect(opt.resourceCost?.spellSlotTier).toBe(i + 1);
    });
  });

  it('every option has a unique id and a non-empty label/description', () => {
    const ids = options.map(o => o.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const opt of options) {
      expect(opt.label.length).toBeGreaterThan(0);
    }
  });
});
