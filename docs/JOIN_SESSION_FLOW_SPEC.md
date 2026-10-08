# Join Session Flow Spec

Design notes supplied by the developer as forward direction for Join Session. Not yet implemented
in this form — the current `JoinModal` is a single room-code field + role chips + Join button,
no confirmation step, no compatibility check, no explicit reconnect-by-token screen.
Cross-reference `CAMPAIGN_PAGE_MODEL_SPEC.md` and `CAMPAIGN_DM_AUTHORITY_RULES.md`.

---

The Join Campaign / Join Session flow should be about joining an existing live room, choosing your role, and attaching the right local character or campaign context. It should not create a campaign and should not grant authority just because someone knows the room code.

A clean flow would be:

## Join Session

Choose how to connect:

- 7-character room code — primary
- Scan QR — equally prominent
- Direct IP — under Advanced

After the room is found, show a confirmation screen with:

- room/session name
- Host identity/device label
- whether a campaign is attached
- campaign name, if public
- current participant count
- whether approval is required

Then choose a role:

- Player
- DM

There should be no Host option here. Host is created locally when starting the room and cannot be remotely requested.

## Player path

For Player, the next step is character selection:

- choose an existing local character
- optionally create/import a character if the campaign allows it
- show whether that character is compatible with the campaign rules/content
- if there is a mismatch, show it before joining rather than silently rewriting anything

Examples:

- homebrew pack not allowed
- level above campaign max
- disallowed subclass
- ruleset mismatch
- missing required content

The Player can still join if the campaign policy allows grandfathered/approval-required characters, but the app should clearly show what needs DM approval.

Then: **Request to Join**

If approval is required, the Host/DM sees the join request. Once approved, the Player receives only their authorized live projection.

## DM path

For DM, the next step is different:

- choose an existing local campaign to attach
- or connect as DM without attaching one yet, if you want to support that
- request DM authorization
- wait for Host approval if required

The DM's campaign must remain local/persistent. Joining does not transfer campaign ownership to the Host.

A useful DM join flow is:

1. Enter room code / scan QR.
2. Select Join as DM.
3. Choose local campaign.
4. Host approves DM capability.
5. Campaign attaches to the room.
6. Prepared content remains inactive.
7. DM explicitly activates encounter/content when needed.

## Reconnect

For reconnects, the app should detect an existing participant token and prefer:

**Reconnect as Nika / Mira**

rather than making the user create a new participant. That is important for exactly-once state.

A good reconnect screen might say:

```
Previous participant found
Character: Mira
Role: Player
Reconnect
```

The room code only tells Grimoire which room. The participant token tells it who you already are.

## Player-to-Player visibility

One more important rule: if a Player joins a campaign where other Players are visible, they should only receive those Players' public projections, including any hidden or false information those owners chose to show. They should never receive authoritative character state for other Players.

## Short model

Join as Player → select character → request/approve → receive Player projection.
Join as DM → select campaign → request/approve DM capability → attach campaign.
No remote Host role.

And the normal UX should be: Room Code / QR first, IP only as fallback.
