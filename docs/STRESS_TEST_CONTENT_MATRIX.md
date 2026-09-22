# Homebrew stress-test content matrix

Status: **PLANNING ARTIFACT, NOT STARTED.** The user's full list of deliberately difficult homebrew creations across every content type, captured 22 September 2026, for checking [MODE_TRANSFORMATION_LAYER_PROPOSAL.md](MODE_TRANSFORMATION_LAYER_PROPOSAL.md) and [HOMEBREW_AUTHORING_LIMITS.md](HOMEBREW_AUTHORING_LIMITS.md) against, before and after any of that proposal is built. None of these are built. This is not the creator-outreach stress test (see `outreach/private/HOMEBREW_GUIDE.md` in the working tree for that, much smaller by design) — this list is for hardening the engine itself.

## Why these, specifically

These don't crash Grimoire. They break its assumptions: a creator gets forced into a lossy text-only description, a stale grant that should have been removed, an impossible mode switch, or a destructive hand-edit to work around a missing primitive. That failure mode is quieter than a crash and easier to miss, which is exactly why it's worth testing for deliberately rather than waiting for a real creator to hit it.

## Full matrix

| Content type | Stress-test creation | What it exposes |
|---|---|---|
| Race / Species | Shapeshifter with Human/Wolf/Bat forms, each changing speed, senses, attacks, proficiencies and stats | Mode switching, stat replacement, form-specific actions |
| Race / Species | A lineage that chooses one ancestry at creation and can later permanently replace it | Exclusive packages, safely replacing grants |
| Race / Species | Traits that change at character level 5/11/17 | Level-gated racial progression |
| Race / Species | One of several body plans at creation: wings, gills, claws, armored hide | Structured choice packages, mutually exclusive grants |
| Subclass | Barbarian stance subclass, 4 mutually exclusive combat stances, switchable as a bonus action | Modes, switch costs, persistent state |
| Subclass | Druid circle with custom Wild Shapes replacing STR/DEX/AC/actions | Numeric replacement, forms |
| Subclass | Fighter subclass, maneuver pool, dice resource, maneuver prerequisites, upgrades | Repeat-choice pools, resource upgrades, prerequisites |
| Subclass | Sorcerer subclass that modifies existing known spells rather than granting new ones | Spell mutation/augmentation |
| Subclass | Cleric-style subclass where the domain choice changes the prepared spell list | Dynamic spell grants — likely already works as a one-time static grant (see proposal doc's corrections); only a real gap if the domain is meant to change after creation |
| Feat | Three modes, chosen after every long rest | Mode packages outside classes |
| Feat | Upgrades if another specific feat is owned | Cross-feature prerequisites |
| Feat | Turns an existing weapon attack into a special action | Derived-action modification |
| Feat | "Choose one spell you know; it now has extra range/damage/type" | User-selected target + modifier on an existing thing |
| Spell | Transforms the caster, replacing AC, speed, attacks and ability scores | Temporary replacement effects |
| Spell | Summons one creature from several selectable templates | Summons + selectable package |
| Spell | Creates a minion whose stats scale from spell level or caster stat | Derived summon scaling |
| Spell | Different effect depending on damage type chosen at cast time | Cast-time modes |
| Spell | Stores a choice made at cast time, used again later | Persistent per-cast state |
| Spell | Modifies another spell already known | Spell-on-spell modification |
| Item | Weapon with Normal / Awakened / Exalted states | Item modes and progression |
| Item | Armor replacing the AC formula rather than adding to it | Replacement semantics — **already supported**, `base_ac_formula` exists in the homebrew item builder |
| Item | Grants different abilities depending on the attuned class | Conditional grants |
| Item | Weapon transforming between sword/bow/spear forms | Mode-specific attacks and equipment identity |
| Item | Charges where different powers consume different amounts | Shared resource pool — **already supported**, see the proposal doc's correction |
| Item | Maximum charges increase at certain character levels | Resource upgrades — already an existing pattern (Rage, Bardic Inspiration) |
| Background | Choose-2-of-8 proficiencies plus a separate choose-one feature package | Nested/repeated choices |
| Background | One choice determines which later choices are available | Choice dependency graph — **confirmed absent** |
| Background | Grants a companion or contact with structured stats | Linked entities |
| Monster / Companion | Two phases at half HP | Mode switching driven by a condition (HP threshold), not a player action |
| Monster / Companion | Transforms into a different stat block | Stat replacement / mode state |
| Monster / Companion | A swarm representing 50 creatures, mechanically acting once | Unit abstraction |
| Monster / Companion | Pet whose stats scale from the owner's proficiency bonus or class level | Owner-derived calculations |

## The ten to actually build and maintain

Rather than all thirty-plus above, the user's plan is to keep about ten intentionally difficult reference creations, revisited whenever the engine changes:

1. **Emperor Warlock** — modes, dynamic spell grants, Edicts (repeat-choice pool), summons, Pact Magic, manual recharge. See [homebrew/EMPEROR_WARLOCK.md](homebrew/EMPEROR_WARLOCK.md). Deliberately *not* the first thing built against the proposal — it exercises too many systems at once (see the proposal doc's phased build order).
2. **Shapeshifter Race** — form switching, numeric replacement, actions, senses and movement.
3. **Stance Fighter Subclass** — rapid switching, a shared resource, action costs, persistent mode state.
4. **Psionic Feat** — shared resources (already supported), choice prerequisites, scaling.
5. **Transforming Magic Weapon** — item modes and action replacement.
6. **Polymorph-style Spell** — temporary stat replacement and granted attacks.
7. **Summoner Spell** — linked-entity creation and scaling.
8. **Branching Background** — nested conditional choices (choice dependency graph).
9. **Two-Phase Monster/Companion** — state switching driven by an external condition, not a player-pressed switch.
10. **Modular Species** — mutually exclusive trait packages plus level progression.

If Grimoire can represent all ten without special-cased code for any single one, the mode/replacement/grant model has earned its place. Build order should follow the proposal doc's phases (a minimal two-option test form first, then a Wild-Shape-style transformation, then Emperor Warlock last) — these ten are the acceptance set for that plan, not a to-do list to work through in this order.

## Before building any of these

Same caveat as the proposal doc: this is a planning artifact. Confirm against the standing project rules (no A44 changes, no general RulesModule) before starting, and re-check the "already supported" items above against the current code rather than trusting this snapshot, since the engine will have moved on by the time building starts.
