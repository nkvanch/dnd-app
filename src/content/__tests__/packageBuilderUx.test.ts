// Product-level checks for the three export concepts and where they live.
//   Export Character  one character (Characters / character sheet)
//   Export Homebrew   one Homebrew entry + what it requires (Compendium -> Homebrew)
//   Export Package    several chosen entries (Compendium -> Packages -> Create Package)
import * as fs from 'fs';
import * as path from 'path';
import { exportFormatsFor } from '../../io/exportFormats';

const root = path.resolve(__dirname, '../../..');
const read = (rel: string) => fs.readFileSync(path.join(root, rel), 'utf8');

describe('Export labels (D, E)', () => {
  it('a Homebrew export offers "Export Homebrew", never a Character file', () => {
    const formats = exportFormatsFor('homebrew');
    expect(formats[0]).toMatchObject({ id: 'pack', label: expect.stringContaining('Export Homebrew') });
    expect(formats.map(f => f.id)).not.toContain('character-json');
    for (const f of formats) expect(`${f.label} ${f.hint}`).not.toMatch(/Grimoire Character|Export Character/);
  });

  it('a character export offers "Export Character", never a Homebrew package', () => {
    const formats = exportFormatsFor('character');
    expect(formats[0]).toMatchObject({ id: 'character-json', label: expect.stringContaining('Export Character') });
    expect(formats.map(f => f.id)).not.toContain('pack');
    for (const f of formats) expect(f.label).not.toMatch(/Export Homebrew/);
  });

  it('both kinds keep the three readable copies, clearly marked as not importable', () => {
    for (const kind of ['homebrew', 'character'] as const) {
      const readable = exportFormatsFor(kind).slice(1);
      expect(readable.map(f => f.id)).toEqual(['pdf', 'md', 'txt']);
      for (const f of readable) expect(f.hint).toMatch(/not importable/);
    }
  });

  it('no "Grimoire Character" export label survives anywhere in the export UI code', () => {
    for (const f of [
      'src/io/exportFormats.ts', 'src/components/ExportFormatSheet.tsx', 'src/components/homebrew/HomebrewExportModal.tsx',
      'src/components/compendium/HomebrewLibraryView.tsx', 'app/homebrew/package-builder.tsx',
    ]) expect(read(f)).not.toContain('Grimoire Character');
  });

  it('the Homebrew library and the character sheet each pass the right kind to the sheet', () => {
    expect(read('src/components/compendium/HomebrewLibraryView.tsx')).toMatch(/<ExportFormatSheet[^>]*\n?\s*visible=\{!!exportTarget\}\s*\n\s*kind="homebrew"/);
    expect(read('app/sheet/[id].tsx')).toMatch(/<ExportFormatSheet\s*\n\s*visible=\{exportSheetOpen\}\s*\n\s*kind="character"/);
  });

  it('the generic "Export" labels are gone: entry export, package export and the sheet menu say what they export', () => {
    expect(read('app/sheet/[id].tsx')).toContain('label="Export Character"');
    const library = read('src/components/compendium/HomebrewLibraryView.tsx');
    expect(library).toContain('accessibilityLabel="Export Homebrew"');
    expect(library).not.toContain('Export portable homebrew package');
    expect(library).toContain('Create Package →');
    expect(read('src/components/compendium/InstalledPackagesView.tsx')).toContain('accessibilityLabel="Export Package"');
    expect(read('app/homebrew/package-builder.tsx')).toContain('Export Package');
  });

  it('Homebrew export never goes through character serialization', () => {
    for (const f of ['src/components/homebrew/HomebrewExportModal.tsx', 'app/homebrew/package-builder.tsx']) {
      const src = read(f);
      expect(src).not.toMatch(/serializePortableCharacter|characterPortable|exportCharacter/);
    }
  });
});

describe('Where each export lives (Compendium integration)', () => {
  it('Homebrew mode: each entry has Export Homebrew; there is no creation there', () => {
    const lib = read('src/components/compendium/HomebrewLibraryView.tsx');
    expect(lib).toContain('HomebrewExportModal');
    expect(lib).not.toMatch(/New (Race|Class|Spell|Feat|Item|Monster)|CreatePanel/);
  });

  it('Packages mode: Create Package opens the builder; an installed package exports through it', () => {
    const view = read('src/components/compendium/InstalledPackagesView.tsx');
    expect(view).toContain("router.push('/homebrew/package-builder')");
    expect(view).toContain('testID="packages-create"');
    expect(view).toContain("step: 'review'");
    expect(read('app/_layout.tsx')).toContain('name="homebrew/package-builder"');
    expect(fs.existsSync(path.join(root, 'app/homebrew/package-builder.tsx'))).toBe(true);
  });

  it('the Homebrew tab still owns creation and does not host the builder', () => {
    const tab = read('app/(tabs)/homebrew.tsx');
    expect(tab).toContain("route: '/homebrew/feat-builder'");
    expect(tab).not.toMatch(/package-builder|PackageBuilder/);
  });

  it('the old one-at-a-time package modal is gone', () => {
    expect(fs.existsSync(path.join(root, 'src/components/homebrew/PackageExportModal.tsx'))).toBe(false);
    for (const f of ['src/components/compendium/HomebrewLibraryView.tsx', 'src/components/compendium/InstalledPackagesView.tsx']) {
      expect(read(f)).not.toContain('PackageExportModal');
    }
  });

  it('the package builder makes the selected/dependency/total counts visible in review', () => {
    const src = read('app/homebrew/package-builder.tsx');
    for (const label of ['Selected by you', 'Required dependencies', 'Total exported', 'INCLUDED AUTOMATICALLY', 'Review Package']) {
      expect(src).toContain(label);
    }
  });

  it('the import screen previews grouped content and offers Import All', () => {
    const src = read('app/homebrew/import-package.tsx');
    expect(src).toContain('groupPackContents');
    // The confirm-button wording now lives in the pure import-flow model (engine/packageImportFlow.ts) the screen calls.
    expect(src).toContain('importConfirmLabel');
    expect(read('src/engine/packageImportFlow.ts')).toContain('Import All');
    expect(src).toContain('INCLUDED AUTOMATICALLY');
  });
});

describe('Maestro flows', () => {
  it('the safe (preserve-state) suite only opens the export options and never a file dialog', () => {
    const y = read('.maestro/preserve-state/compendium-modes.yaml');
    expect(y).toContain('export-format-pack');
    expect(y).toContain('assertNotVisible: { id: export-format-character-json }');
    expect(y).not.toMatch(/package-export-(save|share)|Save File|package-builder/);
    expect(y).not.toMatch(/clearState/);
  });

  it('the disposable suite covers package assembly up to (not including) the file save', () => {
    const y = read('.maestro/disposable/package-builder.yaml');
    for (const token of ['packages-create', 'package-builder-review', 'package-count-selected', 'package-export-share', 'package-export-save']) {
      expect(y).toContain(token);
    }
  });
});
