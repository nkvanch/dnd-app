# Canonical stress suite and the unified resolution architecture

Status: **PROPOSAL + INDEX, NOT STARTED.** The user's closing synthesis, 22 September 2026, of everything checked across this investigation: one proposed pipeline architecture, and 24 canonical stress cases that push different parts of it. This document doesn't re-derive findings already made — it's the index tying them together, with full prose only for the small number of genuinely new things this pass surfaced.

Related documents this indexes: [homebrew/EMPEROR_WARLOCK.md](homebrew/EMPEROR_WARLOCK.md), [MODE_TRANSFORMATION_LAYER_PROPOSAL.md](MODE_TRANSFORMATION_LAYER_PROPOSAL.md), [STRESS_TEST_CONTENT_MATRIX.md](STRESS_TEST_CONTENT_MATRIX.md), [HOMEBREW_AUTHORING_LIMITS.md](HOMEBREW_AUTHORING_LIMITS.md), [THIRD_PARTY_REFERENCE_CONTENT.md](THIRD_PARTY_REFERENCE_CONTENT.md).

## The proposed pipeline

```
Authored Definition
→ Content Resolution
→ Character/Entity Eligibility
→ Choice Resolution
→ Grant/Modifier Resolution
→ Runtime State
→ Derived Calculation
→ Effective Sheet/UI
→ Persistence + Undo/Timeline
```

**Worth stating plainly: this is not a break from what exists, it's a cleaner description of it.** `recomputeDerived` (`src/engine/pipeline.ts:132`) already collapses Grant/Modifier Resolution → Runtime State → Derived Calculation into one recompute pass driven by `collectAllEffects`, confirmed by direct reading (not assumed) to re-gather from every live source fresh each call, with DM overrides applied last and winning, exactly the kind of single deterministic precedence path the pipeline calls for. Persistence + Undo/Timeline is separately real and shipped. The gap between this proposal and the current app isn't the shape of the pipeline — it's that several content types (items, monsters, races beyond the fixed patterns already proven) don't yet have authoring surfaces that reach every stage of it, and that a few grant kinds (modes as a keyed collection, targeted modifiers, summons, linked entities) don't exist as primitives yet. That's the same conclusion [MODE_TRANSFORMATION_LAYER_PROPOSAL.md](MODE_TRANSFORMATION_LAYER_PROPOSAL.md) already reached, now confirmed from the resolution-order side rather than the content side.

## The 24 tests, cross-referenced

Every one of these already has a documented answer from this investigation except three points, called out in full below the table. "Where" links to the existing finding rather than repeating it.

| # | Test | Already covered by |
|---|---|---|
| 1 | Class A — Modular Engineer | Build A (Modular Psychic Engineer) — specialization pattern already works, companion owner-stat formula confirmed absent, item charges blocked by builder UI not the engine |
| 2 | Class B — Psionic Adept | Shared resource pools already work (Rage pattern). **"Power ≠ SpellDefinition" — new, see below.** |
| 3 | Subclass A — Shifter | Mode Groups findings — `transform` is real but a closed content list and a singleton slot |
| 4 | Subclass B — Wrangler | Per-target state confirmed absent (Ranger's Quarry). **Companion action exposure on the owner's sheet — new, see below, confirmed working.** |
| 5 | Subclass C — Bounty Hunter | Repeat-choice pools already work (Battle Master precedent). Retraining ("remove replaced maneuver only") is the same confirmed-absent no-re-selectable-choice gap — you can add via unused slots, not swap a resolved pick |
| 6 | Race/Species A — Fox Shifter | Hengeyokai findings. Species-identity-vs-current-form separation is already correct by construction — Wild Shape's own code comment confirms mental scores and base identity are never overwritten, only overlaid |
| 7 | Race/Species B — Modular Lineage | Point-budget choice confirmed absent. "Remove Trait A, reevaluate dependent Trait B" is the confirmed-absent choice-dependency-graph gap |
| 8 | Subrace/Lineage A — Celestial Transformation Lineage | Elfriche Aasimar findings — official Aasimar's own level-gated transformation ships as `effects: []`, reference-only |
| 9 | Subrace/Lineage B — Progressive Spell Lineage | Level-gate gap confirmed absent (a dozen+ races). "Class also grants the same spell, removing lineage must not remove class access" is exactly what the provenance findings (Build C) already confirmed sound |
| 10 | Spell A — Template Summon | Spell-summon gap confirmed completely absent (KibblesTasty/Spaghetti0 finding) |
| 11 | Spell B — Swarm Summon | Swarm gap confirmed completely absent, plus the summon gap above |
| 12 | Spell C — Battle Transformation | Mode/transform findings. "Never overwrite stored base STR/AC" is already correct — confirmed non-mutating overlay philosophy in `pipeline.ts`, same as Wild Shape and `DmOverride` |
| 13 | Spell D — Elemental Configuration | **New, see below** — cast-time choice persisting for a spell's duration |
| 14 | Spell E — Arcane Reconfiguration | Modify-existing-grant gap confirmed absent (Eldritch Blast range, Bound Weapon, Dragon Slayer) |
| 15 | Magic Item A — Tri-Form Weapon | Item mode gap confirmed absent — no item-level mode mechanism at all |
| 16 | Magic Item B — Returning Grapple Axe | Item charges: engine supports it, builder UI doesn't expose it. Pull/forced-movement confirmed absent |
| 17 | Magic Item C — Living Armor | `situational` conditional effects already work. Automatic creature-category detection confirmed absent (Dragon Slayer) |
| 18 | Magic Item D — Awakened Relic | Mode gap, mildest form — one-way progression, manual-tracking workaround genuinely viable |
| 19 | Magic Item E — Modular Wand | Same as 16's charges finding |
| 20 | Monster A — Two-Phase Boss | HP-threshold trigger confirmed absent, `MonsterTemplate` has exactly one stat/action package. Legendary/mythic action pools already work |
| 21 | Monster B — Legion/Swarm | Swarm gap confirmed completely absent |
| 22 | Monster C — Skinchanger | `transform` confirmed working on monsters too, same closed-form-list caveat |
| 23 | Character Build A — Modular Psychic Engineer | Provenance/precedence confirmed architecturally sound, read directly from `recomputeDerived` |
| 24 | Character Build B — Transforming Hunter | `wildShapeState` confirmed as a singleton slot — two full-replacement modes collide, a condition-based mode does not |

## The three genuinely new findings

### "Power ≠ SpellDefinition" — already true, worth confirming rather than assuming

Checked whether the engine forces supernatural abilities through the `Spell` content type. It doesn't: `Feature.activation` (action type, resource cost, range, target, save) and `Feature.abilityEffects` are the general-purpose mechanism every content type already uses — classes, races, items, conditions, and monsters all grant plain `Feature`s, not spells. A Psionic Adept's powers can be authored as ordinary Features with their own resource cost against a shared `psionic_energy` pool (the same proven Rage-style pattern), with no need to route through `Spell` at all. This was a reasonable thing to check rather than assume, and it checks out clean.

### Companion actions are already exposed and triggerable from the owner's sheet

Checked `CompanionSection.tsx` directly rather than assuming this was another gap. It's real: the owner's sheet renders `companion.actionCards` and exposes `Pressable` controls that trigger companion actions (including summoning). For the three official companion types (Steel Defender, Eldritch Cannon, Ranger's Companion), "expose a command action on the owner's sheet, reference the linked companion" — Wrangler's own requirement — already works today. The actual gap remains exactly what's already documented: no homebrew companion builder, and no owner-stat-derivation formula (Steel Defender's own AC feature admits this directly in its description text).

### Cast-time choice that persists for a spell's duration — confirmed absent, and it explains more than one prior finding

Checked the `Spell` type directly. It has real mechanical teeth — `onConcentrationFeatures?: Feature[]`, genuinely consumed in `src/engine/combat.ts:307-316`, not decorative — but it's a **fixed list**, not something a cast-time choice can branch into. Official Protection from Energy ("resistance to one damage type of your choice") has no `effects`, `choices`, or populated `onConcentrationFeatures` at all — just a description string, same as most other spells checked throughout this investigation.

Worse for authoring: the homebrew spell builder doesn't expose `onConcentrationFeatures` at all. Its own code comment says so outright: *"this builder currently has no UI to AUTHOR onConcentrationFeatures at all... the same honest 'mechanism built, no content exercises it yet' situation this app already has elsewhere"* (`app/homebrew/spell-builder.tsx:150-154`). Same shape as the item-builder charges gap — the engine mechanism exists, the authoring surface doesn't reach it.

This single finding is the root cause behind more of this document set than it looks: spell-based summons being text-only, spells generally lacking structured effects, and Elemental Configuration's cast-time branch all trace back to the same fact — `Spell` carries far less structured mechanical data than `Feature` does, almost everywhere it's used in official content.

## What this confirms about the overall shape of the gaps

Read together, the pattern across all 24 tests sorts cleanly into three kinds, worth keeping distinct when any of this gets built:

1. **Genuinely missing engine primitives** — Mode Groups as a keyed collection, targeted modifiers, summons/linked entities, HP-threshold triggers, swarm abstraction, point-budget choices, choice dependencies, per-target state, forced movement, automatic creature-category detection.
2. **Engine mechanism exists, authoring surface doesn't reach it** — item charges (`resourceCost` hardcoded null in the item builder), spell concentration features (`onConcentrationFeatures` unexposed in the spell builder), homebrew companions and beast forms (no builder at all, closed official lists).
3. **Already sound, confirmed by reading the code rather than assumed** — provenance and override precedence, shared resource pools, legendary/lair actions, conditional (`situational`) effects, non-mutating overlay philosophy for temporary state, species-identity-vs-current-form separation, powers not being forced through the spell system, companion actions already being exposed on the owner's sheet.

Category 3 matters as much as the other two for planning: a large fraction of what this 24-test suite worried about turned out to already work, confirmed by reading the actual resolution code rather than assumed from the outside.
