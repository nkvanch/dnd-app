# Creator demo manifest

Status of every requested creator video: **BLOCKED**, not recorded, nothing faked.

Reason (single, shared, and different from the previous pass): the provenance gate that blocked the *previous*
pass is now **resolved** — the Creator Alpha build is frozen (`Grimoire-0.1.0-creator-alpha.apk`,
SHA-256 `35c1fec3cc79fc17e2bcb148637ac0d24194b595f2a6281e118c97432cd2032e`, see `../BUILD_MANIFEST.md`). What
blocks recording now is purely environmental: **no physical Android device and no emulator/AVD are available
in this session** (`adb devices -l` returned empty every time it was checked throughout this pass, including
immediately before this file was written; no AVD/system-image exists on this machine either). Recording every
demo requires driving the frozen APK on a real screen — that has not been possible this pass.

| Video (target file) | Persona question | Status | Build hash | Flow | Duration | Device | Automated pass |
|---|---|---|---|---|---|---|---|
| Grimoire-DMV-Stress-Test.mp4 | Can it represent the character without redesigning the concept? | BLOCKED (no device) | 35c1fec3… | not authored | n/a | n/a | n/a |
| Grimoire-Zellorea-Break-The-Engine.mp4 | What mechanic can't Grimoire represent? | BLOCKED (no device) | 35c1fec3… | not authored | n/a | n/a | n/a |
| Grimoire-Jonoman-Homebrew-System.mp4 | Does it stay coherent as homebrew becomes interconnected? | BLOCKED (no device) | 35c1fec3… | not authored | n/a | n/a | n/a |
| Grimoire-AmethystDragon-DM-Freedom.mp4 | What table/DM assumptions has it made? | BLOCKED (no device) | 35c1fec3… | not authored | n/a | n/a | n/a |
| Grimoire-ThisCrits-MultiContent.mp4 | Which content type is least first-class? | BLOCKED (no device) | 35c1fec3… | not authored | n/a | n/a | n/a |
| Grimoire-PointyHat-Why-It-Exists.mp4 | Where is the character still limited by the app? | BLOCKED (no device) | 35c1fec3… | not authored | n/a | n/a | n/a |
| Grimoire-Tater-DM-Workflow.mp4 | What would slow a DM running a real session? | BLOCKED (no device); flow ready | 35c1fec3… | `scripts/e2e/flows/taterDm.ts` (already exists and previously passed on an older build) | n/a | none this pass | n/a |

## What does exist

`../../host-dm-rework/demo/grimoire-dm-workflow-part1.mp4` + `part2.mp4` (169.6 s + 95.7 s): an **internal
acceptance recording** of the Tater workflow from `taterDm.ts`, made on the *previous pass's* E2E test build
`grimoire-local-20260930-0516.apk` (SHA-256 `93b71a363007f288bcc0d0b4f2001fd92b0db0c6f48bd8a5b640d1439be0e41c`),
automated PASS, 13 Node-side assertions. It is **not** a creator asset and is **not** from the now-frozen
Creator Alpha build: it predates the freeze, it is 265 s long in two unjoined segments (no video tool is
installed to join them), and the status bar shows the tester's notification icons. Left in place as evidence
the workflow itself is sound; superseded once a real recording is made on `Grimoire-0.1.0-creator-alpha.apk`.

## Level-6 / Tidewalker skills note (resolved, updates the previous pass's caution)

The previous version of this file warned: "Character creation with the Breadth demo species (Tidewalker)
stalled at the Skills step ('Confirm Skills' stayed disabled after the class picks). Unknown whether this is
the demo pack's data or a wizard rule." This was investigated this pass — see `../level6-smoke.md`. **No
engine or wizard defect was found**: a level-5 Bard built on a Tidewalker-shaped homebrew race resolves its
real "choose any 3 skills" choice correctly, with a passing regression test
(`app/creation/__tests__/skillsCommitBard.test.ts`) proving the exact `commit()` code path. The most likely
explanation was a stale/mistimed tap in the improvised script used for that exploratory session. **Whoever
records the DM V / Jonoman3000 demos should still watch this step once, live, before scripting exact timings**
— not because a defect is expected, but because this is the one step in the whole demo set that hasn't been
re-confirmed on a real screen since the fix-free conclusion above.

## Notes for whoever records these once a device is available

* Use the frozen `builds/Grimoire-0.1.0-creator-alpha.apk` — **not** any `grimoire-local-*.apk` or an
  E2E-flagged build. If the source tree changes for any reason before recording, the freeze is invalid: get a
  new build, a new hash, and update `../BUILD_MANIFEST.md` before recording anything.
* Original "(Demo)" content only (the packs in `demo/`); do not show third-party homebrew.
* The test phone previously used for this project cannot install Maestro's driver without a manual
  "Install via USB" tap, so `scripts/e2e/adb.ts`-based flows (uiautomator + `adb input`) are the working
  automation path, not Maestro, unless a different/emulated device changes that.
* Each uiautomator dump costs ~2.3 s on the previously-used phone; flows are real-time and slow by design
  (they assert instead of sleeping) — plan for segmented recordings (`screenrecord` caps at ~3 minutes per
  file) or accept multi-part clips, same as the internal Tater recording above.
* `scripts/e2e/flows/taterDm.ts` already encodes the full Tater the Bard story end to end (steps 1-24 from the
  spec) and is the fastest path to a real Grimoire-Tater-DM-Workflow.mp4 once a device exists — it needs no
  new authoring, only a run against the frozen build with `--record`.
