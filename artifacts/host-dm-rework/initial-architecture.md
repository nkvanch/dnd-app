# Initial architecture (CURRENT behavior, before the Host/DM rework)

Written 2026-09-30 from reading the code, not the roadmap docs. `docs/Future/LAN_SESSION_ARCHITECTURE.md` describes
intent only ("planned, not built"); nothing in it exists in code.

## 1. Automation preflight

| Check | Result |
|---|---|
| `adb devices` | one device, `GAJFYTFIW8KBOZDA` (POCO M7 Pro 5G), state `device` (authorized) |
| AVDs | **none**. `emulator -list-avds` is empty; `D:\Dev\Android\sdk\system-images` does not exist; the emulator binary is present but no system image is installed |
| Launching emulators unattended | **impossible without downloading a system image** (~1 GB from Google). Downloading is not authorized by the task text and no human is available to approve it, so it was not done |
| Maestro | `D:\Dev\Maestro\bin\maestro`, flows under `.maestro/`, runner scripts `scripts/run-maestro-*.ps1` |
| Java | Android Studio JBR present |
| APK install | `adb install -r` works unattended on the phone |
| Screen recording | `adb shell screenrecord` is available on the phone (3 min cap per file) |
| Tests | `npx jest`, `npx tsc --noEmit` run without prompts |

**Consequence (documented reduced topology):** the Emulator A/B/C topology cannot exist. Replacement plan:

1. Deterministic three-peer in-process harness (Host / DM / Player) is the primary correctness layer, unchanged.
2. Real Android UI coverage on the single physical phone, which plays exactly ONE role per run, while the other
   roles are played by **Node peers on the PC** that speak the same wire protocol over real TCP
   (`adb reverse` / `adb forward` bridges). The peers run the same production domain code as the app, not a fake game.
3. Roles that must be seen on a phone screen are recorded in separate runs (phone as DM, phone as Player, phone as Host).
   A single video can never show two phones at once; demo manifests will say which role the phone was.

## 2. What owns campaign state today

- `Campaign` (src/engine/types.ts) is one JSON blob per campaign in the local SQLite `campaigns` table
  (`src/db/campaignRepo.ts`). It carries `dmDeviceId`, `joinCode`, `rules`, `playerIds`, `characterIds`, `notes`,
  `sessionLog`, `quests`, `bannedPackIds`. Whichever device created it holds the authoritative copy.
- Prepared encounters live in their own table (`prepared_encounters`, `src/db/encounterRepo.ts`), planning data
  separate from runtime `CombatState`. This already works offline.
- Players hold a *stub* campaign (`id: joined_<code>`) that is overwritten by the DM's `campaign_snapshot` on hello.
- There is **no campaign revision counter**, **no DM-only note field** (only `Campaign.notes`, which is synced to every
  player inside `campaign_snapshot`!), **no prepared effect / change-template concept**.

## 3. What owns live-session state today

- There is no separate live-session state. `sessionId` is a random string minted per hosting run and only echoed in
  `welcome`. "Session" in `src/engine/session.ts` is a `SessionLogEntry` (start/end stamps in the campaign log).
- Live state is: each player's `Entity` (in the player's own SQLite), the DM's `CombatState` (`combat_state` table),
  and a `combat_turn_state` broadcast (round, current name).

## 4. Is the room creator implicitly the DM?

**Yes, everywhere.** One concept, three names:
- `syncManager.startAsServer()` sets `role = 'dm'` and starts the TCP server. "Server" and "DM" are the same role value.
- `campaignStore.isDm = campaign.dmDeviceId === session.deviceId`, and hosting is started only when `isDm`.
- `app/dm/_layout.tsx` gates every DM screen on `isDm` (UI-only).
- The device-level `DeviceSession.role: 'dm' | 'player'` is described in the code as advisory only.

So: Host == DM == campaign owner == campaign data holder. A Host-only participant cannot exist.

## 5. How player state is synchronized

Star topology, newline-delimited JSON over TCP port 7742 (`src/sync/protocol.ts`).
- Player -> Host: `hello{deviceId,nickname,characterId}`, `entity_snapshot`, `entity_patch` (deepDiff), `claim_character`,
  `sync_event`, `request_entity`, `ping`.
- Host -> Players: `welcome{campaignId,sessionId}`, relayed `entity_snapshot`/`entity_patch`/`sync_event`,
  `campaign_snapshot`/`campaign_patch`, `combat_turn_state`, `error` (closing reason), `pong`.
- Host relays every player message to all other clients **opaquely and unauthenticated**: any connected socket may send
  any message type, including `campaign_patch`-shaped input (the server ignores unknown types, but `entity_patch` for any
  `entityId` is accepted from any client, so any client can overwrite any character).
- Merge rule: `deepMerge` of a patch onto the local copy; last patch to arrive wins per field. **No revision ids, no
  idempotency keys, no ordering guarantees**, no dedupe of replayed patches.
- Rooms are addressed by a room code that is the DM's IPv4 address in base 36 (`src/sync/discovery.ts`).

## 6. What reconnect does today

`SyncClient` retries with capped exponential backoff (5 s doubling to 60 s, 6 attempts) and re-sends `hello`.
On `hello` the server (a) replaces any stale socket for the same deviceId, (b) pushes **every entity it knows** as a
full `entity_snapshot`, (c) pushes the current `campaign_snapshot`. `characterStore.applyIncomingEntity` has a
stale-snapshot guard for the entity the player owns. Consequences:
- Reconnect is "full resend of everything", not "resume from revision N". It cannot detect duplicates or misses.
- Events emitted while a *player* is offline are queued in `sync_events` and flushed on reconnect
  (`syncManager.flushQueuedEvents`), but nothing consumes `sync_event` payloads except a full-sync request.
- If the Host/DM process dies, everything about the "live session" vanishes (it was only sockets). The campaign itself
  survives because it is in the DM's SQLite. There is no Host-process-restart resume.

## 7. Current effect / condition representation

- `Entity.conditions: ConditionMonitor` = `{ active: ActiveCondition[], exhaustion: number, flags }`;
  `ActiveCondition = { id, sourceId, duration: DurationTracker | null, suppressedBy }`. A condition is an id plus a
  duration; there is no name/description/source/visibility/target group, no per-target lifecycle, no Due to End state
  (duration expiry is a separate concept in `DurationTracker` and the End Turn helper).
- Effects with mechanics are `Effect` records inside `FeatureDefinition`s (passive stat effects); they are not runtime
  applications. There is no `EffectDefinition`/`EffectApplication` split.
- No secret effects. Conditions are stored on the player's own entity and synced in full, so anything the DM put there is
  visible to the player.

## 8. Where authority checks happen

- UI only: `app/dm/_layout.tsx` (`isDm`), `SyncStatusDot`, `campaigns.tsx` button visibility.
- Domain/protocol: **none.** `SyncServer.handleClientMessage` performs no authorization; a client's `role` is not even
  transmitted. The Host cannot distinguish a DM from a player.

## 9. Does DM preparation persist independently today?

Partly, and only because DM == owner:
- Campaign record, quests, session log, banned packs, notes: persisted in local SQLite, usable offline. Yes.
- Prepared encounters: persisted, offline. Yes.
- **DM-only notes:** no. `Campaign.notes` is synced to players.
- **Prepared effects (public/secret), prepared change templates:** do not exist.
- Campaign is welded to the hosting device: joining a *different* Host with the same campaign is not a concept, because
  the campaign owner is the Host.

## 10. Screens that assume Host == DM

- `app/(tabs)/campaigns.tsx` (1311 lines): "Create Campaign (DM)" = start hosting; "Join Campaign (Player)"; DM panel
  shows room code, roster, "Stop Hosting". Single flow for both concerns.
- `app/dm/*` (dashboard, encounter, encounters, encounter-builder, monsters, character/[id]) all require `isDm` and read the
  local `CombatState`/`encounterStore`, i.e. they assume the local device runs the table.
- `app/(tabs)/index.tsx`, `app/sheet/[id].tsx`, `SyncStatusDot`: show sync state derived from `SyncStatus.role`
  (`'dm' | 'player' | 'offline'`).

## 11. Transport abstractions

None. `syncManager` constructs `SyncServer` / `SyncClient` directly (react-native-tcp-socket). Tests mock those classes
wholesale (`src/sync/__tests__/syncManager.test.ts`), so **no existing test exercises real message flow** between peers.
`src/sync/protocol.ts`'s `encodeMessage`/`parseBuffer` are pure and reusable.

## 12. Existing test / automation assets

- Jest: 170 suites, pure-engine and store tests; no networking integration test.
- Maestro: `.maestro/{preserve-state,disposable,requires-character}`, runners in `scripts/`, output in `builds/maestro-artifacts`.
- `docs/ANDROID_E2E.md` describes the primary-phone (preserve-state) vs disposable workflow.

## 13. Design decision derived from this

The legacy path (Host+DM on the campaign creator's phone, entity/campaign sync) must keep working and stays the
default "Host session as DM" combination. The new model is a **separate, additive session layer** that carries its own
message envelope over the same framing, with role capabilities enforced at the protocol boundary, and a persistent
DM-preparation store that is independent of any Host. See `design.md`.
