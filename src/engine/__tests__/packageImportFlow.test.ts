import {
  initialImportMode, isUpdatingInstalledPack, updatingBannerText, importConfirmLabel, ImportMode,
} from '../packageImportFlow';

const installed = { id: 'pkg_understudy', name: 'Understudy Test Pack' };

describe('first import (no installed pack matches)', () => {
  const mode = initialImportMode(null);

  it('is its own state, not an update', () => {
    expect(mode).toBe('new');
    expect(isUpdatingInstalledPack(mode, null)).toBe(false);
  });

  it('shows no "Updating installed pack" text (regression: it used to read Updating installed pack "")', () => {
    expect(updatingBannerText(mode, null)).toBeNull();
  });

  it('says Import / Import All, never Update', () => {
    expect(importConfirmLabel(mode, null, 1)).toBe('Import');
    expect(importConfirmLabel(mode, null, 7)).toBe('Import All');
  });
});

describe('a same-id pack is already installed', () => {
  it('waits for the player to choose (no mode yet)', () => {
    expect(initialImportMode(installed)).toBeNull();
  });

  it('after choosing Update: names the real installed pack and says Update', () => {
    const mode: ImportMode = 'update';
    expect(isUpdatingInstalledPack(mode, installed)).toBe(true);
    expect(updatingBannerText(mode, installed)).toBe('Updating installed pack "Understudy Test Pack"');
    expect(importConfirmLabel(mode, installed, 3)).toBe('Update');
  });

  it('after choosing Install As Separate Copy: an import, not an update', () => {
    const mode: ImportMode = 'copy';
    expect(isUpdatingInstalledPack(mode, installed)).toBe(false);
    expect(updatingBannerText(mode, installed)).toBeNull();
    expect(importConfirmLabel(mode, installed, 3)).toBe('Import All');
  });

  it("an 'update' mode with no target can never render a nameless update banner", () => {
    expect(updatingBannerText('update', null)).toBeNull();
    expect(importConfirmLabel('update', null, 1)).toBe('Import');
  });
});
