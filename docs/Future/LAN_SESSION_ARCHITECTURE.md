# LAN_SESSION_ARCHITECTURE.md

# Purpose

This document defines the planned architecture for LAN/session play, the
Host/DM authority split, and the general Effect system that condition/spell/
concentration mechanics are moving toward. It is a **future roadmap**, not a
description of shipped behavior — see `docs/STATUS.md` for what currently
exists. Nothing here should be treated as implemented until it appears there
and in the actual code.

---

# Core principle: Host ≠ DM

The cleanest model is:

> Host = network/session host
> DM = game authority

They can be the same person, but they do not have to be.

So Campaign/LAN setup gets three entry points:

- Host Session (as DM)
- Host Session as Player (non-DM)
- Join Session

After hosting, the host can assign another connected participant as DM.

This gives cases like: Player A hosts because their phone/network is better;
Player B is assigned DM; Player A remains an ordinary player.

The host manages connectivity and synchronization. The DM controls
encounter/session authority. That separation belongs in the data model from
the beginning, not bolted on later.

Authority splits into three independent axes:

- **Network authority** — host (serializes/synchronizes data)
- **Session authority** — DM (encounter/session control)
- **Character authority** — owning player (their own sheet)

The host serializing data does not automatically grant gameplay control.

If hosting as a player:

1. Device starts the LAN server/session.
2. Others connect.
3. Host selects/assigns one participant as DM.
4. DM gains session/encounter authority.
5. Original host stays an ordinary player.
6. Network hosting remains on the original device.

Later, also support **Transfer DM** without migrating network hosting, and
potentially (not v1 — technically harder) **Transfer Host**, moving the
actual LAN server between devices.

---

# LAN v1

## Host/Join

- Host Session (as DM)
- Host Session as Player (non-DM)
- Join Session
- Host can assign DM to any connected participant

## Current Encounter (player view)

Players keep their normal character sheet — LAN does not introduce a
duplicate sheet. It adds a prominent **Current Encounter** entry/tab showing:

- encounter/round state
- initiative
- whether it's your turn
- own HP
- Action / Bonus Action / Reaction state
- visible active effects
- visible monsters
- End Turn
- other encounter-specific info

## Player cards (DM dashboard)

The DM LAN screen shows connected players as compact cards:

- player/character name
- HP
- AC
- passive scores
- active effects
- current concentration
- possibly initiative/current turn state
- pending DM requests

Tapping a row expands details. The main dashboard should never become a
duplicate full character sheet — deeper detail opens on demand.

## Planned encounters (DM-only)

- encounter name
- difficulty
- monster composition/icons
- preparation info

Lifecycle: **Planned → Active → Finished**. Players only receive the active
encounter projection once the DM starts it. Starting an encounter does not
force any particular initiative flow — options include entering initiative
manually, rolling in-app, or reusing existing initiative.

## Snapshot + diff sync

A user can join mid-session, including mid-encounter. The host sends a
**current snapshot** — not full event history — containing only what the
joiner is entitled to see: current session, current encounter, initiative,
visible monsters, current effects, session rules, their own relevant
character state. Incremental diff sync continues from there.

## Basic visibility rules (LAN Rules)

Session-level defaults, configurable rather than hardcoded:

**Player visibility** — other player info visible, other player HP visible,
other player effects visible. By default players mainly see their own data;
LAN Rules can expose more.

**Monster visibility** — controls for: show monster type, show monster name,
show portrait, show conditions, show general HP state, show exact HP. The DM
can override visibility per individual monster on top of the session default.
A monster can therefore range from completely hidden, to "unknown creature,"
to "visible type only," to "name + portrait + HP state," etc. **Exact HP is
off by default.**

## Reconnect

If LAN drops, the character sheet stays usable — local state continues, the
app never freezes waiting on the network. The player keeps acting locally
with the latest known state and reconciles on reconnect.

---

# LAN v2

## DM change requests

The player remains in control of their own character — the DM does not
directly mutate another player's character. Instead:

> DM sends a requested change → player reviews it → player accepts, modifies,
> or rejects it.

Example: "Ogre deals 11 piercing damage. Current HP: 37. Proposed HP: 26.
[Accept] [Modify] [Reject]." Modify matters because the player may know about
resistance, a reaction, temp HP, etc., that the DM's proposal didn't account
for.

The same request/accept model applies to damage, healing, effects,
conditions, resources, and potentially inventory. The DM remains able to
directly control DM-owned entities (monsters) without going through this
flow.

## Multi-target effects

One effect can be applied to multiple targets at once (e.g. Bless → Fighter,
Rogue, Wizard). Each target gets its own effect instance, but the instances
reference one common originating spell/cast instance — so "End Bless
concentration" can mark every linked target effect due-to-end/ready-for-
removal in one action.

## Secret DM effects

DM-private effects (a hidden curse, secret disadvantage, unknown disease)
live in DM/session state and never auto-expose themselves on the player's
device. Rule: **a secret effect must never silently alter visible player-side
calculations if doing so would reveal the secret.** Instead the DM gets the
reminder and applies the consequence manually when it becomes relevant.

## Richer monster visibility

Players can normally see a monster's type unless the DM hides it; name and
portrait can be shown when appropriate. Possible visible facts: name, type,
portrait, conditions, general HP state. Exact HP stays hidden unless LAN
Rules/DM explicitly allow it. The DM can hide or reveal each of these
individually per monster.

## Pending-request UI, conflict/revision UX, effect duration sync

Covered in their own sections below (Conflict Handling, Effect System).

---

# Effect system

This is one of the largest planned additions. Conditions, spells, buffs,
curses, transformations, and similar temporary mechanics move toward a real
`EffectInstance` model rather than each having its own bespoke handling.

An effect instance may track: id, name, target, source entity, source
spell/feature, duration, remaining duration, duration unit, lifecycle state,
concentration link, visibility, notes, and its mechanical effects.

## End Effect

Every persistent condition/spell/effect gets an explicit **End Effect**
action. The app never takes control away from a human just because a timer
hits zero:

> Active → Due to End → Ended by human

A human can also always jump straight from **Active → End Effect** early —
concentration broken, dispelled, a successful repeat save, a narrative
ruling, a manually-ended effect, or the table realizing it should have ended
earlier already.

## Duration tracking is a helper, not an authority

> Bless — 3 rounds remaining → 2 → 1 → Due to End

It never auto-disappears. The DM/player confirms when it actually ends.

## Add effect mid-duration

A user must be able to add an effect that's already partway through its
duration — e.g. Bless (normal duration 10 rounds, entered as 6 remaining).
Also support **Duration: Manual** for anything the app can't reliably time.

## Effect timing

Eventually: beginning/end of source turn, beginning/end of target turn,
round boundary, manual, unknown/contextual. These timings update
remaining-duration / due-to-end state — they never forcibly remove the
effect on their own.

## Visibility

An effect needs visibility separate from its existence: public, target-only,
DM-only, possibly party-visible. This is what lets one infrastructure serve
Bless, Poisoned, a secret curse, a hidden disease, and a DM-only reminder
without separate systems.

---

# DM/session

## Active Encounter, monster control

Covered above (LAN v1/v2). The DM directly controls DM-owned entities
(monsters) without the accept/modify/reject flow that applies to players'
own characters.

## Session Logs (not a mechanical action log)

Session Logs are for major or DM-chosen narrative events only — party
discovers an important location, a major NPC dies, an alliance is made, a
quest development, or anything the DM manually records as notable.

This is explicitly distinct from the **Mechanical Timeline/History**, which
can contain ordinary changes (damage, healing, spell/resource use, condition
change). Session Log entries need more structure than a bare timestamp —
likely session, sequence/order, optional category, and perhaps a link to a
quest/location/NPC/encounter.

## Quest visibility

The existing quest system is already well made and is **not** being
redesigned for LAN. The only LAN-specific addition is visibility/sharing:
DM-only, party-visible, or possibly selectively shared.

## Session rules / LAN Rules

Covered under LAN v1's "Basic visibility rules."

---

# Concentration

Concentration is linked to effects rather than being a bare boolean.

- Starting a new concentration spell can require ending the prior one.
- Concentration can be ended manually.
- One concentration source can link to several target effects (multi-target
  spells — see Effect system above).
- Damage can trigger a concentration-save **reminder**; the app never
  auto-rolls a save unless explicitly asked to.
- Ending concentration updates every linked effect.
- Human confirmation always remains the actual table authority.

---

# Player actions during LAN

Players keep operating their own character normally: spend a spell slot, use
a resource, end their own concentration, add a self-effect, take damage after
DM instruction, use a feature, modify their own sheet wherever normal rules
allow it. LAN must never turn a player's phone into a read-only remote
display.

---

# State synchronization

Deliberately **not** arbitrary remote commands/scripts. LAN synchronizes
state changes/diffs, conceptually:

> entity ID, revision, proposed state change → resulting revision

This fits the existing architecture (Entity + pure engine + explicit
mutation) far better than "execute this function on another phone."

## Conflict handling

Because multiple people can act at once, revisions matter — e.g. a player
modifies a resource at revision 51 while a DM request was built against
revision 50. The system must detect that mismatch rather than silently
overwriting one side. The session host serializes canonical LAN updates.
Clear conflict-handling UX for "both sides changed the same state while
disconnected" is still an open design question.

---

# Later

- DM transfer (see Core principle above)
- Possibly host migration (moving the actual LAN server between devices —
  more technically involved, not needed for v1)
- Richer offline reconciliation
- More granular visibility/permissions
- Encounter/session undo, if we decide to add it

---

# Explicit non-goal: automatic timer authority

Duration tracking stays informational unless the table explicitly opts into
stronger automation. This principle applies uniformly to conditions, spells,
effects, concentration, and LAN — the app tracks and reminds; a human always
confirms when something actually ends.
