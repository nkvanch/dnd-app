# Creator Alpha release gate (checked 2026-09-30, ~05:45 GST)

> **Superseded 2026-09-30 ~09:45.** The SRD provenance work this file identified as blocking reached a
> coherent state and was independently re-verified. The Creator Alpha build is now frozen — see
> `BUILD_MANIFEST.md` for the current gate result and `level6-smoke.md` for the one open item from that later
> pass. This file is kept as the historical record of the blocker at the time it was found, not deleted.

## Verdict: CREATOR RELEASE FREEZE BLOCKED BY PROVENANCE STATE

No `Grimoire-0.1.0-creator-alpha.apk` was produced, no `BUILD_MANIFEST.md` was written, and no creator demo was recorded.
Everything that does not depend on a frozen distributable build was completed (Host/DM/Player implementation, in-process
and Android E2E, regression, creator smoke checks, task patch identity).

## Why

The repository contains concurrent SRD item / spell provenance work (categories B in
`../host-dm-rework/baseline-working-tree.md`) that stopped in a contradictory intermediate state. It was not started, changed
or reverted by this task. Its last edit was at 00:49-00:59 GST; nothing has touched it since (about 5 hours).

| Check | Result |
|---|---|
| Full Jest | 182 suites: **178 pass, 4 fail**; 2785 tests: 2776 pass, **9 fail**. Every failing test is in the provenance work (below). All 11 session suites (98 tests) and every creator-readiness suite pass |
| `srdProvenance.test.ts` (3 fail) | expects all 605 classified items to have an *unverified* provenance record and none to be public; the code says `hasVerifiedPublicItemProvenance('longsword') === true` and the real public-build module returns 1783 lines of items |
| `srdOnlyPublicExposure.test.ts` (3 fail) | golden public counts pin `items: 0`; the source yields **85** public items (`generatedSrdItems`); deny/allow cases (`healers_kit`, Figurines of Wondrous Power) disagree with the source |
| `contentDbSrdParity.test.ts` (2 fail) | expects the native item index to be empty; the real `assets/content.db` (last regenerated 17:15 the previous day) holds 85 public items; a hidden id (`defender_club`) no longer resolves |
| `srdCanonicalExtraction.test.ts` (1 fail) | expects 164 mundane rows; extraction returns 176 |
| `tsc --noEmit` | 1 error, `src/content/items/__tests__/srdCanonicalExtraction.test.ts(52,22)`, in the same untracked provenance test file |
| Which item set would the APK ship? | undetermined: the SRD-only public item count is 0 in the tests, 85 in the source, and the checked-in `content.db` and the earlier SRD-only audit disagree with both |

The distributable would therefore contain an item repository whose intended public exposure is not settled. Building it anyway would
be "silently packaging an unknown intermediate state", which the task forbids, and rewriting or finishing the provenance work is
explicitly out of scope.

## What would unblock it

1. The provenance owner reaches a state where the four suites above pass and `tsc --noEmit` is clean (or explicitly records the intended
   public counts and updates the goldens).
2. Regenerate `assets/content.db` if that state requires it.
3. Then, in one sitting: run full Jest + tsc, `EXPO_PUBLIC_SRD_ONLY=true` build (no `EXPO_PUBLIC_E2E`), name it
   `Grimoire-0.1.0-creator-alpha.apk`, record SHA-256, HEAD, dirty-tree list, and write `BUILD_MANIFEST.md`; then record the demos
   (`.maestro/demos` are replaced by `scripts/e2e/flows`, see `demos/DEMO_MANIFEST.md`).

## What is safe to say about the current tree

* The Host/DM/Player layer and the earlier creator-readiness fixes are in the working tree, tested, and do not depend on the provenance files.
* Test-only APKs built during this task (`builds/grimoire-local-20260930-0151..0516.apk`, E2E flag) and the normal APK installed on the test
  phone (`grimoire-local-20260930-0544.apk`, SHA-256 `0a377760476a52b2a8e76efa16a9f1ea982f771dc06808865a42872b34c58303`) contain the *intermediate*
  provenance state. They are not to be distributed.

## Source identity of this task's own work

* Git HEAD: `1e3e8a32d96439aa197f0a6c759841f73c94c23d`. The working tree is dirty (about 90 entries) and is **not** clean.
* `host-dm-task.patch` (+ `host-dm-task-files.sha256`) reproduce exactly the files changed by the Host/DM task: 4 modified tracked files and
  the new files under `app/live`, `src/session`, `src/components/live`, `scripts/e2e`, `src/db/sessionDocRepo.ts` (+ test), `docs/LIVE_SESSIONS.md`.
* The earlier creator-readiness audit changes remain uncommitted in the tree (they are part of the intended release content).
