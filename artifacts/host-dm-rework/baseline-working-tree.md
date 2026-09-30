# Baseline working tree (captured 2026-09-30 ~01:20 GST, before any Host/DM change)

Branch: `simulation-preview`   HEAD: `1e3e8a3` (Docs: LAN / session / effect-system roadmap)
`git status --short`: 79 entries. `git diff --stat`: 47 files changed, 826 insertions, 281 deletions (tracked files only).
Raw status copy: `_status.txt` in this folder (snapshot at the time of writing this file).

## Attribution

### A. Prior task: Creator Build Readiness Audit (uncommitted, part of the release, must NOT regress)
app/creation/review.tsx, app/homebrew/{class,feat,item,subclass}-builder.tsx, app/homebrew/import-package.tsx,
outreach/pages/zellorea-mechanics.md, docs/EFFECT_AUTHORING_PARITY.md, src/__tests__/importPackageScreen.test.tsx,
src/components/FeatPreviewModal.tsx, src/components/compendium/InstalledPackagesView.tsx,
src/components/homebrew/{TraitEditor.tsx,__tests__/}, src/components/sheet/{TabCharacter.tsx,featureGrantRows.ts},
src/content/{traitCompiler.ts,featureMechanics.ts,identityLabels.ts,officialRefs.ts (also touched by concurrent SRD work)},
src/content/__tests__/{packageBuilderUx,featureMechanics,identityLabels,traitAuthoringParity}.test.ts,
src/engine/{audit,homebrewValidator,packageLibrary,packageValidation,pipeline,resolver,rest,types,effectDiff,packageImportFlow}.ts,
src/engine/__tests__/{dawnRecharge,effectDiff,packageImportFlow,packageLibraryOfficialDeps,packageValidationOfficialRefs,scaleOperation}.test.ts,
src/io/packageIO.ts

### B. Concurrent SRD item / spell provenance work (NOT this task, leave untouched)
artifacts/content-audit/, third_party/, scripts/{audit-item-provenance.ts,extract-srd-items.py,generate-srd-canonical-map.ts,
generate-srd-public-items.ts,requirements-content-audit.txt,convert-spells.mjs}, assets/content.db,
src/content/{compendiumBrowse.ts,contentDbVersion.ts,contentExposure.ts,itemRepo.native.ts,races/index.ts,monsters/srd.ts},
src/content/items/{index.ts,srdClassification.json,srdCanonicalMap.json,srdProvenance.{json,ts},generatedSrdItems.{json,ts},__tests__/srd*.test.ts},
src/content/spells/{generated.ts,index.ts,level1.ts,level2.ts,level5.ts,srdClassification.json},
src/content/__tests__/{contentDbSrdParity,srdOnlyPublicExposure}.test.ts
Latest concurrent edits were seen at 00:57-00:59 (generatedSrdItems.*, srdCanonicalExtraction.test.ts), i.e. active minutes before this task began.

### C. Other pre-existing dirty files, not mine
.obsidian/workspace.json, app/about.tsx, app/creation/race-detail.tsx, docs/CURRENT_STATE.md,
docs/DM_PLAYER_CAMPAIGN_HOMEBREW.md, src/__tests__/theme.test.ts, src/components/SafeBottomView.tsx

### D. Files attributable to THIS task (Host/DM rework), final list
Modified (4): `app/(tabs)/campaigns.tsx` (Live Session entry link), `app/_layout.tsx` (register `live` route; clear stale session effects at boot),
`src/db/schema.ts` (`session_docs` table), `docs/Future/LAN_SESSION_ARCHITECTURE.md` (pointer note).
New (56 files, exact list + hashes in `../creator-alpha/host-dm-task-files.sha256`, patch in `../creator-alpha/host-dm-task.patch`):
`src/session/**` (core, transports, runtime, prep, tests, testing helpers), `app/live/**` (hub, host, prepare, dm, player, e2e),
`src/components/live/LiveUi.tsx`, `src/db/sessionDocRepo.ts` + test, `scripts/e2e/**` (adb driver, Node table, flows, runner, README),
`docs/LIVE_SESSIONS.md`. Artifacts: `artifacts/host-dm-rework/**`, `artifacts/creator-alpha/**`.

## Known baseline health
- `npx tsc --noEmit` (excluding scripts/): 1 error, `src/content/items/__tests__/srdCanonicalExtraction.test.ts(52,47) TS2315` (concurrent file, category B).
- Full Jest at end of prior task: 170 suites / 2684 tests passing.
- Devices: one physical phone (POCO M7 Pro 5G, `GAJFYTFIW8KBOZDA`), authorized. No AVDs, no system images (see initial-architecture.md preflight).
