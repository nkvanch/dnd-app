# Create Campaign Flow Spec

Design notes supplied by the developer as forward direction for the Create Campaign flow. Not yet
implemented in this form — the current `CreateModal` is a single name field + one button.
Cross-reference `CAMPAIGN_PAGE_MODEL_SPEC.md` and `CAMPAIGN_DM_AUTHORITY_RULES.md`.

---

The Create Campaign screen should be about defining the persistent campaign workspace and its defaults. It should not ask the user to host a room yet.

A good mental model is:

Create Campaign = define what this campaign is and how it works.
Campaign page = manage it afterward.
Live Session = optional later attachment.

I would keep the creation flow fairly compact, with advanced rules editable later.

A sensible structure would be:

- Campaign identity: campaign name, optional description, optional icon/cover, DM name/display name.
- Ruleset: choose edition/ruleset, e.g. 5e/2014-compatible first.
- Rule profile: choose default rules, existing custom profile, or "Customize now."
- Player permissions: whether Player Free Edit is allowed, whether campaign-rule suggestions are enabled, and whether permanent DM rewards require approval or apply automatically.
- Visibility defaults: player-to-player sheet visibility, monster HP visibility, monster info visibility.
- Content policy: which installed content/homebrew packs are allowed, approval-required, or blocked.
- Session/log defaults: major-events-only logging, whether DM-marked events are included.
- Create Campaign button.

I would not force the DM to configure every house rule on creation. Better UX is:

**Step 1 — Basics**

- Campaign name
- Description
- Ruleset

**Step 2 — Rules**

- Choose rule profile
- Quick toggles for important rules
- `Edit Full Rules` optional

**Step 3 — Permissions**

- Player rule suggestions: On by default
- Permanent DM rewards: Approval / Automatic
- Player Free Edit
- Player-to-player visibility policy

**Step 4 — Content**

- Allowed packs/content
- Homebrew approval mode

**Step 5 — Review**

- Summary
- Create

After creation, send the user straight to the Campaign page, where they can access:

- DM Dashboard
- Campaign Rules
- Characters
- Prepared Encounters
- Notes
- Content permissions
- Session history
- Live Session

## A few important rules for creation

- Creating a campaign must set the local user as DM of that campaign.
- It must create the persistent campaign object even with no network.
- It must not create a Host session.
- It must not generate a room code yet.
- It must not require Players to exist yet.
- Prepared encounters and live state should start empty/inactive.
- Campaign rules should be copied from the selected rule profile into the campaign so the campaign has its own persistent effective configuration.
- Later editing the original reusable profile should not silently rewrite an existing campaign unless the DM explicitly applies/syncs those changes.

I would also include a checkbox on the review step:

**Create with sample/prepared content**

- Off by default
- Could later be useful for demo campaigns

But I would not mix this with "Start Live Session."

The button text should be simply: **Create Campaign**, not **Create & Host** — unless you later add a separate secondary action after creation.

A compact version of the screen could look like:

```
Create Campaign
Campaign Name
Description
Ruleset
Rule Profile
Player Permissions
Visibility
Content Policy
Session Log Defaults
Create Campaign
```

Then after creation:

```
Campaign created
Open Campaign
Start Live Session
```

That preserves the architecture already chosen.
