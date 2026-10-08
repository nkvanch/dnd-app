# Build Manifest — Grimoire 0.1.0 Creator Alpha

## Identity

- **Product / version:** Grimoire 0.1.0 Creator Alpha
- **Build timestamp:** 2026-09-30 09:44 local (build log timestamp), manifest written 2026-09-30 ~09:47 local
- **Git HEAD:** `1e3e8a32d96439aa197f0a6c759841f73c94c23d` (branch `simulation-preview`)
- **Dirty tree:** YES — 93 entries (`git status --short`), all accounted for below. Nothing was committed or pushed.
- **APK path:** `builds/Grimoire-0.1.0-creator-alpha.apk` (also built as `builds/grimoire-local-20260930-0944.apk`,
  byte-identical — the local build script's own timestamped output name; the frozen copy is the one under the
  `Grimoire-0.1.0-creator-alpha.apk` name and will not be overwritten)
- **APK SHA-256:** `35c1fec3cc79fc17e2bcb148637ac0d24194b595f2a6281e118c97432cd2032e`
- **Build config:** `EXPO_PUBLIC_SRD_ONLY=true` (script default; no `-FullContent`), `EXPO_PUBLIC_E2E` **unset**
  (production; no test-only fixtures screen). `arm64-v8a` only. Signed with the Android debug key (no
  `-KeystorePath` given — fine for direct-install outreach, not a Play Store submission). Build log:
  `build-final-1.log` in this folder.

## Content identity

- **Generated SRD public-item artifact hash:** `c9bd1013c59bb90df8bc02ea836f6589b7f971b1cc3fd9868effbc074123a9e5`
  (`src/content/items/generatedSrdItems.json`, `sha256sum`-verified directly against the file on disk — matches
  the audit-supplied hash `C9BD1013C59BB90DF8BC02EA836F6589B7F971B1CC3FD9868EFFBC074123A9E5` case-insensitively)
- **Generated public item count:** 95 (verified directly: `GENERATED_SRD_ITEMS.length === 95`, and in SRD-only
  mode `ALL_ITEMS` equals `GENERATED_SRD_ITEMS` exactly — `src/content/items/__tests__/srdProvenance.test.ts`)
- **Full/private item count:** 891 (verified directly: `ALL_ITEMS.length === 891` outside SRD-only mode)
- **Spot-checked resolvable public items:** `longsword`, `chain_mail`, `shield` all present with correct
  structured fields (cost/weight/properties/damage or AC bonus) — `srdPublicGeneration.test.ts`
- **Blocked-but-confirmed-canonical items:** 210 (intentionally not public this release — magic items needing
  unsafe/invented conversion, +1/+2/+3 templates, artifacts, ambiguous Rope identity, etc.)
- **Private prose leakage:** NONE — `generatedSrdItems.json` contains no path back to `descriptions.md` or
  `importedItems.ts`'s private prose (`srdPublicGeneration.test.ts`'s "contains no imported-record description
  dependency" test)
- **Native/web parity:** the native SQLite item/spell index (`assets/content.db`, itemRepo.native.ts) equals the
  source public sets exactly in SRD-only mode (95 items / 319 spells), and blocked private ids are not
  resolvable even by explicit id for items (`defender_club`, `healer_s_kit`) — `contentDbSrdParity.test.ts`

## Test results (this exact tree)

- **TypeScript** (`npx tsc --noEmit`): **PASS**, zero errors.
- **Lint** (changed files this pass — `app/creation/__tests__/skillsCommitBard.test.ts`): **PASS**, 0 errors,
  0 warnings after `--fix` (one auto-fixable unnecessary-type-assertion warning, fixed).
- **Full Jest** (`npx jest --silent`): **PASS** — **184 suites / 2794 tests**, all green, 0 failures.
  (183/2789 was the audit's stated baseline for the provenance work alone; this pass adds exactly 1 suite / 5
  tests — `skillsCommitBard.test.ts`, from the Level-6 investigation — landing on 184/2794 with no unexplained
  delta.)
- **SRD generated-runtime focused suites** (`srdPublicGeneration`, `srdCanonicalExtraction`, `srdProvenance`,
  `contentDbSrdParity`, `srdOnlyPublicExposure`, plus `itemBrowse`/`equipmentDisplay`/`items/index`):
  **8 suites / 100 tests, all PASS**.
- **Host/DM session integration** (`src/session/**`, `src/db/__tests__/sessionDocRepo.test.ts`):
  **12 suites / 101 tests, all PASS**.
- **Creator-readiness focused suites** (package import flow, official-dependency validation, scale, Dawn,
  trait-authoring parity, feature-mechanics labeling, identity labels, effect diff, package-builder UX):
  **10 suites / 129 tests, all PASS**.
- **`git diff --check`:** PASS (no whitespace/conflict-marker errors; only the pre-existing LF→CRLF
  informational warnings `git status`/`git diff --stat` print for files this repo already tracks with mixed
  line endings — unrelated to this pass, unchanged by it).
- **Android production build:** PASS — `BUILD SUCCESSFUL in 1m 9s`, APK produced and hashed above.
- **Android E2E (physical device):** **BLOCKED.** `adb devices -l` returned an empty device list every time it
  was checked during this entire pass (start, mid-pass, and immediately before freezing the build). No AVD/
  emulator exists on this machine either (checked again this pass: `system-images` directory absent,
  `emulator -list-avds` empty). The 6-flow device suite from the previous pass
  (`dm-prepare-offline`, `dm-live`, `host-only`, `host-plus-dm`, `player-phone`, `tater-dm-workflow`) is **not
  re-run this pass**; its prior PASS results are preserved unchanged in `artifacts/host-dm-rework/e2e/` and the
  in-process session-integration suite (12/12 suites) is the primary correctness proof per the task's own
  explicit fallback instruction for this exact situation.

## Level-6 smoke (this pass's specific investigation)

See `level6-smoke.md` for the full writeup. Summary: no engine or `skills.tsx` defect found; the real Bard
"choose any 3 skills" content resolves correctly on a homebrew-race + official-class character at level 5 with
other choice kinds simultaneously pending. A regression test was added
(`app/creation/__tests__/skillsCommitBard.test.ts`, 5/5 passing). On-device confirmation of the full
create→confirm→level-6→open-sheet flow is **BLOCKED** (no device this pass) — not fabricated.

## Creator regression (this pass)

Re-verified via the automated suites above (package import/validation, scale ×2, Dawn recharge, save DC,
trait-authoring parity, review labels, effect-diff/Test-bench resistance). Device-level re-clicking of the
Breadth/Understudy pickers, Free Edit's UI, and the manual off-list-Fireball flow was **not repeated this
pass** (no device); those exact flows passed on-device in the immediately preceding pass
(see the prior `RELEASE_GATE.md`/audit history), and nothing in this pass's diff touches the code paths they
exercise (confirmed by reading `final-source.patch`: only the SRD provenance files and the new Level-6 test
changed since that prior device pass — the creator-readiness and Host/DM files were already frozen from the
pass before that). Free Edit's ability-score permissiveness and the "manual" spell-provenance path (no
class-list gate in code) were additionally re-confirmed directly in this pass (`FreeEditModal.test.tsx`'s
existing str=30 test; `src/engine/entitlements.ts`'s `sourceKind:'manual'` spell/cantrip path).

## Host/DM regression (this pass)

Full 12-suite/101-test session-integration run, all green (roles/authorization, offline DM preparation,
encounter/effect activation, change-request Accept/Modify/Reject/stale, secret-effect isolation, multi-target
Due-to-End/end-one, reconnect for DM and Player, Host restart, Host X → Host Y campaign reuse). Physical-device
re-run: BLOCKED (see above); the previous pass's device results are unchanged and preserved.

## Exact files changed during THIS final pass

Everything else in the working tree (Host/DM layer, earlier creator-readiness fixes, the SRD provenance work)
was already present at the start of this pass (see `final-pass-baseline.md`) and is **unmodified** by it.

- **New:** `app/creation/__tests__/skillsCommitBard.test.ts` (the Level-6 regression test)
- **New (this pass's own working artifacts, not app source):** `artifacts/creator-alpha/final-pass-baseline.md`,
  `artifacts/creator-alpha/level6-smoke.md`, `artifacts/creator-alpha/BUILD_MANIFEST.md` (this file),
  `artifacts/creator-alpha/final-source.patch`, `artifacts/creator-alpha/final-file-hashes.json`,
  `artifacts/creator-alpha/build-final-1.log`, `artifacts/creator-alpha/_status_final.txt`
- **New (binary, gitignored):** `builds/grimoire-local-20260930-0944.apk`, `builds/Grimoire-0.1.0-creator-alpha.apk`

`final-source.patch` (sha256 `4c1571e0d11cf5a06741d9d715f2db2e6dea47879678309167bc2c99b69aa8d1`) and
`final-file-hashes.json` capture the **complete** working tree that produced this APK — 52 modified tracked
files + 88 new files (140 total; this pass's one new test file is included in that count) — excluding
`artifacts/` (this pass's own notes/recordings, not app source) and `third_party/` (the raw SRD reference text
the provenance generator scripts read from at generation time; not bundled into the app; ~4.4 MB, unchanged by
any pass).

## Provenance / release-state summary

The SRD item/spell provenance work reached the coherent state described in the task's own supplied audit, and
every number in that audit was independently re-verified against the actual files/tests in this pass (not
just trusted): 95 public items, 891 full-catalog items, 210 confirmed-but-blocked, artifact hash match, native/
web parity, zero private-prose leakage, `longsword`/`chain_mail`/`shield` all resolve publicly. The previous
pass's `RELEASE_GATE.md` (which found this work in a contradictory intermediate state) is now superseded by
this file for the current tree — that document is left in place as a historical record of the earlier,
correctly-identified blocker, not deleted.

## What this manifest does NOT cover

Demo recording (Phase 7/8/9) — see `demos/DEMO_MANIFEST.md`. No demo video was produced this pass: there is no
physical device and no emulator available in this environment. The frozen APK above is ready to be used the
moment a device becomes available; nothing about the source state should change before that recording happens
(if it does, a new build/hash/manifest is required, per the task's own "the freeze is invalid" rule).
