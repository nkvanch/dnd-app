// src/engine/packageValidation.ts
// HOMEBREW-PACKAGE-1: import-time validation for a homebrew package,
// producing the richer Issue[]-shaped diagnostics the import preview shows
// (unsupported ruleset, missing dependency, duplicate id, corrupt/
// incompatible envelope) — distinct from validateGrimoirePack/
// validatePackContents (backup.ts), which stay exactly as they are and
// still gate app/backup.tsx's plain personal-backup flow. This file is
// specifically for the richer package-import preview (src/io/packageIO.ts).
import { GrimoirePack, HOMEBREW_SCHEMA_VERSION, GrimoirePackHomebrew } from './backup';
import { Issue } from './types';
import { HomebrewContent } from '../db/contentCacheRepo';
import { validateGrimoirePack, validatePackContents } from './backup';
import { findDuplicateIdsInPackage, flattenPackageContents } from './packageConflicts';
import { buildDependencyClosure, DependencyRef } from './contentDependencies';

const KNOWN_HOMEBREW_KEYS: Set<keyof GrimoirePackHomebrew> = new Set([
  'races', 'subraces', 'classes', 'subclasses', 'spells', 'backgrounds', 'features', 'items', 'feats', 'monsters', 'conditions',
]);

// HOMEBREW-PACKAGE-1 item 36: a generous but real ceiling on the number of
// content entries a single package may contain — protects against a
// pathological/corrupted file (or a deliberately hostile one) forcing the
// import preview to build a dependency closure and diff every entry against
// the local library for tens of thousands of rows on a mobile device. Actual
// real packages (even a full class + all subclasses + every spell it grants)
// are in the tens to low hundreds of entries — 2000 is comfortably above any
// legitimate use case sampled in this codebase's own content directories
// while still being a real, enforced bound, not a token gesture.
export const MAX_PACKAGE_CONTENT_ENTRIES = 2000;

export type PackageValidationResult = {
  /** Non-empty means the package is corrupt/unsafe and CANNOT be imported
   *  at all — the same "never mutate the library" rule pickAndValidateBackup
   *  already enforces for personal backups. */
  blocking: string[];
  /** HOMEBREW-PACKAGE-1 item 27: the SAME blocking failures as `blocking`
   *  above, structured as Issues (package_incompatible_version for a
   *  too-new formatVersion/schemaVersion, package_corrupt for every other
   *  structural failure — malformed envelope, unrecognized content type,
   *  duplicate ids, malformed content, invalid reference structure) —
   *  `blocking`'s plain strings stay the primary "can't import, here's
   *  why" surface (what pickAndValidatePackage's thrown error uses); this
   *  is the structured-diagnostics form for anything that wants to work
   *  with Issue objects instead of raw strings. Always empty when
   *  `blocking` is empty. */
  blockingIssues: Issue[];
  /** Non-blocking — shown in the import preview, doesn't prevent import. */
  issues: Issue[];
};

/**
 * `knownRulesetIds` — every RulesetId this app build recognizes (from the
 * ruleset registry, src/content/rulesets.ts). `localLookup` resolves
 * whether a {type,id} already exists locally (used both to check
 * dependency resolution and, separately, by detectConflicts). Pure — no
 * platform/file-system access, so this is directly unit-testable.
 */
export function validatePackageForImport(
  data:            unknown,
  knownRulesetIds: Set<string>,
  localLookup:     (ref: DependencyRef) => (HomebrewContent & { rulesetId?: string }) | undefined,
): PackageValidationResult {
  const blocking: string[] = [];

  const envelopeError = validateGrimoirePack(data);
  if (envelopeError) {
    // validateGrimoirePack (backup.ts, shared with the plain-backup flow)
    // covers several distinct failure kinds in one string return — a
    // too-new formatVersion is a version-incompatibility, everything else
    // (missing fields, wrong types, unknown packType) is structural
    // corruption. Distinguished here by the one message that's actually
    // version-specific, so the structured code matches the real cause.
    const isVersionError = envelopeError.includes('newer version of Grimoire');
    return {
      blocking: [envelopeError],
      blockingIssues: [{ severity: 'error', code: isVersionError ? 'package_incompatible_version' : 'package_corrupt', message: envelopeError }],
      issues: [],
    };
  }
  const pack = data as GrimoirePack;

  // HOMEBREW-PACKAGE-1 item 13/23: schemaVersion is genuinely checked here
  // (not just set-and-ignored) — same "reject only NEWER than supported"
  // rule GRIMOIRE_PACK_FORMAT_VERSION's own check already uses. Missing
  // entirely is accepted (older packages, and the single-item
  // createContentPack() path, never set it — treating absence as "predates
  // this concept," not "corrupt," mirrors formatVersion's own tolerance).
  if (typeof pack.schemaVersion === 'number' && pack.schemaVersion > HOMEBREW_SCHEMA_VERSION) {
    const msg = `This package's content schema (v${pack.schemaVersion}) is newer than this app understands (v${HOMEBREW_SCHEMA_VERSION}). Update the app to import it.`;
    return { blocking: [msg], blockingIssues: [{ severity: 'error', code: 'package_incompatible_version', message: msg }], issues: [] };
  }

  // Item 13: an unrecognized content-category key (e.g. from a future
  // Grimoire version, or a corrupted/hand-edited file) — previously
  // silently ignored by flattenPackageContents' fixed known-key list.
  // Flagged here explicitly rather than importing everything else while
  // quietly dropping whatever content lived under that key.
  if (pack.homebrew && typeof pack.homebrew === 'object') {
    const unknownKeys = Object.keys(pack.homebrew).filter(k => !KNOWN_HOMEBREW_KEYS.has(k as keyof GrimoirePackHomebrew));
    if (unknownKeys.length > 0) {
      const msg = `This package contains an unrecognized content type: "${unknownKeys.join('", "')}" — it may be from a newer version of Grimoire.`;
      return { blocking: [msg], blockingIssues: [{ severity: 'error', code: 'package_corrupt', message: msg }], issues: [] };
    }
  }

  // Item 36: oversized/pathological payload check, before any of the
  // heavier structural/dependency work below runs against it.
  const entryCount = flattenPackageContents(pack.homebrew).length;
  if (entryCount > MAX_PACKAGE_CONTENT_ENTRIES) {
    const msg = `This package contains ${entryCount} content entries, which is far more than a real homebrew package should have (limit: ${MAX_PACKAGE_CONTENT_ENTRIES}). It may be corrupted or malformed.`;
    return { blocking: [msg], blockingIssues: [{ severity: 'error', code: 'package_corrupt', message: msg }], issues: [] };
  }

  const contentProblems = validatePackContents(pack);
  blocking.push(...contentProblems);

  const dupIssues = findDuplicateIdsInPackage(pack.homebrew);
  blocking.push(...dupIssues.map(i => i.message));
  const blockingIssues: Issue[] = [
    ...contentProblems.map((message): Issue => ({ severity: 'error', code: 'package_corrupt', message })),
    ...dupIssues, // already Issue-shaped, code: 'package_duplicate_id'
  ];

  // Item 13: "invalid dependency reference structure" — Subrace.parentId /
  // HomebrewSubclass.classId are the two required, non-optional reference
  // fields this feature depends on; validateRace/validateSubclass (the
  // shared validators) don't check them at all (validateRace only checks
  // id/name/features — parentId isn't its concern for a plain Race).
  // Malformed here would otherwise surface much later, confusingly, as a
  // "missing dependency" warning against a garbage id instead of a clear
  // structural rejection now.
  for (const sr of pack.homebrew?.subraces ?? []) {
    const parentId = (sr as unknown as { parentId?: unknown }).parentId;
    if (!parentId || typeof parentId !== 'string') {
      const msg = `subrace "${sr.id}": parentId must be a non-empty string reference to its parent Race.`;
      blocking.push(msg);
      blockingIssues.push({ severity: 'error', code: 'package_corrupt', message: msg, affectedId: sr.id });
    }
  }
  for (const sc of pack.homebrew?.subclasses ?? []) {
    const classId = (sc as unknown as { classId?: unknown }).classId;
    if (!classId || typeof classId !== 'string') {
      const msg = `subclass "${sc.id}": classId must be a non-empty string reference to its parent Class.`;
      blocking.push(msg);
      blockingIssues.push({ severity: 'error', code: 'package_corrupt', message: msg, affectedId: sc.id });
    }
  }

  if (blocking.length > 0) {
    return { blocking, blockingIssues, issues: [] };
  }

  const issues: Issue[] = [];

  // ── Ruleset support ───────────────────────────────────────────────────
  const rulesetsInPack = pack.compatibleRulesets && pack.compatibleRulesets.length > 0
    ? pack.compatibleRulesets
    // Older packages (or ones built via the single-item exportHomebrewItem
    // path) never populated compatibleRulesets — derive it here instead of
    // reporting nothing, same "don't silently skip a real check just
    // because a newer optional field happens to be absent" rule the rest
    // of this feature follows.
    : Array.from(new Set(flattenPackageContents(pack.homebrew).map(c => (c.item as { rulesetId?: string }).rulesetId).filter((r): r is string => !!r)));
  for (const rid of rulesetsInPack) {
    if (!knownRulesetIds.has(rid)) {
      issues.push({
        severity: 'warning', code: 'package_unsupported_ruleset',
        message: `This package includes content tagged for ruleset "${rid}", which this device's Grimoire build doesn't recognize. That content will still be imported and its data preserved — it just may not be usable in character creation until support for that ruleset is added.`,
      });
    }
  }

  // ── Missing dependencies ─────────────────────────────────────────────
  // Resolve every dependency edge against (a) other content in this SAME
  // package, then (b) local homebrew already on this device. Anything
  // still unresolved is reported as a WARNING, not a blocker — it's very
  // often a reference to OFFICIAL content (e.g. a spell every device
  // already has via spellRepo), which this synchronous check has no way
  // to positively confirm without a Tier-2 repo warm-up. Under-reporting
  // (missing a genuinely-broken reference to obscure official content)
  // is the deliberately-chosen failure mode over over-reporting (flagging
  // every single official-spell reference as "missing" and making the
  // warning useless noise) — disclosed, not silent.
  const selectedRefs: DependencyRef[] = flattenPackageContents(pack.homebrew).map(c => ({ type: c.type, id: c.item.id }));
  const packLookup = new Map<string, HomebrewContent>();
  for (const c of flattenPackageContents(pack.homebrew)) packLookup.set(`${c.type}:${c.item.id}`, c.item);
  const { unresolved } = buildDependencyClosure(selectedRefs, ref => {
    const inPack = packLookup.get(`${ref.type}:${ref.id}`);
    if (inPack) return inPack as HomebrewContent & { rulesetId?: string };
    return localLookup(ref);
  });
  // Only report a missing dependency for types that are ALWAYS homebrew-
  // authorable-only-by-reference-to-this-package's-own-kind (race/subrace/
  // class/subclass/condition) — spell/item refs are excluded from this
  // WARNING specifically because the overwhelming majority of real
  // spell/item references in official-derived content point at the SRD
  // catalog, which this check can't see (see comment above).
  for (const ref of unresolved) {
    if (ref.type === 'spell' || ref.type === 'item') continue;
    issues.push({
      severity: 'warning', code: 'package_missing_dependency',
      message: `This package references a "${ref.type}" ("${ref.id}") that isn't included in the package and doesn't already exist on this device. Content depending on it may not work correctly until that dependency is also available.`,
      affectedId: ref.id,
    });
  }

  return { blocking: [], blockingIssues: [], issues };
}
