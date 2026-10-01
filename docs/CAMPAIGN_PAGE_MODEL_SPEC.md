# Campaign Page Model Spec

Design notes supplied by the developer as forward direction for the Campaigns page's top-level
structure. Not yet implemented in this form — the current page has three buttons (Create Campaign
(DM) / Host Campaign / Join Campaign (Player)) wired directly to `CreateModal`/`HostModal`/
`JoinModal`. Cross-reference `CREATE_CAMPAIGN_FLOW_SPEC.md`, `HOST_SESSION_FLOW_SPEC.md`,
`JOIN_SESSION_FLOW_SPEC.md`, and `CAMPAIGN_DM_AUTHORITY_RULES.md`.

**Open question this spec raises, not yet resolved with the developer:** this proposes
`Create Campaign / Open Existing Campaign / Join Live Session` as the three top-level buttons —
with Host folded into an existing campaign's own Live Session section rather than being a
top-level button — which differs from the literal `Create / Host / Join` three-button set
actually shipped. Confirm which is current intent before restructuring again.

---

Right now [the Campaigns page] still reflects the old mental model:

DM creates a campaign and gets a room code.
Player joins that campaign.

That is no longer the architecture wanted.

The page should instead present campaign access, not immediately conflate campaign creation with live hosting.

A reasonable restructure:

## Top state

Keep:

- No Active Campaign
- the name field, if wanted, for a local profile/display name

Then use three primary actions instead of two:

- Create Campaign
- Open Existing Campaign
- Join Live Session

The wording should not say `(DM)` and `(Player)` on the buttons anymore, because the role is determined later.

For example:

**Create Campaign** — Create a persistent campaign workspace and manage it as DM.

**Open Campaign** — Continue one of your existing campaigns.

**Join Live Session** — Join an existing room as Player or DM.

Then, only after choosing Join Live Session, ask:

- Player
- DM

There should be no Host role there.

For hosting, the user goes into an existing campaign and uses the Live Session section: **Host Session** — or, if they want Host-only with no campaign attached, that can live under a separate Live Session / Host screen rather than campaign creation.

## "How it works" text

The current line is wrong:

> "DM creates a campaign — gets a room code + QR"

Campaign creation should not generate a room code. A better version:

- Create or open a campaign to prepare and manage it offline
- Start a Live Session only when you want to play over LAN
- Players or DMs join with a 7-character room code or QR
- HP, effects, conditions, and approved live changes sync during the session
- Campaigns and characters persist offline — no internet required

Also change "Join Campaign (Player)" to "Join Live Session," because you may join as DM as well.

## Recent campaigns

If the app detects existing campaigns, this screen should probably not still say "No Active Campaign" with only a create action. It should show a compact recent-campaign section, e.g.:

```
Recent Campaigns
- The Pressure Vault
- Alu Mutum
- Test Campaign
```

with Open buttons.

## Resulting hierarchy

```
No Active Campaign
Your Name
Create Campaign
Open Existing Campaign
Join Live Session
How It Works
```
