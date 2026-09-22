# Generic mode / player-state transformation layer — proposal

Status: **PROPOSED, NOT STARTED.** Captured 22 September 2026 from the user's own architecture write-up, triggered by asking whether Emperor Warlock (see [homebrew/EMPEROR_WARLOCK.md](homebrew/EMPEROR_WARLOCK.md)) could be built in Grimoire today. Do not begin implementation from this document alone — see "Before starting" below.

Related: [[project-grimoire-new-architecture-vault]] (a separate, earlier external design-review vault, different scope — ruleset migration, not mode-switching) and [[project-grimoire-platform-backlog]] (the user's other large not-started architecture proposal). This is a third, independent proposal in the same family: verified gaps, not yet approved for build.

## The problem it solves

Several class concepts need "the character has one active alternate state, chosen from a set, that swaps a block of features in and out": Druid Wild Shape, a shapeshifter's current form, an elementalist's stance, and Emperor Warlock's bound spirit. Today each of these would need its own hand-built, special-cased subsystem. The proposal is to build one generic primitive instead, so any of them — including homebrew ones — can be authored without new code per class.

## The 13 systems, in the user's stated priority order

1. **Mode Groups.** One active option at a time, from a named set (`ModeGroup { id, name, displayLabel, options, requireActiveOption, selector, switchRule }`).
2. **Atomic mode switching.** One mutation: validate → deactivate old (preserving its state) → remove its grants → activate new → apply its grants → recalc derived values → persist once → one timeline entry. Never a half-old/half-new state.
3. **External-result selectors.** The app records a player's own physical die roll (`ExternalTableSelector { entries: [{ value, optionId, label }] }`); it never rolls dice for content selection itself.
4. **Mode-owned persistent state.** A resource spent under mode A must still read as spent when the character leaves and returns to mode A. Requires splitting `modeActiveState` from `modeOwnedResourceState`.
5. **Level-gated mode progression.** Each mode option has its own `{ classLevel, grants }[]`; binding a mode at level 12 immediately grants everything up to level 10, and level 15 unlocks automatically later.
6. **Generic mode grants.** A mode option grants the same union type everything else grants (feature, action, spell/cantrip access, proficiency, resource, numeric effect, summon) — explicitly not new per-concept grant types. Provenance via `sourceKind: "mode"`, `sourceId`, `parentSourceId`, reusing the existing entitlement system.
7. **Typed numeric replacement effects.** `add | replace | minimum | maximum` on a stat, with a defined precedence order (base → additive → min/max constraints → replacement by source precedence → manual override → DM override → effective) — the user explicitly says to inspect the engine's *existing* effect-precedence logic before inventing a second one.
8. **Configurable switching costs.** `ModeSwitchRule { actionCost: none|action|bonusAction|reaction|manual, resourceId? }` — the app enforces a defined cost when the player presses Switch; it has no opinion on whether the fiction allows the switch at all.
9. **Manual recharge.** `Recovery = shortRest | longRest | NLongRests | manual`, with an optional descriptive rule string ("once per in-game month") and a player-pressed "Mark Available" control. Explicitly no calendar, no clock, no date arithmetic anywhere.
10. **Generic summon/unit definitions.** `SummonGrant { definitionId, durationText, mechanicalCount, narrativeCount?, commandCost? }`, reusing the existing monster/entity stat-block system, adding only ownership-by-a-character-feature.
11. **Content-defined Pact Magic.** A `CastingProgression { kind: "pact", ability, recovery, levels: [{classLevel, slots, slotLevel}] }` a homebrew class can author, instead of the engine's current hardcoded `classId === 'warlock'` special case.
12. **Arcanum-style limited spell choice.** `LimitedSpellChoice { unlockLevel, spellLevel, choices, uses, recovery }` as a reusable primitive (today Warlock's Mystic Arcanum is real but not generic).
13. **Repeatable/expanding choice pools with typed prerequisites.** `ChoicePool { id, optionType }` plus a progression of how many choices unlock at which levels, and prerequisites limited to a closed, typed set (class level ≥ N, has feature X, has spell Y, ability ≥ N, manual) — explicitly **no expression language**.

## Explicitly out of scope (the user's own list)

In-app random selection for content tables; calendars; world clocks; automatic month/year tracking; arbitrary formulas or scripts; full mass combat; political simulation; an arbitrary general-purpose RulesModule; special-cased Emperor Warlock code; special-cased Druid code.

**Flag:** point 11 (content-defined casting) and point 13 (typed-prerequisite choice pools) sit close to what "DO NOT start RulesModule" has meant in this project's standing constraints in past sessions — a generalized rules-authoring layer. The user's own "what NOT to add" list draws the line at "no expression language" and "no arbitrary RulesModule," which is the right instinct, but the boundary between "a few new typed primitives" and "a rules engine" is exactly the kind of thing that should be confirmed explicitly before Phase 3, not assumed from this write-up alone.

## UI sketch (from the proposal)

Character sheet shows the active mode with a `[Change]` control. Tapping it shows the current mode, the selector (a normal choice list or, for Emperor Warlock, "select the result you rolled" against the external table), and on picking a new option, a confirmation screen naming exactly what becomes inactive and stating that spent resources are preserved. No Emperor-Warlock-specific UI — the same component would serve a Druid's Wild Shape form picker.

Homebrew builder gets a new "Dynamic Modes" section: add a Mode Group, name it, choose selector type (normal choice vs. external table result), set `requireActiveOption` and switch cost, then author each option's own level-gated progression — without exposing implementation terms like `ModeGroup` to the creator.

## Phased build order (do not skip)

The user is explicit that Emperor Warlock must **not** be the first thing built against this system — it exercises too many of the 13 systems at once to tell which one failed.

1. **Phase 1 — modes foundation.** Items 1–6 plus 9's UI shell and a homebrew Mode builder. Acceptance test: a tiny two-option "Test Form" (Option A: +10 speed, a proficiency, a test action; Option B: STR minimum 18, a test spell, a different test action), switched A → B → A repeatedly, with nothing leaking or resetting incorrectly.
2. **Phase 2 — transformations.** Item 7 (numeric effect semantics), item 8 (switching costs), item 9 (manual recovery) fully wired. Acceptance test: a Wild-Shape-like transformation.
3. **Phase 3 — complex class support.** Items 10–13 (summons/units, content-defined Pact Magic, Arcanum, repeat-choice pools with prerequisites). Only after Phase 1 survives a sequence like `A → B → A → C → A → B` with resources, provenance, actions, spells and derived values all correct, build Emperor Warlock as the real-world test case.

## Before starting

This is a scoped, not-started proposal, same status as the platform backlog and the new-architecture vault. Standing project rules from prior sessions: do not touch A44, do not start a general RulesModule, and large architecture work needs an explicit go-ahead before Phase 1 begins — this document alone is not that go-ahead. If and when work starts, treat the flag above (points 11 and 13 vs. "no RulesModule") as a question to settle first, not a detail to resolve while building.
