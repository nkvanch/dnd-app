# FEATURE_QA_CHARACTER_SHEET.md

# Purpose

The Character Sheet is the primary gameplay surface of Grimoire.

Character Creation is used occasionally.

The Character Sheet is used every session.

Every design decision should prioritize:

1. Speed during play
2. Explainability
3. Offline functionality
4. Homebrew compatibility
5. DM visibility

The sheet must function equally well for:

* Official D&D 5e characters
* Homebrew D&D characters
* Future rulesets

---

# Core Principles

## Explain Any Number™

Every displayed value must be auditable.

No exceptions.

Examples:

* HP
* AC
* Initiative
* Speed
* Carry Capacity
* Attack Bonus
* Damage Bonus
* Spell Save DC
* Spell Attack Bonus
* Saving Throws
* Skills
* Passive Scores
* Resource Maximums

Every number must provide:

Current Value
↓
Source Breakdown
↓
Reason

Example:

AC 18

Breakdown:

10 Base
+4 Dexterity
+2 Shield
+1 Defense Fighting Style
+1 DM Override

Total: 18

---

## Physical Dice First

Grimoire is a companion app.

Not a virtual tabletop.

Players are expected to use physical dice.

Digital rolling exists as convenience.

Not requirement.

---

## Character Ownership

Players own characters.

Campaigns may create temporary overrides.

Campaigns do not permanently modify source characters.

---

# Navigation

Character Sheet contains persistent header and persistent rest bar.

Between them sits the active tab.

Tabs:

1. Combat
2. Actions
3. Abilities
4. Features
5. Inventory
6. Notes

Conditional:

7. Spellbook

Spellbook only appears when character has spellcasting capability.

---

# Header

Always visible.

Displays:

* Character Name
* Level
* Class
* Race
* HP
* AC
* Speed
* Sync Status

Example:

Level 5 Fighter Human

HP 38/52
AC 18
SPD 30

Low HP state:

Below 25% HP

Header visually warns player.

---

# Combat Tab

Purpose:

Most-used gameplay screen.

Should require minimal scrolling.

---

## HP Management

Displays:

Current HP
Maximum HP
Temporary HP

Supported Actions:

* Damage
* Healing
* Set HP
* Set Max HP
* Add Temp HP

All changes logged in timeline.

---

## Death Saving Throws

Visible only at 0 HP.

Rules:

Natural 20
→ Gain 1 HP

10+
→ Success

2-9
→ Failure

Natural 1
→ Two Failures

3 Successes
→ Stable

3 Failures
→ Dead

All tracked automatically.

---

## Combat Statistics

Visible at top.

Includes:

* AC
* Speed
* Initiative
* Passive Perception

Every value is tappable.

Opens Audit Modal.

---

## Attacks

Displays all available attacks.

Includes:

* Name
* Attack Bonus
* Damage
* Damage Type
* Range

Example:

Longsword

+7 to Hit

1d8+4 Slashing

All values auditable.

---

## Hit Dice

Displays:

Current
Maximum

Supported Actions:

Use
Roll

Roll:

App may roll digitally.

Use:

Player may roll physically.

Both supported.

---

## Conditions

Supported:

Official conditions.

Examples:

* Poisoned
* Blinded
* Restrained
* Charmed
* Frightened

Each displays reminder text.

Example:

Poisoned

Disadvantage on attack rolls and ability checks.

---

## Custom Conditions

Supported.

Created by:

* Homebrew
* DM
* Rulesets

Example:

Soulbound

Cannot move more than 30 feet from target.

---

## Concentration

Automatically tracked.

When damage occurs:

Prompt:

Make Concentration Check

Displays required DC.

---

## Resources

Examples:

* Rage
* Ki
* Sorcery Points
* Channel Divinity
* Bardic Inspiration

Universal resource structure:

Name
Current
Maximum

Supports:

* Spend
* Restore
* Audit

---

## Spell Slots

Displays slot pips.

Tracks:

Current
Maximum

Supports:

Use
Restore

Auditable.

---

## Level Up

Accessible from Combat tab.

Triggers:

* Level increase
* Feature grants
* Choice grants
* ASI/Feat selection

All results recorded in timeline.

---

# Actions Tab

Purpose:

Fast access to abilities.

---

## Categories

Grouped by:

* Actions
* Bonus Actions
* Reactions
* Free Actions

---

## Action Cards

Each card displays:

* Name
* Source
* Resource Cost
* Usage Status
* Key Mechanics

Example:

Fireball

Action

8d6 Fire

DEX Save

Concentration: No

---

## Availability

Unavailable actions are disabled.

Example:

No Level 3 Spell Slots Remaining

Reason displayed.

---

## Action Execution

Using action may:

* Spend Resource
* Spend Spell Slot
* Trigger Roll
* Apply Usage Tracking

Uses same execution pipeline as Spellbook.

Single source of truth.

---

# Spellbook Tab

Visible only to spellcasters.

---

## Sections

Cantrips

Level 1

Level 2

Level 3

etc.

---

## Spell Display

Each spell shows:

* Name
* School
* Range
* Duration
* Concentration
* Ritual

Expandable description.

---

## Filters

Supported:

* Search
* Level
* School
* Ritual
* Concentration
* Prepared

---

## Casting

Cast button uses same logic as Actions tab.

Must never duplicate casting systems.

---

## Prepared Spells

Ruleset-dependent.

Supports:

Prepared
Known
Always Prepared

---

# Abilities Tab

Purpose:

Character mathematics.

---

## Ability Scores

Displays:

* Effective Score
* Modifier

Example:

STR 18 (+4)

Tappable.

Audit required.

---

## Saving Throws

Displays:

Bonus
Proficiency Status

Tappable.

Audit required.

---

## Passive Scores

Displays:

* Passive Perception
* Passive Investigation
* Passive Insight

Tappable.

Audit required.

---

## Skills

Displays all skills.

Shows:

Bonus
Proficiency
Expertise

Tappable.

Audit required.

---

# Features Tab

Purpose:

Show everything character can do.

---

## Grouping

Grouped by source:

* Race
* Class
* Background
* Feat
* Item
* Campaign
* Homebrew

---

## Feature Display

Shows:

* Name
* Source
* Description

Expandable.

---

## Pending Choices

Displays unresolved character choices.

Examples:

* Skill Choice
* Spell Choice
* ASI
* Feat

Must be resolvable directly.

---

# Inventory Tab

Purpose:

Track possessions.

---

## Sections

Equipped

Carried

Stored

Currency

---

## Equipment

Supports:

Equip
Unequip

Immediately recalculates derived values.

Example:

Armor changes AC.

---

## Weight Tracking

Displays:

Current Weight

Maximum Capacity

Auditable.

---

## Currency

Ruleset-dependent.

D&D example:

CP
SP
EP
GP
PP

---

# Notes Tab

Purpose:

Player knowledge storage.

---

## Default Categories

* Backstory
* NPCs
* Goals
* Loot

---

## Custom Categories

Supported.

Players may create:

* Factions
* Mysteries
* Research
* Anything else

---

## Auto Save

Changes save automatically.

No manual save button.

---

# Audit Modal

Most important system in the application.

---

## Access

Every number is tappable.

No exceptions.

---

## Required Information

Displays:

Current Value

Calculation Breakdown

Source Attribution

Example:

Initiative +5

+4 Dexterity
+1 Alert Feat

Total: +5

---

## DM Overrides

Always visible.

Never hidden.

Example:

Speed 40

30 Base

+10 Boots of Speed

+5 DM Override

Total: 45

---

## Override Management

DMs may create:

Named Overrides

Example:

Blessing of Bahamut

+2 AC

Duration:

Until Removed

---

# Character Timeline

Automatically maintained.

Cannot be disabled.

---

## Events

Examples:

Character Created

Selected Race

Selected Class

Level Up

Feat Selected

Resource Modified

Character Death

Character Revival

DM Override Added

---

## Event Visibility

Players may view full history.

DMs may view full history.

---

# Dice System

Supports:

Physical Dice

Digital Dice

Hybrid Play

Physical dice remain primary design target.

---

# Permissions

## Player

May edit:

* Notes
* Resources
* Inventory
* Character Settings

May not modify:

* Campaign Rules
* DM Overrides

---

## DM

May edit any campaign-visible value.

Examples:

* HP
* Conditions
* Resources
* Inventory
* Features
* Notes

DM modifications create timeline entries.

---

# Success Criteria

A complete Character Sheet must:

* Explain every number
* Support physical play
* Support digital convenience
* Work offline
* Support homebrew mechanics
* Support custom resources
* Support custom conditions
* Record character history
* Respect campaign permissions
* Remain usable during live play with minimal taps
* Function as the primary gameplay surface of Grimoire
