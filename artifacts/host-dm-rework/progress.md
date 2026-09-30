# Progress log: Host / DM rework + Creator Alpha

Updated after each major phase. Test evidence lives in `tests.json`.

## Phase 0: inspect + preflight (DONE)
- `baseline-working-tree.md`, `initial-architecture.md` written before any design work.
- Preflight finding: **no AVDs and no system images** on this machine; downloading one was not authorized and no human is
  available to approve it. Android topology is reduced to the one authorized physical phone plus Node peers on the PC
  over real TCP (`adb reverse` / `adb forward`). The in-process harness keeps full three-peer coverage.

## Phase 1-2: transport boundary + role model (DONE, tested)
- `src/session/{types,state,roles,transport,memoryTransport,host,peer}.ts`.
- Host and DM are separate capabilities enforced in `SessionHost.execute`. `host` is never network-grantable.
- Tokens authenticate participant ids; forged / impersonated ops are refused.

## Phase 2B: DM preparation vs live session (DONE, tested)
- `prep.ts`: `CampaignPrep` with `campaignRevision`, separate from `LiveState.revision`.
- Prepared effects / change templates are inert definitions (`findLiveFields` guard); activation builds live payloads.
- Secret effect identity lives in the DM-local `SecretVault`; the Host never receives it.

## Phase 3-8: revisions, requests, effects, reconnect, fault injection (DONE, tested)
- Single reducer `applyEvent`, per-viewer `projectState` / `projectEvent`, op ledger (idempotency), per-participant op sequencing,
  gap detection + resync, ticks for events a viewer may not see.
- ChangeRequest lifecycle PENDING / ACCEPTED / MODIFIED / REJECTED / CANCELLED, stale detection with explicit acknowledgement,
  exactly-once application from the authoritative record.
- Effects: public / target / secret, multi-target, per-target lifecycle ACTIVE / DUE_TO_END / ENDED, End one / End all.
- Host restart persistence implemented (`HostPersisted`) and tested; peer restart persistence tested.
- `InMemoryNetwork` (test only): drop / duplicate / delay / disconnect / inject.

## Phase 9: screens (code DONE, on-device verification pending)
- `app/live/{index,host,prepare,dm,player,e2e}.tsx`, routing in `src/session/routing.ts`, entry link in Campaigns tab.
- SQLite `session_docs` table + `sessionDocRepo`, `SessionRuntime`, `EntityAdapter`, `effectBridge` (secret effects change real
  derived numbers via dmOverrides with a neutral label).

## Known limitations recorded so far
- Revision ticks reveal *that* a hidden event occurred to non-entitled players (not what).
- The Host relays mechanics + target ids of secret effects (it must route them); identity/notes never reach it.
- Session layer is additive to the legacy Host==DM campaign sync (port 7742), which is unchanged.

## Phase 10-14: harness, E2E mode, Android automation (DONE)
- In-process three-peer harness, 101 session/db tests (12 suites) passing; `story.test.ts` replays spec steps A-AM.
- Android: no AVDs (see above) and Maestro's driver cannot be installed without a human tap, so a uiautomator/adb runner plus a Node
  table over real TCP was built (`scripts/e2e`). 6 flows PASS on the physical phone on `grimoire-local-20260930-0516.apk`:
  dm-prepare-offline, dm-live, host-only, host-plus-dm, player-phone, tater-dm-workflow (recorded).
- Real bugs found by the device runs and fixed (each has a regression test where it can be unit tested):
  Host ignored changed role requests / character id on a returning participant; a device reusing its identity on a *new* Host session kept
  old op sequence numbers (new Host waited forever); an `await` inside an object spread in the hub silently dropped the character
  (Hermes/Babel); players never reported their character to the DM; session effects could outlive a killed session on the sheet;
  reconnect gave up after 75 s (now ~10 min); audit lines leaked between projection levels (caught by the convergence invariant).

## Phase 15-16: regression and creator smoke
- Full Jest: 182 suites, 178 pass; the 4 failing suites (9 tests) are the concurrent provenance work, unchanged by this task.
- `tsc`: only the concurrent provenance test file errors. Lint: 0 errors in every file this task added or changed (12 pre-existing errors in
  `campaigns.tsx` are identical at HEAD).
- Breadth pack on the phone: preview shows no false Fighter warning; species, item, monster and feat pickers list the imported content.
  Spell picker was verified in the previous audit round and not re-run. Level-6 creation flow: NOT completed (wizard stalled at Skills with the
  homebrew species); covered only by existing unit tests. Raw lowercase ids (`bard`, `human`) still appear on the Characters list, Home card
  and sheet header: cosmetic, not fixed.

## Phase 17-21
- Provenance gate: BLOCKED (`../creator-alpha/RELEASE_GATE.md`). Creator APK, BUILD_MANIFEST and the seven creator demos were NOT produced.
- Internal DM workflow recording: `demo/grimoire-dm-workflow-part{1,2}.mp4`.
