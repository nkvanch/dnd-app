# Design: Host / DM / Player session layer

Additive layer in `src/session/`. The legacy campaign sync (Host==DM, port 7742, `src/sync/*`) is untouched and remains
the path for "Create Campaign (DM)". The new layer is what "Host", "DM" and "Player" mean from now on: a Host+DM device is
an explicit *combination* of capabilities, not an identity.

## Layers

```
 DM device                    Host device (any participant)                Player device
 ---------                    -----------------------------                -------------
 CampaignPrep (local SQLite)  SessionHost core (LiveState, revisions,      PlayerPeer (replica, pending ops,
 SecretVault (local)            participant registry, authz, idempotency)   applied-request ledger)
 DmPeer  <--- SessionTransport (LAN TCP | in-memory) --->  HostPeer(view)      CharacterAdapter
```

* **CampaignRevision** (DM-local, in `CampaignPrep`) and **LiveSessionRevision** (Host-local, in `LiveState`) are unrelated
  counters. A Host snapshot can never overwrite prep because prep never enters the Host.
* Host runs the authoritative live state; it never stores campaign prep, DM notes, secret-effect identity, or templates.
* Capabilities (`host`, `dm`, `player`) live only in the Host's participant registry, keyed by participant id and
  authenticated by a per-participant token issued on first hello. Nothing in a message can claim a capability.
  `host` is never granted over the network. `dm` is granted by the Host (`dmPolicy`: `manual` default, `auto-first` for tests/E2E).
* Every accepted op produces exactly one canonical `LiveEvent` = one `LiveSessionRevision`. Clients apply revision `n+1`
  only, ignore `<=n`, buffer `>n+1` and ask for a `resync` snapshot.
* Ops carry `(participantId, opSeq, opId)`. Host applies per-participant in `opSeq` order, buffers ahead-of-order ops,
  and returns the stored result for duplicates (idempotency).
* Projections are computed by the Host per viewer: `DmView`, `PlayerView`, `HostView`. The same reducer applies canonical
  events on the Host and projected events on replicas, so there is one implementation of state transitions.

## Secret effects
The DM's local `SecretVault` holds name/description/source/notes/hidden-duration-reason. The op sent to the Host contains
only mechanics (`components`), targets, duration shape and `visibility: 'secret'`. The player projection carries
mechanics-only entries with `label: null`. Consequences, stated honestly: the Host relays mechanics and target ids of
secret effects (it must, to route them), and revision ticks reveal *that* something hidden happened, not what.

## Authority boundary
DM-authoritative (direct ops): campaign link, encounter activation/end, effects (apply/due/end), round ticks.
Player-owned persistent changes: `ChangeRequest` (PENDING -> ACCEPTED | MODIFIED | REJECTED | CANCELLED). A request records
`original` (never mutated), `finalApplied`, `baseRevision`. Stale requests (player's character revision differs from the
base) are not silently applied: the response is answered `stale` until the player explicitly acknowledges. The player device
applies accepted/modified changes exactly once from the authoritative record (`appliedRequests` ledger).

## Transport
`SessionTransport` = `ServerTransport` + `ClientTransport` + `Connection` (string frames). `InMemoryNetwork` (test only,
deterministic, manual pump, fault injection) and a LAN adapter (line-delimited JSON, same framing as `src/sync/protocol.ts`)
for production (react-native-tcp-socket) and for Node peers used by the Android E2E harness.
All messages cross the transport as JSON strings in every test.

## Persistence
`KeyValueStore` interface (`InMemoryKv` for tests, SQLite `session_docs` for the app): `CampaignPrep` per campaign, DM
`SecretVault`, per-peer state for restart, optional Host live-state snapshot for Host restart.

## Deliberately not in scope
Cloud/remote networking, host migration, transfer of Host, per-view sequence numbers (ticks are used instead), automatic
timers (duration is a helper, humans end effects), player-visible campaign content.
