# Homebrew authoring: current limits

A living list of what homebrew creators cannot do in Grimoire today, found while checking whether Emperor Warlock (see [homebrew/EMPEROR_WARLOCK.md](homebrew/EMPEROR_WARLOCK.md)) could be built as designed. Most of these are exactly what [MODE_TRANSFORMATION_LAYER_PROPOSAL.md](MODE_TRANSFORMATION_LAYER_PROPOSAL.md) is trying to close; this file is the evidence for that proposal, kept separate so it stays useful on its own for judging any future homebrew design against the app as it actually is. [THIRD_PARTY_REFERENCE_CONTENT.md](THIRD_PARTY_REFERENCE_CONTENT.md) applies the same checks to five published third-party classes and updates two of the entries below.

Each entry names the gap, why it matters, and what was checked to confirm it.

## No monthly/calendar trigger, no auto-swap of a feature block

There is no in-app concept of an in-game month, and no mechanism that swaps a whole set of active features in and out on any recurring trigger. A design like "re-roll your subclass every month" has nothing to hook into; it would have to be represented as the player manually re-picking, with nothing enforcing when.

Checked: `subclassId` is a single field set once (`src/engine/types.ts:746,762`), not a value that changes on its own after creation.

## No re-selectable choice after it resolves

A `ChoiceDefinition` has a `resolved: boolean` (`src/engine/types.ts:1073,1109`) and nothing in `src/engine/leveling.ts` or `src/engine/choiceEligibility.ts` lets a resolved choice be swapped for a different option later (the only `swap*` function found, `swapBackground`, is unrelated). A design that assumes "you can swap this pick whenever you level up" (Warlock-style invocations, Emperor Warlock's Imperial Edicts) is not supported — it would need to be represented as deleting the old pick and making a fresh one by hand each time, with nothing in the app tracking that it happened.

## No companion builder; companions are a small fixed list

Homebrew has builders for races, subraces, classes, subclasses, spells, items, monsters, feats, backgrounds and conditions (`app/homebrew/*-builder.tsx`), but none for companions. `CompanionTemplate` exists (`src/engine/companion.ts:25`) and is wired only through a hardcoded map from a specific granting feature id to one of three official templates (Steel Defender, Eldritch Cannon, Ranger's Companion) — not something homebrew content can define. A design with several named summoned creatures (a mount, war elephant, mob, a named hero) can at best become separate Monster entries for a DM to place by hand; none of them can be tied to a character feature, have independent turns other players operate, or come and go with a resource.

## Spell-cast summons have no support at all, not even a fixed list

Stricter than the companion gap above: companions at least have three real, working hardcoded examples. A spell that creates a temporary, player-controlled, slot-scaling creature — the entire "Summon X" family Tasha's Cauldron introduced — has none. Checked the actual official spell content: all 12 official summon spells already in `src/content/spells/generated.ts` (`summon_fey`, `summon_beast`, `summon_undead`, and the rest) are pure placeholder text, e.g. `"description": "Description not available (not OGL).\n\nBut here is a summary: Summon 1 fey spirit... friendly (stat block/your lvl)."`. No effect data, no scaling, no link to any stat block, no control handed to the player. Searched the whole `Effect`/`Grant` union for anything resembling a spell-cast summon — nothing exists. Any expansion of this spell family, official or homebrew, needs this built from nothing. See [THIRD_PARTY_REFERENCE_CONTENT.md](THIRD_PARTY_REFERENCE_CONTENT.md) for the KibblesTasty case this was checked against.

## No cross-character resource grant

Searched for any mechanism to give or transfer a resource, use, or die to another character's sheet; none exists — every `ResourceCost` and resource pool lives on one character. A design where a player spends an ability to hand a die or a bonus to an ally's sheet cannot be enforced by the app; the receiving player would have to track it on paper.

## No bulk/raw-JSON homebrew authoring

Every homebrew entry is built one field at a time through its builder screen; there is no path that accepts a pasted or imported JSON definition to create new homebrew content (JSON only appears on the *export/import* side of already-built content, via `.grimoire-pack` and character files). A large design (Emperor Warlock is roughly 120 features across twelve spirits plus 60 spirit-granted spells) has to be built by hand through the UI, entry by entry — there is no shortcut for size.

## No choice dependency graph

`ChoiceDefinition` (`src/engine/types.ts:1064`) has no field for "this choice's options depend on how an earlier choice resolved." Checked every field on the type; nothing like `dependsOn` or a prerequisite-choice-id exists. A design like "choose Draconic Ancestry color, then a color-specific breath/resistance choice appears" cannot be expressed as data today — it would have to be flattened into one long choice list covering every combination, or left as descriptive text the player follows by hand. This is the confirmed gap behind the "Branching Background" and "Modular Species" stress-test entries in [STRESS_TEST_CONTENT_MATRIX.md](STRESS_TEST_CONTENT_MATRIX.md).

## No persistent per-target (marked-creature) state

`targetId` exists in the codebase (`src/engine/types.ts:157` on `GrantResult`, `:2381` on a combat-log event) but both are one-shot — recording what a grant or a logged action pointed at, not a durable reference a character sheet keeps to another entity. A design like "choose a Rival, get a bonus against them until you choose a new one" or "maintain a curse on up to three creatures" has nothing to attach that state to.

**Update, 22 September 2026:** originally flagged as a future primitive, explicitly out of scope for the mode-transformation proposal's first three phases. It has since failed three unrelated designs — Emperor Warlock's Rival, Napoleon's Chosen Rival, and LaserLlama's Ranger's Quarry (a base-class feature three published subclasses build on, see [THIRD_PARTY_REFERENCE_CONTENT.md](THIRD_PARTY_REFERENCE_CONTENT.md)). By the project's own "three unrelated failures" rule this should be re-scoped earlier than originally planned, not left parked. The sketch is still `TargetedEffect { source, target, effect, manual end }`.

## Transformation exists, but only into a closed set of official forms

Correcting an earlier gap in this document: a real, class-agnostic transformation mechanism already exists — the `transform` effect (`src/engine/types.ts:2072`), resolved identically for any class (`src/engine/combat.ts:617`, rendered generically in `src/engine/actionCards.ts:380`), swapping the whole stat block for a `BeastForm`'s and reverting cleanly. This is not hardcoded to Druid.

What's still missing: `ALL_BEAST_FORMS` (`src/content/beastforms/index.ts`) is a fixed 7-entry official list, with no homebrew builder and no merge point in `homebrewStore.ts`. A design that needs to transform into something not on that list — LaserLlama's Shifter Ranger ("shift into whatever beast you touched") is the case that surfaced this — has the switching mechanism available but nothing new to switch into. Same closed-content shape as the missing companion builder, one level over.

## No level-gated racial features — spells or otherwise — beyond character level 1

Not a suspicion — this is already disclosed, repeatedly, in the app's own shipped official content, and it's broader than just spells. Over a dozen races (Tiefling bloodlines, Air/Fire/Water Genasi, Drow, Duergar, Eladrin's seasonal Fey Step, and more) grant a cantrip at 1st level with a comment stating the follow-up spell at 3rd or 5th level doesn't actually activate, because "this app doesn't yet support level-gated racial features" (`src/content/races/index.ts`, e.g. line 32, line 1012, line 1553, and a dozen more matches for the same phrase).

It isn't limited to spells: official Aasimar's own signature feature — the level-3, bonus-action Celestial Revelation transformation (Radiant Soul / Radiant Consumption / Necrotic Shroud) — is shipped the same way. Checked the code (`src/content/races/index.ts:2443-2470`): the prompt literally says *"unlocks at 3rd level — reference only, see below"*, and every one of the three features has an empty `effects: []`. The gap is level-gating in general, not a spell-specific one.

Any homebrew race using the common cantrip-at-1/spell-at-3/spell-at-5 shape, or a level-gated self-transformation like Aasimar's, inherits this exact gap. See [THIRD_PARTY_REFERENCE_CONTENT.md](THIRD_PARTY_REFERENCE_CONTENT.md) for the Kitsune, Elfriche Aasimar and Tlakah cases this surfaced — three unrelated race designs now, past this project's own "three unrelated failures" threshold.

## No point-budget choice, only fixed-count choices

`ChoiceDefinition.count` (`src/engine/types.ts:1064`) is always a fixed number of picks from a pool — there is no way to spend a shared point budget across options of different costs ("2 cheap traits or 1 expensive one"). The only point-budget mechanism in the engine at all is `PointBuyConfig`, hardcoded to ability-score generation (`src/engine/pointBuy.ts`), not a general-purpose choice type. A "build your own lineage from a costed trait menu" design — the modular-lineage/Custom Race System pattern — can't express its central mechanic as one choice; it would have to be flattened into a fixed set of pre-costed bundles instead, which works but loses the actual point-buy flexibility.

## No primitive for modifying an existing granted thing

Every grant type adds something (a feature, a spell, a proficiency, a resource) — none of them change something already granted. "Your Eldritch Blast range becomes 300 ft," "one spell you know now deals psychic instead of fire," "your longsword attacks gain reach" all need to locate an existing grant and alter one typed property of it, which nothing in `src/engine/types.ts`'s grant/effect union supports today. The mode-transformation proposal calls for starting with a small typed set (change range, add damage, replace damage type, add tag, change action cost, add use limit) rather than an open formula system, specifically to avoid this becoming a rules DSL.

This isn't limited to spells or class features. Even Versatile — the single most common weapon-mode mechanic in core 5e — is stored as a plain string (`properties: ['versatile (1d8)']`, `src/content/items/index.ts:80` and several more), not a real switchable damage die. And official Dragon Slayer weapons, which should deal bonus damage against a creature category, ship with `effects: []`, empty — the flavor text says it, nothing computes it. See [THIRD_PARTY_REFERENCE_CONTENT.md](THIRD_PARTY_REFERENCE_CONTENT.md)'s magic-item stress set for both.

## The item builder UI doesn't expose charges, even though the engine could carry them

A narrower, cheaper-to-fix gap than it first looks. `Item` has no dedicated charges field at all — but an item's `Feature.activation.resourceCost` uses the exact same shared `resourceId` mechanism already proven working for Rage, so the underlying data model has no problem with an item having its own resource pool, or several item powers sharing one at different costs. The actual block is narrower: the homebrew item builder hardcodes `resourceCost: null` when building a feature's activation (`app/homebrew/item-builder.tsx:279`) and never exposes it as an editable field. A charge-based magic item (a wand, a returning weapon with a shared-charge alternate use) can't be authored today, but the fix is "expose an existing field in one screen," not "design a new resource system."

## Corrections: three things that looked like gaps but are not

- **Shared resource pools with different per-ability costs** (e.g. a 6-point pool where one ability costs 1 and another costs 2) need no new engine work. `resourceId` is already a plain shared string key — Rage (`resourceId: 'rage_pool'`, `src/content/classes/index.ts:409,413`) is spent by one activation and later upgraded in place by a `resource_upgrade` grant at level 6. Two homebrew activations referencing the same `resourceId` with different `quantity` values already share one pool correctly.
- **Armor that replaces the AC formula instead of adding a bonus** already exists for homebrew: `base_ac_formula` is a real `StrategyKind` (`src/engine/types.ts:134`) and is wired into the homebrew item builder (`app/homebrew/item-builder.tsx:261`), not just official content.
- **A conditional effect gated on a yes/no fact** (a resistance that only applies "while in sunlight," an ability that changes "while underwater") already works: `Effect.situational?: { id, question }` (`src/engine/types.ts:1383`) is answered per-entity via `Entity.situationalAnswers` and genuinely consumed to gate the effect (`src/engine/pipeline.ts:432`). The limit is that it always needs a player answer — it never automatically infers a fact (such as "this attacker is a fiend") from game state.

## No attack/save/damage auto-resolution (existing, disclosed limit)

Not new, but worth restating here because it bears on every "does X" question: Grimoire computes the numbers a feature produces (attack bonus, save DC, damage dice) but does not roll dice or resolve outcomes for the player. This is already disclosed for Artificer magic items and elsewhere in the codebase; it applies equally to any new homebrew class.

## What is in fact well supported

For contrast, so this file isn't read as "homebrew barely works":

- **Temporary effects with a real duration** exist and are player-facing (condition duration UI, shipped — see the project's temp-effects track), so a homebrew Condition with `stat_modifier` effects and an expiry is a genuine, not faked, way to model a temporary transformation.
- **Pact Magic** for a homebrew class can follow the same real pattern the official Warlock uses (`pactSlotTableFor`, `PACT_SLOT_TABLES` in `src/content/classes/spellSlotTables.ts`), it just isn't yet a field a creator fills in through a builder screen (see proposal item 11).
- **Resource pools that refresh on a rest, and scale in die size by level,** are ordinary, well-trodden ground.
