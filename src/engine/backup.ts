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
import { Entity, Race, Subrace, CharClass, HomebrewSubclass, Item, Spell, Background, Feature, Feat, Condition, RulesetId } from './types';
import { MonsterTemplate } from '../content/monsters/types';
import { ContentCacheType } from '../db/contentCacheRepo';
import { validateContent, validateFeature, validateEntityShape } from './homebrewValidator';
import { migrateEntity } from './multiclass';

export const GRIMOIRE_PACK_FORMAT_VERSION = 1;
// HOMEBREW-PACKAGE-1: the CONTENT (not envelope) schema version — bumped
// only when GrimoirePackHomebrew's per-type item SHAPE changes in a way an
// importer needs to know about (a migration point), independent of
// formatVersion (the envelope/container shape) and independent of
// packageVersion (an author's own version string for one specific
// package). Distinct concepts, deliberately not conflated — see this
// file's own header comment on why one schema serves both backup and
// content-pack use cases.
export const HOMEBREW_SCHEMA_VERSION = 1;

export type GrimoirePackHomebrew = {
  races?:       Race[];
  subraces?:    Subrace[];
  classes?:     CharClass[];
  subclasses?:  HomebrewSubclass[];
  items?:       Item[];
  spells?:      Spell[];
  backgrounds?: Background[];
  features?:    Feature[];
  feats?:       Feat[];
  monsters?:    MonsterTemplate[];
  conditions?:  Condition[];
};

/**
 * One entry in a package's manifest (GrimoirePack.contents) — a lightweight
 * {type, id} index of everything actually bundled, letting an import preview
 * (or a dependency-closure computation) answer "what's in this package"
 * without deep-scanning every homebrew array. `included` distinguishes what
 * the exporting user actually picked from what was pulled in automatically
 * to keep the package self-contained — see contentDependencies.ts.
 */
export type PackageContentRef = {
  type:       ContentCacheType;
  id:         string;
  name:       string;
  rulesetId?: RulesetId;
  included:   'selected' | 'dependency';
};

/** Reserved for future local-asset packaging (thumbnails, reference images)
 *  — see contentDependencies.ts / homebrew builders' existing imageUri
 *  fields. Always empty today; the shape exists now so the file FORMAT
 *  never needs to change when media support actually ships, only this
 *  array needs to start being populated. `data` is a base64 payload,
 *  mirroring Item.imageUri's own existing "store the bytes inline as a
 *  data: URI" convention (see item-builder.tsx) rather than a second,
 *  new asset-reference scheme. */
export type PackageMediaAsset = {
  id:       string;
  kind:     'thumbnail' | 'image';
  filename: string;
  mimeType: string;
  data?:    string;
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

  // ── HOMEBREW-PACKAGE-1: package-specific metadata ──────────────────────
  // All optional and ONLY ever set for packType:'content-pack' packages
  // built via the new package-export flow (see src/io/packageIO.ts) — a
  // personal 'backup' pack, and any content-pack exported through the
  // older single-item exportHomebrewItem() path, simply omit these, and
  // every consumer (validateGrimoirePack, the import commit flow) already
  // treats their absence as "no package metadata available," never as
  // malformed. This is what keeps the format backward- AND forward-
  // compatible without a formatVersion bump: an old app reading a new
  // package ignores fields it doesn't know about; a new app reading an
  // old pack (or a personal backup) just sees them as absent.
  schemaVersion?:       number;         // HOMEBREW_SCHEMA_VERSION at export time
  packageId?:           string;         // stable id for THIS exported package, independent of any content item's own id
  name?:                string;         // package display name (user-facing, distinct from any single content item's name)
  packageVersion?:      string;         // author-controlled version string for this package, distinct from formatVersion/schemaVersion
  author?:               string;
  description?:          string;
  modifiedAt?:            number;        // epoch ms — set when a package is re-exported after being updated
  /** Every ruleset actually represented among this package's contents —
   *  derived at export time from each item's own rulesetId (see
   *  contentDependencies.ts), never asserted independently of the real
   *  content. A package with untagged (ruleset-agnostic) content only has
   *  an empty array here, not a fabricated "universal" tag. */
  compatibleRulesets?: RulesetId[];
  /** Manifest of every content item actually bundled in `homebrew` above —
   *  redundant with homebrew's own arrays in WHAT is included, but adds
   *  the type/name/rulesetId/included-reason index an import preview needs
   *  without deep-scanning. */
  contents?:            PackageContentRef[];
  media?:                PackageMediaAsset[];
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

/** A shareable homebrew content pack — no characters, just the payload. */
export function createContentPack(
  homebrew:   GrimoirePackHomebrew,
  deviceId:   string | null,
  appVersion: string,
): GrimoirePack {
  return {
    formatVersion: GRIMOIRE_PACK_FORMAT_VERSION,
    packType:      'content-pack',
    createdAt:     Date.now(),
    appVersion,
    deviceId,
    characters:    [],
    homebrew,
  };
}

export type PackageMeta = {
  name:            string;
  author?:         string;
  description?:    string;
  packageVersion?: string;
};

/**
 * HOMEBREW-PACKAGE-1: the richer sibling to createContentPack() used by the
 * new dependency-aware package export flow (src/io/packageIO.ts) — adds the
 * package-level metadata/manifest fields (see GrimoirePack's own doc
 * comment on why these are new, all-optional fields rather than a
 * formatVersion bump). createContentPack() itself stays untouched and is
 * still what the Library's existing single-item "Export → pack format"
 * button (exportHomebrewItem in exportShare.ts) uses — that path has no
 * user-authored package metadata to attach, so the plain envelope is the
 * right, honest shape for it; this function is for the NEW multi-item
 * "Export Selected" / "Export Pack" flows, which do.
 */
export function createPackageContentPack(
  homebrew:   GrimoirePackHomebrew,
  contents:   PackageContentRef[],
  meta:       PackageMeta,
  deviceId:   string | null,
  appVersion: string,
): GrimoirePack {
  const compatibleRulesets = Array.from(new Set(contents.map(c => c.rulesetId).filter((r): r is NonNullable<typeof r> => !!r)));
  return {
    formatVersion:  GRIMOIRE_PACK_FORMAT_VERSION,
    schemaVersion:  HOMEBREW_SCHEMA_VERSION,
    packType:       'content-pack',
    createdAt:      Date.now(),
    modifiedAt:     Date.now(),
    appVersion,
    deviceId,
    characters:     [],
    homebrew,
    packageId:      `pkg_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    name:           meta.name,
    author:         meta.author,
    description:    meta.description,
    packageVersion: meta.packageVersion,
    compatibleRulesets,
    contents,
    media:          [],
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

/**
 * Bug fix (architecture review C8): validateGrimoirePack above only checks
 * the pack ENVELOPE (formatVersion/packType/characters is an array) — it
 * never validated any individual homebrew content item's structure, even
 * though homebrewValidator.ts's per-type validators exist and are already
 * used by every in-app authoring form. A structurally invalid Feature (e.g.
 * one missing its `effects` array) previously imported silently, then threw
 * inside collectAllEffects (pipeline.ts) the moment any screen touching the
 * character that carries it tried to render — with no per-character error
 * isolation (see ErrorBoundary.tsx), a single malformed import could crash
 * the entire app on every subsequent launch.
 *
 * Checks every homebrew content item via validateContent, and every
 * character's own embedded features (entity.features and
 * entity.inventory.equipped[].features — precisely the two arrays
 * collectAllEffects walks) via validateFeature. Only hard ERRORS block the
 * import; warnings are the same "advisory, not blocking" signal every
 * builder form already treats them as — surfacing a per-item warning
 * dialog for a multi-item pack import isn't practical the way it is for a
 * single-item builder save.
 *
 * Returns a list of human-readable problems — empty means the pack's
 * content is structurally sound and safe to commit.
 */
export function validatePackContents(pack: GrimoirePack): string[] {
  const problems: string[] = [];

  const CONTENT_CHECKS: { key: keyof GrimoirePackHomebrew; type: Parameters<typeof validateContent>[0] }[] = [
    { key: 'races',       type: 'race' },
    { key: 'subraces',    type: 'subrace' },
    { key: 'classes',     type: 'class' },
    { key: 'subclasses',  type: 'subclass' },
    { key: 'items',       type: 'item' },
    { key: 'spells',      type: 'spell' },
    { key: 'backgrounds', type: 'background' },
    { key: 'features',    type: 'feature' },
    { key: 'feats',       type: 'feat' },
    { key: 'monsters',    type: 'monster' },
    { key: 'conditions',  type: 'condition' },
  ];
  const hb = pack.homebrew;
  if (hb) {
    for (const { key, type } of CONTENT_CHECKS) {
      const raw = hb[key];
      if (!Array.isArray(raw)) continue;
      const items = raw as { id?: string; name?: string }[];
      for (const item of items) {
        const { valid, errors } = validateContent(type, item);
        if (!valid) {
          const label = item?.id ?? item?.name ?? '(unknown)';
          problems.push(`${type} "${label}": ${errors.join('; ')}`);
        }
      }
    }
  }

  for (const entity of (Array.isArray(pack.characters) ? pack.characters : [])) {
    const name = entity.identity?.name || entity.id || '(unnamed character)';
    // Re-audit A07: reject a structurally malformed character outright — a
    // payload like {id, identity.name, features} previously passed every
    // check this function ran (only feature-array CONTENTS were checked,
    // never whether identity/stats/resources/inventory/spellcasting even
    // exist) and could reach persistence, where it would either silently
    // misbehave or throw somewhere far from this validation boundary.
    let migrated: Entity;
    try { migrated = migrateEntity(entity); }
    catch (error) {
      problems.push(`character "${name}": migration failed: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }
    const shape = validateEntityShape(migrated);
    if (!shape.valid) {
      problems.push(`character "${name}": ${shape.errors.join('; ')}`);
      continue; // malformed structurally — checking its feature arrays below would be redundant/unsafe
    }
    // Defensively guard against the arrays themselves being malformed (not
    // just absent) — this function's whole job is to validate untrusted
    // external data, so it can't assume even the container shapes are sound.
    const equippedRaw = entity.inventory?.equipped;
    const equipped = Array.isArray(equippedRaw) ? equippedRaw : [];
    const featureArrays: [string, unknown[]][] = [
      ['features', Array.isArray(entity.features) ? entity.features : []],
      ['equipped item features', equipped.flatMap(i => Array.isArray(i?.features) ? i.features : [])],
    ];
    for (const [label, features] of featureArrays) {
      for (const [i, f] of features.entries()) {
        const { valid, errors } = validateFeature(f, `${label}[${i}]`);
        if (!valid) problems.push(`character "${name}" ${label}[${i}]: ${errors.join('; ')}`);
      }
    }
  }

  return problems;
}

/** Total homebrew item count across all categories, for the import preview. */
export function countHomebrew(homebrew: GrimoirePackHomebrew | undefined): number {
  if (!homebrew) return 0;
  return Object.values(homebrew).reduce(
    (sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0,
  );
}
