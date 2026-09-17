// src/io/__tests__/packageIO.test.ts
// HOMEBREW-PACKAGE-1 items 13/24/25: first coverage for packageIO.ts,
// mocking expo-file-system/expo-sharing/expo-document-picker/expo-constants
// the same way exportShare.test.ts already established for backupIO's
// sibling file-handling module. Covers what those items specifically ask
// for: meaningful sanitized filenames (item 24, not a generic "export.json"),
// and the file-layer "malformed JSON" rejection (item 13) that
// packageValidation.test.ts can't reach since it only tests already-parsed
// data.
const mockWriteAsStringAsync = jest.fn().mockResolvedValue(undefined);
const mockShareAsync = jest.fn().mockResolvedValue(undefined);
const mockIsAvailableAsync = jest.fn().mockResolvedValue(true);
const mockGetDocumentAsync = jest.fn();
const mockReadAsStringAsync = jest.fn();

jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: '/cache/',
  EncodingType: { UTF8: 'utf8', Base64: 'base64' },
  writeAsStringAsync: (...args: unknown[]) => mockWriteAsStringAsync(...args),
  readAsStringAsync: (...args: unknown[]) => mockReadAsStringAsync(...args),
}));
jest.mock('expo-sharing', () => ({
  isAvailableAsync: () => mockIsAvailableAsync(),
  shareAsync: (...args: unknown[]) => mockShareAsync(...args),
}));
jest.mock('expo-document-picker', () => ({
  getDocumentAsync: (...args: unknown[]) => mockGetDocumentAsync(...args),
}));
jest.mock('expo-constants', () => ({ expoConfig: { version: '1.0.0' } }));

import { exportPackage, pickAndValidatePackage, MAX_PACKAGE_FILE_BYTES } from '../packageIO';
import { GrimoirePackHomebrew, PackageContentRef } from '../../engine/backup';
import type { Race } from '../../engine/types';

beforeEach(() => jest.clearAllMocks());

describe('exportPackage — file naming (item 24)', () => {
  it('sanitizes the package name into a meaningful filename, not a generic "export.json"', async () => {
    const homebrew: GrimoirePackHomebrew = { races: [{ id: 'tideborn', name: 'Tideborn', features: [] } as Race] };
    const contents: PackageContentRef[] = [{ type: 'race', id: 'tideborn', name: 'Tideborn', included: 'selected' }];
    await exportPackage(homebrew, contents, { name: 'Tideborn Collection', packageVersion: '1.2' }, null, 'share');

    expect(mockWriteAsStringAsync).toHaveBeenCalledTimes(1);
    const [uri] = mockWriteAsStringAsync.mock.calls[0];
    expect(uri).toBe('/cache/tideborn-collection.grimoire-pack');
    expect(uri).not.toContain('export.json');

    expect(mockShareAsync).toHaveBeenCalledTimes(1);
    const [sharedUri] = mockShareAsync.mock.calls[0];
    expect(sharedUri).toBe(uri);
  });

  it('sanitizes special characters and mixed case out of the filename', async () => {
    await exportPackage({}, [], { name: '  Amphibious Adept!! (v2) ' }, null, 'share');
    const [uri] = mockWriteAsStringAsync.mock.calls[0];
    expect(uri).toBe('/cache/amphibious-adept-v2.grimoire-pack');
  });

  it('falls back to a non-empty name if sanitizing produces nothing usable', async () => {
    await exportPackage({}, [], { name: '!!!' }, null, 'share');
    const [uri] = mockWriteAsStringAsync.mock.calls[0];
    expect(uri).toBe('/cache/package.grimoire-pack');
  });

  it('throws a clear error when sharing is unavailable, rather than silently no-opping', async () => {
    mockIsAvailableAsync.mockResolvedValue(false);
    await expect(exportPackage({}, [], { name: 'Pack' }, null, 'share')).rejects.toThrow(/[Ss]har/);
  });
});

describe('pickAndValidatePackage — item 13 (file-layer malformed JSON) and item 25 (picker cancel)', () => {
  it('returns null when the user cancels the file picker', async () => {
    mockGetDocumentAsync.mockResolvedValue({ canceled: true });
    const result = await pickAndValidatePackage(new Set(), () => undefined);
    expect(result).toBeNull();
  });

  it('throws a clear, user-facing error for a file that is not valid JSON, before anything is imported', async () => {
    mockGetDocumentAsync.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///pack.grimoire-pack', name: 'pack.grimoire-pack' }] });
    mockReadAsStringAsync.mockResolvedValue('this is not { valid json');
    await expect(pickAndValidatePackage(new Set(), () => undefined))
      .rejects.toThrow(/valid JSON/);
  });

  it('throws with the specific blocking reason(s) for a structurally invalid but parseable package', async () => {
    mockGetDocumentAsync.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///pack.grimoire-pack', name: 'pack.grimoire-pack' }] });
    mockReadAsStringAsync.mockResolvedValue(JSON.stringify({ packType: 'content-pack' })); // missing formatVersion
    await expect(pickAndValidatePackage(new Set(), () => undefined))
      .rejects.toThrow(/formatVersion/);
  });

  it('returns a full preview (pack/validation/conflicts/identical/suggestedName) for a valid package', async () => {
    const race: Race = { id: 'tideborn', name: 'Tideborn', features: [] } as Race;
    const pack = {
      formatVersion: 1, packType: 'content-pack', createdAt: 0, appVersion: '1.0.0', deviceId: null,
      characters: [], homebrew: { races: [race] }, name: 'Tideborn Collection',
    };
    mockGetDocumentAsync.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///pack.grimoire-pack', name: 'pack.grimoire-pack' }] });
    mockReadAsStringAsync.mockResolvedValue(JSON.stringify(pack));

    // A DIFFERENT local item (name changed) — a real conflict, not an
    // identical-skip, exercising the same path detectConflictsDetailed uses.
    const localLookup = (ref: { type: string; id: string }) => (ref.type === 'race' && ref.id === 'tideborn') ? ({ ...race, name: 'Tideborn (local)' } as never) : undefined;
    const result = await pickAndValidatePackage(new Set(['dnd5e-2014']), localLookup);

    expect(result).not.toBeNull();
    expect(result!.suggestedName).toBe('Tideborn Collection');
    expect(result!.validation.blocking).toEqual([]);
    expect(result!.conflicts).toEqual([{ type: 'race', id: 'tideborn', localName: 'Tideborn (local)', incomingName: 'Tideborn' }]);
    expect(result!.identical).toEqual([]);
  });

  // Item 36: oversized/pathological file rejection, checked BEFORE
  // JSON.parse ever touches the raw content.
  it('rejects a file larger than MAX_PACKAGE_FILE_BYTES before parsing it', async () => {
    mockGetDocumentAsync.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///huge.grimoire-pack', name: 'huge.grimoire-pack' }] });
    mockReadAsStringAsync.mockResolvedValue('x'.repeat(MAX_PACKAGE_FILE_BYTES + 1));
    await expect(pickAndValidatePackage(new Set(), () => undefined))
      .rejects.toThrow(/larger than/);
  });

  it('reports an identical local match separately from conflicts (item 17)', async () => {
    const race: Race = { id: 'tideborn', name: 'Tideborn', features: [] } as Race;
    const pack = {
      formatVersion: 1, packType: 'content-pack', createdAt: 0, appVersion: '1.0.0', deviceId: null,
      characters: [], homebrew: { races: [race] }, name: 'Tideborn Collection',
    };
    mockGetDocumentAsync.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///pack.grimoire-pack', name: 'pack.grimoire-pack' }] });
    mockReadAsStringAsync.mockResolvedValue(JSON.stringify(pack));

    // The SAME local item, byte-for-byte.
    const localLookup = (ref: { type: string; id: string }) => (ref.type === 'race' && ref.id === 'tideborn') ? ({ ...race } as never) : undefined;
    const result = await pickAndValidatePackage(new Set(['dnd5e-2014']), localLookup);

    expect(result!.conflicts).toEqual([]);
    expect(result!.identical).toEqual([{ type: 'race', id: 'tideborn', localName: 'Tideborn', incomingName: 'Tideborn' }]);
  });
});
