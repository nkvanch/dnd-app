# LAN Player Screen Spec

Design notes supplied by the developer as forward direction for the Player-side live-session UI.
Not yet implemented in this form. Cross-reference `DM_SCREEN_SPEC.md` (the DM-side equivalent),
`HOST_SESSION_FLOW_SPEC.md`, `JOIN_SESSION_FLOW_SPEC.md`, and `CAMPAIGN_DM_AUTHORITY_RULES.md`.

**Status:** saved for later. Current priority (per the developer, same message) is: spell list
create/import/export on the Homebrew tab, then the broken E2E entry point, then the PR #1
(`emperor-warlock-engine-unblock`) merge decision — in that order. Not started yet.

---

I think that's the right direction.

The LAN Player screen should stay the normal character sheet, with a small layer of live-session
functionality added around it. That avoids making players learn a second interface just because
they connected to a campaign.

I'd add only a few things.

## Live session status

A compact strip somewhere near the top showing:

- connected / reconnecting / offline
- room code
- current campaign
- current encounter name if one is active
- whose turn it is, if initiative is running

This should be informative, not take over the screen.

## Current live effects

The normal character sheet already shows conditions/effects, so LAN should just make sure
live-session effects appear there properly.

Useful additions:

- Public effect badge
- Due to End badge
- Secret-source mechanical consequence still applied without revealing the secret name
- tap to inspect public effect details

For example:

```
Braced
Active
AC +1, Speed -10
```

or, for a hidden effect:

```
Speed modified by live effect
```

without exposing why.

## DM requests

A small Requests button/badge on the normal character screen.

It should surface:

- permanent change requests
- reward approval requests
- DM modifications
- pending approvals
- accepted/rejected history

The player can:

- Accept
- Modify
- Reject

This is probably the single most important LAN-only addition.

## Rule suggestions

A small Suggest Rule Change action from the campaign/live menu.

Not on the main sheet itself necessarily, but reachable from the LAN context menu.

## Party/public view

A small Party button could open:

- other players' public projections
- visible HP state
- visible conditions
- public name/portrait/class if exposed
- connection state

This should use the other player's chosen public/false projection, never authoritative data.

## Encounter glance

I wouldn't make a whole Player Encounter screen mandatory.

Instead, add a collapsible live encounter panel:

- round
- current turn
- visible initiative order
- visible monsters
- visible monster HP state
- public environmental effects

That's enough for most players.

## "What others see"

This could be one of the nicest player-specific additions.

From the normal character sheet, add:

**Public Persona**

There the player can control:

- which sections other players see
- alternate displayed values
- hidden sections
- false public information
- public portrait/name if different

And ideally:

**Preview as Party**

so they can see exactly what other players receive.

## DM live actions affecting the player

If the DM applies:

- damage
- healing
- temp HP
- condition
- exhaustion
- effect

the normal character sheet should update in place.

No separate "sync screen" should be needed.

## Live notifications

Keep them lightweight:

- "DM requested a permanent change"
- "You received a reward"
- "Braced is Due to End"
- "You reconnected"
- "Campaign rule changed"

No giant chat-like event feed.

## Optional manual sync acknowledgement

For things that might need human confirmation, give a small banner like:

```
DM marked Concentration Check required
```

with:

- Roll in app
- I rolled physically
- Dismiss / Resolve

That fits your table-first philosophy.

## Summary

So my version would be:

Normal character sheet

- connection strip
- live effects
- requests badge
- Party button
- encounter glance
- Public Persona
- lightweight live notifications

I would not add separate tabs like Overview / Player / Live / Session unless the existing
character sheet becomes too crowded.

The best LAN player UX is probably:

"This is still my character sheet, it just becomes live-aware."
