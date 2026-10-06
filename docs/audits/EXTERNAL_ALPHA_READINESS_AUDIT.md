# External Alpha Readiness Audit

## Final Verdict

**NOT READY — blocking issues remain.**

## Candidate

- **Branch:** `simulation-preview`
- **Git HEAD:** `ccb2e8dc7d5b9ed90ca894f7efbb481d05632738`
- **Audited APK:** `D:\Documents\dnd-app\builds\grimoire-local-20261006-2009.apk`
- **APK SHA-256:** `6973ac83ba5a0cd4d412caa9382bc2a47ec9840282180b3e9564683940f53235`
- **Size:** 62,680,731 bytes
- **Build command:** `powershell -ExecutionPolicy Bypass -File scripts\build-apk-local.ps1`
- **Package / version:** `com.nkvanch.grimoire`, `1.0.0` / versionCode `1`
- **ABI:** `arm64-v8a` only
- **Signing:** Android debug certificate (`CN=Android Debug`)
- **Content mode:** packs-only runtime. The APK has an empty embedded SQLite content database; it embeds the signed `grimoire.srd.5.1` and `grimoire.srd.5.2.1` pack payloads in the Metro bundle.
- **Worktree at audit start:** dirty with local device captures, prior audit artifacts, `.obsidian/workspace.json`, and `.claude/settings.local.json`. No product-source change was made during this audit.

The APK above was rebuilt during this audit after recording the stated HEAD. It is not the older September Creator Alpha APK/manifest.

## Release Blockers

### Create Campaign starts a live Host session automatically

This is a hard release-gate failure. The required external-alpha behavior is that campaign creation creates a persistent offline DM campaign; hosting is a later, explicit Live Session action.

The current implementation does the opposite:

- `src/store/campaignStore.ts:218-232` calls `syncManager.startAsServer(...)` from `createCampaign`, assigns the result to `campaign.joinCode`, and only then persists the campaign.
- `app/(tabs)/campaigns.tsx:182-188` explicitly documents and relies on `createCampaign` starting the LAN server.
- The current test suite encodes the same behavior: `src/store/__tests__/campaignStore.test.ts:306-321` tests the `startAsServer` call made by `createCampaign`.

This violates the required workflow and risks making ordinary offline campaign setup depend on live-session/native networking initialization. It also reintroduces the exact Create-Campaign-versus-Host-Session regression named in the audit brief.

**Required correction:** keep `createCampaign` to local campaign persistence and DM ownership only; make `Host Live Session` the sole explicit route that calls `startAsServer`. Add a regression test that offline campaign creation does not allocate a room code or invoke the LAN server.

## High Priority Non-Blockers

- The candidate is debug-signed and arm64-only. That is acceptable only for a tightly controlled direct-install Alpha; it is not suitable for Play distribution or broad external release.
- No Android device or emulator was attached (`adb devices -l` was empty), so clean-install, launch, physical creation, LAN three-peer, reconnect, and on-device privacy checks could not be repeated for this APK. These are required before any later READY verdict.

## Workflow Results

| Workflow | Result | Evidence |
| --- | --- | --- |
| Candidate build | PASS | Local release build produced the APK recorded above. |
| Campaign creation | **FAIL** | `createCampaign` automatically calls `startAsServer`; see blocker. |
| Installation / clean launch | NOT RUN | No connected Android device or AVD. |
| 2014 / 2024 character creation | NOT RUN | Stopped after confirmed hard gate. |
| Character-sheet operations | NOT RUN | Stopped after confirmed hard gate. |
| Homebrew, packs, import/export | NOT RUN | Stopped after confirmed hard gate. |
| DM / Player / Host / LAN reconnect | NOT RUN | Stopped after confirmed hard gate and no device was available. |

## Security / Privacy

Static inspection found a substantial session privacy/authorization test surface, including tests for serialized secret-effect metadata, player vitals, effect conversion, monster visibility, and role authorization. That is useful automated evidence, but it is not a replacement for the required actual multi-peer payload/device verification. No privacy leak was confirmed in this bounded audit.

## Content / Licensing / Packaging

The rebuilt APK was opened directly.

- Packaged data files: `assets/index.android.bundle` and `res/xm.db`; the latter contains `items = 0` and `spells = 0`.
- The Metro bundle includes the public pack identifiers `grimoire.srd.5.1` and `grimoire.srd.5.2.1`.
- It contains neither private pack identifier (`grimoire.nonsrd.5.1`, `grimoire.srd.5.1.unverified`) nor the checked private/demo records: Emperor Warlock, Anchor of Command, Command the Field, Standard of the Unyielding Line, Glassback, Weight of Authority, Ballast, `defender_club`, or `healer_s_kit`.
- `Mace of Disruption` and `Broom of Flying` are present through the explicitly embedded SRD 5.2.1 pack. Their names alone are not evidence of a private-content leak; the pack builder identifies them as SRD 5.2.1 Equipment records and the bundle does not contain the private pack identifiers.

This inspection found no confirmed private-content leak in the rebuilt APK. It does not substitute for a separate legal conclusion about the provenance of the 5.2.1 source material.

## Persistence / Data Integrity

Not fully re-executed because the confirmed campaign-creation hard gate stops release readiness. The existing source has campaign persistence calls after host startup, but this audit does not treat code reading as proof of restart/reconnect durability.

## Automated Tests

- **TypeScript:** `npx tsc --noEmit` — PASS (exit 0).
- **Focused campaign store:** `npx jest --runInBand src/store/__tests__/campaignStore.test.ts` — PASS (1 suite, 30 tests). The suite explicitly passes the now-disallowed `createCampaign → startAsServer` behavior, which corroborates rather than closes the blocker.
- **Diff integrity:** `git diff --check` — PASS (exit 0).

No full Jest or lint run was used to override the confirmed workflow blocker. The current source includes dedicated session/privacy tests, but the candidate cannot receive a READY result while `createCampaign` invokes hosting.

## Real-Device Results

No device was available during this audit: `adb devices -l` returned no attached devices. Therefore no claim is made for install, launch, physical navigation, packet capture, reconnect, or device persistence for the rebuilt APK.

## Known Limitations for Testers

Do not distribute this APK to external testers yet. After the campaign-creation blocker is corrected and rebuilt, disclose at minimum:

- debug signing and arm64-only support;
- features marked table-resolved rather than automated;
- any unsupported 2024 mechanics verified at that time.

## Exact Fixes Made During Audit

None. This was a read-only audit.

## Remaining Work Before Wider/Public Release

1. Decouple persistent Campaign creation from `startAsServer`, rebuild from the corrected commit, and verify offline campaign creation and explicit later hosting.
2. Re-run the release artifact inspection against the new APK.
3. Perform the required clean-device installation and real multi-peer Host/DM/Player reconnect/privacy verification.
