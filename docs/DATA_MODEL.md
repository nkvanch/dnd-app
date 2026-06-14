# DATA_MODEL.md

# Purpose

This document defines the canonical data structures used throughout Grimoire.

All systems must be built on these models.

The goal is:

* Offline-first storage
* Ruleset independence
* Homebrew compatibility
* Snapshot safety
* Explainability
* Versioning
* Future-proofing

---

# Core Design Principle

Everything in Grimoire is data.

The engine should avoid special cases.

Avoid:

if class == "barbarian"

Avoid:

if race == "elf"

Avoid:

if spellcasting == true

Instead:

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

# Top-Level Objects

Grimoire stores:

Rulesets

Content

Characters

Campaigns

Sessions

Audit Events

User Settings

---

# Entity Relationship Overview

Ruleset
└── Content

Character
├── Content Snapshots
├── Features
├── Resources
├── Conditions
├── Inventory
└── Audit History

Campaign
├── Players
├── Characters
├── Overrides
├── Sessions
└── Timeline

---

# Ruleset

Represents an RPG system.

Example:

D&D 5e

Pathfinder 2e

Cyberpunk RED

Call of Cthulhu

---

Structure

```ts
Ruleset {
  id: string
  name: string
  version: string

  contentTypes: string[]
  statistics: StatisticDefinition[]
  resources: ResourceDefinition[]

  creationFlow: CreationStep[]

  validationRules: ValidationRule[]

  metadata: Record<string, any>
}
```

---

# Content

Base object for all game content.

Everything inherits from Content.

---

Structure

```ts
Content {
  id: string

  type: string

  rulesetId: string

  version: string

  name: string

  description: string

  tags: string[]

  dependencies: string[]

  source: ContentSource

  createdAt: string

  modifiedAt: string
}
```

---

# Content Types

Examples

D&D

Race

Class

Subclass

Spell

Feat

Background

Item

Monster

Feature

Condition

---

Cyberpunk

Role

Cyberware

Program

Weapon

Vehicle

Feature

---

# Feature

Most important content object.

Represents mechanics.

---

Structure

```ts
Feature {
  ...Content

  effects: Effect[]

  actions: ActionDefinition[]

  resourcesGranted: string[]

  conditionsGranted: string[]

  choicesGranted: string[]
}
```

---

# Effect

Atomic gameplay change.

Everything eventually becomes Effects.

---

Structure

```ts
Effect {
  id: string

  type: EffectType

  target: string

  value: any

  conditions?: ConditionDefinition[]
}
```

---

Examples

+2 Strength

Resistance Fire

Gain Darkvision

Add Resource

Grant Spell

Increase Speed

---

# Resource

Tracks consumables.

---

Structure

```ts
Resource {
  id: string

  name: string

  current: number

  maximum: number

  recoveryRule: RecoveryRule

  metadata?: Record<string, any>
}
```

---

Examples

HP

Spell Slots

Ki

Corruption

Humanity

Ammo

---

# Condition

Represents temporary or permanent state.

---

Structure

```ts
Condition {
  id: string

  name: string

  sourceId?: string

  description: string

  active: boolean

  expiresAt?: string
}
```

---

Examples

Poisoned

Blinded

Concentrating

Soulbound

Cyberpsychosis

---

# Choice

Represents unresolved player decisions.

---

Structure

```ts
Choice {
  id: string

  type: string

  sourceId: string

  options: ChoiceOption[]

  minimumSelections: number

  maximumSelections: number

  resolved: boolean

  result?: string[]
}
```

---

Examples

Choose Skills

Choose Patron

Choose Fighting Style

Choose Spell

Choose Feat

---

# Action

Represents something player can use.

---

Structure

```ts
ActionDefinition {
  id: string

  name: string

  actionType:
    | "action"
    | "bonus_action"
    | "reaction"
    | "free"

  resourceCosts: ResourceCost[]

  effects: Effect[]

  metadata?: Record<string, any>
}
```

---

Examples

Rage

Fireball

Sneak Attack

Second Wind

Cyberware Activation

---

# Character

Player-owned character.

Most important runtime object.

---

Structure

```ts
Character {
  id: string

  rulesetId: string

  version: string

  name: string

  level?: number

  contentSnapshots: ContentSnapshot[]

  statistics: StatisticSet

  resources: Resource[]

  conditions: Condition[]

  inventory: Inventory

  notes: CharacterNotes

  timeline: TimelineEvent[]

}
```

---

# Content Snapshot

Critical for update safety.

---

Purpose

Characters never depend on live content.

---

Structure

```ts
ContentSnapshot {
  contentId: string

  version: string

  snapshotData: any
}
```

---

Example

Character created using:

Abyss Knight v1.2

Later:

Abyss Knight v2.0 released

Character continues using v1.2 snapshot.

---

# Statistics

Ruleset-defined values.

---

Structure

```ts
StatisticSet {
  [statisticId: string]: number
}
```

---

Examples

D&D

STR
DEX
CON

---

Cyberpunk

INT
REF
EMP

---

# Inventory

---

Structure

```ts
Inventory {
  equipped: ItemInstance[]

  carried: ItemInstance[]

  stored: ItemInstance[]

  currency: CurrencySet
}
```

---

# Item Instance

Important distinction.

Not content.

Owned object.

---

Structure

```ts
ItemInstance {
  instanceId: string

  itemContentId: string

  quantity: number

  customData?: Record<string, any>
}
```

---

# Audit Event

Foundation of Explain Any Number.

---

Structure

```ts
AuditEvent {
  id: string

  timestamp: string

  type: string

  sourceId: string

  description: string

  data: Record<string, any>
}
```

---

Examples

Feature Applied

Spell Slot Used

HP Modified

Level Up

DM Override Added

---

# Timeline Event

Player-visible history.

---

Structure

```ts
TimelineEvent {
  id: string

  timestamp: string

  eventType: string

  summary: string
}
```

---

Examples

Reached Level 5

Defeated Dragon

Obtained Artifact

Character Died

Character Revived

---

# Campaign

Shared multiplayer state.

---

Structure

```ts
Campaign {
  id: string

  name: string

  rulesetId: string

  dmId: string

  players: CampaignMember[]

  characters: CampaignCharacter[]

  overrides: CampaignOverride[]

  sessions: Session[]

  timeline: TimelineEvent[]
}
```

---

# Campaign Character

Important distinction.

Campaigns never own source characters.

---

Structure

```ts
CampaignCharacter {
  sourceCharacterId: string

  mode:
    | "live"
    | "snapshot"

  campaignSnapshot?: Character
}
```

---

# Campaign Override

Temporary campaign modification.

---

Structure

```ts
CampaignOverride {
  id: string

  targetId: string

  effect: Effect

  createdBy: string

  expiresWhen?: string
}
```

---

Examples

Blessing

Curse

Campaign Resource

Temporary Feat

Story Reward

---

# Session

Represents a game session.

---

Structure

```ts
Session {
  id: string

  campaignId: string

  startedAt: string

  endedAt?: string

  notes: string

  events: TimelineEvent[]
}
```

---

# Homebrew Package

Shareable content bundle.

---

Structure

```ts
ContentPack {
  id: string

  name: string

  version: string

  contentIds: string[]

  dependencies: string[]
}
```

---

Examples

Dark Realms Pack

Abyss Knight Pack

Curse of Shadows Pack

---

# Sync Event

Used by campaign networking.

---

Structure

```ts
SyncEvent {
  id: string

  timestamp: string

  objectType: string

  objectId: string

  operation:
    | "create"
    | "update"
    | "delete"

  payload: any
}
```

---

# Storage Layers

SQLite

Stores:

Characters

Campaigns

Content

Rulesets

Audit Events

Timeline Events

---

File Storage

Stores:

Images

Icons

Exports

Imported Content Packs

---

# Data Ownership Rules

Rulesets own:

Definitions

---

Content owns:

Mechanics

---

Characters own:

Choices
Resources
Conditions
Inventory

---

Campaigns own:

Overrides
Sessions
Multiplayer State

---

# Immutable Rules

Characters never reference live content.

Characters always store snapshots.

Campaigns never permanently modify characters.

Every displayed number must be auditable.

Every object must have an ID.

Every content object must be versioned.

Rulesets must remain independent.

Homebrew and official content use identical structures.

---

# Success Criteria

The Data Model is successful when:

A new ruleset can be added without schema changes.

A homebrew class can be added without schema changes.

Characters survive content updates.

Campaigns remain temporary layers.

Every value remains explainable.

Offline play remains fully supported.

Future RPG systems can reuse the same architecture.

The engine remains data-driven rather than code-driven.
