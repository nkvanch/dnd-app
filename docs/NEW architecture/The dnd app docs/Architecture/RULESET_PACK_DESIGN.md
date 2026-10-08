# Ruleset Content Packs — Design Sketch (C++ port)

> **Status: proposal, not implemented.** This extends two things that already
> exist: the ruleset-abstraction plan in `MULTI_SYSTEM_VISION.md` (the
> *engine* side — stat lists, modifier formulas, resolution models) and the
> currently-unused `packType: 'content-pack'` field already reserved in the
> backup format (`src/engine/backup.ts`) (the *distribution* side). This doc
> is the missing piece connecting them: how a ruleset's content actually
> ships, updates, and loads at runtime in the C++ port, for a future with
> several d20 systems and ongoing errata/expansion content.

## The problem this solves

Today there's one ruleset (5e), content is compiled into the app, and an
update means shipping a whole new app build. That breaks down once there are
several rulesets (5e, 5.5e, OSE, 3.5e/PF1e, PF2e, 4e, AD&D per
`MULTI_SYSTEM_VISION.md`'s roadmap) each with their own sourcebooks and
errata arriving on their own schedule. The goal: content becomes a
versioned, swappable **pack file**, not app code — while runtime lookups stay
exactly as fast as the current in-memory hash-map approach (this is a
*distribution* format, not a per-lookup query engine — see the discussion in
the earlier chat message).

## Two layers per ruleset, not one

`MULTI_SYSTEM_VISION.md` already draws this line for the engine; the pack
format should mirror it exactly:

1. **`RulesetDefinition`** — engine configuration. Stat list + modifier
   formula/table, resolution model (proficiency bonus / BAB / THAC0 /
   proficiency ranks) + its params, save categories, skill list, which
   resource model(s) are available (Vancian slots, 4e-style at-will/
   encounter/daily, etc.). Small, changes rarely once a ruleset ships.
2. **`RulesetContent`** — the actual game data: races, classes, spells,
   items, monsters, feats, conditions, backgrounds. Large, updates
   frequently (new sourcebooks, errata).

A pack file can define a **new ruleset** (ships both layers) or be an
**expansion** for an existing ruleset (ships content only, references the
parent ruleset's id).

## Id namespacing

Today ids are bare strings (`"fireball"`) implicitly unique because there's
only one ruleset. With several, every content id must be scoped:
`(rulesetId, type, id)` as a compound key — same trick `content_cache`
already uses for homebrew (`"type:id"` composite primary key), just one level
deeper. `Entity` gains `rulesetId` (already called for in the vision doc);
every content reference an Entity holds (`raceId`, `classId`, spell ids in
`spellcasting.known`, etc.) is implicitly scoped to that entity's own
`rulesetId` — no entity ever references content from a different ruleset.

## Pack file format

**Recommendation: one SQLite file per installed pack**, structurally almost
identical to the existing `content_cache` table, because it lets the app
reuse the exact upsert-by-id pattern already used everywhere in this
codebase instead of inventing a new one:

```sql
-- e.g. dnd5e-core.pack, dnd5e-xanathars.pack, pf2e-core.pack, ose-core.pack
CREATE TABLE pack_meta (
  key TEXT PRIMARY KEY, value TEXT
  -- keys used: rulesetId, packId, packVersion, formatVersion,
  --   definesRuleset (bool — true only for a ruleset's "core" pack),
  --   dependsOnRulesetId (for expansion packs),
  --   license (e.g. "SRD 5.1 CC-BY-4.0", "ORC", "OSR"),
  --   displayName, createdAt
);

CREATE TABLE content (
  id       TEXT PRIMARY KEY,   -- "<type>:<contentId>" — same composite-key trick as content_cache today
  type     TEXT NOT NULL,      -- 'race'|'class'|'subclass'|'spell'|'item'|'feat'|'background'|'condition'|'monster'|...
  data     TEXT NOT NULL,      -- JSON blob — same shape as today's Race/CharClass/Spell/Item/... types
  srd      INTEGER,            -- per-item legal-audit flag, same semantics as today's Spell.srd/Item.srd (nullable = unaudited)
  version  INTEGER NOT NULL DEFAULT 1,   -- REAL versioning — bumped every time this row changes (unlike today's dead content_cache.version)
  deleted  INTEGER NOT NULL DEFAULT 0,   -- soft-delete marker for patch packs (see below)
  updatedAt INTEGER NOT NULL
);

CREATE TABLE ruleset_def (        -- present only in a ruleset's "core"/defining pack
  id INTEGER PRIMARY KEY DEFAULT 1,
  data TEXT NOT NULL              -- RulesetDefinition JSON: stat list, modifier formula, resolution model, save categories, skill list, resource models
);
```

Sourcebooks/expansions ship as their own pack files that reference the
parent ruleset (`dependsOnRulesetId`) and contain `content` rows only, no
`ruleset_def`.

## Updates without an app rebuild

Two mechanisms, both just "ship a file":

- **Full pack replace** — download a new pack file with a bumped
  `packVersion`, swap it in, reload that ruleset's content index.
- **Delta/patch pack** — a small pack containing only changed or new rows
  (same `INSERT ... ON CONFLICT(id) DO UPDATE` upsert already used
  everywhere in this app) plus rows marked `deleted = 1` for anything
  removed by errata. This mirrors how `deleted_builtin_ids` in `app_meta`
  already soft-deletes shipped-but-unwanted built-in homebrew today — same
  pattern, generalized.
- Per-row `version` (finally a *real* use of the versioning the current
  `content_cache.version` column implies but doesn't actually implement)
  lets the app show "12 items changed in this errata" and lets a saved
  character detect "this save references pack X v3, but only v2 is
  installed" — feeding directly into the `ContentSnapshot` safety net below.

## Legal/audit metadata travels with the pack

`pack_meta.license` records the licensing basis for the whole pack (SRD 5.1
CC-BY-4.0 for 5e core, an OSR license for OSE, ORC for PF2e, etc.); each
content row still carries its own `srd`-style flag for per-item exceptions
(Product-Identity-named items, etc.) — the same two-level pattern (blanket
default + per-item override) the current app already uses for 5e, just made
ruleset-generic instead of assuming "SRD" always means D&D 5e's SRD
specifically. The existing offline audit methodology (deny-list /
allow-list / unaudited-defaults-to-excluded, built by directly reading the
source license text — see `CPP_PORT_ARCHITECTURE.md` §7) is reusable
verbatim per ruleset: run one instance of that pipeline per system, output
one pack file instead of one `generated.ts`.

## Character safety matters more here, not less

Once content can be patched out from under a player between sessions
(unlike today, where content only changes when the whole app updates), the
`ContentSnapshot` idea already specified in `DATA_MODEL.md` — *characters
never depend on live content, they store a snapshot of what they used* —
stops being aspirational and becomes load-bearing. A character built against
`dnd5e-core v2` must keep working correctly after the DM's device updates to
`v3`. Build this in from day one of the pack system rather than retrofitting
it later; "an errata update silently changes an in-progress character" is
exactly the failure mode a pack-based update story will produce constantly
if snapshotting isn't there from the start.

## Loading layer / startup flow

1. Enumerate installed pack files: app-bundled "core" packs for launch
   rulesets, plus a user-writable directory for downloaded packs/expansions/
   updates.
2. For each pack: open it, read `pack_meta`, verify `formatVersion`
   compatibility (same shallow-reject-on-mismatch pattern as today's
   `validateGrimoirePack`), read `ruleset_def` if present (registers a new
   ruleset) or confirm it matches an already-loaded ruleset (an expansion),
   then read all non-deleted `content` rows into **one in-memory hash map**
   keyed by `(rulesetId, type, id)`. The SQLite file is a shipping/versioning
   container, read once at startup — runtime lookups never touch it again,
   matching how `ContentRegistry` already works today for the single-ruleset
   case.
3. Homebrew content keeps living in the existing mutable tables, now scoped
   by `rulesetId` too, and merged on top at query time exactly like today's
   `getMergedContentDB()` — just parameterized by which ruleset the active
   character/campaign uses.
4. `Entity.rulesetId` determines which `RulesetDefinition` (stat list,
   modifier formula, resolution model) `recomputeDerived` dispatches to, and
   which content-index partition character-creation screens query against.

## Deliberately not building (yet)

Matching this project's stated "no premature abstraction" discipline: no
cross-ruleset content sharing/dependency graph, no package-manager-style
dependency resolution, no binary diffing for patches (plain row-level
upsert is enough at this catalog size). Keep the pack format to exactly what
today's app already knows how to do — SQLite + JSON blob columns + upsert by
id + a version counter — just parameterized by ruleset instead of assumed
singular.

---

## Why these choices, and what else was considered

### Why SQLite pack files, instead of flat JSON or a binary format (protobuf/flatbuffers)

Three real alternatives, each rejected for a specific reason:

- **Flat JSON file per ruleset** (the simplest possible option — literally
  extend the existing `.grimoire-pack` `content-pack` shape to hold official
  content too): loses the one thing a real content catalog with ongoing
  updates actually needs — **row-level upsert without rewriting the whole
  file**. A delta/errata update to 12 items out of 900 means regenerating
  and re-shipping the *entire* JSON file; with SQLite it means shipping a
  tiny patch file containing only those 12 rows. JSON wins for *backups*
  (§9.1 of `CPP_PORT_ARCHITECTURE.md` — write-rarely, read-rarely, human-
  readability matters more than update granularity) but loses for
  *content*, which updates far more often and at a much larger total size.
- **protobuf/flatbuffers** (schema-driven binary serialization): real
  benefits (smaller files, faster parse, strong schema versioning tooling)
  but real costs too — a codegen step, a schema-definition language to
  maintain in parallel with the actual C++ types, and the loss of "just
  open it in a SQLite browser to debug a bad pack" that SQLite gives for
  free. At this content scale (low thousands of rows per ruleset, well
  under a few MB per pack even as plain JSON-in-SQLite) parse speed isn't a
  real bottleneck — the debuggability and free upsert-by-id tooling SQLite
  provides matter more in practice than the binary format's size/speed
  edge.
- **A single big multi-ruleset database instead of one file per pack**:
  rejected specifically because it breaks the "download and swap in an
  update" story — you can't ship a 3MB PF2e errata update to someone who
  only has 5e installed without touching a shared file that also holds
  their 5e data (and their homebrew, if it lived in the same file). One
  physical file per pack makes "install," "update," and "remove a ruleset
  you don't play" each a plain filesystem operation with no risk to
  unrelated data.

**Verdict**: SQLite-per-pack wins specifically *because* of the ongoing-
updates requirement that motivated this whole document — it's the option
that makes "ship a small patch instead of a full replacement" cheap and
built on tooling (upsert, versioned rows) this codebase already relies on
elsewhere, not a new dependency.

### Why query-once-then-cache-in-memory, instead of querying SQLite live at runtime

The tempting-sounding "just query the DB by id whenever you need content" —
the exact idea this whole thread started from — was rejected for the same
reason it was rejected for today's single-ruleset case: a prepared-statement
query, even a fast one, is strictly slower than an already-built in-memory
hash map lookup, and static content by definition doesn't change between
app launches, so there's nothing to gain from re-querying it live. SQLite
here is earning its place as a **distribution and update format**, not a
runtime query layer — the two are easy to conflate and shouldn't be.

### Why compound-key namespacing `(rulesetId, type, id)`, instead of globally unique ids (UUIDs) for content

**Why not just make every content id a UUID**, sidestepping the namespacing
question entirely: it would work, but throws away everything §13.1 of
`CPP_PORT_ARCHITECTURE.md` argues for — human-readability in hand-authored
cross-references, determinism across regeneration from source, and
reviewability of collisions. A UUID-per-spell is exactly as opaque as a
sequential integer would have been, just longer. Namespacing the existing
human-readable slug scheme by ruleset (`dnd5e:fireball` vs. `pf2e:fireball`)
keeps every one of those properties while solving the only real problem
bare slugs had (collision across independently-authored rulesets that both
happen to have a spell called "Fireball") — it's the smallest change that
fixes the actual problem, rather than replacing a working scheme wholesale
because a different, unrelated part of it (numeric vs. string) was also
being reconsidered at the same time.

### Why per-row soft-delete (`deleted` flag) instead of a real `DELETE`

A patch pack needs to be able to say "this row is gone as of this errata"
without requiring every installed copy to have seen every prior patch in
order — a plain SQL `DELETE` shipped in a patch file only removes a row
that's actually present in the target database, which is fine, but gives no
signal to the in-memory index merge step about *why* a row is missing
(never existed vs. deleted on purpose) when packs from different sources/
versions are being combined. A `deleted` flag is a row like any other —
it upserts the same way an ordinary content change does, arrives
consistently regardless of what version the receiving device started from,
and is exactly the same pattern `app_meta`'s `deleted_builtin_ids` already
uses today for "remove shipped content without deleting code." Real
`DELETE` remains fine for a full pack *replacement* (swap the whole file),
just not for incremental patches.
