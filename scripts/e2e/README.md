# Android E2E for live sessions

Unattended: nothing here asks for a tap, a room code, a QR scan or a file picker.

## Topology

The test machine has **no AVDs and no system images**, so the "emulator A/B/C" layout was not possible. Instead:

* the **phone** (adb, authorized) plays exactly one role per run: DM, Host-only, or Player;
* a **Node table** (`table.ts`) plays every other role on the PC, over real TCP, with the same production session code
  (`SessionHost`, `SessionPeer`, reducers, projections). `adb reverse` lets the phone dial a Node Host;
  `adb forward` lets Node peers dial a phone Host; `FaultProxy` severs or blocks the link on demand.

## Why not Maestro

Maestro needs its own driver APK installed on the phone. On this HyperOS phone that install stops with
`INSTALL_FAILED_USER_RESTRICTED` until a human toggles "Install via USB". `adb.ts` drives the phone with
`uiautomator dump` + `input tap/swipe/text` instead, addressing React Native `testID`s (resource-ids).

## Running

Build the test APK (adds the fixtures screen only; changes no authorization):

```
$env:EXPO_PUBLIC_E2E = '1'; .\scripts\build-apk-local.ps1
adb install -r -g builds\<apk>
npx tsx scripts/e2e/run.ts dm-prepare-offline host-only player-phone dm-live
npx tsx scripts/e2e/run.ts tater-dm-workflow --record
```

Every run writes `artifacts/host-dm-rework/e2e/<flow>/` (`result.json`, `final.png`; on failure also `failure.png`,
`failure-hierarchy.xml`, `logcat.txt`, `host-state.json`, `participants-roles.json`, `pending-requests.json`,
`active-effects.json`, `revisions.json`, `protocol-log.txt`).

## Notes

* Fixture data is test-build only and confined to `session.*` documents plus the single character id `char_e2e_hero`.
* `--record` records the screen in consecutive segments (screenrecord stops at 3 minutes); segments are not edited.
* Each dump costs about 2.3 s on this phone, so flows are slow by design; they assert instead of sleeping.
