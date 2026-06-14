# FEATURE_QA_CHARACTER_CREATION.md

## Purpose

The Character Creation system allows users to create playable characters for supported rulesets.

For V1, the primary target is D&D 5e.

The architecture must remain flexible enough to support future rulesets such as Pathfinder, Call of Cthulhu, Cyberpunk RED, World of Darkness, and custom community-created systems.

---

# Design Principles

## Homebrew First

Official content and homebrew content are first-class citizens.

The system should never assume official content is the only valid content.

---

## Flexible Creation

Character creation is not a strict wizard.

Users may complete creation steps in any order.

The Creation Hub acts as the central navigation point.

---

## Explain Everything

Every value generated during creation must be traceable and auditable.

No stat may exist without a source.

---

## Campaign-Aware

Campaign settings may restrict available content and rules.

Examples:

* Official-only campaigns
* Homebrew-approved campaigns
* No multiclass campaigns
* Level-capped campaigns

---

# Draft System

## Multiple Drafts

Supported.

Users may maintain multiple unfinished drafts simultaneously.

Examples:

* Human Fighter
* Goblin Wizard
* Abyss Knight

Each draft is independent.

---

## Draft Recovery

If unfinished drafts exist:

User is prompted:

* Resume Draft
* Delete Draft

No automatic resume.

---

## Character Duplication

Supported.

Any existing character may be duplicated into a new draft.

Use cases:

* Build testing
* Character variants
* Campaign-specific versions
* Homebrew experimentation

---

# Character Identity

## Required Fields

Required:

* Race (or equivalent ruleset choice)
* Class (or equivalent ruleset choice)

Optional:

* Name

Unnamed characters are valid.

---

## Portraits

Supported:

* Uploaded custom images
* Built-in fantasy avatars

Portraits may be selected:

* During creation
* After creation

---

## Post-Creation Identity Changes

Allowed.

Examples:

* Rename
* Portrait change
* Background change

System recalculates affected values automatically.

---

# Creation Flow

## Current D&D 5e Flow

1. Name & Level
2. Race
3. Class
4. Background
5. Ability Scores
6. Skills
7. Equipment
8. Spells
9. Review

Users may navigate freely via Creation Hub.

---

## Starting Level

Any level may be selected.

Campaign settings may restrict:

* Minimum level
* Maximum level

---

## High-Level Creation

All required level-based choices must be resolved.

Examples:

* ASIs
* Feats
* Spell selections
* Subclass choices

No automatic quick-build mode.

---

# Race System

## Race Changes

Changing race prompts:

Changing race will affect:

* Ability Scores
* Features

Continue?

User confirmation required.

---

## Race Structure

Supported:

### Parent + Subrace

Elf

* High Elf
* Wood Elf
* Drow

### Standalone Race

Shadow Elf

Subraces are optional.

---

## Race-less Characters

Supported.

Useful for:

* NPCs
* Monsters
* Custom species
* Homebrew systems

---

## Trait Editing

Allowed only through:

* Homebrew workflows
* DM-approved modifications

Players may not freely alter character mechanics without approval.

---

# Class System

## Multiclassing

Supported if campaign rules allow.

Examples:

* Fighter 5
* Fighter 2 / Wizard 3

Creation supports multiclass builds.

---

## Class Changes

Changing class prompts:

Changing class will remove:

* Skill choices
* Equipment choices
* Spell selections
* Class features

Continue?

User confirmation required.

---

# Homebrew Integration

## Content Visibility

Controlled by campaign settings.

Possible modes:

* Official Only
* Official + Approved Homebrew
* All Homebrew

---

## Homebrew Organization

Displayed separately.

Examples:

Official

* Human
* Elf

Homebrew

* Shadow Elf
* Frost Elf

Additional support:

* Search
* Filters
* Sorting

---

## Content Snapshots

Characters store full content snapshots.

Character data never depends on a live content reference.

Example:

Shadow Elf v1
→ Character Created

Shadow Elf v3
→ Released Later

Character remains on v1.

---

## Content Updates

When newer versions exist:

Show:

Update Available

User decides whether to upgrade.

No automatic upgrades.

---

## Deleted Content

Characters remain functional.

Deleting content does not invalidate existing characters.

Characters retain their snapshots.

---

# Validation Rules

Character creation cannot complete without:

* Valid Race (or equivalent)
* Valid Class (or equivalent)
* Resolved mandatory choices

Name is optional.

Portrait is optional.

---

# Future Ruleset Support

Character creation must eventually become ruleset-driven.

Examples:

## D&D

Race
Class
Background

## Cyberpunk RED

Role
Lifepath

## Call of Cthulhu

Occupation
Skills

The creation engine must support custom creation flows defined by rulesets.

---

# Success Criteria

A completed character:

* Is fully playable
* Has all mandatory choices resolved
* Can explain every value
* Stores content snapshots
* Works offline
* Respects campaign restrictions
* Supports future ruleset expansion
