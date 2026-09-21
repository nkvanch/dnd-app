// src/io/packageIO.ts
// HOMEBREW-PACKAGE-1: file-system glue for the new dependency-aware
// package export/import flow — deliberately a THIN wrapper. Every actual
// decision (dependency closure, conflict detection, id-remap/reference
// rewriting, ruleset/missing-dependency diagnostics) lives in the pure,
// directly-unit-tested engine files (contentDependencies.ts,
// packageConflicts.ts, packageValidation.ts) that don't import any RN/expo
// module — only THIS file touches expo-file-system/expo-sharing/expo-
// document-picker, mirroring backupIO.ts's own file-read/write/share
// pattern exactly (same expo-file-system/legacy subpath, same
// write→share/SAF, same pick→read→JSON.parse→validate→preview shape) so
// there are not two different file-handling conventions in the app.
import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import {
  GrimoirePack, GrimoirePackHomebrew, PackageContentRef, PackageMeta,
  createPackageContentPack,
} from '../engine/backup';
import { ExportAction, saveTextViaSAF } from './exportShare';
import { validatePackageForImport, PackageValidationResult } from '../engine/packageValidation';
import { detectConflictsDetailed, PackageConflict } from '../engine/packageConflicts';
import { DependencyRef } from '../engine/contentDependencies';
import { HomebrewContent } from '../db/contentCacheRepo';
import { identifyGrimoireImport, WRONG_HOMEBREW_IMPORTER_MESSAGE } from './importEnvelope';

function sanitize(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'package';
}

// HOMEBREW-PACKAGE-1 item 36: a real ceiling on the RAW FILE size read off
// disk, checked before JSON.parse ever runs on it — this is the format's
// analog of a ZIP importer's "limit decompressed size" rule (this format has
// no compression/decompression step, so the file's own byte size IS the
// relevant number). 25MB is far above any real package (a full class +
// every subclass + every spell it grants, hand-authored, is low hundreds of
// KB) while still being a real, enforced bound.
export const MAX_PACKAGE_FILE_BYTES = 25 * 1024 * 1024;

/**
 * Builds and shares (or SAF-saves) a dependency-aware homebrew package. Used by both Export Homebrew
 * (one entry + its requirements) and Export Package (many entries + their requirements).
 * `homebrew`/`contents` are already the FULL closure (selection + any
 * required dependencies) — computed by the caller via
 * contentDependencies.ts's buildDependencyClosure BEFORE calling this,
 * since that's a UI-visible decision (the dependency-preview screen lets
 * the player choose to omit them) this file shouldn't make silently.
 */
export async function exportPackage(
  homebrew:   GrimoirePackHomebrew,
  contents:   PackageContentRef[],
  meta:       PackageMeta,
  deviceId:   string | null,
  action:     ExportAction = 'share',
  /** Optional file-name stem; defaults to the package name. */
  filenameHint?: string,
): Promise<void> {
  const pack = createPackageContentPack(homebrew, contents, meta, deviceId, Constants.expoConfig?.version ?? '1.0.0');
  const json = JSON.stringify(pack, null, 2);
  const filename = `${sanitize(filenameHint ?? meta.name)}.grimoire-pack`;

  if (action === 'save' && Platform.OS === 'android') {
    await saveTextViaSAF(json, filename, 'application/json', FileSystem.EncodingType.UTF8);
    return;
  }
  const uri = FileSystem.cacheDirectory + filename;
  await FileSystem.writeAsStringAsync(uri, json, { encoding: FileSystem.EncodingType.UTF8 });
  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error('Sharing isn’t available on this device. The package file was written but couldn’t be shared.');
  }
  await Sharing.shareAsync(uri, { mimeType: 'application/json', dialogTitle: `Share "${meta.name}"` });
}

export type PackageImportPreview = {
  pack:         GrimoirePack;
  validation:   PackageValidationResult;
  conflicts:    PackageConflict[];
  /** Item 17: same {type,id} match as `conflicts`, but the local and
   *  incoming content are byte-for-byte identical — these need no user
   *  decision and are always skipped on import, never shown as a
   *  Keep/Replace/Copy choice. */
  identical:    PackageConflict[];
  suggestedName: string;
};

/**
 * Opens the file picker, reads + JSON-parses the file, and runs the full
 * validation/conflict-detection pass — but does NOT import anything yet.
 * Mirrors pickAndValidateBackup()'s own "never import silently" rule
 * exactly, just with the richer package-specific diagnostics. Returns null
 * if the user cancels the picker.
 */
export async function pickAndValidatePackage(
  knownRulesetIds: Set<string>,
  localLookup:     (ref: DependencyRef) => (HomebrewContent & { rulesetId?: string }) | undefined,
): Promise<PackageImportPreview | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
  if (result.canceled || !result.assets?.[0]) return null;

  const content = await FileSystem.readAsStringAsync(result.assets[0].uri);
  if (content.length > MAX_PACKAGE_FILE_BYTES) {
    throw new Error(`That file is ${Math.round(content.length / 1024 / 1024)}MB, which is larger than a real homebrew package should be (limit: ${Math.round(MAX_PACKAGE_FILE_BYTES / 1024 / 1024)}MB). It may be corrupted.`);
  }
  let data: unknown;
  try {
    data = JSON.parse(content);
  } catch {
    throw new Error('That file isn’t valid JSON — is it really a .grimoire-pack file?');
  }

  if (identifyGrimoireImport(data) === 'character') throw new Error(WRONG_HOMEBREW_IMPORTER_MESSAGE);

  const validation = validatePackageForImport(data, knownRulesetIds, localLookup);
  if (validation.blocking.length > 0) {
    const shown = validation.blocking.slice(0, 5).join('\n');
    const more = validation.blocking.length > 5 ? `\n…and ${validation.blocking.length - 5} more.` : '';
    throw new Error(`This package can’t be imported:\n${shown}${more}`);
  }

  const pack = data as GrimoirePack;
  // Reuse the SAME {type,id}-keyed full-item lookup already used for
  // dependency-closure resolution above — a real equality check (item 17)
  // needs the whole local item, not just its display name, so there's no
  // longer a separate name-only lookup to keep in sync with this one.
  const { conflicts, identical } = detectConflictsDetailed(pack.homebrew, (type, id) => localLookup({ type, id }));
  const rawName = result.assets[0].name ?? pack.name ?? 'Imported Package';
  return {
    pack,
    validation,
    conflicts,
    identical,
    suggestedName: pack.name ?? rawName.replace(/\.grimoire-pack$/i, ''),
  };
}
