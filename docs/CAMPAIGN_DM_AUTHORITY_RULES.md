# Campaign & DM Authority Rules v1

## Purpose

This document defines how Grimoire should handle:

- persistent campaigns
- DM authority
- player character ownership
- live-session Host / DM / Player roles
- campaign rule management
- player rule suggestions
- character visibility
- monster visibility
- permanent character changes
- temporary combat consequences
- session logs
- secret information
- prepared encounters
- DM rewards
- live-session joining by room code, QR, or IP

The governing principles are:

> **The DM controls the campaign, but the Player controls the character.**

> **The Host controls the room, but hosting does not grant DM authority.**

> **Campaign rules define the table's defaults, while Quick Overrides handle exceptions.**

> **Players receive only information the DM has actually revealed.**

> **Grimoire records and applies the table's decisions; it does not replace the table.**

---

# 1. Ownership Model

There are three distinct ownership domains.

## Campaign Ownership

The **DM owns and manages the campaign**.

A campaign:

- exists independently of a live session;
- can be created and prepared entirely offline;
- contains campaign rules;
- contains prepared encounters;
- contains campaign notes;
- contains DM-only information;
- contains campaign content permissions;
- contains campaign rewards;
- contains campaign history;
- can later attach to any compatible live Host.

## Character Ownership

The **Player remains in control of their own character**.

Joining a campaign does not transfer ownership of the character to the DM.

The DM may directly apply temporary game consequences, but permanent structural character changes follow the campaign's configured approval policy.

## Live-Session Ownership

The **Host owns the temporary live networking room**.

The Host owns:

- the live room;
- participant connections;
- authoritative live-session state;
- reconnect identity;
- synchronization.

Host does **not** automatically equal DM.

Valid arrangements include:

- Host-only + separate DM + Players;
- Host+DM on one device + Players;
- DM connected to someone else's Host;
- Players connected only as Players.

A remote participant must never be able to grant itself Host or DM authority.

---

# 2. Campaign and Live Session Are Separate

Creating a campaign must never require starting or hosting a live session.

A DM should be able to:

1. create a campaign;
2. configure campaign rules;
3. prepare encounters;
4. prepare notes;
5. install or permit campaign content;
6. prepare rewards and effects;
7. close the app;
8. return later;
9. run entirely offline if desired;
10. optionally attach the campaign to a live room.

A campaign may connect to:

- Host A today;
- Host B next week;
- no Host during preparation.

Therefore:

`campaignId != sessionId != roomCode`

Ending a live session must not delete or reset the campaign.

---

# 3. Campaign Rules Are DM-Managed

The DM defines the campaign's effective rules.

Examples include:

- point-buy budget;
- ability-score generation method;
- ASI / feat / both;
- HP mode;
- multiclassing allowed;
- maximum level;
- flanking;
- proficiency-dice variants;
- starting feat rules;
- Large weapon handling;
- rest variants;
- content permissions;
- player Free Edit permissions;
- visibility rules;
- monster information visibility;
- homebrew permissions;
- other typed house rules.

Campaign rules should be mechanically enforced where the engine supports them.

If a rule cannot be enforced mechanically, it may still exist as a clearly marked **reminder-only** campaign rule.

---

# 4. Players May Suggest Campaign-Rule Changes

Campaign-rule suggestions are **enabled by default**.

Any Player may propose a campaign-rule change.

A Player suggestion does **not** activate automatically.

The DM may:

- Accept;
- Modify;
- Reject.

Only the DM can activate a campaign-rule change.

---

# 5. Campaign Rules May Change Mid-Session

The DM may change campaign rules **even during an active session**.

A rule change applies from the point it becomes active unless the DM explicitly applies it retroactively.

The app should not silently rewrite already-resolved past events.

---

# 6. Campaign Rule History

Meaningful campaign-rule changes should preserve history.

Record:

- previous value;
- new value;
- who changed it;
- timestamp;
- session, if applicable;
- optional reason or note.

This technical/audit history is separate from the narrative session log.

---

# 7. Player Character Visibility

Default:

> **A Player sees their own character only.**

Campaign rules may broaden visibility.

Recommended campaign setting:

## Player Character Visibility

### Own Character Only

Default.

### Party Summary

Other Players may see selected summary fields such as:

- name;
- portrait;
- class/level;
- public HP state;
- public conditions;
- selected public notes.

### Full Party Sheets

Players may inspect other Player character sheets, subject to each character owner's privacy projection.

---

# 8. Player-to-Player Character Privacy and False Information

Players control what **other Players** see about their character.

A Player may:

- hide selected fields;
- hide whole sections;
- expose only summaries;
- show alternate information;
- show intentionally false information.

There is **no transparency requirement between Players**.

Other Players do not need to be told that a field is hidden or false.

The DM remains able to access the authoritative character state required to run the campaign.

---

# 9. DM Access to Campaign Characters

The DM may inspect authoritative campaign-character information necessary to run the game.

Examples:

- HP;
- AC;
- speed;
- passive scores;
- conditions;
- exhaustion;
- concentration;
- resources;
- spell slots;
- death/dying/stable state;
- features;
- real values hidden from other Players.

This does not transfer character ownership to the DM.

---

# 10. Monster Visibility

Players should not automatically receive a full monster stat block.

Monster information uses field-level visibility.

Recommended defaults:

| Monster Information | Default |
|---|---|
| Portrait | Visible |
| Display name | Visible if publicly known |
| Creature type | Visible |
| Visible conditions | Visible |
| HP state | Visible |
| Exact HP | Hidden |
| AC | Hidden |
| Exact saves | Hidden |
| Resistances / immunities | Hidden |
| Abilities / features | Hidden |
| Full stat block | DM-only |
| Secret identity | DM-only |

The DM can override any field.

---

# 11. Monster Identity May Be Hidden

The DM may explicitly hide:

- monster name;
- creature type;
- portrait;
- exact identity.

---

# 12. Monster HP Visibility

Default:

> **Players see HP state, not exact HP.**

Recommended campaign setting:

## Monster HP Visibility

- Hidden completely
- State only **(default)**
- Exact current HP
- Exact current/max HP

The DM may override visibility per monster.

---

# 13. Dynamic Information Reveal

Monster and campaign information may be revealed dynamically.

Examples:

- successful lore check reveals creature type;
- investigation reveals resistance;
- transformation reveals a new portrait;
- NPC introduces itself and name becomes public;
- DM reveals exact HP;
- DM reveals an ability after it is used.

The DM decides when table knowledge changes.

---

# 14. Secret Information Must Not Be Sent to Unauthorized Clients

Secret data must not merely be downloaded and hidden in UI.

It must be absent from unauthorized projections.

Examples:

- DM-only notes;
- hidden monster identity;
- secret effects;
- future encounter contents;
- hidden triggers;
- unrevealed motives;
- hidden counters;
- prepared-but-unrevealed content.

A Player may receive a mechanical consequence without receiving the secret source.

---

# 15. Permanent Character Changes

The Player remains in control of permanent character development.

Permanent changes may include:

- ability-score changes;
- permanent max-HP changes;
- permanent feature grants;
- permanent feature removal;
- permanent item changes;
- reward features;
- permanent proficiency changes;
- class/subclass changes;
- permanent spell access;
- structural character changes.

The handling of DM-initiated permanent changes is controlled by campaign rules.

---

# 16. DM Permanent Reward Policy

Campaign rules determine how DM-granted permanent rewards are applied.

Recommended setting:

## Permanent DM Rewards

### Require Player Approval

The DM proposes the reward.

The Player may:

- Accept;
- Modify;
- Reject.

The accepted version is applied.

### Apply Automatically

The DM may grant the permanent reward directly.

The reward is applied immediately with:

- provenance;
- history;
- grant source;
- tier lineage if applicable.

---

# 17. Temporary Game Consequences Do Not Require Player Approval

The DM may directly apply temporary or immediate game-state consequences.

Examples:

- damage;
- healing;
- temporary HP;
- conditions;
- exhaustion caused by play;
- concentration breaks;
- temporary effects;
- encounter effects;
- secret effects;
- initiative;
- death/dying state;
- temporary resource changes.

Rule:

> **Permanent structural character change -> campaign approval policy.**

> **Temporary game consequence -> DM may apply directly.**

---

# 18. Change Requests Preserve History

Permanent change requests should preserve:

- original request;
- Player modification;
- DM modification;
- final accepted version;
- rejection if rejected;
- timestamps;
- acknowledgement state.

A modification must not erase the original request.

---

# 19. Reconnect Must Be Exactly-Once

If a Player disconnects:

- pending requests remain pending;
- already-applied changes do not apply again;
- effects do not duplicate;
- resources do not duplicate;
- secret visibility remains unchanged;
- participant identity remains the same.

The 7-character room code identifies **which room**.

The participant token identifies **who the reconnecting participant is**.

---

# 20. Session Logs Are Selective

Session logs are for **major events or DM-decided events only**.

Do not automatically add every action to the narrative log.

Appropriate session-log entries include:

- encounter started;
- encounter resolved;
- boss defeated;
- major NPC death;
- major quest outcome;
- milestone;
- permanent reward granted;
- major permanent character change;
- major rule change;
- DM-marked event.

The DM should have an explicit **Add to Session Log** control.

---

# 21. Audit History and Session Log Are Different

## Audit / History

Technical and accountability history.

## Session Log

Narrative campaign history.

Do not combine both into one giant log.

---

# 22. DM-Only Campaign Data

Only the DM can manage campaign-authoritative secret information.

Examples:

- DM-only notes;
- hidden encounter prep;
- hidden monster data;
- secret effects;
- unrevealed encounter content;
- secret triggers;
- private rulings.

Host-only users must not gain access merely because they host the network room.

---

# 23. Prepared Encounters Are Not Automatically Active

A prepared encounter may exist in the campaign indefinitely.

Recommended encounter states:

- Prepared
- Active
- Completed
- Archived

Connecting the campaign to a live room does **not** activate prepared content.

Only the DM may explicitly **Activate Encounter**.

---

# 24. DM Encounter Control

When an encounter is active, the DM should have fast operational controls.

Examples:

- initiative order;
- next turn;
- turn correction;
- damage;
- healing;
- temporary HP;
- reduce to 0;
- stabilize;
- add/remove condition;
- add/remove effect;
- concentration;
- resources;
- monster recharge;
- secret effect;
- public effect;
- activate/deactivate monster;
- reveal/hide monster fields.

The app should assist table play rather than simulate the entire world.

---

# 25. Effect Lifecycle Is Per Target

One effect may target several creatures.

Each target has its own lifecycle.

Recommended states:

- ACTIVE
- DUE_TO_END
- ENDED

Ending one target must not silently end the others.

---

# 26. Public and Secret Effects Share One Effect System

Effects should use the same underlying rules engine.

Visibility may be:

- Public
- Secret / DM-only

The mechanical payload may still affect the target even when the effect identity is hidden.

---

# 27. Campaign Rule Priority

Recommended effective-rule precedence:

1. **One-off DM Quick Override**
2. **Campaign Rules**
3. **Character-specific permanent rules/features**
4. **Ruleset defaults**

For persistent content precedence:

1. explicit homebrew override;
2. selected campaign content;
3. ruleset/default content.

---

# 28. Quick Override vs Campaign Rule

Use **Campaign Rule** when:

> "This is how our campaign works."

Use **Quick Override** when:

> "This one situation is an exception."

Do not force the DM to rewrite campaign rules for one exception.

---

# 29. Campaign Content Permissions

The DM controls which content is accepted for the campaign.

Possible states:

- Allowed
- Not Allowed
- Approval Required

This may apply by:

- source;
- pack;
- species;
- class;
- subclass / Bound Spirit;
- feat;
- spell;
- item;
- monster;
- custom condition.

A Player having content installed locally does not automatically make it campaign-legal.

---

# 30. Existing Characters Are Not Silently Rewritten by Rule Changes

If a campaign rule changes after a character already exists, Grimoire should not silently destroy or rewrite the character.

Existing characters may be:

- grandfathered;
- flagged;
- migrated only through an explicit DM/player workflow.

Campaign rules mainly constrain future choices unless an explicit retroactive migration is approved.

---

# 31. Enforced vs Reminder-Only Rules

Every campaign rule should indicate whether Grimoire can enforce it.

Examples:

**Flanking**
- Mechanically enforced

**Travel exhaustion variant**
- Table-resolved

The app must not claim automation it does not perform.

---

# 32. Live Session Belongs on the Campaign Page

Live Session should be part of the campaign page rather than a floating global header.

Offline state:

## Live Session

- Host Session
- Join Session
- Advanced: Connect by IP

Hosting state:

## Live Session — Hosting

- 7-character room code
- Show QR
- participant count
- Open Host View
- End Session

Connected DM state:

## Live Session — Connected as DM

- room code
- Host identity
- participant count
- active encounter
- Open DM View
- Disconnect

Connected Player state:

## Live Session — Connected as Player

- room code
- selected character
- connection state
- Open Player View
- Leave Session

---

# 33. Join Methods

Normal join UX:

1. **7-character room code**
2. **QR code**
3. **Direct IP** under Advanced

The room code is for session discovery and joining.

It is not:

- DM permission;
- Host permission;
- reconnect identity.

QR must not encode privileged authority.

---

# 34. Room Code Rules

The room code identifies the temporary live session.

It should use an ambiguity-safe alphabet such as:

`ABCDEFGHJKLMNPQRSTUVWXYZ23456789`

Example:

`K7M4XQP`

Room code must not become permanent campaign identity.

---

# 35. QR Rules

The QR may encode:

- room code;
- host LAN address;
- port;
- temporary session identity.

The QR must not encode:

- DM authorization secret;
- Host authority;
- secret campaign data;
- DM-only state.

Scanning the QR should only initiate a normal participant connection.

---

# 36. Reconnect Identity

Room code answers:

> "Which room?"

Participant token answers:

> "Who are you?"

Reconnect should reuse the stored participant token so the Host restores the same participant identity.

---

# 37. DM Dashboard

The Campaign page should expose the DM dashboard even when offline.

Per-character cards may show:

- name;
- portrait;
- class/level;
- HP;
- AC;
- speed;
- passive scores;
- conditions;
- concentration;
- exhaustion;
- class resources;
- spell slots;
- death/dying/stable state;
- connection state during Live Session.

---

# 38. Running Campaign vs Character Builder

Once a character is in a running campaign, normal campaign evolution should not force the Player back through character creation.

Changes happen through:

- normal level-up;
- Free Edit if allowed;
- campaign rewards;
- DM change requests;
- homebrew feature grants;
- temporary effects;
- Quick Overrides.

A running character is an ongoing entity, not a creation draft.

---

# 39. Mid-Campaign Rewards

The DM may grant campaign rewards such as:

- features;
- resources;
- proficiencies;
- permanent modifiers;
- reward tiers;
- campaign abilities.

Permanent reward application follows the campaign's **Permanent DM Rewards** policy:

- Require Player Approval; or
- Apply Automatically.

Tier upgrades should replace earlier tiers rather than stack duplicate modifiers.

---

# 40. Player Rule Suggestions Default to On

Campaign-rule suggestions are enabled by default.

Players may propose changes at any time unless the DM disables suggestions for that campaign.

The DM remains the only authority who can activate a campaign-rule change.

---

# 41. No World-Simulator Expansion

Do not add systems merely because a DM could track them.

Avoid turning Grimoire into:

- autonomous political simulation;
- NPC AI;
- continuous world clocks;
- economy simulation;
- mass-combat simulation;
- automatic campaign-event generation;
- universal scripting DSL.

The table decides what happens.

Grimoire records and applies those decisions.

---

# Final Authority Summary

## DM

Controls:

- campaign;
- campaign rules;
- campaign content permissions;
- prepared encounters;
- encounter activation;
- monster visibility;
- secret campaign information;
- temporary consequences;
- rule-change approval;
- session-log decisions;
- permanent reward behavior according to campaign policy.

## Player

Controls:

- their own character;
- permanent character decisions under the configured campaign workflow;
- what other Players see about their character;
- hidden/false public character information;
- campaign-rule suggestions.

## Host

Controls:

- temporary live room;
- participant connections;
- synchronization;
- authoritative live-session transport state.

Host does not automatically gain DM authority.

---

# Short Form

> **DM owns campaign.**

> **Player owns character.**

> **Host owns room.**

> **Players may suggest rules by default.**

> **Only DM activates campaign-rule changes.**

> **DM rewards may be approval-based or automatic, dictated by campaign rules.**

> **Players may hide or falsify what other Players see, with no transparency requirement.**

> **Secret DM data is absent from unauthorized client projections.**

> **Campaign persists independently of Live Session.**

> **Prepared content never becomes active until the DM activates it.**
