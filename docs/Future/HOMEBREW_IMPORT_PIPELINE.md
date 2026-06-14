# HOMEBREW_IMPORT_PIPELINE.md

# Purpose

This document defines how external content is imported into Grimoire.

The import pipeline converts external homebrew into native Grimoire content.

After import:

* No internet connection is required
* No external website dependency exists
* No AI service is required
* Content behaves exactly like native content

The goal is:

Import Once
↓
Store Forever
↓
Play Offline

---

# Core Principles

## Offline First

Internet is only used during import.

After import:

All content must function without network access.

---

## Native Content Conversion

Imported content is never stored as:

* URLs
* Web Pages
* Cached HTML

Imported content becomes:

Native Grimoire Content

---

## User Ownership

Imported content belongs to the user.

If the original website disappears:

Content continues functioning.

---

## AI Optional

AI may assist import in the future.

AI is never required.

All imports must work without AI.

---

# Import Pipeline Overview

External Source

↓

Fetch

↓

Parse

↓

Normalize

↓

Validate

↓

Resolve Dependencies

↓

Review Screen

↓

Convert To Native Content

↓

Store Locally

↓

Available Everywhere

---

# Import Sources

## V1 Supported

Manual Entry

JSON Import

Grimoire Package Import

---

## V1.5 Supported

DandWiki

GM Binder

Homebrewery

---

## Future

GitHub

Campaign Repositories

Community Packs

Custom Websites

PDF Imports

---

# Source Adapters

Each source has an adapter.

Purpose:

Convert source format into normalized content.

---

## Example

DandWiki

HTML

↓

DandWiki Adapter

↓

Normalized Model

---

## Example

Homebrewery

Markdown

↓

Homebrewery Adapter

↓

Normalized Model

---

# Import Stages

# Stage 1

Fetch

Purpose:

Acquire source data.

---

Inputs

URL

File

Paste Text

Package

---

Outputs

Raw Content

---

# Stage 2

Parse

Purpose:

Extract structured information.

---

Examples

Race

Class

Subclass

Feature

Spell

Feat

Background

---

Output

Parsed Objects

---

# Stage 3

Normalize

Purpose:

Convert source-specific structure into Grimoire structure.

---

Example

DandWiki

"Increase your Strength score by 2"

↓

Effect

Type: StatModifier

Target: STR

Value: +2

---

Example

"Gain Darkvision"

↓

Feature

Darkvision

---

Output

Normalized Content Graph

---

# Stage 4

Validation

Purpose:

Detect problems.

---

Checks

Missing Data

Broken References

Unknown Mechanics

Circular Dependencies

Duplicate IDs

Ruleset Compatibility

---

# Validation Levels

Info

Warning

Error

---

Info

Optional improvement.

Import allowed.

---

Warning

Potential issue.

Import allowed.

---

Error

Import blocked.

---

# Example

Missing description

Info

---

Unknown mechanic

Warning

---

Broken dependency

Error

---

# Stage 5

Dependency Resolution

Purpose:

Identify required content.

---

Example

Abyss Knight

Uses:

Soul Corruption

Infernal Patron

Corruption Resource

---

System detects:

3 dependencies required.

---

# Dependency Outcomes

Already Installed

↓

Reuse

---

Included In Import

↓

Install

---

Missing

↓

Prompt User

---

# Stage 6

Review Screen

Purpose:

User approval.

---

Displays

Content Name

Type

Version

Dependencies

Warnings

Imported Objects

---

Example

Import Summary

1 Class

4 Features

1 Resource

2 Warnings

Proceed?

---

# Stage 7

Native Conversion

Purpose:

Generate Grimoire objects.

---

Creates

Content Records

Feature Records

Resource Records

Dependencies

Version Metadata

Audit Entries

---

Output

Native Grimoire Content

---

# Stage 8

Storage

Purpose:

Persist content.

---

Stores

SQLite Metadata

Content Definitions

Dependencies

Versions

Assets

---

Result

Offline Availability

---

# Normalized Content Model

All imports convert into:

Content

↓

Features

↓

Effects

↓

Resources

↓

Choices

---

Never directly into:

Race Logic

Class Logic

Spell Logic

---

Everything becomes data.

---

# Importing Classes

Class imports are the most complex.

---

Required Components

Metadata

Progression

Features

Choices

Resources

Spellcasting

---

Example

Abyss Knight

↓

Level Progression

↓

Features

↓

Effects

↓

Stored

---

# Importing Races

Required Components

Name

Traits

Subraces

Features

Speed

Languages

---

Race-specific text becomes Features.

---

# Importing Spells

Required Components

Name

Level

School

Range

Duration

Description

Effects

---

Unknown mechanics become warnings.

---

# Unsupported Mechanics

Not all content can be automatically converted.

---

Examples

Custom Corruption System

Custom Sanity Rules

Custom Dice Systems

---

Handling

Create Import Warning

Create Placeholder Objects

Request User Resolution

---

Example

Unknown Resource:

Corruption

Create Resource?

Yes / No

---

# User Resolution Workflow

Purpose:

Allow manual fixes.

---

Examples

Unknown Resource

Unknown Condition

Unknown Feature

Unknown Progression

---

System offers:

Create

Map Existing

Ignore

---

# Import Templates

Purpose:

Support recurring structures.

---

Example

Many classes contain:

Choose Subclass At Level 3

---

Template can automatically generate:

Choice Object

Progression Node

Feature Links

---

# DandWiki Import Rules

DandWiki is highly inconsistent.

Import must be tolerant.

---

Common Issues

Missing formatting

Custom mechanics

Non-standard wording

Broken sections

Incomplete progressions

---

Strategy

Best-effort parsing

Warnings instead of failures

Review before import

---

# Homebrewery Import Rules

Generally more structured.

---

Preferred Parsing

Markdown Sections

Tables

Lists

Feature Blocks

---

Higher confidence imports.

---

# Package Imports

Preferred sharing method.

---

Format

.grimoire-pack

---

Contains

Content

Dependencies

Assets

Metadata

Versions

---

Import Quality

Highest

No parsing required.

---

# Content Deduplication

Purpose:

Avoid duplicates.

---

Example

Darkvision

Already Installed

↓

Reuse Existing

---

Instead of:

Creating Duplicate Feature

---

# Version Handling

Imported content is versioned.

---

Example

Abyss Knight v1.2

Installed

---

Later

Abyss Knight v1.3

Available

---

User Options

Update

Ignore

Compare

---

# Update Safety

Critical Rule

Characters never auto-update.

---

Characters use snapshots.

---

Example

Character uses:

Abyss Knight v1.2

---

Import:

Abyss Knight v1.3

---

Character remains:

v1.2

Until user updates.

---

# Import Audit Trail

Every import generates history.

---

Records

Import Date

Source

Version

Dependencies

Warnings

Installer

---

Purpose

Debugging

Ownership

Version Tracking

---

# Security Rules

Imported content must never execute code.

---

Forbidden

JavaScript

External Scripts

Remote Execution

Dynamic Downloads

---

Allowed

Data

Images

Metadata

Content Definitions

---

# Future AI Assistance

Optional Feature.

Never required.

---

AI may assist with:

Poor Formatting

Broken Layouts

PDF Extraction

Unknown Mechanics

---

AI never bypasses:

Validation

Review

User Approval

---

# Success Criteria

The Import Pipeline is successful when:

A user can import a class from DandWiki.

A user can import a race from Homebrewery.

Imported content becomes native content.

Internet is no longer required after import.

Characters remain stable through updates.

Dependencies are tracked automatically.

Unsupported mechanics can be resolved manually.

No AI service is required.

No imported content can execute code.

All imported content behaves like content created inside Grimoire.
