# FEATURE_QA_RULESET_ENGINE.md

# Purpose

The Ruleset Engine is the foundation of Grimoire.

It exists to ensure that:

* D&D 5e can be deeply supported
* Future systems can be added
* Homebrew can create entirely new mechanics
* The UI remains game-specific while the engine remains generic

The player experience may be unapologetically D&D.

The engine must not be.

---

# Core Principle

## D&D First, Engine Generic

The application UI is optimized for D&D 5e.

The underlying engine is not.

The engine must never assume:

* Race
* Class
* Background
* Spell Slot
* Armor Class
* Hit Points

exist in every ruleset.

Instead the engine understands:

* Entity
* Feature
* Resource
* Choice
* Effect
* Condition
* Progression
* Ruleset

Everything else is built from those concepts.

---

# Architecture Philosophy

Wrong:

Race
Class
Background
Feat
Spell

Hardcoded everywhere.

---

Correct:

Content Definition
↓
Ruleset Definition
↓
UI Presentation

The engine stores mechanics.

The UI decides how to display them.

---

# Ruleset Definition

A Ruleset defines:

Character Creation

Character Progression

Resources

Conditions

Combat Rules

Skills

Content Types

Terminology

Validation Rules

---

# Examples

D&D 5e

Uses:

Race
Class
Background

---

Pathfinder

Uses:

Ancestry
Class
Background

---

Call of Cthulhu

Uses:

Occupation

No classes.

---

Cyberpunk RED

Uses:

Role

Lifepath

No races.

---

World of Darkness

Uses:

Clan

Attributes

Disciplines

Humanity

---

# Ruleset Package

Every supported game is a Ruleset Package.

Contains:

Metadata

Rules

Content

UI Configuration

Validation

Assets

---

# Example

D&D 5e Package

Contains:

Races

Classes

Backgrounds

Spells

Conditions

Equipment

Rules

---

# Active Ruleset

Only one ruleset is active per campaign.

Characters belong to a ruleset.

Example:

Campaign

Ruleset = D&D 5e

Only D&D-compatible characters allowed.

---

# Entity System

Entity is the most important object.

Everything playable is an Entity.

---

# Examples

Player Character

NPC

Monster

Companion

Vehicle

Summon

Pet

Construct

---

# Entity Structure

Identity

Statistics

Resources

Features

Inventory

Conditions

Notes

History

Ruleset Reference

---

# Statistics

Engine does not hardcode statistics.

Rulesets define them.

---

# D&D Example

Strength

Dexterity

Constitution

Intelligence

Wisdom

Charisma

---

# Call of Cthulhu Example

STR

DEX

POW

APP

EDU

SIZ

---

# Cyberpunk Example

INT

REF

DEX

TECH

COOL

WILL

BODY

EMP

---

# Resource System

Resources are generic.

Rulesets define meaning.

---

# D&D Resources

HP

Spell Slots

Ki

Rage

Channel Divinity

---

# Pathfinder Resources

Focus Points

Spell Slots

Hero Points

---

# Cyberpunk Resources

Humanity

Luck

Ammo

---

# Custom Resources

Supported.

Unlimited quantity.

No code required.

---

# Feature System

Features are reusable mechanics.

Every ability is a Feature.

---

# Examples

Darkvision

Sneak Attack

Rage

Fireball

Cyberware

Humanity Loss

Clan Discipline

---

# Feature Types

Passive

Activated

Reaction

Conditional

Resource Based

Progression Based

---

# Effect System

Effects modify game state.

Features create Effects.

---

# Examples

+2 Strength

Resistance Fire

Advantage Stealth

Speed +10

Gain Resource

Apply Condition

Unlock Choice

---

# Effect Categories

Stat Modification

Resource Modification

Condition Application

Choice Grant

Feature Grant

Action Grant

Validation Rule

---

# Conditions

Conditions are generic.

Rulesets provide definitions.

---

# D&D Examples

Poisoned

Blinded

Restrained

---

# Cyberpunk Examples

Bleeding

Cyberpsychosis

Suppressed

---

# Call of Cthulhu Examples

Insane

Temporary Madness

Phobia

---

# Choices

Choices represent player decisions.

---

# Examples

Choose Skill

Choose Feature

Choose Spell

Choose Patron

Choose Fighting Style

Choose Discipline

Choose Cyberware

---

# Choice Structure

Options

Requirements

Resolution Rules

Validation Rules

---

# Progression System

Rulesets define progression.

Engine executes progression.

---

# D&D Example

Level 1 → 20

Feature grants

Spell progression

ASI progression

---

# Call of Cthulhu Example

No levels.

Skill advancement only.

---

# Cyberpunk Example

Improvement Point progression.

No classes after creation.

---

# Content Types

Rulesets define content types.

---

# D&D

Race

Class

Background

Spell

Feat

Item

Monster

---

# Cyberpunk

Role

Cyberware

Weapon

Program

Vehicle

---

# World of Darkness

Clan

Discipline

Merit

Flaw

---

# Character Creation Framework

Rulesets define creation flow.

The engine executes it.

---

# D&D Flow

Name

Race

Class

Background

Ability Scores

Equipment

Spells

Review

---

# Pathfinder Flow

Name

Ancestry

Background

Class

Ability Boosts

Skills

Equipment

Review

---

# Cyberpunk Flow

Name

Role

Lifepath

Stats

Skills

Gear

Review

---

# UI Configuration

Rulesets control terminology.

---

# Example

Engine Term:

Feature

---

D&D UI:

Feature

---

Cyberpunk UI:

Ability

---

World of Darkness UI:

Discipline

---

Player never sees engine terminology.

---

# Explainability System

Every ruleset must support audits.

No exceptions.

---

# Requirement

Every value displayed must explain:

Current Value

Source Contributions

Calculation Path

Rules Applied

Overrides Applied

---

# Example

Initiative +6

+4 Dexterity

+2 Improved Reflexes

Total +6

---

# Validation Engine

Rulesets provide validation rules.

---

# Examples

D&D

Ability Score <= 20

---

Pathfinder

Ancestry restrictions

---

Cyberpunk

Humanity cannot exceed maximum

---

# Homebrew Integration

Homebrew uses the same engine.

No special treatment.

---

# Homebrew May Create

Resources

Conditions

Features

Choices

Progressions

Content Types

---

# Example

Corruption System

Resource

Corruption

Effects

5+ Disadvantage Wisdom

10 Transformation

No code changes required.

---

# Data-Driven Philosophy

Rules should be data.

Not code.

---

Wrong:

if class == barbarian

---

Correct:

Feature Definition

Effect Definition

Progression Definition

---

New content should usually require:

Data Creation

not

Programming.

---

# Ruleset Compatibility

Content belongs to a ruleset.

---

# D&D Race

Cannot automatically appear in:

Cyberpunk

Call of Cthulhu

---

Unless explicitly converted.

---

# Conversion Framework

Future Feature.

Allows:

Source Ruleset

↓

Target Ruleset

↓

Conversion Rules

↓

Converted Character

---

# Multiplayer Compatibility

Campaign participants must share ruleset.

---

Valid:

D&D Character

D&D Campaign

---

Invalid:

Cyberpunk Character

D&D Campaign

---

Unless conversion exists.

---

# Storage Philosophy

Characters store:

Ruleset Version

Content Snapshots

Resolved Choices

Audit History

---

This ensures:

Future updates never break old characters.

---

# Future Rulesets

Target Support

D&D 5e

Pathfinder 2e

Call of Cthulhu

Cyberpunk RED

World of Darkness

Shadowrun

Starfinder

Custom Systems

---

# Success Criteria

The Ruleset Engine is successful when:

A new ruleset can be added without rewriting the app.

Character creation can be defined through data.

Progression can be defined through data.

Homebrew can create new mechanics.

Every value remains auditable.

The UI can remain D&D-focused.

The engine remains system-agnostic.

Official content and homebrew use the same architecture.

Future RPG systems can be supported without rebuilding Grimoire.
