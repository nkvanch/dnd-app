# Real-device External Alpha Smoke Test

**Latest result: READY FOR HANDPICKED ALPHA TESTERS, WITH KNOWN LIMITATIONS** (see "Alpha ship-readiness check" at the end and `docs/ALPHA_LIMITATIONS.md`). Earlier failures in this report (campaign auto-host, private content on a clean install) are preserved below with their fixes and retests.

## Previous run (commit 1ca84db, failed)

## Final verdict

**DEVICE FAIL — blocker remains.**

The test stopped at the first specified hard device gate: creating a campaign automatically started LAN hosting.

## Exact candidate and environment

- **Branch:** `simulation-preview`
- **Git HEAD:** `1ca84db57d68391b7e376a3f6ccf814f921292b6`
- **Worktree:** dirty only with pre-existing local workspace settings, device captures, historical audit artifacts, and `third_party`; no product-source edit was made in this test.
- **Fresh arm64 APK:** `D:\Documents\dnd-app\builds\grimoire-local-20261006-2028.apk`
- **SHA-256:** `360a4cb14a56125d58ed89fda2aec2f16a09d28350a00b64f7eeed698248dfa8`
- **Device:** serial `GAJFYTFIW8KBOZDA`, model `2409FPCC4G`, Android 16
- **Automation:** ADB/uiautomator. Maestro was installed at `D:\Dev\Maestro\bin\maestro.bat`, but `maestro --version` failed before running a flow because its logging initializer could not create `C:\Users\nk\AppData\Local\mobile_dev\maestro\Logs\2026-10-07_201211_25192\maestro.log.lck`. This was treated as an automation-environment issue, not an app failure.

## Results

| Scenario | Result | Evidence |
| --- | --- | --- |
| Fresh install and launch | PASS | APK installed successfully; `adb shell pm clear` then clean launch showed the normal Welcome screen. |
| First-run completion | PASS | Used the normal Skip action; Home opened without a crash. |
| Campaign creation | **FAIL — hard gate** | Created `OfflineAudit` through all five normal wizard steps. The completed Campaign screen exposed **“Stop Hosting”** immediately. That control only appears for a running Host session, proving creation auto-started LAN hosting. |
| Offline persistence / restart | NOT RUN | Stopped by the required hard-gate rule. |
| Explicit Host Session | NOT RUN | Invalidated by automatic hosting. |
| 2024 creation, Warlock, persistence, sheet sanity | NOT RUN | Stopped by the required hard-gate rule. |

## Defect

**Campaign creation starts a Live Host session automatically.**

This violates the required offline campaign workflow: a new campaign must become active and DM-owned without a room code or running Host session; starting a session must occur only after an explicit **Host Session** action.

The device evidence is unambiguous: after completing the normal Create Campaign wizard, the active campaign page includes the accessible action `⏸ Stop Hosting`. The campaign was not created through the explicit Host Session control.

## Evidence artifacts

- `D:\Documents\dnd-app\builds\maestro-artifacts\external-alpha-device\01-campaign-autohost-failure.png`
- `D:\Documents\dnd-app\builds\maestro-artifacts\external-alpha-device\01-campaign-autohost-failure.xml`
- `D:\Documents\dnd-app\builds\maestro-artifacts\external-alpha-device\logcat-after-campaign.txt`

The logcat capture contains no app crash signature for this path. The failure is incorrect workflow/authority behavior, not a crash.

## Fixes made

None. This was a read-only device test. Per the task instruction, no feature work was started after the confirmed hard gate.

## Required correction and retest

1. Make `Create Campaign` persist and activate an offline DM campaign without invoking LAN hosting or allocating a room code.
2. Preserve explicit **Host Session** as the sole action that starts the server and presents a room code/QR.
3. Rebuild from the corrected commit, perform a new clean install, and restart this device suite from step 2.

---
---

## Corrected run: Campaign auto-host regression

### Verdict: CAMPAIGN DEVICE REGRESSION FIXED

### Root cause

The earlier separation (`cff4ea1`, contained in `f868d80` and in `1ca84db`; nothing later touched the campaign files) was intact: `createCampaign()` opened no server and allocated no room code, and `startLiveSession` was the only caller of `startAsServer`. The device was not hosting. The DM campaign view (`DmActiveView` in `app/(tabs)/campaigns.tsx`) drew a legacy **Stop Hosting** button at the bottom of the page unconditionally, whatever the live-session state. The store tests could not see it because they never rendered the screen. Fix: that button now renders only while `liveSession` is true.

The previous run's inference ("that control only appears for a running Host session") was wrong about the cause: the LAN server was not running, only the button was drawn.

### What the call graph showed

Server start: `campaignStore.startLiveSession` calls `syncManager.startAsServer`, and is reached only from the Host Session button. `createCampaign`, the wizard completion handler, the Campaign page mount effect, `resumeSync` (a DM restores the campaign only), `loadCampaigns` (drops any stored room code) and the root layout boot sequence do not start it. The separate Live Session feature (`/live`, `LiveSessionStart`) has its own runtime and is not on the Create Campaign path.

### Candidate

- **Commit:** `874e75ef7786d7f863dcf01129a5c3b16bb80cfb` (tracked tree clean; the only modified tracked file was `.obsidian/workspace.json`)
- **APK:** `builds/grimoire-local-20261007-2028.apk`, built fresh from that commit (not the earlier `20261006-2028` file)
- **SHA-256:** `4a1b2eb9441c250ad63b1c25973713e16cb08826333ddbfe80419028d45a7587` (debug-signed)
- **Device:** serial `GAJFYTFIW8KBOZDA`, 1080x2400, installed with `adb install -r`, then `adb shell pm clear com.nkvanch.grimoire`
- **Automation:** `scripts/dev-ui.sh` (adb, uiautomator dump, input tap). Server state was checked independently of the UI by reading `/proc/net/tcp` for a listener on port 7742 (0x1E3E).

### Automated tests (this commit)

`src/__tests__/campaignCreateFlow.test.tsx` renders the real Campaigns screen and presses the real wizard, Host Session and End Live Session controls (5 tests, including restart). It fails against the previous screen. `npx tsc --noEmit` is clean, the full Jest run passes (258 suites, 3442 tests), and `git diff --check` is clean.

### Device results

| Step | Result | Evidence |
| --- | --- | --- |
| Clean install, launch, Skip first-run | PASS | Welcome screen, then Home |
| Create `OfflineAudit` through all 5 wizard steps | PASS | Campaign page opened |
| Campaign page right after creation | **PASS** | Host Session present; Stop Hosting, Room Code, QR and End Live Session all absent, including after scrolling to the bottom; status line "Offline campaign, no live session"; DM dashboard button present. Nothing listening on 7742. |
| Press Host Session | PASS | Room code `DALSAJN` and QR shown, "0 players connected", End Live Session at the top, **Stop Hosting** at the bottom, a listener on 7742, "Hosting on 192.168.1.12:7742". |
| End Live Session (confirm) | PASS | Room code, QR, Stop Hosting and End Live Session gone; Host Session back; `OfflineAudit` still active; no listener on 7742. |
| Kill and relaunch while offline | PASS | Campaign restored offline: Host Session shown, no Stop Hosting or room code, no listener. |
| Host, kill, relaunch | PASS | The old room did not resume: Host Session shown, no room code, no Stop Hosting, no listener. |
| Crash check | PASS | No FATAL EXCEPTION for the app in logcat |

Evidence is in `builds/maestro-artifacts/campaign-fix/`: `02-after-create.png` and `.xml`, `02b-after-create-bottom.png`, `03-hosting.png` and `.xml`, `03-hosting-top.png`, `03b-hosting-bottom.png`, `04-after-end.png`, `05-restart-after-hosting.png`.

### Not run

The rest of the interrupted device suite (2024 creation, Warlock, persistence, sheet sanity) was not continued in this task, as instructed. It can resume from step 2 on this APK.

---

## Independent device re-audit: content-distribution failure

### Verdict: DEVICE FAIL — private/non-SRD content is exposed

An independent clean-install re-audit used the same corrected candidate:

- **Commit:** `9a090a7b07ddaae6913b14b7d722fbd005829e7d`
- **APK:** `builds/grimoire-local-20261007-2028.apk`
- **SHA-256:** `4a1b2eb9441c250ad63b1c25973713e16cb08826333ddbfe80419028d45a7587`
- **Device:** `GAJFYTFIW8KBOZDA`, `2409FPCC4G`, Android 16

`adb shell pm clear com.nkvanch.grimoire` was run after installation. The normal first-run Skip path was used; no content pack was installed.

On the normal **Compendium → All Content** screen, the clean app visibly listed entries marked **Non-SRD**, including:

- `Abyssal Tiefling` — “Non-SRD · Official”
- `Acid` — “Non-SRD · Official”

This is not merely a stale UI cache: direct inspection of the exact APK's `assets/index.android.bundle` finds `Abyssal Tiefling`, `Acid`, and `Blood Hunter`. The same bundle does not contain the checked private pack identifiers, which points to a failed runtime/catalog exclusion rather than an installed private pack. Either way, private/non-distributable records are physically distributed and exposed by the ordinary public Compendium route.

### Evidence

- `builds/maestro-artifacts/external-alpha-device/02-nonsrd-compendium-exposed.png`
- `builds/maestro-artifacts/external-alpha-device/02-nonsrd-compendium-exposed.xml`

### Campaign correction independently reverified

The campaign fix itself passed again on the physical device. A fresh `OfflineVerify` campaign showed “Offline campaign, no live session,” showed **Host Session**, and did not show Stop Hosting, a room code, or End Live Session. Explicit Host Session produced room code `DALSAJN`; End Live Session returned the campaign to offline state; force-stop/relaunch preserved the campaign offline.

### Required correction

Fix the public build/catalog boundary so a clean public install has no private/non-SRD data in its distributed Metro bundle and cannot expose those records in Compendium. Rebuild and restart the device suite from the clean-install and first-party-pack checks. Do not continue external Alpha distribution from this APK.

---

## Retest: public-pack boundary repair

### Verdict: CONTENT-DISTRIBUTION RETEST PASS

This retest uses the replacement candidate built locally from the actual repair commit, not the failed `20261007-2028` APK.

- **Commit:** `10cf9d798a831f3a1a89c39da436454637b69a97`
- **APK:** `builds/grimoire-local-20261007-2134.apk`
- **SHA-256:** `9258894a05ac259326ee99e38323b5451e238030c263aab6d18f3dc6b92eb346`
- **Device:** `GAJFYTFIW8KBOZDA`, `2409FPCC4G`, Android 16

### Artifact inspection

The APK contains the Metro bundle (`assets/index.android.bundle`) and native `res/xm.db`; it contains no separate private-pack asset. The native database has `items = 0` and `spells = 0`.

The Metro bundle was searched directly. It contains neither the former exposed subrace nor the representative private-content markers:

| Marker | Result |
| --- | --- |
| `Abyssal Tiefling` | absent |
| `Blood Hunter` / `Abyss Knight` | absent |
| `Emperor Warlock`, `Anchor of Command`, `Command the Field`, `Standard of the Unyielding Line`, `Glassback`, `Weight of Authority` | absent |
| `grimoire.nonsrd.5.1` / `grimoire.srd.5.1.unverified` | absent |

The expected public names `Acid` and `Broom of Flying` remain in the bundle. This is expected public content, not a private-pack leak.

### Device retest

After `adb install -r`, `adb shell pm clear com.nkvanch.grimoire`, first-run Skip, and opening Compendium:

- `Acid` is shown as **Official**, not `Non-SRD`.
- Searching the ordinary Official Compendium for `Abyssal Tiefling` returns **“No results match your search.”**
- Packages lists exactly the embedded first-party public packs: **Grimoire SRD 5.1 v1.0.0** and **Grimoire SRD 5.2.1 v1.0.0**. It does not list a non-SRD/private pack.
- No app crash or React Native exception appeared in the relevant logcat review.

Evidence: `builds/maestro-artifacts/external-alpha-device/03-pack-fix-compendium.png` and `03-pack-fix-abyssal-search.png`.

### Automated checks

- `npx tsc --noEmit`: pass.
- `npx jest --runInBand src/content/packs/__tests__/publicPackExposure.test.ts`: pass (5 tests). It traverses public-pack records at all depths, verifies private-only names are absent, and proves that the private pack restores the non-SRD subraces only after installation.
- Full `npx jest --silent`: pass (the command emitted no failures; the normal terminal stream was truncated after passing suites).
- `git diff --check`: pass. The only warning is pre-existing line-ending normalization for this report.

### Scope

The repair changes the public/private pack boundary and Compendium badge classification. The device retest did not change product code. This closes the specific content-distribution hard gate; it does **not** complete the remaining external-Alpha workflow/device audit.

---

## Alpha ship-readiness check (final candidate)

### Verdict: READY FOR HANDPICKED ALPHA TESTERS, WITH THE LIMITATIONS IN `docs/ALPHA_LIMITATIONS.md`

Two things were found and fixed in this pass that would have stopped a tester, and two items could not be exercised and are stated as such below.

### Candidate

- **Commit:** `8488e59ff5aa3f03e5442ac04f9e80ffcc49c9fa` (tracked tree clean apart from this report and `.obsidian/workspace.json`)
- **APK:** `builds/grimoire-local-20261007-2256.apk`, built from that commit
- **SHA-256:** `6e429198342bfb147977066976e8f9308b4cbf971d4c970b54e0a742fdd2d27b` (debug-signed)
- **Device:** `GAJFYTFIW8KBOZDA`, Android 16, clean install, `pm clear`
- **Bundle scan of this exact APK** (`assets/index.android.bundle`): 0 hits for Abyssal Tiefling, Blood Hunter, Artificer Specialist, Armorer/Alchemist, Magical Tinkering, Guild Artisan, "Mark of", Eladrin.
- **Automated:** `tsc` clean; full Jest 262 suites, 3464 tests pass; `git diff --check` clean.

### Defects found and fixed in this pass

1. **Navigation trap: a DM could not leave a campaign.** After the earlier fix removed the old Stop Hosting exit, the campaign page had no way to close the open campaign, so no second campaign could be created or opened. Added **Close Campaign / Switch** (ends a live session first, keeps the campaign saved). Device and UI test: create `CampOne`, close, create `CampTwo`, Open Existing lists both, reopen `CampOne`.
2. **The DM's campaign notes were sent to every player.** The server pushed the whole campaign record, notes included, on join and on every edit. Notes are now removed from everything the host sends (`sync/protocol.ts`, `redactForPlayers`), the section is labelled "DM NOTES (PRIVATE, NOT SENT TO PLAYERS)", and players no longer see a notes section. Quests and the session log remain shared by design. Device proof with a scripted player on the LAN: the secret note was present on the DM's screen and absent from the wire.
3. Smaller: class ids shown instead of names (sheet header, DM views, encounter setup, class switch dialog); the Non-SRD badge appeared on 5.5e spells, feats and items; "Case, crossbow bolt" listed as a martial weapon; the +1/+1/+1 background mode needed three taps before the button enabled; an Artificer description and several private-class strings were in the bundle; creation never said starting gear is carried, not worn.

### Criteria

| Criterion | Result |
| --- | --- |
| Known commit, installs on a clean phone | PASS. Commit and hash above; `adb install` then `pm clear`. |
| No private/non-distributable content in the artifact | PASS. Pack boundary fixed earlier (see the retest above), plus the string scan of this APK. A new test (`appSourceNoPrivateContent`) keeps private-class text out of app source. |
| 2014 and 2024 character creation, save/restart, sheet without data loss | PASS for the paths run. 2014 Dwarf Fighter: creation, Equip (AC 10 to 16), 4 damage, hard kill, reopen: AC 16 and HP 7/11 intact. 2024 Dragonborn Warlock: creation, all four pending choices resolved (invocation with prerequisites shown, Magic Initiate ability, cantrips, spell), spells show the 2024 versions, cast a spell (pact slot 0/1), Short Rest restored it (1/1), level 2 with preview, kill and reopen: Level 2, 13/13 HP, spells kept. Not run: characters above level 2, import/export, homebrew. |
| Create and reopen an offline campaign; explicit hosting and joining | PASS for hosting. Create is offline (no listener on 7742, no room code); Host Session opens the listener and shows code and QR; End Live Session closes it; a hard kill while hosting does not resume the room. **Joining from a second phone was not tested.** A scripted client joined the host over the LAN (welcome, campaign snapshot, session-ended message, rejoin after rehost). |
| Not transmitting DM-only data to players | PASS for what the host sends: DM notes (fixed above), prepared encounters and their DM notes, monsters and combat state never leave the DM device; only a turn banner is sent. Disclosed in the limitations: the banner shows the acting creature's real name, every character stored on the DM's device is pushed to joiners, and the LAN session has no authentication. |
| No crashes, navigation traps, inaccessible CTAs, misleading "working" flows in tester paths | PASS for the paths walked (first run, Home, Campaigns, Characters, creation for both rulesets, class detail, sheet tabs, rests, level-up, Compendium, DM dashboard, monster library, encounter library and builder, running and ending combat). No FATAL EXCEPTION in logcat. Not walked: Homebrew tab, Dice, Settings, import/export. |
| Short Alpha limitations list | DONE: `docs/ALPHA_LIMITATIONS.md`, separating table-resolved mechanics from known gaps. |

### Not verified

- **Live-session reconnect from a real player device.** Only the host half and a scripted client were exercised.
- **Characters past level 2 on a device**, and the untested screens listed above.

Evidence: `builds/maestro-artifacts/alpha-rc1/` and `builds/maestro-artifacts/alpha-final/`.
