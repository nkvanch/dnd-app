// ============================================================================
// FILE: src/engine/contentPackManifest.ts
// The manifest of an installable content pack, and the provenance every record in one carries.
//
// Grimoire is the engine; packs provide game content. A ruleset (engine behavior and character structure,
// 'dnd5e-2014', 'dnd5e-2024') is a different thing from a pack (content): a campaign on the 2024 ruleset can load
// the SRD 5.2.1 pack together with homebrew packs. This file is schema only: no content, no SRD data.
// Packs use the existing `.grimoire-pack` envelope (engine/backup.ts GrimoirePack); `manifest` is an optional
// member of it, so a pack without one (a user's homebrew export) is still valid and simply has no manifest.
// ============================================================================

export const CONTENT_PACK_MANIFEST_VERSION = 1;

/** Where a record came from. Pack-level provenance (the manifest) and this record-level one answer two questions. */
export type RecordProvenance = {
  kind: 'srd' | 'grimoire' | 'homebrew';
  /** The source family, e.g. '5.1' or '5.2.1' for the System Reference Document. */
  family?: string;
  /** Stable id of the source document, e.g. 'srd-5.2.1'. */
  sourceId?: string;
  /** Where in the source, when known (a section name). */
  sourceLocation?: string;
  /** Set when Grimoire derived or normalized the record rather than copying it (merged spell versions, mastery mappings). */
  derivedBy?: 'grimoire-normalization';
};

export type PackDependency = { id: string; minVersion?: string; reason?: string };

export type ContentPackManifest = {
  manifestVersion: number;
  /** Stable pack id, e.g. 'grimoire.srd.5.2.1'. */
  id: string;
  name: string;
  /** Semantic version of the pack. */
  version: string;
  /** The ruleset the content is written for. */
  ruleset: string;
  sourceFamily: 'SRD_5_1' | 'SRD_5_2_1' | 'HOMEBREW' | string;
  license: string;
  /** The attribution statement the license requires, shown by the app wherever the pack's content is. */
  attribution: string;
  /** SHA-256 over the pack's canonical content (every record and rules table), so an install can be verified. */
  contentHash: string;
  dependencies: PackDependency[];
  /** Pack ids this one supersedes. */
  replaces: string[];
  author: string;
  /** For trust and branding in the UI only; first-party packs use the same install machinery as any other. */
  officialFirstPartyPack: boolean;
  /** How many records of each kind the pack holds. */
  counts: Record<string, number>;
};

const REQUIRED: (keyof ContentPackManifest)[] = [
  'manifestVersion', 'id', 'name', 'version', 'ruleset', 'sourceFamily', 'license', 'attribution', 'contentHash',
  'dependencies', 'replaces', 'author', 'officialFirstPartyPack', 'counts',
];

/** Structural check of a manifest read from a pack file. Returns the problems found (empty = valid). */
export function validateManifest(m: unknown): string[] {
  const errors: string[] = [];
  if (!m || typeof m !== 'object') return ['The manifest is missing.'];
  const o = m as Record<string, unknown>;
  for (const key of REQUIRED) if (!(key in o)) errors.push(`The manifest has no "${key}".`);
  if (typeof o.id === 'string' && !/^[a-z0-9]+(\.[a-z0-9-]+)+$/.test(o.id)) errors.push('The pack id must look like "grimoire.srd.5.2.1".');
  if (typeof o.version === 'string' && !/^\d+\.\d+\.\d+$/.test(o.version)) errors.push('The version must be a semantic version like "1.0.0".');
  if (typeof o.contentHash === 'string' && !/^[0-9a-f]{64}$/.test(o.contentHash)) errors.push('The content hash must be a SHA-256 hex string.');
  if (o.dependencies !== undefined && !Array.isArray(o.dependencies)) errors.push('Dependencies must be a list.');
  return errors;
}

/** Compares semantic versions: negative when a < b. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number), pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0);
  return 0;
}

/** What a character (or campaign) needs installed, as stored in its export instead of copying the content. */
export type RequiredPack = { id: string; minVersion?: string };

/** Canonical JSON: object keys sorted and undefined members dropped, so the same content always hashes the same. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const o = value as Record<string, unknown>;
    return `{${Object.keys(o).filter(k => o[k] !== undefined).sort().map(k => `${JSON.stringify(k)}:${canonicalJson(o[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/** The text a pack's content hash is taken over: every record and the rules tables (not the manifest or the envelope). */
export const packHashInput = (pack: { homebrew?: unknown; rules?: unknown }): string =>
  canonicalJson({ homebrew: pack.homebrew, rules: pack.rules ?? null });
