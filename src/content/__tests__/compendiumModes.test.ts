import * as fs from 'fs';
import * as path from 'path';
import {
  COMPENDIUM_MODES, COMPENDIUM_MODE_LABELS, DEFAULT_COMPENDIUM_MODE, parseCompendiumMode,
  compendiumHref, legacyHomebrewViewRedirect,
} from '../compendiumModes';
import { EDIT_ROUTES } from '../homebrewLibrary';
import { isContentExposed, selectExposedContent } from '../contentExposure';

const root = path.resolve(__dirname, '../../..');
const read = (rel: string) => fs.readFileSync(path.join(root, rel), 'utf8');

describe('Compendium modes (A, B)', () => {
  it('has exactly three same-page modes, in order: Official / Homebrew / Packages', () => {
    expect(COMPENDIUM_MODES).toEqual(['official', 'homebrew', 'packages']);
    expect(COMPENDIUM_MODES.map(m => COMPENDIUM_MODE_LABELS[m])).toEqual(['Official', 'Homebrew', 'Packages']);
  });

  it('defaults to Official', () => {
    expect(DEFAULT_COMPENDIUM_MODE).toBe('official');
  });

  it('parses only valid modes (route params / persisted values)', () => {
    expect(parseCompendiumMode('homebrew')).toBe('homebrew');
    expect(parseCompendiumMode(['packages'])).toBe('packages');
    expect(parseCompendiumMode('favorites')).toBeNull();
    expect(parseCompendiumMode(undefined)).toBeNull();
    expect(parseCompendiumMode(3)).toBeNull();
  });

  it('the shell renders the segmented switch and mounts only the active mode', () => {
    const shell = read('app/(tabs)/compendium.tsx');
    expect(shell).toMatch(/<CompendiumModeSwitch mode=\{mode\}/);
    expect(shell).toMatch(/mode === 'official' && <OfficialCompendiumView/);
    expect(shell).toMatch(/mode === 'homebrew' && <HomebrewLibraryView/);
    expect(shell).toMatch(/mode === 'packages' && <InstalledPackagesView/);
    const sw = read('src/components/compendium/CompendiumModeSwitch.tsx');
    expect(sw).toContain("compendium-mode-");
    // same visual language as the sheet's Combat / Exploration switch
    const sheet = read('app/sheet/[id].tsx');
    for (const token of ['flexDirection: \'row\'', 'Colors.gold + \'22\'', 'FontWeight.bold']) {
      expect(sw).toContain(token);
      expect(sheet).toContain(token);
    }
  });
});

describe('Old routes redirect (G, H)', () => {
  it('?view=library → Compendium Homebrew; ?view=packages|installed → Compendium Packages', () => {
    expect(legacyHomebrewViewRedirect('library')).toBe(compendiumHref('homebrew'));
    expect(legacyHomebrewViewRedirect('packages')).toBe(compendiumHref('packages'));
    expect(legacyHomebrewViewRedirect('installed')).toBe(compendiumHref('packages'));
    expect(compendiumHref('homebrew')).toBe('/(tabs)/compendium?mode=homebrew');
  });

  it('never redirects a creation route or param', () => {
    for (const v of [undefined, '', 'create', 'race-builder', 'import', 'rule-profile', 'feat']) {
      expect(legacyHomebrewViewRedirect(v)).toBeNull();
    }
  });

  it('the Homebrew tab wires the redirect and keeps the Import Homebrew route', () => {
    const tab = read('app/(tabs)/homebrew.tsx');
    expect(tab).toContain('legacyHomebrewViewRedirect(view)');
    expect(tab).toContain("router.replace(legacyTarget)");
    expect(tab).toContain("'/homebrew/import-package'");
  });
});

describe('Homebrew creation tab is unchanged and separate (F)', () => {
  const tab = read('app/(tabs)/homebrew.tsx');
  const creationRoutes = [
    '/homebrew/race-builder', '/homebrew/subrace-builder', '/homebrew/class-builder', '/homebrew/subclass-builder',
    '/homebrew/background-builder', '/homebrew/item-builder', '/homebrew/rare-items', '/homebrew/spell-builder',
    '/homebrew/feature-editor', '/homebrew/feat-builder', '/homebrew/monster-builder', '/homebrew/condition-builder',
    '/homebrew/rule-profile',
  ];

  it.each(creationRoutes)('still offers %s and the route file exists', route => {
    expect(tab).toContain(`route: '${route}'`);
    expect(fs.existsSync(path.join(root, 'app', `${route}.tsx`))).toBe(true);
  });

  it('does not contain the moved Library / Installed Packs panels', () => {
    expect(tab).not.toMatch(/function LibraryPanel|function InstalledPacksPanel|function ViewPackContentsModal/);
    expect(tab).not.toContain('deleteInstalledPack');
  });

  it('the Compendium views contain no creation entry points', () => {
    for (const f of ['src/components/compendium/HomebrewLibraryView.tsx', 'src/components/compendium/InstalledPackagesView.tsx']) {
      const src = read(f);
      expect(src).not.toMatch(/New (Race|Class|Spell|Feat|Item|Monster)/);
      expect(src).not.toContain('CreatePanel');
    }
  });

  it('every library edit route points at an existing builder (I)', () => {
    for (const route of Object.values(EDIT_ROUTES)) {
      expect(fs.existsSync(path.join(root, 'app', `${route}.tsx`))).toBe(true);
    }
  });
});

describe('Official exposure is preserved (L, M)', () => {
  it('Official mode still filters through the central SRD exposure decision', () => {
    const shell = read('app/(tabs)/compendium.tsx');
    expect(shell).toContain('currentContentExposure');
    expect(shell).toContain('isContentExposed');
  });

  it('SRD-only hides non-SRD official content but never homebrew', () => {
    const ctx = { srdOnly: true };
    expect(isContentExposed({ srd: false }, ctx)).toBe(false);
    expect(isContentExposed({}, ctx)).toBe(false);
    expect(isContentExposed({ srd: true }, ctx)).toBe(true);
    expect(isContentExposed({ srd: false, isHomebrew: true }, ctx)).toBe(true);
    const shown = selectExposedContent([{ srd: false }, { srd: true }, { srd: false, isHomebrew: true }], ctx);
    expect(shown).toHaveLength(2);
  });

  it('the Homebrew library view never reads the official content DB for its rows', () => {
    const src = read('src/components/compendium/HomebrewLibraryView.tsx');
    expect(src).not.toContain('globalContentDB');
    expect(src).not.toContain('mergeSpellIndex');
    expect(src).not.toContain('isContentExposed');
  });
});

describe('Character Import remains under Characters (O)', () => {
  it('Characters tab still routes to import-character; the Packages view does not', () => {
    expect(read('app/(tabs)/characters.tsx')).toContain('import-character');
    expect(fs.existsSync(path.join(root, 'app/import-character.tsx'))).toBe(true);
    expect(read('src/components/compendium/InstalledPackagesView.tsx')).not.toContain('import-character');
    expect(read('src/components/compendium/HomebrewLibraryView.tsx')).not.toContain('import-character');
  });
});
