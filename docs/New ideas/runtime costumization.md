Yes — that interpretation makes much more sense, and it changes how I’d define the old “homebrew override” concept.

It probably wasn’t really about **homebrew content** at all. It sounds more like a **live runtime customization layer** for ad hoc play changes:

```text
during play:
+ add temporary/custom feat
+ remove a feature
+ add an ability
+ change movement
+ add a sense
+ change proficiency
+ grant a spell
+ disable something
```

That is conceptually different from authored homebrew.

I’d split the terms cleanly:

```text
HOME BREW
= persistent authored content
= reusable
= can be exported/shared
= goes through the normal content system

LIVE OVERRIDE / FREE EDIT
= runtime mutation for this character/session
= immediate
= may not correspond to a formal content definition
= layered on top of normal rules
= removable/reversible
```

That seems to match what you remember much better.

For example, if the DM says:

> “You drank from the shrine. You now have darkvision 60 ft until sunrise.”

you should not need to:

```text
create Homebrew Feature
save it
add to library
grant it
```

You want:

```text
Free Edit
→ Add Sense
→ Darkvision
→ 60 ft
→ label: Shrine blessing
→ temporary
```

Likewise:

```text
Free Edit
→ Add Feature
→ "Stone Skin"
→ +1 AC
→ resistance: slashing
```

That is a live-play tool.

## I would therefore preserve the idea, but rename it

I would **not call it Homebrew Override** anymore.

Something like:

```text
Runtime Override
Live Modification
Free Edit Layer
Manual Grant Layer
```

Of those, I think **Free Edit Layer** or **Runtime Override Layer** is clearest.

Then your architecture becomes:

```text
Official Content
       │
       ├── normal definitions
       │
Homebrew Content
       │
       ├── same definitions
       │
       ▼
Character build/progression
       │
       ▼
Runtime Entity
       │
       ├── Conditions
       ├── Temporary Effects
       ├── Free Edit / Runtime Overrides
       └── DM Overrides
```

Though I would probably merge **Free Edit** and **DM Override** conceptually, because they are both manual runtime interventions.

The difference is mostly permission/source:

```text
ManualOverride
├── createdBy: player | dm
├── label
├── scope
├── mechanics
└── removable
```

Then:

```text
player in solo mode
→ may create manual override

DM in multiplayer
→ may create manual override

normal player
→ maybe cannot
```

That is much cleaner than having separate engines.

## Important distinction: override vs grant

Not every live change should be a literal “override.”

For example:

```text
Set AC to 18
```

is an override.

But:

```text
Gain darkvision 60 ft
Gain proficiency in Stealth
Gain a custom feat
Gain +10 ft movement
Gain a temporary ability
```

is better thought of as a **manual grant** or runtime-added feature.

So I would avoid making `OverrideLayer` mean everything.

Instead:

```text
ManualModificationLayer
├── Overrides[]
├── AddedFeatures[]
├── RemovedFeatures[]
├── AddedEffects[]
├── AddedActivations[]
├── AddedResources[]
└── maybe AddedProficiencies[]
```

Or even better, reuse the existing mechanical primitives:

```text
ManualModification
├── source/label
├── active
├── grants[]
├── effects[]
└── overrides[]
```

Then a live blessing can be:

```text
ManualModification
name: "Shrine Blessing"

grants:
  FeatureGrant("Darkvision")

effects:
  MovementEffect(+10)

override:
  none
```

And:

```text
ManualModification
name: "DM correction"

override:
  AC = 19
```

That preserves meaning.

## This also solves the “unsupported mechanics” question

Earlier we were worried that `OverrideLayer` could become the dumping ground for anything the engine cannot model.

Your remembered intent gives us a good rule:

> **Manual modification exists because tabletop play can invent state faster than the formal content system can. It is not the fallback implementation mechanism for authored content.**

So:

```text
A published homebrew feat
→ must use proper structured mechanics where supported

A one-session divine blessing
→ manual modification is perfectly valid

A weird unique magical event
→ manual modification is perfectly valid

A commonly recurring mechanic
→ eventually promote it into a reusable core primitive
```

That fits your answer about the long tail extremely well.

I’d therefore revise the earlier conclusion:

**Do not delete the old override idea.**
Instead, **separate it completely from “Homebrew” and redefine it as the live/manual modification system.**

That feels like the original intent you’re remembering.


That clarification changes my answer on the old “homebrew override” point quite a bit.

What you have is not really a runtime override layer at all. It is a **content precedence / collision-resolution behavior**, implemented inconsistently by content type.

I would reclassify it like this:

```text
Homebrew override
≠ runtime manual edit
≠ DM override
≠ temporary effect

Homebrew override
= content source precedence when two definitions share the same ID
```

And based on what you found, the current app has three different behaviors:

```text
SPELLS
official + homebrew
→ same id
→ homebrew wins

RACES / CLASSES / BACKGROUNDS / CONDITIONS / FEATS
official + homebrew
→ same id
→ duplicates appear

BUILT-IN HOMEBREW
hardcoded seed + edited SQLite copy
→ edited SQLite copy wins on load
```

That means the actual missing abstraction is not `OverrideLayer`; it is something closer to:

```text
ContentResolutionPolicy
```

or:

```text
ContentPrecedence
```

## I would centralize this now

Not because you need a grand pack-priority system immediately, but because Phase 5 is about to make this exact ambiguity visible.

Instead of three files independently doing:

```ts
const homebrewIds = new Set(homebrewSpells.map(s => s.id));
const merged = [
  ...official.filter(s => !homebrewIds.has(s.id)),
  ...homebrewSpells,
];
```

I would want one registry-level merge rule.

Conceptually:

```ts
resolveContentLayers([
  official,
  builtInHomebrew,
  userHomebrew,
])
```

with one deterministic policy.

For example:

```text
lower precedence
Official content
    ↓
Built-in editable content
    ↓
User homebrew
higher precedence
```

Then:

```text
same rulesetId
same contentType
same contentId
→ highest-precedence definition wins
```

That gives you the spell behavior everywhere instead of only in spell pickers.

## But Phase 5 adds another axis: ruleset specificity

This is where it becomes important not to reduce the key to just `id`.

You already wanted content identity to be conceptually:

```text
(rulesetId, contentType, id)
```

So a 5e Human and a 5.5e Human are not necessarily an override collision at all.

They can coexist:

```text
(dnd5e-2014, species, human)
(dnd5e-2024, species, human)
```

Then the active character's `rulesetId` scopes the lookup first.

That means Phase 5 resolution should probably be:

```text
1. Select matching ruleset
2. Select matching content type
3. Group by content id
4. Resolve source precedence inside that ruleset
```

Like:

```text
Character ruleset = dnd5e-2024
        │
        ▼
Filter all content to dnd5e-2024
        │
        ▼
species:human candidates
        │
        ├── official
        └── user homebrew
                │
                ▼
         user homebrew wins
```

A 2014 Human should not participate in that collision at all.

## The tricky case is legacy untagged content

This is where your note becomes directly useful.

Suppose today you have:

```text
human
rulesetId = undefined
```

and Phase 5 introduces:

```text
human
rulesetId = dnd5e-2024
```

Now the question is:

> Does the tagged version shadow the untagged legacy version for a 5.5e character?

I think the clean migration behavior is:

```text
Exact ruleset match
    beats
legacy/unscoped fallback
```

So lookup could behave like:

```text
For dnd5e-2024 character:

1. exact dnd5e-2024 match
2. otherwise compatible legacy/unscoped content
3. otherwise unavailable
```

That uses the precedent you already have:

> later / more specific source wins

but formalizes “more specific” instead of relying on array order.

## I would not make “later array entry wins” the real rule

It is useful precedent, but I would not preserve the implementation accident.

This:

```text
later entry wins
```

is fragile because then behavior depends on:

```text
load order
import order
store order
pack order
```

Instead, make precedence explicit.

For example:

```ts
type ContentCandidate = {
  definition: ContentDefinition;
  sourceKind:
    | "official"
    | "builtin_editable"
    | "homebrew";
  rulesetSpecificity:
    | "exact"
    | "legacy_fallback";
};
```

Then compare:

```text
ruleset specificity first
source precedence second
version / pack rule third if needed
```

Conceptually:

```text
Exact ruleset + user homebrew
    >
Exact ruleset + official
    >
Legacy fallback + user homebrew
    >
Legacy fallback + official
```

Though I would be cautious about the exact ordering until you define how legacy content should migrate.

## This also changes what I would write in the architecture response

I would replace the old section about “homebrew override” with something like:

> **Homebrew override is not a separate runtime system. It is existing content-collision precedence. Spells already implement “homebrew wins by ID,” built-in editable content uses a similar precedence rule, while several other content types currently concatenate without deduplication. This should be centralized in `ContentRegistry` as one deterministic content-resolution policy. Runtime DM/free-edit overrides remain a separate concept.**

Then:

```text
Content resolution
├── ruleset scope
├── content type
├── content ID
└── source precedence
```

That is much cleaner.

## I would probably make this part of the Phase 5 proof slice

Because now your single revised species can validate exactly this.

For example:

```text
official legacy Human
id = human
rulesetId = none

official 2024 Human
id = human
rulesetId = dnd5e-2024
```

Tests:

```text
5e character
→ gets legacy/2014 Human

5.5e character
→ gets exact 2024 Human

5.5e + homebrew 2024 Human
→ gets homebrew 2024 Human

5e + homebrew 5e Human
→ gets homebrew 5e Human
```

And importantly:

```text
content browser
→ no accidental duplicates
```

That would turn the current inconsistency into a properly validated infrastructure feature.

So yes: **this is worth reusing, but as precedent for a centralized content precedence rule—not by preserving the current copy-pasted filtering implementation.**

And I think this is actually one of the most useful things to lock down before Phase 5 content volume starts.

