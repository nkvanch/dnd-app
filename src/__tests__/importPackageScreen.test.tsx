// Import Homebrew screen: a first-time import is an IMPORT (no "Updating installed pack" line, an "Import" button);
// an already-installed pack goes through the update prompt and then names the real installed pack.
// Regression for the creator stress test, where every first import read `Updating installed pack ""` + "Update".
const mockInstalled: { current: { id: string; name: string; importedAt: number; itemRefs: unknown[]; packageVersion?: string }[] } = { current: [] };
const mockPick = jest.fn();
jest.mock('../db/packRegistryRepo', () => ({
  loadInstalledPacks: () => Promise.resolve(mockInstalled.current),
  recordInstalledPack: jest.fn(() => Promise.resolve()),
}));
jest.mock('../db/encounterRepo', () => ({ loadAllEncounters: () => Promise.resolve([]) }));
jest.mock('../io/packageIO', () => ({ pickAndValidatePackage: (...args: unknown[]) => mockPick(...args) }));
jest.mock('../hooks/useSafeGoBack', () => ({ useSafeGoBack: () => () => {} }));
jest.mock('../content/officialRefs', () => ({ isOfficialRef: () => false }));
jest.mock('../utils/alert', () => ({ Alert: { alert: jest.fn() } }));

import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import ImportPackageScreen from '../../app/homebrew/import-package';
import { buildUnderstudyPack, buildBreadthPack } from '../../demo/sample-packs/samplePacks';

const texts = (r: TestRenderer.ReactTestRenderer): string[] => {
  const out: string[] = [];
  const walk = (n: unknown) => {
    if (typeof n === 'string') { out.push(n); return; }
    if (!n || typeof n !== 'object') return;
    ((n as { children?: unknown[] }).children ?? []).forEach(walk);
  };
  walk(r.toJSON());
  return out;
};
const joined = (r: TestRenderer.ReactTestRenderer) => texts(r).join(' | ');

function pressText(r: TestRenderer.ReactTestRenderer, label: string) {
  const btn = r.root.findAll(n => typeof n.props.onPress === 'function' && n.findAll(c => c.children.includes(label)).length > 0)[0];
  if (!btn) throw new Error(`no pressable with text "${label}" in: ${joined(r)}`);
  return act(async () => { await btn.props.onPress(); });
}

async function openPreview(pack: ReturnType<typeof buildUnderstudyPack>) {
  mockPick.mockResolvedValueOnce({
    pack, validation: { blocking: [], blockingIssues: [], issues: [] }, conflicts: [], identical: [], suggestedName: pack.name ?? 'Pack',
  });
  let r!: TestRenderer.ReactTestRenderer;
  await act(async () => { r = TestRenderer.create(<ImportPackageScreen />); await Promise.resolve(); });
  await pressText(r, 'Choose Package File…');
  return r;
}

beforeEach(() => { mockInstalled.current = []; mockPick.mockReset(); });

describe('first import (nothing installed matches)', () => {
  it('reads as an import: no "Updating installed pack", and the button says Import', async () => {
    const r = await openPreview({ ...buildUnderstudyPack(), packageId: 'pkg_understudy' } as never);
    const t = joined(r);
    expect(t).toContain('Understudy Test Pack');
    expect(t).not.toContain('Updating installed pack');
    expect(t).not.toContain('UPDATE AVAILABLE');
    expect(texts(r)).not.toContain('Update');
    expect(texts(r)).toContain('Import All'); // 2 items (subclass + its condition dependency)
  });

  it('a multi-content pack still says Import All, never Update', async () => {
    const r = await openPreview({ ...buildBreadthPack(), packageId: 'pkg_breadth' } as never);
    expect(texts(r)).toContain('Import All');
    expect(texts(r)).not.toContain('Update');
  });

  it('passes the official-content check to the validator (so bundled Bard/Fighter are not reported missing)', async () => {
    await openPreview({ ...buildUnderstudyPack(), packageId: 'pkg_understudy' } as never);
    const [, , isOfficial] = mockPick.mock.calls[0];
    expect(typeof isOfficial).toBe('function');
  });
});

describe('the same pack is already installed', () => {
  it('asks update-or-copy first, naming the real installed pack', async () => {
    mockInstalled.current = [{ id: 'pkg_understudy', name: 'Understudy Test Pack', importedAt: 1, itemRefs: [], packageVersion: '0.9' }];
    const r = await openPreview({ ...buildUnderstudyPack(), packageId: 'pkg_understudy' } as never);
    const t = joined(r);
    expect(t).toContain('UPDATE AVAILABLE');
    expect(texts(r).join('')).toContain('"Understudy Test Pack" is already installed');
    expect(t).toContain('Update Pack');
    expect(t).toContain('Install As Separate Copy');
  });

  it('after choosing Update Pack: shows the real installed name and an Update button', async () => {
    mockInstalled.current = [{ id: 'pkg_understudy', name: 'Understudy Test Pack', importedAt: 1, itemRefs: [] }];
    const r = await openPreview({ ...buildUnderstudyPack(), packageId: 'pkg_understudy' } as never);
    await pressText(r, 'Update Pack');
    expect(joined(r)).toContain('Updating installed pack "Understudy Test Pack"');
    expect(texts(r)).toContain('Update');
  });

  it('after choosing Install As Separate Copy: an import, not an update', async () => {
    mockInstalled.current = [{ id: 'pkg_understudy', name: 'Understudy Test Pack', importedAt: 1, itemRefs: [] }];
    const r = await openPreview({ ...buildUnderstudyPack(), packageId: 'pkg_understudy' } as never);
    await pressText(r, 'Install As Separate Copy');
    expect(joined(r)).not.toContain('Updating installed pack');
    expect(texts(r)).toContain('Import All');
  });
});
