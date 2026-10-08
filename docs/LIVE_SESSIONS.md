# Live sessions: Host, DM and Player as separate roles

This describes what is **built and tested** (`src/session/`, `app/live/`). The older `docs/Future/LAN_SESSION_ARCHITECTURE.md`
is the roadmap that motivated it; where the two disagree, this file describes the code.

It is **additive**: the original campaign flow on the Campaigns tab (creator's phone is Host and DM, port 7742,
`src/sync/*`) is unchanged. Live Sessions use port **7743** and their own protocol.

## Roles are capabilities

| Capability | What it means | How it is obtained |
|---|---|---|
| `host` | runs the connection and the authoritative live-session state | only by starting a session on this device; **never** grantable over the network |
| `dm` | owns campaign preparation and DM operations | requested by a joiner, approved by the Host (`manual`, default) or granted to the first requester (`auto-first`); or explicitly chosen at hosting time as "Host + DM" |
| `player` | owns a character and answers DM requests | granted on request |

Host does not imply DM. A Host-only device gets the Host screen and no DM entry point; its projection of the session
contains participants and connection state only (no encounters, effects, requests, characters).
Authorization is checked in `SessionHost.execute` for every op, so a client cannot forge a DM operation by
editing the UI or crafting a message. Participant identity is a per-participant token issued at first hello.

## Two state domains, two revisions

* **Campaign preparation** (`CampaignPrep`, persisted on the DM's device, works with no Host and no network) carries
  its own `campaignRevision`. Encounters, effect definitions (public/target/secret), change templates, DM-only notes,
  session plans. Prepared items are definitions; nothing is live until the DM activates it.
* **Live session** (`LiveState`, owned by the Host) carries `LiveSessionRevision`, advanced by every accepted op.

A Host snapshot can never overwrite preparation because preparation never enters the Host. The same campaign can be
used with a different Host later. Only the public projection of an encounter (names, coarse state) is sent when it is
started. Secret-effect identity (name, description, source, notes) stays in the DM's local vault; the Host and the
target player receive mechanics only.

## Change requests and effects

* `DM -> Player` persistent changes use `ChangeRequest` (PENDING, ACCEPTED, MODIFIED, REJECTED, CANCELLED). The original
  proposal is never mutated; the player's version is stored separately. A request built against an older character
  revision is answered `stale` until the player explicitly acknowledges. The player device applies accepted changes
  exactly once, driven by the authoritative record.
* Direct DM-authoritative changes (encounters, effects) are applied without a request.
* Effects: `EffectDefinition` + per-target `EffectApplication` (ACTIVE, DUE_TO_END, ENDED). Due to End never removes an
  effect; a human ends it, for one target or for all. Active effects change the player's real derived numbers through the
  existing override layer with a neutral label ("Session effect"), and are cleared when the session ends or at app start.

## Reliability

Every accepted op is one event with the next revision. Clients apply `n+1`, ignore old, and resync on a gap. Ops carry a
per-participant sequence number and id: duplicates return the stored result, ahead-of-order ops are held. Reconnect
replays unacknowledged ops. Peers and the Host persist enough state to survive a process restart (Host restart resumes
from the last snapshot; roles and tokens survive). A device joining a *different* Host session resets its op ordering.

## Testing

* In-process, deterministic: `src/session/__tests__/` (Host, DM and Player peers over `InMemoryNetwork`, with
  drop/duplicate/delay/disconnect injection). `story.test.ts` replays the whole DM story.
* Real Android: `scripts/e2e/` drives the phone through adb + uiautomator (Maestro's driver APK cannot be installed on
  the test phone without a manual tap) while a Node "table" (`scripts/e2e/table.ts`) plays the other roles over real TCP
  using the same production session code. Build the test APK with `EXPO_PUBLIC_E2E=1` (adds fixtures, changes no
  authorization).

  ```
  npx tsx scripts/e2e/run.ts dm-prepare-offline | dm-live | host-only | player-phone | tater-dm-workflow [--record]
  ```

## Known limitations

* Revision ticks tell a non-entitled participant that *something* happened, not what.
* The Host relays mechanics and targets of secret effects (it must, to route them); identity and notes never reach it.
  A modified Host client can read relayed mechanics, requests and public encounter data.
* LAN only. No remote Hosts, no Host migration or DM transfer.
* The Host screen shows only session-level information by design; a Host + DM device has both screens.
* Live sessions and the legacy campaign sync do not share character synchronization; the DM sees the summary
  (name, HP, AC) each player reports, and character changes go through change requests.
