# Generic mode / player-state transformation layer — proposal

Status: **PROPOSED, NOT STARTED.** Captured 22 September 2026 from the user's own architecture write-up, triggered by asking whether Emperor Warlock (see [homebrew/EMPEROR_WARLOCK.md](homebrew/EMPEROR_WARLOCK.md)) could be built in Grimoire today. Do not begin implementation from this document alone — see "Before starting" below.

Related: [[project-grimoire-new-architecture-vault]] (a separate, earlier external design-review vault, different scope — ruleset migration, not mode-switching) and [[project-grimoire-platform-backlog]] (the user's other large not-started architecture proposal). This is a third, independent proposal in the same family: verified gaps, not yet approved for build.

## The problem it solves

Several class concepts need "the character has one active alternate state, chosen from a set, that swaps a block of features in and out": Druid Wild Shape, a shapeshifter's current form, an elementalist's stance, and Emperor Warlock's bound spirit. Today each of these would need its own hand-built, special-cased subsystem. The proposal is to build one generic primitive instead, so any of them — including homebrew ones — can be authored without new code per class.

## Design rule for deciding what becomes a primitive

The user's own stated rule, and the one to apply before adding anything from this document to the engine:

> When one weird creation fails, don't immediately add a primitive. When three unrelated creations fail for the same reason, that reason probably deserves a primitive.

Mode Groups already clears that bar on its own: Emperor Warlock's bound spirit, Wild Shape-style forms, and a transforming weapon's states are three unrelated content types failing for the same reason. See [STRESS_TEST_CONTENT_MATRIX.md](STRESS_TEST_CONTENT_MATRIX.md) for the fuller set of test creations this rule should be checked against before any other item on this list gets built.

## Ten categories the stress-test pass surfaced (22 September 2026)

A second pass, testing the same question across races, subclasses, feats, spells, items, backgrounds and monsters/companions (not just classes), sharpened the 13 systems below into ten named categories of missing capability. They aren't a different proposal — each maps onto one or more of the 13 systems — but they're the right level to check new homebrew designs against, and worth keeping as the primary index:

1. **Modes / forms / states** — the core problem above. Maps to systems 1–6, 8–9 below. **Update, 22 September 2026:** the single-binary-form case is partly solved already — a real, class-agnostic `transform` effect swaps the whole stat block for a `BeastForm`'s and reverts cleanly (`src/engine/types.ts:2072`, `src/engine/combat.ts:617`), not hardcoded to Druid. What's still missing is (a) homebrew-authorable forms to transform into — `ALL_BEAST_FORMS` is a fixed 7-entry official list with no builder, same closed-content shape as the companion gap — and (b) the general N-way case with independent per-option persistent state (Emperor Warlock's twelve spirits, switched arbitrarily, each remembering its own spent resources), which Wild Shape's binary shaped-or-not model doesn't attempt. See [THIRD_PARTY_REFERENCE_CONTENT.md](THIRD_PARTY_REFERENCE_CONTENT.md) (Shifter Ranger) for the case that surfaced this.
2. **Replacement effects** (`add | replace | minimum | maximum` on a stat, one shared resolution order) — system 7.
3. **Dynamic grants that clean up after themselves** (spell/action/proficiency/resource/feature/sense/movement/attack/numeric-modifier, added and removed as a unit) — system 6.
4. **Choice dependencies** (a choice's available options depend on an earlier choice's result, e.g. draconic ancestry color gating which breath/resistance options appear) — **confirmed absent**, see [HOMEBREW_AUTHORING_LIMITS.md](HOMEBREW_AUTHORING_LIMITS.md). Typed prerequisites (class level, has-feature, has-spell, ability score, manual) should be enough; no expression language.
5. **Modifying an existing granted thing**, not just adding a new one (Eldritch Blast's range changes, a known spell's damage type changes, a weapon gains reach, an ability now also triggers under a new condition) — **confirmed absent**, and the user is explicitly wary here: start with typed modifications (change range, add damage, replace damage type, add tag, change action cost, add use limit), not arbitrary formulas, or this becomes a rules DSL.
6. **Shared resource pools, multiple costs** — **already supported**, not a gap. `resourceId` is a plain shared string key (see Rage: `resourceId: 'rage_pool'`, referenced by both the activation's `resourceCost` and by `resource_upgrade` grants at later levels). A "6-point psionic pool, telepathy costs 1, mind blast costs 2" design needs no new engine work, only two activations authored against the same `resourceId` with different `quantity`.
7. **Scaling** — explicit level-keyed tables (`L1: 1d6, L5: 2d6, …`) are worth a first-class primitive; typed scaling sources (character level, class level, proficiency bonus, ability modifier, spell level) with simple operations are enough, avoid arbitrary expressions. **Not yet verified** whether today's pattern is "one Feature per threshold" (which risks a stale duplicate lingering after the new one grants) or something cleaner — check before assuming this needs new work, not after.
8. **Summons / linked entities** — system 10. Confirmed absent for homebrew (see limits doc): no companion builder exists, and the fixed official list (Steel Defender, Eldritch Cannon, Ranger's Companion) isn't extensible by content.
9. **Per-target / marked-creature state** ("choose a Rival," "maintain a curse on up to three creatures") — **confirmed absent**. `targetId` exists in the codebase but only as a one-shot field on a grant result or a combat-log event, not as persistent state referencing another entity. **Update, 22 September 2026:** this has now failed three unrelated designs — Emperor Warlock's own Rival mechanic, Napoleon's Chosen Rival, and LaserLlama's Ranger's Quarry (a *base-class* feature three separate published subclasses build on, see [THIRD_PARTY_REFERENCE_CONTENT.md](THIRD_PARTY_REFERENCE_CONTENT.md)). By this document's own design rule above, that's past "flag for later" — it should move into real Phase-3-or-earlier scoping the next time this proposal is revisited, not stay parked as a someday primitive. A `TargetedEffect { source, target, effect, manual end }` shape is still the sketch to start from.
10. **Features that alter other features, without a duplicate lingering** ("Firing Squad's damage becomes 8d6 at level 10" should update one feature's scaling table, not silently coexist with an old 4d6 version; "Wild Shape gets more uses" should be a `resource_upgrade` on the existing pool, which the engine already does for Rage and Bardic Inspiration). This is really category 7 and the existing `resource_upgrade` pattern, named separately here because it's the most common way homebrew creators will get it wrong by hand.

**Corrections to two assumptions in the original write-up**, found while checking: a homebrew **armor item replacing the AC formula outright** (not just adding a bonus) is already available — `base_ac_formula` is wired into the homebrew item builder today (`app/homebrew/item-builder.tsx`). And a subclass where **a one-time choice (a Cleric's domain) grants a static list of always-prepared spells** is an existing, working official-content pattern (`src/content/subclasses/cleric.ts`), not a gap — it only becomes a real gap if the domain is expected to change *after* creation, which is category 1/4's problem, not a new one.

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

## Coverage check: does building this close the stress-test set?

Checked against the generic magic-item stress set in [THIRD_PARTY_REFERENCE_CONTENT.md](THIRD_PARTY_REFERENCE_CONTENT.md), 22 September 2026. Mostly yes, but three things would survive a full, faithful build of everything above:

1. **The homebrew item builder's own UI.** `app/homebrew/item-builder.tsx` hardcodes `resourceCost: null` when authoring a feature's activation — the engine mechanism (shared `resourceId`, proven by Rage) already works, this proposal is entirely about engine/content-model work, and doesn't touch builder screens. A charge-based item (Modular Wand, Returning Grapple Axe) needs someone to separately go expose that field, after this proposal, not as part of it.
2. **Forced movement toward a point or object** (a returning weapon that pulls its wielder to it). Not covered by any of the 13 systems above — checked the `Effect` union again specifically for this. Only failed once so far (this document's Returning Grapple Axe), so it doesn't clear this project's own three-unrelated-failures bar yet either.
3. **Automatically detecting a fact about a target** (bonus damage or resistance against a creature category — Dragon Slayer weapons, anti-fiend armor), as opposed to `Effect.situational`'s player-answered yes/no. Also outside all 13 systems, also only failed once so far.

One genuine uncertainty, not a clean yes or no: whether building item 5 (level-gated mode progression) also happens to fix the already-disclosed level-gated-racial-feature bug (Tiefling, Aasimar, a dozen others) depends on whether it's implemented generally or scoped narrowly to "mode option," as its own wording above currently says. Same underlying shape, not the same thing unless deliberately generalized.

## Before starting

This is a scoped, not-started proposal, same status as the platform backlog and the new-architecture vault. Standing project rules from prior sessions: do not touch A44, do not start a general RulesModule, and large architecture work needs an explicit go-ahead before Phase 1 begins — this document alone is not that go-ahead. If and when work starts, treat the flag above (points 11 and 13 vs. "no RulesModule") as a question to settle first, not a detail to resolve while building.
