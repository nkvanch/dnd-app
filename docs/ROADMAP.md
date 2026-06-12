# Grimoire — Roadmap

Sequenced priorities for development. Each item is either done, in progress,
or explicitly deferred with a reason. Items are grouped by the question
"what makes the biggest difference to someone using this at their table?"

Read PRODUCT_PRINCIPLES.md for the philosophy, UI_RULES.md for UI constraints,
ARCHITECTURE.md for the technical design, IMPLEMENTATION.md for schemas.

---

## Current state (what works today)

- Character creation wizard (all 12 classes, 9 races, 13 backgrounds)
- Live character sheet (6 tabs, rest bar, conditions, spell slots, hit dice)
- Rules engine: effects, pipeline, audit trail, action cards
- 82 feats with ASI/feat picker (creation + in-play level-up)
- 487 class-tagged spells
- DM dashboard (party view, encounter, monsters)
- Homebrew builders (spell, race, feature, class scaffold)
- Local WiFi sync (TCP, NDJSON, event-sourced, not yet tested two-device)
- SQLite persistence, offline-first

---

## Pre-release priorities (in order)

### 1. Character header — HP and AC always visible
**Size:** hours.
**Impact:** every player at every session.

The most-used values are not in the most-visible place.
Move HP + AC + Speed into the persistent sheet header.
No engineering work — purely moving UI elements.
Do this before anything else because it affects everyone immediately.

### 2. Settings screen
**Size:** small.
**Impact:** philosophical requirement.

The vision is "the app adapts to your table." Without configurable rules,
the app imposes its defaults on every table. Settings must expose at minimum:
- Level cap (default 20)
- HP mode: fixed (class max), rolled, average
- Multiclassing on/off
- Feat option on/off
- XP vs milestone leveling

These already exist in CampaignRules in the engine. The work is surfacing them
in a UI and connecting them to the active rules object.

### 3. Wire homebrew into character creation
**Size:** medium (see split below).
**Impact:** closes the core differentiator gap.

Today homebrew follows this path:
  Create → Saved → Dead end

It should follow:
  Create → Saved → Available in creation → Appears on sheet → Works in campaign

**Part A (do first — one sprint):**
Wire homebrew races, spells, backgrounds, and features into the creation wizard.
These already have the right shape (they're Feature/Effect data).
The creation wizard reads from globalContentDB; add homebrew items into that merge.
Custom race appears in the race picker. Custom spell appears in spell selection.
This closes the loop for the most common homebrew use cases.

**Part B (separate project — larger):**
Homebrew classes and subclasses.
A class is not just data — it's a level-1-to-20 progression with choices, grants,
spellcasting init, resource scaling, and ASIs. The class builder currently produces
a scaffold. Turning that into a real playable class requires designing an authoring
surface for progressions.
Do not block Part A on Part B.

### 4. Spellbook tab
**Size:** medium.
**Impact:** every spellcasting player session.

Add a seventh in-page sheet tab: **Spells**.
This tab only renders for characters with a spellcasting class.
(Barbarians and Fighters do not see an empty Spells tab.)

The Spells tab must show:
- Cantrips, then levels 1–9 in collapsible sections
- Each spell: name, school, casting time, concentration tag, ritual tag
- Prepared vs unprepared (for prepared casters: Wizard, Cleric, Druid, Paladin)
- A Cast button that uses the same code path as the action card Use button
- On cast: spell slot consumed, concentration dialog if applicable

One cast function. Two entry points (action card + spellbook).
The existing action card Use → resource consume → modal flow is the reference.
Do not write a parallel implementation.

See UI_RULES.md Rule 6 for the complete specification.

### 5. Campaign overview screen (between-sessions surface)
**Size:** medium.
**Impact:** engagement between sessions, party-platform feel.

The campaign pillar currently exists only for live sync (DM tools, encounter).
Players need a surface that's useful on a Wednesday, not just on game night.

Additions:
- Session log (the DM can record a short session summary after each session)
- Quest tracker (Active / Completed / Failed — DM-managed)
- Campaign notes (free text, shared read-only with players)
- Party member list with HP, class, level (read-only for players)

This does not require live sync — it uses the existing campaign data model and
SQLite persistence. It is stored per-campaign and readable offline.

### 6. Home screen campaign state
**Size:** small (given #5 is done).
**Impact:** the "platform vs builder" feeling.

Once #5 exists, surface the relevant data on Home when a campaign is active.
See UI_RULES.md Rule 7 for the three states (no campaign / between sessions / live).

Without a campaign overview (#5), this screen has nothing to show.
Build #5 first or Home will still feel empty.

---

## After release

### Audit trail completeness
Every number that appears in the UI must produce a non-empty, correct audit trail.
The product principle "every number is explainable" creates this as a contract.

Priority audit targets (must all produce Base + Contributors = Total, always):
- AC, Speed, Initiative
- All 6 ability scores (effective)
- All 6 saving throws
- All 18 skills
- Passive Perception, Investigation, Insight
- Spell Save DC, Spell Attack Bonus
- HP maximum
- Proficiency Bonus

When this is complete, the "Explain Any Number" feature is marketable.

### Spell selection on level-up
Casters who know a fixed number of spells (Wizard, Sorcerer, Bard, Warlock, Ranger)
must choose new spells when leveling up. Currently level-up handles ASI/feats but
not spell selection.

Required: a per-class known/prepared counts-by-level table, and a level-up flow
that queues a spell selection choice alongside or after the ASI choice.

### Quest log and shared journal
Extend the campaign overview (#5 above) with:
- Quest log (Active / Completed / Failed)
- Shared session journal (DM writes, players read)
- NPC notes
- Location notes

This is the primary between-sessions engagement surface.

### Ruleset concept (architecture, not UI)
Formalize the implicit "ruleset" that already exists as CampaignRules.
A ruleset is: a set of rules + a default content pack + a name.
Today: D&D 5e is the only ruleset and it's implicit.
Future: "D&D 5e", "Nick's House Rules", "Nika's Campaign Rules" are different rulesets
that a campaign can declare.

This does not require a user-facing tab. It is an architectural concept that enables:
- Campaigns declaring their exact rules version
- House rule packs layering on top of the SRD pack
- Future: different base systems (Pathfinder, custom) as different rulesets

The current CampaignRules type is the seed. Growing it into a full Ruleset object
(with name, content pack list, and override declarations) is the prep work.

### Content pack architecture
Wrap contentDB as named, versioned, enable/disable packs.
The existing getMergedContentDB() merge becomes: merge all enabled packs in order,
later packs override earlier ones by id.

This delivers: pack provenance in audit trails, house-rule overrides of official
content, shareable homebrew packs, and the content layer of the Ruleset concept.

### Shared inventory and party loot
A campaign-level inventory for loot and shared items.
DM adds items, distributed to party members or held in the shared pool.

### Class builder — full progression authoring
See Pre-release priority #3 Part B.
A UI for authoring a full class progression: features per level, choices, spellcasting,
resources, ASI slots. This is the authoring-surface completion of homebrew-first.

---

## Explicitly deferred

These are understood, valued, and deliberately not being built yet.

**Multiclassing** — requires significant identity model rework. The entity has one
classId; multiclassing requires a list. Good constraint: don't build until the single-
class experience is excellent. Setting: keep the "allowMulticlass" flag off and obvious.

**Cloud sync** — local WiFi sync is sufficient for table play, and offline-first is
a product principle. Cloud requires accounts, servers, and latency handling. Defer
until local experience is complete and there's a real demand signal.

**Non-D&D rulesets** — the engine is generic, which is good. But the content,
UI language, and creation wizard are all D&D. "Make it work for Pathfinder" is a
multi-month project. The right sequencing: excellent D&D 5e first, then generalize
based on real second-system requirements.

**Generic resource pools replacing spell slots** — spell slots work correctly today.
Replacing them with a generic pool system is refactoring risk with zero user-visible
benefit. The abstraction will emerge naturally if and when a second system needs it.

**Full session replay / time travel** — the event log exists. Full replay is a nice
debugging tool but not a table feature. Defer.

**Marketplace / import ecosystem** — the import pipeline (Claude parses a URL into
content) is built but untested. Getting it working reliably on real input is the
near-term goal. A marketplace or sharing ecosystem is much further out.
