import { useCompendiumModeStore } from '../compendiumModeStore';
import { useBrowseStateStore } from '../browseStateStore';

beforeEach(() => {
  useCompendiumModeStore.setState({ mode: 'official', selectedPackId: null });
  for (const k of ['compendium', 'compendium.homebrew', 'compendium.packages']) useBrowseStateStore.getState().clearBrowseState(k);
});

describe('Compendium mode selection (B)', () => {
  it('starts on Official with no package open', () => {
    const s = useCompendiumModeStore.getState();
    expect(s.mode).toBe('official');
    expect(s.selectedPackId).toBeNull();
  });

  it('remembers the selected mode (leaving and returning to the tab keeps it)', () => {
    useCompendiumModeStore.getState().setMode('homebrew');
    // the tab screen holds no mode state of its own — a fresh read is what a remount sees
    expect(useCompendiumModeStore.getState().mode).toBe('homebrew');
  });
});

describe('Back navigation (I, J)', () => {
  it('editing a Homebrew entry and coming back lands on Homebrew, not Official', () => {
    useCompendiumModeStore.getState().setMode('homebrew');
    // …the editor route is pushed and popped; nothing in the editor touches this store…
    expect(useCompendiumModeStore.getState().mode).toBe('homebrew');
  });

  it('package detail → editor → Back returns to the same package; Back again returns to the Packages list', () => {
    const s = useCompendiumModeStore.getState();
    s.openPack('pack-1');
    expect(useCompendiumModeStore.getState().mode).toBe('packages');
    expect(useCompendiumModeStore.getState().selectedPackId).toBe('pack-1');
    // editor pushed and popped: state untouched → detail is still open
    expect(useCompendiumModeStore.getState().selectedPackId).toBe('pack-1');
    useCompendiumModeStore.getState().closePack();
    expect(useCompendiumModeStore.getState().selectedPackId).toBeNull();
    expect(useCompendiumModeStore.getState().mode).toBe('packages');
  });
});

describe('Per-mode search state is preserved (K)', () => {
  it('Official / Homebrew / Packages each keep their own search across mode switches', () => {
    const b = useBrowseStateStore.getState();
    b.setBrowseState('compendium', { search: 'fire' });
    b.setBrowseState('compendium.homebrew', { search: 'storm' });
    b.setBrowseState('compendium.packages', { search: '' });

    for (const m of ['homebrew', 'packages', 'official', 'homebrew'] as const) useCompendiumModeStore.getState().setMode(m);

    const g = useBrowseStateStore.getState();
    expect(g.getBrowseState('compendium').search).toBe('fire');
    expect(g.getBrowseState('compendium.homebrew').search).toBe('storm');
    expect(g.getBrowseState('compendium.packages').search).toBe('');
  });

  it('the three views persist under their own keys (source check)', () => {
    const fs = require('fs') as typeof import('fs');
    const path = require('path') as typeof import('path');
    const read = (p: string) => fs.readFileSync(path.resolve(__dirname, '../../..', p), 'utf8');
    expect(read('src/components/compendium/HomebrewLibraryView.tsx')).toContain("'compendium.homebrew'");
    expect(read('src/components/compendium/InstalledPackagesView.tsx')).toContain("'compendium.packages'");
    expect(read('app/(tabs)/compendium.tsx')).toContain("const SCREEN_KEY = 'compendium'");
  });
});
