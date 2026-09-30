// The installed-pack detail page listed the official Bard as "(missing: bard)" in red for the Understudy pack
// (the same false alarm as the import preview). Bundled official content is outside the pack but not missing.
import { buildPackDetail } from '../packageLibrary';
import { buildUnderstudyPack, buildBreadthPack } from '../../../demo/sample-packs/samplePacks';
import type { InstalledPack } from '../../db/packRegistryRepo';
import type { DependencyRef } from '../contentDependencies';
import { flattenPackageContents } from '../packageConflicts';

function installed(pack: ReturnType<typeof buildUnderstudyPack>): { inst: InstalledPack; lookup: (r: DependencyRef) => any } {
  const items = flattenPackageContents(pack.homebrew);
  return {
    inst: { id: 'p', name: pack.name ?? 'P', importedAt: 1, itemRefs: items.map(c => ({ type: c.type, id: c.item.id })) } as InstalledPack,
    lookup: (r: DependencyRef) => items.find(c => c.type === r.type && c.item.id === r.id)?.item,
  };
}
const official = (ids: Record<string, string>) => ({
  isOfficial: (r: DependencyRef) => r.type === 'class' && r.id in ids,
  nameOf: (r: DependencyRef) => ids[r.id],
});

describe('buildPackDetail external dependencies', () => {
  it('Understudy: the parent Bard is an external dependency but NOT missing, shown by its real name', () => {
    const { inst, lookup } = installed(buildUnderstudyPack());
    const d = buildPackDetail(inst, lookup, official({ bard: 'Bard' }));
    expect(d.externalDeps).toEqual([expect.objectContaining({ type: 'class', id: 'bard', name: 'Bard', missing: false })]);
  });

  it('Breadth: the parent Fighter likewise', () => {
    const { inst, lookup } = installed(buildBreadthPack());
    const d = buildPackDetail(inst, lookup, official({ fighter: 'Fighter' }));
    const fighter = d.externalDeps.find(x => x.id === 'fighter');
    expect(fighter).toMatchObject({ name: 'Fighter', missing: false });
    expect(d.externalDeps.some(x => x.missing)).toBe(false);
  });

  it('still reports a dependency that exists nowhere as missing', () => {
    const { inst, lookup } = installed(buildUnderstudyPack());
    const d = buildPackDetail(inst, lookup, official({ fighter: 'Fighter' })); // bard unknown to this resolver
    expect(d.externalDeps.find(x => x.id === 'bard')).toMatchObject({ missing: true });
  });

  it('without a resolver the previous behavior is unchanged', () => {
    const { inst, lookup } = installed(buildUnderstudyPack());
    expect(buildPackDetail(inst, lookup).externalDeps.find(x => x.id === 'bard')).toMatchObject({ missing: true });
  });

  it('installed homebrew still satisfies a dependency', () => {
    const { inst, lookup } = installed(buildUnderstudyPack());
    const withHb = (r: DependencyRef) => (r.type === 'class' && r.id === 'bard' ? { id: 'bard', name: 'Homebrew Bard' } : lookup(r));
    expect(buildPackDetail(inst, withHb as never).externalDeps.find(x => x.id === 'bard')).toMatchObject({ name: 'Homebrew Bard', missing: false });
  });
});
