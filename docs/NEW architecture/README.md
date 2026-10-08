# NEW architecture — index

This folder captures the next-generation architecture proposal developed for
Grimoire, distinct from the ruleset-generalization work already in progress
on the `fundamental-changes` branch (see `docs/` root for that content and
the plan tracked outside this repo). **Status: proposed, not implemented.**
No code in this repo currently reflects any of the types or flows described
here — they are a design target for future work, not a description of the
current engine.

- [CURRENT_AND_PLANNED.md](CURRENT_AND_PLANNED.md) — a snapshot of what's
  actually built and verified in the app today, what's in progress (the
  `fundamental-changes` ruleset migration), and what's planned but not
  started. Start here if you want status rather than design.
- [APP_QUIRKS.md](APP_QUIRKS.md) — distinctive house-style conventions and
  gotchas verified against actual source: how Free Edit and DM Override
  relate (one is a special case of the other), the soft (not locked)
  build-vs-play editing split, homebrew builder conventions, the house-rule
  system's enforced-vs-reminder-only split, the `sourceKind`/`sourceId`
  provenance pattern, and other implementation-level quirks (the
  `Alert.alert` web shim, full-recompute discipline, Wild Shape's shadow HP
  pool). Not a feature list — read this for "how things actually behave and
  why," not "what exists."
- [ARCHITECTURE.md](ARCHITECTURE.md) — the overall five-product vision, the
  layered system (UI → Application → Pure Core → Content/Rulesets →
  Persistence/Sync), and the core domain types (Entity, Feature, Effect,
  Ability, Resource, Condition/TemporaryEffect, Override, Simulation,
  Combat, Content/Versioning, and what's explicitly deferred until the
  eventual C++ desktop port for DM tooling).
- [MUTATION_UNDO_TIMELINE.md](MUTATION_UNDO_TIMELINE.md) — the specific,
  settled design for how mutations, undo/redo, and the mechanical session
  timeline work. This went through three rounds of revision; the version
  in this file is the final one, which deliberately does **not** use a
  general-purpose Command/DomainEvent/event-sourcing architecture — that
  was considered and explicitly rejected as over-engineering for this
  project's current scale.

## Relationship to what's actually built today

Grimoire's engine already has some of the primitives this design assumes:
a pure, immutable `Entity` type recomputed from scratch on every derived
stat (`src/engine/pipeline.ts`), and a working explainability system
(`src/engine/audit.ts`'s `explainValue()`, surfaced via `AuditModal`) that
answers "why is this number what it is" — the first of the three signature
features this architecture is built around (Explainability, Simulation,
Mechanical History). Simulation and Mechanical History are not built yet;
this folder is the design for building them.
