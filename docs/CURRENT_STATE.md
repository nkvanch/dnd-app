# Grimoire — What We Have Now

*A snapshot of the actual, shipped state of the app — not a roadmap, not a pitch. Everything below is built and working today.*

---

## What it is

Grimoire is an **offline-first tabletop RPG companion**. D&D 5e is the first ruleset, but the engine treats rules as data, not hardcoded logic — characters and monsters both run through the same `Entity` pipeline, and every derived number (AC, a save, a skill bonus) is auditable back to its source (base + race + class + item + condition + override).

Runs on **Android** today (iOS untested — no device to test on yet, web preview used for development). Fully functional with **no account, no internet connection, no server**. An optional local-WiFi sync lets a table share a live session — no cloud, nothing leaves the network.

---

## Character creation

A full guided wizard: race/subrace → class → background → ability scores (standard array, point buy, manual, or 4d6) → skills → starting equipment → spells → review. Produces a rules-correct character with every number computed by the engine, not typed in by hand.

- Data integrity guaranteed across the whole flow: switching class/background/race mid-creation cleans up and re-applies the right skills, features, and ASI bonuses — nothing double-stacks or ghosts.
- Starting-equipment "choose 2 of X" style choices are real constrained pickers, not flattened to one example item.
- Homebrew content (races, classes, subclasses, backgrounds, feats, spells, items) participates identically to official content everywhere in the flow.

## The character sheet (live play)

Multi-tab sheet: Combat, Actions, Abilities, Spells, Features, Exploration/Inventory, Notes.

- HP, AC, death saves, conditions (with duration tracking and a player-facing End Turn), concentration, spell slots, hit dice, class/subclass/homebrew resources — all live-editable, all audited.
- Auto-generated action cards (attacks, spells, features) grouped by action economy, greyed out with a reason when unaffordable.
- **Preview before you commit**: resting, gaining a feat, equipping/unequipping gear, and leveling up all show a before/after diff first — "HP: 2 → 8", "New attack: Longsword" — before anything is applied.
- **Undo/redo** for the current session, plus a **persistent timeline** of every mechanical change with human-readable labels ("Took 8 damage", "Equipped Chain Mail", "Short Rest").
- **Progression planner** — a read-only "what would I look like at level 7?" projection that never touches the real character.
- Live editing that used to be creation-only is now also available mid-campaign: add/remove features, add a feat, author a one-off custom feature on the spot, change background entirely (with a skill-retrain checklist).

## Homebrew authoring

11 guided builders: Race, Subrace, Class, Subclass, Background, Item, Spell, Feature, Feat, Monster, Condition.

- Builders **author real structured choices** (Expertise/Tool/Language pools, ability-score options, etc.) through one shared choice-authoring component — not free text, not a second parallel data model.
- **Homebrew test bench**: simulate a draft's actual mechanical effect against a scratch character *before* saving it, so you can see "this feat gives +1 AC" instead of trusting your own description.
- Version history on every homebrew entry.

## Portability — the `.grimoire-pack` format

One file format serves both personal backups and shareable homebrew content packages.

- Export a single entry, a multi-selection, or an entire installed pack — with automatic dependency-closure detection (exporting a subclass pulls in the class/spells/features it needs, shown to you before export, never silently).
- Import shows a full preview first: contents, ruleset, warnings, and per-item conflict resolution (**Keep Local / Replace / Import As Copy**) before anything touches your library.
- Content keeps a stable identity across devices — never a raw database row ID — so re-importing, updating a pack to a newer version, or copying content never breaks references.
- Deletion is protected: uninstalling a pack warns you exactly which characters, encounters, or other homebrew still depend on its content.

## Compendium & content browsing

One unified, searchable, filterable, sortable browser across all ten content types — races, subraces, classes, subclasses, backgrounds, feats, spells, items, monsters, conditions — official and homebrew together, with favorites and readable source/provenance labels (never a raw pack ID).

Every large picker in the app (character creation, live "Add Spell"/"Add Feat"/"Add Item", DM tools) shares the same search + filters + sort pattern, with context-aware filtering (a subclass picker inside a known class never asks you to re-filter by class) and state that survives navigating to a detail view and back.

## Content library

Full SRD-derived coverage: every official race, class, subclass, feat, and background, plus a complete monster library (322 monster templates, all tagged SRD: the SRD 5.1 stat blocks as this repo counts them, where a few variants such as Giant Rat (Diseased) are separate entries, so the raw count can differ by one or two from other stated SRD totals; cross-checked against the official SRD 5.1 PDF, no non-SRD monster found) and a broad spell/item catalog. Extensive UA (Unearthed Arcana) and partially-official content on top.

## Running the table (DM)

Party dashboard (spell slots, wild shape, exhaustion at a glance), encounter builder and live tracker, monster library, multi-target tools (act on several combatants at once), temporary/ad-hoc rulings, prepared-encounter planning, and a per-campaign content manifest (a DM can ban specific homebrew packs from their table).

## Engine correctness

- Deterministic effect stacking — the same inputs always produce the same result regardless of the order effects were collected in (locked in by shuffle-invariance tests, not just a fixed example).
- Configurable ability-score caps (not a hardcoded 20) sourced from ruleset/campaign rule/feature/item, applied identically across every increase path — level-up ASI, feat ASI, creation, live edits.
- Descriptive (never auto-simulated) outcome and trigger data for reactive features like Sneak Attack or Shield — the player still rolls and applies everything themselves, matching the app's own "the table plays, the app tracks" philosophy.

## Quality bar

TypeScript throughout, **1,350+ automated tests**, clean typecheck and lint enforced on every change, and a live-verification discipline (real browser click-throughs, not just green tests) before anything is called done.

---

## Known gaps, honestly

- **iOS**: implemented, never tested on a physical device.
- **Images/visual cards**: deliberately deferred — the data model already has room for `imageUri`/`thumbnailUri`, but no UI uses them yet. Planned as a later polish pass, after browsing/filtering stability (which is now done).
- **Other rulesets** (5.5e, PF2e, older editions): the architecture is explicitly designed to support them (content can already be ruleset-tagged), but only a proof-of-concept slice has been built. 5e is the only fully-realized ruleset today.
- **LAN sync**: works over local WiFi only — no remote/internet play yet, by design (no server, no account).
