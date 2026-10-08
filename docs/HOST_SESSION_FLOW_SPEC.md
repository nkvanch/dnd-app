# Host Session Flow Spec

Design notes supplied by the developer as forward direction for Host Session. Not yet implemented
in this form — the current `HostModal` is a single role-choice + policy-choice + Start button.
Cross-reference `CAMPAIGN_PAGE_MODEL_SPEC.md` and `CAMPAIGN_DM_AUTHORITY_RULES.md`.

---

The Host Campaign / Host Session flow should be much simpler than Create Campaign, because hosting does not define the campaign. It creates the temporary live room and optionally attaches a campaign to it.

The mental model should be:

Create Campaign = persistent DM workspace.
Host Session = temporary live room.
Attach Campaign = optional DM action inside that room.

A good Host screen/flow would be:

## Host Session

First choose whether this device is:

- Host only
- Host + DM

If Host only, no campaign needs to be selected at all.

If Host + DM, select one existing campaign to attach. Do not create a new campaign implicitly here.

Then configure the room:

- room name, optional
- 7-character room code, generated automatically
- local network port, hidden under Advanced
- whether new participants require approval
- maximum participants, optional
- QR code for joining
- direct-IP fallback under Advanced

Then: **Start Session**

Once started, show a clear Host dashboard:

## Live Room

- Room code: `K7M4XQP`
- QR button
- local IP/port under Advanced
- session status
- participant count
- connected participants
- reconnecting/disconnected participants
- pending join approvals
- role for each participant
- campaign attached, if any

The Host should be able to:

- approve/reject joins
- assign or approve DM role where allowed
- revoke DM role
- disconnect/kick a participant
- see connection/reconnect state
- end the session
- open Host diagnostics if needed

But the Host should not automatically be able to:

- read DM-only notes
- activate encounters
- reveal monsters
- change campaign rules
- edit Player characters
- see secret effects

...unless this device is also explicitly DM.

For Host + DM, after starting the room, the same device should get both:

- Host controls
- DM controls

without conflating them internally.

The attached campaign should remain independent. Hosting should never copy or transform the campaign into "the Host's campaign."

So:

`Campaign A` can attach to `Session K7M4XQP`, then later detach and attach to `Session R4W8N2P` with the same campaign data intact.

The room code should be temporary and regenerated for each new live room. The campaign should not remember it as permanent identity.

QR should encode only enough to locate/join the room, never privileged credentials. A Player scanning it still joins as an unprivileged participant until approved.

## Flow summary

1. Choose Host only or Host + DM
2. If Host + DM, choose campaign
3. Start room
4. Show room code + QR
5. Approve participants
6. Run session
7. End session

That is enough for normal use. Everything else — IP, ports, discovery diagnostics — belongs under Advanced.
