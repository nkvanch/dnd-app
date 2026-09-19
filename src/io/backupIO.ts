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
import { migrateEntity } from '../engine/multiclass';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { Entity } from '../engine/types';
import {
  GrimoirePack, GrimoirePackHomebrew, createBackupPack, createContentPack,
  validateGrimoirePack, validatePackContents, countHomebrew,
} from '../engine/backup';
import { ExportAction, saveTextViaSAF } from './exportShare';
import { EntityMeta } from '../db/entityRepo';

/**
 * Returns the display names of characters this pack would overwrite with an
 * OLDER copy than what's already on this device. Entity carries no
 * timestamp of its own (see GrimoirePack.createdAt's doc comment), so this
 * compares the pack's overall createdAt against each LOCAL character's own
 * SQLite updatedAt — a character not present locally is never "stale"
 * (nothing to lose). A pure comparison, extracted specifically so it's
 * unit-testable without a screen render harness (audit finding BACKUP-1).
 */
export function findStaleCharacterOverwrites(pack: GrimoirePack, localMeta: EntityMeta[]): string[] {
  const localById = new Map(localMeta.map(m => [m.id, m]));
  return pack.characters
    .filter(c => (localById.get(c.id)?.updatedAt ?? 0) > pack.createdAt)
    .map(c => c.identity.name || c.id);
}

const HOMEBREW_CATEGORIES = [
  'races', 'subraces', 'classes', 'subclasses', 'items', 'spells',
  'backgrounds', 'features', 'feats', 'monsters', 'conditions',
] as const satisfies readonly (keyof GrimoirePackHomebrew)[];

export type HomebrewIdCollision = { type: string; id: string; incomingName: string; localName: string };

/**
 * Returns every {type, id} an incoming pack shares with content ALREADY
 * present on this device — whether that local content came from a
 * different installed pack (already covered by packDiagnostics.ts's
 * pack_content_shadowed check) or was hand-authored locally, never tracked
 * by any pack (NOT covered by that check — the actual gap, since homebrew
 * ids are unnamespaced name-slugs with no uniqueness guarantee across
 * authors/devices). Importing silently overwrites a same-id local item
 * with the incoming one; this surfaces that before it happens instead of
 * only after, via content_cache_history (audit finding INV-2).
 */
export function findHomebrewIdCollisions(
  incoming: GrimoirePackHomebrew,
  local:    GrimoirePackHomebrew,
): HomebrewIdCollision[] {
  const collisions: HomebrewIdCollision[] = [];
  for (const type of HOMEBREW_CATEGORIES) {
    const localById = new Map((local[type] ?? []).map(item => [item.id, item.name]));
    for (const item of incoming[type] ?? []) {
      const localName = localById.get(item.id);
      if (localName !== undefined) {
        collisions.push({ type, id: item.id, incomingName: item.name, localName });
      }
    }
  }
  return collisions;
}

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
export function prepareImportedPack(data: unknown): GrimoirePack {
  const problem = validateGrimoirePack(data);
  if (problem) throw new Error(problem);
  const parsedPack = data as GrimoirePack;
  const pack: GrimoirePack = { ...parsedPack, characters: parsedPack.characters.map(migrateEntity) };
  const contentProblems = validatePackContents(pack);
  if (contentProblems.length > 0) {
    const shown = contentProblems.slice(0, 5).join('\n');
    const more = contentProblems.length > 5 ? `\n…and ${contentProblems.length - 5} more.` : '';
    throw new Error(`This pack contains invalid content and can't be imported safely:\n${shown}${more}`);
  }
  return pack;
}

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

  const pack = prepareImportedPack(data);

  const rawName = result.assets[0].name ?? 'Imported Pack';
  return {
    pack,
    characterCount: pack.characters.length,
    homebrewCount:  countHomebrew(pack.homebrew),
    suggestedName:  rawName.replace(/\.grimoire-pack$/i, ''),
  };
}
