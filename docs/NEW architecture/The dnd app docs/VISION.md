# Grimoire

## Product Vision

### The Problem

Most tabletop RPG software assumes the rules are fixed.

Character builders assume official races.
Character sheets assume official classes.
Campaign tools assume official progression systems.

Homebrew exists, but it is usually treated as an exception layered on top of a predefined game. That is acceptable only until a table decides to play differently.

The moment a group introduces custom races, custom classes, custom resources, custom progression, custom conditions, campaign-specific mechanics, or heavily modified rules, many tools stop helping and begin getting in the way.

Players fall back to spreadsheets.
Dungeon Masters fall back to notes.
Rule tracking becomes manual.
Mechanical truth becomes fragmented.

Grimoire exists because tabletop games are fundamentally creative.

The software should adapt to the table.
The table should not adapt to the software.

---

### The Core Belief

The foundation of Grimoire is simple:

> Rules are data.

A race is data.
A class is data.
A spell is data.
A feature is data.
A condition is data.
A resource is data.
A campaign rule is data.
A workflow is data.

That means official content and homebrew content should use the same systems.

The engine should never need a privileged distinction between:

- official content
- homebrew content
- imported content
- campaign content
- future content packs

If the development team can express a rule in the engine, users should eventually be able to express the same kind of rule through the application.

That is the product philosophy.

---

### What Grimoire Is

Grimoire is a rules-aware tabletop RPG platform.

Its first production ruleset is Dungeons & Dragons 5th Edition.

D&D 5e is not a prototype.

It is a complete, supported game system, and it is the initial proof that the runtime can handle a real tabletop ruleset with enough complexity to matter.

But D&D is not the end goal.

The architecture exists to support tabletop creativity in general.

The long-term goal is not to become a better PDF viewer or a more polished character sheet alone.

The long-term goal is to become the best environment for creating, modifying, explaining, and running tabletop game rules.

---

### What Makes Grimoire Different

Most RPG applications store information.

Grimoire understands information.

Most character sheets can display:

- AC 17
- HP 42
- Speed 30
- Spell Save DC 15

Grimoire should understand:

- why those values are what they are
- what contributed to them
- what would change them
- which rules are currently affecting them
- what the result of a rule change would be

This is a major distinction.

The application should not just remember a sheet.
It should understand the sheet.

That understanding is the core differentiator.

---

## Product Principles

Every feature should support at least one of these principles.

### 1. Homebrew First

Homebrew is not a secondary feature.

It is one of the main reasons the project exists.

If the application can create something internally, users should eventually be able to create the same class of thing themselves.

The experience of using homebrew should feel natural, not improvised.

A custom race should not feel like a hack.
A custom class should not feel like a loophole.
A custom condition should not feel like a spreadsheet workaround.

Official and custom content should feel like the same product, not two different systems stitched together.

---

### 2. Explain Everything

Every mechanical value should be inspectable.

Every derived value should be traceable to its roots.

A player should be able to ask:

- Why is my AC this high?
- Why do I have this spell save DC?
- Why is my speed reduced?
- Why did this resource increase?
- Why is this condition active?

And the application should answer clearly.

Explainability serves three purposes:

- learning
- trust
- debugging

A new player learns the game faster.
A veteran player trusts the result.
A homebrew creator can find mistakes quickly.

This is not optional polish.
It is a core product feature.

---

### 3. Play At The Table

Character creation matters.
Campaign preparation matters.

But the application must remain useful during live play.

The app should support the actual table experience:

- combat
- conditions
- resources
- spellcasting
- action management
- turn-by-turn state
- DM oversight
- encounter tracking

The best feature is the feature that saves time during play.

If a feature only looks good in a demo but is awkward at the table, it is not good enough.

---

### 4. Offline First

A game session should not depend on cloud infrastructure.

Characters should remain usable.
Campaigns should remain accessible.
Homebrew should remain editable.
The app should remain useful without internet.

Synchronization is a convenience.
Offline functionality is a requirement.

Players should own their data.
The table should not be blocked by a failed login, a dead server, or a missing connection.

---

### 5. Transparency Over Automation

The application should reduce bookkeeping.
It should not remove understanding.

The Dungeon Master remains the final source of truth.
The player remains in control of their character.
Automation should always remain explainable.

When the app changes a number, the user should know:

- what changed
- why it changed
- which rule caused it
- whether it came from content, state, or DM override

The software should assist judgment, not hide it.

---

## The Player Experience

A player should feel like the application understands their character.

The player should not need to:

- perform routine calculations
- search PDFs in the middle of play
- memorize modifier chains
- manually track common mechanical interactions
- guess where a number came from

The application should surface:

- available actions
- active effects
- resources
- conditions
- spellcasting
- derived values
- relevant rule explanations

The player should be able to move quickly from “what is happening?” to “what do I do next?”

The application handles bookkeeping.
The player handles decisions.

That is the ideal relationship.

---

## The Dungeon Master Experience

The Dungeon Master should have complete visibility into game state.

The DM should be able to understand:

- active conditions
- resource states
- encounter state
- monster state
- player state
- ongoing effects
- recent mechanical changes

without switching between multiple tools or manually recalculating hidden modifiers.

The application should reduce administration.

It should not reduce authority.

The DM remains the final source of truth at the table.

Any DM override should remain visible and explainable.
Any adjustment should remain transparent to players.

That transparency is important because trust at the table matters more than cleverness in the software.

---

## Character Creation Philosophy

Most character builders enforce a fixed workflow:

Race → Class → Background → Ability Scores → Skills → Equipment → Spells

Grimoire should not.

Character creation should be a workspace.
The wizard can suggest a path, but it should not become a cage.

Users should be able to:

- start at any level
- create content before creating characters
- import content first
- revisit decisions later
- skip irrelevant steps
- follow any order that matches their table’s process

This matters because tables do not always create characters in the same order.

Some tables start with concept.
Some start with class.
Some start with a custom rule.
Some start with equipment.
Some start with a campaign limitation.

The software should support that reality.

---

## Campaign Philosophy

Characters do not exist in isolation.

Campaigns should eventually become first-class entities.

A campaign may contain:

- characters
- monsters
- notes
- locations
- quests
- encounters
- loot
- house rules
- custom content
- session history

The application should help organize the wider play experience, not just the individual character sheet.

This is especially important for homebrew-heavy groups, where the campaign itself often defines the real rules of play.

---

## Homebrew Philosophy

Homebrew is not a decorative layer on top of the app.

It is a primary use case.

The best version of Grimoire should make it easy to create something custom without needing to understand the engine implementation.

That means users should eventually be able to author things like:

- a race
- a class
- a subclass
- a feat
- a spell
- a condition
- an item
- a resource
- a campaign rule
- a progression system
- a combat mechanic

The software should treat those creations as normal content, not edge cases.

This is the main reason the project exists.

---

## What Success Looks Like

Grimoire succeeds when a group can invent a rule that has never existed before and the software can:

- understand it
- validate it
- explain it
- display it
- run it
- and integrate it with the rest of the game

without requiring custom code.

At that point, Grimoire is no longer simply a character tool.

It is a platform for tabletop creativity.

---

> **Status note.** This document describes the *target* product. Several capabilities
> above — homebrew authoring, "start anywhere" creation, campaigns as first-class
> entities, full condition automation — are intended direction, not yet shipped. See
> `STATUS.md` / `OVERVIEW.md` for what exists today, and `ARCHITECTURE.md` (Appendix A)
> for the concrete language, schemas, and protocols as currently implemented.
