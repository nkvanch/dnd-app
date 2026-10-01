# Creator demo manifest

Device connected 2026-09-30 (POCO M7 Pro 5G, serial `GAJFYTFIW8KBOZDA`). Recording is now in progress,
one video at a time. Status per video below; nothing is faked — a status of BLOCKED means literally not
attempted/not possible this pass, not a guess at what would happen.

| Video (target file) | Persona question | Status | Build hash | Flow | Duration | Device | Automated pass |
|---|---|---|---|---|---|---|---|
| Grimoire-DMV-Stress-Test.mp4 | Can it represent the character without redesigning the concept? | **RECORDED** | 35c1fec3… | manual `adb`/`uiautomator` tap sequence (no testIDs exist yet for Compendium/subclass-builder/pending-choices screens — see note below) | ~35s raw | POCO M7 Pro 5G | no (manual, not scripted/automated) |
| Grimoire-Zellorea-Break-The-Engine.mp4 | What mechanic can't Grimoire represent? | BLOCKED (no device) | 35c1fec3… | not authored | n/a | n/a | n/a |
| Grimoire-Jonoman-Homebrew-System.mp4 | Does it stay coherent as homebrew becomes interconnected? | BLOCKED (no device) | 35c1fec3… | not authored | n/a | n/a | n/a |
| Grimoire-AmethystDragon-DM-Freedom.mp4 | What table/DM assumptions has it made? | BLOCKED (no device) | 35c1fec3… | not authored | n/a | n/a | n/a |
| Grimoire-ThisCrits-MultiContent.mp4 | Which content type is least first-class? | BLOCKED (no device) | 35c1fec3… | not authored | n/a | n/a | n/a |
| Grimoire-PointyHat-Why-It-Exists.mp4 | Where is the character still limited by the app? | BLOCKED (no device) | 35c1fec3… | not authored | n/a | n/a | n/a |
| Grimoire-Tater-DM-Workflow.mp4 | What would slow a DM running a real session? | BLOCKED (no device); flow ready | 35c1fec3… | `scripts/e2e/flows/taterDm.ts` (already exists and previously passed on an older build) | n/a | none this pass | n/a |

## Grimoire-DMV-Stress-Test.mp4 — what was actually captured

Recorded live on-device against the frozen `Grimoire-0.1.0-creator-alpha.apk` (no rebuild). Path taken:
Home → Compendium → Homebrew sub-tab → "The Understudy (Demo) (Bard)" → Edit (subclass builder) → **Test**
button → before/after rows (`AC: 10 → 11`, `Resistance: psychic`, `New resource: Borrowed Roles (3)`, and the
4 new features including Cue the Spotlight) → back to Home → Astra (pre-built Level 6 Human Bard / Understudy
subclass, all pending level-up choices resolved this pass) → Actions tab, showing **Cue the Spotlight**
(Subclass · Action · Control · WIS Save vs DC 13) live on her sheet.

Deviations from the `DEMO_SCRIPT.md` beat table, disclosed rather than hidden:
- The pack **import** step is not shown — `understudy-test-pack.grimoire-pack` was already imported earlier
  this pass while building Astra. The recording instead shows the already-installed pack entry in
  Compendium → Homebrew, which still demonstrates "one file → your library" but isn't the literal import tap.
- The beat calls for showing *Borrowed Roles 3/long rest* on Astra's sheet at level 3, then leveling to 6 to
  reveal *Cue the Spotlight*. Astra was already at level 6 for this pass, so both her level-3 and level-6
  subclass features exist simultaneously; only **Cue the Spotlight** was confirmed visible on her Actions tab
  during this recording. **Borrowed Roles was not found on her sheet** during a live search of the Combat,
  Abilities, and Actions tabs — this needs follow-up (possibly an exhausted-use card that hides at 0 remaining,
  or a display gap) before this is called a clean pass; it is not yet a confirmed defect.
- No captions/end-card were added — this is raw device footage, not an edited deliverable.

Not yet run through a scripted/automated flow: every tap was driven manually via raw `adb shell input` +
`uiautomator dump`, because the Compendium list, the subclass builder, and the in-sheet "pending choices"
resolver (used to build Astra) carry no `testID`s — the existing `scripts/e2e/flows` framework (which most
other flows in this repo use) cannot drive these screens yet. If more demos reuse this path, it's worth adding
testIDs to those three screens so the flow can be written once in `scripts/e2e/flows/demos/` and rerun instead
of re-discovered by hand each time.

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
