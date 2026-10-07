# Real-device External Alpha Smoke Test

**Latest result: CAMPAIGN DEVICE REGRESSION FIXED** (corrected run, see the section at the end). The first run below is preserved unchanged as the previous run.

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
