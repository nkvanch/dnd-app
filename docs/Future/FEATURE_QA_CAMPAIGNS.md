# FEATURE_QA_CAMPAIGNS.md

# Purpose

Campaigns connect players, characters, DMs, encounters, notes, and shared information into a single play experience.

The Campaign system is designed for:

* Home games
* Convention games
* One-shots
* Long-running campaigns
* Offline play

Campaigns are not required to use Grimoire.

Characters must remain fully functional outside campaigns.

Campaigns enhance play.

They do not own characters.

---

# Core Principles

## Offline First

Campaigns must function without internet.

Internet is optional.

Required support:

* Local WiFi
* Mobile Hotspot
* Local Network

A table must be able to run an entire campaign session without cloud services.

---

## Character Ownership

Players own characters.

Campaigns do not own characters.

Characters must remain usable after leaving a campaign.

---

## DM Authority

DMs manage campaigns.

DM decisions override conflicting player changes during campaign play.

DM authority is visible and auditable.

---

## Transparency

Mechanical changes are never hidden.

Players always know:

* What changed
* Who changed it
* Why it changed

---

# Campaign Lifecycle

## Create Campaign

Campaign creator becomes DM.

Required:

* Campaign Name

Optional:

* Description
* Ruleset
* Homebrew Settings
* Character Restrictions

---

## Join Campaign

Players may join through:

* Campaign Code
* QR Code
* Direct Invite (future)

---

## Leave Campaign

Players may leave at any time.

Leaving does not delete:

* Character
* Notes
* History

Campaign data remains intact.

---

## Archive Campaign

Supported.

Archived campaigns remain viewable.

No active synchronization.

---

# Campaign Roles

## DM

Full campaign authority.

Can:

* Manage encounters
* Modify campaign state
* Approve homebrew
* Manage players
* Create overrides

---

## Co-DM

Optional feature.

May be granted by DM.

Can perform most DM actions.

Cannot remove primary DM.

---

## Player

Can:

* Use character
* View campaign data
* Participate in encounters
* Edit personal notes

Cannot:

* Modify campaign settings
* Approve homebrew
* Change DM-owned content

---

# Campaign Rules

Campaigns may define restrictions.

Examples:

Official Content Only

Official + Approved Homebrew

All Homebrew

---

## Additional Rules

Examples:

Multiclassing Allowed

Multiclassing Disabled

Level Cap

Starting Level

Custom House Rules

---

# Character Integration

# Character Modes

When joining campaign:

Player chooses:

Live Character

or

Campaign Snapshot

---

## Live Character

Campaign references current character.

Changes remain synchronized.

---

## Campaign Snapshot

Campaign stores independent copy.

Character outside campaign remains unchanged.

Useful for:

* One-shots
* Tournament play
* Experimental campaigns

---

## Import Outside Changes

Campaign may allow:

Import External Updates

DM approval required.

Examples:

Level gained outside campaign

New item added outside campaign

Homebrew update

---

# Character Overrides

Campaigns may create temporary modifications.

Examples:

Blessings

Curses

Campaign Resources

Temporary Feats

Story Effects

---

## Override Scope

Overrides affect:

Campaign Character

Only.

Never source character.

---

## Override Visibility

Always visible.

Displayed in:

Audit Modal

Timeline

Feature Lists

---

# Synchronization

# Supported Modes

Internet

Local WiFi

Mobile Hotspot

Offline Session

---

## Offline Session

Campaign remains playable.

Actions are stored locally.

Synchronization occurs when devices reconnect.

---

## Synchronization Targets

HP

Conditions

Resources

Spell Slots

Inventory

Notes

Encounter State

Campaign Journal

Quest Progress

---

## Conflict Resolution

DM Wins

Always.

Example:

Player HP = 20

DM HP = 14

Conflict detected

Result:

HP = 14

---

## Conflict Logging

Every conflict recorded.

Timeline entry generated.

Example:

HP conflict resolved.

DM version applied.

---

# Campaign Dashboard

Purpose:

Central campaign overview.

---

## DM Dashboard

Displays:

Players

Character Status

Resources

Conditions

Connection Status

Active Encounter

Recent Activity

---

## Player Dashboard

Displays:

Campaign Overview

Party Members

Active Quests

Session Notes

Current Encounter

---

# Shared Knowledge

Campaigns support collaborative information.

---

## Party Journal

Shared notes.

Visible to all players.

---

## Quest Log

Tracks:

Active Quests

Completed Quests

Failed Quests

---

## NPC Database

Shared campaign reference.

Contains:

Name

Description

Status

Notes

---

## Loot Tracker

Tracks:

Party Treasure

Shared Currency

Important Items

Ownership

---

# Secret Information

DM-only information supported.

---

## Hidden Notes

Examples:

Secret Plot Hooks

Hidden NPC Motives

Future Encounters

Secret Conditions

---

## Visibility

Only DM and Co-DMs may view.

Never synchronized to player devices.

---

# Encounter System

Purpose:

Track active gameplay.

---

## Encounter Ownership

Encounters belong to Campaign.

Sessions may use campaign encounters.

---

## Encounter Templates

Reusable.

Example:

Goblin Ambush

May be reused multiple times.

---

## Active Encounter

Tracks:

Participants

Initiative

Conditions

Resources

Status

Notes

---

## Future Expansion

Battle Maps

Tokens

Fog of War

Line of Sight

Measurement Tools

Not required for V1.

---

# Session System

Campaigns may contain sessions.

---

## Session Records

Date

Participants

Notes

Duration

Summary

---

## Session Timeline

Examples:

Session Started

Encounter Began

Boss Defeated

Character Death

Level Up

Session Ended

---

# Campaign Timeline

Automatically maintained.

---

## Examples

Campaign Created

Player Joined

Player Left

Character Imported

Homebrew Approved

Encounter Started

Quest Completed

Campaign Archived

---

# Homebrew Management

Campaigns may control available content.

---

## Approval Modes

Official Only

Official + Approved

All Homebrew

---

## Approval Scope

Single Item

Content Pack

Entire Library

---

## Approval Visibility

Players see:

Approved

Rejected

Pending

Status.

---

# Permissions Matrix

| Action                   | Player | Co-DM    | DM  |
| ------------------------ | ------ | -------- | --- |
| View Campaign            | Yes    | Yes      | Yes |
| Join Campaign            | Yes    | Yes      | Yes |
| Edit Own Notes           | Yes    | Yes      | Yes |
| Manage Encounters        | No     | Yes      | Yes |
| Manage Players           | No     | Limited  | Yes |
| Approve Homebrew         | No     | Optional | Yes |
| Modify Campaign Settings | No     | No       | Yes |
| Create Overrides         | No     | Yes      | Yes |
| View Hidden Notes        | No     | Yes      | Yes |

---

# Networking Philosophy

Campaigns should never require:

* Dedicated Servers
* Cloud Hosting
* Monthly Subscription

The preferred architecture is peer-to-peer with campaign synchronization.

Cloud services may be offered later.

They are never mandatory.

---

# Future Features

Co-DM Management

Voice Chat

Map Sharing

Battle Maps

Fog of War

NPC Relationship Graphs

Shared Handouts

Campaign Websites

Cross-Campaign Character Progression

---

# Success Criteria

The Campaign System is successful when:

A table can create a campaign.

Players can join without internet.

Characters remain player-owned.

DMs maintain campaign authority.

Homebrew can be controlled.

Notes and quests can be shared.

Encounters can be tracked.

Campaigns remain playable offline.

No cloud service is required.

All changes remain auditable.

Campaigns enhance tabletop play without replacing it.
