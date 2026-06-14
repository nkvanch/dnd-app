**GRIMOIRE**

Application Blueprint & Design Specification

Personal D&D 5e Companion - Offline-First, Audit-Driven

# **1\. Executive Summary & Vision**

Grimoire is a best-in-class D&D 5e companion app built for personal use at the physical tabletop. It is not another generic character-sheet viewer. Its underlying engine is architected to be rule-system-agnostic - but that extensibility is an internal design constraint, not a marketed feature. The app ships as the finest possible D&D 5e experience first, with multi-system capability added only after the core product is proven.

**The core identity of Grimoire rests on four pillars:**

- Absolute Auditability - Every number on the sheet explicitly tracks its own derivation. Nothing is a mystery.
- Data-Driven Homebrew Architecture - Classes, races, resources, and mechanics are data packages parsed by a generic rules engine, never hardcoded logic blocks.
- Tabletop Trust Over Technical Restriction - The engine enforces full transparency. Every DM override is documented and visible to the player.
- Physical-First Companion Focus - Grimoire enhances a real-world session. It does not attempt to replace physical dice or face-to-face play.

# **2\. Definitive App Specification**

## **Core System Architecture**

### **Unified Entity Model**

Player Characters, Monsters, NPCs, Companions, and Summons are all instances of a single base Entity framework. This eliminates duplicate combat logic and unifies all pipelines for HP management, condition tracking, and resource depletion.

### **Pure Engine / UI Separation**

The rules engine performs all math and state resolution independently of the presentation layer. The UI only renders data and dispatches user actions. No business logic lives in widgets.

### **Decoupled Rules Engine (Internal)**

The engine evaluates abstract components - Entities, Features, Resources, Choices, Rules, and Effects - rather than D&D-specific constructs. D&D 5e is a data package loaded on top of this layer. This architecture enables future system support without foundational rewrites, but this is an internal engineering constraint. No multi-system UI or user-facing system switching is planned for V1.

**Implementation Note**
The codebase is written in **TypeScript / React Native / Expo SDK 56**. All references to a "Dart" or "Flutter" stack in earlier planning documents were erroneous and have been corrected throughout this specification.

## **Functional Feature Set**

### **The Audit Trail System**

A non-negotiable architectural requirement. Every calculated stat provides a full source breakdown:

- Total value = sum of all contributing sources
- Each source is tagged with its origin (class feature, race trait, DM override, equipment, condition)
- The breakdown is accessible in two modes: a Technical View (full source list with values) and a Plain-Language View (e.g., "Your AC is 17 = 10 base + 3 Dex + 2 Shield + 2 DM Blessing") for players less familiar with the rules

Audit coverage includes every derived value: HP, AC, Spell Save DC, Attack Bonuses, Damage Bonuses, Passive Senses, Carrying Capacity, Initiative, Movement Speeds, and Resource Caps.

### **Character Timeline - Automated + Manual**

Characters maintain a permanent chronological lifecycle log. The timeline has two entry types:

- Automated Milestones - written by the system on significant sheet events: character creation, race selection, level-ups, feat choices, class changes, death events, revivals.
- Manual Journal Entries - written by the player to record narrative moments. Examples: "Defeated the Lich King. Received the Moonblade. Lost Gareth to the Shadow Realm." These sit alongside automated entries in the same timeline, turning it from a technical log into a campaign memoir.

### **Concentration Tracking**

Concentration awareness is built into the base character sheet, not deferred to the encounter layer:

- When a concentration spell is cast, the sheet immediately flags the active concentration slot.
- If a second concentration spell is cast, the app prompts: "This will end \[current spell\]. Continue?"
- When the character takes damage while concentrating, the app surfaces a Constitution saving throw reminder with the correct DC (10 or half damage taken, whichever is higher).

### **Session Mode - Glanceable Combat View**

Alongside the full character sheet, a dedicated Session Mode provides a minimal dashboard optimised for active combat:

- At-a-glance display: current HP, spell slot grid, active conditions, concentration status, and available actions.
- One-tap HP adjustment with auto-trigger for concentration checks on damage.
- This fulfils the Physical-First pillar - Session Mode is what players look at during their turn, not the full management sheet.

### **Extensible Homebrew Ecosystem**

A robust local ecosystem supporting content pack bundling. File extensions: .grimoire-pack, .grimoire-class, .grimoire-race. Features:

- Built-in relational dependency tracking to prevent broken references
- Version control with explicit impact warnings before committing updates
- The .grimoire-pack schema is a documented open JSON standard (published to a public GitHub repository) so the community can build converters and importers independently
- Local use and manual file sharing only in V1. No cloud database or community hosting is in scope.

### **Hybrid Session Engine**

A streamlined tactical tracker designed to run encounters live at the table: initiative order, active conditions, concentration status, resource depletion, and monster HP pools.

# **3\. Product Development Roadmap**

| **Phase** | **Deliverables** |
|---|---|
| **Phase 1 Foundation** | Core TypeScript rules engine (src/engine/) with Unified Entity model and strict calculation pipelines; Full audit tracking framework; Automated character timeline log; Manual journal entry support alongside automated milestones; Complete D&D 5e SRD data pack; Base character management: creation, level-up; Concentration tracking integrated at the sheet level; Session Mode (glanceable combat dashboard) |
| **Phase 2 Homebrew** | Visual Race Builder and Class Builder; Custom tracking counters and resource bars; Custom condition flags with reminder text; Pack export / import system (.grimoire-pack, .grimoire-class, .grimoire-race); Relational dependency checker and version impact alerts; Open .grimoire-pack JSON schema published to GitHub |
| **Phase 3 Campaigns** | Campaign framework: DM device as session authority; Local offline networking; Conflict resolution; Offline edit queue; DM private workspace; Shared party tools: loot tracker, quest log, party journal; Co-DM permission delegation (post-V1) |
| **Phase 4 Polish & V2** | Live Encounter Layer; Import utility for DnD Beyond / Homebrewery content; Full encounter persistence; V2 Stretch Goal: battle map engine (aspirational only) |

## **Phase 1 Detail: Core Engine**

Phase 1 is the only phase that must be complete before Grimoire is useful. The deliverable is a standalone single-player app capable of:

- Creating and fully managing a D&D 5e character (any class, race, multiclass configuration)
- Displaying every stat with a full audit breakdown
- Running a basic combat session (HP tracking, conditions, concentration, spell slots) via Session Mode
- Persisting everything to local storage with zero network dependency

# **4\. Design Decision Catalog**

The following register documents every major design decision. Decisions marked \[REVISED\] reflect corrections or improvements applied to the original QA catalog.

## **A - Character Lifecycle & Campaign Membership**

| **Q#** | **Topic** | **Decision** |
|---|---|---|
| Q21 | Campaign Membership | Characters freely participate in multiple campaigns simultaneously. Campaign-specific state (remaining HP, session inventory, tracking notes) is stored separately from the foundational character identity envelope. |
| Q22 | Character Death | Slain characters remain accessible in the UI. Players are prompted to archive the character card manually. The app never auto-deletes an entity. |
| Q23 | Character Retirement | Retired characters are moved to a viewable archive repository, accessible at any time. |

## **B - Races, Classes & Progression**

| **Q#** | **Topic** | **Decision** |
|---|---|---|
| Q24 | Trait & Race Editing | \[REVISED\] Editing is permitted. Changes to core features require explicit DM Approval during an active session. Outside active sessions, the player can make edits that are queued as "pending DM review" - the character remains fully functional but flags the change. |
| Q25 | Race-less Entities | YES. Entities can exist without a defined race. Required for custom NPCs, generic monsters, and homebrew playtests. |
| Q26 | Race Hierarchy / Subraces | Subraces are optional. The engine supports both multi-tiered nesting (Elf → Wood Elf) and fully flat distinct species concurrently. |
| Q27 | Multiclassing | BOTH paths supported: fresh Level 1 creation and pre-assembled multi-class sheets, subject to active campaign constraints. |
| Q28 | High-Level Character Generation | \[REVISED\] Step-by-step level resolution is the default for player characters to preserve full auditability. A Fast-Track mode is available for DM-controlled entities (NPCs, monsters) to allow instant high-level configuration. |
| Q29 | Retrospective Class Changes | The app issues a loud warning listing all impacted downstream systems before executing any retrospective class change. |
| Q30 | Unsupported Homebrew Imports | Partial Import. Known modular blocks are extracted and instantiated. Unsupported mechanics are isolated and logged. The base character card remains functional. |

## **C - Sheet Audit, Overrides & Game Philosophy**

| **Q#** | **Topic** | **Decision** |
|---|---|---|
| Q31 | Audit Coverage Scope | Every single number. HP, AC, Spell Save DCs, Attack/Damage Bonuses, Passive Senses, Carrying Capacity, Initiative, Movement Speeds, and Resource Caps all maintain real-time audit trails. |
| Q32 | DM Override Granularity | Full Effect System Entries. Overrides use the engine schema: name, effect modifier, and duration. Flat number overrides are not permitted. |
| Q33 | Override Visibility | Players always see DM overrides. Transparency is non-negotiable. |
| Q34 | Audit History Visibility | Yes. A chronological log shows what value changed, what it became, and which user made the edit. |
| Q35 | Dice Rolling Philosophy | Hybrid, physical-first. Physical dice are the default experience. Integrated digital rollers are a backup convenience. |
| Q36 | Custom Resources | Players can instantly create custom tracking counters (Sanity, Favor, Corruption, Blood Points) without writing code. |
| Q37 | Custom Conditions | Users can create custom status flags with reminder text blocks (e.g., "Marked: attacker has advantage against you"). |
| Q38 | DM Sheet Permissions | Full clearance during active sessions. DMs can adjust HP, toggle conditions, modify inventory, alter stats, and strip or award features in real time. All changes are logged. |
| Q39 | Character Notes Layout | User-defined categories, defaulting to a built-in template. Default tabs: Backstory, Loot, NPCs. Players can fully rename, reorder, or add tabs. |
| Q40 | Character Timeline | \[REVISED\] Both automated and manual. Automated: level-ups, death, revival, feat selections, class changes. Manual: player-written freeform narrative entries that sit in the same chronological timeline. |

## **D - Homebrew, Sharing & Content Scope**

| **Q#** | **Topic** | **Decision** |
|---|---|---|
| Q41 | Homebrew Strategy | Create + Import + Share (local). All three workflows are core features. "Share" means local file export (.grimoire-pack), not an online database. |
| Q42 | Content Sharing Pipeline | \[REVISED\] Local .grimoire-pack files only. No online community database in scope for V1. |
| Q43 | Homebrew Version Control | Before committing an update, the engine scans dependencies and shows an explicit impact alert listing affected characters. |
| Q44 | Relational Dependency Tracking | Active. Deletion attempts on referenced objects trigger dependency warnings. |
| Q45 | DM Homebrew Access Control | DMs choose one of three modes per campaign table: Official SRD Only / Official + Approved Homebrew / Unrestricted. |
| Q46 | V1 Mandatory Builders | Race Builder and Class Builder are the two mandatory visual builders required for initial release. |
| Q47 | Offline Ingestion | Import once, store forever offline. No network access required after initial acquisition. |
| Q48 | Import Verification | \[REVISED\] A mandatory preview step is shown before any import is committed: what will be imported, source URL, content quality flags, and a summary of unsupported mechanics. |
| Q49 | Multi-System Scope | \[REVISED\] The underlying engine is system-agnostic internally, but multi-system support is not a V1 user-facing feature. The app ships as a D&D 5e companion. |

## **E - Campaign Infrastructure & Networking**

| **Q#** | **Topic** | **Decision** |
|---|---|---|
| Q50 | Session Sync Authority | \[REVISED\] DM-as-Host is the default authority model. An optional All-Equal peer mode is available. |
| Q51 | Offline Resilience | Sessions continue on local Wi-Fi or mobile hotspot. No internet connection required. |
| Q52 | DM Character Permanence | DMs cannot permanently alter a character's baseline sheet. Campaign overrides are session-scoped. |
| Q53 | Campaign Sync Entry Control | The player chooses between syncing a Live Sheet or a Campaign Snapshot. The DM can approve or decline external sheet variations. |
| Q54 | DM Private Workspace | DMs maintain an isolated private dashboard: hidden NPC HP pools, secret quest chains, upcoming plot notes. Never visible to players. |
| Q55 | Shared Party Tools | Unified party ledger, quest log, and loot tracker accessible to all connected players. |
| Q56 | Co-DM Delegation | Supported, but not a V1 launch requirement. |
| Q57 | Encounter Persistence | Both modes: permanent encounters linked to a campaign folder, or quick one-off scenarios. |
| Q58 | V1 Spatial Mapping | V1 is a companion app only. No map engine. The V2 stretch goal is aspirational and must not influence V1 architecture. |
| Q59 | Conflict Resolution | DM-authority mode: DM's edit wins automatically. All-Equal peer mode: manual resolution dialog with before/after values. |

# **5\. Content & Licensing Boundaries**

## **What Grimoire Bundles (SRD 5.1 - Safe)**

D&D 5e System Reference Document 5.1 is published under Creative Commons Attribution 4.0. Grimoire may bundle and distribute SRD content freely.

## **What Users Can Import (At Their Own Risk)**

The import tool allows users to ingest content from D&D Wiki, Homebrewery, or any other source for personal use. The app must display a clear disclosure on import: "This content may be protected by copyright. Imported data is for personal use only."

## **What Cannot Be Hosted or Shared Publicly**

Any content beyond the SRD cannot be included in shared .grimoire-pack files uploaded to any public database. V1 local-only sharing mitigates this risk entirely.

# **6\. Architectural Decisions Summary**

| **Decision Area** | **Original** | **Revised** |
|---|---|---|
| Technology stack | "Dart / Flutter (incorrect)" | TypeScript / React Native / Expo SDK 56. |
| Multi-system scope | Advertised as universal system architecture | Internal engine design only. Ships as D&D 5e app. |
| Import verification | One-click, no preview | Mandatory preview step with source and quality flags. |
| High-level generation | Step-by-step only | Step-by-step default + Fast-Track for DM entities. |
| Session sync authority | All-Equal peer-to-peer (default) | DM-as-Host default. All-Equal available as opt-in. |
| Offline trait editing | Blocked until DM approves | Edits queued as pending review; character remains functional. |
| Character timeline | Automated milestones only | Automated + manual narrative journal entries. |
| Community database | Core V2 feature | Removed from roadmap. Requires separate product planning. |
| V2 map engine | Planned release feature | Aspirational stretch goal only. No V1 architectural dependencies. |
| Concentration tracking | Deferred to Phase 4 encounter layer | Moved to Phase 1 base sheet. |
| Session Mode | Not specified | Glanceable combat dashboard added to Phase 1. |
| Legal / licensing section | Not specified | Section 5 added. SRD bundling, import disclosure, sharing limits. |

*Grimoire — Personal D&D 5e Companion Application — Revised Specification*
