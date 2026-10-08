# DM Screen Spec

Design notes for the DM operational screen (`/live/dm`), supplied by the developer as forward
direction. Not yet implemented in this form — the current `/live/dm.tsx` is a much smaller screen.
Cross-reference against `CAMPAIGN_DM_AUTHORITY_RULES.md`, which this spec is consistent with.

---

The DM screen should be the operational cockpit for a running campaign, not another campaign editor and not a Host-management screen.

The clean mental model is:

Campaign page = prepare and configure the campaign.
DM screen = run the campaign right now.
Host screen = run the network room.

So on the DM screen, I'd include the following functionality.

## 1. Session overview

At the top, the DM should immediately see the current live state:

- campaign name
- current session status
- room code if connected live
- Host identity
- connected Players
- active encounter, if any
- current initiative/turn
- public/secret effect counts
- pending character-change requests
- pending rule suggestions
- connection warnings/reconnect state

The DM should never have to switch to the Host screen just to know whether Players are connected.

## 2. Party dashboard

This should be the core of the screen.

One compact card per Player character showing:

- portrait/name
- class/level
- current/max HP
- temp HP
- AC
- speed
- passive Perception/Insight/Investigation if useful
- conditions
- exhaustion
- concentration
- death/dying/stable state
- major class resources
- spell-slot pips
- active public effects
- active secret effects visible only to DM
- connection status

Tapping a character opens the DM Character View.

The card should also have fast actions for:

- Damage
- Heal
- Temp HP
- Add Effect
- Remove Effect
- Add Condition
- Exhaustion
- Kill / Set to 0
- Stabilize
- Concentration
- Quick Override

This is where most DM interaction should happen during play.

## 3. DM Character View

This should be a read-only mirror of the Player sheet by default, not a second editable character builder.

It should show the same core tabs/details the Player sees, but with DM-only extras:

- authoritative values even if the Player shows false info to other Players
- hidden/private features
- all effects
- provenance/source of modifiers
- campaign-rule effects
- reward history
- pending permanent changes
- character visibility projection for other Players

From here, the DM can issue a permanent change request rather than directly editing permanent character structure, unless campaign rules allow automatic DM rewards.

## 4. Permanent change requests

The DM screen needs a dedicated queue.

For each request, show:

- Player
- requested change
- original version
- modified version, if any
- who modified it
- current status
- timestamp
- history

Actions:

- Accept
- Modify
- Reject

If campaign rules allow automatic DM rewards, those do not need approval, but should still have provenance/history.

## 5. Rule suggestions

Players can suggest campaign-rule changes by default, so the DM screen needs a Rule Suggestions inbox.

Each suggestion should show:

- proposed rule
- old value
- proposed value
- Player note/reason
- whether it can be mechanically enforced or is reminder-only

DM actions:

- Accept
- Modify
- Reject

Accepted changes should update the campaign immediately, even mid-session.

## 6. Active encounter control

If an encounter is active, the DM screen should show a compact encounter panel without forcing navigation away.

Core controls:

- initiative order
- current turn
- next turn
- previous/correct turn
- round count
- activate/deactivate participant
- add/remove monster
- damage/heal
- conditions/effects
- concentration
- monster resource/recharge
- kill/stabilize
- reveal/hide monster fields

If the DM wants full detail, open the full Encounter screen.

## 7. Prepared encounters

The DM screen should show prepared encounters separately from the active one.

Each prepared encounter card should have:

- name
- participants/monsters
- public effects
- secret effects
- notes
- readiness/status

Actions:

- Preview
- Edit
- Activate

Crucially: connecting to a live session must never auto-activate a prepared encounter.

## 8. Effects panel

A dedicated Effects section should show active campaign/session effects.

Split them visually by:

- Public
- Secret / DM-only

For each effect:

- source
- targets
- duration
- lifecycle per target
- ACTIVE / DUE_TO_END / ENDED
- mechanical consequence
- whether automation is real or table-resolved

The DM must be able to:

- add target
- remove target
- end for one target
- end for all targets
- mark Due to End
- convert public ↔ secret where appropriate
- inspect source/provenance

## 9. Monster visibility controls

For each active monster, the DM should control what Players see.

Per-field toggles:

- name
- portrait
- creature type
- conditions
- HP state
- exact HP
- AC
- resistances
- abilities
- full stat block

There should also be quick presets:

- Hidden
- Minimal
- Standard
- Full Reveal

And the DM can change this dynamically during play.

## 10. Player visibility controls

The DM should see each Player's current projection to other Players.

The Player controls what other Players see, including false information, but the DM needs to see:

- authoritative value
- public value shown to Players
- hidden/false fields

The DM should not automatically override Player-to-Player privacy unless campaign rules explicitly permit that.

## 11. Campaign rules quick panel

The DM screen should have a quick access panel for rules that are likely to change during play:

- monster HP visibility
- Player sheet visibility mode
- Free Edit permission
- homebrew approval mode
- permanent reward policy
- rule suggestions enabled
- relevant combat variants

This should not replicate the full Campaign Rules editor. It should link to that for deeper changes.

## 12. Quick Override

This should be prominent.

The DM should be able to create a one-off temporary exception without rewriting campaign rules.

Examples:

- +2 AC until end of encounter
- speed becomes 0
- advantage on next save
- immunity to one effect
- temporary max-resource change
- custom note/reminder

Every Quick Override should show:

- source: DM Override
- duration
- target
- whether it is public or secret

## 13. Rewards

A Rewards section should let the DM grant:

- stored homebrew feature
- resource
- proficiency
- reward tier
- permanent modifier
- campaign boon

The campaign's Permanent DM Rewards rule determines whether this:

- applies immediately
- or becomes a Player approval request

Tiered rewards should replace the previous tier, preserve spent uses, and keep upgrade history.

## 14. Session log

Keep this intentionally lightweight.

The DM should see recent major entries and have: **Add to Session Log**

Suggested quick event types:

- Major event
- Encounter outcome
- NPC death
- Quest outcome
- Reward
- Milestone
- Rule change
- Custom note

Do not auto-log every roll or HP change.

## 15. DM-only notes

A quick private note area is useful during play.

Support:

- session notes
- encounter notes
- Player-specific notes
- monster/NPC notes
- reminders

These must never be projected to Players.

## 16. Live-session controls

The DM screen should show live-session status, but not become the Host screen.

Useful DM-side controls:

- connected Players
- disconnected Players
- reconnect status
- campaign attached to room
- room code
- open Host view if same device is Host+DM
- disconnect campaign from live room

The DM should not manage network-level Host authority unless they are also the Host.

## 17. Secret/public preview

One very useful feature would be: **Preview as Player**

Not impersonating or changing state — just showing the current authorized projection for a selected Player.

That lets the DM verify:

- monster visibility
- secret effect hiding
- Player-visible character info
- public encounter notes
- active effects

This would be especially valuable given the strict "secret data absent from projection" rule.

## 18. Alerts / attention queue

At the top or side, surface only things needing DM action:

- pending permanent change
- pending rule suggestion
- effect Due to End
- monster recharge available
- Player disconnected
- concentration check needed
- secret trigger fired
- zero-HP trigger queued
- reward awaiting approval

This keeps the DM screen operational instead of cluttered.

## 19. What should NOT be on the DM screen

Do not put full authoring workflows there for:

- class creation
- spell creation
- item creation
- monster builder
- full campaign settings
- pack import/export
- Host transport internals

Those belong elsewhere.

The DM screen should optimize for seconds-per-action during play.

## Recommended layout

Top bar:

- campaign
- live status
- room code
- current encounter
- alerts

Main tabs:

- Dashboard
- Encounter
- Effects
- Requests
- Notes

Then keep behind quick panels or secondary navigation:

- Rules
- Prepared Encounters
- Rewards
- Visibility

The most important design principle is: the DM should be able to handle 90% of live play from the Dashboard and Encounter tabs without digging through menus.
