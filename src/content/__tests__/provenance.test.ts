// src/content/__tests__/provenance.test.ts
import { getContentProvenance } from '../provenance';
import { buildPackOwnershipIndex } from '../../db/packRegistryRepo';
import { asRulesetId } from '../../engine/types';

describe('getContentProvenance', () => {
  it('official + srd content: sourceLabel derives to "SRD 5.1"', () => {
    const p = getContentProvenance({ id: 'human', srd: true }, { isHomebrew: false });
    expect(p.originKind).toBe('official');
    expect(p.sourceLabel).toBe('SRD 5.1');
    expect(p.packId).toBeUndefined();
  });

  it('official + non-srd content: sourceLabel stays undefined (not fabricated)', () => {
    const p = getContentProvenance({ id: 'tiefling', srd: false }, { isHomebrew: false });
    expect(p.originKind).toBe('official');
    expect(p.sourceLabel).toBeUndefined();
  });

  it('official Feat with a real source field: that field wins over the srd derivation', () => {
    const p = getContentProvenance({ id: 'alert', srd: true, source: "Player's Handbook" }, { isHomebrew: false });
    expect(p.sourceLabel).toBe("Player's Handbook");
  });

  it('local homebrew (not in any installed pack): originKind local_homebrew, sourceLabel "Local Homebrew"', () => {
    const packs = buildPackOwnershipIndex([]);
    const p = getContentProvenance({ id: 'my_feat' }, { isHomebrew: true, packOwnership: packs, ownershipKey: 'feat:my_feat' });
    expect(p.originKind).toBe('local_homebrew');
    expect(p.sourceLabel).toBe('Local Homebrew');
    expect(p.packId).toBeUndefined();
  });

  it('imported-pack homebrew: originKind imported_homebrew, sourceLabel/packLabel = the pack name', () => {
    const packs = buildPackOwnershipIndex([
      { id: 'nika-monsters-v2', name: 'Custom Monsters', importedAt: 1, itemRefs: [{ type: 'monster', id: 'owlbear_king' }] },
    ]);
    const p = getContentProvenance({ id: 'owlbear_king' }, { isHomebrew: true, packOwnership: packs, ownershipKey: 'monster:owlbear_king' });
    expect(p.originKind).toBe('imported_homebrew');
    expect(p.sourceLabel).toBe('Custom Monsters');
    expect(p.packId).toBe('nika-monsters-v2');
    expect(p.packLabel).toBe('Custom Monsters');
  });

  it('carries rulesetId through untouched', () => {
    const p = getContentProvenance({ id: 'human_2024', rulesetId: asRulesetId('dnd5e-2024') }, { isHomebrew: false });
    expect(p.rulesetId).toBe('dnd5e-2024');
  });
});

describe('buildPackOwnershipIndex', () => {
  it('indexes every itemRef of every pack, keyed by type:id', () => {
    const idx = buildPackOwnershipIndex([
      { id: 'pack_a', name: 'Pack A', importedAt: 1, itemRefs: [{ type: 'spell', id: 's1' }, { type: 'item', id: 'i1' }] },
      { id: 'pack_b', name: 'Pack B', importedAt: 2, itemRefs: [{ type: 'monster', id: 'm1' }] },
    ]);
    expect(idx.get('spell:s1')).toEqual({ packId: 'pack_a', packName: 'Pack A' });
    expect(idx.get('item:i1')).toEqual({ packId: 'pack_a', packName: 'Pack A' });
    expect(idx.get('monster:m1')).toEqual({ packId: 'pack_b', packName: 'Pack B' });
    expect(idx.size).toBe(3);
  });

  it('an item not claimed by any pack is absent from the index (implies local homebrew)', () => {
    const idx = buildPackOwnershipIndex([
      { id: 'pack_a', name: 'Pack A', importedAt: 1, itemRefs: [{ type: 'spell', id: 's1' }] },
    ]);
    expect(idx.has('spell:s2')).toBe(false);
  });

  it('first pack wins on a double-claim rather than crashing or silently overwriting to the last', () => {
    const idx = buildPackOwnershipIndex([
      { id: 'pack_a', name: 'Pack A', importedAt: 1, itemRefs: [{ type: 'spell', id: 's1' }] },
      { id: 'pack_b', name: 'Pack B', importedAt: 2, itemRefs: [{ type: 'spell', id: 's1' }] },
    ]);
    expect(idx.get('spell:s1')?.packId).toBe('pack_a');
  });

  it('empty pack list produces an empty index', () => {
    expect(buildPackOwnershipIndex([]).size).toBe(0);
  });
});
