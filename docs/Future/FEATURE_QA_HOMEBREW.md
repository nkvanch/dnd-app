# FEATURE_QA_HOMEBREW.md

# Purpose

Homebrew is a first-class system in Grimoire.

The goal is not merely to support homebrew.

The goal is to make creating, importing, managing, sharing, versioning, and playing homebrew content as easy as using official content.

A player should be able to create an entirely custom game experience without writing code.

---

# Core Principles

## Homebrew First

Official content and homebrew content are treated equally.

The application must never assume official content is more important than homebrew content.

Official content is simply a content pack provided by the application.

---

## Offline First

All homebrew content must function without internet.

Internet may be used for importing or sharing.

Once content is installed:

Everything works offline.

---

## Snapshot Safety

Characters never depend on live content.

Characters store snapshots.

Example:

Shadow Elf v1
↓
Character Created

Shadow Elf v3
↓
Released Later

Character remains fully playable using v1.

Deleting content never breaks characters.

---

## No Coding Required

Users should be able to create:

* Classes
* Races
* Features
* Resources
* Conditions

without programming knowledge.

---

# Homebrew Content Types

## V1 Mandatory

Race Builder

Class Builder

---

## V1.5 Recommended

Feature Builder

Spell Builder

Feat Builder

---

## Future Builders

Background Builder

Subclass Builder

Item Builder

Condition Builder

Monster Builder

NPC Builder

Campaign Rule Builder

Ruleset Builder

---

# Content Structure

Every homebrew object contains:

ID

Version

Name

Description

Author

Created Date

Modified Date

Dependencies

Tags

Visibility

---

## Example

Abyss Knight

Version: 1.2.0

Dependencies:

Soul Corruption Feature

Abyssal Transformation Feature

Corruption Resource

---

# Homebrew Library

Homebrew tab contains:

Import

Create

Library

---

# Import System

Purpose:

Convert external homebrew into Grimoire content.

---

## Supported Sources

V1

Manual Import

Future

DandWiki

GM Binder

Homebrewery

Custom Websites

---

## Import Philosophy

Import Once

Store Forever

No permanent internet dependency.

---

## Import Review

Default:

One-click import allowed.

However:

System may display warnings.

Example:

Unsupported Features Detected

Continue?

---

## Import Output

Imported content becomes native Grimoire content.

Not external references.

Not web links.

Not cached pages.

Actual Grimoire content records.

---

# Unsupported Mechanics

Homebrew frequently introduces mechanics unknown to D&D.

Examples:

Corruption

Humanity

Favor

Blood Points

Heat

Stress

Sanity

Mutation

Influence

---

## Requirement

Users must be able to create:

Custom Resources

Custom Conditions

Custom Trackers

without coding.

---

## Example

Corruption

Current: 4

Maximum: 10

Effects:

5+
Disadvantage on Wisdom Saves

10
Transformation

---

# Race Builder

Purpose:

Create playable species.

---

## Supported Fields

Name

Description

Size

Speed

Languages

Traits

Subrace Support

Tags

---

## Race Hierarchy

Supported:

Parent Race

Elf

Subraces

High Elf

Wood Elf

Drow

---

Supported:

Standalone Race

Shadow Elf

---

## Trait System

Traits grant:

Features

Effects

Resources

Choices

Conditions

---

# Class Builder

Purpose:

Create playable classes.

---

## Supported Fields

Name

Description

Hit Die

Saving Throws

Primary Abilities

Armor Proficiencies

Weapon Proficiencies

Tool Proficiencies

Spellcasting

Class Resources

Progression

Choices

---

# Progression Editor

Supports levels:

1-20

Each level may grant:

Features

Resources

Choices

Spellcasting

ASI

Feats

Subclass Features

---

## Example

Level 1

Gain:

Soul Corruption

Infernal Strike

Choose:

Demonic Patron

---

Level 3

Gain:

Subclass Feature

---

# Feature System

Features are reusable building blocks.

Example:

Darkvision

can be used by:

Race

Class

Feat

Item

Condition

---

## Feature Types

Passive

Activated

Reaction

Bonus Action

Resource-Based

Conditional

---

# Resource System

Universal system.

Examples:

Spell Slots

Ki

Corruption

Humanity

Favor

Blood Points

---

## Resource Structure

Name

Current

Maximum

Recovery Rules

Display Rules

Audit Rules

---

# Condition System

Supports:

Official Conditions

Custom Conditions

---

## Example

Soulbound

Description:

Cannot move more than 30 feet from bonded target.

Mechanical Effects:

Custom

Reminder Text

Visible on Character Sheet

---

# Dependency Tracking

Required.

Every object must track dependencies.

---

## Example

Soul Corruption

Used By:

Abyss Knight

Hell Knight

Shadow Apostle

---

## Deletion Protection

Attempting deletion displays:

Used by 3 Classes

Continue?

---

# Versioning

All homebrew content is versioned.

---

## Version Format

Major.Minor.Patch

Example:

1.2.3

---

## Breaking Changes

Examples:

Hit Die Changed

Feature Removed

Resource Deleted

---

System displays:

Affected Characters: 27

Affected Campaigns: 4

Continue?

---

# Content Updates

When newer versions exist:

Display:

Update Available

Users choose:

Update

Ignore

View Changes

---

## Update Safety

Updates never automatically modify characters.

Explicit user action required.

---

# Sharing

Future feature.

---

## Export

Supported.

Examples:

.grimoire-race

.grimoire-class

.grimoire-pack

---

## Import

Supported.

Users may install:

Single Content

Content Packs

Rulesets

Campaign Packs

---

# Content Packs

Purpose:

Bundle related content.

---

## Example

Dark Realms Pack

Contains:

3 Races

2 Classes

14 Features

7 Feats

22 Spells

---

# Campaign Homebrew Rules

Campaigns may restrict content.

Modes:

Official Only

Official + Approved

All Homebrew

---

## Approval Workflow

DM may approve:

Individual Content

Content Packs

Entire Libraries

---

# Homebrew Character Integration

Homebrew content must appear everywhere official content appears.

Examples:

Race Picker

Class Picker

Spell Selection

Feature Lists

Actions

Character Sheet

Campaigns

No separate "homebrew mode."

---

# Future Ruleset Support

Homebrew system must eventually support:

D&D 5e

Pathfinder

Call of Cthulhu

Cyberpunk RED

World of Darkness

Custom Rulesets

---

## Ruleset Independence

Homebrew content should be built on:

Features

Resources

Choices

Effects

Conditions

not hardcoded:

Race

Class

Background

This allows future rulesets to reuse the same engine.

---

# Success Criteria

The Homebrew System is successful when a user can:

Create a custom race

Create a custom class

Import content from external sources

Share content with others

Version content safely

Track dependencies

Create custom mechanics

Use homebrew exactly like official content

Play entirely offline

Build new game systems without writing code
