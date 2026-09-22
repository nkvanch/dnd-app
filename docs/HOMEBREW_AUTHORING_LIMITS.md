# Homebrew authoring: current limits

A living list of what homebrew creators cannot do in Grimoire today, found while checking whether Emperor Warlock (see [homebrew/EMPEROR_WARLOCK.md](homebrew/EMPEROR_WARLOCK.md)) could be built as designed. Most of these are exactly what [MODE_TRANSFORMATION_LAYER_PROPOSAL.md](MODE_TRANSFORMATION_LAYER_PROPOSAL.md) is trying to close; this file is the evidence for that proposal, kept separate so it stays useful on its own for judging any future homebrew design against the app as it actually is.

Each entry names the gap, why it matters, and what was checked to confirm it.

## No monthly/calendar trigger, no auto-swap of a feature block

There is no in-app concept of an in-game month, and no mechanism that swaps a whole set of active features in and out on any recurring trigger. A design like "re-roll your subclass every month" has nothing to hook into; it would have to be represented as the player manually re-picking, with nothing enforcing when.

Checked: `subclassId` is a single field set once (`src/engine/types.ts:746,762`), not a value that changes on its own after creation.

## No re-selectable choice after it resolves

A `ChoiceDefinition` has a `resolved: boolean` (`src/engine/types.ts:1073,1109`) and nothing in `src/engine/leveling.ts` or `src/engine/choiceEligibility.ts` lets a resolved choice be swapped for a different option later (the only `swap*` function found, `swapBackground`, is unrelated). A design that assumes "you can swap this pick whenever you level up" (Warlock-style invocations, Emperor Warlock's Imperial Edicts) is not supported — it would need to be represented as deleting the old pick and making a fresh one by hand each time, with nothing in the app tracking that it happened.

## No companion builder; companions are a small fixed list

Homebrew has builders for races, subraces, classes, subclasses, spells, items, monsters, feats, backgrounds and conditions (`app/homebrew/*-builder.tsx`), but none for companions. `CompanionTemplate` exists (`src/engine/companion.ts:25`) and is wired only through a hardcoded map from a specific granting feature id to one of three official templates (Steel Defender, Eldritch Cannon, Ranger's Companion) — not something homebrew content can define. A design with several named summoned creatures (a mount, war elephant, mob, a named hero) can at best become separate Monster entries for a DM to place by hand; none of them can be tied to a character feature, have independent turns other players operate, or come and go with a resource.

## No cross-character resource grant

Searched for any mechanism to give or transfer a resource, use, or die to another character's sheet; none exists — every `ResourceCost` and resource pool lives on one character. A design where a player spends an ability to hand a die or a bonus to an ally's sheet cannot be enforced by the app; the receiving player would have to track it on paper.

## No bulk/raw-JSON homebrew authoring

Every homebrew entry is built one field at a time through its builder screen; there is no path that accepts a pasted or imported JSON definition to create new homebrew content (JSON only appears on the *export/import* side of already-built content, via `.grimoire-pack` and character files). A large design (Emperor Warlock is roughly 120 features across twelve spirits plus 60 spirit-granted spells) has to be built by hand through the UI, entry by entry — there is no shortcut for size.

## No attack/save/damage auto-resolution (existing, disclosed limit)

Not new, but worth restating here because it bears on every "does X" question: Grimoire computes the numbers a feature produces (attack bonus, save DC, damage dice) but does not roll dice or resolve outcomes for the player. This is already disclosed for Artificer magic items and elsewhere in the codebase; it applies equally to any new homebrew class.

## What is in fact well supported

For contrast, so this file isn't read as "homebrew barely works":

- **Temporary effects with a real duration** exist and are player-facing (condition duration UI, shipped — see the project's temp-effects track), so a homebrew Condition with `stat_modifier` effects and an expiry is a genuine, not faked, way to model a temporary transformation.
- **Pact Magic** for a homebrew class can follow the same real pattern the official Warlock uses (`pactSlotTableFor`, `PACT_SLOT_TABLES` in `src/content/classes/spellSlotTables.ts`), it just isn't yet a field a creator fills in through a builder screen (see proposal item 11).
- **Resource pools that refresh on a rest, and scale in die size by level,** are ordinary, well-trodden ground.
