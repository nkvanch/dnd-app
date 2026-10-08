# Grimoire — Current Functionality & Planned Work

This document is a snapshot: what's actually built and verified in the app
today, what's in progress, and what's planned but not started. It
complements [ARCHITECTURE.md](ARCHITECTURE.md) and
[MUTATION_UNDO_TIMELINE.md](MUTATION_UNDO_TIMELINE.md), which describe the
*proposed* future design — this file is about present state and near-term
sequencing. "Built" items below were verified against actual source in this
pass, not assumed from history.

## Part 1 — What's built today

### Character creation & management
- Full creation wizard: race/species, class, subclass, background, feats,
  spells, equipment, review (`app/creation/*.tsx`)
- Multiclassing, with per-class progression and an "add a class" flow
  (`src/engine/multiclass.ts`, `leveling.ts`)
- Content library: 9 official races + 24 partially-official races, every
  official subclass for every class, a full custom Blood Hunter base class
  (plus all 4 Orders), a full UA sweep, all official feats + UA feats, full
  spell and item libraries
- Inventory with exact quantities, HP/temp HP/death saves, movement &
  senses, conditions, wild shape, resources with recharge tracking,
  favorites (starred quick-access), a global + contextual dice roller,
  character notes
- Full audit/explainability UI (`AuditModal`, backed by
  `src/engine/audit.ts`'s `explainValue()` — tap AC or a skill, see the
  breakdown) and a manual override escape hatch (`FreeEditModal` for
  players, `DmOverrideModal` for DMs)
- **Partial**: attunement (tracked on items, no UI toggle, uncapped), pact
  magic slots (modeled and recharged by the engine, no UI shows or spends
  them), temp buff durations (ticked by the engine, but the player's own
  "+Add condition" never sets a duration and nothing shows time remaining)

### Live play / combat
- A dedicated Combat tab, separate from the full sheet, with compact
  HP/AC/speed/conditions/resources/favorites (`app/sheet/[id].tsx`)
- Damage/heal application, resource spend/restore, ability activation,
  condition add/remove
- Concentration tracking (shows what you're concentrating on, auto-drops
  linked effects when it ends) — no rounds-remaining counter yet
- **Missing**: per-turn action/bonus-action/reaction usage tracking, a rest
  preview before applying, a combat log, duration ticking outside a
  DM-run encounter (a player without a DM never sees their own buffs
  expire)

### DM tools
- `app/dm/dashboard.tsx`, `app/dm/encounter.tsx` (initiative/combat manager
  with a Quick Panel for damage/heal/kill), `app/dm/monsters.tsx` (monster
  library + spawner), plus a per-character DM view
- Wild-Shape-aware HP handling on both player and DM sides
- Further DM-side build-out is intentionally **paused until the eventual
  C++ desktop port** — real DM tooling needs native Windows and Linux
  desktop apps, which this Expo/React Native codebase doesn't target well.
  This is a deliberate scope decision, not a gap.

### Homebrew & content authoring
- 9 of 10 builders present: race, subrace, class, subclass, feat, spell,
  item, background, monster (`app/homebrew/*.tsx`) — no condition builder
  yet
- Shared `feature-editor.tsx` mechanic editor, though it only exposes 6 of
  the engine's ~13 `Effect` types
- Homebrew compiles into the same domain types as official content — no
  parallel homebrew engine
- Local version history (SQLite-backed, per-item restore), an
  import-review screen, a rare-items screen
- Search/filter exists but is fragmented per screen (creation flow,
  homebrew tab, DM monsters tab) — no single cross-type compendium, and
  conditions have no browse UI at all
- **Missing**: a homebrew test bench (scratch-character before/after
  preview), pack dependency graphs, ruleset compatibility checking

### Data portability
Three distinct, working export mechanisms, confirmed structurally
separate: character export (PDF/TXT/MD), `.grimoire-pack` for sharing
content, and a full installation backup.

### Rules platform
- Explainability is done — the one "signature feature" (of the three
  described in [ARCHITECTURE.md](ARCHITECTURE.md#1-five-products-one-domain-model))
  that's actually built
- A real structured house-rule catalog (`houseRules.ts`) applied via
  `CampaignRules`, scoped to one campaign rather than a portable named
  profile
- **Not yet built**: simulation/what-if previews, a progression planner,
  session/mechanical timeline, undo/redo, character snapshots,
  version-aware homebrew-on-character notifications, multi-ruleset support

## Part 2 — In progress

**Ruleset-generalization migration**, branch `fundamental-changes`
(off `main`, both pushed). Target sequence: 5e (current) → 5.5e (near-term)
→ PF2e → older D&D editions. For 5.5e specifically, the scope is
content-tagging only (a `rulesetId`/edition field) — not the full
`RulesetDefinition` parameterization, which is deferred to the PF2e
milestone.

| Phase | Description | Status |
|---|---|---|
| 1 | Unify `audit.ts`/`pipeline.ts` formula duplication | Code complete, **uncommitted** |
| 2 | `CustomResource` source tagging (fixes `clearClassData` resource-wipe bug properly) | Code complete, **uncommitted** |
| 3 | Typed/branded content IDs | Not started |
| 4 | `ContentHeader` unification + `rulesetId` tagging + fix class dual-array desync | Not started |
| 5 | `Effect` taxonomy split | Not started |
| 6 | 5.5e content authoring | Not started |
| 7 | Resource/action-economy unification | Deferred to PF2e milestone |
| 8 | `RulesetDefinition` scaffold | Deferred to PF2e milestone |
| 9 | `Ability`/`SkillName` genericization | Deferred to PF2e milestone |

Phases 1-2 are verified: `npx tsc --noEmit` clean, 305/305 Jest tests
passing. Nothing here is committed — commits happen only on explicit
request.

## Part 3 — Planned, not started

### Near-term functionality gaps (Live Play / Rules Platform)
Everything listed as "Missing" or "Partial" in Part 1 is real backlog, not
yet scheduled. The highest-leverage next investment, in order:

1. **Temporary effects + a duration engine** (`TemporaryEffectInstance`,
   `DurationDefinition`) — fixes the two worst current gaps (buffs with no
   visible duration, concentration with no rounds-remaining) and gives
   everything below a real substrate.
2. **Simulation/preview** (`simulateCommand`) — the engine's derived-stat
   pipeline is already a pure recomputation from scratch, so before/after
   diffing is close to free once built. One primitive powers equip-preview,
   feat-preview, rest-preview, the level-up planner, and the "what-if"
   sandbox simultaneously.
3. **Homebrew test mode** — nearly free once simulation exists (same
   diff primitive, pointed at a scratch character).
4. **Undo/redo and a mechanical timeline** — settled design in
   [MUTATION_UNDO_TIMELINE.md](MUTATION_UNDO_TIMELINE.md): an application-layer
   `mutate()`/`mutateMany()` choke point, RAM-only snapshot-based undo/redo,
   and a separate SQLite-backed, session-scoped timeline. Deliberately does
   *not* use a general Command/DomainEvent/event-sourcing architecture —
   that was considered and rejected as more generalization than this
   project's scale justifies.
5. **Content-authoring hygiene** — dependency viewer, broken-reference
   recovery, mechanically-intelligent version diffing, pack diagnostics.
   Lower priority until the homebrew library is large enough for these to
   matter.

Full domain-type-level detail (Entity, Feature, Effect, Ability, Resource,
Condition/TemporaryEffect, Override, Combat, content versioning, etc.) is
in [ARCHITECTURE.md](ARCHITECTURE.md).

### Explicitly deferred
Everything DM/multiplayer-shaped — campaign dashboard expansion, party
overview, encounter templates/groups, permission model, LAN session
ownership/handoff, campaign archive, player-to-DM requests, shared dice
log — waits for the C++ desktop port, per the product-vision scope
decision. Ruleset compatibility checking waits for the PF2e milestone.

None of Part 3 is scheduled. This file should be re-verified against
actual code before being treated as current — it reflects one point-in-time
audit.
