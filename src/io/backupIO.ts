// src/io/backupIO.ts
// Export/import for .grimoire-pack backup files (docs/ROADMAP_1.0.md Phase
// 3.2). This is the ONLY way a character survives a lost or reset device —
// there is no cloud backup by design (see docs/PRIVACY_POLICY.md). Export
// writes a file and opens the OS share sheet so the user chooses where it
// goes (their own cloud drive, email to themselves, etc.) — Grimoire itself
// never transmits it anywhere.
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { Entity } from '../engine/types';
import {
  GrimoirePack, GrimoirePackHomebrew, createBackupPack, createContentPack,
  validateGrimoirePack, validatePackContents, countHomebrew,
} from '../engine/backup';
import { ExportAction, saveTextViaSAF } from './exportShare';

/**
 * Exports the given characters plus whichever homebrew content they actually
 * reference to a .grimoire-pack file, then opens the OS share sheet. The
 * caller decides which characters/homebrew to include — see the Settings
 * screen for "back up everything" vs. a future per-character export.
 */
export async function exportBackup(
  characters: Entity[],
  homebrew:   GrimoirePackHomebrew,
  deviceId:   string | null,
): Promise<void> {
  const pack = createBackupPack(
    characters,
    homebrew,
    deviceId,
    Constants.expoConfig?.version ?? '1.0.0',
  );

  const json     = JSON.stringify(pack, null, 2);
  const stamp    = new Date().toISOString().slice(0, 10);
  const filename = `grimoire-backup-${stamp}.grimoire-pack`;
  const uri      = FileSystem.cacheDirectory + filename;

  await FileSystem.writeAsStringAsync(uri, json, { encoding: FileSystem.EncodingType.UTF8 });

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error('Sharing isn\u2019t available on this device. The backup file was written but couldn\u2019t be shared.');
  }
  await Sharing.shareAsync(uri, {
    mimeType:    'application/json',
    dialogTitle: 'Save your Grimoire backup',
  });
}

/**
 * Exports a shareable homebrew content pack (no characters) and opens the OS
 * share sheet — this is how a homebrew item "leaves the device it was
 * authored on." Imports through the exact same generic pack.homebrew loop as
 * a full backup (see app/backup.tsx's handleConfirmImport) since the import
 * side never branches on packType.
 */
export async function exportContentPack(
  homebrew:     GrimoirePackHomebrew,
  deviceId:     string | null,
  filenameHint: string,
  action:       ExportAction = 'share',
): Promise<void> {
  const pack = createContentPack(
    homebrew,
    deviceId,
    Constants.expoConfig?.version ?? '1.0.0',
  );

  const json     = JSON.stringify(pack, null, 2);
  const filename = `${filenameHint}.grimoire-pack`;

  if (action === 'save' && Platform.OS === 'android') {
    await saveTextViaSAF(json, filename, 'application/json', FileSystem.EncodingType.UTF8);
    return;
  }

  const uri = FileSystem.cacheDirectory + filename;
  await FileSystem.writeAsStringAsync(uri, json, { encoding: FileSystem.EncodingType.UTF8 });

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error('Sharing isn’t available on this device. The pack file was written but couldn’t be shared.');
  }
  await Sharing.shareAsync(uri, {
    mimeType:    'application/json',
    dialogTitle: 'Share Grimoire homebrew',
  });
}

export type ImportPreview = {
  pack:            GrimoirePack;
  characterCount:  number;
  homebrewCount:   number;
  /** The picked file's own name, extension stripped — used as the default
   *  display name if this import gets registered as an installed pack
   *  (content-pack imports only, see app/backup.tsx). Never part of the
   *  wire format itself, just local UI context from the file picker. */
  suggestedName:   string;
};

/**
 * Opens the file picker and validates the selected file, but does NOT import
 * yet — returns a preview for the caller to show the user before committing.
 * Matches the "Review Screen" stage in docs/Future/HOMEBREW_IMPORT_PIPELINE.md
 * even in this minimal v1 form: never import silently.
 * Returns null if the user cancels the picker.
 */
export async function pickAndValidateBackup(): Promise<ImportPreview | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: '*/*',   // .grimoire-pack has no registered MIME type — accept broadly
    copyToCacheDirectory: true,
  });
  if (result.canceled || !result.assets?.[0]) return null;

  const content = await FileSystem.readAsStringAsync(result.assets[0].uri);
  let data: unknown;
  try {
    data = JSON.parse(content);
  } catch {
    throw new Error('That file isn\u2019t valid JSON \u2014 is it really a .grimoire-pack file?');
  }

  const problem = validateGrimoirePack(data);
  if (problem) throw new Error(problem);

  const pack = data as GrimoirePack;

  // Bug fix (architecture review C8): validateGrimoirePack above only
  // checks the pack ENVELOPE — it never validated any individual homebrew
  // content item or character feature's structure. A structurally invalid
  // Feature previously imported silently, then crashed the app the moment
  // any screen touching it tried to render (collectAllEffects has no guard
  // against a malformed effects array). Never import silently — same "never
  // import silently" rule pickAndValidateBackup's own doc comment already
  // states for the envelope check.
  const contentProblems = validatePackContents(pack);
  if (contentProblems.length > 0) {
    const shown = contentProblems.slice(0, 5).join('\n');
    const more = contentProblems.length > 5 ? `\n…and ${contentProblems.length - 5} more.` : '';
    throw new Error(`This pack contains invalid content and can't be imported safely:\n${shown}${more}`);
  }
  const rawName = result.assets[0].name ?? 'Imported Pack';
  return {
    pack,
    characterCount: pack.characters.length,
    homebrewCount:  countHomebrew(pack.homebrew),
    suggestedName:  rawName.replace(/\.grimoire-pack$/i, ''),
  };
}
