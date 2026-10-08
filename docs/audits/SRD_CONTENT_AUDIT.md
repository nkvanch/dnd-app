# SRD content audit — source and ruleset boundary

## Summary

### Verdict

**INCONCLUSIVE — source or package inclusion could not be proven.**

This is an audit-first report. It does not validate content from names, code
comments, tests, or community data. The local source-of-truth inventory has a
canonical CC-BY SRD 5.1 PDF, but no canonical SRD 5.2.1 source file. The
repository nevertheless exposes a `dnd5e-2024` ruleset and contains 2024
classes, species/background content, and spell-version data. Consequently the
2024 records cannot be verified for source fidelity, provenance, or
cross-edition mechanics.

### Release blockers

1. **BLOCKER — SRD 5.2.1 canonical source absent.** No local PDF, extracted
   data, source manifest, hash, page map, or generation pipeline identifies a
   canonical 5.2.1 input. Comments claiming SRD 5.2.1 are not provenance.
2. **BLOCKER — public provenance is not complete per record.**
   `getContentProvenance()` derives `SRD 5.1` only from `srd === true`; it has
   no source-family field, exact source location, or 5.2.1 representation.
3. **BLOCKER — artifact boundary previously leaked private content.** See
   `artifacts/distribution-audit/CONTENT_DISTRIBUTION_AUDIT.md`: the inspected
   Creator Alpha APK contained an 891-item/489-spell database and blocked
   strings in its JS bundle. A packaging remediation is present but no clean,
   final APK scan proving its bundle clean is recorded.

## Authoritative source inventory

| Source family | Local authoritative artifact | Status |
| --- | --- | --- |
| SRD 5.1 / 2014-compatible | `third_party/wotc/srd/5.1/SRD_CC_v5.1.pdf` | Present; item extraction and provenance artifacts exist |
| SRD 5.2.1 / 2024-compatible | None found | Absent; audit blocked |
| Grimoire-original | Source literals / homebrew data | Not separately catalogued with provenance metadata |
| Separately authorized | No registry found | Unknown |

The existing item audit is the only canonical-extraction pipeline found:
`scripts/extract-srd-items.py` -> `srdCanonicalMap.json` ->
`generatedSrdItems.json` / `srdProvenance.json`. It yields 95 verified public
items. It does not establish provenance for the other content types.

## Ruleset and cross-edition findings

The registry presents both `dnd5e-2014` and `dnd5e-2024`. The source tree
contains `classes2024/`, `races2024.ts`, `backgrounds2024.ts`,
`spellVersions2024.ts`, `spells2024.ts`, and 2024 spell lists. The app also
uses shared/unversioned records as compatibility defaults. That is a valid
architecture only after canonical comparison; without SRD 5.2.1 it cannot be
proven that a shared object is mechanically identical across editions.

The current 2024 spell mechanism overlays same-ID 2014 records at resolution
time. It has no canonical source manifest or per-record 5.2.1 provenance.
Every same-name spell, class feature, species/background, equipment package,
or granted spell therefore remains **unverified**, not source-faithful.

## Content-type audit status

| Content type | 5.1 evidence | 5.2.1 evidence | Result |
| --- | --- | --- | --- |
| Items / weapons / armor | 95 generated records have canonical 5.1 provenance | none | 5.1 partial; 2024 unverified |
| Spells | `srd` flags and generated library; no full 5.1 per-spell manifest | comments/data only | unverified |
| Classes / subclasses | source literals, no canonical progression map | source literals only | unverified |
| Species / races / backgrounds / feats | source literals, sparse `srd` flags | source literals only | unverified |
| Monsters / conditions | source literals / flags | no 5.2.1 source | unverified |
| Class options, invocations, fighting styles, metamagic, masteries, equipment | no complete source manifest | no canonical source | unverified |
| Generated SQLite/public snapshot | item count can be checked; historical public package leaked private DB | no final clean artifact | unverified for distribution |

## Packaging

The current public-export README itself states that `srd` flags are the
project's audit and that kept text was not re-audited line by line. A raw
repository source release is not safe: it contains full/private catalogs,
converters, test fixtures, audit data, docs, and artifacts. Release only a
sanitized staging export after a repeat APK/bundle/database scan passes.

## Required evidence before a PASS-class verdict

1. Add canonical SRD 5.2.1 input with checksum, licensing/source manifest,
   extraction output, and record/page references.
2. Add a source-family/provenance model that can represent `SRD_5_1`,
   `SRD_5_2_1`, `GRIMOIRE_ORIGINAL`, and separately authorized content for
   every public record; reject unknown public records.
3. Generate and compare per-ruleset manifests, including same-name conflicts;
   split records when mechanics differ.
4. Complete all content-type extraction/comparison work rather than relying
   on `srd` flags or comments.
5. Build and directly inspect the exact Creator Alpha release artifact after
   the packaging remediation, including JS bundle, SQLite assets, and source
   release contents.

## Files inspected

- `third_party/wotc/srd/5.1/**`
- `src/content/rulesets.ts`
- `src/content/provenance.ts`
- `src/content/classes2024/**`
- `src/content/races/races2024.ts`
- `src/content/backgrounds/backgrounds2024.ts`
- `src/content/spells/spellVersions*.ts`
- `scripts/srd-export/README.md`
- `artifacts/distribution-audit/CONTENT_DISTRIBUTION_AUDIT.md`

## Fixes made

None. The missing authoritative 5.2.1 source prevents an evidence-based
content correction.
