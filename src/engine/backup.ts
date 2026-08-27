// src/engine/backup.ts
// .grimoire-pack format — the file format for both personal backup/restore
// (Phase 3.2 of docs/ROADMAP_1.0.md) and the future shared homebrew content
// pack import described in docs/Future/HOMEBREW_IMPORT_PIPELINE.md
// ("Package Imports" — .grimoire-pack, "highest import quality, no parsing
// required"). One schema serves both: a personal backup is packType:'backup'
// with characters populated; a future shared content pack is
// packType:'content-pack' with characters empty and just a homebrew payload.
// Designed once now so the bigger import pipeline doesn't need a new file
// format later — exactly what the roadmap asked for.
//
// Note: homebrew feats/monsters are not yet included in GrimoirePackHomebrew's
// fields below, even though homebrewStore now supports both (see saveItem).
// Add feats?/monsters? fields here when the content-pack sharing phase lands.
import { Entity, Race, CharClass, Item, Spell, Background, Feature } from './types';

export const GRIMOIRE_PACK_FORMAT_VERSION = 1;

export type GrimoirePackHomebrew = {
  races?:       Race[];
  classes?:     CharClass[];
  items?:       Item[];
  spells?:      Spell[];
  backgrounds?: Background[];
  features?:    Feature[];
};

export type GrimoirePack = {
  formatVersion: number;              // GRIMOIRE_PACK_FORMAT_VERSION at export time
  packType:      'backup' | 'content-pack';
  createdAt:     number;              // epoch ms
  appVersion:    string;              // Grimoire app.json version, for support/debugging
  deviceId:      string | null;       // provenance — which device created this pack
  /** Full character snapshots. Populated for 'backup', empty for a 'content-pack'. */
  characters:    Entity[];
  /** Homebrew content referenced by the characters above (or, for a future
   *  content-pack, the actual payload being shared). Omitted/empty arrays
   *  mean "none of that type in this pack". */
  homebrew?:     GrimoirePackHomebrew;
};

export function createBackupPack(
  characters: Entity[],
  homebrew:   GrimoirePackHomebrew,
  deviceId:   string | null,
  appVersion: string,
): GrimoirePack {
  return {
    formatVersion: GRIMOIRE_PACK_FORMAT_VERSION,
    packType:      'backup',
    createdAt:     Date.now(),
    appVersion,
    deviceId,
    characters,
    homebrew,
  };
}

/**
 * Basic shape validation before trusting a file as a real pack. Deliberately
 * conservative — reject anything that doesn't look right rather than guess
 * and risk corrupting the store with malformed data. Returns a human-
 * readable reason the file was rejected, or null if it looks valid.
 */
export function validateGrimoirePack(data: unknown): string | null {
  if (typeof data !== 'object' || data === null) {
    return "That doesn't look like a Grimoire pack file.";
  }
  const p = data as Partial<GrimoirePack>;
  if (typeof p.formatVersion !== 'number') {
    return 'Missing or invalid formatVersion — this file may be corrupted.';
  }
  if (p.formatVersion > GRIMOIRE_PACK_FORMAT_VERSION) {
    return `This pack was created by a newer version of Grimoire (format v${p.formatVersion}). Update the app to import it.`;
  }
  if (p.packType !== 'backup' && p.packType !== 'content-pack') {
    return 'Unknown pack type — this file may be corrupted or from a future Grimoire version.';
  }
  if (!Array.isArray(p.characters)) {
    return 'Missing characters list — this file may be corrupted.';
  }
  return null;
}

/** Total homebrew item count across all categories, for the import preview. */
export function countHomebrew(homebrew: GrimoirePackHomebrew | undefined): number {
  if (!homebrew) return 0;
  return Object.values(homebrew).reduce(
    (sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0,
  );
}
